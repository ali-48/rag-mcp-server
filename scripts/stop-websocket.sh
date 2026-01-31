#!/bin/bash

# ============================================
# Script d'arrêt du serveur WebSocket MCP
# ============================================
# Ce script arrête le serveur WebSocket RAG MCP proprement.

set -e  # Arrêter le script en cas d'erreur

# Configuration
PORT=3000
PID_FILE="websocket-server.pid"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Couleurs pour les logs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Arrêter le serveur proprement
stop_server() {
    local pid=$1
    local method=$2

    log_info "Arrêt du serveur (PID: $pid) - Méthode: $method"

    # Essayer d'abord un arrêt propre (SIGTERM)
    kill -15 $pid 2>/dev/null || true
    sleep 1

    # Vérifier si le processus est toujours en cours d'exécution
    if kill -0 $pid 2>/dev/null; then
        log_warning "Le serveur n'a pas répondu à SIGTERM, utilisation de SIGKILL..."
        kill -9 $pid 2>/dev/null || true
        sleep 1
    fi

    # Vérifier que le processus est arrêté
    if kill -0 $pid 2>/dev/null 2>&1; then
        log_error "Impossible d'arrêter le processus $pid"
        return 1
    else
        log_success "Serveur arrêté avec succès (PID: $pid)"

        # Nettoyer le PID file si c'était notre processus
        if [ -f "$PROJECT_ROOT/$PID_FILE" ]; then
            FILE_PID=$(cat "$PROJECT_ROOT/$PID_FILE" 2>/dev/null)
            if [ "$FILE_PID" = "$pid" ]; then
                rm -f "$PROJECT_ROOT/$PID_FILE"
                log_info "PID file supprimé"
            fi
        fi

        return 0
    fi
}

# Fonction principale
main() {
    echo ""
    log_info "Démarrage du script d'arrêt WebSocket MCP"
    log_info "Répertoire projet: $PROJECT_ROOT"

    # Essayer d'abord avec le PID file
    if check_pid_file; then
        PID=$(cat "$PROJECT_ROOT/$PID_FILE")
        stop_server $PID "PID file"
    else
        # Essayer avec le port
        PORT_PID=$(check_port)
        if [ -n "$PORT_PID" ]; then
            # Demander confirmation si ce n'est pas notre processus
            if [ ! -f "$PROJECT_ROOT/$PID_FILE" ]; then
                log_warning "Ce processus n'a pas été démarré par notre script"
                read -p "Voulez-vous arrêter le processus $PORT_PID? (y/N): " -n 1 -r
                echo
                if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                    log_info "Arrêt annulé"
                    exit 0
                fi
            fi
            stop_server $PORT_PID "port detection"
        else
            log_success "✅ Aucun serveur WebSocket MCP n'est en cours d'exécution"
        fi
    fi

    # Vérifier que le port est libéré
    sleep 1
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        log_warning "Le port $PORT est toujours occupé"
    else
        log_success "✅ Port $PORT libéré"
    fi

    echo ""
    echo "========================================="
    echo "   SERVEUR WEBSOCKET MCP ARRÊTÉ"
    echo "========================================="
    echo "Port:              $PORT"
    echo "Statut:            Arrêté"
    echo "========================================="
}

# Exécuter la fonction principale
main "$@"
