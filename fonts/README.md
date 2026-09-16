# fonts

The type the name screen's card is written in (`src/medium/type.js`, guidelines/name.md § the type) — Noto Sans and Noto Sans KR,
under the SIL Open Font License 1.1 (`OFL-NotoSans.txt`, `OFL-NotoSansKR.txt`). Served from here rather than from a font service:
a service that sends only the slices of a font a page's text needs would learn which characters a visitor's name holds, and a
name typed and drawn on the name screen reaches no request (only a shared link carries one, in its own address). The page loads all
four files whatever is typed.

| File | From | Weight | Characters |
| --- | --- | --- | --- |
| `noto-sans-500.woff2` · `noto-sans-700.woff2` | `google/fonts` `ofl/notosans/NotoSans[wdth,wght].ttf` | 500 · 700, width 100 | Latin (Basic, Latin-1, Extended-A and -B, Extended Additional), Greek, Cyrillic, general punctuation, € ™ |
| `noto-sans-kr-500.woff2` · `noto-sans-kr-700.woff2` | `google/fonts` `ofl/notosanskr/NotoSansKR[wght].ttf` | 500 · 700 | every Hangul syllable (11,172), the jamo, hiragana and katakana, CJK and full-width punctuation, · × • ★ ☆ ♡ ♥ |

Made with fontTools 4.60 (`pip install fonttools brotli`) — an instance of the variable font at each weight, then a subset:

```bash
fonttools varLib.instancer "NotoSans[wdth,wght].ttf" wght=700 wdth=100 -o latin-700.ttf
pyftsubset latin-700.ttf --unicodes="U+0020-007E,U+00A0-00FF,U+0100-024F,U+0370-03FF,U+0400-04FF,U+1E00-1EFF,U+2010-2027,U+2030-203A,U+20AC,U+2122,U+2605-2606,U+2661,U+2665" \
  --flavor=woff2 --layout-features='*' --no-hinting --desubroutinize --output-file=noto-sans-700.woff2

fonttools varLib.instancer "NotoSansKR[wght].ttf" wght=700 -o kr-700.ttf
pyftsubset kr-700.ttf --unicodes="U+0020-007E,U+00B7,U+00D7,U+1100-11FF,U+3000-303F,U+3040-30FF,U+3130-318F,U+AC00-D7A3,U+FF00-FFEF,U+2022,U+2605-2606,U+2661,U+2665" \
  --flavor=woff2 --layout-features='*' --no-hinting --desubroutinize --output-file=noto-sans-kr-700.woff2
```

The same with 500. A character in neither — a kanji, a hanja, an emoji — falls to the platform's font, and is traced all the same.
