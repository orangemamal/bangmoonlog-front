import React from 'react';
import { useNavigate } from 'react-router-dom';

const Privacy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="policy-container">
      <header className="policy-header">
        <button onClick={() => navigate(-1)} className="back-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1>개인정보처리방침</h1>
      </header>
      
      <main className="policy-content">
        <section>
          <h2>1. 개인정보의 수집 및 이용 목적</h2>
          <p>방문Log는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.</p>
          <ul>
            <li>서비스 회원가입 및 관리</li>
            <li>서비스 제공 및 이용자 식별</li>
            <li>콘텐츠(방문록, 리뷰) 작성 및 관리</li>
          </ul>
        </section>

        <section>
          <h2>2. 수집하는 개인정보 항목</h2>
          <p>서비스 이용을 위해 수집하는 항목은 다음과 같습니다.</p>
          <ul>
            <li>필수항목: 닉네임, 이메일 주소, 프로필 사진</li>
            <li>자동수집항목: IP 주소, 쿠키, 방문 일시, 서비스 이용 기록</li>
          </ul>
        </section>

        <section>
          <h2>3. 개인정보의 보유 및 이용 기간</h2>
          <p>회원 탈퇴 시까지 개인정보를 보유하며, 탈퇴 시 지체 없이 파기합니다. 단, 관계 법령에 따라 보존할 필요가 있는 경우 해당 기간 동안 보관합니다.</p>
        </section>

        <section>
          <h2>4. 개인정보의 파기 절차 및 방법</h2>
          <p>수집 목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 전자적 파일 형태는 기록을 재생할 수 없는 기술적 방법을 사용하여 삭제합니다.</p>
        </section>

        <section>
          <h2>5. 이용자의 권리 및 의무</h2>
          <p>이용자는 언제든지 자신의 개인정보를 조회하거나 수정할 수 있으며, 회원 탈퇴를 통해 개인정보 이용에 대한 동의를 철회할 수 있습니다.</p>
        </section>

        <section>
          <p className="policy-footer">본 방침은 2024년 4월 20일부터 적용됩니다.</p>
        </section>
      </main>

      <style>{`
        .policy-container {
          min-height: 100vh;
          background: #ffffff;
          padding-bottom: 40px;
        }
        .policy-header {
          display: flex;
          align-items: center;
          padding: 16px;
          border-bottom: 1px solid #f0f0f0;
          position: sticky;
          top: 0;
          background: #ffffff;
          z-index: 10;
        }
        .policy-header h1 {
          font-size: 18px;
          font-weight: 700;
          margin-left: 12px;
          color: #1a1a1a;
        }
        .back-button {
          background: none;
          border: none;
          padding: 4px;
          cursor: pointer;
          color: #333;
        }
        .policy-content {
          padding: 24px 20px;
          line-height: 1.6;
          color: #4a4a4a;
        }
        .policy-content section {
          margin-bottom: 30px;
        }
        .policy-content h2 {
          font-size: 15px;
          font-weight: 700;
          color: #1a1a1a;
          margin-bottom: 10px;
        }
        .policy-content p, .policy-content li {
          font-size: 14px;
          color: #666;
        }
        .policy-content ul {
          padding-left: 20px;
          margin-top: 8px;
        }
        .policy-content li {
          margin-bottom: 4px;
        }
        .policy-footer {
          margin-top: 40px;
          font-size: 13px !important;
          color: #999 !important;
          text-align: center;
        }
      `}</style>
    </div>
  );
};

export { Privacy };
