import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Landing } from './Landing';

const stubMotion = (reduce: boolean) =>
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduce && q.includes('reduce'), media: q, addEventListener() {}, removeEventListener() {}, onchange: null, addListener() {}, removeListener() {}, dispatchEvent: () => false }));

afterEach(() => vi.unstubAllGlobals());

describe('landing page motion', () => {
  it('pins the step-by-step sections when motion is allowed', () => {
    stubMotion(false);
    const { container } = render(<Landing onStart={() => {}} />);
    expect(container.querySelector('.scroll-motion')).not.toBeNull();
    expect(container.querySelector('#how')).toHaveAttribute('data-scroll', 'pin');
  });

  it('is a normal, still page with reduced motion — and nothing is hidden', () => {
    stubMotion(true);
    const { container } = render(<Landing onStart={() => {}} />);
    expect(container.querySelector('.scroll-motion')).toBeNull();
    expect(container.querySelector('#how')).not.toHaveAttribute('data-scroll');
    expect(screen.getByText('Do the Thing You’ve Been Afraid Of')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Your data stays yours.' })).toBeInTheDocument();
  });
});
