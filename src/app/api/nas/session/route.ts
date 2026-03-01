import { NextResponse } from 'next/server';
import {
  NAS_UPLOAD_PATH,
  isNasConfigured,
  nasLogin,
} from '@/lib/nas-auth';

/**
 * 브라우저에서 NAS로 직접 업로드할 때 사용할 세션 정보 반환
 * SID는 10분 후 자동 만료됨
 */
export async function GET() {
  if (!isNasConfigured()) {
    return NextResponse.json(
      { error: 'NAS 환경변수가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  try {
    const { sid, nasUrl } = await nasLogin();

    return NextResponse.json({
      nasUrl,
      sid,
      uploadPath: NAS_UPLOAD_PATH,
    });
  } catch (error) {
    console.error('NAS session error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'NAS 세션 생성에 실패했습니다.',
      },
      { status: 500 }
    );
  }
}
