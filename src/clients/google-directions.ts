import axios, { type AxiosInstance } from 'axios';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export class GoogleDirectionsClient {
  private baseURL = 'https://maps.googleapis.com/maps/api/directions';
  private apiKey: string;
  private client: AxiosInstance;

  constructor() {
    this.apiKey = config.google.apiKey;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 15000,
      headers: {
        'User-Agent': 'NUSNextBus-Gateway/1.0',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug({ url: config.url, method: config.method }, 'Google Directions API request');
        return config;
      },
      (error) => {
        logger.error({ err: error }, 'Google Directions request error');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          { url: response.config.url, status: response.status },
          'Google Directions API response'
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
            'Google Directions API error response'
          );
        } else {
          logger.error({ err: error }, 'Google Directions API network error');
        }
        return Promise.reject(error);
      }
    );
  }

  async getDirections(params: {
    origin: string;
    destination: string;
    mode?: string;
    departure_time?: string;
    arrival_time?: string;
    alternatives?: boolean;
    avoid?: string;
    units?: string;
    region?: string;
    language?: string;
  }): Promise<any> {
    const response = await this.client.get('/json', {
      params: {
        ...params,
        key: this.apiKey,
      },
    });
    return response.data;
  }
}

export const googleDirectionsClient = new GoogleDirectionsClient();
