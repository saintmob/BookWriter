import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { BookPlus, Library, Upload, Loader2, Sparkles, X, Zap, Layout, FileText, Share2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useState, useRef } from 'react';
import { db } from '../lib/db';
import { toast } from 'sonner';

export function Dashboard() {
  const { t } = useTranslation();
  const { books, setActiveBook, loadBooks, resetDraft } = useStore();
  const [isImporting, setIsImporting] = useState(false);
  const [showFeatures, setShowFeatures] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewBook = () => {
    resetDraft();
    setActiveBook('new');
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const toastId = toast.loading(t('importing_book'));
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (!data.book || !Array.isArray(data.chapters)) {
        throw new Error('Invalid format');
      }

      // Save book
      await db.saveBook(data.book);
      
      // Save chapters
      for (const chapter of data.chapters) {
        await db.saveChapter(chapter);
      }

      // Save chat messages if present
      if (Array.isArray(data.chatMessages)) {
        for (const message of data.chatMessages) {
          await db.saveChatMessage(message);
        }
      }

      await loadBooks();
      toast.success(t('import_success'), { id: toastId });
    } catch (error: any) {
      console.error('Import failed', error);
      toast.error(error.message || t('import_error'), { id: toastId });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div className="flex-1 h-screen overflow-y-auto bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 p-8 md:p-16 transition-colors duration-200">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6">
          <h1 className="text-4xl font-serif font-bold flex items-center gap-3">
            <Library className="w-8 h-8 text-emerald-500" />
            {t('my_books')}
          </h1>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setShowFeatures(true)}
              className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-emerald-600 dark:text-emerald-400 px-5 py-2.5 rounded-xl font-medium transition-colors border border-emerald-100 dark:border-emerald-900/30 shadow-sm"
            >
              <Sparkles className="w-5 h-5" />
              {t('feature_highlights')}
            </button>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".json"
              className="hidden"
            />
            <button
              onClick={handleImportClick}
              disabled={isImporting}
              className="flex items-center gap-2 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 px-5 py-2.5 rounded-xl font-medium transition-colors border border-zinc-200 dark:border-zinc-800 shadow-sm disabled:opacity-50"
            >
              {isImporting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
              {t('import_json')}
            </button>
            <button
              onClick={handleNewBook}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
            >
              <BookPlus className="w-5 h-5" />
              {t('new_book')}
            </button>
          </div>
        </div>

        {/* Features Modal */}
        <AnimatePresence>
          {showFeatures && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="bg-white dark:bg-zinc-900 rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-zinc-800">
                  <h2 className="text-2xl font-serif font-bold flex items-center gap-2">
                    <Sparkles className="w-6 h-6 text-emerald-500" />
                    {t('feature_highlights')}
                  </h2>
                  <button 
                    onClick={() => setShowFeatures(false)}
                    className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6 text-zinc-400" />
                  </button>
                </div>
                
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
                      <Zap className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{t('features.multimodal')}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {t('features.multimodal_desc')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0">
                      <Layout className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{t('features.realtime')}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {t('features.realtime_desc')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center shrink-0">
                      <FileText className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{t('features.formatting')}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {t('features.formatting_desc')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0">
                      <Share2 className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg mb-1">{t('features.export')}</h3>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">
                        {t('features.export_desc')}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="p-6 bg-zinc-50 dark:bg-zinc-800/50 flex justify-end">
                  <button
                    onClick={() => setShowFeatures(false)}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-2.5 rounded-xl font-medium transition-colors shadow-sm"
                  >
                    {t('close')}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {books.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl text-zinc-400 dark:text-zinc-600">
            <Library className="w-12 h-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">{t('no_books')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {books.map((book, idx) => (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={book.id}
                onClick={() => setActiveBook(book.id)}
                className="group cursor-pointer bg-white dark:bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500 dark:hover:border-emerald-500 transition-all shadow-sm hover:shadow-md flex flex-col h-72"
              >
                <div className="h-32 bg-zinc-100 dark:bg-zinc-800 relative overflow-hidden">
                  {book.coverImage ? (
                    <img src={book.coverImage} alt={book.title} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-emerald-500/20 to-emerald-700/20 dark:from-emerald-900/40 dark:to-emerald-950/40">
                      <Library className="w-10 h-10 text-emerald-600/50 dark:text-emerald-400/50" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                </div>
                <div className="p-5 flex-1 flex flex-col">
                  <h3 className="font-serif font-bold text-lg mb-2 line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {book.title || 'Untitled'}
                  </h3>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400 line-clamp-3 flex-1">
                    {book.summary || book.idea}
                  </p>
                  <div className="mt-4 text-xs text-zinc-400 dark:text-zinc-500 font-medium">
                    {new Date(book.updatedAt).toLocaleDateString()}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
