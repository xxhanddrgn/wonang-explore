/**
 * Synology NAS 인증 모듈
 * 2단계 인증(OTP) 및 Device Token 지원
 * 로컬/외부 네트워크 자동 감지
 */

// Synology NAS는 자체 서명 SSL 인증서 사용 (포트 5001)
// Vercel 서버에서 HTTPS 연결 시 인증서 검증을 비활성화
if (typeof process !== 'undefined' && process.env) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

const NAS_LOCAL_URL = process.env.NAS_URL || '';
const NAS_EXTERNAL_URL = process.env.NAS_EXTERNAL_URL || '';
const NAS_ACCOUNT = process.env.NAS_ACCOUNT || '';
const NAS_PASSWORD = process.env.NAS_PASSWORD || '';
const NAS_UPLOAD_PATH = process.env.NAS_UPLOAD_PATH || '/lecture-notes';
const NAS_DEVICE_TOKEN = process.env.NAS_DEVICE_TOKEN || '';

export { NAS_ACCOUNT, NAS_PASSWORD, NAS_UPLOAD_PATH, NAS_EXTERNAL_URL };

/** Device token 쿠키 이름 */
export const DEVICE_TOKEN_COOKIE = 'nas_device_token';

/**
 * 요청 쿠키에서 device token 추출
 */
export function getDeviceTokenFromCookies(cookieHeader: string | null): string {
  if (!cookieHeader) return '';
  const match = cookieHeader.match(/(?:^|;\s*)nas_device_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : '';
}

// 활성 URL 캐시 (5분간 유지)
let cachedNasUrl: string | null = null;
let lastUrlCheck = 0;
const URL_CHECK_INTERVAL = 5 * 60 * 1000;

export function isNasConfigured(): boolean {
  return !!((NAS_LOCAL_URL || NAS_EXTERNAL_URL) && NAS_ACCOUNT && NAS_PASSWORD);
}

/**
 * Vercel(클라우드) 환경인지 감지
 * Vercel에서는 로컬 NAS IP에 접근 불가 → 바로 외부 URL 사용
 */
function isCloudEnvironment(): boolean {
  return !!(process.env.VERCEL || process.env.VERCEL_ENV || process.env.VERCEL_URL);
}

/**
 * 접속 가능한 NAS URL을 자동 감지
 * - Vercel 환경: 외부 DDNS URL 직접 사용 (로컬 IP 접근 불가)
 * - 로컬 환경: 로컬 URL 먼저 시도, 실패 시 외부 URL
 */
export async function getActiveNasUrl(): Promise<string> {
  const now = Date.now();

  // 캐시된 URL이 있고 5분 이내면 재사용
  if (cachedNasUrl && now - lastUrlCheck < URL_CHECK_INTERVAL) {
    return cachedNasUrl;
  }

  // Vercel 클라우드 환경에서는 로컬 IP 시도 자체를 건너뜀
  if (isCloudEnvironment()) {
    if (NAS_EXTERNAL_URL) {
      cachedNasUrl = NAS_EXTERNAL_URL;
      lastUrlCheck = now;
      console.log('[NAS] Vercel 환경 → 외부 DDNS URL 사용:', NAS_EXTERNAL_URL);
      return NAS_EXTERNAL_URL;
    }
    console.error('[NAS] Vercel 환경인데 NAS_EXTERNAL_URL이 미설정!');
    return NAS_LOCAL_URL;
  }

  // 로컬 환경: 로컬 URL 시도 (2초 타임아웃)
  if (NAS_LOCAL_URL) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(
        `${NAS_LOCAL_URL}/webapi/query.cgi?api=SYNO.API.Info&version=1&method=query&query=SYNO.API.Auth`,
        { signal: controller.signal }
      );
      clearTimeout(timeout);

      if (res.ok) {
        cachedNasUrl = NAS_LOCAL_URL;
        lastUrlCheck = now;
        console.log('[NAS] 로컬 네트워크 접속 성공');
        return NAS_LOCAL_URL;
      }
    } catch {
      console.log('[NAS] 로컬 네트워크 접속 실패, 외부 URL 시도...');
    }
  }

  // 외부 DDNS URL 사용
  if (NAS_EXTERNAL_URL) {
    cachedNasUrl = NAS_EXTERNAL_URL;
    lastUrlCheck = now;
    console.log('[NAS] 외부 네트워크(DDNS)로 접속');
    return NAS_EXTERNAL_URL;
  }

  return NAS_LOCAL_URL;
}

/**
 * NAS 로그인 - 활성 URL을 자동 감지하여 접속
 * @returns sid와 사용된 nasUrl을 함께 반환
 */
export async function nasLogin(otpCode?: string, cookieDeviceToken?: string): Promise<{ sid: string; nasUrl: string }> {
  const nasUrl = await getActiveNasUrl();

  // device token 우선순위: 쿠키 > 환경변수
  const deviceToken = cookieDeviceToken || NAS_DEVICE_TOKEN;

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
  if (deviceToken) {
    params.device_id = deviceToken;
    params.device_name = 'LectureNotesPlatform';
  }

  // OTP 코드가 제공된 경우 (setup 시)
  if (otpCode) {
    params.otp_code = otpCode;
    params.enable_device_token = 'yes';
    params.device_name = 'LectureNotesPlatform';
  }

  const searchParams = new URLSearchParams(params);

  // 1차: entry.cgi 시도 (DSM 7 표준)
  const entryRes = await fetch(`${nasUrl}/webapi/entry.cgi?${searchParams}`);
  const entryData = await entryRes.json();

  if (entryData.success) {
    console.log('[NAS] entry.cgi 로그인 성공');
    return { sid: entryData.data.sid, nasUrl };
  }

  // entry.cgi에서 OTP 요구(403) 시 → auth.cgi 폴백 (OTP 우회 가능)
  const entryCode = entryData.error?.code;
  if (entryCode === 403) {
    console.log('[NAS] entry.cgi OTP 필요, auth.cgi 폴백 시도...');
    const authRes = await fetch(`${nasUrl}/webapi/auth.cgi?${searchParams}`);
    const authData = await authRes.json();

    if (authData.success) {
      console.log('[NAS] auth.cgi 로그인 성공');
      return { sid: authData.data.sid, nasUrl };
    }

    const authCode = authData.error?.code;
    if (authCode === 403) {
      throw new Error(
        'NAS 2단계 인증이 필요합니다. /api/nas/setup 에서 OTP 설정을 완료하세요.'
      );
    }
    throw new Error(`NAS 로그인 실패 (에러코드: ${authCode})`);
  }

  if (entryCode === 400) {
    throw new Error('NAS 계정 또는 비밀번호가 올바르지 않습니다.');
  }
  if (entryCode === 404) {
    throw new Error('OTP 코드가 올바르지 않습니다.');
  }
  throw new Error(`NAS 로그인 실패 (에러코드: ${entryCode})`);
}

/**
 * OTP 코드로 로그인하여 device token을 발급받음 (최초 1회)
 */
export async function nasLoginWithOtp(
  otpCode: string
): Promise<{ sid: string; deviceToken: string; nasUrl: string }> {
  const nasUrl = await getActiveNasUrl();

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

  // DSM 7: entry.cgi 사용
  const res = await fetch(`${nasUrl}/webapi/entry.cgi?${params}`);
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
    nasUrl,
  };
}

/**
 * NAS 폴더 생성 (없으면 생성, 있으면 무시)
 */
export async function ensureNasFolder(nasUrl: string, sid: string, folderPath: string): Promise<void> {
  const parentPath = folderPath.substring(0, folderPath.lastIndexOf('/'));
  const folderName = folderPath.substring(folderPath.lastIndexOf('/') + 1);

  if (!parentPath || !folderName) return;

  const params = new URLSearchParams({
    api: 'SYNO.FileStation.CreateFolder',
    version: '2',
    method: 'create',
    folder_path: `["${parentPath}"]`,
    name: `["${folderName}"]`,
    force_parent: 'true',
    _sid: sid,
  });

  await fetch(`${nasUrl}/webapi/entry.cgi?${params}`).catch(() => {});
}

/**
 * NAS에 파일 업로드하는 공통 함수
 */
export async function uploadToNasFileStation(
  nasUrl: string,
  sid: string,
  uploadPath: string,
  fileName: string,
  fileBlob: Blob,
): Promise<{ success: boolean; error?: { code: number } }> {
  const uploadForm = new FormData();
  uploadForm.append('api', 'SYNO.FileStation.Upload');
  uploadForm.append('version', '2');
  uploadForm.append('method', 'upload');
  uploadForm.append('path', uploadPath);
  uploadForm.append('create_parents', 'true');
  uploadForm.append('overwrite', 'true');
  uploadForm.append('_sid', sid);
  uploadForm.append('file', fileBlob, fileName);

  // DSM 7: URL path에 API 이름 포함 + Cookie 헤더로 세션 보강
  const uploadRes = await fetch(
    `${nasUrl}/webapi/entry.cgi/SYNO.FileStation.Upload?api=SYNO.FileStation.Upload&version=2&method=upload&_sid=${sid}`,
    {
      method: 'POST',
      body: uploadForm,
      headers: { Cookie: `id=${sid}` },
    }
  );

  const text = await uploadRes.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`NAS 업로드 응답 파싱 실패: ${text.substring(0, 200)}`);
  }
}

export async function nasLogout(sid: string, nasUrl?: string): Promise<void> {
  const url = nasUrl || await getActiveNasUrl();

  const params = new URLSearchParams({
    api: 'SYNO.API.Auth',
    version: '6',
    method: 'logout',
    session: 'FileStation',
    _sid: sid,
  });

  // 양쪽 다 로그아웃 시도 (어디서 로그인했든 세션 정리)
  await Promise.allSettled([
    fetch(`${url}/webapi/entry.cgi?${params}`),
    fetch(`${url}/webapi/auth.cgi?${params}`),
  ]);
}
