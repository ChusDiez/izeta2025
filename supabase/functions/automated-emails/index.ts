// /supabase/functions/automated-emails/index.ts
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

        // Detectar estudiantes que necesitan comunicación automática
        const triggers = await detectEmailTriggers(supabase)
        
        // Procesar cada trigger
        for (const trigger of triggers) {
            await processEmailTrigger(supabase, trigger)
        }

        return new Response(
            JSON.stringify({ 
                success: true, 
                processed: triggers.length,
                timestamp: new Date().toISOString()
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
        
    } catch (error) {
        console.error('Error en automated-emails:', error)
        return new Response(
            JSON.stringify({ success: false, error: error.message }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
    }
})

async function detectEmailTriggers(supabase) {
    const triggers = []
    
    // 1. Estudiantes que bajaron significativamente
    const { data: decliningStudents } = await supabase
        .from('users')
        .select(`
            *,
            user_results!inner(score, submitted_at)
        `)
        .order('user_results.submitted_at', { ascending: false })
        .limit(2, { foreignTable: 'user_results' })
    
    // Analizar cada estudiante
    for (const student of decliningStudents || []) {
        if (student.user_results.length >= 2) {
            const recent = student.user_results[0].score
            const previous = student.user_results[1].score
            
            if (recent < previous - 1.5) {
                triggers.push({
                    type: 'score_decline',
                    student: student,
                    data: { recent, previous, decline: previous - recent }
                })
            }
        }
    }
    
    // 2. Estudiantes que no participan hace más de 2 semanas
    const twoWeeksAgo = new Date()
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14)
    
    const { data: inactiveStudents } = await supabase
        .from('users')
        .select('*')
        .lt('last_participation', twoWeeksAgo.toISOString())
        .eq('active', true)
    
    for (const student of inactiveStudents || []) {
        triggers.push({
            type: 'inactive',
            student: student,
            data: { daysSinceLastParticipation: Math.floor((new Date() - new Date(student.last_participation)) / (1000 * 60 * 60 * 24)) }
        })
    }
    
    // 3. Estudiantes que mejoraron significativamente (para felicitar)
    // ... similar lógica para detectar mejoras
    
    return triggers
}

async function processEmailTrigger(supabase, trigger) {
    // Verificar que no hayamos enviado un email similar recientemente
    const { data: recentEmails } = await supabase
        .from('email_logs')
        .select('*')
        .eq('user_id', trigger.student.id)
        .eq('email_type', `automated_${trigger.type}`)
        .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 7 días
    
    if (recentEmails && recentEmails.length > 0) {
        console.log(`Email ya enviado recientemente a ${trigger.student.email}`)
        return
    }
    
    // Generar contenido del email basado en el trigger
    const emailContent = generateAutomatedEmail(trigger)
    
    // Enviar el email
    await sendEmail(supabase, {
        to: trigger.student.email,
        subject: emailContent.subject,
        html: emailContent.html,
        student_id: trigger.student.id,
        type: `automated_${trigger.type}`
    })
}

function generateAutomatedEmail(trigger) {
    const templates = {
        score_decline: {
            subject: `${trigger.student.username}, ¿necesitas ayuda? 🤝`,
            html: `
                <h2>Hola ${trigger.student.username},</h2>
                <p>He notado que tu última puntuación fue de ${trigger.data.recent.toFixed(2)}/10, 
                   una bajada de ${trigger.data.decline.toFixed(2)} puntos respecto al simulacro anterior.</p>
                <p>Todos tenemos días difíciles, y es completamente normal. Lo importante es no desanimarse.</p>
                <p><strong>¿Qué puedo hacer para ayudarte?</strong></p>
                <ul>
                    <li>¿Necesitas repasar algún tema específico?</li>
                    <li>¿Te gustaría programar una sesión de dudas?</li>
                    <li>¿Hay algo que te esté preocupando?</li>
                </ul>
                <p>Responde a este email y cuéntame cómo puedo apoyarte mejor.</p>
                <p>¡Ánimo! 💪</p>
            `
        },
        inactive: {
            subject: `Te echamos de menos, ${trigger.student.username} 👋`,
            html: `
                <h2>Hola ${trigger.student.username},</h2>
                <p>Han pasado ${trigger.data.daysSinceLastParticipation} días desde tu última participación.</p>
                <p>La constancia es clave para el éxito, y me gustaría verte de vuelta en los simulacros.</p>
                <p>Si hay algo que te está impidiendo participar, por favor házmelo saber.</p>
                <p>¡El próximo simulacro te está esperando!</p>
                <a href="https://tudominio.com/simulacro" style="background: #1e3a8a; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block; margin-top: 10px;">
                    Ir al simulacro
                </a>
            `
        }
    }
    
    return templates[trigger.type] || { subject: 'Mensaje de IZETA', html: '<p>Contenido</p>' }
}