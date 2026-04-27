import React from 'react';

export const MarkerLoadingWindow: React.FC = () => {
  return (
    <div className="iw-card" style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', minWidth: '180px' }}>
      <div className="iw-loader"></div>
      <span style={{ fontSize: '13px', color: '#8B95A1', fontWeight: 600, textAlign: 'center', lineHeight: 1.4 }}>
        건축물대장 공공데이터로<br/>실거주용 건물이 맞는지 확인 중...
      </span>
    </div>
  );
};
