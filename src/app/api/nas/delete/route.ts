import { NextRequest, NextResponse } from 'next/server';

const NAS_URL = process.env.NAS_URL || '';
const NAS_ACCOUNT = process.env.NAS_ACCOUNT || '';
const NAS_PASSWORD = process.env.NAS_PASSWORD || '';
const NAS_UPLOAD_PATH = process.env.NAS_UPLOAD_PATH || '/lecture-notes';

async function nasLogin(): Promise<string> {
  const params = new URLSearchParams({
    api: 'SYNO.API.Auth',
    version: '7',
    method: 'login',
    account: NAS_ACCOUNT,
    passwd: NAS_PASSWORD,
    session: 'FileStation',
    format: 'sid',
  });

  const res = await fetch(`${NAS_URL}/webapi/entry.cgi?${params}`);
  const data = await res.json();

  if (!data.success) {
    throw new Error(`NAS 로그인 실패 (에러코드: ${data.error?.code})`);
  }

  return data.data.sid;
}

async function nasLogout(sid: string): Promise<void> {
  const params = new URLSearchParams({
    api: 'SYNO.API.Auth',
    version: '7',
    method: 'logout',
    session: 'FileStation',
    _sid: sid,
  });

  await fetch(`${NAS_URL}/webapi/entry.cgi?${params}`).catch(() => {});
}

export async function POST(req: NextRequest) {
  if (!NAS_URL || !NAS_ACCOUNT || !NAS_PASSWORD) {
    return NextResponse.json(
      { error: 'NAS 환경변수가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  let sid = '';

  try {
    const { publicId } = await req.json();

    if (!publicId) {
      return NextResponse.json(
        { error: 'publicId가 필요합니다.' },
        { status: 400 }
      );
    }

    sid = await nasLogin();

    // Delete file from NAS
    const filePath = `${NAS_UPLOAD_PATH}/${publicId}`;
    const params = new URLSearchParams({
      api: 'SYNO.FileStation.Delete',
      version: '2',
      method: 'delete',
      path: `["${filePath}"]`,
      _sid: sid,
    });

    const res = await fetch(`${NAS_URL}/webapi/entry.cgi?${params}`);
    const data = await res.json();

    if (!data.success && data.error?.code !== 408) {
      // 408 = file not found, treat as success
      throw new Error(`NAS 삭제 실패 (에러코드: ${data.error?.code})`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('NAS delete error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '서버 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  } finally {
    if (sid) {
      await nasLogout(sid);
    }
  }
}
