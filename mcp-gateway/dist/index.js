"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.McpGateway = void 0;
class McpGateway {
    constructor() {
        console.log('MCP Gateway initialized');
    }
    route(contract) {
        console.log('Routing contract:', contract);
        return { success: true, message: 'Contract routed' };
    }
}
exports.McpGateway = McpGateway;
// Export for CommonJS compatibility
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { McpGateway };
}
//# sourceMappingURL=index.js.map