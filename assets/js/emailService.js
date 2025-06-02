// Archivo: assets/js/emailService.js

/**
 * Servicio simple para enviar el email de confirmación de resultados
 * Versión 1.0 - Solo maneja confirmaciones de resultado
 */
class EmailService {
    /**
     * Envía un email de confirmación cuando el usuario envía sus resultados
     * 
     * @param {Object} resultData - Los datos del resultado del simulacro
     * @param {string} resultData.userId - ID del usuario
     * @param {string} resultData.simulationId - ID del simulacro
     * @param {number} resultData.score - Puntuación obtenida
     * @param {number} resultData.correctAnswers - Número de aciertos
     * @param {number} resultData.wrongAnswers - Número de fallos
     * @param {number} resultData.blankAnswers - Número de preguntas en blanco
     * @param {Array} [resultData.weakestTopics] - Temas donde necesita refuerzo
     * @param {number} [resultData.reviewTime] - Tiempo dedicado a revisar
     * 
     * @returns {Promise<Object>} Respuesta del servicio
     */
    static async sendResultConfirmation(resultData) {
        try {
            console.log('Enviando email de confirmación...', resultData)
            
            // Invocar la Edge Function con los datos
            const { data, error } = await supabaseClient.functions.invoke('email-service', {
                body: resultData
            })
            
            if (error) {
                throw error
            }
            
            console.log('Respuesta del servicio:', data)
            
            // Si el servicio responde con éxito, retornamos los datos
            if (data.success) {
                return data
            } else {
                throw new Error(data.error || 'Error desconocido en el servicio')
            }
            
        } catch (error) {
            console.error('Error al enviar email:', error)
            
            // Re-lanzamos el error para que el código que llama pueda manejarlo
            throw error
        }
    }
}

// Hacer disponible el servicio globalmente
window.EmailService = EmailService