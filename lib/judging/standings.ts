// 라운드별 순위 + 경계 동점(boundary tie) 산정 — 순수 함수.
//   MC 모바일 심사 콘솔이 이 결과를 그대로 렌더한다. 랭킹/동점 공식을
//   commit 라우트(app/api/admin/.../judging/[round]/commit/route.ts:117-134,244-273)
//   및 JudgingMatrix 와 동일하게 맞춰 값 불일치를 막는다.
//
//   prelim/semi : value = O 카운트, maxPerRole = *_pass_per_role
//   final       : value = 활성 항목 총점, maxPerRole = 3 (시상 podium)
//   Olympic rank(1,1,3) · 경계 동점 = rank==maxPerRole 의 값이 rank==maxPerRole+1 의 값과 같을 때.

export interface StandingInput {
  num: string;
  name: string;
  role: 'leader' | 'follower';
  /** 순위 산정 점수 — prelim/semi: O 카운트, final: 활성항목 총점. */
  value: number;
  /** 점수가 하나라도 매겨졌는가(랭킹 대상). false 면 순위에서 제외하고 하단에 표시. */
  scored: boolean;
  /** 헤드(타이브레이커) 심사위원이 O를 줬는가 — 동점 자동 preselect 우선순위. prelim/semi only. */
  headO?: boolean;
  /** 현재 확정 상태(qualifiers.passed / final_rank<=3). 표시용. */
  passed?: boolean;
}

export interface StandingEntry extends StandingInput {
  rank: number;      // Olympic (0 = 미채점)
  inQuota: boolean;  // rank <= maxPerRole
  boundaryTie: boolean;
}

export interface TieInfo {
  /** 경계 동점 후보 participant_num 들. */
  candidates: string[];
  /** 이 동점 그룹에서 추가로 통과시킬 수 있는 자리 수. */
  slots: number;
  /** 자동 preselect 추천(헤드 O → 없으면 num 순)으로 고른 candidates 중 slots 개. */
  suggested: string[];
}

export interface RoleStanding {
  role: 'leader' | 'follower';
  maxPerRole: number;
  entries: StandingEntry[];
  tie: TieInfo | null;
}

function numAsc(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true });
}

/** 한 역할(leader/follower)의 순위 + 경계 동점 산정. */
export function rankRole(inputs: StandingInput[], maxPerRole: number): RoleStanding {
  const role = inputs[0]?.role ?? 'leader';

  const scoredSorted = inputs
    .filter((e) => e.scored)
    .sort((a, b) => b.value - a.value || numAsc(a.num, b.num));

  const entries: StandingEntry[] = [];
  let lastVal = NaN;
  let lastRank = 0;
  scoredSorted.forEach((e, i) => {
    if (e.value !== lastVal) {
      lastRank = i + 1;
      lastVal = e.value;
    }
    entries.push({ ...e, rank: lastRank, inQuota: lastRank <= maxPerRole, boundaryTie: false });
  });
  // 미채점자 — 하단에 rank 0 으로 표시.
  for (const e of inputs.filter((x) => !x.scored)) {
    entries.push({ ...e, rank: 0, inQuota: false, boundaryTie: false });
  }

  // 경계 동점: 정원 컷오프(rank==maxPerRole) 값 == 그 다음(rank==maxPerRole+1) 값.
  let tie: TieInfo | null = null;
  if (maxPerRole > 0 && scoredSorted.length > maxPerRole) {
    const inQuota = entries.filter((e) => e.scored && e.inQuota);
    const firstOut = entries.find((e) => e.scored && !e.inQuota);
    const boundaryValue = inQuota.length ? inQuota[inQuota.length - 1].value : NaN;
    if (firstOut && firstOut.value === boundaryValue) {
      const aboveCount = scoredSorted.filter((e) => e.value > boundaryValue).length;
      const slots = Math.max(0, maxPerRole - aboveCount);
      const candidates = scoredSorted.filter((e) => e.value === boundaryValue);
      for (const c of candidates) {
        const ent = entries.find((e) => e.num === c.num);
        if (ent) ent.boundaryTie = true;
      }
      const suggested = candidates
        .slice()
        .sort((a, b) => Number(!!b.headO) - Number(!!a.headO) || numAsc(a.num, b.num))
        .slice(0, slots)
        .map((c) => c.num);
      tie = { candidates: candidates.map((c) => c.num), slots, suggested };
    }
  }

  return { role, maxPerRole, entries, tie };
}

/** leader/follower 두 역할을 한 번에. */
export function computeStandings(
  inputs: StandingInput[],
  maxPerRole: number
): { leader: RoleStanding; follower: RoleStanding } {
  return {
    leader: rankRole(
      inputs.filter((e) => e.role === 'leader'),
      maxPerRole
    ),
    follower: rankRole(
      inputs.filter((e) => e.role === 'follower'),
      maxPerRole
    ),
  };
}
