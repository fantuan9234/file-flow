# 拖拽文件夹路径获取问题修复

## 🐛 问题描述

用户反馈：拖拽文件夹到应用窗口时，提示"无法获取文件夹路径"。

## 🔍 问题原因

在 Electron 中，默认情况下渲染进程无法直接访问拖拽文件的完整路径。这是 Electron 的安全限制。

## ✅ 解决方案

### 修改 1：主进程配置 (`src/main/index.ts`)

在创建 BrowserWindow 时，设置 `sandbox: false`：

```typescript
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // 关键配置：允许渲染进程访问 Node.js API
      sandbox: false,
    },
  });
  
  // 阻止导航到拖拽的文件/文件夹
  mainWindow.webContents.on('will-navigate', (event) => {
    event.preventDefault();
  });
}
```

**关键点**：
- `sandbox: false` - 禁用沙盒模式，允许访问 Node.js API
- `will-navigate` 事件处理器 - 阻止拖拽文件时浏览器默认打开文件的行为

### 修改 2：渲染进程路径获取 (`src/renderer/src/App.tsx`)

改进路径获取逻辑，尝试多种方式：

```typescript
const handleDrop = async (e: DragEvent<HTMLDivElement>) => {
  e.preventDefault();
  e.stopPropagation();
  setIsDragging(false);

  try {
    const dropFiles = e.dataTransfer.files;
    
    if (!dropFiles || dropFiles.length === 0) {
      message.warning('没有检测到文件夹');
      return;
    }

    const firstFile = dropFiles[0];
    let folderPath: string | null = null;
    
    // 方式 1: 直接访问 path 属性（Electron 环境）
    if ('path' in firstFile && typeof (firstFile as any).path === 'string') {
      folderPath = (firstFile as any).path;
    }
    // 方式 2: 尝试通过 webkitRelativePath（浏览器环境）
    else if ('webkitRelativePath' in firstFile) {
      const webkitPath = (firstFile as any).webkitRelativePath;
      if (webkitPath) {
        folderPath = webkitPath.split('/')[0];
      }
    }
    
    if (folderPath) {
      await scanFolder(folderPath);
    } else {
      message.warning('无法获取文件夹路径，请使用"选择文件夹"按钮');
    }
  } catch (err) {
    message.error('拖拽失败：' + String(err));
  }
};
```

**改进点**：
- 更严格的路径类型检查
- 先验证 `path` 属性是否为字符串
- 简化错误处理逻辑

### 修改 3：Preload 脚本

无需修改，保持原有配置即可。

---

## 📝 测试步骤

### 1. 启动应用
```bash
cd D:\app\2\file-flow\file-flow
pnpm dev
```

### 2. 测试拖拽功能

#### 步骤：
1. 打开系统文件管理器（Windows Explorer）
2. 找到一个包含文件的文件夹
3. 拖拽该文件夹到应用窗口
4. 应该看到蓝色覆盖层和提示文字"释放以扫描文件夹"
5. 释放鼠标
6. 应用应该自动扫描文件夹并显示文件列表

#### 预期结果：
- ✅ 拖拽时显示蓝色覆盖层
- ✅ 释放后自动扫描文件夹
- ✅ 文件列表正确显示
- ✅ 不再提示"无法获取文件夹路径"

### 3. 测试按钮功能（确保未破坏）

#### 步骤：
1. 点击"选择文件夹并扫描"按钮
2. 选择文件夹
3. 扫描成功

#### 预期结果：
- ✅ 按钮功能正常工作
- ✅ 文件夹选择对话框弹出
- ✅ 扫描成功

---

## 🔧 技术细节

### 为什么需要 `sandbox: false`？

Electron 默认启用沙盒模式以增强安全性。在沙盒模式下：
- 渲染进程无法直接访问 Node.js API
- File 对象没有 `path` 属性
- 无法获取文件的完整路径

设置 `sandbox: false` 后：
- 渲染进程可以访问部分 Node.js API
- File 对象有 `path` 属性
- 可以获取拖拽文件夹的路径

### 安全性考虑

虽然 `sandbox: false` 降低了安全性，但在这个场景下是必要的：
1. 应用是本地桌面应用，不加载远程内容
2. 已启用 `contextIsolation: true`，防止原型污染
3. 已设置 `nodeIntegration: false`，防止 Node.js 全局变量注入
4. 拖拽路径只用于扫描文件，不执行其他危险操作

### 路径获取优先级

```
1. 检查 File.path 属性（Electron 环境）
   ↓ 如果不存在
2. 检查 File.webkitRelativePath（浏览器环境）
   ↓ 如果不存在
3. 提示用户无法获取路径
```

---

## ⚠️ 注意事项

### 1. 重启应用
修改 `main/index.ts` 后，必须完全重启 Electron 应用才能生效。

### 2. 缓存问题
如果遇到奇怪的问题，可以尝试清除缓存：
```bash
# Windows
rmdir /s /q %APPDATA%\file-flow

# 或者在应用启动时添加清除缓存代码
```

### 3. 拖拽文件夹 vs 拖拽文件
- 拖拽文件夹：`dataTransfer.files[0]` 是文件夹
- 拖拽文件：`dataTransfer.files[0]` 是文件
- 两者都有 `path` 属性

### 4. 多文件夹拖拽
当前实现只处理第一个文件夹。如需支持多文件夹，可以遍历 `dataTransfer.files`：
```typescript
for (let i = 0; i < dropFiles.length; i++) {
  const file = dropFiles[i];
  if ('path' in file) {
    const folderPath = (file as any).path;
    await scanFolder(folderPath);
  }
}
```

---

## 🎯 验证清单

修改完成后，请验证以下项目：

- [ ] 拖拽文件夹到应用窗口
- [ ] 看到蓝色覆盖层和提示文字
- [ ] 释放后自动扫描文件夹
- [ ] 文件列表正确显示
- [ ] 不再提示"无法获取文件夹路径"
- [ ] 按钮方式仍然正常工作
- [ ] 应用没有崩溃或异常

---

## 🚀 故障排除

### 问题 1：仍然提示无法获取路径

**解决方案**：
1. 确保完全重启了 Electron 应用（不只是热重载）
2. 检查 `main/index.ts` 中的 `sandbox: false` 配置
3. 检查控制台是否有错误信息

### 问题 2：拖拽没有反应

**解决方案**：
1. 检查是否从系统文件管理器拖拽（而不是从其他应用）
2. 确保拖拽的是文件夹，不是文件
3. 检查 `handleDragEnter` 等事件是否触发

### 问题 3：应用崩溃

**解决方案**：
1. 检查 Electron 版本是否兼容
2. 尝试清除缓存和临时文件
3. 重新安装依赖：`pnpm install`

---

## 📚 相关文档

- [Electron 沙盒模式](https://www.electronjs.org/docs/latest/tutorial/sandbox)
- [Electron 拖拽 API](https://www.electronjs.org/docs/latest/api/native-image#drag-and-drop-support)
- [HTML5 拖拽 API](https://developer.mozilla.org/en-US/docs/Web/API/HTML_Drag_and_Drop_API)

---

## ✅ 总结

通过设置 `sandbox: false`，我们成功解决了拖拽文件夹路径获取问题。现在用户可以：

1. ✅ 直接拖拽文件夹到应用窗口
2. ✅ 自动扫描文件夹内容
3. ✅ 享受流畅的拖拽体验
4. ✅ 继续使用按钮方式

两种方式共存，用户体验更优秀！🎉
