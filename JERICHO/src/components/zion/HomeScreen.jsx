import React, { useState } from 'react';
import { useIdentityStore } from '../../state/identityStore.js';

function buildContext(raw) {
  const text = (raw || '').toLowerCase();
  const context = { mode: null, practice: null, note: raw || '' };

  if (text.includes('aim') || text.includes('goal') || text.includes('direction')) {
    context.mode = 'aim';
  } else if (text.includes('pattern') || text.includes('routine') || text.includes('habit')) {
    context.mode = 'pattern';
  } else if (text.includes('flow') || text.includes('pipeline') || text.includes('money')) {
    context.mode = 'flow';
  } else if (text.includes('practice') || text.includes('discipline') || text.includes('skill')) {
    context.mode = 'practice';
  }

  if (text.includes('body')) context.practice = 'Body';
  if (text.includes('resource')) context.practice = 'Resources';
  if (text.includes('creation')) context.practice = 'Creation';
  if (text.includes('focus')) context.practice = 'Focus';

  return context;
}

export default function HomeScreen({
  onEnterZion,
  onMacro,
  onResetIdentity,
  onAssistantQuestion,
  onOpenIdentityScan,
  onOpenHowItWorks,
  onOpenSettings,
  onOpenAssistant
}) {
  const [commandText, setCommandText] = useState('');
  const { cycle } = useIdentityStore();
  const lastDay = cycle && cycle.length > 1 ? cycle[cycle.length - 2] : cycle?.[cycle.length - 1];
  const lastDaySummary = lastDay?.summaryLine;

  const handleEnter = () => {
    if (!commandText.trim()) {
      onEnterZion?.(null);
      return;
    }
    const text = commandText.toLowerCase();
    if (text.includes('reset identity') || text.includes('jericho:reset')) {
      onResetIdentity?.();
      return;
    }
    if (text.includes('clear afternoon')) {
      onMacro?.('CLEAR_AFTERNOON');
      return;
    }
    if (text.includes('protect music') || text.includes('protect creation')) {
      onMacro?.('PROTECT_CREATION');
      return;
    }
    if (text.includes('how do i use this') || text.includes('how to use this')) {
      onOpenHowItWorks?.();
      return;
    }
    if (text.includes('review my day')) {
      onEnterZion?.('today');
      return;
    }
    if (text.includes('review my week')) {
      onEnterZion?.('week');
      return;
    }
    if (text.includes('what do i do next') || text.includes('what should i do next')) {
      if (onOpenAssistant) {
        onOpenAssistant('what do i do next?');
      } else if (onAssistantQuestion) {
        onAssistantQuestion('what do i do next?');
      }
      return;
    }
    if (onAssistantQuestion) {
      onAssistantQuestion(commandText);
      return;
    }
    onEnterZion?.(buildContext(commandText));
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEnter();
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-100 flex flex-col items-center justify-center px-6 py-10 relative overflow-hidden">
      <div className="absolute left-4 top-1/4 flex flex-col items-center gap-6">
        <button
          aria-label="Identity scan"
          className="h-8 w-8 rounded-full border border-neutral-700 hover:border-neutral-400"
          onClick={onOpenIdentityScan}
        />
        <button
          aria-label="How this works"
          className="h-8 w-8 rounded border border-neutral-700 hover:border-neutral-400"
          onClick={onOpenHowItWorks}
        />
        <button
          aria-label="Settings"
          className="h-8 w-8 rounded-full border border-neutral-700 hover:border-neutral-400"
          onClick={onOpenSettings}
        />
      </div>
      <div className="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-6">Jericho System</div>
      <div className="space-y-6 w-full max-w-3xl text-center">
        <p className="text-xl">Where are we starting today?</p>
        {lastDaySummary ? (
          <p className="text-[11px] text-neutral-500 mt-2">Yesterday: {lastDaySummary}</p>
        ) : null}
        <div className="rounded-full border border-neutral-700 bg-neutral-900 px-4 py-2 flex items-center gap-3">
          <span className="h-3 w-3 rounded-full bg-neutral-500" aria-hidden />
          <input
            className="flex-1 bg-transparent text-neutral-100 placeholder-neutral-500 outline-none"
            placeholder="Type or speak a command..."
            value={commandText}
            onChange={(e) => setCommandText(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <button className="h-8 w-8 rounded-full border border-neutral-700 hover:border-neutral-500" aria-label="Voice input" />
        </div>
        <div className="flex flex-col items-center gap-4">
          <div className="h-24 w-24 rounded-full border border-neutral-700 flex items-center justify-center">
            <span className="h-8 w-8 rounded-full border border-neutral-500" aria-hidden />
          </div>
          <button
            onClick={handleEnter}
            className="px-5 py-2 rounded-full border border-neutral-600 text-neutral-100 hover:border-neutral-300"
          >
            Enter Control Room
          </button>
        </div>
      </div>
    </div>
  );
}
