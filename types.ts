
export enum WorkoutType {
  A = 'A',
  B = 'B',
}

export interface ExerciseDef {
  id: string;
  name: string;
  sets: number;
  reps: string;
  notes?: string;
  isCircuit?: boolean;
  isDuration?: boolean; // For cardio/stretching
  defaultWeight?: number;
  imageUrl?: string;
  videoUrl?: string; // YouTube link
  tags?: string[]; // List of muscle groups (e.g., "Petto", "Dorso")
  supersetId?: string; // ID to group consecutive exercises into a superset/circuit
}

export interface WorkoutPlan {
  id: string;
  name: string;
  exercises: ExerciseDef[];
  isHidden?: boolean;
}

export interface SetLog {
  setNumber: number;
  weight: number;
  completedAt: number; // timestamp
}

export interface ExerciseLog {
  exerciseId: string;
  sets: SetLog[];
}

export interface WorkoutSessionLog {
  id: string;
  workoutType: string;
  startTime: number;
  endTime: number;
  durationSeconds: number;
  exercises: ExerciseLog[];
}