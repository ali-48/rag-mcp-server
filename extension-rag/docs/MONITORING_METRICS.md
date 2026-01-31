# 📊 Monitoring et Métriques - McpClient

Ce document décrit les fonctionnalités de monitoring, métriques et logs ajoutées à la classe `McpClient`.

## 🎯 Objectifs

1. **Surveillance en temps réel** : État de la connexion, métriques de performance
2. **Logs structurés** : Logs détaillés avec différents niveaux et format JSON optionnel
3. **Métriques de performance** : Temps de réponse, taux de succès, volume de données
4. **Diagnostic** : Outils pour diagnostiquer les problèmes de connexion

## 📋 Interfaces

### ConnectionMetrics

```typescript
interface ConnectionMetrics {
  totalConnections: number; // Nombre total de tentatives de connexion
  successfulConnections: number; // Connexions réussies
  failedConnections: number; // Connexions échouées
  totalRequests: number; // Nombre total de requêtes MCP
  successfulRequests: number; // Requêtes réussies
  failedRequests: number; // Requêtes échouées
  totalBytesSent: number; // Octets envoyés
  totalBytesReceived: number; // Octets reçus
  averageResponseTime: number; // Temps de réponse moyen (ms)
  lastConnectionTime: Date | null; // Dernière connexion réussie
  lastErrorTime: Date | null; // Dernière erreur
  uptime: number; // Temps de fonctionnement (secondes)
}
```

### LogEntry

```typescript
interface LogEntry {
  timestamp: Date; // Horodatage
  level: "info" | "warn" | "error" | "debug"; // Niveau de log
  message: string; // Message
  data?: any; // Données supplémentaires
  requestId?: number; // ID de requête associé
  toolName?: string; // Nom de l'outil MCP
}
```

### ConnectionStatus

```typescript
interface ConnectionStatus {
  isConnected: boolean; // État de connexion
  serverUrl: string; // URL du serveur
  lastError?: string; // Dernière erreur
  metrics: ConnectionMetrics; // Métriques complètes
  uptime: number; // Temps de fonctionnement (secondes)
  pendingRequests: number; // Requêtes en attente
  lastHeartbeat?: Date; // Dernier heartbeat réussi
}
```

## 🔧 Fonctionnalités

### 1. Logs structurés

#### Niveaux de log

- **info** : Événements normaux (connexion, déconnexion, requêtes)
- **warn** : Avertissements (validation échouée, problèmes mineurs)
- **error** : Erreurs (timeout, échec connexion, parsing)
- **debug** : Informations détaillées (optionnel)

#### Format de sortie

- **Par défaut** : Messages formatés avec emojis dans la console
- **Structured logs** : JSON structuré (activé via `setStructuredLogs(true)`)

#### Exemple de log structuré

```json
{
  "timestamp": "2026-01-31T00:25:00.000Z",
  "level": "info",
  "message": "Connected to MCP server at ws://localhost:3000 (150ms)",
  "data": null,
  "requestId": null,
  "toolName": null
}
```

### 2. Métriques de performance

#### Métriques collectées

- **Connexions** : Succès/échecs, temps de connexion
- **Requêtes** : Volume, taux de succès, temps de réponse
- **Données** : Octets envoyés/reçus
- **Disponibilité** : Uptime, dernier heartbeat

#### Mise à jour automatique

Les métriques sont mises à jour automatiquement lors de :

- Tentative de connexion (succès/échec)
- Envoi de requête
- Réception de réponse
- Timeout de requête
- Erreur de parsing

### 3. Surveillance en temps réel

#### Méthodes disponibles

```typescript
// Obtenir l'état complet de la connexion
const status = client.getConnectionStatus();

// Obtenir les métriques
const metrics = client.getMetrics();

// Obtenir les logs (filtrés par niveau)
const logs = client.getLogs("error", 50);

// Valider la connexion (heartbeat)
const isValid = await client.validateConnection();
```

## 🚀 Utilisation

### Configuration de base

```typescript
import { McpClient } from "./services/McpClient";

// Créer le client
const client = new McpClient("ws://localhost:3000", 30000);

// Activer les logs structurés (optionnel)
client.setStructuredLogs(true);

// Activer/désactiver la validation de sortie
client.setOutputValidation(true);
```

### Surveillance pendant l'exécution

```typescript
// Connexion
await client.connect();

// Exécuter des requêtes
const result = await client.call("get_status", { scope: "global" });

// Surveiller l'état
const status = client.getConnectionStatus();
console.log("État connexion:", {
  isConnected: status.isConnected,
  uptime: status.uptime,
  pendingRequests: status.pendingRequests,
  successRate:
    (
      (status.metrics.successfulRequests / status.metrics.totalRequests) *
      100
    ).toFixed(1) + "%",
  avgResponseTime: status.metrics.averageResponseTime.toFixed(0) + "ms",
});

// Obtenir les logs d'erreur
const errorLogs = client.getLogs("error");
errorLogs.forEach((log) => {
  console.error(`[${log.timestamp.toISOString()}] ${log.message}`, log.data);
});

// Valider périodiquement la connexion
setInterval(async () => {
  const isValid = await client.validateConnection();
  if (!isValid) {
    console.warn("Connexion perdue, tentative de reconnexion...");
    // Logique de reconnexion
  }
}, 30000); // Toutes les 30 secondes
```

### Diagnostic avancé

```typescript
// Diagnostic complet
async function diagnoseConnection(client: McpClient) {
  const status = client.getConnectionStatus();
  const metrics = client.getMetrics();
  const recentLogs = client.getLogs(undefined, 20);

  console.log("=== DIAGNOSTIC MCP CLIENT ===");
  console.log("État:", status.isConnected ? "✅ Connecté" : "❌ Déconnecté");
  console.log("Uptime:", status.uptime.toFixed(0) + "s");
  console.log("URL serveur:", status.serverUrl);

  if (status.lastError) {
    console.log("Dernière erreur:", status.lastError);
  }

  console.log("\n=== MÉTRIQUES ===");
  console.log("Connexions:", {
    total: metrics.totalConnections,
    success: metrics.successfulConnections,
    failure: metrics.failedConnections,
    rate:
      (
        (metrics.successfulConnections / metrics.totalConnections) *
        100
      ).toFixed(1) + "%",
  });

  console.log("Requêtes:", {
    total: metrics.totalRequests,
    success: metrics.successfulRequests,
    failure: metrics.failedRequests,
    rate:
      ((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(1) +
      "%",
    avgTime: metrics.averageResponseTime.toFixed(0) + "ms",
  });

  console.log("Données:", {
    sent: (metrics.totalBytesSent / 1024).toFixed(1) + " KB",
    received: (metrics.totalBytesReceived / 1024).toFixed(1) + " KB",
  });

  console.log("\n=== DERNIERS LOGS ===");
  recentLogs.forEach((log) => {
    const emoji = { info: "ℹ️", warn: "⚠️", error: "❌", debug: "🔍" }[
      log.level
    ];
    console.log(`${emoji} [${log.timestamp.toISOString()}] ${log.message}`);
    if (log.data) console.log("   Données:", log.data);
  });
}

// Exécuter le diagnostic
diagnoseConnection(client);
```

## 🎯 Bonnes pratiques

### 1. Surveillance proactive

```typescript
// Configurer une surveillance périodique
class McpMonitor {
  private client: McpClient;
  private checkInterval: NodeJS.Timeout;

  constructor(client: McpClient) {
    this.client = client;
    this.checkInterval = setInterval(() => this.checkHealth(), 60000); // Toutes les minutes
  }

  private async checkHealth() {
    const status = this.client.getConnectionStatus();

    // Alerter si trop d'erreurs
    if (
      status.metrics.failedRequests > 10 &&
      status.metrics.failedRequests / status.metrics.totalRequests > 0.3
    ) {
      console.error("⚠️ Taux d'erreur élevé détecté!");
      await this.alertAdmin(status);
    }

    // Alerter si temps de réponse élevé
    if (status.metrics.averageResponseTime > 5000) {
      // > 5 secondes
      console.warn("⚠️ Temps de réponse élevé détecté!");
    }
  }

  private async alertAdmin(status: ConnectionStatus) {
    // Implémenter l'alerte (email, webhook, etc.)
  }

  stop() {
    clearInterval(this.checkInterval);
  }
}
```

### 2. Logs pour le débogage

```typescript
// Activer les logs détaillés en développement
if (process.env.NODE_ENV === "development") {
  client.setStructuredLogs(true);

  // Capturer tous les logs
  const allLogs = client.getLogs();
  // Sauvegarder dans un fichier ou envoyer à un service
}

// En production, filtrer les logs
const errorLogs = client.getLogs("error");
if (errorLogs.length > 0) {
  // Envoyer les erreurs à un service de monitoring
  sendToMonitoringService(errorLogs);
}
```

### 3. Métriques pour l'optimisation

```typescript
// Analyser les performances
function analyzePerformance(metrics: ConnectionMetrics) {
  const insights = [];

  // Taux de succès des connexions
  const connectionSuccessRate =
    metrics.successfulConnections / metrics.totalConnections;
  if (connectionSuccessRate < 0.8) {
    insights.push("Taux de succès des connexions faible (< 80%)");
  }

  // Temps de réponse
  if (metrics.averageResponseTime > 1000) {
    insights.push(
      `Temps de réponse moyen élevé: ${metrics.averageResponseTime.toFixed(0)}ms`,
    );
  }

  // Volume de données
  const dataRatio = metrics.totalBytesReceived / metrics.totalBytesSent;
  if (dataRatio < 0.5) {
    insights.push("Ratio données reçues/envoyées faible");
  }

  return insights;
}
```

## 🔧 Maintenance

### Nettoyage des logs

```typescript
// Nettoyer périodiquement les anciens logs
setInterval(
  () => {
    client.clearLogs();
    console.log("Logs nettoyés");
  },
  24 * 60 * 60 * 1000,
); // Tous les jours
```

### Réinitialisation des métriques

```typescript
// Réinitialiser les métriques après un redémarrage
client.resetMetrics();
```

### Export des données

```typescript
// Exporter les métriques et logs
function exportMonitoringData(client: McpClient) {
  return {
    timestamp: new Date().toISOString(),
    status: client.getConnectionStatus(),
    metrics: client.getMetrics(),
    recentLogs: client.getLogs(undefined, 100),
  };
}

// Sauvegarder dans un fichier
const data = exportMonitoringData(client);
fs.writeFileSync("mcp-monitoring.json", JSON.stringify(data, null, 2));
```

## 🐛 Dépannage

### Problèmes courants

#### 1. Connexion échouée

```typescript
try {
  await client.connect();
} catch (error) {
  const status = client.getConnectionStatus();
  const logs = client.getLogs("error");

  console.error("Échec de connexion:");
  console.error("URL:", status.serverUrl);
  console.error("Dernière erreur:", status.lastError);
  console.error("Logs d'erreur:", logs);

  // Vérifier si le serveur est accessible
  // Vérifier les paramètres réseau
  // Vérifier les certificats SSL
}
```

#### 2. Timeout fréquents

```typescript
const metrics = client.getMetrics();
if (metrics.failedRequests > 0) {
  const timeoutRate = metrics.failedRequests / metrics.totalRequests;
  if (timeoutRate > 0.1) {
    // > 10% de timeouts
    console.warn("Taux de timeout élevé détecté!");

    // Solutions possibles :
    // 1. Augmenter le timeout
    // 2. Optimiser les requêtes
    // 3. Vérifier la charge du serveur
    // 4. Implémenter le retry
  }
}
```

#### 3. Performance dégradée

```typescript
const status = client.getConnectionStatus();
if (status.metrics.averageResponseTime > 2000) {
  // > 2 secondes
  console.warn("Performance dégradée détectée!");

  // Analyser les logs récents
  const recentLogs = client.getLogs(undefined, 50);
  const slowRequests = recentLogs.filter(
    (log) => log.data?.responseTime && log.data.responseTime > 5000,
  );

  if (slowRequests.length > 0) {
    console.warn("Requêtes lentes détectées:", slowRequests);
  }
}
```

## 📈 Intégration avec des outils externes

### Prometheus/Grafana

```typescript
// Exposer les métriques au format Prometheus
function exposePrometheusMetrics(client: McpClient) {
  const metrics = client.getMetrics();

  return `
# HELP mcp_connections_total Total connection attempts
# TYPE mcp_connections_total counter
mcp_connections_total ${metrics.totalConnections}

# HELP mcp_requests_total Total MCP requests
# TYPE mcp_requests_total counter
mcp_requests_total ${metrics.totalRequests}

# HELP mcp_response_time_average Average response time in milliseconds
# TYPE mcp_response_time_average gauge
mcp_response_time_average ${metrics.averageResponseTime}

# HELP mcp_uptime_seconds Client uptime in seconds
# TYPE mcp_uptime_seconds gauge
mcp_uptime_seconds ${metrics.uptime}
  `;
}
```

### Sentry/DataDog

```typescript
// Envoyer les erreurs à Sentry
const errorLogs = client.getLogs("error");
errorLogs.forEach((log) => {
  Sentry.captureException(new Error(log.message), {
    extra: log.data,
    tags: {
      toolName: log.toolName,
      requestId: log.requestId?.toString(),
    },
  });
});
```

---

**Dernière mise à jour** : 31/01/2026
**Version** : 2.0
**Compatibilité** : McpClient v2.0+
