import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { DeviceViewport } from './utils/DeviceViewport';
import { ErrorBoundary } from './components/common/ErrorBoundary';

import { Layout } from './components/common/Layout';
import { Home } from './pages/Home';
import { Feed } from './pages/Feed';
import { Notifications } from './pages/Notifications';
import { MyPage } from './pages/MyPage';
import { Terms } from './pages/Terms';
import { Privacy } from './pages/Privacy';
import { NotFound } from './pages/NotFound';

function App() {
  console.log("🚀 [App] Rendering");
  return (
    <ErrorBoundary>
      <DeviceViewport />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
