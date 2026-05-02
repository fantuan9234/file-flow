import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import './CustomTitleBar.css';

interface CustomTitleBarProps {
  title?: string;
}

function CustomTitleBar({ title = 'File Flow' }: CustomTitleBarProps) {
  const { t } = useTranslation();
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    const checkMaximized = async () => {
      const result = await window.fileAPI.windowIsMaximized();
      setIsMaximized(result);
    };
    checkMaximized();
  }, []);

  const handleMinimize = async () => {
    await window.fileAPI.windowMinimize();
  };

  const handleMaximize = async () => {
    await window.fileAPI.windowMaximize();
    const result = await window.fileAPI.windowIsMaximized();
    setIsMaximized(result);
  };

  const handleClose = async () => {
    await window.fileAPI.windowClose();
  };

  return (
    <div className="custom-titlebar" data-tauri-drag-region>
      <div className="titlebar-drag-region" data-tauri-drag-region>
        <span className="titlebar-title">{title}</span>
      </div>
      <div className="titlebar-controls">
        <button className="titlebar-button" onClick={handleMinimize} title={t('titleBar.minimize')}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" y1="6" x2="11" y2="6" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
        <button className="titlebar-button" onClick={handleMaximize} title={isMaximized ? t('titleBar.restore') : t('titleBar.maximize')}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            {isMaximized ? (
              <>
                <rect x="2" y="3" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
                <rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </>
            ) : (
              <rect x="1" y="1" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
            )}
          </svg>
        </button>
        <button className="titlebar-button titlebar-close" onClick={handleClose} title={t('titleBar.close')}>
          <svg width="12" height="12" viewBox="0 0 12 12">
            <line x1="1" y1="1" x2="11" y2="11" stroke="currentColor" strokeWidth="1.5" />
            <line x1="11" y1="1" x2="1" y2="11" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

export default CustomTitleBar;
