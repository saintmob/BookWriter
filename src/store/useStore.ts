import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { db, Book } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { Proposal } from '../lib/ai';

interface DraftState {
  step: 1 | 2 | 3;
  idea: string;
  proposals: Proposal[];
  selectedProposal: Proposal | null;
}

interface AppState {
  books: Book[];
  activeBookId: string | null;
  activeChapterId: string | null;
  theme: 'dark' | 'light' | 'system';
  language: 'en' | 'zh';
  geminiApiKey: string | null;
  draft: DraftState;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setLanguage: (lang: 'en' | 'zh') => void;
  setGeminiApiKey: (key: string | null) => void;
  loadBooks: () => Promise<void>;
  createBook: (title: string, idea: string, summary: string, coverImage?: string) => Promise<Book>;
  setActiveBook: (id: string | null) => void;
  setActiveChapter: (id: string | null) => void;
  deleteBook: (id: string) => Promise<void>;
  updateBook: (id: string, updates: Partial<Book>) => Promise<void>;
  setDraft: (updates: Partial<DraftState>) => void;
  resetDraft: () => void;
}

const initialDraft: DraftState = {
  step: 1,
  idea: '',
  proposals: [],
  selectedProposal: null,
};

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      books: [],
      activeBookId: null,
      activeChapterId: null,
      theme: 'system',
      language: 'zh',
      geminiApiKey: null,
      draft: initialDraft,
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
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
        set({ activeBookId: newBook.id });
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
      setDraft: (updates) => set((state) => ({ draft: { ...state.draft, ...updates } })),
      resetDraft: () => set({ draft: initialDraft }),
    }),
    {
      name: 'ai-book-writer-settings',
      partialize: (state) => ({ 
        theme: state.theme, 
        language: state.language,
        geminiApiKey: state.geminiApiKey,
        activeBookId: state.activeBookId, // Persist active book to prevent jumping to dashboard on refresh
        activeChapterId: state.activeChapterId, // Persist active chapter to prevent losing context
        draft: state.draft // Persist draft state to save progress
      }),
    }
  )
);
