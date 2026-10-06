const engine = createXiangqi();
const $ = id => document.getElementById(id);
let { board, side } = engine.parseFen(engine.START);
let mySide = 'b', flipped = true, editing = false, selected = null, brush = 'R', lastMove = null;
let history = [], result = null, candidateIndex = 0, analysis = null, analyzedSide = side;
const localServer = location.protocol === 'http:' || location.protocol === 'https:';
const sideName = c => c === 'r' ? '红方' : '黑方';
const coord = index => {
  const x = index % 9, y = Math.floor(index / 9);
  return [30 + (flipped ? 8 - x : x) * 60, 30 + (flipped ? 9 - y : y) * 60];
};
function say(message, error = false) { $('message').textContent = message; $('message').classList.toggle('error', error); }
function save(label = '', moveSide = side, move = null) { history.push({ board: board.slice(), side, lastMove, label, moveSide, move }); }
function updateAnalyzeButton() {
  $('analyze').disabled = !localServer || (!analysis && side !== mySide);
  $('analyze').innerHTML = analysis ? '停止分析 <span>■</span>' : !localServer ? '请通过启动弈见.cmd 打开' : side === mySide ? '帮我计算最佳走法 <span>↗</span>' : '请先录入对方走法';
  $('analyze').classList.toggle('busy', Boolean(analysis));
}
function stopSearch() {
  if (analysis) analysis.abort();
  analysis = null; updateAnalyzeButton();
}
function invalidate() {
  stopSearch(); result = null; selected = null;
  $('results').hidden = true; $('empty-analysis').hidden = false;
  $('search-status').textContent = '皮卡鱼 · 专注最佳着法';
}
function drawGrid() {
  let svg = '<g fill="none" stroke="#8f734c" stroke-width="1.1">';
  for (let y = 0; y < 10; y++) svg += `<path d="M30 ${30 + 60 * y}H510"/>`;
  svg += '<path d="M30 30V570M510 30V570"/>';
  for (let x = 1; x < 8; x++) svg += `<path d="M${30 + x * 60} 30V270 M${30 + x * 60} 330V570"/>`;
  svg += '<path d="M210 30L330 150M330 30L210 150M210 450L330 570M330 450L210 570"/>';
  for (const [x, y] of [[1, 2], [7, 2], [1, 7], [7, 7], ...[0, 2, 4, 6, 8].flatMap(x => [[x, 3], [x, 6]])]) {
    const cx = 30 + x * 60, cy = 30 + y * 60;
    for (const dx of [-1, 1]) for (const dy of [-1, 1]) {
      if ((x === 0 && dx === -1) || (x === 8 && dx === 1)) continue;
      svg += `<path d="M${cx + dx * 16} ${cy + dy * 6}H${cx + dx * 6}V${cy + dy * 16}"/>`;
    }
  }
  svg += '</g><g fill="#957646" font-size="29" font-family="KaiTi,STKaiti,SimSun,serif" text-anchor="middle"><text x="150" y="311" letter-spacing="16">楚河</text><text x="400" y="311" letter-spacing="16">汉界</text></g>';
  $('grid').innerHTML = svg;
}
function drawBoard() {
  const destinations = new Set(selected === null || editing ? [] : engine.legalMoves(board, side).filter(m => m.from === selected).map(m => m.to));
  $('squares').replaceChildren();
  board.forEach((p, index) => {
    const cell = document.createElement('button'), [x, y] = coord(index);
    cell.type = 'button'; cell.className = 'square'; cell.dataset.index = index;
    cell.style.left = `${x / 540 * 100}%`; cell.style.top = `${y / 600 * 100}%`;
    cell.setAttribute('aria-label', `${String.fromCharCode(97 + index % 9)}${9 - Math.floor(index / 9)} ${p ? sideName(engine.color(p)) + engine.names[p] : '空位'}`);
    if (p) { cell.classList.add('piece', engine.color(p) === 'r' ? 'red' : 'black'); cell.textContent = engine.names[p]; }
    if (selected === index) cell.classList.add('selected');
    if (destinations.has(index)) cell.classList.add('legal');
    if (lastMove && (index === lastMove.from || index === lastMove.to)) cell.classList.add('last');
    cell.addEventListener('click', () => clickSquare(index));
    $('squares').append(cell);
  });
  $('red-location').textContent = flipped ? '在上' : '在下';
  $('black-location').textContent = flipped ? '在下' : '在上';
  drawArrow();
}
function drawArrow() {
  const candidate = result?.candidates[candidateIndex];
  if (!candidate || selected !== null || editing) { $('arrows').innerHTML = ''; return; }
  const [x1, y1] = coord(candidate.move.from), [x2, y2] = coord(candidate.move.to);
  const length = Math.hypot(x2 - x1, y2 - y1), dx = (x2 - x1) / length, dy = (y2 - y1) / length;
  $('arrows').innerHTML = `<defs><marker id="arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="3.5" markerHeight="3.5" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#276445"/></marker></defs><path d="M${x1 + dx * 19} ${y1 + dy * 19}L${x2 - dx * 17} ${y2 - dy * 17}" stroke="#276445" stroke-width="7" stroke-linecap="round" opacity=".8" marker-end="url(#arrowhead)"/>`;
}
function render() {
  drawBoard();
  const ourTurn = side === mySide;
  $('my-side').value = mySide;
  $('my-side-note').textContent = `你执${sideName(mySide)}，${mySide === 'r' ? '先手' : '后手'}`;
  $('analysis-title').textContent = `帮我下${sideName(mySide)}`;
  $('score-perspective').textContent = `以我方（${sideName(mySide)}）为准`;
  $('turn-guide').classList.toggle('waiting', !ourTurn);
  $('turn-guide').textContent = editing ? `你执${sideName(mySide)}。摆好棋子后，确认「当前轮到」谁走，再退出摆盘。` : ourTurn ? `轮到你（${sideName(mySide)}）。分析完成后，按推荐走法落子，再同步棋盘。` : `轮到对方（${sideName(side)}）。请在棋盘上录入对手实际走的那一步。`;
  $('empty-title').textContent = ourTurn ? '轮到你，计算最佳应手' : '先录入对手的走法';
  $('empty-help').textContent = ourTurn ? '点击下方分析按钮，皮卡鱼会为你计算最佳着法。' : `你执${sideName(mySide)}。请把对手的实际着法同步到棋盘，之后自动分析你的应手。`;
  $('file-notice').hidden = localServer;
  updateAnalyzeButton();
  $('side').value = side;
  $('turn-badge').textContent = (ourTurn ? '我方' : '对方') + '行棋';
  $('turn-badge').classList.toggle('black', side === 'b');
  $('editor').hidden = !editing;
  $('play-mode').classList.toggle('active', !editing); $('edit-mode').classList.toggle('active', editing);
  $('play-mode').setAttribute('aria-pressed', String(!editing)); $('edit-mode').setAttribute('aria-pressed', String(editing));
  $('board-help').textContent = editing ? (brush ? `正在放置：${sideName(engine.color(brush))}${engine.names[brush]}` : '橡皮擦：点击棋子移除') : '点击棋子，再点击落点';
  $('undo').disabled = history.length === 0;
  const error = engine.validate(board, side);
  if (error) $('position-state').textContent = editing ? '摆盘中 · 完成后点击「分析当前局面」。' : error;
  else {
    const moves = engine.legalMoves(board, side), checked = engine.inCheck(board, side);
    $('position-state').textContent = !moves.length ? `${sideName(side)}${checked ? '被将死' : '困毙'}，${sideName(engine.other(side))}胜。` : checked ? `${sideName(side)}正被将军，需要先应将。` : `${sideName(side)}行棋 · 当前有 ${moves.length} 种合法着法。`;
  }
  $('fen').value = engine.toFen(board, side);
  const moves = history.slice(history.findLastIndex(h => !h.label) + 1).filter(h => h.label);
  $('move-count').textContent = `${moves.length} 步`;
  $('history').replaceChildren();
  if (!moves.length) { const empty = document.createElement('p'); empty.className = 'muted'; empty.textContent = '落子后，记录会出现在这里。'; $('history').append(empty); }
  moves.forEach((h, i) => { const item = document.createElement('span'); item.className = 'move' + (h.moveSide === 'r' ? ' red' : ''); item.innerHTML = `<small>${i + 1}.</small>${h.label}`; $('history').append(item); });
  $('history').scrollTop = $('history').scrollHeight;
  document.querySelectorAll('#palette button').forEach(b => b.classList.toggle('active', b.dataset.piece === brush));
  $('eraser').classList.toggle('active', brush === null);
}
function clickSquare(index) {
  if (editing) {
    if (board[index] === brush) return;
    save(); invalidate(); board[index] = brush; lastMove = null; render(); say('摆盘修改已保存，可继续放置棋子。'); return;
  }
  const error = engine.validate(board, side);
  if (error) { say(error, true); return; }
  if (selected !== null) {
    if (selected === index) { selected = null; drawBoard(); return; }
    const move = engine.legalMoves(board, side).find(m => m.from === selected && m.to === index);
    if (move) { makeMove(move); return; }
  }
  if (engine.color(board[index]) === side) { selected = index; drawBoard(); say(`已选中${engine.names[board[index]]}，绿色标记是合法落点。`); }
  else { selected = null; drawBoard(); say(`请选择${sideName(side)}棋子；要修改棋子位置，请使用手动摆盘。`); }
}
function makeMove(move) {
  const label = engine.notation(board, move), mover = side;
  save(label, side, move); invalidate();
  board[move.to] = board[move.from]; board[move.from] = null;
  side = engine.other(side); lastMove = move; render();
  say(`${mover === mySide ? '我方' : '对方'} ${label}，轮到${side === mySide ? '你走' : '对方走，请等对方实际落子后录入'}。`);
  if (side === mySide && $('auto-analyze').checked && localServer && engine.legalMoves(board, side).length) analyze();
}
function formatScore(candidate) {
  const perspective = analyzedSide === mySide ? 1 : -1;
  if (candidate.mate !== null && candidate.mate !== undefined) return candidate.mate * perspective > 0 ? `${Math.abs(candidate.mate)} 步内取胜` : `${Math.abs(candidate.mate)} 步内将败`;
  const score = candidate.score * perspective;
  return `${score > 0 ? '+' : ''}${(score / 100).toFixed(2)}`;
}
function showResults(data, finished) {
  result = data; candidateIndex = Math.min(candidateIndex, data.candidates.length - 1);
  if (candidateIndex < 0) candidateIndex = 0;
  $('search-status').textContent = `${finished ? '分析完成' : '正在深入'} · 深度 ${data.depth} · ${data.nodes.toLocaleString()} 节点 · ${(data.elapsed / 1000).toFixed(1)} 秒${data.depth === 0 && data.candidates.length ? '（仅静态估值）' : ''}`;
  if (data.terminal) {
    $('results').hidden = true; $('empty-analysis').hidden = false;
    say(`${sideName(side)}已${data.terminal === 'checkmate' ? '被将死' : '困毙'}，没有合法着法。`);
    drawArrow(); return;
  }
  $('empty-analysis').hidden = true; $('results').hidden = false;
  $('candidates').replaceChildren();
  data.candidates.forEach((c, i) => {
    const button = document.createElement('button'); button.className = 'candidate' + (i === candidateIndex ? ' active' : '');
    button.setAttribute('aria-pressed', String(i === candidateIndex));
    button.innerHTML = `<span class="rank">0${i + 1}</span><strong>${engine.notation(board, c.move)}</strong>${i === 0 ? '<span class="best">推荐</span>' : ''}<span class="eval">${formatScore(c)}</span>`;
    button.addEventListener('click', () => { candidateIndex = i; selected = null; showResults(result, !analysis); drawBoard(); });
    $('candidates').append(button);
  });
  const pvBoard = board.slice(); let turn = analyzedSide;
  $('pv').replaceChildren();
  for (const [i, move] of data.candidates[candidateIndex].pv.slice(0, 10).entries()) {
    const span = document.createElement('span'); span.className = turn === 'r' ? 'pv-red' : '';
    span.textContent = `${turn === mySide ? '我方' : '对方'} ${engine.notation(pvBoard, move)}`;
    $('pv').append(span); pvBoard[move.to] = pvBoard[move.from]; pvBoard[move.from] = null; turn = engine.other(turn);
  }
  drawArrow();
}
function searchPosition() {
  const moves = history.slice(history.findLastIndex(h => !h.label) + 1);
  const start = moves[0] || { board, side };
  const square = index => String.fromCharCode(97 + index % 9) + (9 - Math.floor(index / 9));
  return { fen: engine.toFen(start.board, start.side), moves: moves.map(h => square(h.move.from) + square(h.move.to)), time: Number($('budget').value) };
}
async function analyze() {
  if (analysis) { stopSearch(); $('search-status').textContent += ' · 已停止'; return; }
  if (!localServer) { say('请双击「启动弈见.cmd」使用皮卡鱼增强版。', true); return; }
  if (side !== mySide) { say('现在轮到对方，请先录入对方的实际走法。'); return; }
  const error = engine.validate(board, side);
  if (error) { say(error, true); return; }
  invalidate(); editing = false; candidateIndex = 0; analyzedSide = side; render();
  const controller = new AbortController(); analysis = controller; updateAnalyzeButton();
  $('search-status').textContent = '皮卡鱼正在为你计算…'; say(`正在为你（${sideName(mySide)}）计算最佳着法。`);
  try {
    const response = await fetch('/api/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(searchPosition()), signal: controller.signal });
    if (!response.ok) throw Error(response.status === 429 ? '当前计算繁忙，请稍后再试。' : '分析服务暂时不可用，请稍后重试。');
    const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '';
    while (true) {
      const { value, done } = await reader.read();
      if (controller !== analysis) return;
      buffer += decoder.decode(value, { stream: !done });
      let newline;
      while ((newline = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, newline); buffer = buffer.slice(newline + 1); if (!line) continue;
        const data = JSON.parse(line);
        if (data.type === 'error') throw Error(data.message);
        showResults(data.result, data.type === 'done');
        if (data.type === 'done' && !data.result.terminal) say('计算完成。按推荐落子后，点击「我已走这一步，同步棋盘」。');
      }
      if (done) break;
    }
  } catch (error) {
    if (controller === analysis && error.name !== 'AbortError') { $('search-status').textContent = '分析未完成'; say('分析失败：' + error.message, true); }
  } finally { if (controller === analysis) { analysis = null; updateAnalyzeButton(); } }
}
$('analyze').addEventListener('click', analyze);
$('apply').addEventListener('click', () => { const move = result?.candidates[candidateIndex]?.move; if (move) makeMove(move); });
$('undo').addEventListener('click', () => {
  const previous = history.pop(); if (!previous) return;
  invalidate(); board = previous.board; side = previous.side; lastMove = previous.lastMove; render(); say('已撤销上一步操作。');
});
$('reset').addEventListener('click', () => { save(); invalidate(); ({ board, side } = engine.parseFen(engine.START)); lastMove = null; editing = false; render(); say('已恢复初始局面。可悔棋返回刚才的局面。'); });
$('flip').addEventListener('click', () => { flipped = !flipped; render(); });
$('my-side').addEventListener('change', e => {
  invalidate(); mySide = e.target.value; flipped = mySide === 'b'; render();
  say(`你执${sideName(mySide)}。${side === mySide ? '轮到你，可以开始分析。' : '当前轮到对方，请先录入对方走法。'}`);
});
$('side').addEventListener('change', e => { save(); invalidate(); side = e.target.value; render(); say(`已切换为${sideName(side)}行棋。`); });
$('edit-mode').addEventListener('click', () => { invalidate(); editing = true; render(); say('先选择下方棋子，再点击棋盘放置。'); });
$('play-mode').addEventListener('click', () => {
  const error = engine.validate(board, side); if (error) { say(error, true); return; }
  invalidate(); editing = false; render(); say('已切换为走棋分析。');
});
$('clear-board').addEventListener('click', () => { save(); invalidate(); board = Array(90).fill(null); lastMove = null; render(); say('棋盘已清空。请先放置双方的帅 / 将。'); });
$('eraser').addEventListener('click', () => { brush = null; render(); });
for (const p of 'RNBACKPrnbackp') {
  const button = document.createElement('button'); button.dataset.piece = p; button.textContent = engine.names[p];
  button.className = engine.color(p) === 'r' ? 'red' : 'black'; button.setAttribute('aria-label', `放置${sideName(engine.color(p))}${engine.names[p]}`);
  button.addEventListener('click', () => { brush = p; render(); }); $('palette').append(button);
}
$('import-fen').addEventListener('click', () => {
  try {
    const position = engine.parseFen($('fen').value), error = engine.validate(position.board, position.side);
    if (error) throw Error(error);
    save(); invalidate(); ({ board, side } = position); lastMove = null; editing = false; render(); say('FEN 局面已导入。');
  } catch (error) { say(error.message, true); }
});
$('copy-fen').addEventListener('click', async () => {
  $('fen').value = engine.toFen(board, side);
  try { await navigator.clipboard.writeText($('fen').value); say('当前局面的 FEN 已复制。'); }
  catch { $('fen').focus(); $('fen').select(); say('已选中当前 FEN，请按 Ctrl+C 复制。'); }
});
drawGrid(); render(); say('默认你执黑方。红方先走，请先录入对手的实际着法；也可在上方改为执红。');
