// Phase 0.3 - Prompts JSON Stricts pour LLM Enrichment
// Version: 1.0.0
// Description: Prompts système avec format JSON strict pour analyse sémantique des chunks

/**
 * Interface pour les prompts d'enrichissement
 */
export interface EnrichmentPrompt {
    /** ID unique du prompt */
    id: string;

    /** Nom du prompt */
    name: string;

    /** Description du prompt */
    description: string;

    /** Version du prompt */
    version: string;

    /** Prompt système complet */
    systemPrompt: string;

    /** Prompt utilisateur template */
    userPromptTemplate: string;

    /** Format de sortie attendu */
    outputFormat: {
        /** Type de format (JSON, YAML, etc.) */
        type: 'json' | 'yaml' | 'text';

        /** Schema JSON attendu */
        jsonSchema?: Record<string, any>;

        /** Exemple de sortie */
        example?: any;
    };

    /** Paramètres LLM recommandés */
    llmParameters: {
        temperature: number;
        maxTokens: number;
        topP?: number;
        topK?: number;
        frequencyPenalty?: number;
        presencePenalty?: number;
    };

    /** Tags pour catégorisation */
    tags: string[];

    /** Actif/inactif */
    enabled: boolean;
}

/**
 * Prompt pour l'analyse sémantique de code
 */
export const CODE_SEMANTIC_ANALYSIS_PROMPT: EnrichmentPrompt = {
    id: 'prompt-code-semantic-001',
    name: 'Code Semantic Analysis',
    description: 'Analyse sémantique de code source : résumé, entités, complexité, catégorie',
    version: '1.0.0',
    systemPrompt: `Tu es un expert en analyse de code source. Ton rôle est d'analyser un morceau de code et de produire une analyse sémantique structurée en JSON.

Règles strictes :
1. Analyse le code fourni de manière objective
2. Identifie les concepts clés, entités et relations
3. Évalue la complexité technique
4. Catégorise le type de code
5. Produis un résumé concis
6. Extrais des mots-clés pertinents
7. Respecte scrupuleusement le format JSON de sortie

Format de sortie JSON attendu :
{
  "summary": "string (résumé concis en 1-2 phrases)",
  "keywords": ["string", "string", ...] (5-10 mots-clés max),
  "entities": ["string", "string", ...] (entités identifiées : fonctions, classes, variables, etc.),
  "complexity": "low" | "medium" | "high",
  "category": "string (ex: 'function', 'class', 'utility', 'test', 'configuration', 'data-processing', etc.)",
  "language": "string (langage détecté)",
  "confidence": number (0-1, confiance de l'analyse)
}`,
    userPromptTemplate: `Analyse le code suivant :

\`\`\`
{{code}}
\`\`\`

Informations supplémentaires :
- Langage détecté : {{language}}
- Type de fichier : {{fileType}}
- Chemin du fichier : {{filePath}}

Produis l'analyse sémantique au format JSON strict.`,
    outputFormat: {
        type: 'json',
        jsonSchema: {
            type: 'object',
            properties: {
                summary: { type: 'string', minLength: 10, maxLength: 500 },
                keywords: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 10 },
                entities: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 20 },
                complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
                category: { type: 'string' },
                language: { type: 'string' },
                confidence: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['summary', 'keywords', 'entities', 'complexity', 'category', 'language', 'confidence']
        },
        example: {
            summary: "Fonction utilitaire pour formater des dates avec validation d'entrée et gestion des fuseaux horaires",
            keywords: ["date", "formatting", "validation", "timezone", "utility"],
            entities: ["formatDate", "validateDate", "DateFormatter"],
            complexity: "medium",
            category: "utility-function",
            language: "typescript",
            confidence: 0.85
        }
    },
    llmParameters: {
        temperature: 0.1,
        maxTokens: 1000,
        topP: 0.9,
        frequencyPenalty: 0.1,
        presencePenalty: 0.1
    },
    tags: ['code-analysis', 'semantic', 'technical', 'structured'],
    enabled: true
};

/**
 * Prompt pour l'analyse de documentation
 */
export const DOCUMENTATION_ANALYSIS_PROMPT: EnrichmentPrompt = {
    id: 'prompt-doc-analysis-001',
    name: 'Documentation Analysis',
    description: 'Analyse de documentation technique : résumé, concepts, structure',
    version: '1.0.0',
    systemPrompt: `Tu es un expert en analyse de documentation technique. Ton rôle est d'analyser un texte de documentation et de produire une analyse structurée en JSON.

Règles strictes :
1. Analyse le contenu documentaire de manière objective
2. Identifie les concepts techniques expliqués
3. Extrais la structure logique
4. Catégorise le type de documentation
5. Produis un résumé concis
6. Extrais des mots-clés pertinents
7. Respecte scrupuleusement le format JSON de sortie

Format de sortie JSON attendu :
{
  "summary": "string (résumé concis en 1-2 phrases)",
  "keywords": ["string", "string", ...] (5-10 mots-clés max),
  "concepts": ["string", "string", ...] (concepts techniques identifiés),
  "structure": "string (type de structure : 'tutorial', 'reference', 'guide', 'api-doc', 'readme', etc.)",
  "targetAudience": "beginner" | "intermediate" | "advanced" | "expert",
  "confidence": number (0-1, confiance de l'analyse)
}`,
    userPromptTemplate: `Analyse la documentation suivante :

{{documentation}}

Informations supplémentaires :
- Source : {{source}}
- Langue : {{language}}

Produis l'analyse sémantique au format JSON strict.`,
    outputFormat: {
        type: 'json',
        jsonSchema: {
            type: 'object',
            properties: {
                summary: { type: 'string', minLength: 10, maxLength: 500 },
                keywords: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 10 },
                concepts: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 15 },
                structure: { type: 'string' },
                targetAudience: { type: 'string', enum: ['beginner', 'intermediate', 'advanced', 'expert'] },
                confidence: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['summary', 'keywords', 'concepts', 'structure', 'targetAudience', 'confidence']
        },
        example: {
            summary: "Guide d'installation et configuration d'une API REST avec authentification JWT et documentation Swagger",
            keywords: ["api", "rest", "jwt", "authentication", "swagger", "configuration"],
            concepts: ["REST principles", "JWT tokens", "OAuth2", "OpenAPI", "middleware"],
            structure: "tutorial",
            targetAudience: "intermediate",
            confidence: 0.9
        }
    },
    llmParameters: {
        temperature: 0.1,
        maxTokens: 800,
        topP: 0.9
    },
    tags: ['documentation', 'technical-writing', 'analysis', 'structured'],
    enabled: true
};

/**
 * Prompt pour l'analyse de configuration
 */
export const CONFIGURATION_ANALYSIS_PROMPT: EnrichmentPrompt = {
    id: 'prompt-config-analysis-001',
    name: 'Configuration Analysis',
    description: 'Analyse de fichiers de configuration : paramètres, sections, valeurs par défaut',
    version: '1.0.0',
    systemPrompt: `Tu es un expert en analyse de fichiers de configuration. Ton rôle est d'analyser un fichier de configuration et de produire une analyse structurée en JSON.

Règles strictes :
1. Analyse la configuration de manière objective
2. Identifie les sections principales
3. Extrais les paramètres clés et leurs valeurs
4. Détecte les valeurs par défaut et les overrides
5. Catégorise le type de configuration
6. Produis un résumé concis
7. Respecte scrupuleusement le format JSON de sortie

Format de sortie JSON attendu :
{
  "summary": "string (résumé concis en 1-2 phrases)",
  "sections": ["string", "string", ...] (sections principales identifiées),
  "keyParameters": ["string", "string", ...] (paramètres clés identifiés),
  "configType": "string (ex: 'environment', 'application', 'build', 'deployment', 'database', etc.)",
  "complexity": "low" | "medium" | "high",
  "confidence": number (0-1, confiance de l'analyse)
}`,
    userPromptTemplate: `Analyse le fichier de configuration suivant :

\`\`\`
{{configuration}}
\`\`\`

Informations supplémentaires :
- Format : {{format}} (json, yaml, toml, etc.)
- Environnement : {{environment}}

Produis l'analyse sémantique au format JSON strict.`,
    outputFormat: {
        type: 'json',
        jsonSchema: {
            type: 'object',
            properties: {
                summary: { type: 'string', minLength: 10, maxLength: 500 },
                sections: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 10 },
                keyParameters: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 15 },
                configType: { type: 'string' },
                complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
                confidence: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['summary', 'sections', 'keyParameters', 'configType', 'complexity', 'confidence']
        },
        example: {
            summary: "Configuration d'application Node.js avec paramètres de base de données, logging et sécurité",
            sections: ["database", "logging", "security", "server"],
            keyParameters: ["DB_HOST", "DB_PORT", "LOG_LEVEL", "JWT_SECRET", "PORT"],
            configType: "application",
            complexity: "low",
            confidence: 0.95
        }
    },
    llmParameters: {
        temperature: 0.1,
        maxTokens: 600,
        topP: 0.9
    },
    tags: ['configuration', 'settings', 'analysis', 'structured'],
    enabled: true
};

/**
 * Prompt pour l'enrichissement général
 */
export const GENERAL_ENRICHMENT_PROMPT: EnrichmentPrompt = {
    id: 'prompt-general-enrichment-001',
    name: 'General Content Enrichment',
    description: 'Enrichissement général de contenu : résumé, mots-clés, catégorisation',
    version: '1.0.0',
    systemPrompt: `Tu es un expert en analyse de contenu. Ton rôle est d'analyser un contenu texte et de produire un enrichissement sémantique structuré en JSON.

Règles strictes :
1. Analyse le contenu de manière objective
2. Produis un résumé concis et informatif
3. Extrais des mots-clés pertinents
4. Identifie des entités importantes
5. Évalue la complexité du contenu
6. Catégorise le type de contenu
7. Respecte scrupuleusement le format JSON de sortie

Format de sortie JSON attendu :
{
  "summary": "string (résumé concis en 1-2 phrases)",
  "keywords": ["string", "string", ...] (5-10 mots-clés max),
  "entities": ["string", "string", ...] (entités identifiées),
  "complexity": "low" | "medium" | "high",
  "category": "string (catégorie de contenu)",
  "sentiment": "positive" | "neutral" | "negative" (ton général),
  "confidence": number (0-1, confiance de l'analyse)
}`,
    userPromptTemplate: `Analyse le contenu suivant :

{{content}}

Informations supplémentaires :
- Type de contenu : {{contentType}}
- Langue : {{language}}

Produis l'enrichissement sémantique au format JSON strict.`,
    outputFormat: {
        type: 'json',
        jsonSchema: {
            type: 'object',
            properties: {
                summary: { type: 'string', minLength: 10, maxLength: 500 },
                keywords: { type: 'array', items: { type: 'string' }, minItems: 3, maxItems: 10 },
                entities: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 15 },
                complexity: { type: 'string', enum: ['low', 'medium', 'high'] },
                category: { type: 'string' },
                sentiment: { type: 'string', enum: ['positive', 'neutral', 'negative'] },
                confidence: { type: 'number', minimum: 0, maximum: 1 }
            },
            required: ['summary', 'keywords', 'entities', 'complexity', 'category', 'sentiment', 'confidence']
        },
        example: {
            summary: "Explication des principes de base de l'authentification JWT avec exemples d'implémentation",
            keywords: ["jwt", "authentication", "tokens", "security", "api"],
            entities: ["JSON Web Token", "Bearer token", "payload", "signature"],
            complexity: "medium",
            category: "technical-explanation",
            sentiment: "neutral",
            confidence: 0.88
        }
    },
    llmParameters: {
        temperature: 0.1,
        maxTokens: 800,
        topP: 0.9
    },
    tags: ['general', 'content', 'enrichment', 'structured'],
    enabled: true
};

/**
 * Collection de tous les prompts
 */
export const ALL_PROMPTS: Record<string, EnrichmentPrompt> = {
    'code-semantic': CODE_SEMANTIC_ANALYSIS_PROMPT,
    'documentation': DOCUMENTATION_ANALYSIS_PROMPT,
    'configuration': CONFIGURATION_ANALYSIS_PROMPT,
    'general': GENERAL_ENRICHMENT_PROMPT
};

/**
 * Récupère un prompt par son ID
 */
export function getPromptById(id: string): EnrichmentPrompt | null {
    for (const prompt of Object.values(ALL_PROMPTS)) {
        if (prompt.id === id) {
            return prompt;
        }
    }
    return null;
}

/**
 * Récupère un prompt par son nom
 */
export function getPromptByName(name: string): EnrichmentPrompt | null {
    for (const prompt of Object.values(ALL_PROMPTS)) {
        if (prompt.name === name) {
            return prompt;
        }
    }
    return null;
}

/**
 * Récupère les prompts par tags
 */
export function getPromptsByTags(tags: string[]): EnrichmentPrompt[] {
    return Object.values(ALL_PROMPTS).filter(prompt =>
        tags.some(tag => prompt.tags.includes(tag))
    );
}

/**
 * Récupère les prompts activés
 */
export function getEnabledPrompts(): EnrichmentPrompt[] {
    return Object.values(ALL_PROMPTS).filter(prompt => prompt.enabled);
}

/**
 * Génère un prompt utilisateur à partir d'un template
 */
export function generateUserPrompt(
    prompt: EnrichmentPrompt,
    variables: Record<string, string>
): string {
    let userPrompt = prompt.userPromptTemplate;

    for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        userPrompt = userPrompt.replace(new RegExp(placeholder, 'g'), value);
    }

    return userPrompt;
}

/**
 * Valide une sortie LLM par rapport au format attendu
 */
export function validatePromptOutput(
    output: string,
    prompt: EnrichmentPrompt
): { valid: boolean; parsed?: any; error?: string } {
    try {
        if (prompt.outputFormat.type === 'json') {
            const parsed = JSON.parse(output);

            // Validation basique de structure
            if (prompt.outputFormat.jsonSchema) {
                // Note: Pour une validation complète, utiliser une librairie comme ajv
                const requiredFields = prompt.outputFormat.jsonSchema.required || [];
                for (const field of requiredFields) {
                    if (parsed[field] === undefined) {
                        return {
                            valid: false,
                            parsed,
                            error: `Champ requis manquant: ${field}`
                        };
                    }
                }
            }

            return {
                valid: true,
                parsed
            };
        } else if (prompt.outputFormat.type === 'text') {
            // Pour le texte, on vérifie juste que ce n'est pas vide
            if (output.trim().length === 0) {
                return {
                    valid: false,
                    error: 'La sortie texte est vide'
                };
            }
            return {
                valid: true,
                parsed: output
            };
        } else {
            // Format non supporté
            return {
                valid: false,
                error: `Format de sortie non supporté: ${prompt.outputFormat.type}`
            };
        }
    } catch (error) {
        return {
            valid: false,
            error: `Erreur de parsing: ${error instanceof Error ? error.message : String(error)}`
        };
    }
}

/**
 * Export par défaut
 */
export default {
    CODE_SEMANTIC_ANALYSIS_PROMPT,
    DOCUMENTATION_ANALYSIS_PROMPT,
    CONFIGURATION_ANALYSIS_PROMPT,
    GENERAL_ENRICHMENT_PROMPT,
    ALL_PROMPTS,
    getPromptById,
    getPromptByName,
    getPromptsByTags,
    getEnabledPrompts,
    generateUserPrompt,
    validatePromptOutput
};
