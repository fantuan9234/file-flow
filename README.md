# FileFlow - 智能文件批量处理中心

<p align="center">
  <strong>一个本地运行的桌面工具，集批量重命名、多格式转换、可保存的智能工作流于一体，彻底解决办公文件处理痛点。</strong>
</p>

<p align="center">
  <a href="#功能特性">功能特性</a> •
  <a href="#技术栈">技术栈</a> •
  <a href="#安装与运行">安装与运行</a> •
  <a href="#使用说明">使用说明</a> •
  <a href="#打包发布">打包发布</a> •
  <a href="#开源协议">开源协议</a>
</p>

---

## ✨ 功能特性

| 功能模块 | 说明 |
|---------|------|
| 📂 **文件夹扫描** | 递归扫描文件夹，自动排除隐藏文件和系统目录 |
| ️ **批量重命名** | 前缀、后缀、查找替换、插入日期、顺序编号，支持规则链组合 |
| 🔄 **多格式转换** | `.docx → .md`、`.md → .html`、`.md → .pdf`、`.html → .md`、`.jpg ↔ .png` |
| ⚡ **智能工作流** | 自由组合重命名 + 格式转换步骤，按顺序一键执行 |
| 💾 **模板管理** | 保存/加载常用规则模板，内置示例模板开箱即用 |
| ↩️ **撤销保护** | 支持单步/整体撤销，格式转换默认保留原文件 |

---

##  项目截图

### 批量重命名

支持多种重命名规则，可自由组合使用：

![批量重命名](screenshots/rename.png)

### 格式转换

支持 Word、Markdown、HTML、图片等多种格式互转：

![格式转换](screenshots/convert.png)

### 智能工作流

自由组合重命名与格式转换步骤，一键执行复杂任务：

![智能工作流](screenshots/workflow.png)

---

## 🛠️ 技术栈

| 类别 | 技术 |
|------|------|
| **框架** | [Electron](https://www.electronjs.org/) + [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| **UI** | [Ant Design](https://ant.design/) |
| **构建工具** | [electron-vite](https://electron-vite.org/) + [Vite](https://vitejs.dev/) |
| **打包工具** | [electron-builder](https://www.electron.build/) |
| **文档转换** | `mammoth`、`marked`、`md-to-pdf`、`turndown` |
| **图片处理** | `sharp` |

---

## 🚀 安装与运行

### 开发环境

```bash
# 1. 克隆仓库
git clone https://github.com/fantuan9234/file-flow.git
cd file-flow

# 2. 安装依赖
pnpm install

# 3. 启动开发模式
pnpm dev
```

### 环境要求

- Node.js >= 18
- pnpm >= 8

---

## 📖 使用说明

### ✏️ 批量重命名

1. 点击 **"选择文件夹并扫描"**，选择目标文件夹
2. 在重命名规则区选择规则类型：
   - **添加前缀**：输入前缀文字
   - **添加后缀**：输入后缀文字
   - **查找替换**：输入查找内容和替换内容
   - **插入日期**：选择位置（前缀/后缀）和日期格式（如 `yyyyMMdd`）
   - **添加序号**：设置起始值、步长、位数
3. 点击 **"+ 添加规则"** 可组合多条规则，按顺序执行
4. 预览表格实时显示重命名效果
5. 确认无误后点击 **"执行重命名"**，支持 **"撤销"** 恢复

###  格式转换

1. 选择 **源格式** 和 **目标格式**
2. 点击按钮选择文件：
   - **"选择单个文件"**：转换单个文件
   - **"选择多个文件"**：批量转换多个文件
3. 转换过程中显示进度提示
4. 输出文件保存在源文件相同目录

**支持的转换格式：**

| 源格式 | 目标格式 |
|--------|---------|
| Word (.docx) | Markdown (.md) |
| Markdown (.md) | HTML (.html) / PDF (.pdf) |
| HTML (.html) | Markdown (.md) |
| JPEG (.jpg) | PNG (.png) |
| PNG (.png) | JPEG (.jpg) |

### ⚡ 智能工作流

1. 切换到 **"智能工作流"** 标签页
2. 点击 **"添加步骤"** 选择重命名规则或格式转换
3. 通过 ↑↓ 按钮调整步骤顺序
4. 可选：勾选 **"格式转换后保留原文件"**
5. 点击 **"执行工作流"** 一键执行所有步骤
6. 支持 **"撤销整个工作流"** 恢复所有文件

### 💾 模板管理

| 操作 | 说明 |
|------|------|
| **保存模板** | 将当前工作流步骤保存为 JSON 文件 |
| **加载模板** | 从 JSON 文件加载之前保存的模板 |
| **使用示例模板** | 一键加载内置模板：<br>•  照片归档：添加日期前缀 + 转 PNG<br>• 📄 文档备份：docx 转 md + 添加后缀 `_backup` |

---

## 📦 打包发布

```bash
# Windows 安装包 (.exe)
pnpm build:win

# macOS (.dmg)
pnpm build:mac

# Linux (.AppImage)
pnpm build:linux
```

打包完成后，安装包位于 `release/` 目录，可直接分发给他人安装使用。

---

## 📁 项目结构

```
file-flow/
├── src/
│   ├── main/          # Electron 主进程
│   │   └── index.ts   # IPC 处理器、文件操作
│   ├── preload/       # 预加载脚本
│   │   └── index.ts   # API 暴露
│   └── renderer/      # React 渲染进程
│       ├── src/
│       │   ├── components/   # UI 组件
│       │   ├── utils/        # 工具函数
│       │   └── App.tsx       # 主应用组件
│       └── index.html
├── build/             # 构建资源（图标等）
├── screenshots/       # 项目截图
├── release/           # 打包输出
└── package.json
```

---

## 📝 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 👤 作者

**fantuan9234**

- GitHub: [@fantuan9234](https://github.com/fantuan9234)
- 项目地址: https://github.com/fantuan9234/file-flow

---

<p align="center">如果这个项目对你有帮助，欢迎 ⭐ Star 支持一下！</p>
