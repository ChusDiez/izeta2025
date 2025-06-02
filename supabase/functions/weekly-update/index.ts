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

    console.log('🚀 Iniciando actualización semanal de ELO...')

    // 1. Resetear rachas de usuarios inactivos
    console.log('🔄 Verificando rachas...')
    await supabase.rpc('check_streak_continuity')
    console.log('✅ Rachas verificadas')

    // 2. Buscar simulacros que necesitan procesarse
    // Buscamos simulacros que:
    // - Su fecha de fin fue ayer (domingo)
    // - NO han sido procesados (processed_at es null)
    
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1) // Domingo
    yesterday.setHours(23, 59, 59, 999) // Fin del domingo
    
    console.log(`📅 Buscando simulacros que terminaron antes de: ${yesterday.toISOString()}`)
    
    const { data: simulacrosPendientes, error: simError } = await supabase
      .from('weekly_simulations')
      .select('*')
      .lte('end_date', yesterday.toISOString().split('T')[0])
      .is('processed_at', null)
      .order('week_number', { ascending: true }) // Procesar en orden
    
    if (simError) {
      console.error('❌ Error buscando simulacros:', simError)
      throw simError
    }
    
    if (!simulacrosPendientes || simulacrosPendientes.length === 0) {
      console.log('ℹ️ No hay simulacros pendientes de procesar')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No hay simulacros para procesar',
          checked_date: yesterday.toISOString()
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`📊 Encontrados ${simulacrosPendientes.length} simulacros para procesar`)
    
    const resultados = []
    
    // 3. Procesar cada simulacro pendiente
    for (const simulacro of simulacrosPendientes) {
      console.log(`\n🎯 Procesando RF${simulacro.week_number} (${simulacro.start_date} al ${simulacro.end_date})`)
      
      try {
        // IMPORTANTE: Crear una fecha de corte para los resultados
        // Solo contarán para ELO los resultados enviados hasta el domingo 23:59:59
        const fechaCorte = new Date(simulacro.end_date + 'T23:59:59.999Z')
        
        console.log(`⏰ Fecha de corte para ELO: ${fechaCorte.toISOString()}`)
        
        // Contar resultados que entran en el cálculo de ELO
        const { count: resultadosElo } = await supabase
          .from('user_results')
          .select('*', { count: 'exact', head: true })
          .eq('simulation_id', simulacro.id)
          .lte('submitted_at', fechaCorte.toISOString())
        
        console.log(`📈 ${resultadosElo || 0} resultados válidos para ELO`)
        
        // Procesar resultados usando la función RPC
        // NOTA: Necesitaremos modificar la función SQL para que respete la fecha de corte
        const { error: processError } = await supabase.rpc('process_weekly_results_with_cutoff', {
          p_week_number: simulacro.week_number,
          p_cutoff_date: fechaCorte.toISOString()
        })
        
        if (processError) {
          // Si la función no existe, intentar con la original
          console.log('⚠️ Intentando con función original...')
          const { error: processError2 } = await supabase.rpc('process_weekly_results', {
            p_week_number: simulacro.week_number
          })
          
          if (processError2) {
            throw processError2
          }
        }
        
        console.log(`✅ RF${simulacro.week_number} procesado correctamente`)
        
        resultados.push({
          week_number: simulacro.week_number,
          status: 'success',
          elo_results: resultadosElo || 0
        })
        
      } catch (error) {
        console.error(`❌ Error procesando RF${simulacro.week_number}:`, error)
        resultados.push({
          week_number: simulacro.week_number,
          status: 'error',
          error: error.message
        })
      }
    }
    
    // 4. Activar el siguiente simulacro si corresponde
    const hoy = new Date()
    const { error: activateError } = await supabase
      .from('weekly_simulations')
      .update({ 
        status: 'active',
        updated_at: new Date().toISOString()
      })
      .lte('start_date', hoy.toISOString().split('T')[0])
      .gte('end_date', hoy.toISOString().split('T')[0])
      .eq('status', 'futuro')
    
    if (!activateError) {
      console.log('✅ Simulacro actual activado (si había alguno pendiente)')
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        processed_count: resultados.length,
        results: resultados,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
    
  } catch (error) {
    console.error('❌ Error en weekly-update:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})