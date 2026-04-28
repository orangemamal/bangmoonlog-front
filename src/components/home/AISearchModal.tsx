import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, RefreshCw, Sparkles, MessageSquare, ShieldCheck, Zap, Heart, LogIn, ChevronLeft, PanelRight, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Badge } from "../../constants/badges";
import { askGemini } from "../../utils/gemini";
import "./AISearchModal.scss";

interface AISearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  aiQuery: string;
  setAiQuery: (query: string) => void;
  isAiProcessing: boolean;
  lastAiResponse?: { address: string; reason: string; lat: number; lng: number } | null;
  onSearch: (query?: string) => void;
  onGoToMap: (lat: number, lng: number, address: string, reason: string) => void;
  onOpenReadList: (address: string) => void;
  userReviews?: any[];
  userBadges?: Badge[];
}

const CATEGORIES = [
  { id: 'all', label: '전체', icon: <Sparkles size={14} /> },
  { id: 'comfort', label: '살기 좋은 곳', icon: <Heart size={14} /> },
  { id: 'facility', label: '시설 조건', icon: <ShieldCheck size={14} /> },
  { id: 'trending', label: '최신 리뷰', icon: <Zap size={14} /> },
];

// 추천 데이터 생성을 위한 헬퍼 함수
const getDynamicRecommendations = (user: any, activeTab: string, reviews: any[], badges: Badge[]): string[] => {
  const name = user?.name || '사용자';
  const regionBadge = badges.find(b => b.category === 'region');
  const specialBadge = badges.find(b => b.category === 'special');
  const recentReview = reviews.length > 0 ? reviews[reviews.length - 1] : null;
  const recentAddr = recentReview ? (recentReview.location || recentReview.address || "").split(" ")[1] : null;
  
  const recommendations: Record<string, string[]> = { all: [], comfort: [], facility: [], trending: [] };

  if (regionBadge) {
    const region = regionBadge.title.split(" ")[0];
    recommendations.all.push(`${region} 보안관님이 인정한 근처의 또 다른 꿀매물은?`);
    recommendations.trending.push(`${region} 내에서 요즘 평점이 급상승 중인 건물 찾아줘`);
  }
  
  if (specialBadge) {
    if (specialBadge.id === 'spc_critic') {
      recommendations.facility.push(`엄격한 비평가인 제가 봐도 만족할만한 수압/보안 완벽한 곳은?`);
    } else if (specialBadge.id === 'spc_writer') {
      recommendations.all.push(`정성스러운 기록을 남길만한 스토리가 있는 특별한 집 추천해줘`);
    }
  }

  if (recentAddr) {
    recommendations.comfort.push(`최근 내가 다녀온 ${recentAddr} 근처에서 가장 조용한 아파트 보여줘`);
    recommendations.facility.push(`${recentAddr} 내에서 엘리베이터 있고 주차 편한 빌라 리스트`);
  }

  const fallbackData: Record<string, string[]> = {
    all: [`내가 좋아할 만한 조용한 집 찾아줘`, "수압 좋고 깨끗한 빌라 위주로 보여줘", "채광 잘 드는 아파트 추천해줄래?"],
    comfort: ["층간소음 걱정 없는 조용한 집", "남향이라 하루종일 따뜻한 곳", "주변에 산책하기 좋은 공원이 있니?"],
    facility: ["보안 철저하고 엘리베이터 있는 빌라", "주차 공간이 넉넉한 오피스텔", "수납 공간이 잘 되어 있는 집"],
    trending: ["지금 사람들에게 가장 인기 있는 장소", "최근 3일 내 올라온 생생한 후기", "별점 4.8 이상의 검증된 방문록"]
  };

  Object.keys(recommendations).forEach(key => {
    const list = recommendations[key];
    const fb = fallbackData[key];
    recommendations[key] = [...list, ...fb].slice(0, 4);
  });

  return recommendations[activeTab] || recommendations.all;
};

export const AISearchModal: React.FC<AISearchModalProps> = ({
  isOpen, onClose, aiQuery, setAiQuery, isAiProcessing, lastAiResponse, onSearch, onGoToMap, onOpenReadList, userReviews = [], userBadges = []
}) => {
  const { isLoggedIn, user } = useAuth();
  const [activeTab, setActiveTab] = useState('all');
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', message: string, keyword?: string, data?: any }[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [dynamicRecs, setDynamicRecs] = useState<string[]>([]);
  const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);
  const [recsCache, setRecsCache] = useState<Record<string, string[]>>({});
  
  // 세션 기반 히스토리 관리
  const [currentSessionId, setCurrentSessionId] = useState<number | null>(null);
  const [historyList, setHistoryList] = useState<{ id: number, title: string, date: string, messages: any[] }[]>(() => {
    const saved = localStorage.getItem('ai_search_sessions');
    return saved ? JSON.parse(saved) : [];
  });

  // 세션 목록이 바뀔 때마다 저장
  useEffect(() => {
    localStorage.setItem('ai_search_sessions', JSON.stringify(historyList));
  }, [historyList]);

  // 현재 대화가 바뀔 때마다 해당 세션 업데이트
  useEffect(() => {
    if (currentSessionId && chatHistory.length > 0) {
      setHistoryList(prev => prev.map(session => 
        session.id === currentSessionId 
          ? { ...session, messages: chatHistory, title: chatHistory[0].message.slice(0, 30) } 
          : session
      ));
    }
  }, [chatHistory]);

  const fetchAiRecommendations = async (tab: string) => {
    const localRecs = getDynamicRecommendations(user, tab, userReviews, userBadges);
    if (recsCache[tab]) {
      setDynamicRecs(recsCache[tab]);
      return;
    }
    setDynamicRecs(localRecs);
    setIsGeneratingRecs(true);
    try {
      const name = user?.name || '사용자';
      const recentAddr = userReviews.length > 0 ? (userReviews[userReviews.length - 1].location || userReviews[userReviews.length - 1].address || "") : "서울";
      const prompt = `부동산 앱 AI 에이전트 질문 추천 (최대 4개, 1인칭, 줄바꿈 구분, 번호X):
        - 사용자: ${name}, 최근 지역: ${recentAddr}, 뱃지: ${userBadges.map(b => b.title).join(", ")}
        - 예: '내가 살기 좋은 ${recentAddr} 아파트 찾아줘'`;
      const response = await askGemini(prompt);
      const aiRecs = response.split('\n').filter(line => line.trim().length > 5).slice(0, 4);
      if (aiRecs.length > 0) {
        setDynamicRecs(aiRecs);
        setRecsCache(prev => ({ ...prev, [tab]: aiRecs }));
      }
    } catch (error) {
      console.error("AI 추천 생성 실패:", error);
    } finally {
      setIsGeneratingRecs(false);
    }
  };

  useEffect(() => {
    if (isOpen && chatHistory.length === 0) {
      fetchAiRecommendations(activeTab);
    }
  }, [isOpen, activeTab]);

  const [currentKeyword, setCurrentKeyword] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory, isAiProcessing]);

  useEffect(() => {
    if (lastAiResponse) {
      setChatHistory(prev => [...prev, { 
        role: 'ai', 
        message: lastAiResponse.reason,
        keyword: currentKeyword,
        data: lastAiResponse 
      }]);
    }
  }, [lastAiResponse]);

  const handleSend = (text: string) => {
    if (!text.trim() || isAiProcessing) return;
    
    // 만약 새로운 세션이라면 생성
    if (!currentSessionId) {
      const newId = Date.now();
      const newSession = { 
        id: newId, 
        title: text.slice(0, 30), 
        date: new Date().toLocaleDateString(), 
        messages: [{ role: 'user', message: text }] 
      };
      setHistoryList(prev => [newSession, ...prev]);
      setCurrentSessionId(newId);
    }

    setCurrentKeyword(text);
    setChatHistory(prev => [...prev, { role: 'user', message: text }]);
    onSearch(text);
    setAiQuery(""); 
  };

  const loadSession = (session: any) => {
    setCurrentSessionId(session.id);
    setChatHistory(session.messages);
    setIsHistoryOpen(false);
  };

  const handleCardClick = (text: string) => {
    handleSend(text);
  };

  const handleBack = () => {
    if (chatHistory.length > 0) {
      // 대화 중이면 세션만 유지하고 홈(추천)으로 돌아가기 원할 수도 있지만,
      // 여기서는 일단 대화 종료(초기화)로 처리하거나 모달 닫기로 처리
      onClose();
    } else {
      onClose();
    }
  };

  const startNewChat = () => {
    setChatHistory([]);
    setCurrentSessionId(null);
    setAiQuery("");
    setIsHistoryOpen(false);
  };

  const modalContent = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ai-search-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Header */}
          <div className="ai-search-header">
            <div>
              <button className="header-btn" onClick={handleBack}>
                <ChevronLeft size={24} color="#4E5968" />
              </button>
            </div>
            
            <div className="header-title">
              <Sparkles size={18} fill="currentColor" />
              <span>AI 검색 에이전트</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="header-btn" onClick={() => setIsHistoryOpen(true)}>
                <PanelRight size={24} color="#4E5968" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="ai-search-body" ref={scrollRef}>
            {chatHistory.length === 0 ? (
              <div className="empty-state">
                <div className="intro-section">
                  <motion.div
                    className="sparkle-icon-wrapper"
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  >
                    ✨
                  </motion.div>
                  <h1 className="intro-title">
                    원하는 방문록,<br />말 한마디면 충분해요
                  </h1>
                  <p className="intro-desc">
                    더 이상 복잡하게 찾지 마세요.<br />원하는 조건을 말하면 AI 에이전트가 찾아드려요.
                  </p>
                </div>

                <div className="recommendations-section">
                  <div className="section-header">
                    <Zap size={18} color="#3182F6" fill="#3182F6" />
                    <span>이런 질문은 어떠세요?</span>
                  </div>
                  <div className="rec-list">
                    {(dynamicRecs.length > 0 ? dynamicRecs : [
                      "치안이 좋고 밤에도 밝은 집",
                      "집주인분이 친절하고 조용한 곳",
                      "주차 공간이 넉넉한 분리형 원룸",
                      "채광이 좋고 환기가 잘 되는 집"
                    ]).map((text, idx) => (
                      <motion.div
                        key={idx}
                        className="rec-item"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleCardClick(text)}
                      >
                        <p className="rec-text">{text}</p>
                        {isGeneratingRecs && (
                          <motion.div 
                            className="progress-bar"
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                          />
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="chat-thread">
                {chatHistory.map((chat, idx) => (
                  <motion.div
                    key={idx}
                    className={`chat-bubble ${chat.role}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {chat.role === 'user' ? (
                      <div className="message-box">
                        {chat.message}
                      </div>
                    ) : (
                      <div className="ai">
                        <div className="ai-header">
                          <div className="avatar">
                            <Sparkles size={14} color="#3182F6" fill="#3182F6" />
                          </div>
                          <span className="name">방문Log AI 에이전트</span>
                        </div>
                        <div className="message-content">
                          <p className="intro-text">
                            {chat.data && chat.data.address !== 'none' 
                              ? `${isLoggedIn ? user?.name || '사용자' : '사용자'}님의 요구사항에 딱 맞는 방문록을 탐색한 결과입니다.`
                              : `${isLoggedIn ? user?.name || '사용자' : '사용자'}님, 요청하신 내용을 분석해 보았습니다.`
                            }
                          </p>
                          <div className="ai-main-message">
                            {chat.message}
                          </div>
                          <div className="keyword-badge-section">
                            <h4>분석 키워드</h4>
                            <div className="keyword-chip">
                              <span>
                                🔍 {chat.keyword || aiQuery}
                              </span>
                            </div>
                          </div>
                          {chat.data && chat.data.address !== 'none' && (
                            <div className="rec-card">
                              <motion.div 
                                className="house-card"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onOpenReadList(chat.data.address)}
                              >
                                <div className="best-match-badge">BEST MATCH</div>
                                <div className="card-header">
                                  <Search size={18} color="#3182F6" style={{ marginTop: '2px' }} />
                                  <h3>
                                    <span className="address-text">{chat.data.address}</span>
                                    <span className="detail-link">상세보기 &gt;</span>
                                  </h3>
                                </div>
                                <p className="reason-text">{chat.data.reason}</p>
                                <div className="tags">
                                  <span className="tag blue">✨ 맞춤 분석 완료</span>
                                  <span className="tag gray"># 실제 방문록 기반</span>
                                </div>
                              </motion.div>

                              <motion.button
                                className="go-to-map-btn"
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={() => onGoToMap(chat.data.lat, chat.data.lng, chat.data.address, chat.data.reason)}
                              >
                                <Zap size={18} fill="currentColor" /> 추천 장소로 지도 이동하기
                              </motion.button>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
                
                {isAiProcessing && (
                  <div className="typing-indicator">
                    <div className="dots">
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer Input */}
          <div className="ai-search-footer">
            <div className="footer-tip">
              {!isLoggedIn ? "로그인하면 내 관심 주소 기반으로 더 정확하게 찾아줘요." : `${user?.name || '사용자'}님의 취향을 반영해 분석해 드려요.`}
            </div>
            <div className="input-wrapper">
              <input
                type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="원하는 조건을 말해 주세요"
                onKeyDown={(e) => e.key === 'Enter' && handleSend(aiQuery)} disabled={isAiProcessing}
              />
              <button
                className={`send-btn ${aiQuery.trim() ? 'active' : 'disabled'}`}
                onClick={() => handleSend(aiQuery)} disabled={isAiProcessing || !aiQuery.trim()}
              >
                {isAiProcessing ? <RefreshCw size={18} className="animate-spin" /> : <Zap size={18} fill="currentColor" />}
              </button>
            </div>
          </div>

          {/* History Sidebar Drawer */}
          <AnimatePresence>
            {isHistoryOpen && (
              <>
                <motion.div
                  className="ai-history-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsHistoryOpen(false)}
                />
                <motion.div
                  className="ai-history-drawer"
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                >
                  <div className="drawer-header">
                    <span>대화 기록</span>
                    <button className="close-btn" onClick={() => setIsHistoryOpen(false)}>
                      <X size={20} color="#8B95A1" />
                    </button>
                  </div>

                  <div className="new-chat-section">
                    <button className="new-chat-btn" onClick={startNewChat}>
                      <Plus size={18} /> 새 채팅 시작하기
                    </button>
                  </div>

                  <div className="history-list-section">
                    <p className="section-title">최근 대화</p>
                    <div className="history-items">
                      {historyList.map(item => (
                        <div 
                          key={item.id} className="history-item"
                          onClick={() => loadSession(item)}
                        >
                          <p className="item-title">{item.title}</p>
                          <p className="item-date">{item.date}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div className="drawer-footer">
                    <button 
                      className="delete-all-btn"
                      onClick={() => {
                        if (window.confirm("모든 대화 기록을 삭제하시겠습니까?")) {
                          setHistoryList([]);
                          setChatHistory([]);
                        }
                      }}
                    >
                      <Trash2 size={14} /> 모든 기록 삭제
                    </button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return createPortal(modalContent, document.body);
};
