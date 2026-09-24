export const COLORS = ['coral', 'amber', 'yellow', 'green', 'blue', 'purple'];
export const SHAPES = ['circle', 'square', 'diamond', 'star', 'clover', 'cross'];
export const key = (x, y) => `${x},${y}`;
const directions = [[1, 0], [0, 1], [-1, 0], [0, -1]];

export function shuffle(values, random = Math.random) {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function openingSize(rack) {
  let max = 0;
  for (const attribute of ['color', 'shape']) {
    for (let value = 0; value < 6; value++) {
      const other = attribute === 'color' ? 'shape' : 'color';
      max = Math.max(max, new Set(rack.filter(t => t[attribute] === value).map(t => t[other])).size);
    }
  }
  return max;
}

export function createGame(random = Math.random) {
  const tiles = [];
  for (let color = 0; color < 6; color++) {
    for (let shape = 0; shape < 6; shape++) {
      for (let copy = 0; copy < 3; copy++) tiles.push({ id: `${color}-${shape}-${copy}`, color, shape });
    }
  }
  const bag = shuffle(tiles, random);
  const players = [{ name: 'You', rack: bag.splice(0, 6), score: 0 }, { name: 'Cleo', rack: bag.splice(0, 6), score: 0 }];
  const current = openingSize(players[1].rack) > openingSize(players[0].rack) ? 1 : 0;
  return { version: 1, board: {}, bag, players, current, turn: 1, passes: 0, over: false, log: [], lastMove: [] };
}

function getLine(board, x, y, dx, dy) {
  while (board[key(x - dx, y - dy)]) { x -= dx; y -= dy; }
  const cells = [];
  while (board[key(x, y)]) {
    cells.push({ x, y, tile: board[key(x, y)] });
    x += dx; y += dy;
  }
  return cells;
}

function lineError(cells) {
  if (cells.length > 6) return 'A line can contain at most six tiles.';
  const tiles = cells.map(cell => cell.tile);
  if (new Set(tiles.map(t => `${t.color}-${t.shape}`)).size !== tiles.length) return 'A line cannot contain the same tile twice.';
  if (!tiles.every(t => t.color === tiles[0].color) && !tiles.every(t => t.shape === tiles[0].shape)) {
    return 'Every line must share one color or one shape.';
  }
  return null;
}

export function validateMove(board, placements) {
  const invalid = error => ({ valid: false, error, score: 0, qwirkles: 0 });
  if (!placements.length) return invalid('Choose a tile from your rack to get started.');
  const combined = { ...board };
  for (const p of placements) {
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y)) return invalid('Place tiles on the grid.');
    if (combined[key(p.x, p.y)]) return invalid('There is already a tile in that space.');
    combined[key(p.x, p.y)] = p.tile;
  }
  const sameRow = placements.every(p => p.y === placements[0].y);
  const sameColumn = placements.every(p => p.x === placements[0].x);
  if (!sameRow && !sameColumn) return invalid('Place all tiles in a single row or column this turn.');
  if (placements.length > 1) {
    const axis = sameRow ? 'x' : 'y';
    const values = placements.map(p => p[axis]);
    for (let value = Math.min(...values); value <= Math.max(...values); value++) {
      const x = sameRow ? value : placements[0].x;
      const y = sameRow ? placements[0].y : value;
      if (!combined[key(x, y)]) return invalid('Keep your line connected, with no empty spaces.');
    }
  }
  if (Object.keys(board).length && !placements.some(p => directions.some(([dx, dy]) => board[key(p.x + dx, p.y + dy)]))) {
    return invalid('Connect your tiles to a tile already on the board.');
  }
  const lines = new Map();
  for (const p of placements) {
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const line = getLine(combined, p.x, p.y, dx, dy);
      const error = lineError(line);
      if (error) return invalid(error);
      if (line.length > 1) lines.set(`${dx}:${key(line[0].x, line[0].y)}`, line);
    }
  }
  let score = 0, qwirkles = 0;
  for (const line of lines.values()) {
    score += line.length;
    if (line.length === 6) { score += 6; qwirkles++; }
  }
  return { valid: true, error: '', score: score || 1, qwirkles };
}

export function candidates(board) {
  if (!Object.keys(board).length) return [{ x: 0, y: 0 }];
  const cells = new Map();
  for (const position of Object.keys(board)) {
    const [x, y] = position.split(',').map(Number);
    for (const [dx, dy] of directions) {
      if (!board[key(x + dx, y + dy)]) cells.set(key(x + dx, y + dy), { x: x + dx, y: y + dy });
    }
  }
  return [...cells.values()];
}

// A bounded beam search considers whole turns, including perpendicular scoring.
// The same search powers the opponent and the optional player hint.
export function findBestMove(board, rack, beamWidth = 24) {
  let beam = [{ placements: [], score: 0 }];
  let best = null;
  for (let depth = 0; depth < rack.length; depth++) {
    const next = [];
    const seen = new Set();
    for (const node of beam) {
      const used = new Set(node.placements.map(p => p.tile.id));
      const combined = { ...board };
      node.placements.forEach(p => { combined[key(p.x, p.y)] = p.tile; });
      let spaces = candidates(combined);
      if (node.placements.length) {
        const first = node.placements[0];
        const horizontal = node.placements.every(p => p.y === first.y);
        const vertical = node.placements.every(p => p.x === first.x);
        spaces = spaces.filter(p => (horizontal && p.y === first.y) || (vertical && p.x === first.x));
      }
      const tried = new Set();
      for (const tile of rack) {
        const kind = `${tile.color}-${tile.shape}`;
        if (used.has(tile.id) || tried.has(kind)) continue;
        tried.add(kind);
        for (const space of spaces) {
          const placements = [...node.placements, { ...space, tile }];
          const signature = placements.map(p => `${key(p.x, p.y)}:${p.tile.color}-${p.tile.shape}`).sort().join('|');
          if (seen.has(signature)) continue;
          seen.add(signature);
          const result = validateMove(board, placements);
          if (!result.valid) continue;
          const move = { placements, score: result.score, qwirkles: result.qwirkles };
          next.push(move);
          if (!best || move.score > best.score || (move.score === best.score && placements.length > best.placements.length)) best = move;
        }
      }
    }
    next.sort((a, b) => b.score - a.score || b.placements.length - a.placements.length);
    beam = next.slice(0, beamWidth);
    if (!beam.length) break;
  }
  return best;
}

function finishTurn(state, entry) {
  state.log.unshift({ ...entry, player: state.current, turn: state.turn });
  state.log = state.log.slice(0, 80);
  if (!state.over) state.current = 1 - state.current;
  state.turn++;
  return state;
}

export function playTurn(game, placements) {
  if (game.over) throw new Error('This game has ended. Start a new table.');
  const result = validateMove(game.board, placements);
  if (!result.valid) throw new Error(result.error);
  const rack = game.players[game.current].rack;
  const ids = new Set();
  for (const p of placements) {
    const actual = rack.find(t => t.id === p.tile.id);
    if (!actual || actual.color !== p.tile.color || actual.shape !== p.tile.shape || ids.has(p.tile.id)) throw new Error('Use each tile in your rack only once.');
    ids.add(p.tile.id);
  }
  if (!Object.keys(game.board).length && placements.length !== openingSize(rack)) {
    throw new Error(`Start with your largest matching set: ${openingSize(rack)} tiles.`);
  }
  const state = structuredClone(game);
  placements.forEach(p => { state.board[key(p.x, p.y)] = { ...p.tile }; });
  const player = state.players[state.current];
  player.rack = player.rack.filter(t => !ids.has(t.id));
  while (player.rack.length < 6 && state.bag.length) player.rack.push(state.bag.pop());
  let bonus = 0;
  if (!player.rack.length && !state.bag.length) { state.over = true; bonus = 6; }
  player.score += result.score + bonus;
  state.passes = 0;
  state.lastMove = placements.map(p => ({ x: p.x, y: p.y }));
  return finishTurn(state, { type: 'play', score: result.score + bonus, count: placements.length, qwirkles: result.qwirkles, bonus, tiles: placements.map(p => p.tile) });
}

export function exchangeTiles(game, ids, random = Math.random) {
  if (game.over) throw new Error('This game has ended.');
  if (!Object.keys(game.board).length) throw new Error('Play your largest matching set to open the game.');
  if (!ids.length) throw new Error('Select the tiles you want to exchange.');
  if (ids.length > game.bag.length) throw new Error(`Only ${game.bag.length} tiles remain in the bag.`);
  const rack = game.players[game.current].rack;
  if (new Set(ids).size !== ids.length || !ids.every(id => rack.some(t => t.id === id))) throw new Error('Choose tiles from your rack.');
  const state = structuredClone(game);
  const player = state.players[state.current];
  const removed = player.rack.filter(t => ids.includes(t.id));
  player.rack = player.rack.filter(t => !ids.includes(t.id));
  player.rack.push(...state.bag.splice(0, ids.length));
  state.bag = shuffle([...state.bag, ...removed], random);
  state.lastMove = [];
  state.passes = 0;
  return finishTurn(state, { type: 'exchange', count: ids.length, score: 0 });
}

export function passTurn(game) {
  if (game.over) throw new Error('This game has ended.');
  if (game.bag.length) throw new Error('Exchange tiles instead while the bag has tiles.');
  if (findBestMove(game.board, game.players[game.current].rack, 1)) throw new Error('You have a playable tile. Try a hint.');
  const state = structuredClone(game);
  state.lastMove = [];
  state.passes++;
  if (state.passes >= 2) state.over = true;
  return finishTurn(state, { type: 'pass', count: 0, score: 0 });
}

export function isSavedGame(value) {
  try {
    if (value?.version !== 1 || ![0, 1].includes(value.current) || value.players.length !== 2 || !Array.isArray(value.log) || !Array.isArray(value.lastMove) || typeof value.over !== 'boolean') return false;
    if (!Number.isInteger(value.turn) || value.turn < 1 || !Number.isInteger(value.passes) || value.passes < 0) return false;
    if (value.players.some(p => !Array.isArray(p.rack) || p.rack.length > 6 || !Number.isInteger(p.score) || p.score < 0)) return false;
    if (Object.keys(value.board).some(k => !/^-?\d+,-?\d+$/.test(k) || k.split(',').some(n => Math.abs(Number(n)) > 108))) return false;
    const tiles = [...value.bag, ...value.players.flatMap(p => p.rack), ...Object.values(value.board)];
    return tiles.length === 108 && new Set(tiles.map(t => t.id)).size === 108 && tiles.every(t => Number.isInteger(t.color) && Number.isInteger(t.shape) && t.color >= 0 && t.color < 6 && t.shape >= 0 && t.shape < 6 && new RegExp(`^${t.color}-${t.shape}-[012]$`).test(t.id));
  } catch { return false; }
}
