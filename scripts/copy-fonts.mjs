// 글꼴을 앱 안(www/fonts)에 넣는다 — 인터넷 없이도 같은 글꼴, 외부 CDN 의존 없음.
// Noto Serif KR(300·500, 한글+라틴) · Pretendard(400·600, KS X 1001 서브셋). 둘 다 SIL OFL 1.1 → 라이선스 파일을 같이 둔다.
// 실행: npm run fonts (make-apk 가 알아서 부른다)
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const NM = join(ROOT, 'node_modules')
const OUT = join(ROOT, 'www', 'fonts')
mkdirSync(OUT, { recursive: true })

const css = []

// Noto Serif KR: fontsource 의 korean-300.css 같은 파일에서 블록을 가져와 주소를 고친다
const serif = join(NM, '@fontsource', 'noto-serif-kr')
for (const w of [300, 500]) {
  for (const subset of ['korean', 'latin']) {
    // 라틴 범위는 300.css 같은 묶음 파일에만 적혀 있다. 한글 파일은 범위 없이 — 라틴을 뒤에 두면 라틴 글자는 라틴 파일이 먼저 잡는다
    const file = `noto-serif-kr-${subset}-${w}-normal.woff2`
    const block = readFileSync(join(serif, `${w}.css`), 'utf8').split('@font-face').find((b) => b.includes(file))
    const range = block?.match(/unicode-range:\s*([^;]+);/)?.[1]
    copyFileSync(join(serif, 'files', file), join(OUT, file))
    css.push(`@font-face {
  font-family: 'Noto Serif KR';
  font-style: normal;
  font-weight: ${w};
  font-display: swap;
  src: url(./${file}) format('woff2');${range ? `\n  unicode-range: ${range};` : ''}
}`)
  }
}
copyFileSync(join(serif, 'LICENSE'), join(OUT, 'LICENSE-NotoSerifKR.txt'))

// Pretendard
const pre = join(NM, 'pretendard', 'dist', 'web', 'static', 'woff2-subset')
for (const [w, name] of [[400, 'Regular'], [600, 'SemiBold']]) {
  const file = `Pretendard-${name}.subset.woff2`
  copyFileSync(join(pre, file), join(OUT, file))
  css.push(`@font-face {
  font-family: 'Pretendard';
  font-weight: ${w};
  font-display: swap;
  src: url(./${file}) format('woff2');
}`)
}
copyFileSync(join(NM, 'pretendard', 'dist', 'LICENSE.txt'), join(OUT, 'LICENSE-Pretendard.txt'))

writeFileSync(join(OUT, 'fonts.css'), `/* scripts/copy-fonts.mjs 가 만든다 — 고치지 말 것 */\n${css.join('\n')}\n`)
console.log(`글꼴 ${css.length}개 → ${OUT}`)
