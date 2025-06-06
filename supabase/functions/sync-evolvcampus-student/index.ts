import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE_URL = "https://api.evolcampus.com/api/v1";
const GROUP_ID_SIMULACROS = 237;     // 334 matrículas activas
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    /* ---------- 0. Entrada ---------- */
    const { studentEmail } = await req.json();        // se la pasa el front
    if (!studentEmail) throw new Error("email requerido");

    /* ---------- 1. Supabase ---------- */
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    /* ---------- 2. Token Evolcampus ---------- */
    const tokenRes = await fetch(`${BASE_URL}/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        clientid: Number(Deno.env.get("EVOL_CLIENT_ID")),
        key:      Deno.env.get("EVOL_KEY"),
      }),
    });
    if (!tokenRes.ok) throw new Error("auth Evolcampus");
    const { token } = await tokenRes.json();
    const auth = { Authorization: `Bearer ${token}` };

    /* ---------- 3. Localizar enrollment del alumno ---------- */
    const enrollRes = await fetch(`${BASE_URL}/getEnrollments`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({
        email:   studentEmail,
        groupid: GROUP_ID_SIMULACROS,     // curso/grupo filtro
        regs_per_page: 100,
        page: 1,
      }),
    });
    if (!enrollRes.ok) throw new Error("getEnrollments error");
    const { data: enrollments } = await enrollRes.json();
    if (!enrollments?.length) throw new Error("alumno no encontrado");

    const enrollmentId = enrollments[0].person.enrollmentid;

    /* ---------- 4. Progreso detallado ---------- */
    const progRes = await fetch(`${BASE_URL}/getEnrollment`, {
      method: "POST",
      headers: { ...auth, "Content-Type": "application/json" },
      body: JSON.stringify({ enrollmentid: enrollmentId }),
    });
    if (!progRes.ok) throw new Error("getEnrollment error");
    const { progress } = await progRes.json();   // array de records

    /* ---------- 5. Fusionar con catálogo & medias ---------- */
    const [{ data: catalog }, { data: stats }] = await Promise.all([
      supabase.from("evolcampus_activity_catalog").select("*"),
      supabase.from("evolcampus_activity_stats").select("*"),
    ]);

    const doneMap = new Map(progress.map(r => [r.topic_code, r.score]));
    const activities = catalog.map(c => ({
      topic_code: c.topic_code,
      activity  : c.activity,
      done      : doneMap.has(c.topic_code),
      score     : doneMap.get(c.topic_code) ?? null,
      avg_score : stats?.find(s => s.topic_code === c.topic_code)?.avg_score ?? null,
    }));

    return new Response(JSON.stringify({ success: true, activities }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});