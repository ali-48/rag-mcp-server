// src/core/tool-registry.ts
// ToolRegistry Core - Système central d'enregistrement des outils MCP

import { Tool } from "@modelcontextprotocol/sdk/types.js";

/**
 * Interface pour un handler d'outil MCP
 */
export type ToolHandler = (args: any) => Promise<any>;

/**
 * Définition complète d'un outil MCP
 */
export interface ToolDefinition extends Tool {
  // Hérite de Tool (name, description, inputSchema)
  // Ajoute éventuellement des métadonnées supplémentaires
  hidden?: boolean; // Si true, l'outil est masqué de la liste des outils visibles
}

/**
 * Registry central pour la gestion des outils MCP
 * 
 * Fonctionnalités :
 * - Enregistrement d'outils avec leurs handlers
 * - Récupération de la liste des outils disponibles
 * - Exécution d'outils par nom
 * - Vérification d'existence d'outils
 */
export class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();
  private handlers = new Map<string, ToolHandler>();

  /**
   * Enregistre un nouvel outil dans le registry
   * @param tool Définition de l'outil (nom, description, schéma)
   * @param handler Fonction d'exécution de l'outil
   * @throws Error si l'outil existe déjà
   */
  register(tool: ToolDefinition, handler: ToolHandler): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool '${tool.name}' is already registered`);
    }

    this.tools.set(tool.name, tool);
    this.handlers.set(tool.name, handler);
  }

  /**
   * Récupère la définition d'un outil par son nom
   * @param name Nom de l'outil
   * @returns Définition de l'outil ou undefined
   */
  getTool(name: string): ToolDefinition | undefined {
    return this.tools.get(name);
  }

  /**
   * Récupère la liste de tous les outils enregistrés
   * @returns Tableau de définitions d'outils
   */
  getTools(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /**
   * Vérifie si un outil est enregistré
   * @param name Nom de l'outil
   * @returns true si l'outil existe
   */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Exécute un outil par son nom avec les arguments fournis
   * @param name Nom de l'outil
   * @param args Arguments de l'outil
   * @returns Résultat de l'exécution
   * @throws Error si l'outil n'existe pas
   */
  async execute(name: string, args: any): Promise<any> {
    const handler = this.handlers.get(name);
    if (!handler) {
      throw new Error(`Tool '${name}' not found in registry`);
    }

    try {
      return await handler(args);
    } catch (error) {
      // Pas de logs sur stderr pour compatibilité MCP
      throw error;
    }
  }

  /**
   * Supprime un outil du registry
   * @param name Nom de l'outil à supprimer
   * @returns true si l'outil a été supprimé
   */
  unregister(name: string): boolean {
    const toolRemoved = this.tools.delete(name);
    const handlerRemoved = this.handlers.delete(name);
    return toolRemoved || handlerRemoved;
  }

  /**
   * Vide complètement le registry
   */
  clear(): void {
    this.tools.clear();
    this.handlers.clear();
  }

  /**
   * Récupère le nombre d'outils enregistrés
   * @returns Nombre d'outils
   */
  size(): number {
    return this.tools.size;
  }

  /**
   * Récupère les noms de tous les outils enregistrés
   * @returns Tableau de noms d'outils
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Filtre les outils par préfixe
   * @param prefix Préfixe à rechercher
   * @returns Outils dont le nom commence par le préfixe
   */
  filterByPrefix(prefix: string): ToolDefinition[] {
    return this.getTools().filter(tool => tool.name.startsWith(prefix));
  }

  /**
   * Filtre les outils par catégorie (basé sur le préfixe ou autre logique)
   * @param category Catégorie à rechercher
   * @returns Outils de la catégorie
   */
  filterByCategory(category: 'graph' | 'rag' | string): ToolDefinition[] {
    if (category === 'graph') {
      // Outils graph: pas de préfixe spécifique
      return this.getTools().filter(tool => !tool.name.startsWith('rag_'));
    } else if (category === 'rag') {
      // Outils RAG: préfixe "rag_"
      return this.filterByPrefix('rag_');
    } else {
      // Catégorie personnalisée
      return this.getTools().filter(tool =>
        tool.name.toLowerCase().includes(category.toLowerCase())
      );
    }
  }
}

/**
 * Instance singleton du ToolRegistry pour une utilisation globale
 */
export const toolRegistry = new ToolRegistry();

/**
 * Fonction utilitaire pour créer une définition d'outil
 */
export function createToolDefinition(
  name: string,
  description: string,
  inputSchema: Tool['inputSchema']
): ToolDefinition {
  return {
    name,
    description,
    inputSchema,
  };
}

/**
 * Fonction utilitaire pour valider les arguments d'un outil
 */
export function validateToolArgs(args: any, expectedSchema: any): boolean {
  // Implémentation basique - à améliorer avec une validation complète
  if (!args || typeof args !== 'object') {
    return false;
  }

  // Vérification des champs requis
  if (expectedSchema.required) {
    for (const requiredField of expectedSchema.required) {
      if (!(requiredField in args)) {
        return false;
      }
    }
  }

  return true;
}
