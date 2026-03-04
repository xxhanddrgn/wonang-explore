export type CourseType = 'course' | 'seminar';

export interface Course {
  id: string;
  name: string;
  type: CourseType;
  color: string;
  createdAt: string;
}

export interface Note {
  id: string;
  courseId: string;
  title: string;
  content: string;
  tags?: string[];
  week?: number;
  createdAt: string;
  updatedAt: string;
}

export interface Material {
  id: string;
  courseId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  url: string;
  publicId: string;
  uploadedAt: string;
}

export type TabType = 'materials' | 'notes';

export type ViewMode = 'list' | 'editor';
