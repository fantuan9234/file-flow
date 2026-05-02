import { contextBridge, ipcRenderer } from 'electron';
import path from 'path';
import { IPC_CHANNELS } from '../shared/ipc-channels';

contextBridge.exposeInMainWorld('fileAPI', {
  selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.SELECT_FOLDER),
  scanFiles: (folderPath: string) => ipcRenderer.invoke(IPC_CHANNELS.SCAN_FILES, folderPath),
  renameFiles: (ops: { oldPath: string; newPath: string }[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXECUTE_RENAME, ops),
  undoRename: () => ipcRenderer.invoke(IPC_CHANNELS.UNDO_RENAME),
  selectFile: (extensions?: string[]) => ipcRenderer.invoke(IPC_CHANNELS.SELECT_FILE, extensions) as Promise<{ success: boolean; path?: string }>,
  openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.OPEN_EXTERNAL, url),
  selectFiles: (extensions?: string[]) => ipcRenderer.invoke(IPC_CHANNELS.SELECT_FILES, extensions) as Promise<{ success: boolean; filePaths?: string[] }>,
  convertFile: (params: { sourcePath: string | string[]; sourceType: string; targetType: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.CONVERT_FILE, params),
  executeWorkflow: (params: { folderPath: string; steps: any[]; keepOriginal: boolean }) =>
    ipcRenderer.invoke(IPC_CHANNELS.EXECUTE_WORKFLOW, params),
  undoWorkflow: () => ipcRenderer.invoke(IPC_CHANNELS.UNDO_WORKFLOW),
  saveDialog: (defaultFileName?: string) => ipcRenderer.invoke(IPC_CHANNELS.SAVE_DIALOG, defaultFileName),
  openDialogJson: () => ipcRenderer.invoke(IPC_CHANNELS.OPEN_DIALOG_JSON),
  readFile: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.READ_FILE, filePath),
  writeFile: (filePath: string, content: string) => ipcRenderer.invoke(IPC_CHANNELS.WRITE_FILE, filePath, content),
  windowMinimize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MINIMIZE),
  windowMaximize: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_MAXIMIZE),
  windowClose: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  windowIsMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_IS_MAXIMIZED),
  classifyFiles: (ops: { oldPath: string; newPath: string }[]) => ipcRenderer.invoke(IPC_CHANNELS.EXECUTE_CLASSIFY, ops),
  undoClassify: () => ipcRenderer.invoke(IPC_CHANNELS.UNDO_CLASSIFY),
  checkForUpdates: () => ipcRenderer.invoke(IPC_CHANNELS.CHECK_FOR_UPDATES),
  findExactDuplicates: (files: { path: string; name: string; size: number; mtime: string }[]) =>
    ipcRenderer.invoke(IPC_CHANNELS.FIND_EXACT_DUPLICATES, files),
  findSimilarDuplicates: (files: { path: string; name: string; size: number; mtime: string }[], threshold: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.FIND_SIMILAR_DUPLICATES, files, threshold),
  deleteFiles: (filePaths: string[]) => ipcRenderer.invoke(IPC_CHANNELS.DELETE_FILES, filePaths),
  moveFiles: (filePaths: string[], targetDir: string) => ipcRenderer.invoke(IPC_CHANNELS.MOVE_FILES, filePaths, targetDir),
  classifyContent: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.CLASSIFY_CONTENT, text),
  ollamaCheckStatus: () => ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_CHECK_STATUS),
  ollamaClassify: (text: string, model: string) => ipcRenderer.invoke(IPC_CHANNELS.OLLAMA_CLASSIFY, text, model),
  apiKeySet: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.API_KEY_SET, key),
  apiKeyGet: () => ipcRenderer.invoke(IPC_CHANNELS.API_KEY_GET),
  apiKeySave: (key: string) => ipcRenderer.invoke(IPC_CHANNELS.API_KEY_SAVE, key),
  hybridExtractText: (filePath: string, languages: string) => ipcRenderer.invoke(IPC_CHANNELS.HYBRID_EXTRACT_TEXT, filePath, languages),
  extractText: (filePath: string, languages: string) => ipcRenderer.invoke(IPC_CHANNELS.EXTRACT_TEXT, filePath, languages),
  paddleExtractText: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.PADDLE_EXTRACT_TEXT, filePath),
  getPaddleOCRStatus: () => ipcRenderer.invoke(IPC_CHANNELS.PADDLE_OCR_STATUS),
  openPaddleOCRLog: () => ipcRenderer.invoke(IPC_CHANNELS.PADDLE_OCR_OPEN_LOG),
  onPaddleOCRStatusChange: (callback: (data: { status: string; errorLogPath?: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.PADDLE_OCR_STATUS_CHANGED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.PADDLE_OCR_STATUS_CHANGED, listener);
  },
  onAskCreateFolder: (callback: (folders: { dir: string; count: number }[]) => void) => {
    const listener = (_event: any, folders: any) => callback(folders);
    ipcRenderer.on(IPC_CHANNELS.ASK_CREATE_FOLDER, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.ASK_CREATE_FOLDER, listener);
  },
  sendCreateFolderResponse: (selectedDirs: string[]) => {
    ipcRenderer.send(IPC_CHANNELS.CREATE_FOLDER_RESPONSE, selectedDirs);
  },
  searchFiles: (params: { files: any[]; query: string; provider: 'ollama' | 'openai'; apiKey: string; model: string; endpoint: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.SEARCH_FILES, params),
  describeImage: (params: { imagePath: string; provider: 'ollama' | 'openai'; apiKey: string; model: string; endpoint: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.DESCRIBE_IMAGE, params),
  testAiConnection: (endpoint: string, provider: 'ollama' | 'lmstudio') => ipcRenderer.invoke(IPC_CHANNELS.TEST_AI_CONNECTION, endpoint, provider),
  aiClassify: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.AI_CLASSIFY, text),
  startLanServer: (uploadDir: string) => ipcRenderer.invoke(IPC_CHANNELS.LAN_START_SERVER, uploadDir),
  stopLanServer: () => ipcRenderer.invoke(IPC_CHANNELS.LAN_STOP_SERVER),
  onLanServerStarted: (callback: (data: { url: string; qrCode: string; port: number; ip: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.LAN_SERVER_STARTED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LAN_SERVER_STARTED, listener);
  },
  onLanServerStopped: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(IPC_CHANNELS.LAN_SERVER_STOPPED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LAN_SERVER_STOPPED, listener);
  },
  onLanFileReceived: (callback: (filename: string) => void) => {
    const listener = (_event: any, filename: string) => callback(filename);
    ipcRenderer.on(IPC_CHANNELS.LAN_FILE_RECEIVED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.LAN_FILE_RECEIVED, listener);
  },
  startP2PServer: (uploadDir: string) => ipcRenderer.invoke(IPC_CHANNELS.P2P_START_SERVER, uploadDir),
  stopP2PServer: () => ipcRenderer.invoke(IPC_CHANNELS.P2P_STOP_SERVER),
  selectP2PReceiveDir: () => ipcRenderer.invoke(IPC_CHANNELS.P2P_SELECT_RECEIVE_DIR),
  getP2PReceiveDir: () => ipcRenderer.invoke(IPC_CHANNELS.P2P_GET_RECEIVE_DIR),
  getP2PPeers: () => ipcRenderer.invoke(IPC_CHANNELS.P2P_GET_PEERS),
  getP2PTransfers: () => ipcRenderer.invoke(IPC_CHANNELS.P2P_GET_TRANSFERS),
  onP2PServerStarted: (callback: (data: { url: string; port: number; ip: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.P2P_SERVER_STARTED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.P2P_SERVER_STARTED, listener);
  },
  onP2PServerStopped: (callback: () => void) => {
    const listener = () => callback();
    ipcRenderer.on(IPC_CHANNELS.P2P_SERVER_STOPPED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.P2P_SERVER_STOPPED, listener);
  },
  onP2PPeerConnected: (callback: (peer: { id: string; name: string; type: string; connectedAt: number }) => void) => {
    const listener = (_event: any, peer: any) => callback(peer);
    ipcRenderer.on(IPC_CHANNELS.P2P_PEER_CONNECTED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.P2P_PEER_CONNECTED, listener);
  },
  onP2PPeerDisconnected: (callback: (data: { peerId: string }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.P2P_PEER_DISCONNECTED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.P2P_PEER_DISCONNECTED, listener);
  },
  onP2PFileReceived: (callback: (file: { id: string; name: string; size: number; type: string; progress: number; status: string; direction: string; peerId: string }) => void) => {
    const listener = (_event: any, file: any) => callback(file);
    ipcRenderer.on(IPC_CHANNELS.P2P_FILE_RECEIVED, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.P2P_FILE_RECEIVED, listener);
  },
  onP2PTransferProgress: (callback: (data: { fileId: string; progress: number }) => void) => {
    const listener = (_event: any, data: any) => callback(data);
    ipcRenderer.on(IPC_CHANNELS.P2P_TRANSFER_PROGRESS, listener);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.P2P_TRANSFER_PROGRESS, listener);
  },
  path: {
    dirname: (p: string) => path.dirname(p),
    basename: (p: string) => path.basename(p),
    join: (...args: string[]) => path.join(...args),
    extname: (p: string) => path.extname(p),
  },
});
