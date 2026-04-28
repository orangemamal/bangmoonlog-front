import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from "../../hooks/useAuth";
import { ArrowLeft, ChevronDown } from 'lucide-react';
import emailjs from '@emailjs/browser';

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
  const { user } = useAuth();
  const [email, setEmail] = useState(initialEmail);
  const [type, setType] = useState(initialType);
  const [content, setContent] = useState(initialContent);
  const [title, setTitle] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 초기값 반영
  useEffect(() => {
    if (isOpen) {
      setEmail(initialEmail || user?.email || "");
      setType(initialType || "");
      setContent(initialContent);
      setTitle("");
    }
  }, [isOpen, initialEmail, user?.email, initialType, initialContent]);

  const handleSubmit = async () => {
    if (!email || !type || !title || !content) return;
    
    setIsSubmitting(true);
    try {
      const { db } = await import("../../services/firebase");
      const { collection, addDoc, serverTimestamp } = await import("firebase/firestore");
      
      await addDoc(collection(db, "inquiries"), {
        email,
        type,
        title,
        content,
        userId: user?.id || "guest",
        createdAt: serverTimestamp(),
        status: "pending"
      });

      // EmailJS로 관리자에게 메일 발송
      await emailjs.send(
        "service_u7yayeo", 
        "template_3qijmbl",
        {
          category: type.replace('/', ' 및 '), // '/' 깨짐 방지를 위해 치환
          title: title,         // 템플릿의 {{title}}
          name: user?.displayName || user?.name || "익명 사용자", // 템플릿의 {{name}}
          email: email,          // 템플릿의 {{email}}
          message: content,      // 템플릿의 {{message}}
          time: new Date().toLocaleString(), // 템플릿의 {{time}}
        },
        "lSpfHBGqKwakZIK-t"
      );

      alert("문의가 성공적으로 접수되었습니다. 최대한 빨리 답변드릴게요! ✉️");
      onClose();
    } catch (e) {
      console.error("Inquiry submission error:", e);
      alert("접수 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
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
                <label className="mypage__inquiry-label">문의 제목</label>
                <input
                  type="text"
                  placeholder="제목을 입력하세요."
                  className="mypage__inquiry-input"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
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
                disabled={!email || !type || !content || isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "접수 중..." : "문의하기"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
