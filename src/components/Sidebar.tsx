import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { BookPlus, Feather, Settings, PanelLeftClose, PanelLeftOpen, Book, PenLine, LayoutTemplate, BookOpen } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';
import { SettingsModal } from './SettingsModal';

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { 
    books, 
    activeBookId, 
    setActiveBook, 
    theme, 
    language, 
    isSidebarCollapsed, 
    setIsSidebarCollapsed, 
    isOutlineSidebarOpen,
    setIsOutlineSidebarOpen,
    resetDraft, 
    appMode, 
    setAppMode 
  } = useStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const handleNewBook = () => {
    resetDraft();
    setActiveBook('new');
    setAppMode('write');
  };

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);


  return (
    <>
      <div className={cn(
        "h-screen bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-all duration-300",
        isSidebarCollapsed ? "w-16" : "w-64"
      )}>
        <div className="p-4 flex items-center justify-between">
          {!isSidebarCollapsed && (
            <button 
              onClick={() => setActiveBook(null)}
              className="flex items-center gap-2 font-serif text-xl font-semibold text-zinc-900 dark:text-zinc-100 hover:opacity-80 transition-opacity text-left truncate"
            >
              <Feather className="w-6 h-6 text-emerald-600 dark:text-emerald-500 shrink-0" />
              <span className="truncate">{t('app_title')}</span>
            </button>
          )}
          {isSidebarCollapsed && (
            <button 
              onClick={() => setActiveBook(null)}
              className="flex items-center justify-center w-full hover:opacity-80 transition-opacity"
              title={t('app_title')}
            >
              <Feather className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
            </button>
          )}
        </div>

        <div className="px-3 pb-2 space-y-1">
            <button 
              onClick={() => setAppMode('write')}
              title={isSidebarCollapsed ? t('write_mode', 'Write') : undefined}
              className={cn("w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center transition-colors", 
                isSidebarCollapsed ? "justify-center" : "gap-2",
                appMode === 'write' ? 'bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50')}
            >
              <PenLine className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>{t('write_mode', 'Write')}</span>}
            </button>
            <button 
              onClick={() => setAppMode('typeset')}
              title={isSidebarCollapsed ? t('typeset_mode', 'Layout') : undefined}
              className={cn("w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center transition-colors", 
                isSidebarCollapsed ? "justify-center" : "gap-2",
                appMode === 'typeset' ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-400' : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50')}
            >
              <LayoutTemplate className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>{t('typeset_mode', 'Layout')}</span>}
            </button>
            
            {activeBookId && activeBookId !== 'new' && (
              <button 
                onClick={() => setIsOutlineSidebarOpen(!isOutlineSidebarOpen)}
                title={isSidebarCollapsed ? (language === 'zh' ? '显示/隐藏章节大纲' : 'Toggle Chapters List') : undefined}
                className={cn("w-full text-left px-3 py-2 rounded-lg text-sm font-medium flex items-center transition-colors", 
                  isSidebarCollapsed ? "justify-center" : "gap-2",
                  isOutlineSidebarOpen 
                    ? 'bg-emerald-50 text-emerald-750 dark:bg-emerald-950/20 dark:text-emerald-400 ring-1 ring-emerald-500/20' 
                    : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50')}
              >
                <BookOpen className="w-5 h-5 shrink-0 text-amber-500" />
                {!isSidebarCollapsed && <span>{language === 'zh' ? '章节大纲' : 'Chapters List'}</span>}
              </button>
            )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={handleNewBook}
            title={isSidebarCollapsed ? t('new_book') : undefined}
            className={cn(
              "w-full flex items-center rounded-lg text-sm font-medium transition-colors",
              isSidebarCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2",
              activeBookId === 'new'
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
            )}
          >
            <BookPlus className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span>{t('new_book')}</span>}
          </button>

          {!isSidebarCollapsed && (
            <button 
              onClick={() => setActiveBook(null)}
              className="w-full text-left pt-4 pb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
            >
              {t('my_books')}
            </button>
          )}
          {isSidebarCollapsed && <div className="h-4" />}
          
          {books.map((book) => (
            <button
              key={book.id}
              onClick={() => setActiveBook(book.id)}
              title={isSidebarCollapsed ? book.title || 'Untitled' : undefined}
              className={cn(
                "w-full flex items-center rounded-lg text-sm font-medium text-left transition-colors",
                isSidebarCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2",
                activeBookId === book.id
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
              )}
            >
              {isSidebarCollapsed ? (
                <Book className="w-5 h-5 shrink-0" />
              ) : (
                <span className="truncate">{book.title || 'Untitled'}</span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-2">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            title={isSidebarCollapsed ? t('settings') : undefined}
            className={cn(
              "w-full flex items-center text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200 rounded-lg transition-colors",
              isSidebarCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
            )}
          >
            <Settings className="w-5 h-5 shrink-0" />
            {!isSidebarCollapsed && <span>{t('settings')}</span>}
          </button>
          
          <button 
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            title={isSidebarCollapsed ? t('expand_sidebar') : t('collapse_sidebar')}
            className={cn(
              "w-full flex items-center text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200 rounded-lg transition-colors",
              isSidebarCollapsed ? "justify-center p-2" : "gap-2 px-3 py-2"
            )}
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen className="w-5 h-5 shrink-0" />
            ) : (
              <>
                <PanelLeftClose className="w-5 h-5 shrink-0" />
                <span>{t('collapse_sidebar', 'Collapse Sidebar')}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isSettingsOpen && (
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}
    </>
  );
}
