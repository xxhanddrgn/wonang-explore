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
    console.log('[Data GET] NAS 로그인 성공, URL:', nasUrl);

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
      console.error('[Data GET] NAS 응답 에러:', res.status, res.statusText);
      return NextResponse.json(empty);
    }

    const text = await res.text();

    try {
      const parsed = JSON.parse(text);
      // Synology 에러 응답인 경우 (파일 미존재 등)
      if (parsed.success === false) {
        console.log('[Data GET] 메타데이터 파일 미존재 (첫 사용)');
        return NextResponse.json(empty);
      }
      console.log('[Data GET] 메타데이터 로드 성공 - 과목:', parsed.courses?.length, '노트:', parsed.notes?.length, '자료:', parsed.materials?.length);
      return NextResponse.json(parsed);
    } catch {
      console.error('[Data GET] JSON 파싱 실패, 텍스트 길이:', text.length);
      return NextResponse.json(empty);
    }
  } catch (error) {
    console.error('[Data GET] NAS 연결/로그인 실패:', error instanceof Error ? error.message : error);
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
    console.log('[Data PUT] NAS 로그인 성공, 저장 시작...');

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

    // Synology DSM 7: _sid를 URL 쿼리 + FormData 양쪽 모두 전달 필수
    const uploadRes = await fetch(
      `${nasUrl}/webapi/entry.cgi?api=SYNO.FileStation.Upload&version=2&method=upload&_sid=${sid}`,
      {
        method: 'POST',
        body: uploadForm,
        headers: { Cookie: `id=${sid}` },
      }
    );

    const uploadText = await uploadRes.text();
    let uploadData;
    try {
      uploadData = JSON.parse(uploadText);
    } catch {
      console.error('[Data PUT] 업로드 응답 파싱 실패:', uploadText.substring(0, 200));
      throw new Error('NAS 업로드 응답 파싱 실패');
    }

    if (!uploadData.success) {
      console.error('[Data PUT] 업로드 실패:', JSON.stringify(uploadData.error));
      throw new Error(`메타데이터 저장 실패 (에러코드: ${uploadData.error?.code})`);
    }

    console.log('[Data PUT] 메타데이터 저장 성공');
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
