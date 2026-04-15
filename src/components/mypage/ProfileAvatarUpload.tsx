import { useState, useEffect, useRef } from "react";
import * as Icons from "lucide-react";
import { Camera } from "lucide-react";
import { ensureFirebaseAuthForStorage } from "../../hooks/useAuth";
import { db, storage } from "../../services/firebase";
import { doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

type Props = {
  userId: string;
  userName: string;
  photoURL?: string;
  updateProfile: (partial: { photoURL?: string }) => void;
};

/** Firebase Storage profile upload; syncs users/{id}.photoURL. Toggled from MyPage. */
export function ProfileAvatarUpload({ userId, userName, photoURL, updateProfile }: Props) {
  const [avatarImg, setAvatarImg] = useState<string | null>(() => {
    const saved = localStorage.getItem("mock_user");
    if (saved) {
      try {
        return JSON.parse(saved).photoURL ?? null;
      } catch {
        return null;
      }
    }
    return null;
  });
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

          const previewUrl = URL.createObjectURL(file);
          setAvatarImg(previewUrl);
          setIsUploadingAvatar(true);

          try {
            await ensureFirebaseAuthForStorage();
            const storageRef = ref(storage, `profile_images/${userId}`);
            await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(storageRef);
            await setDoc(doc(db, "users", userId), { photoURL: downloadURL }, { merge: true });
            updateProfile({ photoURL: downloadURL });
            setAvatarImg(downloadURL);
            URL.revokeObjectURL(previewUrl);
          } catch (err) {
            console.error("Profile image upload failed:", err);
            setAvatarImg(photoURL ?? null);
            URL.revokeObjectURL(previewUrl);
          } finally {
            setIsUploadingAvatar(false);
          }
        }}
      />
    </div>
  );
}
