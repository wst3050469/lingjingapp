// Get terminal output tool - retrieve output from previously executed bash commands
import { getBashOutput, listBashOutputs } from './bash-output-store.js';
export const getTerminalOutputTool = {
    name: 'get_terminal_output',
    description: 'Retrieve output from previously executed bash commands. Call without command_id to list recent commands, or with a specific command_id to get its full output.',
    parameters: {
        type: 'object',
        properties: {
            command_id: {
                type: 'string',
                description: 'The command ID to retrieve output for (e.g. "cmd-3"). Omit to list recent commands.',
            },
            tail: {
                type: 'number',
                description: 'Only return the last N lines of output. Useful for long outputs.',
            },
        },
        required: [],
    },
    async execute(params, _context) {
        const commandId = params.command_id;
        const tail = params.tail;
        // If no command_id, list recent commands
        if (!commandId) {
            const entries = listBashOutputs();
            if (entries.length === 0) {
                return { content: 'No bash commands have been executed yet in this session.' };
            }
            const lines = entries.slice(0, 20).map((e) => {
                const duration = ((e.completedAt - e.startedAt) / 1000).toFixed(1);
                const status = e.exitCode === 0 ? 'ok' : `exit ${e.exitCode}`;
                const cmdPreview = e.command.length > 80 ? e.command.slice(0, 80) + '...' : e.command;
                return `  ${e.commandId}  [${status}] ${duration}s  ${cmdPreview}`;
            });
            return {
                content: `Recent commands (${entries.length} total, showing last ${lines.length}):\n\n${lines.join('\n')}\n\nUse get_terminal_output with a command_id to see full output.`,
            };
        }
        // Retrieve specific command output
        const entry = getBashOutput(commandId);
        if (!entry) {
            return { content: `No output found for command ID "${commandId}". Use get_terminal_output without arguments to list available commands.`, isError: true };
        }
        let output = `Command: ${entry.command}\n`;
        output += `Exit code: ${entry.exitCode ?? 'unknown'}\n`;
        output += `Duration: ${((entry.completedAt - entry.startedAt) / 1000).toFixed(1)}s\n`;
        output += `---\n`;
        let content = entry.stdout || '';
        if (entry.stderr) {
            if (content)
                content += '\n';
            content += `STDERR:\n${entry.stderr}`;
        }
        if (!content) {
            content = '(no output)';
        }
        // Apply tail filter
        if (tail && tail > 0) {
            const lines = content.split('\n');
            if (lines.length > tail) {
                content = `...(${lines.length - tail} lines omitted)\n` + lines.slice(-tail).join('\n');
            }
        }
        output += content;
        return { content: output };
    },
};
//# sourceMappingURL=get-terminal-output.js.map