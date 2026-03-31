import { Heart, MapPin, Award } from "lucide-react";

type NotifType = "reaction" | "local" | "system";

interface Notification {
  id: number;
  type: NotifType;
  content: string;
  time: string;
  isUnread: boolean;
  iconType: NotifType;
  bg: string;
}

function NotifIcon({ type }: { type: NotifType }) {
  if (type === "reaction") return <Heart size={20} style={{ fill: "#F04452", color: "#F04452" }} />;
  if (type === "local")    return <MapPin size={20} color="#3182F6" />;
  return <Award size={20} color="#00A968" />;
}

export function Notifications() {
  const notifications: Notification[] = [
    { id: 1, type: "reaction", content: "내 '자양동 빌라' 방문록에 12명이 공감했어요! 🧡",        time: "방금 전",  isUnread: true,  iconType: "reaction", bg: "#FFF0F0" },
    { id: 2, type: "local",    content: "종민님이 찜한 '화양동' 지역에 새로운 '바퀴벌레 주의' 방문록이 올라왔어요.", time: "2시간 전", isUnread: true,  iconType: "local",    bg: "#E8F3FF" },
    { id: 3, type: "system",   content: "실제 방문자 인증이 승인되었습니다. 발도장 뱃지를 확인하세요!", time: "1일 전",  isUnread: false, iconType: "system",   bg: "#E6F8F3" },
    { id: 4, type: "reaction", content: "내 '성수동 옥탑방' 방문록에 5명이 댓글을 달았어요.",      time: "3일 전",  isUnread: false, iconType: "reaction", bg: "#FFF0F0" },
  ];

  return (
    <div className="notifications">
      <div className="notifications__header">
        <h1>알림</h1>
      </div>

      <div className="notifications__list">
        {notifications.map(noti => (
          <div
            key={noti.id}
            className={`notifications__item${noti.isUnread ? " notifications__item--unread" : ""}`}
          >
            {/* 아이콘: 배경색은 데이터에서 오므로 인라인 유지 */}
            <div className="notifications__icon-box" style={{ backgroundColor: noti.bg }}>
              <NotifIcon type={noti.iconType} />
            </div>

            <div className="notifications__content">
              <p className="notifications__text">{noti.content}</p>
              <span className="notifications__time">{noti.time}</span>
              {noti.isUnread && <span className="notifications__dot" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
