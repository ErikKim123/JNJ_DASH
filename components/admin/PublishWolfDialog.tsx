'use client';

// 결승 시상대 → Wolf 우승자관리 게시 대화상자.
//
// 웹게시(공개 페이지)와 나란히 두되 버튼을 따로 뒀다. 둘은 목적이 다르다 —
// 웹게시는 '지금 이 대회 결과를 누구나 보게' 이고, 여기는 '고객몰의 연도별 시상대에
// 영구히 올린다' 다. 후자는 어느 에디션·부문에 넣을지 골라야 해서 한 번 더 확인받는다.
//
// 넣을 값은 서버가 DB 를 다시 읽어 만든다. 여기 미리보기는 '무엇이 들어갈지' 를
// 보여 줄 뿐이고, 체크박스는 '어느 줄을 넣을지' 만 서버로 보낸다.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Select } from './ui';

interface Entry {
  key: string;
  role: 'leader' | 'follower';
  rank: number;
  num: string;
  name: string;
  country: string | null;
  countryRaw: string;
  photoUrl: string;
  totalScore: number | null;
  avgScore: number | null;
}
interface ScoreRow {
  key: string;
  round: 'prelim' | 'semi' | 'final';
  role: 'leader' | 'follower';
  entryNo: string;
  name: string;
  country: string | null;
  countryRaw: string;
  votes: number | null;
  passed: boolean | null;
  rank: number | null;
  totalScore: number | null;
  avgScore: number | null;
}
interface Edition { id: string; year: number; label: string }
interface Division { editionId: string; code: string; label: string }

const ROLE_LABEL: Record<'leader' | 'follower', string> = { leader: '리더', follower: '팔로워' };
const ROUND_LABEL: Record<ScoreRow['round'], string> = { prelim: '예선', semi: '본선', final: '결승' };

/** 무엇을 넣을지 — Wolf 에서도 다른 화면(우승자관리 / 점수관리)이라 탭으로 가른다. */
type Target = 'winners' | 'scores';

/** 반 표(0.5)가 섞이면 '4.5' 로, 아니면 '4' 로. */
function fmtVotes(n: number | null): string {
  if (n == null) return '—';
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

export function PublishWolfDialog({
  contestId,
  contestName,
  onClose,
}: {
  contestId: string;
  contestName: string;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const [target, setTarget] = useState<Target>('winners');
  const [editions, setEditions] = useState<Edition[]>([]);
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [existing, setExisting] = useState(0);
  const [existingScores, setExistingScores] = useState(0);
  const [halfVotes, setHalfVotes] = useState(false);

  const [editionId, setEditionId] = useState('');
  const [division, setDivision] = useState('');
  const [replace, setReplace] = useState(true);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());

  const base = `/api/admin/contests/${encodeURIComponent(contestId)}/publish-wolf`;

  const load = useCallback(
    async (ed: string, dv: string) => {
      const q = ed && dv ? `?editionId=${encodeURIComponent(ed)}&division=${encodeURIComponent(dv)}` : '';
      const res = await fetch(`${base}${q}`);
      if (!res.ok) throw new Error(`불러오기 실패 (${res.status})`);
      const j = await res.json();
      setEditions(j.data.editions);
      setDivisions(j.data.divisions);
      setEntries(j.data.entries);
      setScores(j.data.scores ?? []);
      setExisting(j.data.existing ?? 0);
      setExistingScores(j.data.existingScores ?? 0);
      setHalfVotes(j.data.halfVotes === true);
    },
    [base],
  );

  useEffect(() => {
    load('', '')
      .catch((e) => setError(e instanceof Error ? e.message : '불러오기 실패'))
      .finally(() => setLoading(false));
  }, [load]);

  // 에디션·부문을 고를 때마다 '이미 들어 있는 행 수' 를 다시 센다 — 덮어쓰기 전에
  // 무엇이 지워지는지 숫자로 보여 주기 위해서다.
  useEffect(() => {
    if (!editionId || !division) { setExisting(0); setExistingScores(0); return; }
    load(editionId, division).catch(() => { setExisting(0); setExistingScores(0); });
  }, [editionId, division, load]);

  // 에디션을 바꾸면 그 에디션에 속하지 않는 부문 선택은 버린다.
  // useEffect 의존성으로 쓰이므로 참조가 매 렌더 바뀌지 않게 고정한다.
  const editionDivisions = useMemo(
    () => divisions.filter((d) => d.editionId === editionId),
    [divisions, editionId],
  );
  useEffect(() => {
    if (division && !editionDivisions.some((d) => d.code === division)) setDivision('');
  }, [editionId, division, editionDivisions]);

  // 탭마다 목록이 다르지만 '뺀 줄' 은 key 하나로 관리한다 — key 에 라운드가 들어 있어
  // 시상대의 leader-016 과 성적표의 final-leader-016 이 섞이지 않는다.
  const rows: { key: string }[] = target === 'winners' ? entries : scores;
  const picked = rows.filter((e) => !skipped.has(e.key));
  const existingHere = target === 'winners' ? existing : existingScores;

  function toggle(key: string) {
    setSkipped((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });
  }

  async function publish() {
    if (!editionId || !division || picked.length === 0) return;
    setBusy(true); setError(null); setDone(null);
    try {
      const res = await fetch(base, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ editionId, division, target, replace, keys: picked.map((e) => e.key) }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? `게시 실패 (${res.status})`);
      const where = target === 'winners' ? 'Wolf 우승자관리' : 'Wolf 점수관리';
      setDone(
        `${where}에 ${j.data.inserted}건 게시 완료` +
          (j.data.removed ? ` (기존 ${j.data.removed}건 교체)` : '') +
          (j.data.criteriaDropped ? ' · 채점 상세는 제외됨(Wolf DB 미적용)' : ''),
      );
      if (target === 'winners') setExisting(j.data.inserted);
      else setExistingScores(j.data.inserted);
    } catch (e) {
      setError(e instanceof Error ? e.message : '게시 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:p-8"
      role="dialog"
      aria-modal="true"
      aria-label="Wolf 우승자관리 게시"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-2xl rounded-lg border border-border bg-panel shadow-xl">
        <header className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Wolf 에 게시</h2>
            <p className="mt-0.5 text-xs text-ink2">
              {contestName} ·{' '}
              {target === 'winners'
                ? '결승 1~3위(리더·팔로워)를 고객몰 시상대에 올립니다.'
                : '예선·본선·결승 전체 성적을 고객몰 전체 결과 표에 올립니다.'}
            </p>
          </div>
          <Button variant="ghost" onClick={onClose}>✕</Button>
        </header>

        {/* 우승자관리 / 점수관리 — Wolf 에서도 다른 화면이라 넣는 곳을 먼저 고르게 한다. */}
        <div className="flex gap-1 border-b border-border px-5 pt-3">
          {([
            ['winners', `우승자관리 (${entries.length})`],
            ['scores', `점수관리 (${scores.length})`],
          ] as [Target, string][]).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTarget(k)}
              className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                target === k ? 'border-accent text-ink' : 'border-transparent text-ink2 hover:text-ink'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="space-y-4 px-5 py-4">
          {loading ? (
            <p className="text-sm text-ink2">불러오는 중…</p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1 block text-xs text-ink2">Wolf 대회(에디션)</span>
                  <Select value={editionId} onChange={(e) => setEditionId(e.target.value)} className="w-full">
                    <option value="">— 선택 —</option>
                    {editions.map((ed) => (
                      <option key={ed.id} value={ed.id}>{ed.year} · {ed.label}</option>
                    ))}
                  </Select>
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs text-ink2">부문</span>
                  <Select
                    value={division}
                    onChange={(e) => setDivision(e.target.value)}
                    disabled={!editionId}
                    className="w-full"
                  >
                    <option value="">— 선택 —</option>
                    {editionDivisions.map((d) => (
                      <option key={d.code} value={d.code}>{d.label}</option>
                    ))}
                  </Select>
                </label>
              </div>

              {editions.length === 0 && (
                <p className="text-xs text-danger">
                  Wolf 에디션을 읽지 못했습니다. Wolf 어드민에서 대회(에디션)를 먼저 만들어 주세요.
                </p>
              )}
              {editionId && editionDivisions.length === 0 && (
                <p className="text-xs text-danger">이 에디션에 등록된 부문이 없습니다. Wolf 어드민에서 부문을 먼저 만들어 주세요.</p>
              )}
              {target === 'scores' && halfVotes && (
                <p className="rounded border border-may/40 bg-may/5 px-3 py-2 text-xs text-may">
                  이 대회에 1/2표(0.5)가 섞여 있습니다. Wolf 의 성적표 득표 칸이 아직 정수라면
                  12.5 가 13 으로 반올림돼 들어갑니다 — Wolf 마이그레이션
                  <span className="mx-1 font-mono">0100_jnj_scores_half_votes</span>
                  를 먼저 적용해 주세요.
                </p>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.target.checked)} />
                <span>
                  {target === 'winners'
                    ? '같은 부문의 기존 1~3위를 지우고 넣기'
                    : '같은 부문의 기존 성적을 (넣는 라운드만) 지우고 넣기'}
                  {existingHere > 0 && <span className="ml-1 text-accent">(현재 {existingHere}건)</span>}
                </span>
              </label>
              <p className="-mt-2 text-[11px] text-ink2">
                끄면 기존 행 위에 덧붙습니다 — 같은 줄이 두 번 보일 수 있습니다.{' '}
                {target === 'winners'
                  ? '커플 시상과 4위 이하 행은 어느 쪽이든 건드리지 않습니다.'
                  : '이번에 넣지 않는 라운드의 성적은 그대로 남습니다.'}
              </p>

              <div>
                <p className="mb-1 text-xs text-ink2">
                  게시할 {target === 'winners' ? '시상대' : '성적'} {picked.length}/{rows.length}건 — 체크를 풀면 그 줄은 빠집니다.
                </p>
                {rows.length === 0 ? (
                  <p className="rounded border border-border bg-bg2/40 px-3 py-4 text-sm text-ink2">
                    {target === 'winners'
                      ? '결승 1~3위가 없습니다. 결승 결과에서 순위를 먼저 확정해 주세요.'
                      : '성적이 없습니다. 예선·본선 통과자 확정이나 결승 결과를 먼저 만들어 주세요.'}
                  </p>
                ) : target === 'scores' ? (
                  <div className="max-h-64 overflow-y-auto rounded border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-bg2 text-xs uppercase tracking-wider text-ink2">
                        <tr>
                          <th className="w-8 px-2 py-2"></th>
                          <th className="px-2 py-2 text-left">라운드</th>
                          <th className="px-2 py-2 text-left">역할</th>
                          <th className="px-2 py-2 text-left">#</th>
                          <th className="px-2 py-2 text-left">이름</th>
                          <th className="px-2 py-2 text-left">국가</th>
                          <th className="px-2 py-2 text-right">득표 / 순위</th>
                          <th className="px-2 py-2 text-right">점수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scores.map((r) => (
                          <tr key={r.key} className="border-t border-border">
                            <td className="px-2 py-1.5 text-center">
                              <input type="checkbox" checked={!skipped.has(r.key)} onChange={() => toggle(r.key)} />
                            </td>
                            <td className="px-2 py-1.5">{ROUND_LABEL[r.round]}</td>
                            <td className="px-2 py-1.5">{ROLE_LABEL[r.role]}</td>
                            <td className="px-2 py-1.5 font-mono text-ink2">{r.entryNo}</td>
                            <td className="px-2 py-1.5">{r.name}</td>
                            <td className="px-2 py-1.5">
                              {r.country ?? (
                                <span className="text-danger" title="국가 코드를 알아보지 못했습니다 — 빈 값으로 들어갑니다">
                                  {r.countryRaw || '—'}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono">
                              {r.round === 'final' ? (
                                r.rank != null ? `${r.rank}위` : '—'
                              ) : (
                                <>
                                  {fmtVotes(r.votes)}
                                  {r.passed && <span className="ml-1 text-ok">통과</span>}
                                </>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono">
                              {r.totalScore != null ? r.totalScore.toFixed(2) : '—'}
                              {r.avgScore != null && <span className="ml-1 text-ink2">avg {r.avgScore.toFixed(2)}</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto rounded border border-border">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-bg2 text-xs uppercase tracking-wider text-ink2">
                        <tr>
                          <th className="w-8 px-2 py-2"></th>
                          <th className="px-2 py-2 text-left">역할</th>
                          <th className="px-2 py-2 text-left">순위</th>
                          <th className="px-2 py-2 text-left">#</th>
                          <th className="px-2 py-2 text-left">이름</th>
                          <th className="px-2 py-2 text-left">국가</th>
                          <th className="px-2 py-2 text-right">점수</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e) => (
                          <tr key={e.key} className="border-t border-border">
                            <td className="px-2 py-1.5 text-center">
                              <input
                                type="checkbox"
                                checked={!skipped.has(e.key)}
                                onChange={() => toggle(e.key)}
                              />
                            </td>
                            <td className="px-2 py-1.5">{ROLE_LABEL[e.role]}</td>
                            <td className="px-2 py-1.5 font-mono">{e.rank}위</td>
                            <td className="px-2 py-1.5 font-mono text-ink2">{e.num}</td>
                            <td className="px-2 py-1.5">{e.name}</td>
                            <td className="px-2 py-1.5">
                              {e.country ?? (
                                <span className="text-danger" title="국가 코드를 알아보지 못했습니다 — 빈 값으로 들어갑니다">
                                  {e.countryRaw || '—'}
                                </span>
                              )}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono">
                              {e.totalScore != null ? e.totalScore.toFixed(2) : '—'}
                              {e.avgScore != null && (
                                <span className="ml-1 text-ink2">avg {e.avgScore.toFixed(2)}</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-danger" role="alert">{error}</p>}
              {done && <p className="text-sm text-ok">{done}</p>}
            </>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-3">
          <Button onClick={onClose} disabled={busy}>닫기</Button>
          <Button
            variant="primary"
            onClick={publish}
            disabled={busy || loading || !editionId || !division || picked.length === 0}
          >
            {busy
              ? '게시 중…'
              : `${target === 'winners' ? '우승자관리' : '점수관리'}에 게시 (${picked.length}건)`}
          </Button>
        </footer>
      </div>
    </div>
  );
}
