import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Search, RefreshCw, Sparkles, MessageSquare, ShieldCheck, Zap, Heart, LogIn, ChevronLeft, PanelRight, Plus, Trash2 } from "lucide-react";
import { useAuth } from "../../hooks/useAuth";
import { Badge } from "../../constants/badges";
import { askGemini } from "../../utils/gemini";

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
  const name = user?.nickname || '회원';
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
  const [chatHistory, setChatHistory] = useState<{ role: 'user' | 'ai', message: string }[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [dynamicRecs, setDynamicRecs] = useState<string[]>([]);
  const [isGeneratingRecs, setIsGeneratingRecs] = useState(false);
  const [recsCache, setRecsCache] = useState<Record<string, string[]>>({}); // 탭별 캐시 저장
  const [historyList, setHistoryList] = useState<{ id: number, title: string, date: string }[]>([
    { id: 1, title: '광진구 보안관님이 인정한 꿀매물', date: '2024.04.26' },
    { id: 2, title: '수압 좋은 강남구 오피스텔', date: '2024.04.25' },
  ]);

  // AI 실시간 추천 질문 생성
  const fetchAiRecommendations = async (tab: string) => {
    // 1. 로컬 추천 로직으로 즉시 노출 (대기 시간 0초)
    const localRecs = getDynamicRecommendations(user, tab, userReviews, userBadges);
    
    // 캐시된 내용이 있으면 즉시 적용하고 AI 호출 스킵 (원할 경우 주기적 갱신 가능)
    if (recsCache[tab]) {
      setDynamicRecs(recsCache[tab]);
      return;
    }

    setDynamicRecs(localRecs);
    
    // 2. 백그라운드에서 AI 업데이트 시도
    setIsGeneratingRecs(true);
    try {
      const name = user?.nickname || '회원';
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

  // 모달이 열리고 대화가 없을 때 추천 생성
  useEffect(() => {
    if (isOpen && chatHistory.length === 0) {
      fetchAiRecommendations(activeTab);
    }
  }, [isOpen, activeTab]);

  useEffect(() => {
    if (lastAiResponse) {
      setChatHistory(prev => [...prev, { role: 'ai', message: lastAiResponse.reason }]);
      // 새 질문이 완료되면 히스토리에 추가 (간단한 예시)
      if (chatHistory.length === 1) { // 첫 질문일 때만
        const newHistory = { 
          id: Date.now(), 
          title: chatHistory[0].message, 
          date: new Date().toLocaleDateString() 
        };
        setHistoryList(prev => [newHistory, ...prev]);
      }
    }
  }, [lastAiResponse]);

  const handleSend = (text: string) => {
    if (!text.trim() || isAiProcessing) return;
    setChatHistory(prev => [...prev, { role: 'user', message: text }]);
    onSearch(text);
  };

  const handleCardClick = (text: string) => {
    setAiQuery(text);
    handleSend(text);
  };

  const handleBack = () => {
    if (chatHistory.length > 0) {
      setChatHistory([]);
    } else {
      onClose();
    }
  };

  const startNewChat = () => {
    setChatHistory([]);
    setAiQuery("");
    setIsHistoryOpen(false);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="ai-modal-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, background: '#fff',
            zIndex: 5000, display: 'flex', flexDirection: 'column',
            overflow: 'hidden' // Body 내에서만 스크롤되도록
          }}
        >
          {/* Header */}
          <div style={{ 
            display: 'grid', gridTemplateColumns: '48px 1fr 48px', alignItems: 'center', 
            padding: '8px 16px', borderBottom: '1px solid #F2F4F6', position: 'sticky', top: 0, 
            background: 'rgba(255, 255, 255, 0.9)', backdropFilter: 'blur(10px)', zIndex: 10 
          }}>
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <button 
                onClick={handleBack} 
                style={{ 
                  background: 'none', border: 'none', padding: '8px', cursor: 'pointer', 
                  borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'background 0.2s' 
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F2F4F6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <ChevronLeft size={24} color="#4E5968" />
              </button>
            </div>
            
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: '#3182F6', fontWeight: 800, fontSize: '16px' }}>
              <Sparkles size={18} fill="currentColor" />
              <span>AI 검색 에이전트</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button 
                onClick={() => setIsHistoryOpen(true)}
                style={{ 
                  background: 'none', border: 'none', padding: '8px', cursor: 'pointer', 
                  borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'background 0.2s' 
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#F2F4F6'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
              >
                <PanelRight size={24} color="#4E5968" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column' }}>
            {chatHistory.length === 0 ? (
              <div style={{ padding: '20px 0' }}>
                <div style={{ textAlign: 'center', marginBottom: '40px' }}>
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    style={{ 
                      width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg, #3182F6 0%, #8B5CF6 100%)',
                      margin: '0 auto 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px'
                    }}
                  >
                    ✨
                  </motion.div>
                  <h1 style={{ fontSize: '26px', fontWeight: 800, color: '#191F28', marginBottom: '12px', lineHeight: 1.4 }}>
                    원하는 방문록,<br />말 한마디면 충분해요
                  </h1>
                  <p style={{ fontSize: '15px', color: '#4E5968', lineHeight: 1.5 }}>
                    더 이상 복잡하게 찾지 마세요.<br />원하는 조건을 말하면 AI 에이전트가 찾아드려요.
                  </p>
                </div>

                <div style={{ marginBottom: '40px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px', fontWeight: 700, color: '#191F28' }}>
                    <MessageSquare size={18} color="#3182F6" />
                    <span>이런 질문 어때요?</span>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '16px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                    {CATEGORIES.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setActiveTab(cat.id)}
                        style={{
                          flexShrink: 0, padding: '8px 16px', borderRadius: '20px', border: 'none',
                          background: activeTab === cat.id ? '#3182F6' : '#F2F4F6',
                          color: activeTab === cat.id ? '#fff' : '#4E5968',
                          fontSize: '14px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        {cat.icon} {cat.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '20px', msOverflowStyle: 'none', scrollbarWidth: 'none' }}>
                    {!isLoggedIn && !isGeneratingRecs && (
                      <motion.div
                        whileTap={{ scale: 0.98 }}
                        onClick={() => window.location.href = '/login'}
                        style={{
                          flexShrink: 0, width: '160px', padding: '20px', borderRadius: '16px', background: '#F9FAFB',
                          border: '1.5px dashed #D1D6DB', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px'
                        }}
                      >
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#E5E8EB', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <LogIn size={18} color="#8B95A1" />
                        </div>
                        <p style={{ fontSize: '13px', color: '#4E5968', fontWeight: 600, lineHeight: 1.4, margin: 0 }}>로그인하고 나에게 딱 맞는 답변 받기</p>
                      </motion.div>
                    )}

                    {dynamicRecs.map((text, idx) => (
                      <motion.div
                        key={`${activeTab}-${idx}`}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.05 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleCardClick(text)}
                        style={{
                          flexShrink: 0, width: '160px', padding: '20px', borderRadius: '16px', 
                          background: '#F2F4F6', cursor: 'pointer', display: 'flex', alignItems: 'center',
                          position: 'relative', overflow: 'hidden'
                        }}
                      >
                        <p style={{ fontSize: '13px', color: '#191F28', fontWeight: 500, lineHeight: 1.4, margin: 0 }}>{text}</p>
                        
                        {/* AI 생성 중임을 나타내는 아주 미세한 프로그레스 바 (선택 사항) */}
                        {isGeneratingRecs && (
                          <motion.div 
                            initial={{ x: '-100%' }}
                            animate={{ x: '100%' }}
                            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                            style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '2px', background: 'rgba(49, 130, 246, 0.3)' }}
                          />
                        )}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px', padding: '10px 0' }}>
                {chatHistory.map((chat, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ alignSelf: chat.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '90%', marginBottom: '16px' }}
                  >
                    {chat.role === 'user' ? (
                      <div style={{ padding: '12px 16px', borderRadius: '18px 18px 2px 18px', background: '#3182F6', color: '#fff', fontSize: '15px', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}>
                        {chat.message}
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#F2F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Sparkles size={14} color="#3182F6" fill="#3182F6" />
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#4E5968' }}>방문Log AI 에이전트</span>
                        </div>
                        <div style={{ padding: '20px', borderRadius: '2px 20px 20px 20px', background: '#fff', border: '1px solid #F2F4F6', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', color: '#191F28' }}>
                          <p style={{ fontSize: '15px', lineHeight: 1.6, marginBottom: '16px', fontWeight: 500 }}>
                            {isLoggedIn ? `${user?.nickname || '회원'}님` : '사용자님'}의 요구사항에 딱 맞는 방문록을 탐색한 결과입니다.
                          </p>
                          <div style={{ background: '#F9FAFB', padding: '16px', borderRadius: '12px', marginBottom: '20px' }}>
                            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#191F28', marginBottom: '10px' }}>분석 키워드</h4>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                              <span style={{ fontSize: '13px', padding: '6px 12px', background: '#fff', border: '1px solid #E5E8EB', borderRadius: '20px', color: '#4E5968', fontWeight: 500 }}>
                                🔍 {aiQuery}
                              </span>
                            </div>
                          </div>
                          {lastAiResponse && chat.message === lastAiResponse.reason && lastAiResponse.address !== 'none' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                              <motion.div 
                                whileHover={{ scale: 1.02, backgroundColor: '#F9FAFB' }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onOpenReadList(lastAiResponse.address)}
                                style={{ border: '1.5px solid #3182F6', borderRadius: '16px', padding: '20px', background: '#fff', cursor: 'pointer', boxShadow: '0 8px 24px rgba(49, 130, 246, 0.12)', position: 'relative', overflow: 'hidden' }}
                              >
                                <div style={{ position: 'absolute', top: 0, right: 0, padding: '4px 12px', background: '#3182F6', color: '#fff', fontSize: '11px', fontWeight: 700, borderRadius: '0 0 0 12px' }}>BEST MATCH</div>
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '12px' }}>
                                  <Search size={18} color="#3182F6" style={{ marginTop: '2px' }} />
                                  <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#191F28', margin: 0, display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    {lastAiResponse.address} <span style={{ fontSize: '12px', color: '#3182F6', fontWeight: 500 }}>상세보기 &gt;</span>
                                  </h3>
                                </div>
                                <p style={{ fontSize: '14px', color: '#4E5968', lineHeight: 1.6, margin: '0 0 16px 0' }}>{lastAiResponse.reason}</p>
                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                  <span style={{ padding: '4px 10px', background: 'rgba(49, 130, 246, 0.1)', color: '#3182F6', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}>✨ 맞춤 분석 완료</span>
                                  <span style={{ padding: '4px 10px', background: '#F2F4F6', color: '#8B95A1', borderRadius: '6px', fontSize: '12px', fontWeight: 600 }}># 실제 방문록 기반</span>
                                </div>
                              </motion.div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
                
                {lastAiResponse && !isAiProcessing && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => onGoToMap(lastAiResponse.lat, lastAiResponse.lng, lastAiResponse.address, lastAiResponse.reason)}
                    style={{ alignSelf: 'center', width: '100%', maxWidth: '280px', marginTop: '10px', padding: '16px', borderRadius: '16px', background: '#3182F6', color: '#fff', border: 'none', fontWeight: 700, fontSize: '15px', cursor: 'pointer', boxShadow: '0 8px 20px rgba(49, 130, 246, 0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  >
                    <Zap size={18} fill="currentColor" /> 추천 장소로 지도 이동하기
                  </motion.button>
                )}

                {isAiProcessing && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ alignSelf: 'flex-start', background: '#F2F4F6', padding: '12px 16px', borderRadius: '18px 18px 18px 2px' }}>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1 }} style={{ width: '6px', height: '6px', background: '#8B95A1', borderRadius: '50%' }} />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }} style={{ width: '6px', height: '6px', background: '#8B95A1', borderRadius: '50%' }} />
                      <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }} style={{ width: '6px', height: '6px', background: '#8B95A1', borderRadius: '50%' }} />
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Footer Input */}
          <div style={{ padding: '20px', background: '#fff', borderTop: '1px solid #F2F4F6', position: 'sticky', bottom: 0 }}>
            <div style={{ textAlign: 'center', marginBottom: '12px', fontSize: '12px', color: '#3182F6', fontWeight: 600 }}>
              {!isLoggedIn ? "로그인하면 내 관심 주소 기반으로 더 정확하게 찾아줘요." : `${user?.nickname || '회원'}님의 취향을 반영해 분석해 드려요.`}
            </div>
            <div style={{ background: '#F2F4F6', borderRadius: '28px', padding: '8px 8px 8px 24px', display: 'flex', alignItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
              <input
                type="text" value={aiQuery} onChange={(e) => setAiQuery(e.target.value)} placeholder="원하는 조건을 말해 주세요"
                style={{ flex: 1, border: 'none', background: 'none', outline: 'none', fontSize: '16px', fontWeight: 500, color: '#191F28' }}
                onKeyDown={(e) => e.key === 'Enter' && handleSend(aiQuery)} disabled={isAiProcessing}
              />
              <button
                onClick={() => handleSend(aiQuery)} disabled={isAiProcessing || !aiQuery.trim()}
                style={{ width: '40px', height: '40px', borderRadius: '50%', background: aiQuery.trim() ? '#3182F6' : '#B0B8C1', border: 'none', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
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
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => setIsHistoryOpen(false)}
                  style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 100 }}
                />
                <motion.div
                  initial={{ x: '100%' }}
                  animate={{ x: 0 }}
                  exit={{ x: '100%' }}
                  transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                  style={{
                    position: 'absolute', top: 0, right: 0, bottom: 0, width: '80%', maxWidth: '320px',
                    background: '#fff', zIndex: 101, display: 'flex', flexDirection: 'column',
                    boxShadow: '-8px 0 32px rgba(0,0,0,0.1)'
                  }}
                >
                  <div style={{ padding: '24px 20px', borderBottom: '1px solid #F2F4F6', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: '18px', color: '#191F28' }}>대화 기록</span>
                    <button onClick={() => setIsHistoryOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
                      <X size={20} color="#8B95A1" />
                    </button>
                  </div>

                  <div style={{ padding: '16px' }}>
                    <button 
                      onClick={startNewChat}
                      style={{
                        width: '100%', padding: '12px', borderRadius: '12px', background: '#F2F4F6',
                        border: 'none', color: '#3182F6', fontWeight: 700, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
                      }}
                    >
                      <Plus size={18} /> 새 채팅 시작하기
                    </button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px' }}>
                    <p style={{ fontSize: '12px', color: '#8B95A1', fontWeight: 600, marginBottom: '12px' }}>최근 대화</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {historyList.map(item => (
                        <div 
                          key={item.id}
                          style={{
                            padding: '16px', borderRadius: '12px', border: '1px solid #F2F4F6',
                            cursor: 'pointer', transition: 'background 0.2s'
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = '#F9FAFB'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                        >
                          <p style={{ fontSize: '14px', color: '#191F28', fontWeight: 500, margin: '0 0 4px 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {item.title}
                          </p>
                          <p style={{ fontSize: '12px', color: '#8B95A1', margin: 0 }}>{item.date}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <div style={{ padding: '20px', borderTop: '1px solid #F2F4F6' }}>
                    <button style={{ width: '100%', background: 'none', border: 'none', color: '#F04452', fontSize: '13px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
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
};
