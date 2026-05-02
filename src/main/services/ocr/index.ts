import { app, ipcMain, BrowserWindow } from 'electron';
import { spawn, ChildProcess } from 'child_process';
import fs from 'fs';
import path from 'path';
import { Worker } from 'worker_threads';
import { createWorker } from 'tesseract.js';
import { IPC_CHANNELS, OCRStatusResponse, ExtractTextResponse } from '../../../shared/ipc-channels';

interface HybridOCRResult {
  paddleText: string;
  paddleConfidence: number;
  tesseractText: string;
  tesseractConfidence: number;
  finalText: string;
  finalConfidence: number;
  consensus: 'high' | 'low' | 'paddle_only' | 'tesseract_only';
}

interface OCRResult {
  code: number;
  data: Array<{
    box: [[number, number], [number, number], [number, number], [number, number]];
    score: number;
    text: string;
  }> | null;
}

interface OCRRequest {
  imagePath: string;
  resolve: (result: { text: string; confidence: number }) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

export class OCRService {
  private status: 'starting' | 'running' | 'stopped' | 'failed' = 'starting';
  private errorLogPath = '';
  private ocrProcess: ChildProcess | null = null;
  private ocrInitPromise: Promise<void> | null = null;
  private stdoutBuffer = '';
  private ocrRequestQueue: OCRRequest[] = [];
  private isProcessingQueue = false;
  private ocrResponseBuffer = '';
  private ocrResponseListenerSetup = false;
  private useOCRWorker = false;
  private mainWindow: BrowserWindow | null = null;

  setMainWindow(window: BrowserWindow | null) {
    this.mainWindow = window;
  }

  getStatus() {
    return this.status;
  }

  getErrorLogPath() {
    return this.errorLogPath;
  }

  getPaddleOCRJsonExePath(): string {
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

  private getErrorLogPathInternal(): string {
    const logsDir = path.join(app.getPath('userData'), 'logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logPath = path.join(logsDir, 'paddleocr_error.log');
    this.errorLogPath = logPath;
    return logPath;
  }

  private appendErrorLog(message: string): void {
    const logPath = this.getErrorLogPathInternal();
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${message}\n`;
    fs.appendFileSync(logPath, logEntry, 'utf-8');
    console.error('[PaddleOCR]', message);
  }

  private notifyRendererStatus(status: 'starting' | 'running' | 'stopped' | 'failed') {
    this.status = status;
    if (this.mainWindow) {
      this.mainWindow.webContents.send(IPC_CHANNELS.PADDLE_OCR_STATUS_CHANGED, {
        status,
        errorLogPath: this.errorLogPath,
      });
    }
  }

  async init(): Promise<void> {
    if (this.ocrInitPromise) {
      return this.ocrInitPromise;
    }

    this.ocrInitPromise = (async () => {
      const exePath = this.getPaddleOCRJsonExePath();
      if (!exePath) {
        const msg = 'PaddleOCR-json executable not found. Please download from https://github.com/hiroi-sora/PaddleOCR-json/releases';
        console.log('[PaddleOCR]', msg);
        this.appendErrorLog(msg);
        this.notifyRendererStatus('failed');
        return;
      }

      const baseDir = path.dirname(exePath);
      const modelsDir = path.join(baseDir, 'models');
      if (!fs.existsSync(modelsDir)) {
        const msg = `Models directory not found: ${modelsDir}`;
        console.log('[PaddleOCR]', msg);
        this.appendErrorLog(msg);
        this.notifyRendererStatus('failed');
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
          this.notifyRendererStatus('starting');
          console.log(`[PaddleOCR] Init attempt ${attempt}/${maxRetries}...`);

          this.stdoutBuffer = '';

          this.ocrProcess = spawn(exePath, [], {
            cwd: baseDir,
            stdio: ['pipe', 'pipe', 'pipe'],
            windowsHide: true,
          });

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('OCR initialization timeout after 30s'));
            }, 30000);

            this.ocrProcess!.stdout!.on('data', (chunk: Buffer) => {
              const text = chunk.toString();
              this.stdoutBuffer += text;
              console.log('[PaddleOCR] stdout:', text.trim());

              if (text.includes('OCR init completed')) {
                clearTimeout(timeout);
                resolve();
              }
            });

            this.ocrProcess!.stderr!.on('data', (chunk: Buffer) => {
              const text = chunk.toString();
              console.error('[PaddleOCR] stderr:', text.trim());
              this.appendErrorLog(`stderr: ${text.trim()}`);
            });

            this.ocrProcess!.on('error', (err: Error) => {
              clearTimeout(timeout);
              reject(err);
            });

            this.ocrProcess!.on('exit', (code: number | null) => {
              clearTimeout(timeout);
              reject(new Error(`OCR process exited with code ${code}`));
            });
          });

          console.log('[PaddleOCR] PaddleOCR-json initialized successfully (pipe mode)');
          if (!this.ocrResponseListenerSetup) {
            this.setupOCRResponseListener();
            this.ocrResponseListenerSetup = true;
          }
          this.notifyRendererStatus('running');
          return;
        } catch (err: any) {
          console.log(`[PaddleOCR] Attempt ${attempt} failed:`, err.message);
          this.appendErrorLog(`Init attempt ${attempt} failed: ${err.message}`);

          if (this.ocrProcess) {
            try { this.ocrProcess.kill(); } catch { /* ignore */ }
            this.ocrProcess = null;
          }

          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, retryInterval));
          }
        }
      }

      const msg = 'PaddleOCR 服务启动失败，请检查 paddleocr-json 目录是否完整';
      console.log('[PaddleOCR]', msg);
      this.appendErrorLog(msg);
      this.notifyRendererStatus('failed');
    })();

    return this.ocrInitPromise;
  }

  private async ensureOCRProcess(): Promise<void> {
    if (this.ocrProcess && this.status === 'running') {
      return;
    }

    await this.init();

    if (!this.ocrProcess || this.status !== 'running') {
      throw new Error('PaddleOCR-json not available. Please check logs.');
    }
  }

  private setupOCRResponseListener(): void {
    if (!this.ocrProcess || !this.ocrProcess.stdout) return;

    this.ocrProcess.stdout.on('data', (chunk: Buffer) => {
      this.ocrResponseBuffer += chunk.toString();

      const lines = this.ocrResponseBuffer.split('\n');
      this.ocrResponseBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || this.ocrRequestQueue.length === 0) continue;

        try {
          const result: OCRResult = JSON.parse(trimmed);
          const currentRequest = this.ocrRequestQueue.shift();
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

          this.isProcessingQueue = false;
          this.processOCRQueue();
        } catch (parseErr: any) {
          console.error('[PaddleOCR] Failed to parse response:', trimmed, parseErr);
        }
      }
    });

    this.ocrProcess.stderr?.on('data', (chunk: Buffer) => {
      console.error('[PaddleOCR] stderr:', chunk.toString().trim());
    });
  }

  private processOCRQueue(): void {
    if (this.isProcessingQueue || this.ocrRequestQueue.length === 0 || !this.ocrProcess || !this.ocrProcess.stdin) return;

    this.isProcessingQueue = true;
    const request = this.ocrRequestQueue[0];

    const jsonRequest = JSON.stringify({ image_path: request.imagePath }) + '\n';
    console.log('[PaddleOCR] Sending request:', jsonRequest.trim());

    this.ocrProcess.stdin.write(jsonRequest, (writeErr) => {
      if (writeErr) {
        this.isProcessingQueue = false;
        const failedRequest = this.ocrRequestQueue.shift();
        if (failedRequest) {
          clearTimeout(failedRequest.timeout);
          failedRequest.reject(writeErr);
        }
        this.processOCRQueue();
      }
    });
  }

  private async performOCR(imagePath: string): Promise<{ text: string; confidence: number }> {
    await this.ensureOCRProcess();

    if (!this.ocrProcess || !this.ocrProcess.stdin || !this.ocrProcess.stdout) {
      throw new Error('OCR process not available');
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        const index = this.ocrRequestQueue.findIndex(r => r.timeout === timeout);
        if (index !== -1) {
          const request = this.ocrRequestQueue.splice(index, 1)[0];
          if (index === 0) {
            this.isProcessingQueue = false;
          }
          request.reject(new Error('OCR recognition timeout after 60s'));
          this.processOCRQueue();
        }
      }, 60000);

      this.ocrRequestQueue.push({ imagePath, resolve, reject, timeout });
      this.processOCRQueue();
    });
  }

  private async performOCRWithWorker(imagePath: string): Promise<{ text: string; confidence: number }> {
    return new Promise((resolve, reject) => {
      const workerPath = app.isPackaged
        ? path.join(process.resourcesPath, 'workers', 'ocr-worker.js')
        : path.join(__dirname, 'workers', 'ocr-worker.js');

      const exePath = this.getPaddleOCRJsonExePath();
      const baseDir = path.dirname(exePath);

      const worker = new Worker(workerPath);

      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new Error('OCR worker timeout'));
      }, 60000);

      worker.postMessage({
        id: Date.now().toString(),
        imagePath,
        ocrExePath: exePath,
        baseDir,
      });

      worker.on('message', (msg) => {
        clearTimeout(timeout);
        if (msg.success) {
          resolve(msg.result);
        } else {
          reject(new Error(msg.error));
        }
        worker.terminate();
      });

      worker.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  private async performOCRWithFallback(imagePath: string): Promise<{ text: string; confidence: number }> {
    if (this.useOCRWorker) {
      try {
        return await this.performOCRWithWorker(imagePath);
      } catch (err) {
        console.log('[OCR] Worker failed, falling back to main process:', err);
        this.useOCRWorker = false;
      }
    }
    return this.performOCR(imagePath);
  }

  private async performHybridOCR(imagePath: string, languages: string): Promise<HybridOCRResult> {
    console.log('[HybridOCR] Starting hybrid OCR for:', imagePath, 'languages:', languages);

    let paddleResult: { text: string; confidence: number } = { text: '', confidence: 0 };
    let tesseractResult: { text: string; confidence: number } = { text: '', confidence: 0 };

    const paddlePromise = this.performOCRWithFallback(imagePath)
      .then(r => { paddleResult = r; return r; })
      .catch(err => {
        console.log('[HybridOCR] PaddleOCR failed:', err.message);
        return { text: '', confidence: 0 };
      });

    const tesseractPromise = (async () => {
      try {
        const langMap: Record<string, string> = {
          'eng': 'eng',
          'chi_sim': 'chi_sim',
          'chi_sim+eng': 'chi_sim+eng',
        };
        const tesseractLang = langMap[languages] || 'chi_sim+eng';

        const worker = await createWorker(tesseractLang, 1, {
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`[Tesseract] Progress: ${(m.progress * 100).toFixed(1)}%`);
            }
          }
        });

        const { data } = await worker.recognize(imagePath);
        await worker.terminate();

        tesseractResult = { text: data.text || '', confidence: data.confidence || 0 };
        console.log('[HybridOCR] Tesseract result:', tesseractResult.text.length, 'chars, confidence:', tesseractResult.confidence.toFixed(1));
        return tesseractResult;
      } catch (err: any) {
        console.log('[HybridOCR] Tesseract failed:', err.message);
        return { text: '', confidence: 0 };
      }
    })();

    await Promise.all([paddlePromise, tesseractPromise]);

    const hasPaddle = paddleResult.text.trim().length > 0;
    const hasTesseract = tesseractResult.text.trim().length > 0;

    if (!hasPaddle && !hasTesseract) {
      return {
        paddleText: '',
        paddleConfidence: 0,
        tesseractText: '',
        tesseractConfidence: 0,
        finalText: '',
        finalConfidence: 0,
        consensus: 'low',
      };
    }

    if (hasPaddle && !hasTesseract) {
      return {
        paddleText: paddleResult.text,
        paddleConfidence: paddleResult.confidence,
        tesseractText: '',
        tesseractConfidence: 0,
        finalText: paddleResult.text,
        finalConfidence: paddleResult.confidence,
        consensus: 'paddle_only',
      };
    }

    if (!hasPaddle && hasTesseract) {
      return {
        paddleText: '',
        paddleConfidence: 0,
        tesseractText: tesseractResult.text,
        tesseractConfidence: tesseractResult.confidence,
        finalText: tesseractResult.text,
        finalConfidence: tesseractResult.confidence,
        consensus: 'tesseract_only',
      };
    }

    const paddleLines = paddleResult.text.trim().split('\n').map(l => l.trim()).filter(Boolean);
    const tesseractLines = tesseractResult.text.trim().split('\n').map(l => l.trim()).filter(Boolean);

    let matchCount = 0;
    let totalCount = Math.max(paddleLines.length, tesseractLines.length);

    for (const pLine of paddleLines) {
      for (const tLine of tesseractLines) {
        if (this.similarity(pLine, tLine) > 0.7) {
          matchCount++;
          break;
        }
      }
    }

    const matchRatio = totalCount > 0 ? matchCount / totalCount : 0;
    const avgConfidence = (paddleResult.confidence + tesseractResult.confidence) / 2;

    let consensus: 'high' | 'low' = matchRatio > 0.6 ? 'high' : 'low';
    let finalText: string;
    let finalConfidence: number;

    if (consensus === 'high') {
      finalText = paddleResult.confidence >= tesseractResult.confidence ? paddleResult.text : tesseractResult.text;
      finalConfidence = Math.max(paddleResult.confidence, tesseractResult.confidence);
    } else {
      const allLines = [...new Set([...paddleLines, ...tesseractLines])];
      finalText = allLines.join('\n');
      finalConfidence = avgConfidence * 0.7;
    }

    console.log('[HybridOCR] Consensus:', consensus, 'match ratio:', matchRatio.toFixed(2), 'final confidence:', finalConfidence.toFixed(1));

    return {
      paddleText: paddleResult.text,
      paddleConfidence: paddleResult.confidence,
      tesseractText: tesseractResult.text,
      tesseractConfidence: tesseractResult.confidence,
      finalText,
      finalConfidence,
      consensus,
    };
  }

  private similarity(a: string, b: string): number {
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1.0;
    const editDist = this.levenshtein(longer, shorter);
    return (longer.length - editDist) / longer.length;
  }

  private levenshtein(a: string, b: string): number {
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

  cleanup() {
    if (this.ocrProcess) {
      console.log('[PaddleOCR] Cleaning up OCR process...');
      try { this.ocrProcess.kill(); } catch { /* ignore */ }
      this.ocrProcess = null;
    }
  }

  registerIPC() {
    ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_STATUS, async (): Promise<OCRStatusResponse> => {
      return { status: this.status, running: this.status === 'running', errorLogPath: this.errorLogPath };
    });

    ipcMain.handle(IPC_CHANNELS.PADDLE_OCR_OPEN_LOG, async () => {
      const { shell } = await import('electron');
      if (this.errorLogPath && fs.existsSync(this.errorLogPath)) {
        shell.openPath(this.errorLogPath);
        return { success: true };
      }
      return { success: false, error: 'Log file not found' };
    });

    ipcMain.handle(IPC_CHANNELS.EXTRACT_TEXT, async (_, filePath: string, languages: string): Promise<ExtractTextResponse> => {
      console.log('[OCR] Extract text request:', filePath, languages);
      try {
        if (!fs.existsSync(filePath)) {
          return { success: false, text: '', confidence: 0, error: 'File not found: ' + filePath };
        }

        const { text, confidence } = await this.performOCRWithFallback(filePath);

        if (!text) {
          return { success: true, text: '', confidence: 0 };
        }

        return { success: true, text, confidence };
      } catch (error: any) {
        console.error('[OCR] Extract text failed:', error);
        this.appendErrorLog(`Extraction failed: ${error?.message || String(error)}`);
        return { success: false, text: '', confidence: 0, error: error?.message || String(error) };
      }
    });

    ipcMain.handle(IPC_CHANNELS.PADDLE_EXTRACT_TEXT, async (_, filePath: string): Promise<ExtractTextResponse> => {
      console.log('[PaddleOCR-json] Extract text request:', filePath);
      try {
        if (!fs.existsSync(filePath)) {
          return { success: false, text: '', confidence: 0, error: 'File not found: ' + filePath };
        }

        const { text, confidence } = await this.performOCRWithFallback(filePath);

        console.log('[PaddleOCR-json] Extracted', text.length, 'characters with', confidence.toFixed(1), '% confidence');

        if (!text) {
          return { success: true, text: '', confidence: 0, error: '未识别到文字' };
        }

        return { success: true, text, confidence };
      } catch (error: any) {
        console.error('[PaddleOCR-json] Extract text failed:', error);
        this.appendErrorLog(`Extraction failed: ${error?.message || String(error)}`);
        return { success: false, text: '', confidence: 0, error: error?.message || String(error) };
      }
    });

    ipcMain.handle(IPC_CHANNELS.HYBRID_EXTRACT_TEXT, async (_, filePath: string, languages: string) => {
      console.log('[HybridOCR] Extract text request:', filePath, languages);
      try {
        if (!fs.existsSync(filePath)) {
          return { success: false, text: '', confidence: 0, paddleText: '', paddleConfidence: 0, tesseractText: '', tesseractConfidence: 0, consensus: 'low' as const, error: 'File not found: ' + filePath };
        }

        const result = await this.performHybridOCR(filePath, languages);

        console.log('[HybridOCR] Final text:', result.finalText.length, 'chars, confidence:', result.finalConfidence.toFixed(1), 'consensus:', result.consensus);

        return {
          success: true,
          text: result.finalText,
          confidence: result.finalConfidence,
          paddleText: result.paddleText,
          paddleConfidence: result.paddleConfidence,
          tesseractText: result.tesseractText,
          tesseractConfidence: result.tesseractConfidence,
          consensus: result.consensus,
        };
      } catch (error: any) {
        console.error('[HybridOCR] Extract text failed:', error);
        this.appendErrorLog(`Hybrid extraction failed: ${error?.message || String(error)}`);
        return { success: false, text: '', confidence: 0, paddleText: '', paddleConfidence: 0, tesseractText: '', tesseractConfidence: 0, consensus: 'low' as const, error: error?.message || String(error) };
      }
    });
  }
}

export const ocrService = new OCRService();

app.on('before-quit', () => {
  ocrService.cleanup();
});
