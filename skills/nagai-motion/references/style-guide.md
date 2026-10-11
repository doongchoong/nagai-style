# 나가이 히로시 스타일 규칙과 새 객체 만들기

라이브러리에 없는 것(요트, 등대, 파라솔, 야경 등)을 요청받았을 때 읽는다.
새 객체도 아래 규칙을 지켜야 기존 장면과 한 그림처럼 보인다.

## 목차
1. 화풍 규칙
2. 객체 약속 (registerKind / extendScene)
3. 예시: 바다 위 요트
4. 저작권

## 1. 화풍 규칙

- **납작한 면 + 단계 음영.** 그라데이션은 하늘·바다 바탕에만. 물체는 면마다 한 색이고, 빛 받는 정도에 따라 3~5단계로만 나눈다.
- **어두운 덩어리 먼저, 밝은 조각은 군데군데.** 야자수 잎, 덤불처럼 잎이 많은 것은 거의 검은 녹색 실루엣을 먼저 깔고, 빛 쪽에 밝은 조각을 띄엄띄엄 올린다. 어두운 바탕이 사이사이 비쳐야 한다.
- **반짝이는 것은 원.** 윤슬, 꽃, 물보라, 도시 불빛, 별은 작은 원을 무리 지어 찍고 일부만 밝게.
- **파스텔 상자 + 검정 창.** 건물은 단순한 상자, 창은 거의 검정에 얇은 흰 틀.
- **한 점 투시.** 정면은 똑바른 직사각형, 옆면·윗면만 소실점 쪽으로 줄어든다 (`util.persp`).
- **그림자는 항상 있다.** 서 있는 것은 모두 땅 그림자 (`util.shadowOffset`, `util.drawBoxShadow`), 색은 `util.SHADOW_COLOR`.
- **빛은 하나.** `util.light.x`(-1 왼쪽 ~ 1 오른쪽), `util.lightVector()` 를 읽어서 밝은 면·그림자 방향을 정한다. 객체마다 빛을 따로 두지 않는다.
- **움직임은 바람과 반짝임뿐.** 건물·도로·자동차는 정적. 바람은 세기로만 쓰고 `time × wind` 는 쓰지 않는다 (바람이 바뀔 때 튐).
- **랜덤은 시드 고정.** `util.mulberry32(seed)` 로 만들고, 모양을 정하는 랜덤은 create 단계에서 끝낸다. 매 프레임 Math.random() 금지 (깜빡임).

## 2. 객체 약속

```js
NagaiScene.registerKind('이름', {
  dynamic: false,                         // 매 프레임 그려야 하면 true (움직임·반짝임)
  create: (item) => obj,                  // 한 번만. 모양·랜덤 결정
  draw: (ctx, obj, item, W, time, wind) => { … },   // wind(x) → 그 위치의 바람 세기
});

function extendScene(spec, helpers) {     // build_page.py 가 이 이름을 찾아 mount 에 넘긴다
  spec.items.push({ kind: '이름', phase: 'stand', y: 바닥y, ...내 매개변수 });
  return spec;
}
```

- `phase`: `back`(하늘·원경) → `sea` → `flat`(바닥에 붙은 것) → `pool` → `stand`(서 있는 것) 순서로 그려진다. `stand` 안에서는 `y`(바닥에 닿는 화면 y)가 작은 것부터.
- 크기: 땅 위 물체는 `s = (y - 수평선y) / (H - 수평선y)` 를 실제 크기에 곱한다. 수평선은 `spec.view.horizonY`, 화면 높이는 `spec.height`.
- 바다 범위: `spec.items.find(i => i.kind === 'sea')` 의 `horizonY`, `shoreY`.
- 화면 좌표는 1200×800 디자인 좌표. 화면 크기에 맞추는 건 mount 가 한다.

## 3. 예시: 바다 위 요트 (동작 확인됨)

```js
NagaiScene.registerKind('sailboat', {
  dynamic: true,
  create: (it) => ({ phase: (it.seed % 100) / 10 }),
  draw(ctx, o, it, W, t) {
    const U = NagaiScene.util, s = it.size;
    const x = it.x, y = it.y + Math.sin(t * 1.4 + o.phase) * s * 0.03;
    const fromLeft = U.light.x < 0;
    U.fillPoly(ctx, [{ x: x - s * 0.5, y: y + s * 0.11 }, { x: x + s * 0.5, y: y + s * 0.11 }, { x: x + s * 0.5, y: y + s * 0.15 }, { x: x - s * 0.5, y: y + s * 0.15 }], U.withAlpha('#0d2f78', 0.45)); // 물 위 그림자
    U.fillPoly(ctx, [{ x: x - s * 0.5, y }, { x: x + s * 0.5, y }, { x: x + s * 0.38, y: y + s * 0.1 }, { x: x - s * 0.42, y: y + s * 0.1 }], '#f4f1ea');               // 선체
    U.fillPoly(ctx, [{ x: x - s * 0.03, y: y - s * 1.1 }, { x: x - s * 0.03, y: y - s * 0.04 }, { x: x - s * 0.45, y: y - s * 0.04 }], fromLeft ? '#ffffff' : '#c9d4e0'); // 큰 돛
    U.fillPoly(ctx, [{ x: x + s * 0.03, y: y - s * 0.95 }, { x: x + s * 0.03, y: y - s * 0.04 }, { x: x + s * 0.36, y: y - s * 0.04 }], fromLeft ? '#c9d4e0' : '#ffffff'); // 앞 돛
    ctx.fillStyle = '#3a2617'; ctx.fillRect(x - s * 0.012, y - s * 1.12, s * 0.024, s * 1.1);                                                                     // 돛대
  },
});

function extendScene(spec) {
  const sea = spec.items.find((i) => i.kind === 'sea');
  const y = sea.horizonY + (sea.shoreY - sea.horizonY) * 0.4;
  spec.items.push({ kind: 'sailboat', phase: 'stand', y, x: spec.width * 0.72, size: 26 + (y - sea.horizonY) * 0.9, seed: spec.seed });
  return spec;
}
```
이 코드를 config 의 `extend_js` 에 문자열로 넣으면 된다.

## 4. 저작권

화풍(납작한 면, 파스텔, 원으로 찍는 반짝임)은 자유롭게 쓴다. 하지만 특정 그림이나 앨범 커버를 그대로 다시 그려 달라는 요청에는, 그 작품을 재현하지 않고 같은 분위기의 새 구도를 만든다고 짧게 말한 뒤 진행한다. 실제 브랜드 로고·엠블럼도 그리지 않는다.
