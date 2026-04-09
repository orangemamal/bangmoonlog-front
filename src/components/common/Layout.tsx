import { Outlet, NavLink, useLocation } from "react-router-dom";
import { Map, List, Bell, User } from "lucide-react";

export function Layout() {
  const location = useLocation();
  const isMapTab = location.pathname === "/";

  return (
    <div className="app-layout">
      <main className={`main-content${isMapTab ? "" : " has-bottom-nav"}`}>
        <Outlet />
      </main>

      <nav className="bottom-nav">
        <NavItem to="/"             icon={<Map  size={24} />} label="홈" />
        <NavItem to="/feed"         icon={<List size={24} />} label="방문록" />
        <NavItem to="/notifications" icon={<Bell size={24} />} label="알림" hasUnread />
        <NavItem to="/mypage"       icon={<User size={24} />} label="내 정보" />
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
