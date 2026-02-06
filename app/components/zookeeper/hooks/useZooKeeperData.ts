'use client';

import { useState, useCallback, useRef, useMemo } from 'react';
import { TreeNode, ZkStatPayload, ChildPayload, ApiResponse } from '../utils/types';

interface UseZooKeeperDataOptions {
  connectionId: string;
  onError?: (error: string) => void;
}

/**
 * Hook for managing ZooKeeper tree data loading and state
 */
export const useZooKeeperData = ({ connectionId, onError }: UseZooKeeperDataOptions) => {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const [treeNodes, setTreeNodes] = useState<Record<string, TreeNode[]>>({});
  const [nodeStats, setNodeStats] = useState<Record<string, ZkStatPayload | null>>({});
  const [childrenList, setChildrenList] = useState<ChildPayload[]>([]);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [childrenError, setChildrenError] = useState<string | null>(null);

  const nodeRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());

  const loadChildren = useCallback(async (path: string, includeStat = false) => {
    if (!connectionId) return;
    setChildrenError(null);
    if (includeStat) {
      setChildrenLoading(true);
    }
    try {
      const response = await fetch('/api/zookeeper/nodes/children', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, path, includeStat }),
      });
      const result: ApiResponse = await response.json();
      if (result.code === 200) {
        const payload = result.data;
        setTreeNodes(prev => ({ ...prev, [path]: payload.children || [] }));
        setNodeStats(prev => {
          const next = { ...prev, [path]: payload.stat || null };
          (payload.children || []).forEach((child: ChildPayload) => {
            if (child.stat) {
              next[child.path] = child.stat;
            }
          });
          return next;
        });
        if (includeStat) {
          setChildrenList(payload.children || []);
        }
      } else {
        setChildrenError(result.message || 'Failed to load children');
        onError?.(result.message || 'Failed to load children');
      }
    } catch (error: any) {
      const errorMsg = error?.message || 'Failed to load children';
      setChildrenError(errorMsg);
      onError?.(errorMsg);
    } finally {
      if (includeStat) {
        setChildrenLoading(false);
      }
    }
  }, [connectionId, onError]);

  const toggleExpand = useCallback((path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const expandAll = useCallback(() => {
    const all = new Set<string>();
    Object.keys(treeNodes).forEach(path => all.add(path));
    all.add('/');
    setExpandedPaths(all);
  }, [treeNodes]);

  const collapseAll = useCallback(() => {
    setExpandedPaths(new Set(['/']));
  }, []);

  return {
    expandedPaths,
    setExpandedPaths,
    treeNodes,
    nodeStats,
    childrenList,
    childrenLoading,
    childrenError,
    nodeRefs,
    loadChildren,
    toggleExpand,
    expandAll,
    collapseAll,
  };
};
