import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db, Book, Chapter } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';

interface AppState {
  books: Book[];
  activeBookId: string | null;
  activeChapterId: string | null;
  theme: 'dark' | 'light' | 'system';
  language: 'en' | 'zh';
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setLanguage: (lang: 'en' | 'zh') => void;
  loadBooks: () => Promise<void>;
  createBook: (title: string, idea: string, summary: string, coverImage?: string) => Promise<Book>;
  setActiveBook: (id: string | null) => void;
  setActiveChapter: (id: string | null) => void;
  deleteBook: (id: string) => Promise<void>;
  updateBook: (id: string, updates: Partial<Book>) => Promise<void>;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      books: [],
      activeBookId: null,
      activeChapterId: null,
      theme: 'system',
      language: 'zh',
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      loadBooks: async () => {
        const books = await db.getBooks();
        set({ books });
      },
      createBook: async (title, idea, summary, coverImage) => {
        const newBook: Book = {
          id: uuidv4(),
          title,
          idea,
          summary,
          coverImage,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        await db.saveBook(newBook);
        await get().loadBooks();
        return newBook;
      },
      setActiveBook: (id) => set({ activeBookId: id, activeChapterId: null }),
      setActiveChapter: (id) => set({ activeChapterId: id }),
      deleteBook: async (id) => {
        await db.deleteBook(id);
        if (get().activeBookId === id) {
          set({ activeBookId: null, activeChapterId: null });
        }
        await get().loadBooks();
      },
      updateBook: async (id, updates) => {
        const book = await db.getBook(id);
        if (book) {
          const updatedBook = { ...book, ...updates, updatedAt: Date.now() };
          await db.saveBook(updatedBook);
          await get().loadBooks();
        }
      },
    }),
    {
      name: 'ai-book-writer-settings',
      partialize: (state) => ({ theme: state.theme, language: state.language }),
    }
  )
);
