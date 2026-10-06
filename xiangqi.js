/* 中国象棋棋盘规则。浏览器和 Node.js 共用；分析由 Pikafish 负责。 */
function createXiangqi() {
  const START = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR w';
  const names = { K: '帅', A: '仕', B: '相', N: '马', R: '车', C: '炮', P: '兵', k: '将', a: '士', b: '象', n: '马', r: '车', c: '炮', p: '卒' };
  const color = p => !p ? null : p === p.toUpperCase() ? 'r' : 'b';
  const other = side => side === 'r' ? 'b' : 'r';
  const inside = (x, y) => x >= 0 && x < 9 && y >= 0 && y < 10;
  const palace = (x, y, side) => x >= 3 && x <= 5 && (side === 'r' ? y >= 7 && y <= 9 : y >= 0 && y <= 2);

  function parseFen(fen) {
    const parts = fen.trim().split(/\s+/), rows = parts[0].split('/');
    if (rows.length !== 10 || !['w', 'r', 'b'].includes(parts[1])) throw Error('FEN 需要 10 行棋盘，并以 w（红走）或 b（黑走）指定行棋方。');
    const board = [];
    for (const row of rows) {
      let cells = [];
      for (let p of row) {
        if (/^[1-9]$/.test(p)) cells.push(...Array(Number(p)).fill(null));
        else {
          p = ({ h: 'n', H: 'N', e: 'b', E: 'B' })[p] || p;
          if (!names[p]) throw Error('FEN 中含有无法识别的棋子。');
          cells.push(p);
        }
      }
      if (cells.length !== 9) throw Error('FEN 每行必须恰好为 9 路。');
      board.push(...cells);
    }
    return { board, side: parts[1] === 'b' ? 'b' : 'r' };
  }
  function toFen(board, side) {
    const rows = [];
    for (let y = 0; y < 10; y++) {
      let row = '', empty = 0;
      for (let x = 0; x < 9; x++) {
        const p = board[y * 9 + x];
        if (!p) empty++;
        else { if (empty) row += empty; empty = 0; row += p; }
      }
      if (empty) row += empty;
      rows.push(row);
    }
    return rows.join('/') + (side === 'r' ? ' w' : ' b');
  }
  function pseudo(board, side) {
    const moves = [];
    const add = (from, x, y) => {
      if (inside(x, y) && color(board[y * 9 + x]) !== side) moves.push({ from, to: y * 9 + x });
    };
    for (let from = 0; from < 90; from++) {
      const p = board[from];
      if (color(p) !== side) continue;
      const x = from % 9, y = Math.floor(from / 9), type = p.toLowerCase();
      if (type === 'r' || type === 'c') {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          let screen = false;
          for (let nx = x + dx, ny = y + dy; inside(nx, ny); nx += dx, ny += dy) {
            const target = board[ny * 9 + nx];
            if (type === 'r') { add(from, nx, ny); if (target) break; }
            else if (!screen) { if (target) screen = true; else add(from, nx, ny); }
            else if (target) { add(from, nx, ny); break; }
          }
        }
      } else if (type === 'n') {
        for (const [dx, dy] of [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [-1, 2], [1, -2], [-1, -2]]) {
          const legX = Math.abs(dx) === 2 ? Math.sign(dx) : 0;
          const legY = Math.abs(dy) === 2 ? Math.sign(dy) : 0;
          if (inside(x + dx, y + dy) && !board[(y + legY) * 9 + x + legX]) add(from, x + dx, y + dy);
        }
      } else if (type === 'b') {
        for (const dx of [-2, 2]) for (const dy of [-2, 2]) {
          const nx = x + dx, ny = y + dy;
          if (inside(nx, ny) && (side === 'r' ? ny >= 5 : ny <= 4) && !board[(y + dy / 2) * 9 + x + dx / 2]) add(from, nx, ny);
        }
      } else if (type === 'a') {
        for (const dx of [-1, 1]) for (const dy of [-1, 1]) if (palace(x + dx, y + dy, side)) add(from, x + dx, y + dy);
      } else if (type === 'k') {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (palace(x + dx, y + dy, side)) add(from, x + dx, y + dy);
        for (const dy of [-1, 1]) for (let ny = y + dy; inside(x, ny); ny += dy) {
          const target = board[ny * 9 + x];
          if (target) { if (target.toLowerCase() === 'k' && color(target) !== side) add(from, x, ny); break; }
        }
      } else if (type === 'p') {
        add(from, x, y + (side === 'r' ? -1 : 1));
        if (side === 'r' ? y <= 4 : y >= 5) { add(from, x - 1, y); add(from, x + 1, y); }
      }
    }
    return moves;
  }
  function inCheck(board, side) {
    const king = board.indexOf(side === 'r' ? 'K' : 'k');
    return king < 0 || pseudo(board, other(side)).some(move => move.to === king);
  }
  function legalMoves(board, side) {
    return pseudo(board, side).filter(move => {
      const piece = board[move.from], captured = board[move.to];
      board[move.to] = piece; board[move.from] = null;
      const safe = !inCheck(board, side);
      board[move.from] = piece; board[move.to] = captured;
      return safe;
    });
  }
  function validate(board, side) {
    const counts = {}, limits = { k: 1, a: 2, b: 2, n: 2, r: 2, c: 2, p: 5 };
    for (let i = 0; i < board.length; i++) {
      const p = board[i]; if (!p) continue;
      const c = color(p), type = p.toLowerCase(), x = i % 9, y = Math.floor(i / 9), rank = c === 'r' ? 9 - y : y;
      counts[p] = (counts[p] || 0) + 1;
      if (counts[p] > limits[type]) return `${c === 'r' ? '红方' : '黑方'}的${names[p]}数量超过规则上限。`;
      if (type === 'a' && !((rank === 0 || rank === 2) && (x === 3 || x === 5) || rank === 1 && x === 4)) return '仕 / 士只能放在己方九宫的五个斜线交点。';
      if (type === 'b' && !((rank === 0 || rank === 4) && (x === 2 || x === 6) || rank === 2 && (x === 0 || x === 4 || x === 8))) return '相 / 象的位置不符合象步，请检查己方河岸的七个象位。';
      if (type === 'p' && (rank < 3 || rank < 5 && x % 2 !== 0)) return '未过河的兵 / 卒必须位于原兵线上，且不能后退。';
    }
    for (const c of ['r', 'b']) {
      const king = c === 'r' ? 'K' : 'k';
      if (board.filter(p => p === king).length !== 1) return '请为红黑双方各放置一枚帅 / 将。';
      const index = board.indexOf(king);
      if (!palace(index % 9, Math.floor(index / 9), c)) return '帅 / 将必须位于己方九宫内。';
    }
    if (inCheck(board, other(side))) return '非行棋方正被将军，或将帅照面。请调整摆盘或切换行棋方。';
    return '';
  }
  function notation(board, move) {
    const p = board[move.from], side = color(p), x = move.from % 9, y = Math.floor(move.from / 9);
    const tx = move.to % 9, ty = Math.floor(move.to / 9), nums = '一二三四五六七八九';
    const num = n => side === 'r' ? nums[n - 1] : String(n);
    const file = col => side === 'r' ? 9 - col : col + 1;
    const peers = board.map((v, i) => v === p && i % 9 === x ? i : -1).filter(i => i >= 0).sort((a, b) => side === 'r' ? a - b : b - a);
    let prefix = names[p] + num(file(x));
    if (peers.length > 1) {
      const n = peers.indexOf(move.from);
      prefix = (n === 0 ? '前' : n === peers.length - 1 ? '后' : peers.length === 3 ? '中' : num(n + 1)) + names[p];
    }
    if (y === ty) return prefix + '平' + num(file(tx));
    const forward = side === 'r' ? ty < y : ty > y;
    return prefix + (forward ? '进' : '退') + num('nab'.includes(p.toLowerCase()) ? file(tx) : Math.abs(ty - y));
  }
  return { START, names, color, other, parseFen, toFen, legalMoves, inCheck, validate, notation };
}
if (typeof module !== 'undefined') module.exports = createXiangqi;
