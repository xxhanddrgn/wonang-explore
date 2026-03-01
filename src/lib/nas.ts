/**
 * NAS 파일 업로드/다운로드 클라이언트
 * Synology NAS File Station API를 서버 API 라우트를 통해 사용
 *
 * 업로드 전략:
 * - 3MB 이하: Vercel API 경유 (간단, 안정적)
 * - 3MB 초과: 청크 분할 업로드 (3MB 조각으로 나눠 서버 경유)
 */

const CHUNK_SIZE = 3 * 1024 * 1024; // 3MB

/**
 * 서버 응답에서 에러 메시지 추출
 */
async function extractErrorMessage(
  res: Response,
  fallback: string
): Promise<string> {
  try {
    const data = await res.json();
    if (data?.error && typeof data.error === 'string') return data.error;
  } catch {
    // JSON 파싱 실패 (Vercel 타임아웃 등 HTML 응답)
  }

  if (res.status === 504) return '서버 처리 시간이 초과되었습니다. 잠시 후 다시 시도해주세요.';
  if (res.status === 413) return '파일 크기가 서버 제한(4.5MB)을 초과했습니다.';
  if (res.status === 502) return '서버에 일시적인 문제가 발생했습니다.';
  if (res.status >= 500) return `서버 오류가 발생했습니다. (HTTP ${res.status})`;

  return fallback;
}

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

  let res: Response;
  try {
    res = await fetch('/api/nas/upload', {
      method: 'POST',
      body: formData,
    });
  } catch {
    throw new Error('서버에 연결할 수 없습니다. 네트워크 연결을 확인해주세요.');
  }

  if (!res.ok) {
    const msg = await extractErrorMessage(res, '파일 업로드에 실패했습니다.');
    throw new Error(msg);
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

    let res: Response;
    try {
      res = await fetch('/api/nas/upload-chunk', {
        method: 'POST',
        body: formData,
      });
    } catch {
      throw new Error(
        `청크 ${i + 1}/${totalChunks} 전송 실패. 네트워크 연결을 확인해주세요.`
      );
    }

    if (!res.ok) {
      const msg = await extractErrorMessage(
        res,
        `청크 업로드 실패 (${i + 1}/${totalChunks})`
      );
      throw new Error(msg);
    }
  }

  // 2. 서버에서 청크 병합
  let mergeRes: Response;
  try {
    mergeRes = await fetch('/api/nas/upload-merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        uploadId,
        totalChunks,
        fileName: file.name,
      }),
    });
  } catch {
    throw new Error('파일 병합 요청 실패. 네트워크 연결을 확인해주세요.');
  }

  if (!mergeRes.ok) {
    const msg = await extractErrorMessage(mergeRes, '파일 병합에 실패했습니다.');
    throw new Error(msg);
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
    const msg = await extractErrorMessage(res, '파일 삭제에 실패했습니다.');
    throw new Error(msg);
  }
}
