import { NextRequest, NextResponse } from 'next/server';
import {
  NAS_UPLOAD_PATH,
  isNasConfigured,
  nasLogin,
  nasLogout,
  getDeviceTokenFromCookies,
} from '@/lib/nas-auth';

export const dynamic = 'force-dynamic';

/**
 * 브라우저 직접 업로드 후 파일이 NAS에 존재하는지 확인
 */
export async function GET(req: NextRequest) {
  if (!isNasConfigured()) {
    return NextResponse.json({ exists: false, error: 'NAS 미설정' }, { status: 500 });
  }

  let sid = '';
  let nasUrl = '';

  try {
    const { searchParams } = new URL(req.url);
    const fileName = searchParams.get('fileName');

    if (!fileName) {
      return NextResponse.json({ exists: false, error: 'fileName 필요' }, { status: 400 });
    }

    const cookieToken = getDeviceTokenFromCookies(req.headers.get('cookie'));
    const login = await nasLogin(undefined, cookieToken);
    sid = login.sid;
    nasUrl = login.nasUrl;

    // NAS에서 파일 목록 조회하여 확인
    const params = new URLSearchParams({
      api: 'SYNO.FileStation.List',
      version: '2',
      method: 'list',
      folder_path: NAS_UPLOAD_PATH,
      _sid: sid,
    });

    const res = await fetch(`${nasUrl}/webapi/entry.cgi?${params}`);
    const data = await res.json();

    if (!data.success) {
      return NextResponse.json({ exists: false, error: 'NAS 조회 실패' });
    }

    const files = data.data?.files || [];
    const found = files.some(
      (f: { name: string }) => f.name === fileName
    );

    const filePath = `${NAS_UPLOAD_PATH}/${fileName}`;
    const fileUrl = `/api/nas/file?path=${encodeURIComponent(filePath)}`;

    return NextResponse.json({
      exists: found,
      url: fileUrl,
      filePath,
    });
  } catch (error) {
    console.error('NAS verify error:', error);
    return NextResponse.json({ exists: false, error: String(error) }, { status: 500 });
  } finally {
    if (sid) {
      await nasLogout(sid, nasUrl);
    }
  }
}
