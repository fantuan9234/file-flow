import sharp from 'sharp';
import { promises as fs, createWriteStream } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const buildDir = path.join(rootDir, 'build');

const svgPath = path.join(buildDir, 'fileflow-icon.svg');
const pngPath = path.join(buildDir, 'fileflow-icon.png');
const icoPath = path.join(buildDir, 'fileflow-icon.ico');
const icnsPath = path.join(buildDir, 'fileflow-icon.icns');

const ICO_SIZES = [256, 128, 64, 48, 32, 16];

// 生成 ICO 文件（手动构建 ICO 格式）
async function generateICO(pngBuffers) {
  // ICO 文件头：6 bytes
  // - Reserved: 2 bytes (0)
  // - Type: 2 bytes (1 for icon)
  // - Count: 2 bytes (number of images)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // Reserved
  header.writeUInt16LE(1, 2); // Type: 1 = ICO
  header.writeUInt16LE(pngBuffers.length, 4); // Number of images

  // 目录条目：每个图像 16 bytes
  // - Width: 1 byte
  // - Height: 1 byte
  // - ColorCount: 1 byte (0 if >= 256 colors)
  // - Reserved: 1 byte (0)
  // - ColorPlanes: 2 bytes (0)
  // - BitCount: 2 bytes (0)
  // - SizeInBytes: 4 bytes
  // - FileOffset: 4 bytes
  const dirEntrySize = 16;
  const dirEntries = Buffer.alloc(pngBuffers.length * dirEntrySize);

  let offset = header.length + (pngBuffers.length * dirEntrySize);
  const imageBuffers = [];

  for (let i = 0; i < pngBuffers.length; i++) {
    const pngBuffer = pngBuffers[i];
    const size = ICO_SIZES[i];

    // 写入目录条目
    const entryOffset = i * dirEntrySize;
    dirEntries.writeUInt8(size >= 256 ? 0 : size, entryOffset); // Width
    dirEntries.writeUInt8(size >= 256 ? 0 : size, entryOffset + 1); // Height
    dirEntries.writeUInt8(0, entryOffset + 2); // ColorCount
    dirEntries.writeUInt8(0, entryOffset + 3); // Reserved
    dirEntries.writeUInt16LE(0, entryOffset + 4); // ColorPlanes
    dirEntries.writeUInt16LE(0, entryOffset + 6); // BitCount
    dirEntries.writeUInt32LE(pngBuffer.length, entryOffset + 8); // SizeInBytes
    dirEntries.writeUInt32LE(offset, entryOffset + 12); // FileOffset

    imageBuffers.push(pngBuffer);
    offset += pngBuffer.length;
  }

  // 合并所有缓冲区
  return Buffer.concat([header, dirEntries, ...imageBuffers]);
}

// 生成 ICNS 文件（简化版，只包含 1024x1024）
async function generateICNS(pngBuffer) {
  // ICNS 文件格式：
  // - Magic: 4 bytes ('icns')
  // - FileLength: 4 bytes (big-endian)
  // - Icon elements...
  
  // 图标元素：
  // - OSType: 4 bytes ('ic10' for 1024x1024)
  // - DataLength: 4 bytes
  // - Data: variable

  const magic = Buffer.from('icns', 'ascii');
  const osType = Buffer.from('ic10', 'ascii'); // 1024x1024 PNG
  const dataLength = pngBuffer.length + 8; // +8 for OSType and DataLength
  const fileLength = dataLength + 8; // +8 for magic and fileLength

  const header = Buffer.alloc(8);
  header.write(magic.toString(), 0, 'ascii');
  header.writeUInt32BE(fileLength, 4);

  const elementHeader = Buffer.alloc(8);
  elementHeader.write(osType.toString(), 0, 'ascii');
  elementHeader.writeUInt32BE(dataLength, 4);

  return Buffer.concat([header, elementHeader, pngBuffer]);
}

async function generateIcons() {
  console.log('🎨 FileFlow Icon Generator');
  console.log('========================\n');

  try {
    // 检查 SVG 文件是否存在
    try {
      await fs.access(svgPath);
      console.log('✅ SVG 文件存在:', svgPath);
    } catch {
      console.error('❌ 找不到 SVG 文件:', svgPath);
      console.log('请先创建 build/fileflow-icon.svg');
      process.exit(1);
    }

    // 1. 生成 1024x1024 PNG
    console.log('\n📱 生成 1024x1024 PNG...');
    await sharp(svgPath)
      .resize(1024, 1024)
      .png()
      .toFile(pngPath);
    console.log('✅ 已生成:', pngPath);

    // 2. 生成 ICO (Windows)
    console.log('\n🪟 生成 Windows ICO...');
    const pngBuffers = [];
    for (const size of ICO_SIZES) {
      const buffer = await sharp(svgPath)
        .resize(size, size)
        .png()
        .toBuffer();
      pngBuffers.push(buffer);
      console.log(`   - ${size}x${size} 已生成`);
    }

    const icoBuffer = await generateICO(pngBuffers);
    await fs.writeFile(icoPath, icoBuffer);
    console.log('✅ 已生成:', icoPath);

    // 3. 生成 ICNS (macOS)
    console.log('\n🍎 生成 macOS ICNS...');
    const pngBuffer = await sharp(pngPath).toBuffer();
    const icnsBuffer = await generateICNS(pngBuffer);
    await fs.writeFile(icnsPath, icnsBuffer);
    console.log('✅ 已生成:', icnsPath);

    console.log('\n✨ 图标生成完成！');
    console.log('\n📋 生成的文件:');
    console.log('   - build/fileflow-icon.png (1024x1024)');
    console.log('   - build/fileflow-icon.ico (Windows, 多尺寸)');
    console.log('   - build/fileflow-icon.icns (macOS)');
    console.log('\n🚀 下一步:');
    console.log('   pnpm build && pnpm build:win');

  } catch (error) {
    console.error('❌ 生成图标时出错:', error);
    process.exit(1);
  }
}

generateIcons();
