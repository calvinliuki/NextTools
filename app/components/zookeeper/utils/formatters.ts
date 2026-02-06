// Formatting utilities for metrics and statistics display

/**
 * Format byte count to human-readable format
 * Example: 1024 => '1 KB', 1048576 => '1 MB'
 */
export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Format number with thousands separator
 * Example: 1000 => '1,000'
 */
export const formatNumber = (num: number): string => {
  return num.toLocaleString('en-US');
};

/**
 * Format milliseconds to human-readable duration
 * Example: 1000 => '1s', 60000 => '1m'
 */
export const formatDuration = (ms: number): string => {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
};

/**
 * Format latency value with unit
 * Example: 10 => '10ms'
 */
export const formatLatency = (value: number): string => {
  return `${value}ms`;
};
