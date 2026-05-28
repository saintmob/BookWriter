import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { db, Chapter, Book, FloatingImage } from '../lib/db';
import { generateChapterContent, generateImage, proofreadChapter, applyProofreadChanges, ProofreadFeedback } from '../lib/ai';
import { Loader2, Sparkles, Image as ImageIcon, Check, Trash2, Edit2, Eye, ListPlus, Download, FileText, Printer, ChevronDown, MessageSquare, BookOpen, Wand2, ChevronLeft, ChevronRight, ArrowLeft, PenLine, LayoutTemplate, Settings as SettingsIcon } from 'lucide-react';
import { cn } from '../lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { OutlineEditorModal } from './OutlineEditorModal';
import { BookInfoModal } from './BookInfoModal';
import { ConfirmModal } from './ConfirmModal';
import { SettingsModal } from './SettingsModal';
import { BookSamplePreview } from './BookSamplePreview';
import { TypesetLayoutEditor } from './TypesetLayoutEditor';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

export function BookEditor() {
  const { t } = useTranslation();
  const { 
    activeBookId, 
    activeChapterId, 
    setActiveChapter,
    setActiveBook,
    deleteBook, 
    language, 
    isOutlineSidebarOpen,
    setIsOutlineSidebarOpen
  } = useStore();
  
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
  const [isOutlineEditorOpen, setIsOutlineEditorOpen] = useState(false);
  const [isBookInfoOpen, setIsBookInfoOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isSamplePreviewOpen, setIsSamplePreviewOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showAIMenu, setShowAIMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const aiMenuRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Helper to synchronize chapter.image with floatingImages for perfect layout integration
  const addHeroImageToFloating = (chap: Chapter, url: string): Chapter => {
    const currentList = chap.floatingImages || [];
    const exists = currentList.some(img => img.url === url);
    if (exists || !url) return chap;
    
    const newFloatingImg: FloatingImage = {
      id: uuidv4(),
      url: url,
      x: 30,
      y: 30,
      width: 320,
      height: 240,
      opacity: 1,
      borderRadius: 12,
      shadow: 'md',
      objectFit: 'cover',
      blendMode: 'normal',
      layoutMode: 'wrap-center', // Default to beautiful centered wrapper flow
      paragraphIndex: 1, // Anchor near top but below the title text block
    };
    return {
      ...chap,
      floatingImages: [...currentList, newFloatingImg]
    };
  };

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
      if (chapter && chapter.image && (!chapter.floatingImages || !chapter.floatingImages.some(img => img.url === chapter.image))) {
        // Auto-synchronize cover illustration on discovered missing
        const synced = addHeroImageToFloating(chapter, chapter.image);
        db.saveChapter(synced).then(() => {
          setChapters(prev => prev.map(c => c.id === synced.id ? synced : c));
          setActiveChapterState(synced);
          setContent(synced.content || '');
        });
      } else {
        setActiveChapterState(chapter);
        setContent(chapter?.content || '');
      }
    } else {
      setActiveChapterState(null);
      setContent('');
    }
  }, [activeChapterId, chapters]);

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
        const baseUpdated = { ...activeChapter, image: imageUrl, updatedAt: Date.now() };
        const updatedChapter = addHeroImageToFloating(baseUpdated, imageUrl);
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

  const handleGenerateImageOfPrompt = async (promptText: string): Promise<string | null> => {
    try {
      const imageUrl = await generateImage(promptText);
      return imageUrl || null;
    } catch (error: any) {
      console.error('Failed to generate flow image', error);
      toast.error(error.message || 'Image generation failed');
      return null;
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
      <div className={cn(
        "transition-all duration-300 ease-in-out border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col print:hidden overflow-hidden shrink-0 h-full relative",
        isOutlineSidebarOpen ? "w-72" : "w-0 border-r-0 shadow-none opacity-0 pointer-events-none"
      )}>
        {/* ... (sidebar content) ... */}
        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          <button 
            onClick={() => setActiveBook(null)}
            className="flex items-center gap-2 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
          >
            <ArrowLeft className="w-4 h-4" />
            {t('my_books')}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsOutlineSidebarOpen(false);
            }}
            type="button"
            className="p-1.5 rounded hover:bg-zinc-200 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300 transition-colors"
            title={language === 'zh' ? '收起大纲栏' : 'Collapse chapters panel'}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        </div>

        <div 
          className="p-4 border-b border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800/20 transition-colors group relative"
          onClick={() => setIsBookInfoOpen(true)}
        >
          <div className="flex items-start justify-between gap-2">
            <h2 className="font-serif font-bold text-lg leading-tight line-clamp-2 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{book.title}</h2>
            <Edit2 className="w-4 h-4 text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
          </div>
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

        <div className="flex items-center justify-between p-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 dark:hover:text-zinc-200 rounded-lg transition-colors flex-1 flex justify-center"
            title={t('settings')}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsDeleteModalOpen(true)}
            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg transition-colors flex-1 flex justify-center"
            title={t('delete_book')}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="relative flex-1" ref={exportMenuRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="w-full flex items-center justify-center p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-zinc-400 dark:hover:text-zinc-200 rounded-lg transition-colors"
              title={t('export')}
            >
              <Download className="w-4 h-4" />
            </button>

            {showExportMenu && (
              <div className="absolute bottom-full right-0 mb-2 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-xl border border-zinc-200 dark:border-zinc-700 py-1 z-50">
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
        {!isOutlineSidebarOpen && (
          <button
            onClick={() => setIsOutlineSidebarOpen(true)}
            type="button"
            className="absolute left-0 top-1/2 -translate-y-1/2 w-5 h-12 bg-white dark:bg-zinc-900 border-y border-r border-zinc-200 dark:border-zinc-800 rounded-r-md shadow-md hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center z-40 group transition-all"
            title={language === 'zh' ? '展开章节大纲' : 'Expand chapters outline'}
          >
            <ChevronRight className="w-4 h-4 text-emerald-500 hover:text-emerald-700 dark:text-emerald-400" />
          </button>
        )}
        {activeChapter ? (
          <TypesetLayoutEditor 
            key={activeChapter.id}
            chapter={activeChapter}
            content={content}
            onContentChange={setContent}
            onUpdateChapter={(updated) => {
              setChapters(chapters.map(c => c.id === updated.id ? updated : c));
              setActiveChapterState(updated);
            }}
            isGeneratingContent={isGeneratingContent}
            isGeneratingImage={isGeneratingImage}
            isProofreading={isProofreading}
            onGenerateContent={handleGenerateContent}
            onGenerateImageOfPrompt={handleGenerateImageOfPrompt}
            onProofreadText={handleProofread}
            bookTitle={book.title}
            language={language}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-650 bg-zinc-50 dark:bg-zinc-950">
            <div className="text-center space-y-3 font-serif">
              <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto animate-pulse" />
              <p className="text-sm font-medium">{t('select_chapter_hint')}</p>
            </div>
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

      {isSettingsOpen && (
        <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      )}
    </div>
  );
}
