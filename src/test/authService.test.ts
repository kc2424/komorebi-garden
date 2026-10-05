import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as supabaseClient from '../sync/supabaseClient';
import { sendOtp, verifyOtp, signOut } from '../sync/authService';
import { mapAuthErrorMessage } from '../sync/authErrors';

describe('mapAuthErrorMessage routing', () => {
  it('routes invalid email on send before generic invalid/token', () => {
    expect(mapAuthErrorMessage('Invalid email address', 'send')).toBe(
      'メールアドレスを確認してください。',
    );
  });

  it('routes OTP errors on verify without treating send SMTP failures as invalid email', () => {
    expect(mapAuthErrorMessage('Token has expired or is invalid', 'verify')).toBe(
      '認証コードの有効期限が切れました。再送して新しいコードを入力してください。',
    );
    expect(mapAuthErrorMessage('Invalid OTP', 'verify')).toBe(
      '認証コードが正しくありません。入力を確認するか、再送してください。',
    );
    expect(mapAuthErrorMessage('Error sending confirmation email', 'send')).toBe(
      '認証コードの送信に失敗しました。しばらくしてからもう一度お試しください。',
    );
  });

  it('returns Japanese fallbacks instead of raw English for unknown errors', () => {
    expect(mapAuthErrorMessage('Unexpected upstream failure', 'send')).toBe(
      '認証コードの送信に失敗しました。もう一度お試しください。',
    );
    expect(mapAuthErrorMessage('Unexpected upstream failure', 'verify')).toBe(
      'ログインに失敗しました。もう一度お試しください。',
    );
    expect(mapAuthErrorMessage('Unexpected upstream failure', 'signout')).toBe(
      'ログアウトに失敗しました。もう一度お試しください。',
    );
  });
});

describe('authService error mapping (mocked Supabase)', () => {
  const signInWithOtpMock = vi.fn();
  const verifyOtpMock = vi.fn();
  const signOutMock = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(supabaseClient, 'isAuthEmailDeliveryReady').mockReturnValue(true);
    vi.spyOn(supabaseClient, 'getSupabase').mockReturnValue({
      auth: {
        signInWithOtp: signInWithOtpMock,
        verifyOtp: verifyOtpMock,
        signOut: signOutMock,
      },
    } as never);
  });

  it('maps send invalid email from Supabase to email correction guidance', async () => {
    signInWithOtpMock.mockResolvedValue({ error: { message: 'Invalid email address' } });

    const result = await sendOtp('not-an-email');

    expect(result).toEqual({ ok: false, error: 'メールアドレスを確認してください。' });
  });

  it('maps send service errors without describing them as invalid email', async () => {
    signInWithOtpMock.mockResolvedValue({
      error: { message: 'Error sending confirmation email' },
    });

    const result = await sendOtp('user@test.com');

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/送信に失敗/);
    expect(result.error).not.toMatch(/メールアドレスを確認/);
    expect(result.error).not.toMatch(/認証コードが正しく/);
  });

  it('maps verify invalid and expired codes from Supabase', async () => {
    verifyOtpMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Token has expired or is invalid' },
    });
    const expired = await verifyOtp('user@test.com', '123456');
    expect(expired).toEqual({
      ok: false,
      error: '認証コードの有効期限が切れました。再送して新しいコードを入力してください。',
    });

    verifyOtpMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: 'Invalid OTP' },
    });
    const invalid = await verifyOtp('user@test.com', '000000');
    expect(invalid).toEqual({
      ok: false,
      error: '認証コードが正しくありません。入力を確認するか、再送してください。',
    });
  });

  it('maps rate limit and network errors for send and verify', async () => {
    signInWithOtpMock.mockResolvedValueOnce({
      error: { message: 'Email rate limit exceeded' },
    });
    const rateLimitedSend = await sendOtp('user@test.com');
    expect(rateLimitedSend.error).toMatch(/送信が多すぎます/);

    verifyOtpMock.mockResolvedValueOnce({
      data: { user: null },
      error: { message: '429 Too Many Requests' },
    });
    const rateLimitedVerify = await verifyOtp('user@test.com', '123456');
    expect(rateLimitedVerify.error).toMatch(/送信が多すぎます/);

    signInWithOtpMock.mockResolvedValueOnce({
      error: { message: 'Failed to fetch' },
    });
    const networkSend = await sendOtp('user@test.com');
    expect(networkSend.error).toBe('通信に失敗しました。接続を確認してからもう一度お試しください。');
  });

  it('maps signOut returned and thrown errors to actionable Japanese copy', async () => {
    signOutMock.mockResolvedValueOnce({ error: { message: 'Network request failed' } });
    const returned = await signOut();
    expect(returned).toEqual({
      ok: false,
      error: '通信に失敗しました。接続を確認してからもう一度お試しください。',
    });

    signOutMock.mockRejectedValueOnce(new Error('fetch failed'));
    const thrown = await signOut();
    expect(thrown.ok).toBe(false);
    expect(thrown.error).toBe('通信に失敗しました。接続を確認してからもう一度お試しください。');

    signOutMock.mockResolvedValueOnce({ error: { message: 'Session not found' } });
    const unknown = await signOut();
    expect(unknown).toEqual({
      ok: false,
      error: 'ログアウトに失敗しました。もう一度お試しください。',
    });
  });
});
