import { useState } from 'react'
import { Card, Select, Input, Button, Space, Typography, message, Switch, InputNumber, Radio, theme } from 'antd'
import { PlusOutlined, DeleteOutlined, DragOutlined } from '@ant-design/icons'
import { generateNewNames, type RenameRule } from '../utils/renameEngine'

const { Text } = Typography
const { TextArea } = Input

interface FileInfo {
  path: string
  name: string
  size: number
  mtime: string | Date
}

interface RenameOperation {
  oldPath: string
  newPath: string
}

interface RuleConfigProps {
  onApplyRules: (operations: RenameOperation[]) => void
  selectedFiles: FileInfo[]
}

export function RuleConfig({ onApplyRules, selectedFiles }: RuleConfigProps) {
  const { token } = theme.useToken();
  const [rules, setRules] = useState<RenameRule[]>([
    {
      type: 'findReplace',
      enabled: true,
      findText: '',
      replaceText: '',
      useRegex: false,
      regexFlags: 'g'
    }
  ])

  const addRule = () => {
    setRules([
      ...rules,
      {
        type: 'findReplace',
        enabled: true,
        findText: '',
        replaceText: '',
        useRegex: false,
        regexFlags: 'g'
      }
    ])
  }

  const removeRule = (index: number) => {
    if (rules.length === 1) {
      message.warning('At least one rule is required')
      return
    }
    setRules(rules.filter((_, i) => i !== index))
  }

  const updateRule = (index: number, updates: Partial<RenameRule>) => {
    const newRules = [...rules]
    newRules[index] = { ...newRules[index], ...updates }
    setRules(newRules)
  }

  const moveRule = (fromIndex: number, direction: 'up' | 'down') => {
    const toIndex = direction === 'up' ? fromIndex - 1 : fromIndex + 1
    if (toIndex < 0 || toIndex >= rules.length) return
    
    const newRules = [...rules]
    const temp = newRules[fromIndex]
    newRules[fromIndex] = newRules[toIndex]
    newRules[toIndex] = temp
    setRules(newRules)
  }

  const generatePreview = (): RenameOperation[] => {
    if (selectedFiles.length === 0) {
      return []
    }

    try {
      const results = generateNewNames(selectedFiles, rules)
      return results.map(result => ({
        oldPath: result.oldName,
        newPath: result.newName
      }))
    } catch (error) {
      message.error(`Failed to generate preview: ${(error as Error).message}`)
      return []
    }
  }

  const handleApply = () => {
    if (selectedFiles.length === 0) {
      message.warning('Please select files first')
      return
    }

    const operations = generatePreview()
    
    if (operations.length === 0) {
      message.info('No files will be renamed')
      return
    }

    onApplyRules(operations)
    message.success(`Generated ${operations.length} rename operations`)
  }

  const handleReset = () => {
    setRules([
      {
        type: 'findReplace',
        enabled: true,
        findText: '',
        replaceText: '',
        useRegex: false,
        regexFlags: 'g'
      }
    ])
  }

  const renderRuleConfig = (rule: RenameRule, index: number) => {
    return (
      <Card
        key={index}
        size="small"
        className="rule-item"
        style={{ marginBottom: '12px' }}
        title={
          <Space>
            <DragOutlined 
              style={{ cursor: 'grab', color: token.colorTextTertiary }}
              onMouseDown={(e) => {
                e.preventDefault()
                // 可以添加拖拽功能
              }}
            />
            <Text strong>Rule {index + 1}</Text>
            <Select
              value={rule.type}
              onChange={(value) => updateRule(index, { type: value })}
              options={[
                { value: 'findReplace', label: 'Find & Replace' },
                { value: 'regexReplace', label: 'Regex Replace' },
                { value: 'addPrefix', label: 'Add Prefix' },
                { value: 'addSuffix', label: 'Add Suffix' },
                { value: 'insertDate', label: 'Insert Date' },
                { value: 'sequence', label: 'Sequence Number' }
              ]}
              style={{ width: 180 }}
              size="small"
            />
          </Space>
        }
        extra={
          <Space>
            <Switch
              checked={rule.enabled}
              onChange={(checked) => updateRule(index, { enabled: checked })}
              size="small"
            />
            <Button
              type="text"
              danger
              icon={<DeleteOutlined />}
              onClick={() => removeRule(index)}
              disabled={rules.length === 1}
            />
          </Space>
        }
      >
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          {/* Find & Replace */}
          {rule.type === 'findReplace' && (
            <>
              <Space.Compact style={{ width: '100%' }}>
                <Radio.Group
                  value={rule.useRegex ? 'regex' : 'text'}
                  onChange={(e) => updateRule(index, { useRegex: e.target.value === 'regex' })}
                  options={[
                    { label: 'Text', value: 'text' },
                    { label: 'Regex', value: 'regex' }
                  ]}
                  size="small"
                />
                <Input
                  placeholder={rule.useRegex ? 'Regex pattern...' : 'Find text...'}
                  value={rule.findText}
                  onChange={(e) => updateRule(index, { findText: e.target.value })}
                />
              </Space.Compact>
              <Input
                placeholder="Replace with..."
                value={rule.replaceText}
                onChange={(e) => updateRule(index, { replaceText: e.target.value })}
              />
              {rule.useRegex && (
                <Input
                  placeholder="Regex flags (e.g., g, i, m)"
                  value={rule.regexFlags}
                  onChange={(e) => updateRule(index, { regexFlags: e.target.value })}
                  style={{ width: '150px' }}
                />
              )}
            </>
          )}

          {/* Regex Replace */}
          {rule.type === 'regexReplace' && (
            <>
              <TextArea
                placeholder="Regex pattern..."
                value={rule.findText}
                onChange={(e) => updateRule(index, { findText: e.target.value })}
                rows={2}
              />
              <Input
                placeholder="Replacement template (e.g., $1_$2)..."
                value={rule.replaceText}
                onChange={(e) => updateRule(index, { replaceText: e.target.value })}
              />
              <Input
                placeholder="Regex flags (e.g., g, i, m)"
                value={rule.regexFlags}
                onChange={(e) => updateRule(index, { regexFlags: e.target.value })}
                style={{ width: '150px' }}
              />
            </>
          )}

          {/* Add Prefix */}
          {rule.type === 'addPrefix' && (
            <Input
              placeholder="Enter prefix (e.g., backup_)"
              value={rule.prefix}
              onChange={(e) => updateRule(index, { prefix: e.target.value })}
              addonBefore="Prefix:"
            />
          )}

          {/* Add Suffix */}
          {rule.type === 'addSuffix' && (
            <Input
              placeholder="Enter suffix (e.g., _v2)"
              value={rule.suffix}
              onChange={(e) => updateRule(index, { suffix: e.target.value })}
              addonBefore="Suffix:"
            />
          )}

          {/* Insert Date */}
          {rule.type === 'insertDate' && (
            <>
              <Space>
                <Text>Format:</Text>
                <Select
                  value={rule.dateFormat || 'YYYY-MM-DD'}
                  onChange={(value) => updateRule(index, { dateFormat: value })}
                  options={[
                    { value: 'YYYY-MM-DD', label: '2024-01-15' },
                    { value: 'YYYYMMDD', label: '20240115' },
                    { value: 'YY-MM-DD', label: '24-01-15' },
                    { value: 'MM-DD-YYYY', label: '01-15-2024' },
                    { value: 'DD-MM-YYYY', label: '15-01-2024' },
                    { value: 'YYYY-MM-DD_HH-mm-ss', label: '2024-01-15_10-30-00' }
                  ]}
                  style={{ width: 200 }}
                />
              </Space>
              <Space>
                <Text>Position:</Text>
                <Radio.Group
                  value={rule.insertPosition || 'before-extension'}
                  onChange={(e) => updateRule(index, { insertPosition: e.target.value })}
                  options={[
                    { label: 'Start', value: 'start' },
                    { label: 'Before .ext', value: 'before-extension' },
                    { label: 'End', value: 'end' }
                  ]}
                  size="small"
                />
              </Space>
            </>
          )}

          {/* Sequence Number */}
          {rule.type === 'sequence' && (
            <>
              <Space wrap>
                <Space>
                  <Text>Start:</Text>
                  <InputNumber
                    value={rule.sequenceStart || 1}
                    onChange={(value) => updateRule(index, { sequenceStart: value || 1 })}
                    min={0}
                    style={{ width: 80 }}
                    size="small"
                  />
                </Space>
                <Space>
                  <Text>Step:</Text>
                  <InputNumber
                    value={rule.sequenceStep || 1}
                    onChange={(value) => updateRule(index, { sequenceStep: value || 1 })}
                    min={1}
                    style={{ width: 80 }}
                    size="small"
                  />
                </Space>
                <Space>
                  <Text>Padding:</Text>
                  <InputNumber
                    value={rule.sequencePadding || 0}
                    onChange={(value) => updateRule(index, { sequencePadding: value || 0 })}
                    min={0}
                    placeholder="0"
                    style={{ width: 80 }}
                    size="small"
                  />
                </Space>
              </Space>
              <Space>
                <Text>Position:</Text>
                <Radio.Group
                  value={rule.sequencePosition || 'before-extension'}
                  onChange={(e) => updateRule(index, { sequencePosition: e.target.value })}
                  options={[
                    { label: 'Start', value: 'start' },
                    { label: 'Before .ext', value: 'before-extension' },
                    { label: 'End', value: 'end' }
                  ]}
                  size="small"
                />
              </Space>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                Example: Start=1, Step=1, Padding=3 → 001, 002, 003...
              </Text>
            </>
          )}
        </Space>
      </Card>
    )
  }

  return (
    <Card 
      title="Rename Rules Configuration" 
      size="small"
      className="rule-config-card"
      extra={
        <Space>
          <Button onClick={handleReset} size="small">
            Reset All
          </Button>
          <Button type="primary" onClick={addRule} size="small" icon={<PlusOutlined />}>
            Add Rule
          </Button>
        </Space>
      }
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {rules.map((rule, index) => (
          <div key={index} style={{ position: 'relative' }}>
            {renderRuleConfig(rule, index)}
            {index < rules.length - 1 && (
              <Button
                size="small"
                type="link"
                style={{ position: 'absolute', right: 0, top: -10 }}
                onClick={() => moveRule(index, 'down')}
              >
                ↓
              </Button>
            )}
            {index > 0 && (
              <Button
                size="small"
                type="link"
                style={{ position: 'absolute', right: 50, top: -10 }}
                onClick={() => moveRule(index, 'up')}
              >
                ↑
              </Button>
            )}
          </div>
        ))}

        <Space style={{ width: '100%', marginTop: '16px' }}>
          <Button type="primary" onClick={handleApply} block size="large">
            Apply Rules & Generate Preview
          </Button>
        </Space>

        {selectedFiles.length > 0 && (
          <Text type="secondary" style={{ display: 'block', textAlign: 'center' }}>
            Will process {selectedFiles.length} file{selectedFiles.length !== 1 ? 's' : ''}
          </Text>
        )}
      </Space>
    </Card>
  )
}
