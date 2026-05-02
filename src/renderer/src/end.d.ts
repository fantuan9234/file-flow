/// <reference types="vite/client" />

declare global {
  interface Window {
    electron?: {
      process: {
        versions: {
          node: string;
          chrome: string;
          electron: string;
        };
      };
    };
    fileAPI: {
      selectFolder: () => Promise<{ success: boolean; path?: string }>;
      selectFile: (extensions?: string[]) => Promise<{ success: boolean; path?: string }>;
      selectFiles: (extensions?: string[]) => Promise<{ success: boolean; filePaths?: string[] }>;
      openExternal: (url: string) => Promise<{ success: boolean; error?: string }>;
      scanFiles: (folderPath: string) => Promise<{
        success: boolean;
        data?: { path: string; name: string; size: number; mtime: string }[];
        error?: string;
      }>;
      renameFiles: (ops: { oldPath: string; newPath: string }[]) => Promise<{ success: boolean; error?: string }>;
      undoRename: () => Promise<{ success: boolean; error?: string }>;
      convertFile: (params: { sourcePath: string | string[]; sourceType: string; targetType: string }) => Promise<{ success: boolean; outputPath?: string; error?: string; results?: { sourcePath: string; success: boolean; outputPath?: string; error?: string }[]; successCount?: number; failCount?: number }>;
      executeWorkflow: (params: { folderPath: string; steps: any[]; keepOriginal: boolean }) => Promise<{ success: boolean; data?: any[]; log?: string[]; error?: string }>;
      undoWorkflow: () => Promise<{ success: boolean; error?: string }>;
      saveDialog: (defaultFileName?: string) => Promise<{ success: boolean; filePath?: string }>;
      openDialogJson: () => Promise<{ success: boolean; filePath?: string }>;
      readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
      writeFile: (filePath: string, content: string) => Promise<{ success: boolean; error?: string }>;
      windowMinimize: () => Promise<{ success: boolean }>;
      windowMaximize: () => Promise<{ success: boolean }>;
      windowClose: () => Promise<{ success: boolean }>;
      windowIsMaximized: () => Promise<boolean>;
      classifyFiles: (ops: { oldPath: string; newPath: string }[]) => Promise<{ success: boolean; error?: string }>;
      undoClassify: () => Promise<{ success: boolean; error?: string }>;
      checkForUpdates: () => Promise<{ success: boolean; available?: boolean; version?: string; currentVersion?: string; error?: string }>;
      findExactDuplicates: (files: { path: string; name: string; size: number; mtime: string }[]) => Promise<{ success: boolean; groups?: { hash: string; files: { path: string; name: string; size: number; mtime: string }[] }[]; totalDuplicates?: number; error?: string }>;
      findSimilarDuplicates: (files: { path: string; name: string; size: number; mtime: string }[], threshold: number) => Promise<{ success: boolean; groups?: { similarity: number; files: { path: string; name: string; size: number; mtime: string }[] }[]; totalDuplicates?: number; error?: string }>;
      deleteFiles: (filePaths: string[]) => Promise<{ success: boolean; error?: string }>;
      moveFiles: (filePaths: string[], targetDir: string) => Promise<{ success: boolean; error?: string }>;
      classifyContent: (text: string) => Promise<{ success: boolean; category?: string; confidence?: number; matchedKeywords?: string[]; error?: string }>;
      ollamaCheckStatus: () => Promise<{ running: boolean; models?: string[]; error?: string }>;
      ollamaClassify: (text: string, model: string) => Promise<{ success: boolean; category?: string; confidence?: number; reasoning?: string; error?: string }>;
      apiKeySet: (key: string) => Promise<{ success: boolean; encrypted?: string; error?: string }>;
      apiKeyGet: () => Promise<{ success: boolean; key?: string; error?: string }>;
      apiKeySave: (key: string) => Promise<{ success: boolean; error?: string }>;
      extractText: (filePath: string, languages: string) => Promise<{ success: boolean; text?: string; confidence?: number; error?: string }>;
      paddleExtractText: (filePath: string) => Promise<{ success: boolean; text?: string; confidence?: number; error?: string }>;
      getPaddleOCRStatus: () => Promise<{ status: 'starting' | 'running' | 'stopped' | 'failed'; running: boolean; errorLogPath?: string }>;
      openPaddleOCRLog: () => Promise<{ success: boolean; error?: string }>;
      onPaddleOCRStatusChange: (callback: (data: { status: string; errorLogPath?: string }) => void) => () => void;
      onAskCreateFolder: (callback: (folders: { dir: string; count: number }[]) => void) => () => void;
      sendCreateFolderResponse: (selectedDirs: string[]) => void;
      testAiConnection: (endpoint: string, provider: 'ollama' | 'lmstudio') => Promise<{ success: boolean; models?: string[]; error?: string }>;
      aiClassify: (text: string) => Promise<{ success: boolean; category?: string; rawResponse?: string; error?: string }>;
      startLanServer: (uploadDir: string) => Promise<{ success: boolean; url?: string; qrCode?: string; port?: number; ip?: string; error?: string }>;
      stopLanServer: () => Promise<{ success: boolean; error?: string }>;
      onLanServerStarted: (callback: (data: { url: string; qrCode: string; port: number; ip: string }) => void) => () => void;
      onLanServerStopped: (callback: () => void) => () => void;
      onLanFileReceived: (callback: (filename: string) => void) => () => void;
      startP2PServer: (uploadDir: string) => Promise<{ success: boolean; url?: string; port?: number; ip?: string; receiveDir?: string; error?: string }>;
      stopP2PServer: () => Promise<{ success: boolean; error?: string }>;
      selectP2PReceiveDir: () => Promise<{ success: boolean; dir?: string; error?: string }>;
      getP2PReceiveDir: () => Promise<{ success: boolean; dir?: string; error?: string }>;
      getP2PPeers: () => Promise<{ success: boolean; peers?: Array<{ id: string; name: string; type: string; connectedAt: number }>; error?: string }>;
      getP2PTransfers: () => Promise<{ success: boolean; transfers?: Array<{ id: string; name: string; size: number; type: string; progress: number; status: string; direction: string; peerId: string }>; error?: string }>;
      onP2PServerStarted: (callback: (data: { url: string; port: number; ip: string }) => void) => () => void;
      onP2PServerStopped: (callback: () => void) => () => void;
      onP2PPeerConnected: (callback: (peer: { id: string; name: string; type: string; connectedAt: number }) => void) => () => void;
      onP2PPeerDisconnected: (callback: (data: { peerId: string }) => void) => () => void;
      onP2PFileReceived: (callback: (file: { id: string; name: string; size: number; type: string; progress: number; status: string; direction: string; peerId: string }) => void) => () => void;
      onP2PTransferProgress: (callback: (data: { fileId: string; progress: number }) => void) => () => void;
      path: {
        dirname: (p: string) => string;
        basename: (p: string) => string;
        join: (...args: string[]) => string;
        extname: (p: string) => string;
      };
    };
  }
}

export {};
