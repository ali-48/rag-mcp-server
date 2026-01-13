#!/bin/bash
# scripts/injection-rag.sh
# Script wrapper pour l'outil injection_rag
# Version: v1.0.1 - Corrections des bugs

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD_DIR="$PROJECT_ROOT/build"
LOG_DIR="$PROJECT_ROOT/logs"
CONFIG_FILE="$PROJECT_ROOT/config/rag-config.json"

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions d'affichage
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Vérifications initiales
check_prerequisites() {
    log_info "🔍 Vérification des prérequis..."
    
    # Vérifier Node.js
    if ! command -v node &> /dev/null; then
        log_error "Node.js n'est pas installé"
        return 1
    fi
    log_info "✅ Node.js: $(node --version)"
    
    # Vérifier le répertoire build
    if [ ! -d "$BUILD_DIR" ]; then
        log_error "Le répertoire build n'existe pas. Exécutez 'npm run build' d'abord."
        return 1
    fi
    log_info "✅ Répertoire build: $BUILD_DIR"
    
    # Vérifier le fichier de configuration
    if [ ! -f "$CONFIG_FILE" ]; then
        log_warning "Fichier de configuration non trouvé: $CONFIG_FILE"
        log_warning "Utilisation des valeurs par défaut"
    else
        log_info "✅ Fichier de configuration: $CONFIG_FILE"
    fi
    
    # Créer le répertoire de logs
    mkdir -p "$LOG_DIR"
    log_info "✅ Répertoire de logs: $LOG_DIR"
    
    return 0
}

# Afficher l'aide
show_help() {
    echo "Usage: $0 [OPTIONS] <project_path>"
    echo ""
    echo "Script wrapper pour l'outil injection_rag v1.0.0"
    echo ""
    echo "Options:"
    echo "  -h, --help                  Afficher cette aide"
    echo "  -v, --verbose               Mode verbeux"
    echo "  -d, --dry-run               Simulation sans modifications"
    echo "  -l, --log-level LEVEL       Niveau de logs (INFO, DEBUG, ERROR)"
    echo "  -c, --chunk-size SIZE       Taille des chunks (défaut: 1000)"
    echo "  -o, --chunk-overlap SIZE    Chevauchement des chunks (défaut: 200)"
    echo "  -p, --patterns PATTERNS     Patterns de fichiers (séparés par des virgules)"
    echo "  --no-graph                  Désactiver l'intégration Graph"
    echo ""
    echo "Exemples:"
    echo "  $0 /chemin/vers/projet"
    echo "  $0 -v -l DEBUG /chemin/vers/projet"
    echo "  $0 -c 500 -o 100 /chemin/vers/projet"
    echo "  $0 -p \"**/*.js,**/*.ts\" /chemin/vers/projet"
    echo ""
    echo "Documentation: voir docs/INCREMENTAL_REINDEX.md"
}

# Parser les arguments
parse_arguments() {
    local project_path=""
    local verbose=false
    local dry_run=false
    local log_level="INFO"
    local chunk_size=""
    local chunk_overlap=""
    local file_patterns=""
    local enable_graph=true
    local show_help_flag=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help_flag=true
                shift
                ;;
            -v|--verbose)
                verbose=true
                shift
                ;;
            -d|--dry-run)
                dry_run=true
                shift
                ;;
            -l|--log-level)
                if [[ -z "$2" ]]; then
                    log_error "L'option -l/--log-level nécessite une valeur"
                    return 1
                fi
                log_level="$2"
                shift 2
                ;;
            -c|--chunk-size)
                if [[ -z "$2" ]]; then
                    log_error "L'option -c/--chunk-size nécessite une valeur"
                    return 1
                fi
                chunk_size="$2"
                shift 2
                ;;
            -o|--chunk-overlap)
                if [[ -z "$2" ]]; then
                    log_error "L'option -o/--chunk-overlap nécessite une valeur"
                    return 1
                fi
                chunk_overlap="$2"
                shift 2
                ;;
            -p|--patterns)
                if [[ -z "$2" ]]; then
                    log_error "L'option -p/--patterns nécessite une valeur"
                    return 1
                fi
                file_patterns="$2"
                shift 2
                ;;
            --no-graph)
                enable_graph=false
                shift
                ;;
            -*)
                log_error "Option inconnue: $1"
                return 1
                ;;
            *)
                if [ -z "$project_path" ]; then
                    project_path="$1"
                else
                    log_error "Trop d'arguments. Un seul chemin de projet attendu."
                    return 1
                fi
                shift
                ;;
        esac
    done
    
    # Retourner le flag d'aide en premier
    if [ "$show_help_flag" = true ]; then
        echo "HELP"
        return 0
    fi
    
    # Vérifier le chemin du projet
    if [ -z "$project_path" ]; then
        log_error "Chemin du projet requis"
        return 1
    fi
    
    # Vérifier que le chemin existe
    if [ ! -d "$project_path" ]; then
        log_error "Le chemin du projet n'existe pas: $project_path"
        return 1
    fi
    
    # Retourner les valeurs
    echo "$project_path"
    echo "$verbose"
    echo "$dry_run"
    echo "$log_level"
    echo "$chunk_size"
    echo "$chunk_overlap"
    echo "$file_patterns"
    echo "$enable_graph"
    
    return 0
}

# Construire la commande Node.js
build_node_command() {
    local project_path="$1"
    local verbose="$2"
    local dry_run="$3"
    local log_level="$4"
    local chunk_size="$5"
    local chunk_overlap="$6"
    local file_patterns="$7"
    local enable_graph="$8"
    
    local tool_args="\"project_path\": \"$project_path\""
    
    if [ "$verbose" = true ]; then
        tool_args="$tool_args, \"log_level\": \"DEBUG\""
    elif [ "$log_level" != "INFO" ]; then
        tool_args="$tool_args, \"log_level\": \"$log_level\""
    fi
    
    if [ -n "$chunk_size" ]; then
        tool_args="$tool_args, \"chunk_size\": $chunk_size"
    fi
    
    if [ -n "$chunk_overlap" ]; then
        tool_args="$tool_args, \"chunk_overlap\": $chunk_overlap"
    fi
    
    if [ -n "$file_patterns" ]; then
        # Convertir les patterns séparés par des virgules en tableau JSON
        IFS=',' read -ra patterns_array <<< "$file_patterns"
        local patterns_json="["
        for pattern in "${patterns_array[@]}"; do
            patterns_json="$patterns_json\"$pattern\","
        done
        patterns_json="${patterns_json%,}]"
        tool_args="$tool_args, \"file_patterns\": $patterns_json"
    fi
    
    if [ "$enable_graph" = false ]; then
        tool_args="$tool_args, \"enable_graph_integration\": false"
    fi
    
    # Mode dry-run
    if [ "$dry_run" = true ]; then
        log_warning "⚠️  MODE DRY-RUN ACTIVÉ - Aucune modification ne sera effectuée"
        # Pour dry-run, on pourrait ajouter un flag spécifique si l'outil le supporte
    fi
    
    # Construire la requête JSON-RPC
    local jsonrpc_request="{
  \"jsonrpc\": \"2.0\",
  \"id\": 1,
  \"method\": \"tools/call\",
  \"params\": {
    \"name\": \"injection_rag\",
    \"arguments\": {$tool_args}
  }
}"
    
    echo "$jsonrpc_request"
}

# Exécuter l'injection
run_injection() {
    local project_path="$1"
    local verbose="$2"
    local dry_run="$3"
    local log_level="$4"
    local chunk_size="$5"
    local chunk_overlap="$6"
    local file_patterns="$7"
    local enable_graph="$8"
    
    local timestamp=$(date +"%Y%m%d_%H%M%S")
    local log_file="$LOG_DIR/injection_rag_${timestamp}.log"
    
    log_info "🚀 Démarrage de l'injection RAG v1.0.0"
    log_info "📁 Projet: $project_path"
    log_info "📝 Logs: $log_file"
    
    if [ "$verbose" = true ]; then
        log_info "⚙️  Configuration:"
        log_info "  • Log level: $log_level"
        log_info "  • Chunk size: ${chunk_size:-auto}"
        log_info "  • Chunk overlap: ${chunk_overlap:-auto}"
        log_info "  • File patterns: ${file_patterns:-auto}"
        log_info "  • Graph integration: $enable_graph"
        log_info "  • Dry run: $dry_run"
    fi
    
    # Construire la commande
    local tool_input=$(build_node_command "$project_path" "$verbose" "$dry_run" "$log_level" \
        "$chunk_size" "$chunk_overlap" "$file_patterns" "$enable_graph")
    
    log_info "🔧 Exécution de l'outil injection_rag..."
    
    # Exécuter la commande et capturer les logs
    {
        echo "=== INJECTION RAG v1.0.0 - $timestamp ==="
        echo "Commande: $tool_input"
        echo ""
        
        cd "$PROJECT_ROOT"
        echo "$tool_input" | node "$BUILD_DIR/index.js" 2>&1
        
        local exit_code=$?
        echo ""
        echo "=== FIN D'EXÉCUTION ==="
        echo "Code de sortie: $exit_code"
        echo "Timestamp: $(date)"
        
        return $exit_code
    } | tee "$log_file"
    
    local exit_code=${PIPESTATUS[0]}
    
    if [ $exit_code -eq 0 ]; then
        log_success "✅ Injection RAG terminée avec succès"
        log_info "📄 Logs détaillés: $log_file"
    else
        log_error "❌ Injection RAG échouée (code: $exit_code)"
        log_error "🔍 Consultez les logs: $log_file"
    fi
    
    return $exit_code
}

# Fonction principale
main() {
    # Parser les arguments d'abord (pour --help)
    local args_result
    args_result=$(parse_arguments "$@")
    local parse_exit_code=$?
    
    if [ $parse_exit_code -ne 0 ]; then
        # Erreur de parsing
        exit $parse_exit_code
    fi
    
    # Extraire les arguments
    # Utiliser mapfile pour lire les lignes dans un tableau
    mapfile -t args_array <<< "$args_result"
    
    # Vérifier si c'est une demande d'aide
    if [ "${args_array[0]}" = "HELP" ]; then
        show_help
        exit 0
    fi
    
    local project_path="${args_array[0]}"
    local verbose="${args_array[1]}"
    local dry_run="${args_array[2]}"
    local log_level="${args_array[3]}"
    local chunk_size="${args_array[4]}"
    local chunk_overlap="${args_array[5]}"
    local file_patterns="${args_array[6]}"
    local enable_graph="${args_array[7]}"
    
    # Afficher l'en-tête seulement si on exécute réellement
    log_info "========================================"
    log_info "      INJECTION RAG WRAPPER v1.0.1     "
    log_info "========================================"
    
    # Vérifier les prérequis (après parsing)
    if ! check_prerequisites; then
        exit 1
    fi
    
    # Exécuter l'injection
    run_injection "$project_path" "$verbose" "$dry_run" "$log_level" \
        "$chunk_size" "$chunk_overlap" "$file_patterns" "$enable_graph"
    
    local exit_code=$?
    
    log_info "========================================"
    log_info "           EXÉCUTION TERMINÉE           "
    log_info "========================================"
    
    exit $exit_code
}

# Exécuter le script
main "$@"
