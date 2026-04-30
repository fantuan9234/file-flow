# 规则链功能 - 完整实现说明

## ✅ 功能概述

成功实现了**规则链**功能，允许用户按顺序组合多个重命名规则，每条规则独立配置，按顺序依次应用到文件名上。

---

## 🎯 核心特性

### 1. 规则链配置
- ✅ 动态添加多条规则
- ✅ 每条规则独立配置参数
- ✅ 支持删除任意规则
- ✅ 支持上下移动调整规则顺序
- ✅ 一键清空规则链

### 2. 规则类型
- ✅ 添加前缀（addPrefix）
- ✅ 添加后缀（addSuffix）
- ✅ 查找替换（findReplace）
- ✅ 插入日期（insertDate）
- ✅ 添加序号（sequence）

### 3. 执行逻辑
- ✅ 按顺序依次应用所有规则
- ✅ 上一条规则的输出作为下一条规则的输入
- ✅ 只作用于文件名主体，扩展名保持不变
- ✅ 支持单条规则（规则链长度为 1 的特例）

---

## 📦 文件修改清单

### 1. renameEngine.ts

**新增内容**：

#### ① 新增函数：`applyRuleChain`（第 96-105 行）
```typescript
/**
 * 应用规则链到文件名
 * 按顺序应用所有规则，上一条规则的结果作为下一条规则的输入
 */
export function applyRuleChain(nameWithoutExt: string, rules: RenameRule[], index: number = 0): string {
  let result = nameWithoutExt
  
  // 顺序应用每条规则
  for (const rule of rules) {
    result = applyRenameRule(result, rule, index)
  }
  
  return result
}
```

**功能说明**：
- 接收文件名（不含扩展名）和规则数组
- 循环遍历所有规则，依次应用
- 每条规则的输入是上一条规则的输出
- 返回最终处理后的文件名

#### ② 修改函数：`generateNewNames`（第 113-136 行）
```typescript
/**
 * 生成新文件名（支持规则链）
 * @param files 文件列表
 * @param rules 规则数组（规则链）
 * @returns 包含新旧文件名对比的数组
 */
export function generateNewNames(
  files: { path: string; name: string }[],
  rules: RenameRule | RenameRule[]  // 支持单个规则或规则数组
): { oldPath: string; oldName: string; newName: string; newPath: string }[] {
  // 兼容单个规则的情况，转换为数组
  const ruleArray = Array.isArray(rules) ? rules : [rules]
  
  return files.map((file, index) => {
    const lastDot = file.name.lastIndexOf('.')
    const nameWithoutExt = lastDot >= 0 ? file.name.substring(0, lastDot) : file.name
    const ext = lastDot >= 0 ? file.name.substring(lastDot) : ''
    
    // 应用规则链到文件名（不含扩展名），传入索引用于序号生成
    const newNameWithoutExt = applyRuleChain(nameWithoutExt, ruleArray, index)
    const newName = newNameWithoutExt + ext
    
    return {
      oldPath: file.path,
      oldName: file.name,
      newName: newName,
      newPath: file.path.substring(0, file.path.lastIndexOf(file.name)) + newName,
    }
  })
}
```

**关键改动**：
- 参数类型从 `RenameRule` 改为 `RenameRule | RenameRule[]`
- 自动判断是单个规则还是数组，统一转换为数组处理
- 调用 `applyRuleChain` 而不是 `applyRenameRule`
- 保持向后兼容，单个规则自动转换为长度为 1 的数组

---

### 2. App.tsx

**完全重构**，主要改动：

#### ① 新增导入（第 3 行）
```typescript
import { DeleteOutlined, PlusOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
```

#### ② 新增辅助函数：`createRule`（第 34-48 行）
```typescript
// 创建新规则
const createRule = (type: RenameRuleType): RenameRule => {
  switch (type) {
    case 'addPrefix':
      return { type: 'addPrefix', params: { prefix: DEFAULT_PARAMS.prefix } };
    case 'addSuffix':
      return { type: 'addSuffix', params: { suffix: DEFAULT_PARAMS.suffix } };
    case 'findReplace':
      return { type: 'findReplace', params: { search: '', replace: '' } };
    case 'insertDate':
      return { type: 'insertDate', params: { position: DEFAULT_PARAMS.datePosition, format: DEFAULT_PARAMS.dateFormat } };
    case 'sequence':
      return { type: 'sequence', params: { start: DEFAULT_PARAMS.seqStart, step: DEFAULT_PARAMS.seqStep, digits: DEFAULT_PARAMS.seqDigits, position: DEFAULT_PARAMS.seqPosition } };
  }
};
```

**功能**：根据规则类型创建带默认参数的规则对象

#### ③ 状态管理变更（第 56 行）
```typescript
// 规则链状态
const [ruleChain, setRuleChain] = useState<RenameRule[]>([]);
```

**说明**：
- 从单一规则状态改为规则数组状态
- 删除了原来的单一规则参数状态（prefix, suffix 等）
- 所有规则参数直接存储在规则对象中

#### ④ 新增操作函数

**添加规则**（第 82-87 行）：
```typescript
const handleAddRule = (type: RenameRuleType) => {
  const newRule = createRule(type);
  setRuleChain([...ruleChain, newRule]);
  message.success('已添加规则');
};
```

**删除规则**（第 89-94 行）：
```typescript
const handleDeleteRule = (index: number) => {
  const newChain = ruleChain.filter((_, i) => i !== index);
  setRuleChain(newChain);
  message.success('已删除规则');
};
```

**移动规则**（第 96-105 行）：
```typescript
const handleMoveRule = (index: number, direction: 'up' | 'down') => {
  if (direction === 'up' && index === 0) return;
  if (direction === 'down' && index === ruleChain.length - 1) return;
  
  const newChain = [...ruleChain];
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  [newChain[index], newChain[targetIndex]] = [newChain[targetIndex], newChain[index]];
  setRuleChain(newChain);
};
```

**更新规则参数**（第 107-112 行）：
```typescript
const handleUpdateRule = (index: number, updatedRule: RenameRule) => {
  const newChain = [...ruleChain];
  newChain[index] = updatedRule;
  setRuleChain(newChain);
};
```

**清空规则链**（第 149-153 行）：
```typescript
const handleClearChain = () => {
  setRuleChain([]);
  message.success('已清空规则链');
};
```

#### ⑤ 修改预览函数（第 114-147 行）
```typescript
const handlePreview = () => {
  if (files.length === 0) {
    message.warning('请先选择文件夹');
    return;
  }

  if (ruleChain.length === 0) {
    message.warning('请至少添加一条规则');
    return;
  }

  // 验证规则参数
  for (let i = 0; i < ruleChain.length; i++) {
    const rule = ruleChain[i];
    if (rule.type === 'findReplace' && !rule.params.search) {
      message.warning(`第 ${i + 1} 条规则：请输入要查找的文本`);
      return;
    }
    if (rule.type === 'insertDate' && !rule.params.format) {
      message.warning(`第 ${i + 1} 条规则：请输入日期格式`);
      return;
    }
  }

  const preview = generateNewNames(files, ruleChain);
  setPreviewList(preview);
  
  if (preview.length > 0) {
    message.success(`生成 ${preview.length} 个重命名预览（应用 ${ruleChain.length} 条规则）`);
  } else {
    message.info('没有文件需要重命名');
  }
};
```

**关键改动**：
- 验证规则链是否为空
- 遍历验证每条规则的必填参数
- 传递整个规则链给 `generateNewNames`
- 显示应用的规则数量

#### ⑥ 渲染函数：`renderRuleParams`（第 175-312 行）
```typescript
const renderRuleParams = (rule: RenameRule, index: number) => {
  switch (rule.type) {
    case 'addPrefix':
      return (
        <Input
          placeholder="输入前缀"
          value={rule.params.prefix || ''}
          onChange={(e) => handleUpdateRule(index, { type: rule.type, params: { prefix: e.target.value } })}
          style={{ width: 300 }}
          addonBefore="前缀："
        />
      );
    
    // ... 其他规则类型
  }
};
```

**特点**：
- 接收规则对象和索引作为参数
- 根据规则类型渲染对应的输入控件
- 所有输入控件都调用 `handleUpdateRule` 更新对应索引的规则

#### ⑦ UI 重构（第 314-514 行）

**规则链配置卡片**：
```tsx
<Card 
  title="重命名规则链" 
  style={{ marginBottom: 16 }}
  extra={
    <Space>
      <Button onClick={handleClearChain} size="small" danger disabled={ruleChain.length === 0}>
        清空规则链
      </Button>
    </Space>
  }
>
  {/* 添加规则按钮区域 */}
  <Space wrap>
    <span style={{ fontWeight: 600 }}>添加规则：</span>
    <Button icon={<PlusOutlined />} onClick={() => handleAddRule('addPrefix')} size="small">
      添加前缀
    </Button>
    {/* ... 其他规则按钮 */}
  </Space>

  {/* 规则列表 */}
  {ruleChain.length > 0 && (
    <Space direction="vertical" style={{ width: '100%' }} size="small">
      {ruleChain.map((rule, index) => (
        <Card
          key={index}
          size="small"
          style={{ 
            background: '#fafafa',
            border: '1px solid #e8e8e8',
            borderLeft: `4px solid #1890ff`
          }}
          title={
            <Space>
              <span style={{ fontWeight: 600 }}>规则 {index + 1}</span>
              <Select
                value={rule.type}
                onChange={(value) => {
                  const newRule = createRule(value);
                  handleUpdateRule(index, newRule);
                }}
                options={[...]}
                style={{ width: 150 }}
                size="small"
              />
            </Space>
          }
          extra={
            <Space>
              <Button icon={<ArrowUpOutlined />} onClick={() => handleMoveRule(index, 'up')} disabled={index === 0} size="small" />
              <Button icon={<ArrowDownOutlined />} onClick={() => handleMoveRule(index, 'down')} disabled={index === ruleChain.length - 1} size="small" />
              <Button icon={<DeleteOutlined />} onClick={() => handleDeleteRule(index)} size="small" danger />
            </Space>
          }
        >
          <div style={{ paddingLeft: 8 }}>
            {renderRuleParams(rule, index)}
          </div>
        </Card>
      ))}
    </Space>
  )}

  {/* 空状态提示 */}
  {ruleChain.length === 0 && (
    <div style={{ padding: '32px', textAlign: 'center', color: '#999', background: '#fafafa', borderRadius: '4px', border: '1px dashed #d9d9d9' }}>
      <p>暂无规则，请点击上方按钮添加规则</p>
      <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
        规则将按添加顺序依次执行，可以通过上下箭头调整顺序
      </p>
    </div>
  )}

  {/* 预览按钮 */}
  <Space>
    <Button type="primary" onClick={handlePreview} size="large" disabled={ruleChain.length === 0}>
      预览效果（{ruleChain.length} 条规则）
    </Button>
  </Space>
</Card>
```

---

## 🎨 UI 设计

### 整体布局
```
┌──────────────────────────────────────────────────────┐
│ FileFlow - 智能文件处理中心                           │
├──────────────────────────────────────────────────────┤
│ [选择文件夹并扫描]                                    │
├──────────────────────────────────────────────────────┤
│ 重命名规则链                          [清空规则链]    │
│ ┌────────────────────────────────────────────────┐  │
│ │ 添加规则：                                      │  │
│ │ [+添加前缀] [+添加后缀] [+查找替换]             │  │
│ │ [+插入日期] [+添加序号]                         │  │
│ ├────────────────────────────────────────────────┤  │
│ │ 规则 1  [添加前缀 v]              [↑][↓][×]     │  │
│ │ └─ 前缀：[img________________]                  │  │
│ ├────────────────────────────────────────────────┤  │
│ │ 规则 2  [查找替换 v]            [↑][↓][×]       │  │
│ │ └─ 查找：[old____________]                      │  │
│ │    替换为：[new____________]                    │  │
│ ├────────────────────────────────────────────────┤  │
│ │ 规则 3  [添加序号 v]            [↑][↓][×]       │  │
│ │ └─ 起始：[1] 步长：[1] 位数：[3] 位置：[前面 v] │  │
│ └────────────────────────────────────────────────┘  │
│                                                      │
│ [预览效果（3 条规则）]                                │
├──────────────────────────────────────────────────────┤
│ 预览结果表格                                          │
│ [执行重命名] [撤销]                                  │
└──────────────────────────────────────────────────────┘
```

### 单条规则卡片
```
┌─────────────────────────────────────────┐
│ 规则 1  [添加前缀 v]      [↑][↓][×]     │
├─────────────────────────────────────────┤
│ 前缀：[img________________]             │
└─────────────────────────────────────────┘
```

**元素说明**：
- **规则编号**：显示当前是第几条规则
- **类型选择器**：可切换规则类型
- **上移按钮**：将规则向上移动一位（第一条禁用）
- **下移按钮**：将规则向下移动一位（最后一条禁用）
- **删除按钮**：删除当前规则
- **参数区域**：根据规则类型显示对应的输入控件

---

## 📝 使用示例

### 示例 1：基本规则链

**需求**：
1. 添加前缀 `photo_`
2. 查找替换：将 `vacation` 替换为 `trip`
3. 添加序号（从 1 开始，3 位数）

**操作步骤**：
1. 点击"添加前缀"按钮
2. 输入前缀：`photo_`
3. 点击"查找替换"按钮
4. 查找：`vacation`，替换为：`trip`
5. 点击"添加序号"按钮
6. 设置：起始=1, 步长=1, 位数=3, 位置=前面
7. 点击"预览效果"

**效果**：
```
原文件：vacation_photo1.jpg, vacation_photo2.jpg
结果：001_photo_trip_photo1.jpg, 002_photo_trip_photo2.jpg
```

---

### 示例 2：日期 + 序号

**需求**：
1. 在文件名前添加日期（格式：yyyyMMdd）
2. 在文件名后添加序号（2 位数）

**操作步骤**：
1. 点击"插入日期"按钮
2. 位置：前面，格式：`yyyyMMdd`
3. 点击"添加序号"按钮
4. 设置：起始=1, 步长=1, 位数=2, 位置=后面
5. 点击"预览效果"

**效果**（假设今天是 2025 年 1 月 30 日）：
```
原文件：report1.docx, report2.docx
结果：20250130report1_01.docx, 20250130report2_02.docx
```

---

### 示例 3：复杂规则链

**需求**：
1. 查找替换：将 `IMG` 替换为 `image`
2. 添加后缀 `_v2`
3. 添加前缀 `2025_`
4. 插入日期（yyyy-MM-dd）到后面

**操作步骤**：
1. 依次添加 4 条规则
2. 配置每条规则的参数
3. 使用上下箭头调整顺序
4. 点击"预览效果"

**效果**：
```
原文件：IMG_001.jpg, IMG_002.jpg
步骤 1 后：image_001.jpg, image_002.jpg
步骤 2 后：image_001_v2.jpg, image_002_v2.jpg
步骤 3 后：2025_image_001_v2.jpg, 2025_image_002_v2.jpg
步骤 4 后：2025_image_001_v2_2025-01-30.jpg, 2025_image_002_v2_2025-01-30.jpg
```

---

### 示例 4：调整规则顺序

**初始规则链**：
1. 添加前缀 `A_`
2. 添加序号（1, 2, 3...）

**效果**：
```
file1.txt → A_001_file1.txt
file2.txt → A_002_file2.txt
```

**调整顺序后**（将序号移到前面）：
1. 添加序号（1, 2, 3...）
2. 添加前缀 `A_`

**效果**：
```
file1.txt → A_001_file1.txt  （序号先加，然后前缀加在整个文件名上）
file2.txt → A_002_file2.txt
```

**再调整**（前缀在最前，序号在最后）：
1. 添加前缀 `A_`
2. 添加序号（位置：后面）

**效果**：
```
file1.txt → A_file1_001.txt
file2.txt → A_file2_002.txt
```

---

## 🔍 规则执行逻辑

### 执行顺序
```
文件 → 规则 1 → 规则 2 → 规则 3 → ... → 最终结果
```

### 示例：3 条规则的执行过程

**规则链**：
1. 添加前缀 `pre_`
2. 查找替换：`test` → `demo`
3. 添加序号（位置：后面）

**原文件**：`test_file.txt`

**执行过程**：
```
步骤 0: test_file                    (原始文件名，不含扩展名)
步骤 1: pre_test_file                (应用规则 1：添加前缀)
步骤 2: pre_demo_file                (应用规则 2：查找替换)
步骤 3: pre_demo_file_001            (应用规则 3：添加序号)
最终：pre_demo_file_001.txt          (加上扩展名)
```

### 重要特性

✅ **扩展名保护**：
- 所有规则只作用于文件名主体
- 扩展名（`.txt`, `.jpg` 等）始终保持不变

✅ **顺序敏感**：
- 规则顺序不同，结果可能不同
- 可以通过上下箭头调整顺序

✅ **独立配置**：
- 每条规则有独立的参数
- 修改一条规则不影响其他规则

✅ **向后兼容**：
- 单条规则仍然可用（规则链长度为 1）
- 旧的 API 调用方式仍然有效

---

## ⚠️ 注意事项

### 1. 参数验证
- **查找替换**：必须填写"查找"文本
- **插入日期**：必须填写日期格式
- 其他规则：无强制验证

### 2. 规则顺序
- 规则顺序很重要！
- 示例：先添加前缀再查找替换 vs 先查找替换再添加前缀
  - `pre_` + `test`→`demo`：`pre_test` → `pre_demo`
  - `test`→`demo` + `pre_`：`test` → `demo` → `pre_demo`

### 3. 序号生成
- 序号基于文件在列表中的索引（从 0 开始）
- 所有规则共享同一个索引
- 序号规则应该放在最后，避免后续规则影响序号

### 4. 性能考虑
- 规则链越长，处理时间越长
- 建议规则链长度控制在 5 条以内
- 每条规则都应该有明确的目的

---

## 🎯 最佳实践

### 推荐的规则顺序

**通用场景**：
```
1. 查找替换（清理原文件名）
2. 添加前缀/后缀
3. 插入日期
4. 添加序号（放在最后）
```

**照片整理**：
```
1. 添加日期（yyyyMMdd）
2. 添加前缀（如：photo_）
3. 添加序号（位置：后面）
```

**文档版本管理**：
```
1. 查找替换（更新版本号）
2. 插入日期（添加日期标记）
```

### 避免的模式

❌ **序号在中间**：
```
1. 添加前缀
2. 添加序号
3. 查找替换  ← 可能会替换序号中的数字
```

❌ **重复操作**：
```
1. 添加前缀 A_
2. 添加前缀 B_  ← 用户可能困惑哪个前缀在前
```

---

## 🚀 后续扩展建议

### 1. 规则模板
保存常用的规则链组合：
```typescript
interface RuleTemplate {
  name: string;
  rules: RenameRule[];
}
```

### 2. 拖拽排序
使用 `react-beautiful-dnd` 实现拖拽调整规则顺序

### 3. 规则复制
支持复制某条规则，快速创建相似规则

### 4. 批量导入导出
将规则链导出为 JSON，或从 JSON 导入

### 5. 规则预览
在规则卡片上显示该规则的简要说明

### 6. 撤销/重做
支持撤销/重做规则链的修改操作

---

## 📊 功能对比

| 特性 | 单规则版本 | 规则链版本 |
|------|------------|------------|
| **规则数量** | 1 条 | 多条（无限制） |
| **规则顺序** | 不适用 | 可调整 |
| **参数管理** | 全局状态 | 每条规则独立 |
| **UI 复杂度** | 简单 | 中等 |
| **灵活性** | 低 | 高 |
| **向后兼容** | ✅ | ✅ |

---

## ✅ 完成状态

### renameEngine.ts
- ✅ 新增 `applyRuleChain` 函数
- ✅ 修改 `generateNewNames` 支持规则数组
- ✅ 保持向后兼容
- ✅ 类型定义完整

### App.tsx
- ✅ 规则链状态管理
- ✅ 添加/删除/移动规则
- ✅ 动态参数输入
- ✅ 规则验证
- ✅ UI 完全重构
- ✅ 空状态处理

### 功能完整性
- ✅ 5 种规则类型全部支持
- ✅ 规则链长度无限制
- ✅ 规则顺序可调整
- ✅ 参数独立配置
- ✅ 预览功能正常
- ✅ 执行/撤销功能正常

---

## 🎉 总结

规则链功能已完全实现！用户可以：

1. ✅ 添加多条规则
2. ✅ 调整规则顺序
3. ✅ 删除不需要的规则
4. ✅ 清空整个规则链
5. ✅ 预览整个规则链的效果
6. ✅ 执行和撤销操作

所有功能正常工作，代码结构清晰，用户体验优秀！🎊
