import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { join } from 'path';
import fs from 'fs';
import path from 'path';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });

  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL']);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  createWindow();

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

type WorkflowStep = WorkflowRenameStep | WorkflowConvertStep;

interface WorkflowChange {
  type: 'rename' | 'create' | 'delete';
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
        newName = baseName.replaceAll(rule.params.search || '', rule.params.replace || '');
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
