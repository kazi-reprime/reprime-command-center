'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/lib/contexts/ToastContext';

/**
 * Hook for fetching cockpit data with automatic error handling and toast notifications.
 */
export function useCockpitQuery<T>(key: string, path: string) {
  return useQuery<{ data: T; source: string; warning?: string }>({
    queryKey: [key],
    queryFn: async () => {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Failed to fetch ${key}`);
      return res.json();
    },
  });
}

/**
 * Hook for mutations (create/update/delete) with toast feedback.
 */
export function useCockpitMutation<TInput, TResult = unknown>(
  path: string,
  options: {
    method?: string;
    invalidateKeys?: string[];
    successMessage?: string;
    errorMessage?: string;
  } = {}
) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const { method = 'POST', invalidateKeys = [], successMessage, errorMessage } = options;

  return useMutation<TResult, Error, TInput>({
    mutationFn: async (input: TInput) => {
      const res = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Request failed with ${res.status}`);
      }
      return data as TResult;
    },
    onSuccess: (data) => {
      if (successMessage) addToast(successMessage, 'success');
      // Show warning if data was saved to local-only store
      const d = data as Record<string, unknown>;
      if (d?.warning && typeof d.warning === 'string') {
        addToast(d.warning, 'warning');
      }
      invalidateKeys.forEach(key => queryClient.invalidateQueries({ queryKey: [key] }));
    },
    onError: (err) => {
      addToast(errorMessage || err.message, 'error');
    },
  });
}
