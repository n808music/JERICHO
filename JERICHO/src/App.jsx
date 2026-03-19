import React from 'react';
import AppShell from './components/AppShell.jsx';
import JerichoDebugPanel from './components/debug/JerichoDebugPanel.jsx';
import { IS_PRODUCTION } from './utils/runtimeEnv.js';

export default function App() {
  return (
    <>
      <AppShell />
      {!IS_PRODUCTION ? <JerichoDebugPanel /> : null}
    </>
  );
}
