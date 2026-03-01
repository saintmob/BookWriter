import { useEffect } from 'react';
import { useStore } from './store/useStore';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { BookCreator } from './components/BookCreator';
import { BookEditor } from './components/BookEditor';
import { Toaster } from 'sonner';
import './i18n';

export default function App() {
  const { loadBooks, activeBookId, books } = useStore();

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  const activeBook = books.find(b => b.id === activeBookId);

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased selection:bg-emerald-200 selection:text-emerald-900 dark:selection:bg-emerald-900/50 dark:selection:text-emerald-100">
      <Toaster position="top-center" richColors />
      <Sidebar />
      
      {activeBookId === null ? (
        <Dashboard />
      ) : activeBook ? (
        <BookEditor />
      ) : (
        <BookCreator />
      )}
    </div>
  );
}
