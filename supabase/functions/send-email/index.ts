// supabase/functions/send-email/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Manejar preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    // Obtener emails pendientes
    const { data: emails, error } = await supabase
      .from('email_queue')
      .select('*')
      .eq('status', 'pending')
      .limit(10)

    if (error || !emails) {
      return new Response(
        JSON.stringify({ error: error?.message || 'No emails found' }),
        { 
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      )
    }

    // Procesar cada email
    const results = []
    for (const email of emails) {
      try {
        // Si no tienes Resend configurado, solo marca como enviado
        if (!RESEND_API_KEY) {
          console.log('Email simulado:', email)
          
          await supabase
            .from('email_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', email.id)
          
          results.push({ id: email.id, status: 'simulated' })
          continue
        }

        // Enviar con Resend
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RESEND_API_KEY}`
          },
          body: JSON.stringify({
            from: 'IZETA 2025 <noreply@izeta2025.com>',
            to: email.to_email,
            subject: email.subject,
            html: generateEmailHTML(email.template_id, email.template_data)
          })
        })

        if (res.ok) {
          await supabase
            .from('email_queue')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString()
            })
            .eq('id', email.id)
          
          results.push({ id: email.id, status: 'sent' })
        } else {
          throw new Error(`Resend error: ${res.status}`)
        }

      } catch (err) {
        await supabase
          .from('email_queue')
          .update({
            status: 'error',
            error: err.message
          })
          .eq('id', email.id)
        
        results.push({ id: email.id, status: 'error', error: err.message })
      }
    }

    return new Response(
      JSON.stringify({ 
        processed: emails.length,
        results 
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

function generateEmailHTML(templateId: string, data: any): string {
  if (templateId === 'result_confirmation') {
    return `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #1E3A8A; color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .stat-box { background: white; padding: 15px; margin: 10px 0; border-radius: 5px; border-left: 4px solid #1E3A8A; }
    .weak-topics { background: #FEF3C7; padding: 15px; border-radius: 5px; margin: 15px 0; }
    .button { display: inline-block; padding: 12px 30px; background: #1E3A8A; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
    .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 0.9em; }
    .identifier { background: #1E3A8A; color: white; padding: 3px 10px; border-radius: 4px; font-weight: bold; display: inline-block; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🎯 IZETA 2025</h1>
      <p>Resultados del Simulacro RF${data.week_number}</p>
    </div>
    <div class="content">
      <p>Hola,</p>
      <p>Confirmamos la recepción de tus resultados del simulacro:</p>
      
      <div class="stat-box">
        <strong>🏷️ Tu identificador en el ranking:</strong> <span class="identifier">${data.user_slug || 'No disponible'}</span>
      </div>
      
      <div class="stat-box">
        <strong>📊 Puntuación:</strong> ${data.score.toFixed(2).replace('.', ',')}/10
      </div>
      
      <div class="stat-box">
        <strong>📝 Preguntas en blanco:</strong> ${data.blank_answers || 0}
      </div>
      
      <div class="stat-box">
        <strong>⏱️ Tiempo de revisión:</strong> ${data.review_time || 0} minutos
      </div>
      
      ${data.weakest_topics && data.weakest_topics.length > 0 ? `
      <div class="weak-topics">
        <strong>📚 Temas a reforzar:</strong><br>
        <ul style="margin: 10px 0 0 20px;">
          ${data.weakest_topics.map(topic => `<li>${topic}</li>`).join('')}
        </ul>
      </div>
      ` : ''}
      
      <p><strong>Recomendaciones personalizadas:</strong></p>
      <ul>
        ${data.blank_answers > 10 ? '<li>📍 Practica con cronómetro para mejorar la gestión del tiempo</li>' : ''}
        ${data.score < 70 ? '<li>📚 Refuerza los conceptos base con repasos más frecuentes</li>' : ''}
        ${data.review_time < 20 ? '<li>🔍 Dedica más tiempo a analizar tus errores - es clave para mejorar</li>' : ''}
        ${data.score >= 85 ? '<li>🌟 ¡Excelente resultado! Mantén este ritmo de estudio</li>' : ''}
      </ul>
      
      <center>
        <a href="https://chusdiez.github.io/izeta2025/public/leaderboard.html" class="button">
          Ver mi posición en el ranking
        </a>
      </center>
      
      <p>Busca tu identificador <strong>${data.user_slug}</strong> en el ranking para ver tu posición y evolución.</p>
      
      <p><strong>Próximos pasos:</strong></p>
      <ul>
        <li>Revisa los temas señalados como débiles</li>
        <li>Practica con las preguntas del banco relacionadas</li>
        <li>Participa en el próximo simulacro para medir tu progreso</li>
      </ul>
      
      <p>¡Sigue así! 💪</p>
      <p><em>Equipo IZETA 2025</em></p>
    </div>
    
    <div class="footer">
      <p>Este es un email automático. Por favor, no respondas a este mensaje.</p>
      <p>© 2025 IZETA - Sistema de Preparación Avanzada</p>
    </div>
  </div>
</body>
</html>
    `
  }
  
  // Template por defecto
  return `
    <h1>IZETA 2025</h1>
    <p>Mensaje del sistema</p>
  `
}