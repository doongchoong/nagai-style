# 사용법

[English](USAGE.md) · **한국어**

1. [Claude 에게 부탁하기](#claude-에게-부탁하기)
2. [페이지 설정 (`build_page.py`)](#페이지-설정)
3. [라이브러리](#라이브러리)
4. [앨범 커버 생성기](#앨범-커버-생성기)
5. [이 저장소 작업하기](#이-저장소-작업하기)

## Claude 에게 부탁하기

먼저 스킬을 설치합니다 ([README](../README.ko.md#claude-에서-쓰기) 참고). 화가 이름을 말하지 않아도 히로시 나가이·시티팝 풍 장면을 원하는 것 같으면 Claude 가 이 스킬을 씁니다. 말한 내용을 구도 선택지로 옮기고, 말하지 않은 것은 시드에 맡겨 HTML 페이지 하나를 만든 뒤, 같은 장면을 다시 만들 수 있게 장면 코드를 알려 줍니다.

| 이렇게 말하면 | Claude 가 하는 일 |
|---|---|
| "나가이 히로시 풍으로 해질녘 수영장 리조트, 바람 세게" | `theme: resort`, `foreground: pool`, `sky: dusk`, 바람 세게 |
| "도시가 멀리 보이는 해안 도로 드라이브, 컨트롤 없이" | `theme: coastRoad`, `far: sea+city`, 컨트롤 끔 |
| "테라스에서 내려다보는 저녁 도시 불빛, 폰 배경화면" | `sky: violet`, 세로 9:16 |
| "블로그 글에 넣을 거야" | `layout: embed` + 붙여넣을 임베드 코드 |
| "시티팝 앨범 커버 만들어줘" | `layout: cover`, 커버 생성기 페이지 |
| "`83608-12 9:16 sky:violet` 장면 다시 열어줘" | 똑같은 장면 |
| "바다에 요트도 띄워줘" | 같은 빛·음영 규칙을 따르는 작은 새 객체 |

선택지로 바뀌는 말: 해변 / 리조트·호텔·가게 / 수영장 / 마당·생울타리 / 도로·드라이브 / 자동차·오픈카 / 담장 / 도시·빌딩·스카이라인 / 섬 / 해질녘·노을·분홍 하늘 / 저녁·밤·야경 / 한낮·쨍한 / 깊은 파랑 / 바람 많이 / 잔잔한 / 야자수 많이 / 야자수 한 쌍. 한국어·영어 모두 됩니다.

특정 그림이나 실제 앨범 커버는 재현하지 않고, 같은 분위기의 새 장면을 만듭니다. 자동차는 실제 차종이 아닌 일반형입니다.

## 페이지 설정

`skills/nagai-motion/scripts/build_page.py` 는 작은 JSON 파일을 HTML 페이지 하나로 만듭니다. 기본은 라이브러리를 통째로 품어서, 파일 하나만으로 어디서든 열립니다.

```bash
python3 skills/nagai-motion/scripts/build_page.py config.json out.html
```

```json
{
  "title": "해질녘 리조트",
  "seed": 1234,
  "force": { "theme": "resort", "foreground": "pool", "sky": "dusk" },
  "wind": 0.8,
  "aspect": "3:2",
  "layout": "fullscreen",
  "controls": true
}
```

| 키 | 값 | 기본 |
|---|---|---|
| `title` | 페이지 제목 | `나가이 히로시 스타일` |
| `seed` | 정수. 비우면 무작위 | 무작위 |
| `jitter` | 같은 구도에서 위치만 바꾸기 | `null` |
| `force` | 고정할 구도 선택지 ([구도 선택지](#구도-선택지) 참고) | `{}` |
| `wind` | `0` ~ `1.5` | `0.6` |
| `aspect` | `3:2` 가로 · `9:16` 세로 · `1:1` 정사각 · `auto` (세로로 긴 화면이면 9:16) | `3:2` |
| `layout` | `fullscreen` · `embed` (글 안에) · `cover` (앨범 커버 생성기) | `fullscreen` |
| `controls` | 컨트롤 패널 표시 | `true` |
| `ui` | 컨트롤 일부만: `{ "info", "random", "seed", "jitter", "wind", "pause", "pick", "aspect", "save", "palm", "lang" }` | `lang` 만 빼고 모두 켬 |
| `url_state` | 주소(`#nagai=…`)에 장면 담기 | `fullscreen` 이면 켬 |
| `palm_detail` | 야자수를 잎마다 정밀하게 (무거움). 기본은 가볍게(잎 도장) | `false` |
| `lang` | 컨트롤 언어: `ko` · `en` · `auto` (주소의 `?lang=` → 마지막으로 고른 언어 → 브라우저 언어). 한 / EN 전환 버튼은 `"ui": {"lang": true}` | `ko` |
| `lib_src` | 라이브러리를 품지 않고 링크로, 예: `"/nagai-scene.min.js"` (`?v=버전` 이 붙음) | 품기 |
| `description` | `<meta name="description">` | — |
| `head_html` | `<head>` 에 넣을 태그 (홈 화면 아이콘, manifest, theme-color …) | — |
| `caption` | `embed` 레이아웃의 그림 설명 | — |
| `extend_js` | 새 객체를 추가하는 자바스크립트 ([객체 추가하기](#객체-추가하기) 참고) | — |

## 라이브러리

`nagai-scene.js` (압축본 약 110 KB) 가 모든 것을 그립니다. 야자수, 바다와 파도, 덤불과 여러 식물(사이프러스, 용설란·유카, 파초), 자동차, 빌딩숲, 건물, 담장, 수영장, 구도 결정트리, 캔버스와 컨트롤까지. 의존성은 없습니다.

```html
<script src="https://cdn.jsdelivr.net/gh/doongchoong/nagai-style@main/skills/nagai-motion/assets/nagai-scene.min.js"></script>
```

실제 서비스에서는 `@main` 대신 커밋이나 태그로 고정하거나, 파일을 내 사이트에 복사해 쓰세요.

### mount

```js
const scene = NagaiScene.mount({
  canvas: '#art',            // 필수: 요소 또는 선택자. 높이를 안 정하면 3:2
  controls: '#ctl',          // 선택: 컨트롤 패널을 그릴 곳
  seed: 42, jitter: null,
  force: { theme: 'resort' },
  wind: 0.6,                 // 0 ~ 1.5
  windDir: null,             // 1 오른쪽, -1 왼쪽. null 이면 빛 반대쪽
  aspect: '3:2',             // '3:2' | '9:16' | '1:1' — 비율마다 구도를 새로 짠다
  autoplay: true, grain: true, maxPixelRatio: 2,
  fps: 30,                   // 초당 그리는 횟수. 움직임 속도는 시간 기준이라 그대로
  palmDetail: false,
  lang: 'ko',                // 'ko' | 'en' | 'auto' — 컨트롤 문구 언어
  urlState: false,           // #nagai=<장면 코드> 읽고 쓰기
  exportSize: null,          // { '3:2': [2400, 1600], '9:16': [1440, 2560], '1:1': [3000, 3000] }
  ui: {},                    // 컨트롤 끄기, 예: { save: false }. { lang: true } 면 한 / EN 전환 버튼
  extend: (spec, helpers) => spec,
  onChange: (state) => {},
});
```

화면 밖으로 나간 장면은 저절로 멈추므로 한 페이지에 여러 개 넣어도 됩니다.

### 조작 함수

`mount` 가 돌려주는 객체:

| 호출 | 하는 일 |
|---|---|
| `setSeed(n)`, `next()`, `prev()`, `randomize()` | 시드 바꾸기 |
| `randomMood('day' \| 'dusk' \| 'evening')` | 그 분위기 하늘이 나오는 무작위 시드 |
| `setForce({ 키: 값 \| null })`, `clearForce()` | 구도 선택지 고정·해제 |
| `shuffleLayout(j?)` | 같은 구도에서 위치만 바꾸기 |
| `setAspect('3:2' \| '9:16' \| '1:1')` | 비율 바꾸기 |
| `setWind(v)`, `play()`, `pause()`, `toggle()` | 움직임 |
| `setPalmDetail(bool)` | 야자수 가볍게 / 잎마다 |
| `lang`, `setLang('ko' \| 'en')` | 컨트롤 언어 읽기·바꾸기 (`lang: 'auto'` 페이지가 다음에 기억해서 씀) |
| `code`, `setCode('83608-12 9:16 sky:violet')` | 장면 코드 읽기·열기 |
| `shareText()` | 장면이 담긴 링크 (iframe 안에서는 장면 코드) |
| `savePNG()` | 지금 순간을 고해상도 PNG 로 내려받기 |
| `render(W, H)` | 지금 순간을 새 W×H 캔버스로 |
| `toPNG()` | 화면 캔버스의 data URL |
| `state`, `spec`, `destroy()` | 상태 보기·정리 |

### HTML 속성

```html
<canvas data-nagai data-seed="7" data-aspect="9:16" data-force='{"theme":"coastRoad"}' data-controls></canvas>
```

그 밖에 `data-controls="#id"`, `data-url-state`, `data-wind`, `data-jitter`, `data-autoplay="false"`, `data-grain="false"`, `data-lang="en"`.

### 장면 코드

장면 하나를 다시 만드는 데 필요한 것(시드, 위치 바꾸기 값, 비율, 고정한 선택지)을 한 줄로 적은 것입니다.

`83608` · `83608-12` · `83608-12 9:16 sky:violet theme:resort`

시드 칸에 붙여넣고 Enter 를 누르거나, `https://nagai-style.vercel.app/#nagai=83608-12%209:16` 주소로 엽니다. 컨트롤의 "복사" 는 단독 페이지에서는 링크를, iframe 안에서는 장면 코드를 복사합니다.

### 구도 선택지

| 키 | 값 |
|---|---|
| `theme` | `beach` 해변, `resort` 리조트, `poolside` 수영장 마당, `coastRoad` 해안 도로 |
| `far` | `sea`, `sea+city` 빌딩숲, `sea+island` 섬, `hedge` 생울타리 (poolside 만) |
| `focal` | `left`, `center`, `right` — 주인공 위치. 빛과 소실점이 따라갑니다 |
| `foreground` | beach: `car` / `empty` · resort: `pool` / `wall` / `car` · poolside: `pool` · coastRoad: `car` (도로 아래 공터에 세움) |
| `buildings` | resort: `1` / `2` · poolside: `0` / `1` |
| `palms` | `even` 고른 간격, `cluster` 무리, `pair` 한 쌍 (beach, coastRoad), `behind` 건물 뒤 (resort, poolside) |
| `sky` | `deep` 짙은 파랑, `bright` 맑음 (오후) · `dusk` 분홍 해질녘 · `violet` 연보라 저녁 (불 켜진 도시를 내려다봄) |

바닥 색은 하늘을 따라갑니다. 오후는 모래색, 해질녘은 산호빛, 저녁은 자줏빛. 오후 해변에는 부서지는 파도가 나옵니다. 테마에 없는 값은 무시되며, `NagaiScene.choiceOptions(theme)` 로 고를 수 있는 값을 볼 수 있습니다.

### 객체 추가하기

종류를 등록하고 장면 명세에 넣습니다. `NagaiScene.util` (`light`, `shadowOffset`, `fillPoly`, `mixColor`, `persp` …) 을 쓰면 새 객체도 장면과 같은 빛과 원근을 따릅니다.

```js
NagaiScene.registerKind('sailboat', {
  dynamic: true,                                   // 매 프레임 그림
  create: (item) => ({ phase: (item.seed % 100) / 10 }),
  draw(ctx, obj, item, W, time, wind) { /* item.x, item.y 에 그린다 */ },
});

function extendScene(spec) {                       // mount({ extend: extendScene }) 로 넘김
  const sea = spec.items.find((i) => i.kind === 'sea');
  spec.items.push({ kind: 'sailboat', phase: 'stand', y: sea.horizonY + 20, x: spec.width * 0.7, size: 40, seed: spec.seed });
  return spec;
}
```

그리는 순서는 `phase` (`back` → `sea` → `flat` → `pool` → `stand`), 그다음 `y` 입니다. 좌표는 1200×800 디자인 좌표입니다. 동작하는 요트 예시 전체와 화풍 규칙은 [`references/style-guide.md`](../skills/nagai-motion/references/style-guide.md) 에 있습니다.

## 앨범 커버 생성기

`"layout": "cover"` 로 커버 페이지를 만듭니다. 정사각 장면, 제목·아티스트·작은 글씨, 일본 LP 띠지, 레코드 슬리브 목업, 3000×3000 PNG 저장.

```json
{
  "layout": "cover",
  "title_page": "City Pop Cover",
  "mood": "dusk",
  "title": "Dalguojin Jungsuri",
  "artist": "Nagai Style",
  "small": "STEREO",
  "font": "script",
  "pos": "tl",
  "color": "#fbf7ef",
  "obi": false,
  "obiColor": "#d8343f",
  "music": { "src": "song.mp3", "title": "곡 제목", "artist": "아티스트" }
}
```

| 키 | 값 |
|---|---|
| `seed` / `mood` | 고정 시드, 또는 `day` · `dusk` · `evening` 으로 열 때마다 그 분위기의 무작위 장면 |
| `lang` | `ko` · `en` · `auto`. 제목 옆 한 / EN 버튼이 장면 컨트롤까지 같이 바꿉니다 |
| `font` | `script` (Yellowtail) · `modern` (Jost) · `serif` (Playfair Display) · `none` |
| `pos` | `tl`, `tc`, `tr`, `bl`, `bc`, `br` |
| `obi` | 일본 LP 띠지 두르기. 한글·일본어 제목은 세로로 쌓고 영문은 돌려 씁니다 |
| `music` | 커버 위에 옅은 재생 버튼이 생깁니다. 누르면 판이 33⅓ RPM 으로 돌고 톤암이 내려앉은 뒤 곡이 나옵니다. `src` 는 커버 페이지 기준 경로이며, 쓸 권리가 있는 곡만 넣으세요 |

띠지의 품번(`NGS-` + 시드)과 가격은 장식입니다.

## 이 저장소 작업하기

```bash
./build.sh   # 스킬에서 압축 라이브러리를 복사하고 index.html, cover/index.html 다시 만들기
./pack.sh    # claude.ai 용 dist/nagai-motion.skill 다시 묶기
```

`skills/nagai-motion/assets/nagai-scene.js` 를 고쳤다면:

1. 파일 안의 `version` 을 올립니다 (사이트가 `nagai-scene.min.js?v=<버전>` 으로 캐시를 새로 받습니다).
2. 압축본을 다시 만듭니다:
   `npx terser skills/nagai-motion/assets/nagai-scene.js --compress --mangle --comments '/^!/' --ecma 2020 -o skills/nagai-motion/assets/nagai-scene.min.js`
3. `./build.sh`, `./pack.sh` 를 실행하고 `.claude-plugin/marketplace.json` 의 `version` 도 맞춥니다.

Vercel 은 저장소 루트를 정적 사이트로 배포합니다. `.vercelignore` 가 `skills/`, `docs/`, `dist/`, 마크다운과 빌드 파일을 배포에서 뺍니다.
