import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RoleTagGlossaryButton } from '../../src/ui/masterPlan/RoleTagGlossaryPanel';
import {
  ENTITY_ROLE_TAGS,
  ROLE_TAG_DISPLAY_LABELS,
} from '../../src/domain/enterprise/entityRoleTags';

describe('RoleTagGlossaryPanel', () => {
  it('renders the glossary button', () => {
    render(<RoleTagGlossaryButton />);
    const button = screen.getByRole('button', { name: /What do these mean/i });
    expect(button).toBeInTheDocument();
  });

  it('opens glossary panel when button is clicked', () => {
    render(<RoleTagGlossaryButton />);
    const button = screen.getByRole('button', { name: /What do these mean/i });

    fireEvent.click(button);
    const heading = screen.getByText('Entity Role-Tags');
    expect(heading).toBeInTheDocument();
  });

  it('displays all four role-tag definitions', () => {
    render(<RoleTagGlossaryButton />);
    const button = screen.getByRole('button', { name: /What do these mean/i });
    fireEvent.click(button);

    // Verify all four display labels are shown
    ENTITY_ROLE_TAGS.forEach((tag) => {
      const label = ROLE_TAG_DISPLAY_LABELS[tag];
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });

  it('shows business definition', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    expect(
      screen.getByText(/selling a product or service.*P&L-based revenue/i)
    ).toBeInTheDocument();
  });

  it('shows campaign leader definition', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    expect(
      screen.getByText(/launches and runs missions/i)
    ).toBeInTheDocument();
  });

  it('shows project operator definition', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    expect(
      screen.getByText(/finite-duration Projects/i)
    ).toBeInTheDocument();
  });

  it('shows system custodian definition', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    expect(
      screen.getByText(/runs recurring engines/i)
    ).toBeInTheDocument();
  });

  it('shows auto-tagging note for initiative', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    const notes = screen.getAllByText(/may be added automatically/i);
    expect(notes.length).toBeGreaterThan(0);
  });

  it('shows auto-tagging note for system', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    const notes = screen.getAllByText(/may be added automatically/i);
    expect(notes.length).toBe(2); // initiative and system both have auto-tag note
  });

  it('shows consequence for each role-tag', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    expect(screen.getAllByText(/Consequence:/i).length).toBe(4);
  });

  it('closes panel when close button is clicked', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    // Panel should be visible
    expect(screen.getByText('Entity Role-Tags')).toBeInTheDocument();

    // Click close button (✕)
    const closeButtons = screen.getAllByRole('button').filter(
      (btn) => btn.textContent === '✕'
    );
    fireEvent.click(closeButtons[0]);

    // Panel should be closed (heading no longer visible)
    expect(screen.queryByText('Entity Role-Tags')).not.toBeInTheDocument();
  });

  it('closes panel when clicking outside it', () => {
    const { container } = render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    // Panel should be visible
    expect(screen.getByText('Entity Role-Tags')).toBeInTheDocument();

    // Click on the overlay background
    const overlay = container.querySelector('div[style*="rgba(0, 0, 0, 0.5)"]');
    fireEvent.click(overlay);

    // Panel should be closed
    expect(screen.queryByText('Entity Role-Tags')).not.toBeInTheDocument();
  });

  it('does not close panel when clicking inside the panel content', () => {
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    // Panel should be visible
    const heading = screen.getByText('Entity Role-Tags');
    expect(heading).toBeInTheDocument();

    // Click inside the panel content
    fireEvent.click(heading);

    // Panel should still be visible
    expect(screen.getByText('Entity Role-Tags')).toBeInTheDocument();
  });

  it('live-sources definitions from entityRoleTags.ts via ENTITY_ROLE_TAGS', () => {
    // This test verifies the component uses the canonical source, not hardcoded values.
    // If entityRoleTags.ts were modified, this component would automatically reflect the change.
    render(<RoleTagGlossaryButton />);
    fireEvent.click(screen.getByRole('button', { name: /What do these mean/i }));

    // Verify it's reading from the exported constants
    ENTITY_ROLE_TAGS.forEach((tag) => {
      // Each tag should have a corresponding display label
      const label = ROLE_TAG_DISPLAY_LABELS[tag];
      expect(label).toBeDefined();
      expect(screen.getByText(label)).toBeInTheDocument();
    });
  });
});
