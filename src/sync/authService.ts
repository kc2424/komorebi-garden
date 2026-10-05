import type { User } from '@supabase/supabase-js';
import { getSupabase, isAuthEmailDeliveryReady, isSupabaseConfigured } from './supabaseClient';
import { mapAuthErrorMessage } from './authErrors';

export type AuthPhase = 'idle' | 'otp_sent' | 'authenticated' | 'unconfigured';

export interface AuthSession {
  user: User | null;
  email: string | null;
  phase: AuthPhase;
}

export function getAuthPhase(user: User | null, otpSent: boolean): AuthPhase {
  if (!isSupabaseConfigured()) return 'unconfigured';
  if (user) return 'authenticated';
  if (otpSent) return 'otp_sent';
  return 'idle';
}

export async function sendOtp(email: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: '同期サービスが未設定です。接続情報を設定してください。' };
  }
  if (!isAuthEmailDeliveryReady()) {
    return {
      ok: false,
      error: '引き継ぎの準備中です。この端末で記録を始められます。',
    };
  }
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true },
  });
  if (error) return { ok: false, error: mapAuthErrorMessage(error.message, 'send') };
  return { ok: true };
}

export async function verifyOtp(
  email: string,
  token: string,
): Promise<{ ok: boolean; user?: User; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: '同期サービスが未設定です。' };
  }
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) return { ok: false, error: mapAuthErrorMessage(error.message, 'verify') };
  if (!data.user) return { ok: false, error: 'ログインに失敗しました。' };
  return { ok: true, user: data.user };
}

export { isAuthEmailDeliveryReady };

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabase();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function signOut(): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: '同期サービスが未設定です。接続情報を設定してください。' };
  }
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      return { ok: false, error: mapAuthErrorMessage(error.message, 'signout') };
    }
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, error: mapAuthErrorMessage(message, 'signout') };
  }
}

export async function deleteAccount(): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) {
    return { ok: false, error: '同期サービスが未設定です。' };
  }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    return { ok: false, error: 'ログインが必要です。' };
  }

  const { error } = await supabase.functions.invoke('delete-account', {
    headers: { Authorization: `Bearer ${sessionData.session.access_token}` },
  });
  if (error) return { ok: false, error: error.message };
  await supabase.auth.signOut();
  return { ok: true };
}
