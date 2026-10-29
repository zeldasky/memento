// 안드로이드 APK 만들기 — 디버그 서명(내 폰 시험 설치용).
// 순서: 버전 맞추기 → JDK 21 찾기 → 글꼴 복사 → cap sync → gradle assembleDebug → release/insaeng-<버전>.apk
// 필요한 것: JDK 21(JAVA_HOME 이 21 이 아니면 아래 JDK_CANDIDATES 를 찾아 본다), 안드로이드 SDK(%LOCALAPPDATA%\Android\Sdk)
// 실행: npm run android:apk
import { spawnSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT = resolve(import.meta.dirname, '..')
const ANDROID = join(ROOT, 'android')
const win = process.platform === 'win32'
const JDK_CANDIDATES = [process.env.JAVA_HOME, 'C:\\Users\\zelda\\golf-wt\\tools\\jdk21-x\\jdk-21.0.12.1+1'].filter(Boolean)

const fail = (msg) => { console.error(`\n${msg}`); process.exit(1) }
function run(cmd, args, opts = {}) {
  const line = [cmd, ...args].join(' ')
  console.log(`\n> ${line}`)
  const r = spawnSync(line, { cwd: ROOT, stdio: 'inherit', shell: true, ...opts })
  if (r.status !== 0) fail(`실패: ${line} (종료 코드 ${r.status})`)
}

// 1. 버전: package.json 의 version → versionName · versionCode · 사용자 에이전트(MET Norway 가 요구하는 앱 식별)
const version = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version
const [maj, min, pat] = version.split('.').map((n) => Number.parseInt(n, 10) || 0)
const versionCode = maj * 10000 + min * 100 + pat || 1
const capPath = join(ROOT, 'capacitor.config.json')
const cap = JSON.parse(readFileSync(capPath, 'utf8'))
const ua = `Insaeng/${version} (+https://github.com/zeldasky/memento)`
cap.android = { ...cap.android, appendUserAgent: ua }
cap.ios = { ...cap.ios, appendUserAgent: ua }
writeFileSync(capPath, `${JSON.stringify(cap, null, 2)}\n`)
const gradlePath = join(ANDROID, 'app', 'build.gradle')
writeFileSync(gradlePath, readFileSync(gradlePath, 'utf8')
  .replace(/versionCode \d+/, `versionCode ${versionCode}`)
  .replace(/versionName "[^"]*"/, `versionName "${version}"`))
console.log(`버전 ${version} (versionCode ${versionCode})`)

// 2. JDK 21 (Capacitor 8 의 gradle 은 21 에서 확인됨)
const javaMajor = (home) => {
  const r = spawnSync(`"${join(home, 'bin', win ? 'java.exe' : 'java')}" -version`, { shell: true, encoding: 'utf8' })
  return Number((`${r.stderr}${r.stdout}`.match(/version "(\d+)/) ?? [])[1] ?? 0)
}
const jdk = JDK_CANDIDATES.find((h) => existsSync(h) && javaMajor(h) === 21)
if (!jdk) fail(`JDK 21 을 찾지 못했어요. JAVA_HOME 을 JDK 21 폴더로 정해 주세요(찾아 본 곳: ${JDK_CANDIDATES.join(', ')})`)
console.log(`JDK: ${jdk}`)

const localProps = join(ANDROID, 'local.properties')
if (!existsSync(localProps)) {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(process.env.LOCALAPPDATA ?? '', 'Android', 'Sdk')
  if (!existsSync(sdk)) fail('안드로이드 SDK 를 찾지 못했어요. ANDROID_HOME 을 정해 주세요.')
  writeFileSync(localProps, `sdk.dir=${sdk.replace(/\\/g, '/')}\n`)
}

// 3. 글꼴 → 4. 웹 자원 동기화 → 5. APK
run('node', ['scripts/copy-fonts.mjs'])
run('npx', ['cap', 'sync', 'android'])
const out = join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk')
rmSync(out, { force: true })
run(win ? `"${join(ANDROID, 'gradlew.bat')}"` : './gradlew', ['assembleDebug', '--console=plain'], {
  cwd: ANDROID, env: { ...process.env, JAVA_HOME: jdk },
})
if (!existsSync(out)) fail('APK 가 만들어지지 않았어요.')

mkdirSync(join(ROOT, 'release'), { recursive: true })
const dest = join(ROOT, 'release', `insaeng-${version}.apk`)
copyFileSync(out, dest)
console.log(`\nAPK: ${dest} (${(statSync(dest).size / 1024 / 1024).toFixed(1)}MB, 디버그 서명)`)
