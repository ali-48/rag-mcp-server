import { indexProject, updateProject } from "../rag/indexer.js";
import { getProjects, getProjectStatistics, searchCode } from "../rag/searcher.js";
import { setEmbeddingProvider } from "../rag/vector-store.js";
// Définition des 4 outils RAG préfixés
export const ragTools = [
    {
        name: "rag_index_project",
        description: "Indexer un projet complet pour la recherche sémantique avec options RAG",
        inputSchema: {
            type: "object",
            properties: {
                project_path: {
                    type: "string",
                    description: "Chemin absolu vers le projet à indexer"
                },
                file_patterns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Patterns de fichiers à inclure (ex: ['**/*.py', '**/*.js'])",
                    default: ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"]
                },
                recursive: {
                    type: "boolean",
                    description: "Parcourir les sous-dossiers récursivement",
                    default: true
                },
                embedding_provider: {
                    type: "string",
                    description: "Fournisseur d'embeddings (fake, ollama, sentence-transformers)",
                    enum: ["fake", "ollama", "sentence-transformers"],
                    default: "fake"
                },
                embedding_model: {
                    type: "string",
                    description: "Modèle d'embeddings (pour Ollama: 'nomic-embed-text', 'all-minilm', etc.)",
                    default: "nomic-embed-text"
                },
                chunk_size: {
                    type: "number",
                    description: "Taille des chunks pour le découpage (en tokens)",
                    default: 1000,
                    minimum: 100,
                    maximum: 10000
                },
                chunk_overlap: {
                    type: "number",
                    description: "Chevauchement entre les chunks (en tokens)",
                    default: 200,
                    minimum: 0,
                    maximum: 1000
                }
            },
            required: ["project_path"]
        }
    },
    {
        name: "rag_search_code",
        description: "Recherche sémantique dans le code indexé avec options RAG",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "Requête de recherche sémantique"
                },
                project_filter: {
                    type: "string",
                    description: "Filtrer par chemin de projet spécifique"
                },
                limit: {
                    type: "number",
                    description: "Nombre maximum de résultats",
                    default: 10,
                    minimum: 1,
                    maximum: 50
                },
                threshold: {
                    type: "number",
                    description: "Seuil de similarité (0.0 à 1.0)",
                    default: 0,
                    minimum: 0,
                    maximum: 1
                },
                format_output: {
                    type: "boolean",
                    description: "Formater la sortie pour l'affichage",
                    default: true
                },
                embedding_provider: {
                    type: "string",
                    description: "Fournisseur d'embeddings pour la recherche (fake, ollama, sentence-transformers)",
                    enum: ["fake", "ollama", "sentence-transformers"],
                    default: "fake"
                },
                embedding_model: {
                    type: "string",
                    description: "Modèle d'embeddings (pour Ollama: 'nomic-embed-text', 'all-minilm', etc.)",
                    default: "nomic-embed-text"
                }
            },
            required: ["query"]
        }
    },
    {
        name: "rag_manage_projects",
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
        }
    },
    {
        name: "rag_update_project",
        description: "Mettre à jour l'indexation d'un projet (indexation incrémentale) avec options RAG",
        inputSchema: {
            type: "object",
            properties: {
                project_path: {
                    type: "string",
                    description: "Chemin absolu vers le projet à mettre à jour"
                },
                file_patterns: {
                    type: "array",
                    items: { type: "string" },
                    description: "Patterns de fichiers à inclure",
                    default: ["**/*.{js,ts,py,md,txt,json,yaml,yml,html,css,scss}"]
                },
                recursive: {
                    type: "boolean",
                    description: "Parcourir les sous-dossiers récursivement",
                    default: true
                },
                embedding_provider: {
                    type: "string",
                    description: "Fournisseur d'embeddings (fake, ollama, sentence-transformers)",
                    enum: ["fake", "ollama", "sentence-transformers"],
                    default: "fake"
                },
                embedding_model: {
                    type: "string",
                    description: "Modèle d'embeddings (pour Ollama: 'nomic-embed-text', 'all-minilm', etc.)",
                    default: "nomic-embed-text"
                },
                chunk_size: {
                    type: "number",
                    description: "Taille des chunks pour le découpage (en tokens)",
                    default: 1000,
                    minimum: 100,
                    maximum: 10000
                },
                chunk_overlap: {
                    type: "number",
                    description: "Chevauchement entre les chunks (en tokens)",
                    default: 200,
                    minimum: 0,
                    maximum: 1000
                }
            },
            required: ["project_path"]
        }
    }
];
// Fonction pour exécuter les outils RAG
export async function executeRagTool(name, args) {
    // Configurer le fournisseur d'embeddings si spécifié
    if (args.embedding_provider) {
        setEmbeddingProvider(args.embedding_provider, args.embedding_model || "nomic-embed-text");
    }
    switch (name) {
        case "rag_index_project":
            const indexOptions = {
                filePatterns: args.file_patterns,
                recursive: args.recursive,
                chunkSize: args.chunk_size,
                chunkOverlap: args.chunk_overlap
            };
            const indexResult = await indexProject(args.project_path, indexOptions);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(indexResult, null, 2)
                    }]
            };
        case "rag_search_code":
            const searchOptions = {
                projectFilter: args.project_filter,
                limit: args.limit,
                threshold: args.threshold
            };
            const searchResult = await searchCode(args.query, searchOptions);
            if (args.format_output !== false) {
                const formatted = `Recherche RAG: "${args.query}"\n` +
                    `Résultats: ${searchResult.totalResults}\n` +
                    `Temps d'exécution: ${searchResult.stats?.executionTime || 0}ms\n` +
                    `Projets scannés: ${searchResult.stats?.projectsScanned || 0}\n\n` +
                    searchResult.results.map((r, i) => `${i + 1}. ${r.filePath} (score: ${(r.score * 100).toFixed(2)}%)\n` +
                        `   Projet: ${r.metadata.projectPath}\n` +
                        `   Contenu: ${r.content.substring(0, 100)}...`).join('\n\n');
                return { content: [{ type: "text", text: formatted }] };
            }
            return { content: [{ type: "text", text: JSON.stringify(searchResult, null, 2) }] };
        case "rag_manage_projects":
            if (args.action === "stats" && args.project_path) {
                const stats = await getProjectStatistics(args.project_path);
                return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
            }
            else {
                const projects = await getProjects();
                return { content: [{ type: "text", text: JSON.stringify(projects, null, 2) }] };
            }
        case "rag_update_project":
            const updateOptions = {
                filePatterns: args.file_patterns,
                recursive: args.recursive,
                chunkSize: args.chunk_size,
                chunkOverlap: args.chunk_overlap
            };
            const updateResult = await updateProject(args.project_path, updateOptions);
            return {
                content: [{
                        type: "text",
                        text: JSON.stringify(updateResult, null, 2)
                    }]
            };
        default:
            throw new Error(`Unknown RAG tool: ${name}`);
    }
}
