import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE_URL = "https://api.evolcampus.com/api/v1";
const GROUP_ID_SIMULACROS = 237;

// CREDENCIALES HARDCODEADAS (temporalmente para pruebas)
const EVOL_CLIENT_ID = 74097;  // Tu clientid real
const EVOL_KEY = "az3fmvjf.dfhj45";  // Tu key real

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async req => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 1. Validar entrada
    const { studentEmail } = await req.json();
    if (!studentEmail) {
      throw new Error("El email del estudiante es requerido");
    }

    console.log(`🔍 Sincronizando datos de: ${studentEmail}`);

    // 2. Configurar Supabase
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 3. Obtener token de Evolcampus
    console.log("🔑 Obteniendo token de autenticación...");
    const tokenRes = await fetch(`${BASE_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientid: EVOL_CLIENT_ID,  // Número hardcodeado
        key: EVOL_KEY,             // String hardcodeado
      }),
    });

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      throw new Error(`Error de autenticación Evolcampus: ${tokenRes.status} - ${errorBody}`);
    }

    const tokenJson = await tokenRes.json();
    if (!tokenJson?.token) {
      throw new Error(`Token inválido: ${JSON.stringify(tokenJson)}`);
    }

    const auth = { Authorization: `Bearer ${tokenJson.token}` };
    console.log("✅ Token obtenido");

    // 4. Buscar enrollment del alumno
    console.log("🔍 Buscando enrollment del estudiante...");
    const enrollRes = await fetch(`${BASE_URL}/getEnrollments`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: studentEmail,
        groupid: GROUP_ID_SIMULACROS,
        regs_per_page: 100,
        page: 1,
      }),
    });

    if (!enrollRes.ok) {
      const errorBody = await enrollRes.text();
      throw new Error(`Error buscando enrollments: ${enrollRes.status} - ${errorBody}`);
    }

    const enrollData = await enrollRes.json();
    const enrollments = enrollData.data || [];

    if (!enrollments.length) {
      console.warn(`No se encontró enrollment para ${studentEmail}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Estudiante no encontrado en Evolcampus",
          message: `No se encontraron enrollments para ${studentEmail} en el grupo ${GROUP_ID_SIMULACROS}`
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const enrollment = enrollments[0];
    const enrollmentId = enrollment.person.enrollmentid;
    console.log(`✅ Enrollment encontrado: ${enrollmentId}`);

    // 5. Obtener progreso detallado
    console.log("📊 Obteniendo progreso detallado...");
    const progRes = await fetch(`${BASE_URL}/getEnrollment`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentid: enrollmentId }),
    });

    if (!progRes.ok) {
      const errorBody = await progRes.text();
      throw new Error(`Error obteniendo progreso: ${progRes.status} - ${errorBody}`);
    }

    const progData = await progRes.json();
    const progress = progData.progress || [];
    console.log(`📚 ${progress.length} actividades encontradas`);

    // 6. Buscar usuario en la base de datos local
    const email = enrollment.person.email.trim().toLowerCase();
    const { data: user, error: userErr } = await supabase
      .from("users")
      .select("id")
      .eq("email", email)
      .single();

    if (userErr || !user) {
      console.error(`Usuario no encontrado en la BD local: ${email}`);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "Usuario no encontrado en el sistema",
          message: `El usuario ${email} existe en Evolcampus pero no en el sistema local`
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const studentId = user.id;
    console.log(`✅ Usuario encontrado: ${studentId}`);

    // 7. Guardar datos del enrollment
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
      console.error("Error guardando enrollment:", enrollError);
    }

    // 8. Guardar progreso detallado
    let recordsSynced = 0;
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
        recordsSynced++;
      } else {
        console.error(`Error guardando progreso:`, error);
      }
    }

    console.log(`✅ Sincronización completada: ${recordsSynced} registros`);

    // 9. Obtener TODOS los topic_results (incluyendo los de Excel)
    const { data: allTopicResults, error: topicError } = await supabase
      .from("topic_results")
      .select("*")
      .eq("student_id", studentId)
      .in("source", ["evolcampus", "evol_excel"]) // Incluir ambas fuentes
      .order("last_attempt", { ascending: false });

    if (topicError) {
      console.error("Error obteniendo topic_results:", topicError);
    }

    // 10. Formatear respuesta para el frontend
    // Combinar datos de API y Excel, priorizando los más recientes
    const activitiesMap = new Map();
    
    // Primero agregar los de Excel (si existen)
    if (allTopicResults) {
      allTopicResults.forEach(record => {
        const key = `${record.topic_code}-${record.activity}`;
        activitiesMap.set(key, {
          topic_code: record.topic_code,
          activity: record.activity,
          done: true,
          score: record.score || null,
          attempts: record.attempts || 1,
          last_attempt: record.last_attempt,
          source: record.source,
          avg_score: null
        });
      });
    }

    // Los de la API actual sobrescriben si existen duplicados
    progress.forEach(record => {
      const key = `${record.topic_code}-${record.activity}`;
      activitiesMap.set(key, {
        topic_code: record.topic_code,
        activity: record.activity,
        done: true,
        score: record.score || null,
        attempts: record.attempts || 1,
        last_attempt: record.last_attempt || new Date().toISOString(),
        source: "evolcampus",
        avg_score: null
      });
    });

    const activities = Array.from(activitiesMap.values());

    // Registrar en log
    await supabase.from("api_sync_log").insert({
      endpoint: "student_sync",
      status_code: 200,
      records_synced: recordsSynced,
      details: {
        student_email: studentEmail,
        enrollment_id: enrollmentId,
        activities_count: activities.length,
        timestamp: new Date().toISOString()
      },
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        activities,
        records_synced: recordsSynced,
        enrollment: {
          completed_percent: enrollment.enroll.completedpercent,
          grade: enrollment.enroll.grade,
          last_connect: enrollment.enroll.lastconnect,
          connections: enrollment.enroll.connections
        },
        message: `Sincronizados ${recordsSynced} registros para ${studentEmail}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ Error en sync-evolvcampus-student:", err);

    // Intentar registrar el error
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      
      await supabase.from("api_sync_log").insert({
        endpoint: "student_sync",
        status_code: 500,
        records_synced: 0,
        details: { 
          error: err.message,
          stack: err.stack,
          timestamp: new Date().toISOString()
        },
      });
    } catch (_) {
      console.error("No se pudo registrar el error en el log");
    }

    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err.message,
        activities: [] // Array vacío para evitar errores en el frontend
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});