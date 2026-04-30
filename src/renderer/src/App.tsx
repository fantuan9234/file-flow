import { useState, useEffect, useRef } from 'react';
import { Button, Table, Input, Card, message, Space, Select, InputNumber, Tabs, ConfigProvider, theme } from 'antd';
import { DeleteOutlined, PlusOutlined, ArrowUpOutlined, ArrowDownOutlined } from '@ant-design/icons';
import { generateNewNames, RenameRule, RenameRuleType } from './utils/renameEngine';
import WorkflowPanel from './components/WorkflowPanel';
import './assets/theme.css';

interface FileInfo {
  path: string;
  name: string;
  size: number;
  mtime: string;
}

interface PreviewItem {
  oldPath: string;
  oldName: string;
  newName: string;
  newPath: string;
}

const CONVERSION_MATRIX: Record<string, { target: string; label: string; extensions: string[] }[]> = {
  '.docx': [{ target: '.md', label: 'Markdown (.md)', extensions: ['docx'] }],
  '.md': [
    { target: '.html', label: 'HTML (.html)', extensions: ['md'] },
    { target: '.pdf', label: 'PDF (.pdf)', extensions: ['md'] },
  ],
  '.html': [{ target: '.md', label: 'Markdown (.md)', extensions: ['html', 'htm'] }],
  '.jpg': [{ target: '.png', label: 'PNG (.png)', extensions: ['jpg', 'jpeg'] }],
  '.jpeg': [{ target: '.png', label: 'PNG (.png)', extensions: ['jpg', 'jpeg'] }],
  '.png': [
    { target: '.jpg', label: 'JPEG (.jpg)', extensions: ['png'] },
    { target: '.jpeg', label: 'JPEG (.jpeg)', extensions: ['png'] },
  ],
};

const SOURCE_FORMATS = [
  { value: '.docx', label: 'Word (.docx)' },
  { value: '.md', label: 'Markdown (.md)' },
  { value: '.html', label: 'HTML (.html)' },
  { value: '.jpg', label: 'JPEG (.jpg)' },
  { value: '.jpeg', label: 'JPEG (.jpeg)' },
  { value: '.png', label: 'PNG (.png)' },
];

function FormatConverter() {
  const [sourceType, setSourceType] = useState<string>('');
  const [targetType, setTargetType] = useState<string>('');
  const [converting, setConverting] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const { token } = theme.useToken();

  const targetOptions = sourceType ? (CONVERSION_MATRIX[sourceType] || []) : [];

  const doConvert = async (filePaths: string[]) => {
    setConverting(true);
    setProgress({ current: 0, total: filePaths.length });
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < filePaths.length; i++) {
        setProgress({ current: i + 1, total: filePaths.length });
        const filePath = filePaths[i];
        const convertRes = await window.fileAPI.convertFile({
          sourcePath: filePath,
          sourceType,
          targetType,
        });

        if (convertRes.success) {
          successCount++;
        } else {
          failCount++;
        }
      }

      if (successCount > 0) {
        message.success(`转换完成！成功 ${successCount} 个${failCount > 0 ? `，失败 ${failCount} 个` : ''}`);
      } else {
        message.error('所有文件转换失败');
      }
    } catch (err) {
      message.error('转换出错：' + String(err));
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  const handleConvertSingle = async () => {
    if (!sourceType) {
      message.warning('请选择源格式');
      return;
    }
    if (!targetType) {
      message.warning('请选择目标格式');
      return;
    }

    const extensions = CONVERSION_MATRIX[sourceType]?.[0]?.extensions || ['*'];
    const fileRes = await window.fileAPI.selectFile(extensions);
    if (!fileRes.success || !fileRes.path) {
      message.info('未选择文件');
      return;
    }

    doConvert([fileRes.path]);
  };

  const handleConvertMultiple = async () => {
    if (!sourceType) {
      message.warning('请选择源格式');
      return;
    }
    if (!targetType) {
      message.warning('请选择目标格式');
      return;
    }

    const extensions = CONVERSION_MATRIX[sourceType]?.[0]?.extensions || ['*'];
    const fileRes = await window.fileAPI.selectFiles(extensions);
    if (!fileRes.success || !fileRes.filePaths || fileRes.filePaths.length === 0) {
      message.info('未选择文件');
      return;
    }

    doConvert(fileRes.filePaths);
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space wrap>
        <Space>
          <span>源格式：</span>
          <Select
            value={sourceType || undefined}
            onChange={(val) => {
              setSourceType(val);
              setTargetType('');
            }}
            options={SOURCE_FORMATS}
            style={{ width: 180 }}
            placeholder="选择源格式"
          />
        </Space>
        <Space>
          <span>目标格式：</span>
          <Select
            value={targetType || undefined}
            onChange={setTargetType}
            options={targetOptions.map((opt) => ({ value: opt.target, label: opt.label }))}
            style={{ width: 180 }}
            placeholder="选择目标格式"
            disabled={!sourceType}
          />
        </Space>
        <Space>
          <Button
            type="primary"
            onClick={handleConvertSingle}
            loading={converting}
            disabled={!sourceType || !targetType}
          >
            {converting ? `正在转换：${progress?.current}/${progress?.total}...` : '选择单个文件'}
          </Button>
          <Button
            type="primary"
            onClick={handleConvertMultiple}
            loading={converting}
            disabled={!sourceType || !targetType}
          >
            {converting ? `正在转换：${progress?.current}/${progress?.total}...` : '选择多个文件'}
          </Button>
        </Space>
      </Space>
      {progress && converting && (
        <div style={{ color: token.colorTextSecondary, fontSize: '12px' }}>
          正在处理第 {progress.current} 个，共 {progress.total} 个文件
        </div>
      )}
      <div style={{ color: token.colorTextSecondary, fontSize: '12px' }}>
        <p style={{ margin: 0 }}>
          支持的转换：Word → Markdown | Markdown → HTML / PDF | HTML → Markdown | JPEG ↔ PNG
        </p>
        <p style={{ margin: '4px 0 0' }}>
          输出文件保存在源文件相同目录，文件名不变（仅扩展名改变）
        </p>
      </div>
    </Space>
  );
}

// 规则参数默认值
const DEFAULT_PARAMS = {
  prefix: 'img_',
  suffix: '_v2',
  searchText: '',
  replaceText: '',
  datePosition: 'prefix' as const,
  dateFormat: 'yyyyMMdd',
  seqStart: 1,
  seqStep: 1,
  seqDigits: 3,
  seqPosition: 'prefix' as const,
};

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

function App() {
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewList, setPreviewList] = useState<PreviewItem[]>([]);
  
  // 规则链状态
  const [ruleChain, setRuleChain] = useState<RenameRule[]>([]);
  
  // 防抖相关
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { token } = theme.useToken();

  // 扫描文件夹的通用函数
  const scanFolder = async (folderPath: string) => {
    setLoading(true);
    try {
      const scanRes = await window.fileAPI.scanFiles(folderPath);
      if (scanRes.success && scanRes.data) {
        setFiles(scanRes.data);
        setPreviewList([]);
        message.success(`扫描完成，共 ${scanRes.data.length} 个文件`);
      } else {
        message.error('扫描失败：' + scanRes.error);
      }
    } catch (err) {
      message.error('出错：' + String(err));
    } finally {
      setLoading(false);
    }
  };

  // 选择文件夹并扫描
  const handleSelectAndScan = async () => {
    try {
      const folderRes = await window.fileAPI.selectFolder();
      if (!folderRes.success || !folderRes.path) {
        message.info('未选择文件夹');
        return;
      }
      await scanFolder(folderRes.path);
    } catch (err) {
      message.error('出错：' + String(err));
    }
  };

  // 自动预览函数（带防抖）
  const autoPreview = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    
    previewTimerRef.current = setTimeout(() => {
      if (files.length === 0 || ruleChain.length === 0) {
        setPreviewList([]);
        return;
      }
      
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
      
      const preview = generateNewNames(files, ruleChain);
      setPreviewList(preview);
    }, 300);
  };
  
  useEffect(() => {
    autoPreview();
    
    return () => {
      if (previewTimerRef.current) {
        clearTimeout(previewTimerRef.current);
      }
    };
  }, [ruleChain, files]);

  // 添加规则
  const handleAddRule = (type: RenameRuleType) => {
    const newRule = createRule(type);
    setRuleChain([...ruleChain, newRule]);
    // useEffect 会自动触发预览
  };

  // 删除规则
  const handleDeleteRule = (index: number) => {
    const newChain = ruleChain.filter((_, i) => i !== index);
    setRuleChain(newChain);
    // useEffect 会自动触发预览
  };

  // 移动规则（上移/下移）
  const handleMoveRule = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === ruleChain.length - 1) return;
    
    const newChain = [...ruleChain];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newChain[index], newChain[targetIndex]] = [newChain[targetIndex], newChain[index]];
    setRuleChain(newChain);
    // useEffect 会自动触发预览
  };

  // 更新规则参数
  const handleUpdateRule = (index: number, updatedRule: RenameRule) => {
    const newChain = [...ruleChain];
    newChain[index] = updatedRule;
    setRuleChain(newChain);
    // useEffect 会自动触发预览
  };

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

  // 清空规则链
  const handleClearChain = () => {
    setRuleChain([]);
    // useEffect 会自动清空预览
  };

  const fileColumns = [
    { title: '文件名', dataIndex: 'name', key: 'name' },
    { title: '路径', dataIndex: 'path', key: 'path', ellipsis: true },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => {
        if (size < 1024) return size + ' B';
        if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
        return (size / (1024 * 1024)).toFixed(1) + ' MB';
      },
    },
  ];

  const previewColumns = [
    { title: '原文件名', dataIndex: 'oldName', key: 'oldName' },
    { title: '新文件名', dataIndex: 'newName', key: 'newName' },
  ];

  // 渲染单条规则的参数输入区域
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

      case 'addSuffix':
        return (
          <Input
            placeholder="输入后缀"
            value={rule.params.suffix || ''}
            onChange={(e) => handleUpdateRule(index, { type: rule.type, params: { suffix: e.target.value } })}
            style={{ width: 300 }}
            addonBefore="后缀："
          />
        );

      case 'findReplace':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Input
                placeholder="查找文本"
                value={rule.params.search || ''}
                onChange={(e) => handleUpdateRule(index, { type: rule.type, params: { search: e.target.value, replace: rule.params.replace } })}
                style={{ width: 300 }}
                addonBefore="查找："
              />
            </Space>
            <Space>
              <Input
                placeholder="替换为"
                value={rule.params.replace || ''}
                onChange={(e) => handleUpdateRule(index, { type: rule.type, params: { search: rule.params.search, replace: e.target.value } })}
                style={{ width: 300 }}
                addonBefore="替换为："
              />
            </Space>
          </Space>
        );

      case 'insertDate':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <span style={{ minWidth: '80px' }}>位置：</span>
              <Select
                value={rule.params.position || 'prefix'}
                onChange={(value) => handleUpdateRule(index, { type: rule.type, params: { ...rule.params, position: value } })}
                options={[
                  { value: 'prefix', label: '前面（日期在前）' },
                  { value: 'suffix', label: '后面（日期在后）' }
                ]}
                style={{ width: 200 }}
              />
            </Space>
            <Space>
              <span style={{ minWidth: '80px' }}>格式：</span>
              <Input
                placeholder="日期格式"
                value={rule.params.format || ''}
                onChange={(e) => handleUpdateRule(index, { type: rule.type, params: { ...rule.params, format: e.target.value } })}
                style={{ width: 300 }}
                addonBefore="格式："
              />
            </Space>
            <Space style={{ fontSize: '12px', color: token.colorTextTertiary, flexWrap: 'wrap' }}>
              <span>示例：yyyyMMdd → 20250130</span>
              <span>yyyy-MM-dd → 2025-01-30</span>
              <span>yyyy 年 MM 月 dd 日 → 2025 年 01 月 30 日</span>
            </Space>
          </Space>
        );

      case 'sequence':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap>
              <Space>
                <span style={{ minWidth: '80px' }}>起始数字：</span>
                <InputNumber
                  value={rule.params.start || 1}
                  onChange={(value) => handleUpdateRule(index, { type: rule.type, params: { ...rule.params, start: value || 1 } })}
                  style={{ width: 100 }}
                  min={0}
                />
              </Space>
              <Space>
                <span style={{ minWidth: '50px' }}>步长：</span>
                <InputNumber
                  value={rule.params.step || 1}
                  onChange={(value) => handleUpdateRule(index, { type: rule.type, params: { ...rule.params, step: value || 1 } })}
                  style={{ width: 80 }}
                  min={1}
                />
              </Space>
              <Space>
                <span style={{ minWidth: '50px' }}>位数：</span>
                <InputNumber
                  value={rule.params.digits || 3}
                  onChange={(value) => handleUpdateRule(index, { type: rule.type, params: { ...rule.params, digits: value || 3 } })}
                  style={{ width: 80 }}
                  min={1}
                  max={10}
                />
              </Space>
              <Space>
                <span style={{ minWidth: '50px' }}>位置：</span>
                <Select
                  value={rule.params.position || 'prefix'}
                  onChange={(value) => handleUpdateRule(index, { type: rule.type, params: { ...rule.params, position: value } })}
                  options={[
                    { value: 'prefix', label: '前面' },
                    { value: 'suffix', label: '后面' }
                  ]}
                  style={{ width: 120 }}
                />
              </Space>
            </Space>
            <Space style={{ fontSize: '12px', color: token.colorTextTertiary, flexWrap: 'wrap' }}>
              <span>示例：起始=1, 步长=1, 位数=3 → 001, 002, 003...</span>
              <span>起始=10, 步长=5, 位数=2 → 10, 15, 20...</span>
            </Space>
          </Space>
        );

      default:
        return null;
    }
  };

  const tabItems = [
    {
      key: 'rename',
      label: '批量重命名',
      children: (
        <>
          {/* 规则链配置卡片 */}
          <Card 
            title="重命名规则链" 
            style={{ marginBottom: 16, boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}
            extra={
              <Space>
                <Button onClick={handleClearChain} size="small" danger disabled={ruleChain.length === 0}>
                  清空规则链
                </Button>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* 添加规则按钮 */}
              <Space wrap>
                <span style={{ fontWeight: 600 }}>添加规则：</span>
                <Button icon={<PlusOutlined />} onClick={() => handleAddRule('addPrefix')} size="small">
                  添加前缀
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => handleAddRule('addSuffix')} size="small">
                  添加后缀
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => handleAddRule('findReplace')} size="small">
                  查找替换
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => handleAddRule('insertDate')} size="small">
                  插入日期
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => handleAddRule('sequence')} size="small">
                  添加序号
                </Button>
              </Space>

              {/* 规则列表 */}
              {ruleChain.length > 0 && (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {ruleChain.map((rule, index) => (
                    <Card
                      key={index}
                      size="small"
                      style={{ 
                        background: token.colorBgContainer,
                        border: `1px solid ${token.colorBorder}`,
                        borderLeft: `4px solid ${token.colorPrimary}`,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)'
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
                            options={[
                              { value: 'addPrefix', label: '添加前缀' },
                              { value: 'addSuffix', label: '添加后缀' },
                              { value: 'findReplace', label: '查找替换' },
                              { value: 'insertDate', label: '插入日期' },
                              { value: 'sequence', label: '添加序号' }
                            ]}
                            style={{ width: 150 }}
                            size="small"
                          />
                        </Space>
                      }
                      extra={
                        <Space>
                          <Button
                            icon={<ArrowUpOutlined />}
                            onClick={() => handleMoveRule(index, 'up')}
                            disabled={index === 0}
                            size="small"
                            title="上移"
                          />
                          <Button
                            icon={<ArrowDownOutlined />}
                            onClick={() => handleMoveRule(index, 'down')}
                            disabled={index === ruleChain.length - 1}
                            size="small"
                            title="下移"
                          />
                          <Button
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteRule(index)}
                            size="small"
                            danger
                            title="删除"
                          />
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

              {ruleChain.length === 0 && (
                <div className="ff-empty-state">
                  <p style={{ margin: 0 }}>暂无规则，请点击上方按钮添加规则</p>
                  <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
                    规则将按添加顺序依次执行，可以通过上下箭头调整顺序
                  </p>
                </div>
              )}

              {/* 预览按钮 */}
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space style={{ justifyContent: 'space-between' }}>
                  <div style={{ color: token.colorPrimary, fontSize: '12px' }}>
                    {ruleChain.length > 0 && files.length > 0 ? (
                      <span>✨ 实时预览已启用 - 修改规则后自动更新</span>
                    ) : (
                      <span style={{ color: token.colorTextTertiary }}>添加规则并选择文件夹后自动预览</span>
                    )}
                  </div>
                  <Button onClick={handlePreview} disabled={ruleChain.length === 0} title="立即刷新预览">
                    刷新预览
                  </Button>
                </Space>
              </Space>
            </Space>
          </Card>

          {/* 预览结果 */}
          {previewList.length > 0 && (
            <>
              <Table
                dataSource={previewList}
                columns={previewColumns}
                rowKey="oldPath"
                pagination={{ pageSize: 10 }}
                style={{ marginBottom: 16 }}
              />
              <Space style={{ marginBottom: 16 }}>
                <Button type="primary" danger onClick={async () => {
                  if (!window.fileAPI.renameFiles) {
                    message.error('重命名功能未加载，请重启应用');
                    return;
                  }
                  setLoading(true);
                  const ops = previewList.map(item => ({
                    oldPath: item.oldPath,
                    newPath: item.newPath,
                  }));
                  const res = await window.fileAPI.renameFiles(ops);
                  if (res.success) {
                    message.success('重命名成功！');
                    setPreviewList([]);
                    // 重新扫描文件夹刷新列表
                    if (files.length > 0) {
                      const folderPath = files[0].path.substring(0, files[0].path.lastIndexOf(files[0].name));
                      const scanRes = await window.fileAPI.scanFiles(folderPath);
                      if (scanRes.success && scanRes.data) setFiles(scanRes.data);
                    }
                  } else {
                    message.error('重命名失败：' + res.error);
                  }
                  setLoading(false);
                }} loading={loading}>
                  执行重命名
                </Button>
                <Button onClick={async () => {
                  const res = await window.fileAPI.undoRename();
                  if (res.success) {
                    message.success('已撤销');
                    setPreviewList([]);
                    if (files.length > 0) {
                      const folderPath = files[0].path.substring(0, files[0].path.lastIndexOf(files[0].name));
                      const scanRes = await window.fileAPI.scanFiles(folderPath);
                      if (scanRes.success && scanRes.data) setFiles(scanRes.data);
                    }
                  } else {
                    message.error(res.error || '撤销失败');
                  }
                }}>
                  撤销
                </Button>
              </Space>
            </>
          )}
        </>
      ),
    },
    {
      key: 'convert',
      label: '格式转换',
      children: (
        <Card title="格式转换器" style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)' }}>
          <FormatConverter />
        </Card>
      ),
    },
    {
      key: 'workflow',
      label: '🚀 智能工作流',
      children: (
        <WorkflowPanel files={files} onFilesChange={setFiles} />
      ),
    },
  ];

  return (
    <ConfigProvider theme={{
      token: {
        colorPrimary: '#4f46e5',
        colorSuccess: '#10b981',
        colorError: '#ef4444',
        colorText: '#1a1a2e',
        colorTextSecondary: '#6b7280',
        colorTextTertiary: '#9ca3af',
        colorTextHeading: '#1a1a2e',
        colorBgContainer: '#ffffff',
        colorBgLayout: '#f8f9fa',
        colorBorder: '#e5e7eb',
        colorBorderSecondary: '#f0f0f0',
        borderRadius: 8,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      components: {
        Button: {
          borderRadius: 8,
          borderRadiusLG: 8,
          borderRadiusSM: 8,
        },
        Card: {
          borderRadiusLG: 8,
        },
        Table: {
          borderRadius: 8,
          headerBg: '#f8f9fa',
          rowHoverBg: '#f3f4f6',
        },
        Input: {
          borderRadius: 8,
          borderRadiusLG: 8,
          borderRadiusSM: 8,
          activeBorderColor: '#4f46e5',
          activeShadow: '0 0 0 2px rgba(79, 70, 229, 0.1)',
        },
        Select: {
          borderRadius: 8,
          borderRadiusLG: 8,
          borderRadiusSM: 8,
        },
      },
    }}>
      <div style={{ padding: 24, minHeight: '100vh', background: token.colorBgLayout }}>
        <h1 style={{ color: token.colorTextHeading }}>FileFlow - 智能文件处理中心</h1>
        
        {/* 选择文件夹按钮 */}
        <Space style={{ marginBottom: 24 }}>
          <Button type="primary" onClick={handleSelectAndScan} loading={loading} size="large">
            选择文件夹并扫描
          </Button>
        </Space>

        {/* 标签页 */}
        <Tabs items={tabItems} defaultActiveKey="rename" size="large" />

        {/* 文件列表 */}
        {files.length > 0 && (
          <Table
            dataSource={files}
            columns={fileColumns}
            rowKey="path"
            pagination={{ pageSize: 10 }}
            style={{ marginTop: 16 }}
          />
        )}
      </div>
    </ConfigProvider>
  );
}

export default App;
