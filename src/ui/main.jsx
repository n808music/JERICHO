import { StrictMode, createElement } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import BlackViewPage from './BlackViewPage.jsx';
import IntakeDev from './IntakeDev.jsx';
import './styles.css';
import '../../JERICHO/src/index.css';
import { resolveRootComponentKey } from './routeSelector.js';

function resolveRootComponent({ pathname = '/' } = {}) {
  const key = resolveRootComponentKey({ pathname });
  if (key === 'BlackViewPage') return BlackViewPage;
  if (key === 'IntakeDev') return IntakeDev;
  return App;
}

function setZionModeIfNeeded(rootComponent) {
  if (rootComponent === IntakeDev && typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-mode', 'zion');
  }
}

if (typeof document !== 'undefined') {
  const pathname = window.location.pathname;
  const rootComponent = resolveRootComponent({ pathname });
  setZionModeIfNeeded(rootComponent);

  const rootElem = document.getElementById('root');
  if (rootElem) {
    ReactDOM.createRoot(rootElem).render(
      createElement(StrictMode, null, createElement(rootComponent))
    );
  }
}

export { App, IntakeDev };
