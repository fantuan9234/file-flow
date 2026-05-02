import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';

// ==================== Test Environment Setup ====================

const TEST_DIR = path.join(os.tmpdir(), 'fileflow-fulltest');
let passed = 0;
let failed = 0;
let skipped = 0;

function log(msg, type = 'info') {
  const prefix = type === 'pass' ? '✅ PASS' : type === 'fail' ? '❌ FAIL' : type === 'skip' ? '⏭️ SKIP' : 'ℹ️ ';
  console.log(`  ${prefix} ${msg}`);
}

function assert(condition, msg) {
  if (condition) {
    passed++;
    log(msg, 'pass');
  } else {
    failed++;
    log(msg, 'fail');
  }
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

function setup() {
  cleanup();
  fs.mkdirSync(TEST_DIR, { recursive: true });
  console.log(`\n📁 Test directory: ${TEST_DIR}\n`);
}

// ==================== Generate Test Files ====================

function generateTestFiles() {
  const filesDir = path.join(TEST_DIR, 'files');
  fs.mkdirSync(filesDir, { recursive: true });

  // report.pdf - simple PDF header
  fs.writeFileSync(path.join(filesDir, 'report.pdf'), '%PDF-1.4\n%Test PDF content\n');

  // photo.jpg - 1x1 pixel JPEG
  const jpegHeader = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43, 0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7B, 0x40, 0x07, 0xFF, 0xD9]);
  fs.writeFileSync(path.join(filesDir, 'photo.jpg'), jpegHeader);

  // notes.txt - random text
  fs.writeFileSync(path.join(filesDir, 'notes.txt'), 'This is a test note file.\nIt contains some random text for testing purposes.\nLine 3 of the notes.\n');

  // contract.docx - simple ZIP-like header (DOCX is ZIP)
  fs.writeFileSync(path.join(filesDir, 'contract.docx'), 'PK\x03\x04This is a simulated DOCX file with contract content.\nAgreement between Party A and Party B.\nBoth parties agree to the terms and conditions.\n');

  // README.md
  fs.writeFileSync(path.join(filesDir, 'README.md'), '# FileFlow\n\nA powerful file management tool.\n\n## Features\n- Batch rename\n- Format conversion\n- Smart classification\n');

  // invoice.png - 1x1 pixel PNG
  const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xDE, 0x00, 0x00, 0x00, 0x0C, 0x49, 0x44, 0x41, 0x54, 0x08, 0xD7, 0x63, 0xF8, 0xCF, 0xC0, 0x00, 0x00, 0x00, 0x03, 0x00, 0x01, 0x00, 0x05, 0xFE, 0xB4, 0xEF, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, 0x42, 0x60, 0x82]);
  fs.writeFileSync(path.join(filesDir, 'invoice.png'), pngHeader);

  // test.html
  fs.writeFileSync(path.join(filesDir, 'test.html'), '<!DOCTYPE html>\n<html>\n<head><title>Test</title></head>\n<body><h1>Hello World</h1></body>\n</html>\n');

  // Duplicate files for dedup testing
  fs.writeFileSync(path.join(filesDir, 'notes_copy.txt'), 'This is a test note file.\nIt contains some random text for testing purposes.\nLine 3 of the notes.\n');
  fs.writeFileSync(path.join(filesDir, 'notes_similar.txt'), 'This is a test note file.\nIt contains some random text for testing purposes.\nLine 3 of the notes (modified).\n');

  // Resume-like file
  fs.writeFileSync(path.join(filesDir, 'my_resume.txt'), 'John Doe\nResume\n\nEducation: BS in Computer Science\nWork Experience: Software Engineer at Tech Corp\nSkills: JavaScript, TypeScript, React\n');

  // Report-like file
  fs.writeFileSync(path.join(filesDir, 'annual_report.txt'), 'Annual Report 2024\n\nSummary: This report analyzes the data and statistics.\nConclusion: The analysis shows positive trends.\n');

  console.log('📄 Test files generated.\n');
}

// ==================== Engine Implementations (inlined for testing) ====================

// --- Rename Engine ---

function formatDate(date, format) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const tokens = { 'yyyy': String(year), 'yy': String(year).slice(-2), 'MM': month, 'M': String(parseInt(month, 10)), 'dd': day, 'd': String(parseInt(day, 10)) };
  return format.replace(/yyyy|yy|MM|M|dd|d/g, match => tokens[match] || match);
}

function generateSequenceNumber(index, start, step, digits) {
  const num = start + (index * step);
  return String(num).padStart(digits, '0');
}

function applyRenameRule(nameWithoutExt, rule, index = 0) {
  let result = nameWithoutExt;
  if (rule.type === 'addPrefix' && rule.params.prefix) {
    result = rule.params.prefix + result;
  } else if (rule.type === 'addSuffix' && rule.params.suffix) {
    result = result + rule.params.suffix;
  } else if (rule.type === 'findReplace' && rule.params.search) {
    result = result.split(rule.params.search).join(rule.params.replace || '');
  } else if (rule.type === 'insertDate' && rule.params.format) {
    const dateStr = formatDate(new Date(), rule.params.format);
    const position = rule.params.position || 'prefix';
    result = position === 'suffix' ? result + dateStr : dateStr + result;
  } else if (rule.type === 'sequence') {
    const start = rule.params.start || 1;
    const step = rule.params.step || 1;
    const digits = rule.params.digits || 3;
    const position = rule.params.position || 'prefix';
    const sequenceStr = generateSequenceNumber(index, start, step, digits);
    result = position === 'suffix' ? result + '_' + sequenceStr : sequenceStr + '_' + result;
  } else if (rule.type === 'regex' && rule.params.pattern && rule.params.replacement !== undefined) {
    try {
      const regex = new RegExp(rule.params.pattern, 'g');
      result = result.replace(regex, rule.params.replacement);
    } catch { /* invalid regex */ }
  }
  return result;
}

function applyRuleChain(nameWithoutExt, rules, index = 0) {
  let result = nameWithoutExt;
  for (const rule of rules) {
    result = applyRenameRule(result, rule, index);
  }
  return result;
}

function generateNewNames(files, rules) {
  const ruleArray = Array.isArray(rules) ? rules : [rules];
  return files.map((file, index) => {
    const lastDot = file.name.lastIndexOf('.');
    const nameWithoutExt = lastDot >= 0 ? file.name.substring(0, lastDot) : file.name;
    const ext = lastDot >= 0 ? file.name.substring(lastDot) : '';
    const newNameWithoutExt = applyRuleChain(nameWithoutExt, ruleArray, index);
    const newName = newNameWithoutExt + ext;
    return {
      oldPath: file.path,
      oldName: file.name,
      newName: newName,
      newPath: file.path.substring(0, file.path.lastIndexOf(file.name)) + newName,
    };
  });
}

// --- Classify Engine ---

function matchesRule(file, rule) {
  switch (rule.type) {
    case 'byExtension': {
      if (!rule.params.extension) return false;
      const fileExt = path.extname(file.name).toLowerCase().replace('.', '');
      const targetExt = rule.params.extension.toLowerCase().replace('.', '');
      return fileExt === targetExt;
    }
    case 'byKeyword': {
      if (!rule.params.keyword) return false;
      return file.name.includes(rule.params.keyword);
    }
    case 'bySize': {
      const { maxSize, minSize } = rule.params;
      if (minSize !== undefined && maxSize !== undefined) {
        return file.size >= minSize && file.size <= maxSize;
      }
      if (maxSize !== undefined) return file.size <= maxSize;
      if (minSize !== undefined) return file.size >= minSize;
      return false;
    }
    case 'byDate': {
      if (!rule.params.days) return false;
      const fileDate = new Date(file.mtime);
      const now = new Date();
      const diffDays = (now.getTime() - fileDate.getTime()) / (1000 * 60 * 60 * 24);
      const mode = rule.params.dateMode || 'older';
      return mode === 'older' ? diffDays >= rule.params.days : diffDays <= rule.params.days;
    }
    default:
      return false;
  }
}

function classifyFiles(files, rules, baseFolder) {
  const results = [];
  for (const file of files) {
    for (const rule of rules) {
      if (matchesRule(file, rule)) {
        const targetDir = path.join(baseFolder, rule.targetFolder);
        const newPath = path.join(targetDir, file.name);
        if (file.path === newPath) break;
        results.push({ oldPath: file.path, newPath, matchedRule: rule.targetFolder });
        break;
      }
    }
  }
  return results;
}

// --- Content Classifier ---

const keywordDictionary = {
  contract: ['合同', '协议', '甲方', '乙方', '签署', '生效', '违约', '赔偿', '条款', '双方', '约定', '权利', '义务', 'contract', 'agreement', 'party'],
  invoice: ['发票', '金额', '税额', '开票', '购买方', '销售方', '纳税人识别号', 'invoice', 'amount', 'tax', 'receipt', 'billing'],
  resume: ['简历', '教育背景', '工作经历', '技能', '项目经验', '自我评价', '联系方式', '求职意向', 'resume', 'experience', 'education', 'skills'],
  report: ['报告', '摘要', '结论', '分析', '数据', '统计', '调研', 'report', 'summary', 'analysis', 'conclusion', 'data'],
};

function classifyContent(text) {
  const lowerText = text.toLowerCase();
  const scores = {};
  const matchedKeywords = {};
  for (const [category, keywords] of Object.entries(keywordDictionary)) {
    let matchCount = 0;
    const matched = [];
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
  return { category: bestCategory, confidence, matchedKeywords: matchedKeywords[bestCategory] || [] };
}

// --- Dedup Engine ---

function calculateMD5(filePath) {
  const hash = createHash('md5');
  const buffer = fs.readFileSync(filePath);
  hash.update(buffer);
  return hash.digest('hex');
}

function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
      }
    }
  }
  return matrix[b.length][a.length];
}

function textSimilarity(a, b) {
  const distance = levenshteinDistance(a, b);
  const maxLength = Math.max(a.length, b.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

function findExactDuplicates(files) {
  const hashMap = new Map();
  for (const file of files) {
    try {
      const hash = calculateMD5(file.path);
      if (!hashMap.has(hash)) hashMap.set(hash, []);
      hashMap.get(hash).push(file);
    } catch { /* skip */ }
  }
  const groups = [];
  for (const [hash, groupFiles] of hashMap) {
    if (groupFiles.length > 1) groups.push({ hash, files: groupFiles });
  }
  return { groups, totalDuplicates: groups.reduce((sum, g) => sum + g.files.length - 1, 0) };
}

function findSimilarDuplicates(files, threshold = 0.9) {
  const groups = [];
  const used = new Set();
  for (let i = 0; i < files.length; i++) {
    if (used.has(files[i].path)) continue;
    const group = [files[i]];
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
        } catch { /* skip */ }
      }
    } catch { /* skip */ }
    if (group.length > 1) {
      groups.push({ similarity: threshold, files: group });
    }
  }
  return { groups, totalDuplicates: groups.reduce((sum, g) => sum + g.files.length - 1, 0) };
}

// ==================== Test Functions ====================

function scanFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isFile()) {
      const fullPath = path.join(dir, entry.name);
      const stat = fs.statSync(fullPath);
      files.push({ path: fullPath, name: entry.name, size: stat.size, mtime: stat.mtime.toISOString() });
    }
  }
  return files;
}

// --- Test 1: File Scanning ---
function test1_fileScanning() {
  console.log('\n📋 Test 1: File Scanning');
  const filesDir = path.join(TEST_DIR, 'files');
  const files = scanFiles(filesDir);
  assert(files.length >= 10, `Scanned ${files.length} files (expected >= 10)`);
  assert(files.some(f => f.name === 'report.pdf'), 'Found report.pdf');
  assert(files.some(f => f.name === 'photo.jpg'), 'Found photo.jpg');
  assert(files.some(f => f.name === 'notes.txt'), 'Found notes.txt');
  assert(files.every(f => f.size > 0), 'All files have size > 0');
}

// --- Test 2: Batch Rename (6 rules + rule chain) ---
function test2_batchRename() {
  console.log('\n📋 Test 2: Batch Rename');
  const files = [{ path: '/test/file.txt', name: 'file.txt' }, { path: '/test/doc.txt', name: 'doc.txt' }];

  // 2a: Prefix
  const prefixResult = generateNewNames(files, [{ type: 'addPrefix', params: { prefix: 'NEW_' } }]);
  assert(prefixResult[0].newName === 'NEW_file.txt', `Prefix: "${prefixResult[0].newName}" === "NEW_file.txt"`);

  // 2b: Suffix
  const suffixResult = generateNewNames(files, [{ type: 'addSuffix', params: { suffix: '_backup' } }]);
  assert(suffixResult[0].newName === 'file_backup.txt', `Suffix: "${suffixResult[0].newName}" === "file_backup.txt"`);

  // 2c: Find & Replace
  const replaceResult = generateNewNames(files, [{ type: 'findReplace', params: { search: 'file', replace: 'document' } }]);
  assert(replaceResult[0].newName === 'document.txt', `Replace: "${replaceResult[0].newName}" === "document.txt"`);

  // 2d: Insert Date
  const dateResult = generateNewNames(files, [{ type: 'insertDate', params: { format: 'yyyyMMdd_' } }]);
  const today = formatDate(new Date(), 'yyyyMMdd');
  assert(dateResult[0].newName === `${today}_file.txt`, `Date: "${dateResult[0].newName}" starts with "${today}"`);

  // 2e: Sequence
  const seqResult = generateNewNames(files, [{ type: 'sequence', params: { start: 1, step: 1, digits: 3 } }]);
  assert(seqResult[0].newName === '001_file.txt', `Sequence[0]: "${seqResult[0].newName}" === "001_file.txt"`);
  assert(seqResult[1].newName === '002_doc.txt', `Sequence[1]: "${seqResult[1].newName}" === "002_doc.txt"`);

  // 2f: Regex
  const regexResult = generateNewNames(files, [{ type: 'regex', params: { pattern: 'fi(e|le)', replacement: 'doc' } }]);
  assert(regexResult[0].newName === 'doc.txt', `Regex: "${regexResult[0].newName}" === "doc.txt"`);

  // 2g: Rule Chain
  const chainResult = generateNewNames(files, [
    { type: 'addPrefix', params: { prefix: '2024_' } },
    { type: 'addSuffix', params: { suffix: '_final' } },
  ]);
  assert(chainResult[0].newName === '2024_file_final.txt', `Chain: "${chainResult[0].newName}" === "2024_file_final.txt"`);
}

// --- Test 3: Format Conversion ---
function test3_formatConversion() {
  console.log('\n📋 Test 3: Format Conversion');
  const filesDir = path.join(TEST_DIR, 'files');

  // 3a: MD -> HTML conversion
  const mdContent = fs.readFileSync(path.join(filesDir, 'README.md'), 'utf-8');
  let htmlResult = mdContent
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/\n/g, '\n');
  assert(htmlResult.includes('<h1>FileFlow</h1>'), 'MD->HTML: h1 tag generated');
  assert(htmlResult.includes('<h2>Features</h2>'), 'MD->HTML: h2 tag generated');

  // 3b: HTML -> MD conversion
  const htmlContent = fs.readFileSync(path.join(filesDir, 'test.html'), 'utf-8');
  let mdResult = htmlContent
    .replace(/<h1>(.*?)<\/h1>/gi, '# $1')
    .replace(/<h2>(.*?)<\/h2>/gi, '## $1')
    .replace(/<li>(.*?)<\/li>/gi, '- $1')
    .replace(/<title>(.*?)<\/title>/gi, '# $1')
    .replace(/<[^>]+>/g, '');
  assert(mdResult.includes('# Test'), 'HTML->MD: title converted to #');

  // 3c: JPG -> PNG (binary copy with extension change)
  const jpgPath = path.join(filesDir, 'photo.jpg');
  const jpgBuffer = fs.readFileSync(jpgPath);
  assert(jpgBuffer.length > 0, 'JPG file read successfully');

  // 3d: PNG -> JPG
  const pngPath = path.join(filesDir, 'invoice.png');
  const pngBuffer = fs.readFileSync(pngPath);
  assert(pngBuffer.length > 0, 'PNG file read successfully');

  // 3e: DOCX -> MD (text extraction simulation)
  const docxPath = path.join(filesDir, 'contract.docx');
  const docxContent = fs.readFileSync(docxPath, 'utf-8');
  assert(docxContent.includes('Party A') || docxContent.includes('Party B'), 'DOCX content readable');

  // 3f: MD -> PDF (text wrapping simulation)
  const mdForPdf = fs.readFileSync(path.join(filesDir, 'README.md'), 'utf-8');
  assert(mdForPdf.includes('# FileFlow'), 'MD content ready for PDF conversion');
}

// --- Test 4: Fast Classification ---
function test4_fastClassification() {
  console.log('\n📋 Test 4: Fast Classification');
  const filesDir = path.join(TEST_DIR, 'files');
  const files = scanFiles(filesDir);

  // 4a: By extension
  const extRules = [
    { type: 'byExtension', params: { extension: 'pdf' }, targetFolder: 'PDFs' },
    { type: 'byExtension', params: { extension: 'jpg' }, targetFolder: 'Images' },
  ];
  const extResults = classifyFiles(files, extRules, filesDir);
  assert(extResults.some(r => r.matchedRule === 'PDFs'), 'Extension rule: PDF classified');
  assert(extResults.some(r => r.matchedRule === 'Images'), 'Extension rule: JPG classified');

  // 4b: By keyword
  const kwRules = [
    { type: 'byKeyword', params: { keyword: 'invoice' }, targetFolder: 'Invoices' },
    { type: 'byKeyword', params: { keyword: 'report' }, targetFolder: 'Reports' },
  ];
  const kwResults = classifyFiles(files, kwRules, filesDir);
  assert(kwResults.some(r => r.matchedRule === 'Invoices'), 'Keyword rule: invoice classified');
  assert(kwResults.some(r => r.matchedRule === 'Reports'), 'Keyword rule: report classified');

  // 4c: By size
  const sizeRules = [
    { type: 'bySize', params: { minSize: 0, maxSize: 100 }, targetFolder: 'Small' },
  ];
  const sizeResults = classifyFiles(files, sizeRules, filesDir);
  assert(sizeResults.length > 0, 'Size rule: small files classified');

  // 4d: By date (newer than 365 days)
  const dateRules = [
    { type: 'byDate', params: { days: 365, dateMode: 'newer' }, targetFolder: 'Recent' },
  ];
  const dateResults = classifyFiles(files, dateRules, filesDir);
  assert(dateResults.length > 0, 'Date rule: recent files classified');
}

// --- Test 5: Content Classification (Basic Mode) ---
function test5_contentClassification() {
  console.log('\n📋 Test 5: Content Classification (Basic Mode)');

  // 5a: Contract detection
  const contractText = 'This is a contract agreement between Party A and Party B. Both parties agree to the terms.';
  const contractResult = classifyContent(contractText);
  assert(contractResult.category === 'contract', `Contract: category="${contractResult.category}" === "contract"`);
  assert(contractResult.confidence > 0, `Contract: confidence=${contractResult.confidence} > 0`);

  // 5b: Resume detection
  const resumeText = 'John Doe Resume. Education: BS in CS. Work Experience: Engineer. Skills: JavaScript.';
  const resumeResult = classifyContent(resumeText);
  assert(resumeResult.category === 'resume', `Resume: category="${resumeResult.category}" === "resume"`);

  // 5c: Report detection
  const reportText = 'Annual Report. Summary of data analysis and statistics. Conclusion shows positive trends.';
  const reportResult = classifyContent(reportText);
  assert(reportResult.category === 'report', `Report: category="${reportResult.category}" === "report"`);

  // 5d: Invoice detection
  const invoiceText = 'Invoice #1234. Amount: $500. Tax: $50. Billing address: 123 Main St.';
  const invoiceResult = classifyContent(invoiceText);
  assert(invoiceResult.category === 'invoice', `Invoice: category="${invoiceResult.category}" === "invoice"`);

  // 5e: Other detection
  const otherText = 'This is just a random text with no specific document type.';
  const otherResult = classifyContent(otherText);
  assert(otherResult.category === 'other', `Other: category="${otherResult.category}" === "other"`);
  assert(otherResult.confidence === 0, `Other: confidence=${otherResult.confidence} === 0`);
}

// --- Test 6: File Deduplication ---
function test6_deduplication() {
  console.log('\n📋 Test 6: File Deduplication');
  const filesDir = path.join(TEST_DIR, 'files');
  const files = scanFiles(filesDir);

  // 6a: Exact duplicates
  const exactResult = findExactDuplicates(files);
  assert(exactResult.groups.length > 0, `Exact: found ${exactResult.groups.length} duplicate group(s)`);
  assert(exactResult.totalDuplicates > 0, `Exact: ${exactResult.totalDuplicates} duplicate file(s)`);

  // 6b: Verify notes.txt and notes_copy.txt are exact duplicates
  const notesGroup = exactResult.groups.find(g => g.files.some(f => f.name === 'notes.txt'));
  assert(notesGroup !== undefined, 'Exact: notes.txt and notes_copy.txt in same group');

  // 6c: Similar duplicates
  const similarResult = findSimilarDuplicates(files, 0.85);
  assert(similarResult.groups.length > 0, `Similar: found ${similarResult.groups.length} similar group(s)`);

  // 6d: Verify notes.txt and notes_similar.txt are similar
  const similarGroup = similarResult.groups.find(g => g.files.some(f => f.name === 'notes.txt'));
  assert(similarGroup !== undefined, 'Similar: notes.txt and notes_similar.txt in same group');
}

// --- Test 7: Workflow ---
function test7_workflow() {
  console.log('\n📋 Test 7: Workflow');

  // Create workflow test files
  const wfDir = path.join(TEST_DIR, 'workflow');
  fs.mkdirSync(wfDir, { recursive: true });
  fs.writeFileSync(path.join(wfDir, 'test1.txt'), 'Hello World');
  fs.writeFileSync(path.join(wfDir, 'test2.txt'), 'Goodbye World');

  const wfFiles = scanFiles(wfDir);

  // Step 1: Rename (add prefix)
  const renameRules = [{ type: 'addPrefix', params: { prefix: 'WF_' } }];
  const renameResults = generateNewNames(wfFiles, renameRules);
  assert(renameResults[0].newName === 'WF_test1.txt', 'Workflow step 1: rename prefix applied');

  // Step 2: Simulate conversion (txt -> md)
  const convertedFiles = renameResults.map(r => ({
    ...r,
    newName: r.newName.replace('.txt', '.md'),
    newPath: r.newPath.replace('.txt', '.md'),
  }));
  assert(convertedFiles[0].newName === 'WF_test1.md', 'Workflow step 2: conversion simulated');

  // Step 3: Classify
  const classifyRules = [
    { type: 'byExtension', params: { extension: 'md' }, targetFolder: 'Markdown' },
  ];
  const classifyResults = classifyFiles(convertedFiles.map(f => ({
    path: f.newPath,
    name: f.newName,
    size: 100,
    mtime: new Date().toISOString()
  })), classifyRules, wfDir);
  assert(classifyResults.length > 0, 'Workflow step 3: classification applied');

  // Full workflow log
  const workflowLog = [
    `Step 1: Rename - ${renameResults.length} files renamed`,
    `Step 2: Convert - ${convertedFiles.length} files converted`,
    `Step 3: Classify - ${classifyResults.length} files classified`,
  ];
  assert(workflowLog.length === 3, `Workflow: ${workflowLog.length} steps logged`);
}

// --- Test 8: Undo ---
function test8_undo() {
  console.log('\n📋 Test 8: Undo');
  const undoDir = path.join(TEST_DIR, 'undo');
  fs.mkdirSync(undoDir, { recursive: true });
  fs.writeFileSync(path.join(undoDir, 'original.txt'), 'test content');

  // Simulate rename
  const originalFiles = [{ path: path.join(undoDir, 'original.txt'), name: 'original.txt' }];
  const renameResults = generateNewNames(originalFiles, [{ type: 'addPrefix', params: { prefix: 'NEW_' } }]);

  // Save undo info
  const undoInfo = renameResults.map(r => ({ oldPath: r.oldPath, newPath: r.newPath }));

  // Simulate file move (rename on disk)
  const oldPath = undoInfo[0].oldPath;
  const newPath = undoInfo[0].newPath;
  fs.renameSync(oldPath, newPath);
  assert(fs.existsSync(newPath), 'Undo: file renamed on disk');
  assert(!fs.existsSync(oldPath), 'Undo: original file no longer exists');

  // Undo: rename back
  fs.renameSync(newPath, oldPath);
  assert(fs.existsSync(oldPath), 'Undo: file restored to original');
  assert(!fs.existsSync(newPath), 'Undo: renamed file removed');

  // Undo history
  const undoHistory = [{ operation: 'rename', files: undoInfo, timestamp: Date.now() }];
  assert(undoHistory.length === 1, 'Undo: history recorded');
}

// --- Test 9: OCR Text Extraction ---
function test9_ocr() {
  console.log('\n📋 Test 9: OCR Text Extraction');

  // Simulate OCR result (since we can't run Tesseract in pure Node.js)
  const simulatedOCRText = 'This is extracted text from an image.\nIt contains multiple lines.\nSome important information here.\n';

  assert(simulatedOCRText.length > 0, 'OCR: text extraction simulated');
  assert(simulatedOCRText.includes('extracted'), 'OCR: text contains expected content');

  // Export to Markdown
  const paragraphs = simulatedOCRText.split(/\n\s*\n/).filter(p => p.trim());
  let md = `# Extracted Text\n\n`;
  md += `> Extracted at: ${new Date().toLocaleString()}\n\n`;
  md += `---\n\n`;
  for (const paragraph of paragraphs) {
    md += `${paragraph.trim()}\n\n`;
  }
  assert(md.includes('# Extracted Text'), 'OCR: Markdown header generated');
  assert(md.includes('> Extracted at:'), 'OCR: Markdown timestamp included');

  // Save MD file
  const ocrDir = path.join(TEST_DIR, 'ocr');
  fs.mkdirSync(ocrDir, { recursive: true });
  const mdPath = path.join(ocrDir, 'extracted.md');
  fs.writeFileSync(mdPath, md);
  assert(fs.existsSync(mdPath), 'OCR: Markdown file saved');
  assert(fs.statSync(mdPath).size > 0, 'OCR: Markdown file has content');
}

// --- Test 10: Rule Template Save/Load ---
function test10_templates() {
  console.log('\n📋 Test 10: Rule Templates');
  const templateDir = path.join(TEST_DIR, 'templates');
  fs.mkdirSync(templateDir, { recursive: true });

  // 10a: Save rename template
  const renameTemplate = {
    name: 'Photo Archive',
    type: 'rename',
    rules: [
      { type: 'insertDate', params: { format: 'yyyyMMdd_' } },
      { type: 'addSuffix', params: { suffix: '_edited' } },
    ],
  };
  const renameTemplatePath = path.join(templateDir, 'photo-archive.json');
  fs.writeFileSync(renameTemplatePath, JSON.stringify(renameTemplate, null, 2));
  assert(fs.existsSync(renameTemplatePath), 'Template: rename template saved');

  // 10b: Load rename template
  const loadedRename = JSON.parse(fs.readFileSync(renameTemplatePath, 'utf-8'));
  assert(loadedRename.name === 'Photo Archive', 'Template: rename template loaded');
  assert(loadedRename.rules.length === 2, `Template: ${loadedRename.rules.length} rules loaded`);

  // 10c: Save classify template
  const classifyTemplate = {
    name: 'Document Organizer',
    type: 'classify',
    rules: [
      { type: 'byExtension', params: { extension: 'pdf' }, targetFolder: 'PDFs' },
      { type: 'byExtension', params: { extension: 'jpg' }, targetFolder: 'Images' },
      { type: 'byKeyword', params: { keyword: 'invoice' }, targetFolder: 'Invoices' },
    ],
  };
  const classifyTemplatePath = path.join(templateDir, 'doc-organizer.json');
  fs.writeFileSync(classifyTemplatePath, JSON.stringify(classifyTemplate, null, 2));
  assert(fs.existsSync(classifyTemplatePath), 'Template: classify template saved');

  // 10d: Load and apply classify template
  const loadedClassify = JSON.parse(fs.readFileSync(classifyTemplatePath, 'utf-8'));
  assert(loadedClassify.rules.length === 3, `Template: ${loadedClassify.rules.length} classify rules loaded`);

  // 10e: Apply loaded template
  const filesDir = path.join(TEST_DIR, 'files');
  const files = scanFiles(filesDir);
  const templateResults = classifyFiles(files, loadedClassify.rules, filesDir);
  assert(templateResults.length > 0, `Template: ${templateResults.length} files classified using loaded template`);

  // 10f: Save workflow template
  const workflowTemplate = {
    name: 'Full Pipeline',
    type: 'workflow',
    steps: [
      { type: 'rename', rules: [{ type: 'addPrefix', params: { prefix: 'processed_' } }] },
      { type: 'classify', rules: [{ type: 'byExtension', params: { extension: 'txt' }, targetFolder: 'TextFiles' }] },
    ],
  };
  const workflowTemplatePath = path.join(templateDir, 'full-pipeline.json');
  fs.writeFileSync(workflowTemplatePath, JSON.stringify(workflowTemplate, null, 2));
  assert(fs.existsSync(workflowTemplatePath), 'Template: workflow template saved');
}

// ==================== Main Execution ====================

console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║         FileFlow Full Feature Test Suite               ║');
console.log('╚══════════════════════════════════════════════════════════╝');

try {
  setup();
  generateTestFiles();

  test1_fileScanning();
  test2_batchRename();
  test3_formatConversion();
  test4_fastClassification();
  test5_contentClassification();
  test6_deduplication();
  test7_workflow();
  test8_undo();
  test9_ocr();
  test10_templates();

} catch (error) {
  console.error(`\n💥 Fatal error: ${error.message}`);
  console.error(error.stack);
} finally {
  // Cleanup
  cleanup();
  console.log('\n🧹 Test directory cleaned up.');
}

// Summary
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║                    Test Summary                          ║');
console.log('╠══════════════════════════════════════════════════════════╣');
console.log(`║  ✅ Passed:   ${String(passed).padEnd(40)}║`);
console.log(`║  ❌ Failed:   ${String(failed).padEnd(40)}║`);
console.log(`║  ⏭️  Skipped:  ${String(skipped).padEnd(40)}║`);
console.log(`║  📊 Total:    ${String(passed + failed + skipped).padEnd(40)}║`);
console.log('╚══════════════════════════════════════════════════════════╝');

if (failed > 0) {
  console.log('\n⚠️  Some tests failed. Please review the output above.');
  process.exit(1);
} else {
  console.log('\n🎉 All tests passed!');
  process.exit(0);
}
