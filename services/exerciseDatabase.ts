
export interface HFExercise {
  Exercise: string;
  Exercise_IT: string;
  'Short YouTube Demonstration'?: string;
  'In-Depth YouTube Explanation'?: string;
  'Difficulty Level'?: string;
  'Target Muscle Group ': string; // Nota lo spazio finale come da specifiche dataset
  'Prime Mover Muscle'?: string;
  'Secondary Muscle'?: string;
  'Primary Equipment '?: string;
  'Posture'?: string;
  'Mechanics'?: string;
}

interface HFDatasetResponse {
  Exercises: HFExercise[];
}

// URL diretto al file raw su Hugging Face
const HF_DB_URL = "https://huggingface.co/datasets/giabritta/gym_database/resolve/main/functional_fitness_exercise_database_gia_links_ITA.json";

let cachedDatabase: HFExercise[] | null = null;

export const fetchExerciseDatabase = async (): Promise<HFExercise[]> => {
  if (cachedDatabase) {
    return cachedDatabase;
  }

  try {
    const response = await fetch(HF_DB_URL);
    if (!response.ok) {
      throw new Error(`Errore nel download del database esercizi: ${response.statusText}`);
    }
    
    const data: HFDatasetResponse = await response.json();
    
    if (data && Array.isArray(data.Exercises)) {
      cachedDatabase = data.Exercises;
      return data.Exercises;
    }
    
    return [];
  } catch (error) {
    console.error("Failed to fetch HF database", error);
    // In caso di errore ritorniamo array vuoto per non bloccare l'app, 
    // l'AI userà la sua conoscenza generale.
    return [];
  }
};

/**
 * Estrae valori unici per un dato campo dal database per popolare i filtri
 */
export const getUniqueValues = (data: HFExercise[], field: keyof HFExercise): string[] => {
  const values = new Set<string>();
  data.forEach(ex => {
    const val = ex[field];
    if (val && typeof val === 'string') {
      values.add(val.trim());
    }
  });
  return Array.from(values).sort();
};

/**
 * Estrae l'ID video di YouTube da un URL
 */
export const getYouTubeVideoId = (url?: string): string | null => {
  if (!url) return null;
  const regExp = /^.*((youtu.be\/)|(v\/)|(\/u\/\w\/)|(embed\/)|(watch\?))\??v?=?([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[7].length === 11) ? match[7] : null;
};

/**
 * Genera l'URL della miniatura HQ di YouTube dato l'URL del video
 */
export const getYouTubeThumbnail = (videoUrl?: string): string | null => {
  const id = getYouTubeVideoId(videoUrl);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
};
