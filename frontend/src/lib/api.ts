/**
 * API Client for AWS Inventory Dashboard
 * Enterprise-grade error handling, retry logic, and timeout management
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import { InventoryResponse, ServiceType, AWSResource } from '@/types';
import { getIdToken } from './auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

if (!API_URL) {
  console.warn('API URL not configured. Set NEXT_PUBLIC_API_URL');
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second
const RETRYABLE_STATUS_CODES = [408, 429, 500, 502, 503, 504];

// Cache configuration
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_MAX_SIZE = 100; // Maximum number of cached responses

interface CacheEntry {
  data: any;
  timestamp: number;
  key: string;
}

class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();

  private generateKey(url: string, params: any): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return `${url}?${sortedParams}`;
  }

  get(url: string, params: any): any | null {
    const key = this.generateKey(url, params);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if cache is expired
    if (Date.now() - entry.timestamp > CACHE_TTL) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  set(url: string, params: any, data: any): void {
    const key = this.generateKey(url, params);

    // Remove oldest entry if cache is full
    if (this.cache.size >= CACHE_MAX_SIZE) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      key,
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

// Custom error class for better error handling
export class APIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public code?: string,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

class InventoryAPI {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    // Add request interceptor to inject auth token
    this.client.interceptors.request.use(
      async (config) => {
        try {
          const token = await getIdToken();
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          } else if (typeof window !== 'undefined') {
            // No token available - might need to redirect to login
            console.warn('No authentication token available');
          }
        } catch (error) {
          console.error('Failed to get auth token:', error);
          // Don't block the request, let the backend handle auth
        }
        return config;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error: AxiosError) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Handle errors with retry logic and proper error formatting
   */
  private handleError(error: any): APIError {
    // Network errors
    if (!error.response) {
      if (error.code === 'ECONNABORTED') {
        return new APIError(
          'Request timeout. Please try again or check your connection.',
          408,
          'TIMEOUT'
        );
      }
      if (error.message === 'Network Error') {
        return new APIError(
          'Network error. Please check your internet connection.',
          0,
          'NETWORK_ERROR'
        );
      }
      return new APIError(
        'Unable to connect to server. Please try again later.',
        0,
        'CONNECTION_ERROR',
        error.message
      );
    }

    const status = error.response.status;
    const data = error.response.data;

    // Authentication errors
    if (status === 401) {
      if (typeof window !== 'undefined') {
        // Clear session and redirect
        localStorage.removeItem('aws-inventory-session');
        setTimeout(() => {
          window.location.href = '/';
        }, 1000);
      }
      return new APIError(
        'Your session has expired. Please log in again.',
        401,
        'UNAUTHORIZED'
      );
    }

    // Authorization errors
    if (status === 403) {
      return new APIError(
        data?.message || 'You do not have permission to access this resource.',
        403,
        'FORBIDDEN',
        data
      );
    }

    // Not found errors
    if (status === 404) {
      return new APIError(
        data?.message || 'The requested resource was not found.',
        404,
        'NOT_FOUND',
        data
      );
    }

    // Server errors
    if (status >= 500) {
      return new APIError(
        data?.message || 'Server error. Please try again later.',
        status,
        'SERVER_ERROR',
        data
      );
    }

    // Validation errors
    if (status === 400) {
      return new APIError(
        data?.message || 'Invalid request. Please check your input.',
        400,
        'VALIDATION_ERROR',
        data
      );
    }

    // Rate limiting
    if (status === 429) {
      return new APIError(
        'Too many requests. Please wait a moment and try again.',
        429,
        'RATE_LIMIT',
        data
      );
    }

    // Generic error
    return new APIError(
      data?.message || 'An unexpected error occurred.',
      status,
      'UNKNOWN_ERROR',
      data
    );
  }

  /**
   * Retry logic for failed requests
   */
  private async retryRequest<T>(
    requestFn: () => Promise<T>,
    retries = MAX_RETRIES
  ): Promise<T> {
    try {
      return await requestFn();
    } catch (error: any) {
      if (retries > 0 && this.isRetryableError(error)) {
        await this.delay(RETRY_DELAY * (MAX_RETRIES - retries + 1));
        return this.retryRequest(requestFn, retries - 1);
      }
      throw error;
    }
  }

  private isRetryableError(error: any): boolean {
    if (!error.statusCode) return false;
    return RETRYABLE_STATUS_CODES.includes(error.statusCode);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get inventory for a service (with caching)
   */
  async getInventory<T extends AWSResource = AWSResource>(
    service: ServiceType,
    options: {
      page?: number;
      size?: number;
      search?: string;
      accounts?: string[];
      regions?: string[];
      accountId?: string;
      region?: string;
      useCache?: boolean; // Allow disabling cache for real-time data
    } = {}
  ): Promise<InventoryResponse<T>> {
    const params: Record<string, string> = {
      service,
      page: String(options.page || 1),
      size: String(options.size || 50)
    };

    if (options.search) {
      params.search = options.search;
    }

    if (options.accounts && options.accounts.length > 0) {
      params.accounts = options.accounts.join(',');
    }

    if (options.regions && options.regions.length > 0) {
      params.regions = options.regions.join(',');
    }

    if (options.accountId) {
      params.accountId = options.accountId;
    }

    if (options.region) {
      params.region = options.region;
    }

    // Check cache first (unless disabled)
    if (options.useCache !== false) {
      const cached = responseCache.get('/inventory', params);
      if (cached) {
        return cached as InventoryResponse<T>;
      }
    }

    return this.retryRequest(async () => {
      const response = await this.client.get<InventoryResponse<T>>('/inventory', { params });
      // Cache the response
      if (options.useCache !== false) {
        responseCache.set('/inventory', params, response.data);
      }
      return response.data;
    });
  }

  /**
   * Get resource details
   */
  async getResourceDetails(
    service: ServiceType,
    resourceId: string,
    accountId?: string,
    region?: string
  ): Promise<AWSResource> {
    const params: Record<string, string> = {
      service,
      resourceId
    };

    if (accountId) {
      params.accountId = accountId;
    }

    if (region) {
      params.region = region;
    }

    return this.retryRequest(async () => {
      const response = await this.client.get<AWSResource>('/inventory/details', { params });
      return response.data;
    });
  }

  /**
   * Export inventory as CSV
   */
  async exportCSV(
    service: ServiceType,
    options: {
      accounts?: string[];
      regions?: string[];
      search?: string;
    } = {}
  ): Promise<Blob> {
    const params: Record<string, string> = {
      service,
      format: 'csv'
    };

    if (options.accounts && options.accounts.length > 0) {
      params.accounts = options.accounts.join(',');
    }

    if (options.regions && options.regions.length > 0) {
      params.regions = options.regions.join(',');
    }

    if (options.search) {
      params.search = options.search;
    }

    return this.retryRequest(async () => {
      const response = await this.client.get('/inventory/export', {
        params,
        responseType: 'blob'
      });
      return response.data;
    });
  }

  /**
   * Export inventory as JSON
   */
  async exportJSON(
    service: ServiceType,
    options: {
      accounts?: string[];
      regions?: string[];
      search?: string;
    } = {}
  ): Promise<InventoryResponse> {
    const params: Record<string, string> = {
      service,
      format: 'json'
    };

    if (options.accounts && options.accounts.length > 0) {
      params.accounts = options.accounts.join(',');
    }

    if (options.regions && options.regions.length > 0) {
      params.regions = options.regions.join(',');
    }

    if (options.search) {
      params.search = options.search;
    }

    return this.retryRequest(async () => {
      const response = await this.client.get<InventoryResponse>('/inventory/export', { params });
      return response.data;
    });
  }

  /**
   * Get available accounts (for multi-account setup)
   */
  async getAccounts(): Promise<Array<{ accountId: string; accountName: string }>> {
    return this.retryRequest(async () => {
      const response = await this.client.get<{ accounts: Array<{ accountId: string; accountName: string }> }>('/accounts');
      return response.data.accounts || [];
    });
  }

  /**
   * Get summary statistics (with caching)
   */
  async getSummary(
    service?: ServiceType,
    accounts?: string[],
    regions?: string[],
    useCache: boolean = true
  ): Promise<{
    total: number;
    running?: number;
    stopped?: number;
    errors?: number;
    securityIssues?: number;
  }> {
    const params: Record<string, string> = {};

    if (service) {
      params.service = service;
    }

    if (accounts && accounts.length > 0) {
      params.accounts = accounts.join(',');
    }

    if (regions && regions.length > 0) {
      params.regions = regions.join(',');
    }

    // Check cache first
    if (useCache) {
      const cached = responseCache.get('/inventory/summary', params);
      if (cached) {
        return cached;
      }
    }

    return this.retryRequest(async () => {
      const response = await this.client.get('/inventory/summary', { params });
      // Cache the response
      if (useCache) {
        responseCache.set('/inventory/summary', params, response.data);
      }
      return response.data;
    });
  }

  /**
   * Clear API cache (useful for refreshing data)
   */
  clearCache(pattern?: string): void {
    responseCache.invalidate(pattern);
  }
}

export const api = new InventoryAPI();

