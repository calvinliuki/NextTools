// Data conversion and transformation utilities

import { DataEncoding, NodeDetailPayload } from './types';

/**
 * Convert base64 encoded string to hexadecimal format
 */
export const base64ToHex = (base64: string): string => {
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

/**
 * Format timestamp to readable date string
 * Format: YYYY-MM-DD HH:MM:SS
 */
export const formatTimestamp = (value?: number | null): string => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  const pad = (num: number) => String(num).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

/**
 * Resolve node data value based on encoding type
 * Supports UTF-8, Base64, and Hex formats
 */
export const resolveDataValue = (detail: NodeDetailPayload | null, encoding: DataEncoding): string => {
  if (!detail) return '';
  if (encoding === 'base64') return detail.dataBase64 || '';
  if (encoding === 'hex') return base64ToHex(detail.dataBase64 || '');
  return detail.data || '';
};
