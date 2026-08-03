// PAIRING 원형(타원) 배치 — 커플을 원 둘레에 늘어놓는 레이아웃의 좌표 계산만 담당.
// 마크업/색은 템플릿마다 다르므로 여기서는 "어디에 어떤 정렬로 놓을지"만 돌려주고,
// 각 템플릿 pairing.ts 가 슬롯을 받아 자기 톤으로 그린다.
//
// 배치 규칙 (템플릿 03/04 의 검증된 튜닝을 일반화):
//   • 12시 방향부터 시계방향으로 균등 분할.
//   • 정타원이 아니라 슈퍼타원(squircle) — 좌우 극단이 곧게 서서 라벨의 좌/우 모서리가
//     한 줄로 정렬되고, 상/하단 호는 넓게 퍼져 세로 공간을 더 쓴다.
//   • zig-zag 는 두지 않는다 — 둘레 균등 분할이라 슬롯 간격이 어디서나 일정해 겹치지 않고,
//     밀어내면 상/하단 행의 높이만 들쭉날쭉해진다.
//   • 좌/우측은 바깥쪽 정렬(end/start), 상/하단은 가운데 정렬 — 라벨이 원 안쪽으로 넘어오지 않는다.
//   • 상단은 블록을 위로, 하단은 아래로 살짝 밀어 상/하 호가 붐비지 않게 한다.

export type SlotAnchor = 'start' | 'middle' | 'end';

export interface CircleSlot {
  /** 1-based 페어 순번 */
  i: number;
  /** 라벨 블록 원점 (리더 줄의 baseline) */
  x: number;
  y: number;
  anchor: SlotAnchor;
  /** 등장 애니메이션 begin 값 (초) */
  delay: string;
  /** 커플 종결 플뢰리시 라인의 x 범위 (블록 원점 기준 상대 좌표) */
  flourishX1: number;
  flourishX2: number;
  /** 플뢰리시 라인의 y (블록 원점 기준 상대 좌표) */
  flourishY: number;
}

export interface CircleLayout {
  cx: number;
  cy: number;
  /** 리더/팔로워 폰트 크기 */
  fontSize: number;
  /** 리더 → 팔로워 줄 간격 */
  lineH: number;
  /** 라벨에 이름까지 넣어도 되는 밀도인지 (false 면 번호만) */
  withNames: boolean;
  slots: CircleSlot[];
}

interface Tier {
  max: number;
  rx: number;
  ry: number;
  fs: number;
}

// 번호+이름 라벨(넓음) — 라벨이 길어 반지름을 키우고 폰트를 줄인다.
const TIERS_WIDE: readonly Tier[] = [
  { max: 6, rx: 265, ry: 148, fs: 24 },
  { max: 10, rx: 330, ry: 164, fs: 20 },
  { max: 14, rx: 392, ry: 174, fs: 17 },
];

// 번호만(좁음) — 03/04 에서 5~25 페어 비중첩이 확인된 값.
const TIERS_NARROW: readonly Tier[] = [
  { max: 8, rx: 235, ry: 150, fs: 30 },
  { max: 14, rx: 335, ry: 165, fs: 22 },
  { max: 20, rx: 405, ry: 172, fs: 18 },
  { max: 999, rx: 434, ry: 178, fs: 15 },
];

/** 이름까지 넣어도 겹치지 않는 최대 커플 수. 이보다 많으면 번호만 표기. */
export const NAME_LIMIT = 14;

export interface CircleLayoutOpts {
  /** 타원 중심 y. 템플릿 헤더 높이에 맞춰 조정. 기본 430. */
  cy?: number;
  /** 타원 중심 x. 기본 640. */
  cx?: number;
  /**
   * 라벨에 이름을 넣을지. 미지정 시 커플 수로 자동 판단(≤14 이면 이름 표기).
   * 번호만 쓰는 템플릿(05/06)은 false 로 고정해 넘긴다.
   */
  withNames?: boolean;
  /** 첫 슬롯 등장 지연(초). 기본 0.45 */
  baseDelay?: number;
  /**
   * 타원 반지름 배율. 템플릿마다 헤더/푸터가 차지하는 높이가 달라
   * 세로로 눌러 담아야 하는 경우(05/06)에 쓴다. 기본 1.
   */
  rxScale?: number;
  ryScale?: number;
  /**
   * 라벨이 들어갈 세로 구간 [top, bottom] (SVG y). 주면 여기에 딱 맞도록
   * ry 와 cy 를 역산한다 — 템플릿마다 헤더 라인/푸터 위치가 달라 손으로 맞추면
   * 커플 수·폰트가 바뀔 때마다 어긋나므로, 구간을 주고 레이아웃이 스스로 맞추게 한다.
   * (cy 옵션보다 우선)
   */
  band?: readonly [number, number];
  /**
   * 슈퍼타원 지수 (0 < p ≤ 1). 1 이면 정타원, 작을수록 좌우가 곧게 서고 상/하 호가 넓어진다.
   * 기본 0.72 — 좌우 라벨이 세로 한 줄로 정렬될 만큼은 곧고, 모서리는 여전히 둥글다.
   */
  squircle?: number;
}

export function circlePairingLayout(pairCount: number, opts: CircleLayoutOpts = {}): CircleLayout {
  const count = Math.max(2, Math.min(30, pairCount));
  const cx = opts.cx ?? 640;
  const baseDelay = opts.baseDelay ?? 0.45;
  const withNames = opts.withNames ?? count <= NAME_LIMIT;

  const tiers = withNames ? TIERS_WIDE : TIERS_NARROW;
  const base = tiers.find((t) => count <= t.max) ?? tiers[tiers.length - 1];

  const lineH = base.fs + 6;
  const flourishGap = Math.round(base.fs * 0.3);
  const flourishHalf = Math.round(base.fs * (withNames ? 1.6 : 1.0));
  // 라벨 블록 전체 높이 (리더 줄 + 팔로워 줄 + 플뢰리시)
  const blockH = lineH * 2 + flourishGap;

  function anchorFor(nx: number): SlotAnchor {
    if (nx > 0.35) return 'start';
    if (nx < -0.35) return 'end';
    return 'middle';
  }
  // 상단(ny<0)은 블록을 위로, 하단(ny>0)은 아래로 밀되 블록 높이의 1/4 만큼만.
  // (예전엔 블록 전체를 밖으로 밀어냈는데, 그만큼 위아래 여백을 잡아먹어 타원을 키울 수 없었다.)
  // ny 에 대해 연속 — 구간 분기로 두면 경계를 넘는 이웃 슬롯끼리 높이가 툭 튄다.
  function yShiftFor(ny: number): number {
    return -blockH * 0.5 + lineH * 0.5 + ny * blockH * 0.25;
  }
  function flourishRange(anchor: SlotAnchor): { x1: number; x2: number } {
    if (anchor === 'start') return { x1: 0, x2: flourishHalf * 2 };
    if (anchor === 'end') return { x1: -flourishHalf * 2, x2: 0 };
    return { x1: -flourishHalf, x2: flourishHalf };
  }

  const p = opts.squircle ?? 0.72;
  const rx = base.rx * (opts.rxScale ?? 1);

  /**
   * 중심을 원점으로 둔 슬롯 좌표. 슈퍼타원 위를 "각도"가 아니라 "둘레 길이"로 균등 분할한다.
   * 각도 균등 분할은 모서리 쪽에서 점이 몰려(=각도당 호 길이가 짧아져) 라벨이 서로 붙는다.
   */
  function buildSlots(ryTry: number): CircleSlot[] {
    const SAMPLES = 360;
    const sx: number[] = [];
    const sy: number[] = [];
    for (let k = 0; k <= SAMPLES; k++) {
      const a = ((-90 + (k * 360) / SAMPLES) * Math.PI) / 180;
      const c = Math.cos(a);
      const s2 = Math.sin(a);
      sx.push(Math.sign(c) * Math.abs(c) ** p * rx);
      sy.push(Math.sign(s2) * Math.abs(s2) ** p * ryTry);
    }
    const cum: number[] = [0];
    for (let k = 1; k <= SAMPLES; k++) {
      cum.push(cum[k - 1] + Math.hypot(sx[k] - sx[k - 1], sy[k] - sy[k - 1]));
    }
    const perimeter = cum[SAMPLES];

    const out: CircleSlot[] = [];
    for (let i = 1; i <= count; i++) {
      const target = ((i - 1) / count) * perimeter;
      let lo = 1;
      let hi = SAMPLES;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (cum[mid] < target) lo = mid + 1;
        else hi = mid;
      }
      const seg = cum[lo] - cum[lo - 1];
      const f = seg > 0 ? (target - cum[lo - 1]) / seg : 0;
      const ox = sx[lo - 1] + (sx[lo] - sx[lo - 1]) * f;
      const oy = sy[lo - 1] + (sy[lo] - sy[lo - 1]) * f;
      // 정규화 좌표 — 앵커/세로 시프트 판정에 쓴다.
      const nx = ox / rx;
      const ny = ryTry > 0 ? oy / ryTry : 0;
      // zig-zag stagger 는 두지 않는다. 각도 균등 분할이던 시절엔 모서리에서 점이 몰려
      // 필요했지만, 둘레 길이 균등 분할로 바꾼 뒤로는 슬롯 간격이 어디서나 일정해
      // 겹치지 않는다. 오히려 상/하단 행의 높이를 들쭉날쭉하게 만든다.
      const anchor = anchorFor(nx);
      const { x1, x2 } = flourishRange(anchor);
      out.push({
        i,
        x: ox,
        y: oy + yShiftFor(ny),
        anchor,
        delay: (baseDelay + i * 0.045).toFixed(2),
        flourishX1: x1,
        flourishX2: x2,
        flourishY: lineH + flourishGap,
      });
    }
    return out;
  }

  /** 라벨이 실제로 차지하는 세로 범위 (리더 줄 cap top ~ 플뢰리시). */
  function extentOf(sl: readonly CircleSlot[]): { top: number; bottom: number } {
    let top = Infinity;
    let bottom = -Infinity;
    for (const s of sl) {
      top = Math.min(top, s.y - base.fs);
      bottom = Math.max(bottom, s.y + lineH + flourishGap);
    }
    return { top, bottom };
  }

  // ry 결정 — band 가 주어지면 그 안에 딱 들어가는 최대 ry 를 이분탐색으로 찾는다.
  // 둘레 균등 분할·세로 시프트 때문에 세로 범위를 식으로 못 푸는 대신,
  // 실제 슬롯을 만들어 재보는 쪽이 커플 수·폰트가 어떻게 바뀌어도 어긋나지 않는다.
  let ry = base.ry * (opts.ryScale ?? 1);
  let cy = opts.cy ?? 430;
  if (opts.band) {
    const avail = opts.band[1] - opts.band[0];
    const heightAt = (r: number) => {
      const e = extentOf(buildSlots(r));
      return e.bottom - e.top;
    };
    if (heightAt(ry) > avail) {
      let lo = 20;
      let hi = ry;
      for (let k = 0; k < 18; k++) {
        const mid = (lo + hi) / 2;
        if (heightAt(mid) <= avail) lo = mid;
        else hi = mid;
      }
      ry = lo;
    }
    const e = extentOf(buildSlots(ry));
    // 남는 여백은 위아래로 반씩 나눠 세로 가운데 정렬.
    cy = opts.band[0] - e.top + (avail - (e.bottom - e.top)) / 2;
  }

  const tier: Tier = { ...base, rx, ry };
  const slots = buildSlots(ry).map((s) => ({
    ...s,
    x: Number((cx + s.x).toFixed(1)),
    y: Number((cy + s.y).toFixed(1)),
  }));

  return { cx, cy, fontSize: tier.fs, lineH, withNames, slots };
}
