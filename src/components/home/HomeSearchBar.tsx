import React from 'react';
import { Search, X, XCircle } from 'lucide-react';

interface HomeSearchBarProps {
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  isHistoryOpen: boolean;
  setIsHistoryOpen: (open: boolean) => void;
  recentSearches: string[];
  setRecentSearches: React.Dispatch<React.SetStateAction<string[]>>;
  onSearchEnter: (term: string) => void;
  onOpenPostcode: () => void;
}

export const HomeSearchBar: React.FC<HomeSearchBarProps> = ({
  searchQuery,
  setSearchQuery,
  isHistoryOpen,
  setIsHistoryOpen,
  recentSearches,
  setRecentSearches,
  onSearchEnter,
  onOpenPostcode
}) => {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      const term = searchQuery.trim();
      setRecentSearches(prev => {
        const next = [term, ...prev.filter(t => t !== term)].slice(0, 10);
        localStorage.setItem('recent_searches_log', JSON.stringify(next));
        return next;
      });
      onOpenPostcode();
      setIsHistoryOpen(false);
    }
  };

  return (
    <div className="home-search-bar-container">
      <div className={`home-search-bar ${isHistoryOpen ? 'focused' : ''}`} style={{ position: 'relative', zIndex: isHistoryOpen ? 2202 : 400 }}>
        {!searchQuery && <span className="home-search-icon"><Search size={24} color="#8B95A1" /></span>}
        <input
          type="text"
          placeholder="어떤 집의 방문Log 궁금하세요?"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsHistoryOpen(true)}
        />
        {searchQuery && (
          <button className="search-clear-btn" onClick={() => { setSearchQuery(""); setIsHistoryOpen(true); }}>
            <XCircle size={20} fill="#E5E8EB" color="#fff" />
          </button>
        )}
      </div>

      {isHistoryOpen && (
        <>
          <div className="search-history-dropdown">
            <div className="history-header">
              <span>최근 검색어</span>
              <button onClick={() => { setRecentSearches([]); localStorage.setItem('recent_searches_log', '[]'); }}>전체 삭제</button>
            </div>
            <div className="history-list">
              {recentSearches.length > 0 ? (
                recentSearches.map((s, i) => (
                  <div key={i} className="history-item" onClick={() => { setSearchQuery(s); onSearchEnter(s); setIsHistoryOpen(false); }}>
                    <span className="history-text">{s}</span>
                    <button className="remove-btn" onClick={(e) => {
                      e.stopPropagation();
                      const next = recentSearches.filter(t => t !== s);
                      setRecentSearches(next);
                      localStorage.setItem('recent_searches_log', JSON.stringify(next));
                    }}><X size={14} /></button>
                  </div>
                ))
              ) : (
                <div className="empty-history">최근 검색어가 없습니다.</div>
              )}
            </div>
          </div>
          <div className="search-history-overlay" onClick={() => setIsHistoryOpen(false)} />
        </>
      )}
    </div>
  );
};
