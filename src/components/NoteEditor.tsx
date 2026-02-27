'use client';

import { useEffect, useCallback, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Highlight from '@tiptap/extension-highlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
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
} from 'lucide-react';

interface NoteEditorProps {
  note: Note;
  onSave: (note: Note) => void;
}

export default function NoteEditor({ note, onSave }: NoteEditorProps) {
  const [title, setTitle] = useState(note.title);
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'idle'>(
    'idle'
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: '여기에 필기를 시작하세요...',
      }),
      Underline,
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: note.content,
    editorProps: {
      attributes: {
        class: 'tiptap-editor',
      },
    },
  });

  // Update editor content when note changes
  useEffect(() => {
    if (editor && note.content !== editor.getHTML()) {
      editor.commands.setContent(note.content);
    }
    setTitle(note.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  // Auto-save
  const doSave = useCallback(() => {
    if (!editor) return;
    setSaveStatus('saving');
    const updated: Note = {
      ...note,
      title: title || '제목 없음',
      content: editor.getHTML(),
      updatedAt: new Date().toISOString(),
    };
    onSave(updated);
    setTimeout(() => setSaveStatus('saved'), 300);
    setTimeout(() => setSaveStatus('idle'), 2000);
  }, [editor, note, title, onSave]);

  // Auto-save on content change with debounce
  useEffect(() => {
    if (!editor) return;
    let timeout: NodeJS.Timeout;

    const handler = () => {
      clearTimeout(timeout);
      timeout = setTimeout(doSave, 1500);
    };

    editor.on('update', handler);
    return () => {
      clearTimeout(timeout);
      editor.off('update', handler);
    };
  }, [editor, doSave]);

  // Ctrl+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        doSave();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [doSave]);

  if (!editor) return null;

  const ToolbarButton = ({
    onClick,
    active,
    children,
    title: buttonTitle,
  }: {
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
    title?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      title={buttonTitle}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-indigo-100 text-indigo-700'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700'
      }`}
    >
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-6 bg-gray-200 mx-1" />;

  return (
    <div className="flex flex-col h-full">
      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={doSave}
        placeholder="필기 제목을 입력하세요"
        className="text-2xl font-bold px-6 pt-5 pb-2 outline-none bg-transparent placeholder:text-gray-300"
      />

      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-5 py-2 border-y border-gray-100 flex-wrap sticky top-0 bg-white z-10">
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive('bold')}
          title="굵게 (Ctrl+B)"
        >
          <Bold size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive('italic')}
          title="기울임 (Ctrl+I)"
        >
          <Italic size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive('underline')}
          title="밑줄 (Ctrl+U)"
        >
          <UnderlineIcon size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          active={editor.isActive('strike')}
          title="취소선"
        >
          <Strikethrough size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHighlight().run()}
          active={editor.isActive('highlight')}
          title="하이라이트"
        >
          <Highlighter size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 1 }).run()
          }
          active={editor.isActive('heading', { level: 1 })}
          title="제목 1"
        >
          <Heading1 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 2 }).run()
          }
          active={editor.isActive('heading', { level: 2 })}
          title="제목 2"
        >
          <Heading2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() =>
            editor.chain().focus().toggleHeading({ level: 3 }).run()
          }
          active={editor.isActive('heading', { level: 3 })}
          title="제목 3"
        >
          <Heading3 size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive('bulletList')}
          title="글머리 기호"
        >
          <List size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive('orderedList')}
          title="번호 매기기"
        >
          <ListOrdered size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          active={editor.isActive('taskList')}
          title="체크리스트"
        >
          <ListTodo size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          active={editor.isActive('codeBlock')}
          title="코드 블록"
        >
          <Code size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          active={editor.isActive('blockquote')}
          title="인용"
        >
          <Quote size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="구분선"
        >
          <Minus size={16} />
        </ToolbarButton>

        <Divider />

        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          title="되돌리기 (Ctrl+Z)"
        >
          <Undo2 size={16} />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          title="다시 실행 (Ctrl+Shift+Z)"
        >
          <Redo2 size={16} />
        </ToolbarButton>

        <div className="ml-auto flex items-center gap-2">
          {saveStatus === 'saving' && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Save size={12} className="animate-pulse" />
              저장 중...
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-xs text-green-500 flex items-center gap-1">
              <Check size={12} />
              저장됨
            </span>
          )}
          <button
            onClick={doSave}
            className="flex items-center gap-1.5 text-xs bg-indigo-50 hover:bg-indigo-100 text-indigo-600 px-3 py-1.5 rounded-md transition-colors font-medium"
          >
            <Save size={13} />
            저장
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
