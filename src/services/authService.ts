import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  OAuthProvider, 
  signInAnonymously,
  signInWithCustomToken,
  updateProfile
} from "firebase/auth";
import { doc, setDoc, serverTimestamp, getDoc } from "firebase/firestore";
import { auth, db } from "./firebase";

const saveUserToFirestore = async (user: any) => {
  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);
    const existingData = userSnap.exists() ? userSnap.data() : {};

    await setDoc(userRef, {
      email: user.email || existingData.email || "",
      displayName: user.displayName || existingData.displayName || "방문객",
      photoURL: user.photoURL || existingData.photoURL || "",
      lastLogin: serverTimestamp(),
      createdAt: existingData.createdAt || serverTimestamp()
    }, { merge: true });
  } catch (e) {
    console.error("Firestore save error:", e);
  }
};

const handleAuthError = (error: any, providerName: string) => {
  console.error(`${providerName} login failed:`, error);
  alert(`${providerName} 로그인 오류: ${error.code}\n${error.message}`);
};

/**
 * 환경에 따라 적절한 OIDC ID를 반환합니다.
 */
const getProviderId = (type: 'kakao' | 'naver') => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  if (type === 'kakao') return isLocal ? 'oidc.kakao_local' : 'oidc.log';
  if (type === 'naver') return isLocal ? 'oidc.naver_local' : 'oidc.naver';
  return '';
};

export const signInWithGoogle = async () => {
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    await saveUserToFirestore(result.user);
    return result.user;
  } catch (error) {
    handleAuthError(error, "Google");
  }
};

export const signInWithKakao = async () => {
  const providerId = getProviderId('kakao');
  const provider = new OAuthProvider(providerId);
  // KOE205 에러 방지를 위해, 우선 에러가 났던 스코프들은 제외하고 openid만 시도합니다.
  // 카카오 콘솔에서 동의항목 설정이 완료되면 아래 주석을 해제하시면 됩니다.
  provider.addScope('openid');
  provider.addScope('profile');
  provider.addScope('email');
  
  try {
    const result = await signInWithPopup(auth, provider);
    await saveUserToFirestore(result.user);
    return result.user;
  } catch (error) {
    handleAuthError(error, "카카오");
  }
};

export const signInWithNaver = async () => {
  // 프론트엔드 단독 파이어베이스 네이버 연동이 불가능하므로, 
  // Custom Token 방식(Vercel API 통신)을 위해 네이버 로그인 페이지로 이동합니다.
  const clientId = 'bHrWcLM6mH_duVHLXhzF';
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  // Vercel의 redirect 허용 목록에 localhost 주소나 배포 주소가 있어야 합니다.
  const redirectUri = isLocal ? 'http://localhost:3000/' : 'https://bangmoonlog.vercel.app/';
  
  const state = Math.random().toString(36).substring(7);
  localStorage.setItem('naver_auth_state', state);
  
  const authUrl = `https://nid.naver.com/oauth2.0/authorize?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  
  window.location.href = authUrl;
};

export const handleNaverCallback = async (accessToken: string) => {
  try {
    // Firebase Cloud Functions URL (서울 리전 사용 시)
    const apiUrl = 'https://asia-northeast3-bangmoonlog-bdf9a.cloudfunctions.net/naverAuth';

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accessToken })
    });

    if (!response.ok) {
      throw new Error(`Naver Token Exchange Failed: ${response.status}`);
    }

    const { firebaseToken, user: naverUserInfo } = await response.json();
    const result = await signInWithCustomToken(auth, firebaseToken);
    
    // Firebase 인증 프로필 실시간 업데이트 (커스텀 토큰은 초기 프로필이 비어있음)
    await updateProfile(result.user, {
      displayName: naverUserInfo.name || "네이버 사용자",
      photoURL: naverUserInfo.picture || ""
    });

    // Firestore 저장 (네이버에서 가져온 이메일을 명시적으로 포함)
    const userRef = doc(db, "users", result.user.uid);
    await setDoc(userRef, {
      email: naverUserInfo.email || "",
      displayName: naverUserInfo.name || "네이버 사용자",
      photoURL: naverUserInfo.picture || "",
      lastLogin: serverTimestamp(),
      // 이메일 정보가 인증 객체에 없을 수도 있으므로 Firestore에 확실히 심음
    }, { merge: true });

    return result.user;
  } catch (error) {
    handleAuthError(error, "네이버(커스텀)");
  }
};

export const signInWithApple = async () => {
  const provider = new OAuthProvider('apple.com');
  provider.addScope('email');
  provider.addScope('name');
  try {
    const result = await signInWithPopup(auth, provider);
    await saveUserToFirestore(result.user);
    return result.user;
  } catch (error) {
    handleAuthError(error, "Apple");
  }
};

export const guestLogin = async () => {
  try {
    const result = await signInAnonymously(auth);
    if (result.user) {
      await setDoc(doc(db, "users", result.user.uid), {
        displayName: "둘러보기(게스트)",
        isAnonymous: true,
        createdAt: serverTimestamp()
      }, { merge: true });
    }
    return result.user;
  } catch (error) {
    handleAuthError(error, "게스트");
  }
};
