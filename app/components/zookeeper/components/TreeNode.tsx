'use client';

import { TreeNode as TreeNodeType, ZkStatPayload } from '../utils/types';

interface TreeNodeProps {
  node: TreeNodeType;
  depth: number;
  isExpanded: boolean;
  isActive: boolean;
  hasChildren: boolean;
  filterValue?: string;
  onToggleExpand: (path: string) => void;
  onSelectNode: (path: string) => void;
  onNodeRef: (path: string, el: HTMLDivElement | null) => void;
  childrenLabel?: string;
}

/**
 * Single tree node component
 * Represents one node in the ZooKeeper tree view
 */
export function TreeNode({
  node,
  depth,
  isExpanded,
  isActive,
  hasChildren,
  filterValue = '',
  onToggleExpand,
  onSelectNode,
  onNodeRef,
  childrenLabel = '',
}: TreeNodeProps) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold ${
        isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-700'
      }`}
      style={{ paddingLeft: `${12 + depth * 4}px` }}
      onClick={() => {
        onSelectNode(node.path);
        if (hasChildren) {
          onToggleExpand(node.path);
        }
      }}
      title={node.path}
      ref={el => {
        onNodeRef(node.path, el);
      }}
    >
      <span className={`h-5 w-5 shrink-0 rounded-lg text-xs font-black grid place-items-center ${
        hasChildren ? 'bg-slate-100 text-slate-700' : 'bg-slate-50 text-slate-400'
      }`}>
        {hasChildren ? (isExpanded ? '▾' : '▸') : '•'}
      </span>
      <span className="h-6 w-6 shrink-0 rounded-lg bg-cyan-50 text-cyan-600 border border-cyan-100 grid place-items-center text-xs font-bold">
        {node.name === '/' ? '/' : node.name.slice(0, 1).toUpperCase()}
      </span>
      <span className="whitespace-nowrap" title={node.name}>{node.name}</span>
      <span className="ml-auto text-[10px] rounded-full border border-slate-200 px-2 py-0.5 text-slate-500">
        {childrenLabel}
      </span>
    </div>
  );
}
