import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../services/firebase";

/**
 * [마이그레이션] 기존 리뷰 데이터에 experienceType 필드가 없는 경우 "단순 방문"으로 채워넣습니다.
 */
export async function migrateExperienceType() {
  try {
    const querySnapshot = await getDocs(collection(db, "reviews"));
    const batch = writeBatch(db);
    let count = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      // experienceType 필드가 존재하지 않거나 빈 문자열인 경우에만 업데이트
      if (!data.experienceType) {
        batch.update(doc(db, "reviews", docSnap.id), {
          experienceType: "단순 방문"
        });
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      return { success: true, count };
    } else {
      return { success: true, count: 0, message: "업데이트할 데이터가 없습니다." };
    }
  } catch (error) {
    console.error("Migration Error:", error);
    return { success: false, error };
  }
}
