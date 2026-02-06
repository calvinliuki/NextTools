'use client';

import { useState, useEffect, useRef } from 'react';
import { useLanguage } from '../../../i18n/LanguageContext';
import { DesignTableDialog, ColumnDefinition } from './dialogs';
import { TableDesignView } from './views';
import DeleteConfirmDialog from '../common/DeleteConfirmDialog';

interface Database {
  id: string;
  name: string;
  schema: string;
  tables: string[];
  tableCount: number;
  size: string;
  status: 'connected' | 'disconnected' | 'connecting';
  type: string; // Database type, e.g. mysql, postgresql, sqlite
}

interface Table {
  name: string;
  columns: Column[];
}

interface Column {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string;
  primaryKey: boolean;
  comment: string;
}

interface DatabaseTabProps {
  connectionId: string;
  connectionName: string;
  onConnectionFailed?: (error: string) => void;
}

export default function DatabaseTab({ connectionId, connectionName, onConnectionFailed }: DatabaseTabProps) {
  const { t } = useLanguage();
  const tabIdRef = useRef<string>(`tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);
  const [databases, setDatabases] = useState<Database[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<string>('');
  const [selectedDb, setSelectedDb] = useState<string>('');

  // SQL editor related state
  const [sqlQuery, setSqlQuery] = useState(`-- ${t('databaseTab.placeholderSqlQuery')}\nSELECT * FROM table_name;`);
  const [results, setResults] = useState<any[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [hasSelection, setHasSelection] = useState(false); // Track if text is selected
  const [showCreateDbModal, setShowCreateDbModal] = useState(false);
  const [newDbName, setNewDbName] = useState('');
  const [newDbCharset, setNewDbCharset] = useState('utf8mb4');
  const [newDbCollate, setNewDbCollate] = useState('utf8mb4_unicode_ci');
  const [newDbEncoding, setNewDbEncoding] = useState('UTF8');

  // Check text selection state
  const checkSelection = () => {
    const textarea = sqlTextareaRef.current;
    if (textarea) {
      const isSelected = textarea.selectionStart !== textarea.selectionEnd;
      if (isSelected !== hasSelection) {
        setHasSelection(isSelected);
      }
    }
  };
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const [rowCount, setRowCount] = useState<number | null>(null);

  // Left side tree structure related state
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  
  // Main tab state (SQL query vs table data vs design table)
  const [activeTab, setActiveTab] = useState<'query' | 'table' | 'design'>('query');
  
  // Current table data
  const [tableData, setTableData] = useState<any[]>([]);
  interface ColumnInfo {
    name: string;
    type: string;
    unifiedType: string;    // Unified type
    isPrimaryKey: boolean;
    nullable: boolean;
    defaultValue: string | null;
  }
  
  const [tableColumns, setTableColumns] = useState<ColumnInfo[]>([]);
  
  // Table sorting, filtering and row selection related state
  const [filteredTableData, setFilteredTableData] = useState<any[]>([]);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  
  // Edit mode state
  const [editingCell, setEditingCell] = useState<{ rowIndex: number; colName: string } | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const [editedRows, setEditedRows] = useState<Set<number>>(new Set());
  const [newRows, setNewRows] = useState<any[]>([]);
  const [deletedRows, setDeletedRows] = useState<Set<number>>(new Set()); // Track rows marked for deletion
  
  // Create table related state
  const [showCreateTableModal, setShowCreateTableModal] = useState(false);
  const [selectedDatabaseForTable, setSelectedDatabaseForTable] = useState<string | null>(null);
  const [selectedDatabaseTypeForTable, setSelectedDatabaseTypeForTable] = useState<string>('mysql');
  const [selectedSchemaForTable, setSelectedSchemaForTable] = useState<string | null>(null);
  
  // Edit table related state
  const [showEditTableModal, setShowEditTableModal] = useState(false);
  const [editingTableData, setEditingTableData] = useState<{tableName: string, columns: any[], schema?: string} | null>(null);
  
  // Divider dragging related state
  const [leftWidth, setLeftWidth] = useState(300); // Default left panel width
  const [topHeight, setTopHeight] = useState(120); // Default SQL editor height (10%)
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingVertical, setIsDraggingVertical] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const sqlEditorRef = useRef<HTMLDivElement>(null);
  const sqlTextareaRef = useRef<HTMLTextAreaElement>(null); // Ref for getting selected text

  // Toast notification state
  const [toasts, setToasts] = useState<Array<{id: string; message: string; type: 'success' | 'error' | 'info'}>>([]);

  // Update filtered data when table data changes
  useEffect(() => {
    setFilteredTableData(tableData);
    setSelectedRow(null); // Reset selected row
  }, [tableData]);

  // Show toast notification
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now().toString() + Math.random().toString(36).substr(2, 9);
    setToasts(prev => [...prev, { id, message, type }]);
    
    // Auto dismiss after 3 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, 3000);
  };

  // Format data display based on unified type
  const formatValueByType = (value: any, unifiedType: string): React.ReactNode => {
    if (value === null || value === undefined) {
      return <span className="text-gray-400 italic">NULL</span>;
    }

    switch (unifiedType) {
      case 'integer':
        return <span className="text-blue-600 font-mono">{String(value)}</span>;
      case 'float':
        return <span className="text-purple-600 font-mono">{String(value)}</span>;
      case 'boolean':
        return (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
            String(value).toLowerCase() === 'true' || value === true || value === 1
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {String(value)}
          </span>
        );
      case 'datetime':
        return <span className="text-orange-600 font-mono">{String(value)}</span>;
      case 'text':
        return <span className="text-gray-800">{String(value)}</span>;
      case 'string':
        return <span className="text-gray-700">{String(value)}</span>;
      case 'binary':
        return <span className="text-gray-500 italic">[BINARY DATA]</span>;
      default:
        return <span>{String(value)}</span>;
    }
  };

  // Start editing cell
  const handleCellDoubleClick = (rowIndex: number, colName: string, value: any) => {
    setEditingCell({ rowIndex, colName });
    setEditValue(String(value ?? ''));
  };

  // Save cell edit
  const handleCellSave = (rowIndex: number, colName: string) => {
    const updatedData = filteredTableData.map((row, idx) => 
      idx === rowIndex ? { ...row, [colName]: editValue } : { ...row }
    );
    setFilteredTableData(updatedData);
    
    // Check if this is a new row
    const isAddedRow = rowIndex >= tableData.length;
    if (isAddedRow) {
      // If it's a new row, sync update newRows data
      const newRowIndex = rowIndex - tableData.length;
      setNewRows(prev => prev.map((row, idx) => 
        idx === newRowIndex ? { ...row, [colName]: editValue } : row
      ));
    } else {
      // Mark row as edited (only for existing data rows)
      setEditedRows(prev => new Set([...prev, rowIndex]));
    }
    setEditingCell(null);
  };

  // Cancel cell edit
  const handleCellCancel = () => {
    setEditingCell(null);
    setEditValue('');
  };

  // Add new row
  const handleAddNewRow = () => {
    const emptyRow: any = {};
    tableColumns.forEach(col => {
      emptyRow[col.name] = null;
    });
    setNewRows([...newRows, emptyRow]);
    setFilteredTableData([...filteredTableData, emptyRow]);
  };

  // Delete row (mark for deletion)
  const handleDeleteRow = (rowIndex: number) => {
    // If it's a newly added row, remove it directly from the list
    if (newRows.includes(filteredTableData[rowIndex])) {
      const rowValue = filteredTableData[rowIndex];
      setNewRows(prev => prev.filter(r => r !== rowValue));
      setFilteredTableData(prev => prev.filter((_, i) => i !== rowIndex));
      setSelectedRow(null);
      showToast(t('databaseTab.newRowDeleted'), 'info');
      return;
    }

    setDeletedRows(prev => {
      const next = new Set(prev);
      if (next.has(rowIndex)) {
        next.delete(rowIndex);
        showToast(t('databaseTab.deleteMarkCancelled'), 'info');
      } else {
        next.add(rowIndex);
        showToast(t('databaseTab.rowMarkedForDelete'), 'success');
      }
      return next;
    });
  };

  // Create database
  const handleCreateDatabase = async () => {
    if (!newDbName.trim()) {
      showToast(t('databaseTab.pleaseEnterDbName'), 'error');
      return;
    }

    try {
      setLoading(true);
      const dbType = databases.length > 0 ? databases[0].type : '';
      const response = await fetch('/api/database/create-db', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          tabId: tabIdRef.current,
          dbName: newDbName,
          charset: newDbCharset,
          collate: newDbCollate,
          encoding: newDbEncoding
        })
      });

      const result = await response.json();
      if (result.code === 200) {
        showToast(t('databaseTab.databaseCreated', { name: newDbName }), 'success');
        setShowCreateDbModal(false);
        setNewDbName('');
        // Refresh structure
        refreshStructure();
      } else {
        showToast(t('databaseTab.createFailed', { message: result.message }), 'error');
      }
    } catch (err: any) {
      showToast(t('databaseTab.errorDuringCreate', { message: err.message }), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Refresh database structure
  const refreshStructure = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/database/connections/open', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: connectionId,
          tabId: tabIdRef.current
        }),
      });

      const result = await response.json();

      if (result.code === 200 && result.data) {
        setDatabases(result.data.databases);
      } else {
        showToast(t('databaseTab.refreshFailed', { message: result.message }), 'error');
      }
    } catch (err: any) {
      showToast(t('databaseTab.refreshFailed', { message: err?.message || t('databaseTab.unknownError') }), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Save all changes
  const handleSaveChanges = async () => {
    if (editedRows.size === 0 && newRows.length === 0 && deletedRows.size === 0) {
      showToast(t('databaseTab.noChangesToSave'), 'info');
      return;
    }

    try {
      setLoading(true);
      const primaryKeys = tableColumns.filter(col => col.isPrimaryKey).map(col => col.name);

      let successCount = 0;
      let errorMessages: string[] = [];

      // 1. Handle deletions
      if (deletedRows.size > 0) {
        for (const index of Array.from(deletedRows)) {
          const row = filteredTableData[index];
          const deleteResponse = await fetch('/api/database/table/data/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connectionId,
              tabId: tabIdRef.current,
              dbName: selectedDb,
              tableName: selectedTable,
              row,
              schema: selectedSchemaForTable
            })
          });
          const deleteResult = await deleteResponse.json();
          if (deleteResult.code === 200) {
            successCount++;
          } else {
            console.error('Delete failed:', deleteResult.message);
            errorMessages.push(t('databaseTab.deleteFailed', { message: deleteResult.message }));
          }
        }
      }

      // 2. Handle updates
      if (editedRows.size > 0) {
        for (const index of Array.from(editedRows)) {
          // Skip rows marked for deletion and newly added rows
          if (deletedRows.has(index) || newRows.includes(filteredTableData[index])) continue;
          
          const originalRow = tableData[index]; // Original data row
          const updatedRow = filteredTableData[index]; // Updated data row
          
          console.log('Sending update request:', {
            connectionId,
            tabId: tabIdRef.current,
            dbName: selectedDb,
            tableName: selectedTable,
            originalRow,
            updatedRow,
            schema: selectedSchemaForTable
          });
          
          const updateResponse = await fetch('/api/database/table/data/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connectionId,
              tabId: tabIdRef.current,
              dbName: selectedDb,
              tableName: selectedTable,
              originalRow,
              updatedRow,
              schema: selectedSchemaForTable
            })
          });
          const updateResult = await updateResponse.json();
          if (updateResult.code === 200) {
            successCount++;
          } else {
            console.error('Update failed:', updateResult.message);
            errorMessages.push(t('databaseTab.updateFailed', { message: updateResult.message }));
          }
        }
      }

      // 3. Handle inserts
      if (newRows.length > 0) {
        for (const row of newRows) {
          console.log('Sending insert request:', {
            connectionId,
            tabId: tabIdRef.current,
            dbName: selectedDb,
            tableName: selectedTable,
            row,
            schema: selectedSchemaForTable
          });
          
          const insertResponse = await fetch('/api/database/table/data/insert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              connectionId,
              tabId: tabIdRef.current,
              dbName: selectedDb,
              tableName: selectedTable,
              row,
              schema: selectedSchemaForTable
            })
          });
          const insertResult = await insertResponse.json();
          if (insertResult.code === 200) {
            successCount++;
          } else {
            console.error('Insert failed:', insertResult.message);
            errorMessages.push(t('databaseTab.insertFailed', { message: insertResult.message }));
          }
        }
      }

      // Show result message based on outcome
      if (errorMessages.length > 0) {
        // Errors occurred
        if (successCount > 0) {
          // Partial success
          showToast(t('databaseTab.syncPartialSuccess', { count: successCount, errorCount: errorMessages.length, errors: errorMessages.join('; ') }), 'error');
        } else {
          // All failed
          showToast(t('databaseTab.operationFailed', { errors: errorMessages.join('; ') }), 'error');
        }
      } else if (successCount > 0) {
        // All succeeded
        showToast(t('databaseTab.syncSuccess', { count: successCount }), 'success');
      } else {
        // No operations
        showToast(t('databaseTab.noChangesToSync'), 'info');
      }
      
      // Refresh data and clear state after successful operations (refresh if any operation succeeded)
      if (successCount > 0) {
        setEditedRows(new Set());
        setNewRows([]);
        setDeletedRows(new Set());
        setSelectedRow(null);
        if (selectedTable && selectedDb) {
          handleSelectTable(selectedDb, selectedTable);
        }
      }
    } catch (error: any) {
      console.error('Save failed:', error);
      showToast(t('databaseTab.saveFailed', { message: error.message }), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Cancel all changes
  const handleCancelChanges = () => {
    if (editedRows.size > 0 || newRows.length > 0 || deletedRows.size > 0) {
      if (confirm(t('databaseTab.confirmDiscardChanges'))) {
        setEditedRows(new Set());
        setNewRows([]);
        setDeletedRows(new Set());
        setEditingCell(null);
        setEditValue('');
        setSelectedRow(null);
        if (selectedTable && selectedDb) {
          handleSelectTable(selectedDb, selectedTable);
        }
        showToast(t('databaseTab.changesDiscarded'), 'info');
      }
    } else {
      showToast(t('databaseTab.noChangesToDiscard'), 'info');
    }
  };

  // Create table
  const handleCreateTable = async (tableName: string, columns: any[], schema?: string) => {
    const targetDb = selectedDatabaseForTable || selectedDb; // Prefer selected database for table, otherwise use current selected database
    if (!targetDb) {
      showToast(t('databaseTab.pleaseSelectDatabase'), 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/database/table/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          tabId: tabIdRef.current,
          dbName: targetDb,
          tableName,
          columns,
          schema: schema || selectedSchemaForTable
        })
      });

      const result = await response.json();
      if (result.code === 200) {
        showToast(t('databaseTab.tableCreated', { name: tableName }), 'success');
        // Refresh structure
        refreshStructure();
        // Switch back to query tab if coming from design page
        setActiveTab('query');
      } else {
        showToast(t('databaseTab.createFailed', { message: result.message }), 'error');
      }
    } catch (err: any) {
      showToast(t('databaseTab.errorDuringCreate', { message: err.message }), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Edit table
  const handleEditTable = async (tableName: string, columns: any[], schema?: string, originalTableName?: string) => {
    const targetDb = selectedDatabaseForTable || selectedDb; // Prefer selected database for table, otherwise use current selected database
    if (!targetDb) {
      showToast(t('databaseTab.pleaseSelectDatabase'), 'error');
      return;
    }

    try {
      setLoading(true);
      
      // Check if this is an incremental update (edit mode), columns may contain changedColumns, deletedColumns, addedColumns
      const isIncrementalUpdate = columns && typeof columns === 'object' && 
        ('changedColumns' in columns || 'deletedColumns' in columns || 'addedColumns' in columns);
      
      const incrementalData = columns as any;
      
      // Check if there are no changes
      if (isIncrementalUpdate && incrementalData.isNoChange) {
        showToast(t('databaseTab.noChangesDetected'), 'info');
        setLoading(false);
        return;
      }
      
      const requestBody: any = {
        connectionId,
        tabId: tabIdRef.current,
        dbName: targetDb,
        tableName,
        originalTableName: originalTableName || tableName,
        schema: schema || selectedSchemaForTable
      };
      
      if (isIncrementalUpdate) {
        // Incremental update: only pass changed fields
        requestBody.changedColumns = incrementalData.changedColumns || [];
        requestBody.deletedColumns = incrementalData.deletedColumns || [];
        requestBody.addedColumns = incrementalData.addedColumns || [];
        requestBody.allColumns = incrementalData.allColumns;  // Full list for validation
      } else {
        // Full update: pass all fields
        requestBody.columns = columns;
      }
      
      // Execute field update
      const response = await fetch('/api/database/table/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const result = await response.json();
      if (result.code !== 200) {
        showToast(t('databaseTab.updateFailed', { message: result.message }), 'error');
        setLoading(false);
        return;
      }

      // If there are index operations, execute index update
      if (incrementalData.indexOperations && 
          (incrementalData.indexOperations.created.length > 0 || 
           incrementalData.indexOperations.modified.length > 0 || 
           incrementalData.indexOperations.deleted.length > 0)) {
        
        const indexResponse = await fetch('/api/database/table/indices/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId,
            tabId: tabIdRef.current,
            dbName: targetDb,
            tableName,
            schema: schema || selectedSchemaForTable,
            operations: incrementalData.indexOperations
          })
        });

        const indexResult = await indexResponse.json();
        if (indexResult.code !== 200) {
          showToast(t('databaseTab.indexUpdateFailed', { message: indexResult.message }), 'error');
        }
      }

      showToast(t('databaseTab.tableStructureUpdated'), 'success');
      // Refresh structure
      refreshStructure();
      // Switch to table data view
      setActiveTab('table');
    } catch (err: any) {
      showToast(t('databaseTab.errorDuringUpdate', { message: err.message }), 'error');
    } finally {
      setLoading(false);
    }
  };

  // Delete table
  const handleDeleteTable = async (dbName: string, tableName: string, schema?: string) => {
    if (!dbName || !tableName) {
      showToast(t('databaseTab.missingDbOrTableName'), 'error');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch('/api/database/table/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId,
          tabId: tabIdRef.current,
          dbName,
          tableName,
          schema: schema || 'public'
        })
      });

      const result = await response.json();
      if (result.code === 200) {
        showToast(t('databaseTab.tableDeleted', { name: tableName }), 'success');
        // Refresh structure
        refreshStructure();
      } else {
        showToast(t('databaseTab.deleteFailed', { message: result.message }), 'error');
      }
    } catch (err: any) {
      showToast(t('databaseTab.errorDuringDelete', { message: err.message }), 'error');
    } finally {
      setLoading(false);
    }
  };
  
  // Delete table confirmation dialog state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [tableToDelete, setTableToDelete] = useState<{dbName: string, tableName: string, schema?: string} | null>(null);

  // Context menu related state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
    node: any;
  }>({ visible: false, x: 0, y: 0, node: null });

  // Show context menu
  const showContextMenu = (e: React.MouseEvent, node: any) => {
    e.preventDefault();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      node: node
    });
  };

  // Hide context menu
  const hideContextMenu = () => {
    setContextMenu({ visible: false, x: 0, y: 0, node: null });
  };

  // Create table from context menu
  const handleCreateTableFromContextMenu = (node: any) => {
    if (node.type === 'database' || node.type === 'mysql' || node.type === 'postgresql' || node.type === 'sqlite' || node.type === 'oracle') {
      setSelectedDatabaseForTable(node.name);
      // If node.type is 'database', try to get the real database type from databases[0].type
      const realType = (node.type === 'database' || node.type === 'folder' || node.type === 'schema') 
        ? (databases[0]?.type || 'mysql') 
        : node.type;
      setSelectedDatabaseTypeForTable(realType);
      setSelectedSchemaForTable(node.schema || 'public'); // For PostgreSQL, use public schema by default
      
      // Set empty creation state
      setEditingTableData({
        tableName: '',
        columns: [],
        schema: node.schema || 'public'
      });
      
      setActiveTab('design');
      hideContextMenu();
    }
  };

  // Edit table from context menu
  const handleEditTableFromContextMenu = async (node: any) => {
    if (node.type === 'table') {
      // Get table structure
      try {
        setLoading(true);
        const response = await fetch('/api/database/table/structure', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            connectionId,
            tabId: tabIdRef.current,
            dbName: node.dbName,
            tableName: node.name,
            schema: node.schema
          })
        });

        const result = await response.json();
        if (result.code === 200) {
          // Convert table structure data to format required by edit dialog
          const columns = result.data.columns.map((col: any) => ({
            name: col.name,
            dataType: col.dataType,
            typeLength: col.typeLength || '',
            scale: col.scale || '',
            nullable: col.nullable,
            defaultValue: col.defaultValue || null,
            isPrimaryKey: col.isPrimaryKey,
            autoIncrement: col.autoIncrement || false,
            unsigned: col.unsigned || false,
            comment: col.comment || ''
          }));

          setSelectedDatabaseForTable(node.dbName);
          setSelectedSchemaForTable(node.schema || 'public');
          const dbType = databases.find(db => db.name === node.dbName)?.type || 'mysql';
          setSelectedDatabaseTypeForTable(dbType);
          
          // Set initial values for edit mode
          setEditingTableData({
            tableName: node.name,
            columns: columns,
            schema: node.schema || 'public'
          });
          
          setActiveTab('design');
          hideContextMenu();
        } else {
          showToast(t('databaseTab.getStructureFailed', { message: result.message }), 'error');
        }
      } catch (err: any) {
        showToast(t('databaseTab.getStructureFailed', { message: err.message }), 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  // Handle clicks outside context menu
  useEffect(() => {
    const handleClickOutside = (e: Event) => {
      if (contextMenu.visible) {
        hideContextMenu();
      }
    };
  
    document.addEventListener('click', handleClickOutside);
      
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [contextMenu.visible]);
  
  // Close connection when component unmounts
  useEffect(() => {
    return () => {
      fetch('/api/database/connections/close', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          id: connectionId,
          tabId: tabIdRef.current
        }),
      }).catch(console.error);
    };
  }, []);
  
  // Open database connection
  useEffect(() => {
    async function openConnection() {
      try {
        setLoading(true);
        setError(null);
  
        // API call to open connection
        const response = await fetch('/api/database/connections/open', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            id: connectionId,
            tabId: tabIdRef.current
          }),
        });
  
        const result = await response.json();
  
        if (result.code === 200 && result.data) {
          console.log('Database structure data:', result.data.databases);
          setDatabases(result.data.databases);
          setConnectionInfo(result.data.connectionInfo);
            
          // Default select the first database
          if (result.data.databases.length > 0) {
            setSelectedDb(result.data.databases[0].name);
          }
        } else {
          const errorMsg = result.message || 'Connection failed';
          setError(errorMsg);
          onConnectionFailed?.(errorMsg);
        }
      } catch (err: any) {
        const errorMsg = `Failed to open connection: ${err?.message || 'Unknown error'}`;
        setError(errorMsg);
        onConnectionFailed?.(errorMsg);
      } finally {
        setLoading(false);
      }
    }
  
    openConnection();
  }, [connectionId, onConnectionFailed]);

  // Handle horizontal drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  // Handle vertical drag start
  const handleVerticalMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingVertical(true);
  };

  // Handle dragging
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && containerRef.current) {
        const containerRect = containerRef.current.getBoundingClientRect();
        const newWidth = e.clientX - containerRect.left;
        const minWidth = 200;
        const maxWidth = containerRect.width - 400;
        if (newWidth >= minWidth && newWidth <= maxWidth) {
          setLeftWidth(newWidth);
        }
      }

      if (isDraggingVertical && sqlEditorRef.current) {
        const editorRect = sqlEditorRef.current.getBoundingClientRect();
        const newHeight = e.clientY - editorRect.top;
        const minHeight = 100;
        
        // Get right panel total height, ensure enough space for bottom area
        if (rightPanelRef.current) {
          const panelRect = rightPanelRef.current.getBoundingClientRect();
          const maxHeight = panelRect.height - 150; // Reserve space for bottom result area
          if (newHeight >= minHeight && newHeight <= maxHeight) {
            setTopHeight(newHeight);
          }
        }
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsDraggingVertical(false);
    };

    if (isDragging || isDraggingVertical) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isDraggingVertical]);

  // Toggle node expand/collapse
  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
  };

  // Select table
  const handleSelectTable = async (dbName: string, tableName: string, page: number = 1, limit: number = pageSize) => {
    console.log('Select table:', { dbName, tableName, page, limit });
    setSelectedTable(tableName);
    setCurrentPage(page);
    // Clear previous query results when selecting a table, show table data
    setResults([]);
    setColumns([]);
    // Update SQL query to SELECT statement for the current table
    setSqlQuery(`SELECT * FROM ${tableName};`);
    
    try {
      // Check if database needs to be switched
      if (dbName !== selectedDb) {
        console.log(`Need to switch database: from ${selectedDb} to ${dbName}`);
        setSelectedDb(dbName);
        
        // PostgreSQL has independent connection cache for each database, no need to send USE statement
        const dbType = databases.length > 0 ? databases[0].type : 'mysql';
        if (dbType !== 'postgresql') {
          // MySQL and SQLite need to call switch database API
          try {
            const switchResponse = await fetch('/api/database/query', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                connectionId,
                tabId: tabIdRef.current,
                query: `USE ${dbName};`
              }),
            });
            
            const switchResult = await switchResponse.json();
            if (switchResult.code !== 200) {
              console.warn(`Switch database failed: ${switchResult.message}`);
              showToast(t('databaseTab.switchDbFailed'), 'error');
              return;
            }
          } catch (switchError) {
            console.error('Switch database error:', switchError);
            showToast(t('databaseTab.switchDbFailed'), 'error');
            return;
          }
        }
      }
      
      // Get table data directly
      const dataResponse = await fetch('/api/database/table/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          connectionId, 
          tabId: tabIdRef.current,
          dbName, 
          tableName,
          page,
          limit
        }),
      });
      
      const dataResult = await dataResponse.json();
      if (dataResult.code === 200) {
        setTableData(dataResult.data.rows || []);
        setTableColumns(dataResult.data.columns || []);
        // Set execution time info
        setExecutionTime(dataResult.data.executionTime || 0);
        // Set row count
        setRowCount(dataResult.data.rows?.length || 0);
      } else {
        showToast(`${t('databaseTab.getTableRowFailed')}: ${dataResult.message}`, 'error');
        setTableData([]);
        setTableColumns([]);
        setExecutionTime(null);
        setRowCount(null);
      }
    } catch (error) {
      console.error('Failed to get table data:', error);
      showToast(t('databaseTab.getTableRowFailed'), 'error');
      setTableData([]);
      setTableColumns([]);
    }
  };

  // Pagination jump handler
  const handlePageChange = (newPage: number) => {
    // Find the currently selected database name
    const findDbName = (nodes: any[]): string | null => {
      for (const node of nodes) {
        if (node.children) {
          const found = node.children.find((c: any) => c.name === selectedTable);
          if (found) return node.dbName || node.name;
          const deepFound = findDbName(node.children);
          if (deepFound) return deepFound;
        }
      }
      return null;
    };

    // Simplified processing: Since handleSelectTable requires dbName, we match from the database list
    const dbName = databases.find(db => 
      db.tables && db.tables.includes(selectedTable || '')
    )?.name || selectedDb;

    if (selectedTable && dbName) {
      handleSelectTable(dbName, selectedTable, newPage, pageSize);
    }
  };

  // Page size change handler
  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    const dbName = databases.find(db => 
      db.tables && db.tables.includes(selectedTable || '')
    )?.name || selectedDb;
    
    if (selectedTable && dbName) {
      handleSelectTable(dbName, selectedTable, 1, newSize);
    }
  };

  // Execute SQL query
  const executeQuery = async () => {
    // Get selected text, or get full text if nothing is selected
    const textarea = sqlTextareaRef.current;
    let queryToExecute = sqlQuery;
    
    if (textarea && textarea.selectionStart !== textarea.selectionEnd) {
      queryToExecute = sqlQuery.substring(textarea.selectionStart, textarea.selectionEnd);
    }

    if (!queryToExecute.trim()) {
      showToast(t('databaseTab.enterSqlOrSelect'), 'info');
      return;
    }

    setIsExecuting(true);
    const startTime = Date.now();
    // Reset selected table data when executing query
    setSelectedTable(null);
    setTableData([]);
    setTableColumns([]);

    try {
      const response = await fetch('/api/database/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          connectionId, 
          tabId: tabIdRef.current,
          query: queryToExecute,
          dbName: selectedDb,
          schema: selectedSchemaForTable || 'public'
        }),
      });

      const result = await response.json();

      if (result.code === 200) {
        setResults(result.data.rows || []);
        setColumns(result.data.columns || []);
        
        // Sync current database context
        if (result.data.currentDb && result.data.currentDb !== selectedDb) {
          setSelectedDb(result.data.currentDb);
        }

        setExecutionTime(Date.now() - startTime);
        setRowCount(result.data.rows?.length || 0);
      } else {
        showToast(`${t('databaseTab.queryFailed')}${result.message}`, 'error');
      }
    } catch (error) {
      console.error('Failed to execute query:', error);
      showToast('Failed to execute query', 'error');
    } finally {
      setIsExecuting(false);
    }
  };

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Render tree node
  const renderTreeNode = (node: any, level: number = 0, parentId: string = ''): React.ReactNode => {
    const nodeId = `${parentId}-${node.name}-${node.type}`;
    const isExpanded = expandedNodes.has(nodeId);
    const paddingLeft = 20 + level * 20;

    // Render icon
    const getIcon = () => {
      switch (node.type) {
        case 'database':
        case 'mysql':
        case 'postgresql':
        case 'sqlite':
          return <i className={`fas fa-database text-base ${node.status === 'connected' ? 'text-blue-500' : 'text-gray-400'}`}></i>;
        case 'schema':
          return <i className="fas fa-project-diagram text-sm text-green-500"></i>;
        case 'folder':
          return <i className="fas fa-folder text-base text-yellow-500"></i>;
        case 'table':
          return <i className="fas fa-table text-sm text-gray-500"></i>;
        default:
          return <i className="fas fa-database text-base text-blue-500"></i>;
      }
    };

    const hasChildren = node.children && node.children.length > 0;
    const isSelected = node.type === 'table' && selectedTable === node.name;

    return (
      <div key={nodeId}>
        <div
          className={`hover:bg-gray-100 cursor-pointer transition-colors flex items-center gap-2 py-1.5 ${
            isSelected ? 'bg-blue-50' : ''
          }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => {
            if (node.type === 'table') {
              handleSelectTable(node.dbName, node.name, node.schema);
            } else {
              if (node.type === 'database') {
                setSelectedDb(node.name);
              }
              toggleNode(nodeId);
            }
          }}
          onContextMenu={(e) => showContextMenu(e, node)}
        >
          {hasChildren ? (
            <i className={`fas fa-caret-${isExpanded ? 'down' : 'right'} text-xs text-gray-400`}></i>
          ) : (
            <span className="w-3"></span>
          )}
          {getIcon()}
          <span className={`text-sm flex-1 truncate ${node.type === 'database' && node.status === 'connected' ? 'font-bold text-blue-800' : 'text-gray-800'}`}>
            {node.name}
            {node.tableCount !== undefined && node.type !== 'table' && (
              <span className="ml-1 text-[10px] text-gray-400">({node.tableCount})</span>
            )}
          </span>
        </div>
        
        {isExpanded && node.children && (
          <div>
            {node.children.map((child: any) => renderTreeNode(child, level + 1, nodeId))}
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center">
          <i className="fas fa-spinner fa-spin text-4xl text-[#007acc] mb-4"></i>
          <p className="text-gray-600">{t('databaseTab.connecting')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center bg-white">
        <div className="text-center max-w-md">
          <i className="fas fa-exclamation-triangle text-6xl text-red-500 mb-4"></i>
          <h3 className="text-xl font-bold text-gray-800 mb-2">{t('databaseTab.connectionFailed')}</h3>
          <p className="text-gray-600 whitespace-pre-wrap">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef} 
      className="h-full flex bg-[#F9FAFB]" 
      style={{ userSelect: isDragging ? 'none' : 'auto' }}
    >
      {/* Left panel: Database and table list */}
      <div
        className="flex flex-col bg-white border-r border-gray-200"
        style={{ width: `${leftWidth}px`, minWidth: '200px' }}
      >
        {/* Connection info header */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 overflow-hidden">
              <i className="fas fa-database text-lg text-blue-500 flex-shrink-0"></i>
              <h3 className="font-semibold text-gray-800 text-sm truncate" title={connectionName}>
                {connectionName}
              </h3>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  refreshStructure();
                }}
                className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-all"
                title={t('database.refreshStructure')}
              >
                <i className={`fas fa-sync-alt text-xs ${loading ? 'fa-spin' : ''}`}></i>
              </button>
              {(databases.length > 0 && (databases[0].type === 'mysql' || databases[0].type === 'postgresql' || (databases[0].type === 'database' && connectionInfo?.toLowerCase().includes('5432')))) && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCreateDbModal(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded-md transition-all"
                  title={t('database.newDatabase')}
                >
                  <i className="fas fa-plus-circle text-xs"></i>
                </button>
              )}
              {selectedDb && (
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedDatabaseForTable(selectedDb);
                    // If PostgreSQL, get current schema
                    if (databases[0]?.type === 'postgresql') {
                      setSelectedSchemaForTable('public'); // Default schema
                    }
                    setShowCreateTableModal(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-md transition-all"
                  title={t('database.newTable')}
                >
                  <i className="fas fa-table text-xs"></i>
                </button>
              )}
            </div>
          </div>
          <p className="text-xs text-gray-500 truncate" title={connectionInfo}>
            {connectionInfo}
          </p>
          <div className="mt-2 flex items-center gap-1 flex-wrap">
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-700">
              <i className="fas fa-check-circle mr-1"></i>
              {t('databaseTab.connected')}
            </span>
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
              {t('databaseTab.databaseCount', { count: databases.length })}
            </span>
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-purple-100 text-purple-700">
              {t('databaseTab.tableCount', { count: databases.reduce((count, db) => count + db.tableCount, 0) })}
            </span>
            <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
              {databases.length > 0 ? databases[0].type : 'Unknown'}
            </span>
          </div>
        </div>

        {/* Database and table list - using tree structure */}
        <div className="flex-1 overflow-y-auto p-2">
          {databases.map((db) => {
            // Directly render database tree structure
            return renderTreeNode(db, 0, 'root');
          })}
        </div>
      </div>

      {/* Divider */}
      <div
        className={`w-1 bg-gray-200 hover:bg-[#007acc] cursor-col-resize flex items-center justify-center transition-colors ${
          isDragging ? 'bg-[#007acc]' : ''
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="w-0.5 h-8 bg-gray-400 rounded"></div>
      </div>

      {/* Right panel: SQL editor and results - vertical layout */}
      <div
        ref={rightPanelRef}
        className="flex-1 flex flex-col bg-white overflow-hidden"
      >
        {activeTab === 'design' && selectedDatabaseForTable && editingTableData ? (
          <TableDesignView
            connectionId={connectionId}
            tabId={tabIdRef.current}
            dbName={selectedDatabaseForTable}
            databaseType={selectedDatabaseTypeForTable}
            schema={editingTableData.schema || selectedSchemaForTable || undefined}
            initialTableName={editingTableData.tableName}
            initialColumns={editingTableData.columns}
            isEditing={!!editingTableData.tableName}
            onSave={editingTableData.tableName ? handleEditTable : handleCreateTable}
            onCancel={() => setActiveTab(selectedTable ? 'table' : 'query')}
          />
        ) : (
          <div className="flex-1 flex flex-col">
            {/* Top toolbar */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-50 border border-gray-300 rounded px-2 py-1">
              <i className="fas fa-database text-xs text-blue-500"></i>
              <select
                className="bg-transparent text-sm font-medium text-gray-800 focus:outline-none min-w-[120px] cursor-pointer"
                value={selectedDb || ''}
                onChange={async (e) => {
                  const newDb = e.target.value;
                  setSelectedDb(newDb);
                  // Execute USE command in backend session when switching database
                  try {
                    await fetch('/api/database/query', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        connectionId,
                        tabId: tabIdRef.current,
                        query: `USE \`${newDb}\`` // MySQL-specific logic, other DBs similar
                      })
                    });
                    showToast(t('databaseTab.switchedToDatabase', { name: newDb }), 'success');
                  } catch (err) {
                    console.error('Switch database failed:', err);
                  }
                }}
              >
                {databases.map(db => (
                  <option key={db.name} value={db.name}>{db.name}</option>
                ))}
              </select>
            </div>
            </div>
            
            <div className="flex items-center gap-2">
            <button
              className="px-3 py-1.5 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors flex items-center gap-1 shadow-sm"
              onClick={executeQuery}
              disabled={isExecuting}
            >
              <i className="fas fa-play text-xs"></i>
              {isExecuting ? t('databaseTab.executing') : (hasSelection ? t('databaseTab.runSelected') : t('databaseTab.run'))}
            </button>
            <button
              className="px-3 py-1.5 text-sm bg-white border border-gray-300 text-gray-700 rounded hover:bg-gray-50 transition-colors flex items-center gap-1"
              onClick={() => setSqlQuery('')}
            >
              <i className="fas fa-eraser text-xs"></i>
              {t('databaseTab.clear')}
            </button>
            </div>
            </div>

            {/* SQL editor - top half */}
            <div
          ref={sqlEditorRef}
          className="flex flex-col border-b border-gray-200"
          style={{ height: `${topHeight}px`, minHeight: '100px' }}
        >
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 text-xs text-gray-500 border-b border-gray-200">
            <div className="flex items-center gap-4">
              <span className="font-semibold flex items-center gap-1">
                <i className="fas fa-code text-[#007acc]"></i>
                {t('databaseTab.sqlQuery')}
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-gray-400">Ln {sqlQuery.split('\n').length}, Col {sqlQuery.split('\n')[sqlQuery.split('\n').length - 1].length}</span>
            </div>
          </div>
          <div className="flex-1 relative">
            <textarea
              ref={sqlTextareaRef}
              value={sqlQuery}
              onChange={(e) => {
                setSqlQuery(e.target.value);
                // Input usually clears selection
                setHasSelection(false);
              }}
              onSelect={checkSelection}
              onMouseUp={checkSelection}
              onKeyUp={checkSelection}
              onBlur={() => {
                // Slight delay to prevent state change before button click
                setTimeout(checkSelection, 100);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  executeQuery();
                }
              }}
              className="w-full h-full p-3 font-mono text-sm resize-none focus:outline-none"
              placeholder={t('databaseTab.placeholderSqlQuery')}
              spellCheck={false}
            />
            <div className="absolute bottom-2 right-2 text-xs text-gray-400 pointer-events-none">
              {t('databaseTab.executeShortcut')}
            </div>
          </div>
            </div>

            {/* Horizontal divider (vertical resize) */}
            <div
          className={`h-1 bg-gray-200 hover:bg-[#007acc] cursor-row-resize flex items-center justify-center transition-colors ${
            isDraggingVertical ? 'bg-[#007acc]' : ''
          }`}
          onMouseDown={handleVerticalMouseDown}
        >
          <div className="h-0.5 w-8 bg-gray-400 rounded"></div>
            </div>

            {/* Data display area - bottom half */}
            <div className="flex-1 flex flex-col min-h-0">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 text-xs text-gray-500 border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center gap-4">
                  <span className="font-semibold flex items-center gap-1">
                    <i className="fas fa-list text-green-600"></i>
                    {t('databaseTab.resultDisplay')}
                  </span>
                  {selectedTable && (
                    <span className="text-gray-600">{t('databaseTab.currentTable')} <span className="font-medium text-gray-800">{selectedTable}</span></span>
                  )}
                </div>
                <div className="flex items-center gap-4">
                  {executionTime !== null && results.length > 0 && (
                    <span>{t('databaseTab.executionTime')} {executionTime}ms</span>
                  )}
                  {(rowCount !== null || tableData.length > 0) && (
                    <span>{t('databaseTab.rowsCount', { count: rowCount ?? tableData.length })}</span>
                  )}
                </div>
              </div>

              {/* Table scroll container - use absolute positioning to ensure clear boundaries */}
              <div className="flex-1 relative min-h-0">
                <div className="absolute inset-0 overflow-auto bg-white">
                {/* Case 1: Display SQL query results */}
                {results.length > 0 ? (
                  <table className="bg-white border-collapse" style={{ minWidth: '100%' }}>
                    <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                      <tr>
                        <th className="py-1 px-2 border-b border-r border-gray-200 text-center text-[9px] font-medium text-gray-400" style={{ minWidth: '40px', width: '40px' }}>#</th>
                        {columns.map((col, index) => (
                          <th 
                            key={index} 
                            className="py-1 px-2 border-b border-r border-gray-200 text-left text-[11px] font-semibold text-gray-600 whitespace-nowrap"
                            style={{ minWidth: '100px' }}
                          >
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {results.map((row, rowIndex) => (
                        <tr 
                          key={rowIndex} 
                          className={`hover:bg-blue-50/50 ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                        >
                          <td className="py-0.5 px-2 border-b border-r border-gray-100 text-center text-[9px] text-gray-400 font-mono" style={{ minWidth: '40px', width: '40px' }}>{rowIndex + 1}</td>
                          {columns.map((col, colIndex) => (
                            <td 
                              key={colIndex} 
                              className="py-0.5 px-2 border-b border-r border-gray-100 text-[11px] text-gray-700 whitespace-nowrap font-mono"
                              style={{ minWidth: '100px' }}
                              title={String(row[col])}
                            >
                              {String(row[col])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : tableColumns.length > 0 ? (
                  /* Case 2: Display data after clicking table (including empty table) */
                  <table className="bg-white border-collapse" style={{ minWidth: '100%' }}>
                    <thead className="sticky top-0 z-10 bg-gray-50 shadow-sm">
                      <tr>
                        <th className="py-1 px-2 border-b border-r border-gray-200 text-center text-[9px] font-medium text-gray-400" style={{ minWidth: '40px', width: '40px' }}>#</th>
                        {tableColumns.map((col, index) => (
                          <th 
                            key={index} 
                            className="px-2 border-b border-r border-gray-200 text-left text-[9px] font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap relative overflow-hidden"
                            style={{ minWidth: '100px', paddingTop: '6px', paddingBottom: '12px' }}
                          >
                            {col.name}
                            <span className="absolute bottom-0.5 right-1 text-[7px] font-normal text-gray-400 lowercase truncate max-w-[calc(100%-8px)]" title={col.type}>{col.type}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTableData.length > 0 ? (
                        filteredTableData.map((row, rowIndex) => (
                          <tr 
                            key={rowIndex} 
                            className={`hover:bg-blue-50/50 cursor-pointer transition-colors ${
                              deletedRows.has(rowIndex) ? 'bg-red-100 opacity-75 line-through' :
                              editedRows.has(rowIndex) ? 'bg-yellow-50' : 
                              selectedRow === rowIndex ? 'bg-blue-50' : 
                              newRows.includes(row) ? 'bg-green-50' :
                              rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                            }`}
                            onClick={() => setSelectedRow(rowIndex)}
                          >
                            <td className="py-0.5 px-2 border-b border-r border-gray-100 text-center text-[9px] text-gray-400 font-mono" style={{ minWidth: '40px', width: '40px' }}>
                              {newRows.includes(row) ? <span className="text-green-600 font-bold">+</span> : rowIndex + 1}
                            </td>
                            {tableColumns.map((col, colIndex) => (
                              <td 
                                key={colIndex} 
                                className={`py-0.5 px-2 border-b border-r border-gray-100 text-[11px] whitespace-nowrap cursor-text relative transition-colors ${
                                  editingCell?.rowIndex === rowIndex && editingCell?.colName === col.name
                                    ? 'bg-blue-100'
                                    : 'hover:bg-gray-100'
                                }`}
                                style={{ minWidth: '100px' }}
                                onDoubleClick={() => handleCellDoubleClick(rowIndex, col.name, row[col.name])}
                              >
                                {editingCell?.rowIndex === rowIndex && editingCell?.colName === col.name ? (
                                  <input
                                    type="text"
                                    value={editValue}
                                    onChange={(e) => setEditValue(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleCellSave(rowIndex, col.name);
                                      } else if (e.key === 'Escape') {
                                        handleCellCancel();
                                      }
                                    }}
                                    onBlur={() => handleCellSave(rowIndex, col.name)}
                                    autoFocus
                                    className="w-full px-1 py-0.5 border border-blue-500 rounded focus:outline-none text-[11px]"
                                  />
                                ) : (
                                  <span title={String(row[col.name])}>
                                    {formatValueByType(row[col.name], col.unifiedType)}
                                  </span>
                                )}
                              </td>
                            ))}
                          </tr>
                        ))
                      ) : (
                        /* When table structure exists but no data, show hint message */
                        <tr>
                          <td colSpan={tableColumns.length + 1} className="py-4 text-center text-gray-400 text-xs bg-gray-50/50">
                            {t('databaseTab.emptyTable')}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                ) : (
                  /* No data display state */
                  <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-gray-50/30">
                    <div className="mb-4 opacity-20">
                      <i className="fas fa-table text-8xl"></i>
                    </div>
                    <p className="text-sm">{t('databaseTab.clickToStart')}</p>
                  </div>
                )}
                </div>
              </div>

              {/* Bottom action bar - Navicat style */}
              <div className="h-10 border-t border-gray-200 bg-gray-50 flex items-center justify-between px-3 flex-shrink-0">
                <div className="flex items-center gap-1">
              {/* Data operation buttons */}
              <button 
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded transition-colors"
                title={t('database.addNewRow')}
                onClick={handleAddNewRow}
              >
                <i className="fas fa-plus text-xs"></i>
              </button>
              <button
                className={`p-1.5 rounded transition-colors ${selectedRow !== null ? 'text-gray-500 hover:text-red-600 hover:bg-gray-200' : 'text-gray-300 cursor-not-allowed'}`}
                title={selectedRow !== null ? `${deletedRows.has(selectedRow) ? t('databaseTab.cancelDelete') : t('databaseTab.markDelete')} ${t('databaseTab.thisRow')}` : t('databaseTab.pleaseSelectRow')}
                disabled={selectedRow === null}
                onClick={() => {
                  if (selectedRow !== null) {
                    handleDeleteRow(selectedRow);
                  }
                }}
              >
                <i className="fas fa-minus text-xs"></i>
              </button>
              <div className="w-px h-4 bg-gray-300 mx-1"></div>
              <button
                className={`p-1.5 rounded transition-colors ${
                  editedRows.size > 0 || newRows.length > 0 || deletedRows.size > 0
                    ? 'text-gray-500 hover:text-green-600 hover:bg-gray-200'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title={t('databaseTab.saveChanges', { count: editedRows.size + newRows.length + deletedRows.size })}
                disabled={editedRows.size === 0 && newRows.length === 0 && deletedRows.size === 0}
                onClick={handleSaveChanges}
              >
                <i className="fas fa-check text-xs"></i>
              </button>
              <button
                className={`p-1.5 rounded transition-colors ${
                  editedRows.size > 0 || newRows.length > 0 || deletedRows.size > 0
                    ? 'text-gray-500 hover:text-orange-600 hover:bg-gray-200'
                    : 'text-gray-300 cursor-not-allowed'
                }`}
                title={t('databaseTab.cancelChanges', { count: editedRows.size + newRows.length + deletedRows.size })}
                disabled={editedRows.size === 0 && newRows.length === 0 && deletedRows.size === 0}
                onClick={handleCancelChanges}
              >
                <i className="fas fa-times text-xs"></i>
              </button>
              <div className="w-px h-4 bg-gray-300 mx-1"></div>
              <button
                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded transition-colors"
                title={t('database.refreshData')}
                onClick={() => showToast(t('databaseTab.dataRefreshed'), 'success')}
              >
                <i className="fas fa-sync-alt text-xs"></i>
              </button>
                </div>

                <div className="flex items-center gap-4">
              {/* Pagination info */}
              <div className="flex items-center gap-2 text-[11px] text-gray-500">
                <span>{t('databaseTab.itemsPerPage')}</span>
                <select 
                  className="bg-transparent border border-gray-300 rounded px-1 py-0.5 focus:outline-none"
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(Number(e.target.value))}
                >
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                  <option value={200}>200</option>
                </select>
              </div>

              <div className="w-px h-4 bg-gray-300"></div>

              <div className="flex items-center gap-1">
                <button 
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded disabled:text-gray-300"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(1)}
                  title={t('database.firstPage')}
                >
                  <i className="fas fa-step-backward text-[10px]"></i>
                </button>
                <button 
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded disabled:text-gray-300"
                  disabled={currentPage === 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  title={t('database.previousPage')}
                >
                  <i className="fas fa-chevron-left text-[10px]"></i>
                </button>
                
                <span className="text-[11px] text-gray-600 px-2 min-w-[60px] text-center">
                  {t('databaseTab.pageNumber', { page: currentPage })}
                </span>

                <button 
                  className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-gray-200 rounded disabled:text-gray-300"
                  disabled={tableData.length < pageSize}
                  onClick={() => handlePageChange(currentPage + 1)}
                  title={t('database.nextPage')}
                >
                  <i className="fas fa-chevron-right text-[10px]"></i>
                </button>
              </div>
            </div>
            </div>
            </div>
          </div>
        )}
      </div>

      {/* New database modal */}
      {showCreateDbModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md overflow-hidden animate-fade-in">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <i className="fas fa-plus-circle text-green-500"></i>
                {t('databaseTab.newDatabase', { type: databases.length > 0 ? (databases[0].type === 'mysql' ? 'MySQL' : 'PostgreSQL') : '' })}
              </h3>
              <button 
                onClick={() => setShowCreateDbModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors p-1"
              >
                <i className="fas fa-times text-lg"></i>
              </button>
            </div>
            
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                  {t('databaseTab.databaseName')}
                  <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-800 placeholder-gray-400"
                  placeholder={t('databaseTab.databaseNamePlaceholder')}
                  value={newDbName}
                  onChange={(e) => setNewDbName(e.target.value)}
                  autoFocus
                />
              </div>
              
              {databases.length > 0 && databases[0].type === 'mysql' && (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">{t('databaseTab.charsetLabel')}</label>
                    <select
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-800"
                      value={newDbCharset}
                      onChange={(e) => {
                        const charset = e.target.value;
                        setNewDbCharset(charset);
                        // Linkage: set default collation based on charset
                        if (charset === 'utf8mb4') setNewDbCollate('utf8mb4_unicode_ci');
                        else if (charset === 'utf8') setNewDbCollate('utf8_general_ci');
                        else if (charset === 'latin1') setNewDbCollate('latin1_swedish_ci');
                        else if (charset === 'gbk') setNewDbCollate('gbk_chinese_ci');
                      }}
                    >
                      <option value="utf8mb4">utf8mb4 {t('databaseTab.recommended')}</option>
                      <option value="utf8">utf8</option>
                      <option value="latin1">latin1</option>
                      <option value="gbk">gbk</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">{t('databaseTab.collationLabel')}</label>
                    <select
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-800"
                      value={newDbCollate}
                      onChange={(e) => setNewDbCollate(e.target.value)}
                    >
                      {newDbCharset === 'utf8mb4' && (
                        <>
                          <option value="utf8mb4_unicode_ci">utf8mb4_unicode_ci</option>
                          <option value="utf8mb4_general_ci">utf8mb4_general_ci</option>
                          <option value="utf8mb4_bin">utf8mb4_bin</option>
                        </>
                      )}
                      {newDbCharset === 'utf8' && (
                        <>
                          <option value="utf8_general_ci">utf8_general_ci</option>
                          <option value="utf8_unicode_ci">utf8_unicode_ci</option>
                          <option value="utf8_bin">utf8_bin</option>
                        </>
                      )}
                      {newDbCharset === 'latin1' && (
                        <option value="latin1_swedish_ci">latin1_swedish_ci</option>
                      )}
                      {newDbCharset === 'gbk' && (
                        <option value="gbk_chinese_ci">gbk_chinese_ci</option>
                      )}
                    </select>
                  </div>
                </>
              )}

              {databases.length > 0 && databases[0].type === 'postgresql' && (
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-gray-700">{t('databaseTab.encodingLabel')}</label>
                  <select
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-gray-800"
                    value={newDbEncoding}
                    onChange={(e) => setNewDbEncoding(e.target.value)}
                  >
                    <option value="UTF8">UTF8 {t('databaseTab.recommended')}</option>
                    <option value="SQL_ASCII">SQL_ASCII</option>
                    <option value="EUC_CN">EUC_CN</option>
                  </select>
                </div>
              )}
            </div>
            
            <div className="px-6 py-4 bg-gray-50 flex items-center justify-end gap-3">
              <button
                onClick={() => setShowCreateDbModal(false)}
                className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded-lg transition-all"
              >
                {t('databaseTab.cancel')}
              </button>
              <button
                onClick={handleCreateDatabase}
                disabled={loading || !newDbName.trim()}
                className="px-5 py-2 text-sm font-bold bg-[#007acc] text-white rounded-lg hover:bg-[#005a9e] disabled:bg-gray-300 disabled:cursor-not-allowed transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    {t('databaseTab.creating')}
                  </>
                ) : t('databaseTab.createNow')}
              </button>
            </div>
          </div>
        </div>
      )}
            
      {/* Create table modal */}
      {showCreateTableModal && selectedDatabaseForTable && (
        <DesignTableDialog 
          isOpen={showCreateTableModal}
          onClose={() => setShowCreateTableModal(false)}
          onCreate={handleCreateTable}
          dbName={selectedDatabaseForTable}
          databaseType={selectedDatabaseTypeForTable}
          schema={selectedSchemaForTable || undefined}
        />
      )}
      
      {/* Edit table modal */}
      {showEditTableModal && selectedDatabaseForTable && editingTableData && (
        <DesignTableDialog
          isOpen={showEditTableModal}
          onClose={() => setShowEditTableModal(false)}
          onCreate={handleCreateTable} // Pass create function just in case
          onEdit={handleEditTable}
          dbName={selectedDatabaseForTable}
          databaseType={selectedDatabaseTypeForTable}
          schema={editingTableData.schema || selectedSchemaForTable || undefined}
          tableName={editingTableData.tableName}
          initialColumns={editingTableData.columns}
          isEditing={true}
        />
      )}
      
      {/* Delete confirmation dialog */}
      <DeleteConfirmDialog
        open={showDeleteConfirm}
        title={t('database.tableTitle')}
        content={`${tableToDelete?.dbName}.${tableToDelete?.tableName}`}
        onConfirm={() => {
          if (tableToDelete) {
            handleDeleteTable(tableToDelete.dbName, tableToDelete.tableName, tableToDelete.schema);
          }
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      {/* Context menu */}
      {contextMenu.visible && contextMenu.node && (
        <div
          className="fixed z-[100] bg-white border border-gray-200 rounded-md shadow-lg py-2 min-w-[150px] text-sm"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {(contextMenu.node.type === 'database' ||
            contextMenu.node.type === 'mysql' ||
            contextMenu.node.type === 'postgresql' ||
            contextMenu.node.type === 'sqlite') && (
            <button
              className="w-full text-left px-4 py-2 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
              onClick={() => handleCreateTableFromContextMenu(contextMenu.node)}
            >
              <i className="fas fa-table text-xs"></i>
              {t('databaseTab.createTable')}
            </button>
          )}
          {contextMenu.node.type === 'table' && databases.find(db => db.name === contextMenu.node.dbName)?.type !== 'sqlite' && (
            <>
              <button
                className="w-full text-left px-4 py-2 hover:bg-blue-50 hover:text-blue-600 flex items-center gap-2"
                onClick={() => handleEditTableFromContextMenu(contextMenu.node)}
              >
                <i className="fas fa-edit text-xs"></i>
                {t('databaseTab.editTable')}
              </button>
              <button
                className="w-full text-left px-4 py-2 hover:bg-red-50 hover:text-red-600 flex items-center gap-2"
                onClick={() => {
                  setTableToDelete({
                    dbName: contextMenu.node.dbName,
                    tableName: contextMenu.node.name,
                    schema: contextMenu.node.schema
                  });
                  setShowDeleteConfirm(true);
                  hideContextMenu();
                }}
              >
                <i className="fas fa-trash text-xs"></i>
                {t('databaseTab.deleteTable')}
              </button>
              <div className="border-t border-gray-200 my-1"></div>
            </>
          )}
        </div>
      )}
            
      {/* Toast notification container */}
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

      <style jsx global>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in {
          animation: slideIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}