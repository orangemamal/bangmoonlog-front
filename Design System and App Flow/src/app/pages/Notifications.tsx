import { Heart, MapPin, Award, CheckCircle2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Notifications() {
  const notifications = [
    {
      id: 1,
      type: "reaction",
      content: "내 '자양동 빌라' 방문록에 12명이 공감했어요! 🧡",
      time: "방금 전",
      isUnread: true,
      icon: <Heart size={20} className="fill-[#F04452] text-[#F04452]" />,
      bg: "bg-[#FFF0F0]"
    },
    {
      id: 2,
      type: "local",
      content: "종민님이 찜한 '화양동' 지역에 새로운 '바퀴벌레 주의' 방문록이 올라왔어요.",
      time: "2시간 전",
      isUnread: true,
      icon: <MapPin size={20} className="text-[#3182F6]" />,
      bg: "bg-[#E8F3FF]"
    },
    {
      id: 3,
      type: "system",
      content: "실제 방문자 인증이 승인되었습니다. 발도장 뱃지를 확인하세요!",
      time: "1일 전",
      isUnread: false,
      icon: <Award size={20} className="text-[#00A968]" />,
      bg: "bg-[#E6F8F3]"
    },
    {
      id: 4,
      type: "reaction",
      content: "내 '성수동 옥탑방' 방문록에 5명이 댓글을 달았어요.",
      time: "3일 전",
      isUnread: false,
      icon: <Heart size={20} className="fill-[#F04452] text-[#F04452]" />,
      bg: "bg-[#FFF0F0]"
    }
  ];

  return (
    <div className="w-full h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 sticky top-0 bg-white z-10 border-b border-[#F2F4F6]">
        <h1 className="text-[20px] font-bold text-[#333D4B]">알림</h1>
      </div>

      {/* Notification List */}
      <div className="flex-1 overflow-y-auto">
        {notifications.map((noti) => (
          <div 
            key={noti.id} 
            className={cn(
              "px-6 py-4 border-b border-[#F2F4F6] flex gap-4 transition-colors cursor-pointer",
              noti.isUnread ? "bg-[#F9FAFB]" : "hover:bg-[#F9FAFB]"
            )}
          >
            {/* Icon */}
            <div className={cn("w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0", noti.bg)}>
              {noti.icon}
            </div>

            {/* Content Area */}
            <div className="flex-1 relative pr-6">
              <p className="text-[15px] text-[#333D4B] leading-snug break-keep">
                {noti.content}
              </p>
              <span className="text-[12px] text-[#8B95A1] mt-1.5 inline-block">
                {noti.time}
              </span>

              {/* Unread Indicator */}
              {noti.isUnread && (
                <div className="absolute top-1 right-0 w-[6px] h-[6px] bg-[#3182F6] rounded-full" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
