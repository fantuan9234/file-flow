import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');
const packageJsonPath = join(rootDir, 'package.json');

// Parse command line arguments
const args = process.argv.slice(2);
const newVersion = args[0];

if (!newVersion) {
  console.error('❌ Error: Please provide a version number.');
  console.log('Usage: node scripts/release.mjs <version>');
  console.log('Example: node scripts/release.mjs 1.1.0');
  process.exit(1);
}

// Validate version format (semver)
const semverRegex = /^\d+\.\d+\.\d+$/;
if (!semverRegex.test(newVersion)) {
  console.error('❌ Error: Invalid version format. Please use semantic versioning (e.g., 1.1.0).');
  process.exit(1);
}

console.log(`🚀 Starting release process for version ${newVersion}...\n`);

// Step 1: Pre-flight checks
console.log('📋 Step 1: Running pre-flight checks...');

// Check if on main branch
try {
  const currentBranch = execSync('git branch --show-current', { encoding: 'utf-8' }).trim();
  if (currentBranch !== 'main') {
    console.error(`❌ Error: You are on branch '${currentBranch}'. Please switch to 'main' branch first.`);
    console.log(`   Run: git checkout main`);
    process.exit(1);
  }
  console.log(`   ✓ On main branch`);
} catch (error) {
  console.error('❌ Error: Failed to check current branch.');
  process.exit(1);
}

// Check if working tree is clean
try {
  execSync('git diff-index --quiet HEAD --', { encoding: 'utf-8' });
  console.log('   ✓ Working tree is clean');
} catch (error) {
  console.error('❌ Error: Working tree is not clean. Please commit or stash your changes first.');
  console.log('   Run: git status');
  process.exit(1);
}

// Step 2: Update package.json version
console.log('\n📝 Step 2: Updating package.json version...');

const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
const oldVersion = packageJson.version;
packageJson.version = newVersion;
writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');

console.log(`   ✓ Updated version: ${oldVersion} → ${newVersion}`);

// Step 3: Build the application
console.log('\n🔨 Step 3: Building the application...');
console.log('   This may take a few minutes, please wait...\n');

try {
  execSync('pnpm build && pnpm build:win', { stdio: 'inherit', cwd: rootDir });
  console.log('\n   ✓ Build completed successfully');
} catch (error) {
  console.error('❌ Error: Build failed. Please fix the errors and try again.');
  // Rollback version
  packageJson.version = oldVersion;
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n', 'utf-8');
  console.log(`   ↩ Rolled back version to ${oldVersion}`);
  process.exit(1);
}

// Step 4: Git operations
console.log('\n📦 Step 4: Committing and tagging...');

try {
  execSync('git add .', { stdio: 'inherit', cwd: rootDir });
  console.log('   ✓ Files staged');

  execSync(`git commit -m "release v${newVersion}"`, { stdio: 'inherit', cwd: rootDir });
  console.log('   ✓ Committed with message: release v${newVersion}');

  execSync(`git tag v${newVersion}`, { stdio: 'inherit', cwd: rootDir });
  console.log(`   ✓ Created tag: v${newVersion}`);

  execSync('git push', { stdio: 'inherit', cwd: rootDir });
  console.log('   ✓ Pushed to remote');

  execSync('git push --tags', { stdio: 'inherit', cwd: rootDir });
  console.log('   ✓ Pushed tags to remote');
} catch (error) {
  console.error('❌ Error: Git operations failed.');
  console.log('   Please check the error messages above and resolve manually.');
  process.exit(1);
}

// Step 5: Post-release instructions
console.log('\n' + '='.repeat(60));
console.log('✅ Release process completed successfully!');
console.log('='.repeat(60));
console.log(`\n📦 Version ${newVersion} has been built and pushed.`);
console.log('\n📋 Next steps:');
console.log('   1. Go to https://github.com/fantuan9234/file-flow/releases');
console.log('   2. Click "Draft a new release" or edit the existing tag');
console.log(`   3. Select tag: v${newVersion}`);
console.log('   4. Add release notes (see CHANGELOG.md)');
console.log('   5. Upload the installer from the release/ folder:');
console.log(`      - file-flow-${newVersion}-setup.exe`);
console.log('      - latest.yml (required for auto-update)');
console.log('   6. Click "Publish release"');
console.log('\n💡 Tip: You can also use GitHub CLI to create the release:');
console.log(`   gh release create v${newVersion} --generate-notes`);
console.log(`   gh release upload v${newVersion} release/file-flow-${newVersion}-setup.exe release/latest.yml`);
console.log('');
