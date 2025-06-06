import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---------------------------
// Configuración
// ---------------------------
const BASE_URL = "https://api.evolcampus.com/api/v1";

// CREDENCIALES HARDCODEADAS (temporalmente para pruebas)
const EVOL_CLIENT_ID = 74097;  // Tu clientid real
const EVOL_KEY = "az3fmvjf.dfhj45";  // Tu key real

// IDs de Simulacros 42
const STUDY_ID_SIMULACROS = 198;   
const GROUP_ID_SIMULACROS = 237;   

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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("🚀 Iniciando sincronización con Evolcampus...");

    // Paso 1: Obtener token
    console.log("🔑 Obteniendo token de autenticación...");
    const tokenResp = await fetch(`${BASE_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientid: EVOL_CLIENT_ID,  // Número hardcodeado
        key: EVOL_KEY,             // String hardcodeado
      }),
    });

    if (!tokenResp.ok) {
      const errorBody = await tokenResp.text();
      console.error("❌ Error de autenticación:", errorBody);
      throw new Error(`Error autenticando contra Evolcampus: ${tokenResp.status} - ${errorBody}`);
    }

    const tokenJson = await tokenResp.json();
    if (!tokenJson?.token) {
      throw new Error(`Token no válido recibido: ${JSON.stringify(tokenJson)}`);
    }

    const authHeader = {
      Authorization: `Bearer ${tokenJson.token}`,
    };
    console.log("✅ Token obtenido exitosamente");

    // Paso 2: Obtener inscripciones con paginación
    console.log("📚 Obteniendo enrollments del grupo", GROUP_ID_SIMULACROS);
    let allEnrollments: Enrollment[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const enrollmentsResp = await fetch(`${BASE_URL}/getEnrollments`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          regs_per_page: 1000,
          page,
          groupid: GROUP_ID_SIMULACROS
        }),
      });

      if (!enrollmentsResp.ok) {
        const errorBody = await enrollmentsResp.text();
        throw new Error(`Error obteniendo inscripciones: ${enrollmentsResp.status} - ${errorBody}`);
      }

      const response = await enrollmentsResp.json();
      const pageEnrollments = response.data || [];
      
      console.log(`📄 Página ${page}: ${pageEnrollments.length} enrollments`);
      
      allEnrollments = [...allEnrollments, ...pageEnrollments];
      
      // Verificar si hay más páginas
      hasMore = response.pages && page < response.pages;
      page++;
    }

    console.log(`📊 Total de enrollments obtenidos: ${allEnrollments.length}`);

    // Variables para tracking
    let totalSynced = 0;
    let studentsProcessed = 0;
    const notFoundEmails: string[] = [];
    const errors: any[] = [];

    // Helper para rate limiting
    const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    // Limitar procesamiento para evitar timeouts
    const MAX_STUDENTS_PER_RUN = 50;
    const studentsToProcess = Math.min(allEnrollments.length, MAX_STUDENTS_PER_RUN);
    
    console.log(`🎯 Procesando ${studentsToProcess} de ${allEnrollments.length} estudiantes`);

    // Procesar cada estudiante
    for (let i = 0; i < studentsToProcess; i++) {
      const enrollment = allEnrollments[i];
      
      try {
        // Validar estructura del enrollment
        if (!enrollment.person?.enrollmentid || !enrollment.person?.email) {
          console.warn(`⚠️ Enrollment incompleto:`, {
            enrollmentid: enrollment.person?.enrollmentid || 'falta',
            email: enrollment.person?.email || 'falta'
          });
          continue;
        }

        // Rate limiting
        if (i > 0 && i % 5 === 0) {
          await delay(1000); // Pausa de 1 segundo cada 5 requests
        }

        // Progreso
        if (i % 10 === 0) {
          console.log(`🔄 Procesando ${i + 1}/${studentsToProcess}...`);
        }

        // Obtener progreso detallado del estudiante
        const progressResp = await fetch(`${BASE_URL}/getEnrollment`, {
          method: "POST",
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            enrollmentid: enrollment.person.enrollmentid,
          }),
        });

        if (!progressResp.ok) {
          if (progressResp.status === 429) {
            console.warn(`⏱️ Rate limit alcanzado, esperando 5 segundos...`);
            await delay(5000);
            continue;
          }
          throw new Error(`Error obteniendo progreso: ${progressResp.status}`);
        }

        const progressData = await progressResp.json();
        const progress = progressData.progress || [];

        // Buscar usuario en la base de datos
        const email = enrollment.person.email.trim().toLowerCase();
        
        const { data: user, error: userErr } = await supabase
          .from("users")
          .select("id")
          .eq("email", email)
          .single();

        if (userErr || !user) {
          console.warn(`👤 Usuario no encontrado: ${email}`);
          notFoundEmails.push(enrollment.person.email);
          continue;
        }

        const studentId = user.id;
        studentsProcessed++;

        // Guardar datos generales del enrollment
        const { error: enrollError } = await supabase
          .from("evolcampus_enrollments")
          .upsert({
            student_id: studentId,
            enrollmentid: enrollment.person.enrollmentid,
            study: enrollment.enroll.study,
            group_name: enrollment.enroll.group,
            begin_date: enrollment.enroll.begin,
            end_date: enrollment.enroll.end,
            completed_percent: enrollment.enroll.completedpercent || 0,
            grade: enrollment.enroll.grade || null,
            last_connect: enrollment.enroll.lastconnect || null,
            time_connected: parseInt(enrollment.enroll.timeconnected || "0"),
            connections: enrollment.enroll.connections || 0,
            enrollment_status: enrollment.enroll.enrollmentstatus,
            pass_requirements: enrollment.enroll.passrequierements,
            synced_at: new Date().toISOString(),
          }, {
            onConflict: 'student_id,enrollmentid'
          });

        if (enrollError) {
          console.error(`Error guardando enrollment:`, enrollError);
          errors.push({ email, error: enrollError.message });
        }

        // Guardar progreso detallado
        for (const record of progress) {
          const { error } = await supabase
            .from("topic_results")
            .upsert({
              student_id: studentId,
              topic_code: record.topic_code,
              activity: record.activity,
              score: record.score || 0,
              max_score: record.max_score || 100,
              first_attempt: record.first_attempt || new Date().toISOString(),
              last_attempt: record.last_attempt || new Date().toISOString(),
              attempts: record.attempts || 1,
              source: "evolcampus",
              created_at: new Date().toISOString(),
            }, {
              onConflict: 'student_id,topic_code,activity'
            });

          if (!error) {
            totalSynced++;
          } else {
            console.error(`Error guardando progreso:`, error);
          }
        }

      } catch (innerErr: any) {
        console.error(`❌ Error procesando ${enrollment.person?.email}:`, innerErr.message);
        errors.push({ 
          email: enrollment.person?.email || 'desconocido', 
          error: innerErr.message 
        });
      }
    }

    // Resumen final
    const summary = {
      total_evolcampus: allEnrollments.length,
      processed_in_this_run: studentsToProcess,
      students_found: studentsProcessed,
      students_not_found: notFoundEmails.length,
      records_synced: totalSynced,
      errors: errors.length,
      timestamp: new Date().toISOString()
    };

    console.log("✅ Sincronización completada:", summary);

    // Registrar en log
    await supabase.from("api_sync_log").insert({
      endpoint: "full_sync",
      status_code: 200,
      records_synced: totalSynced,
      details: {
        ...summary,
        not_found_emails: notFoundEmails,
        errors: errors
      },
    });

    // TODO: Crear esta función RPC en Supabase si necesitas actualizar estadísticas
    // await supabase.rpc("refresh_evolcampus_activity_stats");

    return new Response(
      JSON.stringify({ 
        success: true, 
        records_synced: totalSynced,
        not_found_emails: notFoundEmails,
        summary,
        message: `Sincronizados ${totalSynced} registros de ${studentsProcessed} estudiantes`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );

  } catch (error: any) {
    console.error("❌ Error en sync-evolvcampus:", error);

    // Intentar registrar el error
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      await supabase.from("api_sync_log").insert({
        endpoint: "full_sync",
        status_code: 500,
        records_synced: 0,
        details: { 
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        },
      });
    } catch (_) {
      console.error("No se pudo registrar el error en el log");
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        details: "Revisa los logs de Supabase para más información"
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      },
    );
  }
});