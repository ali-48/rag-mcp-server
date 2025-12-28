import { getProjectStats, listProjects, semanticSearch } from "./vector-store.js";
export async function searchCode(query, options = {}) {
    const startTime = Date.now();
    try {
        const results = await semanticSearch(query, options);
        const endTime = Date.now();
        // Compter les projets uniques dans les résultats
        const uniqueProjects = new Set(results.map(r => r.metadata.projectPath));
        return {
            query,
            results,
            totalResults: results.length,
            stats: {
                executionTime: endTime - startTime,
                projectsScanned: uniqueProjects.size,
            },
        };
    }
    catch (error) {
        console.error("Error in searchCode:", error);
        throw error;
    }
}
export async function getProjects() {
    try {
        const projects = await listProjects();
        return {
            projects,
            totalProjects: projects.length,
        };
    }
    catch (error) {
        console.error("Error getting projects:", error);
        throw error;
    }
}
export async function getProjectStatistics(projectPath) {
    try {
        const stats = await getProjectStats(projectPath);
        return {
            projectPath,
            totalFiles: stats.totalFiles,
            totalChunks: stats.totalChunks,
            indexedAt: stats.indexedAt || new Date(),
            lastUpdated: stats.lastUpdated || new Date(),
        };
    }
    catch (error) {
        console.error(`Error getting statistics for project ${projectPath}:`, error);
        throw error;
    }
}
// Fonction utilitaire pour formater les résultats de recherche
export function formatSearchResults(results) {
    if (results.length === 0) {
        return "Aucun résultat trouvé.";
    }
    let output = `Résultats de recherche (${results.length} trouvés):\n\n`;
    results.forEach((result, index) => {
        output += `## ${index + 1}. ${result.filePath}\n`;
        output += `Score: ${(result.score * 100).toFixed(2)}%\n`;
        output += `Projet: ${result.metadata.projectPath}\n`;
        output += `Taille: ${result.metadata.fileSize} caractères, ${result.metadata.lines} lignes\n\n`;
        // Afficher un extrait du contenu
        const preview = result.content.length > 200
            ? result.content.substring(0, 200) + "..."
            : result.content;
        output += "```\n" + preview + "\n```\n\n";
        output += "---\n\n";
    });
    return output;
}
