'use client';

import { DataEncoding, SetMode } from '../utils/types';

interface DataViewerProps {
  dataValue: string;
  onDataChange: (value: string) => void;
  dataEncoding: DataEncoding;
  onEncodingChange: (encoding: DataEncoding) => void;
  setMode: SetMode;
  onSetModeChange: (mode: SetMode) => void;
  onFormat?: () => void;
  onValidate?: () => void;
  onSave?: () => void;
  isLoading?: boolean;
  labels: {
    nodeContent: string;
    formatJson: string;
    saveChanges: string;
  };
}

/**
 * Data viewer and editor component
 * Displays and allows editing of node data with encoding support
 */
export function DataViewer({
  dataValue,
  onDataChange,
  dataEncoding,
  onEncodingChange,
  setMode,
  onSetModeChange,
  onFormat,
  onValidate,
  onSave,
  isLoading = false,
  labels,
}: DataViewerProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-4">
          <h4 className="text-sm font-bold text-gray-800">{labels.nodeContent}</h4>
          <div className="flex items-center gap-2">
            <select
              className="text-xs border-none bg-transparent font-medium text-[#007acc] focus:ring-0"
              value={dataEncoding}
              onChange={e => onEncodingChange(e.target.value as DataEncoding)}
            >
              <option value="utf8">UTF-8</option>
              <option value="base64">Base64</option>
              <option value="hex">Hex</option>
            </select>
            <select
              className="text-xs border-none bg-transparent font-medium text-gray-500 focus:ring-0"
              value={setMode}
              onChange={e => onSetModeChange(e.target.value as SetMode)}
            >
              <option value="cas">CAS (Safe)</option>
              <option value="overwrite">Overwrite (Force)</option>
            </select>
          </div>
        </div>
        <div className="flex gap-2">
          {onFormat && (
            <button 
              className="px-2 py-1 text-xs text-gray-600 hover:text-[#007acc]" 
              onClick={onFormat}
            >
              {labels.formatJson}
            </button>
          )}
          {onSave && (
            <button 
              className="px-3 py-1 text-xs bg-[#007acc] text-white rounded hover:bg-[#005a9e] disabled:opacity-50"
              onClick={onSave}
              disabled={isLoading}
            >
              {labels.saveChanges}
            </button>
          )}
        </div>
      </div>
      <textarea
        className="w-full h-64 p-3 font-mono text-sm border border-gray-200 rounded focus:ring-1 focus:ring-[#007acc] outline-none"
        value={dataValue}
        onChange={e => onDataChange(e.target.value)}
        spellCheck={false}
        disabled={isLoading}
      />
    </div>
  );
}
