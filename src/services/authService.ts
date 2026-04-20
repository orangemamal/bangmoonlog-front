import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  OAuthProvider, 
  signInAnonymously,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "./firebase";

const saveUserToFirestore = async (user: any) => {
  try {
    const userRef = doc(db, "users", user.uid);
    await setDoc(userRef, {
      email: user.email || "",
      displayName: user.displayName || "방문객",
      photoURL: user.photoURL || "",
      createdAt: serverTimestamp()
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
  if (type === 'kakao') return isLocal ? 'oidc.kakao_local' : 'oidc.kakao';
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
  // provider.addScope('profile');
  // provider.addScope('email');
  
  try {
    const result = await signInWithPopup(auth, provider);
    await saveUserToFirestore(result.user);
    return result.user;
  } catch (error) {
    handleAuthError(error, "카카오");
  }
};

export const signInWithNaver = async () => {
  const providerId = getProviderId('naver');
  const provider = new OAuthProvider(providerId);
  provider.addScope('openid');
  // provider.addScope('profile');
  // provider.addScope('email');
  
  try {
    const result = await signInWithPopup(auth, provider);
    await saveUserToFirestore(result.user);
    return result.user;
  } catch (error) {
    handleAuthError(error, "네이버");
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
