# Nagai Style

**English** · [한국어](README.ko.md)

Procedurally generated, gently animated 80s city-pop scenes in the style of Hiroshi Nagai — palms swaying in the wind, glints on the sea and the pool, flat pastel buildings and long dark shadows. Every scene comes from a seed and a composition decision tree, so there are endless variations and any of them can be shared or reproduced.

The repository holds three things:

- **A website** — [nagai-style.vercel.app](https://nagai-style.vercel.app): browse scenes, share them by link, save them as high-resolution PNGs.
- **An album cover maker** — [nagai-style.vercel.app/cover](https://nagai-style.vercel.app/cover/): put a title on a square scene, wrap a Japanese LP obi around it, play the record, export 3000×3000.
- **A Claude skill** — `nagai-motion`: ask Claude for "a dusk resort pool in Hiroshi Nagai style" and get a single animated HTML page.

![Album cover maker: a dusk cover with a record and tonearm](docs/images/hero.jpg)

| Afternoon | Dusk | Evening |
|---|---|---|
| ![Afternoon beach with a convertible, round trees and a flowering bush](docs/images/scene-afternoon.jpg) | ![Dusk coast road with a classic car](docs/images/scene-dusk.jpg) | ![Evening shop with its sign lit, above the city](docs/images/scene-evening.jpg) |

| Album covers | | | Mobile (9:16) |
|---|---|---|---|
| ![Cover in script type](docs/images/cover-dusk.jpg) | ![Cover with a red obi](docs/images/cover-afternoon.jpg) | ![Cover in serif type](docs/images/cover-evening.jpg) | ![Portrait dusk beach](docs/images/scene-mobile.jpg) |

## Features

- **Composition decision tree.** Theme (beach, resort, poolside, coast road), what lies far off (sea, city skyline, island, hedge), the focal point, foreground (pool, car, wall), palms, sky (deep blue, bright afternoon, pink dusk, violet evening). Fix what you care about and leave the rest to the seed.
- **Plants.** Besides palms and flowering bushes (pink, red, white, yellow or purple blossoms per scene): big round dotted-leaf trees framing the edge of the picture (green, deep teal or lime), agave and yucca, and potted plants by the pool.
- **One light, one style.** Every object follows the same light and shadow, stepped flat shading and one-point perspective, so a scene always holds together.
- **Animated.** Wind in the palms and the big trees, breaking waves, glints on water. Capped at 30 fps and paused off screen, so it is kind to batteries.
- **Scene codes.** A scene is one short line such as `83608-12 9:16 sky:violet`. Paste it into the seed box or open `…/#nagai=83608-12` to get the exact same scene back.
- **Landscape, portrait and square.** 3:2, 9:16 (phone wallpaper) and 1:1 (album cover) each get their own composition.
- **High-resolution export.** 2400×1600, 1440×2560 or 3000×3000 PNG, with film grain kept at the scale you saw on screen.
- **Album cover maker.** Script, modern or serif type, Japanese LP obi, record sleeve mockup, and an optional record player with a tonearm.
- **Korean / English.** Both pages pick the browser language and have a 한 / EN switch (`?lang=en` / `?lang=ko` works too).
- **No dependencies.** One JavaScript file (about 96 KB minified), plain Canvas 2D.

## Use it with Claude

### Claude Code (plugin)

```text
/plugin marketplace add doongchoong/nagai-style
/plugin install nagai-motion@nagai-style
```

### Claude Code (copy the folder)

```bash
git clone https://github.com/doongchoong/nagai-style.git
cp -r nagai-style/skills/nagai-motion ~/.claude/skills/       # every project
# or: cp -r nagai-style/skills/nagai-motion .claude/skills/   # this project only
```

### claude.ai

Upload [`dist/nagai-motion.skill`](dist/nagai-motion.skill) (a zip of the skill folder) under **Settings → Capabilities → Skills**.

Then just ask, for example:

> Make a Hiroshi Nagai style dusk resort with a pool, as a phone wallpaper.
> 나가이 히로시 풍으로 해질녘 수영장 리조트, 모바일 배경화면으로 만들어줘.

See [docs/USAGE.md](docs/USAGE.md) for more prompts and every option.

## Use the library directly

```html
<canvas id="art"></canvas>
<div id="art-ctl"></div>
<script src="https://cdn.jsdelivr.net/gh/doongchoong/nagai-style@main/skills/nagai-motion/assets/nagai-scene.min.js"></script>
<script>
  NagaiScene.mount({ canvas: '#art', controls: '#art-ctl', seed: 42, force: { theme: 'resort', sky: 'dusk' } });
</script>
```

Or with attributes only:

```html
<canvas data-nagai data-seed="42" data-aspect="9:16" data-force='{"sky":"violet"}' data-controls></canvas>
```

The full API (mount options, controls, scene codes, adding your own objects) is in [docs/USAGE.md](docs/USAGE.md#library).

## Repository layout

```
skills/nagai-motion/      the Claude skill (source of truth)
  SKILL.md                instructions Claude follows
  assets/                 nagai-scene.js, nagai-scene.min.js, cover.html
  references/             API and style guide that Claude reads
  scripts/build_page.py   config.json → single HTML page
index.html, cover/        the website (built from site.config.json, cover.config.json)
.claude-plugin/           Claude Code plugin marketplace entry
dist/                     packaged skill for claude.ai
docs/                     usage guide and README images
```

`./build.sh` rebuilds both pages from the skill, `./pack.sh` repackages `dist/nagai-motion.skill`. The site deploys to Vercel as static files; `.vercelignore` keeps the skill, docs and build files out of the deployment.

## Notes

- This is a fan homage to the look of Hiroshi Nagai's illustrations. It is not affiliated with or endorsed by Hiroshi Nagai, and it never reproduces his artworks or any real album cover; every scene is newly generated.
- Cars are generic shapes (coupe, convertible, boxy sedan), not any real make or model.

## License

- Code, skill and docs: [MIT](LICENSE).
- The song in `cover/` ("달궈진 정수리 / Dalguojin Jungsuri", made with Google Gemini): [CC0 1.0](cover/MUSIC-LICENSE.md) — free for anyone to use for anything, no credit needed.
