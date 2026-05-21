// Shared bash output store - stores recent command outputs for retrieval
// Used by bash.ts (write) and get-terminal-output.ts (read)
const MAX_ENTRIES = 50;
const store = new Map();
const orderQueue = []; // Tracks insertion order for FIFO eviction
let commandCounter = 0;
export function generateCommandId() {
    return `cmd-${++commandCounter}`;
}
export function storeBashOutput(entry) {
    // FIFO eviction when at capacity
    if (store.size >= MAX_ENTRIES && !store.has(entry.commandId)) {
        const oldest = orderQueue.shift();
        if (oldest)
            store.delete(oldest);
    }
    store.set(entry.commandId, entry);
    if (!orderQueue.includes(entry.commandId)) {
        orderQueue.push(entry.commandId);
    }
}
export function getBashOutput(commandId) {
    return store.get(commandId);
}
export function listBashOutputs() {
    // Return in reverse chronological order (newest first)
    return Array.from(store.values()).reverse();
}
//# sourceMappingURL=bash-output-store.js.map