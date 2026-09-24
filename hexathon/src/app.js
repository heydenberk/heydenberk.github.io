import { COLORS, SHAPES, key, createGame, validateMove, candidates, openingSize, playTurn, exchangeTiles, passTurn, shuffle, isSavedGame } from './game.js';

const $ = id => document.getElementById(id);
const icons = {
  plus: '<path d="M12 5v14M5 12h14"/>', minus: '<path d="M5 12h14"/>', close: '<path d="m6 6 12 12M6 18 18 6"/>',
  'arrow-right': '<path d="M4 12h15m-5-5 5 5-5 5"/>', 'arrow-down': '<path d="M8 3c0 9 8 7 8 16m-5-4 5 5 5-5"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9a2.8 2.8 0 0 1 5.6 0c0 2-2.8 2.1-2.8 4M12 17h.01"/>',
  'sound-off': '<path d="m11 5-5 4H3v6h3l5 4zM17 9l5 6m0-6-5 6"/>', sound: '<path d="m11 5-5 4H3v6h3l5 4zM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
  bag: '<path d="m9 4-1-2h8l-1 2m-7 2h8c0 4 5 6 5 11 0 4-18 4-18 0 0-5 5-7 5-11Z"/><path d="M9 15h6"/>',
  move: '<path d="M12 2v20M2 12h20M9 5l3-3 3 3M9 19l3 3 3-3M5 9l-3 3 3 3m14-6 3 3-3 3"/>',
  focus: '<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/><circle cx="12" cy="12" r="3"/>',
  sparkle: '<path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7Z"/>',
  shuffle: '<path d="M3 6h3c5 0 7 12 12 12h3m-4-4 4 4-4 4M3 18h3c2 0 3-2 4-4m4-4c1-2 2-4 4-4h3m-4-4 4 4-4 4"/>',
  exchange: '<path d="M4 7h16m-4-4 4 4-4 4M20 17H4m4-4-4 4 4 4"/>',
  undo: '<path d="M4 4v6h6M4 10a8 8 0 1 1 0 5"/>',
  bulb: '<path d="M8 16c0-3-3-3-3-7a7 7 0 0 1 14 0c0 4-3 4-3 7M8 17h8m-7 3h6m-5 2h4"/>',
  trophy: '<path d="M7 3h10v7a5 5 0 0 1-10 0ZM7 5H3v3a4 4 0 0 0 4 4m10-7h4v3a4 4 0 0 1-4 4M12 15v5m-4 1h8"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 3 4 3 4-3 4-3M8 9h.01M16 9h.01"/>',
  history: '<path d="M3 4v5h5M3 9a9 9 0 1 1 0 6M12 7v5l3 2"/>',
  leaf: '<path d="M4 20C0 5 14 3 21 3c0 13-5 20-17 17ZM4 20 16 8m-7 7v-5m0 5h5"/>',
  heart: '<path d="M12 20S2 14 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-10 12-10 12Z"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.sparkle}</svg>`;
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = icon(el.dataset.icon); });
const colorValues = ['#ed7b69', '#eea453', '#e4cb5d', '#90b58c', '#78a8cd', '#ac91c4'];
const shapePaths = [
  '<circle cx="20" cy="20" r="13"/>',
  '<rect x="7" y="7" width="26" height="26" rx="2"/>',
  '<path d="m20 3 17 17-17 17L3 20Z"/>',
  '<path d="m20 2 4.5 11.8L37 14.5 27.5 23l3.2 13L20 28.7 9.3 36l3.2-13L3 14.5l12.5-.7Z"/>',
  '<path d="M20 11C9-6-6 11 11 20-6 29 9 46 20 29c11 17 26 0 9-9C46 11 31-6 20 11Z"/>',
  '<path d="m10 4 10 10L30 4l6 6-10 10 10 10-6 6-10-10-10 10-6-6 10-10L4 10Z"/>',
];
const shape = index => `<svg viewBox="0 0 40 40" fill="currentColor" aria-hidden="true">${shapePaths[index]}</svg>`;
const tileLabel = tile => `${COLORS[tile.color]} ${SHAPES[tile.shape]}`;
const miniTile = tile => `<span class="mini-tile" style="--tile-color:${colorValues[tile.color]}">${shape(tile.shape)}</span>`;
const esc = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
$('example-line').innerHTML = COLORS.map((_, color) => miniTile({ color, shape: 0 })).join('');
$('rule-example').innerHTML = [0, 1, 2, 3].map(s => miniTile({ color: 0, shape: s })).join('');
document.querySelector('.art-one').innerHTML = shape(0);
document.querySelector('.art-two').innerHTML = shape(4);
document.querySelector('.art-three').innerHTML = shape(2);

const STORAGE = 'qwirkle-table-v1';
const MIN_ZOOM = .15;
let game;
try { const saved = JSON.parse(localStorage.getItem(STORAGE)); if (isSavedGame(saved)) game = saved; } catch { /* Local storage may be unavailable. */ }
game ||= createGame();
let pending = [], selected = null, exchanging = false, swapIds = new Set(), busy = false;
let pan = { x: 0, y: 0 }, zoom = 1, hintGhost = [], toastTimer, computerTimer, generation = 0;
let soundEnabled = false, audioContext, storageWarning = false;
let scorePreviewEnabled = true;
try { soundEnabled = localStorage.getItem('qwirkle-sound') === 'true'; } catch { /* Optional setting. */ }
try { scorePreviewEnabled = localStorage.getItem('hexathon-score-preview') !== 'false'; } catch { /* Optional setting. */ }
$('score-preview-toggle').checked = scorePreviewEnabled;
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
let requestNumber = 0;
const requests = new Map();
worker.onmessage = ({ data }) => {
  const request = requests.get(data.id);
  if (!request) return;
  requests.delete(data.id);
  if (data.error) request.reject(new Error(data.error)); else request.resolve(data.move);
};
worker.onerror = () => {
  for (const request of requests.values()) request.reject(new Error('The move finder could not start. Please refresh the page.'));
  requests.clear();
};
function search(board, rack) {
  return new Promise((resolve, reject) => {
    const id = ++requestNumber;
    requests.set(id, { resolve, reject });
    worker.postMessage({ id, board, rack, width: 24 });
  });
}

function save() {
  try { localStorage.setItem(STORAGE, JSON.stringify(game)); }
  catch { if (!storageWarning) { toast('This browser cannot save your game. You can still play here.'); storageWarning = true; } }
}
function toast(message, celebrate = false) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').className = `toast visible${celebrate ? ' celebrate' : ''}`;
  toastTimer = setTimeout(() => $('toast').classList.remove('visible'), 4000);
}
function tone(type = 'place') {
  if (!soundEnabled) return;
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume();
    const notes = type === 'score' ? [440, 554.37, 659.25] : type === 'qwirkle' ? [440, 554.37, 659.25, 880] : [type === 'select' ? 420 : 560];
    notes.forEach((frequency, i) => {
      const osc = audioContext.createOscillator(), gain = audioContext.createGain();
      const start = audioContext.currentTime + i * .095;
      osc.type = 'sine'; osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start); gain.gain.linearRampToValueAtTime(.055, start + .01); gain.gain.exponentialRampToValueAtTime(.001, start + .18);
      osc.connect(gain); gain.connect(audioContext.destination); osc.start(start); osc.stop(start + .2);
    });
  } catch { /* Sound is optional. */ }
}
function updateSound() {
  $('sound-button').innerHTML = icon(soundEnabled ? 'sound' : 'sound-off');
  $('sound-button').setAttribute('aria-label', `Turn sound ${soundEnabled ? 'off' : 'on'}`);
  $('sound-button').setAttribute('aria-pressed', String(soundEnabled));
}
function celebrate() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  for (let i = 0; i < 24; i++) {
    const bit = document.createElement('span');
    bit.className = 'burst'; bit.textContent = ['●', '◆', '✦'][i % 3];
    bit.style.cssText = `color:${colorValues[i % 6]};font-size:${10 + Math.random() * 15}px;--dx:${(Math.random() - .5) * 600}px;--dy:${100 + Math.random() * 400}px;--rot:${Math.random() * 360}deg;`;
    document.body.append(bit); setTimeout(() => bit.remove(), 1900);
  }
}
function playable() { return game.current === 0 && !game.over && !busy; }
function combinedBoard() {
  const board = { ...game.board };
  pending.forEach(p => { board[key(p.x, p.y)] = p.tile; });
  return board;
}
function opening() { return Object.keys(game.board).length === 0; }
function finishingBonus(placements) {
  return !game.bag.length && placements.length === game.players[0].rack.length ? 6 : 0;
}
function turnValidation() {
  const result = validateMove(game.board, pending);
  if (result.valid && opening() && pending.length !== openingSize(game.players[0].rack)) {
    return { ...result, valid: false, error: `Start with your largest matching set: ${openingSize(game.players[0].rack)} tiles.` };
  }
  return { ...result, score: result.score + (result.valid ? finishingBonus(pending) : 0) };
}
function render() {
  const focused = document.activeElement;
  const focusSelector = focused?.dataset.tile ? `[data-tile="${focused.dataset.tile}"]` : focused?.dataset.x !== undefined ? `[data-x="${focused.dataset.x}"][data-y="${focused.dataset.y}"]` : null;
  const mine = playable();
  const result = turnValidation();
  document.body.classList.toggle('thinking', game.current === 1 && !game.over);
  $('bag-count').textContent = game.bag.length;
  $('you-score').textContent = game.players[0].score;
  $('cleo-score').textContent = game.players[1].score;
  $('player-you').classList.toggle('active', mine);
  $('player-cleo').classList.toggle('active', game.current === 1 && !game.over);
  $('you-status').textContent = game.over ? 'Beautifully played' : mine ? 'Your time to shine' : 'Taking it all in';
  $('cleo-status').textContent = game.over ? 'Until next time' : game.current === 1 ? 'Connecting the dots…' : 'Your pattern pal';
  $('table-status').textContent = game.over ? 'A table well played' : 'Your table';
  $('turn-number').textContent = `TURN ${String(game.turn).padStart(2, '0')}`;
  const openingCount = openingSize(game.players[0].rack);
  let message = 'Your move. Make it a good one.';
  if (game.over) message = 'Well played. There’s always room for one more round.';
  else if (game.current === 1) message = 'Cleo is finding a little connection…';
  else if (busy) message = 'Looking for a little inspiration…';
  else if (exchanging) message = 'Choose tiles to swap. This uses your turn.';
  else if (pending.length) message = result.valid ? `${result.qwirkles ? 'Six in a row! ' : 'Looking good. '}${result.score} points are ready to play.` : result.error;
  else if (opening()) message = `You start! Open with ${openingCount} matching ${openingCount === 1 ? 'tile' : 'tiles'}.`;
  else if (selected) message = 'A little possibility. Pick a highlighted space.';
  $('turn-message').textContent = message;
  $('rack-count').textContent = game.players[0].rack.length - pending.length;
  $('rack-instruction').textContent = exchanging ? 'Choose any tiles you’d like to trade in.' : game.current === 1 ? 'A little pause. Cleo is up next.' : pending.length ? 'Keep connecting, or play your tiles.' : 'Pick a tile. Find its people.';
  $('play-button').disabled = !mine || (exchanging ? !swapIds.size || swapIds.size > game.bag.length : !result.valid);
  $('play-button').innerHTML = `${exchanging ? `Swap ${swapIds.size || ''} ${swapIds.size === 1 ? 'tile' : 'tiles'}` : 'Play tiles'} ${icon('arrow-right')}`;
  $('move-preview').textContent = exchanging ? `${game.bag.length} tiles available to swap` : pending.length ? (result.valid ? `+${result.score} points · ${pending.length} ${pending.length === 1 ? 'tile' : 'tiles'}` : 'A little more connecting to do') : game.over ? 'Thanks for playing' : 'Your next great move awaits';
  $('undo-button').disabled = !mine || (!pending.length && !selected && !exchanging && !hintGhost.length);
  $('exchange-button').disabled = !mine || opening() || pending.length > 0;
  $('exchange-button').innerHTML = `${icon('exchange')}<span>${exchanging ? 'Cancel swap' : game.bag.length ? 'Swap tiles' : 'Pass turn'}</span>`;
  $('shuffle-button').disabled = !mine || exchanging;
  $('hint-button').disabled = !mine || exchanging;
  $('hint-button').innerHTML = `${icon('bulb')}${busy && game.current === 0 ? 'Finding a move…' : 'A little hint'}`;
  const diff = game.players[0].score - game.players[1].score;
  $('score-note').textContent = game.over ? 'Good company. Good game.' : diff === 0 ? 'A good time, one tile at a time.' : diff > 0 ? `You’re ${diff} ${diff === 1 ? 'point' : 'points'} ahead. Keep connecting.` : 'Plenty of possibilities still on the table.';
  renderRack(); renderBoard(); renderActivity();
  if (focusSelector) document.querySelector(focusSelector)?.focus({ preventScroll: true });
}
function renderRack() {
  $('rack').innerHTML = game.players[0].rack.map((tile, i) => {
    const staged = pending.some(p => p.tile.id === tile.id);
    const active = selected === tile.id;
    const swapping = swapIds.has(tile.id);
    return `<button class="tile rack-tile${active ? ' selected' : ''}${staged ? ' in-play' : ''}${swapping ? ' exchanging' : ''}" data-tile="${tile.id}" aria-label="${tileLabel(tile)}${staged ? ', placed on board' : ''}" aria-pressed="${exchanging ? swapping : active}" ${!playable() || staged ? 'disabled' : ''} style="--tile-color:${colorValues[tile.color]}" title="${tileLabel(tile)} · ${i + 1}">${shape(tile.shape)}<span class="tile-key" aria-hidden="true">${i + 1}</span></button>`;
  }).join('');
}
function position(x, y) {
  const cell = 58 * zoom;
  const width = $('board').clientWidth, height = $('board').clientHeight;
  return { left: width / 2 + pan.x + x * cell - cell / 2, top: height / 2 + pan.y + y * cell - cell / 2, cell };
}
function renderBoard() {
  const board = combinedBoard();
  const tile = game.players[0].rack.find(t => t.id === selected);
  const fresh = !Object.keys(board).length;
  // The empty-board target sits below the welcome copy.
  const origin = position(0, 0);
  const width = $('board').clientWidth, height = $('board').clientHeight;
  $('grid-layer').style.backgroundSize = `${origin.cell}px ${origin.cell}px`;
  $('grid-layer').style.backgroundPosition = `${origin.left + origin.cell / 2}px ${origin.top + origin.cell / 2}px`;
  $('board-empty').hidden = !fresh || Boolean(selected) || hintGhost.length > 0 || game.over;
  $('zoom-label').textContent = `${Math.round(zoom * 100)}%`;
  $('zoom-out').disabled = zoom <= MIN_ZOOM;
  $('zoom-in').disabled = zoom >= 1.5;
  let html = '';
  function cellHtml(x, y, classes, content, label, extra = '') {
    const p = position(x, y);
    if (p.left < -p.cell || p.top < -p.cell || p.left > width || p.top > height) return '';
    const size = p.cell - 5 * zoom;
    return `<button class="board-cell ${classes}" data-x="${x}" data-y="${y}" aria-label="${esc(label)}" style="left:${p.left + 2.5 * zoom}px;top:${p.top + 2.5 * zoom}px;width:${size}px;height:${size}px;--cell-size:${size}px" ${extra}>${content}</button>`;
  }
  if (playable() && !exchanging) {
    const spaces = candidates(board);
    let allowed = 0;
    for (const space of spaces) {
      const ghost = hintGhost.find(p => p.x === space.x && p.y === space.y);
      const placements = tile ? [...pending, { ...space, tile }] : [];
      const result = tile ? validateMove(game.board, placements) : null;
      if (result && !result.valid) continue;
      if (!tile && !fresh && !ghost) continue;
      allowed++;
      const showTile = ghost?.tile;
      const preview = tile && scorePreviewEnabled ? placementScore(placements, result) : null;
      const content = preview ? `<span class="cell-score" aria-hidden="true">+${preview.score}</span>` : showTile ? `<span style="color:${colorValues[showTile.color]};width:100%;height:100%;display:flex;align-items:center;justify-content:center">${shape(showTile.shape)}</span>` : icon('plus');
      const label = tile ? `Place ${tileLabel(tile)} at ${space.x}, ${space.y}${preview ? `. ${preview.description}` : ''}` : `Starting space at ${space.x}, ${space.y}`;
      html += cellHtml(space.x, space.y, `space${fresh ? ' origin' : ''}${ghost ? ' ghost' : ''}${preview ? ' has-score' : ''}`, content, label, ghost ? 'title="Suggested placement"' : '');
    }
    if (tile && !allowed && !hintGhost.length) $('turn-message').textContent = 'No space for this tile here. Try another tile, undo, or swap.';
  }
  for (const [coords, placed] of Object.entries(board)) {
    const [x, y] = coords.split(',').map(Number);
    const staged = pending.some(p => p.x === x && p.y === y);
    const last = game.lastMove.some(p => p.x === x && p.y === y);
    html += cellHtml(x, y, `tile${staged ? ' staged' : ''}${last && !staged ? ' last-move' : ''}`, `<span style="color:${colorValues[placed.color]};width:100%;height:100%;display:flex;align-items:center;justify-content:center">${shape(placed.shape)}</span>`, `${tileLabel(placed)} at ${x}, ${y}${staged ? '. Click to return to rack.' : ''}`, !staged ? 'aria-disabled="true" tabindex="-1"' : '');
  }
  // Show the full suggested turn, including spaces beyond the current frontier.
  for (const p of hintGhost) {
    if (board[key(p.x, p.y)] || candidates(board).some(c => c.x === p.x && c.y === p.y)) continue;
    html += cellHtml(p.x, p.y, 'space ghost', `<span style="color:${colorValues[p.tile.color]};width:100%;height:100%;display:flex;align-items:center;justify-content:center">${shape(p.tile.shape)}</span>`, `Suggested ${tileLabel(p.tile)} at ${p.x}, ${p.y}`, 'title="Build toward this space"');
  }
  $('tiles-layer').innerHTML = html;
}
function placementScore(placements, result) {
  const bonus = finishingBonus(placements);
  const score = result.score + bonus;
  const remaining = opening() ? openingSize(game.players[0].rack) - placements.length : 0;
  const detail = remaining > 0 ? `Opening so far; add ${remaining} matching ${remaining === 1 ? 'tile' : 'tiles'}` : `Turn total for ${placements.length} ${placements.length === 1 ? 'tile' : 'tiles'}`;
  const bonuses = [];
  if (result.qwirkles) bonuses.push(`${result.qwirkles * 6}-point line bonus`);
  if (bonus) bonuses.push('6-point finish bonus');
  return { score, description: `${score} ${score === 1 ? 'point' : 'points'}. ${detail}.${bonuses.length ? ` Includes ${bonuses.join(' + ')}.` : ''}` };
}
function renderActivity() {
  if (!game.log.length) {
    $('activity').innerHTML = `<div class="activity-empty"><span class="activity-empty-icon">${icon('leaf')}</span><p>A clean slate.<br><span>Let’s see what you make of it.</span></p></div>`;
    return;
  }
  $('activity').innerHTML = game.log.slice(0, 12).map(entry => {
    const name = entry.player === 0 ? 'You' : 'Cleo';
    const words = entry.type === 'play' ? `${entry.qwirkles ? 'completed a line of six' : `played ${Number(entry.count)} ${entry.count === 1 ? 'tile' : 'tiles'}`}${entry.bonus ? ' & finished' : ''}` : entry.type === 'exchange' ? `swapped ${Number(entry.count)} tiles` : 'passed this turn';
    return `<div class="activity-entry${entry.qwirkles ? ' qwirkle' : ''}"><span class="activity-dot${entry.player === 1 ? ' cleo' : ''}"></span><span class="activity-text"><strong>${name}</strong> ${words}<br><span>Turn ${Number(entry.turn)}</span></span><span class="activity-score">${entry.score ? '+' + Number(entry.score) : '—'}</span></div>`;
  }).join('');
}
function selectTile(id) {
  if (!playable() || pending.some(p => p.tile.id === id)) return;
  if (exchanging) { if (swapIds.has(id)) swapIds.delete(id); else swapIds.add(id); }
  else { selected = selected === id ? null : id; hintGhost = []; }
  tone('select'); render();
}
function placeAt(x, y) {
  if (!playable() || exchanging) return;
  const index = pending.findIndex(p => p.x === x && p.y === y);
  if (index >= 0) {
    selected = pending[index].tile.id;
    pending.splice(index, 1); hintGhost = []; render(); return;
  }
  if (game.board[key(x, y)]) return;
  const tile = game.players[0].rack.find(t => t.id === selected);
  if (!tile) { toast('Pick a tile from your rack first.'); return; }
  const move = [...pending, { x, y, tile }];
  const result = validateMove(game.board, move);
  if (!result.valid) { toast(result.error); return; }
  pending = move; selected = null; hintGhost = []; tone('place'); render();
}
function fitBoard(include = []) {
  const positions = [...Object.keys(game.board).map(k => { const [x, y] = k.split(',').map(Number); return { x, y }; }), ...pending, ...include];
  if (!positions.length) { zoom = 1; pan = { x: 0, y: 60 }; renderBoard(); return; }
  const minX = Math.min(...positions.map(p => p.x)), maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y)), maxY = Math.max(...positions.map(p => p.y));
  zoom = Math.min(1, Math.max(MIN_ZOOM, Math.min(($('board').clientWidth - 90) / ((maxX - minX + 3) * 58), ($('board').clientHeight - 60) / ((maxY - minY + 3) * 58))));
  pan = { x: -(minX + maxX) / 2 * 58 * zoom, y: -(minY + maxY) / 2 * 58 * zoom - 9 };
  renderBoard();
}
function clearTurn() { pending = []; selected = null; hintGhost = []; exchanging = false; swapIds.clear(); }
function afterTurn() {
  clearTurn(); save(); render(); fitBoard();
  const entry = game.log[0];
  if (entry.qwirkles) { toast(`${entry.player === 0 ? 'You completed' : 'Cleo completed'} a line of six! +${entry.score} points.`, true); celebrate(); tone('qwirkle'); }
  else if (entry.type === 'play') tone('score');
  if (game.over) { showEnd(); return; }
  if (game.current === 1) scheduleComputer();
}
function commit() {
  if (!playable()) return;
  try {
    game = exchanging ? exchangeTiles(game, [...swapIds]) : playTurn(game, pending);
    afterTurn();
  } catch (error) { toast(error.message); }
}
function scheduleComputer() {
  clearTimeout(computerTimer);
  const version = generation;
  computerTimer = setTimeout(async () => {
    if (generation !== version || game.current !== 1 || game.over) return;
    try {
      const move = await search(game.board, game.players[1].rack);
      if (generation !== version || game.current !== 1 || game.over) return;
      if (move) game = playTurn(game, move.placements);
      else if (game.bag.length) game = exchangeTiles(game, game.players[1].rack.slice(0, game.bag.length).map(t => t.id));
      else game = passTurn(game);
      afterTurn();
    } catch (error) { toast(`Cleo needs a moment: ${error.message}`); }
  }, 850);
}
async function hint() {
  if (!playable() || exchanging) return;
  if (pending.length) { toast('Undo your staged tiles first to see a fresh suggestion.'); return; }
  const version = generation;
  busy = true; render();
  try {
    const move = await search(game.board, game.players[0].rack);
    if (generation !== version) return;
    busy = false;
    if (!move) { toast(game.bag.length ? 'No connections just yet. Swap a few tiles for a fresh start.' : 'No tiles fit. You can pass this turn.'); render(); return; }
    hintGhost = move.placements;
    selected = move.placements[0].tile.id;
    render(); fitBoard(move.placements);
    toast(`Try the ${tileLabel(move.placements[0].tile)}. This path can earn ${move.score} points.`);
  } catch (error) { if (generation === version) { busy = false; render(); toast(error.message); } }
}
function undo() {
  if (!playable()) return;
  if (exchanging) { exchanging = false; swapIds.clear(); }
  else { const last = pending.pop(); selected = last?.tile.id || null; hintGhost = []; }
  render();
}
function newGame() {
  generation++; clearTimeout(computerTimer);
  document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
  game = createGame(); busy = false; clearTurn(); save(); render(); fitBoard();
  if (game.current === 1) scheduleComputer();
}
function showEnd() {
  const [you, cleo] = game.players;
  $('end-title').textContent = you.score > cleo.score ? 'A pattern of brilliance.' : you.score === cleo.score ? 'Perfectly in sync.' : 'Cleo found her rhythm.';
  $('end-copy').textContent = you.score > cleo.score ? 'You won! A little color, a little strategy, and a whole lot of good connections.' : you.score === cleo.score ? 'A tie! Great minds really do think in patterns.' : 'Cleo takes this round. Every game is a fresh set of possibilities.';
  $('end-you').textContent = you.score; $('end-cleo').textContent = cleo.score;
  if (you.score >= cleo.score) celebrate();
  const version = generation;
  setTimeout(() => { if (game.over && generation === version && !$('end-dialog').open) $('end-dialog').showModal(); }, 600);
}

$('rack').addEventListener('click', event => { const tile = event.target.closest('[data-tile]'); if (tile) selectTile(tile.dataset.tile); });
$('score-preview-toggle').addEventListener('change', event => {
  scorePreviewEnabled = event.target.checked;
  renderBoard();
  try { localStorage.setItem('hexathon-score-preview', String(scorePreviewEnabled)); } catch { /* Optional setting. */ }
});
let drag = null, didDrag = false;
$('board').addEventListener('pointerdown', event => {
  if (event.target.closest('button, label, input')) return;
  drag = { x: event.clientX, y: event.clientY, startX: pan.x, startY: pan.y };
  didDrag = false; $('board').setPointerCapture(event.pointerId);
});
$('board').addEventListener('pointermove', event => {
  if (!drag) return;
  const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
  if (Math.abs(dx) + Math.abs(dy) > 4) didDrag = true;
  if (didDrag) { pan = { x: drag.startX + dx, y: drag.startY + dy }; $('board').classList.add('dragging'); renderBoard(); }
});
function stopDrag() { drag = null; $('board').classList.remove('dragging'); }
$('board').addEventListener('pointerup', stopDrag);
$('board').addEventListener('pointercancel', stopDrag);
$('board').addEventListener('click', event => {
  if (didDrag) { didDrag = false; return; }
  const cell = event.target.closest('[data-x]');
  if (cell) placeAt(Number(cell.dataset.x), Number(cell.dataset.y));
});
function changeZoom(delta) {
  const next = Math.min(1.5, Math.max(MIN_ZOOM, zoom + delta));
  const ratio = next / zoom; pan.x *= ratio; pan.y *= ratio; zoom = next; renderBoard();
}
$('board').addEventListener('wheel', event => {
  event.preventDefault();
  if (event.ctrlKey || event.metaKey) changeZoom(-event.deltaY * .003);
  else { pan.x -= event.deltaX; pan.y -= event.deltaY; renderBoard(); }
}, { passive: false });
$('zoom-out').onclick = () => changeZoom(-.1);
$('zoom-in').onclick = () => changeZoom(.1);
$('recenter').onclick = () => fitBoard();
$('play-button').onclick = commit;
$('undo-button').onclick = undo;
$('hint-button').onclick = hint;
$('shuffle-button').onclick = () => { if (playable()) { game.players[0].rack = shuffle(game.players[0].rack); save(); renderRack(); tone('select'); } };
$('exchange-button').onclick = () => {
  if (!playable() || pending.length || opening()) return;
  if (!game.bag.length) {
    try { game = passTurn(game); afterTurn(); } catch (error) { toast(error.message); }
    return;
  }
  exchanging = !exchanging; swapIds.clear(); selected = null; hintGhost = []; render();
};
$('help-button').onclick = () => $('help-dialog').showModal();
$('new-button').onclick = () => $('new-dialog').showModal();
$('confirm-new').onclick = newGame;
$('play-again').onclick = newGame;
$('sound-button').onclick = () => { soundEnabled = !soundEnabled; updateSound(); tone('select'); try { localStorage.setItem('qwirkle-sound', String(soundEnabled)); } catch { /* Optional. */ } };
document.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => $(button.dataset.close).close(); });
document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
document.addEventListener('keydown', event => {
  if (document.querySelector('dialog[open]') || event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target.matches('input, select, textarea, a')) return;
  if (event.key >= '1' && event.key <= '6') { const tile = game.players[0].rack[Number(event.key) - 1]; if (tile) { event.preventDefault(); selectTile(tile.id); } }
  else if (event.key === 'Escape') { event.preventDefault(); undo(); }
  else if (event.key === 'Enter' && event.target.tagName !== 'BUTTON' && !$('play-button').disabled) { event.preventDefault(); commit(); }
  else if (event.target === $('board') && ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
    event.preventDefault(); pan.x += event.key === 'ArrowLeft' ? 58 : event.key === 'ArrowRight' ? -58 : 0; pan.y += event.key === 'ArrowUp' ? 58 : event.key === 'ArrowDown' ? -58 : 0; renderBoard();
  }
});
new ResizeObserver(() => renderBoard()).observe($('board'));
updateSound(); render(); fitBoard(); save();
if (game.current === 1 && !game.over) scheduleComputer();
