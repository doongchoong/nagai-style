---
name: nagai-motion
description: 나가이 히로시(Hiroshi Nagai) 화풍의 움직이는 그림(캔버스 모션그래픽)을 만든다. 야자수가 바람에 흔들리고 바다·수영장에 윤슬이 반짝이는 80년대 시티팝 일러스트 장면을, 결정트리 구도와 시드로 자동 생성해 단일 HTML 로 낸다. "나가이 히로시 스타일로 ~ 만들어줘", "히로시 나가이 풍 모션그래픽", "시티팝 앨범 아트 느낌 애니메이션", "야자수·수영장·파스텔 건물 여름 그림 움직이게", "city pop illustration animation", "Hiroshi Nagai style scene" 같은 요청이면, 화가 이름을 말하지 않아도 이 화풍을 원하는 듯하면 반드시 이 스킬을 쓴다. 블로그에 넣을 임베드 코드나 배경 화면용 장면을 원할 때도 쓴다.
---

# 나가이 히로시 스타일 모션그래픽

`assets/nagai-scene.js` (블로그용 압축본 `assets/nagai-scene.min.js`) 는 장면 전체를 그리는 라이브러리다 (야자수, 바다, 덤불, 자동차, 빌딩숲, 건물, 담장, 수영장, 구도 결정트리, 캔버스+컨트롤 장착). 직접 그림 코드를 새로 짜지 말고 이 라이브러리를 쓴다. 이미 화풍 규칙(단계 음영, 어두운 덩어리 먼저, 원으로 찍는 반짝임, 한 점 투시, 항상 있는 그림자, 하나의 빛)이 맞춰져 있어서, 새로 짜면 오히려 결과가 나빠진다.

## 작업 순서

1. **요청을 구도 선택지로 옮긴다.** `references/api.md` 의 "요청 문장 → 선택지 매핑" 표를 보고 `force` 를 채운다. 사용자가 말하지 않은 항목은 비워 둔다. 시드가 나머지를 정하는 게 이 라이브러리의 재미라서, 다 채우면 오히려 단조로워진다.
2. **시드를 정한다.** 사용자가 숫자를 줬으면 그대로, 아니면 비워서 무작위로 둔다. 결과에 시드를 꼭 알려줘서 마음에 들면 다시 만들 수 있게 한다.
3. **형태를 정한다.**
   - 기본은 `"layout": "fullscreen"` + 컨트롤 켜기. 보는 사람이 시드·바람·구도를 바로 바꿔 볼 수 있다.
   - "깔끔하게", "배경용", "컨트롤 없이" → `"controls": false`.
   - "블로그", "글에 넣을" → `"layout": "embed"`, 그리고 답변에 임베드 코드(아래)를 같이 준다.
   - "앨범 커버", "LP 재킷", "플레이리스트 커버" → `"layout": "cover"` (커버 생성기, `references/api.md` 8절).
   - 비율: 기본 `"aspect": "3:2"`. 정사각이 필요하면 `"1:1"`. "모바일", "세로", "9:16", "폰 배경화면", "릴스·쇼츠" → `"aspect": "9:16"` (세로 구도로 새로 짠다). 컨트롤이 켜져 있으면 보는 사람이 "가로 / 모바일" 버튼으로 바로 바꿀 수 있다.
4. **라이브러리에 없는 것을 원하면** (요트, 등대, 파라솔, 야경, 비행기 …) `references/style-guide.md` 를 읽고, 규칙대로 작은 객체를 `extend_js` 로 추가한다. 예시(요트)가 그대로 동작하니 그걸 고쳐 쓰는 게 빠르다. 요청의 핵심이 아닌 소품은 굳이 만들지 않는다.
5. **HTML 을 만든다.**
   ```bash
   python <스킬경로>/scripts/build_page.py config.json <출력 폴더>/<이름>.html
   ```
   config 형식은 `scripts/build_page.py` 맨 위 설명 참고.
6. **확인한다.** `<script>` 안 코드를 뽑아 `node --check` 로 문법만 확인한다. `extend_js` 를 썼다면 특히.
7. **전달한다.** 웹 페이지를 게시하는 도구(Artifact 등)가 있으면 그걸로 게시하고(claude.ai 아티팩트면 사진 저장이 되도록 `capabilities: {downloads: true}` 선언), 없으면 파일로 준다. 답변에는 무엇을 고정했고 무엇이 시드에 맡겨졌는지, 장면 코드(예: `83608-12 9:16 sky:violet`)를 짧게 적는다.
   - 사용자가 장면 코드를 주면 config 의 `seed`, `jitter`, `aspect`, `force` 로 옮겨 그 장면을 그대로 다시 만든다 (`references/api.md` 6절).
   - 페이지가 여럿인 사이트에 올릴 때는 `"lib_src": "/nagai-scene.min.js"` 로 라이브러리를 품지 않고 링크로 건다 (min 파일은 사이트 루트에 복사). 아티팩트·파일 전달은 기본(품기)을 써서 파일 하나로 열리게 한다.
8. **라이브러리를 고쳤다면** `assets/nagai-scene.min.js` 도 다시 만든다: `terser assets/nagai-scene.js --compress --mangle --comments '/^!/' --ecma 2020 -o assets/nagai-scene.min.js`

## config 예시

"해질녘 수영장 있는 리조트, 바람 좀 세게" →
```json
{ "title": "해질녘 리조트", "force": { "theme": "resort", "foreground": "pool", "sky": "dusk" }, "wind": 1.1, "layout": "fullscreen", "controls": true }
```

"도시가 보이는 해안도로 드라이브, 컨트롤 없이" →
```json
{ "title": "해안 도로", "force": { "theme": "coastRoad", "far": "sea+city" }, "controls": false }
```

## 블로그 임베드 코드 (embed 요청일 때 함께 준다)

`assets/nagai-scene.min.js` 를 블로그 정적 폴더에 두고:
```html
<canvas id="art"></canvas>
<div id="art-ctl"></div>
<script src="/assets/js/nagai-scene.min.js"></script>
<script>NagaiScene.mount({ canvas: '#art', controls: '#art-ctl', seed: 42, aspect: '3:2', force: { theme: 'resort', sky: 'violet' } });</script>
```
코드 없이 속성만으로도 된다: `<canvas data-nagai data-seed="42" data-aspect="9:16" data-force='{"theme":"resort"}' data-controls></canvas>`
한 페이지에 여러 개 넣어도 되고, 화면 밖에 있는 장면은 자동으로 멈춘다. 한 글에 장면이 하나뿐이면 `urlState: true` (또는 `data-url-state`) 로 주소에 장면을 담을 수 있다.

## 주의

- 특정 그림·앨범 커버를 그대로 재현해 달라는 요청은 재현하지 않고, 같은 분위기의 새 구도를 만든다고 한 문장으로 말한 뒤 진행한다 (`references/style-guide.md` 4절).
- 자동차는 특정 차종·브랜드가 아닌 일반형(쿠페, 컨버터블, 각진 세단)이다. 특정 브랜드 차를 원하면 그 형태를 흉내 내지 말고 가장 가까운 일반형을 쓴다고 말한다.
