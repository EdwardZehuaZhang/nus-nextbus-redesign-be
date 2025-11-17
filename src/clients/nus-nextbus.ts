import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export class NUSNextBusClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.nusNextBus.apiUrl,
      timeout: 10000,
      auth: {
        username: config.nusNextBus.username,
        password: config.nusNextBus.password,
      },
      headers: {
        'User-Agent': 'NUSNextBus-Gateway/1.0',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug({ url: config.url, method: config.method }, 'NUS NextBus API request');
        return config;
      },
      (error) => {
        logger.error({ err: error }, 'NUS NextBus request error');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          { url: response.config.url, status: response.status },
          'NUS NextBus API response'
        );
        return response;
      },
      (error) => {
        if (error.response) {
          logger.error(
            {
              url: error.config?.url,
              status: error.response.status,
              data: error.response.data,
            },
            'NUS NextBus API error response'
          );
        } else if (error.request) {
          logger.error({ err: error }, 'NUS NextBus API no response');
        } else {
          logger.error({ err: error }, 'NUS NextBus API request setup error');
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(path, config);
    return response.data;
  }

  async post<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(path, data, config);
    return response.data;
  }
}

export const nusNextBusClient = new NUSNextBusClient();
