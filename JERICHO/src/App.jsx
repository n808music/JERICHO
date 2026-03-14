import React from 'react';
import AppShell from './components/AppShell.jsx';
import JerichoDebugPanel from './components/debug/JerichoDebugPanel.jsx';

export default function App() {
  return (
    <>
      <AppShell />
      {process.env.NODE_ENV !== 'production' ? <JerichoDebugPanel /> : null}
    </>
  );
}
