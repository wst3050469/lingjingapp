import { z } from 'zod';

/**
 * Schema for Agent Run requests.
 * Validates the payload sent from Renderer to Main via `agent:run`.
 */
export const AgentRunSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  mode: z.enum(['ask', 'experts', 'prototype']).optional(),
  images: z.array(z.object({
    data: z.string(), // Base64 encoded image
    mediaType: z.string()
  })).optional(),
  conversationMessages: z.array(z.any()).optional(),
  conversationId: z.string().optional(),
});

/**
 * Schema for Confirm Request payloads.
 * Validates the payload sent from Main to Renderer via `agent:confirm-request`.
 */
export const ConfirmRequestSchema = z.object({
  requestId: z.string(),
  type: z.enum(['bash', 'mcp', 'plan']),
  toolName: z.string(),
  args: z.record(z.any()),
  command: z.string().optional(),
  planTitle: z.string().optional(),
  planContent: z.string().optional(),
});

/**
 * Schema for Quest Run requests.
 * Validates the payload sent from Renderer to Main via `quest:run`.
 */
export const QuestRunSchema = z.object({
  taskId: z.string(),
  message: z.string().min(1),
  scenario: z.string(),
  runMode: z.enum(['local', 'worktree', 'remote']),
  autoMode: z.enum(['auto', 'manual']),
  contexts: z.array(z.object({
    id: z.string(),
    type: z.string(),
    label: z.string(),
    path: z.string(),
  })).optional(),
  runId: z.string().optional(),
  images: z.array(z.object({
    data: z.string(),
    mediaType: z.string(),
  })).optional(),
  chatMode: z.enum(['chat', 'research']).optional(),
});
