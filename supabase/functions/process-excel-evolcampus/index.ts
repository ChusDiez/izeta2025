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

    // Si aún no tenemos email, intentar buscar por nombre
    let searchName = '';
    if (!studentInfo.email) {
      console.log("🔍 No se encontró email, intentando buscar por nombre...");
      
      // Intentar extraer nombre del archivo
      // Formato esperado: expediente-nombre-apellidos-fecha.xlsx
      const cleanFileName = fileName.replace('.xlsx', '').replace('.xls', '');
      const parts = cleanFileName.split('-');
      
      // Asumiendo que el nombre y apellidos están en las posiciones 1 y 2
      if (parts.length >= 3) {
        searchName = `${parts[1]} ${parts[2]}`.trim();
      }
      
      // Si no encontramos nombre en el archivo, usar el que extrajimos del contenido
      if (!searchName && (studentInfo.name || studentInfo.lastname)) {
        searchName = `${studentInfo.name || ''} ${studentInfo.lastname || ''}`.trim();
      }
      
      if (searchName) {
        console.log(`🔍 Buscando usuario con nombre similar a: ${searchName}`);
        
        // 1. Primero buscar en la tabla de mapeo manual
        const { data: mapping, error: mappingError } = await supabase
          .from("excel_name_mappings")
          .select("user_email")
          .eq("excel_name", searchName.toLowerCase())
          .single();
        
        if (mapping && !mappingError) {
          studentInfo.email = mapping.user_email;
          console.log(`✅ Usuario encontrado en mapeo manual: ${mapping.user_email}`);
        } else {
          // 2. Buscar con normalización de nombres
          const { data: normalizedSearch } = await supabase
            .rpc('normalize_name', { input_name: searchName });
          
          if (normalizedSearch) {
            // Buscar usuarios donde el nombre normalizado coincida
            const { data: users, error: searchError } = await supabase
              .from("users")
              .select("id, email, username")
              .filter('username', 'ilike', `%${searchName}%`);
            
            if (!searchError && users && users.length > 0) {
              // Intentar encontrar coincidencia exacta normalizada
              let bestMatch = null;
              let bestScore = 0;
              
              for (const user of users) {
                // Normalizar el nombre del usuario también
                const { data: normalizedUserName } = await supabase
                  .rpc('normalize_name', { input_name: user.username });
                
                if (normalizedUserName === normalizedSearch) {
                  bestMatch = user;
                  bestScore = 100;
                  break;
                } else if (normalizedUserName && normalizedSearch) {
                  // Calcular similitud parcial
                  const searchWords = normalizedSearch.split(' ');
                  const userWords = normalizedUserName.split(' ');
                  let matchCount = 0;
                  
                  for (const searchWord of searchWords) {
                    if (userWords.some(userWord => userWord.includes(searchWord))) {
                      matchCount++;
                    }
                  }
                  
                  const score = (matchCount / searchWords.length) * 100;
                  if (score > bestScore) {
                    bestScore = score;
                    bestMatch = user;
                  }
                }
              }
              
              if (bestMatch && bestScore >= 70) { // 70% de coincidencia mínima
                studentInfo.email = bestMatch.email;
                console.log(`✅ Usuario encontrado por normalización (${bestScore}% match): ${bestMatch.email}`);
              } else if (users.length === 1) {
                // Si solo hay un resultado, usarlo aunque no sea perfecto
                studentInfo.email = users[0].email;
                console.log(`⚠️ Usuario único encontrado: ${users[0].email}`);
              } else {
                console.log(`❌ No se encontró coincidencia suficiente. Mejor score: ${bestScore}%`);
              }
            }
          }
        }
        
        // Buscar en la base de datos por nombre similar
        const { data: users, error: searchError } = await supabase
          .from("users")
          .select("id, email, username")
          .ilike("username", `%${searchName}%`);
        
        if (!searchError && users && users.length > 0) {
          // Si encontramos exactamente un usuario, usarlo
          if (users.length === 1) {
            studentInfo.email = users[0].email;
            console.log(`✅ Usuario encontrado: ${users[0].email}`);
          } else {
            // Si hay múltiples coincidencias, intentar encontrar la mejor
            const exactMatch = users.find(u => 
              u.username.toLowerCase() === searchName.toLowerCase()
            );
            
            if (exactMatch) {
              studentInfo.email = exactMatch.email;
              console.log(`✅ Coincidencia exacta encontrada: ${exactMatch.email}`);
            } else {
              // Usar el primero como fallback
              studentInfo.email = users[0].email;
              console.log(`⚠️ Múltiples usuarios encontrados, usando: ${users[0].email}`);
            }
          }
        }
      }
    }

    if (!studentInfo.email) {
      const errorMsg = searchName 
        ? `No se pudo encontrar el email del estudiante. Nombre buscado: ${searchName}`
        : "No se pudo encontrar el email del estudiante en el archivo ni extraer el nombre";
      throw new Error(errorMsg);
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
    
    // Solo intentar mover si NO es el bucket excel-public
    // (excel-public puede tener restricciones diferentes)
    if (bucket !== 'excel-public') {
      const { error: moveError } = await supabase
        .storage
        .from(bucket)
        .move(fileName, processedFileName);

      if (moveError) {
        console.error("Error moviendo archivo a procesados:", moveError);
        // No fallar si no se puede mover, solo loguear
      }
    } else {
      console.log("Archivo en excel-public - no se mueve a procesados");
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