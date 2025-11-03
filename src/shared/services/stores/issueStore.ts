/**
 * Issue Store
 * Unified issue management with support for both IndexedDB and Backend API
 */
import { create } from 'zustand';
import { api } from '../api';
import { useBackendIssues } from '../../config/featureFlags';
import type { 
  AuditIssue, 
  IssueUpdate,
  IssueComment,
  IssueSeverity,
  IssueCategory,
  IssueStatus
} from '../../types/api';

interface IssueState {
  issues: AuditIssue[];
  currentIssue: AuditIssue | null;
  loading: boolean;
  error: string | null;
  
  // Pagination
  total: number;
  page: number;
  pageSize: number;
  
  // Actions
  fetchIssues: (params?: {
    page?: number;
    page_size?: number;
    task_id?: number;
    severity?: string;
    category?: string;
    status?: string;
  }) => Promise<void>;
  fetchIssue: (id: number) => Promise<void>;
  updateIssue: (id: number, data: IssueUpdate) => Promise<AuditIssue>;
  addComment: (id: number, comment: IssueComment) => Promise<void>;
  bulkUpdateIssues: (issueIds: number[], data: IssueUpdate) => Promise<void>;
  setCurrentIssue: (issue: AuditIssue | null) => void;
  clearError: () => void;
}

/**
 * IndexedDB implementation (legacy)
 */
class IndexedDBIssueService {
  private dbName = 'xcodereviewer_local';
  private storeName = 'audit_issues';

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAll(filters?: {
    task_id?: number;
    severity?: string;
    category?: string;
    status?: string;
  }): Promise<AuditIssue[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => {
        let results = request.result;
        
        // Apply filters
        if (filters?.task_id) {
          results = results.filter((i: AuditIssue) => i.task_id === filters.task_id);
        }
        if (filters?.severity) {
          results = results.filter((i: AuditIssue) => i.severity === filters.severity);
        }
        if (filters?.category) {
          results = results.filter((i: AuditIssue) => i.category === filters.category);
        }
        if (filters?.status) {
          results = results.filter((i: AuditIssue) => i.status === filters.status);
        }
        
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async getById(id: number): Promise<AuditIssue | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async update(id: number, data: Partial<AuditIssue>): Promise<AuditIssue> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Issue not found');
    }

    const updated: AuditIssue = {
      ...existing,
      ...data,
      updated_at: new Date().toISOString(),
    };

    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(updated);
      
      request.onsuccess = () => resolve(updated);
      request.onerror = () => reject(request.error);
    });
  }

  async bulkUpdate(issueIds: number[], data: Partial<AuditIssue>): Promise<void> {
    const db = await this.getDB();
    const transaction = db.transaction([this.storeName], 'readwrite');
    const store = transaction.objectStore(this.storeName);

    for (const id of issueIds) {
      const getRequest = store.get(id);
      await new Promise((resolve, reject) => {
        getRequest.onsuccess = () => {
          const issue = getRequest.result;
          if (issue) {
            const updated = { ...issue, ...data, updated_at: new Date().toISOString() };
            store.put(updated);
          }
          resolve(undefined);
        };
        getRequest.onerror = () => reject(getRequest.error);
      });
    }
  }
}

const indexedDBService = new IndexedDBIssueService();

/**
 * Issue Store with dual backend support
 */
export const useIssueStore = create<IssueState>((set, get) => ({
  issues: [],
  currentIssue: null,
  loading: false,
  error: null,
  total: 0,
  page: 1,
  pageSize: 20,

  fetchIssues: async (params) => {
    set({ loading: true, error: null });
    try {
      if (useBackendIssues()) {
        // Use backend API
        const response = await api.issues.list(params);
        set({ 
          issues: response.items,
          total: response.total,
          page: response.page,
          pageSize: response.page_size,
          loading: false 
        });
      } else {
        // Use IndexedDB
        const issues = await indexedDBService.getAll({
          task_id: params?.task_id,
          severity: params?.severity,
          category: params?.category,
          status: params?.status,
        });
        
        // Simple pagination for IndexedDB
        const page = params?.page || 1;
        const pageSize = params?.page_size || 20;
        const start = (page - 1) * pageSize;
        const end = start + pageSize;
        const paginatedIssues = issues.slice(start, end);
        
        set({ 
          issues: paginatedIssues,
          total: issues.length,
          page,
          pageSize,
          loading: false 
        });
      }
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch issues', 
        loading: false 
      });
    }
  },

  fetchIssue: async (id) => {
    set({ loading: true, error: null });
    try {
      if (useBackendIssues()) {
        // Use backend API
        const issue = await api.issues.get(id);
        set({ currentIssue: issue, loading: false });
      } else {
        // Use IndexedDB
        const issue = await indexedDBService.getById(id);
        set({ currentIssue: issue, loading: false });
      }
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch issue', 
        loading: false 
      });
    }
  },

  updateIssue: async (id, data) => {
    set({ loading: true, error: null });
    try {
      let issue: AuditIssue;
      
      if (useBackendIssues()) {
        // Use backend API
        issue = await api.issues.update(id, data);
      } else {
        // Use IndexedDB
        issue = await indexedDBService.update(id, data);
      }

      // Update in state
      set(state => ({
        issues: state.issues.map(i => i.id === id ? issue : i),
        currentIssue: state.currentIssue?.id === id ? issue : state.currentIssue,
        loading: false
      }));

      return issue;
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to update issue', 
        loading: false 
      });
      throw error;
    }
  },

  addComment: async (id, comment) => {
    set({ loading: true, error: null });
    try {
      if (useBackendIssues()) {
        // Use backend API
        await api.issues.addComment(id, comment);
        
        // Refresh issue to get updated comments
        await get().fetchIssue(id);
      } else {
        // IndexedDB doesn't support comments in the current schema
        console.warn('Comments not supported in IndexedDB mode');
        set({ loading: false });
      }
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to add comment', 
        loading: false 
      });
      throw error;
    }
  },

  bulkUpdateIssues: async (issueIds, data) => {
    set({ loading: true, error: null });
    try {
      if (useBackendIssues()) {
        // Use backend API
        await api.issues.bulkUpdate(issueIds, data);
      } else {
        // Use IndexedDB
        await indexedDBService.bulkUpdate(issueIds, data);
      }

      // Refresh issues list
      await get().fetchIssues({ page: get().page, page_size: get().pageSize });
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to bulk update issues', 
        loading: false 
      });
      throw error;
    }
  },

  setCurrentIssue: (issue) => {
    set({ currentIssue: issue });
  },

  clearError: () => {
    set({ error: null });
  },
}));
