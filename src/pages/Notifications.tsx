import { useState, useEffect } from "react";
import { Heart, MapPin, Award } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { db } from "../services/firebase";
import { collection, query, where, orderBy, onSnapshot, doc, writeBatch } from "firebase/firestore";

type NotifType = "reaction" | "local" | "system";

interface Notification {
  id: string;
  type: NotifType;
  content: string;
  createdAt: any;
  isRead: boolean;
  iconType: NotifType;
  reviewId: string;
}

function NotifIcon({ type }: { type: NotifType }) {
  if (type === "reaction") return <Heart size={20} style={{ fill: "#F04452", color: "#F04452" }} />;
  if (type === "local")    return <MapPin size={20} color="#3182F6" />;
  return <Award size={20} color="#00A968" />;
}

export function Notifications() {
  const { user } = useAuth();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;

    // orderBy를 빼서 복합 인덱스(Composite Index) 에러 방지
    const q = query(
      collection(db, "notifications"), 
      where("toUserId", "==", user.id)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Notification[] = [];
      const unreadIds: string[] = [];

      snap.forEach(docSnap => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as Notification);
        if (!data.isRead) unreadIds.push(docSnap.id);
      });

      // 클라이언트 사이드에서 시간순 정렬 (최신순)
      list.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      // 순수 DB 데이터만 상태로 설정
      setNotifs(list);
      setIsLoading(false);

      if (unreadIds.length > 0) {
        const batch = writeBatch(db);
        unreadIds.forEach(id => {
          batch.update(doc(db, "notifications", id), { isRead: true });
        });
        batch.commit().catch(e => console.error("Batch update error:", e));
      }
    }, (error) => {
      console.error("Notifications snapshot error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  const formatTime = (ts: any) => {
    if (!ts) return "방금 전";
    const date = ts.toDate();
    const diff = (new Date().getTime() - date.getTime()) / 1000;
    if (diff < 60) return "방금 전";
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return new Intl.DateTimeFormat('ko-KR').format(date);
  };

  return (
    <div className="notifications">
      <div className="notifications__header">
        <h1>알림</h1>
      </div>

      <div className="notifications__list">
        {notifs.map(noti => (
          <div
            key={noti.id}
            className={`notifications__item${!noti.isRead ? " notifications__item--unread" : ""}`}
          >
            <div 
              className="notifications__icon-box" 
              style={{ 
                backgroundColor: 
                  noti.type === "reaction" ? "#FEEBED" : 
                  noti.type === "local" ? "#E8F3FF" : 
                  "#E7F9F1" 
              }}
            >
              <NotifIcon type={noti.type} />
            </div>

            <div className="notifications__content">
              <p className="notifications__text">{noti.content}</p>
              <span className="notifications__time">{formatTime(noti.createdAt)}</span>
              {!noti.isRead && <span className="notifications__dot" />}
            </div>
          </div>
        ))}

        {notifs.length === 0 && !isLoading && (
          <div className="notifications__empty">
            <p>새로운 알림이 없습니다.</p>
          </div>
        )}

        {isLoading && (
          <div className="notifications__empty">
            <p>알림을 불러오는 중...</p>
          </div>
        )}
      </div>
    </div>
  );
}
