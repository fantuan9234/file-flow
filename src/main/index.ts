import { app, BrowserWindow, ipcMain, dialog, Menu, shell, safeStorage } from 'electron';
import { join } from 'path';
import fs from 'fs';
import path from 'path';
import { net } from 'electron';
import { createHash } from 'crypto';
import { createServer, IncomingMessage, ServerResponse } from 'http';
import { networkInterfaces, platform } from 'os';
import QRCode from 'qrcode';
import { LanShareManager } from './LanShareManager';
import WebSocket from 'ws';

let mainWindow: BrowserWindow | null = null;

const TIMEOUT = 5000;

// ==================== PaddleOCR-json OCR Engine ====================
/**
 * OCR 引擎：PaddleOCR (via PaddleOCR-json)
 * 项目地址：https://github.com/hiroi-sora/PaddleOCR-json
 * 许可协议：Apache License 2.0
 * 零环境依赖部署方案，无需安装 Python 或 Conda。
 */

import { spawn, ChildProcess } from 'child_process';

let paddleOCRStatus: 'starting' | 'running' | 'stopped' | 'failed' = 'starting';
let paddleOCRErrorLogPath = '';
let ocrProcess: ChildProcess | null = null;
let ocrInitPromise: Promise<void> | null = null;
let stdoutBuffer = '';

interface OCRResult {
  code: number;
  data: Array<{
    box: [[number, number], [number, number], [number, number], [number, number]];
    score: number;
    text: string;
  }> | null;
}

function getPaddleOCRJsonExePath(): string {
  const baseDir = app.isPackaged
    ? path.join(process.resourcesPath, 'paddleocr-json')
    : path.join(app.getAppPath(), 'paddleocr-json');

  const exeName = process.platform === 'win32' ? 'PaddleOCR-json.exe' : 'PaddleOCR-json';
  const exePath = path.join(baseDir, exeName);

  if (fs.existsSync(exePath)) {
    return exePath;
  }

  if (fs.existsSync(baseDir)) {
    const files = fs.readdirSync(baseDir);
    const match = files.find(f => f.startsWith('PaddleOCR-json') && f.endsWith('.exe'));
    if (match) {
      return path.join(baseDir, match);
    }
  }

  return '';
}

function getErrorLogPath(): string {
  const logsDir = path.join(app.getPath('userData'), 'logs');
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  const logPath = path.join(logsDir, 'paddleocr_error.log');
  paddleOCRErrorLogPath = logPath;
  return logPath;
}

function appendErrorLog(message: string): void {
  const logPath = getErrorLogPath();
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] ${message}\n`;
  fs.appendFileSync(logPath, logEntry, 'utf-8');
  console.error('[PaddleOCR]', message);
}

function notifyRendererStatus(status: 'starting' | 'running' | 'stopped' | 'failed') {
  paddleOCRStatus = status;
  if (mainWindow) {
    mainWindow.webContents.send('paddleocr-status-changed', {
      status,
      errorLogPath: paddleOCRErrorLogPath,
    });
  }
}

/**
 * 初始化 PaddleOCR-json 子进程
 * 使用匿名管道模式（stdin/stdout）通信
 */
async function initPaddleOCRJson(): Promise<void> {
  if (ocrInitPromise) {
    return ocrInitPromise;
  }

  ocrInitPromise = (async () => {
    const exePath = getPaddleOCRJsonExePath();
    if (!exePath) {
      const msg = 'PaddleOCR-json executable not found. Please download from https://github.com/hiroi-sora/PaddleOCR-json/releases';
      console.log('[PaddleOCR]', msg);
      appendErrorLog(msg);
      notifyRendererStatus('failed');
      return;
    }

    const baseDir = path.dirname(exePath);
    const modelsDir = path.join(baseDir, 'models');
    if (!fs.existsSync(modelsDir)) {
      const msg = `Models directory not found: ${modelsDir}`;
      console.log('[PaddleOCR]', msg);
      appendErrorLog(msg);
      notifyRendererStatus('failed');
      return;
    }

    console.log('[PaddleOCR] Initializing PaddleOCR-json...');
    console.log('[PaddleOCR] Executable:', exePath);
    console.log('[PaddleOCR] Models:', modelsDir);
    console.log('[PaddleOCR] Working directory:', baseDir);

    const maxRetries = 15;
    const retryInterval = 2000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        notifyRendererStatus('starting');
        console.log(`[PaddleOCR] Init attempt ${attempt}/${maxRetries}...`);

        stdoutBuffer = '';

        ocrProcess = spawn(exePath, [], {
          cwd: baseDir,
          stdio: ['pipe', 'pipe', 'pipe'],
          windowsHide: true,
        });

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('OCR initialization timeout after 30s'));
          }, 30000);

          ocrProcess!.stdout!.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            stdoutBuffer += text;
            console.log('[PaddleOCR] stdout:', text.trim());

            if (text.includes('OCR init completed')) {
              clearTimeout(timeout);
              resolve();
            }
          });

          ocrProcess!.stderr!.on('data', (chunk: Buffer) => {
            const text = chunk.toString();
            console.error('[PaddleOCR] stderr:', text.trim());
            appendErrorLog(`stderr: ${text.trim()}`);
          });

          ocrProcess!.on('error', (err: Error) => {
            clearTimeout(timeout);
            reject(err);
          });

          ocrProcess!.on('exit', (code: number | null) => {
            clearTimeout(timeout);
            reject(new Error(`OCR process exited with code ${code}`));
          });
        });

        console.log('[PaddleOCR] PaddleOCR-json initialized successfully (pipe mode)');
        if (!ocrResponseListenerSetup) {
          setupOCRResponseListener();
          ocrResponseListenerSetup = true;
        }
        notifyRendererStatus('running');
        return;
      } catch (err: any) {
        console.log(`[PaddleOCR] Attempt ${attempt} failed:`, err.message);
        appendErrorLog(`Init attempt ${attempt} failed: ${err.message}`);

        if (ocrProcess) {
          try { ocrProcess.kill(); } catch { /* ignore */ }
          ocrProcess = null;
        }

        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, retryInterval));
        }
      }
    }

    const msg = 'PaddleOCR 服务启动失败，请检查 paddleocr-json 目录是否完整';
    console.log('[PaddleOCR]', msg);
    appendErrorLog(msg);
    notifyRendererStatus('failed');
  })();

  return ocrInitPromise;
}

/**
 * 确保 OCR 子进程可用
 */
async function ensureOCRProcess(): Promise<void> {
  if (ocrProcess && paddleOCRStatus === 'running') {
    return;
  }

  await initPaddleOCRJson();

  if (!ocrProcess || paddleOCRStatus !== 'running') {
    throw new Error('PaddleOCR-json not available. Please check logs.');
  }
}

interface OCRRequest {
  imagePath: string;
  resolve: (result: { text: string; confidence: number }) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

let ocrRequestQueue: OCRRequest[] = [];
let isProcessingQueue = false;
let ocrResponseBuffer = '';

function setupOCRResponseListener(): void {
  if (!ocrProcess || !ocrProcess.stdout) return;

  ocrProcess.stdout.on('data', (chunk: Buffer) => {
    ocrResponseBuffer += chunk.toString();

    const lines = ocrResponseBuffer.split('\n');
    ocrResponseBuffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || ocrRequestQueue.length === 0) continue;

      try {
        const result: OCRResult = JSON.parse(trimmed);
        const currentRequest = ocrRequestQueue.shift();
        if (!currentRequest) continue;

        clearTimeout(currentRequest.timeout);

        if (result.code === 100 && result.data) {
          let extractedText = '';
          let totalConfidence = 0;

          for (const item of result.data) {
            if (item.text) {
              extractedText += item.text + '\n';
              totalConfidence += item.score || 0;
            }
          }

          extractedText = extractedText.trim();
          const avgConfidence = result.data.length > 0
            ? (totalConfidence / result.data.length) * 100
            : 0;

          currentRequest.resolve({ text: extractedText, confidence: avgConfidence });
        } else {
          currentRequest.resolve({ text: '', confidence: 0 });
        }

        isProcessingQueue = false;
        processOCRQueue();
      } catch (parseErr: any) {
        console.error('[PaddleOCR] Failed to parse response:', trimmed, parseErr);
      }
    }
  });

  ocrProcess.stderr?.on('data', (chunk: Buffer) => {
    console.error('[PaddleOCR] stderr:', chunk.toString().trim());
  });
}

function processOCRQueue(): void {
  if (isProcessingQueue || ocrRequestQueue.length === 0 || !ocrProcess || !ocrProcess.stdin) return;

  isProcessingQueue = true;
  const request = ocrRequestQueue[0];

  const jsonRequest = JSON.stringify({ image_path: request.imagePath }) + '\n';
  console.log('[PaddleOCR] Sending request:', jsonRequest.trim());

  ocrProcess.stdin.write(jsonRequest, (writeErr) => {
    if (writeErr) {
      isProcessingQueue = false;
      const failedRequest = ocrRequestQueue.shift();
      if (failedRequest) {
        clearTimeout(failedRequest.timeout);
        failedRequest.reject(writeErr);
      }
      processOCRQueue();
    }
  });
}

async function performOCR(imagePath: string): Promise<{ text: string; confidence: number }> {
  await ensureOCRProcess();

  if (!ocrProcess || !ocrProcess.stdin || !ocrProcess.stdout) {
    throw new Error('OCR process not available');
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const index = ocrRequestQueue.findIndex(r => r.timeout === timeout);
      if (index !== -1) {
        const request = ocrRequestQueue.splice(index, 1)[0];
        if (index === 0) {
          isProcessingQueue = false;
        }
        request.reject(new Error('OCR recognition timeout after 60s'));
        processOCRQueue();
      }
    }, 60000);

    ocrRequestQueue.push({ imagePath, resolve, reject, timeout });
    processOCRQueue();
  });
}

let ocrResponseListenerSetup = false;

// 应用退出时清理 OCR 进程
app.on('before-quit', () => {
  if (ocrProcess) {
    console.log('[PaddleOCR] Cleaning up OCR process...');
    try { ocrProcess.kill(); } catch { /* ignore */ }
    ocrProcess = null;
  }
});

function compareVersions(a: string, b: string): number {
  const aParts = a.replace(/^v/, '').split('.').map(Number);
  const bParts = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    const aVal = aParts[i] || 0;
    const bVal = bParts[i] || 0;
    if (aVal > bVal) return 1;
    if (aVal < bVal) return -1;
  }
  return 0;
}

function checkForNewVersion(): void {
  if (!app.isPackaged || !mainWindow) {
    console.log('[startup] Skipping update check: not packaged or no window');
    return;
  }

  console.log('[startup] Checking for updates...');
  const currentVersion = app.getVersion();
  const request = net.request('https://api.github.com/repos/fantuan9234/file-flow/releases/latest');
  request.setHeader('Accept', 'application/vnd.github.v3+json');

  let resolved = false;

  const timeout = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      console.log('[startup] Update check timed out');
      request.abort();
    }
  }, TIMEOUT);

  request.on('response', (response) => {
    let data = '';
    response.on('data', (chunk) => {
      data += chunk;
    });
    response.on('end', () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timeout);
      try {
        const release = JSON.parse(data);
        const latestVersion = release.tag_name;
        if (compareVersions(latestVersion, currentVersion) > 0) {
          console.log('[startup] New version available:', latestVersion);
          dialog.showMessageBox(mainWindow!, {
            type: 'info',
            title: '发现新版本',
            message: `发现新版本 ${latestVersion}`,
            detail: `你当前使用的是 v${currentVersion}，是否前往下载最新版本？`,
            buttons: ['稍后提醒', '立即下载'],
            defaultId: 1,
            cancelId: 0,
          }).then((result) => {
            if (result.response === 1) {
              shell.openExternal('https://github.com/fantuan9234/file-flow/releases/latest');
            }
          });
        } else {
          console.log('[startup] Already up to date:', currentVersion);
        }
      } catch {
        console.log('[startup] Failed to parse release info');
      }
    });
  });

  request.on('error', (err) => {
    if (resolved) return;
    resolved = true;
    clearTimeout(timeout);
    console.log('[startup] Update check failed:', err.message);
  });

  request.end();
}

function createWindow() {
  app.setAppUserModelId('com.fantuan9234.fileflow');
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: false,
    autoHideMenuBar: true,
    icon: join(__dirname, '../../build/fileflow-icon.png'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true,
    },
  });

  Menu.setApplicationMenu(null);

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription) => {
    console.error('[main] Page failed to load:', errorCode, errorDescription);
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(async () => {
  app.setAppUserModelId('com.fantuan9234.fileflow');
  console.log('[startup] app.whenReady() triggered');
  try {
    console.log('[startup] Creating main window...');
    createWindow();
    console.log('[startup] Window created successfully');

    mainWindow?.webContents.on('did-finish-load', () => {
      console.log('[startup] Page finished loading, initializing PaddleOCR-json...');
      initPaddleOCRJson();
    });

    console.log('[startup] Scheduling update check in 3s...');
    setTimeout(() => {
      try {
        checkForNewVersion();
      } catch (err) {
        console.log('[startup] Update check failed (non-blocking):', err);
      }
    }, 3000);

    console.log('[startup] App ready, all initialization complete');
  } catch (error) {
    console.error('[startup] FATAL: Failed to initialize app:', error);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

function scanFiles(dir: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (!file.startsWith('.') && file !== 'node_modules') {
        arrayOfFiles = scanFiles(filePath, arrayOfFiles);
      }
    } else {
      arrayOfFiles.push(filePath);
    }
  });
  return arrayOfFiles;
}

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }
  return { success: true, path: result.filePaths[0] };
});

ipcMain.handle('open-external', async (_, url: string) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('scan-files', async (_, folderPath: string) => {
  try {
    const files = scanFiles(folderPath);
    const filesInfo = files.map((f) => ({
      path: f,
      name: path.basename(f),
      size: fs.statSync(f).size,
      mtime: fs.statSync(f).mtime,
    }));
    return { success: true, data: filesInfo };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

let lastRenameOps: { oldPath: string; newPath: string }[] = [];

ipcMain.handle('execute-rename', async (_, ops: { oldPath: string; newPath: string }[]) => {
  try {
    lastRenameOps = [];
    for (const op of ops) {
      fs.renameSync(op.oldPath, op.newPath);
      lastRenameOps.push({ oldPath: op.newPath, newPath: op.oldPath });
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('undo-rename', async () => {
  try {
    if (lastRenameOps.length === 0) {
      return { success: false, error: 'No operations to undo' };
    }
    for (const op of lastRenameOps) {
      fs.renameSync(op.oldPath, op.newPath);
    }
    lastRenameOps = [];
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('select-file', async (_, extensions: string[] = ['*']) => {
  const filters: { name: string; extensions: string[] }[] = [];

  if (extensions.includes('*') || extensions.length === 0) {
    filters.push({ name: 'All Files', extensions: ['*'] });
  } else {
    filters.push({ name: 'Files', extensions });
    filters.push({ name: 'All Files', extensions: ['*'] });
  }

  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters,
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }
  return { success: true, path: result.filePaths[0] };
});

ipcMain.handle('select-files', async (_, extensions: string[] = ['*']) => {
  const filters: { name: string; extensions: string[] }[] = [];

  if (extensions.includes('*') || extensions.length === 0) {
    filters.push({ name: 'All Files', extensions: ['*'] });
  } else {
    filters.push({ name: 'Files', extensions });
    filters.push({ name: 'All Files', extensions: ['*'] });
  }

  const result = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections'],
    filters,
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }
  return { success: true, filePaths: result.filePaths };
});

async function convertSingleFile(sourcePath: string, sourceType: string, targetType: string): Promise<{ success: boolean; outputPath?: string; error?: string }> {
  const logPrefix = `[convert-file ${sourceType}->${targetType}]`;
  console.log(logPrefix, 'Starting conversion, source file:', sourcePath);

  try {
    if (!fs.existsSync(sourcePath)) {
      console.error(logPrefix, 'File does not exist:', sourcePath);
      return { success: false, error: 'File not found: ' + sourcePath };
    }

    const dir = path.dirname(sourcePath);
    const baseName = path.basename(sourcePath, path.extname(sourcePath));
    const outputPath = path.join(dir, baseName + '.' + targetType.replace('.', ''));

    if (fs.existsSync(outputPath)) {
      console.warn(logPrefix, 'Output file already exists, will be overwritten:', outputPath);
    }

    switch (sourceType + '->' + targetType) {
      case '.docx->.md': {
        const mammoth = require('mammoth');
        const buffer = fs.readFileSync(sourcePath);
        const result = await mammoth.convertToMarkdown({ buffer });
        if (result.messages && result.messages.length > 0) {
          console.warn(logPrefix, 'Conversion warnings:', JSON.stringify(result.messages));
        }
        fs.writeFileSync(outputPath, result.value, 'utf-8');
        break;
      }

      case '.md->.html': {
        const { marked } = require('marked');
        const mdContent = fs.readFileSync(sourcePath, 'utf-8');
        const htmlContent = marked.parse(mdContent);
        const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${baseName}</title>
<style>
body { max-width: 800px; margin: 40px auto; padding: 0 20px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; }
code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
pre { background: #f4f4f4; padding: 16px; border-radius: 5px; overflow-x: auto; }
blockquote { border-left: 4px solid #ddd; margin: 0; padding: 0 16px; color: #666; }
table { border-collapse: collapse; width: 100%; }
th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
th { background: #f4f4f4; }
</style>
</head>
<body>
${htmlContent}
</body>
</html>`;
        fs.writeFileSync(outputPath, fullHtml, 'utf-8');
        break;
      }

      case '.md->.pdf': {
        const { mdToPdf } = require('md-to-pdf');
        const mdContent = fs.readFileSync(sourcePath, 'utf-8');
        await mdToPdf({ content: mdContent }, {
          dest: outputPath,
          pdf_options: {
            format: 'A4',
            margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
          },
        });
        break;
      }

      case '.html->.md': {
        const TurndownService = require('turndown');
        const turndownService = new TurndownService();
        const htmlContent = fs.readFileSync(sourcePath, 'utf-8');
        const mdContent = turndownService.turndown(htmlContent);
        fs.writeFileSync(outputPath, mdContent, 'utf-8');
        break;
      }

      case '.jpg->.png':
      case '.jpeg->.png': {
        const sharp = require('sharp');
        await sharp(sourcePath).png().toFile(outputPath);
        break;
      }

      case '.png->.jpg':
      case '.png->.jpeg': {
        const sharp = require('sharp');
        await sharp(sourcePath).jpeg({ quality: 90 }).toFile(outputPath);
        break;
      }

      default:
        console.error(logPrefix, 'Unsupported conversion type:', sourceType, '->', targetType);
        return { success: false, error: `Unsupported conversion: ${sourceType} -> ${targetType}` };
    }

    console.log(logPrefix, 'Conversion completed successfully, output file:', outputPath);
    return { success: true, outputPath };
  } catch (error: any) {
    console.error(logPrefix, 'Conversion failed:', error);
    return { success: false, error: error?.message || String(error) };
  }
}

ipcMain.handle('convert-file', async (_, params: { sourcePath: string | string[]; sourceType: string; targetType: string }) => {
  const { sourcePath, sourceType, targetType } = params;

  if (Array.isArray(sourcePath)) {
    console.log(`[convert-file ${sourceType}->${targetType}]`, 'Batch conversion, file count:', sourcePath.length);
    const results: { sourcePath: string; success: boolean; outputPath?: string; error?: string }[] = [];
    for (const filePath of sourcePath) {
      const result = await convertSingleFile(filePath, sourceType, targetType);
      results.push({ sourcePath: filePath, ...result });
    }
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    console.log(`[convert-file ${sourceType}->${targetType}]`, 'Batch conversion completed, success:', successCount, 'failed:', failCount);
    return { success: successCount > 0, results, successCount, failCount };
  } else {
    return convertSingleFile(sourcePath, sourceType, targetType);
  }
});

// ==================== Workflow ====================

interface WorkflowRenameStep {
  stepType: 'rename';
  rule: {
    type: string;
    params: Record<string, any>;
  };
}

interface WorkflowConvertStep {
  stepType: 'convert';
  sourceFormat: string;
  targetFormat: string;
}

interface WorkflowClassifyStep {
  stepType: 'classify';
  rule: {
    type: string;
    params: Record<string, any>;
  };
  targetFolder: string;
}

type WorkflowStep = WorkflowRenameStep | WorkflowConvertStep | WorkflowClassifyStep;

interface WorkflowChange {
  type: 'rename' | 'create' | 'delete' | 'move';
  oldPath?: string;
  newPath?: string;
}

let workflowSnapshot: { folderPath: string; changes: WorkflowChange[] } | null = null;

function applyRenameToFiles(files: string[], rule: { type: string; params: Record<string, any> }): { newFiles: string[]; changes: WorkflowChange[] } {
  const changes: WorkflowChange[] = [];
  const newFiles = files.map((filePath) => {
    const dir = path.dirname(filePath);
    const ext = path.extname(filePath);
    const baseName = path.basename(filePath, ext);
    let newName = baseName;

    switch (rule.type) {
      case 'addPrefix':
        newName = (rule.params.prefix || '') + baseName;
        break;
      case 'addSuffix':
        newName = baseName + (rule.params.suffix || '');
        break;
      case 'findReplace':
        newName = baseName.split(rule.params.search || '').join(rule.params.replace || '');
        break;
      case 'insertDate': {
        const now = new Date();
        let dateStr = rule.params.format || 'yyyyMMdd';
        dateStr = dateStr.replace(/yyyy/g, String(now.getFullYear()));
        dateStr = dateStr.replace(/MM/g, String(now.getMonth() + 1).padStart(2, '0'));
        dateStr = dateStr.replace(/dd/g, String(now.getDate()).padStart(2, '0'));
        dateStr = dateStr.replace(/HH/g, String(now.getHours()).padStart(2, '0'));
        dateStr = dateStr.replace(/mm/g, String(now.getMinutes()).padStart(2, '0'));
        dateStr = dateStr.replace(/ss/g, String(now.getSeconds()).padStart(2, '0'));
        newName = rule.params.position === 'suffix' ? baseName + dateStr : dateStr + baseName;
        break;
      }
      case 'sequence': {
        const idx = files.indexOf(filePath);
        const start = rule.params.start || 1;
        const step = rule.params.step || 1;
        const digits = rule.params.digits || 3;
        const seq = String(start + idx * step).padStart(digits, '0');
        newName = rule.params.position === 'suffix' ? baseName + seq : seq + baseName;
        break;
      }
    }

    const newFilePath = path.join(dir, newName + ext);
    if (newFilePath !== filePath) {
      fs.renameSync(filePath, newFilePath);
      changes.push({ type: 'rename', oldPath: newFilePath, newPath: filePath });
    }
    return newFilePath;
  });

  return { newFiles, changes };
}

function applyConvertToFile(
  filePath: string,
  sourceFormat: string,
  targetFormat: string,
  keepOriginal: boolean
): { newFilePath?: string; change?: WorkflowChange } {
  const ext = path.extname(filePath).toLowerCase();
  if (ext !== sourceFormat) {
    return {};
  }

  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, ext);
  const targetExt = targetFormat.replace('.', '');
  const outputPath = path.join(dir, baseName + '.' + targetExt);

  switch (sourceFormat + '->' + targetFormat) {
    case '.docx->.md': {
      const mammoth = require('mammoth');
      const buffer = fs.readFileSync(filePath);
      const result = mammoth.convertToMarkdown({ buffer });
      fs.writeFileSync(outputPath, result.value, 'utf-8');
      break;
    }
    case '.md->.html': {
      const { marked } = require('marked');
      const mdContent = fs.readFileSync(filePath, 'utf-8');
      const htmlContent = marked.parse(mdContent);
      const fullHtml = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${baseName}</title></head><body>${htmlContent}</body></html>`;
      fs.writeFileSync(outputPath, fullHtml, 'utf-8');
      break;
    }
    case '.md->.pdf': {
      const { mdToPdf } = require('md-to-pdf');
      const mdContent = fs.readFileSync(filePath, 'utf-8');
      mdToPdf({ content: mdContent }, { dest: outputPath, pdf_options: { format: 'A4' } });
      break;
    }
    case '.html->.md': {
      const TurndownService = require('turndown');
      const turndownService = new TurndownService();
      const htmlContent = fs.readFileSync(filePath, 'utf-8');
      const mdContent = turndownService.turndown(htmlContent);
      fs.writeFileSync(outputPath, mdContent, 'utf-8');
      break;
    }
    case '.jpg->.png':
    case '.jpeg->.png': {
      const sharp = require('sharp');
      sharp(filePath).png().toFile(outputPath);
      break;
    }
    case '.png->.jpg':
    case '.png->.jpeg': {
      const sharp = require('sharp');
      sharp(filePath).jpeg({ quality: 90 }).toFile(outputPath);
      break;
    }
    default:
      throw new Error(`Unsupported conversion: ${sourceFormat} -> ${targetFormat}`);
  }

  const change: WorkflowChange = { type: 'create', newPath: outputPath };

  if (!keepOriginal && fs.existsSync(filePath)) {
    const backupPath = filePath + '.workflow_backup';
    fs.copyFileSync(filePath, backupPath);
    fs.unlinkSync(filePath);
    change.type = 'delete';
    change.oldPath = backupPath;
    change.newPath = filePath;
  }

  return { newFilePath: outputPath, change };
}

function classifyMatchesRule(filePath: string, rule: { type: string; params: Record<string, any> }): boolean {
  const name = path.basename(filePath);
  const ext = path.extname(filePath).toLowerCase().replace('.', '');
  const size = fs.statSync(filePath).size;
  const mtime = fs.statSync(filePath).mtimeMs;

  switch (rule.type) {
    case 'byExtension': {
      if (!rule.params.extension) return false;
      const targetExt = rule.params.extension.toLowerCase().replace('.', '');
      return ext === targetExt;
    }
    case 'byKeyword': {
      if (!rule.params.keyword) return false;
      return name.includes(rule.params.keyword);
    }
    case 'bySize': {
      const { maxSize, minSize } = rule.params;
      if (minSize !== undefined && maxSize !== undefined) {
        return size >= minSize && size <= maxSize;
      }
      if (maxSize !== undefined) {
        return size <= maxSize;
      }
      if (minSize !== undefined) {
        return size >= minSize;
      }
      return false;
    }
    case 'byDate': {
      if (!rule.params.days) return false;
      const now = Date.now();
      const diffDays = (now - mtime) / (1000 * 60 * 60 * 24);
      const mode = rule.params.dateMode || 'older';
      return mode === 'older' ? diffDays >= rule.params.days : diffDays <= rule.params.days;
    }
    default:
      return false;
  }
}

function applyClassifyToFiles(
  files: string[],
  rule: { type: string; params: Record<string, any> },
  targetFolder: string,
  baseFolder: string
): { newFiles: string[]; changes: WorkflowChange[] } {
  const changes: WorkflowChange[] = [];
  const newFiles: string[] = [];

  for (const filePath of files) {
    if (classifyMatchesRule(filePath, rule)) {
      const targetDir = path.join(baseFolder, targetFolder);
      const newPath = path.join(targetDir, path.basename(filePath));

      if (filePath === newPath) {
        newFiles.push(filePath);
        continue;
      }

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      fs.renameSync(filePath, newPath);
      changes.push({ type: 'move', oldPath: newPath, newPath: filePath });
      newFiles.push(newPath);
    } else {
      newFiles.push(filePath);
    }
  }

  return { newFiles, changes };
}

ipcMain.handle('execute-workflow', async (_, params: { folderPath: string; steps: WorkflowStep[]; keepOriginal: boolean }) => {
  const { folderPath, steps, keepOriginal } = params;
  console.log('[workflow] Starting workflow execution, folder:', folderPath);
  console.log('[workflow] Steps count:', steps.length, 'Keep original:', keepOriginal);

  try {
    if (!fs.existsSync(folderPath)) {
      return { success: false, error: 'Folder not found: ' + folderPath };
    }

    let currentFiles = scanFiles(folderPath);
    const changes: WorkflowChange[] = [];
    const log: string[] = [];

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      console.log(`[workflow] Executing step ${i + 1}/${steps.length}:`, step.stepType);

      if (step.stepType === 'rename') {
        const result = applyRenameToFiles(currentFiles, step.rule);
        currentFiles = result.newFiles;
        changes.push(...result.changes);
        log.push(`Step ${i + 1}: Renamed ${result.changes.length} files (${step.rule.type})`);
        console.log(`[workflow] Step ${i + 1} done: ${result.changes.length} files renamed`);
      } else if (step.stepType === 'convert') {
        let convertedCount = 0;
        const newFiles: string[] = [];
        for (const filePath of currentFiles) {
          const ext = path.extname(filePath).toLowerCase();
          if (ext === step.sourceFormat) {
            const result = applyConvertToFile(filePath, step.sourceFormat, step.targetFormat, keepOriginal);
            if (result.change) {
              changes.push(result.change);
              convertedCount++;
            }
            if (result.newFilePath) {
              newFiles.push(result.newFilePath);
            }
            if (!keepOriginal) {
              const idx = currentFiles.indexOf(filePath);
              if (idx !== -1 && result.newFilePath) {
                currentFiles[idx] = result.newFilePath;
              }
            }
          }
        }
        if (keepOriginal) {
          currentFiles = [...currentFiles, ...newFiles];
        }
        log.push(`Step ${i + 1}: Converted ${convertedCount} files (${step.sourceFormat} -> ${step.targetFormat})`);
        console.log(`[workflow] Step ${i + 1} done: ${convertedCount} files converted`);
      } else if (step.stepType === 'classify') {
        const result = applyClassifyToFiles(currentFiles, step.rule, step.targetFolder, folderPath);
        currentFiles = result.newFiles;
        changes.push(...result.changes);
        log.push(`Step ${i + 1}: Classified ${result.changes.length} files into "${step.targetFolder}" (${step.rule.type})`);
        console.log(`[workflow] Step ${i + 1} done: ${result.changes.length} files classified`);
      }
    }

    workflowSnapshot = { folderPath, changes };

    const finalFilesInfo = currentFiles.map((f) => ({
      path: f,
      name: path.basename(f),
      size: fs.statSync(f).size,
      mtime: fs.statSync(f).mtime,
    }));

    console.log('[workflow] Workflow completed successfully');
    return { success: true, data: finalFilesInfo, log };
  } catch (error: any) {
    console.error('[workflow] Workflow execution failed:', error);
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('undo-workflow', async () => {
  console.log('[workflow] Undoing workflow...');

  try {
    if (!workflowSnapshot) {
      return { success: false, error: 'No workflow to undo' };
    }

    const { changes } = workflowSnapshot;

    for (let i = changes.length - 1; i >= 0; i--) {
      const change = changes[i];
      if (change.type === 'rename' && change.oldPath && change.newPath) {
        if (fs.existsSync(change.oldPath)) {
          fs.renameSync(change.oldPath, change.newPath);
        }
      } else if (change.type === 'create' && change.newPath) {
        if (fs.existsSync(change.newPath)) {
          fs.unlinkSync(change.newPath);
        }
      } else if (change.type === 'delete' && change.oldPath && change.newPath) {
        if (fs.existsSync(change.oldPath)) {
          fs.renameSync(change.oldPath, change.newPath);
        }
      } else if (change.type === 'move' && change.oldPath && change.newPath) {
        if (fs.existsSync(change.oldPath)) {
          fs.renameSync(change.oldPath, change.newPath);
        }
      }
    }

    workflowSnapshot = null;
    console.log('[workflow] Workflow undone successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[workflow] Undo workflow failed:', error);
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('save-dialog', async (_, defaultFileName: string = 'workflow-template.json') => {
  const result = await dialog.showSaveDialog({
    title: '保存工作流模板',
    defaultPath: defaultFileName,
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
  });
  if (result.canceled || !result.filePath) {
    return { success: false };
  }
  return { success: true, filePath: result.filePath };
});

ipcMain.handle('open-dialog-json', async () => {
  const result = await dialog.showOpenDialog({
    title: '加载工作流模板',
    properties: ['openFile'],
    filters: [{ name: 'JSON Files', extensions: ['json'] }],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }
  return { success: true, filePath: result.filePaths[0] };
});

ipcMain.handle('read-file', async (_, filePath: string) => {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    return { success: true, data: content };
  } catch (error: any) {
    console.error('[read-file] Failed to read file:', error);
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
  try {
    fs.writeFileSync(filePath, content, 'utf-8');
    return { success: true };
  } catch (error: any) {
    console.error('[write-file] Failed to write file:', error);
    return { success: false, error: error?.message || String(error) };
  }
});

let lastClassifyOps: { oldPath: string; newPath: string }[] = [];

function collectMissingFolders(ops: { oldPath: string; newPath: string }[]): { dir: string; count: number }[] {
  const missingMap = new Map<string, number>();
  for (const op of ops) {
    const targetDir = path.dirname(op.newPath);
    if (!fs.existsSync(targetDir)) {
      missingMap.set(targetDir, (missingMap.get(targetDir) || 0) + 1);
    }
  }
  return Array.from(missingMap.entries()).map(([dir, count]) => ({ dir, count }));
}

function waitForFolderResponse(): Promise<string[]> {
  return new Promise((resolve) => {
    const handler = (_: any, selectedDirs: string[]) => {
      ipcMain.removeListener('create-folder-response', handler);
      resolve(selectedDirs);
    };
    ipcMain.on('create-folder-response', handler);
  });
}

ipcMain.handle('execute-classify', async (_, ops: { oldPath: string; newPath: string }[]) => {
  try {
    lastClassifyOps = [];
    const missingFolders = collectMissingFolders(ops);

    if (missingFolders.length > 0) {
      mainWindow?.webContents.send('ask-create-folder', missingFolders);
      const selectedDirs = await waitForFolderResponse();

      for (const folder of missingFolders) {
        if (selectedDirs.includes(folder.dir)) {
          try {
            fs.mkdirSync(folder.dir, { recursive: true });
          } catch (err: any) {
            console.error('[classify] Failed to create folder:', folder.dir, err?.message);
          }
        }
      }
    }

    const results: { oldPath: string; newPath: string; status: 'moved' | 'skipped'; reason?: string }[] = [];
    for (const op of ops) {
      const targetDir = path.dirname(op.newPath);
      if (!fs.existsSync(targetDir)) {
        results.push({ oldPath: op.oldPath, newPath: op.newPath, status: 'skipped', reason: '目标文件夹未创建' });
        continue;
      }
      try {
        fs.renameSync(op.oldPath, op.newPath);
        lastClassifyOps.push({ oldPath: op.newPath, newPath: op.oldPath });
        results.push({ oldPath: op.oldPath, newPath: op.newPath, status: 'moved' });
      } catch (err: any) {
        results.push({ oldPath: op.oldPath, newPath: op.newPath, status: 'skipped', reason: err?.message || '移动失败' });
      }
    }

    return { success: true, results };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('undo-classify', async () => {
  try {
    if (lastClassifyOps.length === 0) {
      return { success: false, error: 'No operations to undo' };
    }
    for (const op of lastClassifyOps) {
      fs.renameSync(op.oldPath, op.newPath);
    }
    lastClassifyOps = [];
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize();
  return { success: true };
});

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
  return { success: true };
});

ipcMain.handle('window-close', () => {
  mainWindow?.close();
  return { success: true };
});

ipcMain.handle('window-is-maximized', () => {
  return mainWindow?.isMaximized() || false;
});

ipcMain.handle('check-for-updates', async () => {
  console.log('[update] Manual update check requested');
  if (!app.isPackaged) {
    console.log('[update] Development mode, skipping');
    return { success: false, error: 'Development mode' };
  }
  try {
    const currentVersion = app.getVersion();

    return new Promise((resolve) => {
      const request = net.request('https://api.github.com/repos/fantuan9234/file-flow/releases/latest');
      request.setHeader('Accept', 'application/vnd.github.v3+json');

      const timeout = setTimeout(() => {
        console.log('[update] Manual check timed out');
        request.abort();
        resolve({ success: false, error: 'Request timed out' });
      }, TIMEOUT);

      request.on('response', (response) => {
        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        response.on('end', () => {
          clearTimeout(timeout);
          try {
            const release = JSON.parse(data);
            const latestVersion = release.tag_name;
            if (compareVersions(latestVersion, currentVersion) > 0) {
              console.log('[update] New version available:', latestVersion);
              resolve({ success: true, available: true, version: latestVersion, currentVersion });
            } else {
              console.log('[update] Already up to date');
              resolve({ success: true, available: false, currentVersion });
            }
          } catch {
            console.log('[update] Failed to parse release info');
            resolve({ success: false, error: 'Failed to parse release info' });
          }
        });
      });

      request.on('error', (err) => {
        clearTimeout(timeout);
        console.log('[update] Request failed:', err.message);
        resolve({ success: false, error: err.message });
      });

      request.end();
    });
  } catch (error: any) {
    console.log('[update] Error:', error?.message || String(error));
    return { success: false, error: error?.message || String(error) };
  }
});

// ==================== Deduplication ====================

function calculateMD5(filePath: string): string {
  const hash = createHash('md5');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function textSimilarity(a: string, b: string): number {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

ipcMain.handle('find-exact-duplicates', async (_, files: { path: string; name: string; size: number; mtime: string }[]) => {
  try {
    const hashMap = new Map<string, typeof files>();

    for (const file of files) {
      try {
        const hash = calculateMD5(file.path);
        if (!hashMap.has(hash)) {
          hashMap.set(hash, []);
        }
        hashMap.get(hash)!.push(file);
      } catch {
        // Skip files that cannot be read
      }
    }

    const groups: { hash: string; files: typeof files }[] = [];
    for (const [hash, groupFiles] of hashMap) {
      if (groupFiles.length > 1) {
        groups.push({ hash, files: groupFiles });
      }
    }

    const totalDuplicates = groups.reduce((sum, g) => sum + g.files.length - 1, 0);
    return { success: true, groups, totalDuplicates };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('find-similar-duplicates', async (_, files: { path: string; name: string; size: number; mtime: string }[], threshold: number) => {
  try {
    const groups: { similarity: number; files: typeof files }[] = [];
    const used = new Set<string>();

    for (let i = 0; i < files.length; i++) {
      if (used.has(files[i].path)) continue;

      const group: typeof files = [files[i]];
      used.add(files[i].path);

      try {
        const contentA = fs.readFileSync(files[i].path, 'utf-8');

        for (let j = i + 1; j < files.length; j++) {
          if (used.has(files[j].path)) continue;

          try {
            const contentB = fs.readFileSync(files[j].path, 'utf-8');
            const similarity = textSimilarity(contentA, contentB);

            if (similarity >= threshold) {
              group.push(files[j]);
              used.add(files[j].path);
            }
          } catch {
            // Skip files that cannot be read
          }
        }
      } catch {
        // Skip files that cannot be read
      }

      if (group.length > 1) {
        groups.push({ similarity: threshold, files: group });
      }
    }

    const totalDuplicates = groups.reduce((sum, g) => sum + g.files.length - 1, 0);
    return { success: true, groups, totalDuplicates };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('delete-files', async (_, filePaths: string[]) => {
  try {
    const { shell } = require('electron');
    for (const filePath of filePaths) {
      if (fs.existsSync(filePath)) {
        shell.trashItem(filePath);
      }
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('move-files', async (_, filePaths: string[], targetDir: string) => {
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    for (const filePath of filePaths) {
      if (fs.existsSync(filePath)) {
        const destPath = path.join(targetDir, path.basename(filePath));
        fs.renameSync(filePath, destPath);
      }
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

// ==================== Content Classification ====================

const keywordDictionary: Record<string, string[]> = {
  contract: [
    '合同', '协议', '甲方', '乙方', '签署', '生效', '违约', '赔偿',
    '条款', '双方', '约定', '权利', '义务', 'contract', 'agreement', 'party',
  ],
  invoice: [
    '发票', '金额', '税额', '开票', '购买方', '销售方', '纳税人识别号',
    'invoice', 'amount', 'tax', 'receipt', 'billing',
  ],
  resume: [
    '简历', '教育背景', '工作经历', '技能', '项目经验', '自我评价',
    '联系方式', '求职意向', 'resume', 'experience', 'education', 'skills',
  ],
  report: [
    '报告', '摘要', '结论', '分析', '数据', '统计', '调研',
    'report', 'summary', 'analysis', 'conclusion', 'data',
  ],
};

ipcMain.handle('classify-content', async (_, text: string) => {
  try {
    const lowerText = text.toLowerCase();
    const scores: Record<string, number> = {};
    const matchedKeywords: Record<string, string[]> = {};

    for (const [category, keywords] of Object.entries(keywordDictionary)) {
      let matchCount = 0;
      const matched: string[] = [];
      for (const keyword of keywords) {
        if (lowerText.includes(keyword.toLowerCase())) {
          matchCount++;
          matched.push(keyword);
        }
      }
      scores[category] = matchCount;
      matchedKeywords[category] = matched;
    }

    let bestCategory = 'other';
    let bestScore = 0;

    for (const [category, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestCategory = category;
      }
    }

    const confidence = bestScore > 0 ? Math.min(bestScore / 5, 1) : 0;

    return {
      success: true,
      category: bestCategory,
      confidence,
      matchedKeywords: matchedKeywords[bestCategory] || [],
    };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

// ==================== Ollama AI Classification ====================

ipcMain.handle('ollama-check-status', async () => {
  console.log('[ollama] Checking status...');
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[ollama] Status check timed out');
      controller.abort();
    }, TIMEOUT);

    const response = await fetch('http://localhost:11434/api/tags', {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      console.log('[ollama] Ollama responded with error:', response.status);
      return { running: false, models: [], error: 'Ollama responded with error' };
    }
    const data = await response.json();
    const models = (data.models || []).map((m: any) => m.name || m);
    console.log('[ollama] Running, models:', models);
    return { running: true, models };
  } catch (error: any) {
    console.log('[ollama] Not running or unreachable:', error?.message || String(error));
    return { running: false, models: [], error: error?.message || String(error) };
  }
});

ipcMain.handle('ollama-classify', async (_, text: string, model: string) => {
  console.log('[ollama] Classifying with model:', model);
  const SYSTEM_PROMPT = `You are a document classification assistant. Classify the following text into one of these categories:
- contract: Legal agreements, contracts, terms of service
- invoice: Bills, receipts, payment records, financial documents
- resume: CVs, job applications, professional profiles
- report: Analysis reports, research papers, summaries, data documents
- other: Documents that don't fit the above categories

Respond with ONLY a JSON object in this format:
{"category": "contract|invoice|resume|report|other", "confidence": 0.0-1.0, "reasoning": "brief explanation"}

Do not include any other text or markdown formatting.`;

  const maxText = text.slice(0, 3000);

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[ollama] Classification timed out');
      controller.abort();
    }, TIMEOUT * 3);

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        prompt: `${SYSTEM_PROMPT}\n\nDocument text:\n${maxText}`,
        stream: false,
        options: {
          temperature: 0.1,
          num_predict: 200,
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.log('[ollama] API error:', response.status, errorText);
      return {
        success: false,
        category: 'other',
        confidence: 0,
        error: `Ollama API error: ${response.status} ${errorText}`,
      };
    }

    const data = await response.json();
    const responseText = data.response || '';

    const jsonMatch = responseText.match(/\{[^}]*\}/s);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const validCategories = ['contract', 'invoice', 'resume', 'report', 'other'];
        if (validCategories.includes(parsed.category)) {
          console.log('[ollama] Classification result:', parsed.category);
          return {
            success: true,
            category: parsed.category,
            confidence: parseFloat(parsed.confidence) || 0.5,
            reasoning: parsed.reasoning || '',
          };
        }
      } catch {
        // Fall through to keyword extraction
      }
    }

    const lowerText = responseText.toLowerCase();
    let category = 'other';
    for (const cat of ['contract', 'invoice', 'resume', 'report']) {
      if (lowerText.includes(cat)) {
        category = cat;
        break;
      }
    }

    return {
      success: true,
      category,
      confidence: 0.5,
      reasoning: 'Parsed from response text',
    };
  } catch (error: any) {
    console.log('[ollama] Classification failed:', error?.message || String(error));
    return {
      success: false,
      category: 'other',
      confidence: 0,
      error: error?.message || String(error),
    };
  }
});

// ==================== AI Connection Test ====================

ipcMain.handle('test-ai-connection', async (_, endpoint: string, provider: 'ollama' | 'lmstudio') => {
  console.log('[AI] Testing connection to:', endpoint, 'provider:', provider);
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log('[AI] Connection test timed out');
      controller.abort();
    }, 5000);

    let url: string;
    if (provider === 'lmstudio') {
      url = `${endpoint}/v1/models`;
    } else {
      url = `${endpoint}/api/tags`;
    }

    const response = await fetch(url, {
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}` };
    }

    const data = await response.json();
    let models: string[];
    if (provider === 'lmstudio') {
      models = (data.data || []).map((m: any) => m.id || m.name || m);
    } else {
      models = (data.models || []).map((m: any) => m.name || m);
    }
    console.log('[AI] Connection successful, models:', models);
    return { success: true, models };
  } catch (error: any) {
    console.log('[AI] Connection failed:', error?.message || String(error));
    return { success: false, error: error?.message || String(error) };
  }
});

// ==================== AI Smart Classification ====================

ipcMain.handle('ai-classify', async (_, text: string) => {
  console.log('[AI] Classify request, text length:', text.length);
  try {
    const { callAI, parseCategory } = await import('./aiService');
    const prompt = '请根据以下文件内容进行分类，只返回一个类别名称，可选类别：合同、发票、简历、报告、其他。文件内容：';
    const aiResponse = await callAI(prompt, text);
    const category = parseCategory(aiResponse);
    console.log('[AI] Classification result:', category, 'raw:', aiResponse);
    return { success: true, category, rawResponse: aiResponse };
  } catch (error: any) {
    console.error('[AI] Classification failed:', error);
    return { success: false, error: error?.message || String(error) };
  }
});

// ==================== OCR Text Extraction ====================
/**
 * OCR 引擎：PaddleOCR (via PaddleOCR-json)
 * 项目地址：https://github.com/hiroi-sora/PaddleOCR-json
 * 许可协议：Apache License 2.0
 */

ipcMain.handle('extract-text', async (_, filePath: string, languages: string) => {
  console.log('[OCR] Extract text request:', filePath, languages);
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, text: '', confidence: 0, error: 'File not found: ' + filePath };
    }

    const { text, confidence } = await performOCR(filePath);

    if (!text) {
      return { success: true, text: '', confidence: 0 };
    }

    return { success: true, text, confidence };
  } catch (error: any) {
    console.error('[OCR] Extract text failed:', error);
    appendErrorLog(`Extraction failed: ${error?.message || String(error)}`);
    return { success: false, text: '', confidence: 0, error: error?.message || String(error) };
  }
});

// ==================== PaddleOCR-json Text Extraction ====================
/**
 * OCR 引擎：PaddleOCR (via PaddleOCR-json)
 * 项目地址：https://github.com/hiroi-sora/PaddleOCR-json
 * 许可协议：Apache License 2.0
 */

ipcMain.handle('paddle-extract-text', async (_, filePath: string) => {
  console.log('[PaddleOCR-json] Extract text request:', filePath);
  try {
    if (!fs.existsSync(filePath)) {
      return { success: false, text: '', confidence: 0, error: 'File not found: ' + filePath };
    }

    const { text, confidence } = await performOCR(filePath);

    console.log('[PaddleOCR-json] Extracted', text.length, 'characters with', confidence.toFixed(1), '% confidence');

    if (!text) {
      return { success: true, text: '', confidence: 0, error: '未识别到文字' };
    }

    return { success: true, text, confidence };
  } catch (error: any) {
    console.error('[PaddleOCR-json] Extract text failed:', error);
    appendErrorLog(`Extraction failed: ${error?.message || String(error)}`);
    return { success: false, text: '', confidence: 0, error: error?.message || String(error) };
  }
});

// ==================== PaddleOCR-json Status ====================

ipcMain.handle('paddle-ocr-status', async () => {
  return { status: paddleOCRStatus, running: paddleOCRStatus === 'running', errorLogPath: paddleOCRErrorLogPath };
});

ipcMain.handle('paddle-ocr-open-log', async () => {
  if (paddleOCRErrorLogPath && fs.existsSync(paddleOCRErrorLogPath)) {
    shell.openPath(paddleOCRErrorLogPath);
    return { success: true };
  }
  return { success: false, error: 'Log file not found' };
});

// ==================== API Key Encryption (safeStorage) ====================

ipcMain.handle('api-key-set', async (_, key: string) => {
  try {
    const encrypted = safeStorage.encryptString(key).toString('base64');
    return { success: true, encrypted };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('api-key-get', async () => {
  try {
    const stored = localStorage.getItem('api-key-encrypted');
    if (!stored) {
      return { success: true, key: '' };
    }
    const decrypted = safeStorage.decryptString(Buffer.from(stored, 'base64'));
    return { success: true, key: decrypted };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('api-key-save', async (_, key: string) => {
  try {
    if (!key) {
      localStorage.removeItem('api-key-encrypted');
      return { success: true };
    }
    const encrypted = safeStorage.encryptString(key).toString('base64');
    localStorage.setItem('api-key-encrypted', encrypted);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

// ==================== LAN Transfer Server ====================

let lanServer: ReturnType<typeof createServer> | null = null;
let lanServerPort = 0;
let lanServerRunning = false;
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
  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FileFlow - 局域网快传</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      max-width: 500px;
      width: 100%;
      padding: 40px;
      text-align: center;
    }
    h1 { color: #333; margin-bottom: 8px; font-size: 24px; }
    .subtitle { color: #666; margin-bottom: 32px; font-size: 14px; }
    .upload-area {
      border: 2px dashed #667eea;
      border-radius: 12px;
      padding: 40px 20px;
      cursor: pointer;
      transition: all 0.3s;
      background: #f8f9ff;
    }
    .upload-area:hover { background: #eef0ff; border-color: #764ba2; }
    .upload-area.dragover { background: #e0e3ff; border-color: #764ba2; }
    .upload-icon { font-size: 48px; margin-bottom: 16px; }
    .upload-text { color: #333; font-size: 16px; margin-bottom: 8px; }
    .upload-hint { color: #999; font-size: 12px; }
    #fileInput { display: none; }
    .progress { margin-top: 24px; display: none; }
    .progress-bar {
      height: 8px;
      background: #e0e0e0;
      border-radius: 4px;
      overflow: hidden;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #667eea, #764ba2);
      width: 0%;
      transition: width 0.3s;
    }
    .status { margin-top: 12px; color: #666; font-size: 14px; }
    .success { color: #22c55e; }
    .error { color: #ef4444; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📲 FileFlow 局域网快传</h1>
    <p class="subtitle">选择文件上传到电脑</p>
    <div class="upload-area" id="uploadArea">
      <div class="upload-icon">📁</div>
      <p class="upload-text">点击选择文件 或 拖拽到此处</p>
      <p class="upload-hint">支持任意文件类型</p>
    </div>
    <input type="file" id="fileInput" multiple>
    <div class="progress" id="progress">
      <div class="progress-bar">
        <div class="progress-fill" id="progressFill"></div>
      </div>
      <p class="status" id="status"></p>
    </div>
  </div>
  <script>
    const uploadArea = document.getElementById('uploadArea');
    const fileInput = document.getElementById('fileInput');
    const progress = document.getElementById('progress');
    const progressFill = document.getElementById('progressFill');
    const status = document.getElementById('status');

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('dragover');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('dragover');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });

    fileInput.addEventListener('change', () => {
      handleFiles(fileInput.files);
    });

    async function handleFiles(files) {
      if (!files || files.length === 0) return;
      
      progress.style.display = 'block';
      status.className = 'status';
      status.textContent = '正在上传 ' + files.length + ' 个文件...';
      progressFill.style.width = '0%';

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const formData = new FormData();
        formData.append('file', file);

        try {
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
    }
  </script>
</body>
</html>`;
}

function handleUploadRequest(req: IncomingMessage, res: ServerResponse) {
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
          mainWindow.webContents.send('lan-file-received', path.basename(finalPath));
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

ipcMain.handle('lan-start-server', async (_, uploadDir: string) => {
  try {
    if (lanServerRunning) {
      return { success: false, error: 'Server already running' };
    }

    lanUploadDir = uploadDir;
    if (!fs.existsSync(lanUploadDir)) {
      fs.mkdirSync(lanUploadDir, { recursive: true });
    }

    lanServer = createServer(handleUploadRequest);

    return new Promise((resolve) => {
      lanServer!.listen(0, '0.0.0.0', async () => {
        const address = lanServer!.address();
        if (typeof address === 'object' && address) {
          lanServerPort = address.port;
          lanServerRunning = true;
          const localIP = getLocalIP();
          const url = `http://${localIP}:${lanServerPort}`;
          const qrCode = await QRCode.toDataURL(url);

          if (mainWindow) {
            mainWindow.webContents.send('lan-server-started', {
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

ipcMain.handle('lan-stop-server', async () => {
  try {
    if (lanServer && lanServerRunning) {
      lanServer.close();
      lanServer = null;
      lanServerRunning = false;
      lanServerPort = 0;
      if (mainWindow) {
        mainWindow.webContents.send('lan-server-stopped');
      }
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

// ==================== P2P LAN Share (WebRTC) ====================

let p2pManager: LanShareManager | null = null;
let p2pServerRunning = false;
let desktopWs: WebSocket | null = null;

function getDesktopPeerName(): string {
  const os = platform();
  const osMap: Record<string, string> = {
    win32: 'Windows 电脑',
    darwin: 'Mac 电脑',
    linux: 'Linux 电脑',
  };
  return osMap[os] || '电脑';
}

function connectDesktopPeer(port: number): void {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`);
  
  ws.on('open', () => {
    ws.send(JSON.stringify({
      type: 'peer-joined',
      from: '',
      payload: { name: getDesktopPeerName(), type: 'desktop' }
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

  desktopWs = ws;
}

ipcMain.handle('p2p-start-server', async (_, uploadDir: string) => {
  try {
    if (p2pServerRunning) {
      return { success: false, error: 'P2P server already running' };
    }

    let dir = uploadDir;
    if (!dir) {
      try {
        const savedDir = await mainWindow?.webContents.executeJavaScript("localStorage.getItem('p2p-receive-dir')");
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

    p2pManager = new LanShareManager(dir);
    p2pManager.setCallbacks({
      onStatusChange: (status) => {
        console.log('[P2P]', status);
        if (mainWindow) {
          mainWindow.webContents.send('p2p-status-change', { status });
        }
      },
      onPeerConnected: (peer) => {
        if (mainWindow) {
          mainWindow.webContents.send('p2p-peer-connected', peer);
        }
      },
      onPeerDisconnected: (peerId) => {
        if (mainWindow) {
          mainWindow.webContents.send('p2p-peer-disconnected', { peerId });
        }
      },
      onFileReceived: (file) => {
        if (mainWindow) {
          mainWindow.webContents.send('p2p-file-received', file);
        }
      },
      onTransferProgress: (fileId, progress) => {
        if (mainWindow) {
          mainWindow.webContents.send('p2p-transfer-progress', { fileId, progress });
        }
      },
    });

    const result = await p2pManager.start(0);
    p2pServerRunning = true;

    connectDesktopPeer(result.port);

    if (mainWindow) {
      mainWindow.webContents.send('p2p-server-started', { ...result, receiveDir: dir });
    }

    return { success: true, ...result, receiveDir: dir };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('p2p-stop-server', async () => {
  try {
    if (desktopWs) {
      desktopWs.close();
      desktopWs = null;
    }
    if (p2pManager) {
      p2pManager.stop();
      p2pManager = null;
      p2pServerRunning = false;
      if (mainWindow) {
        mainWindow.webContents.send('p2p-server-stopped');
      }
    }
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('p2p-select-receive-dir', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow!, {
      title: '选择接收文件保存目录',
      properties: ['openDirectory'],
      buttonLabel: '选择此目录',
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, error: '用户取消选择' };
    }

    const dir = result.filePaths[0];
    if (mainWindow) {
      mainWindow.webContents.executeJavaScript(`localStorage.setItem('p2p-receive-dir', '${dir.replace(/\\/g, '\\\\')}')`);
    }

    return { success: true, dir };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('p2p-get-receive-dir', async () => {
  try {
    const savedDir = await mainWindow?.webContents.executeJavaScript("localStorage.getItem('p2p-receive-dir')");
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

ipcMain.handle('p2p-get-peers', async () => {
  try {
    if (!p2pManager) {
      return { success: false, error: 'Server not running' };
    }
    return { success: true, peers: p2pManager.getPeers() };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});

ipcMain.handle('p2p-get-transfers', async () => {
  try {
    if (!p2pManager) {
      return { success: false, error: 'Server not running' };
    }
    return { success: true, transfers: p2pManager.getTransfers() };
  } catch (error: any) {
    return { success: false, error: error?.message || String(error) };
  }
});
