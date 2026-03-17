import { StrictMode, createElement } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import BlackViewPage from './BlackViewPage.jsx';
import IntakeDev from './IntakeDev.jsx';
import './styles.css';

const isBlack = typeof window !== 'undefined' && window.location.pathname === '/black';
// TEMPORARY: keep the intake dev harness mounted until Surface 1 is integrated into the real app.
const isIntakeDev = typeof window !== 'undefined' && window.location.pathname === '/intake-dev';
const RootComponent = isBlack ? BlackViewPage : isIntakeDev ? IntakeDev : App;

ReactDOM.createRoot(document.getElementById('root')).render(
  createElement(StrictMode, null, createElement(RootComponent))
);
