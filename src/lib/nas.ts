/**
 * NAS 파일 업로드/다운로드 클라이언트
 * Synology NAS File Station API를 서버 API 라우트를 통해 사용
 */

export async function uploadToNas(file: File): Promise<{
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
