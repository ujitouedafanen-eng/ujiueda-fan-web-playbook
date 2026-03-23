// ============================================================
//  CONSTANTS
// ============================================================
const VISIBLE_ROWS = 20;
const BUFFER_ROWS = 4;
let boardRows = VISIBLE_ROWS + BUFFER_ROWS;
const BOARD_COLS = 10;
const CELL_SIZE = 30; // pixels per cell

const PIECE_COLORS = {
  I: '#00bcd4',
  O: '#ffd700',
  T: '#9c27b0',
  S: '#4caf50',
  Z: '#f44336',
  J: '#2196f3',
  L: '#ff9800',
};

const PIECE_ICONS = {
  I: 'I', O: 'O', T: 'T', S: 'S', Z: 'Z', J: 'J', L: 'L',
  ACE: '♠A', JOKER: '🃏',
};

// Rotation data: each piece has 4 rotation states,
// each state is an array of [row, col] offsets from pivot.
const PIECES = {
  I: {
    color: '#00bcd4',
    rotations: [
      [[-1,0],[-1,1],[-1,2],[-1,3]], // 0 - horizontal (spawn row -1 from pivot)
      [[0,2],[1,2],[2,2],[3,2]],      // R
      [[2,-1],[2,0],[2,1],[2,2]],     // 2
      [[0,0],[1,0],[2,0],[3,0]],      // L
    ],
  },
  O: {
    color: '#ffd700',
    rotations: [
      [[0,0],[0,1],[1,0],[1,1]],
      [[0,0],[0,1],[1,0],[1,1]],
      [[0,0],[0,1],[1,0],[1,1]],
      [[0,0],[0,1],[1,0],[1,1]],
    ],
  },
  T: {
    color: '#9c27b0',
    rotations: [
      [[0,0],[0,1],[0,2],[1,1]],
      [[0,1],[1,1],[2,1],[1,0]],
      [[1,0],[1,1],[1,2],[0,1]],
      [[0,0],[1,0],[2,0],[1,1]],
    ],
  },
  S: {
    color: '#4caf50',
    rotations: [
      [[0,1],[0,2],[1,0],[1,1]],
      [[0,0],[1,0],[1,1],[2,1]],
      [[1,0],[1,1],[2,2],[2,1]],  // same as 0 shifted
      [[0,0],[1,0],[1,1],[2,1]],
    ],
  },
  Z: {
    color: '#f44336',
    rotations: [
      [[0,0],[0,1],[1,1],[1,2]],
      [[0,1],[1,0],[1,1],[2,0]],
      [[1,0],[1,1],[2,1],[2,2]],
      [[0,1],[1,0],[1,1],[2,0]],
    ],
  },
  J: {
    color: '#2196f3',
    rotations: [
      [[0,0],[1,0],[1,1],[1,2]],
      [[0,0],[0,1],[1,0],[2,0]],
      [[0,0],[0,1],[0,2],[1,2]],
      [[0,1],[1,1],[2,0],[2,1]],
    ],
  },
  L: {
    color: '#ff9800',
    rotations: [
      [[0,2],[1,0],[1,1],[1,2]],
      [[0,0],[1,0],[2,0],[2,1]],
      [[0,0],[0,1],[0,2],[1,0]],
      [[0,0],[0,1],[1,1],[2,1]],
    ],
  },
};

const PIECE_KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];
const POOL_SPECIALS = ['ACE', 'JOKER'];

// SRS wall kick offsets: [from_rotation][test_index] = [row_offset, col_offset]
// Using simplified 5-test SRS
const WALL_KICKS = {
  '0>1': [[0,0],[0,-1],[1,-1],[-2,0],[-2,-1]],
  '1>0': [[0,0],[0, 1],[-1, 1],[ 2,0],[ 2, 1]],
  '1>2': [[0,0],[0, 1],[-1, 1],[ 2,0],[ 2, 1]],
  '2>1': [[0,0],[0,-1],[1,-1],[-2,0],[-2,-1]],
  '2>3': [[0,0],[0, 1],[1, 1],[-2,0],[-2, 1]],
  '3>2': [[0,0],[0,-1],[-1,-1],[ 2,0],[ 2,-1]],
  '3>0': [[0,0],[0,-1],[-1,-1],[ 2,0],[ 2,-1]],
  '0>3': [[0,0],[0, 1],[1, 1],[-2,0],[-2, 1]],
};

const WALL_KICKS_I = {
  '0>1': [[0,0],[0,-2],[0, 1],[1,-2],[-2, 1]],
  '1>0': [[0,0],[0, 2],[0,-1],[-1, 2],[ 2,-1]],
  '1>2': [[0,0],[0,-1],[0, 2],[-2,-1],[ 1, 2]],
  '2>1': [[0,0],[0, 1],[0,-2],[ 2, 1],[-1,-2]],
  '2>3': [[0,0],[0, 2],[0,-1],[1, 2],[-2,-1]],
  '3>2': [[0,0],[0,-2],[0, 1],[-1,-2],[ 2, 1]],
  '3>0': [[0,0],[0, 1],[0,-2],[-2, 1],[ 1,-2]],
  '0>3': [[0,0],[0,-1],[0, 2],[ 2,-1],[-1, 2]],
};

const TIMER_DURATION = 5000; // ms for Phase 2
const TIMER_CIRCUMFERENCE = 2 * Math.PI * 28; // r=28

// ============================================================
//  STATE
// ============================================================
let board = [];
let activePiece = null;

let gameState = {
  phase: 'INIT',   // INIT | PHASE1_PLAYING | PHASE1_GAMEOVER | PHASE2_IDLE | PHASE2_DRAWING | PHASE2_PLACING | PHASE2_JOKER | PHASE2_ACE | PHASE2_WIN
  // Phase 1
  linesCleared: 0,
  dropInterval: 800,
  lastDropTime: 0,
  bag: [],
  nextPieceType: null,
  // Phase 2
  aceCount: 1,
  excludedItems: new Set(),
  drawnItem: null,
  timerStart: null,
  phase2Lines: 0,
  phase2Turns: 0,
  flashRows: [],
  flashStart: null,
};

let rafId = null;
let keyState = {};
let keyRepeatTimers = {};
let renderOffset = BUFFER_ROWS; // Phase1: BUFFER_ROWS (hide buffer), Phase2: 0 (show all)

// ============================================================
//  SAVE / LOAD (localStorage)
// ============================================================
const SAVE_KEY = 'tetris_card_save';
const SAVE_VERSION = 1;
const ALLOWED_PHASES = new Set([
  'INIT',
  'PHASE1_PLAYING',
  'PHASE1_GAMEOVER',
  'PHASE2_IDLE',
  'PHASE2_DRAWING',
  'PHASE2_PLACING',
  'PHASE2_JOKER',
  'PHASE2_ACE',
  'PHASE2_WIN',
]);

function clampInt(value, min, max, fallback) {
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.trunc(value);
  return Math.min(max, Math.max(min, normalized));
}

function isAllowedColor(value) {
  return typeof value === 'string' && Object.values(PIECES).some(piece => piece.color === value);
}

function sanitizeBoard(candidate, expectedRows) {
  if (!Array.isArray(candidate) || candidate.length !== expectedRows) return null;

  const sanitized = [];
  for (const row of candidate) {
    if (!Array.isArray(row) || row.length !== BOARD_COLS) return null;
    sanitized.push(row.map(cell => (cell === 0 || isAllowedColor(cell) ? cell : 0)));
  }
  return sanitized;
}

function sanitizeGameState(candidate) {
  if (!candidate || typeof candidate !== 'object') return null;

  const sanitized = {
    phase: ALLOWED_PHASES.has(candidate.phase) ? candidate.phase : 'PHASE2_IDLE',
    linesCleared: clampInt(candidate.linesCleared, 0, 9999, 0),
    dropInterval: clampInt(candidate.dropInterval, 100, 800, 800),
    lastDropTime: 0,
    bag: [],
    nextPieceType: PIECE_KEYS.includes(candidate.nextPieceType) ? candidate.nextPieceType : null,
    aceCount: clampInt(candidate.aceCount, 0, 7, 1),
    excludedItems: [],
    drawnItem: null,
    timerStart: null,
    phase2Lines: clampInt(candidate.phase2Lines, 0, 9999, 0),
    phase2Turns: clampInt(candidate.phase2Turns, 0, 9999, 0),
    flashRows: [],
    flashStart: null,
  };

  if (Array.isArray(candidate.bag)) {
    sanitized.bag = candidate.bag.filter(item => PIECE_KEYS.includes(item)).slice(0, PIECE_KEYS.length * 2);
  }

  if (Array.isArray(candidate.excludedItems)) {
    sanitized.excludedItems = candidate.excludedItems.filter(item => [...PIECE_KEYS, ...POOL_SPECIALS].includes(item));
  }

  return sanitized;
}

function sanitizeSaveData(data) {
  if (!data || typeof data !== 'object') return null;

  const nextBoardRows = clampInt(
    data.boardRows,
    VISIBLE_ROWS + BUFFER_ROWS,
    VISIBLE_ROWS + BUFFER_ROWS + 40,
    VISIBLE_ROWS + BUFFER_ROWS
  );
  const nextRenderOffset = data.renderOffset === 0 ? 0 : BUFFER_ROWS;
  const nextBoard = sanitizeBoard(data.board, nextBoardRows);
  const nextGameState = sanitizeGameState(data.gameState);

  if (!nextBoard || !nextGameState) return null;

  return {
    version: SAVE_VERSION,
    board: nextBoard,
    boardRows: nextBoardRows,
    renderOffset: nextRenderOffset,
    gameState: nextGameState,
  };
}

function setOverlayText(lines, emphasizeLastLine = false) {
  const overlayText = document.getElementById('overlay-text');
  overlayText.replaceChildren();

  lines.forEach((line, index) => {
    if (index > 0) overlayText.appendChild(document.createElement('br'));
    if (index > 1) overlayText.appendChild(document.createElement('br'));

    if (emphasizeLastLine && index === lines.length - 1) {
      const strong = document.createElement('strong');
      strong.textContent = line;
      overlayText.appendChild(strong);
    } else {
      overlayText.appendChild(document.createTextNode(line));
    }
  });
}

function saveGame() {
  const data = {
    version: SAVE_VERSION,
    board,
    boardRows,
    renderOffset,
    gameState: {
      ...gameState,
      excludedItems: [...gameState.excludedItems],
      phase: 'PHASE2_IDLE',
      drawnItem: null,
      timerStart: null,
      flashRows: [],
      flashStart: null,
    },
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  try {
    const data = sanitizeSaveData(JSON.parse(raw));
    if (!data) {
      deleteSave();
      return false;
    }
    board = data.board;
    boardRows = data.boardRows;
    renderOffset = data.renderOffset;
    Object.assign(gameState, data.gameState);
    gameState.excludedItems = new Set(data.gameState.excludedItems);
    return true;
  } catch {
    deleteSave();
    return false;
  }
}

function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
}

// ============================================================
//  CANVAS SETUP
// ============================================================
const canvas = document.getElementById('board-canvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');

function setupCanvas() {
  canvas.width = BOARD_COLS * CELL_SIZE;
  canvas.height = (boardRows - renderOffset) * CELL_SIZE;
}

// ============================================================
//  BOARD PRIMITIVES
// ============================================================
function createBoard() {
  return Array.from({ length: boardRows }, () => new Array(BOARD_COLS).fill(0));
}

// Returns absolute [row, col] cells for a piece at given position
function computeCells(type, rotation, pivotRow, pivotCol) {
  const offsets = PIECES[type].rotations[rotation];
  return offsets.map(([dr, dc]) => [pivotRow + dr, pivotCol + dc]);
}

function isValidPosition(cells) {
  for (const [r, c] of cells) {
    if (r >= boardRows || c < 0 || c >= BOARD_COLS) return false;
    if (r >= 0 && board[r][c] !== 0) return false;
  }
  return true;
}

function lockPiece(cells, color) {
  for (const [r, c] of cells) {
    if (r >= 0 && r < boardRows && c >= 0 && c < BOARD_COLS) {
      board[r][c] = color;
    }
  }
}

// Returns { newBoard, clearedRowIndices, bottomCleared }
function checkAndClearLines() {
  const clearedRowIndices = [];
  for (let r = 0; r < boardRows; r++) {
    if (board[r].every(cell => cell !== 0)) {
      clearedRowIndices.push(r);
    }
  }
  if (clearedRowIndices.length === 0) {
    return { clearedRowIndices: [], bottomCleared: false };
  }
  const bottomCleared = clearedRowIndices.includes(boardRows - 1);
  // Remove cleared rows and add empty rows at top
  const newBoard = board.filter((_, r) => !clearedRowIndices.includes(r));
  while (newBoard.length < boardRows) {
    newBoard.unshift(new Array(BOARD_COLS).fill(0));
  }
  board = newBoard;
  return { clearedRowIndices, bottomCleared };
}

// ============================================================
//  PIECE MANAGEMENT
// ============================================================
function makeBag() {
  const bag = [...PIECE_KEYS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

function nextFromBag() {
  if (gameState.bag.length === 0) gameState.bag = makeBag();
  return gameState.bag.pop();
}

function spawnPiece(type) {
  const rotation = 0;
  const pivotRow = type === 'I' ? BUFFER_ROWS + 1 : BUFFER_ROWS;
  const pivotCol = Math.floor(BOARD_COLS / 2) - 1;
  const cells = computeCells(type, rotation, pivotRow, pivotCol);
  const color = PIECES[type].color;
  return { type, rotation, pivotRow, pivotCol, color, cells };
}

function tryRotate(piece, direction) {
  const newRotation = (piece.rotation + direction + 4) % 4;
  const key = `${piece.rotation}>${newRotation}`;
  const kicks = piece.type === 'I' ? (WALL_KICKS_I[key] || [[0,0]]) : (WALL_KICKS[key] || [[0,0]]);
  for (const [dr, dc] of kicks) {
    const newCells = computeCells(piece.type, newRotation, piece.pivotRow + dr, piece.pivotCol + dc);
    if (isValidPosition(newCells)) {
      return { ...piece, rotation: newRotation, pivotRow: piece.pivotRow + dr, pivotCol: piece.pivotCol + dc, cells: newCells };
    }
  }
  return null;
}

function ghostRow(piece) {
  let row = piece.pivotRow;
  while (true) {
    const testCells = computeCells(piece.type, piece.rotation, row + 1, piece.pivotCol);
    if (!isValidPosition(testCells)) break;
    row++;
  }
  return row;
}

// ============================================================
//  RENDERING
// ============================================================
function drawCell(context, r, c, color, alpha = 1) {
  const y = (r - renderOffset) * CELL_SIZE;
  context.save();
  context.globalAlpha = alpha;
  context.fillStyle = color;
  context.fillRect(c * CELL_SIZE + 1, y + 1, CELL_SIZE - 2, CELL_SIZE - 2);
  // Highlight
  context.fillStyle = 'rgba(255,255,255,0.15)';
  context.fillRect(c * CELL_SIZE + 1, y + 1, CELL_SIZE - 2, 4);
  context.restore();
}

function renderBoard() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Grid lines (visible area only)
  const displayRows = boardRows - renderOffset;
  ctx.strokeStyle = 'rgba(74,74,138,0.3)';
  ctx.lineWidth = 0.5;
  for (let vr = 0; vr <= displayRows; vr++) {
    ctx.beginPath();
    ctx.moveTo(0, vr * CELL_SIZE);
    ctx.lineTo(canvas.width, vr * CELL_SIZE);
    ctx.stroke();
  }
  for (let c = 0; c <= BOARD_COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL_SIZE, 0);
    ctx.lineTo(c * CELL_SIZE, canvas.height);
    ctx.stroke();
  }

  // Ceiling line (buffer/main boundary) in Phase 2
  if (renderOffset === 0) {
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(0, BUFFER_ROWS * CELL_SIZE);
    ctx.lineTo(canvas.width, BUFFER_ROWS * CELL_SIZE);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 0.5;
  }

  // Locked cells (visible rows only)
  for (let r = renderOffset; r < boardRows; r++) {
    for (let c = 0; c < BOARD_COLS; c++) {
      if (board[r][c] !== 0) {
        drawCell(ctx, r, c, board[r][c]);
      }
    }
  }
}

function renderGhost(piece) {
  if (!piece) return;
  const gr = ghostRow(piece);
  if (gr === piece.pivotRow) return;
  const ghostCells = computeCells(piece.type, piece.rotation, gr, piece.pivotCol);
  for (const [r, c] of ghostCells) {
    if (r >= renderOffset) drawCell(ctx, r, c, piece.color, 0.2);
  }
}

function renderActivePiece(piece) {
  if (!piece) return;
  for (const [r, c] of piece.cells) {
    if (r >= renderOffset) drawCell(ctx, r, c, piece.color);
  }
}

function renderNextPiece() {
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const type = gameState.nextPieceType;
  if (!type) return;
  const cells = computeCells(type, 0, 1, 1);
  const color = PIECES[type].color;
  const s = 18;
  for (const [r, c] of cells) {
    nextCtx.fillStyle = color;
    nextCtx.fillRect(c * s + 4, r * s + 4, s - 2, s - 2);
    nextCtx.fillStyle = 'rgba(255,255,255,0.15)';
    nextCtx.fillRect(c * s + 4, r * s + 4, s - 2, 4);
  }
}

function renderFlash() {
  if (gameState.flashRows.length === 0) return;
  const elapsed = performance.now() - gameState.flashStart;
  const alpha = Math.max(0, 1 - elapsed / 150);
  for (const r of gameState.flashRows) {
    if (r < renderOffset) continue;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, (r - renderOffset) * CELL_SIZE, canvas.width, CELL_SIZE);
    ctx.restore();
  }
}

// ============================================================
//  UI UPDATES
// ============================================================
function updatePhaseDisplay(text) {
  document.getElementById('phase-val').textContent = text;
}

function updateTimer(remaining) {
  const ring = document.getElementById('timer-ring');
  const timerText = document.getElementById('timer-text');
  const fraction = Math.max(0, remaining / TIMER_DURATION);
  const offset = TIMER_CIRCUMFERENCE * (1 - fraction);
  ring.style.strokeDashoffset = offset;
  // Color: green -> yellow -> red
  let color;
  if (fraction > 0.6) color = '#4caf50';
  else if (fraction > 0.3) color = '#ffc107';
  else color = '#f44336';
  ring.style.stroke = color;
  timerText.textContent = (remaining / 1000).toFixed(1);
}

// ============================================================
//  CARD DISPLAY
// ============================================================
function showCard(item, onFlipped) {
  const area = document.getElementById('card-area');
  const flipper = document.getElementById('card-flipper');
  const icon = document.getElementById('card-icon');
  const label = document.getElementById('card-label');

  area.classList.remove('hidden');
  flipper.classList.remove('flipped');

  icon.textContent = PIECE_ICONS[item] || item;
  if (item === 'ACE') {
    label.textContent = 'ACE';
    icon.style.color = '#ffd700';
  } else if (item === 'JOKER') {
    label.textContent = 'JOKER';
    icon.style.color = '#cf9fff';
  } else {
    label.textContent = item + 'PIECE';
    icon.style.color = PIECES[item]?.color || '#fff';
  }

  // Flip after short delay
  setTimeout(() => {
    flipper.classList.add('flipped');
    if (onFlipped) setTimeout(onFlipped, 650);
  }, 400);
}

function hideCard() {
  document.getElementById('card-area').classList.add('hidden');
  document.getElementById('card-flipper').classList.remove('flipped');
}

// ============================================================
//  PHASE 1 - TETRIS
// ============================================================
function startPhase1() {
  boardRows = VISIBLE_ROWS + BUFFER_ROWS;
  board = createBoard();
  gameState.dropInterval = 800;
  gameState.lastDropTime = 0;
  gameState.bag = makeBag();
  gameState.nextPieceType = nextFromBag();
  gameState.phase = 'PHASE1_PLAYING';

  activePiece = spawnPiece(nextFromBag());
  gameState.nextPieceType = nextFromBag();

  updatePhaseDisplay('テトリス');
  renderNextPiece();

  document.getElementById('next-piece-area').style.display = '';
  hideCard();

  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(phase1Loop);
}

function phase1Loop(ts) {
  if (gameState.phase !== 'PHASE1_PLAYING') return;

  if (!gameState.lastDropTime) gameState.lastDropTime = ts;

  // Handle held key movement
  handleHeldKeys();

  // Gravity
  if (ts - gameState.lastDropTime >= gameState.dropInterval) {
    gameState.lastDropTime = ts;
    moveDown();
  }

  renderBoard();
  if (gameState.flashRows.length > 0) {
    renderFlash();
    if (performance.now() - gameState.flashStart > 150) {
      gameState.flashRows = [];
    }
  }
  renderGhost(activePiece);
  renderActivePiece(activePiece);

  rafId = requestAnimationFrame(phase1Loop);
}

function moveDown() {
  const newCells = computeCells(activePiece.type, activePiece.rotation, activePiece.pivotRow + 1, activePiece.pivotCol);
  if (isValidPosition(newCells)) {
    activePiece.pivotRow++;
    activePiece.cells = newCells;
  } else {
    lockCurrentPiece();
  }
}

function lockCurrentPiece() {
  lockPiece(activePiece.cells, activePiece.color);
  const { clearedRowIndices, bottomCleared } = checkAndClearLines();

  if (clearedRowIndices.length > 0) {
    gameState.flashRows = clearedRowIndices;
    gameState.flashStart = performance.now();
    gameState.linesCleared += clearedRowIndices.length;
    gameState.dropInterval = Math.max(100, 800 - Math.floor(gameState.linesCleared / 5) * 60);
  }

  // Spawn next
  const nextType = gameState.nextPieceType;
  activePiece = spawnPiece(nextType);
  gameState.nextPieceType = nextFromBag();
  renderNextPiece();

  // Check game over
  if (!isValidPosition(activePiece.cells)) {
    gameState.phase = 'PHASE1_GAMEOVER';
    cancelAnimationFrame(rafId);
    rafId = null;
    // Render final board before transition
    renderBoard();
    renderActivePiece(activePiece);
    setTimeout(transitionToPhase2, 1500);
    showOverlay('Game Over', 'Card phase begins next.', null);
  }
}

function hardDrop() {
  const gr = ghostRow(activePiece);
  activePiece.pivotRow = gr;
  activePiece.cells = computeCells(activePiece.type, activePiece.rotation, gr, activePiece.pivotCol);
  lockCurrentPiece();
}

// ============================================================
//  PHASE 1 INPUT
// ============================================================
function handlePhase1Key(key) {
  if (gameState.phase !== 'PHASE1_PLAYING') return;
  if (key === 'ArrowLeft') moveSide(-1);
  else if (key === 'ArrowRight') moveSide(1);
  else if (key === 'ArrowDown') { moveDown(); }
  else if (key === 'ArrowUp' || key === 'z' || key === 'Z') rotatePiece(1);
  else if (key === 'x' || key === 'X') rotatePiece(-1);
  else if (key === ' ') hardDrop();
}

function moveSide(dir) {
  const newCells = computeCells(activePiece.type, activePiece.rotation, activePiece.pivotRow, activePiece.pivotCol + dir);
  if (isValidPosition(newCells)) {
    activePiece.pivotCol += dir;
    activePiece.cells = newCells;
  }
}

function rotatePiece(dir) {
  const rotated = tryRotate(activePiece, dir);
  if (rotated) activePiece = rotated;
}

// Key repeat for held keys
const KEY_REPEAT_DELAY = 150;
const KEY_REPEAT_INTERVAL = 50;

function handleHeldKeys() {
  // Handled via repeat timers
}

document.addEventListener('keydown', (e) => {
  const key = e.key;
  if (['ArrowLeft','ArrowRight','ArrowDown',' ','ArrowUp','z','Z','x','X'].includes(key)) {
    e.preventDefault();
  }

  if (!keyState[key]) {
    keyState[key] = true;
    if (gameState.phase === 'PHASE1_PLAYING') handlePhase1Key(key);
    else if (gameState.phase === 'PHASE2_PLACING') handlePhase2Key(key);

    // Start repeat for movement keys
    if (['ArrowLeft','ArrowRight','ArrowDown'].includes(key)) {
      keyRepeatTimers[key] = setTimeout(() => {
        keyRepeatTimers[key + '_interval'] = setInterval(() => {
          if (gameState.phase === 'PHASE1_PLAYING') handlePhase1Key(key);
          else if (gameState.phase === 'PHASE2_PLACING') handlePhase2Key(key);
        }, KEY_REPEAT_INTERVAL);
      }, KEY_REPEAT_DELAY);
    }
  }
});

document.addEventListener('keyup', (e) => {
  const key = e.key;
  keyState[key] = false;
  if (keyRepeatTimers[key]) {
    clearTimeout(keyRepeatTimers[key]);
    delete keyRepeatTimers[key];
  }
  if (keyRepeatTimers[key + '_interval']) {
    clearInterval(keyRepeatTimers[key + '_interval']);
    delete keyRepeatTimers[key + '_interval'];
  }
});

// ============================================================
//  TRANSITION: PHASE 1 -> PHASE 2
// ============================================================
function transitionToPhase2() {
  hideOverlay();
  gameState.phase = 'PHASE2_IDLE';
  gameState.phase2Lines = 0;
  gameState.phase2Turns = 0;
  gameState.excludedItems = new Set();
  gameState.drawnItem = null;

  // Expand canvas to show buffer rows
  renderOffset = 0;
  setupCanvas();

  updatePhaseDisplay('カードフェーズ');

  // Show Phase 2 UI
  document.getElementById('timer-panel').style.display = '';
  document.getElementById('pool-panel').style.display = '';
  document.getElementById('start-btn').style.display = '';
  document.getElementById('start-btn').disabled = false;
  document.getElementById('retry-btn').style.display = '';
  document.getElementById('next-piece-area').style.display = 'none';

  renderBoard();
  updateTimerDisplay(TIMER_DURATION);
  saveGame();
}

function updateTimerDisplay(remaining) {
  updateTimer(remaining);
}

// ============================================================
//  PHASE 2 - POOL UI
// ============================================================
function setupPoolButtons() {
  document.querySelectorAll('.pool-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (gameState.phase !== 'PHASE2_IDLE') return;
      const item = btn.dataset.item;
      if (gameState.excludedItems.has(item)) {
        gameState.excludedItems.delete(item);
        btn.classList.remove('excluded');
      } else {
        // Prevent excluding last item
        const pool = buildPool();
        if (pool.length <= 1) return;
        gameState.excludedItems.add(item);
        btn.classList.add('excluded');
      }
    });
  });
}

function setupAceCounter() {
  const minusBtn = document.getElementById('ace-minus');
  const plusBtn = document.getElementById('ace-plus');
  const countEl = document.getElementById('ace-count');

  function updateAceDisplay() {
    countEl.textContent = gameState.aceCount;
    minusBtn.disabled = gameState.aceCount <= 0;
  }

  minusBtn.addEventListener('click', () => {
    if (gameState.phase !== 'PHASE2_IDLE') return;
    if (gameState.aceCount <= 0) return;
    gameState.aceCount--;
    const pool = buildPool();
    if (pool.length === 0) { gameState.aceCount++; return; }
    updateAceDisplay();
  });

  plusBtn.addEventListener('click', () => {
    if (gameState.phase !== 'PHASE2_IDLE') return;
    gameState.aceCount++;
    updateAceDisplay();
  });

  updateAceDisplay();
}

function renderPieceCanvases(selector, size) {
  document.querySelectorAll(selector).forEach(miniCanvas => {
    const item = miniCanvas.parentElement.dataset.item || miniCanvas.parentElement.dataset.type;
    if (!PIECES[item]) return;

    const mCtx = miniCanvas.getContext('2d');
    const offsets = PIECES[item].rotations[0];
    const color = PIECES[item].color;

    const rows = offsets.map(o => o[0]);
    const cols = offsets.map(o => o[1]);
    const minR = Math.min(...rows), maxR = Math.max(...rows);
    const minC = Math.min(...cols), maxC = Math.max(...cols);
    const pieceW = maxC - minC + 1;
    const pieceH = maxR - minR + 1;

    const padding = 2;
    const available = size - padding * 2;
    const cellSize = Math.floor(Math.min(available / pieceW, available / pieceH));

    const offsetX = padding + Math.floor((available - pieceW * cellSize) / 2);
    const offsetY = padding + Math.floor((available - pieceH * cellSize) / 2);

    mCtx.clearRect(0, 0, size, size);
    for (const [dr, dc] of offsets) {
      const x = offsetX + (dc - minC) * cellSize;
      const y = offsetY + (dr - minR) * cellSize;
      mCtx.fillStyle = color;
      mCtx.fillRect(x, y, cellSize - 1, cellSize - 1);
      mCtx.fillStyle = 'rgba(255,255,255,0.2)';
      mCtx.fillRect(x, y, cellSize - 1, 2);
    }
  });
}

function buildPool() {
  const pool = [...PIECE_KEYS, 'JOKER'].filter(item => !gameState.excludedItems.has(item));
  for (let i = 0; i < gameState.aceCount; i++) pool.push('ACE');
  return pool;
}

function drawFromPool() {
  const pool = buildPool();
  return pool[Math.floor(Math.random() * pool.length)];
}

// ============================================================
//  PHASE 2 - START BUTTON
// ============================================================
function setupStartButton() {
  const btn = document.getElementById('start-btn');
  btn.addEventListener('click', () => {
    if (gameState.phase !== 'PHASE2_IDLE') return;
    btn.disabled = true;
    startDraw();
  });
}

function startDraw() {
  gameState.phase = 'PHASE2_DRAWING';
  const item = drawFromPool();
  gameState.drawnItem = item;
  gameState.phase2Turns++;

  document.getElementById('preview-title').textContent = 'Drawn Card';

  showCard(item, () => {
    if (item === 'JOKER') {
      handleJoker();
    } else if (item === 'ACE') {
      handleAce();
    } else {
      startPhase2Placing(item);
    }
  });
}

// ============================================================
//  PHASE 2 - JOKER
// ============================================================
function handleJoker() {
  gameState.phase = 'PHASE2_JOKER';
  // Reset timer display
  updateTimer(TIMER_DURATION);
  setTimeout(() => {
    if (gameState.phase === 'PHASE2_JOKER') returnToIdle();
  }, 1800);
}

// ============================================================
//  PHASE 2 - ACE
// ============================================================
function handleAce() {
  gameState.phase = 'PHASE2_ACE';
  document.getElementById('ace-panel').style.display = '';
}

function setupAcePicker() {
  document.querySelectorAll('.ace-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.type;
      document.getElementById('ace-panel').style.display = 'none';
      startPhase2Placing(type);
    });
  });
}

// ============================================================
//  PHASE 2 - PLACING
// ============================================================
function expandBoard(n) {
  for (let i = 0; i < n; i++) {
    board.unshift(new Array(BOARD_COLS).fill(0));
  }
  boardRows += n;
  canvas.height = (boardRows - renderOffset) * CELL_SIZE;
}

function shrinkBoard() {
  const defaultRows = VISIBLE_ROWS + BUFFER_ROWS;
  if (boardRows <= defaultRows) return;

  let emptyTop = 0;
  for (let r = 0; r < boardRows; r++) {
    if (board[r].every(cell => cell === 0)) emptyTop++;
    else break;
  }

  const removable = Math.min(emptyTop, boardRows - defaultRows);
  if (removable <= 0) return;

  board.splice(0, removable);
  boardRows -= removable;
  canvas.height = (boardRows - renderOffset) * CELL_SIZE;
}

function ensureTopSpace(minEmpty) {
  let emptyCount = 0;
  for (let r = 0; r < boardRows; r++) {
    if (board[r].every(cell => cell === 0)) {
      emptyCount++;
    } else {
      break;
    }
  }
  if (emptyCount < minEmpty) {
    expandBoard(minEmpty - emptyCount);
  }
}

function startPhase2Placing(pieceType) {
  gameState.phase = 'PHASE2_PLACING';
  // Ensure at least 4 empty rows at the top for spawning and movement
  ensureTopSpace(4);
  const rotation = 0;
  const pivotRow = pieceType === 'I' ? 1 : 0;
  const pivotCol = Math.floor(BOARD_COLS / 2) - 1;
  const cells = computeCells(pieceType, rotation, pivotRow, pivotCol);
  const color = PIECES[pieceType].color;
  activePiece = { type: pieceType, rotation, pivotRow, pivotCol, color, cells };

  gameState.timerStart = performance.now();
  document.getElementById('place-btn').style.display = '';

  if (rafId) cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(phase2Loop);
}

function phase2Loop(ts) {
  if (gameState.phase !== 'PHASE2_PLACING') return;

  const elapsed = ts - gameState.timerStart;
  const remaining = Math.max(0, TIMER_DURATION - elapsed);
  updateTimerDisplay(remaining);

  // Timer expired: force lock at ghost position
  if (remaining <= 0) {
    confirmPhase2Placement();
    return;
  }

  renderBoard();
  if (gameState.flashRows.length > 0) {
    renderFlash();
    if (performance.now() - gameState.flashStart > 150) {
      gameState.flashRows = [];
    }
  }
  renderGhost(activePiece);
  renderActivePiece(activePiece);

  rafId = requestAnimationFrame(phase2Loop);
}

// Drop piece to ghost position and lock
function confirmPhase2Placement() {
  if (!activePiece) return;
  const gr = ghostRow(activePiece);
  activePiece.pivotRow = gr;
  activePiece.cells = computeCells(activePiece.type, activePiece.rotation, gr, activePiece.pivotCol);
  lockPhase2Piece();
}

// Convert mouse/touch client coords to board column
function canvasCoordsToCol(clientX) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const canvasX = (clientX - rect.left) * scaleX;
  return Math.floor(canvasX / CELL_SIZE);
}

// Move piece so its center aligns with target column
function movePieceToCol(targetCol) {
  if (!activePiece) return;
  const offsets = PIECES[activePiece.type].rotations[activePiece.rotation];
  const colOffsets = offsets.map(o => o[1]);
  const centerC = Math.round((Math.min(...colOffsets) + Math.max(...colOffsets)) / 2);
  const newPivotCol = targetCol - centerC;
  const newCells = computeCells(activePiece.type, activePiece.rotation, activePiece.pivotRow, newPivotCol);
  if (isValidPosition(newCells)) {
    activePiece.pivotCol = newPivotCol;
    activePiece.cells = newCells;
  }
}

function handlePhase2Key(key) {
  if (gameState.phase !== 'PHASE2_PLACING') return;
  if (key === 'ArrowLeft') moveSide(-1);
  else if (key === 'ArrowRight') moveSide(1);
  else if (key === 'ArrowDown') {
    const newCells = computeCells(activePiece.type, activePiece.rotation, activePiece.pivotRow + 1, activePiece.pivotCol);
    if (isValidPosition(newCells)) {
      activePiece.pivotRow++;
      activePiece.cells = newCells;
    }
  }
  else if (key === 'ArrowUp' || key === 'z' || key === 'Z') rotatePiece(1);
  else if (key === 'x' || key === 'X') rotatePiece(-1);
  else if (key === ' ') {
    confirmPhase2Placement();
  }
}

function lockPhase2Piece() {
  cancelAnimationFrame(rafId);
  rafId = null;
  gameState.phase = 'PHASE2_LOCK';
  document.getElementById('place-btn').style.display = 'none';

  lockPiece(activePiece.cells, activePiece.color);
  const { clearedRowIndices, bottomCleared } = checkAndClearLines();
  shrinkBoard();

  if (clearedRowIndices.length > 0) {
    gameState.flashRows = clearedRowIndices;
    gameState.flashStart = performance.now();
    gameState.phase2Lines += clearedRowIndices.length;
  }

  renderBoard();
  if (gameState.flashRows.length > 0) {
    renderFlash();
  }
  activePiece = null;

  if (bottomCleared) {
    deleteSave();
    setTimeout(() => {
      gameState.phase = 'PHASE2_WIN';
      showOverlay(
        'You Win!',
        {
          lines: [
            'The board has been cleared.',
            'Turns: ' + gameState.phase2Turns,
            'Lines: ' + gameState.phase2Lines,
          ],
        },
        'Play Again'
      );
    }, 400);
  } else {
    // Reset lastDropTime for next placing session
    gameState.lastDropTime = 0;
    setTimeout(returnToIdle, 400);
  }
}

function returnToIdle() {
  gameState.phase = 'PHASE2_IDLE';
  gameState.drawnItem = null;
  document.getElementById('preview-title').textContent = 'Drawn Card';
  document.getElementById('start-btn').disabled = false;
  updateTimer(TIMER_DURATION);
  renderBoard();
  saveGame();
}

// ============================================================
//  OVERLAY HELPERS
// ============================================================
function showOverlay(title, text, btnText) {
  document.getElementById('overlay-title').textContent = title;
  if (Array.isArray(text?.lines)) {
    setOverlayText(text.lines, text.emphasizeLastLine === true);
  } else {
    setOverlayText([String(text)]);
  }
  const btn = document.getElementById('overlay-btn');
  if (btnText) {
    btn.textContent = btnText;
    btn.style.display = '';
  } else {
    btn.style.display = 'none';
  }
  document.getElementById('overlay').classList.remove('hidden');
}

function hideOverlay() {
  document.getElementById('overlay').classList.add('hidden');
}

// ============================================================
//  TOUCH CONTROLS
// ============================================================
let touchStartX = 0, touchStartY = 0, touchStartTime = 0;

canvas.addEventListener('touchstart', (e) => {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchStartTime = Date.now();
  e.preventDefault();

  // Phase 2: move piece to touch position immediately
  if (gameState.phase === 'PHASE2_PLACING' && activePiece) {
    const col = canvasCoordsToCol(e.touches[0].clientX);
    movePieceToCol(col);
  }
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
  e.preventDefault();
  // Phase 2: piece follows finger
  if (gameState.phase === 'PHASE2_PLACING' && activePiece) {
    const col = canvasCoordsToCol(e.touches[0].clientX);
    movePieceToCol(col);
  }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
  const dx = e.changedTouches[0].clientX - touchStartX;
  const dy = e.changedTouches[0].clientY - touchStartY;
  const dt = Date.now() - touchStartTime;
  const phase = gameState.phase;

  if (phase === 'PHASE1_PLAYING') {
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 250) {
      rotatePiece(1);
    } else if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 20) moveSide(1);
      else if (dx < -20) moveSide(-1);
    } else if (dy > 40) {
      hardDrop();
    }
  } else if (phase === 'PHASE2_PLACING') {
    // Tap with no movement = rotate
    if (Math.abs(dx) < 10 && Math.abs(dy) < 10 && dt < 250) {
      rotatePiece(1);
    }
    // Placement is done via the "配置指定" button
  }
  e.preventDefault();
}, { passive: false });

// ============================================================
//  MOUSE CONTROLS (Phase 2 drag)
// ============================================================
canvas.addEventListener('mousemove', (e) => {
  if (gameState.phase !== 'PHASE2_PLACING' || !activePiece) return;
  const col = canvasCoordsToCol(e.clientX);
  movePieceToCol(col);
});

canvas.addEventListener('click', () => {
  if (gameState.phase !== 'PHASE2_PLACING' || !activePiece) return;
  confirmPhase2Placement();
});

canvas.addEventListener('contextmenu', (e) => {
  if (gameState.phase === 'PHASE2_PLACING') {
    e.preventDefault();
    rotatePiece(1);
  }
});

canvas.addEventListener('wheel', (e) => {
  if (gameState.phase !== 'PHASE2_PLACING' || !activePiece) return;
  e.preventDefault();
  rotatePiece(e.deltaY > 0 ? 1 : -1);
}, { passive: false });

// ============================================================
//  PLACE BUTTON (Phase 2)
// ============================================================
document.getElementById('place-btn').addEventListener('click', () => {
  if (gameState.phase !== 'PHASE2_PLACING' || !activePiece) return;
  confirmPhase2Placement();
});

// ============================================================
//  OVERLAY BUTTON
// ============================================================
document.getElementById('overlay-btn').addEventListener('click', () => {
  const phase = gameState.phase;
  if (phase === 'INIT' || phase === 'PHASE2_WIN') {
    hideOverlay();
    // Reset canvas to Phase 1 size
    renderOffset = BUFFER_ROWS;
    setupCanvas();
    // Reset phase 2 UI visibility
    document.getElementById('timer-panel').style.display = 'none';
    document.getElementById('pool-panel').style.display = 'none';
    document.getElementById('start-btn').style.display = 'none';
    document.getElementById('retry-btn').style.display = 'none';
    document.getElementById('ace-panel').style.display = 'none';
    document.getElementById('next-piece-area').style.display = '';
    document.getElementById('preview-title').textContent = 'Next Piece';
    // Reset pool button states
    document.querySelectorAll('.pool-btn').forEach(b => b.classList.remove('excluded'));
    gameState.aceCount = 1;
    document.getElementById('ace-count').textContent = 1;
    startPhase1();
  }
});

// ============================================================
//  RETRY BUTTON
// ============================================================
document.getElementById('retry-btn').addEventListener('click', () => {
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  deleteSave();
  // Hide Phase 2 UI
  document.getElementById('timer-panel').style.display = 'none';
  document.getElementById('pool-panel').style.display = 'none';
  document.getElementById('start-btn').style.display = 'none';
  document.getElementById('place-btn').style.display = 'none';
  document.getElementById('ace-panel').style.display = 'none';
  document.getElementById('retry-btn').style.display = 'none';
  document.querySelectorAll('.pool-btn').forEach(b => b.classList.remove('excluded'));
  gameState.aceCount = 1;
  document.getElementById('ace-count').textContent = 1;
  // Reset to Phase 1
  renderOffset = BUFFER_ROWS;
  setupCanvas();
  document.getElementById('next-piece-area').style.display = '';
  document.getElementById('preview-title').textContent = 'Next Piece';
  startPhase1();
});

// ============================================================
//  INIT
// ============================================================
setupPoolButtons();
setupAceCounter();
renderPieceCanvases('.pool-piece-canvas', 32);
setupAcePicker();
renderPieceCanvases('.ace-piece-canvas', 44);
setupStartButton();

// Try to restore saved game, otherwise show start overlay
if (loadGame()) {
  setupCanvas();
  // Restore Phase 2 UI
  document.getElementById('timer-panel').style.display = '';
  document.getElementById('pool-panel').style.display = '';
  document.getElementById('start-btn').style.display = '';
  document.getElementById('start-btn').disabled = false;
  document.getElementById('retry-btn').style.display = '';
  document.getElementById('next-piece-area').style.display = 'none';
  document.getElementById('preview-title').textContent = 'Drawn Card';
  // Restore pool button exclusion states
  document.querySelectorAll('.pool-btn').forEach(b => {
    if (gameState.excludedItems.has(b.dataset.item)) b.classList.add('excluded');
  });
  document.getElementById('ace-count').textContent = gameState.aceCount;
  setupCanvas();
  gameState.phase = 'INIT';
  showOverlay(
    'Tetris Card Game',
    {
      lines: [
        'Play classic Tetris first.',
        'After game over, the card phase begins.',
        'Clear the board to win.',
      ],
      emphasizeLastLine: true,
    },
    'Start Game'
  );
}
