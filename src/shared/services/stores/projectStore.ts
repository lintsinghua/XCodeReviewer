/**
 * Project Store
 * Unified project management with support for both IndexedDB and Backend API
 */
import { create } from 'zustand';
import { api } from '../api';
import { useBackendProjects } from '../../config/featureFlags';
import type { Project, ProjectCreate, ProjectUpdate, PaginatedResponse } from '../../types/api';

interface ProjectState {
  projects: Project[];
  currentProject: Project | null;
  loading: boolean;
  error: string | null;
  
  // Actions
  fetchProjects: (params?: { page?: number; page_size?: number; search?: string }) => Promise<void>;
  fetchProject: (id: number) => Promise<void>;
  createProject: (data: ProjectCreate) => Promise<Project>;
  updateProject: (id: number, data: ProjectUpdate) => Promise<Project>;
  deleteProject: (id: number) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
  clearError: () => void;
}

/**
 * IndexedDB implementation (legacy)
 */
class IndexedDBProjectService {
  private dbName = 'xcodereviewer_local';
  private storeName = 'projects';

  private async getDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
    });
  }

  async getAll(): Promise<Project[]> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.getAll();
      
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getById(id: number): Promise<Project | null> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(id);
      
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  async create(data: ProjectCreate): Promise<Project> {
    const db = await this.getDB();
    const project: Project = {
      id: Date.now(), // Simple ID generation
      ...data,
      owner_id: 1, // Default user ID
      created_at: new Date().toISOString(),
      total_tasks: 0,
      total_issues: 0,
    };

    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.add(project);
      
      request.onsuccess = () => resolve(project);
      request.onerror = () => reject(request.error);
    });
  }

  async update(id: number, data: ProjectUpdate): Promise<Project> {
    const existing = await this.getById(id);
    if (!existing) {
      throw new Error('Project not found');
    }

    const updated: Project = {
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

  async delete(id: number): Promise<void> {
    const db = await this.getDB();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(id);
      
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

const indexedDBService = new IndexedDBProjectService();

/**
 * Project Store with dual backend support
 */
export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  loading: false,
  error: null,

  fetchProjects: async (params) => {
    set({ loading: true, error: null });
    try {
      if (useBackendProjects()) {
        // Use backend API
        const response = await api.projects.list(params);
        set({ projects: response.items, loading: false });
      } else {
        // Use IndexedDB
        const projects = await indexedDBService.getAll();
        set({ projects, loading: false });
      }
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch projects', 
        loading: false 
      });
    }
  },

  fetchProject: async (id) => {
    set({ loading: true, error: null });
    try {
      if (useBackendProjects()) {
        // Use backend API
        const project = await api.projects.get(id);
        set({ currentProject: project, loading: false });
      } else {
        // Use IndexedDB
        const project = await indexedDBService.getById(id);
        set({ currentProject: project, loading: false });
      }
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to fetch project', 
        loading: false 
      });
    }
  },

  createProject: async (data) => {
    set({ loading: true, error: null });
    try {
      let project: Project;
      
      if (useBackendProjects()) {
        // Use backend API with optimistic update
        project = await api.projects.create(data);
      } else {
        // Use IndexedDB
        project = await indexedDBService.create(data);
      }

      // Optimistic update
      set(state => ({
        projects: [...state.projects, project],
        loading: false
      }));

      return project;
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to create project', 
        loading: false 
      });
      throw error;
    }
  },

  updateProject: async (id, data) => {
    set({ loading: true, error: null });
    try {
      let project: Project;
      
      if (useBackendProjects()) {
        // Use backend API
        project = await api.projects.update(id, data);
      } else {
        // Use IndexedDB
        project = await indexedDBService.update(id, data);
      }

      // Update in state
      set(state => ({
        projects: state.projects.map(p => p.id === id ? project : p),
        currentProject: state.currentProject?.id === id ? project : state.currentProject,
        loading: false
      }));

      return project;
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to update project', 
        loading: false 
      });
      throw error;
    }
  },

  deleteProject: async (id) => {
    set({ loading: true, error: null });
    try {
      if (useBackendProjects()) {
        // Use backend API
        await api.projects.delete(id);
      } else {
        // Use IndexedDB
        await indexedDBService.delete(id);
      }

      // Remove from state
      set(state => ({
        projects: state.projects.filter(p => p.id !== id),
        currentProject: state.currentProject?.id === id ? null : state.currentProject,
        loading: false
      }));
    } catch (error: any) {
      set({ 
        error: error.message || 'Failed to delete project', 
        loading: false 
      });
      throw error;
    }
  },

  setCurrentProject: (project) => {
    set({ currentProject: project });
  },

  clearError: () => {
    set({ error: null });
  },
}));
