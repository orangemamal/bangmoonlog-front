import React, { useState, useCallback, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { MapInfoWindow } from './MapInfoWindow';
import { LocationStats } from '../../types/review';

interface InfoWindowPortalProps {
  map: any;
  infoWindow: any;
  onRead: (address: string) => void;
  onWrite: (address: string, lat: number, lng: number) => void;
  onToggleBookmark: (address: string, lat: number, lng: number) => void;
  onReport: (address: string) => void;
}

/**
 * 네이버 지도 InfoWindow 내부에 React 컴포넌트를 렌더링하기 위한 포털 컴포넌트
 */
export const InfoWindowPortal: React.FC<InfoWindowPortalProps> = ({
  map,
  infoWindow,
  onRead,
  onWrite,
  onToggleBookmark,
  onReport
}) => {
  const [content, setContent] = useState<{
    stats: LocationStats;
    isResidential: boolean;
    lat: number;
    lng: number;
  } | null>(null);

  const [container] = useState(() => document.createElement('div'));

  // 전역 함수로 등록하여 네이티브 마커 클릭 시 호출 가능하게 함
  useEffect(() => {
    (window as any).__openInfoWindow = (
      stats: LocationStats, 
      isResidential: boolean, 
      lat: number, 
      lng: number
    ) => {
      setContent({ stats, isResidential, lat, lng });
      infoWindow.setContent(container);
      infoWindow.open(map, new window.naver.maps.LatLng(lat, lng));
    };

    return () => {
      delete (window as any).__openInfoWindow;
    };
  }, [map, infoWindow, container]);

  if (!content) return null;

  return ReactDOM.createPortal(
    <MapInfoWindow 
      stats={content.stats}
      isResidential={content.isResidential}
      onRead={onRead}
      onWrite={onWrite}
      onToggleBookmark={onToggleBookmark}
      onReport={onReport}
    />,
    container
  );
};
