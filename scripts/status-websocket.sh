#!/bin/bash

# ============================================
# Script de statut du serveur WebSocket MCP
# ============================================
# Ce script vérifie l'état du serveur WebSocket RAG MCP.

set -e  # Arrêter le script en cas d'erreur

# Configuration
PORT=3000
PID_FILE="websocket-server.pid"
LOG_FILE="logs/websocket-server.log"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Fonctions de logging
log_info() {
    echo -e "${BLUE}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Vérifier si le serveur est en cours d'exécution via le PID file
check_pid_file() {
    if [ -f "$PROJECT_ROOT/$PID_FILE" ]; then
        PID=$(cat "$PROJECT_ROOT/$PID_FILE" 2>/dev/null)
        if [ -n "$PID" ] && kill -0 $PID 2>/dev/null; then
            log_info "Serveur trouvé via PID file: $PID"
            echo $PID
            return 0
        else
            log_warning "PID file existe mais le processus $PID n'est pas en cours d'exécution"
            rm -f "$PROJECT_ROOT/$PID_FILE"
            return 1
        fi
    else
        log_info "Aucun PID file trouvé"
        return 1
    fi
}

# Vérifier si le serveur est en cours d'exécution via le port
check_port() {
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        PORT_PID=$(lsof -ti:$PORT)
        log_info "Serveur trouvé via port $PORT: PID $PORT_PID"
        echo $PORT_PID
        return 0
    else
        log_info "Aucun serveur n'écoute sur le port $PORT"
        return 1
    fi
}

# Obtenir des informations sur le processus
get_process_info() {
    local pid=$1

    if [ -z "$pid" ] || ! kill -0 $pid 2>/dev/null; then
        echo "Processus non trouvé"
        return 1
    fi

    # Informations de base
    echo "PID: $pid"

    # Command line
    if command -v ps &> /dev/null; then
        CMD=$(ps -p $pid -o cmd= 2>/dev/null || echo "Commande inconnue")
        echo "Commande: $CMD"
    fi

    # Mémoire et CPU
    if command -v ps &> /dev/null; then
        MEM_CPU=$(ps -p $pid -o %mem,%cpu= 2>/dev/null || echo "N/A")
        echo "Mémoire/CPU: $MEM_CPU"
    fi

    # Temps d'exécution
    if command -v ps &> /dev/null; then
        TIME=$(ps -p $pid -o etime= 2>/dev/null || echo "N/A")
        echo "Temps d'exécution: $TIME"
    fi

    return 0
}

# Vérifier la connexion WebSocket
check_websocket_connection() {
    log_info "Test de connexion WebSocket sur ws://localhost:$PORT..."

    # Créer un script Node.js simple pour tester la connexion
    TEST_SCRIPT=$(mktemp)
    cat > $TEST_SCRIPT << 'EOF'
const WebSocket = require('ws');

const url = 'ws://localhost:3000';
const ws = new WebSocket(url);

const timeout = setTimeout(() => {
    console.log('TIMEOUT');
    ws.close();
    process.exit(1);
}, 3000);

ws.on('open', () => {
    console.log('CONNECTED');
    clearTimeout(timeout);
    ws.close();
    process.exit(0);
});

ws.on('error', (error) => {
    console.log('ERROR:', error.message);
    clearTimeout(timeout);
    process.exit(1);
});

ws.on('close', () => {
    // Do nothing
});
EOF

    # Exécuter le test
    cd "$PROJECT_ROOT"
    if node $TEST_SCRIPT 2>/dev/null | grep -q "CONNECTED"; then
        echo "✅ Connexion WebSocket fonctionnelle"
        rm -f $TEST_SCRIPT
        return 0
    else
        echo "❌ Connexion WebSocket échouée"
        rm -f $TEST_SCRIPT
        return 1
    fi
}

# Afficher les logs récents
show_recent_logs() {
    if [ -f "$PROJECT_ROOT/$LOG_FILE" ]; then
        echo ""
        echo -e "${CYAN}=== LOGS RÉCENTS (dernières 10 lignes) ===${NC}"
        echo "-----------------------------------------"
        tail -10 "$PROJECT_ROOT/$LOG_FILE" 2>/dev/null || echo "(fichier de logs vide ou inaccessible)"
        echo "-----------------------------------------"
    else
        echo ""
        echo -e "${YELLOW}Aucun fichier de logs trouvé${NC}"
    fi
}

# Fonction principale
main() {
    echo ""
    log_info "Vérification du statut du serveur WebSocket MCP"
    log_info "Répertoire projet: $PROJECT_ROOT"
    echo ""

    # Vérifier via PID file
    PID_FILE_PID=$(check_pid_file)
    PID_FILE_STATUS=$?

    # Vérifier via port
    PORT_PID=$(check_port)
    PORT_STATUS=$?

    # Déterminer le PID actuel
    if [ $PID_FILE_STATUS -eq 0 ]; then
        ACTIVE_PID=$PID_FILE_PID
        SOURCE="PID file"
    elif [ $PORT_STATUS -eq 0 ]; then
        ACTIVE_PID=$PORT_PID
        SOURCE="port detection"
    else
        ACTIVE_PID=""
        SOURCE="none"
    fi

    # Afficher le statut
    echo "========================================="
    echo "   STATUT SERVEUR WEBSOCKET MCP"
    echo "========================================="

    if [ -n "$ACTIVE_PID" ]; then
        echo -e "${GREEN}✅ SERVEUR EN COURS D'EXÉCUTION${NC}"
        echo "-----------------------------------------"
        echo "Source:           $SOURCE"
        get_process_info $ACTIVE_PID
        echo "-----------------------------------------"

        # Vérifier la connexion WebSocket
        if check_websocket_connection; then
            echo -e "${GREEN}✅ Connexion WebSocket OK${NC}"
        else
            echo -e "${YELLOW}⚠️  Connexion WebSocket problématique${NC}"
        fi

        show_recent_logs

    else
        echo -e "${RED}❌ SERVEUR ARRÊTÉ${NC}"
        echo "-----------------------------------------"
        echo "Port:             $PORT"
        echo "Statut:           Arrêté"
        echo "-----------------------------------------"

        # Vérifier si des processus orphelins existent
        if pgrep -f "index-websocket.js" >/dev/null; then
            echo -e "${YELLOW}⚠️  Processus orphelins détectés${NC}"
            echo "Processus index-websocket.js trouvés:"
            pgrep -f "index-websocket.js"
        fi
    fi

    echo ""
    echo "========================================="
    echo "Commandes disponibles:"
    echo "  Démarrage:   ./scripts/start-websocket.sh"
    echo "  Arrêt:       ./scripts/stop-websocket.sh"
    echo "  Statut:      ./scripts/status-websocket.sh"
    echo "========================================="
}

# Exécuter la fonction principale
main "$@"
