import React from 'react';
import { useNavigate } from 'react-router-dom';

const Terms: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="policy-container">
      <header className="policy-header">
        <button onClick={() => navigate(-1)} className="back-button">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        </button>
        <h1>이용약관</h1>
      </header>
      
      <main className="policy-content">
        <div className="policy-summary">
          방문Log 서비스 이용을 환영합니다. 본 약관은 리얼 부동산 리뷰 서비스 제공과 관련하여 이용자와 회사 간의 권리와 의무를 규정합니다.
        </div>

        <section>
          <h2>제 1 조 (목적)</h2>
          <p>본 약관은 "방문Log"(이하 "서비스")가 제공하는 부동산 방문록 작성, 위치 기반 정보 제공, 커뮤니티 기능 등의 이용과 관련하여 이용자와 운영자의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.</p>
        </section>

        <section>
          <h2>제 2 조 (용어의 정의)</h2>
          <ul>
            <li><strong>"서비스"</strong>: 이용자가 방문한 장소에 대한 리뷰를 남기고 정보를 공유할 수 있는 플랫폼을 의미합니다.</li>
            <li><strong>"이용자"</strong>: 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
            <li><strong>"리뷰(방문록)"</strong>: 이용자가 서비스 내에 게시한 글, 사진, 위치 정보 등을 의미합니다.</li>
          </ul>
        </section>

        <section>
          <h2>제 3 조 (위치 기반 서비스)</h2>
          <ol>
            <li>서비스는 이용자의 현재 위치를 기반으로 주변 부동산의 리뷰를 보여주거나, 방문한 장소의 위치를 인증하는 기능을 제공합니다.</li>
            <li>이용자의 GPS 정보는 리뷰 작성 시 정확한 장소 확인을 위해서만 사용되며, 별도의 마케팅 목적으로 활용되지 않습니다.</li>
          </ol>
        </section>

        <section>
          <h2>제 4 조 (회원가입 및 소셜 로그인)</h2>
          <p>이용자는 구글, 카카오, 네이버 등 소셜 계정 연동을 통해 간편하게 서비스를 이용할 수 있으며, 이 과정에서 제공받는 정보는 본인의 동의 하에 최소한의 정보(이메일, 이름, 프로필 사진)로 제한됩니다.</p>
        </section>

        <section>
          <h2>제 5 조 (리뷰의 관리 및 책임)</h2>
          <ol>
            <li>이용자가 게시한 리뷰의 저작권은 해당 이용자에게 있으며, 서비스는 효율적인 노출을 위해 리뷰의 일부를 편집하거나 가공할 수 있습니다.</li>
            <li>부적절한 내용(허위 사실, 비속어, 광고성 글)을 게시할 경우 운영정책에 의해 예고 없이 삭제될 수 있으며, 이에 대한 책임은 작성자 본인에게 있습니다.</li>
          </ol>
        </section>

        <section>
          <h2>제 6 조 (서비스의 중단 및 변경)</h2>
          <p>서비스는 기술적 필요에 따라 내용을 변경하거나 일시 중단할 수 있으며, 중요 변경 사항은 서비스 내 공지사항을 통해 사전에 고지합니다.</p>
        </section>

        <section className="policy-footer-section">
          <p className="policy-footer">공고일자: 2026년 4월 20일</p>
          <p className="policy-footer">시행일자: 2026년 4월 20일</p>
        </section>
      </main>

      <style>{`
        .policy-container {
          min-height: 100vh;
          background: #ffffff;
          padding-bottom: 60px;
          max-width: 600px;
          margin: 0 auto;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }
        .policy-header {
          display: flex;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #F2F4F6;
          position: sticky;
          top: 0;
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
          z-index: 10;
        }
        .policy-header h1 {
          font-size: 18px;
          font-weight: 700;
          margin-left: 12px;
          color: #191F28;
        }
        .back-button {
          background: #F2F4F6;
          border: none;
          padding: 6px;
          border-radius: 8px;
          cursor: pointer;
          color: #333D4B;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .policy-content {
          padding: 24px 20px;
          line-height: 1.7;
          color: #4E5968;
        }
        .policy-summary {
          background: #F9FAFB;
          padding: 16px;
          border-radius: 12px;
          margin-bottom: 32px;
          font-size: 14px;
          color: #333D4B;
          border: 1px solid #F2F4F6;
        }
        .policy-content section {
          margin-bottom: 32px;
        }
        .policy-content h2 {
          font-size: 16px;
          font-weight: 700;
          color: #191F28;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
        }
        .policy-content h2:before {
          content: "";
          display: inline-block;
          width: 4px;
          height: 16px;
          background: #3182F6;
          margin-right: 10px;
          border-radius: 2px;
        }
        .policy-content p, .policy-content li {
          font-size: 14px;
          color: #4E5968;
          margin-bottom: 8px;
        }
        .policy-content ul, .policy-content ol {
          padding-left: 20px;
        }
        .policy-content strong {
          color: #333D4B;
        }
        .policy-footer-section {
          margin-top: 48px;
          padding-top: 24px;
          border-top: 1px solid #F2F4F6;
          text-align: center;
        }
        .policy-footer {
          font-size: 13px !important;
          color: #8B95A1 !important;
          margin-bottom: 4px;
        }
      `}</style>
    </div>
  );
};

export { Terms };
