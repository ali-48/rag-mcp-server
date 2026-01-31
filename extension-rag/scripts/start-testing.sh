#!/bin/bash

# Script de démarrage rapide pour les tests MCP Client
# Auteur: Cline
# Date: $(date +%Y-%m-%d)

set -e

# Couleurs pour l'affichage
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Fonctions d'affichage
print_header() {
    echo -e "${BLUE}"
    echo "========================================"
    echo "   $1"
    echo "========================================"
    echo -e "${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Vérifier que nous sommes dans le bon répertoire
if [ ! -f "package.json" ]; then
    print_error "Ce script doit être exécuté depuis le répertoire extension-rag/"
    exit 1
fi

# Menu principal
show_menu() {
    clear
    print_header "🚀 MENU DE TESTS MCP CLIENT"
    echo ""
    echo "1. 🔍 Test rapide de tous les scripts"
    echo "2. 🔌 Test connexion MCP"
    echo "3. 📊 Test compatibilité SDK"
    echo "4. 🏭 Test production"
    echo "5. 🔧 Test extensions MCP"
    echo "6. 📈 Tous les tests complets"
    echo "7. 📖 Afficher le guide"
    echo "8. 🛠️  Installer dépendances manquantes"
    echo "9. 🚪 Quitter"
    echo ""
    read -p "Choisissez une option (1-9): " choice
}

# Option 1: Test rapide de tous les scripts
test_all_scripts() {
    print_header "🔍 TEST RAPIDE DE TOUS LES SCRIPTS"
    node scripts/test-all-scripts.js
    read -p "Appuyez sur Entrée pour continuer..."
}

# Option 2: Test connexion MCP
test_mcp_connection() {
    print_header "🔌 TEST CONNEXION MCP"
    print_info "Vérification du serveur MCP sur ws://localhost:3000"
    echo ""
    node scripts/test-mcp-connection.js
    read -p "Appuyez sur Entrée pour continuer..."
}

# Option 3: Test compatibilité SDK
test_compatibility() {
    print_header "📊 TEST COMPATIBILITÉ SDK"
    print_info "Vérification compatibilité SDK MCP et Node.js"
    echo ""
    node scripts/compatibility-test.js
    read -p "Appuyez sur Entrée pour continuer..."
}

# Option 4: Test production
test_production() {
    print_header "🏭 TEST PRODUCTION"
    print_info "Tests de performance et stabilité en production"
    echo ""
    node scripts/production-test.js
    read -p "Appuyez sur Entrée pour continuer..."
}

# Option 5: Test extensions MCP
test_extensions() {
    print_header "🔧 TEST EXTENSIONS MCP"
    print_info "Tests de compatibilité avec les extensions MCP"
    echo ""
    node scripts/test-mcp-extensions.js
    read -p "Appuyez sur Entrée pour continuer..."
}

# Option 6: Tous les tests complets
test_all_complete() {
    print_header "📈 TOUS LES TESTS COMPLETS"
    print_info "Exécution de la suite complète de tests"
    echo ""
    node scripts/run-all-tests.js
    read -p "Appuyez sur Entrée pour continuer..."
}

# Option 7: Afficher le guide
show_guide() {
    print_header "📖 GUIDE DES TESTS"
    echo ""
    echo "Scripts disponibles:"
    echo "-------------------"
    echo "🔍 compatibility-test.js          - Tests compatibilité SDK MCP"
    echo "🔌 test-mcp-connection.js         - Tests connexion MCP"
    echo "🏭 production-test.js             - Tests production"
    echo "🔧 test-mcp-extensions.js         - Tests extensions MCP"
    echo "📊 run-compatibility-tests.js     - Tests compatibilité complets"
    echo "📈 run-all-tests.js               - Tous les tests"
    echo "🚀 test-all-scripts.js            - Test rapide des scripts"
    echo ""
    echo "Pour plus d'informations:"
    echo "cat scripts/README-TESTS.md"
    echo ""
    read -p "Appuyez sur Entrée pour continuer..."
}

# Option 8: Installer dépendances manquantes
install_dependencies() {
    print_header "🛠️  INSTALLATION DES DÉPENDANCES"

    # Vérifier si npm est disponible
    if ! command -v npm &> /dev/null; then
        print_error "npm n'est pas installé"
        exit 1
    fi

    print_info "Installation des dépendances principales..."
    npm install

    print_info "Installation des dépendances de développement..."
    npm install --save-dev @modelcontextprotocol/sdk ws

    print_success "Dépendances installées avec succès!"

    # Vérifier l'installation
    print_info "Vérification de l'installation..."
    if node -e "require('@modelcontextprotocol/sdk')" 2>/dev/null; then
        print_success "SDK MCP installé avec succès"
    else
        print_warning "SDK MCP non installé, essayez: npm install @modelcontextprotocol/sdk"
    fi

    if node -e "require('ws')" 2>/dev/null; then
        print_success "WebSocket installé avec succès"
    else
        print_warning "WebSocket non installé, essayez: npm install ws"
    fi

    read -p "Appuyez sur Entrée pour continuer..."
}

# Option 9: Quitter
quit() {
    print_header "👋 AU REVOIR !"
    echo "Merci d'avoir utilisé les tests MCP Client"
    exit 0
}

# Boucle principale
while true; do
    show_menu

    case $choice in
        1)
            test_all_scripts
            ;;
        2)
            test_mcp_connection
            ;;
        3)
            test_compatibility
            ;;
        4)
            test_production
            ;;
        5)
            test_extensions
            ;;
        6)
            test_all_complete
            ;;
        7)
            show_guide
            ;;
        8)
            install_dependencies
            ;;
        9)
            quit
            ;;
        *)
            print_error "Option invalide"
            read -p "Appuyez sur Entrée pour continuer..."
            ;;
    esac
done
