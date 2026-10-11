#!/usr/bin/env python3
"""나가이 히로시 스타일 장면 HTML 만들기

사용법:
    python build_page.py config.json out.html

config.json 예시:
{
  "title": "해질녘 리조트",
  "seed": 1234,                 # 생략하면 무작위
  "jitter": null,               # 같은 구도에서 위치만 바꿀 때
  "force": {"theme": "resort", "foreground": "pool", "sky": "dusk"},
  "wind": 0.8,                  # 0 ~ 1.5
  "layout": "fullscreen",       # fullscreen | embed | cover (앨범 커버 생성기: title, artist, small, font, pos, color, obi, obiColor 로 초기값, mood: day|dusk|evening 이면 열 때마다 그 분위기의 무작위 장면, music: {src, title, artist} 면 LP 플레이어)
  "url_state": true,            # 주소 끝(#nagai=…)에 장면을 담아 다시 열 수 있게 (fullscreen 기본 켬)
  "aspect": "3:2",              # 처음 비율: 3:2 (가로, 기본) | 9:16 (모바일 세로) | 1:1 (정사각) | auto (세로로 긴 화면이면 9:16). 컨트롤에서 바로 바꿀 수 있다
  "description": "",            # (선택) 페이지 설명 meta 태그
  "head_html": "",              # (선택) <head> 에 그대로 넣을 태그 (홈 화면 아이콘·manifest·theme-color 등)
  "palm_detail": false,         # (선택) 야자수를 잎마다 정밀하게 (기본 false: 가볍게, 컨트롤에서 바꿀 수 있음)
  "lang": "ko",                 # (선택) 컨트롤 문구: ko | en | auto (주소 ?lang= → 마지막 선택 → 브라우저 언어). 전환 버튼은 "ui": {"lang": true}
  "lib_src": "",                # (선택) 라이브러리를 품지 않고 링크로: "/nagai-scene.min.js" → <script src="…?v=버전">. 사이트처럼 페이지가 여럿일 때
  "controls": true,             # 컨트롤 표시 여부
  "ui": {"pick": true},         # 컨트롤 일부만: info, seed, jitter, wind, pause, pick
  "caption": "",                # embed 모드에서 그림 아래 설명
  "extend_js": ""               # (선택) 새 객체를 등록하고 장면에 추가하는 JS. references/style-guide.md 참고
}
결과물은 라이브러리를 통째로 품은 단일 HTML 파일이라 어디서든 열린다.
"""
import html
import json
import re
import random
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
LIB = (HERE.parent / 'assets' / 'nagai-scene.js').read_text(encoding='utf-8')
LIB_VERSION = (re.search(r"version: '([^']+)'", LIB) or [None, 'dev'])[1]


def lib_tag(cfg: dict) -> str:
    """라이브러리를 넣는 <script>. lib_src 가 있으면 링크로 (사이트용, ?v=버전 으로 캐시 갱신), 없으면 통째로 품는다 (파일 하나로 어디서든 열림)"""
    src = cfg.get('lib_src')
    if src:
        return f'<script src="{html.escape(src, quote=True)}?v={LIB_VERSION}"></script>\n'
    return '<script>\n' + LIB.replace('</script', '<\\/script') + '\n</script>\n'

HEAD = """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>{meta}
<style>
:root{{--bg:#0c2a78;--panel:rgba(255,255,255,.86);--ink:#10223f;--line:rgba(16,34,63,.15);
  box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}}
@media (prefers-color-scheme:dark){{:root:not([data-theme="light"]){{--panel:rgba(10,20,40,.82);--ink:#e8eef8;--line:rgba(232,238,248,.18)}}}}
:root[data-theme="dark"]{{--panel:rgba(10,20,40,.82);--ink:#e8eef8;--line:rgba(232,238,248,.18)}}
html,body{{margin:0;height:100%}}
body{{font-family:"Pretendard","Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;color:var(--ink);background:{body_bg}}}
{layout_css}
</style>
</head>
<body>
"""

FULL_CSS = """body{overflow:hidden;display:flex;flex-direction:column;height:100vh;height:100dvh}
#stage{flex:1 1 auto;min-height:0;container-type:size;display:grid;place-items:center}
#art{display:block;width:min(100cqw,calc(100cqh * 3 / 2))!important;height:auto!important;aspect-ratio:3/2!important;margin:0!important}
#art[data-aspect="9:16"]{width:min(100cqw,calc(100cqh * 9 / 16))!important;aspect-ratio:9/16!important}
#art[data-aspect="1:1"]{width:min(100cqw,100cqh)!important;aspect-ratio:1/1!important}
#ctl{flex:0 0 auto;max-height:45vh;overflow:auto;box-sizing:border-box;
  background:var(--panel);border-top:1px solid var(--line);padding:10px 16px calc(10px + env(safe-area-inset-bottom,0px))}
#ctl:empty{display:none}"""

EMBED_CSS = """body{background:#fbfaf7;color:#1d2433}
main{max-width:900px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:22px;margin:0 0 14px}
#art{border-radius:6px}
figcaption{color:#5b6475;font-size:13px;margin-top:6px}
@media (prefers-color-scheme:dark){body{background:#14171d;color:#e6e9ef}figcaption{color:#9aa3b2}}"""



COVER = (HERE.parent / 'assets' / 'cover.html').read_text(encoding='utf-8')


def head_extra(cfg: dict) -> str:
    """config 의 head_html (홈 화면 아이콘 등) 을 <head> 끝에 넣을 문자열로"""
    h = cfg.get('head_html', '').strip()
    return h + '\n' if h else ''


def build_cover(cfg: dict):
    """앨범 커버 생성기 페이지 (정사각 장면 + 제목·아티스트 타이포 + 일본 LP 띠지 + 3000×3000 저장)"""
    # mood 가 있으면 열 때마다 그 분위기의 시드를 고르므로, seed 는 못 찾았을 때만 쓰는 고정값 (다시 빌드해도 파일이 안 바뀌게)
    seed = cfg.get('seed') or (1 if cfg.get('mood') else random.randint(1, 99999))
    conf = {k: cfg[k] for k in ('force', 'wind', 'mood', 'music', 'lang', 'title', 'artist', 'small', 'font', 'pos', 'color', 'obi', 'obiColor') if k in cfg}
    conf['seed'] = seed
    page = (COVER.replace('__TITLE__', html.escape(cfg.get('title_page', 'City Pop Cover')))
            .replace('</head>', head_extra(cfg) + '</head>', 1)
            .replace('<script>\n/*__NAGAI_LIB__*/\n</script>\n', lib_tag(cfg))
            .replace('/*__COVER_CONFIG__*/', json.dumps(conf, ensure_ascii=False).replace('</', '<\\/')))
    return page, seed


def build(cfg: dict):
    layout = cfg.get('layout', 'fullscreen')
    if layout == 'cover':
        return build_cover(cfg)
    seed = cfg.get('seed') or random.randint(1, 99999)
    opts = {
        'canvas': '#art',
        'controls': '#ctl' if cfg.get('controls', True) else None,
        'seed': seed,
        'jitter': cfg.get('jitter'),
        'force': cfg.get('force', {}),
        'wind': cfg.get('wind', 0.6),
        'ui': cfg.get('ui', {}),
    }
    aspect = cfg.get('aspect', '3:2')
    if aspect not in ('3:2', '9:16', '1:1', 'auto'):
        raise SystemExit(f'aspect 는 3:2, 9:16, 1:1, auto 중 하나: {aspect}')
    if aspect != 'auto':
        opts['aspect'] = aspect           # 세로(9:16)는 라이브러리가 세로 구도로 새로 짠다
    # 주소 끝(#nagai=장면코드)으로 장면을 열고 저장한다. 한 페이지 한 장면인 fullscreen 에서 기본으로 켠다
    opts['urlState'] = cfg.get('url_state', layout == 'fullscreen')
    if cfg.get('palm_detail'):
        opts['palmDetail'] = True        # 야자수를 잎마다(휘고 떨림) 그리기. 기본은 가볍게(잎 도장)
    if cfg.get('lang'):
        opts['lang'] = cfg['lang']       # 컨트롤 문구 언어 (ko | en | auto)
    title = cfg.get('title', '나가이 히로시 스타일')
    css = FULL_CSS if layout == 'fullscreen' else EMBED_CSS
    desc = cfg.get('description', '')
    meta = f'\n<meta name="description" content="{html.escape(desc, quote=True)}">' if desc else ''
    if head_extra(cfg):
        meta += '\n' + head_extra(cfg).rstrip('\n')
    out = [HEAD.format(title=html.escape(title), meta=meta, body_bg='#0c2a78' if layout == 'fullscreen' else '#fbfaf7', layout_css=css)]
    if layout == 'fullscreen':
        out.append('<div id="stage"><canvas id="art"></canvas></div>\n<div id="ctl"></div>\n')
    else:
        cap = cfg.get('caption', '')
        out.append(f'<main><h1>{title}</h1><figure style="margin:0"><canvas id="art"></canvas>'
                   f'<div id="ctl"></div>' + (f'<figcaption>{cap}</figcaption>' if cap else '') + '</figure></main>\n')
    # 라이브러리를 그대로 품는다 (</script 가 섞이면 태그가 끊기므로 이스케이프)
    out.append(lib_tag(cfg))
    extend = cfg.get('extend_js', '').strip()
    out.append('<script>\n')
    if extend:
        out.append(extend.replace('</script', '<\\/script') + '\n')
    out.append("const __opts = " + json.dumps(opts, ensure_ascii=False) + ";\n")
    if aspect == 'auto':                  # 세로로 긴 화면(휴대폰)이면 모바일 구도로 시작
        out.append("__opts.aspect = innerWidth < innerHeight ? '9:16' : '3:2';\n")
    if extend:
        out.append("if (typeof extendScene === 'function') __opts.extend = extendScene;\n")
    out.append("window.nagai = NagaiScene.mount(__opts);\n")
    out.append('</script>\n</body>\n</html>\n')
    return ''.join(out), seed


if __name__ == '__main__':
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    cfg = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    page, seed = build(cfg)
    Path(sys.argv[2]).write_text(page, encoding='utf-8')
    print(f'wrote {sys.argv[2]} ({len(page) // 1024} KB), seed={seed}')
