import fs from 'fs';
import path from 'path';
import os from 'os';

// ============================================================
// Embedded classify engine (copied from classifyEngine.ts)
// ============================================================

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
      if (maxSize !== undefined) {
        return file.size <= maxSize;
      }
      if (minSize !== undefined) {
        return file.size >= minSize;
      }
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
        if (file.path === newPath) {
          break;
        }
        results.push({
          oldPath: file.path,
          newPath,
          matchedRule: rule.targetFolder,
        });
        break;
      }
    }
  }
  return results;
}

// ============================================================
// Test helpers
// ============================================================

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition, testName) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✅ PASS: ${testName}`);
  } else {
    failedTests++;
    console.log(`  ❌ FAIL: ${testName}`);
  }
}

function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// ============================================================
// Main test
// ============================================================

async function runTests() {
  console.log('='.repeat(60));
  console.log('FileFlow Workflow - Classify Integration Test');
  console.log('='.repeat(60));
  console.log('');

  // 1. Create test environment
  console.log('[Setup] Creating test environment...');
  const testDir = path.join(os.tmpdir(), 'fileflow-test');
  
  // Clean up if exists
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
  fs.mkdirSync(testDir, { recursive: true });

  // Create test files
  // report.pdf - simple PDF header
  const pdfPath = path.join(testDir, 'report.pdf');
  fs.writeFileSync(pdfPath, '%PDF-1.4\n%test pdf content');

  // photo.jpg - minimal JPEG (1x1 pixel)
  const jpgPath = path.join(testDir, 'photo.jpg');
  const jpgHeader = Buffer.from([
    0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
    0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08,
    0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C,
    0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
    0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D,
    0x1A, 0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20,
    0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
    0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27,
    0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34,
    0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
    0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4,
    0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01,
    0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04,
    0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, 0xFF,
    0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
    0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04,
    0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00,
    0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
    0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32,
    0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1, 0xC1,
    0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
    0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A,
    0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35,
    0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
    0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55,
    0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64, 0x65,
    0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
    0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85,
    0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94,
    0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
    0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2,
    0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9, 0xBA,
    0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
    0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8,
    0xD9, 0xDA, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6,
    0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
    0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA,
    0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
    0xFB, 0xD5, 0xDB, 0x20, 0xA8, 0xFA, 0x28, 0x28,
    0x28, 0x3F, 0xFF, 0xD9
  ]);
  fs.writeFileSync(jpgPath, jpgHeader);

  // notes.txt - random text
  const txtPath = path.join(testDir, 'notes.txt');
  fs.writeFileSync(txtPath, 'This is a random text file for testing purposes.\nLine 2: Some more content here.\nLine 3: The end.');

  // contract.docx - simple DOCX (minimal ZIP structure)
  const docxPath = path.join(testDir, 'contract.docx');
  // DOCX is a ZIP file, we'll create a minimal one
  const { execSync } = await import('child_process');
  try {
    // Create a minimal valid DOCX using Node.js zip
    const AdmZip = (await import('adm-zip')).default;
    const zip = new AdmZip();
    zip.addFile('[Content_Types].xml', Buffer.from('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'));
    zip.addFile('word/document.xml', Buffer.from('<?xml version="1.0"?><document xmlns="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><body><p><r><t>Contract Document</t></r></p></body></document>'));
    zip.writeZip(docxPath);
  } catch {
    // Fallback: just write some bytes if adm-zip not available
    fs.writeFileSync(docxPath, 'PK\x03\x04contract test content placeholder');
  }

  console.log(`  Test directory: ${testDir}`);
  console.log(`  Created files: report.pdf, photo.jpg, notes.txt, contract.docx`);
  console.log('');

  // 2. Scan files
  console.log('[Test 1] Scanning files...');
  const allFiles = fs.readdirSync(testDir);
  const fileInfos = allFiles.map(name => {
    const filePath = path.join(testDir, name);
    const stat = fs.statSync(filePath);
    return {
      path: filePath,
      name: name,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
    };
  });
  console.log(`  Found ${fileInfos.length} files`);
  console.log('');

  // 3. Define classification rules
  console.log('[Test 2] Setting up classification rules...');
  const rules = [
    { type: 'byExtension', params: { extension: 'pdf' }, targetFolder: '发票' },
    { type: 'byExtension', params: { extension: 'jpg' }, targetFolder: '图片' },
    { type: 'byKeyword', params: { keyword: 'contract' }, targetFolder: '合同' },
  ];
  console.log(`  Rule 1: byExtension pdf -> 发票`);
  console.log(`  Rule 2: byExtension jpg -> 图片`);
  console.log(`  Rule 3: byKeyword contract -> 合同`);
  console.log('');

  // 4. Execute classification
  console.log('[Test 3] Executing classification...');
  const classifyResults = classifyFiles(fileInfos, rules, testDir);
  console.log(`  Matched ${classifyResults.length} files for classification`);
  
  // Actually move the files
  for (const result of classifyResults) {
    const targetDir = path.dirname(result.newPath);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.renameSync(result.oldPath, result.newPath);
  }
  console.log('  Files moved successfully');
  console.log('');

  // 5. Verify results
  console.log('[Test 4] Verifying classification results...');
  
  const invoicePdf = path.join(testDir, '发票', 'report.pdf');
  const imageJpg = path.join(testDir, '图片', 'photo.jpg');
  const contractDocx = path.join(testDir, '合同', 'contract.docx');
  const notesTxt = path.join(testDir, 'notes.txt');

  assert(fileExists(invoicePdf), 'report.pdf exists in 发票 folder');
  assert(fileExists(imageJpg), 'photo.jpg exists in 图片 folder');
  assert(fileExists(contractDocx), 'contract.docx exists in 合同 folder');
  assert(fileExists(notesTxt), 'notes.txt remains in original location (not misclassified)');
  console.log('');

  // 6. Test undo functionality
  console.log('[Test 5] Testing undo (restoring files)...');
  
  // Reverse the classification
  for (let i = classifyResults.length - 1; i >= 0; i--) {
    const result = classifyResults[i];
    if (fs.existsSync(result.newPath)) {
      fs.renameSync(result.newPath, result.oldPath);
    }
    // Clean up empty target folders
    const targetDir = path.dirname(result.newPath);
    if (fs.existsSync(targetDir)) {
      const files = fs.readdirSync(targetDir);
      if (files.length === 0) {
        fs.rmdirSync(targetDir);
      }
    }
  }
  console.log('  Files restored to original locations');

  // Verify all files are back
  assert(fileExists(pdfPath), 'report.pdf restored to original location');
  assert(fileExists(jpgPath), 'photo.jpg restored to original location');
  assert(fileExists(docxPath), 'contract.docx restored to original location');
  assert(fileExists(txtPath), 'notes.txt still in original location');
  console.log('');

  // 7. Verify subfolders are cleaned
  console.log('[Test 6] Verifying subfolder cleanup...');
  assert(!fs.existsSync(path.join(testDir, '发票')), '发票 folder removed after undo');
  assert(!fs.existsSync(path.join(testDir, '图片')), '图片 folder removed after undo');
  assert(!fs.existsSync(path.join(testDir, '合同')), '合同 folder removed after undo');
  console.log('');

  // 8. Cleanup
  console.log('[Cleanup] Removing test directory...');
  fs.rmSync(testDir, { recursive: true, force: true });
  assert(!fs.existsSync(testDir), 'Test directory completely removed');
  console.log('');

  // 9. Summary
  console.log('='.repeat(60));
  console.log('Test Summary');
  console.log('='.repeat(60));
  console.log(`Total: ${totalTests} tests, Passed: ${passedTests}, Failed: ${failedTests}`);
  
  if (failedTests === 0) {
    console.log('\n🎉 All tests passed!');
  } else {
    console.log(`\n⚠️  ${failedTests} test(s) failed. Please check the output above.`);
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
