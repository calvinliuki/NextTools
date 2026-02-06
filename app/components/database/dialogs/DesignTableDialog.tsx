import React, { useState } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';

export interface ColumnDefinition {
  name: string;
  dataType: string;
  typeLength?: string;  // Added {t('database.typeNameLengthPrecision')} field
  nullable: boolean;
  defaultValue: string | number | null;
  isPrimaryKey: boolean;
  autoIncrement?: boolean;
  unsigned?: boolean;   // Unsigned
  comment?: string;
}

interface DesignTableDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (tableName: string, columns: ColumnDefinition[], schema?: string) => void;
  onEdit?: (newTableName: string, columns: ColumnDefinition[], schema?: string, originalTableName?: string) => void;
  dbName: string;
  databaseType: string;
  schema?: string;
  tableName?: string;
  initialColumns?: ColumnDefinition[];
  isEditing?: boolean;
}

const DesignTableDialog: React.FC<DesignTableDialogProps> = ({
  isOpen,
  onClose,
  onCreate,
  onEdit,
  dbName,
  databaseType,
  schema,
  tableName: initialTableName = '',
  initialColumns = [],
  isEditing = false
}) => {
  const { t } = useLanguage();
  const [tableName, setTableName] = useState(initialTableName);
  const [columns, setColumns] = useState<ColumnDefinition[]>(initialColumns.length > 0 ? initialColumns : [
    {
      name: '',
      dataType: databaseType === 'postgresql' ? 'integer' : databaseType === 'mysql' ? 'INT' : 'INTEGER',
      typeLength: '',
      nullable: true,
      defaultValue: null,
      isPrimaryKey: false,
      autoIncrement: false
    }
  ]);

  const addColumn = () => {
    setColumns([
      ...columns,
      {
        name: '',
        dataType: databaseType === 'postgresql' ? 'integer' : databaseType === 'mysql' ? 'INT' : 'INTEGER',
        typeLength: '',
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

  const updateColumn = (index: number, field: keyof ColumnDefinition, value: any) => {
    setColumns(prevColumns => {
      const newColumns = [...prevColumns];
      newColumns[index] = { ...newColumns[index], [field]: value };
      return newColumns;
    });
  };

  const handleSubmit = () => {
    if (!tableName.trim()) {
      alert(t('database.enterTableName'));
      return;
    }

    // Validate {t('database.columnDefinition')}
    for (let i = 0; i < columns.length; i++) {
      if (!columns[i].name.trim()) {
        alert(t('database.columnNameEmpty', { index: i + 1 }));
        return;
      }
    }

    if (isEditing && onEdit) {
      onEdit(tableName, columns, schema, initialTableName);
    } else {
      onCreate(tableName, columns, schema);
    }
    onClose();
  };

  const commonDataTypes = {
    mysql: [
      // Numeric
      'INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'DECIMAL', 'FLOAT', 'DOUBLE', 'BIT',
      // String
      'VARCHAR', 'CHAR', 'TEXT', 'LONGTEXT', 'MEDIUMTEXT', 'TINYTEXT', 
      // Date/Time
      'DATETIME', 'TIMESTAMP', 'DATE', 'TIME', 'YEAR',
      // Binary
      'BLOB', 'LONGBLOB', 'MEDIUMBLOB', 'BINARY', 'VARBINARY',
      // Other
      'JSON', 'ENUM', 'SET', 'GEOMETRY'
    ],
    postgresql: [
      'bigint',
      'bigserial',
      'bit',
      'bit varying',
      'bool',
      'boolean',
      'box',
      'bytea',
      'char',
      'character',
      'character varying',
      'cidr',
      'circle',
      'date',
      'decimal',
      'double precision',
      'float4',
      'float8',
      'inet',
      'int2',
      'int4',
      'int8',
      'integer',
      'interval',
      'json',
      'jsonb',
      'line',
      'lseg',
      'macaddr',
      'macaddr8',
      'money',
      'name',
      'numeric',
      'oid',
      'path',
      'pg_lsn',
      'pg_snapshot',
      'point',
      'polygon',
      'real',
      'smallint',
      'smallserial',
      'serial',
      'serial2',
      'serial4',
      'serial8',
      'text',
      'time',
      'time with time zone',
      'timestamp',
      'timestamp with time zone',
      'timestamptz',
      'tsquery',
      'tsvector',
      'txid_snapshot',
      'uuid',
      'xml'
    ],
    sqlite: [
      'INTEGER', 'REAL', 'TEXT', 'BLOB', 'NUMERIC', 'BOOLEAN', 'DATE', 'DATETIME'
    ]
  };

  const dataTypes = commonDataTypes[databaseType.toLowerCase() as keyof typeof commonDataTypes] || [];

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-[60]" onClick={onClose}>
      <div 
        className="bg-white rounded-xl shadow-2xl w-[800px] max-w-[90vw] max-h-[80vh] overflow-hidden transform transition-all animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <i className="fas fa-table text-blue-500"></i>
            {isEditing ? `t('database.editTable', { tableName: tableName || t('database.tableTitle') })` : `t('database.createNewTable', { dbName })`}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
          >
            <i className="fas fa-times text-lg"></i>
          </button>
        </div>
        
        {/* 表单内容 */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2"><span className="text-red-500">**</span></label>
            <div className="relative flex items-center">
              <i className="fas fa-table absolute left-3 text-gray-400"></i>
              <input 
                type="text" 
                value={tableName} 
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTableName(e.target.value)} 
                className="w-full bg-gray-50 border border-gray-200 rounded-lg pl-9 pr-4 py-3 text-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#007acc]/20 focus:border-[#007acc] transition-all" 
                placeholder={t('database.newTableNamePlaceholder')}
                autoFocus 
              />
            </div>
          </div>
          
          <div className="mb-6">
            <div className="flex justify-between items-center mb-3">
              <label className="block text-sm font-semibold text-gray-700">{t('database.columnDefinition')}</label>
              <button
                type="button"
                onClick={addColumn}
                className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors flex items-center gap-1"
              >
                <i className="fas fa-plus text-xs"></i>
                {t('database.addColumn')}
              </button>
            </div>
            
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">列名</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">数据类型</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">{t('database.typeNameLengthPrecision')}</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">默认值</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">可空</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">主键</th>
                    {databaseType === 'mysql' && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">{t('database.onlyNumericUnsigned')}</th>
                    )}
                    {databaseType !== 'postgresql' && (
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-16">{t('database.onlyNumericAutoincrement')}</th>
                    )}
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/6">注释</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {columns.map((column, index) => (
                    <tr key={index}>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={column.name}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateColumn(index, 'name', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#007acc] focus:border-[#007acc]"
                          placeholder={t('database.columnName')}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={dataTypes.find(t => t.toUpperCase() === (column.dataType || '').replace(/ UNSIGNED$/i, '').toUpperCase()) || 
                                 dataTypes.find(t => (column.dataType || '').toUpperCase().startsWith(t.toUpperCase())) || 
                                 column.dataType}
                          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateColumn(index, 'dataType', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#007acc] focus:border-[#007acc]"
                        >
                          {dataTypes.map((type, idx) => (
                            <option key={idx} value={type}>{type}</option>
                          ))}
                          {!dataTypes.find(t => t.toUpperCase() === (column.dataType || '').replace(/ UNSIGNED$/i, '').toUpperCase()) && column.dataType && (
                            <option value={column.dataType}>{column.dataType}</option>
                          )}
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={column.typeLength || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateColumn(index, 'typeLength', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#007acc] focus:border-[#007acc]"
                          placeholder={t('database.columnLengthPlaceholder')}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={column.defaultValue ?? ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateColumn(index, 'defaultValue', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#007acc] focus:border-[#007acc]"
                          placeholder={t('database.defaultValuePlaceholder')}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={column.nullable}
                          disabled={column.isPrimaryKey}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateColumn(index, 'nullable', e.target.checked)}
                          className="h-4 w-4 text-[#007acc] focus:ring-[#007acc] border-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                          title={column.isPrimaryKey ? t('database.primaryKeyMustNotNull') : ''}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={column.isPrimaryKey}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            updateColumn(index, 'isPrimaryKey', e.target.checked);
                            if (e.target.checked) {
                              // If set as primary key, cannot be NULL
                              updateColumn(index, 'nullable', false);
                            }
                          }}
                          className="h-4 w-4 text-[#007acc] focus:ring-[#007acc] border-gray-300 rounded"
                        />
                      </td>
                      {databaseType === 'mysql' && (
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!column.unsigned || (column.dataType || '').toUpperCase().includes('UNSIGNED')}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateColumn(index, 'unsigned', e.target.checked)}
                            className="h-4 w-4 text-[#007acc] focus:ring-[#007acc] border-gray-300 rounded disabled:opacity-30"
                            disabled={!['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].some(t => (column.dataType || '').toUpperCase().includes(t))}
                            title={!['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'MEDIUMINT', 'DECIMAL', 'FLOAT', 'DOUBLE'].some(t => (column.dataType || '').toUpperCase().includes(t)) ? t('database.onlyNumericUnsigned') : ''}
                          />
                        </td>
                      )}
                      {databaseType !== 'postgresql' && (
                        <td className="px-4 py-3 text-center">
                          <input
                            type="checkbox"
                            checked={!!column.autoIncrement}
                            disabled={!['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'INTEGER', 'NUMBER', 'REAL'].some(t => column.dataType.toUpperCase().includes(t))}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateColumn(index, 'autoIncrement', e.target.checked)}
                            className="h-4 w-4 text-[#007acc] focus:ring-[#007acc] border-gray-300 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                            title={!['INT', 'BIGINT', 'SMALLINT', 'TINYINT', 'INTEGER', 'NUMBER', 'REAL'].some(t => column.dataType.toUpperCase().includes(t)) ? t('database.onlyNumericAutoincrement') : ''}
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <input
                          type="text"
                          value={column.comment || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => updateColumn(index, 'comment', e.target.value)}
                          className="w-full bg-white border border-gray-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[#007acc] focus:border-[#007acc]"
                          placeholder={t('database.commentPlaceholder')}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => removeColumn(index)}
                          disabled={columns.length <= 1}
                          className={`px-2.5 py-1.5 text-xs rounded-md transition-colors ${
                            columns.length <= 1 
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                              : 'bg-red-50 hover:bg-red-100 text-red-600'
                          }`}
                        >
                          {t('database.delete')}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        
        {/* 底部操作栏 */}
        <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
          <button
            onClick={onClose}
            className="px-5 py-2 text-sm font-bold text-gray-600 hover:text-gray-800 transition-colors bg-white border border-gray-200 rounded-md hover:bg-gray-50"
          >
            {t('database.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2 bg-[#007acc] hover:bg-[#005a9e] text-white text-sm font-bold rounded-md transition-all shadow-md active:scale-95 flex items-center gap-2"
          >
            <i className="fas fa-plus"></i>
            {isEditing ? t('database.updateTable') : t('database.createTable')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DesignTableDialog;