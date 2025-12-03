import React, { useState, useMemo, useRef, useEffect } from 'react';
import { WorkoutPlan, ExerciseDef } from '../types';
import { getHistory, getExerciseHistory, getPlans, saveNewPlan, saveAllPlans, getKnownExercises, updateExerciseRegistry, initializeDemoDataIfEmpty, clearHistory, getVolumeComparison, exportBackup, importBackup } from '../services/storageService';
import { fetchExerciseDatabase, HFExercise, getYouTubeThumbnail, getYouTubeVideoId, getUniqueValues } from '../services/exerciseDatabase';
import { Play, History, Dumbbell, Eye, X, TrendingUp, Menu, Plus, Upload, Loader2, Camera, Settings, ArrowUp, ArrowDown, Trash2, EyeOff, AlertTriangle, Pencil, Check, Key, ShieldAlert, ExternalLink, LogOut, FileText, Download, Calendar, CheckCircle2, BarChart2, PieChart as PieIcon, Activity, Archive, RefreshCw, Code, ImageOff, Info, Database, Filter, Search, BookOpen, Youtube, Layers, GripVertical, CheckSquare, Square, MousePointer2 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { ExerciseProgressChart } from './ExerciseProgressChart';
import { GoogleGenAI } from "@google/genai";
import jsPDF from "jspdf";

interface DashboardProps {
  onStartWorkout: (id: string) => void;
  onDataReload?: () => void;
}

// Updated based on the Hugging Face dataset 'Target Muscle Group '
const MUSCLE_TAGS = [
    'Addominali', 'Glutei', 'Pettorali', "Flessori dell'anca",
    'Spalle', 'Schiena', 'Adduttori', 'Bicipiti', 'Quadricipiti',
    'Femorali', 'Abduttori', 'Trapezio', 'Tricipiti', 'Avambracci',
    'Polpacci', 'Tibiali', 'Cardio' // Kept Cardio as utility tag
];

const TAG_COLORS: Record<string, string> = {
  // New Dataset mappings
  "Addominali": "#f59e0b", // Amber
  "Glutei": "#f97316", // Orange
  "Pettorali": "#ef4444", // Red
  "Flessori dell'anca": "#d97706", // Amber-dark
  "Spalle": "#8b5cf6", // Violet
  "Schiena": "#3b82f6", // Blue
  "Adduttori": "#ec4899", // Pink
  "Bicipiti": "#10b981", // Emerald
  "Quadricipiti": "#14b8a6", // Teal
  "Femorali": "#6366f1", // Indigo
  "Abduttori": "#d946ef", // Fuchsia
  "Trapezio": "#a855f7", // Purple
  "Tricipiti": "#06b6d4", // Cyan
  "Avambracci": "#64748b", // Slate
  "Polpacci": "#84cc16", // Lime
  "Tibiali": "#22c55e", // Green
  "Cardio": "#94a3b8", // Gray
  
  // Legacy mappings for existing data
  "Core": "#f59e0b",
  "Petto": "#ef4444",
  "Dorso": "#3b82f6",
  "Gambe": "#f97316",
};

export const Dashboard: React.FC<DashboardProps> = ({ onStartWorkout, onDataReload }) => {
  const [history, setHistory] = useState(getHistory());
  const [plans, setPlans] = useState<WorkoutPlan[]>(getPlans());
  const [previewPlan, setPreviewPlan] = useState<WorkoutPlan | null>(null);
  const [selectedProgressExerciseId, setSelectedProgressExerciseId] = useState<string>('');
  
  const [volumeRange, setVolumeRange] = useState<number>(4);
  const [volumeMetric, setVolumeMetric] = useState<'sets' | 'load'>('sets');
  const [volumeChartType, setVolumeChartType] = useState<'bar' | 'pie'>('bar');

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  
  const [pendingImportFile, setPendingImportFile] = useState<File | null>(null);
  const [isImportConfirmOpen, setIsImportConfirmOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const [reportStartDate, setReportStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [reportEndDate, setReportEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  
  const [userApiKey, setUserApiKey] = useState<string>(() => {
      try {
          if (typeof window !== 'undefined') return localStorage.getItem('giancarlo_gym_api_key') || '';
      } catch(e) {}
      return '';
  });
  const [tempApiKey, setTempApiKey] = useState(userApiKey);
  
  const [planToDelete, setPlanToDelete] = useState<string | null>(null);
  const [exerciseToDeleteIndex, setExerciseToDeleteIndex] = useState<number | null>(null);
  
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [customPlanName, setCustomPlanName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [loadingText, setLoadingText] = useState("Analisi con Gemini in corso...");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);

  const [editingExerciseIndex, setEditingExerciseIndex] = useState<number | null>(null);
  // Changed: Now tracking the index of the GROUP being dragged
  const [draggedGroupIndex, setDraggedGroupIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{
      id: string;
      name: string;
      sets: number;
      reps: string;
      notes: string;
      tags: string[];
      supersetId?: string;
  } | null>(null);

  // --- Database Filtering State ---
  const [editModalTab, setEditModalTab] = useState<'local' | 'database'>('local');
  const [hfExercises, setHfExercises] = useState<HFExercise[]>([]);
  const [isDbLoading, setIsDbLoading] = useState(false);
  const [dbSearchTerm, setDbSearchTerm] = useState('');
  const [dbFilterMuscle, setDbFilterMuscle] = useState('');
  const [dbFilterDifficulty, setDbFilterDifficulty] = useState('');
  const [dbFilterEquipment, setDbFilterEquipment] = useState('');
  
  const [availableMuscles, setAvailableMuscles] = useState<string[]>([]);
  const [availableDifficulty, setAvailableDifficulty] = useState<string[]>([]);
  const [availableEquipment, setAvailableEquipment] = useState<string[]>([]);
  
  // New state for viewing details
  const [viewingDbExercise, setViewingDbExercise] = useState<HFExercise | null>(null);

  // --- Multi-Select State ---
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());

  useEffect(() => {
      const initializedHistory = initializeDemoDataIfEmpty();
      setHistory(initializedHistory);
      setPlans(getPlans());
  }, []);

  // Load DB when switching tab
  useEffect(() => {
    if (editModalTab === 'database' && hfExercises.length === 0 && !isDbLoading) {
        setIsDbLoading(true);
        fetchExerciseDatabase().then(data => {
            setHfExercises(data);
            setAvailableMuscles(getUniqueValues(data, 'Target Muscle Group '));
            setAvailableDifficulty(getUniqueValues(data, 'Difficulty Level'));
            setAvailableEquipment(getUniqueValues(data, 'Primary Equipment '));
            setIsDbLoading(false);
        });
    }
  }, [editModalTab, hfExercises.length]);

  // --- Grouping Logic for Drag & Drop ---
  const groupedExercises = useMemo(() => {
    if (!previewPlan) return [];
    const groups: { id: string; isSuperset: boolean; items: ExerciseDef[] }[] = [];
    let currentSupersetId: string | null = null;
    let currentGroup: ExerciseDef[] = [];

    // Helper to push current group
    const pushGroup = () => {
        if (currentGroup.length > 0) {
            groups.push({
                id: currentSupersetId || `single_${currentGroup[0].id}_${Math.random()}`,
                isSuperset: !!currentSupersetId,
                items: [...currentGroup]
            });
            currentGroup = [];
        }
    };

    previewPlan.exercises.forEach((ex) => {
        if (ex.supersetId) {
            if (currentSupersetId && ex.supersetId !== currentSupersetId) {
                // Superset ID changed, push previous group
                pushGroup();
                currentSupersetId = ex.supersetId;
                currentGroup = [ex];
            } else if (currentSupersetId && ex.supersetId === currentSupersetId) {
                // Continue same superset
                currentGroup.push(ex);
            } else {
                // Start new superset
                pushGroup(); // Push any previous single/group
                currentSupersetId = ex.supersetId;
                currentGroup = [ex];
            }
        } else {
            // Exercise has no superset ID
            pushGroup(); // Push previous group
            currentSupersetId = null;
            // Push this single exercise as its own group
            groups.push({
                id: `single_${ex.id}_${Math.random()}`,
                isSuperset: false,
                items: [ex]
            });
        }
    });
    // Push final
    pushGroup();

    return groups;
  }, [previewPlan]);

  const filteredDbExercises = useMemo(() => {
      if (!hfExercises.length) return [];
      return hfExercises.filter(ex => {
          const matchSearch = dbSearchTerm === '' || 
              ex.Exercise.toLowerCase().includes(dbSearchTerm.toLowerCase()) || 
              ex.Exercise_IT.toLowerCase().includes(dbSearchTerm.toLowerCase());
          
          const matchMuscle = dbFilterMuscle === '' || ex['Target Muscle Group '] === dbFilterMuscle;
          const matchDiff = dbFilterDifficulty === '' || ex['Difficulty Level'] === dbFilterDifficulty;
          const matchEquip = dbFilterEquipment === '' || ex['Primary Equipment '] === dbFilterEquipment;
          
          return matchSearch && matchMuscle && matchDiff && matchEquip;
      }).slice(0, 50); // Limit results for performance
  }, [hfExercises, dbSearchTerm, dbFilterMuscle, dbFilterDifficulty, dbFilterEquipment]);

  const selectExerciseFromDb = (ex: HFExercise) => {
      if (!editForm) return;
      
      const newId = ex.Exercise.toLowerCase().replace(/[^a-z0-9]+/g, '_');
      const tag = ex['Target Muscle Group '];
      const tags = tag ? [tag] : [];
      
      // Try to find YouTube thumbnail
      const ytThumb = getYouTubeThumbnail(ex['Short YouTube Demonstration']);

      setEditForm({
          ...editForm,
          id: `db_${newId}`, // Prefix to ensure uniqueness/recognition
          name: ex.Exercise_IT || ex.Exercise, // Use Italian name if available
          tags: tags,
          notes: editForm.notes || `Attrezzo: ${ex['Primary Equipment ']}\nDifficoltà: ${ex['Difficulty Level']}`
      });
      
      // We will handle the image saving in handleSaveExercise by checking the ID
      
      setEditModalTab('local'); // Switch back to editing details
      setViewingDbExercise(null); // Close details if open
  };

  const chartData = useMemo(() => {
    return history.slice(0, 7).reverse().map(session => ({
        date: new Date(session.endTime || Date.now()).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' }),
        duration: Math.round((session.durationSeconds || 0) / 60),
        type: session.workoutType || 'Unknown'
    }));
  }, [history]);

  const volumeComparisonData = useMemo(() => {
      return getVolumeComparison(volumeRange, volumeMetric, history);
  }, [history, plans, volumeRange, volumeMetric]); 

  const streakData = useMemo(() => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const currentDayOfWeek = today.getDay();
      const adjustedDay = currentDayOfWeek === 0 ? 6 : currentDayOfWeek - 1;
      const daysToSubtract = (3 * 7) + adjustedDay;
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - daysToSubtract);
      
      const workoutDates = new Set(history.map(h => {
          try {
            if (!h || !h.endTime) return '';
            const d = new Date(h.endTime);
            if (isNaN(d.getTime())) return '';
            d.setHours(0,0,0,0);
            return d.toISOString().split('T')[0];
          } catch (e) { return ''; }
      }));

      const calendarDays = [];
      for (let i = 0; i < 28; i++) {
          const d = new Date(startDate);
          d.setDate(startDate.getDate() + i);
          const dateString = d.toISOString().split('T')[0];
          const isToday = d.getTime() === today.getTime();
          const hasWorkout = workoutDates.has(dateString);
          calendarDays.push({ date: d, dayNum: d.getDate(), hasWorkout, isToday });
      }
      const count = calendarDays.filter(c => c.hasWorkout).length;
      return { days: calendarDays, count };
  }, [history]);

  const allExercises = useMemo(() => {
    return getKnownExercises().sort((a, b) => a.name.localeCompare(b.name));
  }, [plans, history]);

  useEffect(() => {
      if (!selectedProgressExerciseId && allExercises.length > 0) {
          const defaultId = allExercises.find(e => e.id === 'b_bench' || e.id.includes('bench'))?.id || 
                            allExercises.find(e => e.id === 'a_squat' || e.id.includes('squat'))?.id || 
                            allExercises[0].id;
          setSelectedProgressExerciseId(defaultId);
      }
  }, [allExercises, selectedProgressExerciseId]);

  useEffect(() => {
      if (isSettingsModalOpen) setTempApiKey(userApiKey);
  }, [isSettingsModalOpen, userApiKey]);

  const progressData = useMemo(() => {
     if (!selectedProgressExerciseId) return [];
     return getExerciseHistory(selectedProgressExerciseId);
  }, [selectedProgressExerciseId, history]);

  const togglePreview = (e: React.MouseEvent, plan: WorkoutPlan) => {
    e.stopPropagation();
    setPreviewPlan(plan);
    setEditingExerciseIndex(null);
    setEditForm(null);
    setExerciseToDeleteIndex(null);
    setIsSelectionMode(false);
    setSelectedExerciseIds(new Set());
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportError(null);
    setImportSuccess(false);
    setPendingImportFile(file);
    setIsImportConfirmOpen(true);
  };

  const proceedWithImport = async () => {
      if (!pendingImportFile) return;
      setImportError(null);
      setIsImporting(true);
      await new Promise(r => setTimeout(r, 100));
      try {
        await importBackup(pendingImportFile);
        setImportSuccess(true);
      } catch (err: any) {
        setImportError(err.stack || err.message || String(err));
      } finally {
        setIsImporting(false);
      }
  };

  const finishImport = () => {
      if (onDataReload) onDataReload();
      else window.location.reload();
      setPendingImportFile(null);
      setIsImportConfirmOpen(false);
      setImportSuccess(false);
  };

  const cancelImport = () => {
      setPendingImportFile(null);
      setIsImportConfirmOpen(false);
      setImportError(null);
      setImportSuccess(false);
  };

  const getNextCongruentName = (existingPlans: WorkoutPlan[]) => {
    const existingNames = new Set(existingPlans.map(p => p.name.toLowerCase()));
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    for (const letter of alphabet) {
        const candidate = `Scheda ${letter}`;
        if (!existingNames.has(candidate.toLowerCase())) return candidate;
    }
    return `Scheda ${existingPlans.length + 1}`;
  };

  const saveApiKey = () => {
      const cleanedKey = tempApiKey.trim();
      if (cleanedKey) {
          localStorage.setItem('giancarlo_gym_api_key', cleanedKey);
          setUserApiKey(cleanedKey);
          setIsSettingsModalOpen(false);
      } else {
          clearApiKey();
      }
  };

  const clearApiKey = () => {
      localStorage.removeItem('giancarlo_gym_api_key');
      setUserApiKey('');
      setTempApiKey('');
      setIsSettingsModalOpen(false);
  };

  const handleClearData = () => {
      setIsSidebarOpen(false);
      setIsResetModalOpen(true);
  };

  const confirmClearData = () => {
      clearHistory();
      setHistory([]); 
      setIsResetModalOpen(false);
      if (onDataReload) onDataReload();
  };

  const generatePDF = () => {
    try {
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.width;
        const pageHeight = doc.internal.pageSize.height;
        const margin = 15;
        
        const start = new Date(reportStartDate).getTime();
        const end = new Date(reportEndDate).getTime() + (24 * 60 * 60 * 1000);
        
        const filteredHistory = history.filter(h => (h.endTime || 0) >= start && (h.endTime || 0) <= end);
        
        // --- HEADER ---
        doc.setFillColor(30, 41, 59); // Slate 900
        doc.rect(0, 0, pageWidth, 40, 'F');
        
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(22);
        doc.setFont("helvetica", "bold");
        doc.text("Giancarlo Gym Tracker", margin, 20);
        
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(148, 163, 184); // Slate 400
        doc.text(`Report Periodo: ${new Date(reportStartDate).toLocaleDateString()} - ${new Date(reportEndDate).toLocaleDateString()}`, margin, 30);

        let yPos = 50;

        // --- STATS SUMMARY ---
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Statistiche Generali", margin, yPos);
        yPos += 10;

        const totalWorkouts = filteredHistory.length;
        const totalMinutes = Math.round(filteredHistory.reduce((acc, curr) => acc + (curr.durationSeconds || 0), 0) / 60);
        const avgMinutes = totalWorkouts > 0 ? Math.round(totalMinutes / totalWorkouts) : 0;

        // Draw Stat Cards manually
        const drawStatCard = (x: number, title: string, value: string) => {
            doc.setFillColor(241, 245, 249); // Slate 100
            doc.setDrawColor(226, 232, 240); // Slate 200
            doc.roundedRect(x, yPos, 55, 25, 3, 3, 'FD');
            
            doc.setFontSize(10);
            doc.setTextColor(100, 116, 139);
            doc.text(title, x + 5, yPos + 8);
            
            doc.setFontSize(16);
            doc.setTextColor(15, 23, 42);
            doc.setFont("helvetica", "bold");
            doc.text(value, x + 5, yPos + 18);
        };

        drawStatCard(margin, "Allenamenti", totalWorkouts.toString());
        drawStatCard(margin + 60, "Tempo Totale", `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`);
        drawStatCard(margin + 120, "Durata Media", `${avgMinutes} min`);

        yPos += 35;

        // --- NEW: WEEKLY CONSISTENCY CHART ---
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Costanza Settimanale", margin, yPos);
        yPos += 10;

        // Calculate workouts per week
        const weeksMap: Record<string, number> = {};
        const sortedDates = filteredHistory.map(h => new Date(h.endTime)).sort((a, b) => a.getTime() - b.getTime());
        if (sortedDates.length > 0) {
            sortedDates.forEach(d => {
                // Simple week key: YYYY-WeekNum
                const oneJan = new Date(d.getFullYear(), 0, 1);
                const numberOfDays = Math.floor((d.getTime() - oneJan.getTime()) / (24 * 60 * 60 * 1000));
                const weekNum = Math.ceil((d.getDay() + 1 + numberOfDays) / 7);
                const key = `${d.getFullYear()}-W${weekNum}`;
                weeksMap[key] = (weeksMap[key] || 0) + 1;
            });
            
            const weekKeys = Object.keys(weeksMap);
            if (weekKeys.length > 0) {
                 const barW = 15;
                 const maxH = 40;
                 const maxCount = Math.max(...Object.values(weeksMap));
                 
                 let x = margin + 10;
                 doc.setFontSize(8);
                 doc.setTextColor(100, 116, 139);
                 
                 // Draw axes
                 doc.setDrawColor(203, 213, 225);
                 doc.line(margin, yPos + maxH, pageWidth - margin, yPos + maxH); // X
                 
                 weekKeys.slice(0, 10).forEach((key, i) => { // Limit to 10 weeks fit
                     const count = weeksMap[key];
                     const h = (count / maxCount) * maxH;
                     
                     doc.setFillColor(59, 130, 246); // Blue
                     doc.rect(x, yPos + (maxH - h), barW, h, 'F');
                     
                     doc.text(count.toString(), x + (barW/2) - 1, yPos + (maxH - h) - 2);
                     doc.text(key.split('-')[1], x + 2, yPos + maxH + 4); // Just W##
                     
                     x += barW + 10;
                 });
                 yPos += maxH + 15;
            } else {
                 doc.setFontSize(10); doc.setFont("helvetica", "italic");
                 doc.text("Dati insufficienti.", margin, yPos);
                 yPos += 10;
            }
        } else {
             doc.setFontSize(10); doc.setFont("helvetica", "italic");
             doc.text("Nessun allenamento nel periodo.", margin, yPos);
             yPos += 10;
        }

        // --- NEW: MUSCLE DISTRIBUTION ---
        if (yPos + 60 > pageHeight) { doc.addPage(); yPos = 20; }
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("Distribuzione Muscolare (Serie)", margin, yPos);
        yPos += 10;

        // Calculate volume distribution for this specific period
        const tagCounts: Record<string, number> = {};
        const knownMap = new Map<string, ExerciseDef>(allExercises.map(e => [e.id, e]));
        let totalSets = 0;
        
        filteredHistory.forEach(h => {
             h.exercises.forEach(exLog => {
                 const def = knownMap.get(exLog.exerciseId);
                 const tags = def?.tags || [];
                 const sets = exLog.sets?.length || 0;
                 tags.forEach(t => {
                     tagCounts[t] = (tagCounts[t] || 0) + sets;
                     totalSets += sets;
                 });
             });
        });

        const sortedTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]);
        
        if (sortedTags.length > 0) {
            const barHeight = 6;
            const maxBarWidth = 100;
            const maxVal = sortedTags[0][1];

            sortedTags.forEach(([tag, count]) => {
                 if (yPos > pageHeight - 20) { doc.addPage(); yPos = 20; }
                 
                 // Label
                 doc.setFontSize(10);
                 doc.setTextColor(30, 41, 59);
                 doc.setFont("helvetica", "bold");
                 doc.text(tag, margin, yPos + 5);
                 
                 // Bar
                 const w = (count / maxVal) * maxBarWidth;
                 // Convert hex to rgb for jsPDF
                 const hex = TAG_COLORS[tag] || '#64748b';
                 const r = parseInt(hex.substring(1,3), 16);
                 const g = parseInt(hex.substring(3,5), 16);
                 const b = parseInt(hex.substring(5,7), 16);
                 doc.setFillColor(r, g, b);
                 
                 doc.rect(margin + 30, yPos, w, barHeight, 'F');
                 
                 // Value
                 doc.setFontSize(9);
                 doc.setTextColor(100, 116, 139);
                 doc.setFont("helvetica", "normal");
                 doc.text(`${count} serie`, margin + 30 + w + 2, yPos + 5);
                 
                 yPos += 10;
            });
            yPos += 10;
        } else {
             doc.text("Nessun dato.", margin, yPos);
             yPos += 10;
        }

        // --- EXERCISE PROGRESSION CHARTS ---
        if (yPos + 40 > pageHeight) { doc.addPage(); yPos = 20; }
        doc.setFontSize(14);
        doc.setTextColor(0, 0, 0);
        doc.setFont("helvetica", "bold");
        doc.text("Progressione Carichi", margin, yPos);
        yPos += 10;

        const exercisesToChart = allExercises.filter(ex => !ex.isDuration && !ex.isCircuit);
        let chartDrawn = false;

        exercisesToChart.forEach((ex) => {
            // Get raw history for chart
            const historyPoints = getExerciseHistory(ex.id).sort((a, b) => a.rawDate - b.rawDate);
            // Filter points within date range
            const filteredPoints = historyPoints.filter(p => p.rawDate >= start && p.rawDate <= end);

            if (filteredPoints.length < 2) return; // Need at least 2 points for a line
            chartDrawn = true;

            const chartHeight = 50;
            const chartWidth = 160;
            
            // Page Break Check
            if (yPos + chartHeight + 20 > pageHeight) {
                doc.addPage();
                yPos = 20;
            }

            // Chart Container
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin, yPos, chartWidth + 10, chartHeight + 15, 2, 2, 'S');

            // Title
            doc.setFontSize(11);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(30, 41, 59);
            doc.text(ex.name, margin + 5, yPos + 8);

            // Chart Area Logic
            const graphX = margin + 15;
            const graphY = yPos + 15; // Top of graph area
            const graphH = chartHeight - 10;
            const graphW = chartWidth - 20;

            // Draw Axes
            doc.setDrawColor(203, 213, 225); // Axis color
            doc.setLineWidth(0.5);
            doc.line(graphX, graphY + graphH, graphX + graphW, graphY + graphH); // X Axis
            doc.line(graphX, graphY, graphX, graphY + graphH); // Y Axis

            // Find Range
            const weights = filteredPoints.map(p => p.weight);
            const minWeight = Math.min(...weights);
            const maxWeight = Math.max(...weights);
            const weightRange = maxWeight - minWeight || 1; // avoid div by 0
            
            // Draw Data Lines
            doc.setDrawColor(59, 130, 246); // Blue 500
            doc.setLineWidth(1);
            
            const getX = (index: number) => graphX + (index / (filteredPoints.length - 1)) * graphW;
            const getY = (weight: number) => (graphY + graphH) - ((weight - minWeight) / weightRange) * (graphH - 5) - 2; // -2 buffer from axis

            // Draw Grid & Labels (Simplified)
            doc.setFontSize(8);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(148, 163, 184);

            // Min/Max Y Labels
            doc.text(maxWeight.toString(), graphX - 8, getY(maxWeight) + 3);
            if (minWeight !== maxWeight) {
                doc.text(minWeight.toString(), graphX - 8, getY(minWeight) + 3);
            }

            // Plot Points
            let prevX = 0, prevY = 0;
            filteredPoints.forEach((point, i) => {
                const cx = getX(i);
                const cy = getY(point.weight);

                // Draw Line
                if (i > 0) {
                    doc.line(prevX, prevY, cx, cy);
                }

                // Draw Dot
                doc.setFillColor(59, 130, 246);
                doc.circle(cx, cy, 1.5, 'F');
                
                // Draw Date Label (First and Last only to avoid clutter)
                if (i === 0 || i === filteredPoints.length - 1) {
                     doc.text(point.date, cx - 5, graphY + graphH + 5);
                }

                prevX = cx;
                prevY = cy;
            });

            yPos += chartHeight + 25; // Move down for next chart
        });

        if (!chartDrawn) {
            doc.setFontSize(10);
            doc.setFont("helvetica", "italic");
            doc.setTextColor(100, 116, 139);
            doc.text("Nessun dato sufficiente per generare grafici nel periodo selezionato.", margin, yPos);
            yPos += 15;
        }

        // --- WORKOUT LIST LOGS ---
        if (yPos + 20 > pageHeight) { doc.addPage(); yPos = 20; }
        
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0, 0, 0);
        doc.text("Registro Dettagliato", margin, yPos);
        yPos += 10;

        const exerciseMap = new Map(allExercises.map(e => [e.id, e.name]));

        filteredHistory.forEach(h => {
             if (yPos > pageHeight - 30) { doc.addPage(); yPos = 20; }

             const date = new Date(h.endTime || Date.now()).toLocaleDateString() + " " + new Date(h.endTime || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
             const name = plans.find(p => p.id === h.workoutType)?.name || h.workoutType;
             const duration = Math.round((h.durationSeconds||0)/60);

             // Session Header
             doc.setFillColor(241, 245, 249);
             doc.rect(margin, yPos - 5, pageWidth - (margin*2), 8, 'F');
             
             doc.setFontSize(10);
             doc.setFont("helvetica", "bold");
             doc.setTextColor(30, 41, 59);
             doc.text(`${date} - ${name}`, margin + 2, yPos);
             
             doc.setFontSize(16);
             doc.setTextColor(148, 163, 184); // slate-400 equivalent for duration
             doc.text(`${duration} min`, pageWidth - margin - 20, yPos);
             
             yPos += 8;

             // Exercises List
             if (h.exercises && h.exercises.length > 0) {
                 h.exercises.forEach(ex => {
                     if (yPos > pageHeight - 10) { doc.addPage(); yPos = 20; }

                     const exName = exerciseMap.get(ex.exerciseId) || ex.exerciseId;
                     
                     // Get simplified set string
                     let setsText = "";
                     if (ex.sets && ex.sets.length > 0) {
                         const maxW = Math.max(...ex.sets.map(s => s.weight));
                         const totalReps = ex.sets.length; // Just counting sets for compactness
                         setsText = `${totalReps} serie (Max: ${maxW}kg)`;
                     } else {
                         setsText = "Eseguito";
                     }

                     doc.setFontSize(9);
                     doc.setTextColor(71, 85, 105);
                     doc.text(`• ${exName}`, margin + 5, yPos);
                     doc.setTextColor(100, 116, 139);
                     doc.text(setsText, pageWidth - margin - 50, yPos); // Align right-ish
                     yPos += 5;
                 });
             }
             yPos += 5; // Spacing
        });
        
        doc.save(`GymReport_${reportStartDate}_${reportEndDate}.pdf`);
        setIsReportModalOpen(false);
    } catch (e) {
        console.error("PDF Error", e);
        alert("Errore PDF: " + e);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!selectedImage) return;
    setIsAnalyzing(true);
    setLoadingText("Download database esercizi...");

    let apiKey = userApiKey;
    if (!apiKey) {
         try {
            // @ts-ignore
            if (typeof process !== 'undefined' && process.env && process.env.API_KEY) apiKey = process.env.API_KEY;
         } catch(e) {}
    }
    if (!apiKey && (window as any).aistudio) {
         try {
             if (!(await (window as any).aistudio.hasSelectedApiKey())) {
                 if (!(await (window as any).aistudio.openSelectKey())) {
                     setIsAnalyzing(false); return;
                 }
             }
         } catch(e) {}
    }
    if (!apiKey && !(window as any).aistudio) {
        setIsAnalyzing(false); setIsSettingsModalOpen(true); return; 
    }

    try {
        // 1. Fetch the HF Database
        const hfExercises = await fetchExerciseDatabase();
        setLoadingText("Analisi immagine con Gemini...");

        // 2. Prepare context for Gemini
        // We optimize token usage by sending only necessary fields.
        // Format: "English Name | Italian Name | Muscle Group"
        const dbContext = hfExercises.map(ex => 
            `${ex.Exercise} | ${ex.Exercise_IT} | ${ex['Target Muscle Group ']}`
        ).join('\n');

        const ai = new GoogleGenAI({ apiKey: apiKey || '' });
        const base64Data = selectedImage.split(',')[1];
        
        const prompt = `
            Analizza questa immagine di una scheda di allenamento.
            Estrai il nome della scheda e la lista degli esercizi.
            
            Ecco un database di esercizi ufficiali che DEVI usare come riferimento:
            --- INIZIO DATABASE ---
            (Formato: Nome Inglese | Nome Italiano | Gruppo Muscolare)
            ${dbContext}
            --- FINE DATABASE ---

            Regole FONDAMENTALI:
            1. Per OGNI esercizio trovato nell'immagine, cerca la corrispondenza più vicina nel database fornito sopra.
            2. Se trovi una corrispondenza, usa il 'Nome Italiano' per il campo 'name'.
            3. Se trovi una corrispondenza, usa il 'Gruppo Muscolare' ESATTO del database per il campo 'tags'.
            4. Se NON trovi una corrispondenza (esercizio raro), usa il nome trovato nell'immagine e assegna tu i tag muscolari scegliendo SOLO tra questi: ${JSON.stringify(MUSCLE_TAGS)}.
            5. Estrai serie, ripetizioni e note. Se ci sono indicazioni di tempo (es. 10'), metti isDuration=true. 

            6. GESTIONE CIRCUITI E SUPERSET (Molto Importante):
               - Se vedi un titolo come "Circuito Addome" seguito da una lista numerata di esercizi (es. 1. Criss-cross, 2. Climber...), NON creare un solo esercizio gigante.
               - Crea invece un esercizio separato per OGNI riga del circuito.
               - Assegna a tutti questi esercizi lo stesso valore nel campo "supersetId" (es. "circuit_abs_1").
               - Metti le note generali (es. "x3 serie") nelle note di ogni esercizio del gruppo.

            7. Genera un ID univoco per ogni esercizio (es. usa il nome inglese del database in lowercase sostituendo spazi con underscore, oppure 'custom_...').
            8. Genera una breve 'visualDescription' in INGLESE per ogni esercizio (es. 'man doing bench press').

            Restituisci SOLO un JSON valido che rispetta questa struttura (senza markdown):
            {
                "name": "Nome Scheda",
                "exercises": [
                    { 
                      "id": "...", 
                      "name": "...", 
                      "sets": 3, 
                      "reps": "10", 
                      "notes": "...", 
                      "isDuration": false, 
                      "isCircuit": false, 
                      "supersetId": "id_del_gruppo_opzionale", 
                      "visualDescription": "...", 
                      "tags": ["..."] 
                    }
                ]
            }
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                {
                    role: 'user',
                    parts: [
                        { text: prompt },
                        { inlineData: { mimeType: 'image/jpeg', data: base64Data } }
                    ]
                }
            ],
            config: {
                responseMimeType: 'application/json',
            }
        });

        let textResponse = response.text;
        if (textResponse) {
            // Clean up possible markdown format
            textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

            const parsed: any = JSON.parse(textResponse);
            let finalName = customPlanName.trim();
            if (!finalName) {
                if (parsed.name && parsed.name.length > 2 && !parsed.name.toLowerCase().includes("nuova scheda")) {
                    finalName = parsed.name;
                } else {
                    finalName = getNextCongruentName(plans);
                }
            }
            const processedExercises = (parsed.exercises || []).map((ex: any) => {
                let existingEx = allExercises.find(e => e.id === ex.id);
                if (!existingEx) {
                    existingEx = allExercises.find(e => e.name.trim().toLowerCase() === ex.name.trim().toLowerCase());
                }
                
                let finalId = existingEx ? existingEx.id : (ex.id || `custom_${Date.now()}_${Math.random()}`);
                let imageUrl = existingEx?.imageUrl;
                let videoUrl = existingEx?.videoUrl;

                // TRY TO FIND YOUTUBE LINK FROM HF DB IF NOT PRESENT
                if (!videoUrl) {
                    const match = hfExercises.find(
                        e => e.Exercise.toLowerCase() === ex.name.toLowerCase() || 
                             e.Exercise_IT.toLowerCase() === ex.name.toLowerCase()
                    );
                    if (match && match['Short YouTube Demonstration']) {
                        videoUrl = match['Short YouTube Demonstration'];
                        const ytThumb = getYouTubeThumbnail(videoUrl);
                        if (ytThumb) imageUrl = ytThumb;
                    }
                }
                
                if (!imageUrl && ex.visualDescription) {
                     const query = encodeURIComponent(`${ex.visualDescription} gym workout minimal style`);
                     imageUrl = `https://image.pollinations.ai/prompt/${query}?width=800&height=400&nologo=true`;
                }
                
                // Ensure tags is an array
                const tags = Array.isArray(ex.tags) ? ex.tags : [];

                const { visualDescription, ...rest } = ex;
                return { 
                    ...rest, 
                    id: finalId,
                    name: existingEx ? existingEx.name : ex.name, 
                    imageUrl,
                    videoUrl,
                    tags
                };
            });
            const newPlan: WorkoutPlan = {
                id: `custom_${Date.now()}`,
                name: finalName,
                exercises: processedExercises
            };
            saveNewPlan(newPlan);
            setPlans(getPlans()); 
            setIsUploadModalOpen(false);
            setSelectedImage(null);
            setCustomPlanName('');
            alert("Scheda creata con successo utilizzando il database ufficiale!");
        }
    } catch (error: any) {
        alert("Errore: " + error.message);
    } finally {
        setIsAnalyzing(false);
        setLoadingText("Analisi con Gemini in corso...");
    }
  };
  
  const movePlan = (index: number, direction: 'up' | 'down') => {
      const newPlans = [...plans];
      const targetIndex = direction === 'up' ? index - 1 : index + 1;
      if (targetIndex >= 0 && targetIndex < newPlans.length) {
          [newPlans[index], newPlans[targetIndex]] = [newPlans[targetIndex], newPlans[index]];
          setPlans(newPlans);
          saveAllPlans(newPlans);
      }
  };

  const toggleVisibility = (index: number) => {
      const newPlans = [...plans];
      newPlans[index].isHidden = !newPlans[index].isHidden;
      setPlans(newPlans);
      saveAllPlans(newPlans);
  };

  const deletePlan = (e: React.MouseEvent, planId: string) => {
      e.preventDefault(); e.stopPropagation();
      setPlanToDelete(planId);
  };

  const confirmDeletePlan = () => {
      if (planToDelete) {
        const newPlans = plans.filter((p) => p.id !== planToDelete);
        setPlans(newPlans);
        saveAllPlans(newPlans);
        setPlanToDelete(null);
      }
  };

  const startEditingExercise = (ex: ExerciseDef) => {
    // Find the absolute index in the flat array
    if (!previewPlan) return;
    const index = previewPlan.exercises.indexOf(ex);
    if (index === -1) return;

    setEditingExerciseIndex(index);
    setEditForm({ 
        id: ex.id, 
        name: ex.name, 
        sets: ex.sets, 
        reps: ex.reps, 
        notes: ex.notes || '', 
        tags: ex.tags || [],
        supersetId: ex.supersetId
    });
    setEditModalTab('local');
  };
  
  const startAddingExercise = () => {
    if (!previewPlan) return;
    setEditingExerciseIndex(previewPlan.exercises.length);
    setEditForm({ id: 'NEW', name: '', sets: 3, reps: '10', notes: '', tags: [] });
    setEditModalTab('local');
  };

  const startAddingSuperset = () => {
    if (!previewPlan) return;
    const updatedPlans = [...plans];
    const planIndex = updatedPlans.findIndex(p => p.id === previewPlan.id);
    if (planIndex === -1) return;
    
    // Create new superset with 2 placeholder exercises immediately
    const count = 2; 
    const newSupersetId = `superset_${Date.now()}`;
    const newExercises: ExerciseDef[] = [];

    for(let i=0; i<count; i++) {
        newExercises.push({
            id: `circuit_ex${i+1}_${Date.now()}`,
            name: `Esercizio ${i+1} (Circuito)`,
            sets: 3,
            reps: "10",
            supersetId: newSupersetId,
            tags: []
        });
    }

    updateExerciseRegistry(newExercises);
    updatedPlans[planIndex].exercises.push(...newExercises);
    setPlans(updatedPlans);
    saveAllPlans(updatedPlans);
    setPreviewPlan({ ...previewPlan, exercises: [...updatedPlans[planIndex].exercises] });
  };
  
  const addExerciseToExistingSuperset = (supersetId: string) => {
      if (!previewPlan) return;
      const updatedPlans = [...plans];
      const planIndex = updatedPlans.findIndex(p => p.id === previewPlan.id);
      if (planIndex === -1) return;
      
      const exercises = [...updatedPlans[planIndex].exercises];
      // Find the last index of this superset
      let insertIndex = -1;
      for (let i = exercises.length - 1; i >= 0; i--) {
          if (exercises[i].supersetId === supersetId) {
              insertIndex = i;
              break;
          }
      }
      
      if (insertIndex !== -1) {
          const newEx: ExerciseDef = {
            id: `circuit_add_${Date.now()}`,
            name: "Nuovo Esercizio (Circuito)",
            sets: 3,
            reps: "10",
            supersetId: supersetId,
            tags: []
          };
          updateExerciseRegistry([newEx]);
          exercises.splice(insertIndex + 1, 0, newEx);
          
          updatedPlans[planIndex].exercises = exercises;
          setPlans(updatedPlans);
          saveAllPlans(updatedPlans);
          setPreviewPlan({ ...previewPlan, exercises: exercises });
      }
  };

  const toggleTag = (tag: string) => {
      if (!editForm) return;
      const currentTags = editForm.tags || [];
      setEditForm({ ...editForm, tags: currentTags.includes(tag) ? currentTags.filter(t => t !== tag) : [...currentTags, tag] });
  };
  
  const initiateRemoveExercise = (ex: ExerciseDef) => {
      if (!previewPlan) return;
      const index = previewPlan.exercises.indexOf(ex);
      if (index !== -1) setExerciseToDeleteIndex(index);
  };
  
  const confirmRemoveExercise = () => {
      if (!previewPlan || exerciseToDeleteIndex === null) return;
      const updatedPlans = [...plans];
      const planIndex = updatedPlans.findIndex(p => p.id === previewPlan.id);
      if (planIndex === -1) return;
      
      const removedExercise = updatedPlans[planIndex].exercises[exerciseToDeleteIndex];
      updatedPlans[planIndex].exercises.splice(exerciseToDeleteIndex, 1);
      
      // Clean up Supersets: If only 1 exercise remains with a supersetId, remove the grouping.
      if (removedExercise.supersetId) {
         const sid = removedExercise.supersetId;
         const remainingInSuperset = updatedPlans[planIndex].exercises.filter(e => e.supersetId === sid);
         if (remainingInSuperset.length <= 1) {
             updatedPlans[planIndex].exercises = updatedPlans[planIndex].exercises.map(e => 
                e.supersetId === sid ? { ...e, supersetId: undefined } : e
             );
         }
      }

      setPlans(updatedPlans);
      saveAllPlans(updatedPlans);
      setPreviewPlan({ ...previewPlan, exercises: [...updatedPlans[planIndex].exercises] });
      setExerciseToDeleteIndex(null);
  };

  const moveGroup = (groupIndex: number, direction: 'up' | 'down') => {
      if (!previewPlan) return;
      const updatedPlans = [...plans];
      const planIndex = updatedPlans.findIndex(p => p.id === previewPlan.id);
      if (planIndex === -1) return;

      const groups = [...groupedExercises];
      const targetIndex = direction === 'up' ? groupIndex - 1 : groupIndex + 1;

      if (targetIndex < 0 || targetIndex >= groups.length) return;

      // Swap groups
      [groups[groupIndex], groups[targetIndex]] = [groups[targetIndex], groups[groupIndex]];

      // Flatten back to exercise list
      const newExercises = groups.flatMap(g => g.items);
      
      updatedPlans[planIndex].exercises = newExercises;
      setPlans(updatedPlans);
      saveAllPlans(updatedPlans);
      setPreviewPlan({ ...previewPlan, exercises: newExercises });
  };
  
  const handleGroupDragStart = (e: React.DragEvent, index: number) => {
      if (isSelectionMode) { e.preventDefault(); return; } // Disable drag in selection mode
      setDraggedGroupIndex(index);
      e.dataTransfer.effectAllowed = "move";
  };
  
  const handleGroupDragOver = (e: React.DragEvent) => {
      e.preventDefault(); 
      e.dataTransfer.dropEffect = "move"; 
  };
  
  const handleGroupDrop = (e: React.DragEvent, targetIndex: number) => {
      e.preventDefault();
      if (isSelectionMode || draggedGroupIndex === null || draggedGroupIndex === targetIndex || !previewPlan) return;
      
      const updatedPlans = [...plans];
      const planIndex = updatedPlans.findIndex(p => p.id === previewPlan.id);
      if (planIndex === -1) return;

      const groups = [...groupedExercises];
      const [movedGroup] = groups.splice(draggedGroupIndex, 1);
      groups.splice(targetIndex, 0, movedGroup);

      // Flatten back
      const newExercises = groups.flatMap(g => g.items);
      
      updatedPlans[planIndex].exercises = newExercises;
      setPlans(updatedPlans);
      saveAllPlans(updatedPlans);
      setPreviewPlan({ ...previewPlan, exercises: newExercises });
      setDraggedGroupIndex(null);
  };

  // --- Selection Logic ---
  const handleToggleSelectionMode = () => {
      setIsSelectionMode(!isSelectionMode);
      setSelectedExerciseIds(new Set());
  };

  const handleSelectExercise = (e: React.MouseEvent, exId: string) => {
      e.stopPropagation(); // Prevent opening details or dragging
      const newSet = new Set(selectedExerciseIds);
      if (newSet.has(exId)) {
          newSet.delete(exId);
      } else {
          newSet.add(exId);
      }
      setSelectedExerciseIds(newSet);
  };

  const handleCreateSupersetFromSelection = () => {
      if (!previewPlan || selectedExerciseIds.size < 2) return;

      const updatedPlans = [...plans];
      const planIndex = updatedPlans.findIndex(p => p.id === previewPlan.id);
      if (planIndex === -1) return;
      
      const currentExercises = [...updatedPlans[planIndex].exercises];
      const newSupersetId = `superset_grouped_${Date.now()}`;

      // 1. Find indices of selected items to determine insertion point (highest up)
      const selectedIndices = currentExercises
          .map((ex, i) => selectedExerciseIds.has(ex.id) ? i : -1)
          .filter(i => i !== -1)
          .sort((a, b) => a - b);
      
      const insertionIndex = selectedIndices[0];

      // 2. Extract the selected exercises objects
      const selectedExercises = currentExercises.filter(ex => selectedExerciseIds.has(ex.id));
      
      // 3. Update their SupersetID
      const updatedSelectedExercises = selectedExercises.map(ex => ({
          ...ex,
          supersetId: newSupersetId
      }));

      // 4. Construct new list: 
      // Remove selected items from their original positions (reverse order to maintain indices)
      const remainingExercises = [...currentExercises];
      selectedIndices.reverse().forEach(idx => remainingExercises.splice(idx, 1));
      
      // Insert grouped items at the top-most original position
      remainingExercises.splice(insertionIndex, 0, ...updatedSelectedExercises);

      updatedPlans[planIndex].exercises = remainingExercises;
      setPlans(updatedPlans);
      saveAllPlans(updatedPlans);
      setPreviewPlan({ ...previewPlan, exercises: remainingExercises });
      
      // Reset Selection Mode
      setIsSelectionMode(false);
      setSelectedExerciseIds(new Set());
  };

  const handleSaveExercise = () => {
      if (!previewPlan || editingExerciseIndex === null || !editForm) return;
      const updatedPlans = [...plans];
      const planIndex = updatedPlans.findIndex(p => p.id === previewPlan.id);
      if (planIndex === -1) return;
      let finalExercise: ExerciseDef;
      
      // 1. Lookup DB details for new/edited exercises if we have a match
      let dbVideoUrl: string | undefined = undefined;
      let dbImageUrl: string | undefined = undefined;
      
      if (editForm.id.startsWith('db_') || editForm.id === 'NEW') {
          // Try to find matching video from loaded DB
          const match = hfExercises.find(
              e => e.Exercise.toLowerCase() === editForm.name.toLowerCase() || 
                   e.Exercise_IT.toLowerCase() === editForm.name.toLowerCase()
          );
          if (match && match['Short YouTube Demonstration']) {
              dbVideoUrl = match['Short YouTube Demonstration'];
              const thumb = getYouTubeThumbnail(dbVideoUrl);
              if (thumb) dbImageUrl = thumb;
          }
      }

      if (editForm.id === 'NEW' || editForm.id.startsWith('db_')) {
          const newName = editForm.name.trim() || 'Nuovo Esercizio';
          const existingMatch = allExercises.find(e => e.name.trim().toLowerCase() === newName.toLowerCase());
          
          if (existingMatch) {
             finalExercise = { 
                 ...existingMatch, 
                 sets: editForm.sets, 
                 reps: editForm.reps, 
                 notes: editForm.notes, 
                 tags: editForm.tags,
                 supersetId: editForm.supersetId,
                 // Prefer DB info if found now
                 videoUrl: dbVideoUrl || existingMatch.videoUrl,
                 imageUrl: dbImageUrl || existingMatch.imageUrl
             };
          } else {
             const newId = editForm.id.startsWith('db_') ? editForm.id : `custom_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
             finalExercise = {
                id: newId, 
                name: newName, 
                sets: editForm.sets, 
                reps: editForm.reps, 
                notes: editForm.notes, 
                // Use DB Image if found, else AI Placeholder
                imageUrl: dbImageUrl || `https://image.pollinations.ai/prompt/${encodeURIComponent(newName)}?width=800&height=400&nologo=true`,
                videoUrl: dbVideoUrl,
                isDuration: false, 
                isCircuit: false, 
                tags: editForm.tags,
                supersetId: editForm.supersetId
             };
          }
      } else {
          const existingDef = allExercises.find(e => e.id === editForm.id);
          const baseDef = existingDef || (editingExerciseIndex < previewPlan.exercises.length ? previewPlan.exercises[editingExerciseIndex] : existingDef);
          finalExercise = baseDef 
            ? { 
                ...baseDef, 
                sets: editForm.sets, 
                reps: editForm.reps, 
                notes: editForm.notes, 
                id: editForm.id, 
                tags: editForm.tags,
                supersetId: editForm.supersetId,
                // Don't override existing URLs here unless explicitly wanted, 
                // but let's assume if we are editing text we keep media
              }
            : { id: editForm.id, name: 'Unknown', sets: 3, reps: '10' };
      }
      updateExerciseRegistry([finalExercise]);
      if (editingExerciseIndex === updatedPlans[planIndex].exercises.length) updatedPlans[planIndex].exercises.push(finalExercise);
      else updatedPlans[planIndex].exercises[editingExerciseIndex] = finalExercise;
      setPlans(updatedPlans);
      saveAllPlans(updatedPlans);
      setPreviewPlan({ ...previewPlan, exercises: [...updatedPlans[planIndex].exercises] });
      setEditingExerciseIndex(null);
      setEditForm(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 pb-20 relative overflow-x-hidden">
      
      {/* Top Bar */}
      <div className="p-6 pt-8 flex justify-between items-start">
        <div>
            <div className="flex items-center gap-3 mb-2">
                <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 text-white hover:bg-slate-800 rounded-full">
                    <Menu size={28} />
                </button>
                <button 
                    onClick={() => setIsSettingsModalOpen(true)} 
                    className={`p-2 rounded-full transition-colors ${userApiKey ? 'text-slate-500 hover:text-white hover:bg-slate-800' : 'text-blue-400 bg-blue-900/20 animate-pulse'}`}
                >
                    <Settings size={24} />
                </button>
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">Ciao, Giancarlo!</h1>
            <p className="text-slate-400">Pronto per allenarti oggi?</p>
        </div>
      </div>

      <div className="px-6">
        {/* Workout Cards */}
        <div className="grid gap-4 mb-8">
          {plans.filter(p => !p.isHidden).map((plan, index) => {
             const gradients = ['from-blue-600 to-blue-800', 'from-emerald-600 to-emerald-800', 'from-purple-600 to-purple-800', 'from-orange-600 to-orange-800'];
             return (
                <div key={plan.id} onClick={() => onStartWorkout(plan.id)} className={`relative group overflow-hidden bg-gradient-to-br ${gradients[index % gradients.length]} p-6 rounded-2xl shadow-lg cursor-pointer`}>
                    <div className="flex justify-between items-start relative z-10">
                      <div><h2 className="text-2xl font-bold text-white mb-1">{plan.name}</h2><p className="text-white/70 text-sm">{plan.exercises?.length || 0} Esercizi</p></div>
                      <div className="flex gap-2">
                        <button onClick={(e) => togglePreview(e, plan)} className="p-3 bg-white/10 rounded-xl hover:bg-white/20"><Eye className="text-white" size={24} /></button>
                        <div className="p-3 bg-white/20 rounded-xl"><Play className="text-white fill-white" size={24} /></div>
                      </div>
                    </div>
                    <div className="absolute -right-4 -bottom-4 text-white/5 rotate-12"><Dumbbell size={120} /></div>
                </div>
             );
          })}
          {plans.filter(p => !p.isHidden).length === 0 && (
              <div className="text-center py-8 text-slate-500 bg-slate-900 rounded-2xl border border-slate-800 border-dashed">
                  <p>Nessuna scheda visibile.</p>
                  <button onClick={() => setIsManageModalOpen(true)} className="text-blue-400 underline mt-2">Gestisci schede</button>
              </div>
          )}
        </div>

        {/* Analytics Sections */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 mb-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2"><Calendar className="text-emerald-400" size={20} /><h3 className="text-lg font-semibold text-white">Costanza (4 Set.)</h3></div>
                <span className="text-xs font-medium bg-emerald-900/30 text-emerald-400 px-2 py-1 rounded-full">{streakData.count} Allenamenti</span>
            </div>
            <div className="grid grid-cols-7 gap-2">
                {streakData.days.map((day, i) => (
                    <div key={i} className={`aspect-square rounded-full flex items-center justify-center text-xs font-medium ${day.hasWorkout ? 'bg-emerald-600 text-white' : 'bg-slate-800 text-slate-600'} ${day.isToday ? 'ring-2 ring-blue-500' : ''}`}>{day.dayNum}</div>
                ))}
            </div>
        </div>

        {/* Duration Chart */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 mb-8">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2"><Activity className="text-purple-400" size={20} /><h3 className="text-lg font-semibold text-white">Durata Ultimi Allenamenti</h3></div>
             </div>
             <div className="h-48 w-full">
                {chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                            <XAxis dataKey="date" stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                            <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} />
                            <Bar dataKey="duration" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-full text-slate-600">Dati insufficienti</div>
                )}
             </div>
        </div>

        {/* Volume Analysis */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 mb-8">
            <div className="flex flex-col gap-4 mb-6">
                 <div className="flex items-center gap-2"><BarChart2 className="text-orange-400" size={20} /><h3 className="text-lg font-semibold text-white">Volume di Lavoro</h3></div>
                 <div className="flex justify-between bg-slate-950 p-1 rounded-lg">
                    {[4, 8, 12].map(w => (
                        <button key={w} onClick={() => setVolumeRange(w)} className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${volumeRange === w ? 'bg-slate-800 text-white' : 'text-slate-500'}`}>{w} Sett.</button>
                    ))}
                 </div>
                 <div className="flex gap-2">
                     <button onClick={() => setVolumeMetric('sets')} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${volumeMetric === 'sets' ? 'bg-orange-600 border-transparent text-white' : 'border-slate-700 text-slate-400'}`}>Serie Totali</button>
                     <button onClick={() => setVolumeMetric('load')} className={`flex-1 py-2 rounded-lg text-xs font-bold border ${volumeMetric === 'load' ? 'bg-blue-600 border-transparent text-white' : 'border-slate-700 text-slate-400'}`}>Carico Totale (kg)</button>
                 </div>
            </div>
            
            <div className="flex justify-end mb-4">
                <button onClick={() => setVolumeChartType(t => t === 'bar' ? 'pie' : 'bar')} className="text-slate-400 hover:text-white flex items-center gap-1 text-xs bg-slate-800 px-2 py-1 rounded">
                    {volumeChartType === 'bar' ? <PieIcon size={14}/> : <BarChart2 size={14}/>} Cambia Grafico
                </button>
            </div>

            <div className="h-64 w-full">
                 {volumeComparisonData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        {volumeChartType === 'bar' ? (
                            <BarChart data={volumeComparisonData} layout="vertical" margin={{left: 0}}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="tag" type="category" width={80} tick={{fill: '#94a3b8', fontSize: 10}} axisLine={false} tickLine={false} />
                                <Tooltip cursor={{fill: 'transparent'}} contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} />
                                <Bar dataKey="current" radius={[0, 4, 4, 0]} barSize={20}>
                                    {volumeComparisonData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={TAG_COLORS[entry.tag] || '#64748b'} />
                                    ))}
                                </Bar>
                            </BarChart>
                        ) : (
                            <PieChart>
                                <Pie data={volumeComparisonData} dataKey="current" nameKey="tag" cx="50%" cy="50%" outerRadius={80} stroke="none">
                                    {volumeComparisonData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={TAG_COLORS[entry.tag] || '#64748b'} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{backgroundColor: '#1e293b', border: 'none', borderRadius: '8px', color: '#fff'}} />
                                <Legend iconSize={8} wrapperStyle={{fontSize: '10px'}} />
                            </PieChart>
                        )}
                    </ResponsiveContainer>
                 ) : (
                    <div className="flex items-center justify-center h-full text-slate-600">Nessun dato nel periodo</div>
                 )}
            </div>
        </div>

        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800 mb-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2"><TrendingUp className="text-blue-400" size={20} /><h3 className="text-lg font-semibold text-white">Progressi</h3></div>
            </div>
            <div className="mb-6">
              <select value={selectedProgressExerciseId} onChange={(e) => setSelectedProgressExerciseId(e.target.value)} className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl p-3">
                {allExercises.length === 0 && <option value="" disabled>Nessun esercizio disponibile</option>}
                {allExercises.map(ex => (<option key={ex.id} value={ex.id}>{ex.name}</option>))}
              </select>
            </div>
            <ExerciseProgressChart data={progressData} />
        </div>
      </div>

      {/* Sidebar Menu */}
      <div className={`fixed inset-0 z-40 transition-visibility duration-300 ${isSidebarOpen ? 'visible' : 'invisible'}`}>
        <div className={`absolute inset-0 bg-black/60 transition-opacity duration-300 ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsSidebarOpen(false)} />
        <div className={`absolute left-0 top-0 bottom-0 w-3/4 max-w-xs bg-slate-900 p-6 shadow-2xl transition-transform duration-300 transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
            <h2 className="text-2xl font-bold text-white mb-8 mt-4">Menu</h2>
            <div className="space-y-3">
                <button onClick={() => { setIsSidebarOpen(false); setIsManageModalOpen(true); }} className="flex items-center gap-3 text-white text-lg font-medium w-full p-4 bg-slate-800 rounded-xl hover:bg-slate-700"><Settings size={20} /> Gestisci Schede</button>
                <button onClick={() => { setIsSidebarOpen(false); setIsReportModalOpen(true); }} className="flex items-center gap-3 text-white text-lg font-medium w-full p-4 bg-slate-800 rounded-xl hover:bg-slate-700"><FileText size={20} /> Report PDF</button>
                <button 
                    onClick={(e) => { 
                        e.preventDefault();
                        e.stopPropagation();
                        setIsSidebarOpen(false); 
                        setIsArchiveModalOpen(true); 
                    }} 
                    className="flex items-center gap-3 text-white text-lg font-medium w-full p-4 bg-slate-800 rounded-xl hover:bg-slate-700"
                >
                    <Archive size={20} /> Archivio / Backup
                </button>
                <button onClick={() => { setIsSidebarOpen(false); setIsSettingsModalOpen(true); }} className="flex items-center gap-3 text-white text-lg font-medium w-full p-4 bg-slate-800 rounded-xl hover:bg-slate-700"><Key size={20} /> API Key</button>
                <div className="border-t border-slate-800 my-4"></div>
                <button onClick={handleClearData} className="flex items-center gap-3 text-red-400 text-lg font-medium w-full p-4 bg-red-900/20 rounded-xl hover:bg-red-900/40"><Trash2 size={20} /> Reset Dati</button>
            </div>
        </div>
      </div>

      {/* Other Modals (Settings, Reset, Manage, Upload, Report) */}
      
      {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsSettingsModalOpen(false)} />
               <div className="bg-slate-900 w-full max-w-lg rounded-2xl border border-slate-800 relative p-6 shadow-2xl z-10 flex flex-col max-h-[90vh]">
                    <button onClick={() => setIsSettingsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
                    <div className="flex items-center gap-3 mb-6 border-b border-slate-800 pb-4"><div className="bg-blue-900/20 p-3 rounded-full text-blue-400"><Key size={24} /></div><div><h3 className="text-xl font-bold text-white">Chiave Gemini API</h3><p className="text-slate-400 text-xs">Necessaria per creare schede dalle foto</p></div></div>
                    <div className="overflow-y-auto pr-2 space-y-6">
                        <div><label className="block text-slate-300 text-sm font-medium mb-2">La tua API Key</label><div className="relative"><input type="password" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} placeholder="AIzaSy..." className={`w-full bg-slate-950 border ${tempApiKey && !tempApiKey.startsWith('AIza') ? 'border-red-500 focus:border-red-500' : 'border-slate-700 focus:border-blue-500'} rounded-xl p-3 pl-10 text-white outline-none font-mono transition-colors`} /><div className="absolute left-3 top-3.5 text-slate-500"><Key size={16} /></div>{tempApiKey && tempApiKey.startsWith('AIza') && (<div className="absolute right-3 top-3.5 text-emerald-500"><CheckCircle2 size={16} /></div>)}</div></div>
                        <div className="flex gap-3"><button onClick={saveApiKey} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl font-bold transition-colors">Salva Configurazione</button>{userApiKey && (<button onClick={clearApiKey} className="px-4 bg-slate-800 hover:bg-red-900/30 text-slate-400 hover:text-red-400 border border-slate-700 rounded-xl transition-colors"><Trash2 size={20} /></button>)}</div>
                        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700"><h4 className="text-white font-bold text-sm mb-3 flex items-center gap-2"><Info size={16} className="text-blue-400"/> Come ottenere una chiave (Gratis)</h4><ol className="space-y-3 text-sm text-slate-400 list-decimal list-inside"><li className="pl-1">Vai su <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 underline hover:text-blue-300 inline-flex items-center gap-1">Google AI Studio <ExternalLink size={10}/></a></li><li className="pl-1">Accedi con il tuo account Google.</li><li className="pl-1">Clicca su <span className="text-white font-mono bg-slate-700 px-1 rounded">Create API Key</span>.</li><li className="pl-1">Seleziona "Create API key in new project".</li><li className="pl-1">Copia la chiave generata e incollala qui sopra.</li></ol></div>
                        <div className="border-t border-slate-800 pt-4"><p className="text-slate-500 text-xs uppercase font-bold mb-3">Opzioni Avanzate</p><div className="grid grid-cols-1 gap-2">{(window as any).aistudio && (<button onClick={async () => { try { if (await (window as any).aistudio.openSelectKey()) { setIsSettingsModalOpen(false); alert("Account Google collegato!"); } } catch(e) { console.error(e); } }} className="w-full bg-slate-800 hover:bg-slate-700 text-white py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 border border-slate-700"><img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" className="w-4 h-4" alt="Gemini" />Seleziona Account Google</button>)}<label className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 cursor-pointer border border-slate-700 transition-colors"><Upload size={16} />Importa da file (.txt/.json)<input type="file" accept=".txt,.json" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => { const text = ev.target?.result as string; if (text) { const match = text.match(/AIza[a-zA-Z0-9_\\-]+/); if (match) setTempApiKey(match[0]); else setTempApiKey(text.trim()); } }; reader.readAsText(file); }} /></label></div></div>
                    </div>
               </div>
          </div>
      )}

      {isResetModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setIsResetModalOpen(false)}>
            <div className="bg-slate-900 w-full max-w-xs rounded-2xl border border-slate-800 p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
                <div className="bg-red-900/20 p-4 rounded-full mb-4 text-red-500 inline-block"><Trash2 size={32} /></div>
                <h3 className="text-xl font-bold text-white mb-2">Reset Totale?</h3>
                <div className="flex gap-3 w-full"><button onClick={() => setIsResetModalOpen(false)} className="flex-1 py-3 rounded-xl bg-slate-800 text-white">Annulla</button><button onClick={confirmClearData} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold">Reset</button></div>
            </div>
        </div>
      )}
      
      {isManageModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsManageModalOpen(false)} />
              <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 relative p-6 shadow-2xl z-10 max-h-[80vh] flex flex-col">
                  <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-white">Gestisci Schede</h3><button onClick={() => setIsManageModalOpen(false)} className="text-slate-400 hover:text-white"><X size={24} /></button></div>
                  <div className="overflow-y-auto space-y-3 flex-1 pr-2">
                      {plans.map((plan, index) => (
                          <div key={plan.id} className="flex items-center justify-between p-3 rounded-xl border bg-slate-800 border-slate-700">
                              <span className="font-medium text-white">{plan.name}</span>
                              <div className="flex gap-2">
                                  <button onClick={() => movePlan(index, 'up')} disabled={index===0}><ArrowUp size={16} className="text-slate-400" /></button>
                                  <button onClick={() => movePlan(index, 'down')} disabled={index===plans.length-1}><ArrowDown size={16} className="text-slate-400" /></button>
                                  <button onClick={() => toggleVisibility(index)}>{plan.isHidden ? <EyeOff size={16} className="text-slate-500" /> : <Eye size={16} className="text-blue-400" />}</button>
                                  <button onClick={(e) => deletePlan(e, plan.id)}><Trash2 size={16} className="text-red-400" /></button>
                              </div>
                          </div>
                      ))}
                  </div>
                  <button onClick={() => { setIsManageModalOpen(false); setIsUploadModalOpen(true); }} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-4 flex justify-center gap-2"><Plus size={20}/> Nuova</button>
              </div>
          </div>
      )}

      {isUploadModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsUploadModalOpen(false)} />
            <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 relative p-6 shadow-2xl z-10">
                <button onClick={() => setIsUploadModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
                <h3 className="text-xl font-bold text-white mb-4">Nuova Scheda</h3>
                <div className="space-y-4">
                    <div><label className="block text-slate-400 text-xs font-bold uppercase mb-2">Nome Scheda (Opzionale)</label><input type="text" value={customPlanName} onChange={(e) => setCustomPlanName(e.target.value)} placeholder="Es. Scheda Forza" className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white focus:border-blue-500 outline-none" /></div>
                    <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${selectedImage ? 'border-blue-500 bg-blue-900/10' : 'border-slate-700 hover:border-slate-500 hover:bg-slate-800'}`}>{selectedImage ? (<div className="relative w-full h-48 rounded-lg overflow-hidden"><img src={selectedImage} alt="Preview" className="w-full h-full object-contain" /><div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"><p className="text-white font-bold shadow-md">Cambia Immagine</p></div></div>) : (<><div className="bg-slate-800 p-4 rounded-full mb-3"><Camera size={32} className="text-blue-400" /></div><p className="text-slate-300 font-medium">Scatta foto o carica immagine</p><p className="text-slate-500 text-xs mt-1">Foto della scheda cartacea o screenshot</p></>)}<input type="file" ref={fileInputRef} accept="image/*" onClick={(e) => (e.target as any).value = null} onChange={handleFileSelect} className="hidden" /></div>
                    {isAnalyzing ? (<button disabled className="w-full bg-blue-600/50 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 cursor-wait"><Loader2 className="animate-spin" size={20} /> {loadingText}</button>) : (<div className="flex gap-2"><button onClick={handleAnalyzeImage} disabled={!selectedImage} className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${selectedImage ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}><img src="https://www.gstatic.com/lamda/images/gemini_sparkle_v002_d4735304ff6292a690345.svg" className="w-5 h-5" alt="Gemini" /> Crea con AI</button></div>)}
                    <div className="relative flex py-2 items-center"><div className="flex-grow border-t border-slate-800"></div><span className="flex-shrink mx-4 text-slate-600 text-xs">OPPURE</span><div className="flex-grow border-t border-slate-800"></div></div>
                    <button onClick={() => { const name = customPlanName.trim() || getNextCongruentName(plans); const newPlan: WorkoutPlan = { id: `manual_${Date.now()}`, name: name, exercises: [] }; saveNewPlan(newPlan); setPlans(getPlans()); setIsUploadModalOpen(false); setCustomPlanName(''); setSelectedImage(null); setPreviewPlan(newPlan); }} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-xl font-bold text-sm transition-colors">Crea Scheda Vuota</button>
                </div>
            </div>
        </div>
      )}
      
      {planToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={() => setPlanToDelete(null)}>
            <div className="bg-slate-900 w-full max-w-xs rounded-2xl border border-slate-800 p-6 shadow-2xl text-center" onClick={e => e.stopPropagation()}>
                <h3 className="text-xl font-bold text-white mb-4">Elimina Scheda?</h3>
                <div className="flex gap-3 w-full"><button onClick={() => setPlanToDelete(null)} className="flex-1 py-3 rounded-xl bg-slate-800 text-white">No</button><button onClick={confirmDeletePlan} className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold">Sì</button></div>
            </div>
        </div>
      )}

      {isReportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
               <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsReportModalOpen(false)} />
               <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 relative p-6 shadow-2xl z-10">
                    <button onClick={() => setIsReportModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
                    <h3 className="text-xl font-bold text-white mb-4">Report PDF</h3>
                    <input type="date" value={reportStartDate} onChange={e => setReportStartDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white mb-4" />
                    <input type="date" value={reportEndDate} onChange={e => setReportEndDate(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-white mb-6" />
                    <button onClick={generatePDF} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Scarica PDF</button>
               </div>
          </div>
      )}

      {/* Archive Modal - MOVED OUTSIDE PREVIEWPLAN */}
      {isArchiveModalOpen && (
          <div className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 150 }}>
              <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsArchiveModalOpen(false)} />
              <div className="bg-slate-900 w-full max-w-md rounded-2xl border border-slate-800 relative p-6 shadow-2xl z-10">
                  <button onClick={() => setIsArchiveModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
                  <h3 className="text-xl font-bold text-white mb-2 flex items-center gap-2"><Archive size={24} className="text-blue-400" /> Backup e Ripristino</h3>
                  <p className="text-slate-400 text-sm mb-6">Esporta i tuoi dati per non perderli o per trasferirli.</p>
                  <div className="space-y-4">
                      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700"><h4 className="text-white font-bold mb-2">Esporta</h4><button onClick={() => exportBackup()} className="w-full bg-emerald-600 text-white py-2 rounded-lg font-bold hover:bg-emerald-500 mb-2">Scarica Backup Completo</button></div>
                      <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700"><h4 className="text-white font-bold mb-2">Importa</h4><input type="file" accept=".json" ref={backupFileInputRef} onClick={(e) => { (e.target as HTMLInputElement).value = ''; }} onChange={handleBackupFileSelect} className="hidden" /><button onClick={() => backupFileInputRef.current?.click()} className="w-full bg-slate-700 text-white py-2 rounded-lg font-bold hover:bg-slate-600 border border-slate-600">Seleziona File Backup</button></div>
                  </div>
              </div>
          </div>
      )}
      
      {/* Import Confirm Modal - MOVED OUTSIDE PREVIEWPLAN */}
      {isImportConfirmOpen && pendingImportFile && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm" onClick={cancelImport}>
              <div className="bg-slate-900 w-full max-w-xs rounded-2xl border border-slate-800 p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                  {importSuccess ? (<div className="flex flex-col items-center text-center"><div className="bg-emerald-900/20 p-4 rounded-full mb-4 text-emerald-500"><CheckCircle2 size={32} /></div><h3 className="text-xl font-bold text-white mb-2">Importazione Riuscita!</h3><button onClick={finishImport} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-500 flex items-center justify-center gap-2"><RefreshCw size={20} /> Ricarica App</button></div>) : (<div className="flex flex-col items-center text-center"><div className="bg-orange-900/20 p-4 rounded-full mb-4 text-orange-500"><Upload size={32} /></div><h3 className="text-xl font-bold text-white mb-2">Sovrascrivere Dati?</h3><p className="text-slate-400 text-sm mb-6">Stai per importare: <span className="text-white font-mono">{pendingImportFile.name}</span></p>{importError && <div className="w-full bg-red-950/50 border border-red-500/50 rounded-lg p-2 mb-4 text-left"><p className="text-red-300 text-xs font-mono break-words">{importError}</p></div>}<div className="flex gap-3 w-full"><button onClick={cancelImport} disabled={isImporting} className="flex-1 py-3 rounded-xl bg-slate-800 text-white font-medium">Annulla</button><button onClick={proceedWithImport} disabled={isImporting} className="flex-1 py-3 rounded-xl bg-orange-600 text-white font-bold flex items-center justify-center gap-2">{isImporting ? <Loader2 className="animate-spin" size={16} /> : "Conferma"}</button></div></div>)}
              </div>
          </div>
      )}

      {previewPlan && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-black/60 pointer-events-auto" onClick={() => setPreviewPlan(null)} />
          <div className="bg-slate-900 w-full max-w-md max-h-[90vh] overflow-hidden rounded-t-3xl sm:rounded-3xl relative z-10 flex flex-col pointer-events-auto">
            <div className="p-6 border-b border-slate-800 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-white">{previewPlan.name}</h2>
              <div className="flex gap-2">
                  <button 
                    onClick={handleToggleSelectionMode}
                    className={`p-2 rounded-lg transition-colors ${isSelectionMode ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'}`}
                    title="Seleziona Esercizi"
                  >
                      <CheckSquare size={20} />
                  </button>
                  <button onClick={() => setPreviewPlan(null)}><X size={20} className="text-slate-400" /></button>
              </div>
            </div>
            <div className="overflow-y-auto p-4 space-y-3 relative">
              {isSelectionMode && (
                  <div className="sticky top-0 z-20 bg-slate-900/95 backdrop-blur border border-blue-500/30 rounded-xl p-3 mb-4 flex items-center justify-between shadow-lg">
                      <span className="text-sm text-blue-400 font-bold">{selectedExerciseIds.size} Selezionati</span>
                      <div className="flex gap-2">
                          {selectedExerciseIds.size >= 2 && (
                              <button onClick={handleCreateSupersetFromSelection} className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg flex items-center gap-1 animate-pulse">
                                  <Layers size={14} /> Crea Superset
                              </button>
                          )}
                          <button onClick={handleToggleSelectionMode} className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-medium rounded-lg">Annulla</button>
                      </div>
                  </div>
              )}

              {groupedExercises.map((group, groupIndex) => {
                 return (
                    <div 
                        key={group.id} 
                        className={`relative group-container ${group.isSuperset ? 'rounded-xl border border-blue-500/30 bg-blue-900/10 overflow-hidden' : ''}`}
                        draggable={!isSelectionMode}
                        onDragStart={(e) => handleGroupDragStart(e, groupIndex)}
                        onDragOver={handleGroupDragOver}
                        onDrop={(e) => handleGroupDrop(e, groupIndex)}
                    >
                        {/* Group Header for Supersets */}
                        {group.isSuperset && (
                            <div className="flex items-center justify-between bg-blue-900/20 p-2 border-b border-blue-500/20">
                                <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider pl-1">
                                    <Layers size={12} /> Superset / Circuito
                                </div>
                                {/* Drag & Order Controls for the whole group */}
                                {!isSelectionMode && (
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => moveGroup(groupIndex, 'up')} className="p-1 text-slate-400 hover:text-white"><ArrowUp size={14} /></button>
                                        <button onClick={() => moveGroup(groupIndex, 'down')} className="p-1 text-slate-400 hover:text-white"><ArrowDown size={14} /></button>
                                        <div className="p-1 text-slate-500 cursor-grab active:cursor-grabbing"><GripVertical size={14} /></div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Exercises in Group */}
                        <div>
                            {group.items.map((ex, relativeIndex) => {
                                const isSelected = selectedExerciseIds.has(ex.id);
                                return (
                                    <div 
                                        key={ex.id} 
                                        onClick={isSelectionMode ? (e) => handleSelectExercise(e, ex.id) : undefined}
                                        className={`flex gap-3 p-3 items-center ${group.isSuperset ? 'bg-transparent' : 'bg-slate-800/50 rounded-xl border border-slate-800'} ${isSelectionMode ? 'cursor-pointer hover:bg-slate-800/80' : ''}`}
                                    >
                                        {/* Selection Checkbox */}
                                        {isSelectionMode && (
                                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-600 bg-slate-900'}`}>
                                                {isSelected && <Check size={14} className="text-white" />}
                                            </div>
                                        )}

                                        {/* Single Item Controls */}
                                        {!group.isSuperset && !isSelectionMode && (
                                            <div className="flex flex-col mr-1">
                                                <button onClick={() => moveGroup(groupIndex, 'up')}><ArrowUp size={14} className="text-slate-500" /></button>
                                                <button onClick={() => moveGroup(groupIndex, 'down')}><ArrowDown size={14} className="text-slate-500" /></button>
                                            </div>
                                        )}
                                        
                                        <div className="flex-1">
                                            <h3 className="text-white font-medium">{ex.name}</h3>
                                            <p className="text-slate-400 text-xs">{ex.sets}x{ex.reps}</p>
                                        </div>

                                        {!isSelectionMode && (
                                            <>
                                                <button onClick={() => startEditingExercise(ex)}><Pencil size={16} className="text-blue-400" /></button>
                                                <button onClick={() => initiateRemoveExercise(ex)}><Trash2 size={16} className="text-red-400" /></button>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                        
                        {/* Add to Superset Button */}
                        {group.isSuperset && !isSelectionMode && (
                             <div className="flex justify-center border-t border-blue-500/20">
                                <button 
                                    onClick={() => addExerciseToExistingSuperset(group.id)}
                                    className="w-full text-[10px] bg-blue-900/20 hover:bg-blue-900/40 text-blue-400 py-1.5 flex items-center justify-center gap-1 transition-colors"
                                >
                                    <Plus size={10} /> Aggiungi a circuito
                                </button>
                             </div>
                        )}
                    </div>
                 );
              })}
              
              {!isSelectionMode && (
                  <div className="flex gap-2">
                     <button onClick={startAddingExercise} className="flex-1 py-4 border-2 border-dashed border-slate-700 rounded-xl text-slate-400 flex justify-center gap-2 hover:bg-slate-800 hover:text-white transition-colors"><Plus size={20} /> Aggiungi Esercizio</button>
                     <button onClick={startAddingSuperset} className="flex-1 py-4 border-2 border-dashed border-blue-900/50 rounded-xl text-blue-400 flex justify-center gap-2 hover:bg-blue-900/20 transition-colors"><Layers size={20} /> Aggiungi Superset</button>
                  </div>
              )}
            </div>
            
            {!isSelectionMode && (
                <div className="p-6 border-t border-slate-800"><button onClick={() => { onStartWorkout(previewPlan.id); setPreviewPlan(null); }} className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">Avvia Allenamento</button></div>
            )}
            
            {editingExerciseIndex !== null && editForm && (
                <div className="absolute inset-0 bg-slate-950 z-30 flex flex-col p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="text-xl font-bold text-white">Modifica Esercizio</h3>
                        <button onClick={() => setEditingExerciseIndex(null)}><X size={24} className="text-slate-400" /></button>
                    </div>

                    {/* Tab Selection */}
                    <div className="flex gap-2 mb-4 bg-slate-900 p-1 rounded-xl border border-slate-800">
                        <button 
                            onClick={() => setEditModalTab('local')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${editModalTab === 'local' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
                        >
                            <BookOpen size={16} /> I Miei Esercizi
                        </button>
                        <button 
                            onClick={() => setEditModalTab('database')}
                            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center gap-2 ${editModalTab === 'database' ? 'bg-blue-900/30 text-blue-400 shadow-sm border border-blue-900/50' : 'text-slate-400 hover:text-white'}`}
                        >
                            <Database size={16} /> Database Ufficiale
                        </button>
                    </div>

                    {editModalTab === 'local' ? (
                        <div className="space-y-4 flex-1 overflow-y-auto">
                            {/* Local Selection */}
                             <select value={editForm.id} onChange={e => setEditForm({...editForm, id: e.target.value})} className="w-full bg-slate-900 border border-slate-700 p-3 text-white rounded-xl"><option value="NEW">++ Nuovo Esercizio Manuale ++</option>{allExercises.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select>
                             {(editForm.id === 'NEW' || editForm.id.startsWith('db_')) && <input type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} placeholder="Nome Esercizio" className="w-full bg-slate-900 p-3 text-white rounded-xl border border-slate-700" />}
                             
                             <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Serie</label>
                                    <input type="number" value={editForm.sets} onChange={e => setEditForm({...editForm, sets: Number(e.target.value)})} className="w-full bg-slate-900 p-3 text-white rounded-xl border border-slate-700" />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-slate-500 uppercase">Ripetizioni</label>
                                    <input type="text" value={editForm.reps} onChange={e => setEditForm({...editForm, reps: e.target.value})} className="w-full bg-slate-900 p-3 text-white rounded-xl border border-slate-700" />
                                </div>
                             </div>
                             
                             <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Gruppi Muscolari</label>
                                <div className="flex flex-wrap gap-2">{MUSCLE_TAGS.map(t => <button key={t} onClick={() => toggleTag(t)} className={`px-2 py-1 rounded text-xs font-medium border ${editForm.tags.includes(t) ? 'bg-blue-600 border-transparent text-white' : 'border-slate-700 text-slate-400'}`}>{t}</button>)}</div>
                             </div>

                             <div className="space-y-1">
                                <label className="text-xs font-bold text-slate-500 uppercase">Note</label>
                                <textarea value={editForm.notes} onChange={e => setEditForm({...editForm, notes: e.target.value})} className="w-full bg-slate-900 p-3 text-white rounded-xl border border-slate-700 h-24" placeholder="Es. Carico 20kg, sella 4..." />
                             </div>
                             
                             <button onClick={handleSaveExercise} className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold mt-4 shadow-lg shadow-emerald-900/20">Salva Esercizio</button>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Database Selection */}
                            <div className="space-y-3 mb-4 flex-shrink-0">
                                <div className="relative">
                                    <input 
                                        type="text" 
                                        placeholder="Cerca esercizio..." 
                                        value={dbSearchTerm}
                                        onChange={(e) => setDbSearchTerm(e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 pl-10 text-white focus:border-blue-500 outline-none"
                                    />
                                    <Search className="absolute left-3 top-3.5 text-slate-500" size={16} />
                                </div>
                                <div className="grid grid-cols-3 gap-2">
                                    <select value={dbFilterDifficulty} onChange={e => setDbFilterDifficulty(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg p-2 outline-none">
                                        <option value="">Difficoltà...</option>
                                        {availableDifficulty.map(d => <option key={d} value={d}>{d}</option>)}
                                    </select>
                                    <select value={dbFilterMuscle} onChange={e => setDbFilterMuscle(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg p-2 outline-none">
                                        <option value="">Muscolo...</option>
                                        {availableMuscles.map(m => <option key={m} value={m}>{m}</option>)}
                                    </select>
                                    <select value={dbFilterEquipment} onChange={e => setDbFilterEquipment(e.target.value)} className="bg-slate-900 border border-slate-700 text-slate-300 text-xs rounded-lg p-2 outline-none">
                                        <option value="">Attrezzo...</option>
                                        {availableEquipment.map(e => <option key={e} value={e}>{e}</option>)}
                                    </select>
                                </div>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto min-h-0 space-y-2 pr-1">
                                {isDbLoading ? (
                                    <div className="flex flex-col items-center justify-center h-40 text-slate-500 gap-3">
                                        <Loader2 className="animate-spin text-blue-500" size={32} />
                                        <p>Caricamento Database...</p>
                                    </div>
                                ) : filteredDbExercises.length === 0 ? (
                                    <div className="text-center py-10 text-slate-500">
                                        <p>Nessun risultato trovato.</p>
                                        <button onClick={() => { setDbSearchTerm(''); setDbFilterDifficulty(''); setDbFilterMuscle(''); setDbFilterEquipment(''); }} className="text-blue-400 underline mt-2 text-sm">Resetta Filtri</button>
                                    </div>
                                ) : (
                                    filteredDbExercises.map((ex, i) => (
                                        <div 
                                            key={i} 
                                            onClick={() => selectExerciseFromDb(ex)}
                                            className="bg-slate-800/50 hover:bg-slate-800 border border-slate-700 rounded-xl p-3 cursor-pointer transition-colors group relative"
                                        >
                                            <div className="flex justify-between items-start pr-8">
                                                <h4 className="font-bold text-white group-hover:text-blue-400 transition-colors">{ex.Exercise_IT || ex.Exercise}</h4>
                                                <span className="text-[10px] bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded flex-shrink-0 ml-2">{ex['Difficulty Level']}</span>
                                            </div>
                                            <p className="text-xs text-slate-500 mb-2">{ex.Exercise}</p>
                                            <div className="flex flex-wrap gap-2 text-[10px]">
                                                <span className="px-2 py-0.5 rounded bg-blue-900/30 text-blue-300 border border-blue-800/50">{ex['Target Muscle Group ']}</span>
                                                <span className="px-2 py-0.5 rounded bg-slate-700 text-slate-300">{ex['Primary Equipment ']}</span>
                                            </div>
                                            
                                            {/* Info Button */}
                                            <button 
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setViewingDbExercise(ex);
                                                }}
                                                className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-white bg-slate-700/50 hover:bg-slate-700 rounded-full transition-colors"
                                            >
                                                <Info size={16} />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
            
            {exerciseToDeleteIndex !== null && (
                <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/80"><div className="bg-slate-900 p-6 rounded-xl text-center"><h3 className="text-white font-bold mb-4">Elimina?</h3><div className="flex gap-2"><button onClick={() => setExerciseToDeleteIndex(null)} className="px-4 py-2 bg-slate-800 text-white rounded-lg">No</button><button onClick={confirmRemoveExercise} className="px-4 py-2 bg-red-600 text-white rounded-lg">Sì</button></div></div></div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};