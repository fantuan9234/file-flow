import React from 'react';
import { Drawer, Form, Input, Button, Switch, Space, Typography, Divider, message } from 'antd';

const { Title, Text } = Typography;

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  darkMode: boolean;
  onToggleDarkMode: (checked: boolean) => void;
  lang: string;
  onToggleLang: (checked: boolean) => void;
  t: (key: string) => string;
}

const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open,
  onClose,
  darkMode,
  onToggleDarkMode,
  lang,
  onToggleLang,
  t,
}) => {
  return (
    <Drawer
      title={t('settings.title')}
      placement="right"
      onClose={onClose}
      open={open}
      width={400}
      styles={{
        body: { padding: 24 },
      }}
    >
      <Space direction="vertical" style={{ width: '100%' }} size="large">
        {/* 外观设置 */}
        <div>
          <Title level={5} style={{ margin: '0 0 16px' }}>{t('app.darkMode')}</Title>
          <Space>
            <Text>{darkMode ? '🌙' : '☀️'}</Text>
            <Switch checked={darkMode} onChange={onToggleDarkMode} />
          </Space>
        </div>

        <Divider style={{ margin: 0 }} />

        {/* 语言设置 */}
        <div>
          <Title level={5} style={{ margin: '0 0 16px' }}>{t('app.language')}</Title>
          <Space>
            <Text>{lang === 'zh' ? '🇨🇳' : '🇺🇸'}</Text>
            <Switch checked={lang === 'en'} onChange={onToggleLang} />
            <Text type="secondary">{lang === 'zh' ? '中文' : 'English'}</Text>
          </Space>
        </div>

        <Divider style={{ margin: 0 }} />

        {/* AI 设置 */}
        <div>
          <Title level={5} style={{ margin: '0 0 16px' }}>{t('settings.advancedSettings')}</Title>
          <Form layout="vertical">
            <Form.Item label={t('settings.aiProvider')}>
              <Input defaultValue="http://localhost:1234" placeholder="http://localhost:1234" />
            </Form.Item>
            <Form.Item label={t('settings.apiKey')}>
              <Input.Password placeholder={t('settings.apiKeyPlaceholder')} />
            </Form.Item>
            <Form.Item>
              <Space>
                <Button type="primary">{t('settings.save')}</Button>
                <Button onClick={() => message.info(t('settings.testConnection'))}>
                  {t('settings.testConnection')}
                </Button>
              </Space>
            </Form.Item>
          </Form>
        </div>
      </Space>
    </Drawer>
  );
};

export default SettingsDrawer;
