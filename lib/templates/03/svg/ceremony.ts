// Design Ref: §11.1 — Ceremony 스크린 (결승 시상식)
// 레이아웃: 상단 중앙 1위 (리더 + 팔로워), 하단 좌 2위, 하단 우 3위.
// 벚꽃(sakura) 토글: TemplateRenderer가 .jnj-sakura에 .active 클래스를 토글해 보임/숨김.
//                    SMIL은 페이지 로드부터 계속 돌고, opacity로 가시성 제어.
import { shell, topHeader, hexagonFrame, sponsorRow } from './common';

// 결정적 의사난수 — 매 빌드마다 동일한 결과(스냅샷 안정성).
function seeded(i: number): number {
  const x = Math.sin(i * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

// 벚꽃 잎 색상 팔레트 (분홍·흰 톤)
const SAKURA_COLORS = [
  '#FFB7C5', // 벚꽃 핑크
  '#FFC0CB', // 핑크
  '#FFE4E1', // 미스티 로즈
  '#FFDAE9', // 라이트 핑크
  '#FFEEF2', // 매우 옅은 핑크
  '#FFFFFF', // 흰색
  '#FFC8DD', // 연분홍
  '#FFAFCC', // 진분홍
];

// 단일 벚꽃 잎 path — 5장이 모인 꽃잎 한 장(타원형 아몬드 모양).
// (0,0)이 중심, 위쪽이 잎 끝.
function petalPath(size: number): string {
  const s = size;
  return `M 0 ${-s} C ${s * 0.5} ${-s * 0.8}, ${s * 0.6} ${-s * 0.3}, ${s * 0.5} ${s * 0.2}
          C ${s * 0.3} ${s * 0.7}, 0 ${s}, 0 ${s}
          C 0 ${s}, ${-s * 0.3} ${s * 0.7}, ${-s * 0.5} ${s * 0.2}
          C ${-s * 0.6} ${-s * 0.3}, ${-s * 0.5} ${-s * 0.8}, 0 ${-s} Z`;
}

function sakuraFall(): string {
  // 일관성: 모든 잎의 낙하 시간 동일(DUR), 시간차를 균등 분포 → 균일한 밀도/속도.
  // 크기·sway·회전만 자연스러운 미세 변동.
  const count = 90;
  const DUR = 8;       // 모든 잎 낙하 시간 8초 (동일)
  const ROT_DUR = 4;   // 모든 잎 회전 주기 4초 (동일)
  let html = '';
  for (let i = 0; i < count; i++) {
    const x = seeded(i + 1) * 1280;
    // 시간차를 i/count × DUR로 균등 분포 → 한 잎이 떨어지는 동안 90개 균일하게 진입
    const delay = ((i / count) * DUR).toFixed(2);
    const size = 6 + seeded(i + 300) * 2; // 6~8 (변동 줄임)
    const rot = Math.floor(seeded(i + 500) * 360);
    const rotDir = i % 2 === 0 ? 1 : -1; // 짝수/홀수로 회전 방향 교대
    const color = SAKURA_COLORS[i % SAKURA_COLORS.length];
    const swayAmp = 60 + Math.floor(seeded(i + 700) * 20); // 60~80 (변동 좁힘)
    // SMIL은 페이지 로드부터 계속 돌고, 부모 그룹 opacity로 가시성 토글.
    const beginExpr = `${delay}s`;
    html += `
      <g transform="translate(${x.toFixed(1)} -20)">
        <animateTransform attributeName="transform" type="translate"
          values="${x.toFixed(1)} -20; ${(x + swayAmp).toFixed(1)} 180; ${(x - swayAmp).toFixed(1)} 400; ${(x + swayAmp * 0.5).toFixed(1)} 600; ${x.toFixed(1)} 760"
          dur="${DUR}s" begin="${beginExpr}" repeatCount="indefinite"/>
        <path d="${petalPath(size)}" fill="${color}" stroke="#F472B6" stroke-width="0.3" opacity="0">
          <animateTransform attributeName="transform" type="rotate"
            from="${rot}" to="${rot + 360 * rotDir}" dur="${ROT_DUR}s" begin="${beginExpr}" repeatCount="indefinite"/>
          <animate attributeName="opacity" values="0;0.95;0.95;0" keyTimes="0;0.06;0.92;1" dur="${DUR}s" begin="${beginExpr}" repeatCount="indefinite"/>
        </path>
      </g>`;
  }
  return html;
}

/**
 * 3위까지의 리더/팔로워를 시상대 형태로 배치.
 *   1위: 상단 중앙 (y=290)
 *   2위: 하단 좌 (y=510)
 *   3위: 하단 우 (y=510)
 * 화면 클릭 시 벚꽃이 떨어짐(SMIL 이벤트 트리거).
 */
export function ceremonySvg(): string {
  // 1·2·3위 헥사곤 사진 크기 — 1위는 크게, 2·3위는 살짝 줄여 위계를 또렷이.
  // 하단 스폰서 광고(디바이더 y=628, 로고 y=666)와 겹치지 않도록 2·3위 블록 전체를 상향.
  const HEX_1ST = 80;
  const HEX_RUNNER = 58;
  const NAME_1ST = 24;
  const NAME_RUNNER = 17;

  const firstY = 280;
  const firstLeaderX = 540;
  const firstFollowerX = 740;

  // secondY 494 + HEX_RUNNER 58 → 이름 baseline ≈ 593, 디바이더(628)까지 ~35px 여백 확보.
  const secondY = 494;
  const secondLeaderX = 230;
  const secondFollowerX = 410;

  const thirdLeaderX = 870;
  const thirdFollowerX = 1050;

  // 차분한 순위 라벨 — 필 배지 제거, 이탤릭 세리프 + 양옆 얇은 선으로 우아하게.
  const rankLabel = (cx: number, cy: number, text: string, fontSize = 16, color = '#D4AF37') => {
    const halfTxt = fontSize * (text.length + 1);
    const lineGap = 22;
    return `
      <g transform="translate(${cx} ${cy})">
        <line x1="${-halfTxt - lineGap}" y1="0" x2="${-lineGap / 2}" y2="0" stroke="${color}" stroke-width="0.5" opacity="0.55"/>
        <line x1="${lineGap / 2}" y1="0" x2="${halfTxt + lineGap}" y2="0" stroke="${color}" stroke-width="0.5" opacity="0.55"/>
        <text x="0" y="${fontSize * 0.35}" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="${fontSize}" letter-spacing="${fontSize * 0.5}" fill="${color}" opacity="0.9">${text}</text>
      </g>
    `;
  };

  const leader1 = hexagonFrame(firstLeaderX, firstY, `{{champ_leader_1}}`, HEX_1ST, 0, NAME_1ST, `{{champ_leader_num_1}}`, `{{champ_leader_photo_1}}`);
  const follower1 = hexagonFrame(firstFollowerX, firstY, `{{champ_follower_1}}`, HEX_1ST, 0.1, NAME_1ST, `{{champ_follower_num_1}}`, `{{champ_follower_photo_1}}`);
  const leader2 = hexagonFrame(secondLeaderX, secondY, `{{champ_leader_2}}`, HEX_RUNNER, 0.3, NAME_RUNNER, `{{champ_leader_num_2}}`, `{{champ_leader_photo_2}}`);
  const follower2 = hexagonFrame(secondFollowerX, secondY, `{{champ_follower_2}}`, HEX_RUNNER, 0.4, NAME_RUNNER, `{{champ_follower_num_2}}`, `{{champ_follower_photo_2}}`);
  const leader3 = hexagonFrame(thirdLeaderX, secondY, `{{champ_leader_3}}`, HEX_RUNNER, 0.5, NAME_RUNNER, `{{champ_leader_num_3}}`, `{{champ_leader_photo_3}}`);
  const follower3 = hexagonFrame(thirdFollowerX, secondY, `{{champ_follower_3}}`, HEX_RUNNER, 0.6, NAME_RUNNER, `{{champ_follower_num_3}}`, `{{champ_follower_photo_3}}`);

  return shell(`
    <style>
      /* 벚꽃 토글 — display로 SMIL을 실제로 중지/재개. */
      /* OFF (기본): display:none → 애니메이션 일시정지, 잎 사라짐 (떨어지지 않음) */
      /* ON (.active): display:inline → 잎이 다시 떨어지기 시작 */
      .jnj-sakura {
        display: none;
      }
      .jnj-sakura.active {
        display: inline;
      }
    </style>

    ${topHeader()}

    <text x="640" y="146" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="46" letter-spacing="12" fill="url(#goldg)">{{ceremony_title}}</text>
    <text x="640" y="178" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="17" letter-spacing="6" fill="#E8E6DA" opacity="0.9">{{ceremony_subtitle}}</text>

    ${rankLabel((firstLeaderX + firstFollowerX) / 2, firstY - HEX_1ST - 22, '1ST', 18, '#D4AF37')}
    ${leader1}
    ${follower1}

    ${rankLabel((secondLeaderX + secondFollowerX) / 2, secondY - HEX_RUNNER - 22, '2ND', 14, '#B5B5C0')}
    ${leader2}
    ${follower2}

    ${rankLabel((thirdLeaderX + thirdFollowerX) / 2, secondY - HEX_RUNNER - 22, '3RD', 14, '#B08060')}
    ${leader3}
    ${follower3}

    <!-- 벚꽃 — SMIL은 계속 돌지만 .jnj-sakura의 opacity로 가시성 토글 -->
    <g class="jnj-sakura" pointer-events="none">${sakuraFall()}</g>

    <!-- Sponsor showcase — Grand Final 시상식 하단 광고 영역
         · 얇은 골드 디바이더로 본문/광고 시각적 분리
         · 6슬롯 로고: 박스 150×52, 간격 32 → 좌우 균등 정렬 (총 폭 1060) -->
    <g transform="translate(640 628)">
      <line x1="-400" y1="0" x2="400" y2="0" stroke="url(#goldgh)" stroke-width="0.5" opacity="0.55"/>
    </g>
    ${sponsorRow(666, 150, 52, 32)}
  `);
}
