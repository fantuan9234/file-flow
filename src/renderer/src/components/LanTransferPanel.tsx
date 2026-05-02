import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Space, Typography, message, theme, Spin, Tag, Divider } from 'antd';
import { QrcodeOutlined, StopOutlined, FolderOpenOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

interface LanTransferPanelProps {
  darkMode: boolean;
}

interface ServerInfo {
  url: string;
  qrCode: string;
  port: number;
  ip: string;
}

function LanTransferPanel({ darkMode }: LanTransferPanelProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [serverRunning, setServerRunning] = useState(false);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [receivedFiles, setReceivedFiles] = useState<string[]>([]);

  const handleStartServer = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.fileAPI.startLanServer('');
      if (result.success) {
        setServerRunning(true);
        setServerInfo({
          url: result.url || '',
          qrCode: result.qrCode || '',
          port: result.port || 0,
          ip: result.ip || '',
        });
        message.success(t('lan.serverStarted'));
      } else {
        message.error(result.error || t('lan.startFailed'));
      }
    } catch (error: any) {
      message.error(error.message || t('lan.startFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const handleStopServer = useCallback(async () => {
    try {
      await window.fileAPI.stopLanServer();
      setServerRunning(false);
      setServerInfo(null);
      message.success(t('lan.serverStopped'));
    } catch (error: any) {
      message.error(error.message || t('lan.stopFailed'));
    }
  }, [t]);

  useEffect(() => {
    const unsubscribeStarted = window.fileAPI.onLanServerStarted((data) => {
      setServerRunning(true);
      setServerInfo(data);
    });

    const unsubscribeStopped = window.fileAPI.onLanServerStopped(() => {
      setServerRunning(false);
      setServerInfo(null);
    });

    const unsubscribeFileReceived = window.fileAPI.onLanFileReceived((filename) => {
      setReceivedFiles(prev => [filename, ...prev]);
      message.success(t('lan.fileReceived', { filename }));
    });

    return () => {
      unsubscribeStarted();
      unsubscribeStopped();
      unsubscribeFileReceived();
    };
  }, [t]);

  useEffect(() => {
    return () => {
      if (serverRunning) {
        window.fileAPI.stopLanServer();
      }
    };
  }, [serverRunning]);

  const cardStyle = {
    background: darkMode ? 'rgba(31, 31, 31, 0.9)' : 'rgba(255, 255, 255, 0.9)',
    backdropFilter: 'blur(10px)',
    border: `1px solid ${darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)'}`,
    borderRadius: 12,
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card style={cardStyle}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ textAlign: 'center' }}>
            <QrcodeOutlined style={{ fontSize: 48, color: token.colorPrimary }} />
            <Title level={3} style={{ margin: '16px 0 8px' }}>
              {t('lan.title')}
            </Title>
            <Text type="secondary">
              {t('lan.description')}
            </Text>
          </div>

          <Divider />

          {!serverRunning ? (
            <div style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<FolderOpenOutlined />}
                onClick={handleStartServer}
                loading={loading}
              >
                {t('lan.startServer')}
              </Button>
            </div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ textAlign: 'center' }}>
                <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
                  {t('lan.running')}
                </Tag>
              </div>

              {serverInfo && (
                <>
                  <div style={{ textAlign: 'center' }}>
                    <img src={serverInfo.qrCode} alt="QR Code" style={{ width: 200, height: 200 }} />
                  </div>

                  <Card size="small" style={{ background: darkMode ? 'rgba(0, 0, 0, 0.2)' : '#f5f5f5' }}>
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      <div>
                        <Text strong>{t('lan.url')}：</Text>
                        <Paragraph copyable style={{ margin: 0 }}>
                          {serverInfo.url}
                        </Paragraph>
                      </div>
                      <div>
                        <Text strong>{t('lan.ip')}：</Text>
                        <Text>{serverInfo.ip}</Text>
                      </div>
                      <div>
                        <Text strong>{t('lan.port')}：</Text>
                        <Text>{serverInfo.port}</Text>
                      </div>
                    </Space>
                  </Card>

                  <div style={{ textAlign: 'center' }}>
                    <Button
                      danger
                      size="large"
                      icon={<StopOutlined />}
                      onClick={handleStopServer}
                    >
                      {t('lan.stopServer')}
                    </Button>
                  </div>
                </>
              )}
            </Space>
          )}

          {receivedFiles.length > 0 && (
            <>
              <Divider />
              <div>
                <Title level={5}>{t('lan.receivedFiles')}</Title>
                <Space direction="vertical" style={{ width: '100%' }} size="small">
                  {receivedFiles.slice(0, 10).map((filename, index) => (
                    <Tag key={index} color="blue" style={{ margin: 0 }}>
                      {filename}
                    </Tag>
                  ))}
                  {receivedFiles.length > 10 && (
                    <Text type="secondary">
                      {t('lan.moreFiles', { count: receivedFiles.length - 10 })}
                    </Text>
                  )}
                </Space>
              </div>
            </>
          )}
        </Space>
      </Card>
    </div>
  );
}

export default LanTransferPanel;
