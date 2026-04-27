import { storage } from '../services/firebase';
import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";

export const compressAndEncodeImage = (file: File): Promise<string> => {
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
        const max = 800;
        if (width > height) { if (width > max) { height *= max / width; width = max; } }
        else { if (height > max) { width *= max / height; height = max; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.6));
      };
    };
  });
};

export const compressVideo = (file: File): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const videoUrl = URL.createObjectURL(file);
    video.src = videoUrl;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const MAX_WIDTH = 1280;
      let width = video.videoWidth;
      let height = video.videoHeight;

      if (width > MAX_WIDTH) {
        height = (MAX_WIDTH / width) * height;
        width = MAX_WIDTH;
      }

      canvas.width = width;
      canvas.height = height;

      const mimeType = 'video/webm;codecs=vp8';
      const stream = (canvas as any).captureStream(30);
      const recorder = new MediaRecorder(stream, {
        mimeType: mimeType,
        videoBitsPerSecond: 1500000
      });

      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const compressedBlob = new Blob(chunks, { type: 'video/webm' });
        URL.revokeObjectURL(videoUrl);
        resolve(compressedBlob);
      };

      recorder.start();
      video.play();

      const drawFrame = () => {
        if (video.paused || video.ended) return;
        ctx?.drawImage(video, 0, 0, width, height);
        requestAnimationFrame(drawFrame);
      };
      drawFrame();

      video.onended = () => {
        recorder.stop();
      };
    };

    video.onerror = (err) => {
      URL.revokeObjectURL(videoUrl);
      reject(err);
    };

    setTimeout(() => {
      if (video.paused) {
        URL.revokeObjectURL(videoUrl);
        reject(new Error("Compression Timeout"));
      }
    }, 30000);
  });
};

export const uploadMediaToStorage = (
  file: File | Blob,
  onProgress?: (percent: number) => void
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const fileNameAttr = (file as any).name || `compressed_${Date.now()}.webm`;
    const fileExt = fileNameAttr.split('.').pop();
    const fileName = `media_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
    const storageRef = ref(storage, `reviews/${fileName}`);

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on('state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) onProgress(progress);
      },
      (error) => reject(error),
      () => {
        getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
          resolve(downloadURL);
        });
      }
    );
  });
};
