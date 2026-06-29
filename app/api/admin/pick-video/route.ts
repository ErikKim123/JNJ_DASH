// GET /api/admin/pick-video
// 로컬 운영 전용 — 서버(이 PC)에서 Windows '파일 열기' 대화상자를 띄워
// 선택한 영상파일의 전체 경로(Z:\...)를 돌려준다.
//
// 왜 필요한가: 브라우저의 <input type="file"> 은 보안상 전체 경로를 숨기고
// 파일명만 노출한다(C:\fakepath\…). 그러나 /api/video 는 서버 파일시스템의
// 절대경로를 읽어 스트리밍하므로, 운영자가 풀경로를 손으로 타이핑하지 않고
// 지정할 수 있도록 서버 측에서 네이티브 파일창을 띄운다.
//
// 제약: Windows + 데스크톱 세션(localhost 운영)에서만 동작. Vercel 등
// 헤드리스 환경에서는 데스크톱이 없어 대화상자를 띄울 수 없다.
// 인증: middleware.ts 가 /api/admin/* 를 admin_session 으로 보호한다.
import { NextResponse } from 'next/server';
import { spawn } from 'node:child_process';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// STA 스레드에서 OpenFileDialog 를 띄우고, 선택 시 전체 경로를 stdout 으로 출력.
//
// 핵심: dev 서버(node)의 자식으로 떠서 포그라운드 권한이 없으면 대화상자가
// 브라우저 뒤에 가려진다. 그래서 (1) TopMost 오너 폼을 만들고
// (2) AttachThreadInput + SetForegroundWindow 로 강제로 최상단 포커스를
// 가져와, 대화상자가 반드시 화면 맨 앞에 뜨도록 한다.
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

export async function GET() {
  if (process.platform !== 'win32') {
    return NextResponse.json(
      { error: 'UNSUPPORTED_OS', message: '파일 선택 창은 Windows 로컬 서버에서만 지원됩니다.' },
      { status: 400 },
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

    // 사용자가 취소한 경우 — 경로 없음.
    if (!filePath) return NextResponse.json({ canceled: true });

    return NextResponse.json({ path: filePath });
  } catch (e) {
    return NextResponse.json(
      { error: 'DIALOG_FAILED', message: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
