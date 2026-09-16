'use client';

// 보고 있는 결과 화면을 PNG 한 장으로 내려받는 버튼.
//
// 대회가 끝나면 운영팀이 결과를 인스타·카카오톡에 올린다. 지금까지는 화면을 스크린샷으로
// 찍어 잘라 붙였고, 그 과정에서 아래쪽 순위가 잘리거나 브라우저 주소창이 같이 찍혔다.
// 화면 그대로를 한 장으로 떠 주면 그 손질이 사라진다.
//
// 캡처에서 빼는 것: 탭 버튼과 이 버튼 자신(data-export-hide). 정지된 그림에 눌리지 않는
// 버튼이 남아 있으면 '왜 안 눌리지' 하는 그림이 된다.
import { useState } from 'react';

/** 캡처에서 제외할 표시 — 이 속성이 붙은 요소와 그 아래는 그림에 담기지 않는다. */
export const EXPORT_HIDE = 'data-export-hide';

/** 인스타그램 권장 가로. 이보다 좁게 올리면 피드에서 늘려 보여 주며 흐려진다. */
const IG_MIN_WIDTH = 1080;

/** 투명하지 않은(= 실제로 칠해진) 배경색인지. */
function isPainted(color: string): boolean {
  if (!color || color === 'transparent') return false;
  // rgba(...,0) 처럼 완전 투명이면 칠해지지 않은 것으로 본다.
  const m = /^rgba?\(([^)]+)\)$/.exec(color.trim());
  if (!m) return true;
  const parts = m[1].split(',').map((v) => Number(v.trim()));
  return !(parts.length === 4 && parts[3] === 0);
}

/** 캡처 배경색 — 화면에 실제로 보이는 배경을 그대로 쓴다.
 *  대상에서 위로 올라가며 처음 칠해진 배경을 찾고, 없으면 body/html, 그래도 없으면 검정.
 *  (고정값 흰색으로 뜨면 다크 화면의 밝은 글자가 흰 바탕에 묻혀 안 보인다.) */
function captureBackground(node: HTMLElement): string {
  for (let el: Element | null = node; el; el = el.parentElement) {
    const bg = getComputedStyle(el).backgroundColor;
    if (isPainted(bg)) return bg;
  }
  for (const el of [document.body, document.documentElement]) {
    if (!el) continue;
    const bg = getComputedStyle(el).backgroundColor;
    if (isPainted(bg)) return bg;
  }
  return '#000000';
}

export function SaveImageButton({
  targetRef,
  fileName,
  label = 'SAVE IMAGE',
}: {
  targetRef: React.RefObject<HTMLElement | null>;
  /** 확장자를 뺀 파일 이름. 예: 'JNJ-Cebu2026-champion' */
  fileName: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const node = targetRef.current;
    if (!node || busy) return;
    setBusy(true);
    setError(null);
    try {
      // 무거운 라이브러리라 누를 때 가져온다 — 결과만 보고 가는 사람에게는 받게 하지 않는다.
      const { toPng } = await import('html-to-image');

      const opts = {
        // 배경이 없으면 투명으로 떠서 어두운 앱에 올렸을 때 글자가 안 보인다.
        // 화면에 보이는 배경(다크 화면이면 검정)을 그대로 써야 게시 화면과 같은 그림이 된다.
        backgroundColor: captureBackground(node),
        // 인스타 권장 가로(1080px)를 밑돌지 않게 배율을 잡는다. 최소 2배는 유지 —
        // 데스크톱(1040px)에서는 2배로 충분하고, 폰(약 390px)에서는 3배까지 올라가야
        // 1080 을 넘긴다. 이게 없으면 폰에서 저장한 그림이 피드에서 흐릿하게 뜬다.
        pixelRatio: Math.max(2, Math.ceil(IG_MIN_WIDTH / Math.max(1, node.offsetWidth))),
        // 탭·버튼처럼 그림에 남으면 안 되는 것들을 걸러낸다.
        // 글자 노드에는 getAttribute 가 없으므로 Element 일 때만 본다(빼면 본문이 통째로 사라진다).
        filter: (node: HTMLElement) =>
          !(node instanceof Element) || node.getAttribute(EXPORT_HIDE) === null,
      };

      // Safari 는 첫 호출이 글꼴·이미지를 다 못 싣고 돌아오는 일이 있다(알려진 문제).
      // 결과가 눈에 띄게 작으면 한 번 더 뜬다 — 두 번째는 캐시가 채워져 있어 제대로 나온다.
      let url = await toPng(node, opts);
      if (url.length < 5000) url = await toPng(node, opts);

      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.png`;
      a.click();
    } catch {
      setError('이미지를 만들지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <span {...{ [EXPORT_HIDE]: '' }} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--jnj-space-2)' }}>
      <button type="button" className="res-save" onClick={save} disabled={busy}>
        {busy ? 'SAVING…' : label}
      </button>
      {error && (
        <span className="res-save-err" role="alert">{error}</span>
      )}
    </span>
  );
}
