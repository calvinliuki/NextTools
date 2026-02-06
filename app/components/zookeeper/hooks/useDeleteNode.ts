'use client';

import { useState, useCallback } from 'react';
import { ApiResponse } from '../utils/types';

interface UseDeleteNodeOptions {
  connectionId: string;
  onSuccess?: (parentPath: string) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for managing delete node dialog state and operations
 */
export const useDeleteNode = ({ connectionId, onSuccess, onError }: UseDeleteNodeOptions) => {
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetPath, setDeleteTargetPath] = useState('');
  const [deleteRecursive, setDeleteRecursive] = useState(false);
  const [isDeletingNode, setIsDeletingNode] = useState(false);

  const openDeleteDialog = useCallback((pathToDelete: string) => {
    if (pathToDelete === '/') return;
    setDeleteTargetPath(pathToDelete);
    setDeleteRecursive(false);
    setDeleteDialogOpen(true);
  }, []);

  const closeDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
  }, []);

  const confirmDeleteNode = useCallback(async () => {
    if (!connectionId || !deleteTargetPath) return;
    setIsDeletingNode(true);

    try {
      const response = await fetch('/api/zookeeper/nodes/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          path: deleteTargetPath,
          version: -1,
          recursive: deleteRecursive,
        }),
      });
      const result: ApiResponse = await response.json();
      if (result.code === 200) {
        const parent = deleteTargetPath.split('/').slice(0, -1).join('/') || '/';
        setDeleteDialogOpen(false);
        onSuccess?.(parent);
      } else {
        onError?.(result.message || 'Failed to delete node');
      }
    } catch (error: any) {
      onError?.(error?.message || 'Failed to delete node');
    } finally {
      setIsDeletingNode(false);
    }
  }, [connectionId, deleteTargetPath, deleteRecursive, onSuccess, onError]);

  return {
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteTargetPath,
    setDeleteTargetPath,
    deleteRecursive,
    setDeleteRecursive,
    isDeletingNode,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDeleteNode,
  };
};
