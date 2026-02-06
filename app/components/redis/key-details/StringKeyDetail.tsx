import { useState, useEffect } from 'react';
import { useLanguage } from '../../../../i18n/LanguageContext';
import { parseFullKey } from '../utils';

interface StringKeyDetailProps {
  keyDetails: any;
  onKeyUpdate?: (key: string | null) => void;
  showToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const StringKeyDetail = ({ keyDetails, onKeyUpdate, showToast }: StringKeyDetailProps) => {
  const { t } = useLanguage();
  const [editValue, setEditValue] = useState(keyDetails.value);
  const [isSaving, setIsSaving] = useState(false);
  const [format, setFormat] = useState('Plain Text');

  // Update editValue when keyDetails changes
  useEffect(() => {
    setEditValue(keyDetails.value);
    setFormat('Plain Text');
  }, [keyDetails.key]);

  // JSON formatting function
  const formatAsJson = (text: string) => {
    try {
      const parsed = JSON.parse(text);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      // On formatting failure, return original text without showing error
      return text;
    }
  };

  const handleFormatChange = (newFormat: string) => {
    setFormat(newFormat);
    if (newFormat === 'JSON' && editValue) {
      const formatted = formatAsJson(editValue);
      setEditValue(formatted);
    }
  };

  const handleSave = async () => {
    if (editValue === keyDetails.value) {
      showToast?.(t('stringKeyDetail.valueUnchanged'), 'info');
      return;
    }

    setIsSaving(true);
    try {
      const { connectionId, dbIndex, actualKey } = parseFullKey(keyDetails.key);
      const response = await fetch('/api/redis/connections/key/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectionId, dbIndex, key: actualKey, value: editValue }),
      });

      const result = await response.json();
      if (result.code === 200) {
        showToast?.(t('stringKeyDetail.saveSuccess'), 'success');
        // Refresh key details
        if (onKeyUpdate) {
          onKeyUpdate(keyDetails.key);
        }
      } else {
        showToast?.(t('stringKeyDetail.saveFailed', { message: result.message }), 'error');
      }
    } catch (error) {
      console.error(t('stringKeyDetail.saveKeyFailed'), error);
      showToast?.(t('stringKeyDetail.saveFailed', { message: (error as Error).message }), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="mb-6 flex-1 flex flex-col min-h-0">
        <label className="block text-sm font-semibold text-gray-800 mb-3">{t('stringKeyDetail.valueContent')}</label>
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          className="border border-gray-300 rounded p-4 bg-white font-mono text-sm resize-none flex-1 focus:outline-none focus:ring-2 focus:ring-[#007acc] focus:border-[#007acc] overflow-auto"
          placeholder={t('streamKeyDetail.enterValueContent')}
          spellCheck="false"
          style={{ lineHeight: '1.6' }}
        />
      </div>
      <div className="flex gap-3 items-center mt-4">
        <select
          value={format}
          onChange={(e) => handleFormatChange(e.target.value)}
          className="px-4 py-2 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-[#007acc] font-medium"
        >
          <option>Plain Text</option>
          <option>JSON</option>
          <option>Binary</option>
        </select>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="px-6 py-2 bg-[#00B42A] text-white rounded hover:bg-[#009A29] transition-colors text-sm disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
        >
          {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
          {isSaving ? t('stringKeyDetail.saving') : t('stringKeyDetail.save')}
        </button>
      </div>
    </div>
  );
};

export default StringKeyDetail;
