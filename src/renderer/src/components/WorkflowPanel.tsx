import { useState } from 'react';
import { Button, Card, Space, Select, message, Checkbox, Modal, theme, Dropdown, Divider, Progress } from 'antd';
import { PlusOutlined, DeleteOutlined, ArrowUpOutlined, ArrowDownOutlined, PlayCircleOutlined, UndoOutlined, SaveOutlined, FolderOpenOutlined, DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const classifyRuleTypes = (t: (key: string) => string) => [
  { value: 'byExtension', label: t('classify.byExtension') },
  { value: 'byKeyword', label: t('classify.byKeyword') },
  { value: 'bySize', label: t('classify.bySize') },
  { value: 'byDate', label: t('classify.byDate') },
];

const renameRuleTypes = (t: (key: string) => string) => [
  { value: 'addPrefix', label: t('rename.addPrefix') },
  { value: 'addSuffix', label: t('rename.addSuffix') },
  { value: 'findReplace', label: t('rename.findReplace') },
  { value: 'insertDate', label: t('rename.insertDate') },
  { value: 'sequence', label: t('rename.addSequence') },
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

function WorkflowPanel({ files, onFilesChange, onSelectedFilesChange, skipConfirm }: { files: any[]; allFiles: any[]; onFilesChange: (files: any[]) => void; onSelectedFilesChange: (files: any[]) => void; skipConfirm?: boolean }) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [steps, setSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [keepOriginal, setKeepOriginal] = useState(true);
  const [execLog, setExecLog] = useState<string[]>([]);
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addStepIndex, setAddStepIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState<{ current: number; total: number; stepName: string } | null>(null);

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

  const createClassifyStep = () => ({
    id: Date.now().toString() + Math.random(),
    stepType: 'classify' as const,
    rule: {
      type: 'byExtension',
      params: { extension: 'pdf' },
    },
    targetFolder: '',
  });

  const handleAddStep = (type: 'rename' | 'convert' | 'classify', index?: number) => {
    const newStep = type === 'rename' ? createRenameStep() : type === 'convert' ? createConvertStep() : createClassifyStep();
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

  const handleUpdateClassifyRule = (index: number, field: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index].rule[field] = value;
    setSteps(newSteps);
  };

  const handleUpdateClassifyParam = (index: number, paramKey: string, value: any) => {
    const newSteps = [...steps];
    newSteps[index].rule.params[paramKey] = value;
    setSteps(newSteps);
  };

  const handleUpdateClassifyTarget = (index: number, value: string) => {
    const newSteps = [...steps];
    newSteps[index].targetFolder = value;
    setSteps(newSteps);
  };

  const handleExecute = async () => {
    if (steps.length === 0) {
      message.warning(t('workflow.noStepsToAdd'));
      return;
    }
    if (files.length === 0) {
      message.warning(t('workflow.selectFolderFirst'));
      return;
    }

    const stepLabels: Record<string, string> = {
      rename: t('workflow.rename'),
      convert: t('workflow.convert'),
      classify: t('workflow.classify'),
    };

    const stepSummary = steps.map((s, i) => {
      if (s.stepType === 'rename') return `${i + 1}. ${stepLabels.rename}（${s.rule.type}）`;
      if (s.stepType === 'classify') return `${i + 1}. ${stepLabels.classify}（${s.rule.type} → ${s.targetFolder}）`;
      return `${i + 1}. ${stepLabels.convert}（${s.sourceFormat} → ${s.targetFormat}）`;
    }).join('\n');

    const doExecute = async () => {
      setLoading(true);
      setExecLog([]);
      setProgress({ current: 0, total: steps.length, stepName: '准备中...' });

      const folderPath = files.length > 0 ? files[0].path.substring(0, files[0].path.lastIndexOf(files[0].name)) : '';

      const workflowSteps = steps.map((step) => {
        if (step.stepType === 'rename') {
          return { stepType: 'rename', rule: step.rule };
        }
        if (step.stepType === 'classify') {
          return { stepType: 'classify', rule: step.rule, targetFolder: step.targetFolder };
        }
        return { stepType: 'convert', sourceFormat: step.sourceFormat, targetFormat: step.targetFormat };
      });

      try {
        for (let i = 0; i < workflowSteps.length; i++) {
          const step = workflowSteps[i];
          setProgress({ current: i + 1, total: workflowSteps.length, stepName: stepLabels[step.stepType] || step.stepType });

          const res = await window.fileAPI.executeWorkflow({
            folderPath,
            steps: [step],
            keepOriginal,
          });

          if (!res.success) {
            message.error(t('workflow.stepFailed', { index: i + 1, name: stepLabels[step.stepType], error: res.error }));
            setProgress(null);
            setLoading(false);
            return;
          }

          if (res.data) {
            onFilesChange(res.data);
            onSelectedFilesChange(res.data);
          }
          setExecLog((prev) => [...prev, ...(res.log || [])]);
        }

        message.success(t('workflow.executeSuccess', { count: workflowSteps.length }));
      } catch (err) {
        message.error(t('workflow.executeError', { error: String(err) }));
      } finally {
        setProgress(null);
        setLoading(false);
      }
    };

    if (skipConfirm) {
      doExecute();
    } else {
      Modal.confirm({
        title: t('workflow.confirmTitle'),
        content: (
          <div>
            <p style={{ marginBottom: 8 }}>{t('workflow.confirmContent', { count: steps.length })}</p>
            <pre style={{
              background: token.colorBgLayout,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: '13px',
              lineHeight: 1.8,
              margin: 0,
              whiteSpace: 'pre-wrap',
            }}>
              {stepSummary}
            </pre>
          </div>
        ),
        okText: t('workflow.confirmOk'),
        cancelText: t('workflow.confirmCancel'),
        okButtonProps: { type: 'primary' },
        width: 480,
        onOk: doExecute,
      });
    }
  };

  const handleUndo = async () => {
    setLoading(true);
    const res = await window.fileAPI.undoWorkflow();
    setLoading(false);
    if (res.success) {
      message.success(t('workflow.undoSuccess'));
      setExecLog([]);
      if (files.length > 0) {
        const folderPath = files[0].path.substring(0, files[0].path.lastIndexOf(files[0].name));
        const scanRes = await window.fileAPI.scanFiles(folderPath);
        if (scanRes.success && scanRes.data) {
          onFilesChange(scanRes.data);
          onSelectedFilesChange(scanRes.data);
        }
      }
    } else {
      message.error(t('workflow.undoFailed', { error: res.error }));
    }
  };

  const handleSaveTemplate = async () => {
    if (steps.length === 0) {
      message.warning(t('workflow.noStepsToAdd'));
      return;
    }

    const saveRes = await window.fileAPI.saveDialog('workflow-template.json');
    if (!saveRes.success || !saveRes.filePath) {
      message.info(t('workflow.templateCancelled'));
      return;
    }

    const templateData = {
        version: 1,
        name: '自定义模板',
        steps: steps.map((step) => {
          if (step.stepType === 'rename') {
            return { stepType: 'rename', rule: step.rule };
          }
          if (step.stepType === 'classify') {
            return { stepType: 'classify', rule: step.rule, targetFolder: step.targetFolder };
          }
          return { stepType: 'convert', sourceFormat: step.sourceFormat, targetFormat: step.targetFormat };
        }),
      };

    const writeRes = await window.fileAPI.writeFile(saveRes.filePath, JSON.stringify(templateData, null, 2));
    if (writeRes.success) {
      message.success(t('workflow.templateSaved'));
    } else {
      message.error(t('workflow.templateSaveFailed', { error: writeRes.error || t('common.unknown') }));
    }
  };

  const handleLoadTemplate = async () => {
    const openRes = await window.fileAPI.openDialogJson();
    if (!openRes.success || !openRes.filePath) {
      message.info(t('workflow.templateSelectCancelled'));
      return;
    }

    const readRes = await window.fileAPI.readFile(openRes.filePath);
    if (!readRes.success || !readRes.data) {
      message.error(t('workflow.templateLoadFailed', { error: readRes.error || t('common.unknown') }));
      return;
    }

    try {
      const templateData = JSON.parse(readRes.data);
      if (!templateData.version || templateData.version !== 1) {
        message.error(t('workflow.templateIncompatible'));
        return;
      }
      if (!Array.isArray(templateData.steps)) {
        message.error(t('workflow.templateInvalid'));
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
        if (step.stepType === 'classify') {
          return {
            id: 'loaded-' + Date.now() + '-' + index,
            stepType: 'classify' as const,
            rule: step.rule,
            targetFolder: step.targetFolder,
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
      message.success(t('workflow.templateLoadSuccess'));
    } catch (err) {
      message.error(t('workflow.templateParseFailed'));
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
    message.success(t('workflow.loadedTemplate', { name: template.name }));
  };

  const renderRenameStepParams = (step: any, index: number) => {
    const { rule } = step;
    switch (rule.type) {
      case 'addPrefix':
        return (
          <Space>
            <span>{t('workflow.prefix')}：</span>
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
            <span>{t('workflow.suffix')}：</span>
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
            <span>{t('workflow.search')}：</span>
            <input
              type="text"
              value={rule.params.search || ''}
              onChange={(e) => handleUpdateRenameParam(index, 'search', e.target.value)}
              style={{ width: 100, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
            <span>{t('workflow.replaceWith')}：</span>
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
            <span>{t('workflow.position')}：</span>
            <Select
              value={rule.params.position || 'prefix'}
              onChange={(v) => handleUpdateRenameParam(index, 'position', v)}
              options={[
                { value: 'prefix', label: t('workflow.positionPrefix') },
                { value: 'suffix', label: t('workflow.positionSuffix') },
              ]}
              style={{ width: 80 }}
              size="small"
            />
            <span>{t('workflow.format')}：</span>
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
            <span>{t('workflow.start')}：</span>
            <input
              type="number"
              value={rule.params.start || 1}
              onChange={(e) => handleUpdateRenameParam(index, 'start', parseInt(e.target.value) || 1)}
              style={{ width: 60, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
            <span>{t('workflow.step')}：</span>
            <input
              type="number"
              value={rule.params.step || 1}
              onChange={(e) => handleUpdateRenameParam(index, 'step', parseInt(e.target.value) || 1)}
              style={{ width: 60, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
            <span>{t('workflow.digits')}：</span>
            <input
              type="number"
              value={rule.params.digits || 3}
              onChange={(e) => handleUpdateRenameParam(index, 'digits', parseInt(e.target.value) || 3)}
              style={{ width: 60, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
            <span>{t('workflow.position')}：</span>
            <Select
              value={rule.params.position || 'prefix'}
              onChange={(v) => handleUpdateRenameParam(index, 'position', v)}
              options={[
                { value: 'prefix', label: t('workflow.positionPrefix') },
                { value: 'suffix', label: t('workflow.positionSuffix') },
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
        <span>{t('workflow.sourceFormat')}：</span>
        <Select
          value={step.sourceFormat}
          onChange={(v) => handleUpdateConvertStep(index, 'sourceFormat', v)}
          options={convertFormats}
          style={{ width: 140 }}
          size="small"
        />
        <span>→</span>
        <span>{t('workflow.targetFormat')}：</span>
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

  const renderClassifyStepParams = (step: any, index: number) => {
    const { rule } = step;
    return (
      <Space direction="vertical" style={{ width: '100%' }} size="small">
        <Space wrap>
          <span>{t('workflow.classifyRule')}：</span>
          <Select
            value={rule.type}
            onChange={(v) => handleUpdateClassifyRule(index, 'type', v)}
            options={classifyRuleTypes(t)}
            style={{ width: 140 }}
            size="small"
          />
        </Space>
        {rule.type === 'byExtension' && (
          <Space>
            <span>{t('workflow.extension')}：</span>
            <input
              type="text"
              value={rule.params.extension || ''}
              onChange={(e) => handleUpdateClassifyParam(index, 'extension', e.target.value)}
              placeholder={t('classify.extensionPlaceholder')}
              style={{ width: 120, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
          </Space>
        )}
        {rule.type === 'byKeyword' && (
          <Space>
            <span>{t('workflow.keyword')}：</span>
            <input
              type="text"
              value={rule.params.keyword || ''}
              onChange={(e) => handleUpdateClassifyParam(index, 'keyword', e.target.value)}
              placeholder={t('classify.keywordPlaceholder')}
              style={{ width: 120, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
          </Space>
        )}
        {rule.type === 'bySize' && (
          <Space wrap>
            <span>{t('workflow.minSize')}：</span>
            <input
              type="number"
              value={rule.params.minSize ? rule.params.minSize / (1024 * 1024) : ''}
              onChange={(e) => handleUpdateClassifyParam(index, 'minSize', e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : undefined)}
              placeholder={t('classify.optional')}
              style={{ width: 80, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
            <span>{t('workflow.maxSize')}：</span>
            <input
              type="number"
              value={rule.params.maxSize ? rule.params.maxSize / (1024 * 1024) : ''}
              onChange={(e) => handleUpdateClassifyParam(index, 'maxSize', e.target.value ? parseFloat(e.target.value) * 1024 * 1024 : undefined)}
              placeholder={t('classify.optional')}
              style={{ width: 80, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
          </Space>
        )}
        {rule.type === 'byDate' && (
          <Space wrap>
            <span>{t('workflow.days')}：</span>
            <input
              type="number"
              value={rule.params.days || ''}
              onChange={(e) => handleUpdateClassifyParam(index, 'days', parseInt(e.target.value) || undefined)}
              style={{ width: 60, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
            />
            <span>{t('workflow.condition')}：</span>
            <Select
              value={rule.params.dateMode || 'older'}
              onChange={(v) => handleUpdateClassifyParam(index, 'dateMode', v)}
              options={[
                { value: 'older', label: t('classify.olderThan') },
                { value: 'newer', label: t('classify.newerThan') },
              ]}
              style={{ width: 80 }}
              size="small"
            />
          </Space>
        )}
        <Space>
          <span>{t('workflow.targetFolder')}：</span>
          <input
            type="text"
            value={step.targetFolder || ''}
            onChange={(e) => handleUpdateClassifyTarget(index, e.target.value)}
            placeholder={t('classify.targetFolderPlaceholder')}
            style={{ width: 120, padding: '4px 8px', border: `1px solid ${token.colorBorder}`, borderRadius: 8, background: token.colorBgContainer, color: token.colorText }}
          />
        </Space>
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
              borderLeft: `4px solid ${step.stepType === 'rename' ? token.colorPrimary : step.stepType === 'classify' ? token.colorWarning : token.colorSuccess}`,
              boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
              marginBottom: 12,
            }}
            title={
              <Space>
                <span style={{ fontWeight: 600, color: token.colorText }}>
                  {t('workflow.step')} {index + 1}：{step.stepType === 'rename' ? t('workflow.rename') : step.stepType === 'classify' ? t('workflow.classify') : t('workflow.convert')}
                </span>
                {step.stepType === 'rename' && (
                  <Select
                    value={step.rule.type}
                    onChange={(v) => handleUpdateRenameRule(index, 'type', v)}
                    options={renameRuleTypes(t)}
                    style={{ width: 130 }}
                    size="small"
                  />
                )}
                {step.stepType === 'classify' && (
                  <Select
                    value={step.rule.type}
                    onChange={(v) => handleUpdateClassifyRule(index, 'type', v)}
                    options={classifyRuleTypes(t)}
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
                  title={t('common.moveUp')}
                />
                <Button
                  icon={<ArrowDownOutlined />}
                  onClick={() => handleMoveStep(index, 'down')}
                  disabled={index === steps.length - 1}
                  size="small"
                  title={t('common.moveDown')}
                />
                <Button
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setAddStepIndex(index);
                    setAddModalVisible(true);
                  }}
                  size="small"
                  title={t('workflow.addStepBelow')}
                />
                <Button
                  icon={<DeleteOutlined />}
                  onClick={() => handleDeleteStep(index)}
                  size="small"
                  danger
                  title={t('common.delete')}
                />
              </Space>
            }
          >
            <div style={{ paddingLeft: 8 }}>
              {step.stepType === 'rename'
                ? renderRenameStepParams(step, index)
                : step.stepType === 'classify'
                  ? renderClassifyStepParams(step, index)
                  : renderConvertStepParams(step, index)}
            </div>
          </Card>
        ))}

        {steps.length === 0 && (
          <div className="ff-empty-state">
            <p style={{ margin: 0 }}>{t('workflow.noSteps')}</p>
            <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
              {t('workflow.stepOrderHint')}
            </p>
          </div>
        )}

        <Checkbox checked={keepOriginal} onChange={(e) => setKeepOriginal(e.target.checked)}>
          {t('workflow.keepOriginal')}
        </Checkbox>

        {progress && (
          <Card size="small" style={{ marginBottom: 12 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="small">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: token.colorText, fontWeight: 500 }}>
                  {t('workflow.executing')}: {progress.stepName}
                </span>
                <span style={{ color: token.colorTextSecondary, fontSize: '12px' }}>
                  {t('workflow.stepProgress', { current: progress.current, total: progress.total })}
                </span>
              </div>
              <Progress
                percent={Math.round((progress.current / progress.total) * 100)}
                strokeColor={token.colorPrimary}
                trailColor={token.colorBorderSecondary}
                size="small"
              />
            </Space>
          </Card>
        )}

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
            disabled={loading}
            size="large"
          >
            {t('workflow.undoWorkflow')}
          </Button>
        </Space>

        <Divider style={{ margin: '16px 0' }} />

        <Space>
          <Button
            icon={<SaveOutlined />}
            onClick={handleSaveTemplate}
            disabled={steps.length === 0}
          >
            {t('workflow.saveTemplate')}
          </Button>
          <Button
            icon={<FolderOpenOutlined />}
            onClick={handleLoadTemplate}
          >
            {t('workflow.loadTemplate')}
          </Button>
          <Dropdown
            menu={{
              items: BUILTIN_TEMPLATES.map((tpl) => ({
                key: tpl.name,
                label: t(`workflow.${tpl.name === '照片归档' ? 'photoArchive' : tpl.name === '文档备份' ? 'docBackup' : 'customTemplate'}`),
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
              {t('workflow.useSampleTemplate')} <DownOutlined />
            </Button>
          </Dropdown>
        </Space>

        {execLog.length > 0 && (
          <Card size="small" title={t('workflow.execLog')} style={{ marginTop: 16 }}>
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
        title={t('workflow.selectStepType')}
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <Button
            block
            onClick={() => handleAddStep('rename', addStepIndex ?? undefined)}
            style={{ textAlign: 'left' }}
          >
            {t('workflow.addRename')}
          </Button>
          <Button
            block
            onClick={() => handleAddStep('convert', addStepIndex ?? undefined)}
            style={{ textAlign: 'left' }}
          >
            {t('workflow.addConvert')}
          </Button>
          <Button
            block
            onClick={() => handleAddStep('classify', addStepIndex ?? undefined)}
            style={{ textAlign: 'left' }}
          >
            {t('workflow.addClassify')}
          </Button>
        </Space>
      </Modal>
    </div>
  );
}

export default WorkflowPanel;
