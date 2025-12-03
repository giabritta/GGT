import JSZip from 'jszip';

// This function gathers the current state of the application code
// to allow the user to download it as a standalone project.

const FILES = {
  'index.html': `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Giancarlo Gym Tracker</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
      body { overscroll-behavior-y: none; }
    </style>
  <script type="importmap">
{
  "imports": {
    "lucide-react": "https://aistudiocdn.com/lucide-react@^0.554.0",
    "recharts": "https://aistudiocdn.com/recharts@^3.4.1",
    "react/": "https://aistudiocdn.com/react@^19.2.0/",
    "react": "https://aistudiocdn.com/react@^19.2.0",
    "react-dom/": "https://aistudiocdn.com/react-dom@^19.2.0/",
    "@google/genai": "https://aistudiocdn.com/@google/genai@^1.30.0",
    "jspdf": "https://esm.sh/jspdf@2.5.1",
    "jszip": "https://esm.sh/jszip@3.10.1"
  }
}
</script>
</head>
  <body class="bg-slate-900 text-slate-50 antialiased">
    <div id="root"></div>
  </body>
</html>`,

  'metadata.json': `{
  "name": "Giancarlo Gym Tracker",
  "description": "A personalized workout tracker.",
  "requestFramePermissions": []
}`,

  'index.tsx': `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`,

  'App.tsx': `import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ActiveSession } from './components/ActiveSession';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [dataVersion, setDataVersion] = useState(0);

  const handleStartWorkout = (planId: string) => {
    setActivePlanId(planId);
  };

  const handleFinish = () => {
    setActivePlanId(null);
  };

  const handleCancel = () => {
    setActivePlanId(null);
  };

  const handleSoftReload = () => {
    setDataVersion(v => v + 1);
  };

  return (
    <div className="font-sans">
      {activePlanId ? (
        <ActiveSession 
          planId={activePlanId}
          onFinish={handleFinish}
          onCancel={handleCancel}
        />
      ) : (
        <Dashboard 
            key={dataVersion} 
            onStartWorkout={handleStartWorkout} 
            onDataReload={handleSoftReload}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  );
}`,

  'types.ts': `export enum WorkoutType {
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
  isDuration?: boolean;
  defaultWeight?: number;
  imageUrl?: string;
  tags?: string[];
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
  completedAt: number;
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
}`,
};

export const downloadSourceCode = async () => {
  const zip = new JSZip();

  // Add core files
  Object.entries(FILES).forEach(([name, content]) => {
    zip.file(name, content);
  });
  
  // Note: In this environment we can't reflect the full codebase dynamically,
  // but we ensure the entry points are correct so the user has a working skeleton.
  zip.file("README.md", "Giancarlo Gym Tracker Source Code.\n\nNote: Some component files might need to be copied manually from the chat history if not present in this zip, as this is a generated export.");

  const blob = await zip.generateAsync({ type: 'blob' });
  
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `gym_tracker_source_${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};