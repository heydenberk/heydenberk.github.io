import { key, validateMove } from './game.js';

const row = (length, y, shape) => Array.from({ length }, (_, x) => [x, y, x, shape]);

// Targets and example solutions are checked with an exhaustive search in tests.
const definitions = [
  {
    id: 'last-two', title: 'A little completion', difficulty: 'Warm-up',
    cells: Array.from({ length: 4 }, (_, x) => [x, 0, 0, x]),
    hand: [[0, 4], [2, 2], [4, 1], [0, 5], [3, 3], [5, 0]],
    target: 12, hint: 'Two coral tiles can finish a line of six.',
    explanation: 'A full line scores six for its tiles, plus a six-point bonus.',
  },
  {
    id: 'bridge', title: 'The missing connection', difficulty: 'Warm-up',
    cells: [[0, 0, 0, 0], [1, 0, 0, 1], [2, 0, 0, 2], [0, 1, 4, 0], [2, 1, 4, 2]],
    hand: [[4, 1], [3, 4], [2, 5], [5, 3], [1, 4], [3, 5]],
    target: 5, hint: 'A gap can connect a row and a column at the same time.',
    explanation: 'The blue square scores the three-tile row and the two-tile column.',
  },
  {
    id: 'two-ways', title: 'Look both ways', difficulty: 'Tricky',
    cells: [...row(5, 0, 0), ...row(4, 1, 1)],
    hand: [[5, 0], [4, 1], [5, 1], [2, 4], [3, 5], [1, 3]],
    target: 19, hint: 'Try the two purple tiles together at the left edge of the board.',
    explanation: 'The purple pair scores two, completes a line for 12, and extends the other row for five: 19 points.',
  },
  {
    id: 'side-by-side', title: 'Small lines add up', difficulty: 'Tricky',
    cells: [...row(4, 0, 0), ...row(4, 1, 1)],
    hand: [[2, 2], [4, 4], [0, 2], [3, 2], [5, 5], [1, 2]],
    target: 16, hint: 'Lay the diamonds alongside the squares to score several columns.',
    explanation: 'Four diamonds score four for their row, plus four columns of three: 16 points.',
  },
  {
    id: 'whole-hand', title: 'All together now', difficulty: 'Challenge',
    cells: row(5, 0, 1),
    hand: [[3, 0], [0, 0], [5, 0], [1, 0], [4, 0], [2, 0]],
    target: 22, hint: 'Use all six circles, and make five of them touch a matching color.',
    explanation: 'A full row scores 12, and five crossing pairs add 10. Puzzles have no going-out bonus.',
  },
  {
    id: 'double-finish', title: 'The perfect corner', difficulty: 'Challenge',
    cells: [...row(6, 0, 0), ...row(5, 5, 5), ...Array.from({ length: 4 }, (_, i) => [0, i + 1, 0, i + 1]), ...Array.from({ length: 4 }, (_, i) => [5, i + 1, 5, i + 1])],
    hand: [[1, 1], [3, 3], [5, 5], [0, 0], [2, 2], [4, 4]],
    target: 24, hint: 'One tile can complete two lines of six.',
    explanation: 'The purple cross completes both the bottom row and the right column: 12 + 12.',
  },
];

export const PUZZLES = definitions.map(({ cells, hand, ...details }) => ({
  ...details,
  board: Object.fromEntries(cells.map(([x, y, color, shape], i) => [key(x, y), { id: `${details.id}-board-${i}`, color, shape }])),
  rack: hand.map(([color, shape], i) => ({ id: `${details.id}-hand-${i}`, color, shape })),
}));

export function createPuzzleGame(puzzle) {
  return {
    board: structuredClone(puzzle.board), bag: [],
    players: [{ name: 'You', rack: structuredClone(puzzle.rack), score: 0 }, { name: 'Cleo', rack: [], score: 0 }],
    current: 0, turn: 1, over: false, log: [], lastMove: [],
  };
}

export function checkPuzzleMove(puzzle, placements) {
  const used = new Set();
  for (const { tile } of placements) {
    const actual = puzzle.rack.find(t => t.id === tile?.id);
    if (!actual || actual.color !== tile.color || actual.shape !== tile.shape || used.has(tile.id)) {
      return { valid: false, solved: false, score: 0, error: 'Use each tile in your hand only once.' };
    }
    used.add(tile.id);
  }
  const result = validateMove(puzzle.board, placements);
  return { ...result, solved: result.valid && result.score >= puzzle.target };
}
