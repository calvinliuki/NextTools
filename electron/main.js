const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');

// 单实例锁 - 防止多开
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
  process.exit(0);
}

const isDev = process.argv.includes('--dev');
const PORT = 3000;

let mainWindow = null;
let serverProcess = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 10 },
    icon: path.join(__dirname, '..', 'public', 'logo.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.loadURL(`http://localhost:${PORT}`);

  // 在外部浏览器中打开链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 监听全屏状态变化
  mainWindow.on('enter-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow.webContents.send('fullscreen-change', false);
  });

  // 初始化时发送当前全屏状态
  mainWindow.webContents.on('did-finish-load', () => {
    // 延迟发送，确保渲染进程已准备好
    setTimeout(() => {
      if (mainWindow) {
        mainWindow.webContents.send('fullscreen-change', mainWindow.isFullScreen());
      }
    }, 100);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function startServer() {
  return new Promise((resolve, reject) => {
    if (isDev) {
      // 开发模式：假设 Next.js 开发服务器已在运行
      resolve();
      return;
    }

    // 生产模式：启动内嵌的 Next.js 服务器
    const serverPath = path.join(process.resourcesPath, 'server', 'server.js');
    const serverDir = path.join(process.resourcesPath, 'server');

    console.log('[Electron] 启动服务器:', serverPath);
    console.log('[Electron] 工作目录:', serverDir);

    // 检查 server.js 是否存在
    if (!fs.existsSync(serverPath)) {
      console.error('[Electron] 错误: server.js 不存在:', serverPath);
      reject(new Error('server.js not found'));
      return;
    }

    // 使用 Electron 内置 Node.js 运行 server.js
    serverProcess = spawn(process.execPath, [serverPath], {
      cwd: serverDir,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: PORT.toString(),
        ELECTRON_RUN_AS_NODE: '1',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    serverProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[Server]', output);
      if (output.includes('Ready') || output.includes('started')) {
        resolve();
      }
    });

    serverProcess.stderr.on('data', (data) => {
      console.error('[Server Error]', data.toString());
    });

    serverProcess.on('error', (err) => {
      console.error('[Electron] 服务器启动错误:', err);
      reject(err);
    });

    serverProcess.on('exit', (code) => {
      console.log('[Server] 进程退出，代码:', code);
      if (code !== 0 && code !== null) {
        reject(new Error(`Server exited with code ${code}`));
      }
    });

    // 超时处理
    setTimeout(() => {
      resolve(); // 即使没有收到 Ready 消息也继续
    }, 5000);
  });
}

function stopServer() {
  if (serverProcess) {
    console.log('[Electron] 关闭服务器进程');
    serverProcess.kill();
    serverProcess = null;
  }
}

// 处理第二个实例启动
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

app.whenReady().then(async () => {
  try {
    await startServer();
    createWindow();
  } catch (err) {
    console.error('[Electron] 启动失败:', err);
    stopServer();
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopServer();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

app.on('before-quit', () => {
  stopServer();
});
