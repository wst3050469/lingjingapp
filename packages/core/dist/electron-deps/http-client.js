// Stub for vitest - real implementation is in Electron context
class StubHttpClient {
    on(_event, _handler) { }
    emit(_event, ..._args) { }
    removeListener(_event, _handler) { }
    post(_url, _data, _headers) {
        return Promise.resolve({});
    }
    get(_url, _headers) {
        return Promise.resolve({});
    }
}
export const cloudSyncClient = new StubHttpClient();
export const githubClient = {
    get: (_url, _options) => Promise.resolve({}),
    post: (_url, _data, _options) => Promise.resolve({}),
    put: (_url, _data, _options) => Promise.resolve({}),
    patch: (_url, _data, _options) => Promise.resolve({}),
    delete: (_url, _options) => Promise.resolve({}),
};
//# sourceMappingURL=http-client.js.map