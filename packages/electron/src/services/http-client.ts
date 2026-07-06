import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number;
  maxRetryDelay: number;
  retryableStatusCodes: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  maxRetryDelay: 30000,
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};

export interface HttpClientConfig extends AxiosRequestConfig {
  retry?: Partial<RetryConfig>;
  enableLogging?: boolean;
}

export class HttpClient {
  private client: AxiosInstance;
  private retryConfig: RetryConfig;
  private enableLogging: boolean;

  constructor(config: HttpClientConfig = {}) {
    const { retry = {}, enableLogging = true, ...axiosConfig } = config;
    
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG, ...retry };
    this.enableLogging = enableLogging;

    this.client = axios.create({
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      },
      ...axiosConfig
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    this.client.interceptors.request.use(
      (config) => {
        if (this.enableLogging) {
          console.log(`[HTTP] ${config.method?.toUpperCase()} ${config.url}`, {
            headers: config.headers,
            data: config.data
          });
        }
        
        if (!config.metadata) {
          config.metadata = {};
        }
        config.metadata.startTime = Date.now();
        
        return config;
      },
      (error) => {
        console.error('[HTTP] Request error:', error);
        return Promise.reject(error);
      }
    );

    this.client.interceptors.response.use(
      (response) => {
        const duration = Date.now() - (response.config.metadata?.startTime || 0);
        
        if (this.enableLogging) {
          console.log(`[HTTP] ${response.status} ${response.config.url} (${duration}ms)`, {
            data: response.data
          });
        }
        
        return response;
      },
      async (error: AxiosError) => {
        const config = error.config;
        
        if (!config) {
          return Promise.reject(error);
        }

        if (!config.metadata) {
          config.metadata = {};
        }

        const retryCount = config.metadata.retryCount || 0;
        
        if (
          retryCount < this.retryConfig.maxRetries &&
          this.shouldRetry(error)
        ) {
          config.metadata.retryCount = retryCount + 1;
          
          const delay = Math.min(
            this.retryConfig.retryDelay * Math.pow(2, retryCount),
            this.retryConfig.maxRetryDelay
          );
          
          console.warn(
            `[HTTP] Retry ${config.metadata.retryCount}/${this.retryConfig.maxRetries} ` +
            `after ${delay}ms for ${config.url}`
          );
          
          await this.sleep(delay);
          
          return this.client.request(config);
        }

        console.error('[HTTP] Response error:', {
          url: config.url,
          status: error.response?.status,
          message: error.message,
          retryCount
        });
        
        return Promise.reject(error);
      }
    );
  }

  private shouldRetry(error: AxiosError): boolean {
    if (!error.response) {
      return true;
    }

    return this.retryConfig.retryableStatusCodes.includes(error.response.status);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config);
    return response.data;
  }

  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config);
    return response.data;
  }

  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config);
    return response.data;
  }

  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config);
    return response.data;
  }

  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config);
    return response.data;
  }

  setAuthToken(token: string): void {
    this.client.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  }

  removeAuthToken(): void {
    delete this.client.defaults.headers.common['Authorization'];
  }

  setApiKey(apiKey: string): void {
    this.client.defaults.headers.common['x-api-key'] = apiKey;
  }

  removeApiKey(): void {
    delete this.client.defaults.headers.common['x-api-key'];
  }

  setBaseUrl(baseUrl: string): void {
    this.client.defaults.baseURL = baseUrl;
  }
}

export const cloudSyncClient = new HttpClient({
  baseURL: 'https://www.spiritrealmz.com',
  timeout: 30000,
  retry: {
    maxRetries: 3,
    retryDelay: 1000
  },
  enableLogging: true
});

export const githubClient = new HttpClient({
  baseURL: 'https://api.github.com',
  timeout: 30000,
  retry: {
    maxRetries: 3,
    retryDelay: 1000
  },
  enableLogging: true
});
