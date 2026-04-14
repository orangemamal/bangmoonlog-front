import { collection, getDocs, writeBatch, doc } from "firebase/firestore";
import { db } from "../services/firebase";
import { normalizeAddressDetail } from "./addressUtils";

/**
 * [통합 마이그레이션] 
 * 1. experienceType 필드가 없는 경우 "단순 방문"으로 채움
 * 2. addressDetail 필드가 없는 경우 ""으로 초기화
 * 3. 기존 addressDetail 필드가 있는 경우 정규화(공백 제거 등) 수행
 */
export async function runFullMigration() {
  try {
    const querySnapshot = await getDocs(collection(db, "reviews"));
    const batch = writeBatch(db);
    let count = 0;

    querySnapshot.forEach((docSnap) => {
      const data = docSnap.data();
      let needsUpdate = false;
      const updates: any = {};

      // 1. 방문 유형 마이그레이션
      if (!data.experienceType) {
        updates.experienceType = "단순 방문";
        needsUpdate = true;
      }

      // 2. 상세주소 마이그레이션 및 정규화
      if (data.addressDetail === undefined) {
        updates.addressDetail = "";
        needsUpdate = true;
      } else if (typeof data.addressDetail === 'string') {
        const normalized = normalizeAddressDetail(data.addressDetail);
        if (normalized !== data.addressDetail) {
          updates.addressDetail = normalized;
          needsUpdate = true;
        }
      }

      if (needsUpdate) {
        batch.update(doc(db, "reviews", docSnap.id), updates);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
      return { success: true, count };
    } else {
      return { success: true, count: 0, message: "이미 모든 데이터가 최신 규격입니다." };
    }
  } catch (error) {
    console.error("Full Migration Error:", error);
    return { success: false, error };
  }
}
