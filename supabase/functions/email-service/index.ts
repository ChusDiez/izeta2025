// Archivo: supabase/functions/email-service/index.ts

import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Si es una petición OPTIONS (verificación CORS), responder OK
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Conectar con Supabase usando las credenciales del servidor
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Obtener los datos del email desde la petición
    const requestData = await req.json()
    console.log('Datos recibidos:', requestData)

    // Validar que tenemos todos los datos necesarios
    if (!requestData.userId || !requestData.simulationId || requestData.score === undefined) {
      throw new Error('Faltan datos requeridos: userId, simulationId o score')
    }

    // PASO 1: Obtener información del usuario
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('email, username, slug, cohort')
      .eq('id', requestData.userId)
      .single()

    if (userError || !user) {
      throw new Error(`Usuario no encontrado: ${requestData.userId}`)
    }

    // PASO 2: Obtener información del simulacro
    const { data: simulation, error: simError } = await supabase
      .from('weekly_simulations')
      .select('week_number')
      .eq('id', requestData.simulationId)
      .single()

    const weekNumber = simulation?.week_number || 'N/A'

    // PASO 3: Verificar que no hayamos enviado este email recientemente
    // Esto previene duplicados si algo falla y se reintenta
    const thirtySecondsAgo = new Date()
    thirtySecondsAgo.setSeconds(thirtySecondsAgo.getSeconds() - 30)

    const { data: recentEmail } = await supabase
      .from('email_queue')
      .select('id')
      .eq('to_email', user.email)
      .eq('template_id', 'result_confirmation')
      .gte('created_at', thirtySecondsAgo.toISOString())
      .single()

    if (recentEmail) {
      console.log('Email duplicado detectado, no se enviará otro')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email ya existe en la cola' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // PASO 4: Preparar los datos del email
    // Calculamos algunos valores útiles para el email
    const totalAnswered = requestData.correctAnswers + requestData.wrongAnswers
    const errorPercentage = totalAnswered > 0 
      ? ((requestData.wrongAnswers / totalAnswered) * 100).toFixed(2)
      : '0'

    // PASO 5: Insertar el email en la cola
    const { error: insertError } = await supabase
      .from('email_queue')
      .insert({
        to_email: user.email,
        subject: `Resultados recibidos - Simulacro RF${weekNumber}`,
        template_id: 'result_confirmation',
        template_data: {
          // Datos del usuario
          user_name: user.username,
          user_slug: user.slug,
          cohort: user.cohort,
          
          // Datos del resultado
          week_number: weekNumber,
          score: requestData.score.toFixed(2),
          correct_answers: requestData.correctAnswers,
          wrong_answers: requestData.wrongAnswers,
          blank_answers: requestData.blankAnswers,
          error_percentage: errorPercentage,
          
          // Datos opcionales
          review_time: requestData.reviewTime || 0,
          weakest_topics: requestData.weakestTopics || [],
          
          // IDs para referencia
          user_id: requestData.userId,
          simulation_id: requestData.simulationId
        }
      })

    if (insertError) {
      throw new Error(`Error al insertar email: ${insertError.message}`)
    }

    // PASO 6: Responder con éxito
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email añadido a la cola correctamente',
        recipient: user.email 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error en email-service:', error)
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})