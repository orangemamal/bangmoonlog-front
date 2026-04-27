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
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const lastBackPressRef = useRef<number>(0);
  const lastVersionCheckRef = useRef<number>(0);

  // [Update Check] 서버의 최신 배포 버전 확인 로직
  const checkForUpdate = async () => {
    // 1분 이내 중복 체크 방지
    const now = Date.now();
    if (now - lastVersionCheckRef.current < 60000) return;
    lastVersionCheckRef.current = now;

    try {
      // index.html을 캐시 없이 새로 불러와서 현재 스크립트 해시와 비교
      const response = await fetch(`${window.location.origin}/index.html?t=${now}`, { cache: 'no-store' });
      const html = await response.text();
      
      // 현재 페이지에 로드된 메인 스크립트 파일명을 찾습니다 (Rsbuild/Vite의 해시 포함 파일명)
      const currentScript = Array.from(document.scripts).find(s => s.src.includes('/index.'))?.src || "";
      const currentHash = currentScript.split('.').reverse()[1]; // index.[hash].js 에서 hash 추출

      // 새로 받아온 HTML에서 스크립트 태그 추출
      const scriptMatch = html.match(/src="\/static\/js\/index\.([a-z0-9]+)\.js"/i) || 
                          html.match(/src="\/index\.([a-z0-9]+)\.js"/i);
      
      if (scriptMatch && scriptMatch[1]) {
        const newHash = scriptMatch[1];
        if (currentHash && newHash !== currentHash) {
          console.log("🚀 [Update] New version detected!", { currentHash, newHash });
          setShowUpdateToast(true);
        }
      }
    } catch (e) {
      console.warn("⚠️ [Update Check] Failed to check for updates:", e);
    }
  };

  // 페이지 이동 및 앱 복귀 시 업데이트 체크 트리거
  useEffect(() => {
    checkForUpdate();
    
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') checkForUpdate();
    };
    
    window.addEventListener('visibilitychange', handleVisibilityChange);
    return () => window.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [location.pathname]);

  // [WebView/Mobile] 하드웨어 뒤로가기 버튼 핸들링 (메인 화면 종료 방어)
  useEffect(() => {
    // ... 기존 코드 유지 (생략 방지를 위해 아래 TargetContent와 일치하도록 작성)
    const mainTabs = ["/", "/feed", "/notifications", "/mypage"];
    const isMainTab = mainTabs.includes(location.pathname);

    if (isMainTab) {
      if (!window.history.state?.isAppRoot) {
        window.history.pushState({ isAppRoot: true }, "", window.location.href);
      }

      const handlePopState = (e: PopStateEvent) => {
        const now = Date.now();
        if (now - lastBackPressRef.current < 2000) {
          window.history.go(-2);
        } else {
          lastBackPressRef.current = now;
          setShowExitToast(true);
          window.history.pushState({ isAppRoot: true }, "", window.location.href);
        }
      };

      window.addEventListener("popstate", handlePopState);
      return () => window.removeEventListener("popstate", handlePopState);
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
      window.dispatchEvent(new Event('naver-map-loaded'));
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    
    const q = query(
      collection(db, "notifications"), 
      where("toUserId", "==", user.id),
      where("isRead", "==", false)
    );
    
    const unsubscribe = onSnapshot(q, (snap: any) => {
      const unreadCount = snap.size;
      setHasUnread(unreadCount > 0);
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

      {/* 뒤로가기 종료 알림 */}
      <Toast
        message="버튼을 한 번 더 누르면 종료됩니다."
        isVisible={showExitToast}
        onClose={() => setShowExitToast(false)}
        icon={LogoImg}
      />

      {/* 새 버전 업데이트 알림 */}
      {showUpdateToast && (
        <div className="update-toast-overlay">
          <div className="update-toast">
            <div className="update-toast__content">
              <div className="update-toast__icon">🚀</div>
              <div className="update-toast__text">
                <strong>새로운 기능이 추가되었습니다!</strong>
                <span>더 나은 경험을 위해 업데이트할까요?</span>
              </div>
            </div>
            <button 
              className="update-toast__btn"
              onClick={() => window.location.reload()}
            >
              업데이트
            </button>
          </div>
        </div>
      )}
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
