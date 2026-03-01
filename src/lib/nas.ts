/**
 * NAS 파일 업로드/다운로드 클라이언트
 * Synology NAS File Station API를 서버 API 라우트를 통해 사용
 *
 * 업로드 전략:
 * - 3MB 이하: Vercel API 경유 (간단, 안정적)
 * - 3MB 초과: 청크 분할 업로드 (3MB 조각으로 나눠 서버 경유)
 */

const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB

export async function uploadToNas(file: File): Promise<{
  url: string;
  publicId: string;
}> {
  if (file.size <= CHUNK_SIZE) {
    return uploadViaApi(file);
  }
  return uploadChunked(file);
}

/**
 * 기존 방식: Vercel API 서버를 경유하여 업로드 (작은 파일용)
 */
async function uploadViaApi(file: File): Promise<{
  url: string;
  publicId: string;
}> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('fileName', file.name);

  const res = await fetch('/api/nas/upload', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      (error as { error?: string }).error || '파일 업로드에 실패했습니다.'
    );
  }

  const data = await res.json();
  return { url: data.url, publicId: data.publicId };
}

/**
 * 청크 업로드: 큰 파일을 3MB 조각으로 나눠 서버 API를 통해 업로드
 * Vercel 4.5MB 제한을 우회하면서 CORS 문제 없음
 */
async function uploadChunked(file: File): Promise<{
  url: string;
  publicId: string;
}> {
  const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
  const uploadId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  // 1. 각 청크를 순서대로 업로드
  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, file.size);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('chunk', chunk);
    formData.append('uploadId', uploadId);
    formData.append('chunkIndex', String(i));

    const res = await fetch('/api/nas/upload-chunk', {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(
        (err as { error?: string }).error ||
          `업로드 실패 (${i + 1}/${totalChunks})`
      );
    }
  }

  // 2. 서버에서 청크 병합
  const mergeRes = await fetch('/api/nas/upload-merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      uploadId,
      totalChunks,
      fileName: file.name,
    }),
  });

  if (!mergeRes.ok) {
    const err = await mergeRes.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || '파일 병합에 실패했습니다.'
    );
  }

  const result = await mergeRes.json();
  return { url: result.url, publicId: result.publicId };
}

export async function deleteFromNas(publicId: string): Promise<void> {
  const res = await fetch('/api/nas/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ publicId }),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(
      (error as { error?: string }).error || '파일 삭제에 실패했습니다.'
    );
  }
}
