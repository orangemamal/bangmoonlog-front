import React, { useState, useEffect } from "react";
import { Check, X, MapPin, PencilLine, ShieldCheck } from "lucide-react";
import LogoImg from "../../assets/images/favicon.svg";

interface WelcomeModalProps {
  onClose: () => void;
}

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onClose }) => {
  const [dontShowToday, setDontShowToday] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 마운트 후 약간의 지연을 주어 애니메이션 효과 극대화
    const timer = setTimeout(() => setIsVisible(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleClose = () => {
    if (dontShowToday) {
      const tomorrow = new Date();
      tomorrow.setHours(tomorrow.getHours() + 24);
      localStorage.setItem("welcome_modal_expiry", tomorrow.getTime().toString());
    }
    setIsVisible(false);
    setTimeout(onClose, 300); // 애니메이션 대기
  };

  return (
    <div className={`welcome-overlay ${isVisible ? "active" : ""}`}>
      <div className="welcome-modal">
        <div className="welcome-scroll-area">
          <div className="welcome-header">
            <img src={LogoImg} alt="Logo" className="welcome-logo" />
            <h2>세입자를 위해 만든<br />정보 공유 플랫폼입니다.</h2>
            <p className="subtitle"></p>
          </div>

          <div className="welcome-content">
            <div className="usage-item">
              <div className="icon-box green">
                <PencilLine size={20} />
              </div>
              <div className="text-box">
                <strong>생생한 경험 공유</strong>
                <p>살았던 곳의 후기를 남겨 다음 세입자에게 도움을 주세요.</p>
              </div>
            </div>

            <div className="usage-item">
              <div className="icon-box blue">
                <MapPin size={20} />
              </div>
              <div className="text-box">
                <strong>매물의 진짜 정보 확인</strong>
                <p>실제 거주자가 남긴 생생한 장단점과 사진을 확인하세요.</p>
              </div>
            </div>

            <div className="usage-item">
              <div className="icon-box purple">
                <ShieldCheck size={20} />
              </div>
              <div className="text-box">
                <strong>익명성 및 신뢰보장</strong>
                <p>데이터는 익명으로 보호되며 GPS로 실제 방문을 검증합니다.</p>
              </div>
            </div>

            <div className="location-notice">
              <div className="notice-header">
                <MapPin size={14} color="#3182F6" />
                <span>위치 권한이 왜 필요한가요?</span>
              </div>
              <p>권한을 허용해주시면 <strong>실제 방문자 인증 뱃지</strong>를 획득할 수 있고, <strong>내 주변의 실시간 방문록</strong>을 바로 확인할 수 있어요! (미허용 시 일부 기능이 제한됩니다)</p>
            </div>
          </div>
        </div>

        <div className="welcome-footer">
          <label className="dont-show" onClick={() => setDontShowToday(!dontShowToday)}>
            <div className={`checkbox ${dontShowToday ? "checked" : ""}`}>
              {dontShowToday && <Check size={14} strokeWidth={3} />}
            </div>
            <span>오늘 하루 보지 않기</span>
          </label>
          <button className="start-btn" onClick={handleClose}>
            시작하기
          </button>
        </div>

        <button className="close-x" onClick={handleClose}>
          <X size={20} />
        </button>
      </div>
    </div>
  );
};
