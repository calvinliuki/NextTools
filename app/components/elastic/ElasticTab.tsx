'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import DeleteConfirmDialog from '../common/DeleteConfirmDialog';

interface ElasticTabProps {
  connectionId: string;
  connectionName: string;
}



type ElasticHealth = 'green' | 'yellow' | 'red' | 'unknown';

interface ElasticMetrics {
  cluster: {
    status: ElasticHealth;
    nodes: number;
    activeShards: number;
    unassignedShards: number;
  };
  stats: {
    indices: number;
    docs: number;
    storeBytes: number;
    shards: number;
    qps: number;
    avgResponseTimeMs: number;
  };
  nodes: Array<{
    id: string;
    name: string;
    role: string;
    status: string;
    heap: number;
    cpu: number;
    disk: number;
    shards: number;
  }>;
  indices: Array<{
    name: string;
    docs: number;
    size: string;
    status: string;
    health: ElasticHealth;
  }>;
}

interface ElasticIndexInfo {
  name: string;
  status: string;
  health: ElasticHealth;
  docs: number;
  size: string;
  pri?: number;
  rep?: number;
  alias?: string;
  aliases?: string[];
  createdAt?: string | null;
}

interface ElasticDocRow {
  id: string;
  score?: number;
  source: Record<string, any>;
}

interface DocDialogState {
  open: boolean;
  mode: 'view' | 'edit' | 'create';
  id: string;
  content: string;
  error?: string;
}

interface CreateIndexState {
  open: boolean;
  name: string;
  shards: number;
  replicas: number;
  alias: string;
  error?: string;
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)}${units[idx]}`;
}

export default function ElasticTab({ connectionId, connectionName }: ElasticTabProps) {
  const { t } = useLanguage();
  const navItems = [
    { id: 'dashboard', label: t('elasticTab.dashboard'), icon: '🏠' },
    { id: 'indices', label: t('elasticTab.indices'), icon: '🗂️' },
  ] as const;
  
  type NavId = typeof navItems[number]['id'];
  const [selectedIndex, setSelectedIndex] = useState<string>('');
  const [queryMode, setQueryMode] = useState<'dsl' | 'filters'>('dsl');
  const [dslQuery, setDslQuery] = useState('{"query": {"match_all": {}}}');
  const [filters, setFilters] = useState([{ field: 'status', op: 'eq', value: 'active' }]);
  const [metrics, setMetrics] = useState<ElasticMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);
  const [indicesList, setIndicesList] = useState<ElasticIndexInfo[]>([]);
  const [indicesLoading, setIndicesLoading] = useState(false);
  const [indicesError, setIndicesError] = useState<string | null>(null);
  const [docs, setDocs] = useState<ElasticDocRow[]>([]);
  const [docsTotal, setDocsTotal] = useState(0);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);
  const [docsPage, setDocsPage] = useState(1);
  const [docsPageSize, setDocsPageSize] = useState(50);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [pendingDeleteDoc, setPendingDeleteDoc] = useState<ElasticDocRow | null>(null);
  const [isDeletingDoc, setIsDeletingDoc] = useState(false);
  const [createIndex, setCreateIndex] = useState<CreateIndexState>({
    open: false,
    name: '',
    shards: 3,
    replicas: 1,
    alias: '',
  });
  const [deleteIndexOpen, setDeleteIndexOpen] = useState(false);
  const [pendingDeleteIndex, setPendingDeleteIndex] = useState<string | null>(null);
  const [isDeletingIndex, setIsDeletingIndex] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: 'success' | 'error' | 'info' }>>([]);

  // 分隔条拖动相关状态
  const [leftWidth, setLeftWidth] = useState(280);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 处理拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // 处理拖拽中
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      if (newWidth >= 200 && newWidth <= containerRect.width - 400) {
        setLeftWidth(newWidth);
      }
    };
    const handleMouseUp = () => setIsDragging(false);
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };
  const [fieldsList, setFieldsList] = useState<string[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [queryError, setQueryError] = useState<string | null>(null);
  const [activeQuery, setActiveQuery] = useState<Record<string, any> | null>(null);
  const [docDialog, setDocDialog] = useState<DocDialogState>({
    open: false,
    mode: 'view',
    id: '',
    content: '',
  });

  const fetchMetrics = useCallback(async () => {
    if (!connectionId) return;
    setMetricsLoading(true);
    setMetricsError(null);
    try {
      const response = await fetch('/api/elastic/metrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const data = await response.json();
      if (!response.ok || data?.code !== 200) {
        throw new Error(data?.message || t('elasticTab.errorGettingMetrics'));
      }
      setMetrics(data.data);
    } catch (error: any) {
      setMetricsError(error?.message || t('elasticTab.errorGettingMetrics'));
    } finally {
      setMetricsLoading(false);
    }
  }, [connectionId]);

  const fetchIndices = useCallback(async () => {
    if (!connectionId) return;
    setIndicesLoading(true);
    setIndicesError(null);
    try {
      const response = await fetch('/api/elastic/indices/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId }),
      });
      const data = await response.json();
      if (!response.ok || data?.code !== 200) {
        throw new Error(data?.message || t('elasticTab.errorGettingIndices'));
      }
      setIndicesList(Array.isArray(data.data) ? data.data : []);
    } catch (error: any) {
      setIndicesError(error?.message || t('elasticTab.errorGettingIndices'));
    } finally {
      setIndicesLoading(false);
    }
  }, [connectionId]);

  const handleCreateIndex = async () => {
    if (!createIndex.name.trim()) {
      setCreateIndex(prev => ({ ...prev, error: t('elasticTab.pleaseEnterIndexName') }));
      return;
    }
    try {
      const response = await fetch('/api/elastic/indices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          name: createIndex.name.trim(),
          shards: createIndex.shards,
          replicas: createIndex.replicas,
          alias: createIndex.alias.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.code !== 200) {
        throw new Error(data?.message || t('elasticTab.errorCreatingIndex'));
      }
      setCreateIndex({ open: false, name: '', shards: 3, replicas: 1, alias: '' });
      fetchIndices();
      setSelectedIndex(createIndex.name.trim());
    } catch (error: any) {
      setCreateIndex(prev => ({ ...prev, error: error?.message || t('elasticTab.errorCreatingIndex') }));
    }
  };

  const handleDeleteIndex = (name: string) => {
    setPendingDeleteIndex(name);
    setDeleteIndexOpen(true);
  };

  const confirmDeleteIndex = async () => {
    if (!pendingDeleteIndex) return;
    setIsDeletingIndex(true);
    try {
      const response = await fetch('/api/elastic/indices/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, name: pendingDeleteIndex }),
      });
      const data = await response.json();
      if (!response.ok || data?.code !== 200) {
        throw new Error(data?.message || t('elasticTab.errorDeletingIndex'));
      }
      showToast(t('elasticTab.successDeletingIndex'), 'success');
      if (selectedIndexName === pendingDeleteIndex) {
        setSelectedIndex('');
        setDocs([]);
        setDocsTotal(0);
      }
      fetchIndices();
    } catch (error: any) {
      showToast(error?.message || t('elasticTab.errorDeletingIndex'), 'error');
    } finally {
      setIsDeletingIndex(false);
      setDeleteIndexOpen(false);
      setPendingDeleteIndex(null);
    }
  };

  const fetchFields = useCallback(async (indexName: string) => {
    if (!connectionId || !indexName) return;
    setFieldsLoading(true);
    setFieldsError(null);
    try {
      const response = await fetch('/api/elastic/indices/fields', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, index: indexName }),
      });
      const data = await response.json();
      if (!response.ok || data?.code !== 200) {
        throw new Error(data?.message || t('elasticTab.errorGettingFields'));
      }
      setFieldsList(Array.isArray(data.data) ? data.data : []);
    } catch (error: any) {
      setFieldsError(error?.message || t('elasticTab.errorGettingFields'));
    } finally {
      setFieldsLoading(false);
    }
  }, [connectionId]);

  const fetchDocs = useCallback(async (
    indexName: string,
    page = docsPage,
    pageSize = docsPageSize,
    query: Record<string, any> | null = activeQuery
  ) => {
    if (!connectionId || !indexName) return;
    setDocsLoading(true);
    setDocsError(null);
    try {
      const response = await fetch(query ? '/api/elastic/indices/search' : '/api/elastic/indices/docs/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(query ? {
          connectionId,
          index: indexName,
          query,
          from: Math.max(0, (page - 1) * pageSize),
          size: pageSize,
        } : {
          connectionId,
          index: indexName,
          from: Math.max(0, (page - 1) * pageSize),
          size: pageSize,
        }),
      });
      const data = await response.json();
      if (!response.ok || data?.code !== 200) {
        throw new Error(data?.message || t('elasticTab.errorGettingIndexData'));
      }
      setDocs(Array.isArray(data.data?.docs) ? data.data.docs : []);
      setDocsTotal(Number(data.data?.total || 0));
    } catch (error: any) {
      setDocsError(error?.message || t('elasticTab.errorGettingIndexData'));
    } finally {
      setDocsLoading(false);
    }
  }, [connectionId, docsPage, docsPageSize, activeQuery]);

  const handleCreateDoc = () => {
    setDocDialog({
      open: true,
      mode: 'create',
      id: '',
      content: JSON.stringify({ message: 'new document' }, null, 2),
    });
  };

  const handleViewDoc = (doc: ElasticDocRow) => {
    setDocDialog({
      open: true,
      mode: 'view',
      id: doc.id,
      content: JSON.stringify(doc.source || {}, null, 2),
    });
  };

  const handleEditDoc = (doc: ElasticDocRow) => {
    setDocDialog({
      open: true,
      mode: 'edit',
      id: doc.id,
      content: JSON.stringify(doc.source || {}, null, 2),
    });
  };

  const handleDeleteDoc = (doc: ElasticDocRow) => {
    setPendingDeleteDoc(doc);
    setDeleteConfirmOpen(true);
  };

  const confirmDeleteDoc = async () => {
    if (!selectedIndexName || !pendingDeleteDoc) return;
    setIsDeletingDoc(true);
    try {
      const response = await fetch('/api/elastic/indices/docs/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, index: selectedIndexName, id: pendingDeleteDoc.id }),
      });
      const data = await response.json();
      if (!response.ok || data?.code !== 200) {
        throw new Error(data?.message || t('elasticTab.errorDeleting'));
      }
      showToast(t('elasticTab.successDeleting'), 'success');
      fetchDocs(selectedIndexName, docsPage, docsPageSize);
    } catch (error: any) {
      showToast(error?.message || t('elasticTab.errorDeleting'), 'error');
    } finally {
      setIsDeletingDoc(false);
      setDeleteConfirmOpen(false);
      setPendingDeleteDoc(null);
    }
  };

  const handleSubmitDoc = async () => {
    if (!selectedIndexName) return;
    try {
      const payload = JSON.parse(docDialog.content || '{}');
      const endpoint =
        docDialog.mode === 'create' ? '/api/elastic/indices/docs/create' : '/api/elastic/indices/docs/update';
      const body: any = {
        connectionId,
        index: selectedIndexName,
        doc: payload,
      };
      if (docDialog.id) {
        body.id = docDialog.id;
      }
      if (docDialog.mode === 'edit' && !docDialog.id) {
        throw new Error('缺少文档 ID');
      }
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok || data?.code !== 200) {
        throw new Error(data?.message || t('elasticTab.errorSaving'));
      }
      setDocDialog(prev => ({ ...prev, open: false, error: undefined }));
      fetchDocs(selectedIndexName);
    } catch (error: any) {
      setDocDialog(prev => ({ ...prev, error: error?.message || t('elasticTab.errorSaving') }));
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchIndices();
  }, [fetchMetrics, fetchIndices]);

  const clusterHealth: ElasticHealth = metrics?.cluster?.status || 'unknown';
  const clusterStats = useMemo(() => ({
    indices: metrics?.stats?.indices ?? 0,
    docs: metrics?.stats?.docs ?? 0,
    size: formatBytes(metrics?.stats?.storeBytes ?? 0),
    shards: metrics?.stats?.shards ?? 0,
    nodes: metrics?.cluster?.nodes ?? 0,
    activeShards: metrics?.cluster?.activeShards ?? 0,
    queryPerSecond: metrics?.stats?.qps ?? 0,
    avgResponseTime: `${metrics?.stats?.avgResponseTimeMs ?? 0}ms`,
  }), [metrics]);
  const indices = metrics?.indices ?? [];
  const nodes = metrics?.nodes ?? [];
  const recentQueries: Array<{ query: string; user: string; time: string; duration: string }> = [];
  const activeAlerts: Array<{ id: number; level: 'warning' | 'info'; message: string; time: string }> = [];
  const indicesForMenu = indicesList.length > 0 ? indicesList : indices;
  const selectedIndexName = selectedIndex || indicesForMenu[0]?.name || '';

  useEffect(() => {
    if (selectedIndexName) {
      fetchDocs(selectedIndexName, docsPage, docsPageSize);
      fetchFields(selectedIndexName);
    }
  }, [selectedIndexName, docsPage, docsPageSize, fetchDocs, fetchFields]);

  useEffect(() => {
    if (!selectedIndex && indicesForMenu.length > 0) {
      setSelectedIndex(indicesForMenu[0].name);
    }
  }, [indicesForMenu, selectedIndex]);

  useEffect(() => {
    setDocsPage(1);
    setActiveQuery(null);
    setQueryError(null);
  }, [selectedIndexName]);

  const handleRunDslQuery = () => {
    if (!selectedIndexName) return;
    setQueryError(null);
    try {
      const parsed = JSON.parse(dslQuery || '{}');
      const query = parsed.query ? parsed.query : parsed;
      if (!query || typeof query !== 'object') {
        throw new Error(t('elasticTab.dslFormatInvalid'));
      }
      setActiveQuery(query);
      setDocsPage(1);
      fetchDocs(selectedIndexName, 1, docsPageSize, query);
    } catch (error: any) {
      setQueryError(error?.message || t('elasticTab.dslParseFailed'));
    }
  };

  const handleRunFilters = () => {
    if (!selectedIndexName) return;
    const activeFilters = filters.filter(item => item.field && item.value !== '');
    if (activeFilters.length === 0) {
      setActiveQuery(null);
      fetchDocs(selectedIndexName, 1, docsPageSize, null);
      return;
    }
    const clauses = activeFilters.map(item => {
      if (item.op === 'contains') {
        return { match: { [item.field]: item.value } };
      }
      if (item.op === 'not_contains') {
        return { bool: { must_not: [{ match: { [item.field]: item.value } }] } };
      }
      if (item.op === 'gt' || item.op === 'lt' || item.op === 'gte' || item.op === 'lte') {
        return { range: { [item.field]: { [item.op]: item.value } } };
      }
      if (item.op === 'neq') {
        return { bool: { must_not: [{ term: { [item.field]: item.value } }] } };
      }
      return { term: { [item.field]: item.value } };
    });
    const query = { bool: { filter: clauses } };
    setActiveQuery(query);
    setDocsPage(1);
    fetchDocs(selectedIndexName, 1, docsPageSize, query);
  };

  const handleResetQuery = () => {
    setActiveQuery(null);
    setQueryError(null);
    setDocsPage(1);
    if (selectedIndexName) {
      fetchDocs(selectedIndexName, 1, docsPageSize, null);
    }
  };

  const docColumns = useMemo(() => {
    if (docs.length === 0) return [];
    const keys = new Set<string>();
    docs.forEach(doc => {
      Object.keys(doc.source || {}).forEach(key => {
        if (keys.size < 5) {
          keys.add(key);
        }
      });
    });
    return Array.from(keys);
  }, [docs]);

  const healthText = {
    green: t('elasticTab.green'),
    yellow: t('elasticTab.yellow'),
    red: t('elasticTab.red'),
    unknown: t('elasticTab.unknown'),
  } as const;

  const healthDescription = {
    green: t('elasticTab.greenDescription'),
    yellow: t('elasticTab.yellowDescription'),
    red: t('elasticTab.redDescription'),
    unknown: t('elasticTab.unknownDescription'),
  } as const;

  return (
    <div ref={containerRef} className="h-full flex bg-[#F9FAFB]">
      {/* 左侧索引列表 */}
      <div
        style={{ width: `${leftWidth}px` }}
        className="flex flex-col border-r border-gray-200 bg-white overflow-hidden"
      >
        {/* 头部 */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white font-bold grid place-items-center text-sm">
              ES
            </div>
            <div>
              <div className="text-sm font-semibold text-gray-900">{connectionName}</div>
              <div className="text-[10px] text-gray-500">Elasticsearch</div>
            </div>
          </div>
        </div>

        {/* 搜索和新建按钮 */}
        <div className="px-3 py-2 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <i className="fas fa-search absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400"></i>
              <input
                className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-8 pr-3 py-1.5 text-xs text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent"
                placeholder={t('elasticTab.searchIndex')}
              />
            </div>
            <button
              className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              onClick={() => setCreateIndex(prev => ({ ...prev, open: true, error: undefined }))}
              title={t('elasticTab.newIndex')}
            >
              <i className="fas fa-plus"></i>
            </button>
          </div>
        </div>

        {/* 索引列表 */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {indicesError && (
            <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              {indicesError}
            </div>
          )}
          {indicesLoading && (
            <div className="text-center py-8 text-xs text-gray-500">{t('elasticTab.loading')}</div>
          )}
          {!indicesLoading && !indicesError && indicesForMenu.length === 0 && (
            <div className="text-center py-8 text-xs text-gray-500">{t('elasticTab.noIndices')}</div>
          )}
          <div className="space-y-1">
            {indicesForMenu.map(index => (
              <div key={index.name} className="relative group">
                <button
                  onClick={() => setSelectedIndex(index.name)}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                    selectedIndexName === index.name
                      ? 'bg-[#007acc] text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${
                      index.health === 'green' ? 'bg-emerald-500' :
                      index.health === 'yellow' ? 'bg-amber-500' : 'bg-red-500'
                    }`}></span>
                    <span className="flex-1 truncate font-medium">{index.name}</span>
                    <span className="text-[10px] opacity-70">{index.docs.toLocaleString()}</span>
                  </div>
                </button>
                {selectedIndexName !== index.name && (
                  <button
                    className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[10px] text-gray-400 hover:text-red-500 transition-all"
                    onClick={() => handleDeleteIndex(index.name)}
                    title={t('elasticTab.deleteIndex')}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 底部统计信息 */}
        <div className="px-3 py-2 border-t border-gray-200 bg-gray-50">
          <div className="text-[10px] text-gray-500">
            <div className="flex items-center justify-between mb-1">
              <span>集群健康</span>
              <span className={`font-semibold ${
                clusterHealth === 'green' ? 'text-emerald-600' :
                clusterHealth === 'yellow' ? 'text-amber-600' : 'text-red-600'
              }`}>
                {healthText[clusterHealth]}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>索引总数</span>
              <span className="font-semibold text-gray-700">{clusterStats.indices}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 可拖动分隔条 */}
      <div
        className="w-1 cursor-col-resize bg-gray-200 hover:bg-[#007acc] transition-colors relative group"
        onMouseDown={handleMouseDown}
      >
        <div className="absolute inset-y-0 -left-1 -right-1" />
      </div>

      {/* 右侧详情区 */}
      <div className="flex-1 flex flex-col overflow-hidden bg-white">
        {selectedIndexName ? (
          <>
            {/* 面包屑导航 */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-gray-600">
                <i className="fas fa-database text-[#007acc]"></i>
                <span>/</span>
                <span className="font-semibold text-gray-900">{selectedIndexName}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                  onClick={() => {
                    fetchDocs(selectedIndexName, docsPage, docsPageSize);
                    fetchFields(selectedIndexName);
                  }}
                  disabled={docsLoading}
                >
                  <i className="fas fa-sync-alt mr-1"></i>
                  {t('elasticTab.refresh')}
                </button>
              </div>
            </div>

            {/* 查询区域 */}
            <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-semibold text-gray-700">{t('elasticTab.dataQuery')}</div>
                <div className="flex items-center gap-2">
                  <button
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                      queryMode === 'dsl' ? 'bg-[#007acc] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setQueryMode('dsl')}
                  >
                    {t('elasticTab.dsl')}
                  </button>
                  <button
                    className={`px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors ${
                      queryMode === 'filters' ? 'bg-[#007acc] text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
                    }`}
                    onClick={() => setQueryMode('filters')}
                  >
                    {t('elasticTab.fieldFilter')}
                  </button>
                </div>
              </div>

              {queryMode === 'dsl' ? (
                <div className="space-y-2">
                  <textarea
                    value={dslQuery}
                    onChange={e => setDslQuery(e.target.value)}
                    className="w-full h-20 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent"
                    placeholder='{"query": {"match_all": {}}}'
                  />
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg bg-[#007acc] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#005a9e] transition-colors"
                      onClick={handleRunDslQuery}
                    >
                      {t('elasticTab.executeQuery')}
                    </button>
                    <button
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={handleResetQuery}
                    >
                      {t('elasticTab.reset')}
                    </button>
                    {queryError && <span className="text-[10px] text-red-600">{queryError}</span>}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {filters.map((filter, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <select
                        value={filter.field}
                        onChange={e => {
                          const next = [...filters];
                          next[idx] = { ...next[idx], field: e.target.value };
                          setFilters(next);
                        }}
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#007acc]"
                      >
                        <option value="">{t('elasticTab.selectAllFields')}</option>
                        {fieldsList.map(field => (
                          <option key={field} value={field}>{field}</option>
                        ))}
                      </select>
                      <select
                        value={filter.op}
                        onChange={e => {
                          const next = [...filters];
                          next[idx] = { ...next[idx], op: e.target.value };
                          setFilters(next);
                        }}
                        className="w-24 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#007acc]"
                      >
                        <option value="eq">{t('elasticTab.equals')}</option>
                        <option value="neq">{t('elasticTab.notEquals')}</option>
                        <option value="contains">{t('elasticTab.contains')}</option>
                        <option value="not_contains">{t('elasticTab.notContains')}</option>
                        <option value="gt">{t('elasticTab.greaterThan')}</option>
                        <option value="gte">{t('elasticTab.greaterThanOrEqual')}</option>
                        <option value="lt">{t('elasticTab.lessThan')}</option>
                        <option value="lte">{t('elasticTab.lessThanOrEqual')}</option>
                      </select>
                      <input
                        value={filter.value}
                        onChange={e => {
                          const next = [...filters];
                          next[idx] = { ...next[idx], value: e.target.value };
                          setFilters(next);
                        }}
                        className="flex-1 rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#007acc]"
                        placeholder={t('elasticTab.value')}
                      />
                      <button
                        className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-500 hover:text-red-500 hover:bg-red-50 transition-colors"
                        onClick={() => setFilters(filters.filter((_, i) => i !== idx))}
                      >
                        <i className="fas fa-times"></i>
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-2">
                    <button
                      className="rounded-lg border border-dashed border-[#007acc] bg-blue-50 px-3 py-1.5 text-xs font-semibold text-[#007acc] hover:bg-blue-100 transition-colors"
                      onClick={() => setFilters([...filters, { field: '', op: 'eq', value: '' }])}
                    >
                      {t('elasticTab.addCondition')}
                    </button>
                    <button
                      className="rounded-lg bg-[#007acc] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#005a9e] transition-colors"
                      onClick={handleRunFilters}
                    >
                      {t('elasticTab.applyFilter')}
                    </button>
                    <button
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      onClick={handleResetQuery}
                    >
                      {t('elasticTab.reset')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 数据表格 */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                <div className="text-xs text-gray-600">
                  共 <span className="font-semibold text-gray-900">{docsTotal || docs.length}</span> {t('elasticTab.recordCount')}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-lg bg-[#007acc] px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-[#005a9e] transition-colors"
                    onClick={handleCreateDoc}
                  >
                    <i className="fas fa-plus mr-1"></i>
                    {t('elasticTab.newDocument')}
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                {docsError && (
                  <div className="px-4 py-3 text-xs text-red-600">{docsError}</div>
                )}
                {docsLoading && (
                  <div className="px-4 py-8 text-center text-xs text-gray-500">{t('elasticTab.loading')}</div>
                )}
                {!docsLoading && !docsError && docs.length === 0 && (
                  <div className="px-4 py-8 text-center text-xs text-gray-500">{t('elasticTab.noDocuments')}</div>
                )}
                {docs.length > 0 && (
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-50 text-gray-600 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left font-semibold border-b border-gray-200">{t('elasticTab.id')}</th>
                        {docColumns.map(col => (
                          <th key={col} className="px-3 py-2 text-left font-semibold border-b border-gray-200">{col}</th>
                        ))}
                        <th className="px-3 py-2 text-left font-semibold border-b border-gray-200 sticky right-0 bg-gray-50">{t('elasticTab.operation')}</th>
                      </tr>
                    </thead>
                    <tbody className="text-gray-700">
                      {docs.map(doc => (
                        <tr key={doc.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="px-3 py-2 font-mono text-[10px] text-gray-500">{doc.id}</td>
                          {docColumns.map(col => (
                            <td key={`${doc.id}-${col}`} className="px-3 py-2">
                              {typeof doc.source?.[col] === 'object'
                                ? JSON.stringify(doc.source?.[col])
                                : String(doc.source?.[col] ?? '')}
                            </td>
                          ))}
                          <td className="px-3 py-2 sticky right-0 bg-white">
                            <div className="flex items-center gap-1">
                              <button
                                className="rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
                                onClick={() => handleViewDoc(doc)}
                              >
                                {t('elasticTab.view')}
                              </button>
                              <button
                                className="rounded border border-gray-200 px-2 py-0.5 text-[10px] text-gray-600 hover:bg-gray-50"
                                onClick={() => handleEditDoc(doc)}
                              >
                                {t('elasticTab.edit')}
                              </button>
                              <button
                                className="rounded border border-red-200 px-2 py-0.5 text-[10px] text-red-600 hover:bg-red-50"
                                onClick={() => handleDeleteDoc(doc)}
                              >
                                {t('elasticTab.delete')}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* 分页 */}
              <div className="px-4 py-2 border-t border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setDocsPage(prev => Math.max(1, prev - 1))}
                    disabled={docsPage <= 1 || docsLoading}
                  >
                    {t('elasticTab.previousPage')}
                  </button>
                  <span className="text-xs text-gray-600">{t('elasticTab.currentPage', { page: docsPage })}</span>
                  <button
                    className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setDocsPage(prev => prev + 1)}
                    disabled={docsLoading || docsPage * docsPageSize >= docsTotal}
                  >
                    {t('elasticTab.nextPage')}
                  </button>
                </div>
                <select
                  className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#007acc]"
                  value={docsPageSize}
                  onChange={e => {
                    setDocsPageSize(Number(e.target.value));
                    setDocsPage(1);
                  }}
                >
                  {[10, 20, 50, 100].map(size => (
                    <option key={size} value={size}>{t('elasticTab.perPage', { size: size })}</option>
                  ))}
                </select>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-500">
            <div className="text-center">
              <i className="fas fa-database text-4xl text-gray-300 mb-3"></i>
              <div>{t('elasticTab.pleaseSelectIndex')}</div>
            </div>
          </div>
        )}
      </div>

      {/* 文档查看/编辑弹窗 */}
      {docDialog.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
              <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div className="text-sm font-semibold text-slate-900">
                    {docDialog.mode === 'create' ? t('elasticTab.createDocument') : docDialog.mode === 'edit' ? t('elasticTab.editDocument') : t('elasticTab.viewDocument')}
                  </div>
                  <button
                    className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                    onClick={() => setDocDialog(prev => ({ ...prev, open: false, error: undefined }))}
                  >
                    {t('elasticTab.close')}
                  </button>
                </div>
                <div className="space-y-4 px-5 py-4">
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    <div className="text-xs text-slate-500">
                      {t('elasticTab.index')}<span className="font-semibold text-slate-700">{selectedIndexName || '-'}</span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {t('elasticTab.documentId')}
                      <input
                        value={docDialog.id}
                        onChange={event => setDocDialog(prev => ({ ...prev, id: event.target.value }))}
                        disabled={docDialog.mode === 'view'}
                        className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-slate-700"
                        placeholder={t('elasticTab.autoGenerate')}
                      />
                    </div>
                  </div>
                  <textarea
                    value={docDialog.content}
                    onChange={event => setDocDialog(prev => ({ ...prev, content: event.target.value }))}
                    readOnly={docDialog.mode === 'view'}
                    className="h-64 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-200"
                  />
                  {docDialog.error && (
                    <div className="text-xs text-amber-700">{docDialog.error}</div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                    onClick={() => setDocDialog(prev => ({ ...prev, open: false, error: undefined }))}
                  >
                    {t('elasticTab.cancel')}
                  </button>
                  {docDialog.mode !== 'view' && (
                    <button
                      className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                      onClick={handleSubmitDoc}
                    >
                      {t('elasticTab.save')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {createIndex.open && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
              <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
                  <div className="text-sm font-semibold text-slate-900">{t('elasticTab.createIndex')}</div>
                  <button
                    className="rounded-full border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:bg-slate-50"
                    onClick={() => setCreateIndex(prev => ({ ...prev, open: false, error: undefined }))}
                  >
                    {t('elasticTab.close')}
                  </button>
                </div>
                <div className="space-y-3 px-5 py-4 text-xs text-slate-600">
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">{t('elasticTab.indexName')}</span>
                    <input
                      value={createIndex.name}
                      onChange={event => setCreateIndex(prev => ({ ...prev, name: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                      placeholder={t('elasticTab.exampleIndexName')}
                    />
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-500">{t('elasticTab.shards')}</span>
                      <input
                        type="number"
                        min={1}
                        value={createIndex.shards}
                        onChange={event => setCreateIndex(prev => ({ ...prev, shards: Number(event.target.value) }))}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                      />
                    </label>
                    <label className="block">
                      <span className="mb-1 block text-[11px] font-semibold text-slate-500">{t('elasticTab.replicas')}</span>
                      <input
                        type="number"
                        min={0}
                        value={createIndex.replicas}
                        onChange={event => setCreateIndex(prev => ({ ...prev, replicas: Number(event.target.value) }))}
                        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                      />
                    </label>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-[11px] font-semibold text-slate-500">{t('elasticTab.alias')}</span>
                    <input
                      value={createIndex.alias}
                      onChange={event => setCreateIndex(prev => ({ ...prev, alias: event.target.value }))}
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                      placeholder={t('elasticTab.exampleAlias')}
                    />
                  </label>
                  {createIndex.error && (
                    <div className="text-[11px] text-amber-600">{createIndex.error}</div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-4">
                  <button
                    className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50"
                    onClick={() => setCreateIndex(prev => ({ ...prev, open: false, error: undefined }))}
                  >
                    {t('elasticTab.cancel')}
                  </button>
                  <button
                    className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700"
                    onClick={handleCreateIndex}
                  >
                    {t('elasticTab.create')}
                  </button>
                </div>
              </div>
            </div>
          )}

          <DeleteConfirmDialog
            open={deleteConfirmOpen}
            title={t('elasticTab.document')}
            content={pendingDeleteDoc?.id || ''}
            onConfirm={confirmDeleteDoc}
            onCancel={() => {
              if (isDeletingDoc) return;
              setDeleteConfirmOpen(false);
              setPendingDeleteDoc(null);
            }}
            isLoading={isDeletingDoc}
          />

          <DeleteConfirmDialog
            open={deleteIndexOpen}
            title={t('elasticTab.indexText')}
            content={pendingDeleteIndex || ''}
            onConfirm={confirmDeleteIndex}
            onCancel={() => {
              if (isDeletingIndex) return;
              setDeleteIndexOpen(false);
              setPendingDeleteIndex(null);
            }}
            isLoading={isDeletingIndex}
          />

      {/* Toast 提示 */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[260px] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${
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
