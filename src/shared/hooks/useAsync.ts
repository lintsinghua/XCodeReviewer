import { useState, useEffect, useCallback } from 'react';

interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
}

export function useAsync<T>(
  asyncFunction: () => Promise<T>,
  dependencies: any[] = []
): AsyncState<T> & { refetch: () => Promise<void> } {
  const [state, setState] = useState<AsyncState<T>>({
    data: null,
    loading: true,
    error: null,
  });

  const execute = useCallback(async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await asyncFunction();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error: error as Error });
    }
  }, dependencies);

  useEffect(() => {
    execute();
  }, [execute]);

  const refetch = useCallback(async () => {
    await execute();
  }, [execute]);

  return { ...state, refetch };
}

export function useAsyncCallback<T extends any[], R>(
  asyncFunction: (...args: T) => Promise<R>
): [(...args: T) => Promise<void>, AsyncState<R>] {
  const [state, setState] = useState<AsyncState<R>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(async (...args: T) => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const data = await asyncFunction(...args);
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState(prev => ({ ...prev, loading: false, error: error as Error }));
    }
  }, [asyncFunction]);

  return [execute, state];
}