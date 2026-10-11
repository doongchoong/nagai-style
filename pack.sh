#!/bin/sh
# 스킬 패키지 만들기: skills/nagai-motion → dist/nagai-motion.skill (claude.ai 에 올리는 zip)
set -e
cd "$(dirname "$0")"
mkdir -p dist
rm -f dist/nagai-motion.skill
(cd skills && zip -rq -X ../dist/nagai-motion.skill nagai-motion -x '*.DS_Store')
echo "dist/nagai-motion.skill ($(du -k dist/nagai-motion.skill | cut -f1) KB)"
