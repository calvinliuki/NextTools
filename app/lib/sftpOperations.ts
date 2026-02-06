// SFTP 操作接口定义
export interface SFTPFileItem {
  name: string;
  type: 'file' | 'directory' | 'link';
  size: string;
  modified: string;
  permissions: string;
  owner?: string;
  group?: string;
  path?: string;
  isDirectory?: () => boolean;
}

// SFTP 操作类
export class SFTPOperations {
  private connectionId: string;

  constructor(connectionId: string) {
    this.connectionId = connectionId;
  }

  // 列出目录内容
  async listDirectory(path: string = '/'): Promise<SFTPFileItem[]> {
    const response = await fetch('/api/ssh/sftp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionId: this.connectionId,
        action: 'list',
        path,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to list directory');
    }

    // 转换为前端使用的格式
    return result.data.map((item: any) => ({
      name: item.name,
      type: item.type === 'd' ? 'directory' : (item.type === 'l' ? 'link' : 'file'),
      size: this.formatFileSize(item.size),
      modified: this.formatDate(item.modifyTime),
      permissions: item.rights.user + item.rights.group + item.rights.other,
      owner: item.owner.toString(),
      group: item.group.toString(),
      path: item.path,
      isDirectory: () => item.type === 'd',
    }));
  }

  // 读取文件内容
  async readFile(path: string, encoding: string = 'utf8'): Promise<string> {
    const response = await fetch('/api/ssh/sftp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionId: this.connectionId,
        action: 'read',
        path,
        encoding,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to read file');
    }

    return result.data;
  }

  // 获取文件/目录状态
  async getStat(path: string): Promise<any> {
    const response = await fetch('/api/ssh/sftp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionId: this.connectionId,
        action: 'stat',
        path,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to get file stats');
    }

    return result.data;
  }

  // 创建目录
  async createDirectory(path: string): Promise<void> {
    const response = await fetch('/api/ssh/sftp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionId: this.connectionId,
        action: 'mkdir',
        path,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to create directory');
    }
  }

  // 删除文件或目录
  async deleteItem(path: string, recursive: boolean = false): Promise<void> {
    const response = await fetch('/api/ssh/sftp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionId: this.connectionId,
        action: 'delete',
        path,
        recursive,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to delete item');
    }
  }

  // 重命名文件或目录
  async renameItem(oldPath: string, newPath: string): Promise<void> {
    const response = await fetch('/api/ssh/sftp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        connectionId: this.connectionId,
        action: 'rename',
        path: oldPath,
        newPath,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to rename item');
    }
  }

  // 上传文件
  async uploadFile(path: string, file: File): Promise<string> {
    const formData = new FormData();
    formData.append('connectionId', this.connectionId);
    formData.append('path', path);
    formData.append('file', file);

    const response = await fetch('/api/ssh/sftp', {
      method: 'PUT',
      body: formData,
    });

    const result = await response.json();

    if (!result.success) {
      throw new Error(result.error || 'Failed to upload file');
    }

    return result.filePath;
  }

  // 下载文件
  downloadFile(path: string): string {
    return `/api/ssh/sftp?connectionId=${this.connectionId}&path=${encodeURIComponent(path)}`;
  }

  // 格式化文件大小
  private formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 格式化日期
  private formatDate(date: Date): string {
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  }
}