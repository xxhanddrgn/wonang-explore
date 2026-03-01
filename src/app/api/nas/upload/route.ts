import { NextRequest, NextResponse } from 'next/server';
import {
  NAS_URL,
  NAS_UPLOAD_PATH,
  isNasConfigured,
  nasLogin,
  nasLogout,
} from '@/lib/nas-auth';

async function ensureFolder(sid: string, folderPath: string): Promise<void> {
  const parentPath = folderPath.substring(0, folderPath.lastIndexOf('/'));
  const folderName = folderPath.substring(folderPath.lastIndexOf('/') + 1);

  if (!parentPath || !folderName) return;

  const params = new URLSearchParams({
    api: 'SYNO.FileStation.CreateFolder',
    version: '2',
    method: 'create',
    folder_path: `["${parentPath}"]`,
    name: `["${folderName}"]`,
    force_parent: 'true',
    _sid: sid,
  });

  await fetch(`${NAS_URL}/webapi/entry.cgi?${params}`).catch(() => {});
}

export async function POST(req: NextRequest) {
  if (!isNasConfigured()) {
    return NextResponse.json(
      { error: 'NAS 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.' },
      { status: 500 }
    );
  }

  let sid = '';

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

    // Login to NAS
    sid = await nasLogin();

    // Create unique file path to avoid collisions
    const timestamp = Date.now();
    const safeName = fileName.replace(/[^a-zA-Z0-9가-힣._-]/g, '_');
    const filePath = `${NAS_UPLOAD_PATH}/${timestamp}_${safeName}`;
    const publicId = `${timestamp}_${safeName}`;

    // Ensure upload folder exists
    await ensureFolder(sid, NAS_UPLOAD_PATH);

    // Upload file to NAS via File Station API
    const uploadForm = new FormData();
    uploadForm.append('api', 'SYNO.FileStation.Upload');
    uploadForm.append('version', '2');
    uploadForm.append('method', 'upload');
    uploadForm.append('path', NAS_UPLOAD_PATH);
    uploadForm.append('create_parents', 'true');
    uploadForm.append('overwrite', 'true');
    uploadForm.append('_sid', sid);

    // Convert File to Blob with the correct filename
    const fileBuffer = await file.arrayBuffer();
    const blob = new Blob([fileBuffer], { type: file.type });
    uploadForm.append('file', blob, `${timestamp}_${safeName}`);

    const uploadRes = await fetch(
      `${NAS_URL}/webapi/entry.cgi?_sid=${sid}`,
      {
        method: 'POST',
        body: uploadForm,
        headers: { Cookie: `id=${sid}` },
      }
    );

    const uploadData = await uploadRes.json();

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
      await nasLogout(sid);
    }
  }
}
