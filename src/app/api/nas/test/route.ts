import { NextResponse } from 'next/server';
import {
  NAS_URL,
  NAS_UPLOAD_PATH,
  NAS_ACCOUNT,
  isNasConfigured,
} from '@/lib/nas-auth';

export async function GET() {
  if (!isNasConfigured()) {
    return NextResponse.json({ error: 'NAS 환경변수 미설정' }, { status: 500 });
  }

  const results: Record<string, unknown> = {
    nasUrl: NAS_URL,
    account: NAS_ACCOUNT,
    uploadPath: NAS_UPLOAD_PATH,
  };

  // Step 1: Login test (try both endpoints)
  let sid = '';
  for (const endpoint of ['auth.cgi', 'entry.cgi']) {
    try {
      const params = new URLSearchParams({
        api: 'SYNO.API.Auth',
        version: '6',
        method: 'login',
        account: NAS_ACCOUNT,
        passwd: process.env.NAS_PASSWORD || '',
        session: 'FileStation',
        format: 'sid',
      });

      const res = await fetch(`${NAS_URL}/webapi/${endpoint}?${params}`);
      const data = await res.json();
      results[`login_${endpoint}`] = { success: data.success, sid: data.data?.sid ? '(있음)' : '(없음)', error: data.error };

      if (data.success && !sid) {
        sid = data.data.sid;
        results.workingEndpoint = endpoint;
      }
    } catch (e) {
      results[`login_${endpoint}`] = { error: String(e) };
    }
  }

  if (!sid) {
    results.conclusion = '로그인 실패 - 모든 엔드포인트에서 실패';
    return NextResponse.json(results);
  }

  // Step 2: List shared folders
  try {
    const params = new URLSearchParams({
      api: 'SYNO.FileStation.List',
      version: '2',
      method: 'list_share',
      _sid: sid,
    });
    const res = await fetch(`${NAS_URL}/webapi/entry.cgi?${params}`);
    const data = await res.json();
    if (data.success) {
      results.sharedFolders = data.data.shares.map((s: { path: string; name: string }) => s.path);
    } else {
      results.sharedFolders = { error: data.error };
    }
  } catch (e) {
    results.sharedFolders = { error: String(e) };
  }

  // Step 3: List upload path
  try {
    const params = new URLSearchParams({
      api: 'SYNO.FileStation.List',
      version: '2',
      method: 'list',
      folder_path: NAS_UPLOAD_PATH,
      _sid: sid,
    });
    const res = await fetch(`${NAS_URL}/webapi/entry.cgi?${params}`);
    const data = await res.json();
    results.uploadPathCheck = data.success
      ? { exists: true, fileCount: data.data?.files?.length ?? 0 }
      : { exists: false, error: data.error };
  } catch (e) {
    results.uploadPathCheck = { error: String(e) };
  }

  // Step 4: Also try with /volume1/ prefix
  try {
    const altPath = `/volume1${NAS_UPLOAD_PATH}`;
    const params = new URLSearchParams({
      api: 'SYNO.FileStation.List',
      version: '2',
      method: 'list',
      folder_path: altPath,
      _sid: sid,
    });
    const res = await fetch(`${NAS_URL}/webapi/entry.cgi?${params}`);
    const data = await res.json();
    results.uploadPathWithVolume = {
      path: altPath,
      exists: data.success,
      error: data.success ? undefined : data.error,
    };
  } catch (e) {
    results.uploadPathWithVolume = { error: String(e) };
  }

  // Logout
  try {
    const params = new URLSearchParams({
      api: 'SYNO.API.Auth',
      version: '6',
      method: 'logout',
      session: 'FileStation',
      _sid: sid,
    });
    await fetch(`${NAS_URL}/webapi/auth.cgi?${params}`);
  } catch {}

  return NextResponse.json(results, { status: 200 });
}
