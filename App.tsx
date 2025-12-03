import React, { useState } from 'react';
import { Dashboard } from './components/Dashboard';
import { ActiveSession } from './components/ActiveSession';
import { ErrorBoundary } from './components/ErrorBoundary';

function AppContent() {
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  // This key is used to force a complete re-render of the Dashboard 
  // to reload data from localStorage without triggering a browser refresh (window.location.reload)
  // which causes 404 errors in some preview environments.
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
}