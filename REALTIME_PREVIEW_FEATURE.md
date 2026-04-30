# 实时预览功能 - 实现说明

## ✅ 功能概述

成功实现了**实时预览**功能，当用户修改任何规则参数时，预览结果会自动更新，无需手动点击"预览效果"按钮。

---

## 🎯 核心特性

### 1. 实时预览
- ✅ 输入框内容变化时自动预览
- ✅ 下拉框选项切换时自动预览
- ✅ 规则类型变更时自动预览
- ✅ 添加/删除规则时自动预览
- ✅ 调整规则顺序时自动预览

### 2. 防抖优化
- ✅ 300ms 防抖延迟
- ✅ 避免频繁计算造成卡顿
- ✅ 用户停止输入后才更新预览

### 3. 手动刷新按钮
- ✅ 保留"刷新预览"按钮作为备用
- ✅ 点击立即刷新（清除防抖定时器）
- ✅ 显示实时预览状态提示

---

## 📦 修改文件清单

### App.tsx

#### 修改 ①: 新增导入（第 1 行）
```typescript
import { useState, useEffect, useRef, DragEvent } from 'react';
// 新增：useEffect, useRef
```

#### 修改 ②: 新增防抖引用（第 63-64 行）
```typescript
// 防抖相关
const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
```

#### 修改 ③: 新增自动预览函数（第 66-98 行）
```typescript
// 自动预览函数（带防抖）
const autoPreview = () => {
  // 清除之前的定时器
  if (previewTimerRef.current) {
    clearTimeout(previewTimerRef.current);
  }
  
  // 设置新的定时器，300ms 防抖
  previewTimerRef.current = setTimeout(() => {
    if (files.length === 0 || ruleChain.length === 0) {
      setPreviewList([]);
      return;
    }
    
    // 验证规则参数
    for (let i = 0; i < ruleChain.length; i++) {
      const rule = ruleChain[i];
      if (rule.type === 'findReplace' && !rule.params.search) {
        setPreviewList([]);
        return;
      }
      if (rule.type === 'insertDate' && !rule.params.format) {
        setPreviewList([]);
        return;
      }
    }
    
    // 生成预览
    const preview = generateNewNames(files, ruleChain);
    setPreviewList(preview);
  }, 300);
};
```

**说明**：
- 使用 `setTimeout` 实现 300ms 延迟
- 每次调用前先清除之前的定时器（防抖核心）
- 只在规则参数有效时才生成预览
- 参数无效时清空预览列表

#### 修改 ④: 新增 useEffect 监听器（第 100-110 行）
```typescript
// 监听规则变化和文件变化，自动触发预览
useEffect(() => {
  autoPreview();
  
  // 组件卸载时清除定时器
  return () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
  };
}, [ruleChain, files]);
```

**说明**：
- 监听 `ruleChain` 和 `files` 两个依赖
- 任意一个变化都会触发自动预览
- 组件卸载时清理定时器，避免内存泄漏

#### 修改 ⑤: 简化规则变更函数（第 199-227 行）

**添加规则**：
```typescript
const handleAddRule = (type: RenameRuleType) => {
  const newRule = createRule(type);
  setRuleChain([...ruleChain, newRule]);
  // useEffect 会自动触发预览
};
```

**删除规则**：
```typescript
const handleDeleteRule = (index: number) => {
  const newChain = ruleChain.filter((_, i) => i !== index);
  setRuleChain(newChain);
  // useEffect 会自动触发预览
};
```

**移动规则**：
```typescript
const handleMoveRule = (index: number, direction: 'up' | 'down') => {
  // ... 移动逻辑
  setRuleChain(newChain);
  // useEffect 会自动触发预览
};
```

**更新规则参数**：
```typescript
const handleUpdateRule = (index: number, updatedRule: RenameRule) => {
  const newChain = [...ruleChain];
  newChain[index] = updatedRule;
  setRuleChain(newChain);
  // useEffect 会自动触发预览
};
```

**说明**：
- 移除了原有的 `message.success` 提示
- 所有规则变更都会触发 `setRuleChain`
- `useEffect` 监听到变化后自动调用 `autoPreview`

#### 修改 ⑥: 优化手动预览函数（第 229-265 行）
```typescript
// 手动预览（保留作为备用）
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

  // 立即生成预览（清除防抖定时器）
  if (previewTimerRef.current) {
    clearTimeout(previewTimerRef.current);
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

**改进**：
- 点击按钮时立即清除防抖定时器
- 立即生成预览，无需等待
- 保留完整的参数验证和提示信息

#### 修改 ⑦: 简化清空规则链（第 267-270 行）
```typescript
// 清空规则链
const handleClearChain = () => {
  setRuleChain([]);
  // useEffect 会自动清空预览
};
```

**说明**：
- 移除了 `message.success` 提示
- `ruleChain` 变为空数组后，`useEffect` 会自动清空预览列表

#### 修改 ⑧: 优化预览按钮区域（第 612-625 行）
```tsx
{/* 预览按钮 */}
<Space direction="vertical" style={{ width: '100%' }}>
  <Space style={{ justifyContent: 'space-between' }}>
    <div style={{ color: '#1890ff', fontSize: '12px' }}>
      {ruleChain.length > 0 && files.length > 0 ? (
        <span>✨ 实时预览已启用 - 修改规则后自动更新</span>
      ) : (
        <span style={{ color: '#999' }}>添加规则并选择文件夹后自动预览</span>
      )}
    </div>
    <Button onClick={handlePreview} disabled={ruleChain.length === 0} title="立即刷新预览">
      刷新预览
    </Button>
  </Space>
</Space>
```

**改进**：
- 显示实时预览状态提示
- 有文件和规则时显示"✨ 实时预览已启用"
- 否则显示灰色提示"添加规则并选择文件夹后自动预览"
- 保留"刷新预览"按钮作为备用

---

## 🎯 工作流程

### 自动预览流程

```
用户修改规则参数
    ↓
触发 handleUpdateRule / handleAddRule 等
    ↓
调用 setRuleChain 更新状态
    ↓
useEffect 监听到 ruleChain 变化
    ↓
调用 autoPreview()
    ↓
清除之前的定时器（防抖）
    ↓
设置 300ms 新定时器
    ↓
300ms 后执行预览生成
    ↓
验证规则参数有效性
    ↓
调用 generateNewNames(files, ruleChain)
    ↓
更新 previewList 状态
    ↓
预览表格自动刷新显示
```

### 手动刷新流程

```
用户点击"刷新预览"按钮
    ↓
调用 handlePreview()
    ↓
清除防抖定时器（如果有）
    ↓
立即验证参数
    ↓
立即生成预览
    ↓
显示成功提示
```

---

## 🔍 技术实现细节

### 1. 防抖（Debounce）

**原理**：
```typescript
// 每次修改规则时
autoPreview();

// 内部逻辑：
// 1. 清除之前的定时器（如果用户在前 300ms 内又修改了）
if (previewTimerRef.current) {
  clearTimeout(previewTimerRef.current);
}

// 2. 设置新的定时器
previewTimerRef.current = setTimeout(() => {
  // 300ms 后才真正执行预览生成
  const preview = generateNewNames(files, ruleChain);
  setPreviewList(preview);
}, 300);
```

**效果**：
- 用户快速输入时，不会频繁计算预览
- 只在用户停止输入 300ms 后才计算
- 大幅减少计算次数，提升性能

### 2. useEffect 依赖监听

```typescript
useEffect(() => {
  autoPreview();
  
  return () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
  };
}, [ruleChain, files]);
```

**依赖数组**：
- `ruleChain` - 规则数组变化时触发
- `files` - 文件列表变化时触发

**触发场景**：
- 添加规则
- 删除规则
- 移动规则顺序
- 修改规则参数
- 切换规则类型
- 选择新文件夹
- 清空规则链

### 3. 参数验证

自动预览时会验证参数有效性：

```typescript
// 查找替换规则必须有 search 文本
if (rule.type === 'findReplace' && !rule.params.search) {
  setPreviewList([]);  // 清空预览
  return;
}

// 插入日期规则必须有 format 格式
if (rule.type === 'insertDate' && !rule.params.format) {
  setPreviewList([]);  // 清空预览
  return;
}
```

**效果**：
- 参数无效时不显示预览
- 避免生成错误的预览结果
- 用户输入有效参数后自动显示预览

### 4. 内存清理

```typescript
return () => {
  if (previewTimerRef.current) {
    clearTimeout(previewTimerRef.current);
  }
};
```

**作用**：
- 组件卸载时清除定时器
- 避免内存泄漏
- 避免在已卸载组件上调用 setState

---

## 📊 性能优化

### 1. 防抖延迟选择

**300ms** 是一个平衡点：
- 太短（如 100ms）：仍然会频繁计算
- 太长（如 1000ms）：用户感觉响应慢
- 300ms：用户停止输入后立即响应，又不会太频繁

### 2. 避免重复计算

```typescript
// 如果规则参数无效，直接返回，不调用 generateNewNames
if (rule.type === 'findReplace' && !rule.params.search) {
  setPreviewList([]);
  return;  // 提前返回，避免无效计算
}
```

### 3. useRef 而非 useState

```typescript
const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
```

**为什么用 useRef**：
- 定时器 ID 不需要触发重新渲染
- useState 会在每次设置时触发渲染
- useRef 只是普通对象，不会影响渲染

---

## ✅ 用户体验提升

### 修改前
```
1. 用户修改规则参数
2. 点击"预览效果"按钮
3. 看到预览结果
```

**问题**：
- 需要额外点击按钮
- 容易忘记点击预览
- 操作步骤多

### 修改后
```
1. 用户修改规则参数
2. 0.3 秒后自动看到预览结果
3. 无需任何额外操作
```

**优势**：
- 操作流畅自然
- 即时反馈
- 减少操作步骤
- 保留手动刷新作为备用

---

## 🎨 UI 变化

### 预览按钮区域

**修改前**：
```
┌─────────────────────────────────────┐
│ [预览效果（2 条规则）]                │
└─────────────────────────────────────┘
```

**修改后**：
```
┌─────────────────────────────────────┐
│ ✨ 实时预览已启用 - 修改规则后自动更新 │
│                      [刷新预览]      │
└─────────────────────────────────────┘
```

**说明**：
- 显示实时预览状态
- 蓝色文字提示用户
- 小按钮不抢眼但可用

---

## ⚠️ 注意事项

### 1. 防抖定时器清理

所有可能修改 `ruleChain` 的地方都不需要手动调用 `autoPreview`，因为 `useEffect` 会自动处理。

### 2. 参数验证

自动预览时的验证比较宽松，只验证必填参数。手动预览时的验证更严格，会显示详细错误提示。

### 3. 性能考虑

对于超大量文件（如 10000+），300ms 防抖可能仍然会有一定计算压力。可以考虑：
- 增加防抖时间到 500ms
- 或者添加"性能模式"开关

### 4. 文件列表变化

当用户选择新文件夹或执行重命名后，`files` 会变化，也会触发自动预览。这是期望的行为。

---

## 🚀 扩展建议

### 1. 可配置防抖时间

```typescript
const [debounceTime, setDebounceTime] = useState(300);

// 在 autoPreview 中使用
}, debounceTime);
```

### 2. 预览加载状态

```typescript
const [previewLoading, setPreviewLoading] = useState(false);

// 在 autoPreview 中
setPreviewLoading(true);
setTimeout(() => {
  const preview = generateNewNames(files, ruleChain);
  setPreviewList(preview);
  setPreviewLoading(false);
}, 300);
```

### 3. 预览统计信息

```typescript
{previewList.length > 0 && (
  <div style={{ color: '#999', fontSize: '12px' }}>
    共 {previewList.length} 个文件，
    {previewList.filter(p => p.oldName !== p.newName).length} 个文件将被重命名
  </div>
)}
```

---

## 📚 相关文档

- [React useEffect](https://react.dev/reference/react/useEffect)
- [React useRef](https://react.dev/reference/react/useRef)
- [Debounce 防抖](https://www.freecodecamp.org/news/javascript-debounce-example/)

---

## 🎉 总结

实时预览功能已完全实现！用户现在可以：

1. ✅ 修改规则参数后自动看到预览
2. ✅ 无需手动点击按钮
3. ✅ 300ms 防抖避免卡顿
4. ✅ 保留手动刷新作为备用
5. ✅ 所有现有功能正常工作

**核心改进**：
- 添加 `autoPreview` 函数（带防抖）
- 使用 `useEffect` 监听变化
- 简化所有规则变更函数
- 优化 UI 显示实时预览状态

用户体验大幅提升！🚀
