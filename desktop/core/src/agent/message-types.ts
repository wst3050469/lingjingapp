// Core message types - canonical representation independent of any LLM provider

export interface ToolCall {
    id: string;
    name: string;
    arguments: Record<string, unknown>;
}

export interface ToolResult {
    content: string;
    isError?: boolean;
}

/** Multi-modal content block for user messages */
export type ContentBlock = {
    type: 'text';
    text: string;
} | {
    type: 'image';
    data: string;
    mediaType: string;
};

export interface UserMessage {
    role: 'user';
    /** Plain text (backward-compatible) or multi-modal content blocks */
    content: string | ContentBlock[];
}

export interface AssistantMessage {
    role: 'assistant';
    content: string;
    reasoningContent?: string;
    toolCalls?: ToolCall[];
}

export interface ToolMessage {
    role: 'tool';
    toolCallId: string;
    content: string;
    isError?: boolean;
}

export type Message = UserMessage | AssistantMessage | ToolMessage;
