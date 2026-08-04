// SVG 내부 id(clipPath / gradient / use href) 생성기.
//
// 예전에는 모듈 스코프 카운터(`let n = 0; id = \`x-${++n}\``)로 만들었는데, 이게
// hydration mismatch 의 원인이었다: 서버 모듈과 클라이언트 모듈의 카운터 시작값이 달라
// 같은 화면인데도 SSR HTML 과 CSR HTML 의 id 가 어긋난다
// (특히 TemplatePicker 처럼 한 화면에서 여러 템플릿을 미리보기로 찍을 때 확실히 벌어진다).
//
// 그래서 id 를 "그 요소의 좌표/크기" 같은 입력값에서 결정론적으로 만든다.
// 같은 SVG 안에서 같은 좌표·크기의 도형이 둘 이상 나오는 경우는 없으므로 충돌하지 않고,
// 렌더 순서·횟수와 무관하게 항상 같은 문자열이 나온다.
export function svgId(prefix: string, ...parts: Array<string | number>): string {
  const tail = parts
    .map((p) =>
      typeof p === 'number'
        ? p.toFixed(2).replace('-', 'n').replace('.', '_')
        : String(p).replace(/[^A-Za-z0-9_-]/g, '')
    )
    .join('-');
  return tail ? `${prefix}-${tail}` : prefix;
}
