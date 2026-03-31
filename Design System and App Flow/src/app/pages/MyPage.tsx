import { useState } from "react";
import { Award, Heart, ChevronRight, Bookmark, Clock, Edit3, Settings, HelpCircle } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function MyPage() {
  const [isLoggedIn, setIsLoggedIn] = useState(false); // simple mock state for demonstration

  if (!isLoggedIn) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-white px-[24px]">
        <div className="w-20 h-20 bg-[#F2F4F6] rounded-full mb-6 flex items-center justify-center">
          <Award size={40} className="text-[#3182F6]" />
        </div>
        <h2 className="text-[20px] font-bold text-[#333D4B] mb-2 text-center">
          리얼한 거주 후기,<br/>지금 바로 확인해보세요!
        </h2>
        <p className="text-[15px] text-[#6B7684] mb-8 text-center break-keep">
          로그인하고 전국 방방곡곡의 솔직 담백한<br/>방문록을 구경해보세요.
        </p>
        <button 
          onClick={() => setIsLoggedIn(true)}
          className="w-full bg-[#3182F6] text-white rounded-[16px] py-4 text-[16px] font-bold shadow-[0_4px_16px_rgba(49,130,246,0.3)] transition-transform active:scale-[0.98]"
        >
          토스로 3초 만에 시작하기
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-[#F2F4F6]">
      {/* Profile Section */}
      <div className="bg-white px-[24px] pt-10 pb-6 rounded-b-[24px] shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#E8F3FF] flex items-center justify-center overflow-hidden">
              <span className="text-[24px] font-bold text-[#3182F6]">오</span>
            </div>
            <div>
              <h1 className="text-[20px] font-bold text-[#333D4B]">오종민 님</h1>
              <p className="text-[13px] text-[#8B95A1] mt-1">ojongmin@toss.im</p>
            </div>
          </div>
          <button className="px-3 py-1.5 bg-[#F2F4F6] text-[#4E5968] rounded-[8px] text-[13px] font-semibold">
            프로필 수정
          </button>
        </div>

        {/* Trust Index (Stats) */}
        <div className="flex gap-4">
          <div className="flex-1 bg-[#F9FAFB] rounded-[16px] p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#E8F3FF] rounded-full flex items-center justify-center text-[#3182F6]">
              <Award size={20} />
            </div>
            <div>
              <p className="text-[12px] text-[#6B7684] mb-0.5">발도장 뱃지</p>
              <p className="text-[16px] font-bold text-[#333D4B]">12개</p>
            </div>
          </div>
          <div className="flex-1 bg-[#F9FAFB] rounded-[16px] p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFF0F0] rounded-full flex items-center justify-center text-[#F04452]">
              <Heart size={20} className="fill-[#F04452]" />
            </div>
            <div>
              <p className="text-[12px] text-[#6B7684] mb-0.5">도움돼요 누적</p>
              <p className="text-[16px] font-bold text-[#333D4B]">840개</p>
            </div>
          </div>
        </div>
      </div>

      {/* Activity Menu */}
      <div className="flex-1 mt-3 px-[24px] bg-white pt-6 space-y-2 overflow-y-auto">
        <h3 className="text-[15px] font-bold text-[#333D4B] mb-2 px-2">나의 활동</h3>
        <MenuItem icon={<Edit3 size={20} className="text-[#333D4B]" />} title="내가 쓴 방문록" />
        <MenuItem icon={<Bookmark size={20} className="text-[#333D4B]" />} title="저장한 건물" />
        <MenuItem icon={<Clock size={20} className="text-[#333D4B]" />} title="최근 본 방문록" />

        <div className="h-4" /> {/* Spacer */}
        <h3 className="text-[15px] font-bold text-[#333D4B] mb-2 px-2">설정 및 도움말</h3>
        <MenuItem icon={<Settings size={20} className="text-[#333D4B]" />} title="알림 설정 (관심 지역 설정)" />
        <MenuItem icon={<HelpCircle size={20} className="text-[#333D4B]" />} title="사업자 등록 문의" />
      </div>
    </div>
  );
}

function MenuItem({ icon, title }: { icon: React.ReactNode, title: string }) {
  return (
    <button className="w-full flex items-center justify-between py-4 px-2 hover:bg-[#F9FAFB] rounded-[12px] transition-colors group">
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-[16px] font-medium text-[#4E5968] group-hover:text-[#333D4B] transition-colors">
          {title}
        </span>
      </div>
      <ChevronRight size={20} className="text-[#D1D6DB]" />
    </button>
  );
}
