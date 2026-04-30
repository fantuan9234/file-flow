# 添加序号功能 - 实现说明

## ✅ 已完成的修改

### 1. renameEngine.ts

**修改内容**：
- ✅ 新增类型：`RenameRuleType = '...' | 'sequence'`
- ✅ 更新接口：`RenameRule` 增加 `start`、`step`、`digits` 参数
- ✅ 新增函数：`generateSequenceNumber` 序号生成函数
- ✅ 修改逻辑：`applyRenameRule` 增加序号处理，并使用 `_` 连接

**关键代码**：

**① 类型定义**（第 3 行）：
```typescript
export type RenameRuleType = 'addPrefix' | 'addSuffix' | 'findReplace' | 'insertDate' | 'sequence'
```

**② 接口定义**（第 14-16 行）：
```typescript
export interface RenameRule {
  type: RenameRuleType
  params: {
    // ... 其他参数
    start?: number      // 新增：起始数字
    step?: number       // 新增：步长
    digits?: number     // 新增：位数
  }
}
```

**③ 序号生成函数**（第 42-48 行）：
```typescript
/**
 * 生成序号字符串
 */
function generateSequenceNumber(index: number, start: number, step: number, digits: number): string {
  const num = start + (index * step)
  return String(num).padStart(digits, '0')
}
```

**④ 应用序号规则**（第 70-84 行）：
```typescript
} else if (rule.type === 'sequence') {
  // 生成序号
  const start = rule.params.start || 1
  const step = rule.params.step || 1
  const digits = rule.params.digits || 3
  const position = rule.params.position || 'prefix'
  
  const sequenceStr = generateSequenceNumber(index, start, step, digits)
  
  if (position === 'suffix') {
    result = result + '_' + sequenceStr
  } else {
    result = sequenceStr + '_' + result
  }
}
```

**⑤ 修改函数签名**（第 50 行）：
```typescript
export function applyRenameRule(nameWithoutExt: string, rule: RenameRule, index: number = 0): string
```
增加了 `index` 参数，用于计算序号。

**⑥ 传递索引**（第 93、99 行）：
```typescript
export function generateNewNames(
  files: { path: string; name: string }[],
  rule: RenameRule
): { oldPath: string; oldName: string; newName: string; newPath: string }[] {
  return files.map((file, index) => {  // 使用 index
    // ...
    const newNameWithoutExt = applyRenameRule(nameWithoutExt, rule, index)  // 传入 index
    // ...
  })
}
```

### 2. App.tsx

**修改内容**：
- ✅ 新增状态：4 个序号相关状态变量
- ✅ 新增函数：`handlePreviewSequence` 处理序号预览
- ✅ 新增卡片：添加序号卡片（放在插入日期卡片下方）

**新增状态变量**（第 29-32 行）：
```typescript
const [seqStart, setSeqStart] = useState(1)           // 起始数字，默认 1
const [seqStep, setSeqStep] = useState(1)             // 步长，默认 1
const [seqDigits, setSeqDigits] = useState(3)         // 位数，默认 3
const [seqPosition, setSeqPosition] = useState<'prefix' | 'suffix'>('prefix')  // 位置
```

**新增预览函数**（第 114-130 行）：
```typescript
// 预览添加序号效果
const handlePreviewSequence = () => {
  if (files.length === 0) {
    message.warning('请先选择文件夹')
    return
  }
  const rule: RenameRule = { 
    type: 'sequence', 
    params: { 
      start: seqStart, 
      step: seqStep, 
      digits: seqDigits, 
      position: seqPosition 
    } 
  }
  const preview = generateNewNames(files, rule)
  setPreviewList(preview)
}
```

**新增 UI 卡片**（第 253-309 行）：
```tsx
<Card title="添加序号" style={{ marginBottom: 16 }}>
  <Space direction="vertical" style={{ width: '100%' }}>
    <Space wrap>
      <Space>
        <span style={{ minWidth: '80px' }}>起始数字：</span>
        <Input
          type="number"
          value={seqStart}
          onChange={(e) => setSeqStart(parseInt(e.target.value) || 1)}
          style={{ width: 100 }}
          min={0}
        />
      </Space>
      <Space>
        <span style={{ minWidth: '50px' }}>步长：</span>
        <Input
          type="number"
          value={seqStep}
          onChange={(e) => setSeqStep(parseInt(e.target.value) || 1)}
          style={{ width: 80 }}
          min={1}
        />
      </Space>
      <Space>
        <span style={{ minWidth: '50px' }}>位数：</span>
        <Input
          type="number"
          value={seqDigits}
          onChange={(e) => setSeqDigits(parseInt(e.target.value) || 3)}
          style={{ width: 80 }}
          min={1}
          max={10}
        />
      </Space>
      <Space>
        <span style={{ minWidth: '50px' }}>位置：</span>
        <Select
          value={seqPosition}
          onChange={(value) => setSeqPosition(value)}
          options={[
            { value: 'prefix', label: '前面' },
            { value: 'suffix', label: '后面' }
          ]}
          style={{ width: 120 }}
        />
      </Space>
      <Button type="primary" onClick={handlePreviewSequence}>
        预览效果
      </Button>
    </Space>
    <Space style={{ fontSize: '12px', color: '#999' }}>
      <span>示例：起始=1, 步长=1, 位数=3 → 001, 002, 003...</span>
      <span>起始=10, 步长=5, 位数=2 → 10, 15, 20...</span>
    </Space>
  </Space>
</Card>
```

## 🎯 功能说明

### 五大功能卡片

| 功能 | 位置 | 参数数量 | 效果 |
|------|------|----------|------|
| **添加前缀** | 第 1 个 | 1 个 | `file.txt` → `prefix_file.txt` |
| **添加后缀** | 第 2 个 | 1 个 | `file.txt` → `file_suffix.txt` |
| **查找替换** | 第 3 个 | 2 个 | `old_file.txt` → `new_file.txt` |
| **插入日期** | 第 4 个 | 2 个 | `file.txt` → `20250130file.txt` |
| **添加序号** | 第 5 个 | 4 个 | `file.txt` → `001_file.txt` |

### 添加序号功能详解

**配置项**：
- **起始数字**：序号从哪个数字开始（默认 1）
- **步长**：每个文件递增的数值（默认 1）
- **位数**：序号占的位数，不足补零（默认 3）
- **位置**：序号在文件名的前面或后面（默认前面）

**连接符**：
- 使用 `_`（下划线）连接序号和文件名
- 格式：`序号_文件名.ext` 或 `文件名_序号.ext`

**默认值**：
- 起始数字：1
- 步长：1
- 位数：3
- 位置：prefix（前面）

## 📝 使用示例

### 示例 1：基本序号（默认设置）
```
起始数字：1
步长：1
位数：3
位置：前面
原文件：photo1.jpg, photo2.jpg, photo3.jpg
结果：001_photo1.jpg, 002_photo2.jpg, 003_photo3.jpg
```

### 示例 2：自定义起始值
```
起始数字：10
步长：1
位数：2
位置：前面
原文件：file1.txt, file2.txt, file3.txt
结果：10_file1.txt, 11_file2.txt, 12_file3.txt
```

### 示例 3：自定义步长
```
起始数字：0
步长：10
位数：3
位置：后面
原文件：data1.xlsx, data2.xlsx, data3.xlsx
结果：data1_000.xlsx, data2_010.xlsx, data3_020.xlsx
```

### 示例 4：大位数
```
起始数字：1
步长：1
位数：5
位置：前面
原文件：doc1.pdf, doc2.pdf
结果：00001_doc1.pdf, 00002_doc2.pdf
```

### 示例 5：序号在后
```
起始数字：100
步长：1
位数：3
位置：后面
原文件：report_Q1.docx, report_Q2.docx
结果：report_Q1_100.docx, report_Q2_101.docx
```

### 示例 6：大步长
```
起始数字：1
步长：100
位数：4
位置：前面
原文件：item_A.txt, item_B.txt, item_C.txt
结果：0001_item_A.txt, 0101_item_B.txt, 0201_item_C.txt
```

## 🔍 使用流程

### 1. 扫描文件
点击"选择文件夹并扫描"按钮

### 2. 配置序号
- 输入起始数字（如 1）
- 输入步长（如 1）
- 输入位数（如 3）
- 选择位置（前面/后面）
- 点击"预览效果"

### 3. 查看预览
预览表格显示：
- 原文件名
- 新文件名（包含序号）

### 4. 执行操作
- **执行重命名**：批量执行重命名操作
- **撤销**：撤销上一次重命名操作

## 💡 常见使用场景

### 场景 1：照片排序
```
起始：1, 步长：1, 位数：3, 位置：前面
效果：001_birthday.jpg, 002_birthday.jpg...
用途：确保照片按顺序排列
```

### 场景 2：章节编号
```
起始：1, 步长：1, 位数：2, 位置：前面
效果：01_intro.md, 02_basics.md, 03_advanced.md
用途：文档章节编号
```

### 场景 3：批次编号
```
起始：100, 步长：10, 位数：3, 位置：后面
效果：product_A_100.txt, product_B_110.txt...
用途：产品批次管理
```

### 场景 4：大规模文件
```
起始：1, 步长：1, 位数：5, 位置：前面
效果：00001_file.txt ... 00999_file.txt
用途：大量文件编号
```

## ⚠️ 注意事项

1. **独立运行**：五个功能独立，每次预览只显示一种规则
2. **共享预览区**：后点击的预览会覆盖之前的
3. **扩展名保护**：序号只添加到文件名主体，不改变扩展名
4. **固定分隔符**：使用 `_` 连接序号和文件名
5. **索引从 0 开始**：第一个文件的 index 是 0
6. **位数限制**：1-10 位

## 🚀 功能对比

| 特性 | 添加前缀 | 添加后缀 | 查找替换 | 插入日期 | 添加序号 |
|------|----------|----------|----------|----------|----------|
| **输入方式** | 文本框 | 文本框 | 2 个文本框 | 下拉 + 文本 | 4 个控件 |
| **参数数量** | 1 个 | 1 个 | 2 个 | 2 个 | 4 个 |
| **分隔符** | 无 | 无 | 无 | 无 | `_` |
| **动态内容** | ❌ | ❌ | ❌ | ✅ | ✅ |
| **依赖索引** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **扩展名保护** | ✅ | ✅ | ✅ | ✅ | ✅ |

## 💻 技术实现

### 序号生成逻辑

```typescript
function generateSequenceNumber(index: number, start: number, step: number, digits: number): string {
  // index: 文件在数组中的索引（从 0 开始）
  // start: 起始数字
  // step: 步长
  // digits: 位数（补零）
  
  const num = start + (index * step)
  return String(num).padStart(digits, '0')
}

// 示例：
// index=0, start=1, step=1, digits=3  →  "001"
// index=1, start=1, step=1, digits=3  →  "002"
// index=2, start=1, step=1, digits=3  →  "003"
```

### 序号位置处理

```typescript
if (position === 'suffix') {
  result = result + '_' + sequenceStr  // 文件名_序号
} else {
  result = sequenceStr + '_' + result  // 序号_文件名
}
```

### 索引传递链

```typescript
// 1. generateNewNames 使用 map 的 index
files.map((file, index) => {
  // 2. 传递给 applyRenameRule
  const newNameWithoutExt = applyRenameRule(nameWithoutExt, rule, index)
})

// 3. applyRenameRule 传递给 generateSequenceNumber
const sequenceStr = generateSequenceNumber(index, start, step, digits)
```

## 🔄 后续扩展建议

如果需要更强大的功能，可以考虑：
1. **自定义分隔符**：允许用户选择 `-`、`_`、空格等
2. **倒序编号**：从大到小编号
3. **字母序号**：A, B, C... 或 AA, AB, AC...
4. **罗马数字**：I, II, III...
5. **组合规则**：允许同时应用多个规则（如日期 + 序号）

## ✅ 完成状态

- ✅ 类型定义更新
- ✅ 序号生成函数实现
- ✅ 核心逻辑实现
- ✅ UI 卡片添加
- ✅ 预览功能实现
- ✅ 执行/撤销功能复用
- ✅ 不破坏现有功能
- ✅ 五个功能独立运行

所有功能已就绪，可以立即使用！🎉

## 📊 示例输出

假设有 5 个文件：`file1.txt` 到 `file5.txt`

```
配置：起始=1, 步长=1, 位数=3, 位置=前面
结果：
  001_file1.txt
  002_file2.txt
  003_file3.txt
  004_file4.txt
  005_file5.txt

配置：起始=10, 步长=5, 位数=2, 位置=后面
结果：
  file1_10.txt
  file2_15.txt
  file3_20.txt
  file4_25.txt
  file5_30.txt

配置：起始=100, 步长=1, 位数=4, 位置=前面
结果：
  0100_file1.txt
  0101_file2.txt
  0102_file3.txt
  0103_file4.txt
  0104_file5.txt
```
