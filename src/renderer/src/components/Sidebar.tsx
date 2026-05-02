import React from 'react';
import { Menu } from 'antd';
import {
  EditOutlined,
  SwapOutlined,
  FolderOutlined,
  ThunderboltOutlined,
  ScanOutlined,
  CopyOutlined,
  QrcodeOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { theme } from 'antd';

interface SidebarProps {
  activeTab: string;
  onTabChange: (key: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  t: (key: string) => string;
}

const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabChange, collapsed, onToggleCollapse, t }) => {
  const { token } = theme.useToken();

  const menuItems = [
    { key: 'rename', icon: <EditOutlined />, label: t('tabs.rename') },
    { key: 'convert', icon: <SwapOutlined />, label: t('tabs.convert') },
    { key: 'classify', icon: <FolderOutlined />, label: t('tabs.classify') },
    { key: 'workflow', icon: <ThunderboltOutlined />, label: t('tabs.workflow') },
    { key: 'ocr', icon: <ScanOutlined />, label: t('tabs.ocr') },
    { key: 'dedup', icon: <CopyOutlined />, label: t('tabs.dedup') },
    { key: 'lan', icon: <QrcodeOutlined />, label: t('tabs.lan') },
  ];

  return (
    <div
      style={{
        width: collapsed ? 60 : 200,
        minWidth: collapsed ? 60 : 200,
        height: '100vh',
        background: token.colorBgContainer,
        borderRight: `1px solid ${token.colorBorderSecondary}`,
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.3s ease, background-color 0.3s ease, border-color 0.3s ease',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 12px',
          display: 'flex',
          justifyContent: 'flex-end',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <div
          onClick={onToggleCollapse}
          style={{
            cursor: 'pointer',
            padding: 4,
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: token.colorTextSecondary,
            transition: 'background-color 0.2s ease',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = token.colorFillTertiary)}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      </div>

      <Menu
        mode="inline"
        selectedKeys={[activeTab]}
        items={menuItems}
        onClick={({ key }) => onTabChange(key)}
        className="ff-sidebar-menu"
        style={{
          flex: 1,
          borderRight: 'none',
          background: 'transparent',
          padding: '8px 0',
        }}
      />
    </div>
  );
};

export default Sidebar;
