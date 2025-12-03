import { WorkoutSessionLog, WorkoutType, WorkoutPlan, ExerciseDef, ExerciseLog, SetLog } from '../types';
import { WORKOUT_A, WORKOUT_B } from '../constants';

const HISTORY_KEY = 'giancarlo_gym_history';
const PLANS_KEY = 'giancarlo_gym_plans';
const REGISTRY_KEY = 'giancarlo_gym_registry';
const INIT_FLAG_KEY = 'giancarlo_gym_initialized';

// --- Safety Helpers (Deep Sanitization) ---

const sanitizeExercises = (exercises: any[]): ExerciseDef[] => {
  if (!Array.isArray(exercises)) return [];
  
  return exercises
    .filter(ex => ex && typeof ex === 'object')
    .map((ex: any) => {
      const rawTags = Array.isArray(ex.tags) ? ex.tags : [];
      const safeTags = rawTags.map(String).filter((t: any) => t && t !== 'null' && t.length > 0);

      return {
        id: String(ex.id || `restored_ex_${Math.random().toString(36).substr(2, 9)}`),
        name: String(ex.name || 'Esercizio Sconosciuto'),
        sets: Number(ex.sets) || 3,
        reps: String(ex.reps || '10'),
        notes: ex.notes ? String(ex.notes) : '',
        isCircuit: !!ex.isCircuit,
        isDuration: !!ex.isDuration,
        defaultWeight: (ex.defaultWeight !== undefined && ex.defaultWeight !== null) ? Number(ex.defaultWeight) : undefined,
        imageUrl: ex.imageUrl ? String(ex.imageUrl) : undefined,
        videoUrl: ex.videoUrl ? String(ex.videoUrl) : undefined,
        tags: safeTags,
        supersetId: ex.supersetId ? String(ex.supersetId) : undefined // Preserve supersetId
      };
    });
};

const sanitizePlans = (plans: any[]): WorkoutPlan[] => {
  if (!Array.isArray(plans)) return [];
  
  return plans
    .filter(p => p && typeof p === 'object')
    .map((p: any) => ({
      id: String(p.id || `restored_plan_${Math.random().toString(36).substr(2, 9)}`),
      name: String(p.name || 'Scheda Importata'),
      exercises: sanitizeExercises(p.exercises),
      isHidden: !!p.isHidden
    }));
};

const sanitizeHistory = (history: any[]): WorkoutSessionLog[] => {
  if (!Array.isArray(history)) return [];

  return history
    .filter(h => h && typeof h === 'object')
    .map((h: any) => {
      const safeDate = (val: any): number => {
          const n = Number(val);
          return !isNaN(n) && n > 0 ? n : Date.now();
      };

      const exercises = Array.isArray(h.exercises) 
        ? h.exercises.map((el: any) => {
            if (!el || typeof el !== 'object') {
                return { exerciseId: 'unknown_restored', sets: [] };
            }

            return {
                exerciseId: String(el.exerciseId || 'unknown_ex'),
                sets: Array.isArray(el.sets) ? el.sets.map((s: any) => {
                    if (!s || typeof s !== 'object') {
                        return { setNumber: 1, weight: 0, completedAt: Date.now() };
                    }
                    
                    // Parse weight robustly - handle strings like "60"
                    const rawWeight = s.weight;
                    const parsedWeight = parseFloat(rawWeight);
                    const safeWeight = !isNaN(parsedWeight) ? parsedWeight : 0;

                    return {
                        setNumber: Number(s.setNumber) || 1,
                        weight: safeWeight,
                        completedAt: safeDate(s.completedAt)
                    };
                }) : []
            };
          })
        : [];

      return {
        id: String(h.id || `restored_log_${Math.random().toString(36).substr(2, 9)}`),
        workoutType: String(h.workoutType || 'unknown'),
        startTime: safeDate(h.startTime),
        endTime: safeDate(h.endTime),
        durationSeconds: Number(h.durationSeconds) || 0,
        exercises: exercises
      };
    });
};

const sanitizeRegistry = (registry: any[]): ExerciseDef[] => {
    return sanitizeExercises(registry);
};

// --- Storage Access ---

export const getHistory = (): WorkoutSessionLog[] => {
  try {
    const stored = localStorage.getItem(HISTORY_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (e) {
    console.error("Failed to read history", e);
    return [];
  }
};

export const saveWorkout = (session: WorkoutSessionLog) => {
  const history = getHistory();
  history.unshift(session); 
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

export const clearHistory = () => {
  localStorage.removeItem(HISTORY_KEY);
};

// --- Test Data Generator ---

export const generateTestHistory = () => {
  clearHistory();

  const currentPlans = getPlans();
  const hasA = currentPlans.some(p => p.id === WORKOUT_A.id);
  const hasB = currentPlans.some(p => p.id === WORKOUT_B.id);
  
  let updatedPlans = [...currentPlans];
  let plansChanged = false;
  
  if (!hasA) { updatedPlans.push(WORKOUT_A); plansChanged = true; }
  if (!hasB) { updatedPlans.push(WORKOUT_B); plansChanged = true; }
  
  if (plansChanged) {
      localStorage.setItem(PLANS_KEY, JSON.stringify(updatedPlans));
  }
  
  const allDefaultExercises = [...WORKOUT_A.exercises, ...WORKOUT_B.exercises];
  updateExerciseRegistry(allDefaultExercises);

  const history: WorkoutSessionLog[] = [];
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 90); 
  
  let currentDate = new Date(startDate);
  const today = new Date();
  let toggle = true; 

  const baseWeights: Record<string, number> = {
    'a_squat': 40, 'a_rdl': 30, 'a_tbar': 35, 'a_lat': 40, 'a_pushdown': 15,
    'a_french': 10, 'a_calf': 60, 'b_bench': 45, 'b_chest': 20, 'b_military': 12,
    'b_bicep_low': 15, 'b_bicep_45': 10, 'b_croci': 10, 'b_lat_raise': 6
  };

  while (currentDate < today) {
    const plan = toggle ? WORKOUT_A : WORKOUT_B;
    const durationMins = 55 + Math.floor(Math.random() * 20); 
    
    const weeksPassed = Math.floor((currentDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 7));
    const progressionFactor = weeksPassed * 1.25;

    const exercisesLog: ExerciseLog[] = plan.exercises.map(ex => {
      const sets: SetLog[] = [];
      if (!ex.isDuration && !ex.isCircuit) {
        const targetSets = ex.sets;
        let weight = baseWeights[ex.id] || (ex.defaultWeight || 10);
        weight = weight + progressionFactor + (Math.random() > 0.7 ? 1.25 : 0);
        weight = Math.round(weight / 1.25) * 1.25;

        for (let i = 1; i <= targetSets; i++) {
          sets.push({
            setNumber: i,
            weight: weight,
            completedAt: currentDate.getTime() + (i * 5 * 60 * 1000)
          });
        }
      }
      return { exerciseId: ex.id, sets: sets };
    });

    const startTime = currentDate.getTime() + (18 * 60 * 60 * 1000);
    const endTime = startTime + (durationMins * 60 * 1000);

    const session: WorkoutSessionLog = {
      id: `test_${currentDate.getTime()}_${Math.random().toString(36).substr(2, 9)}`,
      workoutType: plan.id,
      startTime: startTime,
      endTime: endTime,
      durationSeconds: durationMins * 60,
      exercises: exercisesLog
    };
    
    history.unshift(session);
    currentDate.setDate(currentDate.getDate() + (Math.random() > 0.5 ? 2 : 3));
    toggle = !toggle;
  }

  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  localStorage.setItem(INIT_FLAG_KEY, 'true');
  return history;
};

export const initializeDemoDataIfEmpty = (): WorkoutSessionLog[] => {
  const history = getHistory();
  const hasInitialized = localStorage.getItem(INIT_FLAG_KEY);

  if (history.length > 0) {
      if (!hasInitialized) localStorage.setItem(INIT_FLAG_KEY, 'true');
      return history;
  }

  if (!hasInitialized) {
    return generateTestHistory();
  }
  
  return history;
};

// --- Plans Management ---

export const getPlans = (): WorkoutPlan[] => {
  try {
    const stored = localStorage.getItem(PLANS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return Array.isArray(parsed) ? sanitizePlans(parsed) : [WORKOUT_A, WORKOUT_B];
    }
    const defaults = [WORKOUT_A, WORKOUT_B];
    localStorage.setItem(PLANS_KEY, JSON.stringify(defaults));
    return defaults;
  } catch (e) {
    console.error("Failed to read plans", e);
    return [WORKOUT_A, WORKOUT_B];
  }
};

export const saveNewPlan = (newPlan: WorkoutPlan) => {
  const plans = getPlans();
  const filtered = plans.filter(p => p.id !== newPlan.id);
  filtered.push(newPlan);
  localStorage.setItem(PLANS_KEY, JSON.stringify(filtered));
  updateExerciseRegistry(newPlan.exercises);
};

export const saveAllPlans = (plans: WorkoutPlan[]) => {
  localStorage.setItem(PLANS_KEY, JSON.stringify(plans));
  const allEx = plans.flatMap(p => p.exercises);
  updateExerciseRegistry(allEx);
};

// --- Exercise Registry Management ---

export const getKnownExercises = (): ExerciseDef[] => {
  try {
    const stored = localStorage.getItem(REGISTRY_KEY);
    const defaults = [...WORKOUT_A.exercises, ...WORKOUT_B.exercises];
    const storedList = stored ? JSON.parse(stored) : [];
    
    if (!Array.isArray(storedList)) return defaults;

    const map = new Map<string, ExerciseDef>();
    
    defaults.forEach(ex => map.set(ex.id, ex));
    
    storedList.forEach((storedEx: ExerciseDef) => {
      if (!storedEx || typeof storedEx !== 'object') return;
      const defaultEx = map.get(storedEx.id);
      if (defaultEx && (!storedEx.tags || storedEx.tags.length === 0) && defaultEx.tags && defaultEx.tags.length > 0) {
        map.set(storedEx.id, { ...storedEx, tags: defaultEx.tags });
      } else {
        map.set(storedEx.id, storedEx);
      }
    });
    
    return Array.from(map.values());
  } catch (e) {
    console.error("Failed to read registry", e);
    return [...WORKOUT_A.exercises, ...WORKOUT_B.exercises];
  }
};

export const updateExerciseRegistry = (exercises: ExerciseDef[]) => {
  const current = getKnownExercises();
  const map = new Map(current.map(e => [e.id, e]));

  exercises.forEach(ex => {
    if(ex && ex.id) map.set(ex.id, ex); 
  });

  localStorage.setItem(REGISTRY_KEY, JSON.stringify(Array.from(map.values())));
};

// --- History Helpers (PARANOID MODE) ---

export const getLastWeightForExercise = (exerciseId: string): number | null => {
  const history = getHistory();
  for (const session of history) {
    if (!session || !Array.isArray(session.exercises)) continue;

    const exLog = session.exercises.find(e => e && e.exerciseId === exerciseId);
    
    if (exLog && Array.isArray(exLog.sets) && exLog.sets.length > 0) {
        const lastSet = exLog.sets[exLog.sets.length - 1];
        if (lastSet && typeof lastSet === 'object' && typeof lastSet.weight === 'number') {
            return lastSet.weight;
        }
    }
  }
  return null;
};

export interface ProgressPoint {
  date: string;
  weight: number;
  rawDate: number;
}

export const getExerciseHistory = (exerciseId: string): ProgressPoint[] => {
  const history = getHistory();
  const points: ProgressPoint[] = [];
  
  const sortedHistory = [...history].sort((a, b) => {
      const tA = (a && a.startTime) || 0;
      const tB = (b && b.startTime) || 0;
      return tA - tB;
  });

  sortedHistory.forEach(session => {
    if (!session || !Array.isArray(session.exercises)) return;

    const exLog = session.exercises.find(e => e && e.exerciseId === exerciseId);
    
    if (exLog && Array.isArray(exLog.sets) && exLog.sets.length > 0) {
      const weights = exLog.sets
        .filter(s => s && typeof s === 'object' && typeof s.weight === 'number' && !isNaN(s.weight))
        .map(s => s.weight);
        
      if (weights.length > 0) {
          const maxWeight = Math.max(...weights);
          const dateVal = session.endTime || Date.now();
          points.push({
            date: new Date(dateVal).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
            weight: maxWeight,
            rawDate: dateVal
          });
      }
    }
  });
  
  return points;
};

// --- Volume Helpers (PARANOID MODE) ---

export interface VolumeComparisonData {
  tag: string;
  current: number;
  previous: number;
  [key: string]: any;
}

export const getVolumeComparison = (weeks: number, metric: 'sets' | 'load', providedHistory?: WorkoutSessionLog[]): VolumeComparisonData[] => {
  const history = providedHistory || getHistory();
  
  const now = new Date();
  const currentStart = new Date();
  currentStart.setDate(now.getDate() - (weeks * 7));
  
  const prevStart = new Date(currentStart);
  prevStart.setDate(prevStart.getDate() - (weeks * 7));
  
  const currentPeriodData: Record<string, number> = {};
  const prevPeriodData: Record<string, number> = {};
  
  const knownExercises = getKnownExercises();
  const knownMap = new Map(knownExercises.map(e => [e.id, e]));
  
  const processSession = (session: WorkoutSessionLog, accum: Record<string, number>) => {
      if(!session || !Array.isArray(session.exercises)) return;
      
      session.exercises.forEach(exLog => {
          if (!exLog || !exLog.exerciseId) return;
          
          const def = knownMap.get(exLog.exerciseId);
          const tags = def?.tags || [];
          
          const sets = Array.isArray(exLog.sets) ? exLog.sets : [];
          
          let value = 0;
          if (metric === 'sets') {
              value = sets.length;
          } else {
              value = sets.reduce((sum, s) => {
                  return sum + (s && typeof s === 'object' && typeof s.weight === 'number' ? s.weight : 0);
              }, 0);
          }
          
          if (Array.isArray(tags)) {
              tags.forEach(tag => {
                  if(tag) accum[tag] = (accum[tag] || 0) + value;
              });
          }
      });
  };

  history.forEach(h => {
      if (!h) return;
      const t = h.endTime || 0;
      if (t >= currentStart.getTime()) {
          processSession(h, currentPeriodData);
      } else if (t >= prevStart.getTime() && t < currentStart.getTime()) {
          processSession(h, prevPeriodData);
      }
  });

  const allTags = new Set([...Object.keys(currentPeriodData), ...Object.keys(prevPeriodData)]);
  
  return Array.from(allTags).map(tag => ({
      tag,
      current: currentPeriodData[tag] || 0,
      previous: prevPeriodData[tag] || 0
  })).sort((a, b) => b.current - a.current);
};

// --- Backup & Import ---

export const exportBackup = () => {
  const plans = getPlans();
  const history = getHistory();
  const registry = getKnownExercises();

  const backup = {
    plans: plans,
    history: history,
    registry: registry,
    version: 1,
    mode: 'full',
    exportedAt: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gym_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const importBackup = (file: File): Promise<void> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        if (!content) throw new Error("File vuoto");
        
        let data;
        try {
            data = JSON.parse(content);
        } catch (e) {
            throw new Error(`JSON Corrotto: ${(e as Error).message}`);
        }
        
        if (!data || typeof data !== 'object') {
             throw new Error("Formato non valido: il file non contiene un oggetto JSON.");
        }

        let safePlans, safeHistory, safeRegistry;

        try {
            const rawPlans = Array.isArray(data.plans) ? data.plans : [];
            safePlans = sanitizePlans(rawPlans);
        } catch (e) {
            throw new Error(`Errore in Schede: ${(e as Error).message}`);
        }
        
        try {
            const rawHistory = Array.isArray(data.history) ? data.history : [];
            safeHistory = sanitizeHistory(rawHistory);
        } catch (e) {
            throw new Error(`Errore in Storico: ${(e as Error).message}`);
        }

        try {
             if (data.registry) {
                safeRegistry = sanitizeRegistry(data.registry);
            }
        } catch (e) {
            throw new Error(`Errore in Registro Esercizi: ${(e as Error).message}`);
        }

        try {
            // Clear old data first to free up space
            localStorage.removeItem(PLANS_KEY);
            localStorage.removeItem(HISTORY_KEY);
            localStorage.removeItem(REGISTRY_KEY);

            // Attempt write
            localStorage.setItem(PLANS_KEY, JSON.stringify(safePlans));
            localStorage.setItem(HISTORY_KEY, JSON.stringify(safeHistory));
            if (safeRegistry) {
                localStorage.setItem(REGISTRY_KEY, JSON.stringify(safeRegistry));
            }

            localStorage.setItem(INIT_FLAG_KEY, 'true');
            resolve();
        } catch (e: any) {
            if (e.name === 'QuotaExceededError' || e.code === 22) {
                // AUTO-FIX Attempt: Strip images and try again
                try {
                    console.warn("Quota exceeded. Attempting to strip images from backup data in memory...");
                    
                    const strip = (list: any[]) => list.map((item: any) => {
                       // If imageUrl exists and is base64 (long string), strip it
                       if (item.imageUrl && String(item.imageUrl).length > 500) { 
                           const { imageUrl, ...rest } = item;
                           return rest;
                       }
                       return item;
                    });

                    // Apply stripping
                    const lightPlans = safePlans.map((p: any) => ({ ...p, exercises: strip(p.exercises) }));
                    const lightRegistry = safeRegistry ? strip(safeRegistry) : [];

                    // Retry Write
                    localStorage.setItem(PLANS_KEY, JSON.stringify(lightPlans));
                    localStorage.setItem(HISTORY_KEY, JSON.stringify(safeHistory));
                    if (safeRegistry) localStorage.setItem(REGISTRY_KEY, JSON.stringify(lightRegistry));
                    localStorage.setItem(INIT_FLAG_KEY, 'true');
                    
                    // If successful, alert user but resolve promise
                    alert("Attenzione: Il backup era troppo grande. È stato importato con successo ma le immagini pesanti sono state rimosse per risparmiare spazio.");
                    resolve();
                    return;
                } catch (retryError) {
                    throw new Error("Memoria Piena! Impossibile salvare i dati anche rimuovendo le immagini. Lo spazio nel browser è esaurito.");
                }
            }
            throw new Error(`Errore scrittura disco: ${(e as Error).message}`);
        }
        
      } catch (err) {
        console.error("Import failed", err);
        reject(err);
      }
    };
    
    reader.onerror = () => reject(new Error("Errore di lettura file fisico"));
    reader.readAsText(file);
  });
};