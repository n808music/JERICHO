import React from 'react';
import '@testing-library/jest-dom';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import BlockColumn from '../../src/components/zion/BlockColumn.jsx';

describe('draft overlay visibility', () => {
  it('does not render ghost draft blocks when proposed drafts are empty', () => {
    render(<BlockColumn dateLabel="2026-03-01" blocks={[]} drafts={[]} />);
    expect(screen.queryByText(/Draft/i)).not.toBeInTheDocument();
  });

  it('renders ghost draft blocks when proposed drafts exist', () => {
    render(
      <BlockColumn
        dateLabel="2026-03-01"
        blocks={[]}
        drafts={[
          {
            id: 'suggested:d1',
            title: 'Draft block',
            startISO: '2026-03-01T09:00:00.000Z',
            minutes: 45,
            domainKey: 'FOCUS',
          },
        ]}
      />
    );

    expect(screen.getByTestId('ghost-suggested:d1')).toBeInTheDocument();
  });
});
