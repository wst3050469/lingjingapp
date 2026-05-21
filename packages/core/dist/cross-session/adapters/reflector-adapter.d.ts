import type { ReflectorResultSnapshot } from '../types.js';
export declare class ReflectorAdapter {
    private pendingResult;
    private reflector;
    constructor(reflector: {
        reflect: (memories: unknown[]) => unknown;
    });
    onReflect(memories: unknown[]): void;
    consumeReflectorResult(): ReflectorResultSnapshot | null;
}
//# sourceMappingURL=reflector-adapter.d.ts.map