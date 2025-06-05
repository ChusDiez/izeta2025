import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE_URL = "https://api.evolcampus.com/api/v1";

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
    // Obtener el email del estudiante desde el body de la petición
    const { studentEmail } = await req.json();
    
    if (!studentEmail) {
      throw new Error("Email del estudiante requerido");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    // Credenciales hardcodeadas temporalmente
    const evolClientId = "74097";
    const evolKey = "az3fmvjf.dfhj45";

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verificar que el estudiante existe
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("id, username")
      .ilike("email", studentEmail)
      .single();

    if (userError || !user) {
      throw new Error(`Estudiante no encontrado: ${studentEmail}`);
    }

    console.log(`🎯 Sincronizando datos de Evolcampus para: ${user.username} (${studentEmail})`);

    // Paso 1: Obtener token
    const tokenResp = await fetch(`${BASE_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientid: Number(evolClientId),
        key: evolKey,
      }),
    });

    if (!tokenResp.ok) {
      const errorBody = await tokenResp.text();
      throw new Error(`Error autenticando: ${tokenResp.status} - ${errorBody}`);
    }
    
    const tokenData = await tokenResp.json();
    const authHeader = {
      Authorization: `Bearer ${tokenData.token}`,
    };

    // Paso 2: Buscar enrollment del estudiante específico
    const enrollmentsResp = await fetch(`${BASE_URL}/getEnrollments`, {
      method: "POST",
      headers: { ...authHeader, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: studentEmail, // Filtrar por email
        regs_per_page: 100,
        page: 1
      }),
    });

    if (!enrollmentsResp.ok) {
      const errorBody = await enrollmentsResp.text();
      throw new Error(`Error obteniendo enrollments: ${enrollmentsResp.status} - ${errorBody}`);
    }

    const response = await enrollmentsResp.json();
    const enrollments = response.data || [];

    if (enrollments.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: "Estudiante no encontrado en Evolcampus",
          student: user.username,
          synced: 0 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let totalSynced = 0;

    // Procesar cada enrollment del estudiante
    for (const enrollment of enrollments) {
      if (!enrollment.person?.enrollmentid) continue;

      // Guardar datos generales del enrollment
      const { error: enrollError } = await supabase.from("evolcampus_enrollments").upsert({
        student_id: user.id,
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
      }, {
        onConflict: 'student_id,enrollmentid'
      });

      if (enrollError) {
        console.error(`Error guardando enrollment general:`, enrollError);
      }

      // Obtener progreso detallado
      const progressResp = await fetch(`${BASE_URL}/getEnrollment`, {
        method: "POST",
        headers: { ...authHeader, "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentid: enrollment.person.enrollmentid,
        }),
      });

      if (!progressResp.ok) {
        console.error(`Error obteniendo progreso para enrollment ${enrollment.person.enrollmentid}`);
        continue;
      }

      const progressData: { progress: ProgressRecord[] } = await progressResp.json();

      // Primero, eliminar registros antiguos del estudiante
      await supabase
        .from("topic_results")
        .delete()
        .eq("student_id", user.id)
        .eq("source", "evolcampus");

      // Insertar nuevos registros
      for (const record of progressData.progress || []) {
        const { error } = await supabase.from("topic_results").upsert({
          student_id: user.id,
          topic_code: record.topic_code,
          activity: record.activity,
          score: record.score,
          max_score: record.max_score,
          first_attempt: record.first_attempt,
          last_attempt: record.last_attempt,
          attempts: record.attempts,
          source: "evolcampus",
          created_at: new Date().toISOString(),
        }, {
          onConflict: 'student_id,topic_code,activity'
        });

        if (!error) {
          totalSynced += 1;
        }
      }
    }

    // Registrar en log
    await supabase.from("api_sync_log").insert({
      endpoint: "student_sync",
      status_code: 200,
      records_synced: totalSynced,
      details: { student: user.username, email: studentEmail },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sincronización completada para ${user.username}`,
        records_synced: totalSynced 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
    
  } catch (error) {
    console.error("❌ Error en sync-evolvcampus-student:", error);

    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
}); 