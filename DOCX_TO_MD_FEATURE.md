# 格式转换功能 - Word (.docx) 转 Markdown

## ✅ 功能实现完成

已成功添加独立的格式转换功能：将 Word (.docx) 文件转换为 Markdown (.md) 格式。

---

## 🎯 功能特性

### 核心功能
- ✅ 选择单个 .docx 文件
- ✅ 使用 mammoth 库转换为 Markdown
- ✅ 自动保存到源文件相同目录
- ✅ 文件名规则：源文件名（不含扩展名）+ .md
- ✅ 完整的错误处理和用户提示

### 支持的格式
- ✅ 文本内容
- ✅ 标题（Heading 1-6）
- ✅ 列表（有序/无序）
- ✅ 表格
- ✅ 粗体/斜体
- ✅ 链接
- ✅ 图片（转换为 Markdown 图片语法）

---

## 📦 修改的文件

### 1. 主进程 - `src/main/index.ts`

#### ① 新增导入（第 4 行）
```typescript
import mammoth from 'mammoth';
```

**说明**：引入 mammoth 库用于 .docx 到 Markdown 的转换。

#### ② 新增 IPC 处理器 - 选择单个文件（第 128-140 行）
```typescript
// ============ 新增：选择单个文件 ============
ipcMain.handle('select-file', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'Word 文件', extensions: ['docx'] },
      { name: '所有文件', extensions: ['*'] },
    ],
  });
  if (result.canceled || result.filePaths.length === 0) {
    return { success: false };
  }
  return { success: true, path: result.filePaths[0] };
});
```

**功能**：
- 打开系统文件选择对话框
- 默认过滤只显示 .docx 文件
- 返回选中文件的完整路径

#### ③ 新增 IPC 处理器 - 格式转换（第 142-176 行）
```typescript
// ============ 新增：格式转换功能 ============
ipcMain.handle('convert-docx-to-md', async (_, filePath: string) => {
  try {
    // 验证文件是否存在
    if (!fs.existsSync(filePath)) {
      return { success: false, error: '文件不存在' };
    }

    // 验证文件扩展名
    const ext = path.extname(filePath).toLowerCase();
    if (ext !== '.docx') {
      return { success: false, error: '只支持 .docx 格式的文件' };
    }

    // 读取 .docx 文件并转换为 Markdown
    const result = await mammoth.convertToMarkdown({ path: filePath });
    
    if (result.messages && result.messages.length > 0) {
      console.log('转换警告:', result.messages);
    }

    // 生成输出文件路径（同名 .md 文件）
    const dir = path.dirname(filePath);
    const baseName = path.basename(filePath, '.docx');
    const outputPath = path.join(dir, baseName + '.md');

    // 保存 Markdown 文件
    fs.writeFileSync(outputPath, result.value, 'utf-8');

    return { success: true, outputPath };
  } catch (error) {
    return { success: false, error: String(error) };
  }
});
```

**功能**：
- 验证文件存在性和格式
- 使用 mammoth 转换 .docx 到 Markdown
- 生成输出文件路径（同名 .md）
- 保存 Markdown 文件到磁盘
- 返回转换结果和输出路径

**错误处理**：
- 文件不存在 → 返回错误
- 非 .docx 文件 → 返回错误
- 转换失败 → 返回错误信息

---

### 2. Preload 脚本 - `src/preload/index.ts`

#### 新增暴露方法（第 11-14 行）
```typescript
contextBridge.exposeInMainWorld('fileAPI', {
  selectFolder: () => ipcRenderer.invoke('select-folder'),
  scanFiles: (folderPath: string) => ipcRenderer.invoke('scan-files', folderPath),
  renameFiles: (ops: { oldPath: string; newPath: string }[]) => ipcRenderer.invoke('execute-rename', ops),
  undoRename: () => ipcRenderer.invoke('undo-rename'),
  getDroppedFolderPath: () => ipcRenderer.invoke('get-dropped-folder-path'),
  // 新增：选择单个文件
  selectFile: () => ipcRenderer.invoke('select-file'),
  // 新增：格式转换
  convertDocxToMd: (filePath: string) => ipcRenderer.invoke('convert-docx-to-md', filePath),
});
```

**说明**：
- `selectFile()` - 打开文件选择对话框
- `convertDocxToMd(filePath)` - 执行格式转换

---

### 3. 类型声明 - `src/renderer/src/electron.d.ts`

#### 新增类型定义（第 45-48 行）
```typescript
export interface FileAPI {
  scanFiles: (folderPath: string) => Promise<{ success: boolean; data?: FileInfo[]; error?: string }>
  selectFolder: () => Promise<{ success: boolean; path?: string }>
  renameFiles: (operations: { oldPath: string; newPath: string }[]) => Promise<{ success: boolean; error?: string }>
  undoRename: () => Promise<{ success: boolean; error?: string }>
  getDroppedFolderPath: () => Promise<{ success: boolean; path?: string; error?: string }>
  // 新增：选择单个文件
  selectFile: () => Promise<{ success: boolean; path?: string }>
  // 新增：格式转换
  convertDocxToMd: (filePath: string) => Promise<{ success: boolean; outputPath?: string; error?: string }>
}
```

**说明**：
- `selectFile` - 返回成功状态和文件路径
- `convertDocxToMd` - 返回成功状态和输出路径

---

### 4. 前端界面 - `src/renderer/src/App.tsx`

#### 新增格式转换卡片（第 384-438 行）
```tsx
{/* 格式转换卡片 */}
<Card 
  title="格式转换" 
  style={{ marginBottom: 16 }}
  extra={
    <Space>
      <Button 
        type="primary" 
        onClick={async () => {
          try {
            // 选择 .docx 文件
            const fileRes = await window.fileAPI.selectFile();
            if (!fileRes.success || !fileRes.path) {
              message.info('未选择文件');
              return;
            }
            
            setLoading(true);
            
            // 执行转换
            const convertRes = await window.fileAPI.convertDocxToMd(fileRes.path);
            
            if (convertRes.success && convertRes.outputPath) {
              message.success(`转换成功！已保存为：${convertRes.outputPath}`);
            } else {
              message.error('转换失败：' + (convertRes.error || '未知错误'));
            }
          } catch (err) {
            message.error('转换出错：' + String(err));
          } finally {
            setLoading(false);
          }
        }}
        loading={loading}
        size="large"
      >
        选择 Word 文件并转为 Markdown
      </Button>
    </Space>
  }
>
  <Space direction="vertical" style={{ width: '100%' }}>
    <div style={{ color: '#666', fontSize: '14px' }}>
      <p style={{ marginBottom: 8 }}>
        <strong>功能说明：</strong>将 Word (.docx) 文件转换为 Markdown (.md) 格式
      </p>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        <li>支持转换文本、标题、列表、表格等基本格式</li>
        <li>转换后的文件保存在源文件相同目录</li>
        <li>文件名规则：源文件名（不含扩展名）+ .md</li>
      </ul>
    </div>
  </Space>
</Card>
```

**功能说明**：
- 独立的卡片区域
- 大按钮易于点击
- 完整的错误处理
- 用户友好的提示信息
- 转换成功后显示输出路径

---

## 🎨 UI 效果

### 界面布局

```
┌─────────────────────────────────────────┐
│ FileFlow - 智能文件处理中心              │
├─────────────────────────────────────────┤
│ [选择文件夹并扫描]                       │
├─────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ │
│ │ 格式转换                            │ │
│ │                                     │ │
│ │ 功能说明：将 Word (.docx) 文件转换   │ │
│ │ 为 Markdown (.md) 格式               │ │
│ │ • 支持转换文本、标题、列表、表格等   │ │
│ │ • 转换后的文件保存在源文件相同目录   │ │
│ │ • 文件名规则：源文件名 + .md         │ │
│ │                                     │ │
│ │              [选择 Word 文件并转为    │ │
│ │               Markdown]             │ │
│ └─────────────────────────────────────┘ │
├─────────────────────────────────────────┤
│ 重命名规则链                             │
│ ...                                      │
└─────────────────────────────────────────┘
```

### 交互流程

```
用户点击"选择 Word 文件并转为 Markdown"按钮
    ↓
弹出系统文件选择对话框
    ↓
用户选择 .docx 文件
    ↓
调用 window.fileAPI.convertDocxToMd(filePath)
    ↓
主进程验证文件
    ↓
使用 mammoth 转换
    ↓
生成 .md 文件
    ↓
返回输出路径
    ↓
显示成功提示（包含输出路径）
```

---

## 📊 技术细节

### Mammoth 库

**安装**（已安装）：
```json
{
  "dependencies": {
    "mammoth": "^1.12.0"
  }
}
```

**用途**：
- 将 .docx 文件转换为 Markdown
- 保留基本格式（标题、列表、表格等）
- 不支持复杂格式（宏、VBA 等）

**API**：
```typescript
const result = await mammoth.convertToMarkdown({ path: filePath });
// result.value - Markdown 文本
// result.messages - 转换过程中的警告信息
```

### 文件命名规则

**输入**：`/path/to/document.docx`

**输出**：`/path/to/document.md`

**逻辑**：
```typescript
const dir = path.dirname(filePath);           // /path/to
const baseName = path.basename(filePath, '.docx'); // document
const outputPath = path.join(dir, baseName + '.md'); // /path/to/document.md
```

---

## ✅ 保留的所有功能

格式转换功能完全独立，不影响现有功能：

### 1. 文件夹扫描
- ✅ 选择文件夹并扫描
- ✅ 显示文件列表

### 2. 重命名规则链
- ✅ 添加/删除/移动规则
- ✅ 5 种规则类型（前缀/后缀/查找替换/日期/序号）

### 3. 实时预览
- ✅ 300ms 防抖自动预览
- ✅ 参数修改自动更新

### 4. 执行操作
- ✅ 执行重命名
- ✅ 撤销重命名

---

## 🚀 使用指南

### 转换 Word 为 Markdown

**步骤**：

1. **点击按钮**
   - 点击"选择 Word 文件并转为 Markdown"

2. **选择文件**
   - 系统弹出文件选择对话框
   - 选择 .docx 文件
   - 点击"打开"

3. **等待转换**
   - 按钮显示加载状态
   - 自动执行转换

4. **查看结果**
   - 成功：显示成功提示和输出路径
   - 失败：显示错误信息

5. **打开文件**
   - 到输出路径查看 .md 文件
   - 使用 Markdown 编辑器打开

### 示例

**输入文件**：
```
C:\Users\Documents\report.docx
```

**输出文件**：
```
C:\Users\Documents\report.md
```

**转换内容**：
```markdown
# 标题 1

## 标题 2

这是普通文本。

- 列表项 1
- 列表项 2

| 列 1 | 列 2 |
|------|------|
| 值 1  | 值 2  |
```

---

## ⚠️ 注意事项

### 1. 文件格式
- ✅ 仅支持 .docx 格式
- ❌ 不支持 .doc（旧版 Word 格式）
- ❌ 不支持其他格式

### 2. 转换限制
- ✅ 支持基本格式（文本、标题、列表、表格）
- ⚠️ 复杂格式可能丢失（样式、主题等）
- ❌ 不支持宏、VBA 脚本

### 3. 文件编码
- ✅ 输出文件使用 UTF-8 编码
- ✅ 兼容所有 Markdown 编辑器

### 4. 错误处理
- 文件不存在 → 显示错误
- 非 .docx 文件 → 显示错误
- 转换失败 → 显示详细错误信息

---

## 📝 测试建议

### 测试场景

1. **正常转换**
   - ✅ 选择 .docx 文件
   - ✅ 转换成功
   - ✅ 显示输出路径
   - ✅ 打开 .md 文件验证内容

2. **取消选择**
   - ✅ 点击按钮
   - ✅ 取消文件选择
   - ✅ 显示"未选择文件"提示

3. **错误处理**
   - ✅ 选择非 .docx 文件 → 显示错误
   - ✅ 文件不存在 → 显示错误
   - ✅ 文件损坏 → 显示错误

4. **多文件测试**
   - ✅ 转换多个不同的 .docx 文件
   - ✅ 验证所有输出文件

### 测试文件

**简单文档**：
- 包含文本、标题
- 验证基本转换

**复杂文档**：
- 包含列表、表格
- 验证格式保留

**特殊字符**：
- 包含中文、特殊符号
- 验证编码正确

---

## 🎉 总结

格式转换功能已完全实现！

✅ **功能完整** - Word (.docx) 转 Markdown  
✅ **用户友好** - 简单点击，自动保存  
✅ **错误处理** - 完整的验证和提示  
✅ **独立运行** - 不影响现有功能  
✅ **类型安全** - TypeScript 类型定义完整  

现在你可以：

1. ✅ 点击"选择 Word 文件并转为 Markdown"按钮
2. ✅ 选择 .docx 文件
3. ✅ 自动转换并保存
4. ✅ 查看转换结果
5. ✅ 继续使用重命名功能

界面更强大，功能更全面！🚀
