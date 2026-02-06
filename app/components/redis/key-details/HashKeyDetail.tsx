import { useState, useEffect } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { parseFullKey } from '../utils';
import { DeleteConfirmDialog } from '../dialogs';

interface HashKeyDetailProps {
  keyDetails: any;
  onKeyUpdate?: (key: string | null) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const HashKeyDetail = ({ keyDetails, onKeyUpdate, showToast }: HashKeyDetailProps) => {
  const { t } = useLanguage();
  const [searchKeyword, setSearchKeyword] = useState(''); // Search keyword
  const [searchResults, setSearchResults] = useState<Array<{ id: number; key: string; value: string }> | null>(null); // Search results
  const [isSearching, setIsSearching] = useState(false); // Loading during search
  const [editingField, setEditingField] = useState<{ oldKey: string; newKey: string; value: string } | null>(null); // Editing state
  const [isSaving, setIsSaving] = useState(false); // Saving in progress
  const [isInsertingField, setIsInsertingField] = useState(false); // Insert dialog state
  const [newFieldName, setNewFieldName] = useState(''); // New field name
  const [newFieldValue, setNewFieldValue] = useState(''); // New field value
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false); // Delete confirmation dialog
  const [pendingDeleteField, setPendingDeleteField] = useState<string | null>(null); // Field pending deletion
  const [isDeleting, setIsDeleting] = useState(false); // Deletion in progress

  useEffect(() => {
    setSearchKeyword(''); // Clear search when switching keys
    setSearchResults(null); // Clear search results
  }, [keyDetails.key]);

  // Determine display data based on whether searching
  const displayedData = searchResults !== null ? searchResults : (keyDetails.list || []);
  const totalLength = keyDetails.length || 0;

  const handleNextPage = async () => {
    // 简化后：有数据就不需要翻页了（100条数据一次吸完整）
    // 输出提醒
    console.log('数据已经是最大100条，无需翻页');
  };

  const handlePreviousPage = () => {
    // 简化后：有数据就不需要翻页了
    console.log('数据已经是最大100条，无需翻页');
  };

  const handleReload = () => {
    if (onKeyUpdate && keyDetails.key) {
      onKeyUpdate(keyDetails.key);
    }
  };

  // 处理编辑按钮点击
  const handleEditField = (field: string, value: string) => {
    setEditingField({
      oldKey: field,
      newKey: field,
      value,
    });
  };

  // 保存编辑
  const handleSaveEdit = async () => {
    if (!editingField || !editingField.newKey.trim()) {
      showToast?.(t('hashKeyDetail.fieldNameRequired'), 'info');
      return;
    }

    setIsSaving(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/hash/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId, dbIndex, key: actualKey,
          oldField: editingField.oldKey,
          newField: editingField.newKey,
          value: editingField.value,
        }),
      });

      const result = await response.json();
      if (result.code === 200) {
        // 保存成功，关闭编辑面板并刷新数据
        setEditingField(null);
        showToast?.(t('hashKeyDetail.saveSuccess'), 'success');
        handleReload();
      } else {
        showToast?.(t('hashKeyDetail.saveFailed', { message: result.message || t('common.unknownError') }), 'error');
      }
    } catch (error) {
      console.error('保存失败:', error);
      showToast?.(t('hashKeyDetail.saveFailed', { message: (error as Error).message }), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 取消编辑
  const handleCancelEdit = () => {
    setEditingField(null);
  };

  // 打开插入对话框
  const handleOpenInsertDialog = () => {
    setNewFieldName('');
    setNewFieldValue('');
    setIsInsertingField(true);
  };

  // 保存新插入字段
  const handleSaveInsertField = async () => {
    if (!newFieldName.trim()) {
      showToast?.(t('hashKeyDetail.fieldNameRequired'), 'info');
      return;
    }

    setIsSaving(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/hash/insert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId, dbIndex, key: actualKey,
          field: newFieldName.trim(),
          value: newFieldValue,
        }),
      });

      const result = await response.json();
      if (result.code === 200) {
        // 插入成功，关闭Dialog并刷新数据
        setIsInsertingField(false);
        setNewFieldName('');
        setNewFieldValue('');
        showToast?.(t('hashKeyDetail.insertSuccess'), 'success');
        handleReload();
      } else {
        showToast?.(t('hashKeyDetail.insertFailed', { message: result.message || t('common.unknownError') }), 'error');
      }
    } catch (error) {
      console.error('插入失败:', error);
      showToast?.(t('hashKeyDetail.insertFailed', { message: (error as Error).message }), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // 取消插入
  const handleCancelInsert = () => {
    setIsInsertingField(false);
    setNewFieldName('');
    setNewFieldValue('');
  };

  // 打开删除确认对话框
  const handleDeleteField = (field: string) => {
    setPendingDeleteField(field);
    setDeleteConfirmOpen(true);
  };

  // 执行删除
  const executeDeleteField = async () => {
    if (!pendingDeleteField) return;

    setIsDeleting(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/hash/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId, dbIndex, key: actualKey,
          field: pendingDeleteField,
        }),
      });

      const result = await response.json();
      if (result.code === 200 && result.data.deleted) {
        // 删除成功，刷新数据
        showToast?.(t('hashKeyDetail.deleteSuccess'), 'success');
        setDeleteConfirmOpen(false);
        setPendingDeleteField(null);
        handleReload();
      } else {
        showToast?.(t('hashKeyDetail.deleteFailed', { message: result.message || t('common.unknownError') }), 'error');
      }
    } catch (error) {
      console.error('删除字段失败:', error);
      showToast?.(t('hashKeyDetail.deleteFailed', { message: (error as Error).message }), 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  // 搜索功能
  const handleSearch = async () => {
    if (!searchKeyword.trim()) {
      showToast?.(t('hashKeyDetail.searchKeywordRequired'), 'info');
      return;
    }

    setIsSearching(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/hash/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId, dbIndex, key: actualKey,
          keyword: searchKeyword,
          limit: 100,
        }),
      });

      const result = await response.json();
      if (result.code === 200 && result.data) {
        setSearchResults(result.data.results);
      } else {
        showToast?.(t('hashKeyDetail.searchFailed', { message: result.message || t('common.unknownError') }), 'error');
        setSearchResults([]);
      }
    } catch (error) {
      console.error('搜索失败:', error);
      showToast?.(t('hashKeyDetail.searchFailed', { message: (error as Error).message }), 'error');
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearchKeyword('');
    setSearchResults(null);
  };

  return (
    <div className="flex h-full">
      {/* 左侧列表区域 */}
      <div className={editingField ? "flex-1 flex flex-col overflow-hidden border-r border-gray-200" : "flex-1 flex flex-col overflow-hidden"}>
        {/* 搜索栏 */}
        <div className="border-b border-gray-200 px-4 py-3 bg-gray-50">
          <div className="flex gap-2">
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              placeholder={t('streamKeyDetail.searchFieldOrValue')}
              className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent"
            />
            <button
              onClick={handleSearch}
              disabled={isSearching}
              className="px-3 py-1.5 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors disabled:opacity-50"
            >
              {isSearching ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1"></i>{t('hashKeyDetail.searching')}
                </>
              ) : (
                <>
                  <i className="fas fa-search mr-1"></i>{t('hashKeyDetail.search')}
                </>
              )}
            </button>
            {searchResults !== null && (
              <button
                onClick={handleClearSearch}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
              >
                <i className="fas fa-times mr-1"></i>{t('hashKeyDetail.clear')}
              </button>
            )}
          </div>
          {searchResults !== null && (
            <div className="mt-2 text-sm text-gray-600">
              Found {searchResults.length} matching results
            </div>
          )}
        </div>

        {/* Table header */}
        <div className="border-b border-gray-200">
          <div className="grid grid-cols-12 gap-4 px-4 py-3 bg-gray-50 text-sm font-medium text-gray-700">
            <div className="col-span-5">{t('hashKeyDetail.fieldTitle')}</div>
            <div className="col-span-6">{t('streamKeyDetail.value')}</div>
            <div className="col-span-1">{t('streamKeyDetail.action')}</div>
          </div>
        </div>

        {/* 数据行 */}
        <div className="flex-1 overflow-y-auto">
          {displayedData && displayedData.length > 0 ? (
            displayedData.map((item: any) => (
              <div
                key={item.id}
                className={`grid grid-cols-12 gap-4 px-4 py-3 border-b border-gray-100 text-sm cursor-pointer ${
                  editingField?.oldKey === item.key ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
                onClick={() => handleEditField(item.key, item.value)}
              >
                <div className="col-span-5 font-mono text-gray-800 truncate" title={item.key}>{item.key}</div>
                <div className="col-span-6 font-mono text-gray-800 truncate" title={item.value}>{item.value}</div>
                <div className="col-span-1 flex gap-1" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => handleEditField(item.key, item.value)}
                    className="text-blue-500 hover:text-blue-700 text-sm cursor-pointer"
                    title={t('streamKeyDetail.editField')}
                  >
                    <i className="fas fa-edit"></i>
                  </button>
                  <button
                    onClick={() => handleDeleteField(item.key)}
                    className="text-red-500 hover:text-red-700 text-sm cursor-pointer"
                    title={t('streamKeyDetail.deleteField')}
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            ))
          ) : (
            <div className="px-4 py-8 text-center text-gray-500 text-sm">
              {searchKeyword ? t('hashKeyDetail.noMatchingRecords') : t('hashKeyDetail.noData')}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-3 bg-gray-50 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {t('hashKeyDetail.maxRecordsInfo', { count: totalLength })}
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleOpenInsertDialog}
              className="px-3 py-1.5 text-sm bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors"
            >
              <i className="fas fa-plus mr-1"></i>{t('hashKeyDetail.insertRow')}
            </button>
            <button
              onClick={handleReload}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors"
            >
              {t('hashKeyDetail.reload')}
            </button>
          </div>
        </div>
      </div>

      {/* 插入对话框 */}
      {isInsertingField && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg w-96 p-6 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-800">{t('hashKeyDetail.insertNewField')}</h3>
              <button
                onClick={handleCancelInsert}
                className="text-gray-400 hover:text-gray-600 text-lg"
                title={t('streamKeyDetail.close')}
              >
                <i className="fas fa-times"></i>
              </button>
            </div>

            {/* Field name */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('hashKeyDetail.fieldTitle')}</label>
              <input
                type="text"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && !isSaving && handleSaveInsertField()}
                autoFocus
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent"
                placeholder={t('streamKeyDetail.exampleFieldName')}
              />
            </div>

            {/* Field value */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">{t('streamKeyDetail.value')}</label>
              <textarea
                value={newFieldValue}
                onChange={(e) => setNewFieldValue(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent resize-none font-mono h-24"
                placeholder={t('streamKeyDetail.enterFieldValue')}
              />
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveInsertField}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors disabled:opacity-50 text-sm font-medium"
              >
                {isSaving ? (
                  <>
                    <i className="fas fa-spinner fa-spin mr-1"></i>{t('hashKeyDetail.inserting')}
                  </>
                ) : (
                  <>
                    <i className="fas fa-check mr-1"></i>{t('hashKeyDetail.insert')}
                  </>
                )}
              </button>
              <button
                onClick={handleCancelInsert}
                disabled={isSaving}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm font-medium"
              >
                <i className="fas fa-times mr-1"></i>{t('hashKeyDetail.cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 右侧编辑面板 */}
      {editingField && (
        <div className="w-80 bg-white border-l border-gray-200 p-4 overflow-y-auto flex flex-col">
          {/* Edit panel title */}
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-800">{t('hashKeyDetail.editField')}</h3>
            <button
              onClick={handleCancelEdit}
              className="text-gray-400 hover:text-gray-600 text-lg"
              title={t('streamKeyDetail.close')}
            >
              <i className="fas fa-times"></i>
            </button>
          </div>

          {/* Field name edit */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('hashKeyDetail.fieldTitle')}</label>
            <input
              type="text"
              value={editingField.newKey}
              onChange={(e) => setEditingField({ ...editingField, newKey: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent"
              placeholder={t('streamKeyDetail.enterFieldName')}
            />
          </div>

          {/* Field value edit */}
          <div className="mb-4 flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('streamKeyDetail.value')}</label>
            <textarea
              value={editingField.value}
              onChange={(e) => setEditingField({ ...editingField, value: e.target.value })}
              className="w-full h-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-transparent resize-none font-mono"
              placeholder={t('streamKeyDetail.enterFieldValue')}
            />
          </div>

          {/* 操作按钮 */}
          <div className="flex gap-2 mt-4 border-t border-gray-200 pt-4">
            <button
              onClick={handleSaveEdit}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-[#007acc] text-white rounded hover:bg-[#005a9e] transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isSaving ? (
                <>
                  <i className="fas fa-spinner fa-spin mr-1"></i>{t('hashKeyDetail.saving')}
                </>
              ) : (
                <>
                  <i className="fas fa-check mr-1"></i>{t('hashKeyDetail.save')}
                </>
              )}
            </button>
            <button
              onClick={handleCancelEdit}
              disabled={isSaving}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition-colors disabled:opacity-50 text-sm font-medium"
            >
              <i className="fas fa-times mr-1"></i>{t('hashKeyDetail.cancel')}
            </button>
          </div>
        </div>
      )}

      {/* 删除确认对话框 */}
      <DeleteConfirmDialog
        open={deleteConfirmOpen}
        title={t('streamKeyDetail.fieldTitle')}
        content={pendingDeleteField || ''}
        onConfirm={executeDeleteField}
        onCancel={() => setDeleteConfirmOpen(false)}
        isLoading={isDeleting}
      />
    </div>
  );
};

export default HashKeyDetail;
