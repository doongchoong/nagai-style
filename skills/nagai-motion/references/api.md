# NagaiScene API 와 구도 선택지

## 목차
1. 구도 선택지 (force 값)
2. 요청 문장 → 선택지 매핑
3. mount 옵션
4. 조작 함수
5. HTML 속성만으로 넣기

## 1. 구도 선택지 (force 값)

| 키 | 값 | 비고 |
|---|---|---|
| theme | `beach` 해변, `resort` 리조트, `poolside` 수영장 마당, `coastRoad` 해안 도로 | 나머지 선택지가 테마에 따라 달라짐 |
| far | `sea`, `sea+city`(먼 빌딩숲), `sea+island`, `hedge`(생울타리) | hedge 는 poolside 만 |
| (자동) 부서지는 파도 | 오후(deep·bright) + beach 일 때 | 불규칙한 짧은 획·점의 흰 마루선 → 짙은 파란 벽과 흰 입술로 말림 → 작은 원이 빽빽한 흰 거품 + 물보라. 파도마다 모양을 고른다: A자(가운데 정점에서 말림이 둘로 갈라져 양쪽으로, 사이는 거품) 50%, 왼쪽·오른쪽 한쪽 파도 각 25%. 말리는 곳이 옆으로 옮겨 가고(약 11~14초), 끝나면 다음 파도가 자란다. 거품은 성능을 위해 파도마다 한 번 그려 둔 띠를 잘라 붙인다 |
| (자동) 식물 | 모든 장면 | 덤불 자리의 일부에 파초(바나나 잎, 바람에 흔들림)·용설란·유카·사이프러스가 대신 선다. 건물 옆에 사이프러스(건물보다 키 큼)나 처마 밑 파초, 해변 모래밭과 해안 도로 공터에 용설란·유카 무리, 수영장 옆 갑판 안쪽에 화분(토분·흰 화분). 덤불 꽃 색은 장면마다 한 가지 (분홍이 가장 흔하고 빨강·흰색·노랑·보라). 따로 굴린 난수라 다른 배치는 그대로. 해질녘·저녁엔 덤불처럼 어둡게 |
| focal | `left`, `center`, `right` | 주인공 위치. 빛·소실점도 따라감 |
| foreground | beach: `car`/`empty` · resort: `pool`/`wall`/`car` · poolside: `pool` · coastRoad: `car` (도로 아래 공터에 세운다) | 자동차는 곡면 3D 모형(둥근 차체, 위로 좁아지는 캐빈, 감싸는 앞유리, 끝을 감싸 도는 크롬 범퍼)을 조금 위에서 본 3/4 각도로, 쿠페·오픈카·세단. pool 은 가로로 넓고 얕은 원근 사각형 (화면 폭의 약 60~75%) + 둘레 단색 갑판(오후 흰색·해질녘 연분홍·저녁 연어빛), 넓게 빈 쪽 옆 갑판에 실루엣 수준의 선베드 두 개가 앞뒤로, 발 쪽이 수영장을 향하게(85%, 색은 하늘에 맞춤). 선베드 모양·크기는 LOUNGER 고정 치수라 어떤 비율에서도 같다. 낮: 하늘색 물 + 윤슬, 연보라 저녁: 먼 쪽 파랑 → 가까운 쪽 남색 물 + 뒤쪽 풍경의 옅은 잔상 + 가로 물결 줄 |
| buildings | resort: `1`/`2` · poolside: `0`/`1` · beach, coastRoad: `0` | |
| palms | `even` 고른 간격, `cluster` 무리, `pair` 한 쌍(beach, coastRoad), `behind` 건물 뒤(resort, poolside) | |
| sky | `deep` 짙은 파랑, `bright` 맑음 (오후) · `dusk` 분홍 해질녘 (야자수·덤불은 한 단계 어둡게) · `violet` 연보라 저녁 | 바닥 색이 하늘을 따라간다: 오후 → 모래색, dusk → 산호빛, violet → 자줏빛. dusk·violet 이면 빌딩숲 창에 둥근 불빛. violet 은 도시를 내려다보는 구도다: 수평선에 바다 띠, 그 아래로 원형 불빛 벌판과 소실점으로 뻗는 큰길 불빛이 땅의 위쪽 약 40% 를 덮고, 빌딩은 3겹(먼 줄 작게·가까운 줄 크고 드문드문), 꼭대기는 대체로 수평선 아래. 빌딩은 가는 타워 실루엣(거의 한 색의 짙은 남색) + 노란 창 불빛만: 꺼진 창은 그리지 않고, 창은 격자가 아니라 층을 따라 이어지는 불빛 띠 / 어긋나게 흩어진 창 / 거의 다 켜진 빌딩, 불빛마다 옅은 번짐. 가장 가까운 줄 밑동에 가로수 띠, 그 앞 테라스에 작게 줄인 건물·수영장. 자동차는 나오지 않는다 (리조트는 수영장, 해변·해안 도로는 비움). 저녁의 약 1/4 은 건물 없이 테라스·수영장·야자수만 있는 "수영장 테라스" 구도이고, 건물과 수영장이 함께 나오는 경우는 드물다(리조트는 담장으로, 수영장 마당은 건물을 뺀다). 직접 고정한 테마·전경·건물은 바꾸지 않는다. violet 이면 바다는 짙은 남색에 흰 윤슬 대신 빌딩숲 아래 드문드문 노란 가로 획 몇 줄 (미니멀), 야자수는 검은 실루엣, 덤불은 더 어둡게, 건물은 어둡게 + 창에 불 (창 안에 카운터·선반·테이블·책상·화분·소파 같은 실내 실루엣), 주인공 건물은 늘 불 켜진 간판 가게(간판 글자는 시드로: RECORDS, DINER, VIDEO …), 수영장은 선명한 파랑 물에 어두운 물결 자국(윤슬의 반대)과 거의 검은 안쪽 테두리 그림자, 반사는 수영장 뒤 야자수 실루엣만. |

테마에 없는 값을 force 에 넣으면 무시되고 시드대로 고른다. `NagaiScene.choiceOptions(theme)` 로 확인 가능.

## 2. 요청 문장 → 선택지 매핑

| 요청에 이런 말이 있으면 | force |
|---|---|
| 해변, 모래사장, 백사장 | theme: beach |
| 리조트, 호텔, 가게, 상점, 건물, 동네 | theme: resort (건물 2채 원하면 buildings: 2) |
| 수영장, 풀, pool | foreground: pool (theme 미지정이면 resort) |
| 마당, 정원, 생울타리, 담 너머 | theme: poolside (far: hedge) |
| 도로, 드라이브, 해안도로, 길 | theme: coastRoad |
| 자동차, 차, 오픈카, 클래식카 | foreground: car (beach 또는 coastRoad 또는 resort) |
| 담장, 낮은 벽 | foreground: wall (resort) |
| 도시, 빌딩, 스카이라인 | far: sea+city |
| 섬 | far: sea+island |
| 해질녘, 노을, 석양, 분홍 하늘 | sky: dusk |
| 저녁, 밤, 야경, 도시 불빛, 보랏빛 하늘 | sky: violet |
| 한낮, 쨍한, 맑은 | sky: bright |
| 깊은 파랑, 진한 하늘 | sky: deep |
| 바람 많이, 강풍, 흔들리는 | wind: 1.1 ~ 1.4 |
| 잔잔한, 고요한 | wind: 0.2 ~ 0.35 |
| 야자수 많이 | palms: even |
| 야자수 두 그루, 한 쌍 | palms: pair |

여러 개가 맞으면 모두 넣는다. 말하지 않은 항목은 비워서 시드에 맡긴다 (그게 이 라이브러리의 재미).

## 3. mount 옵션

```js
NagaiScene.mount({
  canvas: '#art',            // 필수. 요소 또는 선택자. 높이를 안 정하면 3:2 비율
  controls: '#ctl',          // 선택. 컨트롤을 그릴 div
  seed: 42, jitter: null,    // jitter: 같은 구도에서 위치만 다르게
  force: { theme: 'resort' },
  wind: 0.6,                 // 0 ~ 1.5
  windDir: null,             // 1 오른쪽 / -1 왼쪽. null 이면 빛 반대쪽
  autoplay: true, grain: true, maxPixelRatio: 2,
  ui: { info, random, seed, jitter, wind, pause, pick, aspect, save, palm },   // 컨트롤 일부만 켜기 (기본 모두 true). random = 맨 위 랜덤 묶음 [아무거나·맑은 오후·해질녘·저녁], aspect = 가로/모바일/정사각, save = 사진 저장, palm = 야자수 가볍게/잎마다
  aspect: '3:2',             // '3:2' 가로 | '9:16' 세로 | '1:1' 정사각(앨범 커버) — 비율마다 구도를 새로 짠다
  lang: 'ko',                // 컨트롤 문구: 'ko' | 'en' | 'auto' (주소 ?lang= → 마지막 선택 → 브라우저 언어). ui.lang: true 면 한/EN 전환 버튼
  palmDetail: false,         // 야자수: false 가볍게(잎을 미리 그려 두고 돌려 찍기, 약 6배 가벼움) | true 잎마다(잎줄기가 휘고 소엽이 떨림)
  fps: 30,                   // 초당 그리는 횟수. 움직임이 느려 30 이면 충분 (발열·배터리 절약). 속도는 실제 시간 기준이라 그대로
  exportSize: null,          // 사진 저장 크기 { '3:2': [2400, 1600], '9:16': [1440, 2560] } (기본값)
  urlState: false,           // true 면 주소 끝 #nagai=장면코드 로 장면을 열고, 바뀔 때마다 주소를 갱신 (한 페이지 한 장면일 때)
  extend: (spec, helpers) => spec,                  // 장면 명세에 객체 추가 (style-guide.md)
  onChange: (state) => {},
});
```

## 4. 조작 함수 (mount 가 돌려주는 객체)

`randomMood('day' | 'dusk' | 'evening')` (그 하늘이 원래 나오는 시드로 — 하늘을 고정하지 않아 장면 코드가 짧다), `savePNG()` (지금 순간을 고해상도 PNG 로, 파일 이름 = `fileName`), `render(W, H)` (지금 순간을 W×H 캔버스로 — 글자 합성 등에),  `code` (장면 코드), `setCode('83608-12 9:16 sky:violet')`, `shareText()`, `setPalmDetail(true | false)`, `setLang('ko' | 'en')` · `lang`, `setAspect('3:2' | '9:16' | '1:1')`, `setSeed(n)`, `next()`, `prev()`, `randomize()`, `shuffleLayout(j?)`, `setForce({ key: value | null })`, `clearForce()`, `setWind(v)`, `play()`, `pause()`, `toggle()`, `toPNG()` (data URL), `destroy()`, `state`, `spec`

## 5. HTML 속성만으로 넣기

```html
<canvas data-nagai data-seed="7" data-force='{"theme":"coastRoad"}' data-controls></canvas>
```
`data-controls` 를 쓰면 캔버스 바로 아래에 컨트롤이 생긴다. `data-controls="#id"` 로 위치 지정 가능. 그 밖에 `data-aspect="9:16"`, `data-url-state`, `data-wind`, `data-jitter`, `data-autoplay="false"`, `data-grain="false"`, `data-lang="en"`.

## 6. 장면 코드

장면 하나를 다시 만드는 데 필요한 것(시드, 위치, 비율, 직접 고른 항목)을 한 줄로 적은 것.
`83608` · `83608-12` (위치만 바꾸기 결과) · `83608-12 9:16 sky:violet theme:resort`
컨트롤의 시드 칸에 그대로 붙여넣고 Enter 하면 그 장면으로 간다. "복사" 버튼은 단독 페이지에서는 `#nagai=…` 이 붙은 주소를, iframe 안(아티팩트 등)에서는 장면 코드를 복사한다.
사용자가 장면 코드를 주면 config 의 `seed`, `jitter`, `aspect`, `force` 로 옮겨 적는다.

## 7. 사진 저장

컨트롤의 "사진 저장" 또는 `api.savePNG()`. 지금 순간(바람·윤슬 상태 그대로)을 화면 크기와 상관없이 가로 2400×1600, 모바일 1440×2560, 정사각 3000×3000 으로 다시 그려 PNG 로 내려받는다. 파일 이름에 장면 코드가 들어간다 (`nagai-83608-12_9x16_sky-violet.png`).
claude.ai 아티팩트로 게시할 때는 `capabilities: {downloads: true}` 를 선언한다 → 페이지가 `claude.use("downloads")` 로 저장하고, 보는 사람에게 확인 창이 뜬다.
그 기능이 없는 iframe 에서는 다운로드가 막힐 수 있어서 저장한 사진을 화면 위에 띄우고, 길게 누르기·우클릭으로 저장하라고 안내한다.

## 8. 앨범 커버 생성기 (layout: cover)

80년대 시티팝 LP 재킷처럼 정사각 장면 위에 제목·아티스트·작은 글씨를 얹고, 일본 LP 띠지(오비)를 두를 수 있는 페이지. 레코드 슬리브 목업으로 미리 보고 3000×3000 PNG (스트리밍 커버 규격) 로 저장한다.
config: `{"layout": "cover", "seed": 3, "force": {"sky": "dusk"}, "title": "Summer Breeze", "artist": "Nagai Style", "small": "STEREO", "font": "script|modern|serif|none", "pos": "tl|tc|tr|bl|bc|br", "color": "#fbf7ef", "obi": true, "obiColor": "#d8343f"}`
`"lang": "ko|en|auto"` 로 화면 문구 언어를 정한다 (제목 옆 한/EN 버튼이 장면 컨트롤까지 같이 바꾼다). 해외 사용자가 볼 페이지면 `auto`.
`"mood": "day|dusk|evening"` 을 주면 열 때마다 그 분위기(오후·해질녘·저녁)의 무작위 시드로 시작한다 (seed 대신, 하늘을 고정하지 않으므로 컨트롤로 다른 분위기도 고를 수 있음).
`"music": {"src": "song.mp3", "title": "곡 제목", "artist": "아티스트"}` 를 주면 커버 가운데에 옅은 반투명 재생 버튼이 생긴다: 누르면 판이 33⅓ RPM 으로 돌기 시작하고 톤암이 들어와 바늘을 내린 뒤 음악이 나온다 (패널에 따로 컨트롤 없음, 효과음 없음). 음악은 브라우저가 직접 재생한다 (아이폰 Safari 에서 Web Audio 로 돌리면 멈추는 문제 때문). src 는 커버 페이지 기준 경로(같은 사이트에 올린 파일). 곡은 사용자가 쓸 권리가 있는 것만.
글꼴은 Google Fonts (Yellowtail · Jost · Playfair Display). 띠지 제목은 한글·일본어면 글자를 세로로 쌓고, 영문이면 돌려 쓴다. 띠지의 품번(NGS-시드)과 가격은 장식이다.
"앨범 커버", "LP 재킷", "플레이리스트 커버", "싱글 커버" 요청이면 이 레이아웃을 쓴다. 실제 앨범 커버를 그대로 재현하지는 않는다 (style-guide.md 4절).
