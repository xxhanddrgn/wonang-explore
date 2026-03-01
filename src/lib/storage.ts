import { Course, Note, Material } from '@/types';

const COURSES_KEY = 'lecture-notes-courses';
const NOTES_KEY = 'lecture-notes-notes';
const MATERIALS_KEY = 'lecture-notes-materials';

interface AppData {
  courses: Course[];
  notes: Note[];
  materials: Material[];
}

function getItem<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function setItem<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ===== Server Sync =====

let syncTimeout: ReturnType<typeof setTimeout> | null = null;
let syncStatusListener: ((status: string) => void) | null = null;

/** 동기화 상태 변경 시 호출할 콜백 등록 */
export function onSyncStatusChange(listener: (status: string) => void) {
  syncStatusListener = listener;
}

/** 서버에 즉시 저장 (await 가능) */
async function syncToServerImmediate(): Promise<boolean> {
  try {
    const data: AppData = {
      courses: getItem<Course[]>(COURSES_KEY, []),
      notes: getItem<Note[]>(NOTES_KEY, []),
      materials: getItem<Material[]>(MATERIALS_KEY, []),
    };
    const res = await fetch('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (res.ok) {
      syncStatusListener?.('server');
      return true;
    }
    console.error('[Sync] 서버 저장 실패:', res.status);
    syncStatusListener?.('local-offline');
    return false;
  } catch (error) {
    console.error('[Sync] 서버 저장 실패:', error);
    syncStatusListener?.('local-offline');
    return false;
  }
}

/** 디바운스된 서버 동기화 (일반 편집 시 사용) */
function syncToServer(): void {
  if (syncTimeout) clearTimeout(syncTimeout);
  syncTimeout = setTimeout(() => syncToServerImmediate(), 1000);
}

/**
 * 서버에서 데이터 로드 (앱 시작 시 호출)
 * - 서버에 데이터가 있으면: 서버 데이터 사용 (source of truth)
 * - 서버가 비었고 로컬에 데이터가 있으면: 로컬 → 서버로 마이그레이션 (결과 대기)
 */
export async function loadFromServer(): Promise<AppData & { syncSource: string }> {
  const localData: AppData = {
    courses: getItem<Course[]>(COURSES_KEY, []),
    notes: getItem<Note[]>(NOTES_KEY, []),
    materials: getItem<Material[]>(MATERIALS_KEY, []),
  };

  try {
    const res = await fetch('/api/data');
    if (!res.ok) throw new Error(`Server responded ${res.status}`);
    const serverData: AppData = await res.json();

    const serverHasData =
      serverData.courses.length > 0 ||
      serverData.notes.length > 0 ||
      serverData.materials.length > 0;
    const localHasData =
      localData.courses.length > 0 ||
      localData.notes.length > 0 ||
      localData.materials.length > 0;

    if (serverHasData) {
      // 서버(NAS)에 데이터 있음 → localStorage 캐시 업데이트
      setItem(COURSES_KEY, serverData.courses);
      setItem(NOTES_KEY, serverData.notes);
      setItem(MATERIALS_KEY, serverData.materials);
      return { ...serverData, syncSource: 'server' };
    } else if (localHasData) {
      // 서버 비어있고 로컬에 데이터 있음 → 서버로 마이그레이션 (즉시 + 결과 대기)
      console.log('[Sync] 서버 데이터 없음, 로컬 데이터를 서버로 업로드...');
      const ok = await syncToServerImmediate();
      return { ...localData, syncSource: ok ? 'server' : 'local-offline' };
    }

    return { ...serverData, syncSource: 'server-empty' };
  } catch (error) {
    // 서버 연결 실패 → localStorage 캐시 사용
    console.error('[Sync] 서버 연결 실패, localStorage 사용:', error);
    return { ...localData, syncSource: 'local-offline' };
  }
}

// ===== Courses =====

export function getCourses(): Course[] {
  return getItem<Course[]>(COURSES_KEY, []);
}

export function saveCourses(courses: Course[]): void {
  setItem(COURSES_KEY, courses);
  syncToServer();
}

export function addCourse(course: Course): Course[] {
  const courses = getCourses();
  courses.push(course);
  saveCourses(courses);
  return courses;
}

export function updateCourse(id: string, updates: Partial<Course>): Course[] {
  const courses = getCourses().map((c) =>
    c.id === id ? { ...c, ...updates } : c
  );
  saveCourses(courses);
  return courses;
}

export function deleteCourse(id: string): Course[] {
  const courses = getCourses().filter((c) => c.id !== id);
  setItem(COURSES_KEY, courses);
  const notes = getNotes().filter((n) => n.courseId !== id);
  setItem(NOTES_KEY, notes);
  const materials = getMaterials().filter((m) => m.courseId !== id);
  setItem(MATERIALS_KEY, materials);
  syncToServer();
  return courses;
}

// ===== Notes =====

export function getNotes(): Note[] {
  return getItem<Note[]>(NOTES_KEY, []);
}

export function getNotesByCourse(courseId: string): Note[] {
  return getNotes().filter((n) => n.courseId === courseId);
}

export function saveNote(note: Note): Note[] {
  const notes = getNotes();
  const idx = notes.findIndex((n) => n.id === note.id);
  if (idx >= 0) {
    notes[idx] = note;
  } else {
    notes.push(note);
  }
  setItem(NOTES_KEY, notes);
  syncToServer();
  return notes;
}

export function deleteNote(id: string): Note[] {
  const notes = getNotes().filter((n) => n.id !== id);
  setItem(NOTES_KEY, notes);
  syncToServer();
  return notes;
}

// ===== Materials =====

export function getMaterials(): Material[] {
  return getItem<Material[]>(MATERIALS_KEY, []);
}

export function getMaterialsByCourse(courseId: string): Material[] {
  return getMaterials().filter((m) => m.courseId === courseId);
}

export function addMaterial(material: Material): Material[] {
  const materials = getMaterials();
  materials.push(material);
  setItem(MATERIALS_KEY, materials);
  syncToServer();
  return materials;
}

export function deleteMaterial(id: string): Material[] {
  const materials = getMaterials().filter((m) => m.id !== id);
  setItem(MATERIALS_KEY, materials);
  syncToServer();
  return materials;
}
