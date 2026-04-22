import { useState, useEffect } from "react";
import { Heart, Bell, Megaphone, Trash2, CheckCircle2, ChevronRight, LogIn, Settings, X, Award, Crown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
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
  reviewId?: string;
}

function NotifIcon({ type, content }: { type: NotifType; content?: string }) {
  if (type === "reaction") return <Heart size={20} style={{ fill: "#F04452", color: "#F04452" }} />;
  if (type === "local")    return <Bell size={20} color="#3182F6" style={{ fill: "#3182F6", fillOpacity: 0.1 }} />;
  
  // 모든 칭호 관련 알림 (명칭 무관하게 '달성하여' 혹은 칭호 키워드가 포함된 경우 왕관 아이콘)
  const isTitleNotif = content?.includes("칭호") || 
                       content?.includes("달성하여") || 
                       content?.includes("방문객") || 
                       content?.includes("탐험가") || 
                       content?.includes("가이드") || 
                       content?.includes("발품러") || 
                       content?.includes("방문록의 신") ||
                       content?.includes("보안관");

  if (isTitleNotif) {
    return <Crown size={20} color="#A855F7" style={{ fill: "#A855F7", fillOpacity: 0.2 }} />;
  }
  
  // 일반 뱃지 획득 알림 (예: 방문자 인증 등)
  if (content?.includes("뱃지")) {
    return <Award size={20} color="#F5A623" style={{ fill: "#F5A623", fillOpacity: 0.2 }} />;
  }
  
  return <Megaphone size={20} color="#4E5968" />;
}

function ToggleButton({ isOn, onToggle }: { isOn: boolean; onToggle: () => void }) {
  return (
    <div 
      onClick={onToggle}
      style={{
        width: '50px',
        height: '28px',
        borderRadius: '14px',
        background: isOn ? '#3182F6' : '#E5E7EB',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background 0.3s'
      }}
    >
      <motion.div 
        animate={{ x: isOn ? 24 : 2 }}
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          background: 'white',
          position: 'absolute',
          top: '2px',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      />
    </div>
  );
}

// 텍스트 내 따옴표 강조 헬퍼
function HighlightText({ content }: { content: string }) {
  const parts = content.split(/('[^']+')/g);
  return (
    <>
      {parts.map((part, i) => 
        part.startsWith("'") && part.endsWith("'") ? 
        <strong key={i}>{part.replace(/'/g, '')}</strong> : 
        part
      )}
    </>
  );
}

export function Notifications() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [notiSettings, setNotiSettings] = useState({
    bookmarks: true,
    reactions: true,
    notices: true
  });

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
        <div className="notifications__header-actions">
          {notifs.some(n => !n.isRead) && (
            <button className="notifications__read-all" onClick={markAllAsRead}>
              모두 읽음
            </button>
          )}
          <button className="notifications__settings-btn" onClick={() => setIsSettingsOpen(true)}>
            <Settings size={22} color="#4E5968" />
          </button>
        </div>
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
                  (noti.content.includes("칭호") || noti.content.includes("달성하여") || noti.content.includes("방문객") || noti.content.includes("탐험가") || noti.content.includes("가이드") || noti.content.includes("발품러") || noti.content.includes("신") || noti.content.includes("보안관")) ? "#F5F3FF" : // 칭호 전용 연보라 배경
                  noti.content.includes("뱃지") ? "#FFF9E6" : // 뱃지 전용 골드 배경
                  "#F2F4F6",
                position: 'relative'
              }}
            >
              <NotifIcon type={noti.type} content={noti.content} />
              {!noti.isRead && <span className="notifications__dot" />}
            </div>

            <div className="notifications__content">
              <p className="notifications__text">
                <HighlightText content={noti.content} />
              </p>
              <span className="notifications__time">{formatTime(noti.createdAt)}</span>
            </div>
            <div className="notifications__chevron">
              <ChevronRight size={18} color="#B0B8C1" />
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

      {/* 알림 설정 바텀 시트 */}
      <AnimatePresence>
        {isSettingsOpen && (
          <>
            <motion.div
              className="modal-overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSettingsOpen(false)}
              style={{ 
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                zIndex: 2000 
              }}
            />
            <motion.div
              className="notifications__settings-modal"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              style={{
                position: 'fixed',
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: 'white',
                borderTopLeftRadius: '32px',
                borderTopRightRadius: '32px',
                padding: '32px 24px 40px',
                zIndex: 2001,
                boxShadow: '0 -10px 40px rgba(0,0,0,0.1)'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
                <h2 style={{ fontSize: '22px', fontWeight: '800', color: '#191F28' }}>알림 설정</h2>
                <button 
                  onClick={() => setIsSettingsOpen(false)}
                  style={{ border: 'none', background: '#F2F4F6', width: '36px', height: '36px', borderRadius: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                >
                  <X size={20} color="#8B95A1" />
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#E8F3FF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Bell size={20} color="#3182F6" />
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#333D4B', marginBottom: '2px' }}>찜한 매물 새 방문록</div>
                      <div style={{ fontSize: '13px', color: '#8B95A1' }}>관심 있는 건물의 새 소식을 알려드려요</div>
                    </div>
                  </div>
                  <ToggleButton isOn={notiSettings.bookmarks} onToggle={() => setNotiSettings(p => ({ ...p, bookmarks: !p.bookmarks }))} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#FFF0F3', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Heart size={20} color="#F04452" />
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#333D4B', marginBottom: '2px' }}>좋아요 및 댓글</div>
                      <div style={{ fontSize: '13px', color: '#8B95A1' }}>내 방문록에 대한 반응을 알려드려요</div>
                    </div>
                  </div>
                  <ToggleButton isOn={notiSettings.reactions} onToggle={() => setNotiSettings(p => ({ ...p, reactions: !p.reactions }))} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#F2F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Megaphone size={20} color="#4E5968" />
                    </div>
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: '700', color: '#333D4B', marginBottom: '2px' }}>서비스 공지 및 혜택</div>
                      <div style={{ fontSize: '13px', color: '#8B95A1' }}>중요한 공지와 혜택 소식을 알려드려요</div>
                    </div>
                  </div>
                  <ToggleButton isOn={notiSettings.notices} onToggle={() => setNotiSettings(p => ({ ...p, notices: !p.notices }))} />
                </div>
              </div>

              <div style={{ marginTop: '40px', padding: '20px', background: '#F9FAFB', borderRadius: '20px' }}>
                <p style={{ fontSize: '12px', color: '#8B95A1', lineHeight: '1.8', margin: 0 }}>
                  • 야간 시간대(오후 9시 ~ 오전 8시)에는 마케팅 관련 알림이 제한될 수 있습니다.<br />
                  • 설정하신 내용은 기기별 푸시 알림 설정과 다를 수 있습니다.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
