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
}

let dbPromise: Promise<IDBPDatabase<BookDB>>;

export async function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<BookDB>('ai-book-writer', 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('books')) {
          db.createObjectStore('books', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('chapters')) {
          const chapterStore = db.createObjectStore('chapters', { keyPath: 'id' });
          chapterStore.createIndex('by-book', 'bookId');
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
    const tx = database.transaction(['books', 'chapters'], 'readwrite');
    await tx.objectStore('books').delete(id);
    const index = tx.objectStore('chapters').index('by-book');
    let cursor = await index.openCursor(id);
    while (cursor) {
      await cursor.delete();
      cursor = await cursor.continue();
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
    await database.delete('chapters', id);
  }
};
