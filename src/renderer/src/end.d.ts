/// <reference types="vite/client" />

declare global {
  interface Window {
    fileAPI: {
      selectFolder: () => Promise<{ success: boolean; path?: string }>;
      selectFile: (extensions?: string[]) => Promise<{ success: boolean; path?: string }>;
      selectFiles: (extensions?: string[]) => Promise<{ success: boolean; filePaths?: string[] }>;
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
    };
  }
}

export {};
