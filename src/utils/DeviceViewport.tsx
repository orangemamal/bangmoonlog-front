import { useEffect } from 'react';

export function DeviceViewport() {
  useEffect(() => {
    const styles = {
      '--min-height': `${window.innerHeight}px`,
      '--bottom-padding': '0px',
      '--top-padding': '0px',
    };

    for (const [key, value] of Object.entries(styles)) {
      document.documentElement.style.setProperty(key, value);
    }
  }, []);

  return null;
}
