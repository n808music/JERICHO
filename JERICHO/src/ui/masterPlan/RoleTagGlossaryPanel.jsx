import React, { useState } from 'react';
import {
  ENTITY_ROLE_TAGS,
  ROLE_TAG_DISPLAY_LABELS,
} from '../../domain/enterprise/entityRoleTags';

// Canonical definitions live-sourced from entityRoleTags.ts header comment.
// Expanded for readability with functional consequences and auto-tagging note.
const EXPANDED_DEFINITIONS = {
  business: {
    description: 'A business node: an entity whose defining activity is selling a product or service (P&L-based revenue).',
    consequence: 'Can own Initiatives, Projects, Systems, and other business structures.',
  },
  initiative: {
    description: 'Campaign leader: launches and runs missions. An entity designated to lead work streams, initiatives, or campaigns.',
    consequence: 'Can own Projects, Deliverables, and other initiative-driven work.',
    autoTag: true,
  },
  project: {
    description: 'Project operator: can own finite-duration Projects. An entity responsible for scoped, time-bounded work.',
    consequence: 'Can own Projects and Deliverables produced by those projects.',
    autoTag: false,
  },
  system: {
    description: 'System custodian: runs recurring engines and operational systems. An entity that stewards ongoing, live systems.',
    consequence: 'Can own Systems and recurring operational structures.',
    autoTag: true,
  },
};

export function RoleTagGlossaryButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        style={{
          padding: '4px 10px',
          fontSize: 11,
          fontWeight: 500,
          color: '#60a5fa',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textDecoration: 'underline',
          marginTop: 8,
        }}
        title="View definitions of entity role-tags"
      >
        What do these mean?
      </button>
      {isOpen && <RoleTagGlossaryPanel onClose={() => setIsOpen(false)} />}
    </>
  );
}

function RoleTagGlossaryPanel({ onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#18181b',
          border: '1px solid #3f3f46',
          borderRadius: 12,
          padding: '32px',
          maxWidth: 700,
          maxHeight: '90vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px rgba(0, 0, 0, 0.15)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#f4f4f5', margin: 0 }}>
            Entity Role-Tags
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              fontSize: 20,
              background: 'transparent',
              border: 'none',
              color: '#71717a',
              cursor: 'pointer',
              padding: 0,
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {ENTITY_ROLE_TAGS.map((tag) => {
            const def = EXPANDED_DEFINITIONS[tag];
            const label = ROLE_TAG_DISPLAY_LABELS[tag];
            return (
              <div key={tag} style={{ borderBottom: '1px solid #3f3f46', paddingBottom: 20 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 700,
                    color: '#60a5fa',
                    marginBottom: 6,
                  }}
                >
                  {label}
                </div>
                <p style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.6, margin: '0 0 8px 0' }}>
                  {def.description}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: '#a1a1aa',
                    lineHeight: 1.6,
                    margin: '0 0 8px 0',
                  }}
                >
                  <strong>Consequence:</strong> {def.consequence}
                </p>
                {def.autoTag && (
                  <p
                    style={{
                      fontSize: 12,
                      color: '#fbbf24',
                      lineHeight: 1.6,
                      margin: 0,
                      background: '#1c1007',
                      border: '1px solid #78350f',
                      borderRadius: 4,
                      padding: '6px 8px',
                    }}
                  >
                    <strong>Note:</strong> This tag may be added automatically if the entity owns an Initiative or System,
                    even if not explicitly selected here.
                  </p>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '8px 20px',
              fontSize: 12,
              fontWeight: 600,
              background: '#1e3a5f',
              border: '1px solid #3b82f6',
              color: '#93c5fd',
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
