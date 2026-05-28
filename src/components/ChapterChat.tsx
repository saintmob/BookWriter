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

const STYLE_PROMPTS: Record<string, { labelZh: string; labelEn: string; prompt: string }> = {
  line_art: {
    labelZh: '✍️ 黑白线稿 (推荐书籍插图)',
    labelEn: 'B&W Line Art (Recommended)',
    prompt: 'clean solid black and white line art illustration, elegant pen ink drafting lines, hand-drawn sketch look, pure white background, no gradients, minimal shading outline style, professional book design'
  },
  auto: {
    labelZh: '🎯 智能自动 (随文本场景)',
    labelEn: 'Auto Style',
    prompt: 'natural mood integration style, professional literary book illustration design concept'
  },
  fantasy: {
    labelZh: '🌟 梦幻插画',
    labelEn: 'Fantasy Illustration',
    prompt: 'fantasy style illustration, deeply vibrant colors, celestial elements, whimsical details, digital concept art, masterpiece'
  },
  watercolor: {
    labelZh: '🎨 柔和水彩',
    labelEn: 'Watercolor Art',
    prompt: 'watercolor painting details, soft fluid pigments, gentle color transitions, organic leaks, dreamy style'
  },
  ink: {
    labelZh: '🖌️ 写意水墨',
    labelEn: 'Chinese Ink',
    prompt: 'traditional Chinese ink wash painting style, elegant brush strokes, poetic empty space, minimalist ink aesthetics, spiritual mood'
  },
  engraving: {
    labelZh: '🗺️ 复古版画',
    labelEn: 'Vintage Engraving',
    prompt: 'vintage copperplate engraving style, exquisite cross-hatching textures, retro line-art, antique paper texture'
  },
  cyberpunk: {
    labelZh: '🪐 赛博朋克',
    labelEn: 'Cyberpunk',
    prompt: 'neon cyberpunk atmosphere, futuristic cityscape, raw holographic glows, rainy streets reflection, high-tech style'
  },
  realistic: {
    labelZh: '📷 纪实写实',
    labelEn: 'Realistic Photo',
    prompt: 'cinematic photorealistic capture, detailed textures, natural lighting, documentary realism, crisp focus, 8k resolution'
  },
  anime: {
    labelZh: '⛩️ 次元动漫',
    labelEn: 'Anime Style',
    prompt: 'vibrant Japanese anime illustration style, clean lineart, rich color grading, soft cel shading, detailed aesthetic'
  }
};

const RATIO_PRESETS = [
  { value: '1:1', labelZh: '正方形 (1:1)', labelEn: 'Square (1:1)' },
  { value: '4:3', labelZh: '经典比例 (4:3)', labelEn: 'Classic (4:3)' },
  { value: '16:9', labelZh: '宽屏横画 (16:9)', labelEn: 'Widescreen (16:9)' },
  { value: '3:4', labelZh: '图书竖版 (3:4)', labelEn: 'Portrait (3:4)' },
  { value: '9:16', labelZh: '手机竖式 (9:16)', labelEn: 'Full Portrait (9:16)' }
];

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

  // Image Generation Modal States
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState('line_art');
  const [selectedRatio, setSelectedRatio] = useState('16:9');
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);

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
    <div className="flex flex-col h-full bg-zinc-50 dark:bg-zinc-950/20 overflow-hidden relative">
      {/* AI Quick Actions Row rendered at the very top as a header */}
      <div className="p-3 border-b border-zinc-200/80 dark:border-zinc-800 bg-white/70 dark:bg-zinc-900/60 backdrop-blur-md shrink-0 select-none">
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
          {onGenerateContent && (
            <button
              onClick={onGenerateContent}
              disabled={isGeneratingContent || isLoading}
              className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-emerald-500/5 hover:bg-emerald-500/10 active:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-lg text-[10px] font-bold transition-all border border-emerald-500/15 whitespace-nowrap disabled:opacity-50"
            >
              {isGeneratingContent ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {language === 'zh' ? '生成初稿' : 'Draft'}
            </button>
          )}
          {onProofreadText && (
            <button
              onClick={onProofreadText}
              disabled={isProofreading || isLoading || !content}
              className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-sky-500/5 hover:bg-sky-500/10 active:bg-sky-500/15 text-sky-600 dark:text-sky-400 rounded-lg text-[10px] font-bold transition-all border border-sky-500/15 whitespace-nowrap disabled:opacity-50"
            >
              {isProofreading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
              {language === 'zh' ? '润色文本' : 'Proofread'}
            </button>
          )}
          {onGenerateImageOfPrompt && onAddImageToLayout && (
            <button
              onClick={() => {
                setImagePrompt('');
                setSelectedStyle('line_art');
                setSelectedRatio('16:9');
                setIsImageModalOpen(true);
              }}
              className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-purple-500/5 hover:bg-purple-500/10 active:bg-purple-500/15 text-purple-600 dark:text-purple-400 rounded-lg text-[10px] font-bold transition-all border border-purple-500/15 whitespace-nowrap disabled:opacity-50"
            >
              <ImageIcon className="w-3 h-3 text-purple-500" />
              {language === 'zh' ? '生成配图' : 'Illustrate'}
            </button>
          )}
        </div>
      </div>

      {/* Main chat message center */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full max-w-sm mx-auto text-center px-4 py-8 select-none">
            <div className="w-12 h-12 rounded-full bg-emerald-500/5 dark:bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 mb-4 shadow-sm animate-pulse">
              <Sparkles className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />
            </div>
            <h4 className="font-semibold text-xs text-zinc-750 dark:text-zinc-200 uppercase tracking-wide">
              {language === 'zh' ? '书籍 AI 协助中心' : 'Book AI Workspace'}
            </h4>
            <p className="mt-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 leading-relaxed">
              {language === 'zh' 
                ? '作为您的全能书籍排版伙伴，我可以根据大纲生成初稿、高精度校对美化，或一键绘制插图插入虚拟排版画布中。' 
                : 'As your full-featured partner, I can compose drafts, proofread text, or generate and anchor beautiful illustrations directly.'}
            </p>
            
            {/* Quick Prompt Suggestions to get started */}
            <div className="w-full mt-6 space-y-2 text-left">
              <span className="text-[10px] font-bold text-zinc-400 dark:text-zinc-550 uppercase tracking-wider block mb-1">
                {language === 'zh' ? '您可以这样问我：' : 'SUGGESTED PROMPTS'}
              </span>
              {[
                { zh: '✍️ 为这一章续写一段富有诗意的结尾', en: '✍️ Compose a poetic ending' },
                { zh: '🪄 修饰段落，让叙事节奏更紧凑', en: '🪄 Refine paragraph flow tightly' },
                { zh: '🖌️ 推荐适合中国写意风格的排版调性', en: '🖌️ Traditional Chinese Ink guidelines' }
              ].map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => setInput(language === 'zh' ? item.zh.slice(3) : item.en.slice(3))}
                  className="w-full text-left p-2.5 rounded-lg border border-zinc-150 dark:border-zinc-800 bg-white dark:bg-zinc-900/55 hover:bg-zinc-100 dark:hover:bg-zinc-850 transition-all font-medium text-[11px] text-zinc-650 dark:text-zinc-300 hover:text-emerald-600 dark:hover:text-emerald-400 hover:border-emerald-500/25 shadow-2xs"
                >
                  {language === 'zh' ? item.zh : item.en}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col group ${msg.role === 'user' ? 'items-end' : 'items-start'} animate-fade-in`}>
            <div className="flex items-start gap-1.5 w-full">
              {msg.role === 'user' && (
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, messageId: msg.id })}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity ml-auto mt-2"
                  title={t('delete_message')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
              
              <div 
                className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                  msg.role === 'user' 
                    ? 'bg-emerald-500/5 dark:bg-emerald-500/10 border border-emerald-500/15 text-zinc-800 dark:text-zinc-150 rounded-tr-xs' 
                    : 'bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs text-zinc-800 dark:text-zinc-100 rounded-tl-xs'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-1 mb-1.5 text-[9px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest select-none">
                    <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse shrink-0" />
                    <span>{language === 'zh' ? 'AI 助手' : 'AI ASSISTANT'}</span>
                  </div>
                )}
                <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-pre:my-1 select-text">
                  <MarkdownRenderer>{msg.content}</MarkdownRenderer>
                </div>
              </div>

              {msg.role === 'assistant' && (
                <button
                  onClick={() => setDeleteConfirm({ isOpen: true, messageId: msg.id })}
                  className="opacity-0 group-hover:opacity-100 p-1 text-zinc-400 hover:text-red-500 transition-opacity mr-auto mt-2"
                  title={t('delete_message')}
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </div>
            
            {msg.updatedContent && (
              <div className="mt-2 w-full max-w-[88%] self-start">
                <button
                  onClick={() => onApplyContent(msg.updatedContent!)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-gradient-to-r from-emerald-500/5 to-teal-500/5 hover:from-emerald-500/10 hover:to-teal-500/10 text-emerald-700 dark:text-emerald-400 hover:text-emerald-600 rounded-xl text-xs font-semibold transition-all border border-emerald-500/20 hover:border-emerald-500/30 shadow-2xs group"
                >
                  <Check className="w-3.5 h-3.5 text-emerald-500 group-hover:scale-110 transition-transform" />
                  {language === 'zh' ? '一键应用修改到左侧编辑器' : 'Apply edits to workspace'}
                </button>
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start animate-pulse">
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl rounded-tl-xs p-3 shadow-2xs flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />
              <span className="text-[10px] text-zinc-450 font-medium">{language === 'zh' ? 'AI 正在构思中...' : 'Thinking...'}</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer message composer */}
      <div className="p-3 border-t border-zinc-200/80 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 backdrop-blur-sm flex items-center gap-2 shrink-0">
        <button
          onClick={() => setDeleteConfirm({ isOpen: true, isClearAll: true })}
          disabled={messages.length === 0}
          className="p-2.5 rounded-xl text-zinc-400 hover:text-red-500 hover:bg-red-500/10 dark:hover:bg-red-500/15 border border-zinc-200/60 dark:border-zinc-800 transition-all shrink-0 shadow-2xs disabled:opacity-30 disabled:hover:bg-transparent"
          title={t('clear_all_chats')}
          type="button"
        >
          <Trash2 className="w-4 h-4" />
        </button>

        <div className="flex-1 relative">
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
            className="w-full bg-white dark:bg-zinc-900 rounded-xl pl-3 pr-10 py-2.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/30 min-h-[40px] max-h-32 border border-zinc-200 dark:border-zinc-800 shadow-2xs"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 top-2.5 p-1 text-emerald-600 hover:text-emerald-500 dark:text-emerald-400 disabled:opacity-30 transition-colors"
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

      {/* Dynamic Image Generation Settings Modal */}
      {isImageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-205 dark:border-zinc-800 rounded-xl max-w-sm w-full shadow-2xl overflow-hidden flex flex-col text-left">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/45">
              <div className="flex items-center gap-2">
                <div className="p-1 px-1.5 bg-purple-100 dark:bg-purple-950 rounded text-purple-600 dark:text-purple-400">
                  <ImageIcon className="w-3.5 h-3.5" />
                </div>
                <h3 className="text-xs font-bold text-zinc-900 dark:text-zinc-150">
                  {language === 'zh' ? 'AI 智能插图工坊' : 'AI Illustration Studio'}
                </h3>
              </div>
              <button 
                onClick={() => setIsImageModalOpen(false)}
                className="p-1 rounded-md text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                type="button"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3 overflow-y-auto max-h-[70vh] text-xs">
              {/* Prompt box */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {language === 'zh' ? '画面核心主体与构图描述' : 'Subject & Composition Prompt'}
                </label>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  placeholder={language === 'zh' ? '例如：一个在月光下飞翔的小女孩，周围环绕着发光的蓝色云彩...' : 'e.g., A little girl flying under the golden moonlight, surrounded by vibrant particles...'}
                  className="w-full h-20 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-lg p-2.5 text-xs resize-none focus:outline-none focus:ring-2 focus:ring-purple-500/50 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400"
                />
              </div>

              {/* Style selector */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {language === 'zh' ? '选择艺术创作风格' : 'Select Artistic Style'}
                </label>
                <div className="grid grid-cols-2 gap-1.5">
                  {Object.entries(STYLE_PROMPTS).map(([key, item]) => {
                    const isSelected = selectedStyle === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedStyle(key)}
                        className={`p-2 rounded-lg border text-left transition-all ${
                          isSelected 
                            ? 'bg-purple-50/50 dark:bg-purple-950/20 border-purple-500/80 text-purple-700 dark:text-purple-400 font-semibold' 
                            : 'bg-zinc-50/30 dark:bg-zinc-950/10 border-zinc-150 dark:border-zinc-800 text-zinc-650 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        <div className="font-medium text-[10px]">
                          {language === 'zh' ? item.labelZh : item.labelEn}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Ratio selector */}
              <div className="space-y-1">
                <label className="block text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                  {language === 'zh' ? '画面构图画幅比例' : 'Composition Aspect Ratio'}
                </label>
                <div className="flex flex-wrap gap-1">
                  {RATIO_PRESETS.map((p) => {
                    const isSelected = selectedRatio === p.value;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => setSelectedRatio(p.value)}
                        className={`px-2 py-1 rounded text-[10px] border transition-colors ${
                          isSelected 
                            ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 font-semibold border-zinc-900 dark:border-zinc-100' 
                            : 'bg-zinc-50/30 dark:bg-zinc-950/10 border-zinc-150 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'
                        }`}
                      >
                        {language === 'zh' ? p.labelZh : p.labelEn}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/30">
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                disabled={isGeneratingImg}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-zinc-650 hover:text-zinc-800 dark:text-zinc-300 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors disabled:opacity-50"
              >
                {language === 'zh' ? '取消' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!imagePrompt.trim()) {
                    toast.error(language === 'zh' ? '请指定所需绘图的主题描述' : 'Please insert prompt details first');
                    return;
                  }

                  setIsGeneratingImg(true);
                  const toastId = toast.loading(language === 'zh' ? '正在连接 AI 渲染精美插图...' : 'Developing high-fidelity custom photo...');
                  
                  try {
                    // Combine prompt with high fidelity style signals for best image generation performance
                    const styleSnippet = STYLE_PROMPTS[selectedStyle]?.prompt || '';
                    const fullPromptText = `${imagePrompt}. ${styleSnippet}. Composition layout aspect ratio is ${selectedRatio}.`;
                    
                    const url = await onGenerateImageOfPrompt(fullPromptText);
                    if (url) {
                      onAddImageToLayout(url);
                      toast.dismiss(toastId);
                      toast.success(language === 'zh' ? '精美插图生成成功，已注入书本排版' : 'AI drawing added to book canvas layout!');
                      setIsImageModalOpen(false);
                    } else {
                      toast.dismiss(toastId);
                      toast.error(language === 'zh' ? '渲染引擎未能返回图像数据' : 'Failed to retrieve rendered image data');
                    }
                  } catch (err: any) {
                    toast.dismiss(toastId);
                    toast.error(err.message || 'Image generation failed');
                  } finally {
                    setIsGeneratingImg(false);
                  }
                }}
                disabled={isGeneratingImg || !imagePrompt.trim()}
                className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-750 text-white rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 shadow-md shadow-purple-500/10 hover:shadow-purple-500/20 disabled:opacity-50"
              >
                {isGeneratingImg ? <Loader2 className="w-3 animate-spin" /> : <Sparkles className="w-3" />}
                {language === 'zh' ? '开始生成并植入' : 'Generate & Embed'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
