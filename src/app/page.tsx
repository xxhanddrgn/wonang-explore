'use client';

import { useState, useEffect, useCallback } from 'react';
import { Course, Note, Material } from '@/types';
import {
  getCourses,
  addCourse,
  updateCourse,
  deleteCourse as deleteCourseFromStorage,
  getNotesByCourse,
  saveNote as saveNoteToStorage,
  deleteNote as deleteNoteFromStorage,
  getMaterials,
  getMaterialsByCourse,
  addMaterial as addMaterialToStorage,
  deleteMaterial as deleteMaterialFromStorage,
  generateId,
} from '@/lib/storage';
import Sidebar from '@/components/Sidebar';
import CourseView from '@/components/CourseView';
import AllMaterialsView from '@/components/AllMaterialsView';
import { GraduationCap, BookOpen, PenLine, Cloud } from 'lucide-react';

export default function Home() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [showAllMaterials, setShowAllMaterials] = useState(false);
  const [mounted, setMounted] = useState(false);

  const refreshAllMaterials = useCallback(() => {
    setAllMaterials(getMaterials());
  }, []);

  // Load courses on mount
  useEffect(() => {
    setCourses(getCourses());
    refreshAllMaterials();
    setMounted(true);
  }, [refreshAllMaterials]);

  // Load notes and materials when course changes
  useEffect(() => {
    if (selectedCourseId) {
      setNotes(getNotesByCourse(selectedCourseId));
      setMaterials(getMaterialsByCourse(selectedCourseId));
    }
  }, [selectedCourseId]);

  const selectedCourse = courses.find((c) => c.id === selectedCourseId);

  const handleSelectCourse = useCallback((id: string) => {
    setSelectedCourseId(id);
    setShowAllMaterials(false);
  }, []);

  const handleShowAllMaterials = useCallback(() => {
    setShowAllMaterials(true);
    setSelectedCourseId(null);
    setNotes([]);
    setMaterials([]);
    refreshAllMaterials();
  }, [refreshAllMaterials]);

  const handleAddCourse = useCallback(
    (data: Omit<Course, 'id' | 'createdAt'>) => {
      const course: Course = {
        ...data,
        id: generateId(),
        createdAt: new Date().toISOString(),
      };
      const updated = addCourse(course);
      setCourses(updated);
      setSelectedCourseId(course.id);
    },
    []
  );

  const handleDeleteCourse = useCallback(
    (id: string) => {
      if (!confirm('이 과목을 삭제하시겠습니까? 모든 필기와 자료가 삭제됩니다.'))
        return;
      const updated = deleteCourseFromStorage(id);
      setCourses(updated);
      if (selectedCourseId === id) {
        setSelectedCourseId(null);
        setNotes([]);
        setMaterials([]);
      }
    },
    [selectedCourseId]
  );

  const handleRenameCourse = useCallback((id: string, name: string) => {
    const updated = updateCourse(id, { name });
    setCourses(updated);
  }, []);

  const handleSaveNote = useCallback(
    (note: Note) => {
      saveNoteToStorage(note);
      setNotes(getNotesByCourse(note.courseId));
    },
    []
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      if (!confirm('이 필기를 삭제하시겠습니까?')) return;
      deleteNoteFromStorage(id);
      if (selectedCourseId) {
        setNotes(getNotesByCourse(selectedCourseId));
      }
    },
    [selectedCourseId]
  );

  const handleAddMaterial = useCallback(
    (material: Material) => {
      addMaterialToStorage(material);
      if (selectedCourseId) {
        setMaterials(getMaterialsByCourse(selectedCourseId));
      }
      refreshAllMaterials();
    },
    [selectedCourseId, refreshAllMaterials]
  );

  const handleDeleteMaterial = useCallback(
    async (material: Material) => {
      if (!confirm('이 자료를 삭제하시겠습니까?')) return;

      // Try to delete from Cloudinary
      try {
        await fetch('/api/cloudinary/delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ publicId: material.publicId }),
        });
      } catch {
        // Continue even if Cloudinary delete fails
      }

      deleteMaterialFromStorage(material.id);
      if (selectedCourseId) {
        setMaterials(getMaterialsByCourse(selectedCourseId));
      }
      refreshAllMaterials();
    },
    [selectedCourseId, refreshAllMaterials]
  );

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="animate-pulse text-gray-400">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar
        courses={courses}
        selectedCourseId={selectedCourseId}
        showAllMaterials={showAllMaterials}
        onSelectCourse={handleSelectCourse}
        onShowAllMaterials={handleShowAllMaterials}
        onAddCourse={handleAddCourse}
        onDeleteCourse={handleDeleteCourse}
        onRenameCourse={handleRenameCourse}
        materialCount={allMaterials.length}
      />

      {/* Main Content */}
      {showAllMaterials ? (
        <AllMaterialsView
          courses={courses}
          materials={allMaterials}
          onDeleteMaterial={handleDeleteMaterial}
        />
      ) : selectedCourse ? (
        <CourseView
          key={selectedCourse.id}
          course={selectedCourse}
          notes={notes}
          materials={materials}
          onSaveNote={handleSaveNote}
          onDeleteNote={handleDeleteNote}
          onAddMaterial={handleAddMaterial}
          onDeleteMaterial={handleDeleteMaterial}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center bg-gray-50">
          <div className="text-center max-w-md px-8">
            <div className="w-20 h-20 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <GraduationCap size={40} className="text-indigo-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              강의노트 플랫폼
            </h2>
            <p className="text-gray-500 mb-8">
              대학원 강의 및 세미나 자료를 정리하고
              <br />
              실시간으로 필기하세요.
            </p>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="space-y-2">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto">
                  <BookOpen size={22} className="text-blue-500" />
                </div>
                <p className="text-xs text-gray-500">과목/세미나 분류</p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center mx-auto">
                  <PenLine size={22} className="text-purple-500" />
                </div>
                <p className="text-xs text-gray-500">실시간 필기</p>
              </div>
              <div className="space-y-2">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mx-auto">
                  <Cloud size={22} className="text-emerald-500" />
                </div>
                <p className="text-xs text-gray-500">자료 업로드</p>
              </div>
            </div>

            <p className="text-xs text-gray-300 mt-8">
              왼쪽 메뉴에서 과목을 추가하여 시작하세요
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
