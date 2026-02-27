const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || '';
const UPLOAD_PRESET = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET || '';

const CHUNK_SIZE = 6 * 1024 * 1024; // 6MB per chunk

async function uploadSmallFile(file: File): Promise<{ url: string; publicId: string }> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', UPLOAD_PRESET);
  formData.append('folder', 'lecture-notes');

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/auto/upload`,
    { method: 'POST', body: formData }
  );

  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.error?.message || '업로드에 실패했습니다.');
  }

  const data = await res.json();
  return { url: data.secure_url, publicId: data.public_id };
}

async function getSignedParams(): Promise<{
  signature: string;
  timestamp: number;
  apiKey: string;
  cloudName: string;
  folder: string;
}> {
  const res = await fetch('/api/cloudinary/sign', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ folder: 'lecture-notes' }),
  });

  if (!res.ok) {
    throw new Error('서명 생성에 실패했습니다.');
  }

  return res.json();
}

async function uploadLargeFile(file: File): Promise<{ url: string; publicId: string }> {
  const { signature, timestamp, apiKey, cloudName, folder } = await getSignedParams();

  const totalSize = file.size;
  const totalChunks = Math.ceil(totalSize / CHUNK_SIZE);
  const uniqueId = `uqid-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  let result: { secure_url: string; public_id: string } | null = null;

  for (let i = 0; i < totalChunks; i++) {
    const start = i * CHUNK_SIZE;
    const end = Math.min(start + CHUNK_SIZE, totalSize);
    const chunk = file.slice(start, end);

    const formData = new FormData();
    formData.append('file', chunk);
    formData.append('folder', folder);
    formData.append('timestamp', timestamp.toString());
    formData.append('api_key', apiKey);
    formData.append('signature', signature);

    const headers: Record<string, string> = {
      'X-Unique-Upload-Id': uniqueId,
      'Content-Range': `bytes ${start}-${end - 1}/${totalSize}`,
    };

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      { method: 'POST', body: formData, headers }
    );

    if (i < totalChunks - 1) {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error((error as Record<string, Record<string, string>>).error?.message || `청크 ${i + 1}/${totalChunks} 업로드 실패`);
      }
    } else {
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error((error as Record<string, Record<string, string>>).error?.message || '업로드에 실패했습니다.');
      }
      result = await res.json();
    }
  }

  if (!result) {
    throw new Error('업로드 응답을 받지 못했습니다.');
  }

  return { url: result.secure_url, publicId: result.public_id };
}

export async function uploadToCloudinary(file: File): Promise<{
  url: string;
  publicId: string;
}> {
  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      'Cloudinary 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.'
    );
  }

  // 10MB 이하는 unsigned 업로드, 초과는 signed chunked 업로드
  if (file.size <= 10 * 1024 * 1024) {
    return uploadSmallFile(file);
  }
  return uploadLargeFile(file);
}

export function getCloudinaryFileUrl(publicId: string): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/${publicId}`;
}
