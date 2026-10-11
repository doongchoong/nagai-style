# Usage

**English** · [한국어](USAGE.ko.md)

1. [Asking Claude](#asking-claude)
2. [Page config (`build_page.py`)](#page-config)
3. [Library](#library)
4. [Album cover maker](#album-cover-maker)
5. [Working on this repository](#working-on-this-repository)

## Asking Claude

Install the skill first (see the [README](../README.md#use-it-with-claude)). Claude picks it up whenever you ask for a Hiroshi Nagai / city-pop style scene, even if you don't name the painter. It turns your words into composition choices, leaves everything you didn't mention to the seed, builds one HTML page and tells you the scene code so you can get the same scene again.

| You say | What Claude does |
|---|---|
| "A Hiroshi Nagai style dusk resort with a pool, windy" | `theme: resort`, `foreground: pool`, `sky: dusk`, stronger wind |
| "Coast road drive with the city in the distance, no controls" | `theme: coastRoad`, `far: sea+city`, controls off |
| "Evening city lights from a terrace, phone wallpaper" | `sky: violet`, portrait 9:16 |
| "Something I can put in my blog post" | `layout: embed`, plus a copy-paste embed snippet |
| "Make me a city-pop album cover" | `layout: cover`, the cover maker page |
| "Open scene `83608-12 9:16 sky:violet` again" | The exact same scene |
| "Add a sailboat on the sea" | A small new object that follows the same light and shading rules |

Words that map to choices: beach / resort / pool / garden, hedge / road, drive / car, convertible / wall / city, skyline / island / dusk, sunset, pink sky / evening, night, city lights / bright midday / deep blue / windy / calm / many palms / a pair of palms. Ask in English or Korean.

The skill won't reproduce a specific painting or a real album cover; it makes a new scene with the same mood. Cars are generic shapes, never a real make.

## Page config

`skills/nagai-motion/scripts/build_page.py` turns a small JSON file into one HTML page. By default the library is embedded, so the file opens anywhere on its own.

```bash
python3 skills/nagai-motion/scripts/build_page.py config.json out.html
```

```json
{
  "title": "Dusk resort",
  "seed": 1234,
  "force": { "theme": "resort", "foreground": "pool", "sky": "dusk" },
  "wind": 0.8,
  "aspect": "3:2",
  "layout": "fullscreen",
  "controls": true
}
```

| Key | Values | Default |
|---|---|---|
| `title` | Page title | `나가이 히로시 스타일` |
| `seed` | Integer. Omit for a random one | random |
| `jitter` | Same composition, objects moved around | `null` |
| `force` | Composition choices to fix (see [Composition choices](#composition-choices)) | `{}` |
| `wind` | `0` – `1.5` | `0.6` |
| `aspect` | `3:2` landscape · `9:16` portrait · `1:1` square · `auto` (portrait on tall screens) | `3:2` |
| `layout` | `fullscreen` · `embed` (inside an article) · `cover` (album cover maker) | `fullscreen` |
| `controls` | Show the control panel | `true` |
| `ui` | Show only some controls: `{ "info", "random", "seed", "jitter", "wind", "pause", "pick", "aspect", "save", "palm", "lang" }` | all on except `lang` |
| `url_state` | Keep the scene in the address (`#nagai=…`) | on for `fullscreen` |
| `palm_detail` | Palms drawn leaf by leaf (heavier) instead of the light stamped fronds | `false` |
| `lang` | Control language: `ko` · `en` · `auto` (`?lang=` in the address → last choice → browser language). Add `"ui": {"lang": true}` for a 한 / EN switch | `ko` |
| `lib_src` | Link the library instead of embedding it, e.g. `"/nagai-scene.min.js"` (adds `?v=version`) | embedded |
| `description` | `<meta name="description">` | — |
| `head_html` | Extra tags for `<head>` (home-screen icons, manifest, theme color …) | — |
| `caption` | Caption under the picture in `embed` layout | — |
| `extend_js` | JavaScript that adds your own objects (see [Adding objects](#adding-objects)) | — |

## Library

`nagai-scene.js` (about 96 KB minified) draws everything: palms, sea and waves, bushes, cars, skylines, buildings, walls, pools, the composition tree, and the canvas with its controls. No dependencies.

```html
<script src="https://cdn.jsdelivr.net/gh/doongchoong/nagai-style@main/skills/nagai-motion/assets/nagai-scene.min.js"></script>
```

For production, pin a commit or tag instead of `@main`, or copy the file to your own site.

### mount

```js
const scene = NagaiScene.mount({
  canvas: '#art',            // required: element or selector. 3:2 if you don't set a height
  controls: '#ctl',          // optional: where to draw the control panel
  seed: 42, jitter: null,
  force: { theme: 'resort' },
  wind: 0.6,                 // 0 – 1.5
  windDir: null,             // 1 right, -1 left; null = away from the light
  aspect: '3:2',             // '3:2' | '9:16' | '1:1' — each aspect gets its own composition
  autoplay: true, grain: true, maxPixelRatio: 2,
  fps: 30,                   // frames per second; motion speed is time-based
  palmDetail: false,
  lang: 'ko',                // 'ko' | 'en' | 'auto' — language of the controls
  urlState: false,           // read and write #nagai=<scene code>
  exportSize: null,          // { '3:2': [2400, 1600], '9:16': [1440, 2560], '1:1': [3000, 3000] }
  ui: {},                    // turn controls off, e.g. { save: false }; { lang: true } adds a 한 / EN switch
  extend: (spec, helpers) => spec,
  onChange: (state) => {},
});
```

Scenes that scroll off screen pause themselves, so several on one page are fine.

### Controls

The object `mount` returns:

| Call | Does |
|---|---|
| `setSeed(n)`, `next()`, `prev()`, `randomize()` | Change the seed |
| `randomMood('day' \| 'dusk' \| 'evening')` | A random seed whose sky is that mood |
| `setForce({ key: value \| null })`, `clearForce()` | Fix or release composition choices |
| `shuffleLayout(j?)` | Same composition, objects moved |
| `setAspect('3:2' \| '9:16' \| '1:1')` | Switch aspect |
| `setWind(v)`, `play()`, `pause()`, `toggle()` | Motion |
| `setPalmDetail(bool)` | Light or detailed palms |
| `lang`, `setLang('ko' \| 'en')` | Read or switch the control language (remembered for `lang: 'auto'` pages) |
| `code`, `setCode('83608-12 9:16 sky:violet')` | Read or open a scene code |
| `shareText()` | Link with the scene, or the scene code inside an iframe |
| `savePNG()` | Download the current moment as a high-resolution PNG |
| `render(W, H)` | The current moment on a new W×H canvas |
| `toPNG()` | Data URL of the screen canvas |
| `state`, `spec`, `destroy()` | Inspect or tear down |

### HTML attributes

```html
<canvas data-nagai data-seed="7" data-aspect="9:16" data-force='{"theme":"coastRoad"}' data-controls></canvas>
```

Also `data-controls="#id"`, `data-url-state`, `data-wind`, `data-jitter`, `data-autoplay="false"`, `data-grain="false"`, `data-lang="en"`.

### Scene codes

Everything needed to rebuild one scene, in one line: the seed, an optional jitter, the aspect, and the fixed choices.

`83608` · `83608-12` · `83608-12 9:16 sky:violet theme:resort`

Paste a code into the seed box and press Enter, or open `https://nagai-style.vercel.app/#nagai=83608-12%209:16`. "Copy" in the controls copies a link on a standalone page and the bare code inside an iframe.

### Composition choices

| Key | Values |
|---|---|
| `theme` | `beach`, `resort`, `poolside`, `coastRoad` |
| `far` | `sea`, `sea+city`, `sea+island`, `hedge` (poolside only) |
| `focal` | `left`, `center`, `right` — where the main subject sits; light and vanishing point follow |
| `foreground` | beach: `car` / `empty` · resort: `pool` / `wall` / `car` · poolside: `pool` · coastRoad: `car` (parked on the lot below the road) |
| `buildings` | resort: `1` / `2` · poolside: `0` / `1` |
| `palms` | `even`, `cluster`, `pair` (beach, coastRoad), `behind` (resort, poolside) |
| `sky` | `deep`, `bright` (afternoon) · `dusk` (pink) · `violet` (evening, looking down on a lit city) |

The ground follows the sky: sand in the afternoon, coral at dusk, maroon in the evening. Breaking waves appear on afternoon beaches. Values a theme doesn't have are ignored; `NagaiScene.choiceOptions(theme)` lists what is allowed.

### Adding objects

Register a kind and push items into the scene spec. Use `NagaiScene.util` (`light`, `shadowOffset`, `fillPoly`, `mixColor`, `persp` …) so the new object shares the scene's light and perspective.

```js
NagaiScene.registerKind('sailboat', {
  dynamic: true,                                   // drawn every frame
  create: (item) => ({ phase: (item.seed % 100) / 10 }),
  draw(ctx, obj, item, W, time, wind) { /* draw at item.x, item.y */ },
});

function extendScene(spec) {                       // pass as mount({ extend: extendScene })
  const sea = spec.items.find((i) => i.kind === 'sea');
  spec.items.push({ kind: 'sailboat', phase: 'stand', y: sea.horizonY + 20, x: spec.width * 0.7, size: 40, seed: spec.seed });
  return spec;
}
```

Draw order is by `phase` (`back` → `sea` → `flat` → `pool` → `stand`), then by `y`. Coordinates are in a 1200×800 design space. The complete sailboat example and the style rules are in [`references/style-guide.md`](../skills/nagai-motion/references/style-guide.md) (Korean).

## Album cover maker

`"layout": "cover"` builds the cover page: a square scene, title / artist / small print, a Japanese LP obi, a record sleeve mockup, and a 3000×3000 PNG export.

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
  "music": { "src": "song.mp3", "title": "Song title", "artist": "Artist" }
}
```

| Key | Values |
|---|---|
| `seed` / `mood` | A fixed seed, or `day` · `dusk` · `evening` to open on a random scene of that mood every visit |
| `lang` | `ko` · `en` · `auto`. The page has a 한 / EN switch next to its title that also switches the scene controls |
| `font` | `script` (Yellowtail) · `modern` (Jost) · `serif` (Playfair Display) · `none` |
| `pos` | `tl`, `tc`, `tr`, `bl`, `bc`, `br` |
| `obi` | Wrap a Japanese LP obi strip; CJK titles stack vertically, Latin titles are rotated |
| `music` | Adds a faint play button on the cover. Pressing it spins the record up to 33⅓ rpm, swings the tonearm onto it, then plays the song. `src` is relative to the cover page; use only music you have the rights to |

The catalogue number (`NGS-` + seed) and the price on the obi are decoration.

## Working on this repository

```bash
./build.sh   # copy the minified library from the skill and rebuild index.html and cover/index.html
./pack.sh    # rebuild dist/nagai-motion.skill for claude.ai
```

After editing `skills/nagai-motion/assets/nagai-scene.js`:

1. Bump `version` in the file (the site links `nagai-scene.min.js?v=<version>` to bust caches).
2. Rebuild the minified file:
   `npx terser skills/nagai-motion/assets/nagai-scene.js --compress --mangle --comments '/^!/' --ecma 2020 -o skills/nagai-motion/assets/nagai-scene.min.js`
3. Run `./build.sh` and `./pack.sh`, and update `version` in `.claude-plugin/marketplace.json`.

Vercel serves the repository root as a static site. `.vercelignore` keeps `skills/`, `docs/`, `dist/`, Markdown and build files out of the deployment.
