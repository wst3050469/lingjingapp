import type { IConnector, IConnectorHubAdapter } from './types.js';

export class ConnectorHubAdapter implements IConnectorHubAdapter {
  private connectors = new Map<string, IConnector>();

  register(connector: IConnector): void {
    this.connectors.set(connector.name, connector);
  }

  discover(type?: string): IConnector[] {
    const all = Array.from(this.connectors.values());
    if (!type) return all;
    return all.filter((c) => c.type === type);
  }

  async invoke(name: string, action: string, params: Record<string, unknown>): Promise<unknown> {
    const connector = this.connectors.get(name);
    if (!connector) {
      throw new Error(`Connector "${name}" not found`);
    }
    return connector.execute(action, params);
  }
}
