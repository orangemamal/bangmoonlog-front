import React, { useRef } from 'react';
import { 
  Camera, PlayCircle, Star as StarIcon, CheckCircle2, 
  MapPin, Home as HomeIcon, Search, ClipboardCheck, 
  Image as ImageIcon, MessageSquare, Pencil, RefreshCw 
} from 'lucide-react';
import { Timestamp } from 'firebase/firestore';

interface ReviewEditorProps {
  editingReviewId: string | null;
  selectedAddress: string | null;
  isVerified: boolean;
  verificationDistance: number | null;
  isVerifying: boolean;
  onVerifyLocation: () => void;
  experienceType: string;
  setExperienceType: (t: string) => void;
  selectedImages: (File | string)[];
  setSelectedImages: React.Dispatch<React.SetStateAction<(File | string)[]>>;
  addressDetail: string;
  setAddressDetail: (v: string) => void;
  comment: string;
  setComment: (v: string) => void;
  ratings: { light: number; noise: number; water: number };
  setRatings: React.Dispatch<React.SetStateAction<{ light: number; noise: number; water: number }>>;
  selectedTags: string[];
  setSelectedTags: React.Dispatch<React.SetStateAction<string[]>>;
  customTag: string;
  setCustomTag: (v: string) => void;
  onAddCustomTag: () => void;
  isSubmitting: boolean;
  onSubmit: () => void;
  setViewerImage: (url: string | null) => void;
  tags: string[];
}

export const ReviewEditor: React.FC<ReviewEditorProps> = ({
  editingReviewId,
  selectedAddress,
  isVerified,
  verificationDistance,
  isVerifying,
  onVerifyLocation,
  experienceType,
  setExperienceType,
  selectedImages,
  setSelectedImages,
  addressDetail,
  setAddressDetail,
  comment,
  setComment,
  ratings,
  setRatings,
  selectedTags,
  setSelectedTags,
  customTag,
  setCustomTag,
  onAddCustomTag,
  isSubmitting,
  onSubmit,
  setViewerImage,
  tags
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
  };

  const handleRemoveImage = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="sheet-content">
      <div className={`verification-banner ${isVerified ? 'verified' : ''}`}>
        <div className="banner-left">
          <div className="address-header">
            {isVerified && <div className="badge-verify"><CheckCircle2 size={12} /><span>방문자 인증</span></div>}
            <span className="address-text">{selectedAddress}</span>
          </div>
          {!editingReviewId && (
            <p className="address-desc">
              {isVerifying ? "📍 위치 확인 중..." : isVerified ? `📍 장소와 ${verificationDistance}m 거리에 있어 방문 인증이 완료되었습니다.` : "📍 장소와 멀리 떨어져 있어 인증 마크를 달 수 없어요."}
            </p>
          )}
        </div>
        {!editingReviewId && (
          <button className="refresh-loc-btn" onClick={onVerifyLocation}>
            <RefreshCw size={16} className={isVerifying ? 'spin' : ''} />
          </button>
        )}
      </div>

      <div className="experience-section">
        <div className="section-title">
          <ClipboardCheck size={16} color="#3182F6" />
          <span>방문 유형 선택</span>
        </div>
        <div className="experience-chips">
          {[
            { label: "단순 방문", icon: <MapPin size={14} /> },
            { label: "거주 경험", icon: <HomeIcon size={14} /> },
            { label: "매물 투어", icon: <Search size={14} /> }
          ].map(type => (
            <button
              key={type.label}
              type="button"
              className={`experience-chip ${experienceType === type.label ? 'active' : ''}`}
              onClick={() => !isSubmitting && setExperienceType(type.label)}
              disabled={isSubmitting}
            >
              <span className="icon">{type.icon}</span>
              {type.label}
            </button>
          ))}
        </div>
      </div>

      <div className="section-title">
        <ImageIcon size={16} color="#3182F6" />
        <span>방문 사진 및 동영상</span>
        <span style={{ fontSize: '11px', color: '#3182F6', marginLeft: 'auto', backgroundColor: '#E8F3FF', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>동영상 가능</span>
      </div>
      <div className="photo-section">
        <button className="photo-button" onClick={() => !isSubmitting && fileInputRef.current?.click()} disabled={isSubmitting}>
          <Camera size={24} />
          <span>{selectedImages.length}/10</span>
        </button>
        <input type="file" multiple accept="image/*,video/*" ref={fileInputRef} onChange={e => !isSubmitting && setSelectedImages(prev => [...prev, ...Array.from(e.target.files || [])])} className="hidden-file-input" disabled={isSubmitting} />
        {selectedImages.map((file, i) => {
          const isUrl = typeof file === 'string';
          const isVideo = isUrl ? (file.toLowerCase().includes('.mp4') || file.toLowerCase().includes('media_')) : file.type.startsWith('video/');
          const src = isUrl ? file : URL.createObjectURL(file);
          return (
            <div key={i} className="preview-item">
              {isVideo ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', borderRadius: '12px', overflow: 'hidden' }}>
                  <video src={src} muted autoPlay loop playsInline className="preview-video" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onClick={() => setViewerImage(src)} />
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', pointerEvents: 'none' }}>
                    <PlayCircle size={20} color="#fff" fill="rgba(0,0,0,0.3)" />
                  </div>
                </div>
              ) : (
                <img src={src} onClick={() => setViewerImage(src)} alt="preview" />
              )}
              <button className="preview-remove" onClick={(ev) => { ev.stopPropagation(); !isSubmitting && handleRemoveImage(i); }} disabled={isSubmitting}>✕</button>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: '20px', marginBottom: '12px' }}>
        <div className="section-title"><MapPin size={16} color="#3182F6" /><span>상세주소 (선택)</span></div>
        <input type="text" className="comment-textarea" style={{ height: '52px', padding: '0 16px', fontSize: '15.5px', borderRadius: '14px', backgroundColor: '#F2F4F6', border: 'none', width: '100%', outline: 'none' }} placeholder="예: 101동 201호, 2층 왼쪽, 반지하 등" readOnly={isSubmitting} value={addressDetail} onChange={e => setAddressDetail(e.target.value)} />
      </div>

      <div className="section-title"><MessageSquare size={16} color="#3182F6" /><span>솔직한 방문 후기</span></div>
      <textarea className="comment-textarea" placeholder="방문 시 느꼈던 솔직한 후기를 남겨주세요 (최소 5자)" value={comment} onChange={e => setComment(e.target.value)} readOnly={isSubmitting} />

      <div className="rating-section">
        <RatingRow label="☀️ 채광/일조" value={ratings.light} onChange={v => setRatings(p => ({ ...p, light: v }))} disabled={isSubmitting} />
        <RatingRow label="🔇 층간소음" value={ratings.noise} onChange={v => setRatings(p => ({ ...p, noise: v }))} disabled={isSubmitting} />
        <RatingRow label="🚿 수압/상태" value={ratings.water} onChange={v => setRatings(p => ({ ...p, water: v }))} disabled={isSubmitting} />
      </div>

      <div className="tag-section">
        <div className="section-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '14px' }}>🏷️</span>
            <span>추천 태그 선택</span>
          </div>
        </div>
        <div className="tag-list">
          {tags.map(tag => (
            <button key={tag} className={`tag-chip ${selectedTags.includes(tag) ? 'active' : ''}`} onClick={() => !isSubmitting && handleTagToggle(tag)} disabled={isSubmitting}>{tag}</button>
          ))}
        </div>
        <div className="custom-tag-input-group">
          <input type="text" className="custom-tag-input" placeholder="직접 태그 입력 (예: 반려동물)" value={customTag} onChange={e => setCustomTag(e.target.value)} onKeyDown={e => e.key === "Enter" && onAddCustomTag()} disabled={isSubmitting} />
          <button className="add-tag-btn" onClick={onAddCustomTag} disabled={isSubmitting}>추가</button>
        </div>
      </div>

      <div className="sheet-footer">
        <button className="submit-button" onClick={onSubmit} disabled={isSubmitting}>
          {isSubmitting ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="btn-loader"></div>
              <span>등록 중...</span>
            </div>
          ) : (
            editingReviewId ? "수정 완료" : "방문록 등록하기"
          )}
        </button>
      </div>
    </div>
  );
};

function RatingRow({ label, value, onChange, disabled }: { label: string; value: number; onChange: (v: number) => void; disabled?: boolean }) {
  return (
    <div className="rating-row" style={disabled ? { opacity: 0.6, pointerEvents: 'none' } : {}}>
      <span className="rating-label">{label}</span>
      <div className="stars">
        {[1, 2, 3, 4, 5].map(s => (
          <button key={s} onClick={() => !disabled && onChange(s)} className={`star-button ${s <= value ? "active" : ""}`} disabled={disabled}>
            <StarIcon size={28} className={s <= value ? "fill-active" : "fill-inactive"} />
          </button>
        ))}
      </div>
    </div>
  );
}
