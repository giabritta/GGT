import React, { useEffect, useState, useRef } from 'react';
import { X, Plus, Minus, RotateCcw, Dumbbell, Clock, Percent } from 'lucide-react';

interface RestTimerProps {
  targetSeconds: number;
  nextExercise?: {
    name: string;
    setInfo: string;
  };
  onComplete: () => void;
  onClose: () => void;
  elapsedSeconds?: number;
  progressPercent?: number;
}

// Audio context singleton to persist user activation
let audioCtx: AudioContext | null = null;

export const initAudio = () => {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
            audioCtx = new AudioContextClass();
        }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    return audioCtx;
};

const playBeep = (freq = 880, duration = 0.1) => {
  const ctx = initAudio();
  if (!ctx) return;

  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.value = freq;
    
    // Volume Logic: 1.0 is max volume
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(1.0, ctx.currentTime + 0.02); // Max volume
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    console.error("Audio error", e);
  }
};

export const RestTimer: React.FC<RestTimerProps> = ({ targetSeconds, nextExercise, onComplete, onClose, elapsedSeconds, progressPercent }) => {
  const [timeLeft, setTimeLeft] = useState(targetSeconds);
  const onCompleteRef = useRef(onComplete);

  // Keep ref updated with latest callback to avoid stale closures
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  // Unlock audio context on mount
  useEffect(() => {
    initAudio();
  }, []);
  
  // Handle audio feedback and completion logic
  useEffect(() => {
    if (timeLeft === 0) {
      playBeep(1200, 0.8); // End beep (longer, loud)
      const timeout = setTimeout(() => {
         onCompleteRef.current();
      }, 800); // Slightly longer delay to hear the end beep
      return () => clearTimeout(timeout);
    } else if (timeLeft > 0 && timeLeft <= 3) {
      playBeep(880, 0.2); // Warning beep (loud)
    }
  }, [timeLeft]);

  // Handle timer countdown - Interval independent of props to prevent freezing
  useEffect(() => {
    const interval = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const formatElapsed = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const isUrgent = timeLeft <= 3;

  return (
    <div className="fixed inset-0 bg-black/95 z-50 flex flex-col items-center justify-center p-6">
      {/* Global Stats in Rest Mode */}
      <div className="absolute top-6 left-6 flex flex-col gap-1 text-slate-500 text-xs font-mono">
        {elapsedSeconds !== undefined && (
            <div className="flex items-center gap-1">
                <Clock size={14} className="text-blue-500" />
                <span>{formatElapsed(elapsedSeconds)}</span>
            </div>
        )}
        {progressPercent !== undefined && (
            <div className="flex items-center gap-1">
                <Percent size={14} className="text-emerald-500" />
                <span>{progressPercent}% Fatto</span>
            </div>
        )}
      </div>

      <div className="absolute top-6 right-6">
        <button onClick={onClose} className="p-2 bg-slate-800 rounded-full text-white/60 hover:text-white">
          <X size={32} />
        </button>
      </div>
      
      <h2 className="text-slate-400 text-xl font-medium mb-8 uppercase tracking-widest animate-pulse">Recupero</h2>
      
      <div className="relative flex items-center justify-center w-64 h-64 mb-8">
         {/* Progress Ring (visual) */}
         <div className={`absolute inset-0 border-8 rounded-full transition-colors duration-300 ${isUrgent ? 'border-red-600' : 'border-slate-800'}`}></div>
         <div className={`text-8xl font-bold tabular-nums transition-all duration-300 ${isUrgent ? 'text-red-500 scale-110' : 'text-blue-400'}`}>
            {formatTime(timeLeft)}
         </div>
      </div>

      <div className="flex gap-6 mb-8">
        <button 
          onClick={() => setTimeLeft(t => Math.max(0, t - 10))}
          className="p-4 bg-slate-800 rounded-full active:bg-slate-700"
        >
          <Minus size={24} />
        </button>
        <button 
          onClick={() => setTimeLeft(targetSeconds)}
          className="p-4 bg-slate-800 rounded-full active:bg-slate-700 text-yellow-500"
        >
          <RotateCcw size={24} />
        </button>
        <button 
          onClick={() => setTimeLeft(t => t + 10)}
          className="p-4 bg-slate-800 rounded-full active:bg-slate-700"
        >
          <Plus size={24} />
        </button>
      </div>

      {/* Next Exercise Preview */}
      {nextExercise && (
        <div className="bg-slate-800/50 border border-slate-700 p-4 rounded-2xl w-full max-w-sm text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-2 text-slate-400 text-xs uppercase tracking-wider font-bold mb-2">
                <Dumbbell size={14} /> Prossimo
            </div>
            <p className="text-white font-bold text-xl mb-1 line-clamp-1">{nextExercise.name}</p>
            <p className="text-blue-400 font-medium">{nextExercise.setInfo}</p>
        </div>
      )}

      <button 
        onClick={onComplete}
        className="mt-8 bg-blue-600 text-white px-8 py-4 rounded-xl font-bold text-lg w-full max-w-xs shadow-lg shadow-blue-900/20"
      >
        Salta Recupero
      </button>
    </div>
  );
};
