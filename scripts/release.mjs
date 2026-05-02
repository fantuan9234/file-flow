/**
 * FileFlow 一键发布脚本
 * 用法: node scripts/release.mjs <新版本号>
 * 示例: node scripts/release.mjs 1.1.1
 *
 * 功能:
 *   1. 检查 Git 分支和工作区状态
 *   2. 更新 package.json 版本号
 *   3. 清理旧构建产物并重新打包
 *   4. Git 提交、打标签、推送
 *   5. 自动创建 GitHub Release 并上传安装包
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const packageJsonPath = join(rootDir, 'package.json');
const changelogPath = join(rootDir, 'CHANGELOG.md');

// ANSI 颜色代码
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
};

function info(msg) { console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`); }
function success(msg) { console.log(`${colors.green}[OK]${colors.reset} ${msg}`); }
function warn(msg) { console.log(`${colors.yellow}[WARN]${colors.reset} ${msg}`); }
function error(msg) { console.error(`${colors.red}[ERROR]${colors.reset} ${msg}`); }
function step(msg) { console.log(`\n${colors.bold}${colors.cyan}>>> ${msg}${colors.reset}`); }

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { encoding: 'utf-8', cwd: rootDir, ...opts }).trim();
  } catch (err) {
    if (opts.ignoreExitCode) return '';
    throw err;
  }
}

// 解析参数
const newVersion = process.argv[2];
if (!newVersion) {
  error('请提供版本号，例如: node scripts/release.mjs 1.1.1');
  console.log(`用法: node scripts/release.mjs <version>`);
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
  error(`无效的版本格式 "${newVersion}"，请使用语义化版本，例如: 1.1.1`);
  process.exit(1);
}

const tagName = `v${newVersion}`;

// ========== Step 1: 前置检查 ==========
step('Step 1: 前置检查');

// 检查当前分支
const currentBranch = run('git branch --show-current');
if (currentBranch !== 'main') {
  error(`当前分支为 "${currentBranch}"，请切换到 main 分支后再发布。`);
  info('运行: git checkout main');
  process.exit(1);
}
success(`当前在 main 分支`);

// 检查工作区是否干净
try {
  run('git diff-index --quiet HEAD --', { stdio: 'pipe' });
  success('工作区干净，无未提交更改');
} catch {
  error('工作区有未提交的更改，请先提交或暂存。');
  info('运行: git status 查看详情');
  process.exit(1);
}

// ========== Step 2: 更新版本号 ==========
step('Step 2: 更新 package.json 版本号');

const rawPkg = readFileSync(packageJsonPath, 'utf-8');
const pkg = JSON.parse(rawPkg);
const oldVersion = pkg.version;
pkg.version = newVersion;

// 保留原有缩进写入
const indent = rawPkg.match(/^( +)/m)?.[1] || '  ';
writeFileSync(packageJsonPath, JSON.stringify(pkg, null, indent) + '\n', 'utf-8');
success(`版本号已更新: ${colors.bold}${oldVersion}${colors.reset} → ${colors.bold}${newVersion}${colors.reset}`);

// ========== Step 3: 清理并打包 ==========
step('Step 3: 清理旧构建产物并打包');

const dirsToRemove = ['dist', 'release'];
for (const dir of dirsToRemove) {
  const fullPath = join(rootDir, dir);
  if (existsSync(fullPath)) {
    rmSync(fullPath, { recursive: true, force: true });
    success(`已删除 ${dir}/`);
  } else {
    info(`${dir}/ 不存在，跳过`);
  }
}

info('执行 pnpm build ...');
try {
  run('pnpm build', { stdio: 'inherit', ignoreExitCode: true });
  success('pnpm build 完成');
} catch {
  error('pnpm build 失败，请修复后重试。');
  process.exit(1);
}

info('执行 pnpm build:win ...');
try {
  run('pnpm build:win', { stdio: 'inherit', ignoreExitCode: true });
  success('pnpm build:win 完成');
} catch {
  error('pnpm build:win 失败，请修复后重试。');
  process.exit(1);
}

// 验证构建产物
const releaseDir = join(rootDir, 'release');
if (!existsSync(releaseDir)) {
  error('release/ 目录不存在，打包可能失败。');
  process.exit(1);
}

// 查找 .exe 文件（支持多种命名格式）
const releaseFiles = readdirSync(releaseDir);
const exeFile = releaseFiles.find(f => f.endsWith('-setup.exe') || f.includes('Setup') && f.endsWith('.exe'));
if (!exeFile) {
  error('未找到构建产物 (.exe)');
  info('release/ 目录内容:');
  releaseFiles.forEach(f => info(`  - ${f}`));
  process.exit(1);
}
const exePath = join(releaseDir, exeFile);
success(`构建产物已生成: ${exeFile}`);

// 检查 latest.yml
const ymlPath = join(releaseDir, 'latest.yml');
if (!existsSync(ymlPath)) {
  warn('未找到 latest.yml，自动更新功能可能受影响。');
} else {
  const ymlContent = readFileSync(ymlPath, 'utf-8');
  if (ymlContent.startsWith(`version: ${newVersion}`)) {
    success(`latest.yml 版本号正确: ${newVersion}`);
  } else {
    warn('latest.yml 版本号与预期不符，请检查。');
  }
}

// ========== Step 4: Git 操作 ==========
step('Step 4: Git 提交、打标签、推送');

run('git add .', { stdio: 'pipe' });
success('文件已暂存');

run(`git commit -m "release: ${tagName}"`, { stdio: 'pipe' });
success(`已提交: release: ${tagName}`);

// 删除本地同名标签（如果存在）
try {
  run(`git tag -d ${tagName}`, { stdio: 'pipe' });
  warn(`已删除本地标签 ${tagName}`);
} catch {
  // 标签不存在，正常
}

// 删除远程同名标签（如果存在）
try {
  run(`git push origin --delete ${tagName}`, { stdio: 'pipe' });
  warn(`已删除远程标签 ${tagName}`);
} catch {
  // 标签不存在，正常
}

run(`git tag ${tagName}`, { stdio: 'pipe' });
success(`已创建标签: ${tagName}`);

run('git push', { stdio: 'pipe' });
success('已推送到远程仓库');

run('git push --tags', { stdio: 'pipe' });
success('已推送标签到远程');

// ========== Step 5: 创建 GitHub Release ==========
step('Step 5: 创建 GitHub Release');

// 检查 gh CLI
let ghAvailable = false;
try {
  run('gh --version', { stdio: 'pipe' });
  ghAvailable = true;
} catch {
  // gh 不可用
}

if (ghAvailable) {
  info('检测到 GitHub CLI (gh)，自动创建 Release...');

  // 从 CHANGELOG 提取更新内容
  let releaseNotes = `FileFlow ${tagName}`;
  if (existsSync(changelogPath)) {
    try {
      const changelog = readFileSync(changelogPath, 'utf-8');
      const sectionRegex = new RegExp(`##\\s+v?${newVersion}[\\s\\S]*?(?=##\\s+v?\\d|\\Z)`, 'i');
      const match = changelog.match(sectionRegex);
      if (match) {
        releaseNotes = match[0].trim();
        success('已从 CHANGELOG.md 提取更新内容');
      }
    } catch {
      warn('读取 CHANGELOG.md 失败，使用默认描述');
    }
  }

  // 创建 Release
  try {
    run(
      `gh release create ${tagName} --title "FileFlow ${tagName}" --notes "${releaseNotes.replace(/"/g, '\\"')}"`,
      { stdio: 'pipe' }
    );
    success(`已创建 GitHub Release: ${tagName}`);
  } catch {
    // Release 可能已存在，尝试编辑
    try {
      run(
        `gh release edit ${tagName} --title "FileFlow ${tagName}" --notes "${releaseNotes.replace(/"/g, '\\"')}"`,
        { stdio: 'pipe' }
      );
      success(`已更新 GitHub Release: ${tagName}`);
    } catch (e) {
      warn('创建/更新 Release 失败，可能需要手动操作。');
    }
  }

  // 上传文件
  const uploadFiles = [exePath];
  if (existsSync(ymlPath)) uploadFiles.push(ymlPath);

  try {
    run(`gh release upload ${tagName} ${uploadFiles.join(' ')} --clobber`, { stdio: 'pipe' });
    success('已上传构建产物到 GitHub Release');
  } catch {
    error('上传文件失败，请手动上传。');
    info(`文件路径: ${exePath}`);
  }

  success(`GitHub Release 已发布: https://github.com/fantuan9234/file-flow/releases/tag/${tagName}`);
} else {
  warn('未检测到 GitHub CLI (gh)，无法自动创建 Release。');
  console.log(`\n${colors.yellow}请手动前往以下地址创建 Release:${colors.reset}`);
  console.log(`  ${colors.cyan}https://github.com/fantuan9234/file-flow/releases/new?tag=${tagName}${colors.reset}`);
  console.log(`\n需要上传的文件:`);
  console.log(`  ${colors.cyan}${exePath}${colors.reset}`);
  if (existsSync(ymlPath)) {
    console.log(`  ${colors.cyan}${ymlPath}${colors.reset}`);
  }
}

// ========== 完成 ==========
console.log(`\n${colors.bold}${colors.green}========================================${colors.reset}`);
console.log(`${colors.bold}${colors.green}  发布完成！版本 ${tagName}${colors.reset}`);
console.log(`${colors.bold}${colors.green}========================================${colors.reset}\n`);
