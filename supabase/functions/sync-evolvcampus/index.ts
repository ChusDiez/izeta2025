import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------
// Configuración
// ---------------------------

const BASE_URL = "https://api.evolcampus.com/api/v1";

interface TokenResponse {
  token: string;
  expires_in?: number;
}

interface Enrollment {
  person: {
    userid: number;
    enrollmentid: number;
    name: string;
    lastname: string;
    email: string;
    username: string;
    phone?: string;
    identification?: string;
    position?: string | null;
    photo?: string;
    tags?: string | null;
    anonimous?: boolean;
  };
  enroll: {
    study: string;
    groupid: number;
    group: string;
    fundae: number;
    company?: string | null;
    companyname?: string | null;
    begin: string;
    end: string;
    completedpercent: number;
    evaluationscompletedpercent: number;
    lastconnect: string;
    timeconnected: string;
    connections: number;
    enrollmentstatus: number;
    passrequierements: number;
    grade: number;
    urldiploma?: string;
    urlsdiplomas?: string[];
    surveys?: {
      total: number;
      completed: number;
    };
  };
}

interface ProgressRecord {
  topic_code: string;
  activity: string;
  score: number;
  max_score: number;
  first_attempt: string;
  last_attempt: string;
  attempts: number;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    // Credenciales hardcodeadas temporalmente para pruebas
    const evolClientId = "74097";
    const evolKey = "az3fmvjf.dfhj45";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Paso 1: Obtener token
    const tokenResp = await fetch(`${BASE_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientid: Number(evolClientId),  // clientid como número
        key: evolKey,                     // key en lugar de client_secret
      }),
    });

    if (!tokenResp.ok) {
      const errorBody = await tokenResp.text();
      throw new Error(`Error autenticando contra Evolcampus: ${tokenResp.status} - ${errorBody}`);
    }
    const tokenData = await tokenResp.json();
    const authHeader = {
      Authorization: `Bearer ${tokenData.token}`,  // token, no access_token
    };

    // Paso 2: Obtener inscripciones / estudiantes con paginación
    let allEnrollments: Enrollment[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const enrollmentsResp = await fetch(`${BASE_URL}/getEnrollments`, {
        method: "POST",  // POST, no GET
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          regs_per_page: 1000,
          page: page
        }),
      });

      if (!enrollmentsResp.ok) {
        const errorBody = await enrollmentsResp.text();
        throw new Error(`Error obteniendo inscripciones: ${enrollmentsResp.status} - ${errorBody}`);
      }

      const response = await enrollmentsResp.json();
      const pageEnrollments = response.data || [];
      
      // Debug: ver estructura del primer enrollment
      if (page === 1 && pageEnrollments.length > 0) {
        console.log("🔍 Estructura del primer enrollment:", JSON.stringify(pageEnrollments[0], null, 2));
      }
      
      allEnrollments = [...allEnrollments, ...pageEnrollments];
      
      // Verificar si hay más páginas
      hasMore = response.pages > page;
      page++;
    }

    const enrollments = allEnrollments;

    let totalSynced = 0;
    const notFoundEmails: string[] = []; // Registro de emails no encontrados

    // Función helper para esperar (rate limiting)
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Limitar el número de estudiantes a procesar para evitar timeouts
    const MAX_STUDENTS_PER_RUN = 50; // Procesar máximo 50 estudiantes por ejecución
    const studentsToProcess = Math.min(enrollments.length, MAX_STUDENTS_PER_RUN);
    
    console.log(`📊 Total de enrollments: ${enrollments.length}`);
    console.log(`🎯 Procesando los primeros ${studentsToProcess} estudiantes en esta ejecución`);

    // Procesar cada estudiante con rate limiting
    for (let i = 0; i < studentsToProcess; i++) {
      const enrollment = enrollments[i];
      
      // Verificar que tenemos enrollmentid
      if (!enrollment.person?.enrollmentid) {
        console.warn(`⚠️ Enrollment sin ID válido:`, JSON.stringify({
          email: enrollment.person?.email || 'sin email',
          enrollmentid: enrollment.person?.enrollmentid || 'sin id',
          estructura: !enrollment.person ? 'falta person' : 'person existe pero sin enrollmentid'
        }));
        continue;
      }

      try {
        // Rate limiting: esperar 200ms entre peticiones (5 peticiones por segundo)
        if (i > 0) {
          await delay(200);
        }

        // Mostrar progreso cada 10 estudiantes
        if (i % 10 === 0) {
          console.log(`🔄 Procesando enrollment ${i + 1} de ${studentsToProcess}...`);
        }

        // Paso 2b: Obtener progreso detallado por estudiante con reintentos
        let progressData: { progress: ProgressRecord[] } | null = null;
        let attempts = 0;
        const maxAttempts = 3;
        
        while (attempts < maxAttempts && !progressData) {
          attempts++;
          
          // Si no es el primer intento, esperar exponencialmente más
          if (attempts > 1) {
            const waitTime = Math.min(1000 * Math.pow(2, attempts - 1), 10000); // Max 10 segundos
            console.warn(`⏱️ Reintento ${attempts}/${maxAttempts}. Esperando ${waitTime/1000} segundos...`);
            await delay(waitTime);
          }
          
          const progressResp = await fetch(`${BASE_URL}/getEnrollment`, {
            method: "POST",
            headers: { ...authHeader, "Content-Type": "application/json" },
            body: JSON.stringify({
              enrollmentid: enrollment.person.enrollmentid,
            }),
          });

          if (progressResp.ok) {
            progressData = await progressResp.json();
          } else if (progressResp.status === 429) {
            console.warn(`⚠️ Rate limit alcanzado para enrollment ${enrollment.person.enrollmentid}`);
            // El bucle continuará y aplicará el backoff exponencial
          } else {
            const errorBody = await progressResp.text();
            console.error(`Error progreso ${enrollment.person.enrollmentid}: ${progressResp.status} - ${errorBody}`);
            break; // No reintentar otros tipos de error
          }
        }
        
        if (!progressData) {
          console.error(`❌ No se pudo obtener progreso para enrollment ${enrollment.person.enrollmentid} después de ${attempts} intentos`);
          continue;
        }

        // Resolver student_id local
        const { data: user, error: userErr } = await supabase
          .from("users")
          .select("id")
          .ilike("email", enrollment.person.email);

        if (userErr || !user || user.length === 0) {
          console.warn(`Usuario no encontrado para ${enrollment.person.email}`);
          notFoundEmails.push(enrollment.person.email);
          continue;
        }
        const studentId = user[0].id;

        // Guardar datos generales del enrollment
        const { error: enrollError } = await supabase.from("evolcampus_enrollments").upsert({
          student_id: studentId,
          enrollmentid: enrollment.person.enrollmentid,
          study: enrollment.enroll.study,
          group_name: enrollment.enroll.group,
          begin_date: enrollment.enroll.begin,
          end_date: enrollment.enroll.end,
          completed_percent: enrollment.enroll.completedpercent,
          grade: enrollment.enroll.grade,
          last_connect: enrollment.enroll.lastconnect,
          time_connected: parseInt(enrollment.enroll.timeconnected),
          connections: enrollment.enroll.connections,
          enrollment_status: enrollment.enroll.enrollmentstatus,
          pass_requirements: enrollment.enroll.passrequierements,
          synced_at: new Date().toISOString(),
        });

        if (enrollError) {
          console.error(`Error guardando enrollment general:`, enrollError);
        }

        // Upsert cada progreso
        for (const record of progressData.progress || []) {
          const { error } = await supabase.from("topic_results").upsert({
            student_id: studentId,
            topic_code: record.topic_code,
            activity: record.activity,
            score: record.score,
            max_score: record.max_score,
            first_attempt: record.first_attempt,
            last_attempt: record.last_attempt,
            attempts: record.attempts,
            source: "evolcampus",
            created_at: new Date().toISOString(),
          });

          if (error) {
            console.error(`Upsert error topic_results:`, error);
          } else {
            totalSynced += 1;
          }
        }
      } catch (innerErr) {
        console.error(`Error procesando enrollment ${enrollment.person.enrollmentid}:`, innerErr);
      }
    }

    // Registrar en api_sync_log con reporte de no encontrados
    await supabase.from("api_sync_log").insert({
      endpoint: "full_sync",
      status_code: 200,
      records_synced: totalSynced,
      details: { 
        totalStudents: enrollments.length,
        notFoundEmails: notFoundEmails,
        notFoundCount: notFoundEmails.length,
        processedCount: enrollments.length - notFoundEmails.length
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        records_synced: totalSynced,
        not_found_emails: notFoundEmails,
        summary: {
          total_evolcampus: enrollments.length,
          found_in_system: enrollments.length - notFoundEmails.length,
          not_found: notFoundEmails.length,
          synced_records: totalSynced
        }
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("❌ Error en sync-evolvcampus:", error);

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      await supabase.from("api_sync_log").insert({
        endpoint: "full_sync",
        status_code: 500,
        records_synced: 0,
        details: { error: error.message },
      });
    } catch (_) {
      // ignore nested errors
    }

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}); 