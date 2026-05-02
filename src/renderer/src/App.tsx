import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import { Button, Table, Input, Card, message, Space, Select, InputNumber, ConfigProvider, theme, Modal, Switch, Radio, Slider, Collapse, Checkbox, Progress, Tag, Typography, Tooltip, Breadcrumb, Spin, Descriptions, Row, Col, Alert } from 'antd';
import { DeleteOutlined, PlusOutlined, ArrowUpOutlined, ArrowDownOutlined, SyncOutlined, ScanOutlined, FolderOpenOutlined, FileTextOutlined, ExportOutlined, KeyOutlined, CloudOutlined, SettingOutlined, SaveOutlined, EditOutlined, SwapOutlined, FolderOutlined, ThunderboltOutlined, CopyOutlined, ExperimentOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { generateNewNames, RenameRule, RenameRuleType } from './utils/renameEngine';
import { classifyFiles, ClassifyRule, ClassifyResult } from './utils/classifyEngine';
import WorkflowPanel from './components/WorkflowPanel';
import CustomTitleBar from './components/CustomTitleBar';
import Sidebar from './components/Sidebar';
import StatusBar from './components/StatusBar';
import SettingsDrawer from './components/SettingsDrawer';
import './i18n';
import './assets/theme.css';

const LanShare = lazy(() => import('./components/LanShare'));

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

function TextThemeWrapper({ children }: { children: React.ReactNode }) {
  const { token } = theme.useToken();
  return (
    <div style={{ color: token.colorText, lineHeight: 1.57 }}>
      {children}
    </div>
  );
}

function FormatConverter({ t }: { t: (key: string, params?: Record<string, any>) => string }) {
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
        message.success(t('convert.convertSuccess', { success: successCount, fail: failCount > 0 ? t('convert.failSuffix', { count: failCount }) : '' }));
      } else {
        message.error(t('convert.convertFailed'));
      }
    } catch (err) {
      message.error(t('convert.convertError', { error: String(err) }));
    } finally {
      setConverting(false);
      setProgress(null);
    }
  };

  const handleConvertSingle = async () => {
    if (!sourceType) {
      message.warning(t('convert.selectFileFirst'));
      return;
    }
    if (!targetType) {
      message.warning(t('convert.selectTargetFirst'));
      return;
    }

    const extensions = CONVERSION_MATRIX[sourceType]?.[0]?.extensions || ['*'];
    const fileRes = await window.fileAPI.selectFile(extensions);
    if (!fileRes.success || !fileRes.path) {
      message.info(t('convert.noFileSelected'));
      return;
    }

    doConvert([fileRes.path]);
  };

  const handleConvertMultiple = async () => {
    if (!sourceType) {
      message.warning(t('convert.selectFileFirst'));
      return;
    }
    if (!targetType) {
      message.warning(t('convert.selectTargetFirst'));
      return;
    }

    const extensions = CONVERSION_MATRIX[sourceType]?.[0]?.extensions || ['*'];
    const fileRes = await window.fileAPI.selectFiles(extensions);
    if (!fileRes.success || !fileRes.filePaths || fileRes.filePaths.length === 0) {
      message.info(t('convert.noFileSelected'));
      return;
    }

    doConvert(fileRes.filePaths);
  };

  return (
    <Space direction="vertical" style={{ width: '100%' }} size="middle">
      <Space wrap>
        <Space>
          <span style={{ color: token.colorText }}>{t('convert.sourceFormat')}：</span>
          <Select
            value={sourceType || undefined}
            onChange={(val) => {
              setSourceType(val);
              setTargetType('');
            }}
            options={SOURCE_FORMATS}
            style={{ width: 180 }}
            placeholder={t('convert.sourceFormat')}
          />
        </Space>
        <Space>
          <span style={{ color: token.colorText }}>{t('convert.targetFormat')}：</span>
          <Select
            value={targetType || undefined}
            onChange={setTargetType}
            options={targetOptions.map((opt) => ({ value: opt.target, label: opt.label }))}
            style={{ width: 180 }}
            placeholder={t('convert.targetFormat')}
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
            {converting ? t('convert.converting', { current: progress?.current, total: progress?.total }) : t('convert.selectSingle')}
          </Button>
          <Button
            type="primary"
            onClick={handleConvertMultiple}
            loading={converting}
            disabled={!sourceType || !targetType}
          >
            {converting ? t('convert.converting', { current: progress?.current, total: progress?.total }) : t('convert.selectMultiple')}
          </Button>
        </Space>
      </Space>
      {progress && converting && (
        <div style={{ color: token.colorTextSecondary, fontSize: '12px' }}>
          {t('convert.processing', { current: progress.current, total: progress.total })}
        </div>
      )}
      <div style={{ color: token.colorTextSecondary, fontSize: '12px' }}>
        <p style={{ margin: 0 }}>
          {t('convert.supportedFormats')}
        </p>
        <p style={{ margin: '4px 0 0' }}>
          {t('convert.outputHint')}
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
    case 'regexReplace':
      return { type: 'regexReplace', params: { search: '', replace: '' } };
  }
};

function App() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<FileInfo[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewList, setPreviewList] = useState<PreviewItem[]>([]);
  
  const [ruleChain, setRuleChain] = useState<RenameRule[]>([]);
  
  const [classifyRules, setClassifyRules] = useState<ClassifyRule[]>([]);
  const [classifyPreview, setClassifyPreview] = useState<ClassifyResult[]>([]);
  
  const [skipConfirm, setSkipConfirm] = useState(() => {
    const saved = localStorage.getItem('fileflow-skip-confirm');
    return saved === 'true';
  });

  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('fileflow-dark-mode');
    return saved === 'true';
  });

  useEffect(() => {
    localStorage.setItem('fileflow-dark-mode', String(darkMode));
    if (darkMode) {
      document.documentElement.classList.remove('light');
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }, [darkMode]);

  const [lang, setLang] = useState(() => {
    const saved = localStorage.getItem('fileflow-lang') || 'zh';
    return saved;
  });
  
  const previewTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  const { token } = theme.useToken();

  const handleToggleSkipConfirm = (checked: boolean) => {
    setSkipConfirm(checked);
    localStorage.setItem('fileflow-skip-confirm', String(checked));
  };

  const handleToggleDarkMode = (checked: boolean) => {
    setDarkMode(checked);
    localStorage.setItem('fileflow-dark-mode', String(checked));
  };

  const handleToggleLang = (checked: boolean) => {
    const newLang = checked ? 'en' : 'zh';
    setLang(newLang);
    localStorage.setItem('fileflow-lang', newLang);
    import('./i18n').then(({ default: i18n }) => i18n.changeLanguage(newLang));
  };

  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const [dedupMode, setDedupMode] = useState<'exact' | 'similar'>('exact');
  const [dedupThreshold, setDedupThreshold] = useState(90);
  const [dedupGroups, setDedupGroups] = useState<{ hash?: string; similarity?: number; files: { path: string; name: string; size: number; mtime: string }[] }[]>([]);
  const [dedupChecked, setDedupChecked] = useState<Map<number, Set<number>>>(new Map());
  const [scanningDedup, setScanningDedup] = useState(false);

  const [_ocrLanguage, _setOcrLanguage] = useState<'eng' | 'chi_sim' | 'chi_sim+eng'>('chi_sim+eng');
  const [ocrSelectedFile, setOcrSelectedFile] = useState<string | null>(null);
  const [ocrText, setOcrText] = useState('');
  const [ocrConfidence, setOcrConfidence] = useState(0);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrStatus, setOcrStatus] = useState('');
  const [ocrExtracting, setOcrExtracting] = useState(false);
  const [ocrAiClassifying, setOcrAiClassifying] = useState(false);
  const [ocrAiResult, setOcrAiResult] = useState<{ category: string; rawResponse: string } | null>(null);
  const [paddleOCRStatus, setPaddleOCRStatus] = useState<'starting' | 'running' | 'stopped' | 'failed'>('starting');
  const [paddleOCRErrorLogPath, setPaddleOCRErrorLogPath] = useState<string>('');
  const [ocrFiles, setOcrFiles] = useState<{ path: string; name: string; text: string; originalText: string; confidence: number; edited: boolean }[]>([]);
  const [ocrMultiExtracting, setOcrMultiExtracting] = useState(false);
  const [ocrSaving, setOcrSaving] = useState(false);
  const [useHybridOCR, setUseHybridOCR] = useState(() => localStorage.getItem('fileflow-hybrid-ocr') === 'true');
  const [hybridResult, setHybridResult] = useState<{ paddleText: string; paddleConfidence: number; tesseractText: string; tesseractConfidence: number; consensus: string } | null>(null);
  const [imageDescriptions, setImageDescriptions] = useState<Record<string, string>>({});
  const [describingImages, setDescribingImages] = useState<Set<string>>(new Set());
  const [showAiDescription, _setShowAiDescription] = useState(() => localStorage.getItem('fileflow-show-ai-desc') === 'true');

  const [classifyMode, setClassifyMode] = useState<'fast' | 'basic' | 'enhanced' | 'cloud' | 'hybrid'>('basic');

  const [contentClassifyResults, setContentClassifyResults] = useState<{ fileName: string; category: string; confidence: number; targetFolder: string; selected: boolean }[]>([]);
  const [contentClassifying, setContentClassifying] = useState(false);
  const [classifyExecResults, setClassifyExecResults] = useState<{ fileName: string; oldPath: string; newPath: string; status: 'moved' | 'skipped'; reason?: string }[]>([]);

  const [ollamaRunning, setOllamaRunning] = useState<boolean | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModel, setOllamaModel] = useState('qwen2.5:1.5b');
  const [ollamaClassifying, setOllamaClassifying] = useState(false);
  const [ollamaResult, setOllamaResult] = useState<{ category: string; confidence: number; reasoning: string } | null>(null);
  const [showAISettings, setShowAISettings] = useState(false);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState('rename');
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ path: string; name: string; score: number; reason: string }[]>([]);
  const [searching, setSearching] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [_searchOpen, _setSearchOpen] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim() || files.length === 0) return;
    setSearching(true);
    try {
      const aiEndpoint = localStorage.getItem('fileflow-ai-endpoint') || 'http://localhost:11434';
      const aiModel = localStorage.getItem('fileflow-ai-model') || 'qwen2.5:1.5b';
      const aiProvider = (localStorage.getItem('fileflow-ai-provider') || 'ollama') as 'ollama' | 'openai';
      const aiApiKey = localStorage.getItem('fileflow-ai-api-key') || '';

      const res = await window.fileAPI.searchFiles({
        files: files.map(f => ({ path: f.path, name: f.name, size: f.size, mtime: f.mtime })),
        query: searchQuery,
        provider: aiProvider,
        apiKey: aiApiKey,
        model: aiModel,
        endpoint: aiEndpoint,
      });

      if (res.success && res.results) {
        setSearchResults(res.results);
      } else {
        message.error(res.error || t('search.failed'));
      }
    } catch (err: any) {
      message.error(err?.message || t('search.failed'));
    } finally {
      setSearching(false);
    }
  };

  const handleDescribeImage = async (filePath: string) => {
    if (imageDescriptions[filePath]) return;
    setDescribingImages(prev => new Set(prev).add(filePath));
    try {
      const aiEndpoint = localStorage.getItem('fileflow-ai-endpoint') || 'http://localhost:11434';
      const aiModel = localStorage.getItem('fileflow-ai-model') || 'llava:7b';
      const aiProvider = (localStorage.getItem('fileflow-ai-provider') || 'ollama') as 'ollama' | 'openai';
      const aiApiKey = localStorage.getItem('fileflow-ai-api-key') || '';

      const res = await window.fileAPI.describeImage({
        imagePath: filePath,
        provider: aiProvider,
        apiKey: aiApiKey,
        model: aiModel,
        endpoint: aiEndpoint,
      });

      if (res.success && res.description) {
        setImageDescriptions(prev => ({ ...prev, [filePath]: res.description! }));
      } else {
        message.error(res.error || t('fileList.aiDescFailed'));
      }
    } catch (err: any) {
      message.error(err?.message || t('fileList.aiDescFailed'));
    } finally {
      setDescribingImages(prev => {
        const next = new Set(prev);
        next.delete(filePath);
        return next;
      });
    }
  };

  const [apiProvider, setApiProvider] = useState<'openai' | 'deepseek'>('openai');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [apiClassifying, setApiClassifying] = useState(false);
  const [apiResult, setApiResult] = useState<{ category: string; confidence: number; reasoning: string } | null>(null);
  const [folderCreateModalOpen, setFolderCreateModalOpen] = useState(false);
  const [pendingFolders, setPendingFolders] = useState<{ dir: string; count: number; checked: boolean }[]>([]);
  const [folderCreateResolve, setFolderCreateResolve] = useState<((dirs: string[]) => void) | null>(null);

  const showUpdateDialog = (version: string, currentVersion: string) => {
    Modal.confirm({
      title: t('update.updateAvailable', { version }),
      content: t('update.updateDetail', { currentVersion }),
      okText: t('update.downloadNow'),
      cancelText: t('update.remindLater'),
      onOk: () => {
        window.open('https://github.com/fantuan9234/file-flow/releases/latest', '_blank');
      },
      onCancel: () => {
        const today = new Date().toISOString().split('T')[0];
        localStorage.setItem('fileflow-last-update-check', today);
      },
    });
  };

  const handleCheckForUpdates = async (skipTodayCheck = false) => {
    if (!skipTodayCheck) {
      setCheckingUpdate(true);
    }
    try {
      const res = await window.fileAPI.checkForUpdates();
      if (!res.success) {
        if (res.error === 'Development mode' && !skipTodayCheck) {
          message.info(t('update.devMode'));
        }
      } else if (res.available) {
        showUpdateDialog(res.version!, res.currentVersion!);
      } else if (!skipTodayCheck) {
        message.success(t('update.noUpdateAvailable'));
      }
    } catch (err) {
      if (!skipTodayCheck) {
        message.error(t('update.updateError', { error: String(err) }));
      }
    } finally {
      if (!skipTodayCheck) {
        setCheckingUpdate(false);
      }
    }
  };

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    const lastCheck = localStorage.getItem('fileflow-last-update-check');
    if (lastCheck !== today) {
      const timer = setTimeout(() => {
        handleCheckForUpdates(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleScanDuplicates = async () => {
    if (files.length === 0) {
      message.warning(t('dedup.selectFolderFirst'));
      return;
    }
    setScanningDedup(true);
    try {
      let result;
      if (dedupMode === 'exact') {
        result = await window.fileAPI.findExactDuplicates(files);
      } else {
        result = await window.fileAPI.findSimilarDuplicates(files, dedupThreshold / 100);
      }
      if (result.success && result.groups) {
        setDedupGroups(result.groups);
        const initialChecked = new Map<number, Set<number>>();
        result.groups.forEach((group, groupIndex) => {
          const checkedIndices = new Set<number>();
          let oldestIndex = 0;
          let oldestTime = new Date(group.files[0].mtime).getTime();
          group.files.forEach((file, fileIndex) => {
            const fileTime = new Date(file.mtime).getTime();
            if (fileTime < oldestTime) {
              oldestTime = fileTime;
              oldestIndex = fileIndex;
            }
          });
          checkedIndices.add(oldestIndex);
          initialChecked.set(groupIndex, checkedIndices);
        });
        setDedupChecked(initialChecked);
        if (result.groups.length === 0) {
          message.success(t('dedup.noDuplicates'));
        } else {
          message.success(t('dedup.foundDuplicates', { count: result.totalDuplicates }));
        }
      } else {
        message.error(t('dedup.scanFailed', { error: result.error }));
      }
    } catch (err) {
      message.error(t('dedup.scanFailed', { error: String(err) }));
    } finally {
      setScanningDedup(false);
    }
  };

  const handleToggleDedupCheck = (groupIndex: number, fileIndex: number) => {
    const newChecked = new Map(dedupChecked);
    const groupChecks = newChecked.get(groupIndex) || new Set();
    if (groupChecks.has(fileIndex)) {
      groupChecks.delete(fileIndex);
    } else {
      groupChecks.add(fileIndex);
    }
    newChecked.set(groupIndex, groupChecks);
    setDedupChecked(newChecked);
  };

  const handleDeleteSelected = async (groupIndex: number) => {
    const group = dedupGroups[groupIndex];
    const checked = dedupChecked.get(groupIndex) || new Set();
    const filesToDelete = group.files.filter((_, i) => checked.has(i));
    if (filesToDelete.length === 0) {
      message.warning(t('dedup.noFilesSelected'));
      return;
    }
    Modal.confirm({
      title: t('dedup.confirmDeleteTitle'),
      content: t('dedup.confirmDeleteContent', { count: filesToDelete.length }),
      okText: t('dedup.confirmOk'),
      cancelText: t('dedup.confirmCancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          const result = await window.fileAPI.deleteFiles(filesToDelete.map(f => f.path));
          if (result.success) {
            message.success(t('dedup.deleteSuccess', { count: filesToDelete.length }));
            const newGroups = [...dedupGroups];
            newGroups.splice(groupIndex, 1);
            setDedupGroups(newGroups);
            const newChecked = new Map(dedupChecked);
            newChecked.delete(groupIndex);
            setDedupChecked(newChecked);
          } else {
            message.error(t('dedup.deleteFailed', { error: result.error }));
          }
        } catch (err) {
          message.error(t('dedup.deleteFailed', { error: String(err) }));
        }
      },
    });
  };

  const handleMoveSelected = async (groupIndex: number) => {
    const group = dedupGroups[groupIndex];
    const checked = dedupChecked.get(groupIndex) || new Set();
    const filesToMove = group.files.filter((_, i) => checked.has(i));
    if (filesToMove.length === 0) {
      message.warning(t('dedup.noFilesSelected'));
      return;
    }
    Modal.confirm({
      title: t('dedup.confirmMoveTitle'),
      content: t('dedup.confirmMoveContent', { count: filesToMove.length }),
      okText: t('dedup.confirmOk'),
      cancelText: t('dedup.confirmCancel'),
      onOk: async () => {
        try {
          const folderRes = await window.fileAPI.selectFolder();
          if (!folderRes.success) {
            return;
          }
          const result = await window.fileAPI.moveFiles(filesToMove.map(f => f.path), folderRes.path!);
          if (result.success) {
            message.success(t('dedup.moveSuccess', { count: filesToMove.length }));
            const newGroups = [...dedupGroups];
            newGroups.splice(groupIndex, 1);
            setDedupGroups(newGroups);
            const newChecked = new Map(dedupChecked);
            newChecked.delete(groupIndex);
            setDedupChecked(newChecked);
          } else {
            message.error(t('dedup.moveFailed', { error: result.error }));
          }
        } catch (err) {
          message.error(t('dedup.moveFailed', { error: String(err) }));
        }
      },
    });
  };

  const handleSkipGroup = (groupIndex: number) => {
    const newGroups = [...dedupGroups];
    newGroups.splice(groupIndex, 1);
    setDedupGroups(newGroups);
    const newChecked = new Map(dedupChecked);
    newChecked.delete(groupIndex);
    setDedupChecked(newChecked);
    message.info(t('dedup.skipped'));
  };

  const handleSelectOCRFile = async () => {
    const result = await window.fileAPI.selectFile(['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'webp']);
    if (result.success && result.path) {
      setOcrSelectedFile(result.path);
      setOcrText('');
      setOcrConfidence(0);
      setOcrProgress(0);
    }
  };

  const handleExtractText = async () => {
    if (!ocrSelectedFile) {
      message.warning(t('ocr.selectFileFirst'));
      return;
    }
    if (paddleOCRStatus !== 'running' && !useHybridOCR) {
      message.warning(t('ocr.serviceUnavailableHint'));
      return;
    }
    setOcrExtracting(true);
    setOcrProgress(0);
    setOcrText('');
    setOcrStatus('');
    setHybridResult(null);
    try {
      if (useHybridOCR) {
        console.log('[HybridOCR] Starting hybrid extraction for:', ocrSelectedFile);
        const result = await window.fileAPI.hybridExtractText(ocrSelectedFile, 'chi_sim+eng');

        if (!result.success) {
          throw new Error(result.error || 'Hybrid OCR failed');
        }

        setOcrText(result.text || '');
        setOcrConfidence(result.confidence || 0);
        setHybridResult({
          paddleText: result.paddleText || '',
          paddleConfidence: result.paddleConfidence || 0,
          tesseractText: result.tesseractText || '',
          tesseractConfidence: result.tesseractConfidence || 0,
          consensus: result.consensus || 'low',
        });

        if (!result.text) {
          message.warning(t('ocr.noTextDetected'));
        } else {
          const consensusLabel = result.consensus === 'high' ? t('ocr.consensusHigh') : result.consensus === 'low' ? t('ocr.consensusLow') : t('ocr.singleEngine');
          message.success(`${t('ocr.extractSuccess')} (${consensusLabel})`);
          console.log('[HybridOCR] Extracted', result.text.length, 'chars, confidence:', (result.confidence || 0).toFixed(1), 'consensus:', result.consensus);
        }
      } else {
        console.log('[PaddleOCR] Starting extraction for:', ocrSelectedFile);
        const result = await window.fileAPI.paddleExtractText(ocrSelectedFile);

        if (!result.success) {
          throw new Error(result.error || 'OCR failed');
        }

        if (!result.text) {
          message.warning(t('ocr.noTextDetected'));
          setOcrText('');
          setOcrConfidence(0);
        } else {
          setOcrText(result.text);
          setOcrConfidence(result.confidence || 0);
          message.success(t('ocr.extractSuccess'));
          console.log('[PaddleOCR] Extracted', result.text.length, 'characters with', (result.confidence || 0).toFixed(1), '% confidence');
        }
      }
    } catch (err) {
      const errorMsg = String(err);
      console.error('[OCR] Extraction failed:', errorMsg);
      message.error(t('ocr.extractFailed', { error: errorMsg }));
    } finally {
      setOcrExtracting(false);
      setOcrProgress(100);
      setOcrStatus('');
    }
  };

  const handleExportMarkdown = async () => {
    if (!ocrText) {
      message.warning(t('ocr.noTextToExport'));
      return;
    }
    const paragraphs = ocrText.split(/\n\s*\n/).filter(p => p.trim());
    let md = `# ${t('ocr.extractedText')}\n\n`;
    md += `> ${t('ocr.extractedAt')}: ${new Date().toLocaleString()}\n\n`;
    md += `---\n\n`;
    for (const paragraph of paragraphs) {
      md += `${paragraph.trim()}\n\n`;
    }
    const saveResult = await window.fileAPI.saveDialog('extracted-text.md');
    if (saveResult.success && saveResult.filePath) {
      const writeResult = await window.fileAPI.writeFile(saveResult.filePath, md);
      if (writeResult.success) {
        message.success(t('ocr.exportSuccess'));
      } else {
        message.error(t('ocr.exportFailed', { error: writeResult.error }));
      }
    }
  };

  const handleOcrAiClassify = async () => {
    if (!ocrText) {
      message.warning(t('ocr.noTextToClassify'));
      return;
    }
    setOcrAiClassifying(true);
    setOcrAiResult(null);
    try {
      const result = await window.fileAPI.aiClassify(ocrText);
      if (result.success) {
        setOcrAiResult({ category: result.category || 'other', rawResponse: result.rawResponse || '' });
        message.success(t('ocr.aiClassifySuccess'));
      } else {
        message.error(t('ocr.aiClassifyFailed', { error: result.error || '' }));
      }
    } catch (err) {
      message.error(t('ocr.aiClassifyFailed', { error: String(err) }));
    } finally {
      setOcrAiClassifying(false);
    }
  };

  const handleSelectMultipleOCRFiles = async () => {
    const result = await window.fileAPI.selectFiles(['png', 'jpg', 'jpeg', 'bmp', 'tiff', 'webp']);
    if (result.success && result.filePaths && result.filePaths.length > 0) {
      const newFiles = result.filePaths.map(fp => ({
        path: fp,
        name: fp.split(/[\\/]/).pop() || fp,
        text: '',
        originalText: '',
        confidence: 0,
        edited: false,
      }));
      setOcrFiles(newFiles);
      setOcrText('');
      setOcrSelectedFile(null);
    }
  };

  const handleExtractMultipleFiles = async () => {
    if (ocrFiles.length === 0) {
      message.warning(t('ocr.selectFilesFirst'));
      return;
    }
    if (paddleOCRStatus !== 'running') {
      message.warning(t('ocr.serviceUnavailableHint'));
      return;
    }
    setOcrMultiExtracting(true);
    try {
      const updatedFiles = [...ocrFiles];
      for (let i = 0; i < updatedFiles.length; i++) {
        setOcrProgress(Math.round(((i) / updatedFiles.length) * 100));
        setOcrStatus(t('ocr.extractingFile', { current: i + 1, total: updatedFiles.length }));
        try {
          const result = await window.fileAPI.paddleExtractText(updatedFiles[i].path);
          if (result.success && result.text) {
            updatedFiles[i] = {
              ...updatedFiles[i],
              text: result.text,
              originalText: result.text,
              confidence: result.confidence || 0,
            };
          }
        } catch {
          // Continue with next file
        }
      }
      setOcrFiles(updatedFiles);
      setOcrProgress(100);
      setOcrStatus('');
      message.success(t('ocr.multiExtractSuccess', { count: updatedFiles.filter(f => f.text).length }));
    } catch (err) {
      message.error(t('ocr.multiExtractFailed', { error: String(err) }));
    } finally {
      setOcrMultiExtracting(false);
      setOcrStatus('');
    }
  };

  const handleOcrTextChange = (index: number, newText: string) => {
    setOcrFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, text: newText, edited: newText !== f.originalText } : f
    ));
  };

  const handleSaveSingleFile = async (index: number) => {
    const file = ocrFiles[index];
    if (!file) return;
    setOcrSaving(true);
    try {
      const savePath = file.path.replace(/\.[^.]+$/, '_ocr.txt');
      const result = await window.fileAPI.writeFile(savePath, file.text);
      if (result.success) {
        message.success(t('ocr.saveSuccess'));
        setOcrFiles(prev => prev.map((f, i) =>
          i === index ? { ...f, originalText: f.text, edited: false } : f
        ));
      } else {
        message.error(t('ocr.saveFailed', { error: result.error || '' }));
      }
    } catch (err) {
      message.error(t('ocr.saveFailed', { error: String(err) }));
    } finally {
      setOcrSaving(false);
    }
  };

  const handleRestoreSingleFile = (index: number) => {
    setOcrFiles(prev => prev.map((f, i) =>
      i === index ? { ...f, text: f.originalText, edited: false } : f
    ));
    message.info(t('ocr.restored'));
  };

  const handleSaveAllFiles = async () => {
    const editedFiles = ocrFiles.filter(f => f.edited);
    if (editedFiles.length === 0) {
      message.info(t('ocr.noChangesToSave'));
      return;
    }
    setOcrSaving(true);
    let successCount = 0;
    let failCount = 0;
    try {
      for (const file of editedFiles) {
        const savePath = file.path.replace(/\.[^.]+$/, '_ocr.txt');
        const result = await window.fileAPI.writeFile(savePath, file.text);
        if (result.success) {
          successCount++;
        } else {
          failCount++;
        }
      }
      setOcrFiles(prev => prev.map(f => f.edited ? { ...f, originalText: f.text, edited: false } : f));
      if (failCount === 0) {
        message.success(t('ocr.saveAllSuccess', { count: successCount }));
      } else {
        message.warning(t('ocr.saveAllPartial', { success: successCount, fail: failCount }));
      }
    } catch (err) {
      message.error(t('ocr.saveFailed', { error: String(err) }));
    } finally {
      setOcrSaving(false);
    }
  };

  const hasUnsavedChanges = ocrFiles.some(f => f.edited);

  const handleTabChange = (key: string) => {
    setActiveTab(key);
    if (key !== 'ocr' && hasUnsavedChanges) {
      Modal.confirm({
        title: t('ocr.unsavedChangesTitle'),
        content: t('ocr.unsavedChangesContent'),
        okText: t('ocr.saveBeforeClose'),
        cancelText: t('ocr.cancelClose'),
        onOk: async () => {
          await handleSaveAllFiles();
        },
        onCancel: () => {
          setOcrFiles(prev => prev.map(f => f.edited ? { ...f, originalText: f.text, edited: false } : f));
        },
      });
    }
  };

  const handleClassifyContent = async () => {
    if (!ocrText) {
      message.warning(t('classify.noContentToClassify'));
      return;
    }
    if (classifyMode === 'basic' || classifyMode === 'hybrid') {
      try {
        const result = await window.fileAPI.classifyContent(ocrText);
        if (result.success) {
          message.success(t('classify.classifySuccess', { category: result.category }));
        }
      } catch (err) {
        message.error(t('classify.classifyFailed', { error: String(err) }));
      }
    } else if (classifyMode === 'enhanced') {
      if (ollamaRunning === false) {
        message.error(t('ai.ollamaNotRunning'));
        return;
      }
      setOllamaClassifying(true);
      try {
        const result = await window.fileAPI.ollamaClassify(ocrText, ollamaModel);
        if (result.success) {
          setOllamaResult({ category: result.category || 'other', confidence: result.confidence || 0, reasoning: result.reasoning || '' });
          message.success(t('classify.classifySuccess', { category: result.category }));
        } else {
          message.error(t('classify.classifyFailed', { error: result.error }));
        }
      } catch (err) {
        message.error(t('classify.classifyFailed', { error: String(err) }));
      } finally {
        setOllamaClassifying(false);
      }
    } else if (classifyMode === 'cloud') {
      await handleAPIClassify();
    } else {
      message.info(t('classify.modeNotImplemented'));
    }
  };

  const checkOllamaStatus = async () => {
    try {
      const status = await window.fileAPI.ollamaCheckStatus();
      setOllamaRunning(status.running);
      if (status.running && status.models) {
        setOllamaModels(status.models);
        if (status.models.length > 0 && !status.models.includes(ollamaModel)) {
          setOllamaModel(status.models[0]);
        }
      }
    } catch {
      setOllamaRunning(false);
    }
  };

  const handleSaveAIModel = () => {
    try {
      localStorage.setItem('ollama-config', JSON.stringify({ model: ollamaModel, baseUrl: 'http://localhost:11434' }));
      message.success(t('ai.modelSaved'));
    } catch {
      message.error(t('ai.modelSaveFailed'));
    }
  };

  const loadAPIKey = async () => {
    try {
      const result = await window.fileAPI.apiKeyGet();
      if (result.success && result.key) {
        setApiKey(result.key);
        setApiKeyConfigured(true);
      }
    } catch {
      // Ignore
    }
  };

  const handleSaveAPIKey = async () => {
    try {
      const result = await window.fileAPI.apiKeySave(apiKey);
      if (result.success) {
        setApiKeyConfigured(!!apiKey);
        message.success(t('ai.apiKeySaved'));
      } else {
        message.error(t('ai.apiKeySaveFailed', { error: result.error }));
      }
    } catch (err) {
      message.error(t('ai.apiKeySaveFailed', { error: String(err) }));
    }
  };

  const handleAPIClassify = async () => {
    if (!ocrText) {
      message.warning(t('classify.noContentToClassify'));
      return;
    }
    if (!apiKeyConfigured) {
      message.error(t('ai.apiKeyNotSet'));
      return;
    }
    setApiClassifying(true);
    try {
      const { classifyWithAPI } = await import('./utils/apiClassifier');
      const result = await classifyWithAPI(ocrText, { provider: apiProvider, apiKey, model: '' });
      if (result.success) {
        setApiResult({ category: result.category, confidence: result.confidence, reasoning: result.reasoning || '' });
        message.success(t('classify.classifySuccess', { category: result.category }));
      } else {
        message.error(t('classify.classifyFailed', { error: result.error }));
      }
    } catch (err) {
      message.error(t('classify.classifyFailed', { error: String(err) }));
    } finally {
      setApiClassifying(false);
    }
  };

  const handleContentClassify = async () => {
    const filesToClassify = selectedFiles.length > 0 ? selectedFiles : files;
    if (filesToClassify.length === 0) {
      message.warning(t('app.selectFilesFirst'));
      return;
    }

    setContentClassifying(true);
    setContentClassifyResults([]);
    const results: { fileName: string; category: string; confidence: number; targetFolder: string; selected: boolean }[] = [];

    try {
      for (const file of filesToClassify) {
        let category = 'other';
        let confidence = 0;

        if (classifyMode === 'fast') {
          const ext = file.name.split('.').pop()?.toLowerCase() || '';
          const extMap: Record<string, string> = {
            pdf: 'documents', doc: 'documents', docx: 'documents',
            jpg: 'images', jpeg: 'images', png: 'images', gif: 'images', webp: 'images',
            mp3: 'audio', wav: 'audio', flac: 'audio',
            mp4: 'videos', avi: 'videos', mkv: 'videos',
            zip: 'archives', rar: 'archives', '7z': 'archives',
          };
          category = extMap[ext] || 'other';
          confidence = 0.8;
        } else if (classifyMode === 'basic' || classifyMode === 'hybrid') {
          const readResult = await window.fileAPI.readFile(file.path);
          if (readResult.success && readResult.data) {
            const classifyResult = await window.fileAPI.classifyContent(readResult.data);
            if (classifyResult.success) {
              category = classifyResult.category || 'other';
              confidence = classifyResult.confidence || 0;
            }
          }

          if (classifyMode === 'hybrid' && confidence < 0.5) {
            const imgResult = await window.fileAPI.extractText(file.path, 'chi_sim+eng');
            if (imgResult.success && imgResult.text) {
              const imgClassify = await window.fileAPI.classifyContent(imgResult.text);
              if (imgClassify.success && (imgClassify.confidence || 0) > confidence) {
                category = imgClassify.category || category;
                confidence = imgClassify.confidence || confidence;
              }
            }
          }
        } else if (classifyMode === 'enhanced') {
          const readResult = await window.fileAPI.readFile(file.path);
          if (readResult.success && readResult.data) {
            const aiResult = await window.fileAPI.aiClassify(readResult.data);
            if (aiResult.success) {
              category = aiResult.category || 'other';
              confidence = 0.85;
            } else {
              message.error(t('ai.classifyFailed', { error: aiResult.error || '' }));
              setContentClassifying(false);
              return;
            }
          }
        } else if (classifyMode === 'cloud') {
          if (!apiKeyConfigured) {
            message.error(t('ai.apiKeyNotSet'));
            setContentClassifying(false);
            return;
          }
          const readResult = await window.fileAPI.readFile(file.path);
          if (readResult.success && readResult.data) {
            const { classifyWithAPI } = await import('./utils/apiClassifier');
            const apiResult = await classifyWithAPI(readResult.data, { provider: apiProvider, apiKey, model: '' });
            if (apiResult.success) {
              category = apiResult.category || 'other';
              confidence = apiResult.confidence || 0;
            }
          }
        }

        const targetFolder = category === 'other' ? 'other' : category;
        results.push({
          fileName: file.name,
          category,
          confidence,
          targetFolder,
          selected: true,
        });
      }

      setContentClassifyResults(results);
      message.success(t('classify.contentClassifySuccess', { count: results.length }));
    } catch (err) {
      message.error(t('classify.classifyFailed', { error: String(err) }));
    } finally {
      setContentClassifying(false);
    }
  };

  const handleExecuteContentClassify = async () => {
    const selected = contentClassifyResults.filter(r => r.selected);
    if (selected.length === 0) {
      message.warning(t('classify.noFilesSelected'));
      return;
    }

    const doClassify = async () => {
      setLoading(true);
      try {
        const folderPath = files.length > 0 ? window.fileAPI.path.dirname(files[0].path) : '';
        const ops = selected.map(r => ({
          oldPath: window.fileAPI.path.join(folderPath, r.fileName),
          newPath: window.fileAPI.path.join(folderPath, r.targetFolder, r.fileName),
        }));
        const res = await window.fileAPI.classifyFiles(ops);
        if (res.success) {
          const execResults = (res as any).results || [];
          const movedCount = execResults.filter((r: any) => r.status === 'moved').length;
          const skippedCount = execResults.filter((r: any) => r.status === 'skipped').length;
          const targetFolders = [...new Set(selected.map(r => r.targetFolder))];
          const targetPaths = targetFolders.map(tf => window.fileAPI.path.join(folderPath, tf));
          if (skippedCount > 0) {
            message.warning(t('classify.classifyPartialSuccess', { moved: movedCount, skipped: skippedCount, paths: targetPaths.join(', ') }));
          } else {
            message.success(t('classify.executeContentClassifySuccess', { count: movedCount, paths: targetPaths.join(', ') }));
          }
          const resultsWithNames = execResults.map((r: any) => ({
            fileName: window.fileAPI.path.basename(r.oldPath),
            oldPath: r.oldPath,
            newPath: r.newPath,
            status: r.status as 'moved' | 'skipped',
            reason: r.reason,
          }));
          setClassifyExecResults(resultsWithNames);
          setContentClassifyResults([]);
          if (files.length > 0) {
            const scanRes = await window.fileAPI.scanFiles(folderPath);
            if (scanRes.success && scanRes.data) {
              setFiles(scanRes.data);
              setSelectedFiles(scanRes.data);
            }
          }
        } else {
          message.error(t('classify.classifyFailed', { error: res.error }));
        }
      } catch (err) {
        message.error(t('classify.classifyFailed', { error: String(err) }));
      } finally {
        setLoading(false);
      }
    };

    if (skipConfirm) {
      doClassify();
    } else {
      Modal.confirm({
        title: t('classify.executeContentClassifyTitle'),
        content: t('classify.executeContentClassifyContent', { count: selected.length }),
        okText: t('classify.confirmOk'),
        cancelText: t('classify.confirmCancel'),
        okButtonProps: { type: 'primary' },
        onOk: doClassify,
      });
    }
  };

  const toggleContentClassifyResult = (index: number) => {
    const newResults = [...contentClassifyResults];
    newResults[index].selected = !newResults[index].selected;
    setContentClassifyResults(newResults);
  };

  useEffect(() => {
    checkOllamaStatus();
    loadAPIKey();
  }, []);

  const scanFolder = async (folderPath: string) => {
    setLoading(true);
    try {
      const scanRes = await window.fileAPI.scanFiles(folderPath);
      if (scanRes.success && scanRes.data) {
        setFiles(scanRes.data);
        setSelectedFiles(scanRes.data); // 默认全选
        setPreviewList([]);
        message.success(t('app.scanSuccess', { count: scanRes.data.length }));
      } else {
        message.error(t('app.scanFailed', { error: scanRes.error }));
      }
    } catch (err) {
      message.error(t('app.errorPrefix', { error: String(err) }));
    } finally {
      setLoading(false);
    }
  };

  // 选择文件夹并扫描
  const handleSelectAndScan = async () => {
    try {
      const folderRes = await window.fileAPI.selectFolder();
      if (!folderRes.success || !folderRes.path) {
        message.info(t('app.noFolderSelected'));
        return;
      }
      setSelectedFolder(folderRes.path);
      await scanFolder(folderRes.path);
    } catch (err) {
      message.error(t('app.errorPrefix', { error: String(err) }));
    }
  };

  // 自动预览函数（带防抖）
  const autoPreview = () => {
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    
    previewTimerRef.current = setTimeout(() => {
      if (selectedFiles.length === 0 || ruleChain.length === 0) {
        setPreviewList([]);
        return;
      }
      
      for (let i = 0; i < ruleChain.length; i++) {
        const rule = ruleChain[i];
        if (rule.type === 'findReplace' && !rule.params?.search) {
          setPreviewList([]);
          return;
        }
        if (rule.type === 'insertDate' && !rule.params?.format) {
          setPreviewList([]);
          return;
        }
      }
      
      const preview = generateNewNames(selectedFiles, ruleChain);
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
  }, [ruleChain, files, selectedFiles]);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const result = await window.fileAPI.getPaddleOCRStatus();
        setPaddleOCRStatus(result.status);
        if (result.errorLogPath) {
          setPaddleOCRErrorLogPath(result.errorLogPath);
        }
      } catch {
        setPaddleOCRStatus('failed');
      }
    };
    checkStatus();

    const interval = setInterval(checkStatus, 10000);

    const removeStatusListener = window.fileAPI.onPaddleOCRStatusChange((data) => {
      setPaddleOCRStatus(data.status as 'starting' | 'running' | 'stopped' | 'failed');
      if (data.errorLogPath) {
        setPaddleOCRErrorLogPath(data.errorLogPath);
      }
    });

    const removeFolderListener = window.fileAPI.onAskCreateFolder((folders) => {
      setPendingFolders(folders.map(f => ({ ...f, checked: true })));
      setFolderCreateModalOpen(true);
    });

    return () => {
      clearInterval(interval);
      removeStatusListener();
      removeFolderListener();
    };
  }, []);

  const handleFolderCreateConfirm = () => {
    const selectedDirs = pendingFolders.filter(f => f.checked).map(f => f.dir);
    window.fileAPI.sendCreateFolderResponse(selectedDirs);
    setFolderCreateModalOpen(false);
    setPendingFolders([]);
    if (folderCreateResolve) {
      folderCreateResolve(selectedDirs);
      setFolderCreateResolve(null);
    }
  };

  const handleFolderCreateCancel = () => {
    window.fileAPI.sendCreateFolderResponse([]);
    setFolderCreateModalOpen(false);
    setPendingFolders([]);
    if (folderCreateResolve) {
      folderCreateResolve([]);
      setFolderCreateResolve(null);
    }
  };

  const handleToggleAllFolders = () => {
    const allChecked = pendingFolders.every(f => f.checked);
    setPendingFolders(prev => prev.map(f => ({ ...f, checked: !allChecked })));
  };

  const handleOpenPaddleOCRLog = async () => {
    try {
      await window.fileAPI.openPaddleOCRLog();
    } catch {
      message.error(t('ocr.logOpenFailed'));
    }
  };

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
    if (selectedFiles.length === 0) {
      message.warning(t('app.selectFilesFirst'));
      return;
    }

    if (ruleChain.length === 0) {
      message.warning(t('rename.addRuleFirst'));
      return;
    }

    // 验证规则参数
    for (let i = 0; i < ruleChain.length; i++) {
      const rule = ruleChain[i];
      if (rule.type === 'findReplace' && !rule.params?.search) {
        message.warning(t('rename.enterSearchText', { index: i + 1 }));
        return;
      }
      if (rule.type === 'insertDate' && !rule.params?.format) {
        message.warning(t('rename.enterDateFormat', { index: i + 1 }));
        return;
      }
    }

    // 立即生成预览（清除防抖定时器）
    if (previewTimerRef.current) {
      clearTimeout(previewTimerRef.current);
    }
    
    const preview = generateNewNames(selectedFiles, ruleChain);
    setPreviewList(preview);
    
    if (preview.length > 0) {
      message.success(t('rename.previewGenerated', { count: preview.length, rules: ruleChain.length }));
    } else {
      message.info(t('rename.noFilesToRename'));
    }
  };

  // 清空规则链
  const handleClearChain = () => {
    setRuleChain([]);
  };

  const classifyRuleTypes: { value: ClassifyRule['type']; label: string }[] = [
    { value: 'byExtension', label: t('classify.byExtension') },
    { value: 'byKeyword', label: t('classify.byKeyword') },
    { value: 'bySize', label: t('classify.bySize') },
    { value: 'byDate', label: t('classify.byDate') },
  ];

  const createClassifyRule = (type: ClassifyRule['type'] = 'byExtension'): ClassifyRule => {
    switch (type) {
      case 'byExtension':
        return { type, params: { extension: 'pdf' }, targetFolder: '' };
      case 'byKeyword':
        return { type, params: { keyword: '' }, targetFolder: '' };
      case 'bySize':
        return { type, params: { maxSize: 10485760 }, targetFolder: '' };
      case 'byDate':
        return { type, params: { days: 7, dateMode: 'older' }, targetFolder: '' };
    }
  };

  const handleAddClassifyRule = (type: ClassifyRule['type']) => {
    setClassifyRules([...classifyRules, createClassifyRule(type)]);
  };

  const handleDeleteClassifyRule = (index: number) => {
    setClassifyRules(classifyRules.filter((_, i) => i !== index));
  };

  const handleUpdateClassifyRule = (index: number, updated: ClassifyRule) => {
    const newRules = [...classifyRules];
    newRules[index] = updated;
    setClassifyRules(newRules);
  };

  const handleClassifyPreview = () => {
    if (selectedFiles.length === 0) {
      message.warning(t('app.selectFilesFirst'));
      return;
    }
    if (classifyRules.length === 0) {
      message.warning(t('classify.addRuleFirst'));
      return;
    }
    for (const rule of classifyRules) {
      if (!rule.targetFolder) {
        message.warning(t('classify.setTargetFolder'));
        return;
      }
    }
    const folderPath = selectedFiles.length > 0 ? selectedFiles[0].path.substring(0, selectedFiles[0].path.lastIndexOf(selectedFiles[0].name)) : '';
    const result = classifyFiles(selectedFiles, classifyRules, folderPath);
    setClassifyPreview(result);
    if (result.length > 0) {
      message.success(t('classify.previewSuccess', { count: result.length }));
    } else {
      message.info(t('classify.noMatchedFiles'));
    }
  };

  const handleExecuteClassify = async () => {
    if (classifyPreview.length === 0) {
      message.warning(t('classify.executeClassify'));
      return;
    }

    const doClassify = async () => {
      setLoading(true);
      const ops = classifyPreview.map(item => ({ oldPath: item.oldPath, newPath: item.newPath }));
      const res = await window.fileAPI.classifyFiles(ops);
      setLoading(false);
      if (res.success) {
        const execResults = (res as any).results || [];
        const movedCount = execResults.filter((r: any) => r.status === 'moved').length;
        const skippedCount = execResults.filter((r: any) => r.status === 'skipped').length;
        const targetFolders = [...new Set(classifyPreview.map(item => window.fileAPI.path.dirname(item.newPath)))];
        if (skippedCount > 0) {
          message.warning(t('classify.classifyPartialSuccess', { moved: movedCount, skipped: skippedCount, paths: targetFolders.join(', ') }));
        } else {
          message.success(t('classify.classifySuccess', { count: movedCount, paths: targetFolders.join(', ') }));
        }
        const resultsWithNames = execResults.map((r: any) => ({
          fileName: window.fileAPI.path.basename(r.oldPath),
          oldPath: r.oldPath,
          newPath: r.newPath,
          status: r.status as 'moved' | 'skipped',
          reason: r.reason,
        }));
        setClassifyExecResults(resultsWithNames);
        setClassifyPreview([]);
        if (files.length > 0) {
          const folderPath = window.fileAPI.path.dirname(files[0].path);
          const scanRes = await window.fileAPI.scanFiles(folderPath);
          if (scanRes.success && scanRes.data) {
            setFiles(scanRes.data);
            setSelectedFiles(scanRes.data);
          }
        }
      } else {
        message.error(t('classify.classifyFailed', { error: res.error }));
      }
    };

    if (skipConfirm) {
      doClassify();
    } else {
      Modal.confirm({
        title: t('classify.confirmTitle'),
        content: t('classify.confirmContent', { count: classifyPreview.length }),
        okText: t('classify.confirmOk'),
        cancelText: t('classify.confirmCancel'),
        okButtonProps: { type: 'primary' },
        onOk: doClassify,
      });
    }
  };

  const handleUndoClassify = async () => {
    const res = await window.fileAPI.undoClassify();
    if (res.success) {
      message.success(t('classify.undoSuccess'));
      setClassifyPreview([]);
      if (files.length > 0) {
        const folderPath = files[0].path.substring(0, files[0].path.lastIndexOf(files[0].name));
        const scanRes = await window.fileAPI.scanFiles(folderPath);
        if (scanRes.success && scanRes.data) {
          setFiles(scanRes.data);
          setSelectedFiles(scanRes.data);
        }
      }
    } else {
      message.error(t('classify.undoFailed', { error: res.error }));
    }
  };

  const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg', '.tiff', '.tif', '.ico']);

  const isImageFile = (fileName: string): boolean => {
    const ext = '.' + fileName.split('.').pop()?.toLowerCase();
    return IMAGE_EXTENSIONS.has(ext);
  };

  const getImageSrc = (filePath: string): string => {
    const normalizedPath = filePath.replace(/\\/g, '/');
    return `file:///${normalizedPath}`;
  };

  const renderFileName = (name: string, record: FileInfo) => {
    if (isImageFile(name)) {
      return (
        <Space size={8}>
          <img
            src={getImageSrc(record.path)}
            alt={name}
            style={{
              width: 40,
              height: 40,
              objectFit: 'cover',
              borderRadius: 4,
              flexShrink: 0,
            }}
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                const icon = document.createElement('span');
                icon.innerHTML = `<span class="ocr-preview-fallback-icon"></span>`;
                const firstChild = icon.firstChild as Node | null;
                if (firstChild) {
                  parent.insertBefore(firstChild, target.nextSibling);
                }
              }
            }}
          />
          <span>{name}</span>
        </Space>
      );
    }
    return <span>{name}</span>;
  };

  const fileColumns = [
    { 
      title: t('app.columns.name'), 
      dataIndex: 'name', 
      key: 'name',
      render: (name: string, record: FileInfo) => renderFileName(name, record),
    },
    { title: t('app.columns.path'), dataIndex: 'path', key: 'path', ellipsis: true },
    {
      title: t('app.columns.size'),
      dataIndex: 'size',
      key: 'size',
      render: (size: number) => {
        if (size < 1024) return size + ' B';
        if (size < 1024 * 1024) return (size / 1024).toFixed(1) + ' KB';
        return (size / (1024 * 1024)).toFixed(1) + ' MB';
      },
    },
    ...(showAiDescription ? [{
      title: t('fileList.aiDescription'),
      key: 'aiDescription',
      width: 300,
      render: (_: any, record: FileInfo) => {
        const ext = window.fileAPI.path.extname(record.name).toLowerCase();
        if (!IMAGE_EXTENSIONS.has(ext)) return null;
        
        const desc = imageDescriptions[record.path];
        const isDescribing = describingImages.has(record.path);
        
        if (desc) {
          return (
            <Tooltip title={desc}>
              <Typography.Text
                style={{
                  fontSize: 12,
                  color: token.colorTextSecondary,
                  maxWidth: 280,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  display: 'block',
                }}
              >
                {desc}
              </Typography.Text>
            </Tooltip>
          );
        }
        
        if (isDescribing) {
          return <Spin size="small" />;
        }
        
        return (
          <Button
            size="small"
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleDescribeImage(record.path)}
            style={{ padding: 0 }}
          >
            {t('fileList.generateAiDesc')}
          </Button>
        );
      },
    }] : []),
  ];

  const previewColumns = [
    { title: t('rename.columns.oldName'), dataIndex: 'oldName', key: 'oldName' },
    { title: t('rename.columns.newName'), dataIndex: 'newName', key: 'newName' },
  ];

  // 渲染单条规则的参数输入区域
  const renderRuleParams = (rule: RenameRule, index: number) => {
    const params = rule.params || {};
    switch (rule.type) {
      case 'addPrefix':
        return (
          <Input
            placeholder={t('rename.prefixPlaceholder')}
            value={params.prefix || ''}
            onChange={(e) => handleUpdateRule(index, { type: rule.type, params: { prefix: e.target.value } })}
            style={{ width: 300 }}
            addonBefore={t('rename.prefix') + '：'}
          />
        );

      case 'addSuffix':
        return (
          <Input
            placeholder={t('rename.suffixPlaceholder')}
            value={params.suffix || ''}
            onChange={(e) => handleUpdateRule(index, { type: rule.type, params: { suffix: e.target.value } })}
            style={{ width: 300 }}
            addonBefore={t('rename.suffix') + '：'}
          />
        );

      case 'findReplace':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <Input
                placeholder={t('rename.searchPlaceholder')}
                value={params.search || ''}
                onChange={(e) => handleUpdateRule(index, { type: rule.type, params: { search: e.target.value, replace: params.replace } })}
                style={{ width: 300 }}
                addonBefore={t('rename.search') + '：'}
              />
            </Space>
            <Space>
              <Input
                placeholder={t('rename.replacePlaceholder')}
                value={params.replace || ''}
                onChange={(e) => handleUpdateRule(index, { type: rule.type, params: { search: params.search, replace: e.target.value } })}
                style={{ width: 300 }}
                addonBefore={t('rename.replaceWith') + '：'}
              />
            </Space>
          </Space>
        );

      case 'insertDate':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              <span style={{ minWidth: '80px' }}>{t('rename.position')}：</span>
              <Select
                value={params.position || 'prefix'}
                onChange={(value) => handleUpdateRule(index, { type: rule.type, params: { ...params, position: value } })}
                options={[
                  { value: 'prefix', label: t('rename.datePositionPrefix') },
                  { value: 'suffix', label: t('rename.datePositionSuffix') }
                ]}
                style={{ width: 200 }}
              />
            </Space>
            <Space>
              <span style={{ minWidth: '80px' }}>{t('rename.format')}：</span>
              <Input
                placeholder={t('rename.format')}
                value={params.format || ''}
                onChange={(e) => handleUpdateRule(index, { type: rule.type, params: { ...params, format: e.target.value } })}
                style={{ width: 300 }}
                addonBefore={t('rename.format') + '：'}
              />
            </Space>
            <Space style={{ fontSize: '12px', color: token.colorTextTertiary, flexWrap: 'wrap' }}>
              <Typography.Text type="secondary">{t('rename.exampleFormats')}</Typography.Text>
            </Space>
          </Space>
        );

      case 'sequence':
        return (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space wrap>
              <Space>
                <span style={{ minWidth: '80px' }}>{t('rename.startNumber')}：</span>
                <InputNumber
                  value={params.start || 1}
                  onChange={(value) => handleUpdateRule(index, { type: rule.type, params: { ...params, start: value || 1 } })}
                  style={{ width: 100 }}
                  min={0}
                />
              </Space>
              <Space>
                <span style={{ minWidth: '50px' }}>{t('rename.step')}：</span>
                <InputNumber
                  value={params.step || 1}
                  onChange={(value) => handleUpdateRule(index, { type: rule.type, params: { ...params, step: value || 1 } })}
                  style={{ width: 80 }}
                  min={1}
                />
              </Space>
              <Space>
                <span style={{ minWidth: '50px' }}>{t('rename.digits')}：</span>
                <InputNumber
                  value={params.digits || 3}
                  onChange={(value) => handleUpdateRule(index, { type: rule.type, params: { ...params, digits: value || 3 } })}
                  style={{ width: 80 }}
                  min={1}
                  max={10}
                />
              </Space>
              <Space>
                <span style={{ minWidth: '50px' }}>{t('rename.position')}：</span>
                <Select
                  value={params.position || 'prefix'}
                  onChange={(value) => handleUpdateRule(index, { type: rule.type, params: { ...params, position: value } })}
                  options={[
                    { value: 'prefix', label: t('rename.positionPrefix') },
                    { value: 'suffix', label: t('rename.positionSuffix') }
                  ]}
                  style={{ width: 120 }}
                />
              </Space>
            </Space>
            <Space style={{ fontSize: '12px', color: token.colorTextTertiary, flexWrap: 'wrap' }}>
              <Typography.Text type="secondary">{t('rename.exampleSequence')}</Typography.Text>
            </Space>
          </Space>
        );

      default:
        return null;
    }
  };

  const renderEmptyGuide = () => {
    const moduleInfo = {
      rename: {
        icon: <EditOutlined style={{ fontSize: 48, color: token.colorPrimary }} />,
        title: t('rename.emptyGuideTitle'),
        description: t('rename.emptyGuideDesc'),
      },
      convert: {
        icon: <SwapOutlined style={{ fontSize: 48, color: token.colorPrimary }} />,
        title: t('convert.emptyGuideTitle'),
        description: t('convert.emptyGuideDesc'),
      },
      classify: {
        icon: <FolderOutlined style={{ fontSize: 48, color: token.colorPrimary }} />,
        title: t('classify.emptyGuideTitle'),
        description: t('classify.emptyGuideDesc'),
      },
      workflow: {
        icon: <ThunderboltOutlined style={{ fontSize: 48, color: token.colorPrimary }} />,
        title: t('workflow.emptyGuideTitle'),
        description: t('workflow.emptyGuideDesc'),
      },
      ocr: {
        icon: <ScanOutlined style={{ fontSize: 48, color: token.colorPrimary }} />,
        title: t('ocr.emptyGuideTitle'),
        description: t('ocr.emptyGuideDesc'),
      },
      dedup: {
        icon: <CopyOutlined style={{ fontSize: 48, color: token.colorPrimary }} />,
        title: t('dedup.emptyGuideTitle'),
        description: t('dedup.emptyGuideDesc'),
      },
    };

    const info = moduleInfo[activeTab as keyof typeof moduleInfo] || {
      icon: <FolderOpenOutlined style={{ fontSize: 48, color: token.colorPrimary }} />,
      title: t('app.noFolderSelected'),
      description: t('app.selectFolderGuide'),
    };

    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <div style={{ marginBottom: 16 }}>{info.icon}</div>
        <Typography.Title level={4} style={{ marginBottom: 8 }}>
          {info.title}
        </Typography.Title>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
          {info.description}
        </Typography.Text>
        <Button type="primary" size="large" onClick={handleSelectAndScan}>
          {t('app.selectFolder')}
        </Button>
      </div>
    );
  };

  const renderContent = () => {
    if (activeTab === 'lan') {
      return (
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spin size="large" /></div>}>
          <LanShare />
        </Suspense>
      );
    }

    if (files.length === 0) {
      return renderEmptyGuide();
    }

    const tabItem = tabItems.find(item => item.key === activeTab);
    return tabItem?.children || null;
  };

  const tabItems = [
    {
      key: 'rename',
      label: t('tabs.rename'),
      children: (
        <>
          {/* 规则链配置卡片 */}
          <Card 
            title={t('rename.ruleChainTitle')} 
            style={{ marginBottom: 16 }}
            extra={
              <Space>
                <Button onClick={handleClearChain} size="small" danger disabled={ruleChain.length === 0}>
                  {t('rename.clearRules')}
                </Button>
              </Space>
            }
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              {/* 添加规则按钮 */}
              <Space wrap>
                <span style={{ fontWeight: 600 }}>{t('rename.addRule')}：</span>
                <Button icon={<PlusOutlined />} onClick={() => handleAddRule('addPrefix')} size="small">
                  {t('rename.addPrefix')}
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => handleAddRule('addSuffix')} size="small">
                  {t('rename.addSuffix')}
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => handleAddRule('findReplace')} size="small">
                  {t('rename.findReplace')}
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => handleAddRule('insertDate')} size="small">
                  {t('rename.insertDate')}
                </Button>
                <Button icon={<PlusOutlined />} onClick={() => handleAddRule('sequence')} size="small">
                  {t('rename.addSequence')}
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
                      }}
                      title={
                        <Space>
                          <span style={{ fontWeight: 600 }}>{t('classify.rule')} {index + 1}</span>
                          <Select
                            value={rule.type}
                            onChange={(value) => {
                              const newRule = createRule(value);
                              handleUpdateRule(index, newRule);
                            }}
                            options={[
                              { value: 'addPrefix', label: t('rename.addPrefix') },
                              { value: 'addSuffix', label: t('rename.addSuffix') },
                              { value: 'findReplace', label: t('rename.findReplace') },
                              { value: 'insertDate', label: t('rename.insertDate') },
                              { value: 'sequence', label: t('rename.addSequence') }
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
                            title={t('common.moveUp')}
                          />
                          <Button
                            icon={<ArrowDownOutlined />}
                            onClick={() => handleMoveRule(index, 'down')}
                            disabled={index === ruleChain.length - 1}
                            size="small"
                            title={t('common.moveDown')}
                          />
                          <Button
                            icon={<DeleteOutlined />}
                            onClick={() => handleDeleteRule(index)}
                            size="small"
                            danger
                            title={t('common.delete')}
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
                  <p style={{ margin: 0 }}>{t('rename.noRules')}</p>
                  <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
                    {t('rename.ruleOrderHint')}
                  </p>
                </div>
              )}

              {/* 预览按钮 */}
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space style={{ justifyContent: 'space-between' }}>
                  <div style={{ color: token.colorPrimary, fontSize: '12px' }}>
                    {ruleChain.length > 0 && files.length > 0 ? (
                      <Typography.Text>{t('rename.livePreview')}</Typography.Text>
                    ) : (
                      <Typography.Text type="secondary">{t('rename.autoPreviewHint')}</Typography.Text>
                    )}
                  </div>
                  <Button onClick={handlePreview} disabled={ruleChain.length === 0} title={t('rename.refreshPreview')}>
                    {t('rename.refreshPreview')}
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
                <Button type="primary" danger onClick={() => {
                  if (selectedFiles.length === 0) {
                    message.warning(t('app.selectFilesFirst'));
                    return;
                  }
                  const doRename = async () => {
                    if (!window.fileAPI.renameFiles) {
                      message.error(t('rename.featureNotLoaded'));
                      return;
                    }
                    setLoading(true);
                    const ops = previewList.map(item => ({
                      oldPath: item.oldPath,
                      newPath: item.newPath,
                    }));
                    const res = await window.fileAPI.renameFiles(ops);
                    if (res.success) {
                      message.success(t('rename.renameSuccess', { count: previewList.length }));
                      setPreviewList([]);
                      if (files.length > 0) {
                        const folderPath = files[0].path.substring(0, files[0].path.lastIndexOf(files[0].name));
                        const scanRes = await window.fileAPI.scanFiles(folderPath);
                        if (scanRes.success && scanRes.data) {
                          setFiles(scanRes.data);
                          setSelectedFiles(scanRes.data);
                        }
                      }
                    } else {
                      message.error(t('rename.renameFailed', { error: res.error }));
                    }
                    setLoading(false);
                  };

                  if (skipConfirm) {
                    doRename();
                  } else {
                    Modal.confirm({
                      title: t('rename.confirmTitle'),
                      content: t('rename.confirmContent', { count: previewList.length }),
                      okText: t('rename.confirmOk'),
                      cancelText: t('rename.confirmCancel'),
                      okButtonProps: { type: 'primary' },
                      onOk: doRename,
                    });
                  }
                }} loading={loading}>
                  {t('rename.executeRename')}
                </Button>
                <Button onClick={async () => {
                  const res = await window.fileAPI.undoRename();
                  if (res.success) {
                    message.success(t('rename.undoSuccess'));
                    setPreviewList([]);
                    if (files.length > 0) {
                      const folderPath = files[0].path.substring(0, files[0].path.lastIndexOf(files[0].name));
                      const scanRes = await window.fileAPI.scanFiles(folderPath);
                      if (scanRes.success && scanRes.data) {
                        setFiles(scanRes.data);
                        setSelectedFiles(scanRes.data);
                      }
                    }
                  } else {
                    message.error(t('rename.undoFailed', { error: res.error }));
                  }
                }} disabled={loading}>
                  {t('rename.undo')}
                </Button>
              </Space>
            </>
          )}
        </>
      ),
    },
    {
      key: 'convert',
      label: t('tabs.convert'),
      children: (
        <Card 
          title={t('convert.title')}
          style={{ background: token.colorBgContainer, borderColor: token.colorBorder }}
        >
          <FormatConverter t={t} />
        </Card>
      ),
    },
    {
      key: 'classify',
      label: t('tabs.classify'),
      children: (
        <>
          <Card
            size="small"
            style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Space wrap>
                <Typography.Text strong>{t('classify.classifyMode')}:</Typography.Text>
                <Radio.Group value={classifyMode} onChange={(e) => setClassifyMode(e.target.value)}>
                  <Radio.Button value="fast">⚡ {t('classify.modeFast')}</Radio.Button>
                  <Radio.Button value="basic">📋 {t('classify.modeBasic')}</Radio.Button>
                  <Radio.Button value="enhanced">🧠 {t('classify.modeEnhanced')}</Radio.Button>
                  <Radio.Button value="cloud">☁️ {t('classify.modeCloud')}</Radio.Button>
                  <Radio.Button value="hybrid">🔀 {t('classify.modeHybrid')}</Radio.Button>
                </Radio.Group>
              </Space>
            </Space>
          </Card>

          <Card
            title={t('classify.title')}
            style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}
            extra={
              <Button onClick={() => setClassifyRules([])} size="small" danger disabled={classifyRules.length === 0}>
                {t('classify.clearRules')}
              </Button>
            }
          >
            {(classifyMode === 'basic' || classifyMode === 'hybrid') && ocrText && (
              <Card size="small" style={{ marginBottom: 16, background: token.colorBgLayout }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <FileTextOutlined />
                    <span style={{ fontWeight: 600, color: token.colorText }}>{t('classify.contentAnalysis')}</span>
                  </Space>
                  <Button type="primary" size="small" onClick={handleClassifyContent}>
                    {t('classify.analyzeContent')}
                  </Button>
                </Space>
              </Card>
            )}
            {classifyMode === 'cloud' && (
              <Card size="small" style={{ marginBottom: 16, background: token.colorBgLayout }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <CloudOutlined />
                    <span style={{ fontWeight: 600, color: token.colorText }}>{t('ai.cloudTitle')}</span>
                    <Button type="link" size="small" onClick={() => setShowAISettings(!showAISettings)}>
                      {t('ai.settings')}
                    </Button>
                  </Space>
                  {showAISettings && (
                    <Space direction="vertical" style={{ width: '100%' }}>
                      <Space>
                        <span style={{ color: token.colorText }}>{t('ai.provider')}:</span>
                        <Select
                          value={apiProvider}
                          onChange={setApiProvider}
                          style={{ width: 150 }}
                          options={[
                            { value: 'openai', label: 'OpenAI' },
                            { value: 'deepseek', label: 'DeepSeek' },
                          ]}
                        />
                      </Space>
                      <Space>
                        <KeyOutlined />
                        <Input.Password
                          value={apiKey}
                          onChange={(e) => setApiKey(e.target.value)}
                          style={{ width: 300 }}
                          placeholder={t('ai.apiKeyPlaceholder')}
                        />
                        <Button size="small" onClick={handleSaveAPIKey}>
                          {t('ai.save')}
                        </Button>
                      </Space>
                      {apiKeyConfigured && (
                        <Tag color="green">{t('ai.apiKeyConfigured')}</Tag>
                      )}
                    </Space>
                  )}
                  {!apiKeyConfigured && !showAISettings && (
                    <div style={{ color: token.colorWarning, fontSize: '13px' }}>
                      {t('ai.apiKeyNotSetHint')}
                    </div>
                  )}
                  {apiKeyConfigured && (
                    <Button type="primary" size="small" onClick={handleAPIClassify} loading={apiClassifying} disabled={!ocrText}>
                      {t('ai.analyzeWithCloud')}
                    </Button>
                  )}
                  {apiResult && (
                    <div style={{ padding: '8px 12px', background: token.colorBgContainer, borderRadius: 6, border: `1px solid ${token.colorBorder}` }}>
                      <Space>
                        <Tag color="blue">{t('ai.category')}: {apiResult.category}</Tag>
                        <Tag color="green">{t('ai.confidence')}: {Math.round(apiResult.confidence * 100)}%</Tag>
                      </Space>
                      {apiResult.reasoning && (
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: token.colorTextSecondary }}>
                          {t('ai.reasoning')}: {apiResult.reasoning}
                        </p>
                      )}
                    </div>
                  )}
                </Space>
              </Card>
            )}
            {classifyMode === 'enhanced' && (
              <Card size="small" style={{ marginBottom: 16, background: token.colorBgLayout }}>
                <Space direction="vertical" style={{ width: '100%' }}>
                  <Space>
                    <FileTextOutlined />
                    <span style={{ fontWeight: 600, color: token.colorText }}>{t('ai.title')}</span>
                    <Button type="link" size="small" onClick={() => setShowAISettings(!showAISettings)}>
                      {t('ai.settings')}
                    </Button>
                  </Space>
                  {ollamaRunning === false && (
                    <div style={{ color: token.colorError, fontSize: '13px' }}>
                      <p>{t('ai.ollamaNotRunning')}</p>
                      <p style={{ fontSize: '12px', marginTop: 4 }}>
                        {t('ai.installHint')}
                      </p>
                    </div>
                  )}
                  {ollamaRunning === true && !ollamaModels.includes(ollamaModel) && (
                    <div style={{ color: token.colorWarning, fontSize: '13px' }}>
                      {t('ai.modelNotDownload', { model: ollamaModel })}
                    </div>
                  )}
                  {showAISettings && (
                    <Space>
                      <span style={{ color: token.colorText }}>{t('ai.modelName')}:</span>
                      <Input
                        value={ollamaModel}
                        onChange={(e) => setOllamaModel(e.target.value)}
                        style={{ width: 180 }}
                        placeholder="qwen2.5:1.5b"
                      />
                      <Button size="small" onClick={handleSaveAIModel}>
                        {t('ai.save')}
                      </Button>
                      <Button size="small" onClick={checkOllamaStatus}>
                        {t('ai.refresh')}
                      </Button>
                    </Space>
                  )}
                  {ollamaRunning && (
                    <Button type="primary" size="small" onClick={handleClassifyContent} loading={ollamaClassifying} disabled={!ocrText}>
                      {t('ai.analyzeWithAI')}
                    </Button>
                  )}
                  {ollamaResult && (
                    <div style={{ padding: '8px 12px', background: token.colorBgContainer, borderRadius: 6, border: `1px solid ${token.colorBorder}` }}>
                      <Space>
                        <Tag color="blue">{t('ai.category')}: {ollamaResult.category}</Tag>
                        <Tag color="green">{t('ai.confidence')}: {Math.round(ollamaResult.confidence * 100)}%</Tag>
                      </Space>
                      {ollamaResult.reasoning && (
                        <p style={{ margin: '8px 0 0', fontSize: '12px', color: token.colorTextSecondary }}>
                          {t('ai.reasoning')}: {ollamaResult.reasoning}
                        </p>
                      )}
                    </div>
                  )}
                </Space>
              </Card>
            )}
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Space wrap>
                <span style={{ fontWeight: 600, color: token.colorText }}>{t('classify.addRule')}：</span>
                {classifyRuleTypes.map(rt => (
                  <Button
                    key={rt.value}
                    icon={<PlusOutlined />}
                    onClick={() => handleAddClassifyRule(rt.value)}
                    size="small"
                  >
                    {t(`classify.${rt.value === 'byExtension' ? 'byExtension' : rt.value === 'byKeyword' ? 'byKeyword' : rt.value === 'bySize' ? 'bySize' : 'byDate'}`)}
                  </Button>
                ))}
              </Space>

              {classifyRules.length > 0 && (
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {classifyRules.map((rule, index) => (
                    <Card
                      key={index}
                      size="small"
                      style={{
                        background: token.colorBgContainer,
                        border: `1px solid ${token.colorBorder}`,
                        borderLeft: `4px solid ${token.colorWarning}`,
                      }}
                      title={
                        <Space>
                          <span style={{ fontWeight: 600, color: token.colorText }}>{t('rename.rule')} {index + 1}</span>
                          <Select
                            value={rule.type}
                            onChange={(value) => {
                              handleUpdateClassifyRule(index, createClassifyRule(value));
                            }}
                            options={classifyRuleTypes}
                            style={{ width: 150 }}
                            size="small"
                          />
                        </Space>
                      }
                      extra={
                        <Button
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteClassifyRule(index)}
                          size="small"
                          danger
                          title={t('common.delete')}
                        />
                      }
                    >
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        {rule.type === 'byExtension' && (
                          <Space>
                            <span style={{ color: token.colorText }}>{t('classify.extensions')}：</span>
                            <Input
                              value={rule.params.extension || ''}
                              onChange={(e) => handleUpdateClassifyRule(index, { ...rule, params: { ...rule.params, extension: e.target.value } })}
                              placeholder={t('classify.extensionPlaceholder')}
                              style={{ width: 150 }}
                            />
                          </Space>
                        )}
                        {rule.type === 'byKeyword' && (
                          <Space>
                            <span style={{ color: token.colorText }}>{t('classify.keyword')}：</span>
                            <Input
                              value={rule.params.keyword || ''}
                              onChange={(e) => handleUpdateClassifyRule(index, { ...rule, params: { ...rule.params, keyword: e.target.value } })}
                              placeholder={t('classify.keywordPlaceholder')}
                              style={{ width: 150 }}
                            />
                          </Space>
                        )}
                        {rule.type === 'bySize' && (
                          <Space wrap>
                            <span style={{ color: token.colorText }}>{t('classify.minSize')}：</span>
                            <InputNumber
                              value={rule.params.minSize ? rule.params.minSize / (1024 * 1024) : undefined}
                              onChange={(v) => handleUpdateClassifyRule(index, { ...rule, params: { ...rule.params, minSize: v ? v * 1024 * 1024 : undefined } })}
                              style={{ width: 100 }}
                              min={0}
                              placeholder={t('classify.optional')}
                            />
                            <span style={{ color: token.colorText }}>{t('classify.maxSize')}：</span>
                            <InputNumber
                              value={rule.params.maxSize ? rule.params.maxSize / (1024 * 1024) : undefined}
                              onChange={(v) => handleUpdateClassifyRule(index, { ...rule, params: { ...rule.params, maxSize: v ? v * 1024 * 1024 : undefined } })}
                              style={{ width: 100 }}
                              min={0}
                              placeholder={t('classify.optional')}
                            />
                          </Space>
                        )}
                        {rule.type === 'byDate' && (
                          <Space wrap>
                            <span style={{ color: token.colorText }}>{t('classify.days')}：</span>
                            <InputNumber
                              value={rule.params.days || 7}
                              onChange={(v) => handleUpdateClassifyRule(index, { ...rule, params: { ...rule.params, days: v || 7 } })}
                              style={{ width: 80 }}
                              min={1}
                            />
                            <span style={{ color: token.colorText }}>{t('classify.condition')}：</span>
                            <Select
                              value={rule.params.dateMode || 'older'}
                              onChange={(v) => handleUpdateClassifyRule(index, { ...rule, params: { ...rule.params, dateMode: v } })}
                              options={[
                                { value: 'older', label: t('classify.olderThan') },
                                { value: 'newer', label: t('classify.newerThan') },
                              ]}
                              style={{ width: 100 }}
                              size="small"
                            />
                          </Space>
                        )}
                        <Space>
                          <span style={{ color: token.colorText }}>{t('classify.targetFolder')}：</span>
                          <Input
                            value={rule.targetFolder}
                            onChange={(e) => handleUpdateClassifyRule(index, { ...rule, targetFolder: e.target.value })}
                            placeholder={t('classify.targetFolderPlaceholder')}
                            style={{ width: 150 }}
                          />
                        </Space>
                      </Space>
                    </Card>
                  ))}
                </Space>
              )}

              {classifyRules.length === 0 && (
                <div className="ff-empty-state">
                  <p style={{ margin: 0 }}>{t('classify.noRules')}</p>
                  <p style={{ margin: '8px 0 0', fontSize: '12px' }}>
                    {t('classify.ruleOrderHint')}
                  </p>
                </div>
              )}

              <Space>
                <Button type="primary" onClick={handleClassifyPreview} disabled={classifyRules.length === 0}>
                  {t('classify.preview')}
                </Button>
              </Space>
            </Space>
          </Card>

          {classifyPreview.length > 0 && (
            <>
              <Table
                dataSource={classifyPreview}
                columns={[
                  { title: t('classify.columns.oldPath'), dataIndex: 'oldPath', key: 'oldPath', ellipsis: true },
                  { title: t('classify.columns.newPath'), dataIndex: 'newPath', key: 'newPath', ellipsis: true },
                  { title: t('classify.columns.targetFolder'), dataIndex: 'matchedRule', key: 'matchedRule', width: 120 },
                ]}
                rowKey="oldPath"
                pagination={{ pageSize: 10 }}
                style={{ marginBottom: 16 }}
              />
              <Space>
                <Button type="primary" danger onClick={handleExecuteClassify} loading={loading}>
                  {t('classify.executeClassify')}
                </Button>
                <Button onClick={handleUndoClassify} disabled={loading}>
                  {t('classify.undo')}
                </Button>
              </Space>
            </>
          )}

          {classifyExecResults.length > 0 && (
            <Card
              title={t('classify.executionResults')}
              size="small"
              style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}
            >
              <Table
                dataSource={classifyExecResults}
                columns={[
                  { title: t('classify.columns.fileName'), dataIndex: 'fileName', key: 'fileName', ellipsis: true },
                  {
                    title: t('classify.columns.targetPath'),
                    dataIndex: 'newPath',
                    key: 'newPath',
                    ellipsis: { showTitle: true },
                    render: (path: string, record: any) => (
                      <Tooltip title={path}>
                        <span style={{ color: record.status === 'skipped' ? token.colorError : token.colorText }}>
                          {path}
                        </span>
                      </Tooltip>
                    ),
                  },
                  {
                    title: t('classify.columns.status'),
                    dataIndex: 'status',
                    key: 'status',
                    width: 100,
                    render: (status: string) => (
                      <Tag color={status === 'moved' ? 'success' : 'error'}>
                        {status === 'moved' ? t('classify.statusMoved') : t('classify.statusSkipped')}
                      </Tag>
                    ),
                  },
                  {
                    title: t('classify.columns.reason'),
                    dataIndex: 'reason',
                    key: 'reason',
                    width: 150,
                    ellipsis: { showTitle: true },
                    render: (reason: string) => reason ? <Tooltip title={reason}>{reason}</Tooltip> : '-',
                  },
                ]}
                rowKey={(record) => record.oldPath}
                pagination={{ pageSize: 10 }}
              />
            </Card>
          )}

          <Card
            title={t('classify.contentClassifyTitle')}
            size="small"
            style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Space>
                <Typography.Text type="secondary" style={{ fontSize: '13px' }}>
                  {t('classify.currentMode')}: <Tag color="blue">{t(`classify.mode${classifyMode.charAt(0).toUpperCase() + classifyMode.slice(1)}`)}</Tag>
                </Typography.Text>
              </Space>
              <Space>
                <Button type="primary" icon={<FileTextOutlined />} onClick={handleContentClassify} loading={contentClassifying}>
                  {t('classify.scanAndClassify')}
                </Button>
                <Button danger onClick={handleExecuteContentClassify} disabled={contentClassifyResults.filter(r => r.selected).length === 0}>
                  {t('classify.executeContentClassify')}
                </Button>
              </Space>
              {classifyMode === 'enhanced' && ollamaRunning === false && (
                <div style={{ color: token.colorError, fontSize: '13px' }}>
                  ⚠️ {t('ai.ollamaNotRunning')}
                </div>
              )}
              {classifyMode === 'cloud' && !apiKeyConfigured && (
                <div style={{ color: token.colorWarning, fontSize: '13px' }}>
                  ⚠️ {t('ai.apiKeyNotSetHint')}
                </div>
              )}
            </Space>
          </Card>

          {contentClassifyResults.length > 0 && (
            <Table
              dataSource={contentClassifyResults}
              columns={[
                {
                  title: t('classify.columns.select'),
                  key: 'select',
                  width: 60,
                  render: (_: any, __: any, index: number) => (
                    <input
                      type="checkbox"
                      checked={contentClassifyResults[index].selected}
                      onChange={() => toggleContentClassifyResult(index)}
                    />
                  ),
                },
                { title: t('classify.columns.fileName'), dataIndex: 'fileName', key: 'fileName', ellipsis: true },
                {
                  title: t('classify.columns.category'),
                  dataIndex: 'category',
                  key: 'category',
                  width: 120,
                  render: (cat: string) => <Tag color={cat === 'other' ? 'default' : 'blue'}>{cat}</Tag>,
                },
                {
                  title: t('classify.columns.confidence'),
                  dataIndex: 'confidence',
                  key: 'confidence',
                  width: 100,
                  render: (conf: number) => (
                    <span style={{ color: conf >= 0.7 ? token.colorSuccess : conf >= 0.4 ? token.colorWarning : token.colorError }}>
                      {Math.round(conf * 100)}%
                    </span>
                  ),
                },
                { title: t('classify.columns.targetFolder'), dataIndex: 'targetFolder', key: 'targetFolder', width: 120 },
              ]}
              rowKey="fileName"
              pagination={{ pageSize: 10 }}
              style={{ marginBottom: 16 }}
            />
          )}
        </>
      ),
    },
    {
      key: 'workflow',
      label: t('tabs.workflow'),
      children: (
        <WorkflowPanel files={selectedFiles} allFiles={files} onFilesChange={setFiles} onSelectedFilesChange={setSelectedFiles} skipConfirm={skipConfirm} />
      ),
    },
    {
      key: 'dedup',
      label: t('tabs.dedup'),
      children: (
        <>
          <Card title={t('dedup.title')} size="small" style={{ marginBottom: 16 }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Radio.Group value={dedupMode} onChange={(e) => setDedupMode(e.target.value)}>
                <Radio.Button value="exact">{t('dedup.exactMode')}</Radio.Button>
                <Radio.Button value="similar">{t('dedup.similarMode')}</Radio.Button>
              </Radio.Group>
              {dedupMode === 'similar' && (
                <Space>
                  <Typography.Text>{t('dedup.threshold')}:</Typography.Text>
                  <Slider style={{ width: 200 }} value={dedupThreshold} onChange={setDedupThreshold} min={80} max={99} />
                  <Typography.Text>{dedupThreshold}%</Typography.Text>
                </Space>
              )}
              <Button type="primary" icon={<ScanOutlined />} onClick={handleScanDuplicates} loading={scanningDedup}>
                {t('dedup.scanButton')}
              </Button>
            </Space>
          </Card>
          {dedupGroups.length > 0 && (
            <Collapse
              defaultActiveKey={['0']}
              items={dedupGroups.map((group, groupIndex) => ({
                key: String(groupIndex),
                label: (
                  <span>
                    {group.hash
                      ? `${t('dedup.groupLabel', { index: groupIndex + 1 })} (${t('dedup.md5Match')})`
                      : `${t('dedup.groupLabel', { index: groupIndex + 1 })} (${t('dedup.similarity', { percent: Math.round((group.similarity || 0) * 100) })})`}
                    {' - '}
                    {group.files.length} {t('dedup.files')}
                  </span>
                ),
                children: (
                  <div>
                    {group.files.map((file, fileIndex) => (
                      <div key={file.path} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <Checkbox
                          checked={(dedupChecked.get(groupIndex) || new Set()).has(fileIndex)}
                          onChange={() => handleToggleDedupCheck(groupIndex, fileIndex)}
                          style={{ marginRight: 8 }}
                        />
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                        <span style={{ color: token.colorTextTertiary, fontSize: '12px', marginLeft: 8 }}>
                          {new Date(file.mtime).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                    <Space style={{ marginTop: 12 }}>
                      <Button danger size="small" onClick={() => handleDeleteSelected(groupIndex)}>
                        {t('dedup.deleteSelected')}
                      </Button>
                      <Button icon={<FolderOpenOutlined />} size="small" onClick={() => handleMoveSelected(groupIndex)}>
                        {t('dedup.moveSelected')}
                      </Button>
                      <Button size="small" onClick={() => handleSkipGroup(groupIndex)}>
                        {t('dedup.skipGroup')}
                      </Button>
                    </Space>
                  </div>
                ),
              }))}
            />
          )}
        </>
      ),
    },
    {
      key: 'ocr',
      label: t('tabs.ocr'),
      children: (
        <>
          <Card
            size="small"
            style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}
          >
            <Space>
              <Typography.Text strong>{t('ocr.serviceStatus')}:</Typography.Text>
              {paddleOCRStatus === 'starting' && (
                <Tag color="processing">{t('ocr.serviceStarting')}</Tag>
              )}
              {paddleOCRStatus === 'running' && (
                <Tag color="success">{t('ocr.serviceRunning')}</Tag>
              )}
              {paddleOCRStatus === 'stopped' && (
                <Tag color="default">{t('ocr.serviceStopped')}</Tag>
              )}
              {paddleOCRStatus === 'failed' && (
                <>
                  <Tag color="error">{t('ocr.serviceFailed')}</Tag>
                  <Button size="small" onClick={handleOpenPaddleOCRLog} disabled={!paddleOCRErrorLogPath}>
                    {t('ocr.viewErrorLog')}
                  </Button>
                </>
              )}
              <div style={{ marginLeft: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Switch
                  size="small"
                  checked={useHybridOCR}
                  onChange={(checked) => {
                    setUseHybridOCR(checked);
                    localStorage.setItem('fileflow-hybrid-ocr', String(checked));
                  }}
                />
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{t('ocr.hybridMode')}</Typography.Text>
              </div>
            </Space>
          </Card>

          <Card title={t('ocr.title')} size="small" style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}>
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Space>
                <Button icon={<FolderOpenOutlined />} onClick={handleSelectOCRFile}>
                  {t('ocr.selectFile')}
                </Button>
                <Button type="primary" icon={<FileTextOutlined />} onClick={handleExtractText} loading={ocrExtracting} disabled={!ocrSelectedFile || (paddleOCRStatus !== 'running' && !useHybridOCR)}>
                  {t('ocr.extract')}
                </Button>
                <Button icon={<ExportOutlined />} onClick={handleExportMarkdown} disabled={!ocrText}>
                  {t('ocr.exportMarkdown')}
                </Button>
              </Space>
              <Space>
                <Button icon={<FolderOpenOutlined />} onClick={handleSelectMultipleOCRFiles}>
                  {t('ocr.selectMultipleFiles')}
                </Button>
                <Button type="primary" icon={<FileTextOutlined />} onClick={handleExtractMultipleFiles} loading={ocrMultiExtracting} disabled={ocrFiles.length === 0 || paddleOCRStatus !== 'running'}>
                  {t('ocr.extractAll')}
                </Button>
                {ocrFiles.length > 0 && (
                  <Button icon={<SaveOutlined />} onClick={handleSaveAllFiles} loading={ocrSaving} disabled={!hasUnsavedChanges}>
                    {t('ocr.saveAll')}
                  </Button>
                )}
              </Space>
              {ocrSelectedFile && (
                <div style={{ color: token.colorTextSecondary, fontSize: '12px' }}>
                  {t('ocr.selectedFile')}: {ocrSelectedFile}
                </div>
              )}
              {ocrFiles.length > 0 && (
                <div style={{ color: token.colorTextSecondary, fontSize: '12px' }}>
                  {t('ocr.selectedFilesCount', { count: ocrFiles.length })}
                </div>
              )}
            </Space>
          </Card>

          {ocrExtracting && (
            <Card size="small" style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <span style={{ color: token.colorText }}>{t('ocr.extracting')}...</span>
                  {ocrStatus && <Tag color="processing">{ocrStatus}</Tag>}
                </Space>
                <Progress percent={ocrProgress} status="active" />
              </Space>
            </Card>
          )}

          {ocrMultiExtracting && (
            <Card size="small" style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <span style={{ color: token.colorText }}>{t('ocr.extractingMultiple')}...</span>
                  {ocrStatus && <Tag color="processing">{ocrStatus}</Tag>}
                </Space>
                <Progress percent={ocrProgress} status="active" />
              </Space>
            </Card>
          )}

          {ocrText && (
            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  <span style={{ color: token.colorTextHeading }}>{t('ocr.result')}</span>
                  <Tag color="blue">{t('ocr.confidence')}: {Math.round(ocrConfidence)}%</Tag>
                  {hybridResult && (
                    <Tag color={hybridResult.consensus === 'high' ? 'success' : hybridResult.consensus === 'low' ? 'warning' : 'default'}>
                      {hybridResult.consensus === 'high' ? t('ocr.consensusHigh') : hybridResult.consensus === 'low' ? t('ocr.consensusLow') : t('ocr.singleEngine')}
                    </Tag>
                  )}
                </Space>
              }
              size="small"
              style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}
              extra={
                <Button
                  size="small"
                  type="primary"
                  icon={<CloudOutlined />}
                  onClick={handleOcrAiClassify}
                  loading={ocrAiClassifying}
                  disabled={!ocrText}
                >
                  {t('ocr.aiClassify')}
                </Button>
              }
            >
              <Typography.Paragraph
                style={{
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  color: token.colorText,
                  maxHeight: 400,
                  overflow: 'auto',
                }}
              >
                {ocrText}
              </Typography.Paragraph>
            </Card>
          )}

          {hybridResult && (
            <Card
              title={
                <Space>
                  <ExperimentOutlined />
                  <span style={{ color: token.colorTextHeading }}>{t('ocr.hybridComparison')}</span>
                </Space>
              }
              size="small"
              style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}
            >
              <Descriptions column={2} size="small" bordered>
                <Descriptions.Item label={t('ocr.paddleOCR')}>
                  <Tag color="blue">{t('ocr.confidence')}: {Math.round(hybridResult.paddleConfidence)}%</Tag>
                </Descriptions.Item>
                <Descriptions.Item label={t('ocr.tesseractOCR')}>
                  <Tag color="green">{t('ocr.confidence')}: {Math.round(hybridResult.tesseractConfidence)}%</Tag>
                </Descriptions.Item>
              </Descriptions>
              <Row gutter={16} style={{ marginTop: 12 }}>
                <Col span={12}>
                  <Typography.Text strong>{t('ocr.paddleOCR')}:</Typography.Text>
                  <Typography.Paragraph
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: token.colorTextSecondary,
                      maxHeight: 200,
                      overflow: 'auto',
                      background: token.colorBgLayout,
                      padding: 8,
                      borderRadius: 4,
                      marginTop: 4,
                    }}
                  >
                    {hybridResult.paddleText || t('ocr.noResult')}
                  </Typography.Paragraph>
                </Col>
                <Col span={12}>
                  <Typography.Text strong>{t('ocr.tesseractOCR')}:</Typography.Text>
                  <Typography.Paragraph
                    style={{
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      color: token.colorTextSecondary,
                      maxHeight: 200,
                      overflow: 'auto',
                      background: token.colorBgLayout,
                      padding: 8,
                      borderRadius: 4,
                      marginTop: 4,
                    }}
                  >
                    {hybridResult.tesseractText || t('ocr.noResult')}
                  </Typography.Paragraph>
                </Col>
              </Row>
              {hybridResult.consensus === 'low' && (
                <Alert
                  message={t('ocr.manualReview')}
                  description={t('ocr.manualReviewDesc')}
                  type="warning"
                  showIcon
                  style={{ marginTop: 12 }}
                />
              )}
            </Card>
          )}

          {ocrFiles.length > 0 && ocrFiles.some(f => f.text) && (
            <Card
              title={
                <Space>
                  <FileTextOutlined />
                  <span style={{ color: token.colorTextHeading }}>{t('ocr.multiResults')}</span>
                </Space>
              }
              size="small"
              style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}
            >
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {ocrFiles.filter(f => f.text).map((file) => {
                  const realIndex = ocrFiles.indexOf(file);
                  return (
                    <Card
                      key={realIndex}
                      size="small"
                      title={
                        <Space>
                          <span style={{ fontWeight: 500 }}>{file.name}</span>
                          {file.confidence > 0 && (
                            <Tag color="blue">{t('ocr.confidence')}: {Math.round(file.confidence)}%</Tag>
                          )}
                          {file.edited && (
                            <Tag color="orange">{t('ocr.edited')}</Tag>
                          )}
                        </Space>
                      }
                      extra={
                        <Space>
                          <Button
                            size="small"
                            type="primary"
                            icon={<SaveOutlined />}
                            onClick={() => handleSaveSingleFile(realIndex)}
                            loading={ocrSaving}
                            disabled={!file.edited}
                          >
                            {t('ocr.save')}
                          </Button>
                          <Button
                            size="small"
                            onClick={() => handleRestoreSingleFile(realIndex)}
                            disabled={!file.edited}
                          >
                            {t('ocr.restore')}
                          </Button>
                        </Space>
                      }
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Input.TextArea
                          value={file.text}
                          onChange={(e) => handleOcrTextChange(realIndex, e.target.value)}
                          autoSize={{ minRows: 3, maxRows: 10 }}
                          style={{ fontFamily: 'monospace', fontSize: '13px' }}
                        />
                        <div style={{ textAlign: 'right', color: token.colorTextTertiary, fontSize: '12px' }}>
                          {t('ocr.charCount')}: {file.text.length}
                        </div>
                      </Space>
                    </Card>
                  );
                })}
              </Space>
            </Card>
          )}

          {ocrAiResult && (
            <Card
              title={
                <Space>
                  <CloudOutlined />
                  <span style={{ color: token.colorTextHeading }}>{t('ocr.aiClassifyResult')}</span>
                </Space>
              }
              size="small"
              style={{ marginBottom: 16, background: token.colorBgContainer, borderColor: token.colorBorder }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                <Space>
                  <Tag color="blue">{t('classify.columns.category')}: {ocrAiResult.category}</Tag>
                  <Tag color="green">{t('ocr.aiRawResponse')}: {ocrAiResult.rawResponse}</Tag>
                </Space>
                <Space>
                  <Button
                    type="primary"
                    onClick={() => {
                      if (!ocrSelectedFile) return;
                      const targetDir = ocrAiResult.category === 'other' ? 'other' : ocrAiResult.category;
                      message.info(t('ocr.moveToFolder', { folder: targetDir }));
                    }}
                  >
                    {t('ocr.moveToFolder', { folder: ocrAiResult.category })}
                  </Button>
                </Space>
              </Space>
            </Card>
          )}

          <div style={{ textAlign: 'center', marginTop: 24, color: token.colorTextTertiary, fontSize: '12px' }}>
            {t('ocr.paddleOCRAttribution')}
          </div>
        </>
      ),
    },
    {
      key: 'lan',
      label: t('tabs.lan'),
      children: (
        <LanShare darkMode={darkMode} />
      ),
    },
  ];

  return (
    <ConfigProvider theme={{
      cssVar: { prefix: 'ant', key: 'theme' },
      token: {
        colorPrimary: '#4f46e5',
        colorSuccess: '#10b981',
        colorError: '#ef4444',
        borderRadius: 12,
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      },
      algorithm: darkMode ? theme.darkAlgorithm : theme.defaultAlgorithm,
      components: {
        Button: {
          borderRadius: 8,
          borderRadiusLG: 8,
          borderRadiusSM: 8,
        },
        Card: {
          borderRadiusLG: 12,
        },
        Table: {
          borderRadius: 8,
        },
        Input: {
          borderRadius: 8,
          borderRadiusLG: 8,
          borderRadiusSM: 8,
          activeBorderColor: '#4f46e5',
        },
        Select: {
          borderRadius: 8,
          borderRadiusLG: 8,
          borderRadiusSM: 8,
        },
      },
    }}>
      <CustomTitleBar title="File Flow" />
      <TextThemeWrapper>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', paddingTop: 32 }}>
          <Sidebar
            activeTab={activeTab}
            onTabChange={handleTabChange}
            collapsed={sidebarCollapsed}
            onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
            t={t}
          />
          
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div className="ff-header" style={{ padding: '0 24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h1 style={{ color: darkMode ? 'rgba(255, 255, 255, 0.85)' : '#1a1a2e', margin: 0, fontSize: 20, fontWeight: 600 }}>
                  {t('app.title')}
                </h1>
                <Space size="middle">
                  <Input.Search
                    placeholder={t('search.placeholder') || 'AI semantic search...'}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onSearch={handleSearch}
                    loading={searching}
                    allowClear
                    style={{ width: 300 }}
                    size="small"
                    prefix={<span style={{ fontSize: 12, marginRight: 4 }}>AI</span>}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<SyncOutlined spin={checkingUpdate} />}
                    onClick={() => handleCheckForUpdates()}
                    loading={checkingUpdate}
                    title={t('update.checkForUpdates')}
                  />
                  <Button
                    type="text"
                    size="small"
                    icon={<SettingOutlined />}
                    onClick={() => setShowSettingsModal(true)}
                    title={t('settings.title')}
                  />
                </Space>
              </div>
            </div>

            {searchResults.length > 0 && (
              <div style={{ padding: '0 24px', marginBottom: 16 }}>
                <Card size="small" title={`AI Search Results (${searchResults.length})`} extra={<Button type="link" size="small" onClick={() => { setSearchResults([]); setSearchQuery(''); }}>Clear</Button>}>
                  <Table
                    size="small"
                    dataSource={searchResults}
                    rowKey="path"
                    pagination={false}
                    columns={[
                      { title: 'File', dataIndex: 'name', key: 'name', width: 200, ellipsis: true },
                      { title: 'Relevance', dataIndex: 'score', key: 'score', width: 120, render: (score: number) => <Progress percent={score} size="small" status={score > 70 ? 'success' : score > 40 ? 'normal' : 'exception'} /> },
                      { title: 'Reason', dataIndex: 'reason', key: 'reason', ellipsis: true },
                      { title: 'Action', key: 'action', width: 100, render: (_: any, record: any) => <Button type="link" size="small" onClick={() => window.fileAPI.openExternal('file://' + record.path)}>Open</Button> },
                    ]}
                  />
                </Card>
              </div>
            )}

            <div style={{ flex: 1, overflow: 'auto', padding: 24 }}>
              <div style={{ marginBottom: 24 }}>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  <Space size="large">
                    <Button type="primary" onClick={handleSelectAndScan} loading={loading} size="large">
                      {t('app.selectFolder')}
                    </Button>
                    <Space size="small">
                      <Switch
                        size="small"
                        checked={skipConfirm}
                        onChange={handleToggleSkipConfirm}
                      />
                      <span style={{ color: darkMode ? 'rgba(255, 255, 255, 0.65)' : '#6b7280', fontSize: '13px' }}>
                        {t('app.skipConfirm')}
                      </span>
                    </Space>
                  </Space>

                  {selectedFolder && (
                    <Space direction="vertical" size="small">
                      <Breadcrumb
                        items={[
                          { title: t('app.selectedFolder') },
                          { title: selectedFolder.split(/[\\/]/).pop() || selectedFolder },
                        ]}
                      />
                      <Tag color="blue">
                        {t('app.fileCount', { count: files.length })}
                      </Tag>
                    </Space>
                  )}
                </Space>
              </div>

              {renderContent()}

              {files.length > 0 && (
                <>
                  <div style={{ marginTop: 16, marginBottom: 8, color: darkMode ? 'rgba(255, 255, 255, 0.65)' : '#6b7280', fontSize: '13px' }}>
                    {t('app.selectedFiles', { selected: selectedFiles.length, total: files.length })}
                  </div>
                  <Table
                    dataSource={files}
                    columns={fileColumns}
                    rowKey="path"
                    pagination={{ pageSize: 10 }}
                    rowSelection={{
                      selectedRowKeys: selectedFiles.map(f => f.path),
                      onChange: (_selectedRowKeys: React.Key[], selectedRows: FileInfo[]) => {
                        setSelectedFiles(selectedRows);
                      },
                    }}
                  />
                </>
              )}
            </div>

            <StatusBar
              paddleOCRStatus={paddleOCRStatus}
              ollamaRunning={ollamaRunning}
              lastAction={selectedFolder ? `${t('app.selectedFolder')}: ${selectedFolder}` : undefined}
              t={t}
            />
          </div>
        </div>
      </TextThemeWrapper>

      <SettingsDrawer
        open={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        darkMode={darkMode}
        onToggleDarkMode={handleToggleDarkMode}
        lang={lang}
        onToggleLang={handleToggleLang}
        t={t}
      />

      <Modal
        title={t('classify.folderCreateTitle')}
        open={folderCreateModalOpen}
        onCancel={handleFolderCreateCancel}
        footer={
          <Space>
            <Button onClick={handleFolderCreateCancel}>
              {t('classify.folderCreateCancel')}
            </Button>
            <Button type="primary" onClick={handleFolderCreateConfirm}>
              {t('classify.folderCreateConfirm')}
            </Button>
          </Space>
        }
        width={500}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div style={{ color: darkMode ? 'rgba(255, 255, 255, 0.85)' : '#1a1a2e' }}>
            {t('classify.folderCreateContent')}
          </div>
          <Space>
            <Button size="small" onClick={handleToggleAllFolders}>
              {pendingFolders.every(f => f.checked) ? t('classify.deselectAll') : t('classify.selectAll')}
            </Button>
          </Space>
          <div style={{
            maxHeight: 300,
            overflow: 'auto',
            border: `1px solid ${darkMode ? '#303030' : '#e5e7eb'}`,
            borderRadius: 6,
            padding: '8px 12px',
          }}>
            {pendingFolders.map((folder, index) => (
              <div
                key={folder.dir}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '6px 0',
                  borderBottom: index < pendingFolders.length - 1 ? `1px solid ${darkMode ? '#242424' : '#f0f0f0'}` : 'none',
                }}
              >
                <Checkbox
                  checked={folder.checked}
                  onChange={() => {
                    setPendingFolders(prev => prev.map((f, i) =>
                      i === index ? { ...f, checked: !f.checked } : f
                    ));
                  }}
                  style={{ marginRight: 8 }}
                />
                <span style={{
                  flex: 1,
                  fontFamily: 'monospace',
                  fontSize: '13px',
                  color: darkMode ? 'rgba(255, 255, 255, 0.85)' : '#1a1a2e',
                }}>
                  {folder.dir.split(/[\\/]/).pop() || folder.dir}
                </span>
                <Tag color="blue" style={{ marginLeft: 8 }}>
                  {t('classify.folderFileCount', { count: folder.count })}
                </Tag>
              </div>
            ))}
          </div>
        </Space>
      </Modal>
    </ConfigProvider>
  );
}

export default App;
