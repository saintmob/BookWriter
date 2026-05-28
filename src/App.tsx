import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { BookCreator } from './components/BookCreator';
import { BookEditor } from './components/BookEditor';
import { BookTypesetter } from './components/BookTypesetter';
import { Toaster } from 'sonner';
import './i18n';

export default function App() {
  const { loadBooks, activeBookId, books, theme, appMode } = useStore();

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    const root = window.document.documentElement;
    
    const applyTheme = (t: 'light' | 'dark') => {
      if (t === 'dark') {
        root.classList.add('dark');
        root.style.colorScheme = 'dark';
      } else {
        root.classList.remove('dark');
        root.style.colorScheme = 'light';
      }
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');
      
      const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    } else {
      applyTheme(theme);
    }
  }, [theme]);

  const activeBook = books.find(b => b.id === activeBookId);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased selection:bg-emerald-200 selection:text-emerald-900 dark:selection:bg-emerald-900/50 dark:selection:text-emerald-100">
      <Toaster position="top-center" richColors />
      <Sidebar />
      
      {activeBookId === null ? (
        <Dashboard />
      ) : activeBook ? (
        appMode === 'typeset' ? (
          <BookTypesetter />
        ) : (
          <BookEditor />
        )
      ) : (
        <BookCreator />
      )}
    </div>
  );
}
