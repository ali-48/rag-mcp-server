#!/bin/bash
# RAG MCP Server - VS Code Extensions Installation Script
# Generated: 2026-01-16
# This script installs all recommended extensions for RAG MCP Server development

set -e

echo "========================================="
echo "RAG MCP Server - VS Code Extensions Installer"
echo "========================================="

# Check if VS Code is installed
if ! command -v code &> /dev/null; then
    echo "❌ VS Code 'code' command not found."
    echo "Please install VS Code and ensure 'code' is in your PATH."
    exit 1
fi

echo "✅ VS Code detected: $(code --version | head -1)"

# Create extensions directory if it doesn't exist
EXTENSIONS_DIR="$HOME/.vscode/extensions"
mkdir -p "$EXTENSIONS_DIR"

# Function to install extension with version check
install_extension() {
    local extension_id="$1"
    local expected_version="$2"
    local extension_name="$3"

    echo ""
    echo "📦 Installing: $extension_name"
    echo "   ID: $extension_id"
    echo "   Version: $expected_version"

    # Check if already installed
    if code --list-extensions --show-versions | grep -q "^${extension_id}@"; then
        local installed_version=$(code --list-extensions --show-versions | grep "^${extension_id}@" | cut -d'@' -f2)
        if [ "$installed_version" = "$expected_version" ]; then
            echo "   ✅ Already installed (version $installed_version)"
            return 0
        else
            echo "   ⚠️  Different version installed: $installed_version (expected: $expected_version)"
            echo "   🔄 Reinstalling..."
            code --uninstall-extension "$extension_id" 2>/dev/null || true
        fi
    fi

    # Install extension
    if code --install-extension "${extension_id}@${expected_version}"; then
        echo "   ✅ Successfully installed"
    else
        echo "   ⚠️  Failed to install specific version, trying latest..."
        if code --install-extension "$extension_id"; then
            echo "   ✅ Installed latest version"
        else
            echo "   ❌ Failed to install"
            return 1
        fi
    fi
}

# Essential extensions (Level 1)
echo ""
echo "========================================="
echo "ESSENTIAL EXTENSIONS (Level 1)"
echo "========================================="

install_extension "dbaeumer.vscode-eslint" "3.0.21" "ESLint"
install_extension "esbenp.prettier-vscode" "12.1.0" "Prettier"
install_extension "eamodio.gitlens" "2026.1.1504" "GitLens"
install_extension "block.vscode-mcp-extension" "0.2.0" "MCP Extension"
install_extension "mtxr.sqltools" "0.28.5" "SQLTools"
install_extension "editorconfig.editorconfig" "0.17.4" "EditorConfig"
install_extension "redhat.vscode-yaml" "1.19.1" "YAML"

# Recommended extensions (Level 2)
echo ""
echo "========================================="
echo "RECOMMENDED EXTENSIONS (Level 2)"
echo "========================================="

install_extension "christian-kohler.npm-intellisense" "1.4.5" "npm Intellisense"
install_extension "connor4312.esbuild-problem-matchers" "0.0.3" "esbuild problem matchers"
install_extension "ckolkman.vscode-postgres" "1.4.3" "PostgreSQL"
install_extension "redis.redis-for-vscode" "1.4.0" "Redis"
install_extension "alefragnani.project-manager" "13.0.1" "Project Manager"
install_extension "streetsidesoftware.code-spell-checker" "4.4.0" "Code Spell Checker"
install_extension "usernamehw.errorlens" "3.26.0" "Error Lens"
install_extension "yoavbls.pretty-ts-errors" "0.7.0" "Pretty TypeScript Errors"
install_extension "visualstudioexptteam.vscodeintellicode" "1.3.2" "IntelliCode"
install_extension "gruntfuggly.todo-tree" "0.0.226" "Todo Tree"
install_extension "aaron-bond.better-comments" "3.0.2" "Better Comments"
install_extension "tamasfe.even-better-toml" "0.21.2" "Even Better TOML"

# Optional extensions (Level 3)
echo ""
echo "========================================="
echo "OPTIONAL EXTENSIONS (Level 3)"
echo "========================================="
echo "These extensions are optional and can be installed manually if needed:"
echo "  - ms-azuretools.vscode-docker (Docker support)"
echo "  - github.vscode-pull-request-github (GitHub PRs)"
echo "  - mhutchie.git-graph (Git visualization)"
echo "  - cweijan.vscode-mysql-client2 (MySQL client)"

# Create verification report
echo ""
echo "========================================="
echo "VERIFICATION REPORT"
echo "========================================="

INSTALLED_COUNT=$(code --list-extensions | wc -l)
echo "Total extensions installed: $INSTALLED_COUNT"

echo ""
echo "Essential extensions status:"
code --list-extensions --show-versions | grep -E "(dbaeumer|esbenp|eamodio|block|mtxr|editorconfig|redhat)" || true

echo ""
echo "✅ Installation completed!"
echo ""
echo "Next steps:"
echo "1. Open the workspace: code rag-mcp-server.code-workspace"
echo "2. Configure database connections in SQLTools"
echo "3. Run 'npm install' to install project dependencies"
echo "4. Check the README_VSCODE_CONFIG.md for additional setup"

# Make script executable
chmod +x "$0"
