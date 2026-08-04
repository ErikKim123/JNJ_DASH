// GET /api/ajudge/reports/[reportId] — 리포트 조회. design §4.2
//
// ⚠️ 절대 원칙 2 의 서버측 강제:
//    confidence='low' 면 지표를 **아예 내려보내지 않는다**.
//    UI 실수로 신뢰할 수 없는 값이 노출되는 경로를 원천 차단한다.
import { NextResponse } from 'next/server';
import { createAuthServer, createClientServer, MEDIA_BUCKET } from '@/lib/ai-judge/supabase-server';
import type { Metrics, ReportResponse } from '@/lib/ai-judge/types';

export const dynamic = 'force-dynamic';

const SIGNED_TTL = 60 * 60; // 1시간

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ reportId: string }> }
) {
  const { reportId } = await params;

  const auth = await createAuthServer();
  const { data: userData } = await auth.auth.getUser();
  if (!userData.user) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const supabase = await createClientServer();

  const { data: report, error } = await supabase
    .from('reports')
    .select(
      'id, job_id, onbeat_ratio, sync_index, activity_index, confidence, low_reasons, metrics_json, comments_json, created_at'
    )
    .eq('id', reportId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: 'INTERNAL', message: error.message }, { status: 500 });
  }
  if (!report) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });

  const { data: job } = await supabase
    .from('jobs')
    .select('role, song_title, contest_id, leader_side, video_path')
    .eq('id', report.job_id)
    .maybeSingle();

  const jobMeta = {
    role: job?.role ?? 'leader',
    songTitle: job?.song_title ?? '',
    contestId: job?.contest_id ?? null,
    leaderSide: job?.leader_side ?? '',
  };

  // ── confidence=low → 지표를 담지 않고 사유만 ─────────────────
  if (report.confidence === 'low') {
    const body: ReportResponse = {
      report: {
        id: report.id,
        confidence: 'low',
        unavailableReasons: report.low_reasons ?? [],
      },
      job: jobMeta,
      media: { videoUrl: null, frameUrls: [] },
    };
    return NextResponse.json(body);
  }

  // ── 정상 — 영상/트랙 signed URL 발급 ─────────────────────────
  const metrics = report.metrics_json as Metrics & { pose: { track_path?: string } };
  const storage = supabase.storage.from(MEDIA_BUCKET);

  let videoUrl: string | null = null;
  if (job?.video_path) {
    const { data } = await storage.createSignedUrl(job.video_path, SIGNED_TTL);
    videoUrl = data?.signedUrl ?? null;
  }

  let trackUrl: string | null = null;
  const trackPath = metrics.pose?.track_path;
  if (trackPath) {
    const { data } = await storage.createSignedUrl(trackPath, SIGNED_TTL);
    trackUrl = data?.signedUrl ?? null;
  }

  const framePaths = (metrics.keyframes ?? []).map((k) => k.path).filter(Boolean);
  let frameUrls: string[] = [];
  if (framePaths.length) {
    const { data } = await storage.createSignedUrls(framePaths, SIGNED_TTL);
    frameUrls = (data ?? []).map((d) => d.signedUrl).filter(Boolean) as string[];
  }

  const body: ReportResponse & { media: { trackUrl: string | null } } = {
    report: {
      id: report.id,
      confidence: report.confidence,
      onbeatRatio: Number(report.onbeat_ratio),
      syncIndex: report.sync_index === null ? null : Number(report.sync_index),
      activityIndex: Number(report.activity_index ?? 0),
      metrics,
      comments: report.comments_json ?? {},
      createdAt: report.created_at,
    },
    job: jobMeta,
    media: { videoUrl, frameUrls, trackUrl },
  };
  return NextResponse.json(body);
}
