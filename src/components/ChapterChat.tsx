import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Loader2, Sparkles, Check, X, Trash2, Wand2, Image as ImageIcon } from 'lucide-react';
import { chatWithChapter } from '../lib/ai';
import { MarkdownRenderer } from './MarkdownRenderer';
import { db, ChatMessage } from '../lib/db';
import { v4 as uuidv4 } from 'uuid';
import { useStore } from '../store/useStore';
import { ConfirmModal } from './ConfirmModal';
import { toast } from 'sonner';

interface ChapterChatProps {
  content: string;
  chapterTitle: string;
  bookTitle: string;
  language: string;
  onApplyContent: (newContent: string) => void;
  onClose: () => void;
  onGenerateContent?: () => Promise<void>;
  isGeneratingContent?: boolean;
  onProofreadText?: () => void;
  isProofreading?: boolean;
  onGenerateImageOfPrompt?: (prompt: string) => Promise<string | null>;
  onAddImageToLayout?: (url: string) => void;
}

export function ChapterChat({ 
  content, 
  chapterTitle, 
  bookTitle, 
  language, 
  onApplyContent, 
  onClose,
  onGenerateContent,
  isGeneratingContent,
  onProofreadText,
  isProofreading,
  onGenerateImageOfPrompt,
  onAddImageToLayout
}: ChapterChatProps) {
  const { t } = useTranslation();
  const activeChapterId = useStore((state) => state.activeChapterId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; messageId?: string; isClearAll?: boolean }>({
    isOpen: false,
  });

  const loadMessages = async () => {
    if (activeChapterId) {
      const msgs = await db.getChatMessages(activeChapterId);
      setMessages(msgs);
    }
  };

  useEffect(() => {
    loadMessages();
  }, [activeChapterId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !activeChapterId) return;

    const userMessageContent = input;
    setInput('');
    
    const userMessage: ChatMessage = {
      id: uuidv4(),
      chapterId: activeChapterId,
      role: 'user',
      content: userMessageContent,
      createdAt: Date.now(),
    };
    
    await db.saveChatMessage(userMessage);
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const response = await chatWithChapter(content, userMessageContent, chapterTitle, bookTitle, language);
      
      const assistantMessage: ChatMessage = {
        id: uuidv4(),
        chapterId: activeChapterId,
        role: 'assistant',
        content: response.reply,
        updatedContent: response.updatedContent,
        createdAt: Date.now(),
      };
      
      await db.saveChatMessage(assistantMessage);
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      console.error('Chat failed', error);
      const errorMessage: ChatMessage = {
        id: uuidv4(),
        chapterId: activeChapterId,
        role: 'assistant',
        content: error.message || t('chat_error'),
        createdAt: Date.now(),
      };
      await db.saveChatMessage(errorMessage);
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteMessage = async () => {
    if (deleteConfirm.messageId) {
      await db.deleteChatMessage(deleteConfirm.messageId);
      setMessages(prev => prev.filter(m => m.id !== deleteConfirm.messageId));
    } else if (deleteConfirm.isClearAll && activeChapterId) {
      await db.clearChatMessages(activeChapterId);
      setMessages([]);
    }
    setDeleteConfirm({ isOpen: false });
  };

  return (
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-900 overflow-hidden relative">
      <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shrink-0">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          {t('ai_assistant')}
        </h3>
        <div className="flex items-center gap-2">
          {messages.length > 0 && (
            <button
              onClick={() => setDeleteConfirm({ isOpen: true, isClearAll: true })}
              className="text-zinc-400 hover:text-red-500 transition-colors p-1"
              title={t('clear_all_chats')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-zinc-500 text-sm mt-8">
            <p>{t('chat_welcome')}</p>
            <p className="mt-2 text-xs opacity-70">{t('chat_example')}</p>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className="flex items-center gap-2 w-full">
              {msg.role === 'user' && (
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, messageId: msg.id })}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 object-contain hover:text-red-500 transition-opacity ml-auto"
                  title={t('delete_message')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              <div 
                className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                  msg.role === 'user' 
                    ? 'bg-emerald-500 text-white' 
                    : 'bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 shadow-sm'
                }`}
              >
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                </div>
              </div>
              {msg.role === 'assistant' && (
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, messageId: msg.id })}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity mr-auto"
                  title={t('delete_message')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            
            {msg.updatedContent && (
              <div className="mt-2 w-full pl-6">
                <button
                  onClick={() => onApplyContent(msg.updatedContent!)}
                  className="w-[85%] flex items-center justify-center gap-2 px-3 py-2 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-300 rounded-lg text-xs font-medium transition-colors border border-emerald-200 dark:border-emerald-800"
                >
                  <Check className="w-3 h-3" />
                  {t('apply_to_editor')}
                </button>
              </div>
            )}
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start">
            <div className="bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 shadow-sm">
              <Loader2 className="w-4 h-4 animate-spin text-zinc-400" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col gap-2">
        {/* AI Quick Actions Row */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
          {onGenerateContent && (
            <button
              onClick={onGenerateContent}
              disabled={isGeneratingContent || isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-400 rounded-full text-[10px] font-semibold transition-colors border border-emerald-200 dark:border-emerald-800/50 whitespace-nowrap disabled:opacity-50"
            >
              {isGeneratingContent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {language === 'zh' ? '生成初稿' : 'Generate Draft'}
            </button>
          )}
          {onProofreadText && (
             <button
              onClick={onProofreadText}
              disabled={isProofreading || isLoading || !content}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-300 rounded-full text-[10px] font-semibold transition-colors border border-zinc-200 dark:border-zinc-700 whitespace-nowrap disabled:opacity-50"
            >
              {isProofreading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              {language === 'zh' ? '润色文本' : 'Proofread'}
            </button>
          )}
          {onGenerateImageOfPrompt && onAddImageToLayout && (
             <button
              onClick={async () => {
                const promptText = window.prompt(language === 'zh' ? '请输入 AI 插图描述（如：一只赛博朋克猫）：' : 'Enter AI illustration prompt:');
                if (!promptText) return;
            
                const toastId = toast.loading(language === 'zh' ? '正在渲染高保真插图...' : 'Generating image masterpiece...');
                try {
                  const url = await onGenerateImageOfPrompt(promptText);
                  if (url) {
                    onAddImageToLayout(url);
                    toast.dismiss(toastId);
                    toast.success(language === 'zh' ? '插图生成成功' : 'Generated successfully');
                  } else {
                    toast.dismiss(toastId);
                    toast.error(language === 'zh' ? '未能生成图像' : 'Failed to generate');
                  }
                } catch (err: any) {
                  toast.dismiss(toastId);
                  toast.error(err.message || 'Generation failed');
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-700 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-400 rounded-full text-[10px] font-semibold transition-colors border border-purple-200 dark:border-purple-800/50 whitespace-nowrap disabled:opacity-50"
            >
              <ImageIcon className="w-3 h-3" />
              {language === 'zh' ? '生成配图' : 'Generate Image'}
            </button>
          )}
        </div>

        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={t('type_message')}
            className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg pl-3 pr-10 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/50 min-h-[40px] max-h-32"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2 p-1 text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ConfirmModal
        isOpen={deleteConfirm.isOpen}
        onClose={() => setDeleteConfirm({ isOpen: false })}
        onConfirm={handleDeleteMessage}
        title={deleteConfirm.isClearAll ? t('clear_all_chats_title', 'Clear chat history') : t('delete_message_title', 'Delete message')}
        message={deleteConfirm.isClearAll ? t('clear_all_chats_desc', 'Are you sure you want to clear all chat history for this chapter? This cannot be undone.') : t('delete_message_desc', 'Are you sure you want to delete this message?')}
        confirmLabel={t('delete', 'Delete')}
        cancelLabel={t('cancel', 'Cancel')}
      />
    </div>
  );
}
