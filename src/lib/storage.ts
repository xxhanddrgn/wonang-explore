import { Course, Note, Material } from '@/types';

const COURSES_KEY = 'lecture-notes-courses';
const NOTES_KEY = 'lecture-notes-notes';
const MATERIALS_KEY = 'lecture-notes-materials';

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

// Courses
export function getCourses(): Course[] {
  return getItem<Course[]>(COURSES_KEY, []);
}

export function saveCourses(courses: Course[]): void {
  setItem(COURSES_KEY, courses);
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
  saveCourses(courses);
  const notes = getNotes().filter((n) => n.courseId !== id);
  setItem(NOTES_KEY, notes);
  const materials = getMaterials().filter((m) => m.courseId !== id);
  setItem(MATERIALS_KEY, materials);
  return courses;
}

// Notes
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
  return notes;
}

export function deleteNote(id: string): Note[] {
  const notes = getNotes().filter((n) => n.id !== id);
  setItem(NOTES_KEY, notes);
  return notes;
}

// Materials
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
  return materials;
}

export function deleteMaterial(id: string): Material[] {
  const materials = getMaterials().filter((m) => m.id !== id);
  setItem(MATERIALS_KEY, materials);
  return materials;
}
