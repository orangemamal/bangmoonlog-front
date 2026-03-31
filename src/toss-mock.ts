export function setupTossMock() {
  if (typeof window === 'undefined') return;
  
  // 강력한 우회용 플래그
  (window as any).isAit = true;
  (window as any).__IS_AIT_WDS = true;

  if ((window as any).ReactNativeWebView) return; // 이미 모바일 환경이면 무시

  const listeners: Record<string, Function[]> = {};

  (window as any).__CONSTANT_HANDLER_MAP = {
    getPlatformOS: 'web',
    getSafeAreaTop: 0,
    getSafeAreaBottom: 0,
    getSafeAreaLeft: 0,
    getSafeAreaRight: 0,
  };

  (window as any).__GRANITE_NATIVE_EMITTER = {
    on: (event: string, callback: Function) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(callback);
      return () => {
        listeners[event] = listeners[event].filter((cb) => cb !== callback);
      };
    },
    emit: (event: string, data?: any) => {
      if (listeners[event]) {
        listeners[event].forEach((cb) => cb(data));
      }
    },
  };

  (window as any).ReactNativeWebView = {
    postMessage: (message: string) => {
      try {
        const data = JSON.parse(message);
        if (data.type === 'method') {
          const { functionName, eventId, args } = data;

          setTimeout(() => {
            const emit = (window as any).__GRANITE_NATIVE_EMITTER.emit;

            if (functionName === 'Storage.getItem') {
              const val = localStorage.getItem(args[0]) || null;
              emit(`${functionName}/resolve/${eventId}`, val);
            } else if (functionName === 'Storage.setItem') {
              localStorage.setItem(args[0], args[1]);
              emit(`${functionName}/resolve/${eventId}`, null);
            } else {
              // haptic 등 다른 bridge method 들에 대해서 문제없이 resolve 처리
              emit(`${functionName}/resolve/${eventId}`, null);
            }
          }, 0);
        }
      } catch (e) {
        console.error('Toss Mock Bridge Error:', e);
      }
    },
  };
}
