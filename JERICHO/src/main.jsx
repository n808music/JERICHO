import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';
import { JerichoProvider } from './core/state.js';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <JerichoProvider>
      <App />
    </JerichoProvider>
  </React.StrictMode>
);
