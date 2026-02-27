'use client';

import { useState, useCallback } from 'react';
import { Course, Note, Material, TabType, ViewMode } from '@/types';
import {
  FileText,
  PenLine,
  Plus,
  ArrowLeft,
  Trash2,
  Calendar,
} from 'lucide-react';
import NoteEditor from './NoteEditor';
import FileUploader from './FileUploader';
import MaterialList from './MaterialList';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { generateId } from '@/lib/storage';

interface CourseViewProps {
  course: Course;
  notes: Note[];
  materials: Material[];
  onSaveNote: (note: Note) => void;
  onDeleteNote: (id: string) => void;
  onAddMaterial: (material: Material) => void;
  onDeleteMaterial: (material: Material) => void;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function stripHtml(html: string): string {
  const tmp = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (!tmp) return '';
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export default function CourseView({
  course,
  notes,
  materials,
  onSaveNote,
  onDeleteNote,
  onAddMaterial,
  onDeleteMaterial,
}: CourseViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('notes');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);

  const sortedNotes = [...notes].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  const sortedMaterials = [...materials].sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  const selectedNote = sortedNotes.find((n) => n.id === selectedNoteId);

  const handleNewNote = () => {
    const newNote: Note = {
      id: generateId(),
      courseId: course.id,
      title: '',
      content: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    onSaveNote(newNote);
    setSelectedNoteId(newNote.id);
    setViewMode('editor');
  };

  const handleOpenNote = (noteId: string) => {
    setSelectedNoteId(noteId);
    setViewMode('editor');
  };

  const handleBackToList = () => {
    setViewMode('list');
    setSelectedNoteId(null);
  };

  const handleFileUpload = useCallback(
    async (file: File) => {
      const result = await uploadToCloudinary(file);
      const material: Material = {
        id: generateId(),
        courseId: course.id,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        url: result.url,
        publicId: result.publicId,
        uploadedAt: new Date().toISOString(),
      };
      onAddMaterial(material);
    },
    [course.id, onAddMaterial]
  );

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Course Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3">
          {viewMode === 'editor' && (
            <button
              onClick={handleBackToList}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <div
            className="w-4 h-4 rounded-full shrink-0"
            style={{ backgroundColor: course.color }}
          />
          <div>
            <h2 className="text-xl font-bold text-gray-900">{course.name}</h2>
            <span className="text-xs text-gray-400">
              {course.type === 'course' ? '강의' : '세미나'}
            </span>
          </div>
        </div>

        {/* Tabs (show only in list mode) */}
        {viewMode === 'list' && (
          <div className="flex gap-1 mt-4">
            <button
              onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'notes'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <PenLine size={16} />
              필기
              <span className="text-xs bg-white/80 px-1.5 py-0.5 rounded-full">
                {notes.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === 'materials'
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-500 hover:bg-gray-50'
              }`}
            >
              <FileText size={16} />
              자료
              <span className="text-xs bg-white/80 px-1.5 py-0.5 rounded-full">
                {materials.length}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      {viewMode === 'editor' && selectedNote ? (
        <NoteEditor note={selectedNote} onSave={onSaveNote} />
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'notes' ? (
            <div className="space-y-4">
              {/* New Note Button */}
              <button
                onClick={handleNewNote}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-500 hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-sm font-medium"
              >
                <Plus size={18} />새 필기 시작
              </button>

              {/* Notes List */}
              {sortedNotes.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <PenLine size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">아직 작성된 필기가 없습니다.</p>
                  <p className="text-xs mt-1">
                    위 버튼을 눌러 필기를 시작하세요.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sortedNotes.map((note) => {
                    const preview = stripHtml(note.content).slice(0, 120);
                    return (
                      <div
                        key={note.id}
                        onClick={() => handleOpenNote(note.id)}
                        className="group bg-white border border-gray-100 rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-gray-800 truncate">
                              {note.title || '제목 없음'}
                            </h3>
                            {preview && (
                              <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                                {preview}
                              </p>
                            )}
                            <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-400">
                              <Calendar size={12} />
                              {formatDate(note.updatedAt)}
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onDeleteNote(note.id);
                            }}
                            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded-lg transition-all"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <FileUploader onUpload={handleFileUpload} />
              <MaterialList
                materials={sortedMaterials}
                onDelete={onDeleteMaterial}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
