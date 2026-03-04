import { NextRequest, NextResponse } from 'next/server';
import { isNasConfigured, nasLogin, nasLogout, getDeviceTokenFromCookies } from '@/lib/nas-auth';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isNasConfigured()) {
    return NextResponse.json(
      { error: 'NAS 환경변수가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  let sid = '';
  let nasUrl = '';

  try {
    const { searchParams } = new URL(req.url);
    const filePath = searchParams.get('path');

    if (!filePath) {
      return NextResponse.json(
        { error: '파일 경로가 필요합니다.' },
        { status: 400 }
      );
    }

    const cookieToken = getDeviceTokenFromCookies(req.headers.get('cookie'));
    const login = await nasLogin(undefined, cookieToken);
    sid = login.sid;
    nasUrl = login.nasUrl;

    // Download file from NAS
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
      throw new Error('파일 다운로드 실패');
    }

    // Determine content type from file extension
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const contentTypeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      mp4: 'video/mp4',
      mp3: 'audio/mpeg',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      xls: 'application/vnd.ms-excel',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ppt: 'application/vnd.ms-powerpoint',
      pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      zip: 'application/zip',
      txt: 'text/plain',
      csv: 'text/csv',
      hwp: 'application/x-hwp',
    };

    const contentType = contentTypeMap[ext] || 'application/octet-stream';
    const fileBuffer = await res.arrayBuffer();

    // Extract original filename (remove timestamp prefix)
    const rawName = filePath.split('/').pop() || 'download';
    const originalName = rawName.replace(/^\d+_/, '');

    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(originalName)}`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('NAS file serve error:', error);
    return NextResponse.json(
      { error: '파일을 가져올 수 없습니다.' },
      { status: 500 }
    );
  } finally {
    if (sid) {
      await nasLogout(sid, nasUrl);
    }
  }
}
