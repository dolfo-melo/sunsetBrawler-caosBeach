
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameEngine } from './game/GameEngine';
import { GameStats } from './types';
import { audioManager, ThemeType } from '../src/game/AudioManager';

const App: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [gameState, setGameState] = useState<'menu' | 'playing'>('menu');
  const [resetKey, setResetKey] = useState(0); 
  const [volume, setVolume] = useState(0.4);
  const [isMusicMuted, setIsMusicMuted] = useState(false);
  const [stats, setStats] = useState<GameStats>({
    hp: 100,
    maxHp: 100,
    chaos: 0,
    multiplier: 1,
    phase: 1,
    streak: 0,
    targetChaos: 100,
    specialCooldown: 0,
    specialUnlocked: false,
    isBossActive: false,
    isVictory: false,
    isPaused: false
  });

  const prevAudioKey = useRef<string>("");

  // Surgical audio effect that only triggers on relevant logical state changes
  useEffect(() => {
    const isDead = stats.hp <= 0;
    let theme: ThemeType = ThemeType.MENU;

    if (gameState === 'menu' || stats.isPaused) {
      theme = ThemeType.MENU;
    } else if (isDead) {
      theme = ThemeType.DEFEAT;
    } else if (stats.isVictory) {
      theme = ThemeType.VICTORY;
    } else if (stats.isBossActive) {
      theme = stats.phase === 3 ? ThemeType.BOSS_1 : ThemeType.BOSS_2;
    } else {
      const phaseKey = `PHASE_${stats.phase}` as keyof typeof ThemeType;
      theme = ThemeType[phaseKey] || ThemeType.PHASE_1;
    }

    // Only trigger playTheme if the conceptual music state actually changed
    // We add the pause state to the key so that unpausing within the same phase re-triggers the correct theme
    const currentKey = `${theme}_${stats.isPaused}_${gameState}`;
    if (currentKey !== prevAudioKey.current) {
      prevAudioKey.current = currentKey;
      audioManager.playTheme(theme, true);
    }
  }, [gameState, stats.isPaused, stats.phase, stats.isBossActive, stats.isVictory, stats.hp <= 0]);

  // Handle first interaction for autoplay policy
  useEffect(() => {
    const interactionHandler = async () => {
      await audioManager.init();
      // Force an update to start music
      prevAudioKey.current = "FORCE_UPDATE"; 
      window.dispatchEvent(new Event('resize')); // Dummy trigger for state update if needed, but the effect will run anyway
      window.removeEventListener('click', interactionHandler);
      window.removeEventListener('keydown', interactionHandler);
      window.removeEventListener('touchstart', interactionHandler);
    };
    window.addEventListener('click', interactionHandler);
    window.addEventListener('keydown', interactionHandler);
    window.addEventListener('touchstart', interactionHandler);
    return () => {
      window.removeEventListener('click', interactionHandler);
      window.removeEventListener('keydown', interactionHandler);
      window.removeEventListener('touchstart', interactionHandler);
    };
  }, []);

  useEffect(() => {
    audioManager.setMusicMute(isMusicMuted);
  }, [isMusicMuted]);

  useEffect(() => {
    if (gameState === 'playing' && canvasRef.current) {
      engineRef.current = new GameEngine(canvasRef.current, (newStats) => {
        setStats(newStats);
      });
      canvasRef.current.focus();
    }
    return () => {
      engineRef.current?.cleanup();
    };
  }, [gameState, resetKey]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    audioManager.setVolume(val);
  };

  const handleRestart = () => {
    engineRef.current?.cleanup();
    setResetKey(prev => prev + 1);
    setGameState('playing');
  };

  const handleReturnToMenu = () => {
    engineRef.current?.cleanup();
    setGameState('menu');
  };

  const togglePause = () => {
    engineRef.current?.togglePause();
  };

  const toggleMusicMute = () => {
    setIsMusicMuted(prev => !prev);
  };

  const hpPercentage = Math.max(0, (stats.hp / stats.maxHp) * 100);

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-900 text-white p-4 cursor-pointer" title="Click anywhere to start the beat">
        <div className="max-w-xl w-full text-center space-y-8 animate-in fade-in zoom-in duration-700">
           <div className="relative inline-block">
             <h1 className="text-6xl font-black italic tracking-tighter text-yellow-400 drop-shadow-[0_10px_10px_rgba(0,0,0,0.5)] transform -rotate-2">
               SUNSET<br/>BRAWLER
             </h1>
             <div className="absolute -top-4 -right-8 bg-red-600 px-2 py-1 text-xs font-bold rotate-12 uppercase">Chaos Beach</div>
           </div>

           <div className="space-y-4">
             <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setGameState('playing');
                }}
                className="w-full py-6 bg-yellow-400 text-black text-2xl font-bold hover:bg-white hover:scale-105 active:scale-95 transition-all border-b-8 border-yellow-700 shadow-[0_20px_0_rgba(0,0,0,0.2)]"
             >
               START GAME
             </button>
             <div className="bg-slate-800 p-6 border-2 border-slate-700 rounded-lg text-left space-y-4 shadow-xl">
                <h3 className="text-sm font-bold text-yellow-400 border-b border-slate-600 pb-2 uppercase">Arcade Manual</h3>
                <div className="grid grid-cols-2 gap-4 text-[10px] leading-relaxed">
                  <div className="flex items-center gap-2"><span className="bg-slate-700 px-2 py-1 rounded">WASD</span> MOVE</div>
                  <div className="flex items-center gap-2"><span className="bg-slate-700 px-2 py-1 rounded">J</span> JAB</div>
                  <div className="flex items-center gap-2"><span className="bg-slate-700 px-2 py-1 rounded">K</span> STRAIGHT</div>
                  <div className="flex items-center gap-2"><span className="bg-slate-700 px-2 py-1 rounded">L</span> DODGE</div>
                  <div className="col-span-1 text-purple-400 font-bold border-t border-slate-700 pt-2 flex items-center gap-2">
                    <span className="bg-purple-900 px-2 py-1 rounded text-white font-black">E</span> SPECIAL
                  </div>
                  <div className="col-span-1 text-yellow-400 font-bold border-t border-slate-700 pt-2 flex items-center gap-2">
                    <span className="bg-slate-700 px-2 py-1 rounded text-white font-black">P</span> PAUSE
                  </div>
                </div>
             </div>
           </div>

           <div className="flex flex-col items-center pt-4 space-y-4">
             <div className="flex flex-col items-center">
               <span className="text-[10px] text-slate-500 uppercase mb-3 font-bold tracking-widest">Master Volume</span>
               <input 
                 type="range" 
                 min="0" max="1" step="0.01" 
                 value={volume} 
                 onChange={handleVolumeChange}
                 onClick={(e) => e.stopPropagation()}
                 className="w-48 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
               />
             </div>
             <button 
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMusicMute();
                }}
                className={`text-[10px] font-bold uppercase tracking-widest px-4 py-2 border-2 transition-all ${isMusicMuted ? 'border-red-500 text-red-500' : 'border-slate-600 text-slate-400 hover:text-white hover:border-white'}`}
             >
               {isMusicMuted ? 'MUSIC: MUTED' : 'MUSIC: ON'}
             </button>
           </div>

           <p className="text-[10px] text-slate-600 pt-8 animate-pulse font-bold tracking-widest uppercase italic">
             powered by <a 
               href="https://dolfo-melo.com.br/" 
               target="_blank" 
               rel="noopener noreferrer" 
               className="hover:text-yellow-400 transition-colors underline underline-offset-4"
               onClick={(e) => e.stopPropagation()}
             >Rodolfo Melo</a>
           </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-slate-900 text-white select-none">
      {/* HUD Header */}
      <div className="w-full max-w-[800px] flex justify-between items-end mb-6 border-b-4 border-slate-700 pb-3">
        <div className="flex flex-col">
          <h1 className="text-2xl font-black italic tracking-tighter text-yellow-400 drop-shadow-md">SUNSET BRAWLER</h1>
          <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Beach Level {stats.phase}</div>
        </div>
        
        <div className="flex gap-3 items-center">
           <div className="flex flex-col items-center bg-slate-800/50 px-3 py-1 rounded border border-slate-700">
             <span className="text-[8px] text-slate-500 font-bold mb-1 uppercase tracking-tighter">Volume</span>
             <input 
               type="range" 
               min="0" max="1" step="0.01" 
               value={volume} 
               onChange={handleVolumeChange}
               className="w-20 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-yellow-400"
             />
           </div>
           
           <button 
             onClick={toggleMusicMute}
             className={`w-9 h-9 flex items-center justify-center border-b-4 active:border-b-0 active:translate-y-1 transition-all rounded ${isMusicMuted ? 'bg-red-600 border-red-800' : 'bg-slate-700 border-slate-900 hover:bg-slate-600'}`}
           >
             {isMusicMuted ? '🔇' : '🎵'}
           </button>

           <button 
             onClick={togglePause}
             className={`px-4 h-9 flex items-center justify-center border-b-4 active:border-b-0 active:translate-y-1 transition-all font-black text-[10px] uppercase tracking-tighter rounded ${stats.isPaused ? 'bg-green-600 border-green-800 text-white shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'bg-yellow-400 border-yellow-700 text-black'}`}
           >
             {stats.isPaused ? 'RESUME [P]' : 'PAUSE [P]'}
           </button>

           <div className="h-9 w-[2px] bg-slate-700 mx-1"></div>

           <div className="text-center min-w-[50px]">
             <div className="text-[8px] text-slate-500 uppercase font-black">Phase</div>
             <div className="text-lg text-purple-400 font-black leading-none">{stats.phase}/5</div>
           </div>
           <div className="text-center min-w-[50px]">
             <div className="text-[8px] text-slate-500 uppercase font-black">Goal</div>
             <div className="text-lg text-green-400 font-black leading-none">{stats.targetChaos}</div>
           </div>
        </div>
      </div>

      <div className="relative">
        <div className="border-8 border-slate-800 rounded shadow-2xl overflow-hidden bg-black ring-4 ring-slate-900">
          <canvas
            ref={canvasRef}
            width={800}
            height={600}
            tabIndex={0}
            className="outline-none block cursor-none"
          />
        </div>

        {stats.isBossActive && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 px-12 py-3 bg-red-600 border-4 border-yellow-400 animate-bounce shadow-[0_10px_30px_rgba(239,68,68,0.5)] z-20">
            <span className="text-2xl font-black italic text-white drop-shadow-lg tracking-tighter">BOSS FIGHT!</span>
          </div>
        )}

        {stats.specialUnlocked && (
          <div className="absolute top-4 left-4 flex flex-col items-center z-30">
             <div className={`w-16 h-16 border-4 flex items-center justify-center rounded-lg bg-slate-900/90 ${stats.specialCooldown === 0 ? 'border-purple-500 animate-pulse shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'border-slate-700 opacity-40'}`}>
                <span className="text-4xl font-black text-purple-400">E</span>
             </div>
             <div className="w-16 h-3 bg-slate-800 mt-2 border-2 border-slate-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all duration-100" 
                  style={{ width: `${(1 - stats.specialCooldown) * 100}%` }}
                />
             </div>
             <span className={`text-[8px] mt-1 font-bold ${stats.specialCooldown === 0 ? 'text-purple-400 animate-bounce' : 'text-slate-500'}`}>READY</span>
          </div>
        )}

        {/* Pause Overlay */}
        {stats.isPaused && !stats.isVictory && stats.hp > 0 && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm flex flex-col items-center justify-center z-40 p-10 text-center animate-in fade-in zoom-in duration-200">
            <h2 className="text-6xl text-yellow-400 font-black mb-8 tracking-tighter italic drop-shadow-[0_0_20px_rgba(251,191,36,0.3)] uppercase">Paused</h2>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <button 
                onClick={togglePause}
                className="w-full py-6 bg-yellow-400 text-black font-black text-2xl hover:bg-white transition-all transform hover:scale-105 active:scale-95 border-b-8 border-r-8 border-yellow-700"
              >
                RESUME
              </button>
              <button 
                onClick={handleRestart}
                className="w-full py-4 bg-slate-800 text-white font-bold text-lg hover:bg-slate-700 transition-all border-b-4 border-slate-950"
              >
                RESTART
              </button>
              <button 
                onClick={handleReturnToMenu}
                className="w-full py-4 bg-red-900 text-white font-bold text-lg hover:bg-red-800 transition-all border-b-4 border-red-950"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        )}

        {/* KO Overlay */}
        {stats.hp <= 0 && (
          <div className="absolute inset-0 bg-red-950/95 backdrop-blur-md flex flex-col items-center justify-center z-50 p-10 text-center animate-in fade-in duration-500">
            <h2 className="text-8xl text-white font-black mb-4 tracking-tighter italic animate-pulse drop-shadow-[0_0_20px_rgba(255,0,0,0.5)]">KO!</h2>
            <div className="mb-8 space-y-6">
              <p className="text-2xl text-yellow-400 font-bold uppercase tracking-widest italic">Game Over</p>
              <div className="bg-black/60 p-6 border-4 border-slate-700 rounded-lg shadow-2xl">
                <p className="text-[10px] text-slate-400 mb-2 uppercase tracking-widest font-bold">Chaos Score</p>
                <p className="text-5xl font-black text-white">{stats.chaos.toString().padStart(6, '0')}</p>
              </div>
            </div>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <button 
                onClick={handleRestart}
                className="w-full py-6 bg-yellow-400 text-black font-black text-2xl hover:bg-white transition-all transform hover:scale-105 active:scale-95 border-b-8 border-r-8 border-yellow-700"
              >
                INSERT COIN
              </button>
              <button 
                onClick={handleReturnToMenu}
                className="w-full py-4 bg-slate-800 text-white font-bold text-lg hover:bg-slate-700 transition-all border-b-4 border-slate-950"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        )}

        {/* Victory Overlay */}
        {stats.isVictory && (
          <div className="absolute inset-0 bg-yellow-500/90 backdrop-blur-md flex flex-col items-center justify-center z-50 p-10 text-center animate-in fade-in duration-500">
            <h2 className="text-6xl text-black font-black mb-4 tracking-tighter italic animate-bounce drop-shadow-[0_0_20px_rgba(255,255,255,0.8)] uppercase">Victory!</h2>
            <div className="mb-8 space-y-6">
              <p className="text-2xl text-slate-900 font-bold uppercase tracking-widest italic">Beach Mastered</p>
              <div className="bg-white/30 p-6 border-4 border-black rounded-lg shadow-2xl">
                <p className="text-[10px] text-slate-900 mb-2 uppercase tracking-widest font-bold">Final Score</p>
                <p className="text-5xl font-black text-black">{stats.chaos.toString().padStart(6, '0')}</p>
              </div>
            </div>
            <div className="flex flex-col gap-4 w-full max-w-xs">
              <button 
                onClick={handleRestart}
                className="w-full py-6 bg-black text-white font-black text-2xl hover:bg-slate-900 transition-all transform hover:scale-105 active:scale-95 border-b-8 border-r-8 border-slate-700"
              >
                PLAY AGAIN
              </button>
              <button 
                onClick={handleReturnToMenu}
                className="w-full py-4 bg-slate-800 text-white font-bold text-lg hover:bg-slate-700 transition-all border-b-4 border-slate-950"
              >
                MAIN MENU
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Main HUD Bottom */}
      <div className="w-full max-w-[800px] mt-8 grid grid-cols-3 gap-6 p-6 bg-slate-800 border-b-8 border-r-8 border-black rounded-lg shadow-2xl">
        <div className="col-span-1 space-y-2">
          <div className="flex justify-between text-[10px] font-bold text-slate-300">
            <span className="tracking-widest uppercase">Player Health</span>
            <span>{Math.max(0, Math.floor(stats.hp))}%</span>
          </div>
          <div className="h-8 w-full bg-slate-950 border-4 border-slate-700 p-1 rounded shadow-inner">
            <div 
              className={`h-full transition-all duration-300 rounded-sm ${hpPercentage < 35 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.5)]' : 'bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]'}`}
              style={{ width: `${hpPercentage}%` }}
            />
          </div>
        </div>

        <div className="col-span-1 flex flex-col items-center justify-center bg-slate-900/50 rounded-lg p-2 border border-slate-700 shadow-xl">
           <div className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Chaos Points</div>
           <div className="text-4xl text-yellow-400 font-black tracking-tighter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">{stats.chaos.toString().padStart(6, '0')}</div>
        </div>

        <div className="col-span-1 flex items-center justify-end gap-6">
           <div className="text-right">
             <div className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">Streak</div>
             <div className="text-3xl text-blue-400 font-black italic">{stats.streak}</div>
           </div>
           <div className={`w-20 h-20 rounded-xl border-4 flex flex-col items-center justify-center transition-all ${stats.multiplier > 1 ? 'bg-red-600 animate-pulse border-yellow-400 shadow-[0_0_25px_rgba(239,68,68,0.4)]' : 'bg-slate-700 border-slate-600'}`}>
              <div className="text-[8px] font-black uppercase text-white/80 tracking-tighter">Mult</div>
              <div className="text-3xl font-black italic text-white leading-none">x{stats.multiplier}</div>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
