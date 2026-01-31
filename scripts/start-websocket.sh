#!/bin/bash

# ============================================
# Script de démarrage du serveur WebSocket MCP
# ============================================
# Ce script démarre le serveur WebSocket RAG MCP sur le port 3000
# avec vérification de port et logs de démarrage.

set -e  # Arrêter le script en cas d'erreur

# Configuration
PORT=3000
SERVER_SCRIPT="build/index-websocket.js"
LOG_FILE="logs/websocket-server.log"
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

# Vérifier si Node.js est installé
check_node() {
    if ! command -v node &> /dev/null; then
        log_error "Node.js n'est pas installé ou n'est pas dans le PATH"
        exit 1
    fi

    NODE_VERSION=$(node --version)
    log_info "Node.js version: $NODE_VERSION"
}

# Vérifier si le serveur est déjà en cours d'exécution
check_port() {
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        PID=$(lsof -ti:$PORT)
        log_warning "Le port $PORT est déjà utilisé par le processus PID: $PID"

        # Demander à l'utilisateur s'il veut arrêter le processus existant
        read -p "Voulez-vous arrêter le processus existant? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            kill -9 $PID 2>/dev/null || true
            sleep 1
            log_info "Processus $PID arrêté"
        else
            log_info "Utilisation du processus existant sur le port $PORT"
            exit 0
        fi
    else
        log_info "Le port $PORT est disponible"
    fi
}

# Vérifier si le script serveur existe
check_server_script() {
    if [ ! -f "$PROJECT_ROOT/$SERVER_SCRIPT" ]; then
        log_error "Script serveur introuvable: $SERVER_SCRIPT"
        log_info "Veuillez d'abord compiler le projet: npm run build"
        exit 1
    fi
    log_info "Script serveur trouvé: $SERVER_SCRIPT"
}

# Créer le répertoire de logs si nécessaire
setup_logs() {
    mkdir -p "$PROJECT_ROOT/logs"
    log_info "Répertoire de logs: $PROJECT_ROOT/logs"
}

# Démarrer le serveur
start_server() {
    log_info "Démarrage du serveur WebSocket MCP sur le port $PORT..."

    # Démarrer le serveur en arrière-plan
    cd "$PROJECT_ROOT"
    nohup node "$SERVER_SCRIPT" > "$LOG_FILE" 2>&1 &

    SERVER_PID=$!
    echo $SERVER_PID > "$PID_FILE"

    log_info "Serveur démarré avec PID: $SERVER_PID"
    log_info "Logs: $LOG_FILE"
    log_info "PID sauvegardé dans: $PID_FILE"

    # Attendre que le serveur soit prêt
    log_info "Attente du démarrage du serveur..."
    sleep 2

    # Vérifier si le serveur est en cours d'exécution
    if kill -0 $SERVER_PID 2>/dev/null; then
        if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
            log_success "✅ Serveur WebSocket MCP démarré avec succès"
            log_success "📡 URL: ws://localhost:$PORT"
            log_success "📊 PID: $SERVER_PID"
        else
            log_warning "Serveur démarré mais le port $PORT n'est pas encore accessible"
        fi
    else
        log_error "Le serveur a échoué à démarrer"
        log_info "Vérifiez les logs: tail -f $LOG_FILE"
        exit 1
    fi
}

# Afficher les informations de connexion
show_connection_info() {
    echo ""
    echo "========================================="
    echo "   SERVEUR WEBSOCKET MCP DÉMARRÉ"
    echo "========================================="
    echo "URL de connexion:  ws://localhost:$PORT"
    echo "PID du serveur:    $SERVER_PID"
    echo "Fichier de logs:   $LOG_FILE"
    echo "Fichier PID:       $PID_FILE"
    echo ""
    echo "Commandes utiles:"
    echo "  Voir les logs:    tail -f $LOG_FILE"
    echo "  Arrêter:          ./scripts/stop-websocket.sh"
    echo "  Statut:           ./scripts/status-websocket.sh"
    echo "========================================="
}

# Fonction principale
main() {
    echo ""
    log_info "Démarrage du script de démarrage WebSocket MCP"
    log_info "Répertoire projet: $PROJECT_ROOT"

    check_node
    check_port
    check_server_script
    setup_logs
    start_server
    show_connection_info

    # Afficher les premières lignes des logs
    echo ""
    log_info "Premières lignes des logs:"
    echo "-----------------------------------------"
    tail -5 "$LOG_FILE" 2>/dev/null || echo "(logs pas encore disponibles)"
    echo "-----------------------------------------"
}

# Exécuter la fonction principale
main "$@"
