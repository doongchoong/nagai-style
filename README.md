# nagai-style
nagai-style 절차적 생성

나가이 히로시 풍 80년대 시티팝 모션그래픽 한 페이지. 정적 HTML 하나라 빌드 없이 그대로 배포된다.

- 시드·구도·하늘(오후 / 분홍 해질녘 / 연보라 저녁)을 컨트롤에서 바꿀 수 있다.
- 휴대폰처럼 세로로 긴 화면은 모바일(9:16) 구도로 시작한다. 가로 / 모바일 버튼으로 전환.
- 장면을 바꾸면 주소 끝에 `#nagai=장면코드` 가 붙는다. 그 주소를 공유하면 같은 장면이 열린다.
- "사진 저장" 으로 지금 장면을 고해상도 PNG (2400×1600 / 1440×2560) 로 내려받는다.

## 앨범 커버 생성기 (`/cover`)

정사각 장면 위에 제목·아티스트를 얹고 일본 LP 띠지(오비)를 둘러 80년대 시티팝 LP 재킷처럼 만든다. 레코드 슬리브 목업으로 미리 보고 3000×3000 PNG 로 저장한다.

## 다시 만들기

`index.html` 은 `nagai-motion` 스킬의 `build_page.py` 로 `site.config.json` 에서 만든다.

```bash
python ../.claude/skills/nagai-motion/scripts/build_page.py site.config.json index.html
python ../.claude/skills/nagai-motion/scripts/build_page.py cover.config.json cover/index.html
```

## 배포

Vercel 에서 이 저장소를 Import 하면 된다. Framework Preset 은 Other, Build Command 와 Output Directory 는 비워 둔다.
