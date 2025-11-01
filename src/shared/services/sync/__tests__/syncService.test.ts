/**
 * Sync Service Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { syncService } from '../syncService';
import { api } from '../../api';

// Mock API
vi.mock('../../api', () => ({
  api: {
    projects: {
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    tasks: {
      create: vi.fn(),
      update: vi.fn(),
      cancel: vi.fn(),
    },
    issues: {
      update: vi.fn(),
    },
  },
}));

describe('SyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('queueOperation', () => {
    it('should queue an operation', async () => {
      await syncService.queueOperation({
        type: 'create',
        entity: 'project',
        data: { name: 'Test Project' },
      });

      const pending = await syncService.getPendingOperations();
      expect(pending.length).toBeGreaterThan(0);
      expect(pending[0].entity).toBe('project');
      expect(pending[0].type).toBe('create');
    });
  });

  describe('syncPendingOperations', () => {
    it('should sync pending operations', async () => {
      // Queue some operations
      await syncService.queueOperation({
        type: 'create',
        entity: 'project',
        data: { name: 'Test Project', source_type: 'github' },
      });

      (api.projects.create as any).mockResolvedValue({ id: 1, name: 'Test Project' });

      const result = await syncService.syncPendingOperations();

      expect(result.success).toBe(true);
      expect(result.synced).toBe(1);
      expect(result.failed).toBe(0);
      expect(api.projects.create).toHaveBeenCalled();
    });

    it('should handle sync errors', async () => {
      await syncService.queueOperation({
        type: 'create',
        entity: 'project',
        data: { name: 'Test Project' },
      });

      (api.projects.create as any).mockRejectedValue(new Error('Sync failed'));

      const result = await syncService.syncPendingOperations();

      // Should retry up to maxRetries times
      expect(result.synced).toBe(0);
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict with local strategy', () => {
      const localData = { id: 1, name: 'Local Name', updated_at: '2024-01-02' };
      const remoteData = { id: 1, name: 'Remote Name', updated_at: '2024-01-01' };

      const resolution = syncService.resolveConflict(localData, remoteData, 'local');

      expect(resolution.resolvedData).toEqual(localData);
    });

    it('should resolve conflict with remote strategy', () => {
      const localData = { id: 1, name: 'Local Name', updated_at: '2024-01-01' };
      const remoteData = { id: 1, name: 'Remote Name', updated_at: '2024-01-02' };

      const resolution = syncService.resolveConflict(localData, remoteData, 'remote');

      expect(resolution.resolvedData).toEqual(remoteData);
    });

    it('should resolve conflict with merge strategy', () => {
      const localData = { id: 1, name: 'Local Name', field1: 'local', updated_at: '2024-01-02' };
      const remoteData = { id: 1, name: 'Remote Name', field2: 'remote', updated_at: '2024-01-01' };

      const resolution = syncService.resolveConflict(localData, remoteData, 'merge');

      expect(resolution.resolvedData).toMatchObject({
        name: 'Remote Name', // Remote wins
        field1: 'local', // Local addition preserved
        field2: 'remote', // Remote addition preserved
        updated_at: '2024-01-02', // Newer timestamp preserved
      });
    });
  });

  describe('isOnline', () => {
    it('should check online status', () => {
      const online = syncService.isOnline();
      expect(typeof online).toBe('boolean');
    });
  });

  describe('getSyncStatus', () => {
    it('should get sync status', async () => {
      const status = await syncService.getSyncStatus();

      expect(status).toHaveProperty('pendingOperations');
      expect(status).toHaveProperty('online');
      expect(typeof status.pendingOperations).toBe('number');
      expect(typeof status.online).toBe('boolean');
    });
  });

  afterEach(async () => {
    // Clean up pending operations
    await syncService.clearPendingOperations();
  });
});
