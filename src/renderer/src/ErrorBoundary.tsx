import { Component, ErrorInfo, ReactNode } from 'react';
import { Button, Result, Space } from 'antd';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Result
            status="error"
            title="应用加载失败"
            subTitle="React 组件渲染时发生了错误。请尝试重启应用。"
            extra={
              <Space>
                <Button type="primary" onClick={() => window.location.reload()}>
                  重新加载
                </Button>
                <Button
                  onClick={() => {
                    if (this.state.error) {
                      navigator.clipboard.writeText(this.state.error.stack || this.state.error.message);
                    }
                  }}
                >
                  复制错误信息
                </Button>
              </Space>
            }
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
