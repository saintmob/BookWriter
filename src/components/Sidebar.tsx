import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { BookPlus, Library, Settings, Moon, Sun, Monitor } from 'lucide-react';
import { cn } from '../lib/utils';
import { useEffect } from 'react';

export function Sidebar() {
  const { t, i18n } = useTranslation();
  const { books, activeBookId, setActiveBook, theme, setTheme, language, setLanguage } = useStore();

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
    <div className="w-64 h-screen bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transition-colors duration-200">
      <button 
        onClick={() => setActiveBook(null)}
        className="p-4 flex items-center gap-2 font-serif text-xl font-semibold text-zinc-900 dark:text-zinc-100 hover:opacity-80 transition-opacity text-left"
      >
        <Library className="w-6 h-6 text-emerald-600 dark:text-emerald-500" />
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

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-4">
        <div className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
          <span className="flex items-center gap-2"><Settings className="w-4 h-4" /> {t('settings')}</span>
        </div>
        
        <div className="flex gap-1 bg-zinc-200/50 dark:bg-zinc-800/50 p-1 rounded-lg">
          <button onClick={() => setTheme('light')} className={cn("flex-1 flex justify-center p-1.5 rounded-md transition-colors", theme === 'light' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}><Sun className="w-4 h-4" /></button>
          <button onClick={() => setTheme('system')} className={cn("flex-1 flex justify-center p-1.5 rounded-md transition-colors", theme === 'system' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}><Monitor className="w-4 h-4" /></button>
          <button onClick={() => setTheme('dark')} className={cn("flex-1 flex justify-center p-1.5 rounded-md transition-colors", theme === 'dark' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}><Moon className="w-4 h-4" /></button>
        </div>

        <div className="flex gap-1 bg-zinc-200/50 dark:bg-zinc-800/50 p-1 rounded-lg text-xs font-medium">
          <button onClick={() => setLanguage('en')} className={cn("flex-1 p-1.5 rounded-md transition-colors", language === 'en' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>EN</button>
          <button onClick={() => setLanguage('zh')} className={cn("flex-1 p-1.5 rounded-md transition-colors", language === 'zh' ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}>中文</button>
        </div>
      </div>
    </div>
  );
}
