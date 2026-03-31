import { setupTossMock } from './toss-mock.ts';
setupTossMock();

import ReactDOM from 'react-dom/client';
import 'remixicon/fonts/remixicon.css';
import './styles/main.scss';
import App from './App.tsx';

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = ReactDOM.createRoot(rootEl);
  root.render(<App />);
}
