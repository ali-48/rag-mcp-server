// src/tools/graph/delete-relations.ts
// Outil: delete_relations - Supprimer des relations entre entités
import { knowledgeGraphManager } from "../../knowledge-graph/manager.js";
/**
 * Définition de l'outil delete_relations
 */
export const deleteRelationsTool = {
    name: "delete_relations",
    description: "Delete multiple relations from the knowledge graph",
    inputSchema: {
        type: "object",
        properties: {
            relations: {
                type: "array",
                items: {
                    type: "object",
                    properties: {
                        from: {
                            type: "string",
                            description: "The name of the entity where the relation starts"
                        },
                        to: {
                            type: "string",
                            description: "The name of the entity where the relation ends"
                        },
                        relationType: {
                            type: "string",
                            description: "The type of the relation"
                        },
                    },
                    required: ["from", "to", "relationType"],
                },
                description: "An array of relations to delete"
            },
        },
        required: ["relations"],
    },
};
/**
 * Handler pour l'outil delete_relations
 */
export const deleteRelationsHandler = async (args) => {
    if (!args.relations || !Array.isArray(args.relations)) {
        throw new Error("The 'relations' parameter is required and must be an array");
    }
    // Valider chaque relation
    for (const relation of args.relations) {
        if (!relation.from || typeof relation.from !== 'string') {
            throw new Error("Each relation must have a 'from' string property");
        }
        if (!relation.to || typeof relation.to !== 'string') {
            throw new Error("Each relation must have a 'to' string property");
        }
        if (!relation.relationType || typeof relation.relationType !== 'string') {
            throw new Error("Each relation must have a 'relationType' string property");
        }
    }
    try {
        await knowledgeGraphManager.deleteRelations(args.relations);
        return {
            content: [{
                    type: "text",
                    text: "Relations deleted successfully"
                }]
        };
    }
    catch (error) {
        console.error("Error in delete_relations tool:", error);
        throw error;
    }
};
/**
 * Fonction utilitaire pour supprimer une relation
 */
export async function deleteRelation(from, to, relationType) {
    return deleteRelationsHandler({
        relations: [{ from, to, relationType }]
    });
}
/**
 * Test de l'outil (pour usage en développement)
 */
export async function testDeleteRelations() {
    console.log("Testing delete_relations tool...");
    const entity1 = "Test Entity A for Relations";
    const entity2 = "Test Entity B for Relations";
    const relationType = "TEST_RELATION";
    try {
        // Créer les entités
        await knowledgeGraphManager.createEntities([
            {
                name: entity1,
                entityType: "Test",
                observations: ["Entity A for relation test"]
            },
            {
                name: entity2,
                entityType: "Test",
                observations: ["Entity B for relation test"]
            }
        ]);
        // Créer une relation
        await knowledgeGraphManager.createRelations([{
                from: entity1,
                to: entity2,
                relationType: relationType
            }]);
        console.log(`✅ Created test entities and relation`);
        // Supprimer la relation
        const result = await deleteRelationsHandler({
            relations: [{
                    from: entity1,
                    to: entity2,
                    relationType: relationType
                }]
        });
        console.log("✅ Test passed:", result);
        return result;
    }
    catch (error) {
        console.error("❌ Test failed:", error);
        throw error;
    }
}
