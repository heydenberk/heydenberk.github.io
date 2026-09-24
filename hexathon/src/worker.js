import { findBestMove } from './game.js';
self.onmessage = ({ data }) => {
  try {
    self.postMessage({ id: data.id, move: findBestMove(data.board, data.rack, data.width) });
  } catch (error) {
    self.postMessage({ id: data.id, error: error.message });
  }
};
