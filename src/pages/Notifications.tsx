import { useState, useEffect } from "react";
import { Heart, MapPin, Award, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { db } from "../services/firebase";
import { collection, query, where, onSnapshot, doc, writeBatch, DocumentData, QuerySnapshot } from "firebase/firestore";

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
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    const q = query(
      collection(db, "notifications"), 
      where("toUserId", "==", user.id)
    );

    const unsubscribe = onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
      const list: Notification[] = [];
      snap.forEach((docSnap) => {
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
    }, (error: Error) => {
      console.error("Notifications snapshot error:", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user?.id, authLoading]);

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

  // 1. 인증 확인 중일 때
  if (authLoading) {
    return (
      <div className="notifications">
        <div className="notifications__header"><h1>알림</h1></div>
        <div className="notifications__list">
          <div className="notifications__empty">
            <div className="notifications__empty-spinner" />
            <p>상태를 확인 중입니다...</p>
          </div>
        </div>
      </div>
    );
  }

  // 2. 로그인이 되어 있지 않을 때
  if (!user) {
    return (
      <div className="notifications" style={{ background: '#F9FAFB' }}>
        <div className="notifications__header"><h1>알림</h1></div>
        <div className="notifications__list" style={{ height: 'calc(100vh - 120px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="notifications__empty" style={{ background: 'white', padding: '40px 30px', borderRadius: '32px', boxShadow: '0 8px 24px rgba(0,0,0,0.04)', width: '85%', maxWidth: '340px' }}>
            <div 
              className="notifications__empty-icon" 
              style={{ 
                background: '#E8F3FF', 
                width: '80px',
                height: '80px',
                borderRadius: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
                animation: 'bounce 2s infinite ease-in-out'
              }}
            >
              <LogIn size={36} color="#3182F6" />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: '#191F28', marginBottom: '12px' }}>앗! 로그인이 필요해요 🐾</h3>
            <p style={{ fontSize: '15px', color: '#4E5968', lineHeight: '1.5' }}>
              로그인하시면 친구들의 공감 소식과<br />동네의 핫한 이야기를 알려드릴게요!
            </p>
            <button 
              onClick={() => navigate('/mypage')}
              style={{
                marginTop: '32px',
                width: '100%',
                padding: '16px 0',
                borderRadius: '20px',
                border: 'none',
                background: '#3182F6',
                color: 'white',
                fontSize: '16px',
                fontWeight: '700',
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(49, 130, 246, 0.3)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.02)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              지금 바로 로그인하기
            </button>
          </div>
        </div>
        <style>{`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
        `}</style>
      </div>
    );
  }

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
                  "#E7F9F1",
                position: 'relative'
              }}
            >
              <NotifIcon type={noti.type} />
              {!noti.isRead && <span className="notifications__dot" />}
            </div>

            <div className="notifications__content">
              <p className="notifications__text">{noti.content}</p>
              <span className="notifications__time">{formatTime(noti.createdAt)}</span>
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
