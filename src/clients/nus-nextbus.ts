import https from 'node:https';
import tls from 'node:tls';
import type { Duplex } from 'node:stream';
import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios';
import { config } from '@/config/index.js';
import { logger } from '@/utils/logger.js';

/**
 * HTTPS agent that keeps full TLS checks, except it also accepts a pinned
 * leaf certificate whose only fault is that it has expired. The socket is
 * handed to the request only after this check, so no credentials are sent
 * over a connection that fails it.
 */
class PinnedExpiredCertAgent extends https.Agent {
  constructor(private readonly pins: string[]) {
    super({ keepAlive: true });
  }

  override createConnection(
    options: tls.ConnectionOptions,
    callback?: (err: Error | null, socket: Duplex) => void
  ): Duplex | undefined {
    const socket = tls.connect({ ...options, rejectUnauthorized: false });
    const host = options.servername || options.host || '';
    let done = false;
    const finish = (err: Error | null) => {
      if (done) return;
      done = true;
      socket.off('error', finish);
      callback?.(err, socket);
    };

    socket.once('secureConnect', () => {
      if (socket.authorized) {
        finish(null);
        return;
      }

      const cert = socket.getPeerCertificate();
      const allowed =
        socket.authorizationError?.toString() === 'CERT_HAS_EXPIRED' &&
        this.pins.includes(cert.fingerprint256?.toUpperCase()) &&
        tls.checkServerIdentity(host, cert) === undefined;

      if (!allowed) {
        const err = new Error(`TLS verification failed for ${host}: ${socket.authorizationError}`);
        finish(err);
        socket.destroy();
        return;
      }

      logger.warn({ host, validTo: cert.valid_to }, 'NUS NextBus: accepting pinned expired certificate');
      finish(null);
    });
    socket.on('error', finish);

    return undefined;
  }
}

export class NUSNextBusClient {
  private client: AxiosInstance;

  constructor() {
    const pins = config.nusNextBus.pinnedExpiredCerts;

    this.client = axios.create({
      baseURL: config.nusNextBus.apiUrl,
      timeout: 10000,
      httpsAgent: pins.length > 0 ? new PinnedExpiredCertAgent([...pins]) : undefined,
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
