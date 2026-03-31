import { Outlet, NavLink, useLocation } from "react-router";
import { Map, List, Bell, User } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Layout() {
  const location = useLocation();
  const isMapTab = location.pathname === "/";

  return (
    <div className="flex flex-col h-screen w-full bg-[#F2F4F6] text-[#333D4B] font-['Pretendard',sans-serif] relative overflow-hidden">
      {/* Main Content Area */}
      <main className={cn(
        "flex-1 overflow-y-auto w-full",
        isMapTab ? "pb-0" : "pb-[80px]" // Bottom nav space
      )}>
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 w-full h-[80px] bg-white border-t border-gray-200 flex items-center justify-around px-2 z-50 rounded-t-[16px] shadow-[0_-4px_16px_rgba(0,0,0,0.04)]">
        <NavItem to="/" icon={<Map size={24} />} label="홈" />
        <NavItem to="/feed" icon={<List size={24} />} label="방문록" />
        <NavItem to="/notifications" icon={<Bell size={24} />} label="알림" hasUnread={true} />
        <NavItem to="/mypage" icon={<User size={24} />} label="내 정보" />
      </nav>
    </div>
  );
}

function NavItem({ to, icon, label, hasUnread }: { to: string; icon: React.ReactNode; label: string; hasUnread?: boolean }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex flex-col items-center justify-center gap-1 w-16 h-full relative",
          isActive ? "text-[#3182F6]" : "text-[#6B7684]"
        )
      }
    >
      {({ isActive }) => (
        <>
          <div className="relative">
            {icon}
            {hasUnread && (
              <span className="absolute -top-0.5 -right-0.5 w-[6px] h-[6px] bg-[#F04452] rounded-full ring-2 ring-white" />
            )}
          </div>
          <span className="text-[10px] font-medium">{label}</span>
        </>
      )}
    </NavLink>
  );
}
