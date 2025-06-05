export default class EvolcampusSyncModule {
  constructor(supabaseClient, dashboardCore) {
    this.supabase = supabaseClient;
    this.dashboard = dashboardCore;
  }

  async render(container) {
    const lastSync = await this.getLastSync();

    container.innerHTML = `
      <div class="evolcampus-sync-page">
        <h2>🔄 Sincronización con Evolcampus</h2>
        <p>Controla la importación de progreso desde la plataforma Evolcampus.</p>

        <div class="card sync-status-card">
          <h3>Estado de la última sincronización</h3>
          ${lastSync ? this.renderStatus(lastSync) : '<p>No hay registros aún.</p>'}
        </div>

        <div class="card manual-sync-card">
          <h3>Forzar sincronización</h3>
          <p>Haz clic en el botón para lanzar la importación manualmente.</p>
          <button id="runSyncBtn" class="btn btn-primary">🚀 Ejecutar ahora</button>
        </div>
      </div>
    `;

    // Evento forzar sync
    document.getElementById('runSyncBtn')?.addEventListener('click', () => this.runSync(container));
  }

  async getLastSync() {
    const { data, error } = await this.supabase
      .from('api_sync_log')
      .select('*')
      .order('executed_at', { ascending: false })
      .limit(1);
    if (error) {
      console.error('Error obteniendo sync log:', error);
      return null;
    }
    return data?.[0] || null;
  }

  renderStatus(log) {
    const statusColor = log.status_code === 200 ? 'green' : 'red';
    return `
      <ul class="sync-details">
        <li><strong>Fecha:</strong> ${new Date(log.executed_at).toLocaleString()}</li>
        <li><strong>Código HTTP:</strong> <span style="color:${statusColor}">${log.status_code}</span></li>
        <li><strong>Registros importados:</strong> ${log.records_synced}</li>
      </ul>
    `;
  }

  async runSync(container) {
    try {
      const button = document.getElementById('runSyncBtn');
      if (button) {
        button.disabled = true;
        button.textContent = '⏳ Sincronizando...';
      }

      const { data, error } = await this.supabase.functions.invoke('sync-evolvcampus');

      if (error) throw error;

      this.notify('success', `Sincronización completada: ${data.records_synced} registros`);

      // Refrescar vista
      await this.render(container);
    } catch (err) {
      console.error('Error ejecutando sincronización:', err);
      this.notify('error', 'Error al sincronizar: ' + err.message);
    }
  }

  notify(type, message) {
    if (this.dashboard && typeof this.dashboard.showNotification === 'function') {
      this.dashboard.showNotification(type, message);
    } else if (window.dashboardAdmin && typeof window.dashboardAdmin.showNotification === 'function') {
      window.dashboardAdmin.showNotification(type, message);
    } else {
      // Fallback: simple alert
      console[type === 'error' ? 'error' : 'log'](message);
    }
  }
} 