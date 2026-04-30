import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEST_DIR = path.join(__dirname, 'test-convert-temp');

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

function log(msg) { console.log(msg); }
function pass(msg) { log(`${GREEN}✅ PASS${RESET}  ${msg}`); }
function fail(msg) { log(`${RED}❌ FAIL${RESET}  ${msg}`); }
function info(msg) { log(`${CYAN}ℹ️  ${RESET}${msg}`); }
function title(msg) { log(`\n${BOLD}${CYAN}━━━ ${msg} ━━━${RESET}`); }

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function setup() {
  cleanup();
  fs.mkdirSync(TEST_DIR, { recursive: true });
}

async function generateTestFiles() {
  title('生成测试文件');

  // 1. 生成 .docx
  try {
    const { Document, Packer, Paragraph, TextRun } = await import('docx');
    const doc = new Document({
      sections: [{
        children: [
          new Paragraph({
            children: [new TextRun({ text: 'Hello World', bold: true })],
          }),
          new Paragraph({
            children: [new TextRun({ text: 'This is a test document for conversion.' })],
          }),
        ],
      }],
    });
    const buffer = await Packer.toBuffer(doc);
    fs.writeFileSync(path.join(TEST_DIR, 'test.docx'), buffer);
    pass('生成 test.docx');
  } catch (e) {
    fail('生成 test.docx 失败: ' + e.message);
  }

  // 2. 生成 .md
  const mdContent = `# Test Markdown

This is a **test** document for conversion.

## Features

- Item 1
- Item 2
- Item 3

> This is a blockquote.

| Name | Value |
|------|-------|
| A    | 1     |
| B    | 2     |
`;
  fs.writeFileSync(path.join(TEST_DIR, 'test.md'), mdContent, 'utf-8');
  pass('生成 test.md');

  // 3. 生成 .html
  const htmlContent = `<!DOCTYPE html>
<html>
<head><title>Test HTML</title></head>
<body>
<h1>Test HTML Document</h1>
<p>This is a <strong>test</strong> paragraph.</p>
<ul>
<li>Item 1</li>
<li>Item 2</li>
</ul>
</body>
</html>`;
  fs.writeFileSync(path.join(TEST_DIR, 'test.html'), htmlContent, 'utf-8');
  pass('生成 test.html');

  // 4. 用 sharp 生成 .png（100x100 全红色）
  try {
    const sharp = (await import('sharp')).default;
    const redPng = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 255, g: 0, b: 0 },
      },
    }).png().toBuffer();
    fs.writeFileSync(path.join(TEST_DIR, 'test.png'), redPng);
    pass('生成 test.png (100x100 红色)');
  } catch (e) {
    fail('生成 test.png 失败: ' + e.message);
  }

  // 5. 用 sharp 生成 .jpg（100x100 全蓝色）
  try {
    const sharp = (await import('sharp')).default;
    const blueJpg = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 3,
        background: { r: 0, g: 0, b: 255 },
      },
    }).jpeg({ quality: 90 }).toBuffer();
    fs.writeFileSync(path.join(TEST_DIR, 'test.jpg'), blueJpg);
    pass('生成 test.jpg (100x100 蓝色)');
  } catch (e) {
    fail('生成 test.jpg 失败: ' + e.message);
  }

  log('');
}

async function convertFile(sourcePath, sourceType, targetType) {
  const ext = path.extname(sourcePath);
  const baseName = path.basename(sourcePath, ext);
  const dir = path.dirname(sourcePath);
  const outputPath = path.join(dir, baseName + '_out.' + targetType.replace('.', ''));

  switch (sourceType + '→' + targetType) {
    case '.docx→.md': {
      const mammoth = await import('mammoth');
      const buffer = fs.readFileSync(sourcePath);
      const result = await mammoth.convertToMarkdown({ buffer });
      fs.writeFileSync(outputPath, result.value, 'utf-8');
      break;
    }
    case '.md→.html': {
      const { marked } = await import('marked');
      const mdContent = fs.readFileSync(sourcePath, 'utf-8');
      const htmlContent = marked.parse(mdContent);
      const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head><meta charset="UTF-8"><title>${baseName}</title></head>
<body>${htmlContent}</body>
</html>`;
      fs.writeFileSync(outputPath, fullHtml, 'utf-8');
      break;
    }
    case '.md→.pdf': {
      const { mdToPdf } = await import('md-to-pdf');
      const mdContent = fs.readFileSync(sourcePath, 'utf-8');
      await mdToPdf({ content: mdContent }, {
        dest: outputPath,
        pdf_options: { format: 'A4' },
      });
      break;
    }
    case '.html→.md': {
      const TurndownService = (await import('turndown')).default;
      const turndownService = new TurndownService();
      const htmlContent = fs.readFileSync(sourcePath, 'utf-8');
      const mdContent = turndownService.turndown(htmlContent);
      fs.writeFileSync(outputPath, mdContent, 'utf-8');
      break;
    }
    case '.jpg→.png':
    case '.jpeg→.png': {
      const sharp = (await import('sharp')).default;
      await sharp(sourcePath).png().toFile(outputPath);
      break;
    }
    case '.png→.jpg':
    case '.png→.jpeg': {
      const sharp = (await import('sharp')).default;
      await sharp(sourcePath).jpeg({ quality: 90 }).toFile(outputPath);
      break;
    }
    default:
      throw new Error(`不支持的转换: ${sourceType} → ${targetType}`);
  }

  return outputPath;
}

function verifyResult(outputPath, sourceType, targetType) {
  if (!fs.existsSync(outputPath)) {
    return { success: false, reason: '输出文件不存在' };
  }

  const stats = fs.statSync(outputPath);
  if (stats.size === 0) {
    return { success: false, reason: '输出文件大小为 0' };
  }

  if (targetType === '.md') {
    const content = fs.readFileSync(outputPath, 'utf-8');
    if (sourceType === '.docx' && !content.includes('Hello')) {
      return { success: false, reason: 'Markdown 内容不包含预期文本 "Hello"' };
    }
    if (sourceType === '.html' && !content.includes('test')) {
      return { success: false, reason: 'Markdown 内容不包含预期文本 "test"' };
    }
  }

  if (targetType === '.html') {
    const content = fs.readFileSync(outputPath, 'utf-8');
    if (!content.includes('<') || !content.includes('>')) {
      return { success: false, reason: 'HTML 内容不包含标签' };
    }
  }

  if (targetType === '.pdf') {
    if (stats.size < 1000) {
      return { success: false, reason: 'PDF 文件过小 (' + stats.size + ' bytes)' };
    }
  }

  if (targetType === '.png' || targetType === '.jpg' || targetType === '.jpeg') {
    if (stats.size < 50) {
      return { success: false, reason: '图片文件过小 (' + stats.size + ' bytes)' };
    }
  }

  return { success: true, size: stats.size };
}

async function runTests() {
  const testCases = [
    { source: 'test.docx', sourceType: '.docx', target: '.md' },
    { source: 'test.md', sourceType: '.md', target: '.html' },
    { source: 'test.md', sourceType: '.md', target: '.pdf' },
    { source: 'test.html', sourceType: '.html', target: '.md' },
    { source: 'test.jpg', sourceType: '.jpg', target: '.png' },
    { source: 'test.png', sourceType: '.png', target: '.jpg' },
  ];

  let passed = 0;
  let failed = 0;

  for (const tc of testCases) {
    const sourcePath = path.join(TEST_DIR, tc.source);
    const ext = path.extname(tc.source);
    const baseName = path.basename(tc.source, ext);
    const outputPath = path.join(TEST_DIR, baseName + '_out.' + tc.target.replace('.', ''));

    title(`测试: ${tc.sourceType} → ${tc.target} (${tc.source})`);

    if (!fs.existsSync(sourcePath)) {
      fail(`源文件不存在: ${tc.source}，跳过`);
      failed++;
      continue;
    }

    try {
      info('执行转换...');
      const resultPath = await convertFile(sourcePath, tc.sourceType, tc.target);

      info('验证结果...');
      const verify = verifyResult(resultPath, tc.sourceType, tc.target);

      if (verify.success) {
        pass(`${tc.sourceType} → ${tc.target} 成功 (输出大小: ${verify.size} bytes)`);
        passed++;
      } else {
        fail(`${tc.sourceType} → ${tc.target} 失败: ${verify.reason}`);
        failed++;
      }
    } catch (e) {
      fail(`${tc.sourceType} → ${tc.target} 异常: ${e.message}`);
      failed++;
    }
  }

  title('测试总结');
  const total = passed + failed;
  log(`${BOLD}总计: ${total} 项测试${RESET}`);
  log(`${GREEN}通过: ${passed}${RESET}`);
  log(`${RED}失败: ${failed}${RESET}`);
  log('');

  if (failed === 0) {
    log(`${GREEN}${BOLD}🎉 所有测试通过！${RESET}`);
  } else {
    log(`${RED}${BOLD}⚠️  有 ${failed} 项测试失败，请检查上方错误信息。${RESET}`);
  }
}

(async () => {
  try {
    setup();
    await generateTestFiles();
    await runTests();
  } catch (e) {
    log(`${RED}测试脚本异常: ${e.message}${RESET}`);
    log(e.stack);
  } finally {
    cleanup();
    info('已清理临时测试文件');
  }
})();
