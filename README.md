# FileFlow - Smart File Processing Center

<p align="center">
  <strong>An Electron-powered desktop application for batch renaming, format conversion, intelligent classification, OCR, and LAN file transfer — streamline your file management with AI.</strong>
</p>

<p align="center">
  <a href="#-features">Features</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-build--release">Build & Release</a> •
  <a href="#-usage-guide">Usage Guide</a> •
  <a href="#-acknowledgments">Acknowledgments</a>
</p>

<p align="center">
  <a href="#-功能特性">🇨🇳 中文文档</a>
</p>

---

## ✨ Features

### 📂 Batch Rename

| Feature | Description |
|---------|-------------|
| **Prefix / Suffix** | Add custom text before or after filenames |
| **Find & Replace** | Search and replace text in filenames |
| **Regular Expression** | Powerful pattern-based renaming |
| **Date Insertion** | Insert creation/modification date with custom format |
| **Sequential Numbering** | Auto-number files with configurable start, step, and digit count |
| **Rule Chains** | Compose multiple rules, executed in order |
| **Real-time Preview** | See results instantly before applying |
| **Undo / Redo** | One-click restore to original filenames |

### 🔄 Multi-Format Conversion

| Source | Target |
|--------|--------|
| Word (.docx) | Markdown (.md) |
| Markdown (.md) | HTML (.html) / PDF (.pdf) |
| HTML (.html) | Markdown (.md) |
| JPEG (.jpg) | PNG (.png) |
| PNG (.png) | JPEG (.jpg) |

Supports single file and batch conversion with progress tracking.

### 📁 Intelligent Classification

| Mode | Description |
|------|-------------|
| **Fast Mode** | Classify by extension, keyword, size, or date — no AI required |
| **Basic OCR Mode** | Extract text with PaddleOCR, then classify by keywords |
| **Local AI Enhanced** | Use Ollama / LM Studio for intelligent content-based classification |
| **Cloud API Enhanced** | Use OpenAI / DeepSeek API for high-accuracy classification |
| **Hybrid Mode** | Combine OCR extraction with AI analysis for best results |

### ⚡ Smart Workflow

- **Free Combination**: Chain rename → convert → classify steps in any order
- **Template System**: Save and load workflow templates as JSON files
- **Built-in Templates**: Photo archive, document backup, and more
- **One-Click Execution**: Run complex multi-step tasks automatically
- **Full Undo Support**: Restore all changes with a single click

### 🔍 File Deduplication

| Mode | Description |
|------|-------------|
| **Exact Dedup** | Hash-based detection of identical files |
| **Similar Dedup** | Perceptual hash comparison for visually similar images |
| **Batch Operations** | Delete, move, or skip duplicate groups |

### 📝 OCR Text Extraction

| Engine | Description |
|--------|-------------|
| **PaddleOCR** | High-accuracy Chinese & English recognition via local service |
| **Tesseract.js** | Pure JavaScript OCR, no external dependencies |
| **Hybrid Mode** | Run both engines simultaneously with cross-validation |
| **Confidence Rating** | High confidence when engines agree, flagged for manual review when they differ |
| **Editable Results** | Edit extracted text directly in the app |
| **Batch Extraction** | Process multiple images at once |
| **Export to Markdown** | Save OCR results as formatted Markdown files |

### 🌐 LAN File Transfer

- **Bidirectional Transfer**: Phone ↔ Computer, no app installation required
- **QR Code Sharing**: Scan to connect instantly
- **P2P Mode**: Direct device-to-device transfer without server relay
- **Real-time Progress**: Live transfer status and speed display
- **Background Service**: Continues running after window close (configurable)

### 🤖 AI Semantic Search

- **Natural Language Query**: Search files using everyday language (Chinese & English)
- **Content-Aware**: Analyzes file content, not just filenames
- **Relevance Scoring**: Results ranked by semantic similarity with explanations
- **Ollama / OpenAI Support**: Works with local or cloud AI models

### 🖼️ Visual Image Description

- **AI-Powered**: Uses vision models (llava, bakllava, etc.) to describe image content
- **Inline Display**: "AI Description" column in the file list for image files
- **On-Demand Generation**: Click to generate descriptions as needed

### 🎨 User Experience

| Feature | Description |
|---------|-------------|
| **Dark / Light Mode** | Seamless theme switching with smooth transitions |
| **Chinese / English i18n** | Full bilingual interface support |
| **Multi-File Selection** | Select and operate on multiple files at once |
| **Image Preview** | Built-in thumbnail preview for image files |
| **Custom Title Bar** | Frameless window with custom minimize/maximize/close controls |
| **Status Bar** | Real-time file count and selection info |

### 🚀 One-Click Release & Auto Update

- **Automated Build**: Single command to build, package, and tag releases
- **Auto Update**: Built-in update checker with notification
- **GitHub Release Integration**: Automatic release creation (with GitHub CLI)

---

## 🛠️ Tech Stack

| Category | Technology |
|----------|------------|
| **Framework** | [Electron](https://www.electronjs.org/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **UI Library** | [Ant Design](https://ant.design/) |
| **Build Tool** | [electron-vite](https://electron-vite.org/) + [Vite](https://vitejs.dev/) |
| **Packager** | [electron-builder](https://www.electron.build/) |
| **Document Conversion** | `mammoth`, `marked`, `md-to-pdf`, `turndown` |
| **Image Processing** | `sharp` |
| **OCR Engines** | [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) (Apache 2.0) + [Tesseract.js](https://github.com/naptha/tesseract.js) (Apache 2.0) |
| **AI Integration** | [Ollama](https://ollama.com/) + [LM Studio](https://lmstudio.ai/) + OpenAI-compatible API |
| **P2P Transfer** | WebRTC + WebSocket |
| **i18n** | `react-i18next`, `i18next` |

---

## 🚀 Quick Start

### Prerequisites

- Node.js >= 18
- pnpm >= 8

### Development

```bash
# 1. Clone the repository
git clone https://github.com/fantuan9234/file-flow.git
cd file-flow

# 2. Install dependencies
pnpm install

# 3. Start development mode
pnpm dev
```

### Optional: AI Features

For AI-powered features (semantic search, intelligent classification, image description):

1. **Local AI**: Install [Ollama](https://ollama.com/) and pull a model:
   ```bash
   ollama pull qwen2.5:1.5b      # For text tasks
   ollama pull llava:7b          # For image description
   ```

2. **Cloud AI**: Configure your OpenAI / DeepSeek API key in the app settings.

---

## 📦 Build & Release

```bash
# Windows installer (.exe)
pnpm build:win

# macOS (.dmg)
pnpm build:mac

# Linux (.AppImage)
pnpm build:linux
```

After building, installers are located in the `release/` directory.

### Automated Release

```bash
node scripts/release.mjs <version>
# Example: node scripts/release.mjs 1.2.0
```

This script handles: version bump → build → package → git commit → tag → push.

---

## 📖 Usage Guide

### ✏️ Batch Rename

1. Click **"Select Folder & Scan"** to choose a target folder
2. Add rename rules (prefix, suffix, find/replace, regex, date, sequence)
3. Preview changes in real-time
4. Click **"Execute Rename"** — full undo support available

### 🔄 Format Conversion

1. Select source and target formats
2. Choose single file or multiple files
3. Output files are saved alongside originals

### 📁 Intelligent Classification

1. Choose classification mode (Fast / Basic OCR / Local AI / Cloud API / Hybrid)
2. Configure rules or let AI analyze content
3. Preview folder structure before executing
4. Files auto-sorted into organized folders

### ⚡ Smart Workflow

1. Add steps: rename, convert, or classify
2. Reorder steps with ↑↓ buttons
3. Optionally keep original files after conversion
4. Execute — all steps run automatically in order

### 🔍 File Deduplication

1. Scan folder to find duplicates
2. Choose exact (hash) or similar (perceptual hash) mode
3. Select files to delete, move, or skip

### 📝 OCR Text Extraction

1. Select image file(s)
2. Choose engine: PaddleOCR only, or Hybrid Mode (PaddleOCR + Tesseract.js)
3. View results with confidence ratings
4. Edit text directly if needed
5. Export to Markdown or use AI classification

### 🌐 LAN File Transfer

1. Start server in the LAN tab
2. Share QR code or URL with other devices
3. Transfer files bidirectionally — no app installation needed

### 🤖 AI Semantic Search

1. Open the search box in the sidebar
2. Type a natural language query (e.g., "financial reports from last quarter")
3. View ranked results with relevance scores and explanations

### 🖼️ Image AI Description

1. Enable the "AI Description" column in file list settings
2. Click "Generate AI Description" for any image file
3. View the model's description of the image content

---

## 📁 Project Structure

```
file-flow/
├── src/
│   ├── main/                    # Electron main process
│   │   ├── index.ts             # App lifecycle & window management
│   │   ├── services/            # Service modules
│   │   │   ├── ocr/             # OCR service (PaddleOCR + Tesseract.js)
│   │   │   ├── search/          # AI semantic search service
│   │   │   └── transfer/        # LAN file transfer service
│   │   └── workers/             # Worker threads
│   │       └── ocr-worker.ts    # OCR processing worker
│   ├── preload/                 # Preload scripts
│   │   └── index.ts             # Secure API exposure to renderer
│   ├── shared/                  # Shared code
│   │   └── ipc-channels.ts      # IPC channel definitions & types
│   └── renderer/                # React renderer process
│       ├── src/
│       │   ├── components/      # UI components
│       │   ├── utils/           # Utility functions
│       │   ├── i18n/            # Internationalization
│       │   └── App.tsx          # Main app component
│       └── index.html
├── scripts/                     # Build & release scripts
├── build/                       # Build resources (icons, etc.)
├── release/                     # Build output
└── package.json
```

---

## 🙏 Acknowledgments

| Project | License | Usage |
|---------|---------|-------|
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | [Apache License 2.0](https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE) | OCR text recognition engine |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | [Apache License 2.0](https://github.com/naptha/tesseract.js/blob/main/LICENSE) | Secondary OCR engine for hybrid mode |
| [Ollama](https://github.com/ollama/ollama) | [MIT License](https://github.com/ollama/ollama/blob/main/LICENSE) | Local AI model runtime |
| [Electron](https://www.electronjs.org/) | [MIT License](https://github.com/electron/electron/blob/main/LICENSE) | Desktop application framework |
| [React](https://react.dev/) | [MIT License](https://github.com/facebook/react/blob/main/LICENSE) | UI framework |
| [Ant Design](https://ant.design/) | [MIT License](https://github.com/ant-design/ant-design/blob/master/LICENSE) | Component library |
| [sharp](https://sharp.pixelplumbing.com/) | [Apache License 2.0](https://github.com/lovell/sharp/blob/main/LICENSE) | Image processing |

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).

> **Note**: This project uses third-party components with their own licenses:
> - **PaddleOCR** — Apache License 2.0
> - **Tesseract.js** — Apache License 2.0
> - **sharp** — Apache License 2.0

---

## 👤 Author

**fantuan9234**

- GitHub: [@fantuan9234](https://github.com/fantuan9234)
- Project: https://github.com/fantuan9234/file-flow

---

<p align="center">If this project helps you, please consider giving it a ⭐ Star!</p>

---
---

# FileFlow - 智能文件处理中心

<p align="center">
  <strong>基于 Electron 的桌面应用，集批量重命名、格式转换、智能分类、OCR 文字提取、局域网传输于一体，AI 驱动的文件管理利器。</strong>
</p>

<p align="center">
  <a href="#-功能特性">功能特性</a> •
  <a href="#-技术栈">技术栈</a> •
  <a href="#快速开始">快速开始</a> •
  <a href="#打包与发布">打包与发布</a> •
  <a href="#使用说明">使用说明</a> •
  <a href="#致谢">致谢</a>
</p>

<p align="center">
  <a href="#-features">🇬🇧 English Documentation</a>
</p>

---

## ✨ 功能特性

### 📂 批量重命名

| 功能 | 说明 |
|------|------|
| **前缀 / 后缀** | 在文件名前后添加自定义文本 |
| **查找替换** | 搜索并替换文件名中的文字 |
| **正则表达式** | 强大的模式匹配重命名 |
| **日期插入** | 插入创建/修改日期，支持自定义格式 |
| **序号添加** | 自动编号，可配置起始值、步长和位数 |
| **规则链** | 组合多条规则，按顺序执行 |
| **实时预览** | 应用前即时查看重命名结果 |
| **撤销 / 重做** | 一键恢复原始文件名 |

### 🔄 多格式转换

| 源格式 | 目标格式 |
|--------|----------|
| Word (.docx) | Markdown (.md) |
| Markdown (.md) | HTML (.html) / PDF (.pdf) |
| HTML (.html) | Markdown (.md) |
| JPEG (.jpg) | PNG (.png) |
| PNG (.png) | JPEG (.jpg) |

支持单文件和批量转换，带进度提示。

### 📁 智能分类

| 模式 | 说明 |
|------|------|
| **快速模式** | 按扩展名、关键词、大小、日期分类，无需 AI |
| **基础 OCR 模式** | 使用 PaddleOCR 提取文字后按关键词分类 |
| **本地 AI 增强模式** | 使用 Ollama / LM Studio 进行智能内容分类 |
| **云端 API 增强模式** | 使用 OpenAI / DeepSeek API 实现高精度分类 |
| **混合模式** | 结合 OCR 提取与 AI 分析，效果最佳 |

### ⚡ 智能工作流

- **自由组合**：将重命名 → 转换 → 分类步骤按任意顺序串联
- **模板系统**：将工作流保存为 JSON 模板，随时加载复用
- **内置模板**：照片归档、文档备份等开箱即用
- **一键执行**：自动按顺序运行所有步骤
- **完整撤销**：一键恢复所有更改

### 🔍 文件去重

| 模式 | 说明 |
|------|------|
| **精确去重** | 基于哈希值检测完全相同的文件 |
| **相似去重** | 感知哈希对比，找出视觉上相似的图片 |
| **批量操作** | 对重复文件组进行删除、移动或跳过 |

### 📝 OCR 文字提取

| 引擎 | 说明 |
|------|------|
| **PaddleOCR** | 高精度中英文识别，通过本地服务运行 |
| **Tesseract.js** | 纯 JavaScript OCR，无需外部依赖 |
| **混合模式** | 双引擎同时运行，交叉验证结果 |
| **置信度评级** | 两引擎结果一致为高置信度，不一致则标记需人工核对 |
| **可编辑结果** | 直接在应用内编辑识别出的文字 |
| **批量提取** | 同时处理多张图片 |
| **导出 Markdown** | 将 OCR 结果保存为格式化的 Markdown 文件 |

### 🌐 局域网快传

- **双向传输**：手机 ↔ 电脑互传文件，无需安装 App
- **二维码分享**：扫码即可连接
- **P2P 模式**：设备直连，不经过服务器中转
- **实时进度**：实时显示传输状态和速度
- **后台运行**：窗口关闭后仍可继续传输（可配置）

### 🤖 AI 语义搜索

- **自然语言查询**：用日常语言搜索文件（支持中英文）
- **内容感知**：分析文件内容，不仅限于文件名
- **相关度评分**：结果按语义相似度排序，附带匹配原因
- **Ollama / OpenAI 支持**：兼容本地或云端 AI 模型

### 🖼️ 图片 AI 描述

- **AI 驱动**：使用视觉模型（llava、bakllava 等）描述图片内容
- **内联展示**：文件列表中为图片文件显示"AI 描述"列
- **按需生成**：点击按钮即可生成图片描述

### 🎨 用户体验

| 功能 | 说明 |
|------|------|
| **暗黑 / 浅色模式** | 无缝主题切换，过渡流畅 |
| **中文 / 英文国际化** | 完整的双语界面支持 |
| **文件多选** | 同时选择并操作多个文件 |
| **图片预览** | 内置图片缩略图预览 |
| **自定义标题栏** | 无边框窗口，自定义最小化/最大化/关闭按钮 |
| **状态栏** | 实时显示文件数量和选中信息 |

### 🚀 一键发布与自动更新

- **自动化构建**：一条命令完成构建、打包、打标签
- **自动更新**：内置更新检查器，及时通知新版本
- **GitHub Release 集成**：自动创建 Release（需 GitHub CLI）

---

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **框架** | [Electron](https://www.electronjs.org/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **UI 库** | [Ant Design](https://ant.design/) |
| **构建工具** | [electron-vite](https://electron-vite.org/) + [Vite](https://vitejs.dev/) |
| **打包工具** | [electron-builder](https://www.electron.build/) |
| **文档转换** | `mammoth`, `marked`, `md-to-pdf`, `turndown` |
| **图片处理** | `sharp` |
| **OCR 引擎** | [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR)（Apache 2.0）+ [Tesseract.js](https://github.com/naptha/tesseract.js)（Apache 2.0） |
| **AI 集成** | [Ollama](https://ollama.com/) + [LM Studio](https://lmstudio.ai/) + OpenAI 兼容 API |
| **P2P 传输** | WebRTC + WebSocket |
| **国际化** | `react-i18next`, `i18next` |

---

## 快速开始

### 前置要求

- Node.js >= 18
- pnpm >= 8

### 开发模式

```bash
# 1. 克隆仓库
git clone https://github.com/fantuan9234/file-flow.git
cd file-flow

# 2. 安装依赖
pnpm install

# 3. 启动开发模式
pnpm dev
```

### 可选：AI 功能

要使用 AI 驱动的功能（语义搜索、智能分类、图片描述）：

1. **本地 AI**：安装 [Ollama](https://ollama.com/) 并拉取模型：
   ```bash
   ollama pull qwen2.5:1.5b      # 用于文本任务
   ollama pull llava:7b          # 用于图片描述
   ```

2. **云端 AI**：在应用设置中配置 OpenAI / DeepSeek API 密钥。

---

## 打包与发布

```bash
# Windows 安装包 (.exe)
pnpm build:win

# macOS (.dmg)
pnpm build:mac

# Linux (.AppImage)
pnpm build:linux
```

构建完成后，安装包位于 `release/` 目录。

### 自动化发布

```bash
node scripts/release.mjs <版本号>
# 示例: node scripts/release.mjs 1.2.0
```

该脚本自动完成：版本号更新 → 构建 → 打包 → Git 提交 → 打标签 → 推送。

---

## 使用说明

### ✏️ 批量重命名

1. 点击**"选择文件夹并扫描"**选择目标文件夹
2. 添加重命名规则（前缀、后缀、查找替换、正则、日期、序号）
3. 实时预览更改结果
4. 点击**"执行重命名"** — 支持完整撤销

### 🔄 格式转换

1. 选择源格式和目标格式
2. 选择单个或多个文件
3. 输出文件与源文件保存在同一目录

### 📁 智能分类

1. 选择分类模式（快速 / 基础 OCR / 本地 AI / 云端 API / 混合）
2. 配置规则或让 AI 分析内容
3. 执行前预览文件夹结构
4. 文件自动归类到有序的文件夹中

### ⚡ 智能工作流

1. 添加步骤：重命名、转换或分类
2. 使用 ↑↓ 按钮调整步骤顺序
3. 可选：转换后保留原始文件
4. 执行 — 所有步骤自动按顺序运行

### 🔍 文件去重

1. 扫描文件夹查找重复文件
2. 选择精确去重（哈希）或相似去重（感知哈希）模式
3. 选择要删除、移动或跳过的文件

### 📝 OCR 文字提取

1. 选择图片文件（可多选）
2. 选择引擎：仅 PaddleOCR，或混合模式（PaddleOCR + Tesseract.js）
3. 查看识别结果和置信度评级
4. 如需可直接在应用内编辑文字
5. 导出为 Markdown 或使用 AI 分类

### 🌐 局域网快传

1. 在局域网标签页启动服务器
2. 分享二维码或 URL 给其他设备
3. 双向传输文件 — 无需安装任何 App

### 🤖 AI 语义搜索

1. 打开侧边栏的搜索框
2. 输入自然语言查询（如"上季度的财务报告"）
3. 查看按相关度排序的结果，附带匹配原因

### 🖼️ 图片 AI 描述

1. 在文件列表设置中启用"AI 描述"列
2. 点击任意图片文件的"生成 AI 描述"按钮
3. 查看模型对图片内容的描述

---

## 📁 项目结构

```
file-flow/
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.ts             # 应用生命周期与窗口管理
│   │   ├── services/            # 服务模块
│   │   │   ├── ocr/             # OCR 服务（PaddleOCR + Tesseract.js）
│   │   │   ├── search/          # AI 语义搜索服务
│   │   │   └── transfer/        # 局域网传输服务
│   │   └── workers/             # Worker 线程
│   │       └── ocr-worker.ts    # OCR 处理 Worker
│   ├── preload/                 # Preload 脚本
│   │   └── index.ts             # 安全 API 暴露
│   ├── shared/                  # 共享代码
│   │   └── ipc-channels.ts      # IPC 通道定义与类型
│   └── renderer/                # React 渲染进程
│       ├── src/
│       │   ├── components/      # UI 组件
│       │   ├── utils/           # 工具函数
│       │   ├── i18n/            # 国际化
│       │   └── App.tsx          # 主应用组件
│       └── index.html
├── scripts/                     # 构建与发布脚本
├── build/                       # 构建资源（图标等）
├── release/                     # 构建输出
└── package.json
```

---

## 🙏 致谢

| 项目 | 许可证 | 用途 |
|------|--------|------|
| [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) | [Apache License 2.0](https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE) | OCR 文字识别引擎 |
| [Tesseract.js](https://github.com/naptha/tesseract.js) | [Apache License 2.0](https://github.com/naptha/tesseract.js/blob/main/LICENSE) | 混合 OCR 模式的辅助引擎 |
| [Ollama](https://github.com/ollama/ollama) | [MIT License](https://github.com/ollama/ollama/blob/main/LICENSE) | 本地 AI 模型运行时 |
| [Electron](https://www.electronjs.org/) | [MIT License](https://github.com/electron/electron/blob/main/LICENSE) | 桌面应用框架 |
| [React](https://react.dev/) | [MIT License](https://github.com/facebook/react/blob/main/LICENSE) | UI 框架 |
| [Ant Design](https://ant.design/) | [MIT License](https://github.com/ant-design/ant-design/blob/master/LICENSE) | 组件库 |
| [sharp](https://sharp.pixelplumbing.com/) | [Apache License 2.0](https://github.com/lovell/sharp/blob/main/LICENSE) | 图片处理 |

---

## 📝 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

> **注意**：本项目使用了以下第三方组件，各自遵循其许可证条款：
> - **PaddleOCR** — Apache License 2.0
> - **Tesseract.js** — Apache License 2.0
> - **sharp** — Apache License 2.0

---

## 👤 作者

**fantuan9234**

- GitHub: [@fantuan9234](https://github.com/fantuan9234)
- 项目地址: https://github.com/fantuan9234/file-flow

---

<p align="center">如果这个项目对你有帮助，请考虑给它一个 ⭐ Star！</p>
