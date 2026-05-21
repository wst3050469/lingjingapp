// Tool types - minimal type definitions for MCP module
/**
 * Convert a Tool to an MCP-compatible tool schema.
 * Maps parameters to inputSchema as required by the MCP protocol.
 */
export function toolToSchema(tool) {
    return {
        name: tool.name,
        description: tool.description,
        inputSchema: tool.parameters,
    };
}
//# sourceMappingURL=types.js.map