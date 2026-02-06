import { Client } from 'ssh2';
import { SSHConnectionData } from './sshConnections';

// SFTP文件信息接口
export interface SFTPFileInfo {
  type: 'd' | '-' | 'l'; // 目录、文件、链接
  name: string;
  size: number;
  modifyTime: Date;
  accessTime: Date;
  rights: {
    user: string;
    group: string;
    other: string;
  };
  owner: number;
  group: number;
  path: string;
}

// SFTP会话接口
interface SFTPSession {
  client: Client;
  sftp: any; // SFTP会话对象
  connectionId: string;
  lastUsed: Date;
}

// SFTP管理器类
export class SFTPManager {
  // 存储所有SFTP会话
  private static sessions = new Map<string, SFTPSession>();
  
  // 会话超时时间（毫秒）
  private static SESSION_TIMEOUT = 30 * 60 * 1000; // 30分钟

  // 创建SFTP会话
  static async createSession(connectionId: string, connection: SSHConnectionData): Promise<any> {
    // 检查是否已存在有效会话
    const existingSession = this.sessions.get(connectionId);
    if (existingSession) {
      existingSession.lastUsed = new Date();
      return this.createSFTPOperations(existingSession.sftp, connectionId);
    }

    // 创建新的SSH连接和SFTP会话
    return new Promise((resolve, reject) => {
      const client = new Client();
      
      const host = connection.host?.trim();
      const username = connection.username?.trim();

      // 构建连接选项
      const connectOptions: any = {
        host,
        port: connection.port,
        username,
        readyTimeout: 30000,
      };

      // 设置认证信息
      if (connection.authMethod === 'password') {
        connectOptions.password = connection.password;
      } else if (connection.authMethod === 'privateKey') {
        if (connection.privateKey && connection.privateKey.startsWith('-----BEGIN')) {
          connectOptions.privateKey = connection.privateKey;
        } else if (connection.privateKey) {
          connectOptions.privateKeyPath = connection.privateKey;
        }
        if (connection.passphrase) {
          connectOptions.passphrase = connection.passphrase;
        }
      }

      // 连接SSH服务器
      client.on('ready', () => {
        client.sftp((err: any, sftp: any) => {
          if (err) {
            client.end();
            return reject(new Error(`SFTP session failed: ${err.message}`));
          }

          // 存储会话
          const session: SFTPSession = {
            client,
            sftp,
            connectionId,
            lastUsed: new Date(),
          };

          this.sessions.set(connectionId, session);
          
          // 设置清理定时器
          this.startSessionCleanup();

          resolve(this.createSFTPOperations(sftp, connectionId));
        });
      });

      client.on('error', (err: Error) => {
        reject(new Error(`SSH connection failed: ${err.message}`));
      });

      client.connect(connectOptions);
    });
  }

  // 创建SFTP操作对象
  private static createSFTPOperations(sftp: any, connectionId: string) {
    return {
      // 列出目录内容
      list: async (path: string = '/'): Promise<SFTPFileInfo[]> => {
        return new Promise((resolve, reject) => {
          sftp.readdir(path, (err: any, list: any[]) => {
            if (err) {
              return reject(new Error(`Failed to list directory: ${err.message}`));
            }

            // 更新会话最后使用时间
            const session = this.sessions.get(connectionId);
            if (session) {
              session.lastUsed = new Date();
            }

            const fileList: SFTPFileInfo[] = list.map(item => {
              // 从 mode 中提取文件类型
              const mode = item.attrs.mode;
              let type: 'd' | '-' | 'l' = '-';
              if ((mode & 0o170000) === 0o040000) type = 'd';
              else if ((mode & 0o170000) === 0o120000) type = 'l';

              return {
                type,
                name: item.filename,
                size: item.attrs.size,
                modifyTime: new Date(item.attrs.mtime * 1000),
                accessTime: new Date(item.attrs.atime * 1000),
                rights: {
                  user: this.formatPermissions(mode & 0o700),
                  group: this.formatPermissions(mode & 0o070),
                  other: this.formatPermissions(mode & 0o007),
                },
                owner: item.attrs.uid,
                group: item.attrs.gid,
                path: `${path === '/' ? '' : path}/${item.filename}`,
              };
            });

            resolve(fileList);
          });
        });
      },

      // 读取文件内容
      readFile: async (path: string, encoding: string = 'utf8'): Promise<any> => {
        return new Promise((resolve, reject) => {
          const readMethod = encoding === 'binary' ? 'readFile' : 'readFile';
          
          sftp.readFile(path, (err: any, buffer: Buffer) => {
            if (err) {
              return reject(new Error(`Failed to read file: ${err.message}`));
            }

            // 更新会话最后使用时间
            const session = this.sessions.get(connectionId);
            if (session) {
              session.lastUsed = new Date();
            }

            if (encoding === 'binary') {
              resolve(buffer);
            } else {
              resolve(buffer.toString(encoding as BufferEncoding));
            }
          });
        });
      },

      // 写入文件内容
      writeFile: async (path: string, data: Buffer | string): Promise<void> => {
        return new Promise((resolve, reject) => {
          const buffer = typeof data === 'string' ? Buffer.from(data) : data;
          
          sftp.writeFile(path, buffer, (err: any) => {
            if (err) {
              return reject(new Error(`Failed to write file: ${err.message}`));
            }

            // 更新会话最后使用时间
            const session = this.sessions.get(connectionId);
            if (session) {
              session.lastUsed = new Date();
            }

            resolve();
          });
        });
      },

      // 获取文件/目录状态
      stat: async (path: string): Promise<any> => {
        return new Promise((resolve, reject) => {
          sftp.stat(path, (err: any, attrs: any) => {
            if (err) {
              return reject(new Error(`Failed to get file stats: ${err.message}`));
            }

            // 更新会话最后使用时间
            const session = this.sessions.get(connectionId);
            if (session) {
              session.lastUsed = new Date();
            }

            resolve({
              isDirectory: () => attrs.isDirectory(),
              isFile: () => attrs.isFile(),
              size: attrs.size,
              modifyTime: new Date(attrs.mtime * 1000),
              accessTime: new Date(attrs.atime * 1000),
              permissions: this.formatPermissions(attrs.mode),
              owner: attrs.uid,
              group: attrs.gid,
            });
          });
        });
      },

      // 创建目录
      mkdir: async (path: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          sftp.mkdir(path, (err: any) => {
            if (err) {
              return reject(new Error(`Failed to create directory: ${err.message}`));
            }

            // 更新会话最后使用时间
            const session = this.sessions.get(connectionId);
            if (session) {
              session.lastUsed = new Date();
            }

            resolve();
          });
        });
      },

      // 删除文件或目录
      delete: async (path: string, recursive: boolean = false): Promise<void> => {
        return new Promise((resolve, reject) => {
          // 首先检查是文件还是目录
          sftp.stat(path, (err: any, stats: any) => {
            if (err) {
              return reject(new Error(`Failed to check file type: ${err.message}`));
            }

            if (stats.isFile()) {
              // 删除文件
              sftp.unlink(path, (err: any) => {
                if (err) {
                  return reject(new Error(`Failed to delete file: ${err.message}`));
                }
                
                // 更新会话最后使用时间
                const session = this.sessions.get(connectionId);
                if (session) {
                  session.lastUsed = new Date();
                }
                
                resolve();
              });
            } else if (stats.isDirectory()) {
              if (recursive) {
                // 递归删除目录
                this.deleteDirectoryRecursive(sftp, path, connectionId)
                  .then(() => resolve())
                  .catch(err => reject(err));
              } else {
                // 删除空目录
                sftp.rmdir(path, (err: any) => {
                  if (err) {
                    return reject(new Error(`Failed to delete directory: ${err.message}`));
                  }
                  
                  // 更新会话最后使用时间
                  const session = this.sessions.get(connectionId);
                  if (session) {
                    session.lastUsed = new Date();
                  }
                  
                  resolve();
                });
              }
            } else {
              reject(new Error('Unknown file type'));
            }
          });
        });
      },

      // 重命名文件或目录
      rename: async (oldPath: string, newPath: string): Promise<void> => {
        return new Promise((resolve, reject) => {
          sftp.rename(oldPath, newPath, (err: any) => {
            if (err) {
              return reject(new Error(`Failed to rename: ${err.message}`));
            }

            // 更新会话最后使用时间
            const session = this.sessions.get(connectionId);
            if (session) {
              session.lastUsed = new Date();
            }

            resolve();
          });
        });
      },

      // 下载文件到本地路径
      downloadFile: async (remotePath: string, localPath: string): Promise<void> => {
        console.log('[SFTP downloadFile] 开始下载:', { remotePath, localPath });
        return new Promise((resolve, reject) => {
          // 先检查远程文件是否存在
          sftp.stat(remotePath, (statErr: any, stats: any) => {
            if (statErr) {
              console.error('[SFTP downloadFile] 远程文件不存在:', remotePath, statErr.message);
              return reject(new Error(`Remote file not found: ${remotePath} - ${statErr.message}`));
            }
            console.log('[SFTP downloadFile] 远程文件存在, 大小:', stats.size);
            
            sftp.fastGet(remotePath, localPath, (err: any) => {
              if (err) {
                console.error('[SFTP downloadFile] fastGet 失败:', err.message);
                return reject(new Error(`Failed to download file to local: ${err.message}`));
              }

              // 更新会话最后使用时间
              const session = this.sessions.get(connectionId);
              if (session) {
                session.lastUsed = new Date();
              }

              console.log('[SFTP downloadFile] 下载成功');
              resolve();
            });
          });
        });
      },

      // 获取真实绝对路径
      realpath: async (path: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          sftp.realpath(path, (err: any, resolvedPath: string) => {
            if (err) {
              return reject(new Error(`Failed to resolve path: ${err.message}`));
            }

            // 更新会话最后使用时间
            const session = this.sessions.get(connectionId);
            if (session) {
              session.lastUsed = new Date();
            }

            resolve(resolvedPath);
          });
        });
      },
    };
  }

  // 递归删除目录
  private static async deleteDirectoryRecursive(sftp: any, path: string, connectionId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // 读取目录内容
      sftp.readdir(path, async (err: any, list: any[]) => {
        if (err) {
          return reject(new Error(`Failed to read directory: ${err.message}`));
        }

        // 删除所有子项
        const deletePromises = list.map(item => {
          const itemPath = `${path === '/' ? '' : path}/${item.filename}`;
          const isDir = (item.attrs.mode & 0o170000) === 0o040000;
          
          if (isDir) {
            // 递归删除子目录
            return this.deleteDirectoryRecursive(sftp, itemPath, connectionId);
          } else {
            // 删除文件
            return new Promise<void>((res, rej) => {
              sftp.unlink(itemPath, (err: any) => {
                if (err) return rej(new Error(`Failed to delete file: ${err.message}`));
                res();
              });
            });
          }
        });

        try {
          await Promise.all(deletePromises);
          
          // 删除空目录
          sftp.rmdir(path, (err: any) => {
            if (err) {
              return reject(new Error(`Failed to delete directory: ${err.message}`));
            }
            
            // 更新会话最后使用时间
            const session = this.sessions.get(connectionId);
            if (session) {
              session.lastUsed = new Date();
            }
            
            resolve();
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  // 格式化权限
  private static formatPermissions(mode: number): string {
    const permissions = ['---', '--x', '-w-', '-wx', 'r--', 'r-x', 'rw-', 'rwx'];
    const user = permissions[(mode >> 6) & 0o7];
    const group = permissions[(mode >> 3) & 0o7];
    const other = permissions[mode & 0o7];
    return user + group + other;
  }

  // 启动会话清理定时器
  private static startSessionCleanup() {
    // 如果已经有清理定时器，不重复创建
    if (this.cleanupInterval) return;
    
    this.cleanupInterval = setInterval(() => {
      const now = new Date();
      const expiredSessions: string[] = [];
      
      this.sessions.forEach((session, id) => {
        // 检查会话是否过期
        if (now.getTime() - session.lastUsed.getTime() > this.SESSION_TIMEOUT) {
          expiredSessions.push(id);
        }
      });
      
      // 清理过期会话
      expiredSessions.forEach(id => {
        const session = this.sessions.get(id);
        if (session) {
          try {
            session.client.end();
          } catch (error) {
            console.error('Failed to close expired SFTP session:', error);
          }
          this.sessions.delete(id);
          console.log(`Closed expired SFTP session: ${id}`);
        }
      });
      
      // 如果没有活跃会话，停止清理定时器
      if (this.sessions.size === 0) {
        clearInterval(this.cleanupInterval!);
        this.cleanupInterval = null;
      }
    }, this.SESSION_TIMEOUT / 2); // 每隔超时时间的一半检查一次
  }

  // 清理定时器引用
  private static cleanupInterval: NodeJS.Timeout | null = null;
}