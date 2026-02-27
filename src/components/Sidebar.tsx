'use client';

import { useState } from 'react';
import { Course, CourseType } from '@/types';
import {
  Plus,
  GraduationCap,
  BookOpen,
  Trash2,
  X,
  PenLine,
} from 'lucide-react';

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
];

interface SidebarProps {
  courses: Course[];
  selectedCourseId: string | null;
  onSelectCourse: (id: string) => void;
  onAddCourse: (course: Omit<Course, 'id' | 'createdAt'>) => void;
  onDeleteCourse: (id: string) => void;
  onRenameCourse: (id: string, name: string) => void;
}

export default function Sidebar({
  courses,
  selectedCourseId,
  onSelectCourse,
  onAddCourse,
  onDeleteCourse,
  onRenameCourse,
}: SidebarProps) {
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<CourseType>('course');
  const [newColor, setNewColor] = useState(COLORS[0]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  const handleAdd = () => {
    if (!newName.trim()) return;
    onAddCourse({ name: newName.trim(), type: newType, color: newColor });
    setNewName('');
    setNewType('course');
    setNewColor(COLORS[0]);
    setShowForm(false);
  };

  const handleRename = (id: string) => {
    if (!editName.trim()) return;
    onRenameCourse(id, editName.trim());
    setEditingId(null);
    setEditName('');
  };

  const coursesFiltered = courses.filter((c) => c.type === 'course');
  const seminarsFiltered = courses.filter((c) => c.type === 'seminar');

  const renderCourseItem = (course: Course) => {
    const isSelected = course.id === selectedCourseId;
    const isEditing = editingId === course.id;

    return (
      <li key={course.id}>
        <button
          onClick={() => onSelectCourse(course.id)}
          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all group ${
            isSelected
              ? 'bg-white/15 text-white'
              : 'text-slate-300 hover:bg-white/10 hover:text-white'
          }`}
        >
          <span
            className="w-3 h-3 rounded-full shrink-0"
            style={{ backgroundColor: course.color }}
          />
          {isEditing ? (
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(course.id);
                if (e.key === 'Escape') setEditingId(null);
              }}
              onBlur={() => handleRename(course.id)}
              autoFocus
              onClick={(e) => e.stopPropagation()}
              className="flex-1 bg-white/10 text-white text-sm px-2 py-0.5 rounded outline-none border border-white/20"
            />
          ) : (
            <span className="flex-1 text-sm font-medium truncate">
              {course.name}
            </span>
          )}
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                setEditingId(course.id);
                setEditName(course.name);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  setEditingId(course.id);
                  setEditName(course.name);
                }
              }}
              className="p-1 hover:bg-white/10 rounded cursor-pointer"
            >
              <PenLine size={13} />
            </span>
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onDeleteCourse(course.id);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  onDeleteCourse(course.id);
                }
              }}
              className="p-1 hover:bg-red-500/30 rounded cursor-pointer"
            >
              <Trash2 size={13} />
            </span>
          </div>
        </button>
      </li>
    );
  };

  return (
    <aside className="w-72 bg-slate-800 h-screen flex flex-col shrink-0">
      <div className="px-5 py-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-indigo-500 rounded-lg flex items-center justify-center">
            <GraduationCap size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-lg leading-tight">
              강의노트
            </h1>
            <p className="text-slate-400 text-xs">자료 정리 · 필기 플랫폼</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-3">
        <button
          onClick={() => setShowForm(!showForm)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg text-sm font-medium transition-colors"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? '취소' : '새 과목/세미나 추가'}
        </button>
      </div>

      {showForm && (
        <div className="px-4 pb-3 space-y-2">
          <input
            type="text"
            placeholder="과목 또는 세미나명"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            autoFocus
            className="w-full bg-slate-700 text-white text-sm px-3 py-2 rounded-lg outline-none border border-slate-600 focus:border-indigo-400 placeholder:text-slate-400"
          />
          <div className="flex gap-2">
            <button
              onClick={() => setNewType('course')}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                newType === 'course'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              강의
            </button>
            <button
              onClick={() => setNewType('seminar')}
              className={`flex-1 text-xs py-1.5 rounded-md font-medium transition-colors ${
                newType === 'seminar'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              세미나
            </button>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {COLORS.map((color) => (
              <button
                key={color}
                onClick={() => setNewColor(color)}
                className={`w-6 h-6 rounded-full transition-transform ${
                  newColor === color ? 'scale-125 ring-2 ring-white ring-offset-1 ring-offset-slate-800' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
          <button
            onClick={handleAdd}
            disabled={!newName.trim()}
            className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-slate-600 disabled:text-slate-400 text-white text-sm py-2 rounded-lg font-medium transition-colors"
          >
            추가
          </button>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto sidebar-scroll px-3 pb-4">
        {coursesFiltered.length > 0 && (
          <div className="mb-3">
            <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
              <BookOpen size={13} />
              강의
            </h2>
            <ul className="space-y-0.5">
              {coursesFiltered.map(renderCourseItem)}
            </ul>
          </div>
        )}

        {seminarsFiltered.length > 0 && (
          <div>
            <h2 className="flex items-center gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1.5">
              <GraduationCap size={13} />
              세미나
            </h2>
            <ul className="space-y-0.5">
              {seminarsFiltered.map(renderCourseItem)}
            </ul>
          </div>
        )}

        {courses.length === 0 && (
          <div className="text-center text-slate-500 text-sm mt-8 px-4">
            <GraduationCap size={40} className="mx-auto mb-3 opacity-30" />
            <p>아직 등록된 과목이 없습니다.</p>
            <p className="text-xs mt-1">위 버튼을 눌러 과목을 추가하세요.</p>
          </div>
        )}
      </nav>
    </aside>
  );
}
