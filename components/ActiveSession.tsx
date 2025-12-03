import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { WorkoutPlan, WorkoutType, ExerciseDef, WorkoutSessionLog, ExerciseLog, SetLog } from '../types';
import { saveWorkout, getLastWeightForExercise, getExerciseHistory, getPlans } from '../services/storageService';
import { fetchExerciseDatabase, getYouTubeThumbnail, HFExercise } from '../services/exerciseDatabase';
import { RestTimer, initAudio } from './RestTimer';
import { ExerciseProgressChart } from './ExerciseProgressChart';
import { CheckCircle2, ChevronRight, ArrowLeft, Save, Timer as TimerIcon, Settings, Info, TrendingUp, X, ChevronLeft, AlertTriangle, FastForward, List, Plus, Check, Clock, Percent, Layers, Youtube, ExternalLink, Headphones, Music2, Flame, Zap, Minimize2, Maximize2 } from 'lucide-react';

interface MediaWrapperProps {
    children: React.ReactNode;
    link?: string | null;
}

const MediaWrapper: React.FC<MediaWrapperProps> = ({ children, link }) => {
  if (link) {
      return (
          <a 
              href={link} 
              target="_blank" 
              rel="noopener noreferrer" 
              className="block w-full h-full relative cursor-pointer"
          >
              {children}
          </a>
      );
  }
  return <div className="w-full h-full relative">{children}</div>;
};

// --- MUSIC PLAYER CONSTANTS ---
const PLAYLISTS = {
    POWER: 'PLMC9KNkIncKvY4KSg3GrWLoW8jM51U5_9', // Rock/Metal Motivation
    FOCUS: 'PLj4_d5jB401I-wGj-9B8e5o6a7c8d9e0f'  // Phonk/High Energy
};

interface ActiveSessionProps {
  planId: string;
  onFinish: () => void;
  onCancel: () => void;
}

export const ActiveSession: React.FC<ActiveSessionProps> = ({ planId, onFinish, onCancel }) => {
  // Retrieve plan dynamically
  const plan = useMemo(() => {
    const allPlans = getPlans();
    return allPlans.find(p => p.id === planId) || allPlans[0];
  }, [planId]);
  
  // Grouping Logic for Map View (Copied from Dashboard to ensure consistency)
  const groupedExercises = useMemo(() => {
    const groups: { id: string; isSuperset: boolean; items: ExerciseDef[]; indices: number[] }[] = [];
    let currentSupersetId: string | null = null;
    let currentGroup: ExerciseDef[] = [];
    let currentIndices: number[] = [];

    plan.exercises.forEach((ex, index) => {
        if (ex.supersetId) {
            if (currentSupersetId && ex.supersetId !== currentSupersetId) {
                 if (currentGroup.length > 0) groups.push({ id: currentSupersetId, isSuperset: true, items: [...currentGroup], indices: [...currentIndices] });
                 currentSupersetId = ex.supersetId;
                 currentGroup = [ex];
                 currentIndices = [index];
            } else if (currentSupersetId && ex.supersetId === currentSupersetId) {
                 currentGroup.push(ex);
                 currentIndices.push(index);
            } else {
                 if (currentGroup.length > 0) groups.push({ id: currentSupersetId || `single_${index-1}`, isSuperset: !!currentSupersetId, items: [...currentGroup], indices: [...currentIndices] });
                 currentSupersetId = ex.supersetId;
                 currentGroup = [ex];
                 currentIndices = [index];
            }
        } else {
            if (currentGroup.length > 0) groups.push({ id: currentSupersetId || `single_${index-1}`, isSuperset: !!currentSupersetId, items: [...currentGroup], indices: [...currentIndices] });
            currentSupersetId = null;
            groups.push({ id: `single_${ex.id}_${index}`, isSuperset: false, items: [ex], indices: [index] });
            currentGroup = [];
            currentIndices = [];
        }
    });
    if (currentGroup.length > 0) groups.push({ id: currentSupersetId || `single_last`, isSuperset: !!currentSupersetId, items: [...currentGroup], indices: [...currentIndices] });
    return groups;
  }, [plan]);
  
  // State
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [setsData, setSetsData] = useState<Record<string, SetLog[]>>({});
  const [skippedSetsData, setSkippedSetsData] = useState<Record<string, number>>({});
  const [extraSetsData, setExtraSetsData] = useState<Record<string, number>>({}); // Track manually added sets
  
  const [showTimer, setShowTimer] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showMap, setShowMap] = useState(false); // New: Exercise Map Modal
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  
  // --- Music State ---
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [activePlaylist, setActivePlaylist] = useState<string | null>(null);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);

  const [timerTarget, setTimerTarget] = useState(75);
  const [startTime] = useState(Date.now());
  const [now, setNow] = useState(Date.now()); // Track current time for elapsed calculation
  const [currentWeight, setCurrentWeight] = useState<string>('');
  
  // State for previewing next exercise in Rest Timer
  const [nextUpInfo, setNextUpInfo] = useState<{name: string, setInfo: string} | undefined>(undefined);

  // Database cache for image lookup
  const [hfExercises, setHfExercises] = useState<HFExercise[]>([]);

  useEffect(() => {
    // Load DB silently to improve images
    fetchExerciseDatabase().then(data => setHfExercises(data));
  }, []);
  
  const currentExercise = plan.exercises[currentExerciseIndex];

  // Dynamic Media Logic: Resolve both Thumbnail and Playable Link
  const displayMedia = useMemo(() => {
    let thumbUrl = currentExercise.imageUrl;
    let videoLink = currentExercise.videoUrl;

    // 1. If explicit videoUrl exists, derive thumbnail if missing
    if (videoLink) {
         const t = getYouTubeThumbnail(videoLink);
         if (t && (!thumbUrl || !thumbUrl.includes('img.youtube.com'))) thumbUrl = t;
    }

    // 2. If no videoUrl, try to find in DB
    if (!videoLink && hfExercises.length > 0) {
        const match = hfExercises.find(
            e => e.Exercise.toLowerCase() === currentExercise.name.toLowerCase() || 
                 e.Exercise_IT.toLowerCase() === currentExercise.name.toLowerCase()
        );
        if (match && match['Short YouTube Demonstration']) {
            videoLink = match['Short YouTube Demonstration'];
            const t = getYouTubeThumbnail(videoLink);
            if (t) thumbUrl = t;
        }
    }

    // 3. Fallback placeholder if still no image
    if (!thumbUrl) {
        thumbUrl = `https://picsum.photos/seed/${currentExercise.id}/800/400?grayscale&blur=2`;
    }

    // Check if we effectively have a video to play
    const hasVideo = !!videoLink;
    
    return { 
        url: thumbUrl, 
        videoLink: videoLink,
        hasVideo
    };
  }, [currentExercise, hfExercises]);

  // Update timer every second
  useEffect(() => {
      const interval = setInterval(() => setNow(Date.now()), 1000);
      return () => clearInterval(interval);
  }, []);

  // Helper to get the dynamic target set count
  const getEffectiveTargetSets = (exId: string) => {
      const originalSets = plan.exercises.find(e => e.id === exId)?.sets || 3;
      const extra = extraSetsData[exId] || 0;
      return originalSets + extra;
  };

  // Global Progress Calculation (Sets based)
  const { totalSetsPlanned, totalSetsCompleted, progressPercent } = useMemo(() => {
      let planned = 0;
      let completed = 0;

      plan.exercises.forEach(ex => {
          const target = (ex.sets || 3) + (extraSetsData[ex.id] || 0);
          const done = (setsData[ex.id]?.length || 0) + (skippedSetsData[ex.id] || 0);
          planned += target;
          completed += done;
      });

      const percent = planned > 0 ? Math.round((completed / planned) * 100) : 0;
      return { totalSetsPlanned: planned, totalSetsCompleted: completed, progressPercent: percent };
  }, [plan, setsData, skippedSetsData, extraSetsData]);

  // Elapsed Time Calculation
  const elapsedSeconds = Math.floor((now - startTime) / 1000);
  const formatElapsed = (secs: number) => {
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
  };
  
  // Load last weight when exercise changes
  useEffect(() => {
    if (currentExercise) {
      const lastWeight = getLastWeightForExercise(currentExercise.id);
      if (lastWeight !== null && lastWeight !== undefined) {
        setCurrentWeight(lastWeight.toString());
      } else if (currentExercise.defaultWeight) {
        setCurrentWeight(currentExercise.defaultWeight.toString());
      } else {
        setCurrentWeight('');
      }
    }
  }, [currentExercise]);

  const historyData = useMemo(() => {
      if (showHistory) {
          return getExerciseHistory(currentExercise.id);
      }
      return [];
  }, [showHistory, currentExercise.id]);

  const getSetCount = (exId: string) => {
      return (setsData[exId]?.length || 0) + (skippedSetsData[exId] || 0);
  };

  // --- Navigation Logic ---

  const handleNextExercise = () => {
      if (currentExerciseIndex < plan.exercises.length - 1) {
          setCurrentExerciseIndex(prev => prev + 1);
      }
  };

  const handlePrevExercise = () => {
    if (currentExerciseIndex > 0) {
      setCurrentExerciseIndex(prev => prev - 1);
    }
  };

  const handleJumpToExercise = (index: number) => {
      setCurrentExerciseIndex(index);
      setShowMap(false);
  };

  const handleAddSet = () => {
      setExtraSetsData(prev => ({
          ...prev,
          [currentExercise.id]: (prev[currentExercise.id] || 0) + 1
      }));
  };

  const calculateNextInfo = (currentEx: ExerciseDef, setsDoneIncludingCurrent: number, isLoopingSuperset: boolean) => {
      const target = getEffectiveTargetSets(currentEx.id);
      
      // 1. Logic for Loop Back (Circuit Mode)
      if (isLoopingSuperset) {
          const sid = currentEx.supersetId;
          const firstExOfSuperset = plan.exercises.find(e => e.supersetId === sid);
          if (firstExOfSuperset) {
              const nextSetNum = (setsData[firstExOfSuperset.id]?.length || 0) + 1; // It will be the next set for the *first* ex
              const firstExTarget = getEffectiveTargetSets(firstExOfSuperset.id);
              return {
                  name: firstExOfSuperset.name,
                  setInfo: `Serie ${Math.min(nextSetNum + 1, firstExTarget)} di ${firstExTarget} (Circuito)`
              };
          }
      }
      
      // 2. Standard Logic: Is there another set for THIS exercise?
      if (setsDoneIncludingCurrent < target && !currentEx.supersetId) {
          return {
              name: currentEx.name,
              setInfo: `Serie ${setsDoneIncludingCurrent + 1} di ${target}`
          };
      }
      
      // 3. Move to NEXT exercise (Standard or End of Superset Block)
      const nextIndex = currentExerciseIndex + 1;
      if (nextIndex < plan.exercises.length) {
          const nextEx = plan.exercises[nextIndex];
          return {
              name: nextEx.name,
              setInfo: `Serie 1 di ${nextEx.sets}`
          };
      }
      // 4. Workout finished
      return {
          name: "Fine Allenamento!",
          setInfo: "Ottimo lavoro"
      };
  };

  const finishCallbackRef = useRef<() => void>(() => {});

  const triggerRest = (callback: () => void, forceTimer: boolean = false) => {
    if (currentExercise.isDuration && !forceTimer) {
        callback();
    } else {
        setTimerTarget(75);
        setShowTimer(true);
        finishCallbackRef.current = callback;
    }
  };

  const handleFinishSet = () => {
    // Unlock audio context on explicit user interaction
    initAudio();

    // 1. Record the set
    const setNumber = (setsData[currentExercise.id]?.length || 0) + 1;
    const newSet: SetLog = {
      setNumber,
      weight: parseFloat(currentWeight) || 0,
      completedAt: Date.now()
    };

    const updatedSets = {
      ...setsData,
      [currentExercise.id]: [...(setsData[currentExercise.id] || []), newSet]
    };
    setSetsData(updatedSets);

    // 2. Determine next action & Calculate Preview
    const currentTotalSets = getSetCount(currentExercise.id) + 1; // +1 because we just finished one
    const effectiveTarget = getEffectiveTargetSets(currentExercise.id);
    const isLastSetOfExercise = currentTotalSets >= effectiveTarget;

    // --- SUPERSET / CIRCUIT LOGIC ---
    const isSuperset = !!currentExercise.supersetId;
    
    if (isSuperset) {
        // Find all exercises in this superset
        const supersetSequence = plan.exercises.filter(e => e.supersetId === currentExercise.supersetId);
        const currentIndexInSequence = supersetSequence.findIndex(e => e.id === currentExercise.id);
        const isLastInSequence = currentIndexInSequence === supersetSequence.length - 1;

        if (!isLastInSequence) {
            // IMMEDIATE TRANSITION: Move to next exercise in sequence WITHOUT REST
            // We just look for the next exercise in the plan which should be the next in sequence
            if (currentExerciseIndex < plan.exercises.length - 1) {
                setCurrentExerciseIndex(prev => prev + 1);
            }
            return;
        } else {
            // END OF SEQUENCE: Check if we need to loop back
            // We check the target of the *current* exercise (assuming all in circuit have same sets usually)
            if (!isLastSetOfExercise) {
                // REST -> THEN LOOP BACK TO START
                const firstExOfSuperset = supersetSequence[0];
                const globalIndexOfFirst = plan.exercises.findIndex(e => e.id === firstExOfSuperset.id);
                
                setNextUpInfo(calculateNextInfo(currentExercise, currentTotalSets, true));
                
                // FORCE TIMER for Superset Loop
                triggerRest(() => {
                    setCurrentExerciseIndex(globalIndexOfFirst);
                }, true);
                return;
            }
            // ELSE: Sequence done AND Sets done -> Proceed to next block (standard logic below)
        }
    }

    // --- STANDARD LOGIC (Not superset OR End of Superset Block) ---
    
    // Determine next preview
    setNextUpInfo(calculateNextInfo(currentExercise, currentTotalSets, false));

    const performPostRestAction = () => {
        if (isLastSetOfExercise) {
             // Move to next exercise (if exists)
             if (currentExerciseIndex < plan.exercises.length - 1) {
                 setCurrentExerciseIndex(prev => prev + 1);
             }
        }
        // If not last set, stay on current index
    };
    
    // Trigger Rest
    triggerRest(performPostRestAction);
  };

  const handleSkipSet = () => {
      // 1. Increment skipped count
      const currentSkipped = skippedSetsData[currentExercise.id] || 0;
      setSkippedSetsData({
          ...skippedSetsData,
          [currentExercise.id]: currentSkipped + 1
      });

      // 2. Check navigation
      const currentTotalSets = getSetCount(currentExercise.id) + 1; 
      const effectiveTarget = getEffectiveTargetSets(currentExercise.id);
      const isLastSetOfExercise = currentTotalSets >= effectiveTarget;

      // Simplification for Skip: Always move next if done, regardless of superset logic (user manually skipping)
      if (isLastSetOfExercise) {
          if (currentExerciseIndex < plan.exercises.length - 1) {
              setCurrentExerciseIndex(prev => prev + 1);
          }
      }
  };

  const handleTimerComplete = useCallback(() => {
    setShowTimer(false);
    finishCallbackRef.current();
  }, []);

  const finishWorkout = () => {
    const endTime = Date.now();
    const exerciseLogs: ExerciseLog[] = Object.entries(setsData).map(([exId, sets]) => ({
      exerciseId: exId,
      sets: sets as SetLog[]
    }));

    const log: WorkoutSessionLog = {
      id: crypto.randomUUID(),
      workoutType: planId, 
      startTime,
      endTime,
      durationSeconds: (endTime - startTime) / 1000,
      exercises: exerciseLogs
    };

    saveWorkout(log);
    onFinish();
  };

  // Progress calculation
  const currentSetIndex = getSetCount(currentExercise.id);
  const effectiveTarget = getEffectiveTargetSets(currentExercise.id);
  const isDuration = currentExercise.isDuration;
  const isCircuit = currentExercise.isCircuit;

  // Helper to render a map item
  const renderExerciseItem = (ex: ExerciseDef, idx: number) => {
      const status = (() => {
          const target = getEffectiveTargetSets(ex.id);
          const done = (setsData[ex.id]?.length || 0) + (skippedSetsData[ex.id] || 0);
          if (done >= target) return 'done';
          if (done > 0) return 'in-progress';
          return 'todo';
      })();
      
      const isCurrent = idx === currentExerciseIndex;
      
      return (
        <button 
            key={ex.id}
            onClick={() => handleJumpToExercise(idx)}
            className={`w-full p-3 rounded-xl flex items-center gap-3 text-left transition-colors ${
                isCurrent ? 'bg-slate-800 border border-blue-500/50 ring-1 ring-blue-500/20' : 'bg-slate-800/50 border border-slate-800 hover:bg-slate-800'
            }`}
        >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                status === 'done' ? 'bg-emerald-600 text-white' :
                status === 'in-progress' ? 'bg-amber-600 text-white' :
                'bg-slate-700 text-slate-400'
            }`}>
                {status === 'done' ? <Check size={14} /> : idx + 1}
            </div>
            <div className="flex-1">
                <div className="flex items-center gap-2">
                    <p className={`font-medium ${status === 'done' ? 'text-slate-500 line-through' : 'text-white'}`}>{ex.name}</p>
                </div>
                <p className="text-xs text-slate-400">{ex.sets + (extraSetsData[ex.id] || 0)} serie x {ex.reps}</p>
            </div>
            {isCurrent && <span className="text-xs bg-blue-900/30 text-blue-400 px-2 py-1 rounded">ORA</span>}
        </button>
      );
  };

  const selectPlaylist = (playlistId: string | null) => {
      setActivePlaylist(playlistId);
      setIsMusicModalOpen(false);
      setIsPlayerMinimized(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col">
      {/* Header */}
      <div className="p-3 pb-2 bg-slate-900 border-b border-slate-800 shadow-sm z-10">
        <div className="flex items-center justify-between mb-3">
            <button 
                type="button"
                onClick={(e) => { e.preventDefault(); setShowExitConfirmation(true); }} 
                className="p-2 text-red-400 hover:text-red-300 bg-red-900/10 rounded-xl"
            >
                <X size={22} />
            </button>

            <h1 className="font-bold text-white truncate px-2 flex-1 text-center text-lg">{plan.name}</h1>
            
            <div className="flex gap-2">
                <button 
                    type="button"
                    onClick={() => setIsMusicModalOpen(true)}
                    className={`p-2 rounded-full transition-colors ${activePlaylist ? 'text-white bg-red-600 animate-pulse' : 'text-slate-400 bg-slate-800'}`}
                >
                    <Headphones size={20} />
                </button>
                <button 
                    type="button"
                    onClick={() => setShowHistory(true)} 
                    className="p-2 text-blue-400 hover:text-blue-300 bg-blue-900/20 rounded-full"
                >
                    <TrendingUp size={20} />
                </button>
                <button 
                    type="button"
                    onClick={() => setShowMap(true)} 
                    className="p-2 text-emerald-400 hover:text-emerald-300 bg-emerald-900/20 rounded-full"
                >
                    <List size={20} />
                </button>
            </div>
        </div>

        {/* Global Workout Stats */}
        <div className="flex justify-between items-center text-xs px-1 mb-1 text-slate-400 font-mono">
             <div className="flex items-center gap-1">
                 <Clock size={12} className="text-blue-400" />
                 <span>{formatElapsed(elapsedSeconds)}</span>
             </div>
             <div className="flex items-center gap-1">
                 <span>{progressPercent}% Completato</span>
                 <Percent size={12} className="text-emerald-400" />
             </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 bg-slate-800 w-full rounded-full overflow-hidden">
            <div 
            className="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
            />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 p-6 flex flex-col overflow-y-auto">
        
        <div className="mb-4 text-center">
          <div className="flex items-center justify-center gap-4 mb-2">
             <button 
                onClick={handlePrevExercise}
                disabled={currentExerciseIndex === 0}
                className={`p-1 rounded-full ${currentExerciseIndex === 0 ? 'text-slate-700' : 'text-white bg-slate-800'}`}
             >
                 <ChevronLeft size={20} />
             </button>
             <span className="bg-slate-800 text-slate-400 px-3 py-1 rounded text-xs font-mono">
                #{currentExerciseIndex + 1} / {plan.exercises.length}
             </span>
             <button 
                onClick={handleNextExercise}
                disabled={currentExerciseIndex === plan.exercises.length - 1}
                className={`p-1 rounded-full ${currentExerciseIndex === plan.exercises.length - 1 ? 'text-slate-700' : 'text-white bg-slate-800'}`}
             >
                 <ChevronRight size={20} />
             </button>
          </div>
          
          {/* Superset Badge */}
          {currentExercise.supersetId && (
              <div className="flex justify-center mb-2">
                  <span className="inline-flex items-center gap-1 bg-blue-900/30 text-blue-400 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border border-blue-900/50">
                      <Layers size={12} /> Circuito / Superset
                  </span>
              </div>
          )}

          <h2 className="text-2xl font-bold text-white mb-2 leading-tight">{currentExercise.name}</h2>
          <div className="flex items-center justify-center gap-3 mb-6">
              <p className="text-blue-400 font-bold text-lg">
                Target: {effectiveTarget} x {currentExercise.reps}
              </p>
              {!isDuration && !isCircuit && (
                  <button 
                    onClick={handleAddSet}
                    className="flex items-center gap-1 px-2 py-1 bg-blue-900/30 text-blue-400 rounded-lg text-xs font-bold border border-blue-800 hover:bg-blue-900/50 transition-colors"
                  >
                      <Plus size={12} /> Serie
                  </button>
              )}
          </div>

          {/* Notes Section */}
          {currentExercise.notes && (
            <div className="bg-amber-900/20 border border-amber-600/30 text-amber-100 p-4 rounded-xl text-sm mb-6 text-left shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-amber-400 font-bold uppercase tracking-wider text-xs">
                 <Settings size={14} />
                 Setup & Note
              </div>
              <p className="whitespace-pre-line font-medium leading-relaxed">{currentExercise.notes}</p>
            </div>
          )}
          
          {/* Image/Video Placeholder */}
          <div className="w-full h-48 bg-slate-800 rounded-xl mb-6 overflow-hidden relative shadow-inner group transition-all hover:shadow-blue-900/20">
            <MediaWrapper link={displayMedia.videoLink}>
                {displayMedia.url ? (
                    <img 
                    src={displayMedia.url}
                    alt={currentExercise.name}
                    className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Info className="text-white/20 w-16 h-16" />
                    </div>
                )}
                
                {/* Clean Corner Indicator if clickable */}
                {displayMedia.hasVideo && (
                    <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-sm px-2 py-1 rounded text-[10px] text-white font-medium flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
                        <ExternalLink size={10} /> Apri Video
                    </div>
                )}
            </MediaWrapper>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-auto bg-slate-900 rounded-2xl p-6 border border-slate-800 shadow-xl">
          <div className="flex justify-between items-center mb-6">
             <div>
                <p className="text-slate-400 text-xs uppercase tracking-wider font-bold">Serie Corrente</p>
                <div className="flex items-baseline gap-2">
                    <p className="text-4xl font-bold text-white">
                        {Math.min(currentSetIndex + 1, effectiveTarget + 1)} 
                    </p>
                    <span className="text-slate-500 text-xl font-medium">/ {effectiveTarget}</span>
                </div>
             </div>
             
             <button 
                type="button"
                onClick={() => { 
                    const currentDone = getSetCount(currentExercise.id);
                    // Manually trigger rest logic for button press
                    setNextUpInfo(calculateNextInfo(currentExercise, currentDone, false));
                    setTimerTarget(75); 
                    setShowTimer(true); 
                }}
                className="p-4 bg-slate-800 rounded-full text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
             >
                <TimerIcon size={24} />
             </button>
          </div>

          {!isDuration && !isCircuit && (
            <div className="mb-6">
              <label className="block text-slate-400 text-xs uppercase tracking-wider font-bold mb-4 text-center">
                Carico Utilizzato (kg)
              </label>
              <div className="flex items-center justify-center gap-3">
                <button 
                   type="button"
                   onClick={() => setCurrentWeight(w => String(Math.max(0, (parseFloat(w)||0) - 1.25)))}
                   className="bg-slate-800 w-14 h-14 rounded-xl text-white text-2xl font-bold flex items-center justify-center hover:bg-slate-700 active:scale-95 transition-transform"
                > - </button>
                
                <div className="relative w-32">
                  <input 
                    type="number" 
                    value={currentWeight}
                    onChange={(e) => setCurrentWeight(e.target.value)}
                    className="w-full bg-slate-950 border-2 border-slate-700 rounded-xl h-14 text-center text-2xl font-bold text-white focus:border-blue-500 outline-none transition-colors"
                    placeholder="0"
                  />
                </div>

                <button 
                   type="button"
                   onClick={() => setCurrentWeight(w => String((parseFloat(w)||0) + 1.25))}
                   className="bg-slate-800 w-14 h-14 rounded-xl text-white text-2xl font-bold flex items-center justify-center hover:bg-slate-700 active:scale-95 transition-transform"
                > + </button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
                type="button"
                onClick={handleSkipSet}
                className="bg-slate-800 text-slate-300 p-4 rounded-xl font-bold text-lg flex flex-col items-center justify-center w-24 hover:bg-slate-700 transition-all active:scale-95"
            >
                <FastForward size={20} className="mb-1" />
                <span className="text-xs uppercase">Salta</span>
            </button>

            <button
                type="button"
                onClick={handleFinishSet}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white p-4 rounded-xl font-bold text-xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-900/30 active:scale-[0.98]"
            >
                {/* Logic for Button Text */}
                {(() => {
                    const currentSupersetId = currentExercise.supersetId;
                    if (currentSupersetId) {
                        const supersetSequence = plan.exercises.filter(e => e.supersetId === currentSupersetId);
                        const currentIndex = supersetSequence.findIndex(e => e.id === currentExercise.id);
                        const isLastInSeq = currentIndex === supersetSequence.length - 1;
                        if (!isLastInSeq) return <><ChevronRight size={24} /> Prox Circuito</>;
                    }
                    
                    if (currentSetIndex + 1 >= effectiveTarget) return "Fatto, Prossimo";
                    
                    return <><CheckCircle2 size={24} /> Fatto, Pausa</>;
                })()}
            </button>
          </div>
          
          {/* Universal Finish Button at bottom */}
          <div className="mt-4 pt-4 border-t border-slate-800">
              <button onClick={finishWorkout} className="w-full py-3 bg-emerald-900/30 text-emerald-400 border border-emerald-900 rounded-xl font-bold flex justify-center items-center gap-2 hover:bg-emerald-900/50">
                  <Save size={20} /> Concludi Allenamento
              </button>
          </div>
        </div>
      </div>

      {/* Music Selector Modal */}
      {isMusicModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setIsMusicModalOpen(false)}>
              <div className="bg-slate-900 w-full max-w-sm rounded-2xl border border-slate-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                   <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                             <Music2 className="text-blue-400" size={24} />
                             <h3 className="text-xl font-bold text-white">Gym DJ</h3>
                        </div>
                        <button onClick={() => setIsMusicModalOpen(false)}><X size={24} className="text-slate-400" /></button>
                   </div>
                   <p className="text-slate-400 text-sm mb-6">Scegli la playlist per il tuo allenamento. Il player rimarrà attivo in basso.</p>
                   
                   <div className="space-y-3">
                        <button 
                            onClick={() => selectPlaylist(PLAYLISTS.POWER)}
                            className="w-full p-4 bg-gradient-to-r from-orange-900/40 to-red-900/40 border border-red-500/30 hover:border-red-500 rounded-xl flex items-center justify-between group transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-red-600 rounded-lg text-white"><Flame size={20} /></div>
                                <div className="text-left">
                                    <p className="text-white font-bold group-hover:text-red-400 transition-colors">Power & Heavy</p>
                                    <p className="text-slate-400 text-xs">Metal, Rock, Aggressive</p>
                                </div>
                            </div>
                            {activePlaylist === PLAYLISTS.POWER && <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse shadow-[0_0_10px_#ef4444]" />}
                        </button>

                        <button 
                            onClick={() => selectPlaylist(PLAYLISTS.FOCUS)}
                            className="w-full p-4 bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-purple-500/30 hover:border-purple-500 rounded-xl flex items-center justify-between group transition-all"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-purple-600 rounded-lg text-white"><Zap size={20} /></div>
                                <div className="text-left">
                                    <p className="text-white font-bold group-hover:text-purple-400 transition-colors">Focus & Rhythm</p>
                                    <p className="text-slate-400 text-xs">Phonk, Trap, High Energy</p>
                                </div>
                            </div>
                            {activePlaylist === PLAYLISTS.FOCUS && <div className="w-3 h-3 bg-purple-500 rounded-full animate-pulse shadow-[0_0_10px_#a855f7]" />}
                        </button>
                        
                        {activePlaylist && (
                             <button 
                                onClick={() => setActivePlaylist(null)}
                                className="w-full py-3 bg-slate-800 text-slate-400 font-medium rounded-xl hover:bg-slate-700 mt-2"
                             >
                                Spegni Musica
                             </button>
                        )}
                   </div>
              </div>
          </div>
      )}

      {/* Persistent YouTube Player */}
      {activePlaylist && (
        <div className={`fixed z-[40] transition-all duration-300 ease-in-out shadow-2xl rounded-tl-xl overflow-hidden border-t border-l border-slate-700 bg-black ${isPlayerMinimized ? 'bottom-20 right-4 w-32 h-20 opacity-80 hover:opacity-100' : 'bottom-24 right-4 w-72 h-48'}`}>
            <div className="absolute top-0 left-0 right-0 h-6 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-end p-1 gap-1">
                <button 
                    onClick={() => setIsPlayerMinimized(!isPlayerMinimized)} 
                    className="p-1 text-white/70 hover:text-white bg-black/40 rounded-full"
                >
                    {isPlayerMinimized ? <Maximize2 size={12} /> : <Minimize2 size={12} />}
                </button>
                <button 
                    onClick={() => setActivePlaylist(null)} 
                    className="p-1 text-white/70 hover:text-red-400 bg-black/40 rounded-full"
                >
                    <X size={12} />
                </button>
            </div>
            {/* The Iframe must always be present to keep playing */}
            <iframe 
                width="100%" 
                height="100%" 
                src={`https://www.youtube.com/embed/videoseries?list=${activePlaylist}&autoplay=1&loop=1&enablejsapi=1`} 
                title="Gym DJ Player" 
                frameBorder="0" 
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowFullScreen
                className="pointer-events-auto"
            ></iframe>
        </div>
      )}

      {/* Timer Modal */}
      {showTimer && (
        <RestTimer 
          targetSeconds={timerTarget} 
          nextExercise={nextUpInfo}
          onComplete={handleTimerComplete}
          onClose={handleTimerComplete}
          elapsedSeconds={elapsedSeconds}
          progressPercent={progressPercent}
        />
      )}

      {/* Map Modal */}
      {showMap && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setShowMap(false)}>
            <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 relative flex flex-col max-h-[80vh]" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b border-slate-800 flex justify-between items-center">
                    <h3 className="text-white font-bold text-lg">Mappa Allenamento</h3>
                    <button onClick={() => setShowMap(false)}><X size={24} className="text-slate-400" /></button>
                </div>
                <div className="overflow-y-auto p-2 space-y-2 flex-1">
                    {groupedExercises.map((group) => {
                        if (group.isSuperset) {
                            return (
                                <div key={group.id} className="bg-slate-800/30 border border-blue-500/20 rounded-xl overflow-hidden">
                                     <div className="bg-blue-900/20 p-2 flex items-center gap-2 text-blue-400 text-xs font-bold uppercase">
                                        <Layers size={12} /> Superset
                                     </div>
                                     <div className="p-1 space-y-1">
                                        {group.items.map((ex, i) => {
                                            const realIdx = group.indices[i];
                                            return renderExerciseItem(ex, realIdx);
                                        })}
                                     </div>
                                </div>
                            );
                        } else {
                            return renderExerciseItem(group.items[0], group.indices[0]);
                        }
                    })}
                </div>
            </div>
          </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/80" onClick={() => setShowHistory(false)}>
            <div className="bg-slate-900 w-full max-w-md rounded-3xl overflow-hidden border border-slate-800 relative" onClick={e => e.stopPropagation()}>
                <div className="p-4 flex justify-between items-center border-b border-slate-800">
                    <h3 className="text-white font-bold">Andamento Carichi</h3>
                    <button onClick={() => setShowHistory(false)} className="p-1 bg-slate-800 rounded-full text-slate-400">
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    <p className="text-sm text-slate-400 mb-4">{currentExercise.name}</p>
                    <ExerciseProgressChart data={historyData} />
                </div>
            </div>
        </div>
      )}

      {/* Exit Confirmation Modal */}
      {showExitConfirmation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setShowExitConfirmation(false)}>
            <div className="bg-slate-900 w-full max-w-xs rounded-2xl border border-slate-800 p-6 shadow-2xl transform transition-all" onClick={e => e.stopPropagation()}>
                <div className="flex flex-col items-center text-center">
                    <div className="bg-red-900/20 p-4 rounded-full mb-4 text-red-500">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-white mb-2">Esci dall'allenamento?</h3>
                    <p className="text-slate-400 text-sm mb-6">
                        I progressi di questa sessione andranno persi se esci ora.
                    </p>
                    
                    <div className="flex gap-3 w-full">
                        <button 
                            onClick={() => setShowExitConfirmation(false)}
                            className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-medium hover:bg-slate-700 transition-colors"
                        >
                            Annulla
                        </button>
                        <button 
                            onClick={onCancel}
                            className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors"
                        >
                            Esci
                        </button>
                    </div>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};