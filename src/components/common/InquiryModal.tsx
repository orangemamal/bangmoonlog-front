import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, ChevronDown } from 'lucide-react';

interface InquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialEmail?: string;
  initialType?: string;
  initialContent?: string;
}

export const InquiryModal: React.FC<InquiryModalProps> = ({
  isOpen,
  onClose,
  initialEmail = "",
  initialType = "",
  initialContent = ""
}) => {
  const [email, setEmail] = useState(initialEmail);
  const [type, setType] = useState(initialType);
  const [content, setContent] = useState(initialContent);

  // 초기값 반영
  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail);
      setType(initialType);
      setContent(initialContent);
    }
  }, [isOpen, initialEmail, initialType, initialContent]);

  const handleSubmit = () => {
    const subject = encodeURIComponent(`[방문Log 1:1문의] ${type}`);
    const body = encodeURIComponent(
      `답변받으실 이메일: ${email}\n` +
      `문의 유형: ${type}\n\n` +
      `-- 문의 내용 --\n${content}`
    );
    window.location.href = `mailto:bangmoonlog.cs@gmail.com?subject=${subject}&body=${body}`;
    alert("작성하신 내용으로 메일 앱을 실행합니다. 메일 앱에서 전송 버튼을 눌러주세요!");
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
          className="mypage__full-modal"
          style={{ zIndex: 3000, position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', backgroundColor: '#fff' }}
        >
          <div className="mypage__modal-header">
            <button onClick={onClose} className="back-btn">
              <ArrowLeft size={24} color="#333D4B" />
            </button>
            <h2>문의하기</h2>
          </div>

          <div className="mypage__inquiry-container">
            <div className="mypage__inquiry-content">
              <div className="mypage__inquiry-field">
                <label className="mypage__inquiry-label">답변받으실 이메일</label>
                <input
                  type="email"
                  placeholder="email@example.com"
                  className="mypage__inquiry-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="mypage__inquiry-field">
                <label className="mypage__inquiry-label">문의 유형</label>
                <div className="mypage__inquiry-input-wrap">
                  <select
                    className="mypage__inquiry-input mypage__inquiry-select"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="" disabled>카테고리 선택</option>
                    <option value="서비스 이용">서비스 이용 문의</option>
                    <option value="오류 제보">오류/버그 제보</option>
                    <option value="계정/인증">계정 및 인증 관련</option>
                    <option value="불건전 게시물">게시물 관련 제보</option>
                    <option value="기타">기타 문의</option>
                  </select>
                  <ChevronDown size={20} color="#8B95A1" className="mypage__inquiry-select-icon" />
                </div>
              </div>

              <div className="mypage__inquiry-field">
                <label className="mypage__inquiry-label">문의 내용</label>
                <div className="mypage__inquiry-input-wrap">
                  <textarea
                    className="mypage__inquiry-textarea"
                    placeholder="내용을 입력하세요."
                    maxLength={1000}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                  />
                  <div className="mypage__inquiry-counter">{content.length}/1000</div>
                </div>
              </div>
            </div>

            <div className="mypage__inquiry-footer">
              <button
                className="mypage__inquiry-submit"
                disabled={!email || !type || !content}
                onClick={handleSubmit}
              >
                문의하기
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
