import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { BookPlus, Feather, Settings } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEffect, useState } from 'react';
import { SettingsModal } from './SettingsModal';

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { books, activeBookId, setActiveBook, theme, setTheme, language, setLanguage } = useStore();
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    i18n.changeLanguage(language);
  }, [language, i18n]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    if (theme === 'system') {
      const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  return (
    <>
      <div className="w-64 h-screen bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-colors duration-200">
        <button 
          onClick={() => setActiveBook(null)}
          className="p-4 flex items-center gap-2 font-serif text-xl font-semibold text-zinc-900 dark:text-zinc-100 hover:opacity-80 transition-opacity text-left"
        >
          <Feather className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
          {t('app_title')}
        </button>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <button
            onClick={() => setActiveBook('new')}
            className={cn(
              "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              activeBookId === 'new'
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
            )}
          >
            <BookPlus className="w-4 h-4" />
            {t('new_book')}
          </button>

          <button 
            onClick={() => setActiveBook(null)}
            className="w-full text-left pt-4 pb-2 text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
          >
            {t('my_books')}
          </button>
          
          {books.map((book) => (
            <button
              key={book.id}
              onClick={() => setActiveBook(book.id)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-left truncate transition-colors",
                activeBookId === book.id
                  ? "bg-zinc-200 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
              )}
            >
              {book.title || 'Untitled'}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-200 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            {t('settings')}
          </button>
        </div>
      </div>

      {isSettingsOpen && (
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}
    </>
  );
}
