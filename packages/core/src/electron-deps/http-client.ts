// HTTP client stubs - real implementations are in Electron context

class StubHttpClient {
  on(_event: string, _handler: (...args: any[]) => void): void {}
  emit(_event: string, ..._args: any[]): void {}
  removeListener(_event: string, _handler: (...args: any[]) => void): void {}
  post(_url: string, _data?: any, _headers?: Record<string, string>): Promise<any> {
    return Promise.resolve({});
  }
  get(_url: string, _headers?: Record<string, string>): Promise<any> {
    return Promise.resolve({});
  }
}

export const cloudSyncClient = new StubHttpClient();

export const githubClient = {
  get: (_url: string, _options?: any): Promise<any> => Promise.resolve({}),
  post: (_url: string, _data?: any, _options?: any): Promise<any> => Promise.resolve({}),
  put: (_url: string, _data?: any, _options?: any): Promise<any> => Promise.resolve({}),
  patch: (_url: string, _data?: any, _options?: any): Promise<any> => Promise.resolve({}),
  delete: (_url: string, _options?: any): Promise<any> => Promise.resolve({}),
};
