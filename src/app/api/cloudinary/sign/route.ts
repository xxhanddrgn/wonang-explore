import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { folder } = await req.json();

    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        { error: 'Cloudinary 환경변수가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const timestamp = Math.floor(Date.now() / 1000);

    const crypto = await import('crypto');
    const params: Record<string, string> = {
      folder: folder || 'lecture-notes',
      timestamp: timestamp.toString(),
    };

    // Build the signature string: sorted params joined by & + api_secret
    const signatureStr =
      Object.keys(params)
        .sort()
        .map((key) => `${key}=${params[key]}`)
        .join('&') + apiSecret;

    const signature = crypto
      .createHash('sha1')
      .update(signatureStr)
      .digest('hex');

    return NextResponse.json({
      signature,
      timestamp,
      apiKey,
      cloudName,
      folder: params.folder,
    });
  } catch (error) {
    console.error('Cloudinary sign error:', error);
    return NextResponse.json(
      { error: '서명 생성에 실패했습니다.' },
      { status: 500 }
    );
  }
}
