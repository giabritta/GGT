
import { WorkoutPlan, WorkoutType } from './types';

export const WORKOUT_A: WorkoutPlan = {
  id: WorkoutType.A,
  name: "Scheda A",
  exercises: [
    {
      id: 'a_warmup',
      name: "Attivazione aerobica + Mobilità",
      sets: 1,
      reps: "10' + 10'",
      isDuration: true,
      imageUrl: "https://image.pollinations.ai/prompt/man%20running%20on%20treadmill%20gym%20warmup?width=800&height=400&nologo=true",
      tags: ["Cardio"]
    },
    // --- CIRCUITO ADDOME (A) ---
    {
      id: 'a_abs_1',
      name: "Criss-cross (Addome)",
      sets: 3,
      reps: "20",
      notes: "Esercizio 1 del circuito",
      supersetId: "a_abs_circuit",
      videoUrl: "https://www.youtube.com/watch?v=1we3bh9uhqY",
      tags: ["Addominali"]
    },
    {
      id: 'a_abs_2',
      name: "Mountain Climber",
      sets: 3,
      reps: "20 m.",
      notes: "Esercizio 2 del circuito",
      supersetId: "a_abs_circuit",
      videoUrl: "https://www.youtube.com/watch?v=nmwgirgXLYM",
      tags: ["Addominali", "Cardio"]
    },
    {
      id: 'a_abs_3',
      name: "Crunch gambe su 90°",
      sets: 3,
      reps: "12",
      notes: "Esercizio 3 del circuito",
      supersetId: "a_abs_circuit",
      videoUrl: "https://www.youtube.com/watch?v=Xyd_fa5zoEU",
      tags: ["Addominali"]
    },
    {
      id: 'a_abs_4',
      name: "Plank sui gomiti",
      sets: 3,
      reps: "30\"",
      isDuration: true,
      notes: "Esercizio 4 del circuito. Recupero 1' alla fine.",
      supersetId: "a_abs_circuit",
      videoUrl: "https://www.youtube.com/watch?v=pSHjTRCQxIw",
      tags: ["Addominali"]
    },
    // --- FINE CIRCUITO ---
    {
      id: 'a_rdl',
      name: "RDL (Stacchi Rumeni) con bilanciere",
      sets: 3,
      reps: "10",
      videoUrl: "https://www.youtube.com/watch?v=JCXUYuzwNrM",
      tags: ["Femorali", "Glutei", "Schiena"]
    },
    {
      id: 'a_lunges',
      name: "Affondi sul posto",
      sets: 3,
      reps: "10 per lato",
      notes: "Con manubri 6+6kg (2/3 serie). Rest 1'",
      defaultWeight: 6,
      videoUrl: "https://www.youtube.com/watch?v=D7KaRcUTQeE",
      tags: ["Quadricipiti", "Glutei"]
    },
    {
      id: 'a_squat',
      name: "Squat al MultiPower",
      sets: 3,
      reps: "10",
      notes: "Carico: 10+10kg",
      defaultWeight: 20,
      videoUrl: "https://www.youtube.com/watch?v=_SgkL1nN-P0",
      tags: ["Quadricipiti", "Glutei"]
    },
    {
      id: 'a_tbar',
      name: "Rematore T-Bar",
      sets: 3,
      reps: "10",
      videoUrl: "https://www.youtube.com/watch?v=j3Igk5nyZE4",
      tags: ["Schiena"]
    },
    {
      id: 'a_lat',
      name: "Lat Machine",
      sets: 3,
      reps: "10",
      videoUrl: "https://www.youtube.com/watch?v=CAwf7n6Luuc",
      tags: ["Schiena"]
    },
    {
      id: 'a_pushdown',
      name: "Pushdown",
      sets: 3,
      reps: "12",
      videoUrl: "https://www.youtube.com/watch?v=2-LAMcpzODU",
      tags: ["Tricipiti"]
    },
    {
      id: 'a_french',
      name: "French press al cavo sopra la testa",
      sets: 3,
      reps: "10",
      notes: "Carico: 7.5kg",
      defaultWeight: 7.5,
      videoUrl: "https://www.youtube.com/watch?v=1u18yJFLMeI",
      tags: ["Tricipiti"]
    },
    {
      id: 'a_calf',
      name: "Polpacci alla pressa",
      sets: 3,
      reps: "12/15",
      notes: "Carico: 70kg",
      defaultWeight: 70,
      videoUrl: "https://www.youtube.com/watch?v=Kk2T12vNkkc",
      tags: ["Polpacci"]
    },
    {
      id: 'a_stretch',
      name: "Stretching generale",
      sets: 1,
      reps: "10'",
      isDuration: true,
      imageUrl: "https://image.pollinations.ai/prompt/man%20doing%20stretching%20gym%20mat?width=800&height=400&nologo=true",
      tags: ["Cardio"]
    }
  ]
};

export const WORKOUT_B: WorkoutPlan = {
  id: WorkoutType.B,
  name: "Scheda B",
  exercises: [
    {
      id: 'b_warmup',
      name: "Attivazione aerobica + Mobilità",
      sets: 1,
      reps: "10' + 10'",
      isDuration: true,
      imageUrl: "https://image.pollinations.ai/prompt/man%20running%20on%20treadmill%20gym%20warmup?width=800&height=400&nologo=true",
      tags: ["Cardio"]
    },
    // --- CIRCUITO ADDOME (B) ---
    {
      id: 'b_abs_1',
      name: "Criss-cross (Addome)",
      sets: 3,
      reps: "20",
      notes: "Esercizio 1 del circuito",
      supersetId: "b_abs_circuit",
      videoUrl: "https://www.youtube.com/watch?v=1we3bh9uhqY",
      tags: ["Addominali"]
    },
    {
      id: 'b_abs_2',
      name: "Mountain Climber",
      sets: 3,
      reps: "20 m.",
      notes: "Esercizio 2 del circuito",
      supersetId: "b_abs_circuit",
      videoUrl: "https://www.youtube.com/watch?v=nmwgirgXLYM",
      tags: ["Addominali", "Cardio"]
    },
    {
      id: 'b_abs_3',
      name: "Crunch gambe su 90°",
      sets: 3,
      reps: "12",
      notes: "Esercizio 3 del circuito",
      supersetId: "b_abs_circuit",
      videoUrl: "https://www.youtube.com/watch?v=Xyd_fa5zoEU",
      tags: ["Addominali"]
    },
    {
      id: 'b_abs_4',
      name: "Plank sui gomiti",
      sets: 3,
      reps: "30\"",
      isDuration: true,
      notes: "Esercizio 4 del circuito. Recupero 1' alla fine.",
      supersetId: "b_abs_circuit",
      videoUrl: "https://www.youtube.com/watch?v=pSHjTRCQxIw",
      tags: ["Addominali"]
    },
    // --- FINE CIRCUITO ---
    {
      id: 'b_bench',
      name: "Panca piana",
      sets: 4,
      reps: "8",
      videoUrl: "https://www.youtube.com/watch?v=rT7DgCr-3pg",
      tags: ["Pettorali", "Tricipiti"]
    },
    {
      id: 'b_chest',
      name: "Chest Press",
      sets: 3,
      reps: "12",
      notes: "Sella 6.\nCarico: 25kg",
      defaultWeight: 25,
      videoUrl: "https://www.youtube.com/watch?v=xUm0BiZCWlQ",
      tags: ["Pettorali"]
    },
    {
      id: 'b_croci',
      name: "Croci su panca 30° con manubri",
      sets: 3,
      reps: "10",
      notes: "Panca inclinata 30 gradi",
      videoUrl: "https://www.youtube.com/watch?v=bDaIL_zIb84",
      tags: ["Pettorali"]
    },
    {
      id: 'b_bicep_low',
      name: "Bicipiti al cavo basso",
      sets: 4,
      reps: "10",
      videoUrl: "https://www.youtube.com/watch?v=AsAVryOCddc",
      tags: ["Bicipiti"]
    },
    {
      id: 'b_bicep_45',
      name: "Bicipiti su panca 45° con manubri",
      sets: 3,
      reps: "10",
      videoUrl: "https://www.youtube.com/watch?v=soxrZlIl35U",
      tags: ["Bicipiti"]
    },
    {
      id: 'b_military',
      name: "Military press da seduto con manubri",
      sets: 4,
      reps: "8",
      videoUrl: "https://www.youtube.com/watch?v=qEwKCR5JCog",
      tags: ["Spalle"]
    },
    {
      id: 'b_lat_raise',
      name: "Alzate laterali al cavo singolo",
      sets: 3,
      reps: "10 per braccio",
      notes: "Con busto inclinato",
      videoUrl: "https://www.youtube.com/watch?v=PMqRMNwALac",
      tags: ["Spalle"]
    },
    {
      id: 'b_stretch',
      name: "Stretching generale",
      sets: 1,
      reps: "10'",
      isDuration: true,
      imageUrl: "https://image.pollinations.ai/prompt/man%20doing%20stretching%20gym%20mat?width=800&height=400&nologo=true",
      tags: ["Cardio"]
    }
  ]
};
