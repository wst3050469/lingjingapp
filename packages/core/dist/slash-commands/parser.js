export class SlashCommandParser {
    commands = new Map();
    commandPrefix = '/';
    register(command) {
        this.commands.set(command.name, command);
    }
    unregister(name) {
        return this.commands.delete(name);
    }
    get(name) {
        return this.commands.get(name);
    }
    getAll() {
        return Array.from(this.commands.values());
    }
    parse(input) {
        const trimmed = input.trim();
        if (!trimmed.startsWith(this.commandPrefix)) {
            return { isCommand: false };
        }
        const parts = trimmed.slice(1).split(/\s+/);
        const commandName = parts[0];
        const args = parts.slice(1).join(' ');
        return {
            isCommand: true,
            command: commandName,
            args,
        };
    }
    getCompletions(partial) {
        const completions = [];
        if (!partial.startsWith(this.commandPrefix)) {
            return completions;
        }
        const partialCommand = partial.slice(1).toLowerCase();
        for (const cmd of this.commands.values()) {
            if (cmd.name.toLowerCase().startsWith(partialCommand)) {
                completions.push({
                    command: cmd.name,
                    description: cmd.description,
                    usage: cmd.usage,
                    match: partial,
                });
            }
        }
        return completions.sort((a, b) => a.command.localeCompare(b.command));
    }
    async execute(input, context) {
        const parsed = this.parse(input);
        if (!parsed.isCommand || !parsed.command) {
            return {
                success: false,
                message: 'Not a slash command',
            };
        }
        const command = this.get(parsed.command);
        if (!command) {
            const suggestions = this.findSimilar(parsed.command);
            return {
                success: false,
                message: `Unknown command: /${parsed.command}. ${suggestions}`,
            };
        }
        try {
            const result = await command.execute(parsed.args || '', context);
            return {
                success: result.success,
                message: result.message,
                data: result.data,
            };
        }
        catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            return {
                success: false,
                message: `Command execution failed: ${msg}`,
            };
        }
    }
    findSimilar(commandName) {
        const allCommands = Array.from(this.commands.keys());
        const lowerName = commandName.toLowerCase();
        const similar = allCommands.filter(cmd => {
            const lowerCmd = cmd.toLowerCase();
            return lowerCmd.includes(lowerName) || lowerName.includes(lowerCmd);
        });
        if (similar.length > 0) {
            return `Did you mean: ${similar.map(c => `/${c}`).join(', ')}?`;
        }
        return `Available commands: ${allCommands.map(c => `/${c}`).join(', ')}`;
    }
    getHelp() {
        const commands = this.getAll();
        const lines = ['Available slash commands:', ''];
        for (const cmd of commands.sort((a, b) => a.name.localeCompare(b.name))) {
            lines.push(`/${cmd.name} - ${cmd.description}`);
            lines.push(`  Usage: ${cmd.usage}`);
            if (cmd.examples && cmd.examples.length > 0) {
                lines.push(`  Examples:`);
                for (const example of cmd.examples) {
                    lines.push(`    ${example}`);
                }
            }
            lines.push('');
        }
        return lines.join('\n');
    }
}
//# sourceMappingURL=parser.js.map