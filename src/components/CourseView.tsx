'use client';

import { useState, useCallback, useMemo } from 'react';
import { Course, Note, Material, TabType, ViewMode } from '@/types';
import {
  FileText,
  PenLine,
  Plus,
  ArrowLeft,
  Trash2,
  Calendar,
  Search,
  Tag,
  X,
  LayoutList,
  CalendarDays,
} from 'lucide-react';
import NoteEditor from './NoteEditor';
import FileUploader from './FileUploader';
import MaterialList from './MaterialList';
import { uploadToNas } from '@/lib/nas';
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
  return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function stripHtml(html: string): string {
  const tmp = typeof document !== 'undefined' ? document.createElement('div') : null;
  if (!tmp) return '';
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
}

export default function CourseView({ course, notes, materials, onSaveNote, onDeleteNote, onAddMaterial, onDeleteMaterial }: CourseViewProps) {
  const [activeTab, setActiveTab] = useState<TabType>('notes');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [weeklyView, setWeeklyView] = useState(false);

  const sortedNotes = useMemo(() => [...notes].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()), [notes]);
  const sortedMaterials = useMemo(() => [...materials].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()), [materials]);

  const allTags = useMemo(() => {
    const s = new Set<string>();
    notes.forEach((n) => n.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [notes]);

  const filteredNotes = useMemo(() => {
    let result = sortedNotes;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n) => n.title.toLowerCase().includes(q) || stripHtml(n.content).toLowerCase().includes(q));
    }
    if (selectedTag) result = result.filter((n) => n.tags?.includes(selectedTag));
    return result;
  }, [sortedNotes, searchQuery, selectedTag]);

  const weeklyGroups = useMemo(() => {
    const groups = new Map<number | undefined, Note[]>();
    filteredNotes.forEach((n) => {
      const list = groups.get(n.week) || [];
      list.push(n);
      groups.set(n.week, list);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => {
      if (a === undefined) return 1;
      if (b === undefined) return -1;
      return a - b;
    });
  }, [filteredNotes]);

  const selectedNote = sortedNotes.find((n) => n.id === selectedNoteId);

  const handleNewNote = () => {
    const newNote: Note = { id: generateId(), courseId: course.id, title: '', content: '', tags: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
    onSaveNote(newNote);
    setSelectedNoteId(newNote.id);
    setViewMode('editor');
  };

  const handleFileUpload = useCallback(async (file: File) => {
    const result = await uploadToNas(file);
    onAddMaterial({ id: generateId(), courseId: course.id, fileName: file.name, fileType: file.type, fileSize: file.size, url: result.url, publicId: result.publicId, uploadedAt: new Date().toISOString() });
  }, [course.id, onAddMaterial]);

  const renderNoteCard = (note: Note) => {
    const preview = stripHtml(note.content).slice(0, 120);
    return (
      <div key={note.id} onClick={() => { setSelectedNoteId(note.id); setViewMode('editor'); }}
        className="group bg-white border border-gray-100 rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-gray-800 truncate">{note.title || '제목 없음'}</h3>
            {preview && <p className="text-sm text-gray-400 mt-1 line-clamp-2">{preview}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-xs text-gray-400"><Calendar size={12} />{formatDate(note.updatedAt)}</span>
              {note.week && <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{note.week}주차</span>}
              {note.tags?.map((tag) => <span key={tag} className="text-xs bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded-full">#{tag}</span>)}
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); onDeleteNote(note.id); }}
            className="p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 text-gray-400 rounded-lg transition-all">
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3">
          {viewMode === 'editor' && (
            <button onClick={() => { setViewMode('list'); setSelectedNoteId(null); }} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-500">
              <ArrowLeft size={20} />
            </button>
          )}
          <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: course.color }} />
          <div>
            <h2 className="text-xl font-bold text-gray-900">{course.name}</h2>
            <span className="text-xs text-gray-400">{course.type === 'course' ? '강의' : '세미나'}</span>
          </div>
        </div>
        {viewMode === 'list' && (
          <div className="flex gap-1 mt-4">
            <button onClick={() => setActiveTab('notes')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'notes' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
              <PenLine size={16} /> 필기 <span className="text-xs bg-white/80 px-1.5 py-0.5 rounded-full">{notes.length}</span>
            </button>
            <button onClick={() => setActiveTab('materials')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'materials' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-500 hover:bg-gray-50'}`}>
              <FileText size={16} /> 자료 <span className="text-xs bg-white/80 px-1.5 py-0.5 rounded-full">{materials.length}</span>
            </button>
          </div>
        )}
      </div>

      {viewMode === 'editor' && selectedNote ? (
        <NoteEditor note={selectedNote} onSave={onSaveNote} />
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
          {activeTab === 'notes' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="relative flex-1 min-w-[200px]">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="노트 검색..."
                    className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-indigo-300 bg-white" />
                  {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>}
                </div>
                <button onClick={() => setWeeklyView(!weeklyView)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs rounded-lg border transition-colors ${weeklyView ? 'bg-blue-50 border-blue-200 text-blue-600' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}>
                  {weeklyView ? <CalendarDays size={14} /> : <LayoutList size={14} />}
                  {weeklyView ? '주차별' : '전체'}
                </button>
              </div>

              {allTags.length > 0 && (
                <div className="flex gap-1.5 flex-wrap">
                  {selectedTag && <button onClick={() => setSelectedTag(null)} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full hover:bg-gray-200">전체</button>}
                  {allTags.map((tag) => (
                    <button key={tag} onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
                      className={`text-xs px-2 py-0.5 rounded-full transition-colors ${selectedTag === tag ? 'bg-indigo-500 text-white' : 'bg-indigo-50 text-indigo-500 hover:bg-indigo-100'}`}>
                      <Tag size={10} className="inline mr-0.5" />{tag}
                    </button>
                  ))}
                </div>
              )}

              <button onClick={handleNewNote}
                className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-500 hover:bg-indigo-50 hover:border-indigo-300 transition-colors text-sm font-medium">
                <Plus size={18} />새 필기 시작
              </button>

              {filteredNotes.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <PenLine size={48} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">{searchQuery || selectedTag ? '검색 결과가 없습니다.' : '아직 작성된 필기가 없습니다.'}</p>
                </div>
              ) : weeklyView ? (
                <div className="space-y-6">
                  {weeklyGroups.map(([week, weekNotes]) => (
                    <div key={week ?? 'none'}>
                      <div className="flex items-center gap-2 mb-2">
                        <CalendarDays size={14} className="text-blue-500" />
                        <h3 className="text-sm font-semibold text-gray-700">{week ? `${week}주차` : '주차 미지정'}</h3>
                        <span className="text-xs text-gray-400">{weekNotes.length}개</span>
                      </div>
                      <div className="space-y-2 ml-5">{weekNotes.map(renderNoteCard)}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">{filteredNotes.map(renderNoteCard)}</div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <FileUploader onUpload={handleFileUpload} />
              <MaterialList materials={sortedMaterials} onDelete={onDeleteMaterial} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
