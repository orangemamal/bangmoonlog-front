import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#F2F4F6',
      padding: '0 24px',
      textAlign: 'center'
    }}>
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        <span style={{ fontSize: '80px', marginBottom: '24px', display: 'block' }}>🚧</span>
      </motion.div>
      
      <h1 style={{
        fontSize: '24px',
        fontWeight: 700,
        color: '#191F28',
        marginBottom: '12px'
      }}>길을 잃으셨나요?</h1>
      
      <p style={{
        fontSize: '16px',
        color: '#4E5968',
        marginBottom: '32px',
        lineHeight: 1.6
      }}>
        요청하신 페이지를 찾을 수 없습니다.<br />
        입력하신 주소가 정확한지 확인해 주세요.
      </p>

      <button
        onClick={() => navigate('/', { replace: true })}
        style={{
          width: '100%',
          maxWidth: '280px',
          height: '56px',
          backgroundColor: '#3182F6',
          color: '#ffffff',
          border: 'none',
          borderRadius: '16px',
          fontSize: '16px',
          fontWeight: 600,
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(49, 130, 246, 0.2)'
        }}
      >
        홈으로 돌아가기
      </button>

      <p style={{
        marginTop: '24px',
        fontSize: '14px',
        color: '#8B95A1',
        cursor: 'pointer',
        textDecoration: 'underline'
      }} onClick={() => window.history.back()}>
        이전 페이지로
      </p>
    </div>
  );
};
