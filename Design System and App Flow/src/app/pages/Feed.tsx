import { useState } from "react";
import { Heart, Eye, MapPin, MoreVertical } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function Feed() {
  const [activeTab, setActiveTab] = useState<"hot" | "local">("hot");

  const mockData = [
    {
      id: 1,
      type: "hot",
      tag: "#빌런집주인",
      tagColor: "bg-[#FFF0F0] text-[#E84040]",
      date: "2026.03.30",
      location: "광진구 자양동",
      content: "진짜 역대급 빌런 집주인 만났습니다. 보일러 고장난 거 3주째 안 고쳐주고, 월세만 꼬박꼬박 받아가네요. 겨울인데 너무 추워서 매일 밤 전기장판에만 의지하고 있습니다. 절대 이 건물 오지 마세요.",
      image: "https://images.unsplash.com/photo-1566699270403-3f7e3f340664?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtZXNzeSUyMHJvb218ZW58MXx8fHwxNzc0ODQ5NTM1fDA&ixlib=rb-4.1.0&q=80&w=1080",
      likes: 124,
      views: 3400
    },
    {
      id: 2,
      type: "hot",
      tag: "#인테리어자랑",
      tagColor: "bg-[#E8F3FF] text-[#3182F6]",
      date: "2026.03.28",
      location: "성동구 성수동",
      content: "성수동 옥탑방 리모델링 후기입니다! 처음엔 진짜 폐가 수준이었는데, 바닥 공사하고 벽지 뜯어내고 화이트 톤으로 다 맞추니까 환골탈태했어요. 채광이 너무 좋아서 낮에는 불 안 켜도 환해요.",
      image: "https://images.unsplash.com/photo-1600592858560-9fef0f602f40?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxicmlnaHQlMjBsaXZpbmclMjByb29tJTIwc3VubGlnaHR8ZW58MXx8fHwxNzc0ODQ5NTM1fDA&ixlib=rb-4.1.0&q=80&w=1080",
      likes: 89,
      views: 1205
    },
    {
      id: 3,
      type: "local",
      tag: "#수압체크필수",
      tagColor: "bg-[#F3F4F6] text-[#6B7684]",
      date: "2026.03.29",
      location: "강남구 역삼동",
      content: "역삼동 오피스텔인데, 수압이 정말 약해요. 샤워기 물줄기가 너무 가늘어서 머리 감는데 한참 걸립니다. ㅠㅠ 입주하실 분들은 수압 꼭 확인하고 계약하세요.",
      image: "https://images.unsplash.com/photo-1512845296467-183ccf124347?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhcGFydG1lbnQlMjBleHRlcmlvcnxlbnwxfHx8fDE3NzQ4NDk1MzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      likes: 45,
      views: 670
    },
    {
      id: 4,
      type: "local",
      tag: "#방음맛집",
      tagColor: "bg-[#E6F8F3] text-[#00A968]",
      date: "2026.03.27",
      location: "마포구 서교동",
      content: "여기 방음 진짜 잘돼요. 옆집에서 뭘 하는지 하나도 안 들림. 층간소음도 없고 완전 쾌적하게 살고 있습니다. 홍대 근처인데도 조용해서 너무 좋아요!",
      image: "https://images.unsplash.com/photo-1563261515-5bfbfe4b0173?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxrb3JlYW4lMjBhcGFydG1lbnQlMjBidWlsZGluZ3xlbnwxfHx8fDE3NzQ4NDk1MzV8MA&ixlib=rb-4.1.0&q=80&w=1080",
      likes: 12,
      views: 300
    }
  ];

  const filteredData = mockData.filter(item => item.type === activeTab || activeTab === 'hot');

  return (
    <div className="w-full h-full flex flex-col bg-[#F2F4F6]">
      {/* Top Navigation / Filters */}
      <div className="sticky top-0 bg-white z-10 pt-4 px-6 pb-2 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
        <h1 className="text-[20px] font-bold text-[#333D4B] mb-4">방문록</h1>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab("hot")}
            className={cn(
              "pb-3 text-[16px] font-semibold transition-colors relative",
              activeTab === "hot" ? "text-[#333D4B]" : "text-[#8B95A1]"
            )}
          >
            실시간 핫게시물
            {activeTab === "hot" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#333D4B] rounded-full" />
            )}
          </button>
          <button 
            onClick={() => setActiveTab("local")}
            className={cn(
              "pb-3 text-[16px] font-semibold transition-colors relative",
              activeTab === "local" ? "text-[#333D4B]" : "text-[#8B95A1]"
            )}
          >
            내 주변 소식
            {activeTab === "local" && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#333D4B] rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* Feed List */}
      <div className="flex-1 overflow-y-auto px-[24px] py-4 space-y-4">
        {filteredData.map(post => (
          <div key={post.id} className="bg-white rounded-[16px] p-4 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
            {/* Card Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className={cn("px-2 py-1 text-[12px] font-bold rounded-[6px]", post.tagColor)}>
                  {post.tag}
                </span>
                <span className="text-[12px] text-[#8B95A1]">{post.date}</span>
              </div>
              <button className="text-[#8B95A1]">
                <MoreVertical size={18} />
              </button>
            </div>

            {/* Location */}
            <div className="flex items-center gap-1 mb-2 text-[#4E5968]">
              <MapPin size={14} className="text-[#3182F6]" />
              <span className="text-[13px] font-medium">{post.location}</span>
            </div>

            {/* Card Body */}
            <div className="flex gap-3 mb-4">
              <p className="flex-1 text-[15px] leading-relaxed text-[#333D4B] line-clamp-3">
                {post.content}
              </p>
              <div className="w-[88px] h-[88px] rounded-[12px] overflow-hidden shrink-0 bg-[#F2F4F6]">
                <img src={post.image} alt="post image" className="w-full h-full object-cover" />
              </div>
            </div>

            {/* Card Footer: Engagement */}
            <div className="flex items-center gap-4 text-[#8B95A1] text-[13px] border-t border-[#F2F4F6] pt-3">
              <div className="flex items-center gap-1">
                <Heart size={16} className={post.likes > 100 ? "fill-[#F04452] text-[#F04452]" : ""} />
                <span>공감 {post.likes}</span>
              </div>
              <div className="flex items-center gap-1">
                <Eye size={16} />
                <span>조회 {post.views}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
