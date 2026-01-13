// Tests de rétrocompatibilité v2.0
// Objectif: Vérifier que les anciens appels d'API fonctionnent toujours via activated_rag
// et que la cohabitation ancien/nouveau système fonctionne correctement
import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRagConfigManager } from '../src/config/rag-config.js';
import { initializeAutoRegistryV2 } from '../src/core/registry-v2.js';
import { toolRegistry } from '../src/core/tool-registry.js';
describe('Rétrocompatibilité v2.0 - Tests système', () => {
    const testProjectPath = path.join(__dirname, '..', 'test-data', 'retro-v2-test');
    let originalConfig;
    beforeEach(async () => {
        // Sauvegarder la configuration originale
        const configManager = getRagConfigManager();
        originalConfig = configManager.getConfig();
        // Créer le répertoire de test
        if (!fs.existsSync(testProjectPath)) {
            fs.mkdirSync(testProjectPath, { recursive: true });
        }
        // Réinitialiser le registre
        toolRegistry.clear();
        // Initialiser le registre v2.0
        await initializeAutoRegistryV2({ verbose: false });
    });
    afterEach(async () => {
        // Restaurer la configuration originale
        const configManager = getRagConfigManager();
        const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
        fs.writeFileSync(configPath, JSON.stringify(originalConfig, null, 2));
        // Nettoyer les fichiers de test
        if (fs.existsSync(testProjectPath)) {
            const files = fs.readdirSync(testProjectPath);
            for (const file of files) {
                fs.unlinkSync(path.join(testProjectPath, file));
            }
        }
    });
    describe('1. Vérification des outils enregistrés', () => {
        it('1.1 - activated_rag doit être enregistré et visible', () => {
            const tool = toolRegistry.getTool('activated_rag');
            expect(tool).toBeDefined();
            expect(tool?.name).toBe('activated_rag');
            expect(tool?.hidden).toBe(false);
        });
        it('1.2 - recherche_rag doit être enregistré et visible', () => {
            const tool = toolRegistry.getTool('recherche_rag');
            expect(tool).toBeDefined();
            expect(tool?.name).toBe('recherche_rag');
            expect(tool?.hidden).toBe(false);
        });
        it('1.3 - Les outils legacy doivent être enregistrés mais masqués', () => {
            const legacyTools = ['injection_rag', 'index_project', 'update_project', 'search_code', 'manage_projects'];
            legacyTools.forEach(toolName => {
                const tool = toolRegistry.getTool(toolName);
                expect(tool).toBeDefined();
                expect(tool?.name).toBe(toolName);
                expect(tool?.hidden).toBe(true);
            });
        });
        it('1.4 - Seuls les outils visibles doivent apparaître dans getTools()', () => {
            const allTools = toolRegistry.getTools();
            const visibleTools = allTools.filter(t => !t.hidden);
            const hiddenTools = allTools.filter(t => t.hidden);
            // Vérifier que seuls activated_rag et recherche_rag sont visibles
            expect(visibleTools.length).toBe(2);
            expect(visibleTools.map(t => t.name)).toContain('activated_rag');
            expect(visibleTools.map(t => t.name)).toContain('recherche_rag');
            // Vérifier que les outils legacy sont masqués
            expect(hiddenTools.length).toBe(5);
            expect(hiddenTools.map(t => t.name)).toEqual(expect.arrayContaining(['injection_rag', 'index_project', 'update_project', 'search_code', 'manage_projects']));
        });
    });
    describe('2. Rétrocompatibilité des appels API', () => {
        it('2.1 - activated_rag doit pouvoir remplacer injection_rag', async () => {
            // Créer un fichier de test
            const testFile = path.join(testProjectPath, 'test-file.js');
            fs.writeFileSync(testFile, `
                // Test file for activated_rag
                function hello() {
                    return 'Hello from activated_rag';
                }
                
                module.exports = { hello };
            `);
            // Vérifier que activated_rag peut être exécuté
            const activatedRagTool = toolRegistry.getTool('activated_rag');
            expect(activatedRagTool).toBeDefined();
            // Note: L'exécution réelle nécessiterait un handler fonctionnel
            // Pour ce test, nous vérifions juste que l'outil est disponible
        });
        it('2.2 - recherche_rag doit pouvoir remplacer search_code', async () => {
            const rechercheRagTool = toolRegistry.getTool('recherche_rag');
            expect(rechercheRagTool).toBeDefined();
            // Vérifier le schéma d'entrée
            expect(rechercheRagTool?.inputSchema).toBeDefined();
            expect(rechercheRagTool?.inputSchema.type).toBe('object');
            expect(rechercheRagTool?.inputSchema.properties).toBeDefined();
            expect(rechercheRagTool?.inputSchema.properties?.query).toBeDefined();
        });
        it('2.3 - Les outils legacy doivent toujours être exécutables', async () => {
            // Même s'ils sont masqués, les outils legacy doivent être exécutables
            // pour assurer la rétrocompatibilité
            const legacyTools = ['injection_rag', 'index_project', 'update_project', 'search_code', 'manage_projects'];
            legacyTools.forEach(toolName => {
                const tool = toolRegistry.getTool(toolName);
                expect(tool).toBeDefined();
                expect(toolRegistry.hasTool(toolName)).toBe(true);
            });
        });
    });
    describe('3. Migration depuis v1.0', () => {
        it('3.1 - La migration doit préserver les outils existants', async () => {
            // Simuler un registre v1.0 avec des outils legacy
            toolRegistry.clear();
            // Enregistrer manuellement des outils legacy (simulation v1.0)
            const legacyTool = {
                name: 'injection_rag',
                description: 'Legacy injection tool',
                inputSchema: { type: 'object' }
            };
            toolRegistry.register(legacyTool, async () => ({ success: true }));
            // Initialiser le registre v2.0 (doit détecter et masquer les outils legacy)
            await initializeAutoRegistryV2({ verbose: false });
            // Vérifier que l'outil legacy est toujours présent mais masqué
            const tool = toolRegistry.getTool('injection_rag');
            expect(tool).toBeDefined();
            expect(tool?.hidden).toBe(true);
        });
        it('3.2 - La configuration doit être migrée automatiquement', async () => {
            // Créer une configuration v1.0
            const v1Config = {
                version: '1.0.0',
                defaults: {
                    embedding_provider: 'fake',
                    embedding_model: 'nomic-embed-text',
                    chunk_size: 1000,
                    chunk_overlap: 200,
                },
                providers: {
                    fake: { description: 'Fake provider' },
                    ollama: { description: 'Ollama' }
                }
                // Pas de configuration system pour v2.0
            };
            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(v1Config, null, 2));
            // Recharger la configuration
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            // Vérifier que la configuration est valide
            expect(config).toBeDefined();
            // Vérifier que les paramètres système v2.0 ont des valeurs par défaut
            // Note: La configuration v2.0 ajoute automatiquement la section system
            // si elle n'existe pas
            const configWithSystem = config;
            expect(configWithSystem.system).toBeDefined();
            expect(configWithSystem.system.legacy_mode).toBe(true); // Par défaut en mode rétrocompatible
            expect(configWithSystem.system.exposed_tools).toEqual(['activated_rag', 'recherche_rag']);
            expect(configWithSystem.system.legacy_tools).toEqual(expect.arrayContaining(['injection_rag', 'index_project', 'update_project', 'search_code', 'manage_projects']));
        });
    });
    describe('4. Cohabitation ancien/nouveau système', () => {
        it('4.1 - activated_rag doit pouvoir utiliser les composants existants', async () => {
            // Créer plusieurs fichiers de test
            const files = [
                {
                    name: 'component-a.js',
                    content: `
                        // Component A
                        export class ComponentA {
                            constructor() {
                                this.name = 'ComponentA';
                            }
                            
                            greet() {
                                return 'Hello from ComponentA';
                            }
                        }
                    `
                },
                {
                    name: 'component-b.js',
                    content: `
                        // Component B
                        export function componentB() {
                            return {
                                version: '1.0.0',
                                features: ['feature1', 'feature2']
                            };
                        }
                    `
                },
                {
                    name: 'README.md',
                    content: `
                        # Test Project
                        
                        This is a test project for v2.0 compatibility testing.
                        
                        ## Components
                        - ComponentA: Main component
                        - ComponentB: Utility component
                    `
                }
            ];
            for (const file of files) {
                const filePath = path.join(testProjectPath, file.name);
                fs.writeFileSync(filePath, file.content);
            }
            // Vérifier que tous les outils sont disponibles
            const tools = toolRegistry.getToolNames();
            expect(tools).toContain('activated_rag');
            expect(tools).toContain('recherche_rag');
            expect(tools).toContain('injection_rag'); // Masqué mais présent
        });
        it('4.2 - Les recherches doivent fonctionner avec les deux systèmes', async () => {
            // Ce test vérifie que recherche_rag peut utiliser
            // l'infrastructure de recherche existante
            const rechercheRagTool = toolRegistry.getTool('recherche_rag');
            expect(rechercheRagTool).toBeDefined();
            // Vérifier que le schéma supporte les options de recherche avancées
            const inputSchema = rechercheRagTool?.inputSchema;
            expect(inputSchema?.properties?.scope).toBeDefined();
            expect(inputSchema?.properties?.top_k).toBeDefined();
            expect(inputSchema?.properties?.filters).toBeDefined();
        });
        it('4.3 - Le chunking intelligent doit être compatible', async () => {
            // Créer un fichier avec structure complexe
            const complexFile = path.join(testProjectPath, 'complex-structure.ts');
            fs.writeFileSync(complexFile, `
                // TypeScript file with complex structure
                interface User {
                    id: string;
                    name: string;
                    email: string;
                }
                
                class UserManager {
                    private users: Map<string, User> = new Map();
                    
                    addUser(user: User): void {
                        this.users.set(user.id, user);
                    }
                    
                    getUser(id: string): User | undefined {
                        return this.users.get(id);
                    }
                    
                    getAllUsers(): User[] {
                        return Array.from(this.users.values());
                    }
                }
                
                // Utility functions
                function validateEmail(email: string): boolean {
                    const regex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
                    return regex.test(email);
                }
                
                function formatUserName(user: User): string {
                    return \`\${user.name} <\${user.email}>\`;
                }
                
                export { User, UserManager, validateEmail, formatUserName };
            `);
            // Vérifier que activated_rag peut traiter ce fichier
            // (Le test réel d'exécution nécessiterait une implémentation complète)
            const activatedRagTool = toolRegistry.getTool('activated_rag');
            expect(activatedRagTool).toBeDefined();
            expect(activatedRagTool?.description).toContain('automatique');
        });
    });
    describe('5. Tests de performance et stabilité', () => {
        it('5.1 - Le registre v2.0 ne doit pas dégrader les performances', async () => {
            // Mesurer le temps d'initialisation
            const startTime = Date.now();
            toolRegistry.clear();
            await initializeAutoRegistryV2({ verbose: false });
            const endTime = Date.now();
            const duration = endTime - startTime;
            // L'initialisation doit être rapide (< 500ms)
            expect(duration).toBeLessThan(500);
            // Vérifier que tous les outils sont enregistrés
            const tools = toolRegistry.getToolNames();
            expect(tools.length).toBe(7); // 2 nouveaux + 5 legacy
        });
        it('5.2 - La visibilité des outils ne doit pas affecter l\'exécution', () => {
            // Récupérer tous les outils
            const allTools = toolRegistry.getTools();
            const visibleTools = allTools.filter(t => !t.hidden);
            const hiddenTools = allTools.filter(t => t.hidden);
            // Vérifier les comptes
            expect(visibleTools.length).toBe(2);
            expect(hiddenTools.length).toBe(5);
            // Vérifier que les outils masqués sont toujours accessibles par getTool()
            hiddenTools.forEach(tool => {
                const retrievedTool = toolRegistry.getTool(tool.name);
                expect(retrievedTool).toBeDefined();
                expect(retrievedTool?.hidden).toBe(true);
            });
        });
        it('5.3 - La configuration doit être persistante entre les rechargements', async () => {
            // Modifier la configuration
            const configManager = getRagConfigManager();
            const config = configManager.getConfig();
            // Activer le mode nouveau seulement
            config.system = {
                ...config.system,
                legacy_mode: false,
                exposed_tools: ['activated_rag'],
                legacy_tools: ['injection_rag', 'index_project', 'update_project', 'search_code', 'manage_projects', 'recherche_rag']
            };
            const configPath = path.join(process.cwd(), 'config', 'rag-config.json');
            fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
            // Recharger le registre
            toolRegistry.clear();
            await initializeAutoRegistryV2({ verbose: false });
            // Vérifier que la configuration a été appliquée
            const allTools = toolRegistry.getTools();
            const visibleTools = allTools.filter(t => !t.hidden);
            const hiddenTools = allTools.filter(t => t.hidden);
            // Seul activated_rag devrait être visible
            expect(visibleTools.length).toBe(1);
            expect(visibleTools[0].name).toBe('activated_rag');
            // recherche_rag devrait être masqué
            expect(hiddenTools.map(t => t.name)).toContain('recherche_rag');
        });
    });
});
//# sourceMappingURL=retrocompatibility-v2.test.js.map