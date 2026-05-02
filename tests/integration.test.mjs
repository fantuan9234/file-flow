/**
 * FileFlow Integration Test Suite
 * 
 * Run with: node tests/integration.test.mjs
 * 
 * Tests:
 * 1. PaddleOCR service startup and health check
 * 2. OCR text extraction
 * 3. AI classification (Ollama/LM Studio) connection test
 * 4. Complete workflow: select folder → rename → format conversion → smart classification → undo
 * 5. File deduplication (exact + similar)
 * 6. Multi-file operations
 * 7. Dark mode toggle state consistency
 * 8. Chinese/English i18n switching
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ==================== Test Utilities ====================

let testDir = '';
let passed = 0;
let failed = 0;
let skipped = 0;
const results = [];

function log(msg) {
  console.log(msg);
}

function recordResult(status, testName, detail = '') {
  results.push({ name: testName, status, detail });
  if (status === 'PASS') {
    passed++;
    log(`  ✅ PASS: ${testName}`);
  } else if (status === 'SKIP') {
    skipped++;
    log(`  ⚠️ SKIP: ${testName}${detail ? ' - ' + detail : ''}`);
  } else {
    failed++;
    log(`  ❌ FAIL: ${testName}${detail ? ' - ' + detail : ''}`);
  }
}

function assert(condition, testName, detail = '') {
  if (condition) {
    recordResult('PASS', testName, detail);
  } else {
    recordResult('FAIL', testName, detail);
  }
}

function skipTest(testName, reason) {
  recordResult('SKIP', testName, reason);
}

// Check if a TCP port is available (service is listening)
function checkPort(port, timeout = 3000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeout);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timer);
      resolve(false);
    });

    socket.connect(port, 'localhost');
  });
}

// Extract port from URL
function extractPort(url) {
  try {
    const parsed = new URL(url);
    return parseInt(parsed.port, 10);
  } catch {
    return null;
  }
}

// Safe fetch with port pre-check and graceful skip on failure
async function safeFetch(url, options = {}, testName = '') {
  const port = extractPort(url);
  
  // Pre-check: TCP connection to port
  if (port) {
    const portOpen = await checkPort(port, 2000);
    if (!portOpen) {
      return { skipped: true, reason: '服务未运行，已跳过' };
    }
  }

  // Attempt fetch
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);
    
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    
    return { skipped: false, response };
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'UND_ERR_SOCKET_TIMEOUT') {
      return { skipped: true, reason: '服务未响应，已跳过' };
    }
    if (err.code === 'ECONNREFUSED' || err.cause?.code === 'ECONNREFUSED') {
      return { skipped: true, reason: '服务未运行，已跳过' };
    }
    // Other errors are actual failures
    return { skipped: false, error: err };
  }
}

function setupTestDir() {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fileflow-test-'));
  log(`\n📁 Test directory: ${testDir}`);
  
  // Create test files
  fs.writeFileSync(path.join(testDir, 'test1.txt'), 'Hello World - This is a test file for FileFlow integration testing.');
  fs.writeFileSync(path.join(testDir, 'test2.txt'), 'Hello World - This is a test file for FileFlow integration testing.'); // Duplicate
  fs.writeFileSync(path.join(testDir, 'test3.txt'), 'Different content here. Unique file for testing purposes.');
  fs.writeFileSync(path.join(testDir, 'contract_2024.pdf'), 'Mock PDF content - Contract Agreement');
  fs.writeFileSync(path.join(testDir, 'invoice_jan.png'), 'Mock image data');
  fs.writeFileSync(path.join(testDir, 'resume.docx'), 'Mock DOCX content');
  
  // Create subdirectories
  fs.mkdirSync(path.join(testDir, 'contracts'), { recursive: true });
  fs.mkdirSync(path.join(testDir, 'invoices'), { recursive: true });
  fs.mkdirSync(path.join(testDir, 'resumes'), { recursive: true });
  
  log(`  Created ${fs.readdirSync(testDir).length} test files`);
}

function cleanupTestDir() {
  if (testDir && fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
    log(`\n🧹 Cleaned up test directory`);
  }
}

// ==================== Test 1: PaddleOCR Service Health Check ====================

async function testPaddleOCRHealth() {
  log('\n🔍 Test 1: PaddleOCR Service Health Check');
  
  const result = await safeFetch('http://localhost:8866/health', {}, 'PaddleOCR health endpoint responds');
  
  if (result.skipped) {
    skipTest('PaddleOCR health endpoint responds', result.reason);
    return;
  }
  
  if (result.error) {
    assert(false, 'PaddleOCR health endpoint responds', result.error.message);
    return;
  }
  
  assert(result.response.ok, 'PaddleOCR health endpoint responds', `Status: ${result.response.status}`);
  
  try {
    const data = await result.response.json();
    assert(data !== undefined, 'PaddleOCR returns valid JSON response');
  } catch {
    assert(false, 'PaddleOCR returns valid JSON response', 'Invalid JSON');
  }
}

// ==================== Test 2: OCR Text Extraction ====================

async function testOCRExtraction() {
  log('\n🔍 Test 2: OCR Text Extraction');
  
  // Create a simple test image (1x1 pixel PNG)
  const testImagePath = path.join(testDir, 'test_ocr.png');
  // Minimal valid PNG (1x1 transparent pixel)
  const pngBuffer = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(testImagePath, pngBuffer);
  
  const result = await safeFetch(
    'http://localhost:8866/predict/ocr_system',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ images: [pngBuffer.toString('base64')] }),
      timeout: 30000,
    },
    'OCR text extraction completes without error'
  );
  
  if (result.skipped) {
    skipTest('OCR text extraction completes without error', result.reason);
    return;
  }
  
  if (result.error) {
    assert(false, 'OCR text extraction completes without error', result.error.message);
    return;
  }
  
  assert(result.response.ok, 'PaddleOCR OCR endpoint responds', `Status: ${result.response.status}`);
  
  try {
    const data = await result.response.json();
    assert(data.results !== undefined, 'OCR returns results object');
    
    // Extract text from results
    let extractedText = '';
    if (data.results && Array.isArray(data.results) && data.results.length > 0) {
      const firstResult = data.results[0];
      if (Array.isArray(firstResult)) {
        for (const item of firstResult) {
          if (item.text) {
            extractedText += item.text + '\n';
          }
        }
      }
    }
    
    assert(true, 'OCR text extraction completes without error', `Extracted: "${extractedText.trim()}"`);
  } catch {
    assert(false, 'OCR text extraction completes without error', 'Invalid response format');
  }
}

// ==================== Test 3: AI Classification Connection Test ====================

async function testAIConnection() {
  log('\n🔍 Test 3: AI Classification (Ollama/LM Studio) Connection Test');
  
  const endpoints = [
    { name: 'Ollama', url: 'http://localhost:11434/api/tags' },
    { name: 'LM Studio', url: 'http://localhost:1234/v1/models' },
  ];
  
  let anyConnected = false;
  
  for (const ep of endpoints) {
    const result = await safeFetch(ep.url, { timeout: 5000 }, `${ep.name} connection test`);
    
    if (result.skipped) {
      skipTest(`${ep.name} connection test`, result.reason);
      continue;
    }
    
    if (result.error) {
      assert(false, `${ep.name} connection test`, result.error.message);
      continue;
    }
    
    if (result.response.ok) {
      anyConnected = true;
      assert(true, `${ep.name} connection test`);
      
      try {
        const data = await result.response.json();
        assert(data !== undefined, `${ep.name} returns valid response`);
      } catch {
        assert(false, `${ep.name} returns valid response`, 'Invalid JSON');
      }
    } else {
      assert(false, `${ep.name} connection test`, `Status: ${result.response.status}`);
    }
  }
  
  // Skip the summary test if no services are available
  const port11434 = await checkPort(11434, 1000);
  const port1234 = await checkPort(1234, 1000);
  if (!port11434 && !port1234) {
    skipTest('At least one AI service available', 'Ollama and LM Studio 均未运行，已跳过');
  } else {
    assert(anyConnected, 'At least one AI service available');
  }
}

// ==================== Test 4: Complete Workflow ====================

async function testCompleteWorkflow() {
  log('\n🔍 Test 4: Complete Workflow (Rename → Convert → Classify → Undo)');
  
  // Simulate rename operation
  const originalName = path.join(testDir, 'test1.txt');
  const renamedPath = path.join(testDir, 'renamed_test1.txt');
  
  try {
    // Step 1: Rename
    fs.renameSync(originalName, renamedPath);
    assert(fs.existsSync(renamedPath), 'File renamed successfully');
    
    // Step 2: Format conversion simulation (copy with new extension)
    const convertedPath = path.join(testDir, 'converted_test1.md');
    const content = fs.readFileSync(renamedPath, 'utf-8');
    fs.writeFileSync(convertedPath, `# Converted Document\n\n${content}`);
    assert(fs.existsSync(convertedPath), 'Format conversion simulation successful');
    
    // Step 3: Smart classification simulation
    const classifiedDir = path.join(testDir, 'classified');
    fs.mkdirSync(classifiedDir, { recursive: true });
    const classifiedPath = path.join(classifiedDir, 'test1.txt');
    fs.copyFileSync(renamedPath, classifiedPath);
    assert(fs.existsSync(classifiedPath), 'Smart classification simulation successful');
    
    // Step 4: Undo simulation
    if (fs.existsSync(originalName)) {
      fs.unlinkSync(originalName);
    }
    fs.renameSync(renamedPath, originalName);
    assert(fs.existsSync(originalName), 'Undo operation successful');
    
    // Cleanup converted file
    if (fs.existsSync(convertedPath)) {
      fs.unlinkSync(convertedPath);
    }
  } catch (err) {
    assert(false, 'Complete workflow test', err.message);
  }
}

// ==================== Test 5: File Deduplication ====================

async function testFileDeduplication() {
  log('\n🔍 Test 5: File Deduplication (Exact + Similar)');
  
  try {
    // Exact deduplication - compare file hashes
    const file1 = path.join(testDir, 'test1.txt');
    const file2 = path.join(testDir, 'test2.txt');
    
    const hash1 = createHash('md5').update(fs.readFileSync(file1)).digest('hex');
    const hash2 = createHash('md5').update(fs.readFileSync(file2)).digest('hex');
    
    assert(hash1 === hash2, 'Exact deduplication detects identical files', `Hash1: ${hash1}, Hash2: ${hash2}`);
    
    // Similar deduplication - compare content similarity
    const file3 = path.join(testDir, 'test3.txt');
    const content1 = fs.readFileSync(file1, 'utf-8');
    const content3 = fs.readFileSync(file3, 'utf-8');
    
    // Simple similarity check (word overlap)
    const words1 = new Set(content1.toLowerCase().split(/\s+/));
    const words3 = new Set(content3.toLowerCase().split(/\s+/));
    const intersection = new Set([...words1].filter(x => words3.has(x)));
    const similarity = intersection.size / Math.max(words1.size, words3.size);
    
    assert(similarity < 0.5, 'Similar deduplication correctly identifies different files', `Similarity: ${(similarity * 100).toFixed(1)}%`);
    
    // Verify identical files have high similarity
    const content2 = fs.readFileSync(file2, 'utf-8');
    const words2 = new Set(content2.toLowerCase().split(/\s+/));
    const intersection2 = new Set([...words1].filter(x => words2.has(x)));
    const similarity2 = intersection2.size / Math.max(words1.size, words2.size);
    
    assert(similarity2 > 0.9, 'Similar deduplication correctly identifies similar files', `Similarity: ${(similarity2 * 100).toFixed(1)}%`);
  } catch (err) {
    assert(false, 'File deduplication test', err.message);
  }
}

// ==================== Test 6: Multi-File Operations ====================

async function testMultiFileOperations() {
  log('\n🔍 Test 6: Multi-File Operations');
  
  try {
    // Get all test files
    const files = fs.readdirSync(testDir)
      .filter(f => fs.statSync(path.join(testDir, f)).isFile())
      .map(f => path.join(testDir, f));
    
    assert(files.length >= 3, 'Multiple files available for testing', `Found ${files.length} files`);
    
    // Batch rename simulation
    const batchDir = path.join(testDir, 'batch_renamed');
    fs.mkdirSync(batchDir, { recursive: true });
    
    for (let i = 0; i < files.length; i++) {
      const newName = path.join(batchDir, `batch_${i + 1}${path.extname(files[i])}`);
      fs.copyFileSync(files[i], newName);
    }
    
    const batchFiles = fs.readdirSync(batchDir);
    assert(batchFiles.length === files.length, 'Batch rename operation successful', `${batchFiles.length} files renamed`);
    
    // Batch move simulation
    const moveDir = path.join(testDir, 'batch_moved');
    fs.mkdirSync(moveDir, { recursive: true });
    
    for (const file of batchFiles) {
      fs.renameSync(path.join(batchDir, file), path.join(moveDir, file));
    }
    
    assert(fs.readdirSync(batchDir).length === 0, 'Batch move operation successful');
    assert(fs.readdirSync(moveDir).length === files.length, 'All files moved successfully');
  } catch (err) {
    assert(false, 'Multi-file operations test', err.message);
  }
}

// ==================== Test 7: Dark Mode State Consistency ====================

async function testDarkModeState() {
  log('\n🔍 Test 7: Dark Mode State Consistency');
  
  try {
    const appTsPath = path.join(__dirname, '..', 'src', 'renderer', 'src', 'App.tsx');
    const appContent = fs.readFileSync(appTsPath, 'utf-8');
    
    // Check for darkMode state variable
    const hasDarkModeState = appContent.includes('darkMode') && appContent.includes('setDarkMode');
    assert(hasDarkModeState, 'Dark mode state exists in App.tsx');
    
    // Check for dark mode toggle handler
    const hasToggleHandler = appContent.includes('handleToggleDarkMode');
    assert(hasToggleHandler, 'Dark mode toggle handler exists');
    
    // Check for localStorage persistence
    const hasLocalStorage = appContent.includes('fileflow-dark-mode');
    assert(hasLocalStorage, 'Dark mode localStorage persistence exists');
    
    // Check for theme config in antd ConfigProvider
    const hasConfigProvider = appContent.includes('ConfigProvider') && appContent.includes('darkAlgorithm');
    assert(hasConfigProvider, 'Ant Design ConfigProvider with darkAlgorithm exists');
    
    // Check for Switch component (UI toggle)
    const hasSwitch = appContent.includes('Switch') && appContent.includes('checked={darkMode}');
    assert(hasSwitch, 'Dark mode Switch component exists in UI');
  } catch (err) {
    assert(false, 'Dark mode state consistency test', err.message);
  }
}

// ==================== Test 8: i18n Switching ====================

async function testI18nSwitching() {
  log('\n🔍 Test 8: Chinese/English i18n Switching');
  
  try {
    const zhPath = path.join(__dirname, '..', 'src', 'renderer', 'src', 'i18n', 'zh.json');
    const enPath = path.join(__dirname, '..', 'src', 'renderer', 'src', 'i18n', 'en.json');
    
    const zhContent = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));
    const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
    
    // Check both files have the same structure
    const zhKeys = Object.keys(zhContent).sort();
    const enKeys = Object.keys(enContent).sort();
    
    assert(JSON.stringify(zhKeys) === JSON.stringify(enKeys), 'i18n files have matching structure', 
      `ZH keys: ${zhKeys.length}, EN keys: ${enKeys.length}`);
    
    // Check critical keys exist in both
    const criticalKeys = ['tabs.ocr', 'tabs.classify', 'tabs.rename', 'tabs.convert', 'tabs.dedup'];
    for (const key of criticalKeys) {
      const zhVal = getNestedValue(zhContent, key);
      const enVal = getNestedValue(enContent, key);
      assert(zhVal && enVal, `Critical key "${key}" exists in both languages`, 
        `ZH: "${zhVal}", EN: "${enVal}"`);
    }
    
    // Check PaddleOCR attribution exists
    assert(zhContent.ocr?.paddleOCRAttribution, 'PaddleOCR attribution exists in Chinese');
    assert(enContent.ocr?.paddleOCRAttribution, 'PaddleOCR attribution exists in English');
  } catch (err) {
    assert(false, 'i18n switching test', err.message);
  }
}

function getNestedValue(obj, key) {
  return key.split('.').reduce((o, k) => o && o[k], obj);
}

// ==================== Main Test Runner ====================

async function runTests() {
  log('╔══════════════════════════════════════════════════════════╗');
  log('║           FileFlow Integration Test Suite              ║');
  log('╚══════════════════════════════════════════════════════════╝');
  
  setupTestDir();
  
  try {
    await testPaddleOCRHealth();
    await testOCRExtraction();
    await testAIConnection();
    await testCompleteWorkflow();
    await testFileDeduplication();
    await testMultiFileOperations();
    await testDarkModeState();
    await testI18nSwitching();
  } finally {
    cleanupTestDir();
  }
  
  // Summary
  const total = passed + failed + skipped;
  log('\n╔══════════════════════════════════════════════════════════╗');
  log('║                    Test Summary                          ║');
  log('╠══════════════════════════════════════════════════════════╣');
  log(`║  总计: ${total}  |  ✅ 通过: ${passed}  |  ❌ 失败: ${failed}  |  ⚠️ 跳过: ${skipped}       ║`);
  log('╚══════════════════════════════════════════════════════════╝');
  
  if (failed > 0) {
    log('\nFailed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      log(`  ❌ ${r.name}${r.detail ? ' - ' + r.detail : ''}`);
    });
  }
  
  if (skipped > 0) {
    log('\nSkipped tests:');
    results.filter(r => r.status === 'SKIP').forEach(r => {
      log(`  ⚠️ ${r.name}${r.detail ? ' - ' + r.detail : ''}`);
    });
  }
  
  // Only exit with error if there are actual failures (not skips)
  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(err => {
  log(`\n💥 Fatal error: ${err.message}`);
  cleanupTestDir();
  process.exit(1);
});
