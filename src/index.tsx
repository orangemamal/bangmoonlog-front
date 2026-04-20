import ReactDOM from 'react-dom/client';
import 'remixicon/fonts/remixicon.css';
import './styles/main.scss';
import App from './App.tsx';

console.log("🟢 [Index] App Initialization Start");

const rootEl = document.getElementById('root');
if (rootEl) {
  console.log("🟢 [Index] Root element found, rendering...");
  const root = ReactDOM.createRoot(rootEl);
  root.render(<App />);
} else {
  console.error("🔴 [Index] Root element not found!");
}
