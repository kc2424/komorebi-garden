import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useState } from 'react';
import { SkySettingsDialog } from '../components/garden/SkySettingsDialog';
import { DEFAULT_SKY_SETTINGS } from '../utils/skySettings';
import type { SkyMode } from '../utils/skyTime';

describe('SkySettingsDialog', () => {
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function showModal(this: HTMLDialogElement) {
      this.setAttribute('open', '');
    });
    HTMLDialogElement.prototype.close = vi.fn(function close(this: HTMLDialogElement) {
      this.removeAttribute('open');
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function ControlledDialog() {
    const [open, setOpen] = useState(false);
    const [settings, setSettings] = useState(DEFAULT_SKY_SETTINGS);

    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          空の設定
        </button>
        <SkySettingsDialog
          open={open}
          settings={settings}
          onClose={() => setOpen(false)}
          onModeChange={(mode) => setSettings((prev) => ({ ...prev, mode }))}
          onMotionChange={(motion) => setSettings((prev) => ({ ...prev, motion }))}
        />
      </>
    );
  }

  it('stops background arrow and escape handlers while open', () => {
    const backgroundHandler = vi.fn();
    window.addEventListener('keydown', backgroundHandler);

    render(
      <SkySettingsDialog
        open
        settings={DEFAULT_SKY_SETTINGS}
        onClose={vi.fn()}
        onModeChange={vi.fn()}
        onMotionChange={vi.fn()}
      />,
    );

    const dialog = screen.getByRole('dialog');
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    fireEvent.keyDown(dialog, { key: 'Escape' });

    expect(backgroundHandler).not.toHaveBeenCalled();
    window.removeEventListener('keydown', backgroundHandler);
  });

  it('does not close on keyboard-style radio click with 0,0 coordinates', () => {
    function NightModeDialog() {
      const [open, setOpen] = useState(false);
      const [settings, setSettings] = useState({
        ...DEFAULT_SKY_SETTINGS,
        mode: 'night' as SkyMode,
      });

      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            空の設定
          </button>
          <SkySettingsDialog
            open={open}
            settings={settings}
            onClose={() => setOpen(false)}
            onModeChange={(mode) => setSettings((prev) => ({ ...prev, mode }))}
            onMotionChange={(motion) => setSettings((prev) => ({ ...prev, motion }))}
          />
        </>
      );
    }

    render(<NightModeDialog />);

    const opener = screen.getByRole('button', { name: '空の設定' });
    act(() => {
      fireEvent.click(opener);
    });

    const dialog = screen.getByRole('dialog');
    vi.spyOn(dialog, 'getBoundingClientRect').mockReturnValue({
      left: 10,
      top: 20,
      right: 400,
      bottom: 500,
      width: 390,
      height: 480,
      x: 10,
      y: 20,
      toJSON: () => ({}),
    });

    const nightRadio = screen.getByRole('radio', { name: '夜' });
    const duskRadio = screen.getByRole('radio', { name: '夕' });
    act(() => {
      nightRadio.focus();
    });
    expect(nightRadio).toBeChecked();

    act(() => {
      fireEvent.click(duskRadio, { clientX: 0, clientY: 0, detail: 0 });
    });

    expect(duskRadio).toBeChecked();
    expect(screen.getByRole('button', { name: '閉じる' })).toBeInTheDocument();
    expect(document.activeElement).not.toBe(opener);
  });

  it('returns focus to the opener after close', () => {
    render(<ControlledDialog />);

    const opener = screen.getByRole('button', { name: '空の設定' });
    opener.focus();
    expect(document.activeElement).toBe(opener);

    act(() => {
      fireEvent.click(opener);
    });

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    });

    expect(document.activeElement).toBe(opener);
  });
});
