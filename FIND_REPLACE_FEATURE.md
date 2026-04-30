# 查找替换功能 - 实现说明

## ✅ 已完成的修改

### 1. renameEngine.ts

**修改内容**：
- ✅ 新增类型：`RenameRuleType = 'addPrefix' | 'addSuffix' | 'findReplace'`
- ✅ 更新接口：`RenameRule` 增加 `search` 和 `replace` 参数
- ✅ 修改函数：`applyRenameRule` 增加查找替换逻辑
- ✅ 保持逻辑：只对文件名主体（不含扩展名）进行替换

**关键代码**：
```typescript
export type RenameRuleType = 'addPrefix' | 'addSuffix' | 'findReplace'

export interface RenameRule {
  type: RenameRuleType
  params: {
    prefix?: string
    suffix?: string
    search?: string      // 新增：要查找的文本
    replace?: string     // 新增：替换成的文本
  }
}

export function applyRenameRule(nameWithoutExt: string, rule: RenameRule): string {
  let result = nameWithoutExt
  
  if (rule.type === 'addPrefix' && rule.params.prefix) {
    result = rule.params.prefix + result
  } else if (rule.type === 'addSuffix' && rule.params.suffix) {
    result = result + rule.params.suffix
  } else if (rule.type === 'findReplace' && rule.params.search) {
    // 全局替换所有匹配的文本
    result = result.split(rule.params.search).join(rule.params.replace || '')
  }
  
  return result
}
```

### 2. App.tsx

**修改内容**：
- ✅ 新增状态：
  - `const [searchText, setSearchText] = useState('')`
  - `const [replaceText, setReplaceText] = useState('')`
- ✅ 新增函数：`handlePreviewFindReplace` 处理查找替换预览
- ✅ 新增卡片：查找替换卡片（放在后缀卡片下方）

**新增的状态变量**（第 25-26 行）：
```typescript
const [searchText, setSearchText] = useState('')
const [replaceText, setReplaceText] = useState('')
```

**新增的预览函数**（第 75-89 行）：
```typescript
// 预览查找替换效果
const handlePreviewFindReplace = () => {
  if (files.length === 0) {
    message.warning('请先选择文件夹')
    return
  }
  if (!searchText) {
    message.warning('请输入要查找的文本')
    return
  }
  const rule: RenameRule = { 
    type: 'findReplace', 
    params: { search: searchText, replace: replaceText } 
  }
  const preview = generateNewNames(files, rule)
  setPreviewList(preview)
}
```

**新增的查找替换卡片**（第 147-170 行）：
```tsx
{/* 查找替换规则 */}
<Card title="查找替换" style={{ marginBottom: 16 }}>
  <Space direction="vertical" style={{ width: '100%' }}>
    <Space>
      <Input
        placeholder="查找文本"
        value={searchText}
        onChange={(e) => setSearchText(e.target.value)}
        style={{ width: 200 }}
        addonBefore="查找："
      />
      <Input
        placeholder="替换为"
        value={replaceText}
        onChange={(e) => setReplaceText(e.target.value)}
        style={{ width: 200 }}
        addonBefore="替换为："
      />
      <Button type="primary" onClick={handlePreviewFindReplace}>
        预览效果
      </Button>
    </Space>
  </Space>
</Card>
```

## 🎯 功能说明

### 三大功能卡片

| 功能 | 位置 | 参数 | 效果 |
|------|------|------|------|
| **添加前缀** | 第 1 个卡片 | 前缀文本 | `file.txt` → `prefix_file.txt` |
| **添加后缀** | 第 2 个卡片 | 后缀文本 | `file.txt` → `file_suffix.txt` |
| **查找替换** | 第 3 个卡片 | 查找文本 + 替换文本 | `old_file.txt` → `new_file.txt` |

### 查找替换功能详解

**输入框**：
- **查找文本**：要查找的字符串（必填）
- **替换为**：替换成的字符串（可选，默认为空）

**替换逻辑**：
- ✅ 只对文件名主体进行替换（不含扩展名）
- ✅ 全局替换（替换所有匹配项）
- ✅ 区分大小写
- ✅ 支持空替换（删除文本）

**示例**：
```
查找：old
替换：new
原文件：old_doc.txt, old_file_old.pdf, new.txt
结果：new_doc.txt, new_file_new.pdf, new.txt
```

## 🔍 使用流程

### 1. 扫描文件
点击"选择文件夹并扫描"按钮

### 2. 使用三种规则（任选其一）

**添加前缀**：
- 输入前缀（如 `backup_`）
- 点击"预览效果"

**添加后缀**：
- 输入后缀（如 `_v2`）
- 点击"预览效果"

**查找替换**：
- 输入"查找文本"（如 `old`）
- 输入"替换为"（如 `new`）
- 点击"预览效果"

### 3. 查看预览
预览表格显示：
- 原文件名
- 新文件名

### 4. 执行操作
- **执行重命名**：批量执行重命名操作
- **撤销**：撤销上一次重命名操作

## 📝 示例场景

### 场景 1：批量修改日期格式
```
查找：2024
替换：2025
原文件：report_2024_Q1.xlsx, plan_2024.docx
结果：report_2025_Q1.xlsx, plan_2025.docx
```

### 场景 2：删除文件名中的特定文本
```
查找：_draft
替换：（空）
原文件：article_draft.txt, notes_draft.md
结果：article.txt, notes.md
```

### 场景 3：修正拼写错误
```
查找：recieve
替换：receive
原文件：recieve_form.pdf, recieve_letter.docx
结果：receive_form.pdf, receive_letter.docx
```

### 场景 4：批量重命名项目文件
```
查找：ProjectA
替换：ProjectB
原文件：ProjectA_Proposal.pptx, ProjectA_Budget.xlsx
结果：ProjectB_Proposal.pptx, ProjectB_Budget.xlsx
```

## ⚠️ 注意事项

1. **独立运行**：三个功能独立，每次预览只显示一种规则的效果
2. **共享预览区**：三个卡片共用一个预览表格，后点击的会覆盖之前的预览
3. **扩展名保护**：所有规则都只在文件名主体上操作，不改变扩展名
4. **全局替换**：查找替换会替换所有匹配的文本
5. **区分大小写**：当前实现区分大小写
6. **必填验证**：查找文本必须输入，替换文本可以为空

## 🚀 功能对比

| 特性 | 添加前缀 | 添加后缀 | 查找替换 |
|------|----------|----------|----------|
| **输入框数量** | 1 个 | 1 个 | 2 个 |
| **必填参数** | 前缀 | 后缀 | 查找文本 |
| **可选参数** | - | - | 替换为 |
| **作用位置** | 文件名开头 | 文件名末尾（扩展名前） | 文件名任意位置 |
| **替换范围** | - | - | 全局替换 |
| **扩展名保护** | ✅ | ✅ | ✅ |

## 💡 最佳实践

1. **先预览后执行**：始终先预览效果，确认无误后再执行
2. **小批量测试**：先在少量文件上测试，确认效果后再大批量操作
3. **备份重要文件**：重要文件操作前先备份
4. **检查预览**：仔细检查预览表格中的新旧文件名对比
5. **及时撤销**：如果执行错误，立即使用撤销功能恢复

## 🔄 后续扩展建议

如果需要更强大的功能，可以考虑：
1. **正则表达式支持**：使用正则进行更复杂的匹配
2. **不区分大小写选项**：添加复选框控制是否区分大小写
3. **组合规则**：允许同时应用多个规则
4. **规则模板**：保存常用的替换规则
5. **批量预览**：同时显示多个规则的预览效果

## ✅ 完成状态

- ✅ 类型定义更新
- ✅ 核心逻辑实现
- ✅ UI 卡片添加
- ✅ 预览功能实现
- ✅ 执行/撤销功能复用
- ✅ 不破坏现有功能
- ✅ 三个功能独立运行

所有功能已就绪，可以立即使用！🎉
