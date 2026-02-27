'use client';

import { useState, useRef, useCallback } from 'react';
import { Upload, FileUp, AlertCircle } from 'lucide-react';

interface FileUploaderProps {
  onUpload: (file: File) => Promise<void>;
}

export default function FileUploader({ onUpload }: FileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setError(null);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        setIsUploading(true);
        setProgress(`업로드 중 (${i + 1}/${files.length}): ${file.name}`);
        try {
          await onUpload(file);
        } catch (err) {
          setError(
            err instanceof Error ? err.message : '업로드에 실패했습니다.'
          );
          break;
        }
      }

      setIsUploading(false);
      setProgress(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
    [onUpload]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFiles(e.dataTransfer.files);
  };

  return (
    <div className="space-y-3">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          isDragging
            ? 'border-indigo-500 bg-indigo-50'
            : 'border-gray-200 hover:border-indigo-300 hover:bg-gray-50'
        } ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />

        {isUploading ? (
          <div className="space-y-2">
            <FileUp
              size={36}
              className="mx-auto text-indigo-400 animate-bounce"
            />
            <p className="text-sm text-indigo-600 font-medium">{progress}</p>
            <div className="w-48 h-1.5 bg-gray-200 rounded-full mx-auto overflow-hidden">
              <div className="h-full bg-indigo-500 rounded-full animate-pulse w-2/3" />
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload size={36} className="mx-auto text-gray-300" />
            <p className="text-sm text-gray-500">
              <span className="text-indigo-500 font-medium">
                클릭하여 파일 선택
              </span>{' '}
              또는 파일을 여기에 드래그하세요
            </p>
            <p className="text-xs text-gray-400">
              PDF, PPT, DOC, 이미지 등 모든 파일 형식 지원
            </p>
          </div>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-4 py-2.5 rounded-lg">
          <AlertCircle size={16} />
          {error}
        </div>
      )}
    </div>
  );
}
