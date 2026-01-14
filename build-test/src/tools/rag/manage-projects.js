// src/tools/rag/manage-projects.ts
// Outil: manage_projects - Gérer et lister les projets indexés
import { getProjects, getProjectStatistics } from "../../rag/searcher.js";
/**
 * Définition de l'outil manage_projects
 */
export const manageProjectsTool = {
    name: "manage_projects",
    description: "Gérer et lister les projets indexés",
    inputSchema: {
        type: "object",
        properties: {
            action: {
                type: "string",
                description: "Action à effectuer",
                enum: ["list", "stats"],
                default: "list"
            },
            project_path: {
                type: "string",
                description: "Chemin du projet pour les statistiques (requis pour 'stats')"
            }
        }
    },
};
/**
 * Handler pour l'outil manage_projects
 */
export const manageProjectsHandler = async (args) => {
    const action = args.action || "list";
    try {
        if (action === "stats") {
            if (!args.project_path || typeof args.project_path !== 'string') {
                throw new Error("The 'project_path' parameter is required for 'stats' action");
            }
            const stats = await getProjectStatistics(args.project_path);
            return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
        }
        else {
            const projects = await getProjects();
            return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
        }
    }
    catch (error) {
        // Pas de logs sur stderr pour compatibilité MCP
        throw error;
    }
};
/**
 * Test de l'outil (pour usage en développement)
 */
export async function testManageProjects() {
    // Pas de logs sur stderr pour compatibilité MCP
    try {
        // D'abord indexer un projet de test
        const testProjectPath = "/tmp/test-project-manage";
        const fs = await import('fs');
        const path = await import('path');
        if (!fs.existsSync(testProjectPath)) {
            fs.mkdirSync(testProjectPath, { recursive: true });
        }
        // Créer un fichier de test
        const testFile = path.join(testProjectPath, "manage-test.js");
        fs.writeFileSync(testFile, "// Test file for manage_projects\nconsole.log('Manage test');");
        // Initialiser le projet avec init_rag
        const { initRagHandler } = await import("./init-rag.js");
        await initRagHandler({
            project_path: testProjectPath,
            mode: "default",
            force: false,
            verbose: false
        });
        // Indexer le projet avec activated_rag
        const { activatedRagHandler } = await import("./activated-rag.js");
        await activatedRagHandler({
            project_path: testProjectPath,
            mode: "full",
            file_patterns: ["**/*.js"],
            enable_phase0: true
        });
        // Pas de logs sur stderr pour compatibilité MCP
        // Tester l'action 'list'
        // Pas de logs sur stderr pour compatibilité MCP
        const listResult = await manageProjectsHandler({ action: "list" });
        // Pas de logs sur stderr pour compatibilité MCP
        // Tester l'action 'stats'
        // Pas de logs sur stderr pour compatibilité MCP
        const statsResult = await manageProjectsHandler({
            action: "stats",
            project_path: testProjectPath
        });
        // Pas de logs sur stderr pour compatibilité MCP
        // Nettoyer
        fs.rmSync(testProjectPath, { recursive: true, force: true });
        return { listResult, statsResult };
    }
    catch (error) {
        // Pas de logs sur stderr pour compatibilité MCP
        throw error;
    }
}
//# sourceMappingURL=manage-projects.js.map