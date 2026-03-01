import { NextRequest, NextResponse } from 'next/server';
import {
  NAS_UPLOAD_PATH,
  isNasConfigured,
  nasLogin,
  nasLogout,
} from '@/lib/nas-auth';

export const maxDuration = 60;

const METADATA_FILE = '_metadata.json';

/**
 * GET: NAS에서 메타데이터(과목, 필기, 자료 목록) 로드
 */
export async function GET() {
  const empty = { courses: [], notes: [], materials: [] };

  if (!isNasConfigured()) {
    return NextResponse.json(empty);
  }

  let sid = '';
  let nasUrl = '';

  try {
    const login = await nasLogin();
    sid = login.sid;
    nasUrl = login.nasUrl;

    const filePath = `${NAS_UPLOAD_PATH}/${METADATA_FILE}`;
    const params = new URLSearchParams({
      api: 'SYNO.FileStation.Download',
      version: '2',
      method: 'download',
      path: `["${filePath}"]`,
      mode: 'download',
      _sid: sid,
    });

    const res = await fetch(`${nasUrl}/webapi/entry.cgi?${params}`);

    if (!res.ok) {
      return NextResponse.json(empty);
    }

    const text = await res.text();

    try {
      const parsed = JSON.parse(text);
      // Synology 에러 응답인 경우 (파일 미존재 등)
      if (parsed.success === false) {
        return NextResponse.json(empty);
      }
      return NextResponse.json(parsed);
    } catch {
      return NextResponse.json(empty);
    }
  } catch (error) {
    console.error('Data load error:', error);
    return NextResponse.json(empty);
  } finally {
    if (sid) {
      await nasLogout(sid, nasUrl);
    }
  }
}

/**
 * PUT: 메타데이터를 NAS에 저장
 */
export async function PUT(req: NextRequest) {
  if (!isNasConfigured()) {
    return NextResponse.json({ error: 'NAS 미설정' }, { status: 500 });
  }

  let sid = '';
  let nasUrl = '';

  try {
    const data = await req.json();
    const login = await nasLogin();
    sid = login.sid;
    nasUrl = login.nasUrl;

    const content = JSON.stringify(data);
    const blob = new Blob([content], { type: 'application/json' });

    const uploadForm = new FormData();
    uploadForm.append('api', 'SYNO.FileStation.Upload');
    uploadForm.append('version', '2');
    uploadForm.append('method', 'upload');
    uploadForm.append('path', NAS_UPLOAD_PATH);
    uploadForm.append('create_parents', 'true');
    uploadForm.append('overwrite', 'true');
    uploadForm.append('_sid', sid);
    uploadForm.append('file', blob, METADATA_FILE);

    const uploadRes = await fetch(`${nasUrl}/webapi/entry.cgi?_sid=${sid}`, {
      method: 'POST',
      body: uploadForm,
      headers: { Cookie: `id=${sid}` },
    });

    const uploadData = await uploadRes.json();

    if (!uploadData.success) {
      throw new Error(`메타데이터 저장 실패 (에러코드: ${uploadData.error?.code})`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Data save error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '데이터 저장 실패' },
      { status: 500 }
    );
  } finally {
    if (sid) {
      await nasLogout(sid, nasUrl);
    }
  }
}
