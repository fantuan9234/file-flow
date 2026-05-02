import { useState, useEffect, useCallback } from 'react';
import { Button, Card, Space, Typography, message, theme, Spin, Tag, Divider, Progress, List, Avatar, Tooltip } from 'antd';
import { QrcodeOutlined, StopOutlined, PlayCircleOutlined, DesktopOutlined, MobileOutlined, FileOutlined, CheckCircleOutlined, CloseCircleOutlined, FolderOpenOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';
import { useTranslation } from 'react-i18next';

const { Title, Text, Paragraph } = Typography;

interface LanShareProps {
  darkMode: boolean;
}

interface Peer {
  id: string;
  name: string;
  type: string;
  connectedAt: number;
}

interface TransferFile {
  id: string;
  name: string;
  size: number;
  type: string;
  progress: number;
  status: string;
  direction: string;
  peerId: string;
  savedPath?: string;
}

function LanShare({ darkMode }: LanShareProps) {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const [serverRunning, setServerRunning] = useState(false);
  const [serverInfo, setServerInfo] = useState<{ url: string; port: number; ip: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [transfers, setTransfers] = useState<TransferFile[]>([]);
  const [receiveDir, setReceiveDir] = useState<string>('');

  const handleSelectReceiveDir = useCallback(async () => {
    try {
      const result = await window.fileAPI.selectP2PReceiveDir();
      if (result.success && result.dir) {
        setReceiveDir(result.dir);
        message.success(t('lan.receiveDirChanged'));
      }
    } catch (error: any) {
      message.error(error.message || t('lan.selectDirFailed'));
    }
  }, [t]);

  const handleStartServer = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.fileAPI.startP2PServer('');
      if (result.success) {
        setServerRunning(true);
        setServerInfo({
          url: result.url || '',
          port: result.port || 0,
          ip: result.ip || '',
        });
        if (result.receiveDir) {
          setReceiveDir(result.receiveDir);
        }
        message.success(t('lan.p2pServerStarted'));
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
      await window.fileAPI.stopP2PServer();
      setServerRunning(false);
      setServerInfo(null);
      setPeers([]);
      message.success(t('lan.p2pServerStopped'));
    } catch (error: any) {
      message.error(error.message || t('lan.stopFailed'));
    }
  }, [t]);

  const handleOpenWeb = useCallback(() => {
    if (serverInfo?.url) {
      window.fileAPI.openExternal(serverInfo.url);
    }
  }, [serverInfo]);

  useEffect(() => {
    window.fileAPI.getP2PReceiveDir().then(res => {
      if (res.success && res.dir) {
        setReceiveDir(res.dir);
      }
    });
  }, []);

  useEffect(() => {
    handleStartServer();
  }, []);

  useEffect(() => {
    const unsubscribeStarted = window.fileAPI.onP2PServerStarted((data) => {
      setServerRunning(true);
      setServerInfo(data);
      setLoading(false);
    });

    const unsubscribeStopped = window.fileAPI.onP2PServerStopped(() => {
      setServerRunning(false);
      setServerInfo(null);
      setPeers([]);
    });

    const unsubscribePeerConnected = window.fileAPI.onP2PPeerConnected((peer) => {
      setPeers(prev => {
        const exists = prev.find(p => p.id === peer.id);
        if (exists) return prev;
        return [...prev, peer];
      });
      message.info(t('lan.peerConnected', { name: peer.name }));
    });

    const unsubscribePeerDisconnected = window.fileAPI.onP2PPeerDisconnected((data) => {
      setPeers(prev => prev.filter(p => p.id !== data.peerId));
    });

    const unsubscribeFileReceived = window.fileAPI.onP2PFileReceived((file) => {
      setTransfers(prev => {
        const exists = prev.find(t => t.id === file.id);
        if (exists) {
          return prev.map(t => t.id === file.id ? file : t);
        }
        return [file, ...prev];
      });
      message.success(t('lan.fileReceived', { filename: file.name }));
    });

    const unsubscribeTransferProgress = window.fileAPI.onP2PTransferProgress((data) => {
      setTransfers(prev =>
        prev.map(t =>
          t.id === data.fileId ? { ...t, progress: data.progress, status: 'transferring' } : t
        )
      );
    });

    return () => {
      unsubscribeStarted();
      unsubscribeStopped();
      unsubscribePeerConnected();
      unsubscribePeerDisconnected();
      unsubscribeFileReceived();
      unsubscribeTransferProgress();
    };
  }, [t]);

  useEffect(() => {
    return () => {
      if (serverRunning) {
        window.fileAPI.stopP2PServer();
      }
    };
  }, [serverRunning]);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  const getPeerIcon = (type: string) => {
    if (type === 'desktop') return <DesktopOutlined />;
    if (type === 'tablet') return <MobileOutlined />;
    return <MobileOutlined />;
  };

  const getPeerTypeLabel = (type: string): string => {
    if (type === 'desktop') return '电脑';
    if (type === 'tablet') return '平板';
    return '手机';
  };

  const getTransferIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'error': return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
      default: return <FileOutlined />;
    }
  };

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
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <Card style={cardStyle}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ textAlign: 'center' }}>
            <QrcodeOutlined style={{ fontSize: 48, color: token.colorPrimary }} />
            <Title level={3} style={{ margin: '16px 0 8px' }}>
              {t('lan.p2pTitle')}
            </Title>
            <Text type="secondary">
              {t('lan.p2pDescription')}
            </Text>
          </div>

          <Divider />

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <Spin size="large" />
              <div style={{ marginTop: 16 }}>
                <Text type="secondary">{t('lan.startingServer')}</Text>
              </div>
            </div>
          ) : !serverRunning ? (
            <div style={{ textAlign: 'center' }}>
              <Button
                type="primary"
                size="large"
                icon={<PlayCircleOutlined />}
                onClick={handleStartServer}
              >
                {t('lan.startP2PServer')}
              </Button>
            </div>
          ) : (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <div style={{ textAlign: 'center' }}>
                <Tag color="green" style={{ fontSize: 14, padding: '4px 12px' }}>
                  {t('lan.p2pRunning')}
                </Tag>
              </div>

              {serverInfo && (
            <Space direction="vertical" style={{ width: '100%' }} size="middle">
              <Button
                type="primary"
                size="large"
                icon={<LinkOutlined />}
                onClick={handleOpenWeb}
                block
              >
                {t('lan.openWeb')}
              </Button>

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

              <Card size="small" style={{ background: darkMode ? 'rgba(0, 0, 0, 0.2)' : '#f5f5f5', textAlign: 'center' }}>
                <div style={{ padding: '16px 0 8px' }}>
                  <QRCodeSVG value={serverInfo.url} size={180} level="M" />
                </div>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {t('lan.scanToConnect')}
                </Text>
              </Card>

              {receiveDir && (
                <Card size="small" style={{ background: darkMode ? 'rgba(0, 0, 0, 0.2)' : '#f5f5f5' }}>
                  <Space direction="vertical" style={{ width: '100%' }} size="small">
                    <div>
                      <Text strong>{t('lan.receiveDir')}：</Text>
                      <Text copyable style={{ fontSize: 12 }}>{receiveDir}</Text>
                    </div>
                    <Button size="small" icon={<FolderOpenOutlined />} onClick={handleSelectReceiveDir}>
                      {t('lan.changeReceiveDir')}
                    </Button>
                  </Space>
                </Card>
              )}
            </Space>
          )}

              <div style={{ textAlign: 'center' }}>
                <Button
                  danger
                  size="large"
                  icon={<StopOutlined />}
                  onClick={handleStopServer}
                >
                  {t('lan.stopP2PServer')}
                </Button>
              </div>
            </Space>
          )}

          {peers.length > 0 && (
            <>
              <Divider />
              <div>
                <Title level={5}>{t('lan.connectedPeers')}</Title>
                <List
                  dataSource={peers}
                  renderItem={(peer) => (
                    <List.Item>
                      <List.Item.Meta
                        avatar={<Avatar icon={getPeerIcon(peer.type)} />}
                        title={peer.name}
                        description={`${getPeerTypeLabel(peer.type)} · ${new Date(peer.connectedAt).toLocaleTimeString()}`}
                      />
                      <Tag color="blue">在线</Tag>
                    </List.Item>
                  )}
                />
              </div>
            </>
          )}

          {transfers.length > 0 && (
            <>
              <Divider />
              <div>
                <Title level={5}>{t('lan.transfers')}</Title>
                <Space direction="vertical" style={{ width: '100%' }} size="middle">
                  {transfers.slice(0, 10).map((transfer) => (
                    <Card key={transfer.id} size="small">
                      <Space direction="vertical" style={{ width: '100%' }} size="small">
                        <Space>
                          {getTransferIcon(transfer.status)}
                          <Text strong style={{ flex: 1 }}>{transfer.name}</Text>
                          <Text type="secondary">{formatFileSize(transfer.size)}</Text>
                        </Space>
                        <Progress
                          percent={Math.round(transfer.progress)}
                          status={transfer.status === 'completed' ? 'success' : transfer.status === 'error' ? 'exception' : 'active'}
                          size="small"
                        />
                        <Space direction="vertical" style={{ width: '100%' }} size="small">
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {transfer.status === 'completed' ? t('lan.transferComplete') :
                             transfer.status === 'error' ? t('lan.transferError') :
                             t('lan.transferring')}
                          </Text>
                          {transfer.status === 'completed' && transfer.savedPath && (
                            <Space style={{ fontSize: 11 }}>
                              <Text type="secondary">{t('lan.savedTo')}：</Text>
                              <Text copyable style={{ fontSize: 11, flex: 1 }}>{transfer.savedPath}</Text>
                              <Tooltip title={t('lan.copyPath')}>
                                <CopyOutlined 
                                  style={{ cursor: 'pointer', color: token.colorPrimary }}
                                  onClick={() => {
                                    navigator.clipboard.writeText(transfer.savedPath || '');
                                    message.success(t('lan.pathCopied'));
                                  }}
                                />
                              </Tooltip>
                            </Space>
                          )}
                        </Space>
                      </Space>
                    </Card>
                  ))}
                </Space>
              </div>
            </>
          )}
        </Space>
      </Card>
    </div>
  );
}

export default LanShare;
