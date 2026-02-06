import React, { useState } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';

export interface ColumnDefinition {
  name: string;
  dataType: string;
  typeLength?: string;
  scale?: string;
  nullable: boolean;
  defaultValue: string | number | null;
  isPrimaryKey: boolean;
  autoIncrement?: boolean;
  unsigned?: boolean;
  comment?: string;
}

interface TableDesignViewProps {
  connectionId: string;
  tabId: string;
  dbName: string;
  databaseType: string;
  schema?: string;
  initialTableName?: string;
  initialColumns?: ColumnDefinition[];
  isEditing?: boolean;
  onSave: (tableName: string, columns: ColumnDefinition[], schema?: string, originalTableName?: string) => void;
  onCancel: () => void;
}

const TableDesignView: React.FC<TableDesignViewProps> = ({
  connectionId,
  tabId,
  dbName,
  databaseType,
  schema,
  initialTableName = '',
  initialColumns = [],
  isEditing = false,
  onSave,
  onCancel
}) => {
  const { t } = useLanguage();
  const [tableName, setTableName] = useState(initialTableName);
  const [columns, setColumns] = useState<ColumnDefinition[]>(initialColumns.length > 0 ? initialColumns : [
    {
      name: '',
      dataType: databaseType === 'postgresql' ? 'integer' : databaseType === 'mysql' ? 'INT' : 'INTEGER',
      typeLength: '',
      scale: '',
      nullable: true,
      defaultValue: null,
      isPrimaryKey: false,
      autoIncrement: false,
      unsigned: false,
      comment: ''
    }
  ]);
  
  // Save original field snapshot (for comparing and detecting changes)
  const [originalColumns] = useState<ColumnDefinition[]>(
    initialColumns.length > 0 ? JSON.parse(JSON.stringify(initialColumns)) : []
  );
  const [originalTableName] = useState<string>(initialTableName);
  
  // Tab switching state
  const [activeTab, setActiveTab] = useState<'fields' | 'indices'>('fields');
  const [indices, setIndices] = useState<any[]>([]);
  const [originalIndices, setOriginalIndices] = useState<any[]>([]);
  const [indicesLoading, setIndicesLoading] = useState(false);
  const [editingIndexId, setEditingIndexId] = useState<string | null>(null);
  const [editingIndex, setEditingIndex] = useState<any>(null);

  const commonDataTypes = {
    mysql: [
      'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'BIT',
      'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT', 
      'DATETIME', 'TIMESTAMP', 'DATE', 'TIME', 'YEAR',
      'BLOB', 'LONGBLOB', 'MEDIUMBLOB', 'BINARY', 'VARBINARY',
      'JSON', 'ENUM', 'SET', 'GEOMETRY'
    ],
    postgresql: [
      // Integer types
      'int2', 'int4', 'int8', 'serial', 'serial2', 'serial4', 'serial8', 'bigserial',
      // Floating point types
      'float4', 'float8', 'numeric', 'decimal', 'money',
      // String types
      'char', 'varchar', 'text',
      // Date/Time types
      'date', 'time', 'timetz', 'timestamp', 'timestamptz', 'interval',
      // Boolean types
      'bool',
      // Binary types
      'bytea', 'bit', 'bit varying',
      // Network types
      'inet', 'cidr', 'macaddr', 'macaddr8',
      // Geometry types
      'point', 'line', 'lseg', 'box', 'path', 'polygon', 'circle',
      // JSON types
      'json', 'jsonb',
      // Other types
      'uuid', 'xml', 'oid', 'name', 'pg_lsn', 'pg_snapshot', 'tsquery', 'tsvector', 'txid_snapshot', 'box'
    ],
    sqlite: [
      'INTEGER', 'REAL', 'TEXT', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATE', 'DATETIME'
    ]
  };

  const dataTypes = commonDataTypes[databaseType.toLowerCase() as keyof typeof commonDataTypes] || [];

  const addColumn = () => {
    setColumns([
      ...columns,
      {
        name: '',
        dataType: databaseType === 'postgresql' ? 'integer' : databaseType === 'mysql' ? 'INT' : 'INTEGER',
        typeLength: '',
        scale: '',
        nullable: true,
        defaultValue: null,
        isPrimaryKey: false,
        autoIncrement: false,
        unsigned: false,
        comment: ''
      }
    ]);
  };

  const removeColumn = (index: number) => {
    if (columns.length <= 1) return;
    setColumns(columns.filter((_, i) => i !== index));
  };

  const moveColumnUp = (index: number) => {
    if (index <= 0) return;
    const newColumns = [...columns];
    [newColumns[index - 1], newColumns[index]] = [newColumns[index], newColumns[index - 1]];
    setColumns(newColumns);
  };

  const moveColumnDown = (index: number) => {
    if (index >= columns.length - 1) return;
    const newColumns = [...columns];
    [newColumns[index], newColumns[index + 1]] = [newColumns[index + 1], newColumns[index]];
    setColumns(newColumns);
  };

  const updateColumn = (index: number, field: keyof ColumnDefinition, value: any) => {
    setColumns(prevColumns => {
      const newColumns = [...prevColumns];
      newColumns[index] = { ...newColumns[index], [field]: value };
      return newColumns;
    });
  };

  // Compare and detect changed fields and added/deleted fields
  const getChangedData = () => {
    const changedColumns: any[] = [];
    const deletedColumns: string[] = [];
    const addedColumns: ColumnDefinition[] = [];
    
    // Detect modifications and deletions
    originalColumns.forEach((origCol, idx) => {
      const currentCol = columns.find(col => col.name === origCol.name);
      
      if (!currentCol) {
        // Field is deleted
        deletedColumns.push(origCol.name);
      } else {
        // Check if there are changes
        const isChanged = JSON.stringify(origCol) !== JSON.stringify(currentCol);
        if (isChanged) {
          changedColumns.push({
            ...currentCol,
            originalName: origCol.name  // Record original name (to prevent loss when column name changes)
          });
        }
      }
    });
    
    // Detect newly added fields
    columns.forEach(col => {
      if (!originalColumns.find(origCol => origCol.name === col.name)) {
        addedColumns.push(col);
      }
    });
    
    return {
      changedColumns,
      deletedColumns,
      addedColumns,
      hasChanges: changedColumns.length > 0 || deletedColumns.length > 0 || addedColumns.length > 0
    };
  };

  // Load table indices
  const loadTableIndices = async () => {
    if (!isEditing || !initialTableName) return;
    
    setIndicesLoading(true);
    try {
      const response = await fetch('/api/database/table/indices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          tabId,
          dbName,
          tableName: initialTableName,
          schema
        })
      });

      const result = await response.json();
      if (result.code === 200) {
        const indicesList = result.data.indices || [];
        setIndices(indicesList);
        // Save original index list (for detecting changes)
        setOriginalIndices(JSON.parse(JSON.stringify(indicesList)));
      } else {
        console.error('Failed to load indices:', result.message);
      }
    } catch (error) {
      console.error('Error loading indices:', error);
    } finally {
      setIndicesLoading(false);
    }
  };

  // Start editing index
  const startEditingIndex = (index: any) => {
    setEditingIndexId(index.name);
    setEditingIndex({
      ...index,
      columns: [...index.columns]
    });
  };

  // Cancel editing
  const cancelEditingIndex = () => {
    setEditingIndexId(null);
    setEditingIndex(null);
  };

  // Save index editing
  const saveEditingIndex = () => {
    if (!editingIndex) return;
    
    setIndices(prevIndices =>
      prevIndices.map(idx =>
        idx.name === editingIndexId ? editingIndex : idx
      )
    );
    setEditingIndexId(null);
    setEditingIndex(null);
  };

  // Delete index
  const deleteIndex = (indexName: string) => {
    setIndices(prevIndices => prevIndices.filter(idx => idx.name !== indexName));
  };

  // Add new index
  const addNewIndex = () => {
    const newIndex = {
      name: `idx_${Date.now()}`,
      columns: [],
      indexType: 'NORMAL',
      method: 'BTREE',
      primary: false,
      unique: false
    };
    setIndices([...indices, newIndex]);
    startEditingIndex(newIndex);
  };

  // Calculate index changes
  const getIndexChanges = () => {
    const created: any[] = [];
    const modified: any[] = [];
    const deleted: any[] = [];

    // Detect deleted indices
    originalIndices.forEach(origIndex => {
      if (!indices.find(idx => idx.name === origIndex.name)) {
        deleted.push(origIndex.name);
      }
    });

    // Detect newly added and modified indices
    indices.forEach(currentIndex => {
      const origIndex = originalIndices.find(idx => idx.name === currentIndex.name);
      
      if (!origIndex) {
        // New index
        created.push(currentIndex);
      } else {
        // Check if modified
        const isChanged = JSON.stringify(origIndex) !== JSON.stringify(currentIndex);
        if (isChanged) {
          modified.push({
            ...currentIndex,
            originalName: origIndex.name
          });
        }
      }
    });

    return { created, modified, deleted };
  };

  const handleSave = () => {
    if (!tableName.trim()) {
      alert(t('database.enterTableName'));
      return;
    }
    for (let i = 0; i < columns.length; i++) {
      if (!columns[i].name.trim()) {
        alert(t('database.columnNameEmpty', { index: i + 1 }));
        return;
      }
    }
    
    // Get changed data
    const { changedColumns, deletedColumns, addedColumns, hasChanges } = getChangedData();
    
    // Get index changes
    const indexChanges = getIndexChanges();
    const hasIndexChanges = indexChanges.created.length > 0 || indexChanges.modified.length > 0 || indexChanges.deleted.length > 0;
    
    // Check if there are any changes
    if (isEditing && !hasChanges && !hasIndexChanges && tableName === originalTableName) {
      // Pass a special marker through onSave to let the caller handle the prompt
      onSave(tableName, { changedColumns: [], deletedColumns: [], addedColumns: [], allColumns: columns, isNoChange: true } as any, schema, originalTableName);
      return;
    }
    
    // In edit mode, only pass changed fields; in create mode, pass all fields
    const dataToSend = isEditing ? {
      tableName,
      changedColumns,
      deletedColumns,
      addedColumns,
      allColumns: columns,  // Complete list for validation
      indexOperations: hasIndexChanges ? indexChanges : null
    } : {
      tableName,
      columns,
      indexOperations: null
    };
    
    onSave(dataToSend.tableName, dataToSend as any, schema, originalTableName);
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <i className="fas fa-table text-blue-500 text-sm"></i>
            <input 
              type="text" 
              value={tableName} 
              onChange={(e) => setTableName(e.target.value)} 
              className="bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none font-semibold text-gray-800 transition-all px-1 text-sm" 
              placeholder={t('database.tableNamePlaceholder')}
            />
          </div>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded uppercase font-medium">{databaseType}</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded transition-all"
          >
            {t('database.cancel')}
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-1 text-xs font-bold bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-all flex items-center gap-1"
          >
            <i className="fas fa-save text-[10px]"></i>
            {isEditing ? t('database.saveChanges') : t('database.createTable')}
          </button>
        </div>
      </div>

      {/* 主体内容 */}
      <div className="flex-1 overflow-auto flex flex-col">
        {/* Tab 标签页 */}
        {isEditing && (
          <div className="flex gap-0 px-4 py-0 border-b border-gray-200 bg-gray-50/50">
            <button
              onClick={() => {
                setActiveTab('fields');
              }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'fields'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="fas fa-columns mr-2"></i>
              {t('database.fields')}
            </button>
            <button
              onClick={() => {
                setActiveTab('indices');
                loadTableIndices();
              }}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'indices'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              <i className="fas fa-key mr-2"></i>
              {t('database.indices')}
            </button>
          </div>
        )}

        {/* Fields tab content */}
        {(activeTab === 'fields' || !isEditing) && (
          <>
            <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 bg-gray-50/50">
              <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t('database.fieldList')}</h3>
              <button
                onClick={addColumn}
                className="px-2 py-0.5 text-[11px] bg-white border border-gray-200 hover:border-blue-500 hover:text-blue-600 text-gray-600 rounded transition-all flex items-center gap-1"
              >
                <i className="fas fa-plus text-[9px]"></i>
                {t('database.addField')}
              </button>
            </div>

            <div className="overflow-hidden flex-1">
              <table className="w-full text-left border-collapse text-[12px]">
                <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-300">
                  <tr>
                    <th className="px-3 py-1.5 border-r border-gray-300 whitespace-nowrap">{t('database.fieldName')}</th>
                    <th className="px-3 py-1.5 border-r border-gray-300 whitespace-nowrap">{t('database.type')}</th>
                    <th className="px-3 py-1.5 border-r border-gray-300 w-16 text-center whitespace-nowrap">{t('database.length')}</th>
                    <th className="px-3 py-1.5 border-r border-gray-300 w-16 text-center whitespace-nowrap">{t('database.decimalPlaces')}</th>
                    <th className="px-3 py-1.5 border-r border-gray-300 w-12 text-center whitespace-nowrap">{t('database.required')}</th>
                    <th className="px-3 py-1.5 border-r border-gray-300 w-12 text-center whitespace-nowrap">{t('database.primaryKey')}</th>
                    {databaseType === 'mysql' && (
                      <th className="px-3 py-1.5 border-r border-gray-300 w-14 text-center whitespace-nowrap">{t('database.unsigned')}</th>
                    )}
                    {databaseType !== 'postgresql' && (
                      <th className="px-3 py-1.5 border-r border-gray-300 w-12 text-center whitespace-nowrap">{t('database.autoIncrement')}</th>
                    )}
                    <th className="px-3 py-1.5 border-r border-gray-300 flex-1 whitespace-nowrap">{t('database.defaultValue')}</th>
                    <th className="px-3 py-1.5 border-r border-gray-300 flex-1 whitespace-nowrap">{t('database.comment')}</th>
                    <th className="px-3 py-1.5 w-16 text-center whitespace-nowrap">{t('database.operations')}</th>
                  </tr>
                </thead>
                <tbody className="border-t border-gray-300">
                  {columns.map((column, index) => (
                    <tr key={index} className="border-b border-gray-200 hover:bg-blue-50/30 transition-colors group">
                      <td className="px-3 py-1.5 border-r border-gray-200">
                        <input
                          type="text"
                          value={column.name}
                          onChange={(e) => updateColumn(index, 'name', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-400 focus:outline-none group-hover:border-blue-300"
                          placeholder={t('database.columnNamePlaceholder')}
                        />
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-200">
                        <select
                          value={dataTypes.find(t => t.toUpperCase() === (column.dataType || '').replace(/ UNSIGNED$/i, '').toUpperCase()) || 
                                 dataTypes.find(t => (column.dataType || '').toUpperCase().startsWith(t.toUpperCase())) || 
                                 column.dataType}
                          onChange={(e) => updateColumn(index, 'dataType', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-400 focus:outline-none group-hover:border-blue-300"
                        >
                          {dataTypes.map((type, idx) => (
                            <option key={idx} value={type}>{type}</option>
                          ))}
                          {!dataTypes.find(t => t.toUpperCase() === (column.dataType || '').replace(/ UNSIGNED$/i, '').toUpperCase()) && column.dataType && (
                            <option value={column.dataType}>{column.dataType}</option>
                          )}
                        </select>
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-200">
                        <input
                          type="text"
                          value={column.typeLength || ''}
                          onChange={(e) => updateColumn(index, 'typeLength', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-400 focus:outline-none group-hover:border-blue-300 text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-200">
                        <input
                          type="text"
                          value={column.scale || ''}
                          onChange={(e) => updateColumn(index, 'scale', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-400 focus:outline-none group-hover:border-blue-300 text-center"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                        <input
                          type="checkbox"
                          checked={!column.nullable}
                          disabled={column.isPrimaryKey}
                          onChange={(e) => updateColumn(index, 'nullable', !e.target.checked)}
                          className="w-4 h-4 text-blue-600 rounded cursor-pointer disabled:opacity-30"
                        />
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                        <input
                          type="checkbox"
                          checked={column.isPrimaryKey}
                          onChange={(e) => {
                            updateColumn(index, 'isPrimaryKey', e.target.checked);
                            if (e.target.checked) updateColumn(index, 'nullable', false);
                          }}
                          className="w-4 h-4 text-blue-600 rounded cursor-pointer"
                        />
                      </td>
                      {databaseType === 'mysql' && (
                        <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                          <input
                            type="checkbox"
                            checked={!!column.unsigned || (column.dataType || '').toUpperCase().includes('UNSIGNED')}
                            onChange={(e) => updateColumn(index, 'unsigned', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer disabled:opacity-30"
                            disabled={!['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].some(t => (column.dataType || '').toUpperCase().includes(t))}
                          />
                        </td>
                      )}
                      {databaseType !== 'postgresql' && (
                        <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                          <input
                            type="checkbox"
                            checked={!!column.autoIncrement}
                            disabled={!['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'INTEGER', 'NUMBER', 'REAL'].some(t => column.dataType.toUpperCase().includes(t))}
                            onChange={(e) => updateColumn(index, 'autoIncrement', e.target.checked)}
                            className="w-4 h-4 text-blue-600 rounded cursor-pointer disabled:opacity-30"
                          />
                        </td>
                      )}
                      <td className="px-3 py-1.5 border-r border-gray-200">
                        <input
                          type="text"
                          value={column.defaultValue ?? ''}
                          onChange={(e) => updateColumn(index, 'defaultValue', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-400 focus:outline-none group-hover:border-blue-300"
                          placeholder={t('database.defaultValuePlaceholder')}
                        />
                      </td>
                      <td className="px-3 py-1.5 border-r border-gray-200">
                        <input
                          type="text"
                          value={column.comment || ''}
                          onChange={(e) => updateColumn(index, 'comment', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-400 focus:outline-none group-hover:border-blue-300"
                          placeholder={t('database.commentPlaceholder')}
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => moveColumnUp(index)}
                            disabled={index === 0}
                            className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                            title={t('database.moveUp')}
                          >
                            <i className="fas fa-arrow-up"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => moveColumnDown(index)}
                            disabled={index === columns.length - 1}
                            className="text-gray-400 hover:text-blue-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-sm"
                            title={t('database.moveDown')}
                          >
                            <i className="fas fa-arrow-down"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => removeColumn(index)}
                            disabled={columns.length <= 1}
                            className="text-gray-400 hover:text-red-500 transition-colors disabled:opacity-0 text-sm"
                            title={t('database.delete')}
                          >
                            <i className="fas fa-trash-alt"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* 索引标签页内容 */}
        {isEditing && activeTab === 'indices' && (
          <div className="flex-1 overflow-auto flex flex-col">
            {indicesLoading && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <i className="fas fa-spinner fa-spin text-blue-500 text-2xl"></i>
                  <p className="text-sm text-gray-600 mt-2">{t('database.loadingIndices')}</p>
                </div>
              </div>
            )}

            {!indicesLoading && (
              <>
                {/* 添加索引按钮 */}
                <div className="flex justify-between items-center px-4 py-2 border-b border-gray-100 bg-gray-50/50">
                  <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider">{t('database.indexList')}</h3>
                  <button
                    onClick={addNewIndex}
                    className="px-2 py-0.5 text-[11px] bg-white border border-gray-200 hover:border-blue-500 hover:text-blue-600 text-gray-600 rounded transition-all flex items-center gap-1"
                  >
                    <i className="fas fa-plus text-[9px]"></i>
                    {t('database.addNewIndex')}
                  </button>
                </div>

                {indices.length === 0 && (
                  <div className="flex items-center justify-center flex-1">
                    <div className="rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 px-6 py-8 text-center">
                      <i className="fas fa-key text-3xl text-gray-300 mb-3"></i>
                      <p className="text-sm text-gray-500">{t('database.noIndices')}</p>
                    </div>
                  </div>
                )}

                {indices.length > 0 && (
                  <div className="overflow-hidden flex-1">
                    <table className="w-full text-left border-collapse text-[12px]">
                      <thead className="bg-gray-100 text-gray-600 font-semibold border-b border-gray-300 sticky top-0">
                        <tr>
                          <th className="px-3 py-1.5 border-r border-gray-300 whitespace-nowrap w-32">{t('database.name')}</th>
                          <th className="px-3 py-1.5 border-r border-gray-300 flex-1 whitespace-nowrap">{t('database.fields')}</th>
                          <th className="px-3 py-1.5 border-r border-gray-300 whitespace-nowrap w-20 text-center">{t('database.indexMethod')}</th>
                          <th className="px-3 py-1.5 border-r border-gray-300 whitespace-nowrap w-16 text-center">{t('database.unique')}</th>
                          <th className="px-3 py-1.5 border-r border-gray-300 whitespace-nowrap w-16 text-center">{t('database.concurrent')}</th>
                          <th className="px-3 py-1.5 border-r border-gray-300 flex-1 whitespace-nowrap">{t('database.comment')}</th>
                          <th className="px-3 py-1.5 w-20 text-center whitespace-nowrap">{t('database.operations')}</th>
                        </tr>
                      </thead>
                      <tbody className="border-t border-gray-300">
                        {indices.map((index) => (
                          <tr key={index.name} className="border-b border-gray-200 hover:bg-blue-50/30 transition-colors group">
                            {editingIndexId === index.name ? (
                              // Edit mode
                              <>
                                <td className="px-3 py-1.5 border-r border-gray-200">
                                  <input
                                    type="text"
                                    value={editingIndex?.name || ''}
                                    onChange={(e) => setEditingIndex({ ...editingIndex, name: e.target.value })}
                                    className="w-full bg-white border border-blue-400 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-500 focus:outline-none"
                                  />
                                </td>
                                <td className="px-3 py-1.5 border-r border-gray-200">
                                  <div className="space-y-1">
                                    {editingIndex?.columns.map((col: any, idx: number) => (
                                      <div key={idx} className="flex items-center gap-1">
                                        <select
                                          value={col.name}
                                          onChange={(e) => {
                                            const newColumns = [...editingIndex.columns];
                                            newColumns[idx] = { ...col, name: e.target.value };
                                            setEditingIndex({ ...editingIndex, columns: newColumns });
                                          }}
                                          className="flex-1 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-400 focus:outline-none"
                                        >
                                          <option value="">选择字段</option>
                                          {columns.map((col) => (
                                            <option key={col.name} value={col.name}>{col.name}</option>
                                          ))}
                                        </select>
                                        <select
                                          value={col.order || 'ASC'}
                                          onChange={(e) => {
                                            const newColumns = [...editingIndex.columns];
                                            newColumns[idx] = { ...col, order: e.target.value };
                                            setEditingIndex({ ...editingIndex, columns: newColumns });
                                          }}
                                          className="w-16 bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-400 focus:outline-none"
                                        >
                                          <option value="ASC">ASC</option>
                                          <option value="DESC">DESC</option>
                                        </select>
                                        <button
                                          onClick={() => {
                                            const newColumns = editingIndex.columns.filter((_: any, i: number) => i !== idx);
                                            setEditingIndex({ ...editingIndex, columns: newColumns });
                                          }}
                                          className="text-gray-400 hover:text-red-500 transition-colors text-xs"
                                        >
                                          <i className="fas fa-trash-alt"></i>
                                        </button>
                                      </div>
                                    ))}
                                    <button
                                      onClick={() => {
                                        setEditingIndex({
                                          ...editingIndex,
                                          columns: [...editingIndex.columns, { name: '', order: 'ASC' }]
                                        });
                                      }}
                                      className="text-[10px] text-blue-600 hover:text-blue-700 font-medium"
                                    >
                                      + {t('database.addField')}
                                    </button>
                                  </div>
                                </td>
                                <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                                  <select
                                    value={editingIndex?.method || 'BTREE'}
                                    onChange={(e) => setEditingIndex({ ...editingIndex, method: e.target.value })}
                                    className="w-full bg-white border border-gray-200 rounded px-1.5 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-400 focus:outline-none"
                                  >
                                    <option value="BTREE">BTREE</option>
                                    <option value="HASH">HASH</option>
                                    <option value="GIST">GIST</option>
                                    <option value="GIN">GIN</option>
                                    <option value="BRIN">BRIN</option>
                                  </select>
                                </td>
                                <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                                  <input
                                    type="checkbox"
                                    checked={editingIndex?.unique || false}
                                    onChange={(e) => setEditingIndex({ ...editingIndex, unique: e.target.checked })}
                                    className="w-4 h-4"
                                  />
                                </td>
                                <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                                  <input
                                    type="checkbox"
                                    checked={editingIndex?.concurrent || false}
                                    onChange={(e) => setEditingIndex({ ...editingIndex, concurrent: e.target.checked })}
                                    className="w-4 h-4"
                                  />
                                </td>
                                <td className="px-3 py-1.5 border-r border-gray-200">
                                  <input
                                    type="text"
                                    value={editingIndex?.comment || ''}
                                    onChange={(e) => setEditingIndex({ ...editingIndex, comment: e.target.value })}
                                    className="w-full bg-white border border-gray-200 rounded px-2 py-0.5 text-[11px] focus:ring-1 focus:ring-blue-400 focus:outline-none"
                                    placeholder={t('database.indexCommentPlaceholder')}
                                  />
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={saveEditingIndex}
                                      className="text-green-600 hover:text-green-700 transition-colors text-sm"
                                      title={t('database.save')}
                                    >
                                      <i className="fas fa-check"></i>
                                    </button>
                                    <button
                                      onClick={cancelEditingIndex}
                                      className="text-gray-400 hover:text-gray-600 transition-colors text-sm"
                                      title={t('database.cancel')}
                                    >
                                      <i className="fas fa-times"></i>
                                    </button>
                                  </div>
                                </td>
                              </>
                            ) : (
                              // Display mode
                              <>
                                <td className="px-3 py-1.5 border-r border-gray-200">
                                  <div className="flex items-center gap-2">
                                    <i className="fas fa-key text-blue-500 text-xs"></i>
                                    <span className="font-medium text-gray-900">{index.name}</span>
                                  </div>
                                </td>
                                <td className="px-3 py-1.5 border-r border-gray-200">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    {index.columns.map((col: any, idx: number) => (
                                      <span key={idx} className="inline-flex items-center gap-1">
                                        <code className="bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-[11px] font-mono">
                                          `{col.name}`
                                        </code>
                                        {col.order && (
                                          <span className="text-gray-400 text-[10px]">{col.order}</span>
                                        )}
                                      </span>
                                    ))}
                                  </div>
                                </td>
                                <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                                  {index.indexType === 'FULLTEXT' ? (
                                    <span className="text-gray-400 text-[11px]">-</span>
                                  ) : (
                                    <span className="text-gray-600">{index.method || 'BTREE'}</span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                                  <input
                                    type="checkbox"
                                    checked={index.unique || false}
                                    readOnly
                                    disabled
                                    className="w-4 h-4 cursor-not-allowed"
                                  />
                                </td>
                                <td className="px-3 py-1.5 border-r border-gray-200 text-center">
                                  <input
                                    type="checkbox"
                                    checked={index.concurrent || false}
                                    readOnly
                                    disabled
                                    className="w-4 h-4 cursor-not-allowed"
                                  />
                                </td>
                                <td className="px-3 py-1.5 border-r border-gray-200 text-gray-600 text-[11px] truncate">
                                  {index.comment || '-'}
                                </td>
                                <td className="px-3 py-1.5 text-center">
                                  <div className="flex items-center justify-center gap-1">
                                    {index.primary ? (
                                      <span className="text-gray-300 text-[11px]">{t('database.systemIndex')}</span>
                                    ) : (
                                      <>
                                        <button
                                          onClick={() => startEditingIndex(index)}
                                          className="text-blue-600 hover:text-blue-700 transition-colors text-sm"
                                          title={t('database.edit')}
                                        >
                                          <i className="fas fa-edit"></i>
                                        </button>
                                        <button
                                          onClick={() => deleteIndex(index.name)}
                                          className="text-gray-400 hover:text-red-500 transition-colors text-sm"
                                          title={t('database.delete')}
                                        >
                                          <i className="fas fa-trash-alt"></i>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default TableDesignView;
