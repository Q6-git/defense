import { SPRITES, SVG_RESOLUTION } from './sprites';

/**
 * 그림 파일을 미리 받아서 검사한 뒤, 쓸 수 있는 것만 blob URL로 돌려준다.
 * Phaser의 SVG 로더는 SVG가 아닌 응답(없는 파일에 대해 서버가 HTML을 돌려주는 경우 등)을 받으면
 * 게임 전체가 멈추기 때문에, 직접 검사해서 깨진 파일은 건너뛴다 (그 그림은 이모지로 그려진다).
 */
export async function prepareSprites(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    Object.entries(SPRITES).map(async ([key, file]) => {
      try {
        const res = await fetch(`sprites/${file}`);
        if (!res.ok) return;
        if (file.endsWith('.svg')) {
          const src = await res.text();
          const open = src.match(/<svg\b[^>]*>/);
          if (!open) return;
          // 루트 태그에 크기를 박아 넣어야 브라우저마다 같은 해상도로 그려진다
          const sized = open[0].replace(/\s(width|height)="[^"]*"/g, '').replace('<svg', `<svg width="${SVG_RESOLUTION}" height="${SVG_RESOLUTION}"`);
          out[key] = URL.createObjectURL(new Blob([src.replace(open[0], sized)], { type: 'image/svg+xml' }));
        } else {
          const blob = await res.blob();
          if (!blob.type.startsWith('image/')) return;
          out[key] = URL.createObjectURL(blob);
        }
      } catch {
        /* 못 받은 그림은 이모지로 */
      }
    }),
  );
  return out;
}

/** main.ts가 게임을 만들기 전에 채워 둔다 */
export const spriteUrls: Record<string, string> = {};
