import { getRagConfigManager } from "../config/rag-config.js";

export interface LlmRequest {
    model: string;
    prompt: string;
    system?: string;
    temperature?: number;
    max_tokens?: number;
    stream?: boolean;
}

export interface LlmResponse {
    response: string;
    model: string;
    created_at: string;
    done: boolean;
    total_duration?: number;
    load_duration?: number;
}

export interface LlmProviderConfig {
    description: string;
    models: string[];
    endpoint?: string;
    requires_ollama?: boolean;
    default_model?: string;
    max_tokens?: number;
    temperature?: number;
    timeout_ms?: number | null;
}

export interface PreparationConfig {
    enable_llm_analysis: boolean;
    llm_provider: string;
    llm_model: string;
    tasks: string[];
    cache_enabled: boolean;
    cache_ttl_seconds: number;
    batch_size: number;
    max_content_length: number;
}

export class LlmService {
    private configManager = getRagConfigManager();
    private preparationConfig: PreparationConfig;
    private llmProviderConfig: LlmProviderConfig | undefined;

    constructor() {
        this.preparationConfig = this.configManager.getPreparationConfig();
        this.llmProviderConfig = this.configManager.getLlmProviderConfig(
            this.preparationConfig.llm_provider
        );

        if (!this.llmProviderConfig) {
            // Pas de logs sur stderr pour compatibilité MCP
        }
    }

    async analyzeContent(
        content: string,
        filePath: string,
        contentType: string,
        task: string
    ): Promise<string> {
        if (!this.preparationConfig.enable_llm_analysis) {
            // Pas de logs sur stderr pour compatibilité MCP
            throw new Error('LLM analysis is disabled in configuration');
        }

        if (!this.llmProviderConfig) {
            // Pas de logs sur stderr pour compatibilité MCP
            throw new Error('No LLM provider configured');
        }

        // Vérifier la longueur du contenu
        if (content.length > this.preparationConfig.max_content_length) {
            // Pas de logs sur stderr pour compatibilité MCP
            content = content.substring(0, this.preparationConfig.max_content_length) + '... [TRONQUÉ]';
        }

        const prompt = this.buildPrompt(content, filePath, contentType, task);

        // Pas de logs sur stderr pour compatibilité MCP

        return await this.callOllama({
            model: this.preparationConfig.llm_model,
            prompt: prompt,
            temperature: 0.1,
            max_tokens: 1000,
            stream: false
        });
    }

    private buildPrompt(
        content: string,
        filePath: string,
        contentType: string,
        task: string
    ): string {
        const tasks = {
            summarize: `Résume ce ${contentType} (${filePath}) en 2-3 phrases :\n\n${content}`,
            extract_keywords: `Extrais 5-10 mots-clés de ce ${contentType} (${filePath}) :\n\n${content}`,
            suggest_structure: `Suggère une structure de segmentation pour ce ${contentType} (${filePath}) :\n\n${content}`,
            detect_entities: `Détecte les entités principales (fonctions, classes, variables) :\n\n${content}`,
            classify_complexity: `Évalue la complexité (1-5) et suggère une taille de chunk :\n\n${content}`
        };

        return tasks[task as keyof typeof tasks] || tasks.summarize;
    }

    private async callOllama(request: LlmRequest): Promise<string> {
        if (!this.llmProviderConfig) {
            throw new Error('No LLM provider configured');
        }

        const endpoint = this.llmProviderConfig.endpoint || 'http://localhost:11434';

        // S'assurer que stream est false pour éviter les réponses streaming
        const requestWithStream = { ...request, stream: false };

        // Pas de logs sur stderr pour compatibilité MCP

        try {
            const startTime = Date.now();
            const response = await fetch(`${endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestWithStream)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API error (${response.status}): ${errorText}`);
            }

            // Vérifier le content-type
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                // Pas de logs sur stderr pour compatibilité MCP
                throw new Error(`Réponse non-JSON reçue: ${contentType}`);
            }

            const data: LlmResponse = await response.json();
            const duration = Date.now() - startTime;

            // Pas de logs sur stderr pour compatibilité MCP

            return data.response;

        } catch (error) {
            // Pas de logs sur stderr pour compatibilité MCP
            throw error;
        }
    }

    // Méthode batch pour traitement efficace
    async analyzeBatch(
        contents: Array<{ content: string, filePath: string, contentType: string }>,
        task: string
    ): Promise<string[]> {
        const batchSize = this.preparationConfig.batch_size || 5;
        const results: string[] = [];

        for (let i = 0; i < contents.length; i += batchSize) {
            const batch = contents.slice(i, i + batchSize);
            const batchPromises = batch.map(item =>
                this.analyzeContent(item.content, item.filePath, item.contentType, task)
                    .catch(error => `ERROR: ${error.message}`)
            );

            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);

            // Petit délai entre les batches pour éviter la surcharge
            if (i + batchSize < contents.length) {
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        }

        return results;
    }

    // Vérifier si Ollama est disponible
    async checkOllamaAvailability(): Promise<boolean> {
        if (!this.llmProviderConfig) {
            return false;
        }

        const endpoint = this.llmProviderConfig.endpoint || 'http://localhost:11434';

        try {
            const response = await fetch(`${endpoint}/api/tags`, {
                method: 'GET'
            });
            return response.ok;
        } catch (error) {
            // Pas de logs sur stderr pour compatibilité MCP
            return false;
        }
    }

    // Récupérer les modèles disponibles
    async getAvailableModels(): Promise<string[]> {
        if (!this.llmProviderConfig) {
            return [];
        }

        const endpoint = this.llmProviderConfig.endpoint || 'http://localhost:11434';

        try {
            const response = await fetch(`${endpoint}/api/tags`, {
                method: 'GET'
            });

            if (!response.ok) {
                throw new Error(`API error (${response.status})`);
            }

            const data = await response.json();
            const models = data.models || [];

            return models.map((model: any) => model.name);
        } catch (error) {
            // Pas de logs sur stderr pour compatibilité MCP
            return [];
        }
    }

    // Générer une réponse simple (pour tests)
    async generateResponse(prompt: string, context: string = 'test'): Promise<string> {
        if (!this.preparationConfig.enable_llm_analysis) {
            throw new Error('LLM analysis is disabled in configuration');
        }

        if (!this.llmProviderConfig) {
            throw new Error('No LLM provider configured');
        }

        // Pas de logs sur stderr pour compatibilité MCP

        return await this.callOllama({
            model: this.preparationConfig.llm_model,
            prompt: prompt,
            temperature: 0.7,
            max_tokens: 500,
            stream: false
        });
    }
}
