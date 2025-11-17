import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export class LTAClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: config.lta.apiUrl,
      timeout: 10000,
      headers: {
        AccountKey: config.lta.apiKey,
        'User-Agent': 'NUSNextBus-Gateway/1.0',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug({ url: config.url, method: config.method }, 'LTA API request');
        return config;
      },
      (error) => {
        logger.error({ err: error }, 'LTA request error');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          { url: response.config.url, status: response.status },
          'LTA API response'
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
            'LTA API error response'
          );
        } else if (error.request) {
          logger.error({ err: error }, 'LTA API no response');
        } else {
          logger.error({ err: error }, 'LTA API request setup error');
        }
        return Promise.reject(error);
      }
    );
  }

  async get<T>(path: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(path, config);
    return response.data;
  }
}

export const ltaClient = new LTAClient();
