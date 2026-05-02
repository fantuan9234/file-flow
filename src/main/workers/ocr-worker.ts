import { parentPort } from 'worker_threads';
import { spawn } from 'child_process';

interface OCRWorkerRequest {
  id: string;
  imagePath: string;
  ocrExePath: string;
  baseDir: string;
}

interface OCRResult {
  code: number;
  data: Array<{
    box: [[number, number], [number, number], [number, number], [number, number]];
    score: number;
    text: string;
  }> | null;
}

async function processOCR(request: OCRWorkerRequest): Promise<{ text: string; confidence: number }> {
  const { imagePath, ocrExePath, baseDir } = request;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('OCR processing timeout'));
    }, 60000);

    const ocrProcess = spawn(ocrExePath, [], {
      cwd: baseDir,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    let stdoutBuffer = '';

    ocrProcess.stdout?.on('data', (chunk: Buffer) => {
      stdoutBuffer += chunk.toString();

      const lines = stdoutBuffer.split('\n');
      stdoutBuffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
          const result: OCRResult = JSON.parse(trimmed);
          clearTimeout(timeout);

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

            resolve({ text: extractedText, confidence: avgConfidence });
          } else {
            resolve({ text: '', confidence: 0 });
          }

          ocrProcess.kill();
        } catch (parseErr) {
          console.error('[OCR Worker] Failed to parse response:', trimmed);
        }
      }
    });

    ocrProcess.stderr?.on('data', (chunk: Buffer) => {
      console.error('[OCR Worker] stderr:', chunk.toString().trim());
    });

    ocrProcess.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    ocrProcess.on('exit', (code) => {
      clearTimeout(timeout);
      reject(new Error(`OCR process exited with code ${code}`));
    });

    const jsonRequest = JSON.stringify({ image_path: imagePath }) + '\n';
    ocrProcess.stdin?.write(jsonRequest);
  });
}

parentPort?.on('message', async (request: OCRWorkerRequest) => {
  try {
    const result = await processOCR(request);
    parentPort?.postMessage({
      id: request.id,
      success: true,
      result,
    });
  } catch (error) {
    parentPort?.postMessage({
      id: request.id,
      success: false,
      error: String(error),
    });
  }
});
