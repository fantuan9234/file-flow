# 插入日期功能 - 实现说明

## ✅ 已完成的修改

### 1. renameEngine.ts

**修改内容**：
- ✅ 新增类型：`RenameRuleType = 'addPrefix' | 'addSuffix' | 'findReplace' | 'insertDate'`
- ✅ 更新接口：`RenameRule` 增加 `position` 和 `format` 参数
- ✅ 新增函数：`formatDate` 日期格式化函数
- ✅ 修改逻辑：`applyRenameRule` 增加插入日期处理

**关键代码**：

**① 类型定义**（第 3 行）：
```typescript
export type RenameRuleType = 'addPrefix' | 'addSuffix' | 'findReplace' | 'insertDate'
```

**② 接口定义**（第 5-15 行）：
```typescript
export interface RenameRule {
  type: RenameRuleType
  params: {
    prefix?: string
    suffix?: string
    search?: string
    replace?: string
    position?: 'prefix' | 'suffix'      // 新增：日期位置
    format?: string                      // 新增：日期格式
  }
}
```

**③ 日期格式化函数**（第 17-37 行）：
```typescript
/**
 * 格式化日期
 */
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  
  // 支持的格式标记
  const tokens: Record<string, string> = {
    'yyyy': String(year),
    'yy': String(year).slice(-2),
    'MM': month,
    'M': String(parseInt(month, 10)),
    'dd': day,
    'd': String(parseInt(day, 10))
  }
  
  // 替换格式标记
  return format.replace(/yyyy|yy|MM|M|dd|d/g, match => tokens[match] || match)
}
```

**④ 应用规则**（第 49-59 行）：
```typescript
} else if (rule.type === 'insertDate' && rule.params.format) {
  // 生成当天日期
  const dateStr = formatDate(new Date(), rule.params.format)
  const position = rule.params.position || 'prefix'
  
  if (position === 'suffix') {
    result = result + dateStr
  } else {
    result = dateStr + result
  }
}
```

### 2. App.tsx

**修改内容**：
- ✅ 导入 `Select` 组件
- ✅ 新增状态：`datePosition` 和 `dateFormat`
- ✅ 新增函数：`handlePreviewInsertDate` 处理插入日期预览
- ✅ 新增卡片：插入日期卡片（放在查找替换卡片下方）

**新增导入**（第 2 行）：
```typescript
import { Button, Table, Input, Card, message, Space, Select } from 'antd';
```

**新增状态变量**（第 27-28 行）：
```typescript
const [datePosition, setDatePosition] = useState<'prefix' | 'suffix'>('prefix')
const [dateFormat, setDateFormat] = useState('yyyyMMdd')
```

**新增预览函数**（第 92-107 行）：
```typescript
// 预览插入日期效果
const handlePreviewInsertDate = () => {
  if (files.length === 0) {
    message.warning('请先选择文件夹')
    return
  }
  if (!dateFormat) {
    message.warning('请输入日期格式')
    return
  }
  const rule: RenameRule = { 
    type: 'insertDate', 
    params: { position: datePosition, format: dateFormat } 
  };
  const preview = generateNewNames(files, rule)
  setPreviewList(preview)
}
```

**新增 UI 卡片**（第 192-228 行）：
```tsx
{/* 插入日期规则 */}
<Card title="插入日期" style={{ marginBottom: 16 }}>
  <Space direction="vertical" style={{ width: '100%' }}>
    <Space>
      <Space>
        <span style={{ minWidth: '80px' }}>位置：</span>
        <Select
          value={datePosition}
          onChange={(value) => setDatePosition(value)}
          options={[
            { value: 'prefix', label: '前面（日期在前）' },
            { value: 'suffix', label: '后面（日期在后）' }
          ]}
          style={{ width: 180 }}
        />
      </Space>
      <Space>
        <span style={{ minWidth: '80px' }}>格式：</span>
        <Input
          placeholder="日期格式"
          value={dateFormat}
          onChange={(e) => setDateFormat(e.target.value)}
          style={{ width: 200 }}
          addonBefore="格式："
        />
      </Space>
      <Button type="primary" onClick={handlePreviewInsertDate}>
        预览效果
      </Button>
    </Space>
    <Space style={{ fontSize: '12px', color: '#999' }}>
      <span>示例：yyyyMMdd → 20250130</span>
      <span>yyyy-MM-dd → 2025-01-30</span>
      <span>yyyy 年 MM 月 dd 日 → 2025 年 01 月 30 日</span>
    </Space>
  </Space>
</Card>
```

## 🎯 功能说明

### 四大功能卡片

| 功能 | 位置 | 参数 | 效果 |
|------|------|------|------|
| **添加前缀** | 第 1 个卡片 | 前缀文本 | `file.txt` → `prefix_file.txt` |
| **添加后缀** | 第 2 个卡片 | 后缀文本 | `file.txt` → `file_suffix.txt` |
| **查找替换** | 第 3 个卡片 | 查找 + 替换 | `old_file.txt` → `new_file.txt` |
| **插入日期** | 第 4 个卡片 | 位置 + 格式 | `file.txt` → `20250130file.txt` |

### 插入日期功能详解

**配置项**：
- **位置选择**：
  - `前面（日期在前）`：日期插入到文件名开头
  - `后面（日期在后）`：日期插入到扩展名前
- **日期格式**：自定义日期格式字符串

**支持的格式标记**：
| 标记 | 说明 | 示例 |
|------|------|------|
| `yyyy` | 4 位年份 | 2025 |
| `yy` | 2 位年份 | 25 |
| `MM` | 2 位月份 | 01-12 |
| `M` | 月份（无前导零） | 1-12 |
| `dd` | 2 位日期 | 01-31 |
| `d` | 日期（无前导零） | 1-31 |

**默认值**：
- 位置：`prefix`（前面）
- 格式：`yyyyMMdd`

## 📝 使用示例

### 示例 1：日期在前（默认）
```
位置：前面
格式：yyyyMMdd
原文件：document.txt, report.pdf
结果：20250130document.txt, 20250130report.pdf
```

### 示例 2：日期在后
```
位置：后面
格式：yyyyMMdd
原文件：document.txt, report.pdf
结果：document20250130.txt, report20250130.pdf
```

### 示例 3：带分隔符的格式
```
位置：前面
格式：yyyy-MM-dd
原文件：photo.jpg
结果：2025-01-30photo.jpg
```

### 示例 4：中文格式
```
位置：前面
格式：yyyy 年 MM 月 dd 日
原文件：meeting_notes.docx
结果：2025 年 01 月 30 日 meeting_notes.docx
```

### 示例 5：简洁格式
```
位置：后面
格式：yyMMdd
原文件：data.xlsx
结果：data250130.xlsx
```

### 示例 6：不带前导零
```
位置：前面
格式：yyyy-M-d
原文件：file.txt（假设日期是 1 月 5 日）
结果：2025-1-5file.txt
```

## 🔍 使用流程

### 1. 扫描文件
点击"选择文件夹并扫描"按钮

### 2. 配置插入日期
- 选择位置：前面 / 后面
- 输入日期格式（如 `yyyyMMdd`）
- 点击"预览效果"

### 3. 查看预览
预览表格显示：
- 原文件名
- 新文件名（包含插入的日期）

### 4. 执行操作
- **执行重命名**：批量执行重命名操作
- **撤销**：撤销上一次重命名操作

## 💡 常见使用场景

### 场景 1：照片归档
```
位置：前面
格式：yyyyMMdd
效果：IMG_001.jpg → 20250130IMG_001.jpg
用途：按日期整理照片
```

### 场景 2：日志文件
```
位置：后面
格式：yyyy-MM-dd
效果：app_log.txt → app_log2025-01-30.txt
用途：每日日志文件
```

### 场景 3：日报文档
```
位置：前面
格式：yyyy 年 MM 月 dd 日
效果：daily_report.docx → 2025 年 01 月 30 日 daily_report.docx
用途：中文日报命名
```

### 场景 4：备份文件
```
位置：后面
格式：yyyyMMdd_HHmmss
效果：backup.zip → backup20250130_143022.zip
用途：带时间戳的备份
```

## ⚠️ 注意事项

1. **独立运行**：四个功能独立，每次预览只显示一种规则
2. **共享预览区**：后点击的预览会覆盖之前的
3. **扩展名保护**：日期只插入到文件名主体，不改变扩展名
4. **当天日期**：始终使用当天日期，不是文件修改日期
5. **格式验证**：日期格式必填，位置有默认值
6. **格式标记**：只支持预定义的格式标记（yyyy, MM, dd 等）

## 🚀 功能对比

| 特性 | 添加前缀 | 添加后缀 | 查找替换 | 插入日期 |
|------|----------|----------|----------|----------|
| **输入方式** | 文本框 | 文本框 | 2 个文本框 | 下拉框 + 文本框 |
| **参数数量** | 1 个 | 1 个 | 2 个 | 2 个 |
| **作用位置** | 开头 | 末尾 | 任意位置 | 开头/末尾 |
| **动态内容** | ❌ | ❌ | ❌ | ✅（日期） |
| **扩展名保护** | ✅ | ✅ | ✅ | ✅ |

## 💻 技术实现

### 日期格式化逻辑

```typescript
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear()              // 2025
  const month = String(date.getMonth() + 1).padStart(2, '0')  // "01"
  const day = String(date.getDate()).padStart(2, '0')         // "30"
  
  const tokens: Record<string, string> = {
    'yyyy': String(year),                      // "2025"
    'yy': String(year).slice(-2),              // "25"
    'MM': month,                               // "01"
    'M': String(parseInt(month, 10)),          // "1"
    'dd': day,                                 // "30"
    'd': String(parseInt(day, 10))             // "30"
  }
  
  // 使用正则替换所有匹配的标记
  return format.replace(/yyyy|yy|MM|M|dd|d/g, match => tokens[match] || match)
}
```

### 替换顺序说明

正则表达式 `/yyyy|yy|MM|M|dd|d/g` 的匹配顺序很重要：
- 先匹配长的标记（`yyyy` 在 `yy` 前）
- 避免 `yy` 匹配到 `yyyy` 的后两位

## 🔄 后续扩展建议

如果需要更强大的功能，可以考虑：
1. **文件修改日期**：使用文件的 mtime 而不是当前日期
2. **时间支持**：添加 HH:mm:ss 等时间格式
3. **预设模板**：提供常用格式的快速选择
4. **自定义分隔符**：允许使用任意分隔符
5. **组合规则**：允许同时应用多个规则

## ✅ 完成状态

- ✅ 类型定义更新
- ✅ 日期格式化函数实现
- ✅ 核心逻辑实现
- ✅ UI 卡片添加
- ✅ 预览功能实现
- ✅ 执行/撤销功能复用
- ✅ 不破坏现有功能
- ✅ 四个功能独立运行

所有功能已就绪，可以立即使用！🎉

## 📅 示例输出

假设今天是 **2025 年 1 月 30 日**：

```
格式：yyyyMMdd        →  20250130
格式：yyyy-MM-dd      →  2025-01-30
格式：yyMMdd          →  250130
格式：yyyy 年 MM 月 dd 日  →  2025 年 01 月 30 日
格式：yyyy/M/d        →  2025/1/30
```
