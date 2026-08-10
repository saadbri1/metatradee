# Brand icons — favicon and app icon

## Why this file exists

`src/app/favicon.ico` and `src/app/apple-icon.png` are binaries. Without a record
of where their geometry and colours came from, the next person to touch the brand
has to guess, and a favicon that drifts from the mark is how a brand ends up with
two slightly different identities.

## Source of truth

The mark is **"The Tier"**, defined in
`src/features/marketing/components/brand-mark.tsx`. Its geometry is fixed by the
identity spec and must not be redrawn:

```
viewBox      0 0 32 32
meta-plane   x=8.5  y=8     w=20  h=6.5  rx=2.2
base plane   x=3.5  y=17.5  w=20  h=6.5  rx=2.2
```

The icons use the **light-appearance** token values, because a favicon renders on
a light surface in browser tabs and in Google Search results and has no theme
context to react to:

| Element    | Token          | Value     |
| ---------- | -------------- | --------- |
| meta-plane | `--primary`    | `#3D4FE0` |
| base plane | `--foreground` | `#0E1016` |
| tile       | `--background` | `#FBFBFD` |

Those values come from `src/styles/tokens.css` (`.light` block). Nothing here is
invented, and no colour is hardcoded that is not already a brand token.

## The tile

`BrandMark` renders with **no tile** — that rule governs the mark in the product,
where it sits on a themed surface. An icon has no such surface: it is a fixed
square composited onto browser chrome or a search result, and the base plane is
near-black, so on a dark tab strip an untiled mark would lose half of itself. The
icons therefore place the unmodified mark on the brand's own light background.

`favicon.ico` has rounded corners (radius 7 of 32, matching the supplied app-icon
reference). `apple-icon.png` is full-bleed square, because iOS applies its own
corner mask and would otherwise round an already-rounded shape.

## Files

| File                     | Contents                                 | Serves as         |
| ------------------------ | ---------------------------------------- | ----------------- |
| `src/app/favicon.ico`    | 256, 128, 64, 48, 32, 16 — largest first | `/favicon.ico`    |
| `src/app/apple-icon.png` | 180×180, full-bleed                      | `/apple-icon.png` |

Both use the Next.js App Router file convention, so the `<link>` tags are emitted
by the framework. **Do not add `metadata.icons`** to a layout as well — that
produces a second, competing declaration.

**Layer order matters.** Next.js reads the _first_ ICO directory entry to fill the
`sizes` attribute. Written ascending (the order Pillow produces by default) the
homepage advertises `sizes="16x16"` for a file that actually contains a 256px
layer, which understates the asset to Google, whose guidance prefers icons well
above 48×48. Written largest-first it advertises `sizes="256x256"`. The directory
is assembled by hand for this reason.

## Regenerating

Only when the identity spec itself changes. Render each layer from the geometry
above at 8× and downsample with Lanczos; assemble the ICO directory in descending
size order with PNG-compressed entries. Then confirm the emitted markup:

```bash
pnpm build
grep -oE '<link[^>]*rel="[^"]*icon[^"]*"[^>]*>' .next/server/app/index.html
```

Expected, exactly two lines and no more:

```
<link rel="icon" href="/favicon.ico" type="image/x-icon" sizes="256x256"/>
<link rel="apple-touch-icon" href="/apple-icon.png?<hash>" type="image/png" sizes="180x180"/>
```

## Not the same thing as the Organization logo

The `Organization` structured data carries a `logo`, and Google uses that for
knowledge-panel style surfaces. It is **not** the search-result favicon and does
not substitute for one — the favicon is resolved from `/favicon.ico` and the
`rel="icon"` link. Keep both accurate; do not point one at the other expecting it
to stand in.
