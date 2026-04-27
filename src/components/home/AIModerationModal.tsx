import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, XCircle, RefreshCw } from 'lucide-react';

interface AIModerationModalProps {
  aiStep: 'idle' | 'analyzing' | 'passed' | 'rejected' | 'error';
  aiReason: string | null;
  onClose: () => void;
}

export const AIModerationModal: React.FC<AIModerationModalProps> = ({
  aiStep,
  aiReason,
  onClose
}) => {
  if (aiStep === 'idle') return null;

  return (
    <motion.div
      className="ai-modal-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(8px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}
    >
      <motion.div
        className="ai-modal-content"
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        style={{
          width: '100%',
          maxWidth: '340px',
          backgroundColor: '#fff',
          borderRadius: '28px',
          padding: '32px 24px',
          textAlign: 'center',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}
      >
        <div className="ai-visual-area" style={{ marginBottom: '24px', position: 'relative' }}>
          {aiStep === 'analyzing' && (
            <div className="ai-scanning-animation">
              <div className="ai-core-orb"></div>
              <div className="ai-ring-one"></div>
              <div className="ai-ring-two"></div>
            </div>
          )}
          {aiStep === 'passed' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ai-status-icon success">
              <CheckCircle2 size={64} color="#3182F6" strokeWidth={2.5} />
            </motion.div>
          )}
          {aiStep === 'rejected' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ai-status-icon reject">
              <XCircle size={64} color="#F04452" strokeWidth={2.5} />
            </motion.div>
          )}
          {aiStep === 'error' && (
            <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="ai-status-icon error">
              <RefreshCw size={64} color="#8B95A1" strokeWidth={2.5} />
            </motion.div>
          )}
        </div>

        <h3 style={{
          fontSize: '20px',
          fontWeight: 700,
          color: '#191F28',
          marginBottom: '12px',
          lineHeight: 1.4
        }}>
          {aiStep === 'analyzing' && "AI가 내용을\n꼼꼼하게 읽고 있어요"}
          {aiStep === 'passed' && "클린한 리뷰 확인 완료!"}
          {aiStep === 'rejected' && "잠시만요!\n내용을 조금 수정해주세요"}
          {aiStep === 'error' && "AI가 잠시 자리를 비웠어요"}
        </h3>

        <p style={{
          fontSize: '15px',
          color: '#4E5968',
          lineHeight: 1.6,
          marginBottom: '28px',
          whiteSpace: 'pre-wrap'
        }}>
          {aiStep === 'analyzing' && "방문Log는 AI와 함께 건전한\n커뮤니티를 만들어가고 있습니다."}
          {aiStep === 'passed' && "부적절한 내용이 발견되지 않았습니다.\n지금 바로 등록을 완료합니다."}
          {aiStep === 'rejected' && (
            <>
              <span style={{ color: '#F04452', fontWeight: 600 }}>{aiReason}</span>
              {"\n위 사유로 인해 등록이 거절되었습니다.\n내용을 수정 후 다시 시도해주세요."}
            </>
          )}
          {aiStep === 'error' && (aiReason || "일시적인 오류가 발생했습니다.\n다시 시도해주시겠어요?")}
        </p>

        {(aiStep === 'rejected' || aiStep === 'error') && (
          <button
            onClick={onClose}
            style={{
              width: '100%',
              height: '56px',
              backgroundColor: '#3182F6',
              color: '#fff',
              borderRadius: '16px',
              border: 'none',
              fontSize: '16px',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            수정하러 가기
          </button>
        )}
      </motion.div>
    </motion.div>
  );
};
