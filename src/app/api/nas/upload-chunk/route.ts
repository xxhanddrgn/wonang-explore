import { NextRequest, NextResponse } from 'next/server';
import {
  NAS_UPLOAD_PATH,
  isNasConfigured,
  nasLogin,
  nasLogout,
} from '@/lib/nas-auth';

export const maxDuration = 60;

/**
 * 청크 업로드: 큰 파일을 3MB 조각으로 나눠 NAS 임시 폴더에 저장
 */
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
    const formData = await req.formData();
    const chunk = formData.get('chunk') as File | null;
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = formData.get('chunkIndex') as string;

    if (!chunk || !uploadId || chunkIndex === null) {
      return NextResponse.json(
        { error: 'chunk, uploadId, chunkIndex가 필요합니다.' },
        { status: 400 }
      );
    }

    const login = await nasLogin();
    sid = login.sid;
    nasUrl = login.nasUrl;

    const tempPath = `${NAS_UPLOAD_PATH}/.temp`;

    // 임시 폴더 생성
    const createParams = new URLSearchParams({
      api: 'SYNO.FileStation.CreateFolder',
      version: '2',
      method: 'create',
      folder_path: `["${NAS_UPLOAD_PATH}"]`,
      name: '[".temp"]',
      force_parent: 'true',
      _sid: sid,
    });
    await fetch(`${nasUrl}/webapi/entry.cgi?${createParams}`).catch(() => {});

    // 청크 파일 업로드
    const chunkFileName = `${uploadId}_chunk_${chunkIndex}`;
    const uploadForm = new FormData();
    uploadForm.append('api', 'SYNO.FileStation.Upload');
    uploadForm.append('version', '2');
    uploadForm.append('method', 'upload');
    uploadForm.append('path', tempPath);
    uploadForm.append('create_parents', 'true');
    uploadForm.append('overwrite', 'true');
    uploadForm.append('_sid', sid);

    const chunkBuffer = await chunk.arrayBuffer();
    const blob = new Blob([chunkBuffer], { type: 'application/octet-stream' });
    uploadForm.append('file', blob, chunkFileName);

    const uploadRes = await fetch(
      `${nasUrl}/webapi/entry.cgi/SYNO.FileStation.Upload?api=SYNO.FileStation.Upload&version=2&method=upload&_sid=${sid}`,
      {
        method: 'POST',
        body: uploadForm,
      }
    );

    const uploadData = await uploadRes.json();

    if (!uploadData.success) {
      throw new Error(`청크 업로드 실패 (에러코드: ${uploadData.error?.code})`);
    }

    return NextResponse.json({ success: true, chunkIndex: Number(chunkIndex) });
  } catch (error) {
    console.error('Chunk upload error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '청크 업로드 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  } finally {
    if (sid) {
      await nasLogout(sid, nasUrl);
    }
  }
}
