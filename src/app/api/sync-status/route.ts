import { NextResponse } from 'next/server';
import {
  NAS_UPLOAD_PATH,
  isNasConfigured,
  nasLogin,
  nasLogout,
} from '@/lib/nas-auth';

export const maxDuration = 30;

/**
 * GET: 동기화 상태 진단
 * 브라우저에서 /api/sync-status 접속하면 NAS 연결 + 데이터 상태 확인 가능
 */
export async function GET() {
  const status: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    environment: process.env.VERCEL ? 'vercel' : 'local',
    vercelRegion: process.env.VERCEL_REGION || '(알 수 없음)',
  };

  // 1. 환경변수 확인
  status.envCheck = {
    NAS_URL: process.env.NAS_URL ? '설정됨' : '미설정',
    NAS_EXTERNAL_URL: process.env.NAS_EXTERNAL_URL ? '설정됨' : '미설정',
    NAS_ACCOUNT: process.env.NAS_ACCOUNT ? '설정됨' : '미설정',
    NAS_PASSWORD: process.env.NAS_PASSWORD ? '설정됨' : '미설정',
    NAS_UPLOAD_PATH: process.env.NAS_UPLOAD_PATH || '미설정',
    isConfigured: isNasConfigured(),
  };

  if (!isNasConfigured()) {
    status.result = 'FAIL: NAS 환경변수가 설정되지 않았습니다';
    return NextResponse.json(status);
  }

  // 2. NAS 로그인 테스트
  let sid = '';
  let nasUrl = '';
  try {
    const login = await nasLogin();
    sid = login.sid;
    nasUrl = login.nasUrl;
    status.loginTest = { success: true, nasUrl };
  } catch (error) {
    status.loginTest = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
    status.result = 'FAIL: NAS 로그인 실패';
    return NextResponse.json(status);
  }

  // 3. 메타데이터 파일 읽기 테스트
  try {
    const filePath = `${NAS_UPLOAD_PATH}/_metadata.json`;
    const params = new URLSearchParams({
      api: 'SYNO.FileStation.Download',
      version: '2',
      method: 'download',
      path: `["${filePath}"]`,
      mode: 'download',
      _sid: sid,
    });

    const res = await fetch(`${nasUrl}/webapi/entry.cgi?${params}`);
    const text = await res.text();

    try {
      const parsed = JSON.parse(text);
      if (parsed.success === false) {
        status.metadataTest = { exists: false, message: '메타데이터 파일 없음 (첫 사용)' };
      } else {
        status.metadataTest = {
          exists: true,
          courses: parsed.courses?.length || 0,
          notes: parsed.notes?.length || 0,
          materials: parsed.materials?.length || 0,
        };
      }
    } catch {
      status.metadataTest = { exists: false, rawLength: text.length };
    }
  } catch (error) {
    status.metadataTest = {
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // 4. API 정보 조회 (올바른 Upload 엔드포인트 확인)
  let uploadPath = 'entry.cgi';
  let uploadMaxVersion = 2;
  try {
    const infoParams = new URLSearchParams({
      api: 'SYNO.API.Info',
      version: '1',
      method: 'query',
      query: 'SYNO.FileStation.Upload',
    });
    const infoRes = await fetch(`${nasUrl}/webapi/query.cgi?${infoParams}`);
    const infoData = await infoRes.json();
    if (infoData.success && infoData.data?.['SYNO.FileStation.Upload']) {
      const uploadInfo = infoData.data['SYNO.FileStation.Upload'];
      uploadPath = uploadInfo.path || 'entry.cgi';
      uploadMaxVersion = uploadInfo.maxVersion || 2;
    }
    status.apiInfo = {
      uploadPath,
      uploadMaxVersion,
      raw: infoData.data?.['SYNO.FileStation.Upload'] || null,
    };
  } catch (error) {
    status.apiInfo = { error: error instanceof Error ? error.message : String(error) };
  }

  // 5. 업로드(쓰기) 테스트 - API가 알려준 정확한 경로 사용
  try {
    const testContent = JSON.stringify({ test: true, timestamp: new Date().toISOString() });
    const blob = new Blob([testContent], { type: 'application/json' });

    const uploadForm = new FormData();
    uploadForm.append('api', 'SYNO.FileStation.Upload');
    uploadForm.append('version', String(Math.min(uploadMaxVersion, 2)));
    uploadForm.append('method', 'upload');
    uploadForm.append('path', NAS_UPLOAD_PATH);
    uploadForm.append('create_parents', 'true');
    uploadForm.append('overwrite', 'true');
    uploadForm.append('_sid', sid);
    uploadForm.append('file', blob, '_sync_test.json');

    // API Info 경로 + URL path에 API 이름 포함 + 쿼리/FormData/Cookie 모두 전달
    const ver = String(Math.min(uploadMaxVersion, 2));
    const uploadUrl = `${nasUrl}/webapi/${uploadPath}/SYNO.FileStation.Upload?api=SYNO.FileStation.Upload&version=${ver}&method=upload&_sid=${sid}`;
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: uploadForm,
      headers: { Cookie: `id=${sid}` },
    });

    const uploadText = await uploadRes.text();
    try {
      const uploadData = JSON.parse(uploadText);
      status.uploadTest = {
        success: uploadData.success,
        error: uploadData.error || null,
        httpStatus: uploadRes.status,
        urlUsed: uploadUrl.replace(sid, 'SID_HIDDEN'),
      };
    } catch {
      status.uploadTest = {
        success: false,
        httpStatus: uploadRes.status,
        rawResponse: uploadText.substring(0, 500),
        urlUsed: uploadUrl.replace(sid, 'SID_HIDDEN'),
      };
    }
  } catch (error) {
    status.uploadTest = {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // 6. 결론
  const loginOk = (status.loginTest as { success: boolean }).success;
  const uploadOk = (status.uploadTest as { success: boolean })?.success;
  const metaExists = (status.metadataTest as { exists?: boolean })?.exists;

  if (loginOk && uploadOk && metaExists) {
    status.result = 'OK: NAS 연결 정상, 읽기/쓰기 모두 가능';
  } else if (loginOk && uploadOk && !metaExists) {
    status.result = 'OK: NAS 연결 정상, 쓰기 가능 (메타데이터는 첫 저장 시 생성됨)';
  } else if (loginOk && !uploadOk) {
    status.result = 'FAIL: NAS 로그인 성공, 하지만 파일 쓰기 실패 (권한 또는 경로 문제)';
  } else {
    status.result = 'FAIL: NAS 연결 실패';
  }

  // Logout
  if (sid) {
    await nasLogout(sid, nasUrl);
  }

  return NextResponse.json(status, { status: 200 });
}
