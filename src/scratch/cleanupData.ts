
import { db } from "../services/firebase";
import { collection, getDocs, deleteDoc, doc } from "firebase/firestore";

async function cleanupBrokenReviews() {
  console.log("🧹 시 작 : 잘못된 이미지 주소(blob)를 가진 게시물 정리 중...");
  
  try {
    const querySnapshot = await getDocs(collection(db, "reviews"));
    let count = 0;

    for (const document of querySnapshot.docs) {
      const data = document.data();
      const images = data.images || [];
      
      // 이미지 배열 중 하나라도 'blob:'으로 시작하는 주소가 있으면 삭제 대상으로 판단
      const hasBlob = images.some((url: string) => url.startsWith("blob:"));
      
      if (hasBlob) {
        console.log(`🗑️ 삭제 중: [${document.id}] - 잘못된 이미지 주소 감지됨`);
        await deleteDoc(doc(db, "reviews", document.id));
        count++;
      }
    }

    console.log(`✅ 완 료 : 총 ${count}개의 잘못된 게시물을 삭제했습니다.`);
  } catch (error) {
    console.error("❌ 오류 발생:", error);
  }
}

cleanupBrokenReviews();
