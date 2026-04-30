# 添加后缀功能 - 实现说明

## ✅ 已完成的修改

### 1. renameEngine.ts

**修改内容**：
- ✅ 新增类型：`RenameRuleType = 'addPrefix' | 'addSuffix'`
- ✅ 更新接口：`RenameRule` 支持 `prefix` 和 `suffix` 参数
- ✅ 修改函数：`applyRenameRule` 支持两种规则类型
- ✅ 保持逻辑：`generateNewNames` 自动处理扩展名

**关键代码**：
```typescript
export type RenameRuleType = 'addPrefix' | 'addSuffix'

export interface RenameRule {
  type: RenameRuleType
  params: {
    prefix?: string
    suffix?: string
  }
}

export function applyRenameRule(nameWithoutExt: string, rule: RenameRule): string {
  let result = nameWithoutExt
  
  if (rule.type === 'addPrefix' && rule.params.prefix) {
    result = rule.params.prefix + result
  } else if (rule.type === 'addSuffix' && rule.params.suffix) {
    result = result + rule.params.suffix
  }
  
  return result
}
```

### 2. App.tsx

**修改内容**：
- ✅ 新增状态：`const [suffix, setSuffix] = useState('_v2')`
- ✅ 新增函数：`handlePreviewSuffix` 处理后缀预览
- ✅ 新增卡片：在后缀卡片下方添加"添加后缀"卡片
- ✅ 修改函数名：`handlePreview` → `handlePreviewPrefix`（避免冲突）

**新增的后缀卡片**：
```tsx
<Card title="添加后缀" style={{ marginBottom: 16 }}>
  <Space>
    <Input
      placeholder="输入后缀"
      value={suffix}
      onChange={(e) => setSuffix(e.target.value)}
      style={{ width: 200 }}
    />
    <Button type="primary" onClick={handlePreviewSuffix}>
      预览效果
    </Button>
  </Space>
</Card>
```

## 🎯 功能说明

### 前缀功能
- **输入框**：默认值 `img_`
- **规则类型**：`addPrefix`
- **效果**：`document.txt` → `img_document.txt`

### 后缀功能
- **输入框**：默认值 `_v2`
- **规则类型**：`addSuffix`
- **效果**：`document.txt` → `document_v2.txt`

## 🔍 使用流程

### 1. 扫描文件
点击"选择文件夹并扫描"按钮

### 2. 添加前缀（可选）
- 在前缀卡片输入框输入前缀（如 `backup_`）
- 点击"预览效果"
- 查看预览表格

### 3. 添加后缀（可选）
- 在后缀卡片输入框输入后缀（如 `_v2`）
- 点击"预览效果"
- 查看预览表格（会覆盖之前的预览）

### 4. 执行操作
- 预览表格显示新旧文件名对比
- 点击"执行重命名"执行批量重命名
- 点击"撤销"恢复上一次操作

## ⚠️ 注意事项

1. **独立运行**：前缀和后缀功能独立，每次预览只显示一种规则的效果
2. **扩展名保护**：两种规则都不会改变文件扩展名
3. **预览覆盖**：每次点击预览会覆盖之前的预览结果
4. **共享预览区**：前缀和后缀共用一个预览表格区域

## 📝 示例

**前缀示例**：
```
输入前缀：backup_
原文件：photo.jpg, document.pdf, report.docx
新文件：backup_photo.jpg, backup_document.pdf, backup_report.docx
```

**后缀示例**：
```
输入后缀：_v2
原文件：photo.jpg, document.pdf, report.docx
新文件：photo_v2.jpg, document_v2.pdf, report_v2.docx
```

## 🚀 后续可扩展

如果需要同时使用前缀和后缀，可以：
1. 先应用前缀规则，执行重命名
2. 再应用后缀规则，执行重命名

或者在未来版本中添加"组合规则"功能，允许同时配置前缀和后缀。
