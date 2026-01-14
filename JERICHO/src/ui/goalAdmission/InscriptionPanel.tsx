import React, { useState } from 'react';
import { Inscription } from '../../domain/goal/GoalExecutionContract';
import { computeInscriptionHash } from '../../utils/inscriptionHash';

interface InscriptionPanelProps {
  inscription: Inscription | undefined;
  onInscriptionChange: (inscription: Inscription) => void;
  isValid: boolean;
}

export default function InscriptionPanel({
  inscription,
  onInscriptionChange,
  isValid,
}: InscriptionPanelProps) {
  const [ackText, setAckText] = useState('');

  const current = inscription || {
    contractHash: '',
    inscribedAtISO: '',
    acknowledgment: '',
    acknowledgmentHash: '',
    isCompromised: false,
  };

  const handleInscribe = () => {
    if (!ackText.trim()) return;
    const ackHash = computeInscriptionHash(ackText);
    const now = new Date().toISOString();

    onInscriptionChange({
      ...current,
      acknowledgment: ackText,
      acknowledgmentHash: ackHash,
      inscribedAtISO: now,
      isCompromised: false,
    });
    setAckText('');
  };

  return (
    <div className="rounded-lg border border-line/60 bg-jericho-surface/90 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="inline-block w-5 h-5 rounded-full border border-line/60 text-[11px] flex items-center justify-center flex-shrink-0">
          7
        </span>
        <p className="text-xs uppercase tracking-[0.14em] text-muted font-semibold">Inscription (Immutability)</p>
        {isValid && <span className="text-xs text-green-600">✓</span>}
      </div>

      <div className="space-y-2 text-xs">
        <p className="text-muted">
          Once you inscribe this contract, it becomes immutable. No edits permitted. Only archive or complete.
        </p>

        {current.inscribedAtISO ? (
          <div className="rounded border border-green-600/40 bg-green-50 p-2 space-y-1">
            <p className="font-semibold text-green-900">✓ Inscribed</p>
            <p className="text-[11px] text-green-800">
              Inscribed at {new Date(current.inscribedAtISO).toLocaleString()}
            </p>
            <p className="text-[11px] text-green-700 font-mono break-all">Hash: {current.contractHash?.slice(0, 16)}…</p>
            {current.isCompromised && (
              <p className="text-[11px] text-red-700 font-semibold">⚠ Contract has been modified since inscription.</p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs uppercase tracking-[0.12em] text-muted mb-1 block">
                I understand this contract is binding and immutable
              </span>
              <textarea
                value={ackText}
                onChange={(e) => setAckText(e.target.value)}
                placeholder="Type your acknowledgment to inscribe (e.g., 'I understand this is binding')"
                className="w-full h-12 rounded border border-line/60 bg-transparent px-2 py-1 text-sm font-mono"
                minLength={5}
              />
            </label>
            <button
              onClick={handleInscribe}
              disabled={ackText.trim().length < 5}
              className="w-full rounded border border-jericho-accent px-3 py-1 text-xs text-jericho-accent hover:bg-jericho-accent/10 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Inscribe Contract
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
