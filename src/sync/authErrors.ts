const OTP_RESEND_COOLDOWN_SEC = 60;

export { OTP_RESEND_COOLDOWN_SEC };

export type AuthErrorContext = 'send' | 'verify' | 'signout';

function fallbackMessage(context: AuthErrorContext): string {
  switch (context) {
    case 'send':
      return '認証コードの送信に失敗しました。もう一度お試しください。';
    case 'signout':
      return 'ログアウトに失敗しました。もう一度お試しください。';
    default:
      return 'ログインに失敗しました。もう一度お試しください。';
  }
}

function isRateLimitError(lower: string): boolean {
  return lower.includes('rate') || lower.includes('429') || lower.includes('too many');
}

function isNetworkError(lower: string): boolean {
  return (
    lower.includes('network') ||
    lower.includes('fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('connection')
  );
}

function isEmailValidationError(lower: string): boolean {
  if (lower.includes('invalid email') || lower.includes('email address')) return true;
  if (lower.includes('email') && (lower.includes('invalid') || lower.includes('malformed') || lower.includes('format'))) {
    return true;
  }
  return lower.includes('valid email');
}

function isOtpExpiredError(lower: string): boolean {
  return lower.includes('expired') || lower.includes('otp_expired');
}

function isOtpInvalidError(lower: string): boolean {
  return (
    lower.includes('invalid') ||
    lower.includes('token') ||
    lower.includes('otp') ||
    (lower.includes('code') && !lower.includes('status code'))
  );
}

function isSendServiceError(lower: string): boolean {
  return (
    lower.includes('smtp') ||
    lower.includes('sending') ||
    lower.includes('confirmation email') ||
    lower.includes('send email') ||
    lower.includes('mail delivery') ||
    lower.includes('email provider') ||
    lower.includes('unable to send')
  );
}

export function mapAuthErrorMessage(
  error: string | undefined,
  context: AuthErrorContext = 'verify',
): string {
  if (!error) return fallbackMessage(context);

  const lower = error.toLowerCase();

  if (isRateLimitError(lower)) {
    return `送信が多すぎます。${OTP_RESEND_COOLDOWN_SEC}秒ほど待ってから再送してください。`;
  }
  if (isNetworkError(lower)) {
    return '通信に失敗しました。接続を確認してからもう一度お試しください。';
  }
  if (isEmailValidationError(lower)) {
    return 'メールアドレスを確認してください。';
  }

  if (context === 'verify') {
    if (isOtpExpiredError(lower)) {
      return '認証コードの有効期限が切れました。再送して新しいコードを入力してください。';
    }
    if (isOtpInvalidError(lower)) {
      return '認証コードが正しくありません。入力を確認するか、再送してください。';
    }
    return fallbackMessage(context);
  }

  if (context === 'send') {
    if (isSendServiceError(lower)) {
      return '認証コードの送信に失敗しました。しばらくしてからもう一度お試しください。';
    }
    return fallbackMessage(context);
  }

  return fallbackMessage(context);
}
