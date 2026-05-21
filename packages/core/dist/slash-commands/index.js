import { SlashCommandParser } from './parser.js';
import { explainCommand, testCommand, refactorCommand, commentCommand, optimizeCommand, reviewCommand, helpCommand, } from './builtin.js';
export { SlashCommandParser } from './parser.js';
export * from './types.js';
export * from './builtin.js';
export function createSlashCommandParser() {
    const parser = new SlashCommandParser();
    parser.register(explainCommand);
    parser.register(testCommand);
    parser.register(refactorCommand);
    parser.register(commentCommand);
    parser.register(optimizeCommand);
    parser.register(reviewCommand);
    parser.register(helpCommand);
    return parser;
}
//# sourceMappingURL=index.js.map