
import { useState, useEffect } from "react";

export function useRecentLogs() {
  const [recentIds, setRecentIds] = useState<string[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("recent_logs");
    if (saved) {
      setRecentIds(JSON.parse(saved));
    }
  }, []);

  const addRecentLog = (id: string) => {
    setRecentIds(prev => {
      const filtered = prev.filter(item => item !== id);
      const updated = [id, ...filtered].slice(0, 10);
      localStorage.setItem("recent_logs", JSON.stringify(updated));
      return updated;
    });
  };

  return { recentIds, addRecentLog };
}
