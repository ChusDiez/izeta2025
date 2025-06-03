// /admin/js/modules/auth.js
// Módulo de autenticación y verificación de permisos de administrador

export class AdminAuth {
    constructor(supabaseClient) {
        this.supabase = supabaseClient;
        this.currentUser = null;
        this.isAdmin = false;
    }

    /**
     * Verificar si hay un usuario autenticado
     */
    async checkAuth() {
        try {
            const { data: { user }, error } = await this.supabase.auth.getUser();
            
            if (error) {
                console.error('Error verificando autenticación:', error);
                return null;
            }
            
            this.currentUser = user;
            return user;
        } catch (error) {
            console.error('Error en checkAuth:', error);
            return null;
        }
    }

    /**
     * Verificar si el usuario es administrador consultando la BD
     */
    async checkIfUserIsAdmin(email) {
        try {
            console.log('Verificando permisos de admin para:', email);
            
            // Verificar en la tabla users el campo is_admin
            const { data, error } = await this.supabase
                .from('users')
                .select('id, email, username, is_admin')
                .eq('email', email.toLowerCase().trim())
                .single();
            
            if (error) {
                console.error('Error al verificar admin en BD:', error);
                return false;
            }
            
            if (!data) {
                console.error('Usuario no encontrado en la BD:', email);
                return false;
            }
            
            console.log('Datos del usuario:', data);
            this.isAdmin = data.is_admin === true;
            
            // Guardar información adicional del usuario admin
            if (this.isAdmin) {
                this.currentUser = {
                    ...this.currentUser,
                    dbInfo: data
                };
            }
            
            return this.isAdmin;
            
        } catch (error) {
            console.error('Error en checkIfUserIsAdmin:', error);
            return false;
        }
    }

    /**
     * Verificación completa de acceso admin
     */
    async verifyAdminAccess() {
        try {
            // 1. Verificar autenticación
            const user = await this.checkAuth();
            
            if (!user) {
                console.log('No hay usuario autenticado');
                return {
                    success: false,
                    error: 'NOT_AUTHENTICATED',
                    message: 'No hay sesión activa'
                };
            }
            
            // 2. Verificar permisos de admin
            const isAdmin = await this.checkIfUserIsAdmin(user.email);
            
            if (!isAdmin) {
                console.log('Usuario no es administrador:', user.email);
                return {
                    success: false,
                    error: 'NOT_ADMIN',
                    message: 'No tienes permisos de administrador'
                };
            }
            
            console.log('Acceso de administrador verificado para:', user.email);
            
            return {
                success: true,
                user: this.currentUser,
                isAdmin: true
            };
            
        } catch (error) {
            console.error('Error en verifyAdminAccess:', error);
            return {
                success: false,
                error: 'VERIFICATION_ERROR',
                message: 'Error al verificar permisos'
            };
        }
    }

    /**
     * Cerrar sesión
     */
    async logout() {
        try {
            const { error } = await this.supabase.auth.signOut();
            
            if (error) {
                console.error('Error al cerrar sesión:', error);
                return { success: false, error };
            }
            
            this.currentUser = null;
            this.isAdmin = false;
            
            return { success: true };
            
        } catch (error) {
            console.error('Error en logout:', error);
            return { success: false, error };
        }
    }

    /**
     * Obtener información del usuario actual
     */
    getUserInfo() {
        return {
            user: this.currentUser,
            isAdmin: this.isAdmin,
            email: this.currentUser?.email || null,
            dbInfo: this.currentUser?.dbInfo || null
        };
    }

    /**
     * Suscribirse a cambios de autenticación
     */
    onAuthStateChange(callback) {
        return this.supabase.auth.onAuthStateChange(async (event, session) => {
            console.log('Auth state changed:', event);
            
            if (event === 'SIGNED_IN' && session) {
                // Re-verificar permisos cuando el usuario inicia sesión
                const isAdmin = await this.checkIfUserIsAdmin(session.user.email);
                callback(event, session, isAdmin);
            } else {
                callback(event, session, false);
            }
        });
    }

    /**
     * Middleware para proteger rutas/funciones admin
     */
    async requireAdmin() {
        const result = await this.verifyAdminAccess();
        
        if (!result.success) {
            // Redirigir según el tipo de error
            const redirectUrl = result.error === 'NOT_AUTHENTICATED' 
                ? '/admin/login.html' 
                : '/public/index.html';
            
            // Mostrar mensaje antes de redirigir
            if (result.error === 'NOT_ADMIN') {
                alert('No tienes permisos para acceder a esta sección');
            }
            
            window.location.href = this.getBasePath() + redirectUrl;
            return false;
        }
        
        return true;
    }

    /**
     * Obtener la ruta base (para GitHub Pages)
     */
    getBasePath() {
        if (window.location.hostname.includes('github.io')) {
            const pathParts = window.location.pathname.split('/');
            return '/' + pathParts[1];
        }
        return '';
    }

    /**
     * Gestión de permisos granulares (futuro)
     */
    async checkPermission(permission) {
        // Por ahora solo verificamos si es admin
        // En el futuro podríamos tener una tabla de permisos específicos
        return this.isAdmin;
    }

    /**
     * Log de actividad administrativa
     */
    async logAdminActivity(action, details = {}) {
        if (!this.isAdmin || !this.currentUser) return;
        
        try {
            const { error } = await this.supabase
                .from('admin_activity_logs')
                .insert({
                    admin_id: this.currentUser.id,
                    action: action,
                    details: details,
                    ip_address: await this.getClientIP(),
                    user_agent: navigator.userAgent,
                    created_at: new Date().toISOString()
                });
            
            if (error) {
                console.error('Error registrando actividad:', error);
            }
        } catch (error) {
            console.error('Error en logAdminActivity:', error);
        }
    }

    /**
     * Obtener IP del cliente (básico)
     */
    async getClientIP() {
        try {
            const response = await fetch('https://api.ipify.org?format=json');
            const data = await response.json();
            return data.ip;
        } catch (error) {
            return 'unknown';
        }
    }
}

// Exportar una instancia singleton
let authInstance = null;

export function getAuthInstance(supabaseClient) {
    if (!authInstance) {
        authInstance = new AdminAuth(supabaseClient);
    }
    return authInstance;
}