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
  enrollmentid: number;  // ID numérico de la matrícula
  userid: number;
  courseid: number;
  email: string;
  username: string;
  slug?: string;
  // Otros campos según la API
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
      allEnrollments = [...allEnrollments, ...pageEnrollments];
      
      // Verificar si hay más páginas
      hasMore = response.pages > page;
      page++;
    }

    const enrollments = allEnrollments;

    let totalSynced = 0;

    // Procesar cada estudiante
    for (const enrollment of enrollments) {
      try {
        // Paso 2b: Obtener progreso detallado por estudiante
        const progressResp = await fetch(`${BASE_URL}/getEnrollment`, {
          method: "POST",  // POST, no GET
          headers: { ...authHeader, "Content-Type": "application/json" },
          body: JSON.stringify({
            enrollmentid: enrollment.enrollmentid,  // usar enrollmentid
          }),
        });

        if (!progressResp.ok) {
          const errorBody = await progressResp.text();
          console.error(`Error progreso ${enrollment.enrollmentid}: ${progressResp.status} - ${errorBody}`);
          continue;
        }

        const progressData: { progress: ProgressRecord[] } = await progressResp.json();

        // Resolver student_id local
        const { data: user, error: userErr } = await supabase
          .from("users")
          .select("id")
          .ilike("email", enrollment.email);

        if (userErr || !user || user.length === 0) {
          console.warn(`Usuario no encontrado para ${enrollment.email}`);
          continue;
        }
        const studentId = user[0].id;

        // Upsert cada progreso
        for (const record of progressData.progress) {
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
        console.error(`Error procesando enrollment ${enrollment.enrollmentid}:`, innerErr);
      }
    }

    // Registrar en api_sync_log
    await supabase.from("api_sync_log").insert({
      endpoint: "full_sync",
      status_code: 200,
      records_synced: totalSynced,
      details: { totalStudents: enrollments.length },
    });

    return new Response(
      JSON.stringify({ success: true, records_synced: totalSynced }),
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