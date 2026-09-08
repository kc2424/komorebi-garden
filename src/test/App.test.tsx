import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders garden screen with Japanese title after hydration', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'こもれび植物園' })).toBeInTheDocument();
  });

  it('shows discover button on garden screen', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: '植物を見つけた' })).toBeInTheDocument();
  });
});
