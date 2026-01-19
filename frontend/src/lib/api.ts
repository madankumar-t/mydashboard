/**
 * API Client for AWS Inventory Dashboard
 */

import axios, { AxiosInstance, AxiosError } from 'axios';
import { InventoryResponse, ServiceType, AWSResource } from '@/types';
import { getIdToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/* -------------------- Cache config -------------------- */

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 100;

interface CacheEntry {
  data: any;
  timestamp: number;
}

/* -------------------- Response Cache -------------------- */

class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();

  private generateKey(url: string, params: Record<string, string>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(k => `${k}=${params[k]}`)
      .join('&');
    return `${url}?${sortedParams}`;
  }

  get(url: string, params: Record<string, string>): any | null {
    const key = this.generateKey(url, params);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(url: string, params: Record<string, string>, data: any): void {
    const key = this.generateKey(url, params);

    // ✅ SAFE eviction (fixes string | undefined error)
    if (this.cache.size >= CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  clear(): void {
    this.cache.clear();
  }

  invalidate(pattern?: string): void {
    if (!pattern) {
      this.clear();
      return;
    }

    for (const [key] of this.cache) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

const responseCache = new ResponseCache();

/* -------------------- API Client -------------------- */

class InventoryAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Inject auth token
    this.client.interceptors.request.use(async config => {
      try {
        const token = await getIdToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      } catch {
        // ignore auth errors here
      }
      return config;
    });
  }

  /* -------------------- Inventory -------------------- */

  async getInventory<T extends AWSResource = AWSResource>(
    service: ServiceType,
    options: {
      page?: number;
      size?: number;
      search?: string;
      accounts?: string[];
      regions?: string[];
      useCache?: boolean;
    } = {}
  ): Promise<InventoryResponse<T>> {
    const params: Record<string, string> = {
      service,
      page: String(options.page ?? 1),
      size: String(options.size ?? 50),
    };

    if (options.search) params.search = options.search;
    if (options.accounts?.length) params.accounts = options.accounts.join(',');
    if (options.regions?.length) params.regions = options.regions.join(',');

    if (options.useCache !== false) {
      const cached = responseCache.get('/inventory', params);
      if (cached) return cached;
    }

    const res = await this.client.get<InventoryResponse<T>>('/inventory', {
      params,
    });

    if (options.useCache !== false) {
      responseCache.set('/inventory', params, res.data);
    }

    return res.data;
  }

  /* -------------------- Accounts -------------------- */

  async getAccounts(): Promise<
    Array<{ accountId: string; accountName: string }>
  > {
    const res = await this.client.get<{
      accounts: Array<{ accountId: string; accountName: string }>;
    }>('/accounts');

    return res.data.accounts || [];
  }

  /* -------------------- Summary -------------------- */

  async getSummary(
    service?: ServiceType,
    accounts?: string[],
    regions?: string[]
  ): Promise<{
    total: number;
    running?: number;
    stopped?: number;
    errors?: number;
    securityIssues?: number;
  }> {
    const params: Record<string, string> = {};

    if (service) params.service = service;
    if (accounts?.length) params.accounts = accounts.join(',');
    if (regions?.length) params.regions = regions.join(',');

    const cached = responseCache.get('/inventory/summary', params);
    if (cached) return cached;

    const res = await this.client.get('/inventory/summary', { params });
    responseCache.set('/inventory/summary', params, res.data);
    return res.data;
  }

  /* -------------------- Cache control -------------------- */

  clearCache(pattern?: string): void {
    responseCache.invalidate(pattern);
  }
}

/* -------------------- EXPORT (IMPORTANT) -------------------- */

export const api = new InventoryAPI();
