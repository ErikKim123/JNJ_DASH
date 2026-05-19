// 사진 URL 정규화 + 폴백 — 클라이언트/서버 양쪽에서 사용.
//
// Google Drive 공유 링크는 hotlink 차단되므로 lh3.googleusercontent.com CDN 으로 변환해야
// 외부 페이지(SVG 표출 화면 포함)에서 임베드 가능.

export function normalizePhotoUrl(raw: string | null | undefined): string {
  if (!raw) return '';
  let v = raw.trim();
  if (!v) return '';

  // =IMAGE("url", ...) 수식 텍스트가 들어왔을 때
  const m = v.match(/^=IMAGE\(\s*["']([^"']+)["']/i);
  if (m) v = m[1];

  // Google Drive 다양한 공유 형식 → lh3 CDN
  if (v.includes('drive.google.com')) {
    const fileIdMatch =
      v.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ?? v.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (fileIdMatch) {
      return `https://lh3.googleusercontent.com/d/${fileIdMatch[1]}`;
    }
  }

  if (!/^(https?:\/\/|data:image\/)/i.test(v)) return '';
  return v;
}

/**
 * row.photo_url → meta.사진원본 → meta.사진 → '' 순으로 시도. 각각 normalize.
 */
export function resolvePhotoUrl(row: {
  photo_url?: string | null;
  meta?: Record<string, unknown> | null;
}): string {
  const candidates = [
    row.photo_url ?? '',
    (row.meta?.['사진원본'] ?? '') as string,
    (row.meta?.['사진'] ?? '') as string,
  ];
  for (const c of candidates) {
    const n = normalizePhotoUrl(typeof c === 'string' ? c : '');
    if (n) return n;
  }
  return '';
}
