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
    const isLiked = likeDoc.exists();

    if (isLiked) {
      await deleteDoc(likeRef);
      await updateDoc(reviewRef, { likes: increment(-1) });
    } else {
      await setDoc(likeRef, { createdAt: serverTimestamp() });
      await updateDoc(reviewRef, { likes: increment(1) });
      
      // 내 게시물이 아닌 경우에만 좋아요 알림 전송
      if (authorId && userId !== authorId && likerName) {
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
    }
    
    return true;
  } catch (error) {
    console.error("Like toggle error:", error);
    return false;
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
