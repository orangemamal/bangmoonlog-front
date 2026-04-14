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

    const q = query(
      collection(db, "notifications"), 
      where("toUserId", "==", user.id)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const list: Notification[] = [];
      snap.forEach(docSnap => {
        const data = docSnap.data();
        list.push({ id: docSnap.id, ...data } as Notification);
      });

      list.sort((a, b) => {
        const timeA = a.createdAt?.toMillis() || 0;
        const timeB = b.createdAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setNotifs(list);
      setIsLoading(false);
    }, (error) => {
      console.error("Notifications snapshot error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id]);

  const markAsRead = async (id: string) => {
    try {
      await writeBatch(db).update(doc(db, "notifications", id), { isRead: true }).commit();
    } catch (e) {
      console.error("Mark as read error:", e);
    }
  };

  const markAllAsRead = async () => {
    const unreadNotifs = notifs.filter(n => !n.isRead);
    if (unreadNotifs.length === 0) return;

    try {
      const batch = writeBatch(db);
      unreadNotifs.forEach(n => {
        batch.update(doc(db, "notifications", n.id), { isRead: true });
      });
      await batch.commit();
    } catch (e) {
      console.error("Mark all as read error:", e);
    }
  };

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
        {notifs.some(n => !n.isRead) && (
          <button className="notifications__read-all" onClick={markAllAsRead}>
            모두 읽음
          </button>
        )}
      </div>

      <div className="notifications__list">
        {notifs.map(noti => (
          <div
            key={noti.id}
            className={`notifications__item${!noti.isRead ? " notifications__item--unread" : ""}`}
            onClick={() => !noti.isRead && markAsRead(noti.id)}
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
            <div className="notifications__empty-icon">🔔</div>
            <h3>새로운 알림이 없어요</h3>
            <p>방문록에 공감이 달리거나 관심 지역에<br />새로운 글이 올라오면 알려드릴게요.</p>
          </div>
        )}

        {isLoading && (
          <div className="notifications__empty">
            <div className="notifications__empty-spinner" />
            <p>알림을 불러오는 중입니다...</p>
          </div>
        )}
      </div>
    </div>
  );
}
