import { NextRequest, NextResponse } from 'next/server';
import {
  NAS_UPLOAD_PATH,
  isNasConfigured,
  nasLogin,
  nasLogout,
} from '@/lib/nas-auth';

export async function POST(req: NextRequest) {
  if (!isNasConfigured()) {
    return NextResponse.json(
      { error: 'NAS 환경변수가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  let sid = '';
  let nasUrl = '';

  try {
    const { publicId } = await req.json();

    if (!publicId) {
      return NextResponse.json(
        { error: 'publicId가 필요합니다.' },
        { status: 400 }
      );
    }

    const login = await nasLogin();
    sid = login.sid;
    nasUrl = login.nasUrl;

    // Delete file from NAS
    const filePath = `${NAS_UPLOAD_PATH}/${publicId}`;
    const params = new URLSearchParams({
      api: 'SYNO.FileStation.Delete',
      version: '2',
      method: 'delete',
      path: `["${filePath}"]`,
      _sid: sid,
    });

    const res = await fetch(`${nasUrl}/webapi/entry.cgi?${params}`);
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
      await nasLogout(sid, nasUrl);
    }
  }
}
