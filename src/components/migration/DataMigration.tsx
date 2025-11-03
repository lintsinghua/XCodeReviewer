/**
 * Data Migration Component
 * UI for migrating data from IndexedDB to Backend API
 */
import React, { useState, useEffect } from 'react';
import { api } from '../../shared/services/api';
import { featureFlags } from '../../shared/config/featureFlags';
import type { ExportData, ImportResult } from '../../shared/types/api';

interface MigrationStep {
  id: string;
  title: string;
  description: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export const DataMigration: React.FC = () => {
  const [steps, setSteps] = useState<MigrationStep[]>([
    {
      id: 'export',
      title: 'Export Local Data',
      description: 'Export data from IndexedDB',
      status: 'pending',
    },
    {
      id: 'validate',
      title: 'Validate Data',
      description: 'Check data integrity',
      status: 'pending',
    },
    {
      id: 'import',
      title: 'Import to Backend',
      description: 'Upload data to backend API',
      status: 'pending',
    },
    {
      id: 'verify',
      title: 'Verify Migration',
      description: 'Confirm data was migrated correctly',
      status: 'pending',
    },
  ]);

  const [exportedData, setExportedData] = useState<ExportData | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [migrating, setMigrating] = useState(false);
  const [showMigration, setShowMigration] = useState(false);

  useEffect(() => {
    // Check if migration UI should be shown
    setShowMigration(featureFlags.isEnabled('SHOW_MIGRATION_UI'));
  }, []);

  const updateStep = (stepId: string, updates: Partial<MigrationStep>) => {
    setSteps(prev =>
      prev.map(step =>
        step.id === stepId ? { ...step, ...updates } : step
      )
    );
  };

  const exportLocalData = async (): Promise<ExportData> => {
    updateStep('export', { status: 'in_progress', progress: 0 });

    try {
      // Export from IndexedDB
      const dbName = 'xcodereviewer_local';
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      const exportData: ExportData = {
        version: '1.0',
        exported_at: new Date().toISOString(),
        projects: [],
        tasks: [],
        issues: [],
      };

      // Export projects
      updateStep('export', { progress: 25 });
      const projectsStore = db.transaction(['projects'], 'readonly').objectStore('projects');
      exportData.projects = await new Promise((resolve, reject) => {
        const request = projectsStore.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Export tasks
      updateStep('export', { progress: 50 });
      const tasksStore = db.transaction(['audit_tasks'], 'readonly').objectStore('audit_tasks');
      exportData.tasks = await new Promise((resolve, reject) => {
        const request = tasksStore.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      // Export issues
      updateStep('export', { progress: 75 });
      const issuesStore = db.transaction(['audit_issues'], 'readonly').objectStore('audit_issues');
      exportData.issues = await new Promise((resolve, reject) => {
        const request = issuesStore.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      updateStep('export', { status: 'completed', progress: 100 });
      return exportData;
    } catch (error: any) {
      updateStep('export', { 
        status: 'failed', 
        error: error.message || 'Failed to export data' 
      });
      throw error;
    }
  };

  const validateData = async (data: ExportData): Promise<void> => {
    updateStep('validate', { status: 'in_progress', progress: 0 });

    try {
      // Basic validation
      if (!data.version || !data.exported_at) {
        throw new Error('Invalid export format');
      }

      updateStep('validate', { progress: 50 });

      // Validate with backend
      await api.migration.validateImport(data);

      updateStep('validate', { status: 'completed', progress: 100 });
    } catch (error: any) {
      updateStep('validate', { 
        status: 'failed', 
        error: error.message || 'Validation failed' 
      });
      throw error;
    }
  };

  const importToBackend = async (data: ExportData): Promise<ImportResult> => {
    updateStep('import', { status: 'in_progress', progress: 0 });

    try {
      const result = await api.migration.importData(data);
      
      updateStep('import', { status: 'completed', progress: 100 });
      return result;
    } catch (error: any) {
      updateStep('import', { 
        status: 'failed', 
        error: error.message || 'Import failed' 
      });
      throw error;
    }
  };

  const verifyMigration = async (result: ImportResult): Promise<void> => {
    updateStep('verify', { status: 'in_progress', progress: 0 });

    try {
      // Fetch data from backend to verify
      const projects = await api.projects.list({ page: 1, page_size: 100 });
      
      updateStep('verify', { progress: 50 });

      if (projects.total < result.imported_projects) {
        throw new Error('Project count mismatch');
      }

      updateStep('verify', { status: 'completed', progress: 100 });
    } catch (error: any) {
      updateStep('verify', { 
        status: 'failed', 
        error: error.message || 'Verification failed' 
      });
      throw error;
    }
  };

  const startMigration = async () => {
    setMigrating(true);
    setImportResult(null);

    try {
      // Step 1: Export
      const data = await exportLocalData();
      setExportedData(data);

      // Step 2: Validate
      await validateData(data);

      // Step 3: Import
      const result = await importToBackend(data);
      setImportResult(result);

      // Step 4: Verify
      await verifyMigration(result);

      // Enable backend API after successful migration
      featureFlags.setFlag('USE_BACKEND_API', true);
    } catch (error) {
      console.error('Migration failed:', error);
    } finally {
      setMigrating(false);
    }
  };

  const downloadExport = () => {
    if (!exportedData) return;

    const blob = new Blob([JSON.stringify(exportedData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `xcodereviewer-export-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!showMigration) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-2xl font-bold mb-4">Data Migration</h2>
        <p className="text-gray-600 mb-6">
          Migrate your local data to the backend API for improved reliability and features.
        </p>

        {/* Migration Steps */}
        <div className="space-y-4 mb-6">
          {steps.map((step, index) => (
            <div
              key={step.id}
              className={`border rounded-lg p-4 ${
                step.status === 'completed'
                  ? 'border-green-500 bg-green-50'
                  : step.status === 'failed'
                  ? 'border-red-500 bg-red-50'
                  : step.status === 'in_progress'
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      step.status === 'completed'
                        ? 'bg-green-500 text-white'
                        : step.status === 'failed'
                        ? 'bg-red-500 text-white'
                        : step.status === 'in_progress'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-300 text-gray-600'
                    }`}
                  >
                    {step.status === 'completed' ? '✓' : index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold">{step.title}</h3>
                    <p className="text-sm text-gray-600">{step.description}</p>
                  </div>
                </div>
                <div className="text-sm">
                  {step.status === 'in_progress' && step.progress !== undefined && (
                    <span className="text-blue-600">{step.progress}%</span>
                  )}
                  {step.status === 'completed' && (
                    <span className="text-green-600">Complete</span>
                  )}
                  {step.status === 'failed' && (
                    <span className="text-red-600">Failed</span>
                  )}
                </div>
              </div>
              {step.error && (
                <div className="mt-2 text-sm text-red-600">{step.error}</div>
              )}
            </div>
          ))}
        </div>

        {/* Import Result */}
        {importResult && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h3 className="font-semibold mb-2">Migration Summary</h3>
            <ul className="text-sm space-y-1">
              <li>Projects imported: {importResult.imported_projects}</li>
              <li>Tasks imported: {importResult.imported_tasks}</li>
              <li>Issues imported: {importResult.imported_issues}</li>
              {importResult.errors.length > 0 && (
                <li className="text-red-600">
                  Errors: {importResult.errors.length}
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Actions */}
        <div className="flex space-x-4">
          <button
            onClick={startMigration}
            disabled={migrating}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {migrating ? 'Migrating...' : 'Start Migration'}
          </button>
          
          {exportedData && (
            <button
              onClick={downloadExport}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
            >
              Download Export
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
