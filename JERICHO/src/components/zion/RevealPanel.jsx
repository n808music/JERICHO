import React from 'react';

export default function RevealPanel({ open, title, onClose, children, actionLabel = 'Insert block', onAction }) {
  if (!open) return null;
  // Deprecated overlay; return null to avoid transparent screens
  return null;
}
