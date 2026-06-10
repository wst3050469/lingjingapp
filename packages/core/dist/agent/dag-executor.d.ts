export interface DAGNode<T = unknown> {
    id: string;
    dependencies: string[];
    execute: () => Promise<T>;
}
export declare class DAGExecutor {
    detectCycle(nodes: DAGNode[]): string[] | null;
    execute<T>(nodes: DAGNode<T>[]): Promise<Map<string, T>>;
    topologicalSort(nodes: DAGNode[]): string[];
    private dfs;
}
//# sourceMappingURL=dag-executor.d.ts.map