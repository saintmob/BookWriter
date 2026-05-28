import React, { useState, useEffect } from 'react';
import { useStore } from '../store/useStore';
import { useTranslation } from 'react-i18next';
import { db, Chapter } from '../lib/db';
import { TypesetLayoutEditor } from './TypesetLayoutEditor';
import { LayoutTemplate } from 'lucide-react';
import { cn } from '../lib/utils';

export function BookTypesetter() {
  const { t } = useTranslation();
  const { activeBookId, activeChapterId, setActiveChapter, books } = useStore();
  const [chapters, setChapters] = useState<Chapter[]>([]);
  
  useEffect(() => {
    const loadChapters = async () => {
      if (!activeBookId) return;
      const data = await db.getChapters(activeBookId);
      setChapters(data);
      if (data.length > 0 && !activeChapterId) {
         setActiveChapter(data[0].id);
      }
    };
    loadChapters();
  }, [activeBookId, activeChapterId, setActiveChapter]);

  const activeChapter = chapters.find(c => c.id === activeChapterId);
  const activeBook = books.find(b => b.id === activeBookId);

  return (
    <div className="flex-1 flex bg-zinc-50 dark:bg-zinc-950 overflow-hidden h-full">
      {/* Chapter List (Left Panel) */}
      <div className="w-64 border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col hidden md:flex shrink-0">
         <div className="h-16 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-4 shrink-0">
           <LayoutTemplate className="w-5 h-5 text-emerald-600 dark:text-emerald-500 mr-2 shrink-0" />
           <h2 className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">{t('typeset_mode', 'Layout Mode')}</h2>
         </div>
         <div className="flex-1 overflow-y-auto p-4 space-y-1">
            <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2">
              {activeBook?.title || 'Book Phases'}
            </div>
            {chapters.map((chapter) => (
              <button
                key={chapter.id}
                onClick={() => setActiveChapter(chapter.id)}
                className={cn(
                  "w-full text-left px-3 py-2 text-sm rounded-lg font-medium transition-colors truncate",
                  activeChapterId === chapter.id 
                    ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
                )}
              >
                {chapter.title || 'Untitled Phase'}
              </button>
            ))}
         </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col min-w-0">
         {activeChapter ? (
            <TypesetLayoutEditor 
               chapter={activeChapter}
               content={activeChapter.content}
               onUpdateChapter={(updated) => {
                  setChapters(chapters.map(c => c.id === updated.id ? updated : c));
               }}
            />
         ) : (
           <div className="flex flex-col items-center justify-center text-zinc-400 h-full">
              <LayoutTemplate className="w-12 h-12 mb-4 opacity-20" />
              <p>{t('no_chapter_selected', 'Select a phase to layout')}</p>
           </div>
         )}
      </div>
    </div>
  );
}
