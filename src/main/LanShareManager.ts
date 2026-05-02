import { WebSocketServer, WebSocket } from 'ws';
import { createServer, Server } from 'http';
import { networkInterfaces } from 'os';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

interface PeerInfo {
  id: string;
  name: string;
  type: 'desktop' | 'browser';
  connectedAt: number;
}

interface SignalingMessage {
  type: 'offer' | 'answer' | 'candidate' | 'disconnect' | 'peer-joined' | 'peer-left' | 'file-meta' | 'file-chunk' | 'file-complete';
  from: string;
  to?: string;
  payload?: any;
}

interface TransferFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: 'pending' | 'transferring' | 'completed' | 'error';
  direction: 'sending' | 'receiving';
  peerId: string;
  savedPath?: string;
}

export class LanShareManager {
  private httpServer: Server | null = null;
  private wss: WebSocketServer | null = null;
  private port: number = 0;
  private peers: Map<string, { ws: WebSocket; info: PeerInfo }> = new Map();
  private pendingTransfers: Map<string, TransferFile> = new Map();
  private fileBuffers: Map<string, Buffer[]> = new Map();
  private uploadDir: string = '';
  private onStatusChange?: (status: string) => void;
  private onPeerConnected?: (peer: PeerInfo) => void;
  private onPeerDisconnected?: (peerId: string) => void;
  private onFileReceived?: (file: TransferFile) => void;
  private onTransferProgress?: (fileId: string, progress: number) => void;

  constructor(uploadDir: string) {
    this.uploadDir = uploadDir;
  }

  getLocalIP(): string {
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

  async start(port: number = 0): Promise<{ url: string; port: number; ip: string }> {
    return new Promise((resolve, reject) => {
      this.httpServer = createServer((req, res) => {
        if (req.url === '/' || req.url === '/index.html') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(this.generateClientPage());
        } else if (req.url === '/api/peers') {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          const peerList = Array.from(this.peers.values()).map(p => p.info);
          res.end(JSON.stringify(peerList));
        } else {
          res.writeHead(404);
          res.end('Not found');
        }
      });

      this.wss = new WebSocketServer({ server: this.httpServer, path: '/ws' });

      this.wss.on('connection', (ws: WebSocket) => {
        const peerId = uuidv4();
        console.log(`[LanShare] New peer connected: ${peerId}`);

        ws.on('message', (data: Buffer) => {
          try {
            const msg: SignalingMessage = JSON.parse(data.toString());
            this.handleMessage(peerId, ws, msg);
          } catch (err) {
            console.error('[LanShare] Invalid message:', err);
          }
        });

        ws.on('close', () => {
          console.log(`[LanShare] Peer disconnected: ${peerId}`);
          const peer = this.peers.get(peerId);
          if (peer) {
            this.peers.delete(peerId);
            this.broadcast({
              type: 'peer-left',
              from: peerId,
              payload: { peerId },
            });
            this.onPeerDisconnected?.(peerId);
          }
        });

        ws.on('error', (err) => {
          console.error('[LanShare] WebSocket error:', err);
        });
      });

      this.httpServer.listen(port, '0.0.0.0', () => {
        const address = this.httpServer!.address();
        if (typeof address === 'object' && address) {
          this.port = address.port;
          const ip = this.getLocalIP();
          const url = `http://${ip}:${this.port}`;
          this.onStatusChange?.(`Server started on ${url}`);
          resolve({ url, port: this.port, ip });
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
    });
  }

  stop(): void {
    if (this.wss) {
      this.wss.close();
      this.wss = null;
    }
    if (this.httpServer) {
      this.httpServer.close();
      this.httpServer = null;
    }
    this.peers.clear();
    this.pendingTransfers.clear();
    this.fileBuffers.clear();
    this.onStatusChange?.('Server stopped');
  }

  setCallbacks(callbacks: {
    onStatusChange?: (status: string) => void;
    onPeerConnected?: (peer: PeerInfo) => void;
    onPeerDisconnected?: (peerId: string) => void;
    onFileReceived?: (file: TransferFile) => void;
    onTransferProgress?: (fileId: string, progress: number) => void;
  }): void {
    this.onStatusChange = callbacks.onStatusChange;
    this.onPeerConnected = callbacks.onPeerConnected;
    this.onPeerDisconnected = callbacks.onPeerDisconnected;
    this.onFileReceived = callbacks.onFileReceived;
    this.onTransferProgress = callbacks.onTransferProgress;
  }

  getPeers(): PeerInfo[] {
    return Array.from(this.peers.values()).map(p => p.info);
  }

  getTransfers(): TransferFile[] {
    return Array.from(this.pendingTransfers.values());
  }

  private handleMessage(peerId: string, ws: WebSocket, msg: SignalingMessage): void {
    switch (msg.type) {
      case 'peer-joined':
        this.handlePeerJoined(peerId, ws, msg.payload);
        break;

      case 'offer':
      case 'answer':
      case 'candidate':
        this.relayMessage(msg);
        break;

      case 'file-meta':
        this.handleFileMeta(peerId, msg.payload);
        break;

      case 'file-chunk':
        this.handleFileChunk(peerId, msg.payload);
        break;

      case 'file-complete':
        this.handleFileComplete(peerId, msg.payload);
        break;

      case 'disconnect':
        ws.close();
        break;

      default:
        console.log('[LanShare] Unknown message type:', msg.type);
    }
  }

  private handlePeerJoined(peerId: string, ws: WebSocket, payload: any): void {
    let name = payload?.name || 'Unknown Device';
    const type = payload?.type || 'browser';

    const existingNames = Array.from(this.peers.values()).map(p => p.info.name);
    let finalName = name;
    let counter = 1;
    while (existingNames.includes(finalName)) {
      finalName = `${name} (${counter})`;
      counter++;
    }

    const peerInfo: PeerInfo = {
      id: peerId,
      name: finalName,
      type: type as 'desktop' | 'browser',
      connectedAt: Date.now(),
    };

    this.peers.set(peerId, { ws, info: peerInfo });
    this.onPeerConnected?.(peerInfo);

    ws.send(JSON.stringify({
      type: 'peer-joined',
      from: 'server',
      to: peerId,
      payload: { peerId, peers: this.getPeers() },
    }));

    this.broadcast({
      type: 'peer-joined',
      from: peerId,
      payload: { peer: peerInfo },
    }, peerId);
  }

  private handleFileMeta(peerId: string, payload: any): void {
    const fileId = payload.id || uuidv4();
    const transfer: TransferFile = {
      id: fileId,
      name: payload.name,
      size: payload.size,
      type: payload.type || 'application/octet-stream',
      progress: 0,
      status: 'pending',
      direction: 'receiving',
      peerId,
    };

    this.pendingTransfers.set(fileId, transfer);
    this.fileBuffers.set(fileId, []);
  }

  private handleFileChunk(_peerId: string, payload: any): void {
    const fileId = payload.fileId;
    const chunk = Buffer.from(payload.data, 'base64');
    const buffers = this.fileBuffers.get(fileId);

    if (buffers) {
      buffers.push(chunk);
      this.fileBuffers.set(fileId, buffers);

      const transfer = this.pendingTransfers.get(fileId);
      if (transfer) {
        transfer.status = 'transferring';
        const totalSize = buffers.reduce((sum, b) => sum + b.length, 0);
        transfer.progress = Math.min((totalSize / transfer.size) * 100, 100);
        this.onTransferProgress?.(fileId, transfer.progress);
      }
    }
  }

  private handleFileComplete(_peerId: string, payload: any): void {
    const fileId = payload.fileId;
    const buffers = this.fileBuffers.get(fileId);
    const transfer = this.pendingTransfers.get(fileId);

    if (buffers && transfer) {
      const fileData = Buffer.concat(buffers);
      const filePath = join(this.uploadDir, transfer.name);

      try {
        const { writeFileSync, existsSync, mkdirSync } = require('fs');
        mkdirSync(this.uploadDir, { recursive: true });

        let finalPath = filePath;
        let counter = 1;
        while (existsSync(finalPath)) {
          const ext = require('path').extname(transfer.name);
          const name = require('path').basename(transfer.name, ext);
          finalPath = join(this.uploadDir, `${name}_${counter}${ext}`);
          counter++;
        }

        writeFileSync(finalPath, fileData);
        transfer.status = 'completed';
        transfer.progress = 100;
        transfer.savedPath = finalPath;
        this.onFileReceived?.(transfer);

        const peer = this.peers.get(_peerId);
        if (peer) {
          peer.ws.send(JSON.stringify({
            type: 'file-saved',
            from: 'server',
            to: _peerId,
            payload: { fileId, savedPath: finalPath, fileName: transfer.name },
          }));
        }
      } catch (err: any) {
        transfer.status = 'error';
        console.error('[LanShare] Failed to save file:', err);
      }

      this.fileBuffers.delete(fileId);
    }
  }

  private relayMessage(msg: SignalingMessage): void {
    if (msg.to) {
      const target = this.peers.get(msg.to);
      if (target) {
        target.ws.send(JSON.stringify(msg));
      }
    } else {
      this.broadcast(msg);
    }
  }

  private broadcast(msg: SignalingMessage, excludeId?: string): void {
    const data = JSON.stringify(msg);
    for (const [id, { ws }] of this.peers) {
      if (id !== excludeId && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    }
  }

  private generateClientPage(): string {
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
      background: var(--upload-bg);
      text-align: center;
      transition: all 0.2s ease;
      outline: none;
    }

    .device-name-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
    }

    .device-name-input::placeholder {
      color: var(--text-tertiary);
    }

    .section-title {
      font-size: 13px;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    .peers-section {
      margin-bottom: 24px;
    }

    .peers-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }

    .peer-card {
      background: var(--peer-card-bg);
      border: 1.5px solid transparent;
      border-radius: 14px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      transition: all 0.2s ease;
      min-width: 0;
      flex: 1;
    }

    .peer-card:hover {
      background: var(--peer-card-hover-bg);
      transform: translateY(-1px);
    }

    .peer-card.selected {
      border-color: var(--primary);
      background: var(--primary-bg);
    }

    .peer-avatar {
      width: 36px;
      height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-light) 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .peer-avatar svg {
      width: 20px;
      height: 20px;
      fill: white;
    }

    .peer-info {
      min-width: 0;
      flex: 1;
    }

    .peer-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .peer-type {
      font-size: 12px;
      color: var(--text-tertiary);
    }

    .peer-status {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--success);
      flex-shrink: 0;
    }

    .upload-section {
      margin-bottom: 24px;
    }

    .upload-area {
      border: 2px dashed var(--upload-border);
      border-radius: 16px;
      padding: 32px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.25s ease;
      background: var(--upload-bg);
    }

    .upload-area:hover {
      background: var(--upload-hover-bg);
      border-color: var(--primary);
    }

    .upload-area.dragover {
      background: var(--primary-bg);
      border-color: var(--primary);
      transform: scale(1.02);
    }

    .upload-icon {
      width: 48px;
      height: 48px;
      margin: 0 auto 12px;
      background: var(--primary-bg);
      border-radius: 14px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .upload-icon svg {
      width: 24px;
      height: 24px;
      fill: var(--primary);
    }

    .upload-text {
      font-size: 15px;
      font-weight: 500;
      color: var(--text-primary);
      margin-bottom: 4px;
    }

    .upload-hint {
      font-size: 13px;
      color: var(--text-tertiary);
    }

    .transfers-section {
      margin-bottom: 8px;
    }

    .transfer-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .transfer-item {
      background: var(--peer-card-bg);
      border-radius: 12px;
      padding: 14px;
    }

    .transfer-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 10px;
    }

    .transfer-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .transfer-icon.transferring {
      background: var(--primary-bg);
    }

    .transfer-icon.completed {
      background: var(--success-bg);
    }

    .transfer-icon.error {
      background: var(--error-bg);
    }

    .transfer-icon svg {
      width: 18px;
      height: 18px;
    }

    .transfer-icon.transferring svg {
      fill: var(--primary);
    }

    .transfer-icon.completed svg {
      fill: var(--success);
    }

    .transfer-icon.error svg {
      fill: var(--error);
    }

    .transfer-info {
      min-width: 0;
      flex: 1;
    }

    .transfer-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .transfer-size {
      font-size: 12px;
      color: var(--text-tertiary);
    }

    .transfer-progress-bar {
      height: 4px;
      background: var(--progress-bg);
      border-radius: 2px;
      overflow: hidden;
    }

    .transfer-progress-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--primary) 0%, var(--primary-light) 100%);
      border-radius: 2px;
      transition: width 0.3s ease;
    }

    .transfer-status {
      font-size: 12px;
      color: var(--text-tertiary);
      margin-top: 6px;
    }

    .transfer-status.success {
      color: var(--success);
    }

    .transfer-status.error {
      color: var(--error);
    }

    .empty-state {
      text-align: center;
      padding: 20px;
      color: var(--text-tertiary);
      font-size: 14px;
    }

    .empty-state svg {
      width: 40px;
      height: 40px;
      fill: var(--text-tertiary);
      margin-bottom: 8px;
      opacity: 0.5;
    }

    #fileInput {
      display: none;
    }

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
    }

    .connecting {
      animation: pulse 1.5s ease-in-out infinite;
    }

    @media (max-width: 480px) {
      .main-card {
        padding: 24px 20px;
        border-radius: 20px;
      }

      .app-title {
        font-size: 22px;
      }

      .upload-area {
        padding: 24px 16px;
      }
    }
  </style>
</head>
<body>
  <div class="app-container">
    <div class="main-card">
      <div class="header">
        <div class="logo-container">
          <svg class="logo-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
          </svg>
        </div>
        <h1 class="app-title">FileFlow <span>快传</span></h1>
        <p class="app-subtitle">P2P 直传，无需安装 App</p>
      </div>

      <div class="device-name-section">
        <input type="text" class="device-name-input" id="deviceName" placeholder="输入你的设备名称">
      </div>

      <div class="peers-section">
        <div class="section-title">在线设备</div>
        <div class="peers-grid" id="peerList">
          <div class="empty-state" id="emptyPeers">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <p>等待其他设备连接...</p>
          </div>
        </div>
      </div>

      <div class="upload-section">
        <div class="section-title">发送文件</div>
        <div class="upload-area" id="uploadArea">
          <div class="upload-icon">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/>
            </svg>
          </div>
          <p class="upload-text" id="uploadText">点击选择文件</p>
          <p class="upload-hint" id="uploadHint">或拖拽文件到此处</p>
        </div>
        <input type="file" id="fileInput" multiple>
      </div>

      <div class="transfers-section" id="transfersSection" style="display: none;">
        <div class="section-title">传输记录</div>
        <div class="transfer-list" id="transferList"></div>
      </div>
    </div>
  </div>

  <script>
    let ws;
    let peerId;
    let peers = {};
    let selectedPeer = null;
    let transfers = {};

    const deviceNameInput = document.getElementById('deviceName');
    const peerList = document.getElementById('peerList');
    const emptyPeers = document.getElementById('emptyPeers');
    const uploadArea = document.getElementById('uploadArea');
    const uploadText = document.getElementById('uploadText');
    const uploadHint = document.getElementById('uploadHint');
    const fileInput = document.getElementById('fileInput');
    const transfersSection = document.getElementById('transfersSection');
    const transferList = document.getElementById('transferList');

    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    if (isTouchDevice) {
      uploadHint.textContent = '轻触选择文件';
    }

    function parseUserAgent() {
      const ua = navigator.userAgent;
      let os = '';
      let browser = '';
      let deviceType = '';

      if (/iPhone/.test(ua)) {
        os = 'iPhone';
        deviceType = 'mobile';
        if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
        else if (/Chrome/.test(ua)) browser = 'Chrome';
        else browser = '浏览器';
      } else if (/iPad/.test(ua)) {
        os = 'iPad';
        deviceType = 'tablet';
        if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
        else if (/Chrome/.test(ua)) browser = 'Chrome';
        else browser = '浏览器';
      } else if (/Android/.test(ua)) {
        os = 'Android';
        deviceType = 'mobile';
        if (/Mobile/.test(ua)) deviceType = 'mobile';
        else deviceType = 'tablet';
        if (/Chrome/.test(ua)) browser = 'Chrome';
        else if (/Firefox/.test(ua)) browser = 'Firefox';
        else if (/SamsungBrowser/.test(ua)) browser = 'Samsung';
        else browser = '浏览器';
      } else if (/Mac OS X/.test(ua)) {
        os = 'Mac';
        deviceType = 'desktop';
        if (/Safari/.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';
        else if (/Chrome/.test(ua)) browser = 'Chrome';
        else if (/Firefox/.test(ua)) browser = 'Firefox';
        else browser = '浏览器';
      } else if (/Windows NT/.test(ua)) {
        os = 'Windows';
        deviceType = 'desktop';
        if (/Edg/.test(ua)) browser = 'Edge';
        else if (/Chrome/.test(ua)) browser = 'Chrome';
        else if (/Firefox/.test(ua)) browser = 'Firefox';
        else browser = '浏览器';
      } else if (/Linux/.test(ua)) {
        os = 'Linux';
        deviceType = 'desktop';
        if (/Chrome/.test(ua)) browser = 'Chrome';
        else if (/Firefox/.test(ua)) browser = 'Firefox';
        else browser = '浏览器';
      } else {
        os = '未知设备';
        deviceType = 'unknown';
        browser = '浏览器';
      }

      const osMap = {
        'iPhone': 'iPhone',
        'iPad': 'iPad',
        'Android': 'Android',
        'Mac': 'Mac 电脑',
        'Windows': 'Windows 电脑',
        'Linux': 'Linux 电脑',
        '未知设备': '未知设备'
      };

      const name = osMap[os] || os;
      return { name: name + ' ' + browser, type: deviceType };
    }

    const { name: detectedName, type: deviceType } = parseUserAgent();
    deviceNameInput.placeholder = detectedName;
    deviceNameInput.value = detectedName;

    function connect() {
      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(protocol + '//' + location.host + '/ws');

      ws.onopen = () => {
        console.log('Connected to signaling server');
        ws.send(JSON.stringify({
          type: 'peer-joined',
          from: '',
          payload: { name: deviceNameInput.value || '未知设备', type: deviceType || 'browser' }
        }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        handleMessage(msg);
      };

      ws.onclose = () => {
        setTimeout(connect, 2000);
      };
    }

    function handleMessage(msg) {
      switch (msg.type) {
        case 'peer-joined':
          if (msg.payload.peerId && !peerId) {
            peerId = msg.payload.peerId;
            console.log('Assigned peerId:', peerId);
          }
          if (msg.payload.peers) {
            msg.payload.peers.forEach(p => {
              if (p.id !== peerId) peers[p.id] = p;
            });
          } else if (msg.payload.peer) {
            peers[msg.payload.peer.id] = msg.payload.peer;
          }
          renderPeers();
          break;
        case 'peer-left':
          delete peers[msg.payload.peerId];
          if (selectedPeer === msg.payload.peerId) selectedPeer = null;
          renderPeers();
          break;
        case 'file-chunk':
          if (msg.payload.fileId && transfers[msg.payload.fileId]) {
            const t = transfers[msg.payload.fileId];
            t.received += (msg.payload.data.length * 0.75);
            t.progress = Math.min((t.received / t.size) * 100, 100);
            updateProgress(t);
          }
          break;
        case 'file-complete':
          if (transfers[msg.payload.fileId]) {
            transfers[msg.payload.fileId].progress = 100;
            transfers[msg.payload.fileId].status = 'completed';
            updateProgress(transfers[msg.payload.fileId]);
          }
          break;
        case 'file-saved':
          if (transfers[msg.payload.fileId]) {
            transfers[msg.payload.fileId].savedPath = msg.payload.savedPath;
            updateProgress(transfers[msg.payload.fileId]);
          }
          break;
      }
    }

    function renderPeers() {
      const list = Object.values(peers);
      if (list.length === 0) {
        emptyPeers.style.display = 'block';
        peerList.innerHTML = '';
        peerList.appendChild(emptyPeers);
        return;
      }
      emptyPeers.style.display = 'none';
      peerList.innerHTML = list.map(p => 
        '<div class="peer-card' + (selectedPeer === p.id ? ' selected' : '') + '" onclick="selectPeer(\\'' + p.id + '\\')">' +
          '<div class="peer-avatar">' +
            '<svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>' +
          '</div>' +
          '<div class="peer-info">' +
            '<div class="peer-name" onclick="event.stopPropagation(); editPeerName(\\'' + p.id + '\\')" title="点击修改名称">' + p.name + '</div>' +
            '<div class="peer-type">' + (p.type === 'desktop' ? '电脑' : p.type === 'tablet' ? '平板' : '手机') + '</div>' +
          '</div>' +
          '<div class="peer-status"></div>' +
        '</div>'
      ).join('');
    }

    function editPeerName(id) {
      const peer = peers[id];
      if (!peer) return;
      const newName = prompt('修改设备名称：', peer.name);
      if (newName && newName.trim()) {
        peer.name = newName.trim();
        renderPeers();
      }
    }

    function selectPeer(id) {
      selectedPeer = selectedPeer === id ? null : id;
      renderPeers();
    }

    function sendFile(file) {
      if (!selectedPeer) {
        alert('请先选择一个目标设备');
        return;
      }

      const fileId = Date.now().toString();
      const transfer = {
        id: fileId,
        name: file.name,
        size: file.size,
        progress: 0,
        status: 'transferring',
        received: 0
      };
      transfers[fileId] = transfer;
      addTransferItem(transfer);

      ws.send(JSON.stringify({
        type: 'file-meta',
        from: peerId,
        to: selectedPeer,
        payload: { id: fileId, name: file.name, size: file.size, type: file.type }
      }));

      const chunkSize = 16384;
      let offset = 0;
      const reader = new FileReader();

      function readNextChunk() {
        if (offset >= file.size) {
          ws.send(JSON.stringify({
            type: 'file-complete',
            from: peerId,
            to: selectedPeer,
            payload: { fileId }
          }));
          transfer.status = 'completed';
          updateProgress(transfer);
          return;
        }

        const chunk = file.slice(offset, offset + chunkSize);
        reader.onload = (e) => {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(e.target.result)));
          ws.send(JSON.stringify({
            type: 'file-chunk',
            from: peerId,
            to: selectedPeer,
            payload: { fileId, data: base64 }
          }));
          offset += chunkSize;
          transfer.received = offset;
          transfer.progress = Math.min((offset / file.size) * 100, 100);
          updateProgress(transfer);
          setTimeout(readNextChunk, 10);
        };
        reader.readAsArrayBuffer(chunk);
      }

      readNextChunk();
    }

    function addTransferItem(transfer) {
      transfersSection.style.display = 'block';
      const div = document.createElement('div');
      div.className = 'transfer-item';
      div.id = 'transfer-' + transfer.id;
      div.innerHTML = 
        '<div class="transfer-header">' +
          '<div class="transfer-icon transferring" id="icon-' + transfer.id + '">' +
            '<svg viewBox="0 0 24 24"><path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z"/></svg>' +
          '</div>' +
          '<div class="transfer-info">' +
            '<div class="transfer-name">' + transfer.name + '</div>' +
            '<div class="transfer-size">' + formatFileSize(transfer.size) + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="transfer-progress-bar">' +
          '<div class="transfer-progress-fill" id="progress-' + transfer.id + '" style="width:0%"></div>' +
        '</div>' +
        '<div class="transfer-status" id="status-' + transfer.id + '">准备传输...</div>';
      transferList.insertBefore(div, transferList.firstChild);
    }

    function updateProgress(transfer) {
      const progressEl = document.getElementById('progress-' + transfer.id);
      const statusEl = document.getElementById('status-' + transfer.id);
      const iconEl = document.getElementById('icon-' + transfer.id);
      
      if (!progressEl || !statusEl) return;
      
      progressEl.style.width = transfer.progress + '%';
      
      if (transfer.status === 'completed') {
        statusEl.className = 'transfer-status success';
        const savedPath = transfer.savedPath || '';
        if (savedPath) {
          statusEl.innerHTML = '传输完成 · 已保存至: ' + savedPath.replace(/\\/g, '\\\\') + 
            ' <button onclick="copyPath(\\'' + savedPath.replace(/\\/g, '\\\\') + '\\')" style="margin-left:8px;padding:2px 8px;font-size:11px;border:1px solid var(--border-color);border-radius:4px;background:var(--card-bg);color:var(--text-secondary);cursor:pointer;">复制路径</button>';
        } else {
          statusEl.textContent = '传输完成';
        }
        if (iconEl) {
          iconEl.className = 'transfer-icon completed';
          iconEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
        }
      } else if (transfer.status === 'error') {
        statusEl.className = 'transfer-status error';
        statusEl.textContent = '传输失败';
        if (iconEl) {
          iconEl.className = 'transfer-icon error';
          iconEl.innerHTML = '<svg viewBox="0 0 24 24"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z"/></svg>';
        }
      } else {
        statusEl.textContent = Math.round(transfer.progress) + '%';
      }
    }

    function formatFileSize(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
      return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
    }

    function copyPath(path) {
      navigator.clipboard.writeText(path).then(() => {
        alert('路径已复制到剪贴板');
      }).catch(() => {
        const input = document.createElement('input');
        input.value = path;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        alert('路径已复制到剪贴板');
      });
    }

    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('dragover'));
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      Array.from(e.dataTransfer.files).forEach(sendFile);
    });
    fileInput.addEventListener('change', () => {
      Array.from(fileInput.files).forEach(sendFile);
      fileInput.value = '';
    });

    connect();
  </script>
</body>
</html>`;
  }
}
