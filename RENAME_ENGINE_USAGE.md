# Rename Engine 使用文档

## 📚 API 参考

### `generateNewNames(files, rules)`

生成新的文件名

**参数**:
- `files: FileInfo[]` - 文件信息数组
- `rules: RenameRule[]` - 重命名规则数组

**返回**: `RenameResult[]` - 包含 `{oldName, newName}` 的数组

### `validateRules(results)`

验证重命名结果是否有冲突

**参数**:
- `results: RenameResult[]` - 重命名结果数组

**返回**: `{ valid: boolean; conflicts?: string[] }`

### `previewRename(files, rules)`

预览重命名结果（包含验证）

**参数**:
- `files: FileInfo[]` - 文件信息数组
- `rules: RenameRule[]` - 重命名规则数组

**返回**: `RenameResult[]`

---

## 🎯 规则类型详解

### 1. Find & Replace (查找替换)

**类型**: `findReplace`

**参数**:
```typescript
{
  type: 'findReplace',
  enabled: true,
  findText: string,        // 要查找的文本
  replaceText: string,     // 替换的文本
  useRegex: boolean,       // 是否使用正则表达式
  regexFlags: string       // 正则标志（g, i, m 等）
}
```

**示例 1 - 简单替换**:
```typescript
const rules: RenameRule[] = [{
  type: 'findReplace',
  enabled: true,
  findText: 'old',
  replaceText: 'new',
  useRegex: false
}]

// 输入：old_file.txt
// 输出：new_file.txt
```

**示例 2 - 正则替换**:
```typescript
const rules: RenameRule[] = [{
  type: 'findReplace',
  enabled: true,
  findText: '(\\d+)-(\\d+)-(\\d+)',
  replaceText: '$3-$1-$2',
  useRegex: true,
  regexFlags: 'g'
}]

// 输入：2024-01-15_report.txt
// 输出：15-2024-01_report.txt
```

**示例 3 - 不区分大小写**:
```typescript
const rules: RenameRule[] = [{
  type: 'findReplace',
  enabled: true,
  findText: 'test',
  replaceText: 'demo',
  useRegex: true,
  regexFlags: 'gi'  // g: 全局，i: 不区分大小写
}]

// 输入：TEST_File.txt, Test-File.txt
// 输出：DEMO_File.txt, demo-File.txt
```

---

### 2. Regex Replace (正则替换)

**类型**: `regexReplace`

**参数**:
```typescript
{
  type: 'regexReplace',
  enabled: true,
  findText: string,        // 正则表达式
  replaceText: string,     // 替换模板
  regexFlags: string       // 正则标志
}
```

**示例 1 - 提取文件名**:
```typescript
const rules: RenameRule[] = [{
  type: 'regexReplace',
  enabled: true,
  findText: '^.*\\\\(.*)\\.[^.]+$',
  replaceText: '$1',
  regexFlags: ''
}]

// 输入：C:\\folder\\document.pdf
// 输出：document.pdf
```

**示例 2 - 格式化日期**:
```typescript
const rules: RenameRule[] = [{
  type: 'regexReplace',
  enabled: true,
  findText: '(\\d{4})(\\d{2})(\\d{2})',
  replaceText: '$1-$2-$3',
  regexFlags: ''
}]

// 输入：20240115_photo.jpg
// 输出：2024-01-15_photo.jpg
```

---

### 3. Add Prefix (添加前缀)

**类型**: `addPrefix`

**参数**:
```typescript
{
  type: 'addPrefix',
  enabled: true,
  prefix: string  // 要添加的前缀
}
```

**示例**:
```typescript
const rules: RenameRule[] = [{
  type: 'addPrefix',
  enabled: true,
  prefix: 'backup_'
}]

// 输入：document.txt
// 输出：backup_document.txt
```

---

### 4. Add Suffix (添加后缀)

**类型**: `addSuffix`

**参数**:
```typescript
{
  type: 'addSuffix',
  enabled: true,
  suffix: string  // 要添加的后缀
}
```

**示例**:
```typescript
const rules: RenameRule[] = [{
  type: 'addSuffix',
  enabled: true,
  suffix: '_v2'
}]

// 输入：document.txt
// 输出：document_v2.txt
```

---

### 5. Insert Date (插入日期)

**类型**: `insertDate`

**参数**:
```typescript
{
  type: 'insertDate',
  enabled: true,
  dateFormat: string,  // 日期格式
  insertPosition: 'start' | 'end' | 'before-extension'
}
```

**日期格式标记**:
- `YYYY` - 4 位年份 (2024)
- `YY` - 2 位年份 (24)
- `MM` - 2 位月份 (01-12)
- `M` - 月份 (1-12)
- `DD` - 2 位日期 (01-31)
- `D` - 日期 (1-31)
- `HH` - 2 位小时 (00-23)
- `H` - 小时 (0-23)
- `mm` - 2 位分钟 (00-59)
- `m` - 分钟 (0-59)
- `ss` - 2 位秒 (00-59)
- `s` - 秒 (0-59)

**示例 1 - 在文件名前插入日期**:
```typescript
const rules: RenameRule[] = [{
  type: 'insertDate',
  enabled: true,
  dateFormat: 'YYYY-MM-DD',
  insertPosition: 'start'
}]

// 输入：photo.jpg (假设今天是 2024-01-15)
// 输出：2024-01-15photo.jpg
```

**示例 2 - 在扩展名前插入日期时间**:
```typescript
const rules: RenameRule[] = [{
  type: 'insertDate',
  enabled: true,
  dateFormat: 'YYYY-MM-DD_HH-mm-ss',
  insertPosition: 'before-extension'
}]

// 输入：report.pdf
// 输出：report_2024-01-15_10-30-00.pdf
```

---

### 6. Sequence Number (序号)

**类型**: `sequence`

**参数**:
```typescript
{
  type: 'sequence',
  enabled: true,
  sequenceStart: number,      // 起始序号
  sequenceStep: number,       // 序号增量
  sequencePadding: number,    // 补零位数
  sequencePosition: 'start' | 'end' | 'before-extension'
}
```

**示例 1 - 基本序号**:
```typescript
const rules: RenameRule[] = [{
  type: 'sequence',
  enabled: true,
  sequenceStart: 1,
  sequenceStep: 1,
  sequencePadding: 0,
  sequencePosition: 'start'
}]

// 输入：file1.txt, file2.txt, file3.txt
// 输出：1file1.txt, 2file2.txt, 3file3.txt
```

**示例 2 - 带补零的序号**:
```typescript
const rules: RenameRule[] = [{
  type: 'sequence',
  enabled: true,
  sequenceStart: 1,
  sequenceStep: 1,
  sequencePadding: 3,  // 3 位补零
  sequencePosition: 'before-extension'
}]

// 输入：photo1.jpg, photo2.jpg, photo3.jpg
// 输出：photo001.jpg, photo002.jpg, photo003.jpg
```

**示例 3 - 自定义起始和步长**:
```typescript
const rules: RenameRule[] = [{
  type: 'sequence',
  enabled: true,
  sequenceStart: 100,
  sequenceStep: 10,
  sequencePadding: 3,
  sequencePosition: 'end'
}]

// 输入：doc1.pdf, doc2.pdf, doc3.pdf
// 输出：doc1100.pdf, doc2110.pdf, doc3120.pdf
```

---

## 🔗 组合规则示例

规则按顺序依次应用，可以组合多个规则实现复杂的重命名逻辑。

**示例 1 - 清理文件名并添加序号**:
```typescript
const rules: RenameRule[] = [
  // 1. 替换空格为下划线
  {
    type: 'findReplace',
    enabled: true,
    findText: ' ',
    replaceText: '_',
    useRegex: false
  },
  // 2. 删除特殊字符
  {
    type: 'regexReplace',
    enabled: true,
    findText: '[^\\w\\-\\.]',
    replaceText: '',
    regexFlags: 'g'
  },
  // 3. 添加日期前缀
  {
    type: 'insertDate',
    enabled: true,
    dateFormat: 'YYYYMMDD',
    insertPosition: 'start'
  },
  // 4. 添加序号
  {
    type: 'sequence',
    enabled: true,
    sequenceStart: 1,
    sequenceStep: 1,
    sequencePadding: 3,
    sequencePosition: 'before-extension'
  }
]

// 输入：My Document (1).txt, Another File!.txt
// 输出：20240115My_Document_001.txt, 20240115Another_File_002.txt
```

**示例 2 - 照片批量重命名**:
```typescript
const rules: RenameRule[] = [
  // 1. 添加前缀
  {
    type: 'addPrefix',
    enabled: true,
    prefix: 'vacation_'
  },
  // 2. 插入拍摄日期
  {
    type: 'insertDate',
    enabled: true,
    dateFormat: 'YYYY-MM-DD',
    insertPosition: 'before-extension'
  },
  // 3. 添加序号
  {
    type: 'sequence',
    enabled: true,
    sequenceStart: 1,
    sequenceStep: 1,
    sequencePadding: 2,
    sequencePosition: 'end'
  }
]

// 输入：IMG_001.jpg, IMG_002.jpg
// 输出：vacation_IMG_001_2024-01-15_01.jpg, vacation_IMG_002_2024-01-15_02.jpg
```

---

## ⚠️ 注意事项

### 1. 文件扩展名保护
所有规则都不会改变文件扩展名，扩展名始终保留在原位置。

```typescript
// 即使规则匹配到扩展名部分，也不会修改
const rules: RenameRule[] = [{
  type: 'findReplace',
  enabled: true,
  findText: 'txt',
  replaceText: 'bak'
}]

// 输入：document.txt
// 输出：docubakent.txt (只修改文件名部分，不修改扩展名)
```

### 2. 规则顺序
规则按数组顺序依次应用，顺序不同可能导致结果不同。

```typescript
// 顺序 1：先替换再添加前缀
const rules1: RenameRule[] = [
  { type: 'findReplace', findText: 'old', replaceText: 'new' },
  { type: 'addPrefix', prefix: 'prefix_' }
]
// 结果：old_file.txt → new_file.txt → prefix_new_file.txt

// 顺序 2：先添加前缀再替换
const rules2: RenameRule[] = [
  { type: 'addPrefix', prefix: 'prefix_' },
  { type: 'findReplace', findText: 'old', replaceText: 'new' }
]
// 结果：old_file.txt → prefix_old_file.txt → prefix_new_file.txt
```

### 3. 启用/禁用规则
使用 `enabled` 字段可以临时禁用某个规则而不删除它。

```typescript
const rules: RenameRule[] = [
  { type: 'addPrefix', enabled: true, prefix: 'backup_' },
  { type: 'addSuffix', enabled: false, suffix: '_v2' }  // 禁用
]
// 只应用第一个规则
```

### 4. 冲突检测
使用 `validateRules` 检测是否有多个文件会被重命名为相同的名字。

```typescript
const results = generateNewNames(files, rules)
const validation = validateRules(results)

if (!validation.valid) {
  console.error('Name conflicts:', validation.conflicts)
}
```

---

## 🧪 测试示例

```typescript
import { generateNewNames, validateRules } from './renameEngine'

// 测试数据
const files: FileInfo[] = [
  { path: 'C:\\test\\file1.txt', size: 1024, mtime: new Date() },
  { path: 'C:\\test\\file2.txt', size: 2048, mtime: new Date() },
  { path: 'C:\\test\\file3.txt', size: 4096, mtime: new Date() }
]

// 规则：添加前缀 + 序号
const rules: RenameRule[] = [
  {
    type: 'addPrefix',
    enabled: true,
    prefix: 'doc_'
  },
  {
    type: 'sequence',
    enabled: true,
    sequenceStart: 1,
    sequenceStep: 1,
    sequencePadding: 2,
    sequencePosition: 'before-extension'
  }
]

// 生成结果
const results = generateNewNames(files, rules)
console.log(results)
// [
//   { oldName: 'C:\\test\\file1.txt', newName: 'C:\\test\\doc_01file1.txt' },
//   { oldName: 'C:\\test\\file2.txt', newName: 'C:\\test\\doc_02file2.txt' },
//   { oldName: 'C:\\test\\file3.txt', newName: 'C:\\test\\doc_03file3.txt' }
// ]

// 验证冲突
const validation = validateRules(results)
console.log(validation)
// { valid: true }
```

---

## 📖 最佳实践

1. **先预览后执行**: 始终使用 `previewRename` 预览结果
2. **小批量测试**: 先在少量文件上测试规则
3. **规则从简到繁**: 先添加简单规则，逐步增加复杂度
4. **保留备份**: 重要文件操作前先备份
5. **使用正则要小心**: 正则表达式可能产生意外结果
6. **检查冲突**: 使用 `validateRules` 检查命名冲突
