// ZooKeeper component shared type definitions

export interface ZooKeeperTabProps {
  connectionId: string;
  connectionName: string;
}

export interface TreeNode {
  name: string;
  path: string;
  stat?: ZkStatPayload | null;
}

export interface ZkStatPayload {
  czxid: number;
  mzxid: number;
  ctime: number;
  mtime: number;
  version: number;
  cversion: number;
  aversion: number;
  ephemeralOwner: number;
  dataLength: number;
  numChildren: number;
  pzxid: number;
}

export interface NodeDetailPayload {
  path: string;
  data: string;
  dataBase64: string;
  stat: ZkStatPayload | null;
}

export interface ChildPayload {
  name: string;
  path: string;
  stat: ZkStatPayload | null;
}

export type DetailTab = 'data';

export type DataEncoding = 'utf8' | 'base64' | 'hex';

export type CreateMode = 'persistent' | 'ephemeral' | 'persistent_sequential' | 'ephemeral_sequential';

export type SetMode = 'cas' | 'overwrite';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T;
}
