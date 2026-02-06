'use client';

import { useState, useCallback } from 'react';
import { CreateMode, DataEncoding, ApiResponse } from '../utils/types';

interface UseCreateNodeOptions {
  connectionId: string;
  onSuccess?: (newPath: string) => void;
  onError?: (error: string) => void;
}

/**
 * Hook for managing create node dialog state and operations
 */
export const useCreateNode = ({ connectionId, onSuccess, onError }: UseCreateNodeOptions) => {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createParentPath, setCreateParentPath] = useState('/');
  const [createNodeName, setCreateNodeName] = useState('');
  const [createNodeData, setCreateNodeData] = useState('');
  const [createEncoding, setCreateEncoding] = useState<DataEncoding>('utf8');
  const [createMode, setCreateMode] = useState<CreateMode>('persistent');
  const [createParents, setCreateParents] = useState(true);
  const [isCreatingNode, setIsCreatingNode] = useState(false);

  const openCreateDialog = useCallback((parentPath: string) => {
    setCreateParentPath(parentPath || '/');
    setCreateNodeName('');
    setCreateNodeData('');
    setCreateEncoding('utf8');
    setCreateMode('persistent');
    setCreateParents(true);
    setCreateDialogOpen(true);
  }, []);

  const closeCreateDialog = useCallback(() => {
    setCreateDialogOpen(false);
  }, []);

  const handleCreateNode = useCallback(async () => {
    if (!connectionId) return;
    const name = createNodeName.trim().replace(/^\/+/, '');
    if (!name) {
      onError?.('Please enter node name');
      return;
    }

    setIsCreatingNode(true);
    const parentPath = createParentPath || '/';
    const newPath = parentPath === '/' ? `/${name}` : `${parentPath}/${name}`;

    try {
      const response = await fetch('/api/zookeeper/nodes/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          path: newPath,
          data: createNodeData,
          encoding: createEncoding,
          createMode,
          createParents,
        }),
      });
      const result: ApiResponse = await response.json();
      if (result.code === 200) {
        setCreateDialogOpen(false);
        onSuccess?.(newPath);
      } else {
        onError?.(result.message || 'Failed to create node');
      }
    } catch (error: any) {
      onError?.(error?.message || 'Failed to create node');
    } finally {
      setIsCreatingNode(false);
    }
  }, [connectionId, createNodeName, createParentPath, createNodeData, createEncoding, createMode, createParents, onSuccess, onError]);

  return {
    createDialogOpen,
    setCreateDialogOpen,
    createParentPath,
    setCreateParentPath,
    createNodeName,
    setCreateNodeName,
    createNodeData,
    setCreateNodeData,
    createEncoding,
    setCreateEncoding,
    createMode,
    setCreateMode,
    createParents,
    setCreateParents,
    isCreatingNode,
    openCreateDialog,
    closeCreateDialog,
    handleCreateNode,
  };
};
