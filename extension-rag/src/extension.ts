import * as vscode from 'vscode';
import { MonitoringReader } from './services/MonitoringReader';

let monitoringReader: MonitoringReader | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('RAG MCP Extension (Read-Only) is now active!');

  // Initialize Monitoring Reader
  monitoringReader = new MonitoringReader();

  // Register commands
  const commands = [
    vscode.commands.registerCommand('rag-mcp.showDashboard', () => {
      showDashboard();
    }),
    vscode.commands.registerCommand('rag-mcp.getStatus', () => {
      getStatus();
    }),
    vscode.commands.registerCommand('rag-mcp.showMetrics', () => {
      showMetrics();
    }),
    vscode.commands.registerCommand('rag-mcp.showHealth', () => {
      showHealth();
    }),
    vscode.commands.registerCommand('rag-mcp.showEvents', () => {
      showEvents();
    })
  ];

  commands.forEach(command => context.subscriptions.push(command));

  // Check if monitoring is available
  checkMonitoringAvailability();
}

export function deactivate() {
  // No cleanup needed for read-only extension
}

async function checkMonitoringAvailability() {
  if (!monitoringReader) {
    return;
  }

  const isAvailable = await monitoringReader.isMonitoringAvailable();
  if (!isAvailable) {
    vscode.window.showWarningMessage(
      '⚠️ RAG MCP Monitoring non disponible. Le moteur RAG n\'a pas encore généré de données de monitoring.',
      { modal: false }
    );
  }
}

async function showDashboard() {
  if (!monitoringReader) {
    vscode.window.showErrorMessage('MonitoringReader non initialisé');
    return;
  }

  const panel = vscode.window.createWebviewPanel(
    'ragMcpDashboard',
    'RAG MCP Dashboard',
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  // Load metrics
  const metrics = await monitoringReader.readMetrics();
  const health = await monitoringReader.readHealthStatus();
  const events = await monitoringReader.readTodayEvents();

  let html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>RAG MCP Dashboard</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          padding: 20px;
          background: #1e1e1e;
          color: #d4d4d4;
        }
        .card {
          background: #252526;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 20px;
          border-left: 4px solid #007acc;
        }
        .card h2 {
          margin-top: 0;
          color: #569cd6;
        }
        .metric {
          display: flex;
          justify-content: space-between;
          margin: 8px 0;
          padding: 8px;
          background: #2d2d30;
          border-radius: 4px;
        }
        .metric .label {
          font-weight: 500;
        }
        .metric .value {
          font-weight: bold;
          color: #4ec9b0;
        }
        .status-healthy { color: #4ec9b0; }
        .status-degraded { color: #ffcc00; }
        .status-unhealthy { color: #f44747; }
        .event {
          padding: 8px;
          margin: 4px 0;
          background: #2d2d30;
          border-radius: 4px;
          border-left: 3px solid #007acc;
        }
        .event-time {
          font-size: 0.9em;
          color: #858585;
        }
        .event-message {
          margin-top: 4px;
        }
      </style>
    </head>
    <body>
      <h1>📊 RAG MCP Dashboard</h1>
      <p>Extension read-only - Données lues depuis les fichiers de monitoring</p>
  `;

  if (metrics) {
    html += `
      <div class="card">
        <h2>📈 Métriques Système</h2>
        <div class="metric">
          <span class="label">Dernière mise à jour</span>
          <span class="value">${new Date(metrics.last_updated).toLocaleString()}</span>
        </div>
        <div class="metric">
          <span class="label">Uptime</span>
          <span class="value">${Math.floor(metrics.system.uptime_seconds / 3600)}h ${Math.floor((metrics.system.uptime_seconds % 3600) / 60)}m</span>
        </div>
        <div class="metric">
          <span class="label">CPU</span>
          <span class="value">${metrics.system.cpu_usage_percent}%</span>
        </div>
        <div class="metric">
          <span class="label">Mémoire</span>
          <span class="value">${metrics.system.memory_usage_percent}%</span>
        </div>
        <div class="metric">
          <span class="label">Threads actifs</span>
          <span class="value">${metrics.system.active_threads}</span>
        </div>
      </div>

      <div class="card">
        <h2>📋 File d'attente</h2>
        <div class="metric">
          <span class="label">Tâches en attente</span>
          <span class="value">${metrics.queue.pending_tasks}</span>
        </div>
        <div class="metric">
          <span class="label">Tâches actives</span>
          <span class="value">${metrics.queue.active_tasks}</span>
        </div>
        <div class="metric">
          <span class="label">Tâches terminées</span>
          <span class="value">${metrics.queue.completed_tasks}</span>
        </div>
        <div class="metric">
          <span class="label">Tâches échouées</span>
          <span class="value">${metrics.queue.failed_tasks}</span>
        </div>
      </div>
    `;
  }

  if (health) {
    const statusClass = `status-${health.status}`;
    html += `
      <div class="card">
        <h2>🏥 Statut de Santé</h2>
        <div class="metric">
          <span class="label">Statut</span>
          <span class="value ${statusClass}">${health.status.toUpperCase()}</span>
        </div>
        <div class="metric">
          <span class="label">Dernière vérification</span>
          <span class="value">${new Date(health.timestamp).toLocaleString()}</span>
        </div>
        <h3>Vérifications</h3>
    `;

    health.checks.forEach(check => {
      const checkEmoji = check.status === 'pass' ? '✅' : check.status === 'warning' ? '⚠️' : '❌';
      html += `
        <div class="metric">
          <span class="label">${checkEmoji} ${check.name}</span>
          <span class="value">${check.message}</span>
        </div>
      `;
    });

    html += `</div>`;
  }

  if (events.length > 0) {
    html += `
      <div class="card">
        <h2>📝 Événements Récents</h2>
        <p>${events.length} événements aujourd'hui</p>
    `;

    const recentEvents = events.slice(-5).reverse();
    recentEvents.forEach(event => {
      const time = new Date(event.timestamp).toLocaleTimeString();
      const emoji = event.type === 'info' ? 'ℹ️' :
        event.type === 'warning' ? '⚠️' :
          event.type === 'error' ? '❌' :
            event.type === 'phase_started' ? '🚀' :
              event.type === 'task_completed' ? '✅' : '📌';

      html += `
        <div class="event">
          <div class="event-time">${emoji} [${time}]</div>
          <div class="event-message">${event.message}</div>
        </div>
      `;
    });

    html += `</div>`;
  }

  if (!metrics && !health && events.length === 0) {
    html += `
      <div class="card">
        <h2>⚠️ Aucune donnée disponible</h2>
        <p>Le moteur RAG MCP n'a pas encore généré de données de monitoring.</p>
        <p>Vérifiez que le service est en cours d'exécution et qu'il a écrit des fichiers dans le dossier <code>rag/monitoring/</code>.</p>
      </div>
    `;
  }

  html += `
    </body>
    </html>
  `;

  panel.webview.html = html;
}

async function getStatus() {
  if (!monitoringReader) {
    vscode.window.showErrorMessage('MonitoringReader non initialisé');
    return;
  }

  const metrics = await monitoringReader.readMetrics();
  if (!metrics) {
    vscode.window.showWarningMessage('⚠️ Aucune métrique disponible. Le monitoring RAG n\'est pas encore initialisé.');
    return;
  }

  const message = `📊 RAG MCP Status (Read-Only)\n` +
    `• Dernière mise à jour: ${new Date(metrics.last_updated).toLocaleString()}\n` +
    `• Uptime: ${Math.floor(metrics.system.uptime_seconds / 3600)}h ${Math.floor((metrics.system.uptime_seconds % 3600) / 60)}m\n` +
    `• CPU: ${metrics.system.cpu_usage_percent}%\n` +
    `• Mémoire: ${metrics.system.memory_usage_percent}%\n` +
    `• Tâches en attente: ${metrics.queue.pending_tasks}\n` +
    `• Tâches actives: ${metrics.queue.active_tasks}\n` +
    `• Projets: ${Object.keys(metrics.projects || {}).length}`;

  vscode.window.showInformationMessage(message);
}

async function showMetrics() {
  if (!monitoringReader) {
    vscode.window.showErrorMessage('MonitoringReader non initialisé');
    return;
  }

  const metrics = await monitoringReader.readMetrics();
  if (!metrics) {
    vscode.window.showWarningMessage('Aucune métrique disponible');
    return;
  }

  const formatted = monitoringReader.formatMetrics(metrics);
  showMarkdownPreview('Métriques RAG MCP', formatted);
}

async function showHealth() {
  if (!monitoringReader) {
    vscode.window.showErrorMessage('MonitoringReader non initialisé');
    return;
  }

  const health = await monitoringReader.readHealthStatus();
  if (!health) {
    vscode.window.showWarningMessage('Aucun statut de santé disponible');
    return;
  }

  const formatted = monitoringReader.formatHealthStatus(health);
  showMarkdownPreview('Statut de Santé RAG MCP', formatted);
}

async function showEvents() {
  if (!monitoringReader) {
    vscode.window.showErrorMessage('MonitoringReader non initialisé');
    return;
  }

  const events = await monitoringReader.readTodayEvents();
  if (events.length === 0) {
    vscode.window.showInformationMessage('Aucun événement aujourd\'hui');
    return;
  }

  const formatted = monitoringReader.formatEvents(events);
  showMarkdownPreview('Événements RAG MCP', formatted);
}

function showMarkdownPreview(title: string, content: string) {
  const panel = vscode.window.createWebviewPanel(
    'ragMcpPreview',
    title,
    vscode.ViewColumn.One,
    { enableScripts: true }
  );

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title}</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
          padding: 20px;
          background: #1e1e1e;
          color: #d4d4d4;
          line-height: 1.6;
          white-space: pre-wrap;
        }
        h1, h2, h3 {
          color: #569cd6;
        }
        strong {
          color: #dcdcaa;
        }
        .emoji {
          font-size: 1.2em;
        }
      </style>
    </head>
    <body>
      ${content.replace(/\n/g, '<br>')}
    </body>
    </html>
  `;

  panel.webview.html = html;
}
