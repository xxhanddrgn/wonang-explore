/**
 * Synology NAS 인증 모듈
 * 2단계 인증(OTP) 및 Device Token 지원
 */

const NAS_URL = process.env.NAS_URL || '';
const NAS_ACCOUNT = process.env.NAS_ACCOUNT || '';
const NAS_PASSWORD = process.env.NAS_PASSWORD || '';
const NAS_UPLOAD_PATH = process.env.NAS_UPLOAD_PATH || '/lecture-notes';
const NAS_DEVICE_TOKEN = process.env.NAS_DEVICE_TOKEN || '';

export { NAS_URL, NAS_ACCOUNT, NAS_PASSWORD, NAS_UPLOAD_PATH };

export function isNasConfigured(): boolean {
  return !!(NAS_URL && NAS_ACCOUNT && NAS_PASSWORD);
}

export async function nasLogin(otpCode?: string): Promise<string> {
  const params: Record<string, string> = {
    api: 'SYNO.API.Auth',
    version: '6',
    method: 'login',
    account: NAS_ACCOUNT,
    passwd: NAS_PASSWORD,
    session: 'FileStation',
    format: 'sid',
  };

  // Device token이 있으면 OTP 없이 로그인 가능
  if (NAS_DEVICE_TOKEN) {
    params.device_id = NAS_DEVICE_TOKEN;
    params.device_name = 'LectureNotesPlatform';
  }

  // OTP 코드가 제공된 경우 (setup 시)
  if (otpCode) {
    params.otp_code = otpCode;
    params.enable_device_token = 'yes';
    params.device_name = 'LectureNotesPlatform';
  }

  const searchParams = new URLSearchParams(params);
  const res = await fetch(`${NAS_URL}/webapi/auth.cgi?${searchParams}`);
  const data = await res.json();

  if (!data.success) {
    const code = data.error?.code;
    if (code === 403) {
      throw new Error(
        'NAS 2단계 인증이 필요합니다. /api/nas/setup 에서 OTP 설정을 완료하세요.'
      );
    }
    if (code === 400) {
      throw new Error('NAS 계정 또는 비밀번호가 올바르지 않습니다.');
    }
    if (code === 404) {
      throw new Error('OTP 코드가 올바르지 않습니다.');
    }
    throw new Error(`NAS 로그인 실패 (에러코드: ${code})`);
  }

  return data.data.sid;
}

/**
 * OTP 코드로 로그인하여 device token을 발급받음 (최초 1회)
 */
export async function nasLoginWithOtp(
  otpCode: string
): Promise<{ sid: string; deviceToken: string }> {
  const params = new URLSearchParams({
    api: 'SYNO.API.Auth',
    version: '6',
    method: 'login',
    account: NAS_ACCOUNT,
    passwd: NAS_PASSWORD,
    session: 'FileStation',
    format: 'sid',
    otp_code: otpCode,
    enable_device_token: 'yes',
    device_name: 'LectureNotesPlatform',
  });

  const res = await fetch(`${NAS_URL}/webapi/auth.cgi?${params}`);
  const data = await res.json();

  if (!data.success) {
    const code = data.error?.code;
    if (code === 404) {
      throw new Error('OTP 코드가 올바르지 않습니다. 다시 시도하세요.');
    }
    throw new Error(`NAS 로그인 실패 (에러코드: ${code})`);
  }

  return {
    sid: data.data.sid,
    deviceToken: data.data.did || '',
  };
}

export async function nasLogout(sid: string): Promise<void> {
  const params = new URLSearchParams({
    api: 'SYNO.API.Auth',
    version: '6',
    method: 'logout',
    session: 'FileStation',
    _sid: sid,
  });

  await fetch(`${NAS_URL}/webapi/auth.cgi?${params}`).catch(() => {});
}
