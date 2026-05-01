# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v1.0.0] - 2025-01-28

### 🎉 首次正式发布

FileFlow v1.0.0 是一个功能完整的桌面文件批量处理工具，集重命名、格式转换、智能分类和工作流于一体。

### ✨ 新增功能

#### 📂 批量重命名
- 支持 5 种重命名规则：前缀、后缀、查找替换、插入日期、顺序编号
- 规则链系统：可自由组合多条规则，按顺序执行
- 实时预览：修改规则后自动显示重命名效果
- 撤销支持：单步撤销，随时恢复原文件

#### 🔄 多格式转换
- 支持 6 种格式互转：
  - Word (.docx) → Markdown (.md)
  - Markdown (.md) → HTML (.html) / PDF (.pdf)
  - HTML (.html) → Markdown (.md)
  - JPEG (.jpg) ↔ PNG (.png)
- 单文件/批量转换模式
- 转换进度实时显示
- 默认保留原文件

#### 📁 智能分类
- 4 种分类规则：
  - 按扩展名（如 pdf、jpg、docx）
  - 按关键词（如 合同、发票）
  - 按文件大小（范围筛选）
  - 按修改日期（早于/近于 N 天）
- 分类预览表格
- 一键执行分类，自动创建目标文件夹
- 分类撤销支持

#### ⚡ 智能工作流
- 自由组合重命名、格式转换、智能分类步骤
- 可视化步骤管理：添加、删除、上移、下移
- 步骤参数实时编辑
- 一键执行整个工作流
- 整体撤销，恢复所有文件
- 内置示例模板：
  - 照片归档：日期前缀 + 转 PNG
  - 文档备份：docx 转 md + 后缀 `_backup`

#### 💾 模板系统
- 保存当前工作流为 JSON 模板文件
- 从 JSON 文件加载模板
- 一键使用内置示例模板

#### ↩️ 撤销历史
- 每个功能模块独立撤销支持
- 工作流整体撤销
- 撤销后自动刷新文件列表

#### 🌍 国际化
- 完整的中英文双语支持
- 右上角一键切换语言
- 语言偏好持久化保存

#### 🎨 界面美化
- 标签页布局：重命名、转换、分类、工作流四个模块
- 现代清爽配色方案（Indigo 主题色）
- 暗黑模式完整支持：
  - 全局背景色、文字色、边框色自动适配
  - Ant Design 组件主题切换
  - 自定义 CSS 变量兜底
  - 平滑过渡动画
- 自定义窗口标题栏（无边框设计）
- 操作确认弹窗（可全局关闭）
- 加载状态与进度提示

### 🛠️ 技术栈

- **框架**: Electron + React + TypeScript
- **UI 库**: Ant Design
- **构建工具**: electron-vite + Vite
- **打包工具**: electron-builder
- **文档转换**: mammoth, marked, md-to-pdf, turndown
- **图片处理**: sharp
- **国际化**: react-i18next, i18next

### 📦 安装方式

```bash
# 克隆仓库
git clone https://github.com/fantuan9234/file-flow.git
cd file-flow

# 安装依赖
pnpm install

# 开发模式
pnpm dev

# 打包 Windows 安装包
pnpm build:win
```

### 📝 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

---

## 链接

- [GitHub 仓库](https://github.com/fantuan9234/file-flow)
- [中文文档](README.zh-CN.md)
- [English README](README.md)
