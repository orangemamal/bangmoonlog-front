import { useState, useEffect } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { HouseHeart, BookMarked, BellRing, SquareUserRound } from "lucide-react";
import { db } from "../../services/firebase";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { useAuth } from "../../hooks/useAuth";

export function Layout() {
  console.log("🗺️ [Layout] Rendering");
  const location = useLocation();
  const { user } = useAuth();
  const [hasUnread, setHasUnread] = useState(false);
  const isMapTab = location.pathname === "/";

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
