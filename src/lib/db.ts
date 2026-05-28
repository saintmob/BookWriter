import { openDB, DBSchema, IDBPDatabase } from 'idb';

export interface Book {
  id: string;
  title: string;
  idea: string;
  summary: string;
  coverImage?: string;
  createdAt: number;
  updatedAt: number;
}

export interface FloatingImage {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageIndex?: number; // Which page this image belongs to
}

export type TrimFormat = 'a4' | 'letter' | 'trade' | 'pocket';

export interface PageLayout {
  marginTop: number;
  marginBottom: number;
  marginLeft: number;
  marginRight: number;
  format?: TrimFormat;
  fontSize?: number;
  lineHeight?: number;
}

export interface Chapter {
  id: string;
  bookId: string;
  title: string;
  description: string;
  content: string;
  image?: string;
  order: number;
  createdAt: number;
  updatedAt: number;
  layout?: PageLayout;
  floatingImages?: FloatingImage[];
}

export interface ChatMessage {
  id: string;
  chapterId: string;
  role: 'user' | 'assistant';
  content: string;
  updatedContent?: string;
  createdAt: number;
}

interface BookDB extends DBSchema {
  books: {
    key: string;
    value: Book;
  };
  chapters: {
    key: string;
    value: Chapter;
    indexes: { 'by-book': string };
  };
  chatMessages: {
    key: string;
    value: ChatMessage;
    indexes: { 'by-chapter': string };
  };
}

let dbPromise: Promise<IDBPDatabase<BookDB>>;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<BookDB>('ai-book-writer', 2, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chapters')) {
          const chapterStore = db.createObjectStore('chapters', { keyPath: 'id' });
          chapterStore.createIndex('by-book', 'bookId');
        }
        if (!db.objectStoreNames.contains('chatMessages')) {
          const chatStore = db.createObjectStore('chatMessages', { keyPath: 'id' });
          chatStore.createIndex('by-chapter', 'chapterId');
        }
      },
    });
  }
  return dbPromise;
}

export const db = {
  async getBooks() {
    const database = await getDB();
    return database.getAll('books');
  },
  async getBook(id: string) {
    const database = await getDB();
    return database.get('books', id);
  },
  async saveBook(book: Book) {
    const database = await getDB();
    await database.put('books', book);
  },
  async deleteBook(id: string) {
    const database = await getDB();
    const tx = database.transaction(['books', 'chapters', 'chatMessages'], 'readwrite');
    await tx.objectStore('books').delete(id);
    
    // delete chapters
    const chapterIndex = tx.objectStore('chapters').index('by-book');
    let chapterCursor = await chapterIndex.openCursor(id);
    while (chapterCursor) {
      const chapterId = chapterCursor.value.id;
      
      // delete chats for this chapter
      const chatIndex = tx.objectStore('chatMessages').index('by-chapter');
      let chatCursor = await chatIndex.openCursor(chapterId);
      while (chatCursor) {
        await chatCursor.delete();
        chatCursor = await chatCursor.continue();
      }
      
      await chapterCursor.delete();
      chapterCursor = await chapterCursor.continue();
    }
    await tx.done;
  },
  async getChapters(bookId: string) {
    const database = await getDB();
    const chapters = await database.getAllFromIndex('chapters', 'by-book', bookId);
    return chapters.sort((a, b) => a.order - b.order);
  },
  async saveChapter(chapter: Chapter) {
    const database = await getDB();
    await database.put('chapters', chapter);
  },
  async deleteChapter(id: string) {
    const database = await getDB();
    const tx = database.transaction(['chapters', 'chatMessages'], 'readwrite');
    await tx.objectStore('chapters').delete(id);
    
    // delete chats for this chapter
    const chatIndex = tx.objectStore('chatMessages').index('by-chapter');
    let chatCursor = await chatIndex.openCursor(id);
    while (chatCursor) {
      await chatCursor.delete();
      chatCursor = await chatCursor.continue();
    }
    
    await tx.done;
  },
  async getChatMessages(chapterId: string) {
    const database = await getDB();
    const messages = await database.getAllFromIndex('chatMessages', 'by-chapter', chapterId);
    return messages.sort((a, b) => a.createdAt - b.createdAt);
  },
  async saveChatMessage(message: ChatMessage) {
    const database = await getDB();
    await database.put('chatMessages', message);
  },
  async deleteChatMessage(id: string) {
    const database = await getDB();
    await database.delete('chatMessages', id);
  },
  async clearChatMessages(chapterId: string) {
    const database = await getDB();
    const tx = database.transaction('chatMessages', 'readwrite');
    const chatIndex = tx.objectStore('chatMessages').index('by-chapter');
    let chatCursor = await chatIndex.openCursor(chapterId);
    while (chatCursor) {
      await chatCursor.delete();
      chatCursor = await chatCursor.continue();
    }
    await tx.done;
  }
};
