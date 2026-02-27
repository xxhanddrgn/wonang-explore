'use client';

import { Material } from '@/types';
import {
  FileText,
  Image,
  FileSpreadsheet,
  File,
  Download,
  Trash2,
  ExternalLink,
} from 'lucide-react';

interface MaterialListProps {
  materials: Material[];
  onDelete: (material: Material) => void;
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
  const ext = fileName.split('.').pop()?.toUpperCase() || '';
  return ext;
}

export default function MaterialList({
  materials,
  onDelete,
}: MaterialListProps) {
  if (materials.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <FileText size={48} className="mx-auto mb-3 opacity-30" />
        <p className="text-sm">아직 업로드된 자료가 없습니다.</p>
        <p className="text-xs mt-1">위에서 파일을 업로드하세요.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {materials.map((material) => {
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
                onClick={() => onDelete(material)}
                className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-md transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
