import { useRef, useState } from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { User } from '@supabase/supabase-js';
import { AuthScreen } from '../components/settings/AuthScreen';
import type { AppSession, SignOutResult } from '../hooks/useAppSession';

const sendOtpMock = vi.fn();
const verifyOtpMock = vi.fn();

vi.mock('../sync/authService', async () => {
  const actual = await vi.importActual<typeof import('../sync/authService')>('../sync/authService');
  return {
    ...actual,
    sendOtp: (...args: unknown[]) => sendOtpMock(...args),
    verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
  };
});

function AuthTestBed({
  emailReady = true,
  onBack = vi.fn(),
}: {
  emailReady?: boolean;
  onBack?: () => void;
}) {
  const [otpSent, setOtpSent] = useState(false);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const otpGenRef = useRef(0);

  const session: AppSession = {
    user: null,
    authPhase: otpSent ? 'otp_sent' : 'idle',
    onboardingComplete: true,
    completeOnboarding: vi.fn(),
    draft: null,
    persistDraft: vi.fn(),
    syncStatus: 'idle',
    syncError: null,
    conflict: null,
    dismissConflict: vi.fn(),
    resolveConflict: vi.fn(),
    runSync: vi.fn(),
    otpEmail,
    resetOtpFlow: () => {
      otpGenRef.current += 1;
      setOtpSent(false);
      setOtpEmail(null);
    },
    handleSendOtp: async (email: string) => {
      const gen = otpGenRef.current;
      const result = await sendOtpMock(email);
      if (gen !== otpGenRef.current) return { ok: false, error: '送信がキャンセルされました。' };
      if (result.ok) {
        setOtpEmail(email);
        setOtpSent(true);
      }
      return result;
    },
    handleVerifyOtp: async (token: string) => {
      if (!otpEmail) return { ok: false, error: 'メールアドレスを入力してコードを送信してください。' };
      return verifyOtpMock(otpEmail, token);
    },
    handleSignOut: vi.fn(async (): Promise<SignOutResult> => ({ needsConfirm: false, ok: true })),
    handleDeleteAccount: vi.fn(async () => ({ ok: true })),
    syncHalted: false,
    importPending: false,
    setSyncHalted: vi.fn(),
    online: true,
    initialScreen: 'garden',
    metaLoaded: true,
    isSupabaseConfigured: true,
    isAuthEmailDeliveryReady: emailReady,
  };

  return <AuthScreen session={session} onBack={onBack} />;
}

function AuthenticatedAuthTestBed({
  syncError = null,
  onBack = vi.fn(),
  handleSignOut = vi.fn(async (): Promise<SignOutResult> => ({ needsConfirm: false, ok: true })),
}: {
  syncError?: string | null;
  onBack?: () => void;
  handleSignOut?: AppSession['handleSignOut'];
}) {
  const session: AppSession = {
    user: { id: 'u1', email: 'a@test.local' } as User,
    authPhase: 'authenticated',
    onboardingComplete: true,
    completeOnboarding: vi.fn(),
    draft: null,
    persistDraft: vi.fn(),
    syncStatus: 'error',
    syncError,
    conflict: null,
    dismissConflict: vi.fn(),
    resolveConflict: vi.fn(),
    runSync: vi.fn(),
    otpEmail: null,
    resetOtpFlow: vi.fn(),
    handleSendOtp: vi.fn(),
    handleVerifyOtp: vi.fn(),
    handleSignOut,
    handleDeleteAccount: vi.fn(async () => ({ ok: true })),
    syncHalted: false,
    importPending: false,
    setSyncHalted: vi.fn(),
    online: true,
    initialScreen: 'garden',
    metaLoaded: true,
    isSupabaseConfigured: true,
    isAuthEmailDeliveryReady: true,
  };

  return <AuthScreen session={session} onBack={onBack} />;
}

describe('AuthScreen OTP recovery (G4, mocked)', () => {
  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    sendOtpMock.mockResolvedValue({ ok: true });
    verifyOtpMock.mockResolvedValue({ ok: true, user: { id: 'u1', email: 'a@test.local' } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks send when email delivery is not ready', () => {
    render(<AuthTestBed emailReady={false} />);
    expect(screen.getByText(/引き継ぎの準備中/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '認証コードを送信' })).toBeDisabled();
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it('shows destination, supports resend cooldown, and verifies with fixed email', async () => {
    render(<AuthTestBed />);

    fireEvent.change(screen.getByRole('textbox', { name: /メールアドレス/ }), {
      target: { value: 'a@test.local' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '認証コードを送信' }));
    });

    expect(sendOtpMock).toHaveBeenCalledWith('a@test.local');
    expect(screen.getByText(/a@test\.local/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /再送/ })).toBeDisabled();

    fireEvent.change(screen.getByLabelText('認証コード'), { target: { value: '123456' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    });
    expect(verifyOtpMock).toHaveBeenCalledWith('a@test.local', '123456');
  });

  it('returns to email entry when changing address from OTP step', async () => {
    render(<AuthTestBed />);
    fireEvent.change(screen.getByRole('textbox', { name: /メールアドレス/ }), {
      target: { value: 'old@test.local' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '認証コードを送信' }));
    });
    expect(screen.getByLabelText('認証コード')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'メールアドレスを変更' }));
    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /メールアドレス/ })).toBeInTheDocument();
    });
    expect(screen.queryByLabelText('認証コード')).not.toBeInTheDocument();
  });

  it('enables resend after 60s, calls resend once, and keeps errors recoverable', async () => {
    vi.useFakeTimers();
    render(<AuthTestBed />);

    fireEvent.change(screen.getByRole('textbox', { name: /メールアドレス/ }), {
      target: { value: 'a@test.local' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '認証コードを送信' }));
    });

    expect(sendOtpMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: /再送/ })).toBeDisabled();

    await act(async () => {
      vi.advanceTimersByTime(60_000);
    });

    const resendButton = screen.getByRole('button', { name: '認証コードを再送' });
    expect(resendButton).not.toBeDisabled();

    sendOtpMock.mockResolvedValueOnce({ ok: false, error: '通信に失敗しました。接続を確認してからもう一度お試しください。' });
    await act(async () => {
      fireEvent.click(resendButton);
    });

    expect(sendOtpMock).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/通信に失敗しました/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '認証コードを再送' })).not.toBeDisabled();

    sendOtpMock.mockResolvedValueOnce({ ok: true });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '認証コードを再送' }));
    });
    expect(sendOtpMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole('button', { name: /再送/ })).toBeDisabled();
  });

  it('shows actionable error for invalid code', async () => {
    verifyOtpMock.mockResolvedValue({ ok: false, error: '認証コードが正しくありません。' });
    render(<AuthTestBed />);

    fireEvent.change(screen.getByRole('textbox', { name: /メールアドレス/ }), {
      target: { value: 'a@test.local' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '認証コードを送信' }));
    });
    fireEvent.change(screen.getByLabelText('認証コード'), { target: { value: '000000' } });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ログイン' }));
    });
    expect(screen.getByText(/認証コードが正しくありません/)).toBeInTheDocument();
  });
});

describe('AuthScreen logged-in failures (G4, mocked)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows sync error on authenticated account screen', () => {
    render(
      <AuthenticatedAuthTestBed syncError="同期に失敗しました。接続を確認してからもう一度お試しください。" />,
    );
    expect(screen.getByText(/同期に失敗しました/)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'アカウント' })).toBeInTheDocument();
  });

  it('shows logout error, stays on account screen, and allows retry', async () => {
    const onBack = vi.fn();
    const handleSignOut = vi
      .fn()
      .mockResolvedValueOnce({
        needsConfirm: false,
        ok: false,
        error: '通信に失敗しました。接続を確認してからもう一度お試しください。',
      })
      .mockResolvedValueOnce({ needsConfirm: false, ok: true });

    render(<AuthenticatedAuthTestBed onBack={onBack} handleSignOut={handleSignOut} />);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    });

    expect(screen.getByText(/通信に失敗しました/)).toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
    expect(screen.getByRole('heading', { name: 'アカウント' })).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'ログアウト' }));
    });

    expect(handleSignOut).toHaveBeenCalledTimes(2);
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
