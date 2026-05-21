import type { IncrementalSnapshotter } from '../incremental-snapshotter.js';
import type { ContextPersistor } from '../context-persistor.js';
import type { ContextSnapshot } from '../types.js';
import type { Conversation } from '../../agent/conversation.js';
export declare class NudgerAdapter {
    private snapshotter;
    private persistor;
    private nudger;
    constructor(nudger: {
        review: (conversation: Conversation) => unknown;
    }, snapshotter: IncrementalSnapshotter, persistor: ContextPersistor);
    onNudge(conversation: Conversation, baseSnapshot: ContextSnapshot | null): void;
}
//# sourceMappingURL=nudger-adapter.d.ts.map