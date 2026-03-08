import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { X, Send, Loader2, Sparkles, AlertCircle, Check, RotateCcw, Save } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { updateOutlineWithAI } from '../lib/ai';
import { Chapter } from '../lib/db';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

interface OutlineEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  bookId: string;
  initialChapters: Chapter[];
  onSave: (newChapters: Chapter[]) => Promise<void>;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function OutlineEditorModal({ isOpen, onClose, bookId, initialChapters, onSave }: OutlineEditorModalProps) {
  const { t } = useTranslation();
  const { books, language } = useStore();
  const book = books.find(b => b.id === bookId);
  
  // Local state for chapters (preview)
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: t('outline_editor_welcome') || "I can help you modify the book outline. You can ask me to add, remove, or rename chapters." }
  ]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      setChapters(initialChapters);
      setMessages([{ role: 'assistant', content: t('outline_editor_welcome') || "I can help you modify the book outline. You can ask me to add, remove, or rename chapters." }]);
    }
  }, [isOpen, initialChapters, t]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim() || isProcessing || !book) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsProcessing(true);

    try {
      // Prepare simplified chapter list for AI
      const simplifiedChapters = chapters.map(c => ({
        title: c.title,
        description: c.description
      }));

      const response = await updateOutlineWithAI(
        simplifiedChapters,
        userMessage,
        book.title,
        book.summary,
        language
      );

      if (response.updatedOutline) {
        // Merge AI response with existing chapters to preserve IDs and content where possible
        const newChapters: Chapter[] = response.updatedOutline.map((item, index) => {
          const existing = chapters.find(c => c.title === item.title);
          
          return {
            id: existing ? existing.id : uuidv4(),
            bookId: bookId,
            title: item.title,
            description: item.description,
            content: existing ? existing.content : '', // Preserve content if title matches
            image: existing ? existing.image : undefined,
            order: index,
            createdAt: existing ? existing.createdAt : Date.now(),
            updatedAt: Date.now()
          };
        });

        setChapters(newChapters);
      }
      
      setMessages(prev => [...prev, { role: 'assistant', content: response.reply }]);

    } catch (error) {
      console.error('Failed to update outline:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: t('outline_update_failed') || "Sorry, I couldn't update the outline. Please try again." }]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(chapters);
      toast.success(t('outline_saved_success'));
      onClose();
    } catch (error) {
      console.error('Failed to save outline:', error);
      toast.error(t('outline_save_failed'));
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-5xl h-[80vh] overflow-hidden border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row"
        >
          {/* Header (Mobile only) */}
          <div className="md:hidden flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{t('edit_outline')}</h2>
            <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Left Panel: Chapter List Preview */}
          <div className="flex-1 flex flex-col border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 min-w-0">
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-white dark:bg-zinc-900">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-zinc-400" />
                {t('outline_preview')}
              </h3>
              <span className="text-xs text-zinc-500">{chapters.length} {t('chapters')}</span>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {chapters.map((chapter, index) => (
                <div key={chapter.id || index} className="bg-white dark:bg-zinc-800 p-3 rounded-lg border border-zinc-200 dark:border-zinc-700 shadow-sm">
                  <div className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-6 h-6 flex items-center justify-center bg-zinc-100 dark:bg-zinc-700 rounded-full text-xs font-medium text-zinc-600 dark:text-zinc-300 mt-0.5">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate" title={chapter.title}>
                        {chapter.title}
                      </h4>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
                        {chapter.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex justify-between items-center">
              <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-zinc-600 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-200"
              >
                {t('cancel')}
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {t('save_changes')}
              </button>
            </div>
          </div>

          {/* Right Panel: AI Chat */}
          <div className="w-full md:w-96 flex flex-col bg-white dark:bg-zinc-900 h-1/2 md:h-auto border-t md:border-t-0 md:border-l border-zinc-200 dark:border-zinc-800">
            <div className="hidden md:flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                {t('ai_assistant')}
              </h3>
              <button onClick={onClose} className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-zinc-50 dark:bg-zinc-950/50">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex w-full",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-4 py-3 text-sm",
                      msg.role === 'user'
                        ? "bg-emerald-600 text-white rounded-br-none"
                        : "bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-800 dark:text-zinc-200 rounded-bl-none shadow-sm"
                    )}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isProcessing && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                    <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder={t('ask_ai_to_change_outline') || "e.g., Add a chapter about..."}
                  className="w-full pl-4 pr-12 py-3 bg-zinc-100 dark:bg-zinc-800 border-none rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-sm"
                  disabled={isProcessing}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!input.trim() || isProcessing}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:hover:bg-emerald-600 transition-colors"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
              <p className="mt-2 text-xs text-center text-zinc-400 dark:text-zinc-500">
                {t('ai_can_make_mistakes')}
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
