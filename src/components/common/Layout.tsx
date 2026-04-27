import { useState, useEffect, useRef } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { HouseHeart, BookMarked, BellRing, SquareUserRound } from "lucide-react";
import { db } from "../../services/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../../hooks/useAuth";
import { Toast } from "./Toast";
import LogoImg from "../../assets/images/favicon.svg";

export function Layout() {
  console.log("🗺️ [Layout] Rendering");
  const location = useLocation();
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);
  const isMapTab = location.pathname === "/";
  const [showExitToast, setShowExitToast] = useState(false);
  const lastBackPressRef = useRef<number>(0);

  // [WebView/Mobile] 하드웨어 뒤로가기 버튼 핸들링 (홈 화면 종료 방어)
  useEffect(() => {
    // 홈 경로(/)일 때만 뒤로가기를 가로채서 종료 토스트를 띄웁니다.
    if (location.pathname === '/') {
      // 가상 히스토리 추가
      window.history.pushState({ isHome: true }, '', window.location.href);

      const handlePopState = (e: PopStateEvent) => {
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          // 2초 내에 두 번 누름 -> 종료 처리
          window.history.go(-2);
        } else {
          // 첫 번째 누름 -> 토스트 노출
          lastBackPressRef.current = now;
          setShowExitToast(true);
          // 다시 가상 히스토리 추가하여 다음 뒤로가기를 대기
          window.history.pushState({ isHome: true }, '', window.location.href);
        }
      };

      window.addEventListener('popstate', handlePopState);
      return () => window.removeEventListener('popstate', handlePopState);
    }
  }, [location.pathname]);

  useEffect(() => {
    // Naver Map SDK Global Loading
    const SCRIPT_ID = "naver-map-script";
    if (!document.getElementById(SCRIPT_ID)) {
      const s = document.createElement("script");
      s.id = SCRIPT_ID;
      s.src = "https://openapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=dj5vfj5th7&submodules=geocoder,panorama";
      s.async = true;
      s.onload = () => {
        window.dispatchEvent(new Event('naver-map-loaded'));
        console.log("✅ [Layout] Naver Map SDK Loaded");
      };
      document.head.appendChild(s);
    } else {
      // 이미 로드되어 있는 경우에도 이벤트를 한 번 더 쏴줌
      window.dispatchEvent(new Event('naver-map-loaded'));
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    
    // 실시간 리스너 (onSnapshot)를 통해 새 알림이 오는 즉시 배지 업데이트
    const q = query(
      collection(db, "notifications"), 
      where("toUserId", "==", user.id),
      where("isRead", "==", false)
    );
    
    const unsubscribe = onSnapshot(q, (snap: any) => {
      const unreadCount = snap.size;
      setHasUnread(unreadCount > 0);
      console.log(`[Notification Badge] Unread count updated: ${unreadCount}`);
    }, (error: any) => {
      console.error("[Notification Badge] onSnapshot error:", error);
    });

    return () => unsubscribe();
  }, [user?.id]);

  return (
    <div className="app-layout">
      <main className={`main-content${isMapTab ? "" : " has-bottom-nav"}`}>
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <NavItem to="/" icon={<HouseHeart size={24} />} label="홈" />
        <NavItem to="/feed" icon={<BookMarked size={24} />} label="방문록" />
        <NavItem to="/notifications" icon={<BellRing size={24} />} label="알림" hasUnread={hasUnread} />
        <NavItem to="/mypage" icon={<SquareUserRound size={24} />} label="내 정보" />
      </nav>

      <Toast
        message="버튼을 한 번 더 누르면 종료됩니다."
        isVisible={showExitToast}
        onClose={() => setShowExitToast(false)}
        icon={LogoImg}
      />
    </div>
  );
}

function NavItem({
  to, icon, label, hasUnread,
}: {
  to: string; icon: React.ReactNode; label: string; hasUnread?: boolean;
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
    >
      {({ isActive }) => (
        <>
          <span className={`nav-item__icon${isActive ? " active" : ""}`}>
            {icon}
            {hasUnread && <span className="nav-item__badge" />}
          </span>
          <span className="nav-item__label">{label}</span>
        </>
      )}
    </NavLink>
  );
}
