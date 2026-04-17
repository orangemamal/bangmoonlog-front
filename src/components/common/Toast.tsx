import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastProps {
  message: string;
  duration?: number;
  isVisible: boolean;
  onClose: () => void;
  icon?: string;
}

export const Toast: React.FC<ToastProps> = ({ message, duration = 2000, isVisible, onClose, icon }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [isVisible, duration, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: 20, x: '-50%' }}
          style={{
            position: 'fixed',
            bottom: '100px',
            left: '50%',
            backgroundColor: 'rgba(51, 61, 75, 0.95)',
            color: '#fff',
            padding: '12px 20px',
            borderRadius: '24px',
            fontSize: '14px',
            fontWeight: 500,
            zIndex: 9999,
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          {icon && <img src={icon} alt="toast-icon" style={{ width: '18px', height: '18px', borderRadius: '4px' }} />}
          <span>{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
