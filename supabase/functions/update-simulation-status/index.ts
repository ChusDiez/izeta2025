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

    console.log('🔄 Actualizando estados de simulacros...')
    
    const currentDate = new Date().toISOString().split('T')[0]
    
    // 1. Marcar como completados los simulacros pasados
    const { data: completed, error: errorCompleted } = await supabase
      .from('weekly_simulations')
      .update({ 
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .neq('status', 'completed')
      .lt('end_date', currentDate)
      .select()
    
    if (errorCompleted) {
      console.error('Error actualizando completados:', errorCompleted)
    }
    
    // 2. Activar el simulacro actual
    const { data: activated, error: errorActivated } = await supabase
      .from('weekly_simulations')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .neq('status', 'active')
      .lte('start_date', currentDate)
      .gte('end_date', currentDate)
      .select()
    
    if (errorActivated) {
      console.error('Error activando simulacro:', errorActivated)
    }
    
    // 3. Obtener el simulacro activo actual
    const { data: activeSimulation } = await supabase
      .from('weekly_simulations')
      .select('*')
      .eq('status', 'active')
      .single()
    
    console.log('✅ Estados actualizados')
    console.log(`- Completados: ${completed?.length || 0} simulacros`)
    console.log(`- Activados: ${activated?.length || 0} simulacros`)
    
    return new Response(
      JSON.stringify({
        success: true,
        completed: completed?.length || 0,
        activated: activated?.length || 0,
        currentDate,
        activeSimulation,
        message: `Estados actualizados: ${completed?.length || 0} completados, ${activated?.length || 0} activados`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}) 