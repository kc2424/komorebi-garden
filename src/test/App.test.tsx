import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App', () => {
  it('renders garden screen with Japanese title after hydration', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'こもれび植物園' })).toBeInTheDocument();
  });

  it('shows main garden entrances on viewing home', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: '撮る' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '庭づくり' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '記録' })).toBeInTheDocument();
  });
});
