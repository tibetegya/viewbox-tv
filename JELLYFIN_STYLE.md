# Jellyfin TV-layout reference (measured)

Measured on the user's Jellyfin 10.11.6 web client, **TV layout** (`localStorage.layout = "tv"`), 1920×1080, 2026-09-29. This file holds our own notes and numbers. No jellyfin-web code is copied (it's GPL-2.0); the CSS in `src/shell/jellyfin.css` is written from these measurements.

## Tokens
| Token | Value |
|---|---|
| Page background | `#101010` |
| Header background | `#202020` (height 87 px); over the player: `linear-gradient(rgba(15,15,15,.75), rgba(15,15,15,0))`, 150 px |
| Accent (focus fill, progress, badges, links) | `#00a4dc` |
| Text | `rgba(255,255,255,.8)`; secondary `rgba(255,255,255,.5)`; header inactive tab `#999`, active `#fff` |
| Font | "Noto Sans", sans-serif; base 20 px / 27 px |
| Section title | 30 px / 400, padding `15px 0 6px 63px` |
| Card text | 20 px centred, padding `4.8px 10px 1.2px`; secondary 17.2 px, 50 % white |
| Rating badge | 18.4 px, bg `rgba(170,170,190,.2)`, radius 4.6 px, padding `4px 9px`, colour `#ddd` |
| Star rating | gold star + number, 20 px |
| Progress bar | 5.6 px high, fill `#00a4dc`, track `rgba(51,51,51,.8)`, at the image's bottom edge |
| Unwatched badge | blue circle (`#00a4dc`), white count, top-right of poster |
| Watched badge | blue circle with ✓, top-right |

## Focus
- Cards: **no outline**. The `.cardBox` scales **1.07** (`transition: transform .2s ease-out`) and the card gets `z-index: 10`.
- Buttons (details icon row, OSD): the focused button fills with the accent (`#00a4dc`, radius 4.3 px, 71×65 px incl. padding `15px 18px`). Unfocused buttons are bare white icons.
- Text links (tags, suggestions): focused = accent background.

## Header (home)
Logo left (48 px). Centred tabs **Home · Favourites** (20 px/600, padding 30 px). Right: SyncPlay, Search, User icons and a clock (20 px). On inner pages: Back ← and Home icons left, page title (22 px) next to them; libraries show their own centred tabs (Shows · Suggestions · Upcoming · Genres · TV Networks · Episodes).

## Home
Rows, each a section title plus a horizontal card row starting at x = 63 px:
- **My Media**: backdrop tiles 427×240 (16:9) with the library name centred under them.
- **Continue Watching**: landscape 16:9 cards 427×240 (4 per screen, gap 24 px), progress bar on the image bottom, title + "S2:E15 - Temp Check" (or year) under it.
- **Next Up**: same landscape cards, subtitle "S12:E10 - No Lessons Learned".
- **Latest in <Library>**: portrait posters.

## Details (series / movie)
- Poster left: x 96, 480×720, radius 4 px.
- Right column from x 623:
  - Title 36 px/600.
  - Meta line (20 px): years or year · runtime · rating badge · ★ 7.1 · "Ends at 15:23".
  - Icon button row (Play focused by default, Trailer, Shuffle, Mark played ✓, Favourite ♥, More ⋮).
  - Movie: tagline 24 px. Overview 20 px/27 px.
  - "Tags:" line with bold links. Two-column table **Genre(s)** / **Studio** (label 20 px, value 20 px/600).
- Sections below: **Next Up** (one landscape card), **Series** (season posters with unwatched badges), **Cast & Crew** (portrait person cards).

## Season page
Poster left; title + "Season 12" (22 px/600) + icon buttons. Episode list rows: 16:9 thumbnail 576×384 with watched ✓ at the top-right; to its right "1. Atlanta" (30 px), a meta line "35m ★ 8.1 Ends at 14:00" (20 px, 60 % white), then the overview (20 px/28 px, 60 % white).

## Library (Shows / Movies)
Header with centred tabs. Toolbar row centred: "1-7 of 7", view ▦, sort A↕Z, filter ⏷. Poster grid 262×393 (2:3), title + years under each, unwatched badges. A–Z jump bar along the right edge.

## Search
Search field full width (x 410–1560, 52 px high, dark `#1c1c1c`-ish fill with a 3 px accent border when focused, search icon left). On-screen alphabet row "␣ A–Z ⌫" plus a digits row (20 px, 60 % white; focused letter = accent). "Suggestions" heading (30 px) and a centred list of accent-coloured title links. Results replace suggestions with rows of cards (Movies, Shows, Episodes, People).

## Player OSD
- Top: gradient header with ← and "Ant-Man (2015)" (23 px), clock right.
- Bottom (full width, no panel; gradient from the bottom):
  - Time "0:01" left; a slider with a 4 px accent fill and a 22 px accent thumb; remaining "-1:57:04" right.
  - Button row: ⏪ ⏸ ⏩, "Ends at 15:23" (20 px) on the left; ♥, mute, volume slider, ⚙ settings, PiP, fullscreen on the right.
  - Buttons 56×56 with white icons; the focused one is accent-filled.
- A volume OSD appears at the top right when volume or mute changes.
