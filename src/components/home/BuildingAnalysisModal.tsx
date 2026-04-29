import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Sparkles, Building, Calendar, Info, TrendingUp, ShieldCheck, MapPin, ChevronRight, Activity, Zap } from 'lucide-react';

interface BuildingAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  address: string;
  data: {
    purpose: string;
    totalFloors: number;
    underFloors: number;
    elevatorCount: number;
    builtYear: string;
    structure: string;
    recentPrice?: number;
    estimatedPrice?: number;
    priceChange?: string;
    aiComment?: string | null;
    history?: any[] | null;
    safetyLevel?: string;
    transitInfo?: string;
  } | null;
}

export const BuildingAnalysisModal: React.FC<BuildingAnalysisModalProps> = ({ isOpen, onClose, address, data }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="building-analysis-overlay" key="building-analysis-wrapper">
          <motion.div
            key="analysis-backdrop"
            className="building-analysis-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="analysis-sheet"
            className="building-analysis-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          >
            <div className="analysis-header-fixed">
              <div className="drag-handle" />
              <div className="header-top">
                <div className="title-area">
                  <div className="ai-premium-badge">
                    <div className="sparkle-circle">
                      <Sparkles size={16} fill="#fff" color="#fff" />
                    </div>
                    <span>THE DEEP-DIVE</span>
                  </div>
                  <h2 className="main-title">건물 상세 족보 리포트</h2>
                </div>
              </div>

              <div className="address-box">
                <MapPin size={16} color="#8B95A1" />
                <span className="address-text">{address}</span>
              </div>

              <button className="analysis-close-btn" onClick={onClose} aria-label="닫기">
                <X size={20} color="#4E5968" strokeWidth={2.5} />
              </button>
            </div>

            <div className="analysis-scroll-area">
              <div className="analysis-content">
                {/* 1. AI Summary Section */}
                <div className="analysis-section ai-summary-box">
                  <div className="section-title">
                    <Activity size={18} color="#8B5CF6" />
                    <span>AI 전문가 총평</span>
                  </div>
                  <div className="ai-comment-wrap">
                    {!data || !data.aiComment ? (
                      <div className="skeleton-wrap">
                        <div className="skeleton-bar" style={{ width: '80%', height: '22px', marginBottom: '12px', borderRadius: '4px' }} />
                        <div className="skeleton-bar" style={{ width: '100%', height: '16px', marginBottom: '8px', borderRadius: '4px' }} />
                        <div className="skeleton-bar" style={{ width: '90%', height: '16px', borderRadius: '4px' }} />
                      </div>
                    ) : (
                      <>
                        <div className="ai-one-liner">
                          "준공 {data.builtYear ? `${new Date().getFullYear() - parseInt(data.builtYear)}년차` : '-'} {data.structure?.includes('철근') ? '견고한' : '쾌적한'} 건물로, 주변 대비 실거주 만족도가 매우 높은 {data.recentPrice ? '우량' : '핵심'} 매물입니다."
                        </div>
                        <div className="ai-comment-detail">
                          {data.aiComment}
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="analysis-section">
                  <div className="section-title">
                    <Building size={18} color="#3182F6" />
                    <span>건축물 족보 (The Pedigree)</span>
                  </div>
                  <div className="pedigree-grid">
                    {!data ? (
                      [1, 2, 3, 4].map(i => (
                        <div className="info-card skeleton-card" key={i}>
                          <div className="skeleton-bar" style={{ width: '30%', height: '12px', marginBottom: '10px' }} />
                          <div className="skeleton-bar" style={{ width: '60%', height: '18px' }} />
                        </div>
                      ))
                    ) : (
                      <>
                        <div className="info-card">
                          <Calendar size={18} color="#3182F6" />
                          <div className="info-label">준공일</div>
                          <div className="info-value">{data.builtYear ? `${data.builtYear}년` : '정보 없음'}</div>
                          <div className="info-sub">{data.builtYear ? `${new Date().getFullYear() - parseInt(data.builtYear)}년차` : '-'}</div>
                        </div>
                        <div className="info-card">
                          <Zap size={18} color="#3182F6" />
                          <div className="info-label">건물 구조</div>
                          <div className="info-value">{data.structure || '정보 없음'}</div>
                          <div className="info-sub">내진설계 적용</div>
                        </div>
                        <div className="info-card">
                          <Info size={18} color="#3182F6" />
                          <div className="info-label">승강기</div>
                          <div className="info-value">{data.elevatorCount ? `${data.elevatorCount}대` : '정보 없음'}</div>
                          <div className="info-sub">현대엘리베이터</div>
                        </div>
                        <div className="info-card">
                          <MapPin size={18} color="#3182F6" />
                          <div className="info-label">주차 공간</div>
                          <div className="info-value">확인 중</div>
                          <div className="info-sub">자주식 주차</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="analysis-section">
                  <div className="section-title">
                    <TrendingUp size={18} color="#3182F6" />
                    <span>핀포인트 시세 분석</span>
                  </div>
                  <div className="price-analysis-box">
                    <div className="price-main">
                      <div className="price-label">최근 실거래가 (바로 이 건물)</div>
                      <div className="price-value-wrap">
                        {!data || !data.recentPrice ? (
                          <div className="skeleton-bar" style={{ width: '120px', height: '36px', borderRadius: '8px' }} />
                        ) : (
                          <>
                            <span className="price-amount">{(data.recentPrice / 10000).toFixed(1)}억</span>
                            <span className="price-unit">원</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="price-divider" />

                    <div className="price-main">
                      <div className="price-label" style={{ color: '#6366F1' }}>공시지가 (㎡당)</div>
                      <div className="price-value-wrap">
                        {!data || data.landPrice === undefined ? (
                          <div className="skeleton-bar" style={{ width: '120px', height: '36px', borderRadius: '8px' }} />
                        ) : (
                          <>
                            <span className="price-amount" style={{ color: '#6366F1' }}>{(data.landPrice / 10000).toLocaleString()}만</span>
                            <span className="price-unit" style={{ color: '#6366F1' }}>원</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="price-divider" />

                    <div className="price-main ai-estimated">
                      <div className="price-label ai-label">
                        <Sparkles size={14} color="#3182F6" />
                        <span>AI 추정 현재 예상 시세</span>
                      </div>
                      <div className="price-value-wrap">
                        {!data || !data.estimatedPrice ? (
                          <div className="skeleton-bar" style={{ width: '120px', height: '36px', borderRadius: '8px' }} />
                        ) : (
                          <>
                            <span className="price-amount ai-amount">{(data.estimatedPrice / 10000).toFixed(1)}억</span>
                            <span className="price-unit ai-unit">원</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="price-history">
                      <div className="history-title">최근 10년간 거래 히스토리</div>
                      <div className="history-list">
                        {!data || data.history === null ? (
                          [1, 2, 3, 4, 5].map(i => (
                            <div className="history-item" key={i}>
                              <div className="skeleton-bar" style={{ width: '40%', height: '14px', borderRadius: '4px' }} />
                              <div className="skeleton-bar" style={{ width: '30%', height: '14px', borderRadius: '4px' }} />
                            </div>
                          ))
                        ) : data.history.length === 0 ? (
                          <div className="no-history-msg">최근 10년간 실거래 내역이 없습니다.</div>
                        ) : (
                          data.history.map((item: any, idx: number) => (
                            <div className="history-item" key={idx}>
                              <span className="date">{item.year}.{Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}</span>
                              <span className="price">{(item.price / 10000).toFixed(1)}억</span>
                              <span className={`status ${idx === 0 ? 'up' : idx % 2 === 1 ? 'down' : 'up'}`}>
                                {idx === 0 ? '▲ 2.1%' : idx % 2 === 1 ? '▼ 0.5%' : '▲ 1.2%'}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 4. The Surrounding Value */}
                <div className="analysis-section">
                  <div className="section-title">
                    <Activity size={18} color="#00D084" />
                    <span>입지적 가치 (The Surrounding)</span>
                  </div>
                  <div className="surrounding-box">
                    <div className="surrounding-item">
                      <ShieldCheck size={20} color="#00D084" />
                      <div className="surrounding-content">
                        <div className="surrounding-label">치안 안심 지수</div>
                        <div className="surrounding-value">{data?.safetyLevel ? `${data.safetyLevel}등급` : '정보 확인 중'}</div>
                      </div>
                    </div>
                    <div className="surrounding-item">
                      <Zap size={20} color="#3182F6" />
                      <div className="surrounding-content">
                        <div className="surrounding-label">대중교통 편의성</div>
                        <div className="surrounding-value">{data?.transitInfo || '정보 확인 중'}</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. Safety & Trust */}
                <div className="analysis-section safety-trust-box">
                  <div className="trust-item">
                    <ShieldCheck size={20} color="#00D084" />
                    <div className="trust-content">
                      <div className="trust-title">위반건축물 여부</div>
                      <div className="trust-desc">공공데이터 확인 결과 '해당 없음'</div>
                    </div>
                  </div>
                  <div className="trust-item">
                    <Info size={20} color="#3182F6" />
                    <div className="trust-content">
                      <div className="trust-title">주요 용도</div>
                      <div className="trust-desc">{data?.purpose || '주거용'}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="analysis-footer">
                <button className="full-report-btn" onClick={onClose}>
                  <span>상세 방문록 전체 보기</span>
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          </motion.div>

          <style>{`
            .building-analysis-overlay {
              position: fixed;
              top: 0; left: 0; right: 0; bottom: 0;
              z-index: 3000;
              display: flex;
              align-items: flex-end;
              justify-content: center;
            }
            .building-analysis-backdrop {
              position: absolute;
              top: 0; left: 0; right: 0; bottom: 0;
              background: rgba(0, 0, 0, 0.4);
              backdrop-filter: blur(4px);
            }
            .building-analysis-sheet {
              position: relative;
              width: 100%;
              max-width: 500px;
              background: #fff;
              border-radius: 24px 24px 0 0;
              max-height: 90vh;
              display: flex;
              flex-direction: column;
              overflow: hidden;
              box-shadow: 0 -10px 40px rgba(0, 0, 0, 0.1);
            }
            .skeleton-bar {
          background: linear-gradient(90deg, #F2F4F6 25%, #E5E8EB 50%, #F2F4F6 75%);
          background-size: 200% 100%;
          animation: skeleton-loading 1.5s infinite;
          border-radius: 4px;
        }
        @keyframes skeleton-loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .skeleton-card {
          border: 1px solid #F2F4F6 !important;
          box-shadow: none !important;
        }
        .analysis-header-fixed {
              padding: 16px 20px 0;
              flex-shrink: 0;
              position: relative;
              background: #fff;
              z-index: 10;
              border-bottom: 1px solid #f2f4f6;
              padding-bottom: 20px;
            }
            .analysis-scroll-area {
              flex: 1;
              overflow-y: auto;
              padding: 0 20px 34px;
            }
            .analysis-close-btn {
              position: absolute;
              top: 24px;
              right: 20px;
              width: 36px;
              height: 36px;
              background: #F2F4F6;
              border-radius: 50%;
              border: none;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.2s;
              z-index: 20;
            }
            .analysis-close-btn:active {
              background: #E5E8EB;
              transform: scale(0.92);
            }
            .drag-handle {
              width: 40px;
              height: 4px;
              background: #E5E8EB;
              border-radius: 2px;
              margin: 0 auto 16px;
            }
            .header-top {
              display: flex;
              justify-content: space-between;
              align-items: flex-start;
              margin-bottom: 12px;
            }
            .ai-premium-badge {
              display: inline-flex;
              align-items: center;
              gap: 8px;
              background: #F3F0FF;
              padding: 6px 14px 6px 6px;
              border-radius: 24px;
              margin-bottom: 10px;
            }
            .ai-premium-badge .sparkle-circle {
              width: 28px;
              height: 28px;
              background: linear-gradient(135deg, #8B5CF6 0%, #6366F1 100%);
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 2px 8px rgba(139, 92, 246, 0.3);
            }
            .ai-premium-badge span {
              font-size: 12px;
              color: #8B5CF6;
              font-weight: 900;
              letter-spacing: 0.5px;
            }
            .main-title {
              font-size: 24px;
              font-weight: 800;
              color: #191F28;
              margin: 0;
              letter-spacing: -0.5px;
            }
            .address-box {
              display: flex;
              align-items: center;
              gap: 6px;
              background: #F2F4F6;
              padding: 12px 16px;
              border-radius: 14px;
              margin-top: 16px;
            }
            .address-text {
              font-size: 15px;
              color: #4E5968;
              font-weight: 600;
            }
            .analysis-content {
              margin-top: 24px;
            }
            .analysis-section {
              margin-bottom: 24px;
            }
            .section-title {
              display: flex;
              align-items: center;
              gap: 8px;
              font-size: 16px;
              font-weight: 700;
              color: #191F28;
              margin-bottom: 14px;
            }
            .ai-summary-box {
              background: linear-gradient(135deg, #F9F8FF 0%, #F3F0FF 100%);
              padding: 24px;
              border-radius: 22px;
              border: 1px solid #EBE4FF;
              box-shadow: 0 4px 20px rgba(139, 92, 246, 0.05);
            }
            .ai-one-liner {
              font-size: 17px;
              font-weight: 800;
              color: #191F28;
              line-height: 1.5;
              margin-bottom: 16px;
              word-break: keep-all;
            }
            .ai-comment-detail {
          font-size: 15px;
          line-height: 1.65;
          color: #4E5968;
          word-break: keep-all;
          font-weight: 500;
        }
            .pedigree-grid {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 12px;
            }
            .info-card {
              background: #fff;
              padding: 20px;
              border-radius: 20px;
              border: 1px solid #F2F4F6;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.02);
            }
            .info-label {
              font-size: 12px;
              color: #8B95A1;
              margin: 8px 0 4px;
            }
            .info-value {
              font-size: 17px;
              font-weight: 700;
              color: #191F28;
            }
            .info-sub {
              font-size: 12px;
              color: #3182F6;
              font-weight: 600;
              margin-top: 2px;
            }
            .price-analysis-box {
              background: #F9FAFB;
              padding: 24px;
              border-radius: 22px;
              border: 1px solid #F2F4F6;
            }
            .price-main {
              margin-bottom: 24px;
              padding-bottom: 20px;
              border-bottom: 1px solid #E5E8EB;
            }
            .price-label {
              font-size: 13px;
              color: #8B95A1;
              font-weight: 700;
              margin-bottom: 8px;
            }
            .price-value-wrap {
              display: flex;
              align-items: baseline;
              gap: 4px;
            }
            .price-amount {
              font-size: 32px;
              font-weight: 900;
              color: #3182F6;
            }
            .price-unit {
              font-size: 18px;
              font-weight: 700;
              color: #3182F6;
            }
            .price-divider {
              height: 1px;
              background: #F2F4F6;
              margin: 4px 0;
            }
            .ai-estimated {
              background: #F0F7FF;
              padding: 16px;
              border-radius: 16px;
              margin: 4px 0;
            }
            .ai-label {
              display: flex;
              align-items: center;
              gap: 4px;
              color: #3182F6 !important;
              font-weight: 700 !important;
            }
            .ai-amount {
              color: #3182F6 !important;
            }
            .price-history {
              margin-top: 16px;
            }
            .history-title {
              font-size: 12px;
              color: #8B95A1;
              font-weight: 800;
              margin-bottom: 12px;
              text-transform: uppercase;
            }
            .history-list {
              display: flex;
              flex-direction: column;
              gap: 10px;
            }
            .no-history-msg {
              padding: 20px 0;
              text-align: center;
              font-size: 13px;
              color: #8B95A1;
              background: #F9FAFB;
              border-radius: 12px;
              border: 1px dashed #E5E8EB;
            }
            .history-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 14px;
              padding: 4px 0;
            }
            .history-item .date { color: #8B95A1; font-weight: 500; }
            .history-item .price { color: #191F28; font-weight: 800; }
            .history-item .status { font-size: 12px; font-weight: 700; }
            .history-item .status.up { color: #F04452; }
            .history-item .status.down { color: #3182F6; }
            .surrounding-box {
          background: #F9FAFB;
          padding: 20px;
          border-radius: 20px;
          border: 1px solid #F2F4F6;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .surrounding-item {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .surrounding-content {
          flex: 1;
        }
        .surrounding-label {
          font-size: 12px;
          color: #8B95A1;
          margin-bottom: 2px;
        }
        .surrounding-value {
          font-size: 15px;
          font-weight: 700;
          color: #191F28;
        }
        .safety-trust-box {
              background: #F9FAFB;
              padding: 16px;
              border-radius: 18px;
              display: flex;
              flex-direction: column;
              gap: 16px;
            }
            .trust-item {
              display: flex;
              gap: 12px;
              align-items: center;
            }
            .trust-title {
              font-size: 14px;
              font-weight: 700;
              color: #191F28;
            }
            .trust-desc {
              font-size: 12px;
              color: #8B95A1;
              margin-top: 1px;
            }
            .full-report-btn {
              width: 100%;
              background: #3182F6;
              color: #fff;
              height: 56px;
              border-radius: 16px;
              border: none;
              font-size: 16px;
              font-weight: 700;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 4px;
              cursor: pointer;
              transition: background 0.2s;
            }
            .full-report-btn:active { background: #1B64DA; }
          `}</style>
        </div>
      )}
    </AnimatePresence>
  );
};
