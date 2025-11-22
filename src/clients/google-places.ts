import axios, { type AxiosInstance } from 'axios';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

export class GooglePlacesClient {
  private baseURL = 'https://maps.googleapis.com/maps/api/place';
  private apiKey: string;
  private client: AxiosInstance;

  constructor() {
    this.apiKey = config.google.apiKey;
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'User-Agent': 'NUSNextBus-Gateway/1.0',
      },
    });

    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        logger.debug({ url: config.url, method: config.method }, 'Google Places API request');
        return config;
      },
      (error) => {
        logger.error({ err: error }, 'Google Places request error');
        return Promise.reject(error);
      }
    );

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        logger.debug(
          { url: response.config.url, status: response.status },
          'Google Places API response'
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
            'Google Places API error response'
          );
        } else {
          logger.error({ err: error }, 'Google Places API network error');
        }
        return Promise.reject(error);
      }
    );
  }

  async autocomplete(params: {
    input: string;
    sessiontoken?: string;
    location?: string;
    radius?: number;
  }): Promise<any> {
    const response = await this.client.get('/autocomplete/json', {
      params: {
        ...params,
        key: this.apiKey,
      },
    });
    return response.data;
  }

  async details(params: {
    place_id: string;
    fields?: string;
  }): Promise<any> {
    const response = await this.client.get('/details/json', {
      params: {
        place_id: params.place_id,
        fields: params.fields || 'geometry,name,formatted_address,place_id',
        key: this.apiKey,
      },
    });
    return response.data;
  }
}

export const googlePlacesClient = new GooglePlacesClient();
