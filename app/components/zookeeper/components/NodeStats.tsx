'use client';

import { ZkStatPayload } from '../utils/types';
import { formatTimestamp } from '../utils/dataConverter';

interface NodeStatsProps {
  stat: ZkStatPayload | null | undefined;
  isEphemeral: boolean;
  dataLength: number;
  dataVersion: number;
  childrenCount: number;
  labels: {
    nodeType: string;
    ephemeralNode: string;
    persistentNode: string;
    dataLength: string;
    bytes: string;
    version: string;
    childrenCount: string;
  };
}

/**
 * Display component for node metadata/statistics
 * Shows node type, data size, version, and children count in card layout
 */
export function NodeStats({
  stat,
  isEphemeral,
  dataLength,
  dataVersion,
  childrenCount,
  labels,
}: NodeStatsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      <div className="p-3 bg-gray-50 rounded border border-gray-100">
        <div className="text-[10px] text-gray-500 uppercase mb-1">{labels.nodeType}</div>
        <div className="text-sm font-semibold text-gray-800">
          {isEphemeral ? labels.ephemeralNode : labels.persistentNode}
        </div>
      </div>
      <div className="p-3 bg-gray-50 rounded border border-gray-100">
        <div className="text-[10px] text-gray-500 uppercase mb-1">{labels.dataLength}</div>
        <div className="text-sm font-semibold text-gray-800">
          {dataLength} {labels.bytes}
        </div>
      </div>
      <div className="p-3 bg-gray-50 rounded border border-gray-100">
        <div className="text-[10px] text-gray-500 uppercase mb-1">{labels.version}</div>
        <div className="text-sm font-semibold text-gray-800">v{dataVersion}</div>
      </div>
      <div className="p-3 bg-gray-50 rounded border border-gray-100">
        <div className="text-[10px] text-gray-500 uppercase mb-1">{labels.childrenCount}</div>
        <div className="text-sm font-semibold text-gray-800">{childrenCount}</div>
      </div>
    </div>
  );
}
