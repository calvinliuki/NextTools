'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '@/i18n/LanguageContext';

interface ZooKeeperTabProps {
  connectionId: string;
  connectionName: string;
}

interface TreeNode {
  name: string;
  path: string;
  stat?: ZkStatPayload | null;
}

interface ZkStatPayload {
  czxid: number;
  mzxid: number;
  ctime: number;
  mtime: number;
  version: number;
  cversion: number;
  aversion: number;
  ephemeralOwner: number;
  dataLength: number;
  numChildren: number;
  pzxid: number;
}

interface NodeDetailPayload {
  path: string;
  data: string;
  dataBase64: string;
  stat: ZkStatPayload | null;
}

interface ChildPayload {
  name: string;
  path: string;
  stat: ZkStatPayload | null;
}

type DetailTab = 'data';

export default function ZooKeeperTab({ connectionId, connectionName }: ZooKeeperTabProps) {
  const { t } = useLanguage();
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set(['/']));
  const [selectedPath, setSelectedPath] = useState('/');
  const [detailTab, setDetailTab] = useState<DetailTab>('data');
  const [treeNodes, setTreeNodes] = useState<Record<string, TreeNode[]>>({});
  const [nodeStats, setNodeStats] = useState<Record<string, ZkStatPayload | null>>({});
  const [treeFilter, setTreeFilter] = useState('');
  const [jumpPath, setJumpPath] = useState('');
  const [nodeDetail, setNodeDetail] = useState<NodeDetailPayload | null>(null);
  const [childrenList, setChildrenList] = useState<ChildPayload[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [childrenLoading, setChildrenLoading] = useState(false);
  const [childrenError, setChildrenError] = useState<string | null>(null);
  const [dataEncoding, setDataEncoding] = useState<'utf8' | 'base64' | 'hex'>('utf8');
  const [setMode, setSetMode] = useState<'cas' | 'overwrite'>('cas');
  const [dataValue, setDataValue] = useState('');
  const [metrics, setMetrics] = useState<any>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  
  // Splitter drag-related state
  const [leftWidth, setLeftWidth] = useState(280); // Default left width
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const nodeRefs = useRef<Map<string, HTMLDivElement | null>>(new Map());
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createParentPath, setCreateParentPath] = useState('/');
  const [createNodeName, setCreateNodeName] = useState('');
  const [createNodeData, setCreateNodeData] = useState('');
  const [createEncoding, setCreateEncoding] = useState<'utf8' | 'base64' | 'hex'>('utf8');
  const [createMode, setCreateMode] = useState<'persistent' | 'ephemeral' | 'persistent_sequential' | 'ephemeral_sequential'>('persistent');
  const [createParents, setCreateParents] = useState(true);
  const [isCreatingNode, setIsCreatingNode] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteTargetPath, setDeleteTargetPath] = useState('');
  const [deleteRecursive, setDeleteRecursive] = useState(false);
  const [isDeletingNode, setIsDeletingNode] = useState(false);

  const breadcrumbs = useMemo(() => {
    if (selectedPath === '/') return ['/'];
    const parts = selectedPath.split('/').filter(Boolean);
    const crumbs = ['/'];
    let current = '';
    parts.forEach(part => {
      current += `/${part}`;
      crumbs.push(current);
    });
    return crumbs;
  }, [selectedPath]);

  const toggleExpand = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = () => {
    const all = new Set<string>();
    Object.keys(treeNodes).forEach(path => all.add(path));
    all.add('/');
    setExpandedPaths(all);
  };

  const collapseAll = () => {
    setExpandedPaths(new Set(['/']));
  };

  const formatTimestamp = (value?: number | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    const pad = (num: number) => String(num).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  };

  const base64ToHex = (base64: string) => {
    try {
      const binary = atob(base64);
      let hex = '';
      for (let i = 0; i < binary.length; i += 1) {
        hex += binary.charCodeAt(i).toString(16).padStart(2, '0');
      }
      return hex;
    } catch {
      return '';
    }
  };

  const resolveDataValue = (detail: NodeDetailPayload | null, encoding: 'utf8' | 'base64' | 'hex') => {
    if (!detail) return '';
    if (encoding === 'base64') return detail.dataBase64 || '';
    if (encoding === 'hex') return base64ToHex(detail.dataBase64 || '');
    return detail.data || '';
  };

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
      const result = await response.json();
      if (result.code === 200) {
        const payload = result.data;
        // 调试日志：查看后端返回的子节点数据
        console.log('[ZK Debug] loadChildren response:', path, {
          parentStat: payload.stat,
          children: payload.children?.map((c: any) => ({ path: c.path, numChildren: c.stat?.numChildren }))
        });
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
        setChildrenError(result.message || t('zooKeeperTab.loadChildrenFailed'));
      }
    } catch (error: any) {
      setChildrenError(error?.message || t('zooKeeperTab.loadChildrenFailed'));
    } finally {
      if (includeStat) {
        setChildrenLoading(false);
      }
    }
  }, [connectionId]);

  const handleLocateCurrent = async () => {
    if (!selectedPath) return;
    const crumbs = selectedPath === '/' ? ['/'] : breadcrumbs;
    setExpandedPaths(prev => {
      const next = new Set(prev);
      crumbs.forEach(crumb => next.add(crumb));
      return next;
    });
    for (const crumb of crumbs) {
      if (!treeNodes[crumb]) {
        await loadChildren(crumb, false);
      }
    }
    requestAnimationFrame(() => {
      const el = nodeRefs.current.get(selectedPath);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

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
      const result = await response.json();
      if (result.code === 200) {
        setNodeDetail(result.data);
        setNodeStats(prev => ({ ...prev, [path]: result.data?.stat || null }));
      } else {
        setDetailError(result.message || t('zooKeeperTab.loadNodeDetailFailed'));
      }
    } catch (error: any) {
      setDetailError(error?.message || t('zooKeeperTab.loadNodeDetailFailed'));
    } finally {
      setDetailLoading(false);
    }
  }, [connectionId]);

  const renderTree = (node: TreeNode, depth = 0) => {
    const hasLoadedChildren = Object.prototype.hasOwnProperty.call(treeNodes, node.path);
    const children = treeNodes[node.path] || [];
    const nodeStat = nodeStats[node.path];
    // 优先使用节点本身的 stat 中的 numChildren，这是最准确的值
    const numChildren = nodeStat?.numChildren;
    const hasChildren = numChildren !== undefined ? numChildren > 0 : (!hasLoadedChildren || children.length > 0);
    const isExpanded = expandedPaths.has(node.path);
    const isActive = selectedPath === node.path;
    const filterValue = treeFilter.trim().toLowerCase();
    const matchesFilter = !filterValue || node.path.toLowerCase().includes(filterValue);
    const hasMatchingChild = filterValue
      ? children.some(child => (child.path || '').toLowerCase().includes(filterValue))
      : true;
    if (filterValue && !matchesFilter && !hasMatchingChild) {
      return null;
    }

    // 显示子节点数时，优先使用已加载的实际子节点数
    // 如果已加载了子节点，使用实际数量；否则使用 stat 中的 numChildren；都没有则显示省略号
    const childrenLabel = hasChildren
      ? (hasLoadedChildren 
          ? t('zooKeeperTab.childrenLabel', {count: children.length})
          : (numChildren !== undefined 
              ? t('zooKeeperTab.childrenLabel', {count: numChildren}) 
              : '...'))
      : t('zooKeeperTab.leafNode');

    return (
      <li key={node.path} className="relative">
        <div
          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
            isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
          }`}
          style={{ paddingLeft: `${12 + depth * 4}px` }}
          onClick={() => {
            setSelectedPath(node.path);
            if (hasChildren) {
              toggleExpand(node.path);
              if (!treeNodes[node.path]) {
                loadChildren(node.path);
              }
            }
          }}
          title={node.path}
          ref={el => {
            nodeRefs.current.set(node.path, el);
          }}
        >
          <span className={`h-5 w-5 shrink-0 rounded-lg text-xs font-black grid place-items-center ${
            hasChildren ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
          }`}>
            {hasChildren ? (isExpanded ? '▾' : '▸') : '•'}
          </span>
          <span className="h-6 w-6 shrink-0 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100 grid place-items-center text-xs font-bold">
            {node.name === '/' ? '/' : node.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="whitespace-nowrap" title={node.name}>{node.name}</span>
          <span className="ml-auto text-[10px] rounded-full border border-slate-200 px-2 py-0.5 text-slate-500">
            {childrenLabel}
          </span>
        </div>
        {hasChildren && isExpanded && (
          <ul className="ml-4 border-l border-slate-200 pl-2">
            {children.map(child => renderTree(child, depth + 1))}
          </ul>
        )}
      </li>
    );
  };

  // Handle splitter dragging
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      
      // Restrict minimum and maximum width
      if (newWidth > 150 && newWidth < 600) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

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
        const result = await response.json();
        if (result.code === 200) {
          setMetrics(result.data);
        } else {
          setMetricsError(result.message || t('zooKeeperTab.metricsLoadFailed'));
        }
      } catch (error: any) {
        setMetricsError(error?.message || t('zooKeeperTab.metricsLoadFailed'));
      } finally {
        setMetricsLoading(false);
      }
    };

    fetchMetrics();
  }, [connectionId]);

  useEffect(() => {
    if (!connectionId) return;
    setSelectedPath('/');
    setExpandedPaths(new Set(['/']));
    // 初始化时就获取根节点的完整子节点信息（包括stat），确保显示准确的子节点数
    loadChildren('/', true);
    loadNodeDetail('/');
  }, [connectionId, loadChildren, loadNodeDetail]);

  useEffect(() => {
    if (!connectionId || !selectedPath) return;
    setJumpPath(selectedPath);
    loadNodeDetail(selectedPath);
    loadChildren(selectedPath, true);
  }, [connectionId, selectedPath, loadChildren, loadNodeDetail]);

  useEffect(() => {
    if (detailTab !== 'data') {
      setDetailTab('data');
    }
  }, [detailTab]);



  useEffect(() => {
    setDataValue(resolveDataValue(nodeDetail, dataEncoding));
  }, [nodeDetail, dataEncoding]);

  const nodeListText = (metrics?.nodes || []).join(' / ') || t('zooKeeperTab.noNodeInfo');
  const nodesCount = metrics?.nodes?.length || 0;
  const connections = metrics?.connections ?? 0;
  const watchCount = metrics?.watchCount ?? 0;
  const nodeCount = metrics?.nodeCount ?? 0;
  const latencyAvg = metrics?.latency?.avg ?? 0;
  const outstanding = metrics?.outstanding ?? 0;
  const detailStat = nodeDetail?.stat;
  const dataVersion = detailStat?.version ?? 0;
  const isEphemeral = !!detailStat?.ephemeralOwner;
  const childrenCount = detailStat?.numChildren ?? 0;
  const dataLength = detailStat?.dataLength ?? 0;

  const normalizePath = (value: string) => {
    if (!value) return '/';
    const trimmed = value.trim();
    if (!trimmed) return '/';
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  };

  const handleCopyPath = async () => {
    if (!selectedPath) return;
    try {
      await navigator.clipboard.writeText(selectedPath);
    } catch (error) {
      console.error(t('zooKeeperTab.copyPathFailed'), error);
    }
  };

  const handleJumpSubmit = () => {
    const nextPath = normalizePath(jumpPath);
    setSelectedPath(nextPath);
    setExpandedPaths(prev => new Set(prev).add(nextPath));
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).slice(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  const openCreateDialog = (parentPath: string) => {
    setCreateParentPath(parentPath || '/');
    setCreateNodeName('');
    setCreateNodeData('');
    setCreateEncoding('utf8');
    setCreateMode('persistent');
    setCreateParents(true);
    setCreateDialogOpen(true);
  };

  const handleCreateNode = async () => {
    if (!connectionId) return;
    const name = createNodeName.trim().replace(/^\/+/, '');
    if (!name) {
      showToast(t('zooKeeperTab.enterNodeName'), 'info');
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
      const result = await response.json();
      if (result.code === 200) {
        showToast(t('zooKeeperTab.createNodeSuccess'), 'success');
        await loadChildren(parentPath, true);
        setSelectedPath(newPath);
        setCreateDialogOpen(false);
      } else {
        showToast(result.message || t('zooKeeperTab.createNodeFailed'), 'error');
      }
    } catch (error: any) {
      showToast(t('zooKeeperTab.createNodeError', {error: error?.message || 'Unknown error'}), 'error');
    } finally {
      setIsCreatingNode(false);
    }
  };

  const handleDeleteNode = async (pathToDelete: string) => {
    if (!connectionId) return;
    if (pathToDelete === '/') return;
    setDeleteTargetPath(pathToDelete);
    setDeleteRecursive(false);
    setDeleteDialogOpen(true);
  };

  const confirmDeleteNode = async () => {
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
      const result = await response.json();
      if (result.code === 200) {
        const parent = deleteTargetPath.split('/').slice(0, -1).join('/') || '/';
        setSelectedPath(parent);
        await loadChildren(parent, true);
        setDeleteDialogOpen(false);
        showToast(t('zooKeeperTab.deleteSuccess'), 'success');
      } else {
        showToast(result.message || t('zooKeeperTab.deleteNodeFailed'), 'error');
      }
    } catch (error: any) {
      showToast(t('zooKeeperTab.deleteNodeError', {error: error?.message || 'Unknown error'}), 'error');
    } finally {
      setIsDeletingNode(false);
    }
  };

  const handleSaveData = async () => {
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
          version: dataVersion,
        }),
      });
      const result = await response.json();
      if (result.code === 200) {
        await loadNodeDetail(selectedPath);
      } else {
        console.error(result.message || t('zooKeeperTab.saveDataFailed'));
      }
    } catch (error) {
      console.error(t('zooKeeperTab.saveDataFailed'), error);
    }
  };

  const handleFormat = () => {
    if (dataEncoding !== 'utf8') return;
    try {
      const formatted = JSON.stringify(JSON.parse(dataValue), null, 2);
      setDataValue(formatted);
    } catch (error) {
      console.error(t('zooKeeperTab.jsonFormatError'), error);
    }
  };

  const handleValidate = () => {
    if (dataEncoding !== 'utf8') return;
    try {
      JSON.parse(dataValue);
    } catch (error) {
      console.error(t('zooKeeperTab.jsonValidateError'), error);
    }
  };

  return (
    <div ref={containerRef} className="h-full flex bg-[#F9FAFB]" style={{ userSelect: isDragging ? 'none' : 'auto' }}>
      {/* Left: Node Tree */}
      <div
        className="flex flex-col bg-white border-r border-gray-200"
        style={{ width: `${leftWidth}px`, minWidth: '200px' }}
      >
        {/* Connection Info Header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-600 text-white font-black grid place-items-center shadow-sm text-xs">
              ZK
            </div>
            <h3 className="font-semibold text-gray-800 text-sm truncate" title={connectionName}>
              {connectionName}
            </h3>
          </div>
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
              <i className="fas fa-check-circle mr-1"></i>
              {t('zooKeeperTab.connected')}
            </span>
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
              {metrics?.mode || 'standalone'}
            </span>
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
              {t('zooKeeperTab.nodeCount', {count: nodesCount})}
            </span>
          </div>
          
          <div className="mt-3 text-xs text-gray-500 flex items-center gap-1 mb-2">
             <i className="fas fa-info-circle text-blue-500"></i>
             <span>{t('zooKeeperTab.latency')}: {latencyAvg}ms</span>
             <span className="mx-1">·</span>
             <span>{t('zooKeeperTab.watch')}: {watchCount}</span>
          </div>

          <div className="mt-1">
            <input
              className="w-full px-3 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc]"
              placeholder={t('zooKeeperTab.searchNodes')}
              value={treeFilter}
              onChange={e => setTreeFilter(e.target.value)}
            />
          </div>
        </div>

        {/* Node Tree */}
        <div className="flex-1 overflow-y-auto p-2">
          <ul className="space-y-1">
            {renderTree({ name: '/', path: '/' })}
          </ul>
        </div>

        {/* Bottom Operation Buttons */}
        <div className="px-3 py-2 border-t border-gray-200 flex gap-2">
          <button
            className="flex-1 px-3 py-1.5 text-xs bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center justify-center gap-1"
            onClick={handleLocateCurrent}
          >
            <i className="fas fa-crosshairs"></i>
            {t('zooKeeperTab.locate')}
          </button>
          <button
            className="flex-1 px-3 py-1.5 text-xs bg-[#00B42A] text-white rounded hover:bg-[#009A29] transition-colors flex items-center justify-center gap-1"
            onClick={() => openCreateDialog(selectedPath || '/')}
          >
            <i className="fas fa-plus"></i>
            {t('zooKeeperTab.create')}
          </button>
        </div>
      </div>

      {/* Splitter */}
      <div
        className={`w-1 bg-gray-200 hover:bg-[#007acc] cursor-col-resize flex items-center justify-center transition-colors ${
          isDragging ? 'bg-[#007acc]' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="w-0.5 h-8 bg-gray-400 rounded"></div>
      </div>

      {/* Right: Data Display Area */}
      <div className="flex-1 flex flex-col bg-white overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2 overflow-hidden mr-4">
             <i className="fas fa-folder-open text-gray-400 text-sm"></i>
             <div className="flex items-center gap-1 text-xs font-medium text-gray-600 overflow-hidden">
               {breadcrumbs.map((crumb, idx) => (
                 <span key={crumb} className="flex items-center gap-1 shrink-0">
                   {idx > 0 && <span className="text-gray-300">/</span>}
                   <button
                     className="hover:text-[#007acc] truncate max-w-[120px]"
                     onClick={() => setSelectedPath(crumb)}
                     title={crumb}
                   >
                     {idx === 0 ? t('zooKeeperTab.root') : crumb.split('/').pop() || '/'}
                   </button>
                 </span>
               ))}
             </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-1 rounded border border-gray-300 bg-white px-2 py-1">
              <i className="fas fa-terminal text-[10px] text-gray-400"></i>
              <input
                className="w-40 text-xs outline-none"
                value={jumpPath}
                onChange={e => setJumpPath(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleJumpSubmit()}
              />
            </div>
            <button 
              className="p-1.5 text-gray-500 hover:text-[#007acc] hover:bg-gray-100 rounded transition-colors"
              onClick={handleCopyPath}
              title={t('zooKeeperTab.copyPath')}
            >
              <i className="fas fa-copy text-sm"></i>
            </button>
            <button 
              className="p-1.5 text-gray-500 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
              onClick={() => handleDeleteNode(selectedPath)}
              title={t('zooKeeperTab.deleteNode')}
            >
              <i className="fas fa-trash-alt text-sm"></i>
            </button>
            <div className="h-4 w-px bg-gray-300 mx-1"></div>
            <button
              className="px-3 py-1.5 text-xs bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center gap-1"
              onClick={() => loadChildren(selectedPath, true)}
            >
              <i className="fas fa-sync-alt"></i>
              {t('zooKeeperTab.refresh')}
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto p-4">
          {detailError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-600 text-xs flex items-center gap-2">
              <i className="fas fa-exclamation-circle"></i>
              {detailError}
            </div>
          )}

          {/* 节点元数据卡片 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="p-3 bg-gray-50 rounded border border-gray-100">
              <div className="text-[10px] text-gray-500 uppercase mb-1">{t('zooKeeperTab.nodeType')}</div>
              <div className="text-sm font-semibold text-gray-800">{isEphemeral ? t('zooKeeperTab.ephemeralNode') : t('zooKeeperTab.persistentNode')}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-100">
              <div className="text-[10px] text-gray-500 uppercase mb-1">{t('zooKeeperTab.dataLength')}</div>
              <div className="text-sm font-semibold text-gray-800">{dataLength} {t('zooKeeperTab.bytes')}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-100">
              <div className="text-[10px] text-gray-500 uppercase mb-1">{t('zooKeeperTab.version')}</div>
              <div className="text-sm font-semibold text-gray-800">v{dataVersion}</div>
            </div>
            <div className="p-3 bg-gray-50 rounded border border-gray-100">
              <div className="text-[10px] text-gray-500 uppercase mb-1">{t('zooKeeperTab.childrenCount')}</div>
              <div className="text-sm font-semibold text-gray-800">{childrenCount}</div>
            </div>
          </div>

          {/* 数据编辑器区域 */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4">
                <h4 className="text-sm font-bold text-gray-800">{t('zooKeeperTab.nodeContent')}</h4>
                <div className="flex items-center gap-2">
                   <select
                    className="text-xs border-none bg-transparent font-medium text-[#007acc] focus:ring-0"
                    value={dataEncoding}
                    onChange={e => {
                      const next = e.target.value as any;
                      setDataEncoding(next);
                      setDataValue(resolveDataValue(nodeDetail, next));
                    }}
                  >
                    <option value="utf8">UTF-8</option>
                    <option value="base64">Base64</option>
                    <option value="hex">Hex</option>
                  </select>
                  <select
                    className="text-xs border-none bg-transparent font-medium text-gray-500 focus:ring-0"
                    value={setMode}
                    onChange={e => setSetMode(e.target.value as any)}
                  >
                    <option value="cas">{t('zooKeeperTab.casSafe')}</option>
                    <option value="overwrite">{t('zooKeeperTab.overwriteForce')}</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-2">
                <button className="px-2 py-1 text-xs text-gray-600 hover:text-[#007acc]" onClick={handleFormat}>{t('zooKeeperTab.formatJson')}</button>
                <button className="px-3 py-1 text-xs bg-[#007acc] text-white rounded hover:bg-[#005a9e]" onClick={handleSaveData}>{t('zooKeeperTab.saveChanges')}</button>
              </div>
            </div>
            <textarea
              className="w-full h-64 p-3 font-mono text-sm border border-gray-200 rounded focus:ring-1 focus:ring-[#007acc] outline-none"
              value={dataValue}
              onChange={e => setDataValue(e.target.value)}
              spellCheck={false}
            />
          </div>

          {/* 子节点表格 */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-bold text-gray-800">{t('zooKeeperTab.childrenList')} ({childrenList.length})</h4>
              <button 
                className="text-xs text-[#007acc] hover:underline"
                onClick={() => openCreateDialog(selectedPath)}
              >
                {t('zooKeeperTab.addChild')}
              </button>
            </div>
            <div className="border border-gray-200 rounded overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2 font-semibold">{t('zooKeeperTab.name')}</th>
                    <th className="px-4 py-2 font-semibold">{t('zooKeeperTab.type')}</th>
                    <th className="px-4 py-2 font-semibold text-right">{t('zooKeeperTab.size')}</th>
                    <th className="px-4 py-2 font-semibold text-right">{t('zooKeeperTab.modifyTime')}</th>
                    <th className="px-4 py-2 font-semibold text-center">{t('zooKeeperTab.operation')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {childrenLoading ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t('zooKeeperTab.loading')}</td></tr>
                  ) : childrenList.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">{t('zooKeeperTab.noChildren')}</td></tr>
                  ) : (
                    childrenList.map(child => (
                      <tr key={child.path} className="hover:bg-gray-50 group">
                        <td className="px-4 py-2 font-medium text-gray-700">{child.name}</td>
                        <td className="px-4 py-2 text-gray-500">{child.stat?.ephemeralOwner ? t('zooKeeperTab.ephemeral') : t('zooKeeperTab.persistent')}</td>
                        <td className="px-4 py-2 text-gray-500 text-right">{child.stat?.dataLength ?? 0} B</td>
                        <td className="px-4 py-2 text-gray-500 text-right">{formatTimestamp(child.stat?.mtime)}</td>
                        <td className="px-4 py-2 text-center">
                          <div className="flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button className="text-[#007acc]" onClick={() => setSelectedPath(child.path)}>{t('zooKeeperTab.open')}</button>
                            <button className="text-red-500" onClick={() => handleDeleteNode(child.path)}>{t('zooKeeperTab.delete')}</button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
          
          {/* 时间线统计信息 */}
          <div className="mt-8 pt-6 border-t border-gray-100 grid grid-cols-2 gap-8">
             <div>
               <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-2">{t('zooKeeperTab.nodeMetaInfo')}</h5>
               <div className="space-y-2 text-[11px]">
                 <div className="flex justify-between"><span className="text-gray-500">{t('zooKeeperTab.czxid')}</span><span className="font-mono text-gray-800">0x{detailStat?.czxid.toString(16)}</span></div>
                 <div className="flex justify-between"><span className="text-gray-500">{t('zooKeeperTab.mzxid')}</span><span className="font-mono text-gray-800">0x{detailStat?.mzxid.toString(16)}</span></div>
                 <div className="flex justify-between"><span className="text-gray-500">{t('zooKeeperTab.cversion')}</span><span className="text-gray-800">{detailStat?.cversion}</span></div>
               </div>
             </div>
             <div>
               <h5 className="text-[10px] font-bold text-gray-400 uppercase mb-2">{t('zooKeeperTab.timeStatistics')}</h5>
               <div className="space-y-2 text-[11px]">
                 <div className="flex justify-between"><span className="text-gray-500">{t('zooKeeperTab.createTime')}</span><span className="text-gray-800">{formatTimestamp(detailStat?.ctime)}</span></div>
                 <div className="flex justify-between"><span className="text-gray-500">{t('zooKeeperTab.lastModifyTime')}</span><span className="text-gray-800">{formatTimestamp(detailStat?.mtime)}</span></div>
               </div>
             </div>
          </div>
        </div>
      </div>

      {createDialogOpen && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setCreateDialogOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-[600px] max-w-[90vw] max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <i className="fas fa-plus-circle text-[#00B42A]"></i>
                {t('zooKeeperTab.createNode')}
              </h2>
              <button
                onClick={() => setCreateDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('zooKeeperTab.parentPath')}</label>
                <input
                  type="text"
                  value={createParentPath}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm bg-gray-100 text-gray-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('zooKeeperTab.nodeName')} {t('zooKeeperTab.required')}</label>
                <input
                  type="text"
                  value={createNodeName}
                  onChange={(event) => setCreateNodeName(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00B42A] text-sm"
                  placeholder={t('zooKeeperTab.enterNodeName')}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('zooKeeperTab.createMode')}</label>
                <select
                  value={createMode}
                  onChange={(event) => setCreateMode(event.target.value as typeof createMode)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00B42A] text-sm"
                >
                  <option value="persistent">persistent</option>
                  <option value="ephemeral">ephemeral</option>
                  <option value="persistent_sequential">persistent_sequential</option>
                  <option value="ephemeral_sequential">ephemeral_sequential</option>
                </select>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  id="zk-create-parents"
                  type="checkbox"
                  checked={createParents}
                  onChange={(event) => setCreateParents(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-[#00B42A] focus:ring-[#00B42A]"
                />
                <label htmlFor="zk-create-parents">{t('zooKeeperTab.autoCreateParent')}</label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('zooKeeperTab.dataEncoding')}</label>
                <select
                  value={createEncoding}
                  onChange={(event) => setCreateEncoding(event.target.value as typeof createEncoding)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00B42A] text-sm"
                >
                  <option value="utf8">{t('zooKeeperTab.utf8Text')}</option>
                  <option value="base64">Base64</option>
                  <option value="hex">Hex</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('zooKeeperTab.nodeData')}</label>
                <textarea
                  value={createNodeData}
                  onChange={(event) => setCreateNodeData(event.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00B42A] font-mono text-sm"
                  placeholder={t('zooKeeperTab.optional')}
                  rows={6}
                />
              </div>
            </div>
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setCreateDialogOpen(false)}
                disabled={isCreatingNode}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
              >
                {t('zooKeeperTab.cancel')}
              </button>
              <button
                onClick={handleCreateNode}
                disabled={isCreatingNode}
                className="px-4 py-2 text-sm text-white bg-[#00B42A] hover:bg-[#009A29] rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isCreatingNode ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    {t('zooKeeperTab.creating')}
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i>
                    {t('zooKeeperTab.confirmCreate')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {deleteDialogOpen && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
          onClick={() => setDeleteDialogOpen(false)}
        >
          <div
            className="bg-white rounded-lg shadow-xl w-[520px] max-w-[90vw] max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <i className="fas fa-trash text-red-500"></i>
                {t('zooKeeperTab.deleteTitle')}
              </h2>
              <button
                onClick={() => setDeleteDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm text-gray-700">
                {t('zooKeeperTab.willDeleteNode')}<span className="font-semibold text-gray-900 break-words">{deleteTargetPath}</span>
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  id="zk-delete-recursive"
                  type="checkbox"
                  checked={deleteRecursive}
                  onChange={(event) => setDeleteRecursive(event.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-red-500 focus:ring-red-500"
                />
                <label htmlFor="zk-delete-recursive">{t('zooKeeperTab.recursiveDelete')}</label>
              </div>
              <p className="text-xs text-red-500">{t('zooKeeperTab.recursiveWarning')}</p>
            </div>
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
              <button
                onClick={() => setDeleteDialogOpen(false)}
                disabled={isDeletingNode}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50"
              >
                {t('zooKeeperTab.cancel')}
              </button>
              <button
                onClick={confirmDeleteNode}
                disabled={isDeletingNode}
                className="px-4 py-2 text-sm text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {isDeletingNode ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    {t('zooKeeperTab.deleting')}
                  </>
                ) : (
                  <>
                    <i className="fas fa-trash"></i>
                    {t('zooKeeperTab.confirmDelete')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}


      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[300px] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${
              toast.type === 'success' ? 'bg-green-500 text-white' :
              toast.type === 'error' ? 'bg-red-500 text-white' :
              'bg-blue-500 text-white'
            }`}
            style={{ animation: 'slideIn 0.3s ease-out' }}
          >
            <i className={`fas ${
              toast.type === 'success' ? 'fa-check-circle' :
              toast.type === 'error' ? 'fa-times-circle' :
              'fa-info-circle'
            } text-xl`}></i>
            <span className="flex-1 text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}
              className="text-white/80 hover:text-white transition-colors"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
