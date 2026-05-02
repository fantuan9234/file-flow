import React from 'react';
import { Space, Tag, Typography } from 'antd';
import { theme } from 'antd';

const { Text } = Typography;

interface StatusBarProps {
  paddleOCRStatus?: string;
  ollamaRunning?: boolean | null;
  lastAction?: string;
  t: (key: string) => string;
}

const StatusBar: React.FC<StatusBarProps> = ({ paddleOCRStatus, ollamaRunning, lastAction, t }) => {
  const { token } = theme.useToken();

  return (
    <div
      style={{
        height: 32,
        background: token.colorBgContainer,
        borderTop: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        fontSize: 12,
        transition: 'background-color 0.3s ease, border-color 0.3s ease',
      }}
    >
      <Space size="middle">
        <Space size="small">
          <Text type="secondary">{t('ocr.serviceStatus')}:</Text>
          {paddleOCRStatus === 'running' && <Tag color="success" style={{ fontSize: 11 }}>{t('ocr.serviceRunning')}</Tag>}
          {paddleOCRStatus === 'starting' && <Tag color="processing" style={{ fontSize: 11 }}>{t('ocr.serviceStarting')}</Tag>}
          {paddleOCRStatus === 'stopped' && <Tag color="default" style={{ fontSize: 11 }}>{t('ocr.serviceStopped')}</Tag>}
          {paddleOCRStatus === 'failed' && <Tag color="error" style={{ fontSize: 11 }}>{t('ocr.serviceFailed')}</Tag>}
          {!paddleOCRStatus && <Tag color="default" style={{ fontSize: 11 }}>--</Tag>}
        </Space>

        <Space size="small">
          <Text type="secondary">Ollama:</Text>
          {ollamaRunning === true && <Tag color="success" style={{ fontSize: 11 }}>Running</Tag>}
          {ollamaRunning === false && <Tag color="default" style={{ fontSize: 11 }}>Stopped</Tag>}
          {ollamaRunning === undefined && <Tag color="default" style={{ fontSize: 11 }}>--</Tag>}
        </Space>
      </Space>

      <Text type="secondary" style={{ maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {lastAction || t('app.noFolderSelected')}
      </Text>
    </div>
  );
};

export default StatusBar;
