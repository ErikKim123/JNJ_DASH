// GET /api/local-pick-video  (+ OPTIONS preflight)
// "로컬 브리지" — 이 PC에서 도는 로컬 서버가 Windows '파일 열기' 대화상자를 띄워
// 선택한 영상파일의 전체 경로(Z:\...)를 돌려준다.
//
// 왜 /api/admin 이 아니라 별도 공개 경로인가:
//   Vercel(https) 관리자 페이지의 📁 버튼이 "이 PC의 로컬 서버(http://localhost)"를
//   직접 호출(cross-origin)할 수 있어야 한다. /api/admin/* 는 middleware 가 세션
//   쿠키로 보호하는데, cross-origin 요청엔 localhost 쿠키가 실리지 않아 401 이 된다.
//   이 엔드포인트는 "로컬 파일창을 띄워 경로 문자열만 반환"할 뿐(파일 내용·DB 접근 없음)
//   이고, 아래 Origin 허용목록으로 호출 출처를 우리 앱(localhost / *.vercel.app)으로
//   제한하므로 무인증으로 두어도 위험이 낮다.
//
// 동작 조건: 이 라우트가 도는 서버가 데스크톱 있는 Windows(=로컬 운영 PC)여야 한다.
// Vercel(리눅스 헤드리스)에 배포된 서버에서 호출되면 파일창을 못 띄운다(그래서
// Vercel 화면의 버튼은 이 라우트를 "localhost" 로 호출하도록 되어 있다 — ContestForm).
import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// 호출 허용 Origin — localhost(모든 포트) / 127.0.0.1 / *.vercel.app.
// 허용되지 않은 출처는 파일창을 띄우기 전에 403 으로 거절(임의 사이트의 대화상자 팝업 방지).
function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true; // 동일 출처(GET) 는 Origin 헤더가 없을 수 있음 → 허용
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') return true;
    if (u.hostname === 'vercel.app' || u.hostname.endsWith('.vercel.app')) return true;
    return false;
  } catch {
    return false;
  }
}

// CORS + Private Network Access(크롬: https 공개사이트 → http://localhost 호출 허용) 헤더.
function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin ?? '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Allow-Private-Network': 'true',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  };
}

// STA 스레드에서 OpenFileDialog 를 띄우고, 선택 시 전체 경로를 stdout 으로 출력.
// AttachThreadInput + SetForegroundWindow 로 대화상자를 반드시 화면 맨 앞에 띄운다.
const PS_SCRIPT = `
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -TypeDefinition 'using System;
using System.Runtime.InteropServices;
public static class Fg {
  [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, IntPtr p);
  [DllImport("kernel32.dll")] static extern uint GetCurrentThreadId();
  [DllImport("user32.dll")] static extern bool AttachThreadInput(uint a, uint b, bool f);
  [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] static extern bool BringWindowToTop(IntPtr h);
  [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int n);
  public static void Force(IntPtr h) {
    uint fg = GetWindowThreadProcessId(GetForegroundWindow(), IntPtr.Zero);
    uint cur = GetCurrentThreadId();
    AttachThreadInput(fg, cur, true);
    ShowWindow(h, 5); BringWindowToTop(h); SetForegroundWindow(h);
    AttachThreadInput(fg, cur, false);
  }
}'
$dlg = New-Object System.Windows.Forms.OpenFileDialog
$dlg.Title = '심사위원 소개 영상 선택'
$dlg.Filter = 'Video files|*.mp4;*.webm;*.mov;*.m4v;*.mkv;*.ogg;*.ogv|All files|*.*'
$dlg.Multiselect = $false
$owner = New-Object System.Windows.Forms.Form
$owner.StartPosition = 'CenterScreen'
$owner.Size = New-Object System.Drawing.Size(1,1)
$owner.FormBorderStyle = 'None'
$owner.ShowInTaskbar = $false
$owner.TopMost = $true
$owner.Show()
$owner.Activate()
[Fg]::Force($owner.Handle)
$result = $dlg.ShowDialog($owner)
$owner.Close()
$owner.Dispose()
if ($result -eq [System.Windows.Forms.DialogResult]::OK) { [Console]::Out.Write($dlg.FileName) }
`;

export async function OPTIONS(req: Request) {
  const origin = req.headers.get('origin');
  if (!isAllowedOrigin(origin)) return new Response(null, { status: 403 });
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function GET(req: Request) {
  const origin = req.headers.get('origin');
  const headers = corsHeaders(origin);

  // 허용되지 않은 출처면 파일창을 띄우지 않고 즉시 거절.
  if (!isAllowedOrigin(origin)) {
    return NextResponse.json({ error: 'FORBIDDEN_ORIGIN' }, { status: 403, headers });
  }

  // 이 서버가 데스크톱 있는 Windows 가 아니면(예: Vercel) 파일창 불가.
  if (process.platform !== 'win32') {
    return NextResponse.json(
      { error: 'UNSUPPORTED_OS', message: '이 PC의 로컬 서버에서만 파일창을 띄울 수 있습니다.' },
      { status: 400, headers },
    );
  }

  try {
    const filePath = await new Promise<string>((resolve, reject) => {
      const ps = spawn(
        'powershell.exe',
        ['-NoProfile', '-STA', '-Command', PS_SCRIPT],
        { windowsHide: true },
      );
      let out = '';
      let err = '';
      ps.stdout.on('data', (d) => (out += d.toString()));
      ps.stderr.on('data', (d) => (err += d.toString()));
      ps.on('error', reject);
      ps.on('close', (code) => {
        if (code === 0) resolve(out.trim());
        else reject(new Error(err.trim() || `powershell exited with code ${code}`));
      });
    });

    if (!filePath) return NextResponse.json({ canceled: true }, { headers });
    return NextResponse.json({ path: filePath }, { headers });
  } catch (e) {
    return NextResponse.json(
      { error: 'DIALOG_FAILED', message: e instanceof Error ? e.message : String(e) },
      { status: 500, headers },
    );
  }
}
