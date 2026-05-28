// Design Ref: §11.1 #6 — Grand Final 전용 스크린 (Prep / Wrapup / Result / Pairing*)
// *Pairing은 라우트 레벨에서 차단되지만 폴백 표시용으로 유지
import { shell, heroHeader, topHeader, citiesFooter, bottomSeal, hexagonFrame, trophyIcon, sponsorRow } from './common';

export function finalPrepSvg(): string {
  const rays = Array.from({ length: 16 })
    .map((_, i) => {
      const ang = (i * 22.5) * Math.PI / 180;
      const isLong = i % 2 === 0;
      const r1 = 78;
      const r2 = isLong ? 124 : 98;
      const w = isLong ? 1.4 : 0.7;
      const x1 = (Math.cos(ang) * r1).toFixed(1);
      const y1 = (Math.sin(ang) * r1).toFixed(1);
      const x2 = (Math.cos(ang) * r2).toFixed(1);
      const y2 = (Math.sin(ang) * r2).toFixed(1);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#goldg)" stroke-width="${w}"/>`;
    })
    .join('');

  return shell(`
    ${heroHeader()}

    <text x="640" y="288" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="20" letter-spacing="10" fill="#FFD56B">{{stage_label}}</text>

    <g transform="translate(640 380)">
      <circle r="100" fill="url(#sgw)" opacity="0.35"/>
      <g opacity="0.55">
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="36s" repeatCount="indefinite"/>
        ${rays}
      </g>
      <g>
        <animateTransform attributeName="transform" type="translate" values="0 0; 0 -5; 0 0" dur="3.2s" repeatCount="indefinite"/>
        <g fill="url(#goldg)">
          <animate attributeName="opacity" values="0.92;1;0.92" dur="2.6s" repeatCount="indefinite"/>
          <path d="M -64 24 L -64 -8 L -40 18 L -20 -32 L 0 16 L 20 -32 L 40 18 L 64 -8 L 64 24 Z"/>
          <rect x="-68" y="24" width="136" height="14"/>
          <circle cx="-64" cy="-12" r="5"/>
          <circle cx="0" cy="-38" r="6"/>
          <circle cx="64" cy="-12" r="5"/>
        </g>
        <g fill="#0F2C20">
          <circle cx="-30" cy="32" r="2"/>
          <circle cx="0" cy="32" r="2"/>
          <circle cx="30" cy="32" r="2"/>
        </g>
      </g>
      <g fill="#FFEBA0">
        <circle cx="-92" cy="-44" r="2">
          <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0s" repeatCount="indefinite"/>
        </circle>
        <circle cx="98" cy="-30" r="1.8">
          <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0.6s" repeatCount="indefinite"/>
        </circle>
        <circle cx="-110" cy="20" r="1.6">
          <animate attributeName="opacity" values="0;1;0" dur="2s" begin="1.2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="106" cy="44" r="1.6">
          <animate attributeName="opacity" values="0;1;0" dur="2s" begin="0.4s" repeatCount="indefinite"/>
        </circle>
        <circle cx="0" cy="-72" r="2.2">
          <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="0.9s" repeatCount="indefinite"/>
        </circle>
        <circle cx="-50" cy="60" r="1.4">
          <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="1.5s" repeatCount="indefinite"/>
        </circle>
        <circle cx="56" cy="64" r="1.4">
          <animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="0.2s" repeatCount="indefinite"/>
        </circle>
      </g>
    </g>

    <text x="640" y="510" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="76" letter-spacing="12" fill="url(#goldg)">{{round_title}}</text>
    <text x="640" y="552" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="20" letter-spacing="14" fill="#E8E6DA" opacity="0.85">{{round_subtitle}}</text>

    <g transform="translate(640 594)">
      <line x1="-300" y1="0" x2="-110" y2="0" stroke="url(#goldgh)" stroke-width="0.7"/>
      <line x1="110" y1="0" x2="300" y2="0" stroke="url(#goldgh)" stroke-width="0.7"/>
      <text text-anchor="middle" y="6" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="15" letter-spacing="6" fill="#D4AF37">{{participants}}</text>
    </g>

    ${citiesFooter(620)}
    ${sponsorRow()}
  `);
}

export function finalWrapupSvg(): string {
  const rays = Array.from({ length: 16 })
    .map((_, i) => {
      const ang = (i * 22.5) * Math.PI / 180;
      const isLong = i % 2 === 0;
      const r1 = 76;
      const r2 = isLong ? 116 : 94;
      const w = isLong ? 1.4 : 0.7;
      const x1 = (Math.cos(ang) * r1).toFixed(1);
      const y1 = (Math.sin(ang) * r1).toFixed(1);
      const x2 = (Math.cos(ang) * r2).toFixed(1);
      const y2 = (Math.sin(ang) * r2).toFixed(1);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="url(#goldg)" stroke-width="${w}"/>`;
    })
    .join('');
  const studs = Array.from({ length: 12 })
    .map((_, i) => {
      const ang = (i * 30) * Math.PI / 180;
      const x = (Math.cos(ang) * 72).toFixed(1);
      const y = (Math.sin(ang) * 72).toFixed(1);
      return `<circle cx="${x}" cy="${y}" r="2"/>`;
    })
    .join('');

  return shell(`
    ${topHeader()}
    <text x="640" y="160" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="22" letter-spacing="10" fill="#FFD56B">{{stage_label}}</text>

    <text x="640" y="270" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="62" letter-spacing="6" fill="url(#goldg)">{{wrap_title}}</text>
    <text x="640" y="316" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-size="24" letter-spacing="14" fill="#E8E6DA" opacity="0.9">{{wrap_subtitle}}</text>

    <g transform="translate(640 450)">
      <circle r="92" fill="url(#sgw)" opacity="0.45"/>
      <g opacity="0.55">
        <animateTransform attributeName="transform" type="rotate" from="0" to="360" dur="22s" repeatCount="indefinite"/>
        ${rays}
      </g>
      <circle r="72" fill="#0F2C20" stroke="url(#goldg)" stroke-width="2.4"/>
      <circle r="62" fill="none" stroke="#D4AF37" stroke-width="0.6" opacity="0.6"/>
      <g fill="url(#goldg)">${studs}</g>
      <g fill="url(#goldg)">
        <animateTransform attributeName="transform" type="rotate" from="0" to="-360" dur="36s" repeatCount="indefinite"/>
        <path d="M 0 -42 L 10 -14 L 40 -14 L 16 4 L 25 32 L 0 16 L -25 32 L -16 4 L -40 -14 L -10 -14 Z"/>
        <circle r="6" fill="#FFFAE0"/>
      </g>
    </g>

    <g fill="#FFEBA0" transform="translate(640 450)">
      <circle cx="-130" cy="-60" r="2"><animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="0s" repeatCount="indefinite"/></circle>
      <circle cx="138" cy="-46" r="1.6"><animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="0.5s" repeatCount="indefinite"/></circle>
      <circle cx="-148" cy="36" r="1.6"><animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="1s" repeatCount="indefinite"/></circle>
      <circle cx="142" cy="62" r="1.4"><animate attributeName="opacity" values="0;1;0" dur="1.8s" begin="0.3s" repeatCount="indefinite"/></circle>
    </g>

    <g transform="translate(640 558)" fill="#FFD56B">
      <circle cx="-32" cy="0" r="5"><animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" begin="0s" repeatCount="indefinite"/></circle>
      <circle cx="0" cy="0" r="5"><animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" begin="0.2s" repeatCount="indefinite"/></circle>
      <circle cx="32" cy="0" r="5"><animate attributeName="opacity" values="0.3;1;0.3" dur="1.4s" begin="0.4s" repeatCount="indefinite"/></circle>
    </g>
    <text x="640" y="606" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="15" letter-spacing="4" fill="#9A98A8">{{wrap_message}}</text>

    ${bottomSeal(620)}
    ${sponsorRow()}
  `);
}

export function finalResultSvg(): string {
  const champCol = (xCenter: number, side: 'L' | 'F'): string => {
    const prefix = side === 'L' ? 'champ_leader' : 'champ_follower';
    const sideLabel = side === 'L' ? '{{label_leader}}' : '{{label_follower}}';
    const dly = side === 'L' ? 0 : 0.08;
    return `
      <g transform="translate(${xCenter} 0)">
        <text x="0" y="378" text-anchor="middle" font-family="ui-monospace, monospace" font-size="22" font-weight="600" letter-spacing="8" fill="#D4AF37">${sideLabel}</text>
        <line x1="-130" y1="396" x2="130" y2="396" stroke="url(#goldgh)" stroke-width="0.6"/>

        <g class="jnj-reveal" data-reveal-id="${side}-2">
          ${hexagonFrame(-105, 502, `{{${prefix}_2}}`, 36, dly + 0.45, 16, `{{${prefix}_num_2}}`, `{{${prefix}_photo_2}}`)}
          <text x="-105" y="600" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" letter-spacing="5" fill="#C0C0C8">2ND</text>
        </g>

        <g class="jnj-reveal" data-reveal-id="${side}-1">
          <g transform="translate(0 432)">
            <g fill="url(#goldg)">
              <animate attributeName="opacity" values="0.85;1;0.85" dur="2.6s" repeatCount="indefinite"/>
              <path d="M -28 8 L -28 -8 L -14 8 L 0 -18 L 14 8 L 28 -8 L 28 8 Z"/>
              <rect x="-30" y="8" width="60" height="5"/>
              <circle cx="-28" cy="-12" r="2.5"/>
              <circle cx="0" cy="-22" r="3"/>
              <circle cx="28" cy="-12" r="2.5"/>
            </g>
          </g>
          ${hexagonFrame(0, 502, `{{${prefix}_1}}`, 52, dly + 0.2, 20, `{{${prefix}_num_1}}`, `{{${prefix}_photo_1}}`)}
          <text x="0" y="624" text-anchor="middle" font-family="ui-monospace, monospace" font-size="11" letter-spacing="6" fill="#FFD56B">1ST</text>
        </g>

        <g class="jnj-reveal" data-reveal-id="${side}-3">
          ${hexagonFrame(105, 502, `{{${prefix}_3}}`, 36, dly + 0.65, 16, `{{${prefix}_num_3}}`, `{{${prefix}_photo_3}}`)}
          <text x="105" y="600" text-anchor="middle" font-family="ui-monospace, monospace" font-size="10" letter-spacing="5" fill="#B07050">3RD</text>
        </g>
      </g>
    `;
  };

  return shell(`
    <style>
      .jnj-reveal {
        opacity: 0;
        transform-box: fill-box;
        transform-origin: center;
      }
      /* 이미 발표된 항목 — 정적 가시 상태(애니메이션 없음) */
      .jnj-reveal.revealed {
        opacity: 1;
      }
      /* 방금 클릭으로 새로 발표된 항목만 keyframe 애니메이션 재생 */
      .jnj-reveal.reveal-anim {
        will-change: transform, opacity, filter;
        animation: jnj-reveal-pop 1250ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                   jnj-reveal-glow 1800ms ease-out forwards;
      }
      @keyframes jnj-reveal-pop {
        0%   { opacity: 0; transform: translateY(110px) scale(0.35) rotate(-16deg); }
        25%  { opacity: 1; transform: translateY(-26px)  scale(1.24) rotate(6deg); }
        45%  {              transform: translateY(10px)   scale(0.92) rotate(-3deg); }
        62%  {              transform: translateY(-6px)   scale(1.06) rotate(2deg); }
        80%  {              transform: translateY(2px)    scale(0.985) rotate(-0.6deg); }
        100% { opacity: 1; transform: translateY(0)      scale(1)    rotate(0deg); }
      }
      /* 강화된 글로우 — 흰 코어 + 골드 헤일로 이중 레이어 + 채도 부스트 */
      @keyframes jnj-reveal-glow {
        0%   { filter: brightness(4) saturate(2.2) contrast(1.15)
                       drop-shadow(0 0 0 rgba(255,255,255,0))
                       drop-shadow(0 0 0 rgba(255,213,107,0)); }
        12%  { filter: brightness(3.4) saturate(2.0) contrast(1.15)
                       drop-shadow(0 0 28px rgba(255,255,255,1))
                       drop-shadow(0 0 80px rgba(255,213,107,1)); }
        28%  { filter: brightness(2.6) saturate(1.7) contrast(1.1)
                       drop-shadow(0 0 50px rgba(255,255,255,0.85))
                       drop-shadow(0 0 110px rgba(255,213,107,0.95)); }
        50%  { filter: brightness(1.7) saturate(1.3) contrast(1.05)
                       drop-shadow(0 0 30px rgba(255,255,255,0.45))
                       drop-shadow(0 0 70px rgba(255,213,107,0.7)); }
        75%  { filter: brightness(1.25) saturate(1.1) contrast(1)
                       drop-shadow(0 0 14px rgba(255,213,107,0.4)); }
        100% { filter: brightness(1) saturate(1) contrast(1)
                       drop-shadow(0 0 0 rgba(255,213,107,0)); }
      }
    </style>

    ${heroHeader()}

    <text x="640" y="296" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="54" letter-spacing="12" fill="url(#goldg)">{{result_title}}</text>
    <text x="640" y="328" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="15" letter-spacing="6" fill="#E8E6DA" opacity="0.9">{{result_subtitle}}</text>

    ${trophyIcon(640, 488, 0.95)}

    ${champCol(280, 'L')}
    ${champCol(1000, 'F')}

    ${citiesFooter()}
  `);
}

// 결승 Pairing — 심사위원과 결승 진출자가 함께 추는 인비테이셔널 댄스 시간.
// 시적 부제 + 떠다니는 스파클로 분위기를 연출. 하단은 PREP 과 동일한 스폰서 광고 로고 6개.
function pairingSparkles(cx: number, cy: number, count: number): string {
  let body = '';
  for (let i = 0; i < count; i++) {
    const angle = (i * (360 / count)) * Math.PI / 180;
    const radius = 200 + ((i * 37) % 70);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius * 0.55;
    const delay = ((i * 0.31) % 3).toFixed(2);
    const r = (1.2 + ((i * 0.7) % 1.5)).toFixed(1);
    body += `
      <circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="#FFEBA0">
        <animate attributeName="opacity" values="0;1;0" dur="3.4s" begin="${delay}s" repeatCount="indefinite"/>
      </circle>`;
  }
  return `<g opacity="0.7">${body}</g>`;
}

export function finalPairingSvg(): string {
  return shell(`
    ${topHeader()}

    <text x="640" y="216" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-style="italic" font-size="22" letter-spacing="10" fill="#FFD56B">{{stage_label}}</text>

    <g transform="translate(640 420)">
      <circle r="320" fill="url(#sgw)" opacity="0.28"/>
      <circle r="200" fill="url(#sgw)" opacity="0.18"/>
    </g>

    ${pairingSparkles(640, 420, 18)}

    <g>
      <animate attributeName="opacity" values="0.92;1;0.92" dur="3s" repeatCount="indefinite"/>
      <text x="640" y="438" text-anchor="middle" font-family="'Cinzel', 'Cormorant Garamond', Georgia, 'Gulim', '굴림', serif" font-weight="bold" font-size="118" letter-spacing="24" fill="url(#goldg)">{{round_title}}</text>
    </g>

    <g transform="translate(640 502)">
      <line x1="-240" y1="0" x2="-32" y2="0" stroke="url(#goldgh)" stroke-width="0.7"/>
      <line x1="32" y1="0" x2="240" y2="0" stroke="url(#goldgh)" stroke-width="0.7"/>
      <g fill="#D4AF37">
        <circle cx="-14" cy="0" r="1.6" opacity="0.55"/>
        <circle cx="0" cy="0" r="2.2"/>
        <circle cx="14" cy="0" r="1.6" opacity="0.55"/>
      </g>
    </g>

    <text x="640" y="552" text-anchor="middle" font-family="'Cormorant Garamond', Georgia, serif" font-style="italic" font-size="16" letter-spacing="5" fill="#D4AF37" opacity="0.9">
      Where the judges share the floor with the finalists
    </text>

    ${citiesFooter(620)}
    ${sponsorRow()}
  `);
}
