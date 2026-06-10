// JSON-RPC 2.0 protocol types and utilities for MCP

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

// MCP protocol types
export interface McpServerInfo {
  name: string;
  version: string;
}

export interface McpCapabilities {
  tools?: {};
  resources?: {};
  prompts?: {};
}

export interface McpInitializeResult {
  protocolVersion: string;
  capabilities: McpCapabilities;
  serverInfo: McpServerInfo;
}

export interface McpToolDefinition {
  name: string;
  description?: string;
  inputSchema: {
    type: 'object';
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

export interface McpToolsListResult {
  tools: McpToolDefinition[];
}

export interface McpToolCallResult {
  content: McpContent[];
  isError?: boolean;
}

export interface McpContent {
  type: 'text' | 'image' | 'resource';
  text?: string;
  data?: string;
  mimeType?: string;
}

export interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;

  type?: 'stdio' | 'sse' | 'streamable-http';
  url?: string;
  headers?: Record<string, string>;

  timeout?: number;
}

export type McpConnectionState =
  | 'connected'
  | 'disconnected'
  | 'connecting'
  | 'connect-failed';

export interface McpServerState {
  name: string;
  config: McpServerConfig;
  state: McpConnectionState;
  serverInfo?: McpServerInfo | null;
  tools: McpToolDefinition[];
  error?: string;
  errorCategory?: string;
}

export interface McpMarketplaceEntry {
  id: string;
  name: string;
  publisher: string;
  stars: number;
  description: string;
  category: string;
  config: McpServerConfig;
  requiredEnv: string[];
}

export interface McpOperationLog {
  serverName: string;
  toolName: string;
  timestamp: string;
  success: boolean;
  error?: string;
  durationMs: number;
}
