/**
 * SequencingStrategyReconfigureButton.jsx
 *
 * Button component for reconfiguring an initiative's sequencing strategy.
 * Opens the SequencingStrategyModal.
 *
 * Used on Initiative detail/panel views where operators can adjust their
 * Foundation-First vs Output-First choice post-creation.
 */

import React from 'react';

export default function SequencingStrategyReconfigureButton({ initiativeId, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(initiativeId)}
      className={`rounded-lg border border-jericho-accent/60 bg-jericho-accent/10 px-3 py-2 text-xs font-medium text-jericho-accent hover:bg-jericho-accent/20 transition ${className}`}
    >
      Configure Sequencing Strategy
    </button>
  );
}
