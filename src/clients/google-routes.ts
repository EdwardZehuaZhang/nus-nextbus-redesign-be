import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export class GoogleRoutesClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: 'https://routes.googleapis.com',
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': config.google.apiKey,
        'User-Agent': 'NUSNextBus-Gateway/1.0',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug({ url: config.url, method: config.method }, 'Google Routes API request');
        return config;
      },
      (error) => {
        logger.error({ err: error }, 'Google Routes request error');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          { url: response.config.url, status: response.status },
          'Google Routes API response'
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
            'Google Routes API error response'
          );
        } else if (error.request) {
          logger.error({ err: error }, 'Google Routes API no response');
        } else {
          logger.error({ err: error }, 'Google Routes API request setup error');
        }
        return Promise.reject(error);
      }
    );
  }

  async post<T>(path: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(path, data, config);
    return response.data;
  }
}

export const googleRoutesClient = new GoogleRoutesClient();
