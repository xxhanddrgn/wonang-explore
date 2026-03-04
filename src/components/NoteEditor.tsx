'use client';

import { useEffect, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import { Note } from '@/types';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Highlighter,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  Code,
  Quote,
  Minus,
  Undo2,
  Redo2,
  Save,
  Check,
  ImageIcon,
  Download,
  Tag,
  X,
  Calendar,
} from 'lucide-react';

interface NoteEditorProps {
  note: Note;
  onSave: (note: Note) => void;
}

function htmlToMarkdown(html: string): string {
  let md = html;
  md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n');
  md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n');
  md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n');
  md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**');
  md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**');
  md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*');
  md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*');
  md = md.replace(/<s[^>]*>(.*?)<\/s>/gi, '~~$1~~');
  md = md.replace(/<del[^>]*>(.*?)<\/del>/gi, '~~$1~~');
  md = md.replace(/<mark[^>]*>(.*?)<\/mark>/gi, '==$1==');
  md = md.replace(/<code[^>]*>(.*?)<\/code>/gi, '`$1`');
  md = md.replace(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi, '> $1\n\n');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*alt="([^"]*)"[^>]*\/?>/gi, '![$2]($1)');
  md = md.replace(/<img[^>]*src="([^"]*)"[^>]*\/?>/gi, '![]($1)');
  md = md.replace(/<hr\s*\/?>/gi, '\n---\n\n');
  md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n');
  md = md.replace(/<\/?(ul|ol|p|div|br\s*\/?|pre)[^>]*>/gi, '\n');
  md = md.replace(/<[^>]+>/g, '');
  md = md.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  md = md.replace(/\n{3,}/g, '\n\n');
  return md.trim();
}

export default function NoteEditor({ note, onSave }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [tags, setTags] = useState<string[]>(note.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [week, setWeek] = useState<number | undefined>(note.week);
  const [showTagInput, setShowTagInput] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>('idle');
  const [uploading, setUploading] = useState(false);

  const handleImageUpload = useCallback(async (file: File, editorInstance: ReturnType<typeof useEditor>) => {
    if (!editorInstance) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('fileName', file.name);
      const res = await fetch('/api/nas/upload', { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) {
        editorInstance.chain().focus().setImage({ src: data.url, alt: file.name }).run();
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          editorInstance.chain().focus().setImage({ src: reader.result, alt: file.name }).run();
        }
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Placeholder.configure({ placeholder: '여기에 필기를 시작하세요... (Ctrl+V로 이미지 붙여넣기 가능)' }),
      Underline,
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Image.configure({ inline: true, allowBase64: true }),
    ],
    content: note.content,
    editorProps: {
      attributes: { class: 'tiptap-editor' },
      handlePaste: (_view, event) => {
        const items = event.clipboardData?.items;
        if (!items) return false;
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) handleImageUpload(file, editor);
            return true;
          }
        }
        return false;
      },
      handleDrop: (_view, event) => {
        const files = event.dataTransfer?.files;
        if (!files?.length) return false;
        for (const file of Array.from(files)) {
          if (file.type.startsWith('image/')) {
            event.preventDefault();
            handleImageUpload(file, editor);
            return true;
          }
        }
        return false;
      },
    },
  });

  useEffect(() => {
    if (editor && note.content !== editor.getHTML()) {
      editor.commands.setContent(note.content);
    }
    setTitle(note.title);
    setTags(note.tags || []);
    setWeek(note.week);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  const doSave = useCallback(() => {
    if (!editor) return;
    setSaveStatus('saving');
    const updated: Note = {
      ...note,
      title: title || '제목 없음',
      content: editor.getHTML(),
      tags,
      week,
      updatedAt: new Date().toISOString(),
    };
    onSave(updated);
    setTimeout(() => setSaveStatus('saved'), 300);
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [editor, note, title, tags, week, onSave]);

  useEffect(() => {
    if (!editor) return;
    let timeout: NodeJS.Timeout;
    const handler = () => { clearTimeout(timeout); timeout = setTimeout(doSave, 1500); };
    editor.on('update', handler);
    return () => { clearTimeout(timeout); editor.off('update', handler); };
  }, [editor, doSave]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); doSave(); }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [doSave]);

  const handleAddTag = () => {
    const t = tagInput.trim().replace(/^#/, '');
    if (t && !tags.includes(t)) { setTags([...tags, t]); setTagInput(''); }
  };

  const handleExportMarkdown = () => {
    if (!editor) return;
    const md = `# ${title || '제목 없음'}\n\n${htmlToMarkdown(editor.getHTML())}`;
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || '제목없음'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!editor) return null;

  const ToolbarButton = ({ onClick, active, children, title: t }: { onClick: () => void; active?: boolean; children: React.ReactNode; title?: string }) => (
    <button type="button" onClick={onClick} title={t} className={`p-1.5 rounded transition-colors ${active ? 'bg-indigo-100 text-indigo-700' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'}`}>
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-6 bg-gray-200 mx-1" />;

  return (
    <div className="flex flex-col h-full">
      {/* Title + Week */}
      <div className="flex items-center gap-3 px-6 pt-5 pb-1">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={doSave} placeholder="필기 제목을 입력하세요"
          className="flex-1 text-2xl font-bold outline-none bg-transparent placeholder:text-gray-300" />
        <div className="flex items-center gap-1.5 shrink-0">
          <Calendar size={14} className="text-gray-400" />
          <select value={week ?? ''} onChange={(e) => setWeek(e.target.value ? Number(e.target.value) : undefined)} onBlur={doSave}
            className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-1 outline-none text-gray-600">
            <option value="">주차</option>
            {Array.from({ length: 16 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1}주차</option>)}
          </select>
        </div>
      </div>

      {/* Tags */}
      <div className="flex items-center gap-2 px-6 pb-2 flex-wrap">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full">
            #{tag}
            <button onClick={() => setTags(tags.filter((tt) => tt !== tag))} className="hover:text-red-500"><X size={11} /></button>
          </span>
        ))}
        {showTagInput ? (
          <input type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddTag(); } if (e.key === 'Escape') { setShowTagInput(false); setTagInput(''); } }}
            onBlur={() => { handleAddTag(); setShowTagInput(false); }} placeholder="#태그" autoFocus
            className="text-xs bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5 outline-none w-20" />
        ) : (
          <button onClick={() => setShowTagInput(true)} className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-500 px-1.5 py-0.5 rounded-full hover:bg-gray-50">
            <Tag size={11} /> 태그 추가
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-5 py-2 border-y border-gray-100 flex-wrap sticky top-0 bg-white z-10">
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} title="굵게"><Bold size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} title="기울임"><Italic size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} title="밑줄"><UnderlineIcon size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} title="취소선"><Strikethrough size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHighlight().run()} active={editor.isActive('highlight')} title="하이라이트"><Highlighter size={16} /></ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} title="제목 1"><Heading1 size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} title="제목 2"><Heading2 size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} title="제목 3"><Heading3 size={16} /></ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} title="글머리 기호"><List size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} title="번호 매기기"><ListOrdered size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} title="체크리스트"><ListTodo size={16} /></ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} title="코드 블록"><Code size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} title="인용"><Quote size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="구분선"><Minus size={16} /></ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) handleImageUpload(f, editor); }; input.click(); }} title="이미지 삽입">
          <ImageIcon size={16} />
        </ToolbarButton>
        <Divider />
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="되돌리기"><Undo2 size={16} /></ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="다시 실행"><Redo2 size={16} /></ToolbarButton>

        <div className="ml-auto flex items-center gap-2">
          {uploading && <span className="text-xs text-blue-500 flex items-center gap-1"><ImageIcon size={12} className="animate-pulse" /> 업로드 중...</span>}
          {saveStatus === 'saving' && <span className="text-xs text-gray-400 flex items-center gap-1"><Save size={12} className="animate-pulse" /> 저장 중...</span>}
          {saveStatus === 'saved' && <span className="text-xs text-green-500 flex items-center gap-1"><Check size={12} /> 저장됨</span>}
          <button onClick={handleExportMarkdown} className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 px-2 py-1.5 rounded-md transition-colors" title="마크다운으로 내보내기">
            <Download size={13} /> .md
          </button>
          <button onClick={doSave} className="flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-md transition-colors font-medium">
            <Save size={13} /> 저장
          </button>
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-4">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
