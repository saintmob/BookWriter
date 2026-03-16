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
  textProvider: 'gemini' | 'openrouter';
  imageProvider: 'gemini' | 'openrouter';
  geminiApiKey: string | null;
  geminiTextModel: string;
  geminiImageModel: string;
  openRouterApiKey: string | null;
  openRouterTextModel: string;
  openRouterImageModel: string;
  draft: DraftState;
  isSidebarCollapsed: boolean;
  setIsSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'dark' | 'light' | 'system') => void;
  setLanguage: (lang: 'en' | 'zh') => void;
  setTextProvider: (provider: 'gemini' | 'openrouter') => void;
  setImageProvider: (provider: 'gemini' | 'openrouter') => void;
  setGeminiApiKey: (key: string | null) => void;
  setGeminiTextModel: (model: string) => void;
  setGeminiImageModel: (model: string) => void;
  setOpenRouterApiKey: (key: string | null) => void;
  setOpenRouterTextModel: (model: string) => void;
  setOpenRouterImageModel: (model: string) => void;
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
      textProvider: 'openrouter',
      imageProvider: 'gemini',
      geminiApiKey: null,
      geminiTextModel: 'gemini-3.1-flash-preview',
      geminiImageModel: 'gemini-2.5-flash-image',
      openRouterApiKey: null,
      openRouterTextModel: 'stepfun/step-3.5-flash:free',
      openRouterImageModel: 'google/gemini-3.1-flash-image-preview',
      draft: initialDraft,
      isSidebarCollapsed: false,
      setIsSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
      setTheme: (theme) => set({ theme }),
      setLanguage: (language) => set({ language }),
      setTextProvider: (provider) => set({ textProvider: provider }),
      setImageProvider: (provider) => set({ imageProvider: provider }),
      setGeminiApiKey: (key) => set({ geminiApiKey: key }),
      setGeminiTextModel: (model) => set({ geminiTextModel: model }),
      setGeminiImageModel: (model) => set({ geminiImageModel: model }),
      setOpenRouterApiKey: (key) => set({ openRouterApiKey: key }),
      setOpenRouterTextModel: (model) => set({ openRouterTextModel: model }),
      setOpenRouterImageModel: (model) => set({ openRouterImageModel: model }),
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
        textProvider: state.textProvider,
        imageProvider: state.imageProvider,
        geminiApiKey: state.geminiApiKey,
        geminiTextModel: state.geminiTextModel,
        geminiImageModel: state.geminiImageModel,
        openRouterApiKey: state.openRouterApiKey,
        openRouterTextModel: state.openRouterTextModel,
        openRouterImageModel: state.openRouterImageModel,
        activeBookId: state.activeBookId, // Persist active book to prevent jumping to dashboard on refresh
        activeChapterId: state.activeChapterId, // Persist active chapter to prevent losing context
        draft: state.draft // Persist draft state to save progress
      }),
    }
  )
);
