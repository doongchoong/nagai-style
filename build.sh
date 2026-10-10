#!/bin/sh
# 사이트 다시 만들기: 스킬의 최신 라이브러리(min)를 복사하고 두 페이지를 빌드한다
set -e
cd "$(dirname "$0")"
SKILL=../.claude/skills/nagai-motion
cp "$SKILL/assets/nagai-scene.min.js" nagai-scene.min.js
python3 "$SKILL/scripts/build_page.py" site.config.json index.html
python3 "$SKILL/scripts/build_page.py" cover.config.json cover/index.html
