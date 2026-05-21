export interface JSONSchema {
    type: string;
    properties?: Record<string, JSONSchema & {
        description?: string;
        enum?: string[];
    }>;
    required?: string[];
    items?: JSONSchema & {
        enum?: string[];
    };
    description?: string;
    default?: unknown;
    additionalProperties?: boolean;
    enum?: string[];
}
export interface ToolSchema {
    name: string;
    description: string;
    parameters: JSONSchema;
}
//# sourceMappingURL=types.d.ts.map