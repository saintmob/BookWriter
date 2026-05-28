import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { db, Chapter, Book } from '../lib/db';
import { generateChapterContent, generateImage, proofreadChapter, applyProofreadChanges, ProofreadFeedback } from '../lib/ai';
import { Loader2, Sparkles, Image as ImageIcon, Check, Trash2, Edit2, Eye, ListPlus, Download, FileText, Printer, ChevronDown, MessageSquare, BookOpen, Wand2 } from 'lucide-react';
import { cn } from '../lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { OutlineEditorModal } from './OutlineEditorModal';
import { ChapterChat } from './ChapterChat';
import { BookInfoModal } from './BookInfoModal';
import { ConfirmModal } from './ConfirmModal';
import { BookSamplePreview } from './BookSamplePreview';
import { toast } from 'sonner';

export function BookEditor() {
  const { t } = useTranslation();
  const { activeBookId, activeChapterId, setActiveChapter, deleteBook, language } = useStore();
  
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapter, setActiveChapterState] = useState<Chapter | null>(null);
  
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isProofreading, setIsProofreading] = useState(false);
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const [proofreadFeedback, setProofreadFeedback] = useState<ProofreadFeedback | null>(null);
  const [isProofreadModalOpen, setIsProofreadModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [content, setContent] = useState('');
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [isOutlineEditorOpen, setIsOutlineEditorOpen] = useState(false);
  const [isBookInfoOpen, setIsBookInfoOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSamplePreviewOpen, setIsSamplePreviewOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const aiMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
      }
      if (aiMenuRef.current && !aiMenuRef.current.contains(event.target as Node)) {
        setShowAIMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (activeBookId) {
      loadBookData();
    }
  }, [activeBookId]);

  useEffect(() => {
    if (activeChapterId && chapters.length > 0) {
      const chapter = chapters.find(c => c.id === activeChapterId) || null;
      setActiveChapterState(chapter);
      setContent(chapter?.content || '');
    } else {
      setActiveChapterState(null);
      setContent('');
    }
  }, [activeChapterId, chapters]);

  useEffect(() => {
    if (viewMode === 'edit' && textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [content, viewMode, activeChapterId]);

  const loadBookData = async () => {
    if (!activeBookId) return;
    const b = await db.getBook(activeBookId);
    if (b) setBook(b);
    
    const c = await db.getChapters(activeBookId);
    setChapters(c);
    
    if (c.length > 0 && !activeChapterId) {
      setActiveChapter(c[0].id);
    }
  };

  const handleOutlineSave = async (newChapters: Chapter[]) => {
    if (!book) return;
    
    // Save all new chapters to DB
    // We need to handle deletions too: find chapters in DB that are NOT in newChapters
    const existingIds = chapters.map(c => c.id);
    const newIds = newChapters.map(c => c.id);
    const idsToDelete = existingIds.filter(id => !newIds.includes(id));

    for (const id of idsToDelete) {
      await db.deleteChapter(id);
    }

    for (const chapter of newChapters) {
      await db.saveChapter(chapter);
    }

    await loadBookData(); // Reload to refresh state
    
    // If active chapter was deleted, switch to the first one
    if (activeChapter && !newIds.includes(activeChapter.id)) {
      if (newChapters.length > 0) {
        setActiveChapter(newChapters[0].id);
      } else {
        setActiveChapter(null);
      }
    }
  };

  // Auto-save effect
  useEffect(() => {
    if (!activeChapter || !content || content === activeChapter.content) return;

    const timer = setTimeout(async () => {
      try {
        const updatedChapter = { ...activeChapter, content, updatedAt: Date.now() };
        await db.saveChapter(updatedChapter);
        // Only update local state if we're still on the same chapter
        if (activeChapter.id === updatedChapter.id) {
          setChapters(prev => prev.map(c => c.id === updatedChapter.id ? updatedChapter : c));
          setActiveChapterState(updatedChapter);
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 2000);
        }
      } catch (error) {
        console.error('Auto-save failed', error);
      }
    }, 2000); // Debounce for 2 seconds

    return () => clearTimeout(timer);
  }, [content, activeChapter]);

  const handleGenerateContent = async () => {
    if (!book || !activeChapter) return;
    setIsGeneratingContent(true);
    try {
      const prevChapter = chapters.find(c => c.order === activeChapter.order - 1);
      const newContent = await generateChapterContent(
        book.title,
        book.summary,
        activeChapter.title,
        activeChapter.description,
        prevChapter?.content || null,
        language
      );
      setContent(newContent);
      
      // Auto save
      const updatedChapter = { ...activeChapter, content: newContent, updatedAt: Date.now() };
      await db.saveChapter(updatedChapter);
      setChapters(chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c));
      setActiveChapterState(updatedChapter);
    } catch (error: any) {
      console.error('Failed to generate content', error);
      toast.error(error.message || t('generate_content_error') || 'Failed to generate content');
    } finally {
      setIsGeneratingContent(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!activeChapter) return;
    setIsGeneratingImage(true);
    try {
      const prompt = `Illustration for chapter "${activeChapter.title}" of book "${book?.title}". The chapter is about: ${content.substring(0, 500)}...`;
      const imageUrl = await generateImage(prompt);
      
      if (imageUrl) {
        const updatedChapter = { ...activeChapter, image: imageUrl, updatedAt: Date.now() };
        await db.saveChapter(updatedChapter);
        setChapters(chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c));
        setActiveChapterState(updatedChapter);
        toast.success(t('image_generated_success'));
      }
    } catch (error: any) {
      console.error('Failed to generate image', error);
      toast.error(error.message || t('generate_image_error') || 'Failed to generate image');
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleProofread = async () => {
    if (!activeChapter || !content) return;
    setIsProofreading(true);
    setProofreadFeedback(null);
    setIsProofreadModalOpen(true);
    try {
      const feedback = await proofreadChapter(content, activeChapter.title, language);
      setProofreadFeedback(feedback);
    } catch (error: any) {
      console.error('Failed to proofread', error);
      toast.error(error.message || t('chat_error') || 'Failed to proofread');
      setIsProofreadModalOpen(false);
    } finally {
      setIsProofreading(false);
    }
  };

  const handleApplyProofreadChanges = async () => {
    if (!activeChapter || !content || !proofreadFeedback) return;
    setIsApplyingChanges(true);
    try {
      const newContent = await applyProofreadChanges(content, proofreadFeedback, activeChapter.title, language);
      setContent(newContent);
      
      // Auto save
      const updatedChapter = { ...activeChapter, content: newContent, updatedAt: Date.now() };
      await db.saveChapter(updatedChapter);
      setChapters(chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c));
      setActiveChapterState(updatedChapter);
      
      setIsProofreadModalOpen(false);
      setProofreadFeedback(null);
      toast.success(t('saved'));
    } catch (error: any) {
      console.error('Failed to apply changes', error);
      toast.error(error.message || t('chat_error') || 'Failed to apply changes');
    } finally {
      setIsApplyingChanges(false);
    }
  };

  const handleExportMarkdown = () => {
    if (!book) return;
    
    let markdownContent = `# ${book.title}\n\n${book.summary}\n\n`;
    
    chapters.forEach((chapter, index) => {
      markdownContent += `## Chapter ${index + 1}: ${chapter.title}\n\n`;
      if (chapter.description) {
        markdownContent += `*${chapter.description}*\n\n`;
      }
      markdownContent += `${chapter.content || ''}\n\n---\n\n`;
    });

    const blob = new Blob([markdownContent], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title.replace(/\s+/g, '_')}.md`;
    document.body.appendChild(a);
    a.click();
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    window.print();
    setShowExportMenu(false);
  };

  const handleExportJSON = async () => {
    if (!book) return;
    
    // Fetch chat messages for all chapters
    const allChatMessages = [];
    for (const chapter of chapters) {
      const messages = await db.getChatMessages(chapter.id);
      allChatMessages.push(...messages);
    }
    
    const data = {
      book,
      chapters,
      chatMessages: allChatMessages,
      version: '1.0',
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${book.title.replace(/\s+/g, '_')}_backup.json`;
    document.body.appendChild(a);
    a.click();
    if (a.parentNode) a.parentNode.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  if (!book) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="flex-1 flex h-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Print Container (Hidden by default, visible in print) */}
      <div id="print-container" className="hidden">
        <h1 className="text-3xl font-bold mb-4">{book.title}</h1>
        <p className="text-gray-600 mb-8 italic">{book.summary}</p>
        {chapters.map((chapter, index) => (
          <div key={chapter.id} className="mb-8 break-inside-avoid">
            <h2 className="text-2xl font-bold mb-4">Chapter {index + 1}: {chapter.title}</h2>
            {chapter.image && (
              <img src={chapter.image} alt={chapter.title} className="w-full max-w-2xl mx-auto mb-4 rounded-lg" />
            )}
            <div className="prose max-w-none">
              <MarkdownRenderer>{chapter.content || ''}</MarkdownRenderer>
            </div>
            <hr className="my-8 border-gray-200" />
          </div>
        ))}
      </div>

      {/* Outline Sidebar */}
      <div className="w-72 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col print:hidden">
        {/* ... (sidebar content) ... */}
        <div 
          className="p-4 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800/50 transition-colors group"
          onClick={() => setIsBookInfoOpen(true)}
        >
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-serif font-bold text-lg truncate flex-1" title={book.title}>{book.title}</h2>
            <Edit2 className="w-3 h-3 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{book.summary}</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="flex items-center justify-between px-2 mb-2">
            <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
              {t('chapters')}
            </div>
            <button 
              onClick={() => setIsOutlineEditorOpen(true)}
              className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors"
              title={t('edit_outline')}
            >
              <ListPlus className="w-4 h-4" />
            </button>
          </div>
          {chapters.map((chapter) => (
            <button
              key={chapter.id}
              onClick={() => setActiveChapter(chapter.id)}
              className={cn(
                "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2",
                activeChapterId === chapter.id
                  ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/30 dark:text-emerald-400 font-medium"
                  : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800/50"
              )}
            >
              <span className="w-5 text-center text-xs opacity-50">{chapter.order + 1}</span>
              <span className="truncate flex-1">{chapter.title}</span>
              {chapter.content && <Check className="w-3 h-3 text-emerald-500" />}
            </button>
          ))}
        </div>

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-between gap-2">
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors"
            title={t('delete_book')}
          >
            <Trash2 className="w-5 h-5" />
          </button>

          <div className="relative flex-1" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium transition-colors"
            >
              <Download className="w-4 h-4" />
              {t('export')}
              <ChevronDown className="w-3 h-3 opacity-50" />
            </button>

            {showExportMenu && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 py-1 z-50">
                <button
                  onClick={handleExportMarkdown}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {t('export_markdown')}
                </button>
                <button
                  onClick={handlePrint}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  {t('print_pdf')}
                </button>
                <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1"></div>
                <button
                  onClick={handleExportJSON}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  <Download className="w-4 h-4 text-emerald-500" />
                  {t('export_json')}
                </button>
                <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1"></div>
                <button
                  onClick={() => {
                    setIsSamplePreviewOpen(true);
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                >
                  <BookOpen className="w-4 h-4 text-purple-500" />
                  {t('generate_sample')}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col overflow-hidden relative print:hidden">
        {activeChapter ? (
          <>
            {/* Toolbar */}
            <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 grid grid-cols-3 items-center px-4 md:px-6 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm z-10">
              {/* Left: Chapter Title */}
              <div className="flex items-center min-w-0">
                <h3 className="font-serif font-semibold text-lg truncate" title={activeChapter.title}>
                  {activeChapter.title}
                </h3>
              </div>
              
              {/* Center: Edit/Preview/Typeset Toggle */}
              <div className="flex justify-center">
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1">
                  <button
                    onClick={() => setViewMode('edit')}
                    className={cn(
                      "px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                      viewMode === 'edit'
                        ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" 
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    )}
                  >
                    {t('edit')}
                  </button>
                  <button
                    onClick={() => setViewMode('preview')}
                    className={cn(
                      "px-4 py-1.5 text-sm font-medium rounded-md transition-all duration-200",
                      viewMode === 'preview'
                        ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" 
                        : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                    )}
                  >
                    {t('preview')}
                  </button>
                </div>
              </div>

              {/* Right: AI Tools & Chat */}
              <div className="flex items-center justify-end gap-3">
                {/* AI Tools Dropdown (Renamed to Generate) */}
                <div className="relative" ref={aiMenuRef}>
                  <button
                    onClick={() => setShowAIMenu(!showAIMenu)}
                    className="flex items-center gap-2 px-3 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 rounded-lg text-sm font-medium transition-colors whitespace-nowrap"
                    title={t('generate')}
                  >
                    <Sparkles className="w-4 h-4 text-emerald-500" />
                    <span className="hidden lg:inline">{t('generate')}</span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>

                  {showAIMenu && (
                    <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 z-50">
                      <button
                        onClick={() => {
                          handleGenerateContent();
                          setShowAIMenu(false);
                        }}
                        disabled={isGeneratingContent}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isGeneratingContent ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                        {t('generate_content')}
                      </button>
                      <button
                        onClick={() => {
                          handleGenerateImage();
                          setShowAIMenu(false);
                        }}
                        disabled={isGeneratingImage || !content}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                        {t('generate_image')}
                      </button>
                      <div className="h-px bg-zinc-100 dark:bg-zinc-700 my-1"></div>
                      <button
                        onClick={() => {
                          handleProofread();
                          setShowAIMenu(false);
                        }}
                        disabled={isProofreading || !content}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2 disabled:opacity-50"
                      >
                        {isProofreading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4 text-purple-500" />}
                        {t('ai_proofread')}
                      </button>
                    </div>
                  )}
                </div>

                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block"></div>

                <button
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 whitespace-nowrap shadow-sm",
                    isChatOpen 
                      ? "bg-emerald-700 text-white ring-2 ring-emerald-500 ring-offset-2 dark:ring-offset-zinc-950" 
                      : "bg-emerald-600 hover:bg-emerald-700 text-white"
                  )}
                  title={t('ai_assistant')}
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden lg:inline">{t('ai_chat')}</span>
                </button>
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 flex overflow-hidden relative">
              <div 
                className={cn("flex-1 overflow-y-auto p-8 md:p-12 lg:px-24", viewMode === 'edit' && "cursor-text")}
                onClick={(e) => {
                  if (e.target === e.currentTarget && viewMode === 'edit') {
                    textareaRef.current?.focus();
                    // Place cursor at the end
                    const length = textareaRef.current?.value.length || 0;
                    textareaRef.current?.setSelectionRange(length, length);
                  }
                }}
              >
                <div 
                  className={cn("max-w-3xl mx-auto space-y-8 pb-32", viewMode !== 'edit' && "cursor-default")}
                  onClick={(e) => {
                    if (e.target === e.currentTarget && viewMode === 'edit') {
                      textareaRef.current?.focus();
                      const length = textareaRef.current?.value.length || 0;
                      textareaRef.current?.setSelectionRange(length, length);
                    }
                  }}
                >
                  {/* Image Area with Loading State */}
                  {(activeChapter.image || isGeneratingImage) && (
                    <div className="relative group rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm bg-zinc-100 dark:bg-zinc-900 aspect-video">
                      {isGeneratingImage ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-50 dark:bg-zinc-900/50 animate-pulse">
                          <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                          <p className="text-sm font-medium text-zinc-500">{t('generating_image_placeholder')}</p>
                        </div>
                      ) : (
                        <>
                          <img src={activeChapter.image} alt={activeChapter.title} className="w-full h-auto object-cover aspect-video" referrerPolicy="no-referrer" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button 
                              onClick={handleGenerateImage}
                              className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                            >
                              <Sparkles className="w-4 h-4" /> {t('regenerate_image')}
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Content Area with Loading State */}
                  <div className="relative">
                    {viewMode === 'preview' ? (
                      <div className="prose prose-zinc dark:prose-invert max-w-none font-serif text-lg leading-relaxed">
                        {isGeneratingContent && !content ? (
                          <div className="space-y-4 animate-pulse">
                            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-3/4"></div>
                            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-full"></div>
                            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-5/6"></div>
                            <div className="h-4 bg-zinc-200 dark:bg-zinc-800 rounded w-2/3"></div>
                            <p className="text-sm text-emerald-500 font-medium mt-4">{t('generating_content_placeholder')}</p>
                          </div>
                        ) : (
                          <>
                            <MarkdownRenderer>{content || `*${t('no_content_yet')}*`}</MarkdownRenderer>
                            {isGeneratingContent && (
                              <div className="mt-6 flex items-center gap-2 text-emerald-500 font-medium animate-pulse">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>{t('generating_content_placeholder')}</span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="relative">
                        <textarea
                          ref={textareaRef}
                          value={content}
                          onChange={(e) => {
                            setContent(e.target.value);
                            e.target.style.height = 'auto';
                            e.target.style.height = `${e.target.scrollHeight}px`;
                          }}
                          placeholder={t('chapter_content_placeholder')}
                          className={cn(
                            "w-full min-h-[calc(100vh-300px)] bg-transparent border-none outline-none resize-none font-serif text-lg leading-relaxed text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 overflow-hidden",
                            isGeneratingContent && !content && "opacity-50"
                          )}
                          disabled={isGeneratingContent}
                        />
                        {isGeneratingContent && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/50 dark:bg-zinc-950/50 backdrop-blur-[1px] rounded-xl pointer-events-none">
                            <div className="flex flex-col items-center gap-3 p-6 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl border border-zinc-200 dark:border-zinc-800">
                              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                              <p className="text-sm font-bold text-zinc-700 dark:text-zinc-300">{t('generating_content_placeholder')}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {isChatOpen && (
                <ChapterChat
                  content={content}
                  chapterTitle={activeChapter.title}
                  bookTitle={book.title}
                  language={language}
                  onApplyContent={(newContent) => {
                    setContent(newContent);
                    // Trigger auto-save immediately
                    const updatedChapter = { ...activeChapter, content: newContent, updatedAt: Date.now() };
                    db.saveChapter(updatedChapter).then(() => {
                      setChapters(chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c));
                      setActiveChapterState(updatedChapter);
                      setSaveSuccess(true);
                      setTimeout(() => setSaveSuccess(false), 2000);
                    });
                  }}
                  onClose={() => setIsChatOpen(false)}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-600">
            {t('select_chapter_hint')}
          </div>
        )}
      </div>
      {book && (
        <OutlineEditorModal 
          isOpen={isOutlineEditorOpen} 
          onClose={() => setIsOutlineEditorOpen(false)} 
          bookId={book.id}
          initialChapters={chapters}
          onSave={handleOutlineSave}
        />
      )}
      {book && (
        <BookInfoModal
          isOpen={isBookInfoOpen}
          onClose={() => setIsBookInfoOpen(false)}
          book={book}
          onUpdate={(updatedBook) => setBook(updatedBook)}
        />
      )}
      {book && (
        <ConfirmModal
          isOpen={isDeleteModalOpen}
          onClose={() => setIsDeleteModalOpen(false)}
          onConfirm={() => deleteBook(book.id)}
          title={t('delete_book')}
          message={t('confirm_delete_book')}
          confirmLabel={t('delete')}
          isDanger
        />
      )}
      {book && (
        <BookSamplePreview
          isOpen={isSamplePreviewOpen}
          onClose={() => setIsSamplePreviewOpen(false)}
          book={book}
          chapters={chapters}
        />
      )}

      {/* Proofread Modal */}
      {isProofreadModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800">
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                  <Wand2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">{t('ai_proofread')}</h2>
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">{activeChapter?.title}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsProofreadModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors p-2"
                disabled={isApplyingChanges || isProofreading}
              >
                {t('close')}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {isProofreading ? (
                <div className="flex flex-col items-center justify-center py-16 space-y-4">
                  <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium animate-pulse">{t('proofreading')}</p>
                </div>
              ) : proofreadFeedback ? (
                <>
                  <div>
                    <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-zinc-400" />
                      {t('proofread_feedback')}
                    </h3>
                    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl p-4 text-zinc-700 dark:text-zinc-300 leading-relaxed text-sm border border-zinc-100 dark:border-zinc-800">
                      {proofreadFeedback.feedback}
                    </div>
                  </div>

                  {proofreadFeedback.suggestions && proofreadFeedback.suggestions.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <ListPlus className="w-4 h-4 text-zinc-400" />
                        {t('proofread_suggestions')}
                      </h3>
                      <ul className="space-y-2">
                        {proofreadFeedback.suggestions.map((suggestion, index) => (
                          <li key={index} className="flex gap-3 text-sm text-zinc-700 dark:text-zinc-300 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-3 rounded-lg shadow-sm">
                            <span className="text-purple-500 font-bold shrink-0">{index + 1}.</span>
                            <span>{suggestion}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              ) : null}
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3">
              <button
                onClick={() => setIsProofreadModalOpen(false)}
                className="px-5 py-2.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors"
                disabled={isApplyingChanges || isProofreading}
              >
                {t('ignore_changes')}
              </button>
              <button
                onClick={handleApplyProofreadChanges}
                disabled={isApplyingChanges || isProofreading || !proofreadFeedback}
                className="flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 shadow-sm"
              >
                {isApplyingChanges ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('applying_changes')}
                  </>
                ) : (
                  <>
                    <Check className="w-4 h-4" />
                    {t('accept_changes')}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
