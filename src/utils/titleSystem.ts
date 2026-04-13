export const getUserTitle = (reviewCount: number) => {
  if (reviewCount >= 100) return { title: "방문록의 신", icon: "👑" };
  if (reviewCount >= 50) return { title: "프로 발품러", icon: "🥾" };
  if (reviewCount >= 20) return { title: "로컬 가이드", icon: "👟" };
  if (reviewCount >= 5) return { title: "동네 탐험가", icon: "🏃‍♂️" };
  if (reviewCount >= 1) return { title: "초보 방문객", icon: "🚶‍♂️" };
  return { title: "새내기", icon: "🌱" };
};

export const checkEligibleForNewTitle = (prevCount: number, newCount: number) => {
  const prev = getUserTitle(prevCount);
  const next = getUserTitle(newCount);
  return prev.title !== next.title ? next : null;
};
