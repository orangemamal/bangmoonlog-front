import { useEffect } from 'react';

export function DeviceViewport() {
  const isIOS = false; // Vercel 배포 시에는 web으로 고정하여 TDS 에러 방지

  useEffect(() => {
    const styles = {
      '--min-height': `${window.innerHeight}px`,
    };

    if (isIOS) {
      Object.assign(styles, {
        '--bottom-padding': `max(env(safe-area-inset-bottom), 20px)`,
        '--top-padding': `max(env(safe-area-inset-top), 20px)`,
      });
    }

    for (const [key, value] of Object.entries(styles)) {
      document.documentElement.style.setProperty(key, value);
    }
  }, []);

  return null;
}
