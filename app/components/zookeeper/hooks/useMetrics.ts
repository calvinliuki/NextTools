'use client';

import { useState, useEffect } from 'react';
import { ApiResponse } from '../utils/types';

interface UseMetricsOptions {
  connectionId: string;
  onError?: (error: string) => void;
}

interface MetricsData {
  nodes?: string[];
  mode?: string;
  connections?: number;
  watchCount?: number;
  nodeCount?: number;
  latency?: {
    avg?: number;
  };
  outstanding?: number;
}

/**
 * Hook for loading and managing ZooKeeper metrics/statistics
 */
export const useMetrics = ({ connectionId, onError }: UseMetricsOptions) => {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    if (!connectionId) return;

    const fetchMetrics = async () => {
      setMetricsLoading(true);
      setMetricsError(null);
      try {
        const response = await fetch('/api/zookeeper/metrics', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ connectionId }),
        });
        const result: ApiResponse<MetricsData> = await response.json();
        if (result.code === 200) {
          setMetrics(result.data);
        } else {
          const errorMsg = result.message || 'Failed to load metrics';
          setMetricsError(errorMsg);
          onError?.(errorMsg);
        }
      } catch (error: any) {
        const errorMsg = error?.message || 'Failed to load metrics';
        setMetricsError(errorMsg);
        onError?.(errorMsg);
      } finally {
        setMetricsLoading(false);
      }
    };

    fetchMetrics();
  }, [connectionId, onError]);

  return {
    metrics,
    metricsLoading,
    metricsError,
  };
};
