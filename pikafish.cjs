const { spawn } = require('node:child_process');
const { createInterface } = require('node:readline');
const path = require('node:path');
const { availableParallelism } = require('node:os');
const rules = require('./xiangqi.js')();

function fromUci(text) {
  if (!/^[a-i][0-9][a-i][0-9]$/.test(text)) throw Error('无法识别着法：' + text);
  const square = (file, rank) => (9 - Number(rank)) * 9 + file.charCodeAt(0) - 97;
  return { from: square(text[0], text[1]), to: square(text[2], text[3]) };
}
function preparePosition({ fen, moves = [], time = 5000 }) {
  if (typeof fen !== 'string' || !Array.isArray(moves) || !Number.isInteger(time) || time < 100 || time > 30000) throw Error('局面、走子记录或思考时间无效。');
  const { board, side: initialSide } = rules.parseFen(fen);
  let side = initialSide;
  const error = rules.validate(board, side); if (error) throw Error(error);
  const canonicalFen = rules.toFen(board, side) + ' - - 0 1';
  for (const text of moves) {
    if (typeof text !== 'string') throw Error('走子记录格式无效。');
    const move = fromUci(text);
    if (!rules.legalMoves(board, side).some(m => m.from === move.from && m.to === move.to)) throw Error('走子记录中存在非法着法：' + text);
    board[move.to] = board[move.from]; board[move.from] = null; side = rules.other(side);
  }
  return { board, side, time, command: 'position fen ' + canonicalFen + (moves.length ? ' moves ' + moves.join(' ') : '') };
}

function analyze(input, emit = () => {}, signal) {
  return new Promise((resolve, reject) => {
    let position;
    try { position = preparePosition(input); } catch (error) { reject(error); return; }
    const { board, side, time } = position;
    if (!rules.legalMoves(board, side).length) {
      const result = { depth: 0, nodes: 0, elapsed: 0, candidates: [], terminal: rules.inCheck(board, side) ? 'checkmate' : 'stalemate' };
      emit({ type: 'done', result }); resolve(result); return;
    }
    if (signal?.aborted) { reject(new Error('分析已取消')); return; }
    const directory = path.join(__dirname, 'engine');
    const executable = process.platform === 'win32' ? 'Pikafish-Windows-x86-64-universal.exe' : 'Pikafish-Linux-x86-64-universal';
    const child = spawn(path.join(directory, executable), [], { cwd: directory, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    const lines = createInterface({ input: child.stdout });
    let settled = false, latest = null, engineError = '', sent = false;
    const exactLines = new Map();
    const timer = setTimeout(() => finish(new Error('引擎响应超时，请重新分析。')), time + 15000);
    function finish(error, result) {
      if (settled) return;
      settled = true; clearTimeout(timer); signal?.removeEventListener('abort', cancel);
      lines.close(); child.kill();
      if (error) reject(error); else resolve(result);
    }
    const cancel = () => finish(new Error('分析已取消'));
    signal?.addEventListener('abort', cancel, { once: true });
    const send = command => { if (!settled) child.stdin.write(command + '\n'); };
    child.once('error', error => finish(new Error('无法启动皮卡鱼：' + error.message)));
    child.stdin.on('error', error => finish(new Error('引擎通信失败：' + error.message)));
    child.stderr.on('data', chunk => { engineError = String(chunk).trim(); });
    child.once('exit', code => { if (!settled) finish(new Error(engineError || `引擎提前退出（${code}），请检查摆盘。`)); });
    lines.on('line', line => {
      if (settled) return;
      if (line.includes('CRITICAL ERROR')) { engineError = '引擎拒绝此局面：' + line; return; }
      if (line === 'uciok') {
        send('setoption name Threads value ' + Math.max(1, Math.min(4, Math.floor(availableParallelism() / 2))));
        send('setoption name Hash value 64');
        send('setoption name MultiPV value 1'); send('ucinewgame'); send('isready');
      } else if (line === 'readyok' && !sent) {
        sent = true; send(position.command); send('go movetime ' + time);
      } else if (line.startsWith('info depth ') && /\spv\s/.test(line) && !/\b(?:lowerbound|upperbound)\b/.test(line)) {
        const score = line.match(/\bscore (cp|mate) (-?\d+)/), pv = line.match(/\bpv (.+)$/);
        if (!score || !pv) return;
        try {
          const variations = pv[1].trim().split(/\s+/).map(fromUci);
          const candidate = { move: variations[0], pv: variations, score: score[1] === 'cp' ? Number(score[2]) : null, mate: score[1] === 'mate' ? Number(score[2]) : null };
          const field = name => Number(line.match(new RegExp('\\b' + name + ' (\\d+)'))?.[1] || 0);
          latest = { depth: field('depth'), nodes: field('nodes'), elapsed: field('time'), candidates: [candidate] };
          exactLines.set(pv[1].split(' ')[0], latest);
          emit({ type: 'progress', result: latest });
        } catch (error) { finish(error); }
      } else if (line.startsWith('bestmove ')) {
        const bestMove = line.split(' ')[1], result = exactLines.get(bestMove);
        if (!result) { finish(new Error(engineError || '引擎没有返回完整推荐，请重新分析。')); return; }
        emit({ type: 'done', result }); finish(null, result);
      }
    });
    send('uci');
  });
}
module.exports = { analyze, fromUci, preparePosition };
