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
        <section>
          <h2>제 1 조 (목적)</h2>
          <p>본 약관은 방문Log(이하 "서비스")가 제공하는 모든 서비스의 이용조건 및 절차, 이용자와 서비스 운영자의 권리, 의무, 책임사항을 규정함을 목적으로 합니다.</p>
        </section>

        <section>
          <h2>제 2 조 (용어의 정의)</h2>
          <ol>
            <li>"이용자"란 서비스에 접속하여 본 약관에 따라 서비스를 이용하는 회원 및 비회원을 말합니다.</li>
            <li>"회원"이란 서비스에 개인정보를 제공하여 회원등록을 한 자로서, 서비스의 정보를 지속적으로 제공받으며 서비스를 계속적으로 이용할 수 있는 자를 말합니다.</li>
          </ol>
        </section>

        <section>
          <h2>제 3 조 (약관의 효력 및 변경)</h2>
          <p>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 이용자에게 공지함으로써 효력이 발생합니다. 서비스는 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.</p>
        </section>

        <section>
          <h2>제 4 조 (서비스의 제공 및 변경)</h2>
          <p>서비스는 방문록 작성, 장소 검색, 리뷰 공유 등의 기능을 제공하며, 운영상 필요한 경우 서비스의 내용을 변경할 수 있습니다.</p>
        </section>

        <section>
          <h2>제 5 조 (회원의 의무)</h2>
          <p>회원은 타인의 정보를 도용하거나 서비스의 운영을 방해하는 행위를 해서는 안 됩니다. 부적절한 콘텐츠 게시 시 예고 없이 삭제될 수 있습니다.</p>
        </section>

        <section>
          <p className="policy-footer">본 약관은 2024년 4월 20일부터 적용됩니다.</p>
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
        .policy-content ol {
          padding-left: 20px;
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

export { Terms };
