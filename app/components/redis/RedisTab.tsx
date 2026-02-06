'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { parseFullKey } from './utils';
import {
  StringKeyDetail,
  HashKeyDetail,
  ListKeyDetail,
  SetKeyDetail,
  ZSetKeyDetail,
  StreamKeyDetail
} from './key-details';

interface Database {
  dbIndex: number;
  keyCount: number;
  isApproximate?: boolean; // Whether it is an approximation
}

// Tree node type
interface TreeNode {
  key: string;
  label: string;
  type: 'folder' | 'key';
  children?: TreeNode[];
  count?: number;
}

interface RedisTabProps {
  connectionId: string;
  connectionName: string;
  onConnectionFailed?: (error: string) => void;
}

export default function RedisTab({ connectionId, connectionName, onConnectionFailed }: RedisTabProps) {
  const { t } = useLanguage();
  const [databases, setDatabases] = useState<Database[]>([]);
  const [mode, setMode] = useState<'standalone' | 'cluster'>('standalone');
  const [selectedDb, setSelectedDb] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<string>('');

  // Tree view related states
  const [expandedDbs, setExpandedDbs] = useState<Set<number>>(new Set()); // Expanded databases
  const [dbKeys, setDbKeys] = useState<Map<number, TreeNode[]>>(new Map()); // Key tree for each database
  const [loadingKeys, setLoadingKeys] = useState<Set<number>>(new Set()); // Databases with keys being loaded
  const [hideEmptyDbs, setHideEmptyDbs] = useState(false); // Whether to hide empty databases
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set()); // Expanded folders
  const [keysLimit, setKeysLimit] = useState<number>(10000); // Limit on the number of keys to retrieve
  const [selectedKey, setSelectedKey] = useState<string | null>(null); // Selected key
  const [keyDetails, setKeyDetails] = useState<any>(null); // Key details data
  const [loadingKeyDetails, setLoadingKeyDetails] = useState(false); // Loading key details status

  // Dialog states
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [renameInputValue, setRenameInputValue] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [expireDialogOpen, setExpireDialogOpen] = useState(false);
  const [expireInputValue, setExpireInputValue] = useState('');
  const [currentOperatingKey, setCurrentOperatingKey] = useState<string | null>(null);

  // Add key-value dialog states
  const [addKeyDialogOpen, setAddKeyDialogOpen] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyType, setNewKeyType] = useState<'string' | 'hash' | 'list' | 'set' | 'zset' | 'stream'>('string');
  const [newKeyValue, setNewKeyValue] = useState(''); // Value for string type
  const [newKeyTtl, setNewKeyTtl] = useState(''); // Expiration time
  const [newKeyFields, setNewKeyFields] = useState<Array<{name: string, value: string}>>([{name: '', value: ''}]); // Hash fields
  const [newKeyValues, setNewKeyValues] = useState<string[]>(['']); // List/Set values
  const [newKeyMembers, setNewKeyMembers] = useState<Array<{value: string, score: string}>>([{value: '', score: '0'}]); // ZSet members
  const [newKeyStreamFields, setNewKeyStreamFields] = useState<Array<{name: string, value: string}>>([{name: '', value: ''}]); // Stream fields
  const [isAddingKey, setIsAddingKey] = useState(false);

  // Filter search states
  const [filterPattern, setFilterPattern] = useState(''); // Filter pattern
  const [isReloading, setIsReloading] = useState(false); // Reloading status

  // Toast notification states
  const [toasts, setToasts] = useState<Array<{id: string; message: string; type: 'success' | 'error' | 'info'}>>([]);

  // Display Toast notifications
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // 3秒后自动消失
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  // Divider drag related states
  const [leftWidth, setLeftWidth] = useState(280); // Default left panel width
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 打开连接
  useEffect(() => {
    async function openConnection() {
      try {
        setLoading(true);
        setError(null);

        const response = await fetch('/api/redis/connections/open', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ id: connectionId }),
        });

        const result = await response.json();

        if (result.code === 200 && result.data) {
          setDatabases(result.data.databases);
          setMode(result.data.mode);
          setConnectionInfo(result.data.connectionInfo);
          
          // Default to selecting the first database
          if (result.data.databases.length > 0) {
            setSelectedDb(result.data.databases[0].dbIndex);
          }
        } else {
          const errorMsg = result.message || t('redisTab.connectionFailed');
          setError(errorMsg);
          onConnectionFailed?.(errorMsg);
        }
      } catch (err: any) {
        const errorMsg = `${t('redis.openConnectionFailed')}: ${err?.message || t('common.unknownError')}`;
        setError(errorMsg);
        onConnectionFailed?.(errorMsg);
      } finally {
        setLoading(false);
      }
    }

    openConnection();

    // 组件卸载时关闭连接
    return () => {
      fetch('/api/redis/connections/open', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: connectionId }),
      }).catch(console.error);
    };
  }, [connectionId, onConnectionFailed]);

  // Toggle database expand/collapse
  const toggleDatabase = async (dbIndex: number) => {
    const newExpanded = new Set(expandedDbs);
    
    if (newExpanded.has(dbIndex)) {
      // 如果已展开，则折叠
      newExpanded.delete(dbIndex);
      setExpandedDbs(newExpanded);
    } else {
      // 如果未展开，则展开并加载键列表
      newExpanded.add(dbIndex);
      setExpandedDbs(newExpanded);
      
      // 如果还没有加载过这个数据库的键，则加载
      if (!dbKeys.has(dbIndex)) {
        await loadDatabaseKeys(dbIndex);
      }
    }
  };

  // Load key list for specified database
  const loadDatabaseKeys = async (dbIndex: number) => {
    const newLoadingKeys = new Set(loadingKeys);
    newLoadingKeys.add(dbIndex);
    setLoadingKeys(newLoadingKeys);

    try {
      const response = await fetch('/api/redis/connections/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: connectionId, 
          dbIndex,
          pattern: '*', // 默认获取所有键
          limit: keysLimit,   // 使用配置的 limit
        }),
      });

      const result = await response.json();

      if (result.code === 200 && result.data) {
        const newDbKeys = new Map(dbKeys);
        newDbKeys.set(dbIndex, result.data.tree || []); // 使用树形结构
        setDbKeys(newDbKeys);
      }
    } catch (error) {
      console.error(`加载 db${dbIndex} 的键列表失败:`, error);
    } finally {
      const newLoadingKeys = new Set(loadingKeys);
      newLoadingKeys.delete(dbIndex);
      setLoadingKeys(newLoadingKeys);
    }
  };

  // Toggle folder expand/collapse
  const toggleFolder = (folderKey: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderKey)) {
      newExpanded.delete(folderKey);
    } else {
      newExpanded.add(folderKey);
    }
    setExpandedFolders(newExpanded);
  };

  // Recursively render tree nodes
  const renderTreeNode = (node: TreeNode, level: number = 0, dbIndex?: number): React.ReactNode => {
    const paddingLeft = 28 + level * 20; // 基础 28px（db 下一级）+ 每级缩进 20px
    
    if (node.type === 'folder') {
      const isExpanded = expandedFolders.has(node.key);
      
      return (
        <div key={node.key}>
          {/* 文件夹节点 */}
          <div
            className="hover:bg-gray-100 cursor-pointer transition-colors flex items-center gap-2 py-1.5"
            style={{ paddingLeft: `${paddingLeft}px` }}
            onClick={() => toggleFolder(node.key)}
          >
            <i className={`fas fa-caret-${isExpanded ? 'down' : 'right'} text-xs text-gray-400`}></i>
            <i className="fas fa-folder text-base text-yellow-500"></i>
            <span className="text-sm text-gray-800 flex-1 font-medium">{node.label}</span>
            {node.count !== undefined && (
              <span className="text-xs text-gray-500 mr-3">({node.count})</span>
            )}
          </div>
          
          {/* 子节点 */}
          {isExpanded && node.children && (
            <div>
              {node.children.map(child => renderTreeNode(child, level + 1, dbIndex))}
            </div>
          )}
        </div>
      );
    } else {
      // 键节点
      return (
        <div
          key={node.key}
          className="hover:bg-gray-100 cursor-pointer transition-colors flex items-center gap-2 py-1.5"
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={(e) => {
            e.stopPropagation();
            // 构造完整的key格式: connectionId-dbIndex-actualKey
            const fullKey = `${connectionId}-${dbIndex}-${node.key}`;
            console.log('[RedisTab] 点击key:', { nodeKey: node.key, dbIndex, fullKey, nodeType: node.type });
            handleSelectKey(fullKey);
          }}
        >
          <i className="fas fa-key text-sm text-orange-500 ml-4"></i>
          <span className="text-sm text-gray-700 truncate flex-1" title={node.key}>
            {node.label}
          </span>
        </div>
      );
    }
  };

  // 处理拖动开始
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // 处理拖动中
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging || !containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;

      // 限制最小和最大宽度
      const minWidth = 200;
      const maxWidth = containerRect.width - 400;
      
      if (newWidth >= minWidth && newWidth <= maxWidth) {
        setLeftWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);
  
  // 处理选择key
  const handleSelectKey = async (key: string | null) => {
    if (!key) {
      setSelectedKey(null);
      setKeyDetails(null);
      return;
    }
    
    console.log('[RedisTab] 选中key:', { key, connectionId });
    setSelectedKey(key);
    setLoadingKeyDetails(true);
    
    try {
      const { connectionId: connId, dbIndex, actualKey } = parseFullKey(key);
      const response = await fetch('/api/redis/connections/key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ connectionId: connId, dbIndex, key: actualKey }),
      });
      
      const result = await response.json();
      
      if (result.code === 200 && result.data) {
        setKeyDetails(result.data);
      } else if (result.code === 404) {
        // key不存在的情况
        console.error('获取key详情失败:', result.message);
        showToast(`错误: ${result.message}`, 'error');
        setKeyDetails(null);
      } else {
        console.error('获取key详情失败:', result.message);
        setKeyDetails(null);
      }
    } catch (error) {
      console.error('获取key详情失败:', error);
      setKeyDetails(null);
    } finally {
      setLoadingKeyDetails(false);
    }
  };
  
  // 渲染key详情内容
  const renderKeyDetailContent = (details: any) => {
    switch (details.type) {
      case 'string':
        return <StringKeyDetail keyDetails={details} onKeyUpdate={handleSelectKey} showToast={showToast} />;
      case 'hash':
        return <HashKeyDetail keyDetails={details} onKeyUpdate={handleSelectKey} showToast={showToast} />;
      case 'list':
        return <ListKeyDetail keyDetails={details} onKeyUpdate={handleSelectKey} showToast={showToast} />;
      case 'set':
        return <SetKeyDetail keyDetails={details} onKeyUpdate={handleSelectKey} showToast={showToast} />;
      case 'zset':
        return <ZSetKeyDetail keyDetails={details} onKeyUpdate={handleSelectKey} showToast={showToast} />;
      case 'stream':
        return <StreamKeyDetail keyDetails={details} onKeyUpdate={handleSelectKey} showToast={showToast} />;
      default:
        return (
          <div className="p-4 text-center text-gray-500">
            不支持的数据类型: {details.type}
          </div>
        );
    }
  };
  
  // 重命名key - 打开对话框
  const handleRenameKey = (key: string) => {
    const actualKeyName = key.split('-').slice(2).join('-');
    setCurrentOperatingKey(key);
    setRenameInputValue(actualKeyName);
    setRenameDialogOpen(true);
  };
  
  // 执行重命名
  const executeRename = async () => {
    if (!currentOperatingKey || !renameInputValue.trim()) {
      showToast('请输入有效的新key名称', 'info');
      return;
    }
    
    try {
      const { connectionId: connId, dbIndex, actualKey } = parseFullKey(currentOperatingKey);
      const response = await fetch('/api/redis/connections/key/rename', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connId, dbIndex, key: actualKey, newKey: renameInputValue.trim() }),
      });
      
      const result = await response.json();
      if (result.code === 200) {
        showToast(t('redis.renameSuccess'), 'success');
        setRenameDialogOpen(false);
        setRenameInputValue('');
        
        // 解析当前key信息获取dbIndex
        const keyParts = currentOperatingKey.split('-');
        const connectionIdWithDb = keyParts.slice(0, -1).join('-');
        const lastDashIndex = connectionIdWithDb.lastIndexOf('-');
        const dbIndex = parseInt(connectionIdWithDb.substring(lastDashIndex + 1));
        
        // 刷新当前数据库的key列表
        if (!isNaN(dbIndex)) {
          const newDbKeys = new Map(dbKeys);
          newDbKeys.delete(dbIndex);
          setDbKeys(newDbKeys);
          await loadDatabaseKeys(dbIndex);
        }
        
        // 重新加载key详情
        const newFullKey = `${keyParts[0]}-${keyParts[1]}-${renameInputValue.trim()}`;
        handleSelectKey(newFullKey);
      } else {
        showToast(`重命名失败: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('重命名key失败:', error);
      showToast('重命名失败: ' + (error as Error).message, 'error');
    }
  };
  
  // 删除key - 打开确认对话框
  const handleDeleteKey = (key: string) => {
    setCurrentOperatingKey(key);
    setDeleteConfirmOpen(true);
  };
  
  // 执行删除
  const executeDelete = async () => {
    if (!currentOperatingKey) return;
    
    try {
      const { connectionId: connId, dbIndex, actualKey } = parseFullKey(currentOperatingKey);
      const response = await fetch('/api/redis/connections/key/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connId, dbIndex, key: actualKey }),
      });
      
      const result = await response.json();
      if (result.code === 200) {
        showToast(t('redis.deleteSuccess'), 'success');
        setDeleteConfirmOpen(false);
        
        // 解析当前key信息获取dbIndex
        const keyParts = currentOperatingKey.split('-');
        const connectionIdWithDb = keyParts.slice(0, -1).join('-');
        const lastDashIndex = connectionIdWithDb.lastIndexOf('-');
        const dbIndex = parseInt(connectionIdWithDb.substring(lastDashIndex + 1));
        
        // 刷新当前数据库的key列表
        if (!isNaN(dbIndex)) {
          const newDbKeys = new Map(dbKeys);
          newDbKeys.delete(dbIndex);
          setDbKeys(newDbKeys);
          await loadDatabaseKeys(dbIndex);
        }
        
        // 返回到key列表
        handleSelectKey(null);
      } else {
        showToast(`删除失败: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('删除key失败:', error);
      showToast('删除失败: ' + (error as Error).message, 'error');
    }
  };
  
  // 设置过期时间 - 打开对话框
  const handleSetExpire = (key: string, currentTtl: number) => {
    setCurrentOperatingKey(key);
    setExpireInputValue(currentTtl === -1 ? '' : currentTtl.toString());
    setExpireDialogOpen(true);
  };
  
  // 执行设置过期时间
  const executeSetExpire = async () => {
    if (!currentOperatingKey) return;
    
    const ttlValue = expireInputValue.trim() === '' ? -1 : parseInt(expireInputValue);
    if (isNaN(ttlValue) || (ttlValue !== -1 && ttlValue <= 0)) {
      showToast('请输入有效的过期时间（秒数，-1表示永不过期）', 'info');
      return;
    }
    
    try {
      const { connectionId: connId, dbIndex, actualKey } = parseFullKey(currentOperatingKey);
      // 如果ttl为-1，表示要设置为永不过期，发送-1让后端处理
      const response = await fetch('/api/redis/connections/key/expire', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId: connId, dbIndex, key: actualKey, ttl: ttlValue }),
      });
      
      const result = await response.json();
      if (result.code === 200) {
        showToast(t('redis.expireSetSuccess'), 'success');
        setExpireDialogOpen(false);
        setExpireInputValue('');
        // 重新加载key详情
        handleSelectKey(currentOperatingKey);
      } else {
        showToast(`设置过期时间失败: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('设置过期时间失败:', error);
      showToast('设置过期时间失败: ' + (error as Error).message, 'error');
    }
  };

  // 打开添加键值对话框
  const handleOpenAddKeyDialog = () => {
    // 重置表单
    setNewKeyName('');
    setNewKeyType('string');
    setNewKeyValue('');
    setNewKeyTtl('');
    setNewKeyFields([{name: '', value: ''}]);
    setNewKeyValues(['']);
    setNewKeyMembers([{value: '', score: '0'}]);
    setNewKeyStreamFields([{name: '', value: ''}]);
    setAddKeyDialogOpen(true);
  };

  // 执行添加键值
  const executeAddKey = async () => {
    if (!newKeyName.trim()) {
      showToast(t('redis.pleaseEnterKeyName'), 'info');
      return;
    }

    setIsAddingKey(true);
    try {
      const requestBody: any = {
        connectionId,
        dbIndex: selectedDb,
        key: newKeyName.trim(),
        type: newKeyType,
        ttl: newKeyTtl ? parseInt(newKeyTtl) : undefined,
      };

      // 根据类型添加对应的数据
      switch (newKeyType) {
        case 'string':
          requestBody.value = newKeyValue;
          break;
        case 'hash':
          const validFields = newKeyFields.filter(f => f.name.trim());
          if (validFields.length === 0) {
            showToast(t('redis.pleaseAddAtLeastOneField'), 'info');
            setIsAddingKey(false);
            return;
          }
          requestBody.fields = validFields;
          break;
        case 'list':
        case 'set':
          const validValues = newKeyValues.filter(v => v.trim());
          if (validValues.length === 0) {
            showToast(newKeyType === 'list' ? t('redis.pleaseAddAtLeastOneElement') : t('redis.pleaseAddAtLeastOneMember'), 'info');
            setIsAddingKey(false);
            return;
          }
          requestBody.values = validValues;
          break;
        case 'zset':
          const validMembers = newKeyMembers.filter(m => m.value.trim());
          if (validMembers.length === 0) {
            showToast(t('redis.pleaseAddAtLeastOneMember'), 'info');
            setIsAddingKey(false);
            return;
          }
          requestBody.members = validMembers.map(m => ({
            value: m.value,
            score: parseFloat(m.score) || 0,
          }));
          break;
        case 'stream':
          const validStreamFields = newKeyStreamFields.filter(f => f.name.trim());
          if (validStreamFields.length === 0) {
            showToast(t('redis.pleaseAddAtLeastOneField'), 'info');
            setIsAddingKey(false);
            return;
          }
          const streamFieldsObj: {[key: string]: string} = {};
          validStreamFields.forEach(f => {
            streamFieldsObj[f.name] = f.value;
          });
          requestBody.streamFields = streamFieldsObj;
          break;
      }

      const response = await fetch('/api/redis/connections/key/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });

      const result = await response.json();
      if (result.code === 200) {
        showToast(t('redis.addSuccess'), 'success');
        setAddKeyDialogOpen(false);
        
        // 刷新当前数据库的key列表
        const newDbKeys = new Map(dbKeys);
        newDbKeys.delete(selectedDb);
        setDbKeys(newDbKeys);
        await loadDatabaseKeys(selectedDb);
      } else {
        showToast(`添加失败: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error('添加键值失败:', error);
      showToast('添加失败: ' + (error as Error).message, 'error');
    } finally {
      setIsAddingKey(false);
    }
  };

  // 重新载入当前数据库的key列表（根据过滤条件）
  const handleReloadKeys = async () => {
    if (!expandedDbs.has(selectedDb)) {
      // 如果当前数据库未展开，先展开它
      await toggleDatabase(selectedDb);
      return;
    }
    
    setIsReloading(true);
    try {
      // 准备pattern，如果为空则使用 '*'
      const pattern = filterPattern.trim() || '*';
      
      const response = await fetch('/api/redis/connections/keys', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: connectionId, 
          dbIndex: selectedDb,
          pattern: pattern,
          limit: keysLimit,
        }),
      });

      const result = await response.json();

      if (result.code === 200 && result.data) {
        const newDbKeys = new Map(dbKeys);
        newDbKeys.set(selectedDb, result.data.tree || []);
        setDbKeys(newDbKeys);
        
        // 如果有过滤条件，显示提示
        if (pattern !== '*') {
          console.log(`已加载 db${selectedDb} 的键列表 (pattern: ${pattern})`);
        }
      } else {
        showToast(`加载失败: ${result.message}`, 'error');
      }
    } catch (error) {
      console.error(`重新加载 db${selectedDb} 的键列表失败:`, error);
      showToast('加载失败: ' + (error as Error).message, 'error');
    } finally {
      setIsReloading(false);
    }
  };

  // 获取模式图标
  const getModeIcon = () => {
    if (mode === 'cluster') {
      return 'fa-sitemap';
    }
    return 'fa-server';
  };

  // 获取模式颜色
  const getModeColor = () => {
    if (mode === 'cluster') {
      return '#722ED1';
    }
    return '#F53F3F';
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-[#007acc] mb-4"></i>
          <p className="text-gray-600">{t('redisTab.connecting')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <i className="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
          <h3 className="text-xl font-bold text-gray-800 mb-2">{t('redisTab.connectionFailed')}</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex bg-[#F9FAFB]" style={{ userSelect: isDragging ? 'none' : 'auto' }}>
      {/* 左侧：数据库列表 */}
      <div
        className="flex flex-col bg-white border-r border-gray-200"
        style={{ width: `${leftWidth}px`, minWidth: '200px' }}
      >
        {/* 连接信息头部 */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <i 
              className={`fas ${getModeIcon()} text-lg`} 
              style={{ color: getModeColor() }}
            ></i>
            <h3 className="font-semibold text-gray-800 text-sm truncate" title={connectionName}>
              {connectionName}
            </h3>
          </div>
          <p className="text-xs text-gray-500 truncate" title={connectionInfo}>
            {connectionInfo}
          </p>
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
              <i className="fas fa-check-circle mr-1"></i>
              {t('redis.connected')}
            </span>
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
              {mode === 'cluster' ? t('redis.clusterMode') : t('redis.standaloneMode')}
            </span>
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
              {t('redis.databaseCount', { count: databases.length })}
            </span>
          </div>
          {mode === 'cluster' && databases.length > 0 && (
            <div className="mt-2 text-xs text-gray-500 flex items-start gap-1">
              <i className="fas fa-info-circle mt-0.5 text-blue-500"></i>
              <span>
                {databases[0].isApproximate 
                  ? t('redis.approximateKeyCount') 
                  : t('redis.totalKeyCount')}
              </span>
            </div>
          )}
          
          {/* Limit 配置和隐藏空数据库 */}
          <div className="mt-3">
            <label className="block text-xs text-gray-600 mb-1">{t('redisTab.keysLimitLabel')}</label>
            <input
              type="number"
              value={keysLimit}
              onChange={(e) => setKeysLimit(Math.max(1, parseInt(e.target.value) || 10000))}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc]"
              placeholder={t('redis.keysLoadLimit')}
              min="1"
            />
            <div className="flex items-center justify-between mt-1">
              <p className="text-xs text-gray-500">{t('redisTab.maxKeysLoaded', { count: keysLimit.toLocaleString() })}</p>
              <label className="flex items-center gap-1.5 cursor-pointer whitespace-nowrap">
                <input
                  type="checkbox"
                  checked={hideEmptyDbs}
                  onChange={(e) => setHideEmptyDbs(e.target.checked)}
                  className="w-3.5 h-3.5 text-[#007acc] border-gray-300 rounded focus:ring-[#007acc] focus:ring-1 cursor-pointer"
                />
                <span className="text-xs text-gray-600">{t('redisTab.hideEmptyDbLabel')}</span>
              </label>
            </div>
          </div>
        </div>

        {/* 数据库列表 */}
        <div className="flex-1 overflow-y-auto">
          {databases
            .filter(db => !hideEmptyDbs || db.keyCount > 0) // 根据选项过滤空数据库
            .map((db) => {
            const isExpanded = expandedDbs.has(db.dbIndex);
            const keys = dbKeys.get(db.dbIndex) || [];
            const isLoadingKeys = loadingKeys.has(db.dbIndex);
            
            return (
              <div key={db.dbIndex}>
                {/* 数据库项 */}
                <div
                  className={`px-3 py-2 cursor-pointer transition-all ${
                    selectedDb === db.dbIndex
                      ? 'bg-blue-50'
                      : 'hover:bg-gray-50'
                  }`}
                  onClick={() => {
                    setSelectedDb(db.dbIndex);
                    toggleDatabase(db.dbIndex);
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* 展开/折叠图标 */}
                      <i 
                        className={`fas fa-caret-${isExpanded ? 'down' : 'right'} text-sm text-gray-400`}
                      ></i>
                      <i 
                        className={`fas fa-database text-base ${
                          selectedDb === db.dbIndex ? 'text-[#007acc]' : 'text-gray-500'
                        }`}
                      ></i>
                      <span className={`font-medium text-sm ${
                        selectedDb === db.dbIndex ? 'text-[#007acc]' : 'text-gray-800'
                      }`}>
                        db{db.dbIndex}
                      </span>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      selectedDb === db.dbIndex 
                        ? 'bg-[#007acc] text-white' 
                        : 'bg-gray-200 text-gray-600'
                    }`}>
                      {db.keyCount}{db.isApproximate ? '~' : ''}
                    </span>
                  </div>
                </div>

                {/* 键列表（展开时显示） - 作为 db 节点的子树 */}
                {isExpanded && (
                  <>
                    {isLoadingKeys ? (
                      <div className="px-4 py-2 text-xs text-gray-500 flex items-center gap-2" style={{ paddingLeft: '28px' }}>
                        <i className="fas fa-spinner fa-spin"></i>
                        <span>{t('redisTab.loading')}</span>
                      </div>
                    ) : keys.length === 0 ? (
                      <div className="px-4 py-2 text-xs text-gray-500 text-center" style={{ paddingLeft: '28px' }}>
                        {t('redis.noData')}
                      </div>
                    ) : (
                      <div>
                        {keys.map(node => renderTreeNode(node, 0, db.dbIndex))}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 底部操作按钮 */}
        <div className="px-3 py-2 border-t border-gray-200">
          <button
            className="w-full px-3 py-1.5 text-xs bg-[#00B42A] text-white rounded hover:bg-[#009A29] transition-colors flex items-center justify-center gap-1"
            onClick={handleOpenAddKeyDialog}
            title={t('redis.addNewKey')}
          >
            <i className="fas fa-plus"></i>
            {t('redis.addNewKeyValue')}
          </button>
        </div>
      </div>

      {/* 分隔条 */}
      <div
        className={`w-1 bg-gray-200 hover:bg-[#007acc] cursor-col-resize flex items-center justify-center transition-colors ${
          isDragging ? 'bg-[#007acc]' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="w-0.5 h-8 bg-gray-400 rounded"></div>
      </div>

      {/* 右侧：数据展示区 */}
      <div className="flex-1 flex flex-col bg-white">
        {/* 操作栏 */}
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          {/* 左侧：数据库信息 */}
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">
              db{selectedDb}
            </span>
            <span className="text-xs text-gray-500">
              ({databases.find(d => d.dbIndex === selectedDb)?.keyCount || 0}{databases.find(d => d.dbIndex === selectedDb)?.isApproximate ? '~' : ''} keys)
            </span>
          </div>
          
          {/* 右侧：搜索框和操作按钮 */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder={t('redis.filterKeyPlaceholder')}
              value={filterPattern}
              onChange={(e) => setFilterPattern(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleReloadKeys();
                }
              }}
              className="w-64 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-[#007acc]"
            />
            <button
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
              onClick={handleReloadKeys}
              disabled={isReloading}
              title={t('redis.reload')}
            >
              <i className={`fas fa-sync-alt ${isReloading ? 'fa-spin' : ''}`}></i>
              {t('redis.reload')}
            </button>
            <button
              className="px-3 py-1.5 text-sm bg-[#00B42A] text-white rounded hover:bg-[#009A29] transition-colors flex items-center gap-1"
              onClick={handleOpenAddKeyDialog}
              title={t('redis.addKeyValue')}
            >
              <i className="fas fa-plus"></i>
              {t('redis.add')}
            </button>
          </div>
        </div>

        {/* 数据展示区域 */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {selectedKey && keyDetails ? (
            // 显示选中的key详情
            <div className="p-4 flex flex-col h-full overflow-hidden">
              <div className="mb-4 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    <i className="fas fa-key text-[#007acc]"></i>
                    {keyDetails.littleKey}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded">
                      {keyDetails.type.toUpperCase()}
                    </span>
                    <button 
                      className="px-3 py-1 text-xs bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
                      onClick={() => handleSelectKey(null)}
                    >
                      {t('redis.return')}
                    </button>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <button 
                    className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200 transition-colors"
                    onClick={() => handleRenameKey(keyDetails.key)}
                  >
                    {t('redis.rename')}
                  </button>
                  <button 
                    className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
                    onClick={() => handleDeleteKey(keyDetails.key)}
                  >
                    {t('redis.delete')}
                  </button>
                  <button 
                    className="px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded hover:bg-blue-200 transition-colors"
                    onClick={() => handleSetExpire(keyDetails.key, keyDetails.ttl)}
                  >
                    {t('redis.setExpirationTime')}
                  </button>
                </div>
              </div>
              
              {/* Key 信息区域 */}
              <div className="mb-4 flex-shrink-0">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">{t('redisTab.typeLabel')}</div>
                    <div className="font-medium">{keyDetails.type.toUpperCase()}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">{t('redisTab.memoryUsageLabel')}</div>
                    <div className="font-medium">{keyDetails.mem} bytes</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">{t('redisTab.encodingLabel')}</div>
                    <div className="font-medium">{keyDetails.coding}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 mb-1">{t('redisTab.expirationLabel')}</div>
                    <div className="font-medium">
                      {keyDetails.ttl === -1 ? t('redis.neverExpires') : t('redis.seconds', { seconds: keyDetails.ttl })}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Key 数据区域 - 根据类型显示不同内容 */}
              <div className="bg-white border border-gray-200 rounded-lg overflow-hidden flex flex-col flex-1 min-h-0">
                {renderKeyDetailContent(keyDetails)}
              </div>
            </div>
          ) : (
            // 显示数据库概览
            <div className="p-4">
              <div className="text-center py-12">
                <i className="fas fa-key text-6xl text-gray-300 mb-4"></i>
                <h3 className="text-xl font-bold text-gray-800 mb-2">
                  {t('redis.dataOperationInterface')}
                </h3>
                <p className="text-gray-600 mb-6">
                  {t('redis.selectKeyFromTree')}
                </p>
                <div className="max-w-2xl mx-auto bg-gray-50 rounded-lg p-6 border border-gray-200">
                  <div className="text-left space-y-3">
                    <div className="flex items-start gap-2">
                      <i className="fas fa-info-circle text-[#007acc] mt-0.5"></i>
                      <div>
                        <p className="text-sm text-gray-700">
                          <strong>{t('redisTab.tipsTitle')}</strong>{t('redisTab.supportedTypes')}
                        </p>
                      </div>
                    </div>
                    <ul className="text-sm text-gray-600 space-y-2 pl-6">
                      <li className="flex items-start gap-2">
                        <span className="text-[#007acc]">•</span>
                        <span>{t('redisTab.stringType')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#007acc]">•</span>
                        <span>{t('redisTab.hashType')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#007acc]">•</span>
                        <span>{t('redisTab.listType')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#007acc]">•</span>
                        <span>{t('redisTab.setType')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#007acc]">•</span>
                        <span>{t('redisTab.zsetType')}</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-[#007acc]">•</span>
                        <span>{t('redisTab.streamType')}</span>
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 重命名对话框 */}
      {renameDialogOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setRenameDialogOpen(false)}>
          <div className="bg-white rounded-lg shadow p-5 w-80 max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <i className="fas fa-edit text-[#007acc]"></i>
                {t('redis.renameKey')}
              </h2>
              <button
                onClick={() => setRenameDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2 uppercase">New Key Name</label>
              <input
                type="text"
                value={renameInputValue}
                onChange={(e) => setRenameInputValue(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#007acc] focus:border-transparent bg-gray-50"
                placeholder={t('redis.exampleKeyName')}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') executeRename();
                  if (e.key === 'Escape') setRenameDialogOpen(false);
                }}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setRenameDialogOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                {t('redis.cancel')}
              </button>
              <button
                onClick={executeRename}
                className="px-3 py-1.5 text-sm text-white bg-[#007acc] hover:bg-[#005a9e] rounded-md transition-colors flex items-center gap-1"
              >
                <i className="fas fa-check text-xs"></i>
                {t('redis.rename')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      {deleteConfirmOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setDeleteConfirmOpen(false)}>
          <div className="bg-white rounded-lg shadow p-5 w-80 max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <i className="fas fa-trash text-red-500"></i>
                {t('redis.confirmDelete')}
              </h2>
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <p className="text-gray-700 mb-6 text-sm">
              {t('redis.deleteConfirmationMessage')}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeleteConfirmOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeDelete}
                className="px-3 py-1.5 text-sm text-white bg-red-500 hover:bg-red-600 rounded-md transition-colors flex items-center gap-1"
              >
                <i className="fas fa-trash text-xs"></i>
                {t('redis.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 过期时间对话框 */}
      {expireDialogOpen && (
        <div className="fixed inset-0 bg-black/20 flex items-center justify-center z-50" onClick={() => setExpireDialogOpen(false)}>
          <div className="bg-white rounded-lg shadow p-5 w-80 max-w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
                <i className="fas fa-hourglass-end text-[#007acc]"></i>
                {t('redis.setExpirationTime')}
              </h2>
              <button
                onClick={() => setExpireDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-600 mb-2 uppercase">TTL (秒)</label>
              <input
                type="number"
                value={expireInputValue}
                onChange={(e) => setExpireInputValue(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#007acc] focus:border-transparent bg-gray-50"
                placeholder={t('redis.exampleTTL')}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') executeSetExpire();
                  if (e.key === 'Escape') setExpireDialogOpen(false);
                }}
              />
              <p className="text-xs text-gray-500 mt-1.5">
                {t('redis.expireDescription')}
              </p>
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setExpireDialogOpen(false)}
                className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                取消
              </button>
              <button
                onClick={executeSetExpire}
                className="px-3 py-1.5 text-sm text-white bg-[#007acc] hover:bg-[#005a9e] rounded-md transition-colors flex items-center gap-1"
              >
                <i className="fas fa-check text-xs"></i>
                {t('redis.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 添加键值对话框 */}
      {addKeyDialogOpen && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50" onClick={() => setAddKeyDialogOpen(false)}>
          <div className="bg-white rounded-lg shadow-xl w-[600px] max-w-[90vw] max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            {/* 标题 */}
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <i className="fas fa-plus-circle text-[#00B42A]"></i>
                {t('redis.addNewKeyValue')}
              </h2>
              <button
                onClick={() => setAddKeyDialogOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <i className="fas fa-times text-xl"></i>
              </button>
            </div>
            {/* 表单内容 */}
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('redis.keyName')} *</label>
                <input type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00B42A]" placeholder={t('redis.enterKeyName')} autoFocus />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">{t('redis.dataType')} *</label>
                <select value={newKeyType} onChange={(e) => setNewKeyType(e.target.value as any)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00B42A]">
                  <option value="string">String</option>
                  <option value="hash">Hash</option>
                  <option value="list">List</option>
                  <option value="set">Set</option>
                  <option value="zset">ZSet</option>
                  <option value="stream">Stream</option>
                </select>
              </div>
              {newKeyType === 'string' && (
                <div><label className="block text-sm font-medium text-gray-700 mb-2">{t('redis.value')}</label><textarea value={newKeyValue} onChange={(e) => setNewKeyValue(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#00B42A] font-mono text-sm" placeholder={t('redis.enterValue')} rows={6} /></div>
              )}
              {newKeyType === 'hash' && (
                <div><label className="block text-sm font-medium text-gray-700 mb-2">{t('redis.fieldList')} *</label>
                  <div className="space-y-2">
                    {newKeyFields.map((field, index) => (<div key={index} className="flex gap-2"><input type="text" value={field.name} onChange={(e) => {const updated = [...newKeyFields]; updated[index].name = e.target.value; setNewKeyFields(updated);}} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder={t('redis.fieldName')} /><input type="text" value={field.value} onChange={(e) => {const updated = [...newKeyFields]; updated[index].value = e.target.value; setNewKeyFields(updated);}} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder={t('redis.fieldValue')} /><button onClick={() => setNewKeyFields(newKeyFields.filter((_, i) => i !== index))} className="px-3 text-red-500" disabled={newKeyFields.length === 1}><i className="fas fa-times"></i></button></div>))}
                    <button onClick={() => setNewKeyFields([...newKeyFields, {name: '', value: ''}])} className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:text-[#00B42A]"><i className="fas fa-plus mr-1"></i>{t('redis.addField')}</button>
                  </div>
                </div>
              )}
              {(newKeyType === 'list' || newKeyType === 'set') && (<div><label className="block text-sm font-medium text-gray-700 mb-2">{newKeyType === 'list' ? t('redis.elementList') : t('redis.memberList')} *</label><div className="space-y-2">{newKeyValues.map((value, index) => (<div key={index} className="flex gap-2"><input type="text" value={value} onChange={(e) => {const updated = [...newKeyValues]; updated[index] = e.target.value; setNewKeyValues(updated);}} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder={newKeyType === 'list' ? t('redis.elementValue') : t('redis.memberValue')} /><button onClick={() => setNewKeyValues(newKeyValues.filter((_, i) => i !== index))} className="px-3 text-red-500" disabled={newKeyValues.length === 1}><i className="fas fa-times"></i></button></div>))}<button onClick={() => setNewKeyValues([...newKeyValues, ''])} className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:text-[#00B42A]"><i className="fas fa-plus mr-1"></i>{newKeyType === 'list' ? t('redis.addElement') : t('redis.addMember')}</button></div></div>)}
              {newKeyType === 'zset' && (<div><label className="block text-sm font-medium text-gray-700 mb-2">{t('redis.memberList')} *</label><div className="space-y-2">{newKeyMembers.map((member, index) => (<div key={index} className="flex gap-2"><input type="text" value={member.value} onChange={(e) => {const updated = [...newKeyMembers]; updated[index].value = e.target.value; setNewKeyMembers(updated);}} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder={t('redis.memberValue')} /><input type="text" value={member.score} onChange={(e) => {const updated = [...newKeyMembers]; updated[index].score = e.target.value; setNewKeyMembers(updated);}} className="w-24 px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder={t('redis.score')} /><button onClick={() => setNewKeyMembers(newKeyMembers.filter((_, i) => i !== index))} className="px-3 text-red-500" disabled={newKeyMembers.length === 1}><i className="fas fa-times"></i></button></div>))}<button onClick={() => setNewKeyMembers([...newKeyMembers, {value: '', score: '0'}])} className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:text-[#00B42A]"><i className="fas fa-plus mr-1"></i>{t('redis.addMember')}</button></div></div>)}
              {newKeyType === 'stream' && (<div><label className="block text-sm font-medium text-gray-700 mb-2">{t('redis.initialMessageFields')} *</label><div className="space-y-2">{newKeyStreamFields.map((field, index) => (<div key={index} className="flex gap-2"><input type="text" value={field.name} onChange={(e) => {const updated = [...newKeyStreamFields]; updated[index].name = e.target.value; setNewKeyStreamFields(updated);}} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder={t('redis.fieldName')} /><input type="text" value={field.value} onChange={(e) => {const updated = [...newKeyStreamFields]; updated[index].value = e.target.value; setNewKeyStreamFields(updated);}} className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder={t('redis.fieldValue')} /><button onClick={() => setNewKeyStreamFields(newKeyStreamFields.filter((_, i) => i !== index))} className="px-3 text-red-500" disabled={newKeyStreamFields.length === 1}><i className="fas fa-times"></i></button></div>))}<button onClick={() => setNewKeyStreamFields([...newKeyStreamFields, {name: '', value: ''}])} className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-md text-sm text-gray-600 hover:text-[#00B42A]"><i className="fas fa-plus mr-1"></i>{t('redis.addField')}</button></div></div>)}
              <div><label className="block text-sm font-medium text-gray-700 mb-2">{t('redis.expirationTime')} <span className="text-gray-400 font-normal">{t('redis.optional')}</span></label><input type="number" value={newKeyTtl} onChange={(e) => setNewKeyTtl(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm" placeholder={t('redis.emptyForNeverExpires')} min="-1" /><p className="text-xs text-gray-500 mt-1">{t('redis.expireDescription')}</p></div>
            </div>
            <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex gap-3 justify-end">
              <button onClick={() => setAddKeyDialogOpen(false)} disabled={isAddingKey} className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-md transition-colors disabled:opacity-50">{t('redis.cancel')}</button>
              <button onClick={executeAddKey} disabled={isAddingKey} className="px-4 py-2 text-sm text-white bg-[#00B42A] hover:bg-[#009A29] rounded-md transition-colors disabled:opacity-50 flex items-center gap-2">{isAddingKey ? <><i className="fas fa-spinner fa-spin"></i>{t('redis.adding')}...</> : <><i className="fas fa-check"></i>{t('redis.confirmAdd')}</>}</button>
            </div>
          </div>
        </div>
      )}
      
      {/* Toast 通知容器 */}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`min-w-[300px] px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-slide-in ${
              toast.type === 'success' ? 'bg-green-500 text-white' :
              toast.type === 'error' ? 'bg-red-500 text-white' :
              'bg-blue-500 text-white'
            }`}
            style={{
              animation: 'slideIn 0.3s ease-out'
            }}
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