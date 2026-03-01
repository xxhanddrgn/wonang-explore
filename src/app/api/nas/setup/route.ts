import { NextRequest, NextResponse } from 'next/server';
import { isNasConfigured, nasLoginWithOtp, nasLogout } from '@/lib/nas-auth';

/**
 * NAS 2단계 인증 설정 엔드포인트
 *
 * POST /api/nas/setup
 * Body: { otpCode: "123456" }
 *
 * 성공 시 device token을 반환합니다.
 * 이 토큰을 .env.local의 NAS_DEVICE_TOKEN에 저장하세요.
 */
export async function POST(req: NextRequest) {
  if (!isNasConfigured()) {
    return NextResponse.json(
      { error: 'NAS 환경변수가 설정되지 않았습니다. .env.local 파일을 확인하세요.' },
      { status: 500 }
    );
  }

  try {
    const { otpCode } = await req.json();

    if (!otpCode) {
      return NextResponse.json(
        { error: 'OTP 코드가 필요합니다.', usage: 'POST { "otpCode": "123456" }' },
        { status: 400 }
      );
    }

    const { sid, deviceToken } = await nasLoginWithOtp(otpCode);
    await nasLogout(sid);

    if (!deviceToken) {
      return NextResponse.json({
        success: true,
        message: 'NAS 로그인 성공! 하지만 device token이 발급되지 않았습니다. NAS에서 2FA가 활성화되어 있는지 확인하세요.',
        deviceToken: null,
      });
    }

    return NextResponse.json({
      success: true,
      message: '아래 NAS_DEVICE_TOKEN 값을 .env.local에 추가한 후 서버를 재시작하세요.',
      deviceToken,
      envLine: `NAS_DEVICE_TOKEN=${deviceToken}`,
    });
  } catch (error) {
    console.error('NAS setup error:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'NAS 설정 중 오류가 발생했습니다.',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    description: 'NAS 2단계 인증 설정',
    usage: 'POST /api/nas/setup with body { "otpCode": "인증앱의 6자리 코드" }',
    configured: isNasConfigured(),
    hasDeviceToken: !!(process.env.NAS_DEVICE_TOKEN),
  });
}
