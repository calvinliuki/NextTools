// SSH连接存储（使用SQLite数据库）

import { getDatabase, generateConnectionId } from './db';
import Database from 'better-sqlite3';

export interface TerminalSettings {
  fontSize?: number;
  fontFamily?: string;
  fontWeight?: string;
  foreground?: string;
  background?: string;
  cursorColor?: string;
}

export interface SSHConnectionData {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: 'password' | 'privateKey';
  password?: string;
  privateKey?: string;
  passphrase?: string;
  downloadDir?: string;
  terminalSettings?: TerminalSettings;
  created_at: string;
  updated_at: string;
}

export const SSHConnectionStore = {
  // 获取所有连接
  getAll: (): SSHConnectionData[] => {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM connections WHERE id LIKE ? ORDER BY created_at DESC');
    const rows = stmt.all('ssh_%') as Array<{ id: string; name: string; config: string; created_at: string }>;
    return rows.map(row => {
      const config = JSON.parse(row.config);
      return {
        id: row.id,
        name: row.name,
        host: config.host,
        port: config.port,
        username: config.username,
        authMethod: config.authMethod,
        password: config.password,
        privateKey: config.privateKey,
        passphrase: config.passphrase,
        downloadDir: config.downloadDir,
        terminalSettings: config.terminalSettings,
        created_at: row.created_at,
        updated_at: config.updated_at,
      };
    });
  },

  // 获取单个连接
  get: (id: string): SSHConnectionData | undefined => {
    const database = getDatabase();
    const stmt = database.prepare('SELECT * FROM connections WHERE id = ?');
    const row = stmt.get(id) as { id: string; name: string; config: string; created_at: string } | undefined;
    
    if (!row) return undefined;
    
    const config = JSON.parse(row.config);
    return {
      id: row.id,
      name: row.name,
      host: config.host,
      port: config.port,
      username: config.username,
      authMethod: config.authMethod,
      password: config.password,
      privateKey: config.privateKey,
      passphrase: config.passphrase,
      downloadDir: config.downloadDir,
      terminalSettings: config.terminalSettings,
      created_at: row.created_at,
      updated_at: config.updated_at,
    };
  },

  // 保存连接
  save: (connection: SSHConnectionData): SSHConnectionData => {
    const database = getDatabase();
    
    // 将连接信息存储在配置中
    const config = {
      host: connection.host,
      port: connection.port,
      username: connection.username,
      authMethod: connection.authMethod,
      password: connection.password,
      privateKey: connection.privateKey,
      passphrase: connection.passphrase,
      downloadDir: connection.downloadDir || '',
      terminalSettings: connection.terminalSettings,
      updated_at: new Date().toISOString(),
    };
    
    const stmt = database.prepare('INSERT OR REPLACE INTO connections (id, name, config) VALUES (?, ?, ?)');
    stmt.run(connection.id, connection.name, JSON.stringify(config));
    
    return connection;
  },

  // 删除连接
  delete: (id: string): boolean => {
    const database = getDatabase();
    const stmt = database.prepare('DELETE FROM connections WHERE id = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  },

  // 生成SSH连接ID
  generateId: (): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `ssh_${timestamp}_${random}`;
  },
};
