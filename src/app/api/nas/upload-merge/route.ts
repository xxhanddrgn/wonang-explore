import { NextRequest, NextResponse } from 'next/server';
import {
  NAS_UPLOAD_PATH,
  isNasConfigured,
  nasLogin,
  nasLogout,
} from '@/lib/nas-auth';

export const maxDuration = 60;

/**
 * 청크 병합: NAS 임시 폴더의 청크들을 다운로드 → 합쳐서 → 최종 파일로 업로드
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
    const { uploadId, totalChunks, fileName } = await req.json();

    if (!uploadId || !totalChunks || !fileName) {
      return NextResponse.json(
        { error: 'uploadId, totalChunks, fileName이 필요합니다.' },
        { status: 400 }
      );
    }

    const login = await nasLogin();
    sid = login.sid;
    nasUrl = login.nasUrl;

    const tempPath = `${NAS_UPLOAD_PATH}/.temp`;

    // 모든 청크를 병렬로 다운로드하여 합치기
    const chunkPromises = Array.from({ length: totalChunks }, (_, i) => {
      const chunkFileName = `${uploadId}_chunk_${i}`;
      const chunkFilePath = `${tempPath}/${chunkFileName}`;

      const downloadParams = new URLSearchParams({
        api: 'SYNO.FileStation.Download',
        version: '2',
        method: 'download',
        path: `["${chunkFilePath}"]`,
        mode: 'download',
        _sid: sid,
      });

      return fetch(`${nasUrl}/webapi/entry.cgi?${downloadParams}`)
        .then((res) => {
          if (!res.ok) {
            throw new Error(`청크 ${i} 다운로드 실패 (HTTP ${res.status})`);
          }
          return res.arrayBuffer();
        });
    });

    const chunks = await Promise.all(chunkPromises);

    // 청크 합치기
    const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const combined = new Uint8Array(totalSize);
    let offset = 0;
    for (const chunk of chunks) {
      combined.set(new Uint8Array(chunk), offset);
      offset += chunk.byteLength;
    }

    // 최종 파일 업로드
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
    const finalFileName = `${timestamp}_${safeName}`;

    const uploadForm = new FormData();
    uploadForm.append('api', 'SYNO.FileStation.Upload');
    uploadForm.append('version', '2');
    uploadForm.append('method', 'upload');
    uploadForm.append('path', NAS_UPLOAD_PATH);
    uploadForm.append('create_parents', 'true');
    uploadForm.append('overwrite', 'true');
    uploadForm.append('_sid', sid);

    const blob = new Blob([combined]);
    uploadForm.append('file', blob, finalFileName);

    const uploadRes = await fetch(`${nasUrl}/webapi/entry.cgi?_sid=${sid}`, {
      method: 'POST',
      body: uploadForm,
      headers: { Cookie: `id=${sid}` },
    });

    const uploadData = await uploadRes.json();

    if (!uploadData.success) {
      throw new Error(
        `최종 파일 업로드 실패 (에러코드: ${uploadData.error?.code})`
      );
    }

    // 임시 청크 파일들 삭제
    const chunkPaths = [];
    for (let i = 0; i < totalChunks; i++) {
      chunkPaths.push(`${tempPath}/${uploadId}_chunk_${i}`);
    }

    const deleteParams = new URLSearchParams({
      api: 'SYNO.FileStation.Delete',
      version: '2',
      method: 'delete',
      path: JSON.stringify(chunkPaths),
      _sid: sid,
    });
    await fetch(`${nasUrl}/webapi/entry.cgi?${deleteParams}`).catch(() => {});

    const filePath = `${NAS_UPLOAD_PATH}/${finalFileName}`;
    const fileUrl = `/api/nas/file?path=${encodeURIComponent(filePath)}`;

    return NextResponse.json({
      url: fileUrl,
      publicId: finalFileName,
      filePath,
    });
  } catch (error) {
    console.error('Merge error:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : '파일 병합 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  } finally {
    if (sid) {
      await nasLogout(sid, nasUrl);
    }
  }
}
