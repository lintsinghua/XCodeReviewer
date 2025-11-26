import type { CodeAnalysisResult } from "@/shared/types";
import { apiClient } from "@/shared/api/serverClient";
import { SUPPORTED_LANGUAGES } from '@/shared/constants';

export class CodeAnalysisEngine {
  static getSupportedLanguages(): string[] {
    return [...SUPPORTED_LANGUAGES];
  }

  static async analyzeCode(code: string, language: string): Promise<CodeAnalysisResult> {
    try {
      const response = await apiClient.post('/scan/instant', { code, language });
      return response.data;
    } catch (error: any) {
      console.error('Analysis failed:', error);
      throw new Error(error.response?.data?.detail || 'Analysis failed');
    }
  }

  // Mock methods for compatibility if needed, or remove if unused
  static async analyzeRepository() { return { taskId: 'mock', status: 'pending' }; }
  static async getRepositories() { return []; }
  static async getBranches() { return []; }
}
