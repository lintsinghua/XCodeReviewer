/**
 * API Client Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { APIClient } from '../client';
import axios from 'axios';

// Mock axios
vi.mock('axios');
const mockedAxios = axios as any;

describe('APIClient', () => {
  let client: APIClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Setup mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        request: { use: vi.fn() },
        response: { use: vi.fn() },
      },
    };

    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    // Clear localStorage
    localStorage.clear();

    // Create client instance
    client = new APIClient('http://test-api.com');
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Token Management', () => {
    it('should load tokens from localStorage on initialization', () => {
      localStorage.setItem('access_token', 'test-access-token');
      localStorage.setItem('refresh_token', 'test-refresh-token');

      const newClient = new APIClient();
      expect(newClient.isAuthenticated()).toBe(true);
    });

    it('should save tokens to localStorage', () => {
      client.setTokens('new-access-token', 'new-refresh-token');

      expect(localStorage.getItem('access_token')).toBe('new-access-token');
      expect(localStorage.getItem('refresh_token')).toBe('new-refresh-token');
      expect(client.isAuthenticated()).toBe(true);
    });

    it('should clear tokens from localStorage', () => {
      client.setTokens('access-token', 'refresh-token');
      client.clearTokens();

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(localStorage.getItem('refresh_token')).toBeNull();
      expect(client.isAuthenticated()).toBe(false);
    });
  });

  describe('HTTP Methods', () => {
    it('should make GET request', async () => {
      const mockData = { id: 1, name: 'Test' };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.get('/test');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/test', undefined);
      expect(result).toEqual(mockData);
    });

    it('should make POST request', async () => {
      const mockData = { id: 1, name: 'Test' };
      const postData = { name: 'Test' };
      mockAxiosInstance.post.mockResolvedValue({ data: mockData });

      const result = await client.post('/test', postData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/test', postData, undefined);
      expect(result).toEqual(mockData);
    });

    it('should make PUT request', async () => {
      const mockData = { id: 1, name: 'Updated' };
      const putData = { name: 'Updated' };
      mockAxiosInstance.put.mockResolvedValue({ data: mockData });

      const result = await client.put('/test/1', putData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith('/test/1', putData, undefined);
      expect(result).toEqual(mockData);
    });

    it('should make PATCH request', async () => {
      const mockData = { id: 1, name: 'Patched' };
      const patchData = { name: 'Patched' };
      mockAxiosInstance.patch.mockResolvedValue({ data: mockData });

      const result = await client.patch('/test/1', patchData);

      expect(mockAxiosInstance.patch).toHaveBeenCalledWith('/test/1', patchData, undefined);
      expect(result).toEqual(mockData);
    });

    it('should make DELETE request', async () => {
      mockAxiosInstance.delete.mockResolvedValue({ data: {} });

      const result = await client.delete('/test/1');

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith('/test/1', undefined);
      expect(result).toEqual({});
    });
  });

  describe('Error Handling', () => {
    it('should handle server error response', async () => {
      const errorResponse = {
        response: {
          status: 400,
          data: {
            message: 'Bad Request',
            detail: 'Invalid input',
          },
        },
      };

      mockAxiosInstance.get.mockRejectedValue(errorResponse);

      await expect(client.get('/test')).rejects.toMatchObject({
        message: 'Bad Request',
        detail: 'Invalid input',
        status: 400,
      });
    });

    it('should handle network error', async () => {
      const networkError = {
        request: {},
        message: 'Network Error',
      };

      mockAxiosInstance.get.mockRejectedValue(networkError);

      await expect(client.get('/test')).rejects.toMatchObject({
        message: 'No response from server',
      });
    });

    it('should handle request setup error', async () => {
      const setupError = {
        message: 'Request failed',
      };

      mockAxiosInstance.get.mockRejectedValue(setupError);

      await expect(client.get('/test')).rejects.toMatchObject({
        message: 'Request failed',
      });
    });
  });

  describe('File Upload', () => {
    it('should upload file with progress tracking', async () => {
      const mockFile = new File(['test'], 'test.txt', { type: 'text/plain' });
      const mockResponse = { data: { id: 1, filename: 'test.txt' } };
      const onProgress = vi.fn();

      mockAxiosInstance.post.mockImplementation((url, data, config) => {
        // Simulate progress
        if (config.onUploadProgress) {
          config.onUploadProgress({ loaded: 50, total: 100 });
          config.onUploadProgress({ loaded: 100, total: 100 });
        }
        return Promise.resolve(mockResponse);
      });

      const result = await client.upload('/upload', mockFile, onProgress);

      expect(mockAxiosInstance.post).toHaveBeenCalled();
      expect(onProgress).toHaveBeenCalledWith(50);
      expect(onProgress).toHaveBeenCalledWith(100);
      expect(result).toEqual(mockResponse.data);
    });
  });

  describe('File Download', () => {
    it('should download file', async () => {
      const mockBlob = new Blob(['test content']);
      mockAxiosInstance.get.mockResolvedValue({ data: mockBlob });

      // Mock DOM methods
      const createElementSpy = vi.spyOn(document, 'createElement');
      const appendChildSpy = vi.spyOn(document.body, 'appendChild').mockImplementation(() => null as any);
      const removeChildSpy = vi.spyOn(document.body, 'removeChild').mockImplementation(() => null as any);
      
      const mockLink = {
        href: '',
        download: '',
        click: vi.fn(),
      };
      createElementSpy.mockReturnValue(mockLink as any);

      await client.download('/download/1', 'test.txt');

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/download/1', {
        responseType: 'blob',
      });
      expect(mockLink.download).toBe('test.txt');
      expect(mockLink.click).toHaveBeenCalled();

      createElementSpy.mockRestore();
      appendChildSpy.mockRestore();
      removeChildSpy.mockRestore();
    });
  });
});
