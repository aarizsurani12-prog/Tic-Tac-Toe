const LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

let board         = Array(9).fill(null);
let gameOver      = false;
let botThinking   = false;
let resetting     = false;
let mode          = 'bot';
let currentPlayer = 'X';
let scores        = { player: 0, bot: 0, draw: 0 };

const cells       = document.querySelectorAll('.cell');
const statusEl    = document.getElementById('status');
const resetBtn    = document.getElementById('resetBtn');
const diffSelect  = document.getElementById('difficulty');
const diffWrap    = document.getElementById('diffWrap');
const muteBtn     = document.getElementById('muteBtn');
const themeBtn    = document.getElementById('themeBtn');
const modeToggle  = document.getElementById('modeToggle');
const boardEl     = document.getElementById('board');
const winLineSvg  = document.getElementById('winLineSvg');
const winLineEl   = document.getElementById('winLineEl');
const scorePlayer = document.getElementById('scorePlayer');
const scoreBot    = document.getElementById('scoreBot');
const scoreDraw   = document.getElementById('scoreDraw');
const labelPlayer = document.getElementById('labelPlayer');
const labelBot    = document.getElementById('labelBot');
const dotPlayer   = document.getElementById('dotPlayer');
const dotBot      = document.getElementById('dotBot');

// ---------- Sound ----------

const Sound = (() => {
  let ctx = null, masterGain = null, muted = false, ready = false;

  function init() {
    if (ready) return;
    ready = true;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.85;
    masterGain.connect(ctx.destination);
  }

  function tone(freq, dur, vol = 0.3, type = 'sine', delay = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  return {
    init,
    toggleMute() {
      muted = !muted;
      if (ctx) masterGain.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.1);
      return muted;
    },
    moveX() { tone(523.25, 0.18, 0.28); tone(783.99, 0.10, 0.08, 'sine', 0.01); },
    moveO() { tone(392.00, 0.20, 0.22); tone(587.33, 0.10, 0.06, 'sine', 0.01); },
    win()   { [523.25,659.25,783.99,1046.5].forEach((f,i) => tone(f,0.35,0.3,'sine',i*0.13)); },
    lose()  { [392.00,329.63,261.63,196.00].forEach((f,i) => tone(f,0.4,0.22,'sine',i*0.16)); },
    draw()  { tone(392.00,0.25,0.20); tone(349.23,0.45,0.14,'sine',0.22); },
  };
})();

// ---------- Theme ----------

const themes = [
  { name: 'dark',  icon: '🌙' },
  { name: 'light', icon: '☀️' },
  { name: 'neon',  icon: '⚡' },
];
let themeIdx = 0;

themeBtn.addEventListener('click', () => {
  themeIdx = (themeIdx + 1) % themes.length;
  const t = themes[themeIdx];
  document.documentElement.dataset.theme = t.name;
  themeBtn.textContent = t.icon;
});

// ---------- Visual helpers ----------

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function setBoardState(state) {
  boardEl.classList.remove('state-player','state-bot','state-win','state-lose','state-draw','player-turn','p2-turn');
  if (state) boardEl.classList.add('state-' + state);
}

function setTurnClasses() {
  boardEl.classList.remove('player-turn', 'p2-turn');
  if (gameOver || botThinking || resetting) return;
  if (mode === 'bot' || currentPlayer === 'X') boardEl.classList.add('player-turn');
  else boardEl.classList.add('p2-turn');
}

function updateTurnDots() {
  dotPlayer.classList.remove('active');
  dotBot.classList.remove('active');
  if (gameOver || resetting) return;
  const isX = mode === 'bot' || currentPlayer === 'X';
  (isX ? dotPlayer : dotBot).classList.add('active');
}

function drawWinLine(line, winner) {
  const boardRect = boardEl.getBoundingClientRect();
  const r0 = cells[line[0]].getBoundingClientRect();
  const r2 = cells[line[2]].getBoundingClientRect();
  const x1 = r0.left + r0.width  / 2 - boardRect.left;
  const y1 = r0.top  + r0.height / 2 - boardRect.top;
  const x2 = r2.left + r2.width  / 2 - boardRect.left;
  const y2 = r2.top  + r2.height / 2 - boardRect.top;

  winLineSvg.setAttribute('viewBox', `0 0 ${boardRect.width} ${boardRect.height}`);
  winLineEl.setAttribute('x1', x1); winLineEl.setAttribute('y1', y1);
  winLineEl.setAttribute('x2', x2); winLineEl.setAttribute('y2', y2);

  const len = Math.hypot(x2 - x1, y2 - y1) + 20;
  winLineEl.style.strokeDasharray  = len;
  winLineEl.style.strokeDashoffset = len;
  winLineEl.style.stroke = cssVar(winner === 'X' ? '--x-win-line' : '--o-win-line');

  winLineEl.classList.remove('draw');
  void winLineEl.offsetWidth;
  winLineEl.classList.add('draw');
}

function bumpScore(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function updateLabels() {
  labelPlayer.textContent = mode === 'bot' ? 'You (X)' : 'P1 (X)';
  labelBot.textContent    = mode === 'bot' ? 'Bot (O)' : 'P2 (O)';
}

// ---------- Confetti ----------

function spawnConfetti(winner) {
  const main = cssVar(winner === 'X' ? '--x-color' : '--o-color');
  const alt  = cssVar(winner === 'X' ? '--o-color' : '--x-color');
  const palette = [main, main, main, alt, '#fbbf24', '#ffffff'];
  const boardRect = boardEl.getBoundingClientRect();

  for (let i = 0; i < 55; i++) {
    const el  = document.createElement('div');
    el.className = 'confetti-particle';

    const color    = palette[Math.floor(Math.random() * palette.length)];
    const w        = 5 + Math.random() * 10;
    const h        = 5 + Math.random() * 10;
    const br       = Math.random() > 0.5 ? '50%' : Math.random() > 0.5 ? '2px' : '0';
    const dur      = 0.75 + Math.random() * 0.7;
    const delay    = Math.random() * 0.22;
    const ox       = boardRect.left + boardRect.width  * Math.random();
    const oy       = boardRect.top  + boardRect.height * Math.random();
    const angle    = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 1.3;
    const dist     = 90 + Math.random() * 170;
    const tx       = Math.cos(angle) * dist;
    const ty       = Math.sin(angle) * dist;

    el.style.left         = `${ox}px`;
    el.style.top          = `${oy}px`;
    el.style.width        = `${w}px`;
    el.style.height       = `${h}px`;
    el.style.background   = color;
    el.style.borderRadius = br;
    el.style.setProperty('--tx',  `${tx}px`);
    el.style.setProperty('--ty',  `${ty}px`);
    el.style.setProperty('--rot', `${Math.random()*720-360}deg`);
    el.style.animation    = `confettiFly ${dur}s ease-out ${delay}s both`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), (dur + delay + 0.25) * 1000);
  }
}

// ---------- Game logic ----------

function checkWinner(b) {
  for (const [a, c, d] of LINES)
    if (b[a] && b[a] === b[c] && b[a] === b[d]) return { winner: b[a], line: [a, c, d] };
  return null;
}

function isDraw(b) { return b.every(Boolean) && !checkWinner(b); }

function renderBoard() {
  cells.forEach((cell, i) => {
    const mark = board[i];
    cell.classList.toggle('mark-x', mark === 'X');
    cell.classList.toggle('mark-o', mark === 'O');
    cell.classList.toggle('taken', !!mark);
  });
}

function setStatus(text, cls = '') {
  statusEl.innerHTML = text;
  statusEl.className = 'status' + (cls ? ' ' + cls : '');
}

function lockBoard()   { cells.forEach(c => c.classList.add('locked')); }
function unlockBoard() {
  cells.forEach(c => {
    c.classList.remove('locked');
    if (!board[c.dataset.index]) c.classList.remove('taken');
  });
}

function highlightWin(line, winner) {
  // Stagger the bounce of the 3 winning cells
  line.forEach((i, idx) => {
    cells[i].style.animationDelay = `${idx * 75}ms`;
    cells[i].classList.add('win-cell');
  });
  drawWinLine(line, winner);
}

function placeMarker(index, mark) {
  board[index] = mark;
  const cell = cells[index];
  cell.classList.add('taken', mark === 'X' ? 'mark-x' : 'mark-o', 'pop');
  setTimeout(() => cell.classList.remove('pop'), 380);
}

// winnerMark: 'X' | 'O' | null (draw)
function endGame(winnerMark) {
  gameOver = true;
  lockBoard();
  diffSelect.disabled = false;
  updateTurnDots();

  if (!winnerMark) {
    scores.draw++;
    setStatus("It's a draw!", 'draw');
    setBoardState('draw');
    boardEl.classList.add('game-over', 'draw-result', 'shake');
    setTimeout(() => boardEl.classList.remove('shake'), 560);
    Sound.draw();
    scoreDraw.textContent = scores.draw;
    bumpScore(scoreDraw);
  } else {
    boardEl.classList.add('game-over');
    spawnConfetti(winnerMark);

    if (winnerMark === 'X') {
      scores.player++;
      setStatus(mode === 'bot' ? 'You win! 🎉' : 'Player 1 wins! 🎉', 'player-win');
      setBoardState('win');
      Sound.win();
      scorePlayer.textContent = scores.player;
      bumpScore(scorePlayer);
    } else {
      scores.bot++;
      if (mode === 'bot') {
        setStatus('Bot wins! 🤖', 'bot-win');
        setBoardState('lose');
        Sound.lose();
      } else {
        setStatus('Player 2 wins! 🎉', 'p2-win');
        setBoardState('win');
        Sound.win();
      }
      scoreBot.textContent = scores.bot;
      bumpScore(scoreBot);
    }
  }
}

// ---------- Bot logic ----------

function emptyIndices(b) {
  return b.reduce((acc, v, i) => { if (!v) acc.push(i); return acc; }, []);
}

function randomMove(b) {
  const e = emptyIndices(b);
  return e[Math.floor(Math.random() * e.length)];
}

function mediumMove(b) {
  for (const i of emptyIndices(b)) { b[i]='O'; if (checkWinner(b)) { b[i]=null; return i; } b[i]=null; }
  for (const i of emptyIndices(b)) { b[i]='X'; if (checkWinner(b)) { b[i]=null; return i; } b[i]=null; }
  return randomMove(b);
}

function minimax(b, depth, isMax) {
  const r = checkWinner(b);
  if (r) return r.winner === 'O' ? 10 - depth : depth - 10;
  if (b.every(Boolean)) return 0;
  const e = emptyIndices(b);
  if (isMax) {
    let best = -Infinity;
    for (const i of e) { b[i]='O'; best=Math.max(best,minimax(b,depth+1,false)); b[i]=null; }
    return best;
  } else {
    let best = Infinity;
    for (const i of e) { b[i]='X'; best=Math.min(best,minimax(b,depth+1,true)); b[i]=null; }
    return best;
  }
}

function minimaxMove(b) {
  const e = emptyIndices(b);
  let best = -Infinity, idx = e[0];
  for (const i of e) {
    b[i] = 'O';
    const s = minimax(b, 0, false);
    b[i] = null;
    if (s > best) { best = s; idx = i; }
  }
  return idx;
}

function botMove() {
  const d = diffSelect.value;
  if (d === 'easy')   return randomMove(board);
  if (d === 'medium') return mediumMove(board);
  return minimaxMove(board);
}

// ---------- Game flow ----------

function handleCellClick(e) {
  Sound.init();
  if (resetting) return;
  const index = +e.currentTarget.dataset.index;
  if (gameOver || botThinking || board[index]) return;

  if (mode === 'bot') {
    diffSelect.disabled = true;
    placeMarker(index, 'X');
    Sound.moveX();

    const winResult = checkWinner(board);
    if (winResult) { highlightWin(winResult.line, winResult.winner); endGame(winResult.winner); return; }
    if (isDraw(board)) { endGame(null); return; }

    botThinking = true;
    lockBoard();
    setBoardState('bot');
    setTurnClasses();
    updateTurnDots();
    setStatus('Bot is thinking… <span class="dot-flashing"><span></span><span></span><span></span></span>', 'thinking');

    setTimeout(() => {
      const move = botMove();
      placeMarker(move, 'O');
      Sound.moveO();
      botThinking = false;

      const botResult = checkWinner(board);
      if (botResult) { renderBoard(); highlightWin(botResult.line, botResult.winner); endGame(botResult.winner); return; }
      if (isDraw(board)) { renderBoard(); endGame(null); return; }

      unlockBoard();
      renderBoard();
      setBoardState('player');
      setTurnClasses();
      updateTurnDots();
      setStatus('Your turn (X)');
    }, 420);

  } else {
    placeMarker(index, currentPlayer);
    currentPlayer === 'X' ? Sound.moveX() : Sound.moveO();

    const winResult = checkWinner(board);
    if (winResult) { highlightWin(winResult.line, winResult.winner); endGame(winResult.winner); return; }
    if (isDraw(board)) { endGame(null); return; }

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    setBoardState(currentPlayer === 'X' ? 'player' : 'bot');
    setTurnClasses();
    updateTurnDots();
    setStatus(currentPlayer === 'X' ? "Player 1's turn (X)" : "Player 2's turn (O)");
  }
}

// ---------- Reset with animated board-clear ----------

function resetGame() {
  if (resetting) return;
  resetting = true;
  gameOver  = true;   // block clicks during animation
  botThinking = false;

  // Animate occupied cells out with random stagger
  cells.forEach(c => {
    if (c.classList.contains('mark-x') || c.classList.contains('mark-o')) {
      c.style.animationDelay = Math.random() * 130 + 'ms';
      c.classList.add('clearing');
    }
  });

  setTimeout(() => {
    board         = Array(9).fill(null);
    gameOver      = false;
    resetting     = false;
    currentPlayer = 'X';

    cells.forEach(c => {
      c.style.animationDelay = '';
      c.className = 'cell';
    });
    boardEl.classList.remove('game-over', 'draw-result', 'shake');
    winLineEl.classList.remove('draw');
    winLineEl.style.strokeDasharray  = '10000';
    winLineEl.style.strokeDashoffset = '10000';

    diffSelect.disabled = false;
    setBoardState('player');
    setTurnClasses();
    updateTurnDots();
    setStatus(mode === 'bot' ? 'Your turn (X)' : "Player 1's turn (X)");
  }, 450);  // 130ms max stagger + 300ms animation + 20ms buffer
}

// ---------- Init ----------

cells.forEach(cell => cell.addEventListener('click', handleCellClick));

resetBtn.addEventListener('click', resetGame);

modeToggle.addEventListener('click', e => {
  const btn = e.target.closest('.mode-btn');
  if (!btn || btn.dataset.mode === mode) return;
  mode = btn.dataset.mode;
  modeToggle.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('active', b === btn));
  diffWrap.style.display = mode === 'bot' ? '' : 'none';
  scores = { player: 0, bot: 0, draw: 0 };
  scorePlayer.textContent = '0';
  scoreBot.textContent    = '0';
  scoreDraw.textContent   = '0';
  updateLabels();
  resetGame();
});

muteBtn.addEventListener('click', () => {
  Sound.init();
  const nowMuted = Sound.toggleMute();
  muteBtn.textContent = nowMuted ? '🔇' : '🔊';
  muteBtn.title = nowMuted ? 'Unmute' : 'Mute';
});

// Initialize turn dots
updateTurnDots();
