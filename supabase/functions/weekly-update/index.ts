import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    console.log('Ejecutando actualización semanal...')

    // 1. Resetear rachas
    await supabase.rpc('check_streak_continuity')

    // 2. Procesar resultados
    const currentDate = new Date()
    const weekNumber = Math.ceil(((currentDate - new Date(currentDate.getFullYear(), 0, 1)) / 86400000 + 1) / 7)
    
    await supabase.rpc('process_weekly_results', {
      p_week_number: weekNumber - 1
    })

    return new Response(
      JSON.stringify({ success: true, week: weekNumber }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})