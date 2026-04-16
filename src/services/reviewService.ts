import { db } from "./firebase";
import { 
  doc, 
  updateDoc, 
  increment, 
  runTransaction, 
  collection, 
  addDoc, 
  serverTimestamp,
  getDoc,
  deleteDoc,
  setDoc
} from "firebase/firestore";

/**
 * 게시물 조회수 1 증가
 */
export const incrementViews = async (reviewId: string) => {
  try {
    const reviewRef = doc(db, "reviews", reviewId);
    await updateDoc(reviewRef, {
      views: increment(1)
    });
  } catch (error) {
    console.error("View increment error:", error);
  }
};

/**
 * 게시물 공감하기 (좋아요) 토글 처리 및 알림 생성
 */
export const toggleLike = async (reviewId: string, userId: string, authorId: string, likerName?: string) => {
  try {
    const reviewRef = doc(db, "reviews", reviewId);
    const likeRef = doc(db, "reviews", reviewId, "likes", userId);
    
    const likeDoc = await getDoc(likeRef);
    let wasLiked = false;

    await runTransaction(db, async (transaction) => {
      const reviewDoc = await transaction.get(reviewRef);
      if (!reviewDoc.exists()) {
        throw new Error("리뷰가 존재하지 않습니다.");
      }

      const likeDoc = await transaction.get(likeRef);
      wasLiked = likeDoc.exists();
      let currentLikes = reviewDoc.data().likes || 0;

      if (wasLiked) {
        transaction.delete(likeRef);
        // 음수가 되지 않도록 방어 로직 추가
        transaction.update(reviewRef, { likes: Math.max(0, currentLikes - 1) });
      } else {
        transaction.set(likeRef, { createdAt: serverTimestamp() });
        transaction.update(reviewRef, { likes: currentLikes + 1 });
      }
    });
      
    // DB 업데이트가 성공적으로 완료된 후 알림 전송 (트랜잭션 외부)
    if (!wasLiked && authorId && userId !== authorId && likerName) {
      // 수신자의 알림 설정 확인
      const userRef = doc(db, "users", authorId);
      const userSnap = await getDoc(userRef);
      
      let canNotify = true;
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.settings?.notifications?.reactions === false) {
          canNotify = false;
        }
      }

      if (canNotify) {
        await addDoc(collection(db, "notifications"), {
          toUserId: authorId,
          type: "reaction",
          content: `${likerName}님이 회원님의 방문록에 공감했습니다.`,
          createdAt: serverTimestamp(),
          isRead: false,
          reviewId: reviewId
        });
      }
    }
    
    return true;
  } catch (error: any) {
    console.error("Like toggle transaction error:", error);
    throw error; // 에러를 감추지 않고 던져서 UI가 정확한 원인을 알게 합니다.
  }
};

/**
 * 댓글 추가
 */
export const addComment = async (reviewId: string, userId: string, authorName: string, content: string, reviewAuthorId?: string) => {
  try {
    const commentsRef = collection(db, "reviews", reviewId, "comments");
    await addDoc(commentsRef, {
      userId,
      authorName,
      content,
      createdAt: serverTimestamp()
    });
    
    // 댓글 작성 알림 (내 게시물이 아닐 때)
    if (reviewAuthorId && userId !== reviewAuthorId) {
      // 수신자의 알림 설정 확인
      const userRef = doc(db, "users", reviewAuthorId);
      const userSnap = await getDoc(userRef);
      
      let canNotify = true;
      if (userSnap.exists()) {
        const userData = userSnap.data();
        if (userData.settings?.notifications?.reactions === false) {
          canNotify = false;
        }
      }

      if (canNotify) {
        await addDoc(collection(db, "notifications"), {
          toUserId: reviewAuthorId,
          type: "reaction",
          content: `${authorName}님이 댓글을 남겼습니다: ${content}`,
          createdAt: serverTimestamp(),
          isRead: false,
          reviewId: reviewId
        });
      }
    }
    return true;
  } catch (error) {
    console.error("Add comment error:", error);
    return false;
  }
};

/**
 * 게시물 삭제
 */
export const deleteReview = async (reviewId: string) => {
  try {
    const reviewRef = doc(db, "reviews", reviewId);
    await deleteDoc(reviewRef);
    return true;
  } catch (error) {
    console.error("Delete review error:", error);
    return false;
  }
};
