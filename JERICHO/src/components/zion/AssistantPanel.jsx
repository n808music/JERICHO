import React, { useEffect, useState } from 'react';
import { useIdentityStore, getAssistantContext } from '../../state/identityStore.js';

function buildAssistantReply(command, ctx) {
  const text = (command || '').toLowerCase();
  if (text.includes('what do i do next') || text.includes('what should i do next')) {
    const next = ctx.nextSuggestion;
    if (next) {
      return `Next block: ${next.practice} ${formatTime(next.startISO)}–${formatTime(next.endISO)}. ${next.reason}`;
    }
    return 'No next block suggestion available yet. Check Today view for current blocks.';
  }
  if (text.includes('how do i use') || text.includes('help')) {
    return 'You are in the Jericho System. The black screen is Home; Zion is the control room. Use Today to schedule and execute, Structure to refine your contract and patterns, and Stability to see drift and integrity.';
  }
  if (text.includes('review last week')) {
    const comp = Math.round((ctx.currentWeek?.metrics?.completionRate || 0) * 100);
    const drift = ctx.currentWeek?.metrics?.driftLabel || ctx.vector?.driftLabel || 'contained';
    const dom = ctx.currentWeek?.metrics?.dominantPractice || 'balanced';
    return `Last week was ${dom}-heavy, with about ${comp}% completion and drift ${drift}. Use Stability to inspect drift and Today for missed blocks.`;
  }
  if (text.includes('fix drift') || text.includes('fix this')) {
    return 'Your Stability view can rebalance today by cutting total minutes and protecting one priority block. Switch to Stability or click Rebalance Today when the banner appears.';
  }
  const drift = ctx.vector?.driftLabel || 'contained';
  const todaySummary = ctx.today?.summaryLine || 'No work logged yet.';
  return `Current drift is ${drift}. Today looks like: ${todaySummary} Use Today to adjust your blocks, or Structure to refine your contract and patterns.`;
}

export default function AssistantPanel({ isOpen, onClose, initialPrompt }) {
  const identity = useIdentityStore();
  const ctx = getAssistantContext(identity);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    if (initialPrompt) {
      addMessage('user', initialPrompt, true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialPrompt]);

  useEffect(() => {
    if (isOpen && !initialPrompt && messages.length === 0) {
      addMessage(
        'assistant',
        'You are in the Jericho System. Today shows your blocks, Structure holds your contract and patterns, and Stability explains drift.',
        false
      );
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  if (!isOpen) return null;

  function addMessage(role, text, autoReply = false) {
    const next = [...messages, { role, text }];
    setMessages(next);
    if (role === 'user' || autoReply) {
      const reply = buildAssistantReply(text, ctx);
      setMessages([...next, { role: 'assistant', text: reply }]);
    }
  }

  function handleSend() {
    if (!input.trim()) return;
    addMessage('user', input.trim());
    setInput('');
  }

  return (
    <div className="h-full flex flex-col text-xs bg-jericho-surface border border-line/60 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="uppercase tracking-[0.14em] text-muted">Assistant</span>
        <button
          className="text-[11px] text-muted hover:text-jericho-accent"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 text-sm">
        {messages.map((m, idx) => (
          <div key={idx} className={m.role === 'assistant' ? 'text-jericho-text' : 'text-muted'}>
            <span className="font-semibold capitalize">{m.role}: </span>
            <span>{m.text}</span>
          </div>
        ))}
        {!messages.length ? <p className="text-muted">Ask about navigation, last week, or how to fix drift.</p> : null}
      </div>
      <div className="mt-2 pt-2 border-t border-line/60 flex gap-2">
        <input
          className="flex-1 rounded-md border border-line/60 bg-jericho-bg px-3 py-2 text-sm"
          placeholder="Ask the assistant..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend();
          }}
        />
        <button className="px-3 py-2 rounded-md border border-jericho-accent text-jericho-accent text-sm" onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
}

function formatTime(iso = '') {
  if (!iso) return '--:--';
  const d = new Date(iso);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}
