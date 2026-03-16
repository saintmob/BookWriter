import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check, Save } from 'lucide-react';
import { Book, db } from '../lib/db';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface BookInfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  onUpdate: (updatedBook: Book) => void;
}

export function BookInfoModal({ isOpen, onClose, book, onUpdate }: BookInfoModalProps) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(book.title);
  const [summary, setSummary] = useState(book.summary);
  const [isCopied, setIsCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setTitle(book.title);
    setSummary(book.summary);
  }, [book]);

  if (!isOpen) return null;

  const handleCopy = () => {
    const text = `${title}\n\n${summary}`;
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const updatedBook = { ...book, title, summary, updatedAt: Date.now() };
      await db.saveBook(updatedBook);
      onUpdate(updatedBook);
      onClose();
    } catch (error: any) {
      console.error('Failed to save book info', error);
      toast.error(error.message || 'Failed to save book info');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between p-6 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-xl font-serif font-bold">{t('book_info')}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors relative"
              title={t('copy_to_clipboard')}
            >
              {isCopied ? <Check className="w-5 h-5 text-emerald-500" /> : <Copy className="w-5 h-5" />}
              {isCopied && (
                <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-zinc-800 text-white text-[10px] px-2 py-1 rounded whitespace-nowrap">
                  {t('copied')}
                </span>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('book_title')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-serif text-lg"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {t('book_summary')}
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="w-full bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all font-serif text-base leading-relaxed min-h-[300px] resize-none"
            />
          </div>
        </div>

        <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg font-medium transition-colors"
          >
            {t('cancel')}
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || (!title.trim())}
            className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {isSaving ? <Check className="w-4 h-4 animate-pulse" /> : <Save className="w-4 h-4" />}
            {t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}
