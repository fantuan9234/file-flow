import React, { useState } from 'react';
import { Button, Card, Space, Select, message, Table, Checkbox, Modal, theme, Dropdown, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, PlayCircleOutlined, UndoOutlined, SaveOutlined, FolderOpenOutlined, DownOutlined } from '@ant-design/icons';

const renameRuleTypes = [
  { value: 'addPrefix', label: '添加前缀' },
  { value: 'addSuffix', label: '添加后缀' },
  { value: 'findReplace', label: '查找替换' },
  { value: 'insertDate', label: '插入日期' },
  { value: 'sequence', label: '添加序号' },
];

const convertFormats = [
  { value: '.docx', label: 'Word (.docx)' },
  { value: '.md', label: 'Markdown (.md)' },
  { value: '.html', label: 'HTML (.html)' },
  { value: '.jpg', label: 'JPEG (.jpg)' },
  { value: '.png', label: 'PNG (.png)' },
];

const conversionMap: Record<string, string[]> = {
  '.docx': ['.md'],
  '.md': ['.html', '.pdf'],
  '.html': ['.md'],
  '.jpg': ['.png'],
  '.png': ['.jpg'],
};

const BUILTIN_TEMPLATES = [
  {
    name: '照片归档',
    template: {
      version: 1,
      name: '照片归档',
      steps: [
        {
          id: 'tpl-photo-date',
          stepType: 'rename',
          rule: {
            type: 'insertDate',
            params: { position: 'prefix', format: 'yyyyMMdd_' },
          },
        },
        {
          id: 'tpl-photo-convert',
          stepType: 'convert',
          sourceFormat: '.jpg',
          targetFormat: '.png',
        },
      ],
    },
  },
  {
    name: '文档备份',
    template: {
      version: 1,
      name: '文档备份',
      steps: [
        {
          id: 'tpl-doc-convert',
          stepType: 'convert',
          sourceFormat: '.docx',
          targetFormat: '.md',
        },
        {
          id: 'tpl-doc-suffix',
          stepType: 'rename',
          rule: {
            type: 'addSuffix',
            params: { suffix: '_backup' },
          },
        },
      ],
    },
  },
];

function WorkflowPanel({ files, onFilesChange }: { files: any[]; onFilesChange: (files: any[]) => void }) {
  const { token } = theme.useToken();
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [execLog, setExecLog] = useState<string[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addStepIndex, setAddStepIndex] = useState<number | null>(null);

  const createRenameStep = () => ({
    id: Date.now().toString() + Math.random(),
    stepType: 'rename' as const,
    rule: {
      type: 'addPrefix',
      params: { prefix: '' },
    },
  });

  const createConvertStep = () => ({
    id: Date.now().toString() + Math.random(),
    stepType: 'convert' as const,
    sourceFormat: '.docx',
    targetFormat: '.md',
  });

  const handleAddStep = (type: 'rename' | 'convert', index?: number) => {
    const newStep = type === 'rename' ? createRenameStep() : createConvertStep();
    if (index !== undefined && index !== null) {
      const newSteps = [...steps];
      newSteps.splice(index + 1, 0, newStep);
      setSteps(newSteps);
    } else {
      setSteps([...steps, newStep]);
    }
    setAddModalVisible(false);
    setAddStepIndex(null);
  };

  const handleDeleteStep = (index: number) => {
    setSteps(steps.filter((_, i) => i !== index));
  };

  const handleMoveStep = (index: number, direction: 'up' | 'down') => {
    const newSteps = [...steps];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSteps.length) return;
    [newSteps[index], newSteps[targetIndex]] = [newSteps[targetIndex], newSteps[index]];
    setSteps(newSteps);
  };

  const handleUpdateRenameRule = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index].rule[field] = value;
    setSteps(newSteps);
  };

  const handleUpdateRenameParam = (index: number, paramKey: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index].rule.params[paramKey] = value;
    setSteps(newSteps);
  };

  const handleUpdateConvertStep = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index][field] = value;
    if (field === 'sourceFormat') {
      const allowedTargets = conversionMap[value] || [];
      if (!allowedTargets.includes(newSteps[index].targetFormat)) {
        newSteps[index].targetFormat = allowedTargets[0] || '';
      }
    }
    setSteps(newSteps);
  };

  const handleExecute = async () => {
    if (steps.length === 0) {
      message.warning('请先添加至少一个步骤');
      return;
    }
    if (files.length === 0) {
      message.warning('请先选择文件夹并扫描文件');
      return;
    }

    setLoading(true);
    setExecLog([]);

    const folderPath = files.length > 0 ? files[0].path.substring(0, files[0].path.lastIndexOf(files[0].name)) : '';

    const workflowSteps = steps.map((step) => {
      if (step.stepType === 'rename') {
        return { stepType: 'rename', rule: step.rule };
      }
      return { stepType: 'convert', sourceFormat: step.sourceFormat, targetFormat: step.targetFormat };
    });

    const res = await window.fileAPI.executeWorkflow({
      folderPath,
      steps: workflowSteps,
      keepOriginal,
    });

    setLoading(false);

    if (res.success && res.data) {
      onFilesChange(res.data);
      setExecLog(res.log || []);
      message.success('工作流执行完成');
    } else {
      message.error('工作流执行失败：' + res.error);
    }
  };

  const handleUndo = async () => {
    const res = await window.fileAPI.undoWorkflow();
    if (res.success) {
      message.success('工作流已撤销');
      setExecLog([]);
      if (files.length > 0) {
        const folderPath = files[0].path.substring(0, files[0].path.lastIndexOf(files[0].name));
        const scanRes = await window.fileAPI.scanFiles(folderPath);
        if (scanRes.success && scanRes.data) {
          onFilesChange(scanRes.data);
        }
      }
    } else {
      message.error('撤销失败：' + res.error);
    }
  };

  const handleSaveTemplate = async () => {
    if (steps.length === 0) {
      message.warning('请先添加至少一个步骤');
      return;
    }

    const saveRes = await window.fileAPI.saveDialog('workflow-template.json');
    if (!saveRes.success || !saveRes.filePath) {
      message.info('已取消保存');
      return;
    }

    const templateData = {
      version: 1,
      name: '自定义模板',
      steps: steps.map((step) => {
        if (step.stepType === 'rename') {
          return { stepType: 'rename', rule: step.rule };
        }
        return { stepType: 'convert', sourceFormat: step.sourceFormat, targetFormat: step.targetFormat };
      }),
    };

    const writeRes = await window.fileAPI.writeFile(saveRes.filePath, JSON.stringify(templateData, null, 2));
    if (writeRes.success) {
      message.success('模板保存成功');
    } else {
      message.error('模板保存失败：' + (writeRes.error || '未知错误'));
    }
  };

  const handleLoadTemplate = async () => {
    const openRes = await window.fileAPI.openDialogJson();
    if (!openRes.success || !openRes.filePath) {
      message.info('已取消选择');
      return;
    }

    const readRes = await window.fileAPI.readFile(openRes.filePath);
    if (!readRes.success || !readRes.data) {
      message.error('读取文件失败：' + (readRes.error || '未知错误'));
      return;
    }

    try {
      const templateData = JSON.parse(readRes.data);
      if (!templateData.version || templateData.version !== 1) {
        message.error('模板格式不兼容');
        return;
      }
      if (!Array.isArray(templateData.steps)) {
        message.error('模板格式错误：缺少步骤数据');
        return;
      }

      const loadedSteps = templateData.steps.map((step: any, index: number) => {
        if (step.stepType === 'rename') {
          return {
            id: 'loaded-' + Date.now() + '-' + index,
            stepType: 'rename' as const,
            rule: step.rule,
          };
        }
        return {
          id: 'loaded-' + Date.now() + '-' + index,
          stepType: 'convert' as const,
          sourceFormat: step.sourceFormat,
          targetFormat: step.targetFormat,
        };
      });

      setSteps(loadedSteps);
      message.success('模板加载成功');
    } catch (err) {
      message.error('模板解析失败：无效的 JSON 格式');
    }
  };

  const handleLoadBuiltinTemplate = async (template: any) => {
    const loadedSteps = template.steps.map((step: any, index: number) => {
      if (step.stepType === 'rename') {
        return {
          id: 'builtin-' + Date.now() + '-' + index,
          stepType: 'rename' as const,
          rule: step.rule,
        };
      }
      return {
        id: 'builtin-' + Date.now() + '-' + index,
        stepType: 'convert' as const,
        sourceFormat: step.sourceFormat,
        targetFormat: step.targetFormat,
      };
    });

    setSteps(loadedSteps);
    message.success(`已加载模板：${template.name}`);
  };

  const renderRenameStepParams = (step: any, index: number) => {
    const { rule } = step;
    switch (rule.type) {
      case 'addPrefix':
        return (
          <Space>
            <span>前缀：</span>
            <input
              type="text"
              value={rule.params.prefix || ''}
              onChange={(e) => handleUpdateRenameParam(index, 'prefix', e.target.value)}
              style={{ width: 120, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
          </Space>
        );
      case 'addSuffix':
        return (
          <Space>
            <span>后缀：</span>
            <input
              type="text"
              value={rule.params.suffix || ''}
              onChange={(e) => handleUpdateRenameParam(index, 'suffix', e.target.value)}
              style={{ width: 120, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
          </Space>
        );
      case 'findReplace':
        return (
          <Space>
            <span>查找：</span>
            <input
              type="text"
              value={rule.params.search || ''}
              onChange={(e) => handleUpdateRenameParam(index, 'search', e.target.value)}
              style={{ width: 100, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
            <span>替换为：</span>
            <input
              type="text"
              value={rule.params.replace || ''}
              onChange={(e) => handleUpdateRenameParam(index, 'replace', e.target.value)}
              style={{ width: 100, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
          </Space>
        );
      case 'insertDate':
        return (
          <Space>
            <span>位置：</span>
            <Select
              value={rule.params.position || 'prefix'}
              onChange={(v) => handleUpdateRenameParam(index, 'position', v)}
              options={[
                { value: 'prefix', label: '前缀' },
                { value: 'suffix', label: '后缀' },
              ]}
              style={{ width: 80 }}
              size="small"
            />
            <span>格式：</span>
            <input
              type="text"
              value={rule.params.format || 'yyyyMMdd'}
              onChange={(e) => handleUpdateRenameParam(index, 'format', e.target.value)}
              style={{ width: 120, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
          </Space>
        );
      case 'sequence':
        return (
          <Space>
            <span>起始：</span>
            <input
              type="number"
              value={rule.params.start || 1}
              onChange={(e) => handleUpdateRenameParam(index, 'start', parseInt(e.target.value) || 1)}
              style={{ width: 60, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
            <span>步长：</span>
            <input
              type="number"
              value={rule.params.step || 1}
              onChange={(e) => handleUpdateRenameParam(index, 'step', parseInt(e.target.value) || 1)}
              style={{ width: 60, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
            <span>位数：</span>
            <input
              type="number"
              value={rule.params.digits || 3}
              onChange={(e) => handleUpdateRenameParam(index, 'digits', parseInt(e.target.value) || 3)}
              style={{ width: 60, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
            <span>位置：</span>
            <Select
              value={rule.params.position || 'prefix'}
              onChange={(v) => handleUpdateRenameParam(index, 'position', v)}
              options={[
                { value: 'prefix', label: '前缀' },
                { value: 'suffix', label: '后缀' },
              ]}
              style={{ width: 80 }}
              size="small"
            />
          </Space>
        );
      default:
        return null;
    }
  };

  const renderConvertStepParams = (step: any, index: number) => {
    const allowedTargets = conversionMap[step.sourceFormat] || [];
    return (
      <Space>
        <span>源格式：</span>
        <Select
          value={step.sourceFormat}
          onChange={(v) => handleUpdateConvertStep(index, 'sourceFormat', v)}
          options={convertFormats}
          style={{ width: 140 }}
          size="small"
        />
        <span>→</span>
        <span>目标格式：</span>
        <Select
          value={step.targetFormat}
          onChange={(v) => handleUpdateConvertStep(index, 'targetFormat', v)}
          options={convertFormats.filter((f) => allowedTargets.includes(f.value))}
          style={{ width: 140 }}
          size="small"
        />
      </Space>
    );
  };

  return (
    <div>
      <Space direction="vertical" style={{ width: '100%' }}>
        <Button
          type="dashed"
          icon={<PlusOutlined />}
          onClick={() => {
            setAddStepIndex(null);
            setAddModalVisible(true);
          }}
          block
        >
          添加步骤
        </Button>

        {steps.map((step, index) => (
          <Card
            key={step.id}
            size="small"
            className="ff-workflow-step"
            style={{
              borderLeft: `4px solid ${step.stepType === 'rename' ? token.colorPrimary : token.colorSuccess}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              marginBottom: 12,
            }}
            title={
              <Space>
                <span style={{ fontWeight: 600 }}>
                  步骤 {index + 1}：{step.stepType === 'rename' ? '重命名' : '格式转换'}
                </span>
                {step.stepType === 'rename' && (
                  <Select
                    value={step.rule.type}
                    onChange={(v) => handleUpdateRenameRule(index, 'type', v)}
                    options={renameRuleTypes}
                    style={{ width: 130 }}
                    size="small"
                  />
                )}
              </Space>
            }
            extra={
              <Space>
                <Button
                  icon={<ArrowUpOutlined />}
                  onClick={() => handleMoveStep(index, 'up')}
                  disabled={index === 0}
                  size="small"
                  title="上移"
                />
                <Button
                  icon={<ArrowDownOutlined />}
                  onClick={() => handleMoveStep(index, 'down')}
                  disabled={index === steps.length - 1}
                  size="small"
                  title="下移"
                />
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setAddStepIndex(index);
                    setAddModalVisible(true);
                  }}
                  size="small"
                  title="在下方添加步骤"
                />
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteStep(index)}
                  size="small"
                  danger
                  title="删除"
                />
              </Space>
            }
          >
            <div style={{ paddingLeft: 8 }}>
              {step.stepType === 'rename'
                ? renderRenameStepParams(step, index)
                : renderConvertStepParams(step, index)}
            </div>
          </Card>
        ))}

        {steps.length === 0 && (
          <div className="ff-empty-state">
            <p style={{ margin: 0 }}>暂无步骤，请点击上方"添加步骤"按钮</p>
            <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
              步骤按从上到下的顺序执行
            </p>
          </div>
        )}

        <Checkbox checked={keepOriginal} onChange={(e) => setKeepOriginal(e.target.checked)}>
          格式转换后保留原文件
        </Checkbox>

        <Space>
          <Button
            type="primary"
            icon={<PlayCircleOutlined />}
            onClick={handleExecute}
            loading={loading}
            disabled={steps.length === 0}
            size="large"
          >
            执行工作流
          </Button>
          <Button
            icon={<UndoOutlined />}
            onClick={handleUndo}
            size="large"
          >
            撤销整个工作流
          </Button>
        </Space>

        <Divider style={{ margin: '16px 0' }} />

        <Space>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveTemplate}
            disabled={steps.length === 0}
          >
            保存模板
          </Button>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={handleLoadTemplate}
          >
            加载模板
          </Button>
          <Dropdown
            menu={{
              items: BUILTIN_TEMPLATES.map((tpl) => ({
                key: tpl.name,
                label: tpl.name,
              })),
              onClick: ({ key }) => {
                const tpl = BUILTIN_TEMPLATES.find((t) => t.name === key);
                if (tpl) {
                  handleLoadBuiltinTemplate(tpl.template);
                }
              },
            }}
          >
            <Button>
              使用示例模板 <DownOutlined />
            </Button>
          </Dropdown>
        </Space>

        {execLog.length > 0 && (
          <Card size="small" title="执行日志" style={{ marginTop: 16 }}>
            <ul style={{ margin: 0, paddingLeft: 20 }}>
              {execLog.map((log, i) => (
                <li key={i} style={{ color: token.colorTextSecondary, lineHeight: 1.8 }}>
                  {log}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </Space>

      <Modal
        title="选择步骤类型"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            block
            onClick={() => handleAddStep('rename', addStepIndex)}
            style={{ textAlign: 'left' }}
          >
            📝 添加重命名规则
          </Button>
          <Button
            block
            onClick={() => handleAddStep('convert', addStepIndex)}
            style={{ textAlign: 'left' }}
          >
            🔄 添加格式转换
          </Button>
        </Space>
      </Modal>
    </div>
  );
}

export default WorkflowPanel;
