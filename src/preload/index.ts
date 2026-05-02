import { contextBridge, ipcRenderer } from 'electron';
import path from 'path';

contextBridge.exposeInMainWorld('fileAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFiles: (folderPath: string) => ipcRenderer.invoke('scan-files', folderPath),
  renameFiles: (ops: { oldPath: string; newPath: string }[]) =>
    ipcRenderer.invoke('execute-rename', ops),
  undoRename: () => ipcRenderer.invoke('undo-rename'),
  selectFile: (extensions?: string[]) => ipcRenderer.invoke('select-file', extensions) as Promise<{ success: boolean; path?: string }>,
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),
  selectFiles: (extensions?: string[]) => ipcRenderer.invoke('select-files', extensions) as Promise<{ success: boolean; filePaths?: string[] }>,
  convertFile: (params: { sourcePath: string | string[]; sourceType: string; targetType: string }) =>
    ipcRenderer.invoke('convert-file', params),
  executeWorkflow: (params: { folderPath: string; steps: any[]; keepOriginal: boolean }) =>
    ipcRenderer.invoke('execute-workflow', params),
  undoWorkflow: () => ipcRenderer.invoke('undo-workflow'),
  saveDialog: (defaultFileName?: string) => ipcRenderer.invoke('save-dialog', defaultFileName),
  openDialogJson: () => ipcRenderer.invoke('open-dialog-json'),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke('write-file', filePath, content),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  windowIsMaximized: () => ipcRenderer.invoke('window-is-maximized'),
  classifyFiles: (ops: { oldPath: string; newPath: string }[]) => ipcRenderer.invoke('execute-classify', ops),
  undoClassify: () => ipcRenderer.invoke('undo-classify'),
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  findExactDuplicates: (files: { path: string; name: string; size: number; mtime: string }[]) =>
    ipcRenderer.invoke('find-exact-duplicates', files),
  findSimilarDuplicates: (files: { path: string; name: string; size: number; mtime: string }[], threshold: number) =>
    ipcRenderer.invoke('find-similar-duplicates', files, threshold),
  deleteFiles: (filePaths: string[]) => ipcRenderer.invoke('delete-files', filePaths),
  moveFiles: (filePaths: string[], targetDir: string) => ipcRenderer.invoke('move-files', filePaths, targetDir),
  classifyContent: (text: string) => ipcRenderer.invoke('classify-content', text),
  ollamaCheckStatus: () => ipcRenderer.invoke('ollama-check-status'),
  ollamaClassify: (text: string, model: string) => ipcRenderer.invoke('ollama-classify', text, model),
  apiKeySet: (key: string) => ipcRenderer.invoke('api-key-set', key),
  apiKeyGet: () => ipcRenderer.invoke('api-key-get'),
  apiKeySave: (key: string) => ipcRenderer.invoke('api-key-save', key),
  extractText: (filePath: string, languages: string) => ipcRenderer.invoke('extract-text', filePath, languages),
  paddleExtractText: (filePath: string) => ipcRenderer.invoke('paddle-extract-text', filePath),
  getPaddleOCRStatus: () => ipcRenderer.invoke('paddle-ocr-status'),
  openPaddleOCRLog: () => ipcRenderer.invoke('paddle-ocr-open-log'),
  onPaddleOCRStatusChange: (callback: (data: { status: string; errorLogPath?: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('paddleocr-status-changed', listener);
    return () => ipcRenderer.removeListener('paddleocr-status-changed', listener);
  },
  onAskCreateFolder: (callback: (folders: { dir: string; count: number }[]) => void) => {
    const listener = (_event: any, folders: any) => callback(folders);
    ipcRenderer.on('ask-create-folder', listener);
    return () => ipcRenderer.removeListener('ask-create-folder', listener);
  },
  sendCreateFolderResponse: (selectedDirs: string[]) => {
    ipcRenderer.send('create-folder-response', selectedDirs);
  },
  testAiConnection: (endpoint: string, provider: 'ollama' | 'lmstudio') => ipcRenderer.invoke('test-ai-connection', endpoint, provider),
  aiClassify: (text: string) => ipcRenderer.invoke('ai-classify', text),
  startLanServer: (uploadDir: string) => ipcRenderer.invoke('lan-start-server', uploadDir),
  stopLanServer: () => ipcRenderer.invoke('lan-stop-server'),
  onLanServerStarted: (callback: (data: { url: string; qrCode: string; port: number; ip: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('lan-server-started', listener);
    return () => ipcRenderer.removeListener('lan-server-started', listener);
  },
  onLanServerStopped: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('lan-server-stopped', listener);
    return () => ipcRenderer.removeListener('lan-server-stopped', listener);
  },
  onLanFileReceived: (callback: (filename: string) => void) => {
    const listener = (_event: any, filename: string) => callback(filename);
    ipcRenderer.on('lan-file-received', listener);
    return () => ipcRenderer.removeListener('lan-file-received', listener);
  },
  startP2PServer: (uploadDir: string) => ipcRenderer.invoke('p2p-start-server', uploadDir),
  stopP2PServer: () => ipcRenderer.invoke('p2p-stop-server'),
  selectP2PReceiveDir: () => ipcRenderer.invoke('p2p-select-receive-dir'),
  getP2PReceiveDir: () => ipcRenderer.invoke('p2p-get-receive-dir'),
  getP2PPeers: () => ipcRenderer.invoke('p2p-get-peers'),
  getP2PTransfers: () => ipcRenderer.invoke('p2p-get-transfers'),
  onP2PServerStarted: (callback: (data: { url: string; port: number; ip: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('p2p-server-started', listener);
    return () => ipcRenderer.removeListener('p2p-server-started', listener);
  },
  onP2PServerStopped: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on('p2p-server-stopped', listener);
    return () => ipcRenderer.removeListener('p2p-server-stopped', listener);
  },
  onP2PPeerConnected: (callback: (peer: { id: string; name: string; type: string; connectedAt: number }) => void) => {
    const listener = (_event: any, peer: any) => callback(peer);
    ipcRenderer.on('p2p-peer-connected', listener);
    return () => ipcRenderer.removeListener('p2p-peer-connected', listener);
  },
  onP2PPeerDisconnected: (callback: (data: { peerId: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('p2p-peer-disconnected', listener);
    return () => ipcRenderer.removeListener('p2p-peer-disconnected', listener);
  },
  onP2PFileReceived: (callback: (file: { id: string; name: string; size: number; type: string; progress: number; status: string; direction: string; peerId: string }) => void) => {
    const listener = (_event: any, file: any) => callback(file);
    ipcRenderer.on('p2p-file-received', listener);
    return () => ipcRenderer.removeListener('p2p-file-received', listener);
  },
  onP2PTransferProgress: (callback: (data: { fileId: string; progress: number }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on('p2p-transfer-progress', listener);
    return () => ipcRenderer.removeListener('p2p-transfer-progress', listener);
  },
  path: {
    dirname: (p: string) => path.dirname(p),
    basename: (p: string) => path.basename(p),
    join: (...args: string[]) => path.join(...args),
    extname: (p: string) => path.extname(p),
  },
});
