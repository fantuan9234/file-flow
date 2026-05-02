# FileFlow - Smart File Batch Processing Center

<p align="center">
  <strong>A desktop application for batch renaming, format conversion, and intelligent workflows — streamline your file management with one click.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#installation">Installation</a> •
  <a href="#getting-started">Getting Started</a> •
  <a href="#build">Build</a> •
  <a href="#license">License</a>
</p>

<p align="center">
  <a href="README.zh-CN.md">中文文档</a>
</p>

---

## ✨ Features

| Module | Description |
|--------|-------------|
| 📂 **Folder Scanning** | Recursively scan folders, automatically excluding hidden files and system directories |
| ✏️ **Batch Rename** | Prefix, suffix, find & replace, date insertion, sequential numbering — with composable rule chains |
| 🔄 **Format Conversion** | `.docx → .md`, `.md → .html`, `.md → .pdf`, `.html → .md`, `.jpg ↔ .png` |
| 📁 **Smart Classification** | Auto-sort files by extension, keyword, size, or date into organized folders |
| ⚡ **Intelligent Workflow** | Combine rename + convert + classify steps, execute in order with one click |
| 💾 **Template System** | Save/load workflow templates, with built-in examples ready to use |
| ↩️ **Undo Protection** | Step-by-step and full workflow undo support, original files preserved by default |
| 🌙 **Dark Mode** | Seamless light/dark theme switching with smooth transitions |
| 🌍 **Internationalization** | Full Chinese & English language support |

---

## 📸 Screenshots

### Batch Rename

Support multiple rename rules, freely composable:

![Batch Rename](screenshots/rename.png)

### Format Conversion

Support Word, Markdown, HTML, images and more:

![Format Conversion](screenshots/convert.png)

### Smart Classification

Auto-sort files by customizable rules:

![Smart Classification](screenshots/classify.png)

### Intelligent Workflow

Combine rename, conversion, and classification steps for complex tasks:

![Intelligent Workflow](screenshots/workflow.png)

---

## 💡 Who Needs FileFlow?

### 🎨 Scenario 1: Designer's Deliverable Organization

> **"final_v3_really_final_EDITED.psd"**

| The Problem | FileFlow Solution |
|-------------|-------------------|
| Dozens of exported assets named `artboard1.png`, `untitled-1.jpg`. Before delivery, you manually rename everything to match naming conventions. | 1. Drag the folder in<br>2. Use **Find & Replace** to change all `artboard` to `App-Home`<br>3. Stack a **Prefix** `v2.0_` and **Sequence** `_01`<br>4. Click run — messy files instantly organized |

### 💻 Scenario 2: Developer's Documentation Migration

> **"API docs are in Markdown, but the PM needs Word!"**

| The Problem | FileFlow Solution |
|-------------|-------------------|
| You wrote API docs in Markdown, but the PM needs `.docx` for approval workflow. Manual copy-paste breaks formatting. | 1. Use the **Smart Workflow**<br>2. **Step 1**: Add a **Format Conversion** step, batch convert `.md` to `.docx`<br>3. **Step 2**: Add a **Rename** step with date suffix `_20250128` and version `_v1`<br>4. Fully automated — an afternoon's work done in one minute |

### 📋 Scenario 3: Admin/Project Manager's Filing

> **"Company expense reports have inconsistent naming!"**

| The Problem | FileFlow Solution |
|-------------|-------------------|
| Hundreds of scattered invoices and contract scans named "WeChat Image", "Receipt (1)" — impossible to sort by date. | 1. Use **Rename Rules** to add **date prefixes**<br>2. Use **Find & Replace** to clean up messy characters<br>3. Use **Format Conversion** to unify image formats<br>4. Save as a **Workflow Template** — reuse next quarter with one click! |

### ⚡ More Use Cases

| User | Use Case |
|------|----------|
| 📸 **Photographers / Content Creators** | Batch rename raw materials with `date+sequence`, convert to publish-ready formats |
| 📚 **Researchers / Educators** | Clean up OCR-exported papers with find/replace and sequential numbering for easy citation |
| 💼 **Finance Professionals** | Batch convert `.html` e-invoices to `.md` or `.pdf`, auto-rename for archiving |
| 🤖 **AI Trainers** | Unify training dataset naming and formats with one click for better AI recognition |

> 💡 **Business Impact**: Organizations using automated file processing can **eliminate 90% of manual file naming work** and **reduce daily repetitive tasks by 3+ hours**.

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
| **OCR Engine** | [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) (Apache License 2.0) |
| **i18n** | `react-i18next`, `i18next` |

---

## 🚀 Installation

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

---

## 📖 Getting Started

### ✏️ Batch Rename

1. Click **"Select Folder & Scan"** to choose a target folder
2. In the rename rules section, select a rule type:
   - **Add Prefix**: Enter prefix text
   - **Add Suffix**: Enter suffix text
   - **Find & Replace**: Enter search and replacement text
   - **Insert Date**: Choose position (prefix/suffix) and date format (e.g., `yyyyMMdd`)
   - **Add Sequence**: Set start value, step, and digit count
3. Click **"+ Add Rule"** to compose multiple rules, executed in order
4. Preview table shows real-time rename results
5. Click **"Execute Rename"** when ready — full **undo** support available

### 🔄 Format Conversion

1. Select **Source Format** and **Target Format**
2. Choose files:
   - **"Select Single File"**: Convert one file
   - **"Select Multiple Files"**: Batch convert multiple files
3. Progress notifications during conversion
4. Output files saved in the same directory as source files

**Supported Conversions:**

| Source Format | Target Format |
|---------------|---------------|
| Word (.docx) | Markdown (.md) |
| Markdown (.md) | HTML (.html) / PDF (.pdf) |
| HTML (.html) | Markdown (.md) |
| JPEG (.jpg) | PNG (.png) |
| PNG (.png) | JPEG (.jpg) |

### 📁 Smart Classification

1. Switch to the **"Classify"** tab
2. Choose a classification rule:
   - **By Extension**: Move files with specific extensions to a folder
   - **By Keyword**: Move files containing keywords in their names
   - **By Size**: Move files within a size range
   - **By Date**: Move files older/newer than N days
3. Set the target folder name
4. Preview and execute — files auto-sorted into organized folders

### ⚡ Intelligent Workflow

1. Switch to the **"Workflow"** tab
2. Click **"Add Step"** to choose rename, conversion, or classification
3. Use ↑↓ buttons to reorder steps
4. Optional: Check **"Keep original files after conversion"**
5. Click **"Execute Workflow"** to run all steps in order
6. Full **"Undo Workflow"** support to restore all files

### 💾 Template Management

| Action | Description |
|--------|-------------|
| **Save Template** | Save current workflow steps as a JSON file |
| **Load Template** | Load a previously saved template from JSON |
| **Use Sample Template** | One-click load built-in templates:<br>• 📷 Photo Archive: date prefix + convert to PNG<br>• 📄 Document Backup: docx to md + `_backup` suffix |

---

## 📦 Build

```bash
# Windows installer (.exe)
pnpm build:win

# macOS (.dmg)
pnpm build:mac

# Linux (.AppImage)
pnpm build:linux
```

After building, installers are located in the `release/` directory, ready for distribution.

---

## 📁 Project Structure

```
file-flow/
├── src/
│   ├── main/              # Electron main process
│   │   └── index.ts       # IPC handlers, file operations
│   ├── preload/           # Preload scripts
│   │   └── index.ts       # API exposure
│   └── renderer/          # React renderer process
│       ├── src/
│       │   ├── components/    # UI components
│       │   ├── utils/         # Utility functions
│       │   ├── i18n/          # Internationalization
│       │   └── App.tsx        # Main app component
│       └── index.html
├── build/                 # Build resources (icons, etc.)
├── screenshots/           # Project screenshots
├── release/               # Build output
└── package.json
```

---

## 🙏 Acknowledgments

- [PaddleOCR](https://github.com/PaddlePaddle/PaddleOCR) - Provides OCR text recognition engine (Apache License 2.0)
- [tesseract.js](https://github.com/naptha/tesseract.js) - Previously used as the early OCR engine (replaced)

---

## 📝 License

This project is licensed under the [MIT License](LICENSE).

> **Note**: This project uses PaddleOCR components which are licensed under the [Apache License 2.0](https://github.com/PaddlePaddle/PaddleOCR/blob/main/LICENSE).

---

## 👤 Author

**fantuan9234**

- GitHub: [@fantuan9234](https://github.com/fantuan9234)
- Project: https://github.com/fantuan9234/file-flow

---

<p align="center">If this project helps you, please consider giving it a ⭐ Star!</p>
