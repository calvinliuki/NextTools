'use client';

import { useState, useCallback, useEffect } from 'react';
import { NodeDetailPayload, DataEncoding, SetMode, ApiResponse } from '../utils/types';
import { resolveDataValue } from '../utils/dataConverter';

interface UseNodeDetailOptions {
  connectionId: string;
  selectedPath: string;
  onError?: (error: string) => void;
}

/**
 * Hook for managing node detail loading and data editing
 */
export const useNodeDetail = ({ connectionId, selectedPath, onError }: UseNodeDetailOptions) => {
  const [nodeDetail, setNodeDetail] = useState<NodeDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [dataEncoding, setDataEncoding] = useState<DataEncoding>('utf8');
  const [setMode, setSetMode] = useState<SetMode>('cas');
  const [dataValue, setDataValue] = useState('');

  const loadNodeDetail = useCallback(async (path: string) => {
    if (!connectionId) return;
    setDetailLoading(true);
    setDetailError(null);
    try {
      const response = await fetch('/api/zookeeper/nodes/detail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, path }),
      });
      const result: ApiResponse = await response.json();
      if (result.code === 200) {
        setNodeDetail(result.data);
      } else {
        const errorMsg = result.message || 'Failed to load node detail';
        setDetailError(errorMsg);
        onError?.(errorMsg);
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to load node detail';
      setDetailError(errorMsg);
      onError?.(errorMsg);
    } finally {
      setDetailLoading(false);
    }
  }, [connectionId, onError]);

  // Update data value when encoding changes
  useEffect(() => {
    setDataValue(resolveDataValue(nodeDetail, dataEncoding));
  }, [nodeDetail, dataEncoding]);

  // Load node detail when path changes
  useEffect(() => {
    if (selectedPath && connectionId) {
      loadNodeDetail(selectedPath);
    }
  }, [selectedPath, connectionId, loadNodeDetail]);

  const handleSaveData = useCallback(async () => {
    if (!connectionId || !selectedPath) return;
    try {
      const response = await fetch('/api/zookeeper/nodes/set-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          path: selectedPath,
          data: dataValue,
          encoding: dataEncoding,
          mode: setMode,
          version: nodeDetail?.stat?.version ?? 0,
        }),
      });
      const result: ApiResponse = await response.json();
      if (result.code === 200) {
        await loadNodeDetail(selectedPath);
      } else {
        console.error(result.message || 'Failed to save data');
      }
    } catch (error) {
      console.error('Failed to save data', error);
    }
  }, [connectionId, selectedPath, dataValue, dataEncoding, setMode, nodeDetail?.stat?.version, loadNodeDetail]);

  const handleFormat = useCallback(() => {
    if (dataEncoding !== 'utf8') return;
    try {
      const formatted = JSON.stringify(JSON.parse(dataValue), null, 2);
      setDataValue(formatted);
    } catch (error) {
      console.error('Failed to format JSON', error);
    }
  }, [dataEncoding, dataValue]);

  const handleValidate = useCallback(() => {
    if (dataEncoding !== 'utf8') return;
    try {
      JSON.parse(dataValue);
      console.log('JSON is valid');
    } catch (error) {
      console.error('JSON validation error', error);
    }
  }, [dataEncoding, dataValue]);

  return {
    nodeDetail,
    detailLoading,
    detailError,
    dataEncoding,
    setDataEncoding,
    setMode,
    setSetMode,
    dataValue,
    setDataValue,
    loadNodeDetail,
    handleSaveData,
    handleFormat,
    handleValidate,
  };
};
