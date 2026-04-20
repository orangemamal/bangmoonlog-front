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
        <div className="policy-summary">
          방문Log는 이용자의 개인정보 보호를 최우선으로 생각합니다. 본 방침은 구글, 카카오, 네이버 소셜 로그인 및 위치 정보 처리에 관한 세부 사항을 담고 있습니다.
        </div>

        <section>
          <h2>1. 개인정보의 수집 및 이용 목적</h2>
          <p>서비스는 다음의 목적을 위해 최소한의 개인정보를 수집하며, 목적 외 용도로는 이용되지 않습니다.</p>
          <ul>
            <li><strong>이용자 식별 및 회원 관리</strong>: 소셜 로그인 연동을 통한 서비스 가입 및 본인 확인</li>
            <li><strong>위치 기반 기능 제공</strong>: 리뷰 작성 시 실제 장소 방문 여부 확인 및 주변 정보 제공</li>
            <li><strong>고객 지원</strong>: 1:1 문의 대응 및 서비스 중요 공지사항 전달</li>
          </ul>
        </section>

        <section>
          <h2>2. 수집하는 개인정보 항목</h2>
          <p>서비스는 이용자가 동의한 범위 내에서만 정보를 수집합니다.</p>
          <ul>
            <li><strong>소셜 로그인 (필수)</strong>: 이메일 주소, 닉네임, 프로필 사진 (Google, Kakao, Naver 제공 정보)</li>
            <li><strong>위치 정보 (선택)</strong>: 리뷰 작성 시의 위경도(GPS) 좌표</li>
            <li><strong>자동 수집 항목</strong>: 접속 로그, 단말기 정보, 쿠키</li>
          </ul>
        </section>

        <section>
          <h2>3. 위치 정보의 처리</h2>
          <p>방문Log는 이용자의 리뷰 신뢰도를 확보하기 위해 위치 정보를 처리합니다. 수집된 GPS 정보는 해당 리뷰의 장소 매칭에만 사용되며, 실시간 위치 추적이나 이동 경로 저장 등은 수행하지 않습니다.</p>
        </section>

        <section>
          <h2>4. 개인정보의 보유 및 이용 기간</h2>
          <p>이용자의 개인정보는 원칙적으로 <strong>회원 탈퇴 시 지체 없이 파기</strong>합니다. 단, 이용자가 작성한 리뷰 콘텐츠는 서비스 운영 정책에 따라 별도로 보관될 수 있으며, 탈퇴 전 본인이 직접 삭제할 수 있습니다.</p>
        </section>

        <section>
          <h2>5. 정보주체의 권리와 행사 방법</h2>
          <p>이용자는 언제든지 자신의 정보를 조회, 수정하거나 서비스 내 '회원 탈퇴' 기능을 통해 동의를 철회할 수 있습니다. 개인정보와 관련된 문의는 고객센터(roomlog.cs@gmail.com)를 통해 처리 가능합니다.</p>
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
        .policy-content ul {
          padding-left: 20px;
          margin-top: 8px;
        }
        .policy-content li {
          margin-bottom: 8px;
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

export { Privacy };
