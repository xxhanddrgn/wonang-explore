/**
 * NAS 파일 업로드/다운로드 클라이언트
 * Synology NAS File Station API를 서버 API 라우트를 통해 사용
 *
 * 업로드 전략:
 * - 4MB 이하: Vercel API 경유 (간단, 안정적)
 * - 4MB 초과: 브라우저에서 NAS로 직접 업로드 (Vercel 크기 제한 우회)
 */

const VERCEL_LIMIT = 4 * 1024 * 1024; // 4MB

export async function uploadToNas(file: File): Promise<{
  url: string;
  publicId: string;
}> {
  if (file.size <= VERCEL_LIMIT) {
    return uploadViaApi(file);
  }
  return uploadDirect(file);
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
 * 직접 업로드: 브라우저에서 NAS로 직접 전송 (큰 파일용)
 * Vercel 4.5MB 제한을 우회
 */
async function uploadDirect(file: File): Promise<{
  url: string;
  publicId: string;
}> {
  // 1. 서버에서 NAS 세션 가져오기
  const sessionRes = await fetch('/api/nas/session');
  if (!sessionRes.ok) {
    const err = await sessionRes.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error || 'NAS 세션 생성에 실패했습니다.'
    );
  }
  const session = await sessionRes.json();

  // 2. 파일명 생성
  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
  const uploadFileName = `${timestamp}_${safeName}`;

  // 3. NAS에 직접 업로드 (no-cors: 응답은 못 읽지만 업로드는 됨)
  const formData = new FormData();
  formData.append('api', 'SYNO.FileStation.Upload');
  formData.append('version', '2');
  formData.append('method', 'upload');
  formData.append('path', session.uploadPath);
  formData.append('create_parents', 'true');
  formData.append('overwrite', 'true');
  formData.append('_sid', session.sid);
  formData.append('file', file, uploadFileName);

  try {
    await fetch(`${session.nasUrl}/webapi/entry.cgi`, {
      method: 'POST',
      body: formData,
      mode: 'no-cors',
    });
  } catch {
    throw new Error(
      'NAS에 직접 연결할 수 없습니다. 네트워크를 확인해주세요.'
    );
  }

  // 4. 업로드 확인 (no-cors에서는 응답을 못 읽으므로 서버에서 확인)
  await new Promise((resolve) => setTimeout(resolve, 2000));

  const verifyRes = await fetch(
    `/api/nas/verify?fileName=${encodeURIComponent(uploadFileName)}`
  );
  const verify = await verifyRes.json();

  if (!verify.exists) {
    // 대용량 파일은 처리 시간이 더 걸릴 수 있음
    await new Promise((resolve) => setTimeout(resolve, 4000));
    const retryRes = await fetch(
      `/api/nas/verify?fileName=${encodeURIComponent(uploadFileName)}`
    );
    const retry = await retryRes.json();

    if (!retry.exists) {
      throw new Error(
        '파일 업로드를 확인할 수 없습니다. 네트워크 연결을 확인하고 다시 시도해주세요.'
      );
    }

    return { url: retry.url, publicId: uploadFileName };
  }

  return { url: verify.url, publicId: uploadFileName };
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
