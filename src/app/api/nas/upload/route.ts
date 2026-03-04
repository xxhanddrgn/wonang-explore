import { NextRequest, NextResponse } from 'next/server';
import {
  NAS_UPLOAD_PATH,
  isNasConfigured,
  nasLogin,
  nasLogout,
  ensureNasFolder,
  uploadToNasFileStation,
  getDeviceTokenFromCookies,
} from '@/lib/nas-auth';

export const maxDuration = 60;


export async function POST(req: NextRequest) {
  if (!isNasConfigured()) {
    return NextResponse.json(
      { error: 'NAS 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.' },
      { status: 500 }
    );
  }

  let sid = '';
  let nasUrl = '';

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const fileName = formData.get('fileName') as string | null;

    if (!file || !fileName) {
      return NextResponse.json(
        { error: '파일이 필요합니다.' },
        { status: 400 }
      );
    }

    // Login to NAS (자동으로 로컬/외부 URL 감지)
    const cookieToken = getDeviceTokenFromCookies(req.headers.get('cookie'));
    const login = await nasLogin(undefined, cookieToken);
    sid = login.sid;
    nasUrl = login.nasUrl;

    // Create unique file path to avoid collisions
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
    const filePath = `${NAS_UPLOAD_PATH}/${timestamp}_${safeName}`;
    const publicId = `${timestamp}_${safeName}`;

    // Ensure upload folder exists
    await ensureNasFolder(nasUrl, sid, NAS_UPLOAD_PATH);

    // Convert File to Blob with the correct filename
    const fileBuffer = await file.arrayBuffer();
    const blob = new Blob([fileBuffer], { type: file.type });

    const uploadData = await uploadToNasFileStation(nasUrl, sid, NAS_UPLOAD_PATH, `${timestamp}_${safeName}`, blob);

    if (!uploadData.success) {
      throw new Error(
        `NAS 업로드 실패 (에러코드: ${uploadData.error?.code})`
      );
    }

    // Return the file URL (proxied through our API)
    const fileUrl = `/api/nas/file?path=${encodeURIComponent(filePath)}`;

    return NextResponse.json({
      url: fileUrl,
      publicId: publicId,
      filePath: filePath,
    });
  } catch (error) {
    console.error('NAS upload error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'NAS 업로드 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  } finally {
    if (sid) {
      await nasLogout(sid, nasUrl);
    }
  }
}
