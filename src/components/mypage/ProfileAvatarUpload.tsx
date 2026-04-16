import { useState, useEffect, useRef } from "react";
import * as Icons from "lucide-react";
import { Camera } from "lucide-react";
import { db } from "../../services/firebase";

/** 
 * 이미지 압축 및 Base64 인코딩 함수 (Home.tsx와 동일 로직)
 * Firebase Storage 유료 플랜 회피를 위해 Firestore에 직접 저장하는 방식 사용
 */
const compressAndEncodeProfileImage = (file: File): Promise<string> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (e) => {
      const img = new Image();
      img.src = e.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const max = 400; // 프로필은 400px이면 충분
        if (width > height) { if (width > max) { height *= max / width; width = max; } }
        else { if (height > max) { width *= max / height; height = max; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); // 품질 0.7
      };
    };
  });
};

type Props = {
  userId: string;
  userName: string;
  photoURL?: string;
  updateProfile: (partial: { photoURL?: string }) => void;
};

/** Firebase Storage 대신 Firestore에 Base64로 직접 저장하여 무료 플랜 유지 */
export function ProfileAvatarUpload({ userId, userName, photoURL, updateProfile }: Props) {
  const [avatarImg, setAvatarImg] = useState<string | null>(photoURL ?? null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarImg(photoURL ?? null);
  }, [userId, photoURL]);

  return (
    <div
      className="mypage__avatar-wrapper"
      onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}
      style={{ opacity: isUploadingAvatar ? 0.6 : 1 }}
    >
      <div className="mypage__avatar">
        {avatarImg ? (
          <img src={avatarImg} alt="profile" className="mypage__avatar-img" />
        ) : (
          userName?.slice(0, 1)
        )}
      </div>
      <div className="mypage__avatar-camera">
        {isUploadingAvatar ? (
          <Icons.Loader size={12} color="white" style={{ animation: "spin 1s linear infinite" }} />
        ) : (
          <Camera size={14} color="white" />
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: "none" }}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !userId) return;

          setIsUploadingAvatar(true);

          try {
            // 1. 이미지 압축 및 Base64 변환 (Storage를 거치지 않음)
            const base64Image = await compressAndEncodeProfileImage(file);
            
            // 2. 상태 업데이트 및 Firestore 동기화 (useAuth의 updateProfile이 처리)
            await updateProfile({ photoURL: base64Image });
            setAvatarImg(base64Image);
          } catch (err) {
            console.error("Profile image upload failed:", err);
            alert("이미지 업로드 중 오류가 발생했습니다.");
          } finally {
            setIsUploadingAvatar(false);
          }
        }}
      />
    </div>
  );
}
