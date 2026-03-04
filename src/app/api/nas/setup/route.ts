import { NextRequest, NextResponse } from 'next/server';
import { isNasConfigured, nasLoginWithOtp, nasLogout } from '@/lib/nas-auth';

/**
 * NAS 2단계 인증 설정 엔드포인트
 *
 * GET  /api/nas/setup → OTP 입력 폼 (HTML)
 * POST /api/nas/setup → OTP 인증 후 device token 발급
 */
export async function POST(req: NextRequest) {
  if (!isNasConfigured()) {
    return NextResponse.json(
      { error: 'NAS 환경변수가 설정되지 않았습니다.' },
      { status: 500 }
    );
  }

  try {
    const { otpCode } = await req.json();

    if (!otpCode) {
      return NextResponse.json(
        { error: 'OTP 코드가 필요합니다.' },
        { status: 400 }
      );
    }

    const { sid, deviceToken, nasUrl } = await nasLoginWithOtp(otpCode);
    await nasLogout(sid, nasUrl);

    if (!deviceToken) {
      return NextResponse.json({
        success: true,
        message: '로그인 성공했지만 device token이 발급되지 않았습니다.',
        deviceToken: null,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Device token 발급 완료! Vercel 환경변수에 추가하세요.',
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
  const hasToken = !!process.env.NAS_DEVICE_TOKEN;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>NAS OTP 설정</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f172a; color: #e2e8f0; min-height: 100vh; display: flex; align-items: center; justify-content: center; }
    .card { background: #1e293b; border-radius: 16px; padding: 32px; max-width: 480px; width: 90%; box-shadow: 0 4px 24px rgba(0,0,0,0.3); }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .subtitle { color: #94a3b8; margin-bottom: 24px; font-size: 14px; }
    .status { padding: 12px 16px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; }
    .status.ok { background: #064e3b; color: #6ee7b7; }
    .status.warn { background: #78350f; color: #fcd34d; }
    .step { background: #334155; padding: 16px; border-radius: 8px; margin-bottom: 16px; }
    .step-num { display: inline-block; background: #3b82f6; color: white; width: 24px; height: 24px; border-radius: 50%; text-align: center; line-height: 24px; font-size: 12px; font-weight: bold; margin-right: 8px; }
    .step p { display: inline; font-size: 14px; }
    label { display: block; font-size: 14px; color: #94a3b8; margin-bottom: 8px; }
    .input-row { display: flex; gap: 8px; }
    input[type="text"] { flex: 1; padding: 12px 16px; border: 2px solid #475569; background: #0f172a; color: white; border-radius: 8px; font-size: 20px; letter-spacing: 8px; text-align: center; outline: none; }
    input:focus { border-color: #3b82f6; }
    button { padding: 12px 24px; background: #3b82f6; color: white; border: none; border-radius: 8px; font-size: 16px; cursor: pointer; font-weight: 600; }
    button:hover { background: #2563eb; }
    button:disabled { background: #475569; cursor: not-allowed; }
    .result { margin-top: 20px; padding: 16px; border-radius: 8px; font-size: 14px; word-break: break-all; }
    .result.success { background: #064e3b; border: 1px solid #059669; }
    .result.error { background: #7f1d1d; border: 1px solid #dc2626; }
    .token-box { background: #0f172a; padding: 12px; border-radius: 8px; margin: 12px 0; font-family: monospace; font-size: 13px; color: #fcd34d; user-select: all; cursor: pointer; }
    .copy-btn { background: #059669; font-size: 13px; padding: 8px 16px; margin-top: 8px; }
    .copy-btn:hover { background: #047857; }
    .hidden { display: none; }
    .instructions { margin-top: 16px; font-size: 13px; color: #94a3b8; line-height: 1.6; }
    .instructions ol { padding-left: 20px; }
    .instructions li { margin-bottom: 4px; }
  </style>
</head>
<body>
  <div class="card">
    <h1>🔐 NAS OTP 설정</h1>
    <p class="subtitle">한 번만 설정하면 이후 OTP 없이 동기화됩니다</p>

    ${hasToken
      ? '<div class="status ok">✅ Device Token이 이미 설정되어 있습니다. 동기화가 정상 작동해야 합니다.</div>'
      : '<div class="status warn">⚠️ Device Token이 없습니다. 아래에서 OTP 인증을 완료하세요.</div>'
    }

    <div class="step">
      <span class="step-num">1</span>
      <p>NAS 인증 앱(Google Authenticator 등)에서 6자리 코드를 확인하세요</p>
    </div>

    <div class="step">
      <span class="step-num">2</span>
      <p>아래에 코드를 입력하고 인증 버튼을 누르세요</p>
    </div>

    <label for="otp">OTP 코드 (6자리)</label>
    <div class="input-row">
      <input type="text" id="otp" maxlength="6" placeholder="000000" autocomplete="off" />
      <button id="submitBtn" onclick="submitOtp()">인증</button>
    </div>

    <div id="result" class="hidden"></div>

    <div class="step" style="margin-top: 20px;">
      <span class="step-num">3</span>
      <p>발급된 토큰을 Vercel 환경변수에 추가하세요</p>
    </div>

    <div class="instructions">
      <ol>
        <li>Vercel 대시보드 → Settings → Environment Variables</li>
        <li><strong>NAS_DEVICE_TOKEN</strong> 이름으로 토큰 값 추가</li>
        <li>Deployments → 최신 배포 Redeploy</li>
      </ol>
    </div>
  </div>

  <script>
    const otpInput = document.getElementById('otp');
    const submitBtn = document.getElementById('submitBtn');
    const resultDiv = document.getElementById('result');

    // 숫자만 입력
    otpInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.replace(/[^0-9]/g, '');
    });

    // Enter 키
    otpInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitOtp();
    });

    async function submitOtp() {
      const code = otpInput.value.trim();
      if (code.length !== 6) {
        showResult('error', '6자리 코드를 입력하세요.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.textContent = '인증 중...';

      try {
        const res = await fetch('/api/nas/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ otpCode: code }),
        });
        const data = await res.json();

        if (data.success && data.deviceToken) {
          showResult('success',
            '<strong>✅ 인증 성공!</strong><br><br>' +
            'Vercel 환경변수에 추가할 값:<br>' +
            '<div class="token-box" id="tokenBox">' + data.deviceToken + '</div>' +
            '<button class="copy-btn" onclick="copyToken()">📋 복사</button>' +
            '<br><br>변수명: <strong>NAS_DEVICE_TOKEN</strong>'
          );
        } else if (data.error) {
          showResult('error', '❌ ' + data.error);
        } else {
          showResult('error', '❌ Device token이 발급되지 않았습니다.');
        }
      } catch (err) {
        showResult('error', '❌ 네트워크 오류: ' + err.message);
      }

      submitBtn.disabled = false;
      submitBtn.textContent = '인증';
    }

    function showResult(type, html) {
      resultDiv.className = 'result ' + type;
      resultDiv.innerHTML = html;
    }

    function copyToken() {
      const token = document.getElementById('tokenBox').textContent;
      navigator.clipboard.writeText(token).then(() => {
        const btn = document.querySelector('.copy-btn');
        btn.textContent = '✅ 복사됨!';
        setTimeout(() => btn.textContent = '📋 복사', 2000);
      });
    }

    otpInput.focus();
  </script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
