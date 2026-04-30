# IPC API 使用指南

## 概述

本应用通过 `window.api` 暴露了三个主要方法用于文件操作：

1. **scanFiles(folderPath)** - 扫描目录中的文件
2. **renameFiles(operations)** - 批量重命名文件
3. **undoRename(history)** - 撤销重命名操作

## API 详细说明

### 1. scanFiles(folderPath)

扫描指定目录下的所有文件，返回文件信息数组。

**参数：**
- `folderPath: string` - 要扫描的目录路径

**返回：**
```typescript
interface FileInfo {
  path: string    // 文件完整路径
  size: number    // 文件大小（字节）
  mtime: Date     // 最后修改时间
}
```

**排除项：**
- 隐藏文件（以 `.` 开头）
- `node_modules`, `.git`, `.svn`, `.hg`, `vendor`, `dist`, `build` 目录

**使用示例：**
```typescript
// 在渲染进程中
const files = await window.api.scanFiles('C:\\Users\\Example\\Documents')
console.log(files)
// [
//   {
//     path: 'C:\\Users\\Example\\Documents\\file1.txt',
//     size: 1024,
//     mtime: new Date('2024-01-01T12:00:00')
//   },
//   ...
// ]
```

### 2. renameFiles(operations)

批量执行文件重命名操作。

**参数：**
```typescript
interface RenameOperation {
  oldPath: string  // 原文件路径
  newPath: string  // 新文件路径
}
```

**返回：**
```typescript
interface RenameResult {
  success: boolean      // 是否成功
  message: string       // 结果消息
  operation?: RenameOperation  // 操作信息
}
```

**特性：**
- 自动创建目标目录（如果不存在）
- 部分失败不影响其他操作
- 返回每个操作的结果

**使用示例：**
```typescript
const operations = [
  { oldPath: 'C:\\file1.txt', newPath: 'C:\\renamed1.txt' },
  { oldPath: 'C:\\file2.txt', newPath: 'C:\\folder\\file2.txt' }
]

const results = await window.api.renameFiles(operations)
console.log(results)
// [
//   { success: true, message: 'Successfully renamed...', operation: {...} },
//   { success: false, message: 'Failed to rename...', operation: {...} }
// ]
```

### 3. undoRename(history)

撤销上一步的重命名操作。

**参数：**
```typescript
interface RenameHistory {
  operations: RenameOperation[]  // 要撤销的操作列表
  timestamp: number              // 时间戳
}
```

**返回：**
- 与 `renameFiles` 相同的结果格式

**使用示例：**
```typescript
// 假设这是之前执行的重命名操作
const lastOperations = [
  { oldPath: 'C:\\file1.txt', newPath: 'C:\\renamed1.txt' },
  { oldPath: 'C:\\file2.txt', newPath: 'C:\\folder\\file2.txt' }
]

// 创建历史记录
const history: RenameHistory = {
  operations: lastOperations,
  timestamp: Date.now()
}

// 撤销操作（会将 renamed1.txt 改回 file1.txt）
const results = await window.api.undoRename(history)
console.log(results)
```

## 完整使用流程

```typescript
import { useState } from 'react'

function FileManagementComponent() {
  const [lastOperations, setLastOperations] = useState([])
  
  // 1. 扫描目录
  const scanDirectory = async (path: string) => {
    try {
      const files = await window.api.scanFiles(path)
      console.log(`找到 ${files.length} 个文件`)
      return files
    } catch (error) {
      console.error('扫描失败:', error)
      throw error
    }
  }
  
  // 2. 批量重命名
  const renameFiles = async (operations: Array<{oldPath: string, newPath: string}>) => {
    try {
      const results = await window.api.executeRename(operations)
      const successCount = results.filter(r => r.success).length
      console.log(`成功重命名 ${successCount}/${operations.length} 个文件`)
      
      // 保存操作记录以便撤销
      setLastOperations(operations)
      return results
    } catch (error) {
      console.error('重命名失败:', error)
      throw error
    }
  }
  
  // 3. 撤销重命名
  const undoLastRename = async () => {
    if (lastOperations.length === 0) {
      console.log('没有可撤销的操作')
      return
    }
    
    try {
      const results = await window.api.undoRename(lastOperations)
      const successCount = results.filter(r => r.success).length
      console.log(`成功撤销 ${successCount}/${lastOperations.length} 个操作`)
      
      // 清空操作记录
      setLastOperations([])
      return results
    } catch (error) {
      console.error('撤销失败:', error)
      throw error
    }
  }
  
  return (
    <div>
      <button onClick={() => scanDirectory('C:\\Users\\Example')}>
        扫描目录
      </button>
      <button onClick={undoLastRename}>
        撤销上次重命名
      </button>
    </div>
  )
}
```

## 注意事项

1. **权限问题**：确保应用有权限访问目标目录
2. **路径格式**：Windows 路径使用双反斜杠 `\\` 或正斜杠 `/`
3. **错误处理**：始终使用 try-catch 包裹 API 调用
4. **大文件操作**：扫描大目录时可能需要较长时间
5. **原子性**：重命名操作不是原子性的，部分失败是可能的

## 安全特性

- 排除了常见的系统目录和隐藏文件
- 自动创建目标目录（使用 `recursive: true`）
- 详细的错误信息帮助调试
- 每个操作独立执行，互不影响
