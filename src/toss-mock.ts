export function setupTossMock() {
  if (typeof window === 'undefined') return;
  
  // 1. 강력한 우회용 플래그
  (window as any).isAit = true;
  (window as any).__IS_AIT_WDS = true;

  // 2. UserAgent 스푸핑 (가장 중요: @toss/tds-mobile 체크 우회)
  const originalUserAgent = navigator.userAgent;
  const mockUserAgent = `${originalUserAgent} Toss TossMobileAit`;
  
  try {
    Object.defineProperty(navigator, 'userAgent', {
      get: () => mockUserAgent,
      configurable: true
    });
  } catch (e) {
    console.warn('UA spoofing failed, attempting alternative...');
  }

  // 3. Toss Bridge Mock
  if (!(window as any).Toss) {
    (window as any).Toss = {
      isAit: true,
      ready: (cb: any) => cb && cb(),
    };
  }

  if ((window as any).ReactNativeWebView) return;

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
              emit(`${functionName}/resolve/${eventId}`, null);
            }
          }, 0);
        }
      } catch (e) {
        console.error('Toss Mock Bridge Error:', e);
      }
    },
  };

  console.log("🚀 Toss Environment Mocked (UA: " + navigator.userAgent + ")");
}
