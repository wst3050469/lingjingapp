export class ConnectorHubAdapter {
    connectors = new Map();
    register(connector) {
        this.connectors.set(connector.name, connector);
    }
    discover(type) {
        const all = Array.from(this.connectors.values());
        if (!type)
            return all;
        return all.filter((c) => c.type === type);
    }
    async invoke(name, action, params) {
        const connector = this.connectors.get(name);
        if (!connector) {
            throw new Error(`Connector "${name}" not found`);
        }
        return connector.execute(action, params);
    }
}
//# sourceMappingURL=connector-hub-adapter.js.map