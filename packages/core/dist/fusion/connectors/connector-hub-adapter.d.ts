import type { IConnector, IConnectorHubAdapter } from './types.js';
export declare class ConnectorHubAdapter implements IConnectorHubAdapter {
    private connectors;
    register(connector: IConnector): void;
    discover(type?: string): IConnector[];
    invoke(name: string, action: string, params: Record<string, unknown>): Promise<unknown>;
}
//# sourceMappingURL=connector-hub-adapter.d.ts.map