import React, { useState, useEffect, useCallback } from 'react';
import { Chess, Square, Move } from 'chess.js';
import {
  RotateCcw,
  Trophy,
  Swords,
  Volume2,
  VolumeX,
  FlipHorizontal,
  Lightbulb,
  History,
  Zap,
  Flag,
  Trash2,
  X,
  CheckCircle2,
  Calendar,
  ChevronRight,
  Download,
  AlertCircle
} from 'lucide-react';
import { BOTS } from '../data/initialData';
import { EloRating, ChessGameRecord } from '../types';
import { playSound } from '../utils/audioUtils';
import { getAllChessGames, saveChessGame, deleteChessGame, clearAllChessGames } from '../utils/database';

// Standard Piece-Square positional evaluation tables for chess heuristic
const PAWN_PST = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 30, 30, 20, 10, 10],
  [5, 5, 10, 25, 25, 10, 5, 5],
  [0, 0, 0, 20, 20, 0, 0, 0],
  [5, -5, -10, 0, 0, -10, -5, 5],
  [5, 10, 10, -20, -20, 10, 10, 5],
  [0, 0, 0, 0, 0, 0, 0, 0],
];

const KNIGHT_PST = [
  [-50, -40, -30, -30, -30, -30, -40, -50],
  [-40, -20, 0, 0, 0, 0, -20, -40],
  [-30, 0, 10, 15, 15, 10, 0, -30],
  [-30, 5, 15, 20, 20, 15, 5, -30],
  [-30, 0, 15, 20, 20, 15, 0, -30],
  [-30, 5, 10, 15, 15, 10, 5, -30],
  [-40, -20, 0, 5, 5, 0, -20, -40],
  [-50, -40, -30, -30, -30, -30, -40, -50],
];

const PIECE_VALUES: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

export const ChessArena: React.FC = () => {
  const [chessInstance] = useState(() => new Chess());
  const [, setFen] = useState(chessInstance.fen());
  const [selectedElo, setSelectedElo] = useState<EloRating>(1100);
  const [playerColor, setPlayerColor] = useState<'w' | 'b'>('w');
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [validMoves, setValidMoves] = useState<string[]>([]);
  const [isBotThinking, setIsBotThinking] = useState(false);
  const [gameResult, setGameResult] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [hintMove, setHintMove] = useState<string | null>(null);
  const [capturedByWhite, setCapturedByWhite] = useState<string[]>([]);
  const [capturedByBlack, setCapturedByBlack] = useState<string[]>([]);

  // Persistent Chess Game History
  const [matchHistory, setMatchHistory] = useState<ChessGameRecord[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedHistoryGame, setSelectedHistoryGame] = useState<ChessGameRecord | null>(null);
  const [gameStartTime, setGameStartTime] = useState<number>(() => Date.now());
  const [recordedGameId, setRecordedGameId] = useState<string | null>(null);

  const activeBot = BOTS.find((b) => b.elo === selectedElo) || BOTS[2];

  // Load match history from database
  const refreshMatchHistory = useCallback(async () => {
    const games = await getAllChessGames();
    setMatchHistory(games);
  }, []);

  useEffect(() => {
    refreshMatchHistory();
  }, [refreshMatchHistory]);

  // Evaluate board score for Minimax algorithm
  const evaluateBoard = useCallback((game: Chess): number => {
    let score = 0;
    const board = game.board();

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece) {
          const val = PIECE_VALUES[piece.type] || 0;
          let pstVal = 0;
          if (piece.type === 'p') {
            pstVal = piece.color === 'w' ? PAWN_PST[r][c] : PAWN_PST[7 - r][c];
          } else if (piece.type === 'n') {
            pstVal = piece.color === 'w' ? KNIGHT_PST[r][c] : KNIGHT_PST[7 - r][c];
          }

          if (piece.color === 'w') {
            score += val + pstVal;
          } else {
            score -= val + pstVal;
          }
        }
      }
    }
    return score;
  }, []);

  // Minimax with alpha-beta pruning
  const minimax = useCallback(
    (game: Chess, depth: number, alpha: number, beta: number, isMaximizing: boolean): { score: number; move: Move | null } => {
      if (depth === 0 || game.isGameOver()) {
        return { score: evaluateBoard(game), move: null };
      }

      const possibleMoves = game.moves({ verbose: true });
      if (possibleMoves.length === 0) {
        return { score: evaluateBoard(game), move: null };
      }

      let bestMove: Move | null = null;

      if (isMaximizing) {
        let maxEval = -Infinity;
        for (const move of possibleMoves) {
          game.move(move);
          const evaluation = minimax(game, depth - 1, alpha, beta, false).score;
          game.undo();
          if (evaluation > maxEval) {
            maxEval = evaluation;
            bestMove = move;
          }
          alpha = Math.max(alpha, evaluation);
          if (beta <= alpha) break;
        }
        return { score: maxEval, move: bestMove };
      } else {
        let minEval = Infinity;
        for (const move of possibleMoves) {
          game.move(move);
          const evaluation = minimax(game, depth - 1, alpha, beta, true).score;
          game.undo();
          if (evaluation < minEval) {
            minEval = evaluation;
            bestMove = move;
          }
          beta = Math.min(beta, evaluation);
          if (beta <= alpha) break;
        }
        return { score: minEval, move: bestMove };
      }
    },
    [evaluateBoard]
  );

  // Record completed game to database
  const recordFinishedGame = useCallback(
    async (result: 'win' | 'loss' | 'draw' | 'resigned', reason: string) => {
      if (recordedGameId) return; // Prevent duplicate save
      const matchId = `match-${Date.now()}`;
      setRecordedGameId(matchId);

      const now = new Date();
      const dateStr = now.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      const gameRecord: ChessGameRecord = {
        id: matchId,
        date: dateStr,
        timestamp: Date.now(),
        opponent: {
          title: activeBot.title,
          elo: activeBot.elo,
          avatar: activeBot.avatar,
        },
        playerColor,
        result,
        resultReason: reason,
        moveCount: Math.ceil(moveHistory.length / 2),
        moves: [...moveHistory],
        durationSeconds: Math.max(5, Math.floor((Date.now() - gameStartTime) / 1000)),
        fen: chessInstance.fen(),
      };

      await saveChessGame(gameRecord);
      await refreshMatchHistory();
    },
    [recordedGameId, activeBot, playerColor, moveHistory, gameStartTime, chessInstance, refreshMatchHistory]
  );

  // Check Game End Conditions
  const checkEndConditions = useCallback(() => {
    if (chessInstance.isCheckmate()) {
      if (soundEnabled) playSound('gameover');
      const winner = chessInstance.turn() === 'w' ? 'Black' : 'White';
      const playerWon = (winner === 'White' && playerColor === 'w') || (winner === 'Black' && playerColor === 'b');
      const resultText = `Checkmate! ${winner} wins.`;
      setGameResult(resultText);
      recordFinishedGame(playerWon ? 'win' : 'loss', resultText);
    } else if (chessInstance.isDraw()) {
      if (soundEnabled) playSound('gameover');
      let reason = 'Game drawn.';
      if (chessInstance.isStalemate()) {
        reason = 'Stalemate! Game drawn.';
      } else if (chessInstance.isThreefoldRepetition()) {
        reason = 'Draw by threefold repetition.';
      }
      setGameResult(reason);
      recordFinishedGame('draw', reason);
    }
  }, [chessInstance, soundEnabled, playerColor, recordFinishedGame]);

  // Bot makes move calibrated to selected Elo rating
  const triggerBotMove = useCallback(() => {
    if (chessInstance.isGameOver()) return;

    setIsBotThinking(true);
    setTimeout(() => {
      const possibleMoves = chessInstance.moves({ verbose: true });
      if (possibleMoves.length === 0) {
        setIsBotThinking(false);
        return;
      }

      let chosenMove: Move | null = null;
      const isBlundering = Math.random() < activeBot.blunderRate;

      if (isBlundering) {
        chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
      } else if (activeBot.elo <= 800) {
        const captures = possibleMoves.filter((m) => m.captured);
        if (captures.length > 0 && Math.random() > 0.3) {
          chosenMove = captures[Math.floor(Math.random() * captures.length)];
        } else {
          chosenMove = possibleMoves[Math.floor(Math.random() * possibleMoves.length)];
        }
      } else {
        const isBotWhite = playerColor === 'b';
        const depth = activeBot.searchDepth;
        const result = minimax(chessInstance, depth, -Infinity, Infinity, isBotWhite);
        chosenMove = result.move || possibleMoves[0];
      }

      if (chosenMove) {
        const moveRes = chessInstance.move(chosenMove);
        if (moveRes) {
          setFen(chessInstance.fen());
          setMoveHistory((prev) => [...prev, moveRes.san]);
          setHintMove(null);

          if (moveRes.captured) {
            if (soundEnabled) playSound('capture');
            if (moveRes.color === 'w') {
              setCapturedByWhite((prev) => [...prev, moveRes.captured!]);
            } else {
              setCapturedByBlack((prev) => [...prev, moveRes.captured!]);
            }
          } else {
            if (soundEnabled) playSound('move');
          }

          if (chessInstance.inCheck()) {
            if (soundEnabled) playSound('check');
          }

          checkEndConditions();
        }
      }

      setIsBotThinking(false);
    }, 450 + Math.random() * 300);
  }, [chessInstance, activeBot, playerColor, minimax, soundEnabled, checkEndConditions]);

  // Handle Square Selection and Player Move
  const handleSquareClick = (square: Square) => {
    if (chessInstance.isGameOver() || isBotThinking) return;

    const isPlayerTurn = chessInstance.turn() === playerColor;
    if (!isPlayerTurn) return;

    if (selectedSquare) {
      if (selectedSquare === square) {
        setSelectedSquare(null);
        setValidMoves([]);
        return;
      }

      try {
        const move = chessInstance.move({
          from: selectedSquare,
          to: square,
          promotion: 'q',
        });

        if (move) {
          setFen(chessInstance.fen());
          setMoveHistory((prev) => [...prev, move.san]);
          setSelectedSquare(null);
          setValidMoves([]);
          setHintMove(null);

          if (move.captured) {
            if (soundEnabled) playSound('capture');
            if (move.color === 'w') {
              setCapturedByWhite((prev) => [...prev, move.captured!]);
            } else {
              setCapturedByBlack((prev) => [...prev, move.captured!]);
            }
          } else {
            if (soundEnabled) playSound('move');
          }

          if (chessInstance.inCheck()) {
            if (soundEnabled) playSound('check');
          }

          checkEndConditions();

          if (!chessInstance.isGameOver()) {
            triggerBotMove();
          }
          return;
        }
      } catch (e) {
        // Invalid destination, attempt selecting new piece below
      }
    }

    const piece = chessInstance.get(square);
    if (piece && piece.color === playerColor) {
      setSelectedSquare(square);
      const moves = chessInstance.moves({ square, verbose: true });
      setValidMoves(moves.map((m) => m.to));
      if (soundEnabled) playSound('click');
    } else {
      setSelectedSquare(null);
      setValidMoves([]);
    }
  };

  // Flip Board Player Color
  const handleFlipColor = () => {
    playSound('click');
    const newColor = playerColor === 'w' ? 'b' : 'w';
    setPlayerColor(newColor);
    handleResetMatch();
  };

  // Tactical Hint using Minimax
  const handleRequestHint = () => {
    playSound('click');
    const isWhite = chessInstance.turn() === 'w';
    const result = minimax(chessInstance, 3, -Infinity, Infinity, isWhite);
    if (result.move) {
      setHintMove(`${result.move.from} → ${result.move.to} (${result.move.san})`);
      setSelectedSquare(result.move.from);
      setValidMoves([result.move.to]);
    }
  };

  const handleUndo = () => {
    playSound('click');
    chessInstance.undo();
    chessInstance.undo();
    setFen(chessInstance.fen());
    setMoveHistory((prev) => prev.slice(0, -2));
    setSelectedSquare(null);
    setValidMoves([]);
    setGameResult(null);
  };

  const handleResetMatch = () => {
    playSound('click');
    chessInstance.reset();
    setFen(chessInstance.fen());
    setSelectedSquare(null);
    setValidMoves([]);
    setMoveHistory([]);
    setGameResult(null);
    setCapturedByWhite([]);
    setCapturedByBlack([]);
    setHintMove(null);
    setGameStartTime(Date.now());
    setRecordedGameId(null);

    if (playerColor === 'b') {
      setTimeout(() => triggerBotMove(), 300);
    }
  };

  // Handle Resign
  const handleResign = async () => {
    if (chessInstance.isGameOver() || moveHistory.length === 0) return;
    if (!window.confirm(`Resign this match against ${activeBot.title} (${activeBot.elo} Elo)?`)) return;

    if (soundEnabled) playSound('gameover');
    const reason = `Resigned vs ${activeBot.title} (${activeBot.elo} Elo)`;
    setGameResult(reason);
    await recordFinishedGame('resigned', reason);
  };

  // History stats computation
  const winsCount = matchHistory.filter((g) => g.result === 'win').length;
  const lossesCount = matchHistory.filter((g) => g.result === 'loss' || g.result === 'resigned').length;
  const drawsCount = matchHistory.filter((g) => g.result === 'draw').length;
  const winRate = matchHistory.length > 0 ? Math.round((winsCount / matchHistory.length) * 100) : 0;
  const highestBeatenElo = matchHistory
    .filter((g) => g.result === 'win')
    .reduce((max, g) => Math.max(max, g.opponent.elo), 0);

  const handleDeleteHistoryGame = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await deleteChessGame(id);
    await refreshMatchHistory();
    if (selectedHistoryGame?.id === id) {
      setSelectedHistoryGame(null);
    }
    playSound('click');
  };

  const handleClearHistory = async () => {
    if (!window.confirm('Clear all saved chess match history from database?')) return;
    await clearAllChessGames();
    await refreshMatchHistory();
    setSelectedHistoryGame(null);
    playSound('click');
  };

  const renderPieceSymbol = (type: string, color: 'w' | 'b') => {
    const symbols: Record<string, { w: string; b: string }> = {
      p: { w: '♙', b: '♟' },
      r: { w: '♖', b: '♜' },
      n: { w: '♘', b: '♞' },
      b: { w: '♗', b: '♝' },
      q: { w: '♕', b: '♛' },
      k: { w: '♔', b: '♚' },
    };

    const char = symbols[type]?.[color] || '';
    const isWhite = color === 'w';

    return (
      <span
        className={`select-none leading-none ${
          isWhite
            ? 'text-amber-50 drop-shadow-[0_2px_3px_rgba(0,0,0,0.7)]'
            : 'text-slate-900 drop-shadow-[0_1px_1px_rgba(255,255,255,0.4)]'
        }`}
        style={{ fontSize: 'clamp(28px, 5.5vw, 48px)' }}
      >
        {char}
      </span>
    );
  };

  // Generate board coordinates based on player orientation
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

  const displayFiles = playerColor === 'w' ? files : [...files].reverse();
  const displayRanks = playerColor === 'w' ? ranks : [...ranks].reverse();

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4 border-b border-slate-200 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shadow-sm">
              <Swords size={22} />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Cognitive Reset Chess Arena</h2>
              <p className="text-xs text-slate-500">
                Calibrated academic break sparring against sociological faculty engines (500 – 2000 Elo)
              </p>
            </div>
          </div>
        </div>

        {/* Global Chess Actions */}
        <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
          <button
            onClick={() => setIsHistoryModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 rounded-xl text-xs font-bold border border-slate-300 shadow-xs transition-colors cursor-pointer"
            title="View persistent history of all games played"
          >
            <Trophy size={15} className="text-amber-500" />
            <span>Match History</span>
            <span className="px-1.5 py-0.5 rounded-full bg-teal-100 text-teal-800 text-[10px] font-mono font-bold">
              {matchHistory.length}
            </span>
          </button>

          <button
            onClick={() => setSoundEnabled((prev) => !prev)}
            className="p-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl transition-colors cursor-pointer"
            title={soundEnabled ? 'Mute sound' : 'Enable sound'}
          >
            {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
          </button>

          <button
            onClick={handleFlipColor}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            title="Play as opposite color"
          >
            <FlipHorizontal size={15} />
            <span>{playerColor === 'w' ? 'White' : 'Black'}</span>
          </button>

          <button
            onClick={handleResign}
            disabled={chessInstance.isGameOver() || moveHistory.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-rose-50 border border-slate-300 hover:border-rose-300 text-rose-700 rounded-xl text-xs font-bold transition-colors disabled:opacity-40 cursor-pointer"
            title="Resign current match and save to history"
          >
            <Flag size={14} />
            <span>Resign</span>
          </button>

          <button
            onClick={handleResetMatch}
            className="flex items-center gap-2 px-4 py-2 bg-teal-700 hover:bg-teal-800 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-700/20 transition-colors cursor-pointer"
          >
            <RotateCcw size={15} />
            <span>New Game</span>
          </button>
        </div>
      </div>

      {/* Bot Selector Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
        {BOTS.map((bot) => {
          const isSelected = selectedElo === bot.elo;
          return (
            <button
              key={bot.elo}
              onClick={() => {
                setSelectedElo(bot.elo);
                playSound('click');
              }}
              className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? 'bg-teal-50 border-2 border-teal-600 shadow-md ring-1 ring-teal-500/20'
                  : 'bg-white border-slate-200 hover:border-slate-300 shadow-xs'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-2xl">{bot.avatar}</span>
                <span
                  className={`text-xs font-bold font-mono px-2 py-0.5 rounded-full ${
                    isSelected ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {bot.elo}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900 mt-2 truncate">{bot.title}</p>
              <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                {bot.elo <= 800 ? 'Casual play' : bot.elo <= 1400 ? 'Club standard' : 'Master tactics'}
              </p>
            </button>
          );
        })}
      </div>

      {/* Main Board Arena Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left 7 cols: LARGE CHESS BOARD CONTAINER */}
        <div className="lg:col-span-7 flex flex-col items-center">
          {/* Bot Card Header */}
          <div className="w-full max-w-[620px] mb-3 flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{activeBot.avatar}</span>
              <div>
                <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>{activeBot.title}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 border border-teal-200 text-teal-800 font-mono font-bold">
                    {activeBot.elo} Elo
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  {isBotThinking ? (
                    <span className="text-teal-700 font-bold flex items-center gap-1 animate-pulse">
                      <Zap size={13} /> Calculating move...
                    </span>
                  ) : (
                    `Bot Plays ${playerColor === 'w' ? 'Black' : 'White'}`
                  )}
                </p>
              </div>
            </div>

            {/* Captured Pieces by White */}
            <div className="flex gap-1 text-sm font-bold text-slate-800">
              {capturedByWhite.map((p, i) => (
                <span key={i} className="text-slate-800">
                  {p.toUpperCase()}
                </span>
              ))}
            </div>
          </div>

          {/* Actual 8x8 Chessboard */}
          <div className="relative w-full max-w-[620px] aspect-square rounded-2xl overflow-hidden border-4 border-slate-800 shadow-2xl bg-slate-900">
            <div className="grid grid-cols-8 grid-rows-8 w-full h-full">
              {displayRanks.map((rank) =>
                displayFiles.map((file) => {
                  const squareKey = `${file}${rank}` as Square;
                  const piece = chessInstance.get(squareKey);
                  const isLightSquare = (files.indexOf(file) + ranks.indexOf(rank)) % 2 === 0;
                  const isSelected = selectedSquare === squareKey;
                  const isValidTarget = validMoves.includes(squareKey);
                  const isCheckSquare =
                    chessInstance.inCheck() &&
                    piece?.type === 'k' &&
                    piece?.color === chessInstance.turn();

                  return (
                    <div
                      key={squareKey}
                      onClick={() => handleSquareClick(squareKey)}
                      className={`relative flex items-center justify-center cursor-pointer transition-colors ${
                        isCheckSquare
                          ? 'bg-rose-500 ring-4 ring-rose-600 inset-0 z-10'
                          : isSelected
                          ? 'bg-teal-400 ring-2 ring-teal-600 inset-0 z-10'
                          : isLightSquare
                          ? 'bg-[#e8ecef] hover:bg-[#d8e0e5]'
                          : 'bg-[#607d8b] hover:bg-[#546e7a]'
                      }`}
                    >
                      {/* Rank & File coordinate badges */}
                      {file === (playerColor === 'w' ? 'a' : 'h') && (
                        <span
                          className={`absolute top-1 left-1.5 text-[10px] font-bold font-mono select-none ${
                            isLightSquare ? 'text-slate-600' : 'text-slate-200'
                          }`}
                        >
                          {rank}
                        </span>
                      )}
                      {rank === (playerColor === 'w' ? '1' : '8') && (
                        <span
                          className={`absolute bottom-0.5 right-1.5 text-[10px] font-bold font-mono select-none ${
                            isLightSquare ? 'text-slate-600' : 'text-slate-200'
                          }`}
                        >
                          {file}
                        </span>
                      )}

                      {/* Piece display */}
                      {piece && renderPieceSymbol(piece.type, piece.color)}

                      {/* Valid move target markers */}
                      {isValidTarget && !piece && (
                        <div className="w-3.5 h-3.5 rounded-full bg-teal-800/60 shadow-sm" />
                      )}
                      {isValidTarget && piece && (
                        <div className="absolute inset-0 border-4 border-rose-500 rounded-none bg-rose-500/20" />
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Player Card Footer */}
          <div className="w-full max-w-[620px] mt-3 flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-teal-700 text-white font-extrabold flex items-center justify-center text-lg shadow-sm">
                A
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Nadasha (You)</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono font-bold">
                    Playing {playerColor === 'w' ? 'White' : 'Black'}
                  </span>
                </p>
                <p className="text-xs text-slate-500">Sociology Researcher Session</p>
              </div>
            </div>

            {/* Captured Pieces by Black */}
            <div className="flex gap-1 text-sm font-bold text-slate-800">
              {capturedByBlack.map((p, i) => (
                <span key={i} className="text-slate-800">
                  {p.toUpperCase()}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Right 5 cols: STATUS, NOTATION & ACTIONS */}
        <div className="lg:col-span-5 space-y-4">
          {/* Game Status Card */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Match Status
              </span>
              <span className="text-xs font-mono font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded-full border border-teal-200">
                Turn: {chessInstance.turn() === 'w' ? 'White' : 'Black'}
              </span>
            </div>

            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm font-bold flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full shrink-0 ${
                  chessInstance.inCheck()
                    ? 'bg-rose-500 animate-ping'
                    : isBotThinking
                    ? 'bg-amber-500 animate-pulse'
                    : 'bg-emerald-500'
                }`}
              />
              <span className="text-slate-900 leading-snug">
                {gameResult
                  ? gameResult
                  : chessInstance.inCheck()
                  ? 'Check! Defend your King.'
                  : isBotThinking
                  ? `${activeBot.title} (${activeBot.elo}) calculating move...`
                  : chessInstance.turn() === playerColor
                  ? 'Your Turn - Click a piece to move'
                  : 'Opponent Turn'}
              </span>
            </div>

            {/* Hint and Undo Buttons */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                onClick={handleRequestHint}
                disabled={isBotThinking || chessInstance.isGameOver()}
                className="flex items-center justify-center gap-2 py-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 transition-colors cursor-pointer"
              >
                <Lightbulb size={15} className="text-amber-600" />
                <span>Coach Hint</span>
              </button>

              <button
                onClick={handleUndo}
                disabled={moveHistory.length < 2 || isBotThinking}
                className="flex items-center justify-center gap-2 py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <RotateCcw size={15} />
                <span>Takeback (Undo)</span>
              </button>
            </div>

            {hintMove && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2 font-medium">
                <Lightbulb size={15} className="text-amber-600 flex-shrink-0" />
                <span>
                  Recommended Move: <strong className="text-amber-950 font-bold">{hintMove}</strong>
                </span>
              </div>
            )}
          </div>

          {/* Move History / Notation Log */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-2.5">
            <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-500">
              <span className="flex items-center gap-1.5">
                <History size={14} className="text-teal-700" />
                Current Move History ({moveHistory.length} ply)
              </span>
              <button
                onClick={() => setIsHistoryModalOpen(true)}
                className="text-teal-700 hover:underline cursor-pointer"
              >
                All Matches ({matchHistory.length})
              </button>
            </div>

            <div className="h-40 overflow-y-auto bg-slate-50 p-3 rounded-xl border border-slate-200 font-mono text-xs text-slate-800 space-y-1">
              {moveHistory.length === 0 ? (
                <span className="text-slate-400 italic text-xs">No moves played in this match yet.</span>
              ) : (
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {moveHistory.map((m, idx) => {
                    const moveNumber = Math.floor(idx / 2) + 1;
                    const isWhiteMove = idx % 2 === 0;
                    return (
                      <span key={idx} className="truncate">
                        {isWhiteMove && <span className="text-slate-400 mr-1">{moveNumber}.</span>}
                        <span className={isWhiteMove ? 'text-teal-800 font-bold' : 'text-indigo-900 font-bold'}>
                          {m}
                        </span>
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Quick Stats Widget */}
          <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Lifetime Record in Database</span>
              <span className="text-teal-800">{matchHistory.length} Matches</span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                <p className="text-xs text-emerald-800 font-medium">Wins</p>
                <p className="text-base font-black text-emerald-900">{winsCount}</p>
              </div>
              <div className="p-2 rounded-xl bg-rose-50 border border-rose-200">
                <p className="text-xs text-rose-800 font-medium">Losses</p>
                <p className="text-base font-black text-rose-900">{lossesCount}</p>
              </div>
              <div className="p-2 rounded-xl bg-slate-100 border border-slate-200">
                <p className="text-xs text-slate-600 font-medium">Win Rate</p>
                <p className="text-base font-black text-slate-800">{winRate}%</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ================= MATCH HISTORY MODAL ================= */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[85vh] border border-slate-200 shadow-2xl flex flex-col overflow-hidden animate-scaleIn">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center">
                  <Trophy size={20} />
                </div>
                <div>
                  <h3 className="font-bold text-lg text-slate-900">Chess Match Database History</h3>
                  <p className="text-xs text-slate-500">
                    Persistent database record of all games played during doctoral fieldwork breaks
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {matchHistory.length > 0 && (
                  <button
                    onClick={handleClearHistory}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-rose-200 text-rose-700 hover:bg-rose-50 text-xs font-semibold cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Clear All</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsHistoryModalOpen(false);
                    setSelectedHistoryGame(null);
                  }}
                  className="w-8 h-8 rounded-xl bg-slate-200 text-slate-600 hover:text-slate-900 flex items-center justify-center font-bold text-sm cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Summary Stat Banner */}
            <div className="p-4 bg-teal-900 text-white grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
              <div>
                <p className="text-[11px] text-teal-300 font-medium uppercase tracking-wider">Total Games</p>
                <p className="text-xl font-black">{matchHistory.length}</p>
              </div>
              <div>
                <p className="text-[11px] text-teal-300 font-medium uppercase tracking-wider">Victories</p>
                <p className="text-xl font-black text-emerald-400">{winsCount}</p>
              </div>
              <div>
                <p className="text-[11px] text-teal-300 font-medium uppercase tracking-wider">Defeats</p>
                <p className="text-xl font-black text-rose-400">{lossesCount}</p>
              </div>
              <div>
                <p className="text-[11px] text-teal-300 font-medium uppercase tracking-wider">Draws</p>
                <p className="text-xl font-black text-slate-300">{drawsCount}</p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[11px] text-teal-300 font-medium uppercase tracking-wider">Peak Elo Defeated</p>
                <p className="text-xl font-black text-amber-300">{highestBeatenElo || '—'}</p>
              </div>
            </div>

            {/* List of Historical Matches */}
            <div className="flex-1 overflow-y-auto p-5 space-y-3">
              {matchHistory.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="w-14 h-14 mx-auto rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                    <Trophy size={28} />
                  </div>
                  <h4 className="text-base font-bold text-slate-800">No Chess Games Recorded Yet</h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Complete or resign a chess match against any of the faculty bots to store your game analysis in the persistent database.
                  </p>
                </div>
              ) : (
                matchHistory.map((game) => {
                  const isWin = game.result === 'win';
                  const isLoss = game.result === 'loss' || game.result === 'resigned';
                  const isDraw = game.result === 'draw';

                  return (
                    <div
                      key={game.id}
                      onClick={() => setSelectedHistoryGame(game)}
                      className="p-4 rounded-2xl border border-slate-200 hover:border-teal-500 bg-white hover:bg-slate-50/80 transition-all cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs"
                    >
                      <div className="flex items-center gap-3.5">
                        <span className="text-3xl p-2 rounded-xl bg-slate-100 border border-slate-200">
                          {game.opponent.avatar}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">{game.opponent.title}</h4>
                            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                              {game.opponent.elo} Elo
                            </span>
                            <span className="text-xs text-slate-400">•</span>
                            <span className="text-xs text-slate-600 font-semibold">
                              Played as {game.playerColor === 'w' ? 'White' : 'Black'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">{game.date}</p>
                          <p className="text-xs text-slate-600 font-medium italic mt-1">
                            "{game.resultReason}"
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 self-end sm:self-auto">
                        <div className="text-right">
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-xs font-black uppercase tracking-wider ${
                              isWin
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                : isLoss
                                ? 'bg-rose-100 text-rose-800 border border-rose-300'
                                : 'bg-slate-100 text-slate-800 border border-slate-300'
                            }`}
                          >
                            {game.result === 'resigned' ? 'Resigned' : game.result}
                          </span>
                          <p className="text-[11px] font-mono text-slate-500 mt-1">
                            {game.moveCount} moves ({game.durationSeconds}s)
                          </p>
                        </div>

                        <button
                          onClick={(e) => handleDeleteHistoryGame(game.id, e)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                          title="Delete game from database"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= SPECIFIC GAME INSPECT MODAL ================= */}
      {selectedHistoryGame && (
        <div className="fixed inset-0 z-55 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full border border-slate-200 shadow-2xl p-6 space-y-4 animate-scaleIn">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <span className="text-2xl">{selectedHistoryGame.opponent.avatar}</span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">
                    Match vs {selectedHistoryGame.opponent.title} ({selectedHistoryGame.opponent.elo} Elo)
                  </h3>
                  <p className="text-xs text-slate-500">{selectedHistoryGame.date}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedHistoryGame(null)}
                className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center font-bold"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Outcome:</span>
                <span className="font-bold text-slate-900 uppercase">{selectedHistoryGame.result}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Reason:</span>
                <span className="font-semibold text-slate-800">{selectedHistoryGame.resultReason}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-500">Moves:</span>
                <span className="font-mono text-slate-800">{selectedHistoryGame.moveCount} full moves ({selectedHistoryGame.moves.length} ply)</span>
              </div>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-2">
                Move Notation (PGN)
              </h4>
              <div className="h-44 overflow-y-auto bg-slate-900 text-slate-100 p-3.5 rounded-xl font-mono text-xs leading-relaxed">
                {selectedHistoryGame.moves.length === 0 ? (
                  <span className="text-slate-500 italic">No moves recorded</span>
                ) : (
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
                    {selectedHistoryGame.moves.map((m, idx) => {
                      const moveNum = Math.floor(idx / 2) + 1;
                      const isWhite = idx % 2 === 0;
                      return (
                        <span key={idx}>
                          {isWhite && <span className="text-slate-500 mr-1.5">{moveNum}.</span>}
                          <span className={isWhite ? 'text-teal-300 font-bold' : 'text-amber-300 font-bold'}>
                            {m}
                          </span>
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedHistoryGame(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Close Match View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
