export interface ConnectorConfig {
  name: string;
  type: string;
  config: Record<string, unknown>;
}

export interface IConnector {
  name: string;
  type: string;
  execute(action: string, params: Record<string, unknown>): Promise<unknown>;
  isAvailable(): Promise<boolean>;
}

export interface IConnectorHubAdapter {
  register(connector: IConnector): void;
  discover(type?: string): IConnector[];
  invoke(name: string, action: string, params: Record<string, unknown>): Promise<unknown>;
}
