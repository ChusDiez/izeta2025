export default class EvolcampusSyncModule {
  constructor(supabaseClient, dashboardCore) {
    this.supabase = supabaseClient;
    this.dashboard = dashboardCore;
    window.evolcampusSync = this; // Referencia global para el modal
  }

  async render(container) {
    const lastSync = await this.getLastSync();
    const studentsData = await this.getEvolcampusStudentsData();

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
        
        <div class="card students-summary-card">
          <h3>📊 Resumen de Estudiantes en Evolcampus</h3>
          ${this.renderStudentsSummary(studentsData)}
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

      // Mostrar resumen detallado
      let message = `✅ Sincronización completada: ${data.records_synced} registros procesados`;
      
      if (data.summary && data.not_found_emails && data.not_found_emails.length > 0) {
        message += `\n\n⚠️ ${data.not_found_emails.length} usuarios no encontrados en el sistema:`;
        data.not_found_emails.forEach(email => {
          message += `\n• ${email}`;
        });
        
        // Mostrar modal con detalles si hay muchos no encontrados
        if (data.not_found_emails.length > 5) {
          this.showNotFoundReport(data);
        }
      }
      
      this.notify('success', message);

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

  showNotFoundReport(data) {
    const modalHtml = `
      <div id="notFoundModal" class="modal" style="display: flex;">
        <div class="modal-content">
          <div class="modal-header">
            <h3>📋 Reporte de Usuarios No Encontrados</h3>
            <button class="btn-icon" onclick="document.getElementById('notFoundModal').remove()">✖️</button>
          </div>
          <div class="modal-body">
            <p><strong>Resumen de sincronización:</strong></p>
            <ul>
              <li>Total en Evolcampus: ${data.summary.total_evolcampus}</li>
              <li>Encontrados en sistema: ${data.summary.found_in_system}</li>
              <li>No encontrados: ${data.summary.not_found}</li>
              <li>Registros sincronizados: ${data.summary.synced_records}</li>
            </ul>
            
            <p><strong>Emails no encontrados:</strong></p>
            <div style="max-height: 300px; overflow-y: auto; background: #f5f5f5; padding: 10px; border-radius: 4px;">
              ${data.not_found_emails.map(email => `<div>• ${email}</div>`).join('')}
            </div>
            
            <div style="margin-top: 20px;">
              <button class="btn btn-primary" onclick="window.evolcampusSync.copyNotFoundEmails('${data.not_found_emails.join(',')}')">
                📋 Copiar emails
              </button>
              <button class="btn btn-secondary" onclick="document.getElementById('notFoundModal').remove()">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }
  
  copyNotFoundEmails(emailsStr) {
    const emails = emailsStr.split(',').join('\n');
    navigator.clipboard.writeText(emails).then(() => {
      this.notify('success', 'Emails copiados al portapapeles');
    });
  }

  async getEvolcampusStudentsData() {
    const { data, error } = await this.supabase
      .from('evolcampus_student_summary')
      .select('*')
      .order('last_activity', { ascending: false, nullsFirst: false });
    
    if (error) {
      console.error('Error obteniendo resumen de estudiantes:', error);
      return [];
    }
    
    return data || [];
  }

  renderStudentsSummary(students) {
    if (!students || students.length === 0) {
      return '<p>No hay estudiantes sincronizados aún.</p>';
    }

    const studentsWithData = students.filter(s => s.completed_percent !== null);
    const avgCompletion = studentsWithData.length > 0 
      ? studentsWithData.reduce((sum, s) => sum + (s.completed_percent || 0), 0) / studentsWithData.length 
      : 0;
    const avgGrade = studentsWithData.filter(s => s.grade !== null).reduce((sum, s) => sum + (s.grade || 0), 0) / studentsWithData.filter(s => s.grade !== null).length || 0;
    const activeStudents = students.filter(s => {
      if (!s.last_connect) return false;
      const daysSinceConnect = (Date.now() - new Date(s.last_connect).getTime()) / (1000 * 60 * 60 * 24);
      return daysSinceConnect < 7;
    }).length;

    return `
      <div class="evolcampus-stats-grid" style="margin-bottom: 2rem;">
        <div class="stat-card">
          <div class="stat-value">${students.length}</div>
          <div class="stat-label">Total Estudiantes</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${studentsWithData.length}</div>
          <div class="stat-label">Con Datos</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgCompletion.toFixed(1)}%</div>
          <div class="stat-label">Promedio Completado</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${avgGrade.toFixed(1)}</div>
          <div class="stat-label">Nota Promedio</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${activeStudents}</div>
          <div class="stat-label">Activos (7 días)</div>
        </div>
      </div>
      
      <h4>Lista de Estudiantes</h4>
      <div style="overflow-x: auto;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Estudiante</th>
              <th>Cohorte</th>
              <th>Estudio</th>
              <th>% Completado</th>
              <th>Nota</th>
              <th>Temas</th>
              <th>Última Conexión</th>
              <th>Última Actividad</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${students.map(student => `
              <tr>
                <td>
                  <strong>${student.username}</strong><br>
                  <small class="text-muted">${student.email}</small>
                </td>
                <td><span class="badge badge-info">${student.cohort}</span></td>
                <td>${student.study || 'N/A'}</td>
                <td>
                  <div class="progress-bar-mini">
                    <div class="progress-fill" style="width: ${student.completed_percent || 0}%"></div>
                    <span>${student.completed_percent || 0}%</span>
                  </div>
                </td>
                <td>${student.grade !== null ? student.grade.toFixed(1) : 'N/A'}</td>
                <td>${student.topics_studied || 0}</td>
                <td>${student.last_connect ? new Date(student.last_connect).toLocaleDateString() : 'N/A'}</td>
                <td>${student.last_activity ? new Date(student.last_activity).toLocaleDateString() : 'N/A'}</td>
                <td>
                  <button class="btn btn-sm btn-secondary" onclick="window.dashboardAdmin.showStudentDetail('${student.student_id}')">
                    👁️ Ver
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
      
      <style>
        .evolcampus-stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 1rem;
        }
        
        .progress-bar-mini {
          position: relative;
          width: 100px;
          height: 20px;
          background: #e5e7eb;
          border-radius: 10px;
          overflow: hidden;
        }
        
        .progress-bar-mini .progress-fill {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          background: #3b82f6;
          transition: width 0.3s ease;
        }
        
        .progress-bar-mini span {
          position: relative;
          z-index: 1;
          display: block;
          text-align: center;
          font-size: 0.75rem;
          line-height: 20px;
          font-weight: 600;
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
        }
        
        .data-table th,
        .data-table td {
          padding: 0.75rem;
          text-align: left;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .data-table th {
          background: #f9fafb;
          font-weight: 600;
          color: #374151;
        }
        
        .data-table tbody tr:hover {
          background: #f9fafb;
        }
      </style>
    `;
  }
} 