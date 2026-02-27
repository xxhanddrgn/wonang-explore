'use client';

import { Course, Material } from '@/types';
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  ExternalLink,
  FolderOpen,
} from 'lucide-react';

interface AllMaterialsViewProps {
  courses: Course[];
  materials: Material[];
  onDeleteMaterial: (material: Material) => void;
}

function getFileIcon(fileType: string) {
  if (fileType.startsWith('image/')) return Image;
  if (fileType.includes('pdf')) return FileText;
  if (
    fileType.includes('spreadsheet') ||
    fileType.includes('excel') ||
    fileType.includes('csv')
  )
    return FileSpreadsheet;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function getFileExtension(fileName: string): string {
  return fileName.split('.').pop()?.toUpperCase() || '';
}

export default function AllMaterialsView({
  courses,
  materials,
  onDeleteMaterial,
}: AllMaterialsViewProps) {
  const sortedMaterials = [...materials].sort(
    (a, b) =>
      new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );

  const courseMap = new Map(courses.map((c) => [c.id, c]));

  // Group by course
  const grouped = new Map<string, Material[]>();
  for (const m of sortedMaterials) {
    const list = grouped.get(m.courseId) || [];
    list.push(m);
    grouped.set(m.courseId, list);
  }

  return (
    <div className="flex-1 flex flex-col h-screen overflow-hidden">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
            <FolderOpen size={22} className="text-indigo-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">내 자료</h2>
            <span className="text-xs text-gray-400">
              업로드한 모든 파일 · {materials.length}개
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        {sortedMaterials.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <FolderOpen size={56} className="mx-auto mb-4 opacity-30" />
            <p className="text-base">아직 업로드된 자료가 없습니다.</p>
            <p className="text-sm mt-1">
              과목을 선택하고 자료를 업로드하세요.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {Array.from(grouped.entries()).map(([courseId, mats]) => {
              const course = courseMap.get(courseId);
              return (
                <div key={courseId}>
                  {/* Course Group Header */}
                  <div className="flex items-center gap-2 mb-3">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: course?.color || '#6366f1' }}
                    />
                    <h3 className="text-sm font-semibold text-gray-700">
                      {course?.name || '삭제된 과목'}
                    </h3>
                    <span className="text-xs text-gray-400">
                      {mats.length}개
                    </span>
                  </div>

                  {/* Material Cards */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {mats.map((material) => {
                      const Icon = getFileIcon(material.fileType);
                      const ext = getFileExtension(material.fileName);
                      const isImage = material.fileType.startsWith('image/');

                      return (
                        <div
                          key={material.id}
                          className="group border border-gray-100 rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all bg-white"
                        >
                          {isImage && (
                            <div className="mb-3 rounded-lg overflow-hidden bg-gray-50 h-32 flex items-center justify-center">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={material.url}
                                alt={material.fileName}
                                className="max-h-full max-w-full object-contain"
                              />
                            </div>
                          )}

                          <div className="flex items-start gap-3">
                            <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                              <Icon size={20} className="text-indigo-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-800 truncate">
                                {material.fileName}
                              </p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded font-mono">
                                  {ext}
                                </span>
                                <span className="text-xs text-gray-400">
                                  {formatFileSize(material.fileSize)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatDate(material.uploadedAt)}
                              </p>
                            </div>
                          </div>

                          {/* Actions */}
                          <div className="flex gap-1.5 mt-3 pt-3 border-t border-gray-50">
                            <a
                              href={material.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 py-1.5 rounded-md transition-colors"
                            >
                              <ExternalLink size={13} />
                              열기
                            </a>
                            <a
                              href={material.url}
                              download={material.fileName}
                              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 py-1.5 rounded-md transition-colors"
                            >
                              <Download size={13} />
                              다운로드
                            </a>
                            <button
                              onClick={() => onDeleteMaterial(material)}
                              className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
