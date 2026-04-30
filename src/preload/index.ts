import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('fileAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFiles: (folderPath: string) => ipcRenderer.invoke('scan-files', folderPath),
  renameFiles: (ops: { oldPath: string; newPath: string }[]) =>
    ipcRenderer.invoke('execute-rename', ops),
  undoRename: () => ipcRenderer.invoke('undo-rename'),
  selectFile: (extensions?: string[]) => ipcRenderer.invoke('select-file', extensions) as Promise<{ success: boolean; path?: string }>,
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
});
