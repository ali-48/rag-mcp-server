import { getRagConfigManager } from "../config/rag-config.js";
export class LlmService {
    configManager = getRagConfigManager();
    preparationConfig;
    llmProviderConfig;
    constructor() {
        this.preparationConfig = this.configManager.getPreparationConfig();
        this.llmProviderConfig = this.configManager.getLlmProviderConfig(this.preparationConfig.llm_provider);
        if (!this.llmProviderConfig) {
            console.warn(`⚠️ Aucune configuration trouvée pour le fournisseur LLM: ${this.preparationConfig.llm_provider}`);
        }
    }
    async analyzeContent(content, filePath, contentType, task) {
        if (!this.preparationConfig.enable_llm_analysis) {
            console.warn('⚠️ Analyse LLM désactivée dans la configuration');
            throw new Error('LLM analysis is disabled in configuration');
        }
        if (!this.llmProviderConfig) {
            console.warn('⚠️ Aucun fournisseur LLM configuré');
            throw new Error('No LLM provider configured');
        }
        // Vérifier la longueur du contenu
        if (content.length > this.preparationConfig.max_content_length) {
            console.warn(`⚠️ Contenu trop long (${content.length} > ${this.preparationConfig.max_content_length}), troncation`);
            content = content.substring(0, this.preparationConfig.max_content_length) + '... [TRONQUÉ]';
        }
        const prompt = this.buildPrompt(content, filePath, contentType, task);
        console.log(`🧠 Analyse LLM: ${task} pour ${filePath} (${contentType})`);
        return await this.callOllama({
            model: this.preparationConfig.llm_model,
            prompt: prompt,
            temperature: 0.1,
            max_tokens: 1000,
            stream: false
        });
    }
    buildPrompt(content, filePath, contentType, task) {
        const tasks = {
            summarize: `Résume ce ${contentType} (${filePath}) en 2-3 phrases :\n\n${content}`,
            extract_keywords: `Extrais 5-10 mots-clés de ce ${contentType} (${filePath}) :\n\n${content}`,
            suggest_structure: `Suggère une structure de segmentation pour ce ${contentType} (${filePath}) :\n\n${content}`,
            detect_entities: `Détecte les entités principales (fonctions, classes, variables) :\n\n${content}`,
            classify_complexity: `Évalue la complexité (1-5) et suggère une taille de chunk :\n\n${content}`
        };
        return tasks[task] || tasks.summarize;
    }
    async callOllama(request) {
        if (!this.llmProviderConfig) {
            throw new Error('No LLM provider configured');
        }
        const endpoint = this.llmProviderConfig.endpoint || 'http://localhost:11434';
        const timeout = this.llmProviderConfig.timeout_ms || 30000;
        // S'assurer que stream est false pour éviter les réponses streaming
        const requestWithStream = { ...request, stream: false };
        console.log(`🔗 Appel Ollama: ${endpoint}/api/generate, modèle: ${requestWithStream.model}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
            const startTime = Date.now();
            const response = await fetch(`${endpoint}/api/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestWithStream),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API error (${response.status}): ${errorText}`);
            }
            // Vérifier le content-type
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.warn(`⚠️ Réponse non-JSON reçue: ${text.substring(0, 200)}...`);
                throw new Error(`Réponse non-JSON reçue: ${contentType}`);
            }
            const data = await response.json();
            const duration = Date.now() - startTime;
            console.log(`✅ Réponse Ollama reçue en ${duration}ms, modèle: ${data.model}`);
            return data.response;
        }
        catch (error) {
            clearTimeout(timeoutId);
            console.error(`❌ Échec de l'analyse LLM: ${error}`);
            throw error;
        }
    }
    // Méthode batch pour traitement efficace
    async analyzeBatch(contents, task) {
        const batchSize = this.preparationConfig.batch_size || 5;
        const results = [];
        for (let i = 0; i < contents.length; i += batchSize) {
            const batch = contents.slice(i, i + batchSize);
            const batchPromises = batch.map(item => this.analyzeContent(item.content, item.filePath, item.contentType, task)
                .catch(error => `ERROR: ${error.message}`));
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
    async checkOllamaAvailability() {
        if (!this.llmProviderConfig) {
            return false;
        }
        const endpoint = this.llmProviderConfig.endpoint || 'http://localhost:11434';
        const timeout = 5000; // 5 secondes pour la vérification
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(`${endpoint}/api/tags`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response.ok;
        }
        catch (error) {
            console.log(`❌ Ollama non disponible: ${error}`);
            return false;
        }
    }
    // Récupérer les modèles disponibles
    async getAvailableModels() {
        if (!this.llmProviderConfig) {
            return [];
        }
        const endpoint = this.llmProviderConfig.endpoint || 'http://localhost:11434';
        const timeout = 10000; // 10 secondes
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);
            const response = await fetch(`${endpoint}/api/tags`, {
                method: 'GET',
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`API error (${response.status})`);
            }
            const data = await response.json();
            const models = data.models || [];
            return models.map((model) => model.name);
        }
        catch (error) {
            console.error(`❌ Erreur récupération modèles: ${error}`);
            return [];
        }
    }
    // Générer une réponse simple (pour tests)
    async generateResponse(prompt, context = 'test') {
        if (!this.preparationConfig.enable_llm_analysis) {
            throw new Error('LLM analysis is disabled in configuration');
        }
        if (!this.llmProviderConfig) {
            throw new Error('No LLM provider configured');
        }
        console.log(`🧠 Génération LLM: ${context}, prompt: "${prompt.substring(0, 50)}..."`);
        return await this.callOllama({
            model: this.preparationConfig.llm_model,
            prompt: prompt,
            temperature: 0.7,
            max_tokens: 500,
            stream: false
        });
    }
}
//# sourceMappingURL=llm-service.js.map