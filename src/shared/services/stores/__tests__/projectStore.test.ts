/**
 * Project Store Tests
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useProjectStore } from '../projectStore';
import { api } from '../../api';
import { featureFlags } from '../../../config/featureFlags';

// Mock API
vi.mock('../../api', () => ({
  api: {
    projects: {
      list: vi.fn(),
      get: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Mock feature flags
vi.mock('../../../config/featureFlags', () => ({
  featureFlags: {
    isEnabled: vi.fn(),
  },
  useBackendProjects: vi.fn(() => true),
}));

describe('ProjectStore', () => {
  beforeEach(() => {
    // Reset store state
    useProjectStore.setState({
      projects: [],
      currentProject: null,
      loading: false,
      error: null,
    });

    // Clear all mocks
    vi.clearAllMocks();
  });

  describe('fetchProjects', () => {
    it('should fetch projects from backend API', async () => {
      const mockProjects = [
        { id: 1, name: 'Project 1', source_type: 'github' },
        { id: 2, name: 'Project 2', source_type: 'gitlab' },
      ];

      (api.projects.list as any).mockResolvedValue({
        items: mockProjects,
        total: 2,
        page: 1,
        page_size: 10,
      });

      await useProjectStore.getState().fetchProjects();

      expect(api.projects.list).toHaveBeenCalled();
      expect(useProjectStore.getState().projects).toEqual(mockProjects);
      expect(useProjectStore.getState().loading).toBe(false);
      expect(useProjectStore.getState().error).toBeNull();
    });

    it('should handle fetch error', async () => {
      (api.projects.list as any).mockRejectedValue(new Error('Network error'));

      await useProjectStore.getState().fetchProjects();

      expect(useProjectStore.getState().projects).toEqual([]);
      expect(useProjectStore.getState().loading).toBe(false);
      expect(useProjectStore.getState().error).toBe('Network error');
    });
  });

  describe('createProject', () => {
    it('should create project via backend API', async () => {
      const newProject = {
        name: 'New Project',
        description: 'Test project',
        source_type: 'github' as const,
        source_url: 'https://github.com/test/repo',
      };

      const createdProject = {
        id: 1,
        ...newProject,
        owner_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        total_tasks: 0,
        total_issues: 0,
      };

      (api.projects.create as any).mockResolvedValue(createdProject);

      const result = await useProjectStore.getState().createProject(newProject);

      expect(api.projects.create).toHaveBeenCalledWith(newProject);
      expect(result).toEqual(createdProject);
      expect(useProjectStore.getState().projects).toContainEqual(createdProject);
    });

    it('should handle create error', async () => {
      const newProject = {
        name: 'New Project',
        source_type: 'github' as const,
      };

      (api.projects.create as any).mockRejectedValue(new Error('Create failed'));

      await expect(
        useProjectStore.getState().createProject(newProject)
      ).rejects.toThrow('Create failed');

      expect(useProjectStore.getState().error).toBe('Create failed');
    });
  });

  describe('updateProject', () => {
    it('should update project via backend API', async () => {
      const existingProject = {
        id: 1,
        name: 'Old Name',
        source_type: 'github' as const,
        owner_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        total_tasks: 0,
        total_issues: 0,
      };

      useProjectStore.setState({ projects: [existingProject] });

      const updates = { name: 'New Name' };
      const updatedProject = { ...existingProject, ...updates };

      (api.projects.update as any).mockResolvedValue(updatedProject);

      const result = await useProjectStore.getState().updateProject(1, updates);

      expect(api.projects.update).toHaveBeenCalledWith(1, updates);
      expect(result).toEqual(updatedProject);
      expect(useProjectStore.getState().projects[0].name).toBe('New Name');
    });
  });

  describe('deleteProject', () => {
    it('should delete project via backend API', async () => {
      const project = {
        id: 1,
        name: 'Project to Delete',
        source_type: 'github' as const,
        owner_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        total_tasks: 0,
        total_issues: 0,
      };

      useProjectStore.setState({ projects: [project] });

      (api.projects.delete as any).mockResolvedValue(undefined);

      await useProjectStore.getState().deleteProject(1);

      expect(api.projects.delete).toHaveBeenCalledWith(1);
      expect(useProjectStore.getState().projects).toHaveLength(0);
    });
  });

  describe('setCurrentProject', () => {
    it('should set current project', () => {
      const project = {
        id: 1,
        name: 'Current Project',
        source_type: 'github' as const,
        owner_id: 1,
        created_at: '2024-01-01T00:00:00Z',
        total_tasks: 0,
        total_issues: 0,
      };

      useProjectStore.getState().setCurrentProject(project);

      expect(useProjectStore.getState().currentProject).toEqual(project);
    });
  });

  describe('clearError', () => {
    it('should clear error', () => {
      useProjectStore.setState({ error: 'Some error' });

      useProjectStore.getState().clearError();

      expect(useProjectStore.getState().error).toBeNull();
    });
  });
});
