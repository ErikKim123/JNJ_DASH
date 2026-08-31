// 관객 심사위원 통합 계정(audience_judges) 헬퍼 — 계정 찾기 / 만들기 / 대회 일괄 참여.
//
// 정책(0037):
//   · 이메일 1개 = 계정 1개. 계정에 전역 번호(judge_no)와 4자리 PIN 이 붙는다.
//   · 한 번 등록하면 같은 group_name(같은 페스티벌)의 열린 대회 전체에 참여 행이 생긴다.
//   · online_judges 행은 그대로 유지 — 결승 채점이 online_judges.id 를 키로 쓰기 때문.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AudienceJudgeRow, ContestRow, OnlineJudgeRow } from '@/lib/db/types';

/** 이메일 비교 키 — 앞뒤 공백 제거 + 소문자. DB 유니크 인덱스와 같은 규칙. */
export function emailKey(raw: string | null | undefined): string {
  return (raw ?? '').trim().toLowerCase();
}

/**
 * ilike 패턴 이스케이프 — 이메일에 흔한 '_' 가 "아무 글자 하나" 로 먹히는 걸 막는다.
 * 계정 조회는 email_key 로 하지만, 생성 컬럼이 없는 옛 online_judges 행은 ilike 로 찾아야 한다.
 */
export function escapeLike(raw: string): string {
  return raw.replace(/[\\%_]/g, (m) => `\\${m}`);
}

/** 연락처 비교 키 — 숫자만. DB phone_key 생성 컬럼과 같은 규칙. */
export function phoneKey(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '');
}

/** 이메일 또는 연락처로 기존 계정 찾기. 이메일 우선(연락처는 공유될 수 있으므로). */
export async function findAccount(
  sb: SupabaseClient,
  opts: { email?: string; phone?: string }
): Promise<AudienceJudgeRow | null> {
  const ek = emailKey(opts.email);
  if (ek) {
    const { data, error } = await sb
      .from('audience_judges')
      .select('*')
      .eq('email_key', ek)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`findAccount(email): ${error.message}`);
    if (data) return data as AudienceJudgeRow;
  }
  const pk = phoneKey(opts.phone);
  if (pk.length >= 5) {
    const { data, error } = await sb
      .from('audience_judges')
      .select('*')
      .eq('phone_key', pk)
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`findAccount(phone): ${error.message}`);
    if (data) return data as AudienceJudgeRow;
  }
  return null;
}

/**
 * 로그인 입력값으로 계정 찾기.
 *   · 숫자만 → 전역 번호(judge_no). 대회별 옛 번호는 여기서 안 잡히고 호출부가 폴백한다.
 *   · 그 외 → 이메일.
 */
export async function findAccountByIdentifier(
  sb: SupabaseClient,
  identifier: string
): Promise<AudienceJudgeRow | null> {
  const id = identifier.trim();
  if (!id) return null;
  if (/^\d+$/.test(id)) {
    const { data, error } = await sb
      .from('audience_judges')
      .select('*')
      .eq('judge_no', Number(id))
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(`findAccountByIdentifier(no): ${error.message}`);
    return (data as AudienceJudgeRow) ?? null;
  }
  const { data, error } = await sb
    .from('audience_judges')
    .select('*')
    .eq('email_key', emailKey(id))
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findAccountByIdentifier(email): ${error.message}`);
  return (data as AudienceJudgeRow) ?? null;
}

/** 계정이 참여할 수 있는 대회인가 — 등록 화면(/ojudge/competitions)의 노출 조건과 같게 둔다. */
export function isEnrollable(c: Pick<ContestRow, 'status' | 'audience_listed'>): boolean {
  return c.status !== 'archived' && c.status !== 'done' && c.audience_listed !== false;
}

/**
 * 같은 페스티벌의 다른 열린 대회들 — 안내용.
 *   여기에 미리 참여 행을 만들지는 않는다. 참여 행은 그 사람이 실제로 그 대회에
 *   들어올 때(등록 또는 로그인) 생긴다 — 심사하지 않을 대회의 명단을 부풀리지 않기 위해.
 *   group_name 이 빈 값이면 "미분류" 라 서로 관계 없는 대회끼리 묶이므로 제외한다.
 */
export async function siblingContestIds(
  sb: SupabaseClient,
  contest: ContestRow
): Promise<string[]> {
  const ids = new Set<string>([contest.id]);
  const group = (contest.group_name ?? '').trim();
  if (!group) return [...ids];

  const { data, error } = await sb
    .from('contests')
    .select('id, status, audience_listed')
    .eq('group_name', contest.group_name);
  if (error) throw new Error(`siblingContestIds: ${error.message}`);
  for (const c of (data ?? []) as Pick<ContestRow, 'id' | 'status' | 'audience_listed'>[]) {
    if (isEnrollable(c)) ids.add(c.id);
  }
  return [...ids];
}

/** 대회 내 다음 등록 번호 — max + 1. */
async function nextDisplayOrder(sb: SupabaseClient, contestId: string): Promise<number> {
  const { data } = await sb
    .from('online_judges')
    .select('display_order')
    .eq('contest_id', contestId)
    .order('display_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.display_order ?? 0) + 1;
}

/** 계정 프로필을 online_judges 참여 행으로 복사 — 대회별 명단/매트릭스가 그대로 읽는다. */
function enrollmentRow(contestId: string, account: AudienceJudgeRow, displayOrder: number) {
  return {
    contest_id: contestId,
    display_order: displayOrder,
    audience_judge_id: account.id,
    first_name: account.first_name,
    last_name: account.last_name,
    name: account.name,
    representative: account.representative,
    email: account.email,
    phone: account.phone,
    photo_url: account.photo_url,
    pin: account.pin,
  };
}

/**
 * 한 대회 참여 보장 — 이미 있으면 그 행, 없으면 만든다.
 * display_order 유니크 충돌(동시 등록)은 번호를 다시 계산해 재시도한다.
 */
export async function ensureEnrollment(
  sb: SupabaseClient,
  contestId: string,
  account: AudienceJudgeRow
): Promise<OnlineJudgeRow | null> {
  const { data: existing, error: exErr } = await sb
    .from('online_judges')
    .select('*')
    .eq('contest_id', contestId)
    .eq('audience_judge_id', account.id)
    .limit(1)
    .maybeSingle();
  if (exErr) throw new Error(`ensureEnrollment(find): ${exErr.message}`);
  if (existing) return existing as OnlineJudgeRow;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const order = await nextDisplayOrder(sb, contestId);
    const { data, error } = await sb
      .from('online_judges')
      .insert(enrollmentRow(contestId, account, order))
      .select('*')
      .single();
    if (!error) return data as OnlineJudgeRow;
    if (error.code !== '23505') throw new Error(`ensureEnrollment(insert): ${error.message}`);
    // 23505 — display_order 충돌이면 재시도, (contest_id, audience_judge_id) 충돌이면
    // 동시에 들어온 다른 요청이 이미 만든 것이므로 그 행을 읽어 돌려준다.
    const { data: raced } = await sb
      .from('online_judges')
      .select('*')
      .eq('contest_id', contestId)
      .eq('audience_judge_id', account.id)
      .limit(1)
      .maybeSingle();
    if (raced) return raced as OnlineJudgeRow;
  }
  return null;
}
