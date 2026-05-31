# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the project

No build step or dev server required. Open `tictactoe/index.html` directly in a browser:

```
open tictactoe/index.html
```

Deployed to GitHub Pages at `https://aarizsurani12-prog.github.io/Tic-Tac-Toe/`.

## Architecture

Three vanilla files — no framework, no bundler, no dependencies.

- **`index.html`** — static markup only; no logic. Each `.cell` contains an inline SVG with both the X lines (`.x-line1`, `.x-line2`) and O circle (`.o-circle`) — CSS shows/hides them via `.mark-x` / `.mark-o`. `#winLineSvg` / `#winLineEl` is a separate full-board SVG overlay for the animated win-line stroke.
- **`style.css`** — all visual state is driven by CSS classes toggled from JS. Key classes on `#board`: `state-player`, `state-bot`, `state-win`, `state-lose`, `state-draw`, `game-over`, `draw-result`, `shake`, `player-turn`, `p2-turn`. Key classes on `.cell`: `taken`, `locked`, `win-cell`, `pop`, `clearing`, `mark-x`, `mark-o`. Cell sizing uses `min(26vw, 110px)` for mobile responsiveness.
- **`script.js`** — all game state and logic.

### Game state (`script.js`)

Global flags: `board` (flat `Array(9)` of `null | 'X' | 'O'`), `gameOver`, `botThinking`, `resetting` (blocks clicks during board-clear animation), `mode` (`'bot' | 'friend'`), `currentPlayer`, `scores`.

Index layout: 0–2 top row, 3–5 middle, 6–8 bottom.

### Modes

`mode === 'bot'` — player is X, bot is O. `mode === 'friend'` — P1 is X, P2 is O, `diffWrap` is hidden. Switching modes resets scores and calls `resetGame()`.

### Bot difficulty levels

| Value | Function | Behavior |
|---|---|---|
| `easy` | `randomMove(b)` | Picks a random empty cell |
| `medium` | `mediumMove(b)` | Wins if possible, blocks player win, else random |
| `hard` | `minimaxMove(b)` | Perfect play via `minimax()` — unbeatable |

`diffSelect` is disabled once a game starts and re-enabled on reset or game end.

### Sound system (`Sound` module in `script.js`)

Self-contained IIFE using the Web Audio API — no audio files. `Sound.init()` must be called on first user gesture (browser autoplay policy); it's idempotent and called at the top of every interaction handler. Sound effects: `moveX()`, `moveO()`, `win()`, `lose()`, `draw()`. `Sound.toggleMute()` fades `masterGain` smoothly and returns the new muted state.

### Theme system

Three themes cycled via `themeBtn`: `dark` → `light` → `neon`. Applied as `document.documentElement.dataset.theme`. Win-line stroke color reads from CSS custom properties `--x-win-line` / `--o-win-line` via `cssVar()`.

### Visual effects

- **Win line**: `drawWinLine(line, winner)` positions `#winLineEl` between the first and last winning cells using `getBoundingClientRect`, then triggers a CSS stroke-dashoffset animation.
- **Confetti**: `spawnConfetti(winner)` creates 55 `.confetti-particle` divs with randomized position, size, color, and CSS `--tx`/`--ty`/`--rot` custom properties, then removes them after animation.
- **Turn dots**: `#dotPlayer` / `#dotBot` get `.active` toggled by `updateTurnDots()`.
- **Score bump**: `bumpScore(el)` re-triggers a `.bump` CSS animation on score elements.
