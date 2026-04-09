import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { DeviceViewport } from './utils/DeviceViewport';
import { TDSMobileAITProvider } from '@toss/tds-mobile-ait';
import { Layout } from './components/common/Layout';
import { Home } from './pages/Home';
import { Feed } from './pages/Feed';
import { Notifications } from './pages/Notifications';
import { MyPage } from './pages/MyPage';

function App() {
  return (
    <TDSMobileAITProvider>
      <DeviceViewport />
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/mypage" element={<MyPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </TDSMobileAITProvider>
  );
}

export default App;
