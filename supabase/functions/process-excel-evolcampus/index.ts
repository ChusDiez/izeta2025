import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://cdn.sheetjs.com/xlsx-0.20.1/package/xlsx.mjs";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ExcelTestRow {
  subject?: string;
  topic?: string;
  activity?: string;
  max_score?: number;
  corrected_by?: string;
  first_attempt?: string;
  attempts?: number;
  last_attempt?: string;
  score?: number;
}

interface StudentInfo {
  name?: string;
  lastname?: string;
  email?: string;
  dni?: string;
  course?: string;
  group?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { bucket, fileName } = await req.json();

    if (!bucket || !fileName) {
      throw new Error("Falta bucket o fileName en la petición");
    }

    console.log(`📄 Procesando archivo: ${fileName} del bucket: ${bucket}`);

    // Descargar el archivo del bucket
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from(bucket)
      .download(fileName);

    if (downloadError) {
      throw new Error(`Error descargando archivo: ${downloadError.message}`);
    }

    // Convertir blob a ArrayBuffer
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Parsear Excel
    const workbook = XLSX.read(uint8Array, { type: "array", cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];

    // Convertir a array de arrays para procesar manualmente
    const rawData = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1, 
      raw: false,
      dateNF: 'yyyy-mm-dd'
    }) as any[][];

    // Extraer información del estudiante de las primeras filas
    const studentInfo: StudentInfo = {};
    
    // Buscar el email y DNI en las primeras 20 filas
    for (let i = 0; i < Math.min(20, rawData.length); i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      // Buscar patrones comunes
      const rowText = row.join(" ").toLowerCase();
      
      // Email
      if (rowText.includes("email") || rowText.includes("correo")) {
        const emailMatch = rowText.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/);
        if (emailMatch) {
          studentInfo.email = emailMatch[1];
        }
      }
      
      // DNI
      if (rowText.includes("dni") || rowText.includes("nif")) {
        const dniMatch = rowText.match(/([0-9]{8}[A-Z])/);
        if (dniMatch) {
          studentInfo.dni = dniMatch[1];
        }
      }

      // Nombre
      if (rowText.includes("nombre") && !rowText.includes("asignatura")) {
        // Buscar el valor en la siguiente columna
        for (let j = 0; j < row.length - 1; j++) {
          if (row[j]?.toLowerCase().includes("nombre")) {
            studentInfo.name = row[j + 1];
          }
          if (row[j]?.toLowerCase().includes("apellido")) {
            studentInfo.lastname = row[j + 1];
          }
        }
      }

      // Curso
      if (rowText.includes("curso") || rowText.includes("estudio")) {
        for (let j = 0; j < row.length - 1; j++) {
          if (row[j]?.toLowerCase().includes("curso")) {
            studentInfo.course = row[j + 1];
          }
        }
      }
    }

    // Si no encontramos email en el contenido, intentar extraerlo del nombre del archivo
    if (!studentInfo.email) {
      // Patrón: expediente-nombre-apellidos-email.xlsx
      const fileNameParts = fileName.toLowerCase().split('-');
      const emailPart = fileNameParts.find(part => part.includes('@'));
      if (emailPart) {
        studentInfo.email = emailPart.replace('.xlsx', '');
      }
    }

    if (!studentInfo.email) {
      throw new Error("No se pudo encontrar el email del estudiante en el archivo");
    }

    // Buscar la fila de cabecera (donde está "Asignatura")
    let headerRowIndex = -1;
    for (let i = 0; i < rawData.length; i++) {
      if (rawData[i] && rawData[i][0] === "Asignatura") {
        headerRowIndex = i;
        break;
      }
    }

    if (headerRowIndex === -1) {
      throw new Error("No se encontró la cabecera de la tabla de tests");
    }

    // Mapear columnas
    const headers = rawData[headerRowIndex];
    const columnMap: Record<string, number> = {};
    
    headers.forEach((header, index) => {
      const h = header?.toString().toLowerCase() || "";
      if (h.includes("asignatura")) columnMap.subject = index;
      if (h.includes("tema")) columnMap.topic = index;
      if (h.includes("actividad")) columnMap.activity = index;
      if (h.includes("nota máxima")) columnMap.max_score = index;
      if (h.includes("corregido")) columnMap.corrected_by = index;
      if (h.includes("primer intento")) columnMap.first_attempt = index;
      if (h.includes("intentos")) columnMap.attempts = index;
      if (h.includes("último intento")) columnMap.last_attempt = index;
      if (h.includes("nota") && !h.includes("máxima")) columnMap.score = index;
    });

    // Buscar el student_id en la base de datos
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("email", studentInfo.email.toLowerCase())
      .single();

    if (userError || !user) {
      throw new Error(`Usuario no encontrado con email: ${studentInfo.email}`);
    }

    const studentId = user.id;
    const testRecords = [];

    // Procesar filas de tests (después de la cabecera)
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      if (!row || row.length === 0) continue;

      const testData: ExcelTestRow = {
        subject: row[columnMap.subject],
        topic: row[columnMap.topic],
        activity: row[columnMap.activity],
        max_score: parseFloat(row[columnMap.max_score]) || 100,
        corrected_by: row[columnMap.corrected_by],
        first_attempt: row[columnMap.first_attempt],
        attempts: parseInt(row[columnMap.attempts]) || 0,
        last_attempt: row[columnMap.last_attempt],
        score: parseFloat(row[columnMap.score]) || 0
      };

      // Solo procesar si tiene actividad
      if (!testData.activity || testData.activity.trim() === "") continue;

      // Generar topic_code desde el tema
      const topicCode = testData.topic || `${testData.subject}-${i}`;

      // Preparar registro para topic_results
      const record = {
        student_id: studentId,
        topic_code: topicCode,
        activity: testData.activity,
        score: testData.score || 0,
        max_score: testData.max_score || 100,
        first_attempt: testData.first_attempt ? new Date(testData.first_attempt).toISOString() : new Date().toISOString(),
        last_attempt: testData.last_attempt ? new Date(testData.last_attempt).toISOString() : new Date().toISOString(),
        attempts: testData.attempts || 1,
        source: "evol_excel",
        created_at: new Date().toISOString()
      };

      testRecords.push(record);
    }

    console.log(`📊 Encontrados ${testRecords.length} registros de tests para ${studentInfo.email}`);

    // Insertar registros en la base de datos
    if (testRecords.length > 0) {
      const { error: insertError } = await supabase
        .from("topic_results")
        .upsert(testRecords, {
          onConflict: 'student_id,topic_code,activity'
        });

      if (insertError) {
        throw new Error(`Error insertando registros: ${insertError.message}`);
      }
    }

    // Mover archivo a carpeta procesados
    const processedFileName = `processed/${new Date().getFullYear()}/${new Date().getMonth() + 1}/${fileName}`;
    
    const { error: moveError } = await supabase
      .storage
      .from(bucket)
      .move(fileName, processedFileName);

    if (moveError) {
      console.error("Error moviendo archivo a procesados:", moveError);
    }

    // Registrar en log
    await supabase.from("api_sync_log").insert({
      endpoint: "process_excel",
      status_code: 200,
      records_synced: testRecords.length,
      details: {
        fileName,
        studentEmail: studentInfo.email,
        recordsProcessed: testRecords.length,
        processedAt: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Procesados ${testRecords.length} registros para ${studentInfo.email}`,
        details: {
          student: studentInfo,
          recordsProcessed: testRecords.length
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("❌ Error procesando Excel:", error);

    // Intentar registrar el error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase.from("api_sync_log").insert({
        endpoint: "process_excel",
        status_code: 500,
        records_synced: 0,
        details: { 
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    } catch (_) {
      console.error("No se pudo registrar el error en el log");
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
}); 