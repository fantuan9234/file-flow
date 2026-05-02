import { app, ipcMain, BrowserWindow, dialog } from 'electron';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { networkInterfaces, platform } from 'os';
import { join } from 'path';
import fs from 'fs';
import path from 'path';
import QRCode from 'qrcode';
import WebSocket from 'ws';
import { LanShareManager } from '../../LanShareManager';
import {
  IPC_CHANNELS,
  LanServerResponse,
  P2PStartServerResponse,
  P2PGetPeersResponse,
  P2PGetTransfersResponse,
} from '../../../shared/ipc-channels';

let lanServer: ReturnType<typeof createServer> | null = null;
let lanServerRunning = false;
let lanServerPort = 0;
let lanUploadDir = '';

function getLocalIP(): string {
  const interfaces = networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    const nets = interfaces[name];
    if (!nets) continue;
    for (const net of nets) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '127.0.0.1';
}

function generateUploadPage(): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta name="theme-color" content="#6366f1">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>FileFlow 快传</title>
  <style>
    :root {
      --bg-gradient-start: #f0f4ff;
      --bg-gradient-end: #e8ecf8;
      --card-bg: #ffffff;
      --card-shadow: 0 8px 32px rgba(99, 102, 241, 0.12), 0 2px 8px rgba(0, 0, 0, 0.04);
      --card-shadow-hover: 0 12px 40px rgba(99, 102, 241, 0.18), 0 4px 12px rgba(0, 0, 0, 0.06);
      --text-primary: #1f2937;
      --text-secondary: #6b7280;
      --text-tertiary: #9ca3af;
      --border-color: #e5e7eb;
      --primary: #6366f1;
      --primary-light: #818cf8;
      --primary-bg: #eef2ff;
      --success: #10b981;
      --success-bg: #ecfdf5;
      --error: #ef4444;
      --error-bg: #fef2f2;
      --upload-bg: #f9fafb;
      --upload-border: #d1d5db;
      --upload-hover-bg: #f3f4f6;
      --peer-card-bg: #f9fafb;
      --peer-card-hover-bg: #f3f4f6;
      --progress-bg: #e5e7eb;
      --divider: #e5e7eb;
    }

    @media (prefers-color-scheme: dark) {
      :root {
        --bg-gradient-start: #0f172a;
        --bg-gradient-end: #1e293b;
        --card-bg: #1e293b;
        --card-shadow: 0 8px 32px rgba(0, 0, 0, 0.4), 0 2px 8px rgba(0, 0, 0, 0.2);
        --card-shadow-hover: 0 12px 40px rgba(0, 0, 0, 0.5), 0 4px 12px rgba(0, 0, 0, 0.25);
        --text-primary: #f9fafb;
        --text-secondary: #9ca3af;
        --text-tertiary: #6b7280;
        --border-color: #374151;
        --primary: #818cf8;
        --primary-light: #a5b4fc;
        --primary-bg: #1e1b4b;
        --success: #34d399;
        --success-bg: #064e3b;
        --error: #f87171;
        --error-bg: #7f1d1d;
        --upload-bg: #1f2937;
        --upload-border: #4b5563;
        --upload-hover-bg: #374151;
        --peer-card-bg: #1f2937;
        --peer-card-hover-bg: #374151;
        --progress-bg: #374151;
        --divider: #374151;
      }
    }

    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    html, body {
      height: 100%;
      overflow: hidden;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, var(--bg-gradient-start) 0%, var(--bg-gradient-end) 100%);
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 16px;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
    }

    .app-container {
      width: 100%;
      max-width: 480px;
      max-height: 90vh;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: none;
    }

    .app-container::-webkit-scrollbar {
      display: none;
    }

    .main-card {
      background: var(--card-bg);
      border-radius: 24px;
      box-shadow: var(--card-shadow);
      padding: 32px 24px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .main-card:hover {
      box-shadow: var(--card-shadow-hover);
    }

    .header {
      text-align: center;
      margin-bottom: 28px;
    }

    .logo-container {
      width: 64px;
      height: 64px;
      margin: 0 auto 16px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
      border-radius: 18px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
    }

    .logo-icon {
      width: 36px;
      height: 36px;
      fill: white;
    }

    .app-title {
      font-size: 24px;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.5px;
      margin-bottom: 8px;
    }

    .app-title span {
      color: var(--primary);
    }

    .app-subtitle {
      font-size: 14px;
      color: var(--text-secondary);
      line-height: 1.5;
    }

    .device-name-section {
      margin-bottom: 24px;
    }

    .device-name-input {
      width: 100%;
      padding: 12px 16px;
      border: 1.5px solid var(--border-color);
      border-radius: 12px;
      font-size: 15px;
      color: var(--text-primary);
      background: var(--peer-card-bg);
      transition: all 0.2s ease;
      outline: none;
    }

    .device-name-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .upload-area {
      border: 2px dashed var(--upload-border);
      border-radius: 16px;
      padding: 32px 16px;
      text-align: center;
      background: var(--upload-bg);
      cursor: pointer;
      transition: all 0.2s ease;
      margin-bottom: 24px;
    }

    .upload-area:hover {
      border-color: var(--primary);
      background: var(--upload-hover-bg);
    }

    .upload-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 12px;
      fill: var(--primary);
    }

    .upload-text {
      font-size: 16px;
      font-weight: 600;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .upload-hint {
      font-size: 13px;
      color: var(--text-secondary);
    }

    .peers-section {
      margin-bottom: 24px;
    }

    .section-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--text-secondary);
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .peer-card {
      display: flex;
      align-items: center;
      padding: 12px 16px;
      background: var(--peer-card-bg);
      border-radius: 12px;
      margin-bottom: 8px;
      transition: background 0.2s ease;
    }

    .peer-card:hover {
      background: var(--peer-card-hover-bg);
    }

    .peer-avatar {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: var(--primary-bg);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
    }

    .peer-avatar svg {
      width: 20px;
      height: 20px;
      fill: var(--primary);
    }

    .peer-info {
      flex: 1;
    }

    .peer-name {
      font-size: 15px;
      font-weight: 500;
      color: var(--text-primary);
    }

    .peer-type {
      font-size: 12px;
      color: var(--text-tertiary);
    }

    .progress-section {
      margin-bottom: 24px;
    }

    .progress-bar {
      height: 8px;
      background: var(--progress-bg);
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 8px;
    }

    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary) 0%, var(--primary-light) 100%);
      border-radius: 4px;
      transition: width 0.3s ease;
      width: 0%;
    }

    .status {
      font-size: 14px;
      text-align: center;
      padding: 8px;
      border-radius: 8px;
    }

    .status.success {
      color: var(--success);
      background: var(--success-bg);
    }

    .status.error {
      color: var(--error);
      background: var(--error-bg);
    }

    .divider {
      height: 1px;
      background: var(--divider);
      margin: 24px 0;
    }

    .footer {
      text-align: center;
      font-size: 12px;
      color: var(--text-tertiary);
      padding-top: 16px;
    }

    #fileInput {
      display: none;
    }
  </style>
</head>
<body>
  <div class="app-container">
    <div class="main-card">
      <div class="header">
        <div class="logo-container">
          <svg class="logo-icon" viewBox="0 0 24 24">
            <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
          </svg>
        </div>
        <h1 class="app-title">FileFlow <span>快传</span></h1>
        <p class="app-subtitle">局域网内快速传输文件，无需数据线</p>
      </div>

      <div class="device-name-section">
        <input type="text" id="deviceName" class="device-name-input" placeholder="输入设备名称" value="手机">
      </div>

      <div class="upload-area" id="uploadArea">
        <svg class="upload-icon" viewBox="0 0 24 24">
          <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
        </svg>
        <div class="upload-text">点击选择文件</div>
        <div class="upload-hint">支持所有文件类型</div>
      </div>
      <input type="file" id="fileInput" multiple>

      <div class="progress-section" id="progressSection" style="display: none;">
        <div class="progress-bar">
          <div class="progress-fill" id="progressFill"></div>
        </div>
        <div class="status" id="status"></div>
      </div>

      <div class="divider"></div>

      <div class="peers-section">
        <div class="section-title">在线设备</div>
        <div id="peersList"></div>
      </div>

      <div class="footer">
        Powered by FileFlow
      </div>
    </div>
  </div>

  <script>
    const ws = new WebSocket('ws://' + location.host + '/ws');
    let peers = [];

    ws.onopen = () => {
      const deviceName = document.getElementById('deviceName').value || 'Unknown Device';
      ws.send(JSON.stringify({
        type: 'peer-joined',
        from: '',
        payload: { name: deviceName, type: 'browser' }
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'peer-joined') {
        if (msg.payload?.peerId) {
          peers = msg.payload.peers || [];
          if (msg.payload.peer) {
            const exists = peers.find(p => p.id === msg.payload.peer.id);
            if (!exists) peers.push(msg.payload.peer);
          }
        } else if (msg.payload?.peer) {
          peers.push(msg.payload.peer);
        }
        renderPeers();
      } else if (msg.type === 'peer-left') {
        peers = peers.filter(p => p.id !== msg.payload.peerId);
        renderPeers();
      } else if (msg.type === 'file-saved') {
        alert('文件已保存: ' + msg.payload.fileName);
      }
    };

    function renderPeers() {
      const container = document.getElementById('peersList');
      container.innerHTML = peers.map(p => \`
        <div class="peer-card">
          <div class="peer-avatar">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
          </div>
          <div class="peer-info">
            <div class="peer-name">\${p.name}</div>
            <div class="peer-type">\${p.type === 'desktop' ? '电脑' : '浏览器'}</div>
          </div>
        </div>
      \`).join('');
    }

    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const progressSection = document.getElementById('progressSection');
    const progressFill = document.getElementById('progressFill');
    const status = document.getElementById('status');

    uploadArea.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async (e) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      progressSection.style.display = 'block';
      status.className = 'status';
      status.textContent = '准备上传...';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        status.textContent = '上传中: ' + file.name;

        try {
          const formData = new FormData();
          formData.append('file', file);

          const xhr = new XMLHttpRequest();
          xhr.upload.addEventListener('progress', (e) => {
            if (e.lengthComputable) {
              const percent = Math.round(((i + e.loaded / e.total) / files.length) * 100);
              progressFill.style.width = percent + '%';
            }
          });

          await new Promise((resolve, reject) => {
            xhr.onload = () => {
              if (xhr.status === 200) resolve();
              else reject(new Error('Upload failed'));
            };
            xhr.onerror = reject;
            xhr.open('POST', '/upload');
            xhr.send(formData);
          });

          status.textContent = '已上传: ' + file.name;
        } catch (err) {
          status.className = 'status error';
          status.textContent = '上传失败: ' + file.name;
          return;
        }
      }

      progressFill.style.width = '100%';
      status.className = 'status success';
      status.textContent = '✅ 全部上传成功！';
    });
  </script>
</body>
</html>`;
}

function handleUploadRequest(req: IncomingMessage, res: ServerResponse, mainWindow: BrowserWindow | null) {
  const url = new URL(req.url || '/', `http://${req.headers.host}`);

  if (req.method === 'GET' && url.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(generateUploadPage());
    return;
  }

  if (req.method === 'POST' && url.pathname === '/upload') {
    const boundary = req.headers['content-type']?.split('boundary=')[1];
    if (!boundary) {
      res.writeHead(400);
      res.end('Invalid request');
      return;
    }

    let body: Buffer[] = [];
    req.on('data', (chunk: Buffer) => body.push(chunk));
    req.on('end', () => {
      const buffer = Buffer.concat(body);
      const headerEnd = buffer.indexOf('\r\n\r\n');
      if (headerEnd === -1) {
        res.writeHead(400);
        res.end('Invalid multipart data');
        return;
      }

      const header = buffer.slice(0, headerEnd).toString();
      const filenameMatch = header.match(/filename="([^"]+)"/);
      const filename = filenameMatch ? filenameMatch[1] : 'unknown';

      const dataStart = headerEnd + 4;
      const dataEnd = buffer.lastIndexOf('\r\n');
      const fileData = buffer.slice(dataStart, dataEnd);

      const savePath = path.join(lanUploadDir, filename);
      let finalPath = savePath;
      let counter = 1;
      while (fs.existsSync(finalPath)) {
        const ext = path.extname(filename);
        const name = path.basename(filename, ext);
        finalPath = path.join(lanUploadDir, `${name}_${counter}${ext}`);
        counter++;
      }

      try {
        fs.writeFileSync(finalPath, fileData);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, filename: path.basename(finalPath) }));
        if (mainWindow) {
          mainWindow.webContents.send(IPC_CHANNELS.LAN_FILE_RECEIVED, path.basename(finalPath));
        }
      } catch (err: any) {
        res.writeHead(500);
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
}

export class TransferService {
  private mainWindow: BrowserWindow | null = null;
  private p2pManager: LanShareManager | null = null;
  private p2pServerRunning = false;
  private desktopWs: WebSocket | null = null;

  setMainWindow(window: BrowserWindow | null) {
    this.mainWindow = window;
  }

  isLanServerRunning() {
    return lanServerRunning;
  }

  isP2PServerRunning() {
    return this.p2pServerRunning;
  }

  private getDesktopPeerName(): string {
    const os = platform();
    const osMap: Record<string, string> = {
      win32: 'Windows 电脑',
      darwin: 'Mac 电脑',
      linux: 'Linux 电脑',
    };
    return osMap[os] || '电脑';
  }

  private connectDesktopPeer(port: number): void {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'peer-joined',
        from: '',
        payload: { name: this.getDesktopPeerName(), type: 'desktop' }
      }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'peer-joined' && msg.payload?.peerId) {
          console.log('[P2P] Desktop peer connected with ID:', msg.payload.peerId);
        }
      } catch (err) {
        console.error('[P2P] Invalid message from desktop peer:', err);
      }
    });

    ws.on('close', () => {
      console.log('[P2P] Desktop peer disconnected');
    });

    ws.on('error', (err) => {
      console.error('[P2P] Desktop peer WebSocket error:', err);
    });

    this.desktopWs = ws;
  }

  cleanup() {
    if (lanServer && lanServerRunning) {
      lanServer.close();
      lanServer = null;
      lanServerRunning = false;
      lanServerPort = 0;
    }

    if (this.desktopWs) {
      this.desktopWs.close();
      this.desktopWs = null;
    }
    if (this.p2pManager) {
      this.p2pManager.stop();
      this.p2pManager = null;
      this.p2pServerRunning = false;
    }
  }

  registerIPC() {
    ipcMain.handle(IPC_CHANNELS.LAN_START_SERVER, async (_, uploadDir: string): Promise<LanServerResponse> => {
      try {
        if (lanServerRunning) {
          return { success: false, error: 'Server already running' };
        }

        lanUploadDir = uploadDir;
        if (!fs.existsSync(lanUploadDir)) {
          fs.mkdirSync(lanUploadDir, { recursive: true });
        }

        lanServer = createServer((req, res) => handleUploadRequest(req, res, this.mainWindow));

        return new Promise((resolve) => {
          lanServer!.listen(0, '0.0.0.0', async () => {
            const address = lanServer!.address();
            if (typeof address === 'object' && address) {
              lanServerPort = address.port;
              lanServerRunning = true;
              const localIP = getLocalIP();
              const url = `http://${localIP}:${lanServerPort}`;
              const qrCode = await QRCode.toDataURL(url);

              if (this.mainWindow) {
                this.mainWindow.webContents.send(IPC_CHANNELS.LAN_SERVER_STARTED, {
                  url,
                  qrCode,
                  port: lanServerPort,
                  ip: localIP,
                });
              }

              resolve({ success: true, url, qrCode, port: lanServerPort, ip: localIP });
            } else {
              resolve({ success: false, error: 'Failed to get server address' });
            }
          });
        });
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    });

    ipcMain.handle(IPC_CHANNELS.LAN_STOP_SERVER, async () => {
      try {
        if (lanServer && lanServerRunning) {
          lanServer.close();
          lanServer = null;
          lanServerRunning = false;
          lanServerPort = 0;
          if (this.mainWindow) {
            this.mainWindow.webContents.send(IPC_CHANNELS.LAN_SERVER_STOPPED);
          }
        }
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    });

    ipcMain.handle(IPC_CHANNELS.P2P_START_SERVER, async (_, uploadDir: string): Promise<P2PStartServerResponse> => {
      try {
        if (this.p2pServerRunning) {
          return { success: false, error: 'P2P server already running' };
        }

        let dir = uploadDir;
        if (!dir) {
          try {
            const savedDir = await this.mainWindow?.webContents.executeJavaScript("localStorage.getItem('p2p-receive-dir')");
            if (savedDir) {
              dir = savedDir;
            } else {
              const downloadsDir = app.getPath('downloads');
              dir = join(downloadsDir, 'FileFlow_Received');
            }
          } catch {
            const downloadsDir = app.getPath('downloads');
            dir = join(downloadsDir, 'FileFlow_Received');
          }
        }

        this.p2pManager = new LanShareManager(dir);
        this.p2pManager.setCallbacks({
          onStatusChange: (status) => {
            console.log('[P2P]', status);
            if (this.mainWindow) {
              this.mainWindow.webContents.send(IPC_CHANNELS.P2P_STATUS_CHANGE, { status });
            }
          },
          onPeerConnected: (peer) => {
            if (this.mainWindow) {
              this.mainWindow.webContents.send(IPC_CHANNELS.P2P_PEER_CONNECTED, peer);
            }
          },
          onPeerDisconnected: (peerId) => {
            if (this.mainWindow) {
              this.mainWindow.webContents.send(IPC_CHANNELS.P2P_PEER_DISCONNECTED, { peerId });
            }
          },
          onFileReceived: (file) => {
            if (this.mainWindow) {
              this.mainWindow.webContents.send(IPC_CHANNELS.P2P_FILE_RECEIVED, file);
            }
          },
          onTransferProgress: (fileId, progress) => {
            if (this.mainWindow) {
              this.mainWindow.webContents.send(IPC_CHANNELS.P2P_TRANSFER_PROGRESS, { fileId, progress });
            }
          },
        });

        const result = await this.p2pManager.start(0);
        this.p2pServerRunning = true;

        this.connectDesktopPeer(result.port);

        if (this.mainWindow) {
          this.mainWindow.webContents.send(IPC_CHANNELS.P2P_SERVER_STARTED, { ...result, receiveDir: dir });
        }

        return { success: true, ...result, receiveDir: dir };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    });

    ipcMain.handle(IPC_CHANNELS.P2P_STOP_SERVER, async () => {
      try {
        if (this.desktopWs) {
          this.desktopWs.close();
          this.desktopWs = null;
        }
        if (this.p2pManager) {
          this.p2pManager.stop();
          this.p2pManager = null;
          this.p2pServerRunning = false;
          if (this.mainWindow) {
            this.mainWindow.webContents.send(IPC_CHANNELS.P2P_SERVER_STOPPED);
          }
        }
        return { success: true };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    });

    ipcMain.handle(IPC_CHANNELS.P2P_SELECT_RECEIVE_DIR, async () => {
      try {
        const result = await dialog.showOpenDialog(this.mainWindow!, {
          title: '选择接收文件保存目录',
          properties: ['openDirectory'],
          buttonLabel: '选择此目录',
        });

        if (result.canceled || result.filePaths.length === 0) {
          return { success: false, error: '用户取消选择' };
        }

        const dir = result.filePaths[0];
        if (this.mainWindow) {
          this.mainWindow.webContents.executeJavaScript(`localStorage.setItem('p2p-receive-dir', '${dir.replace(/\\/g, '\\\\')}')`);
        }

        return { success: true, dir };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    });

    ipcMain.handle(IPC_CHANNELS.P2P_GET_RECEIVE_DIR, async () => {
      try {
        const savedDir = await this.mainWindow?.webContents.executeJavaScript("localStorage.getItem('p2p-receive-dir')");
        if (savedDir) {
          return { success: true, dir: savedDir };
        }
        const downloadsDir = app.getPath('downloads');
        const defaultDir = join(downloadsDir, 'FileFlow_Received');
        return { success: true, dir: defaultDir };
      } catch (error: any) {
        const downloadsDir = app.getPath('downloads');
        const defaultDir = join(downloadsDir, 'FileFlow_Received');
        return { success: true, dir: defaultDir };
      }
    });

    ipcMain.handle(IPC_CHANNELS.P2P_GET_PEERS, async (): Promise<P2PGetPeersResponse> => {
      try {
        if (!this.p2pManager) {
          return { success: false, error: 'Server not running' };
        }
        return { success: true, peers: this.p2pManager.getPeers() };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    });

    ipcMain.handle(IPC_CHANNELS.P2P_GET_TRANSFERS, async (): Promise<P2PGetTransfersResponse> => {
      try {
        if (!this.p2pManager) {
          return { success: false, error: 'Server not running' };
        }
        return { success: true, transfers: this.p2pManager.getTransfers() };
      } catch (error: any) {
        return { success: false, error: error?.message || String(error) };
      }
    });
  }
}

export const transferService = new TransferService();
