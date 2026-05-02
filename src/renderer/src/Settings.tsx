import React, { useState, useEffect } from 'react';
import { Form, Select, Input, Button, Space, message, Tag, Collapse, theme } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, LoadingOutlined } from '@ant-design/icons';

interface SettingsProps {
  t: (key: string, options?: Record<string, string>) => string;
}

const OLLAMA_ENDPOINT = 'http://localhost:11434';

const Settings: React.FC<SettingsProps> = ({ t }) => {
  const { token } = theme.useToken();
  const [aiProvider, setAiProvider] = useState<'ollama' | 'lmstudio'>('ollama');
  const [apiEndpoint, setApiEndpoint] = useState(OLLAMA_ENDPOINT);
  const [apiKey, setApiKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'success' | 'error' | null>(null);
  const [models, setModels] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('ai-settings');
      if (saved) {
        const config = JSON.parse(saved);
        setAiProvider(config.provider || 'ollama');
        setApiEndpoint(config.endpoint || OLLAMA_ENDPOINT);
        setApiKey(config.apiKey || '');
        if (config.provider === 'lmstudio') {
          setShowAdvanced(true);
        }
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleTestConnection = async () => {
    setTesting(true);
    setConnectionStatus(null);
    setModels([]);
    try {
      const result = await window.fileAPI.testAiConnection(apiEndpoint, aiProvider);
      if (result.success) {
        setConnectionStatus('success');
        setModels(result.models || []);
        message.success(t('settings.connectionSuccess'));
      } else {
        setConnectionStatus('error');
        const errorMsg = result.error || '';
        if (aiProvider === 'ollama' && (errorMsg.includes('fetch') || errorMsg.includes('ECONNREFUSED'))) {
          message.error(t('settings.ollamaNotRunning'));
        } else {
          message.error(t('settings.connectionFailed', { error: errorMsg }));
        }
      }
    } catch (err) {
      setConnectionStatus('error');
      const errMsg = String(err);
      if (aiProvider === 'ollama' && (errMsg.includes('fetch') || errMsg.includes('ECONNREFUSED'))) {
        message.error(t('settings.ollamaNotRunning'));
      } else {
        message.error(t('settings.connectionFailed', { error: errMsg }));
      }
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    try {
      localStorage.setItem('ai-settings', JSON.stringify({
        provider: aiProvider,
        endpoint: apiEndpoint,
        apiKey: apiKey,
      }));
      message.success(t('settings.saved'));
    } catch {
      message.error(t('settings.saveFailed'));
    }
  };

  return (
    <Form layout="vertical">
      <Form.Item label={t('settings.aiProvider')}>
        <Select
          value="ollama"
          disabled
          options={[{ value: 'ollama', label: 'Ollama' }]}
        />
      </Form.Item>

      <Form.Item label={t('settings.apiEndpoint')}>
        <Input value={OLLAMA_ENDPOINT} disabled />
      </Form.Item>

      <Form.Item>
        <Space>
          <Button
            type="primary"
            onClick={handleTestConnection}
            loading={testing}
            icon={testing ? <LoadingOutlined /> : undefined}
          >
            {t('settings.testConnection')}
          </Button>
          <Button onClick={handleSave}>{t('settings.save')}</Button>
        </Space>
      </Form.Item>

      {connectionStatus === 'success' && (
        <Space>
          <Tag color="success" icon={<CheckCircleOutlined />}>{t('settings.connected')}</Tag>
          {models.length > 0 && (
            <span style={{ fontSize: '12px', color: token.colorTextSecondary }}>
              {t('settings.availableModels')}: {models.join(', ')}
            </span>
          )}
        </Space>
      )}

      {connectionStatus === 'error' && (
        <Tag color="error" icon={<CloseCircleOutlined />}>{t('settings.connectionError')}</Tag>
      )}

      <Collapse
        activeKey={showAdvanced ? ['advanced'] : []}
        onChange={(keys) => setShowAdvanced(keys.includes('advanced'))}
        style={{ marginTop: 16 }}
        items={[
          {
            key: 'advanced',
            label: t('settings.advancedSettings'),
            children: (
              <Form layout="vertical">
                <Form.Item label={t('settings.aiProvider')}>
                  <Select
                    value={aiProvider}
                    onChange={(value: 'ollama' | 'lmstudio') => {
                      setAiProvider(value);
                      setApiEndpoint(value === 'lmstudio' ? 'http://localhost:1234/v1' : OLLAMA_ENDPOINT);
                      setConnectionStatus(null);
                      setModels([]);
                    }}
                    options={[
                      { value: 'ollama', label: 'Ollama' },
                      { value: 'lmstudio', label: 'LM Studio' },
                    ]}
                  />
                </Form.Item>

                <Form.Item label={t('settings.apiEndpoint')}>
                  <Input
                    value={apiEndpoint}
                    onChange={(e) => {
                      setApiEndpoint(e.target.value);
                      setConnectionStatus(null);
                    }}
                    placeholder={aiProvider === 'lmstudio' ? 'http://localhost:1234/v1' : OLLAMA_ENDPOINT}
                  />
                </Form.Item>

                <Form.Item label={t('settings.apiKey')}>
                  <Input.Password
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t('settings.apiKeyPlaceholder')}
                  />
                </Form.Item>
              </Form>
            ),
          },
        ]}
      />
    </Form>
  );
};

export default Settings;
