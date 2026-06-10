import { ZodSchema } from 'zod';

/**
 * Validates an IPC payload against a provided Zod schema.
 * If validation fails, it throws a structured error that can be caught by the IPC handler.
 * 
 * @param schema The Zod schema to validate against.
 * @param payload The incoming payload from the renderer.
 * @param context Additional context for error reporting (e.g., handler name).
 * @throws Error with a descriptive message if validation fails.
 */
export function validateIpcPayload<T>(
  schema: ZodSchema<T>,
  payload: unknown,
  context: string
): T {
  const result = schema.safeParse(payload);

  if (!result.success) {
    const errorMessages = result.error.issues
      .map((issue)  => `[${issue.path.join('.')}] ${issue.message}`)
      .join(', ');
    
    const errorMessage = `[IPC Validation Failed in ${context}] ${errorMessages}`;
    console.error(errorMessage);
    throw new Error(errorMessage);
  }

  return result.data;
}
