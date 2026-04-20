import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100vh',
          backgroundColor: '#ffffff',
          padding: '0 24px',
          textAlign: 'center'
        }}>
          <span style={{ fontSize: '64px', marginBottom: '24px' }}>⚠️</span>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#191F28', marginBottom: '12px' }}>
            서비스 이용에 불편을 드려 죄송합니다.
          </h2>
          <p style={{ fontSize: '15px', color: '#4E5968', marginBottom: '32px', lineHeight: 1.5 }}>
            일시적인 오류가 발생했습니다.<br />
            아래 버튼을 눌러 페이지를 다시 불러와 주세요.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              width: '100%',
              maxWidth: '240px',
              height: '52px',
              backgroundColor: '#3182F6',
              color: '#ffffff',
              border: 'none',
              borderRadius: '14px',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            페이지 새로고침
          </button>
          {process.env.NODE_ENV === 'development' && (
            <details style={{ marginTop: '24px', textAlign: 'left', width: '100%', overflowX: 'auto' }}>
              <summary style={{ cursor: 'pointer', color: '#8B95A1' }}>Error Details (Dev Only)</summary>
              <pre style={{ fontSize: '12px', color: '#F04452', marginTop: '12px' }}>
                {this.state.error?.toString()}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
