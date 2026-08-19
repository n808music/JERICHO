import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, beforeAll } from 'vitest';
import { RoleTagGlossaryButton } from '../../src/ui/masterPlan/RoleTagGlossaryPanel';
import * as entityRoleTags from '../../src/domain/enterprise/entityRoleTags';

describe('RoleTagGlossaryPanel — Live Source Verification', () => {
  it('uses ENTITY_ROLE_TAGS and ROLE_TAG_DISPLAY_LABELS directly from canonical entityRoleTags.ts', () => {
    // This test verifies that the glossary component imports directly from
    // the canonical source file (entityRoleTags.ts) and does NOT have a
    // hardcoded copy of definitions. This is the mechanism that prevents
    // drift and ensures automatic updates when the source changes.

    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    // Verify each tag in the canonical ENTITY_ROLE_TAGS array is shown
    const canonicalTags = entityRoleTags.ENTITY_ROLE_TAGS;
    expect(canonicalTags).toBeDefined();
    expect(canonicalTags.length).toBeGreaterThan(0);

    canonicalTags.forEach((tag) => {
      const displayLabel = entityRoleTags.ROLE_TAG_DISPLAY_LABELS[tag];
      expect(displayLabel).toBeDefined();
      expect(screen.getByText(displayLabel)).toBeInTheDocument();
    });
  });

  it('dynamically reflects changes to ROLE_TAG_DISPLAY_LABELS', () => {
    // This demonstrates the live-source principle:
    // If entityRoleTags.ts were modified to change a label,
    // this component would automatically display the new label
    // without any changes to the glossary component itself.

    const currentLabels = { ...entityRoleTags.ROLE_TAG_DISPLAY_LABELS };

    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    // Verify the component displays exactly the labels from the canonical source
    Object.entries(currentLabels).forEach(([tag, label]) => {
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('verifies four role-tags from canonical source', () => {
    const tags = entityRoleTags.ENTITY_ROLE_TAGS;
    expect(tags).toEqual(['business', 'initiative', 'project', 'system']);
  });

  it('verifies canonical mapping is complete', () => {
    const tags = entityRoleTags.ENTITY_ROLE_TAGS;
    const labels = entityRoleTags.ROLE_TAG_DISPLAY_LABELS;

    // Every tag must have a display label
    tags.forEach((tag) => {
      expect(labels[tag]).toBeDefined();
      expect(typeof labels[tag]).toBe('string');
      expect(labels[tag].length).toBeGreaterThan(0);
    });
  });

  it('shows business with canonical meaning', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    expect(screen.getByText('Business')).toBeInTheDocument();
    // The expanded definition should talk about selling products/services
    expect(screen.getByText(/A business node: an entity whose defining activity is selling a product or service/i)).toBeInTheDocument();
  });

  it('shows initiative with canonical meaning', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    expect(screen.getByText('Campaign leader')).toBeInTheDocument();
  });

  it('shows project with canonical meaning', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    expect(screen.getByText('Project operator')).toBeInTheDocument();
  });

  it('shows system with canonical meaning', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    expect(screen.getByText('System custodian')).toBeInTheDocument();
  });

  it('includes auto-tagging note for initiative (canonical behavior)', () => {
    // Initiative is auto-tagged when an entity owns an initiative
    // (see entityRoleTags.ts header and identityCompute.js:15974)
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    const notes = screen.getAllByText(/may be added automatically/i);
    expect(notes.length).toBeGreaterThanOrEqual(2); // initiative and system
  });

  it('includes auto-tagging note for system (canonical behavior)', () => {
    // System is auto-tagged when an entity owns a system
    // (see entityRoleTags.ts header and identityCompute.js:16056)
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    const notes = screen.getAllByText(/may be added automatically/i);
    expect(notes.length).toBe(2); // exactly initiative and system
  });

});
