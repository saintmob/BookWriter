import { useState, useEffect, useRef, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { db, Chapter, Book, FloatingImage } from '../lib/db';
import { generateChapterContent, generateImage, proofreadChapter, applyProofreadChanges, ProofreadFeedback, factCheckChapterContent, applyFactCheckCorrections, FactCheckReport } from '../lib/ai';
import { Loader2, Sparkles, Image as ImageIcon, Check, Trash2, Edit2, Eye, ListPlus, Download, FileText, Printer, ChevronDown, MessageSquare, BookOpen, Wand2, ChevronLeft, ChevronRight, ArrowLeft, PenLine, LayoutTemplate, Settings as SettingsIcon, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, ZoomIn, ZoomOut, Grid, Columns, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '../lib/utils';
import { MarkdownRenderer } from './MarkdownRenderer';
import { OutlineEditorModal } from './OutlineEditorModal';
import { BookInfoModal } from './BookInfoModal';
import { ConfirmModal } from './ConfirmModal';
import { SettingsModal } from './SettingsModal';
import { BookSamplePreview } from './BookSamplePreview';
import { TypesetLayoutEditor } from './TypesetLayoutEditor';
import { BookCoverEditor } from './BookCoverEditor';
import { DesignThemeEditor } from './DesignThemeEditor';
import { BookCatalogueEditor } from './BookCatalogueEditor';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

import { ChapterDirectoryView } from './ChapterDirectoryView';

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
    setIsOutlineSidebarOpen,
    isRightSidebarOpen,
    setIsRightSidebarOpen,
    workspaceMode,
    setWorkspaceMode,
    zoom,
    setZoom,
    showGuides,
    setShowGuides
  } = useStore();
  
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapter, setActiveChapterState] = useState<Chapter | null>(null);
  const [activeView, setActiveView] = useState<'chapter' | 'cover' | 'theme' | 'catalogue'>('chapter');
  
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isProofreading, setIsProofreading] = useState(false);
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);
  const [proofreadFeedback, setProofreadFeedback] = useState<ProofreadFeedback | null>(null);
  const [isProofreadModalOpen, setIsProofreadModalOpen] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [factCheckReport, setFactCheckReport] = useState<FactCheckReport | null>(null);
  const [isFactCheckModalOpen, setIsFactCheckModalOpen] = useState(false);
  const [isApplyingFactCheck, setIsApplyingFactCheck] = useState(false);
  
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

  // Real-time page number calculation based on actual content length
  const chapterPageMap = useMemo(() => {
    const pageMap: Record<string, number> = {};
    let pageCounter = 12; // Base page after Front Matter & Catalogue

    chapters.forEach((ch) => {
      pageMap[ch.id] = pageCounter;
      
      if (ch.level === 1) {
        // Parts/Volumes start a new main section (takes 2 pages)
        pageCounter += 2;
      } else {
        const charCount = ch.content?.length || 0;
        // Standard paper page typically has 500 characters
        const estPages = Math.max(1, Math.ceil(charCount / 500));
        pageCounter += estPages;
      }
    });
    return pageMap;
  }, [chapters]);

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
        language,
        book.designTheme,
        chapters.map(c => ({ title: c.title, description: c.description, level: c.level || 2 }))
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
      let prompt = `Illustration for chapter "${activeChapter.title}" of book "${book?.title}". The chapter is about: ${content.substring(0, 500)}...`;
      if (book?.designTheme?.illustrationStyle) {
        prompt += `. Conforming strictly to artistic style: ${book.designTheme.illustrationStyle}`;
      }
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
      let prompt = promptText;
      if (book?.designTheme?.illustrationStyle && !promptText.includes(book.designTheme.illustrationStyle)) {
        prompt = `${promptText}. Style instructions: ${book.designTheme.illustrationStyle}`;
      }
      const imageUrl = await generateImage(prompt);
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

  const handleFactCheck = async () => {
    if (!activeChapter || !content) return;
    setIsFactChecking(true);
    setFactCheckReport(null);
    setIsFactCheckModalOpen(true);
    try {
      const report = await factCheckChapterContent(content, activeChapter.title, book?.title || '', language);
      setFactCheckReport(report);
    } catch (error: any) {
      console.error('Failed to run fact check', error);
      toast.error(error.message || 'Fact checking failed. Please try again.');
      setIsFactCheckModalOpen(false);
    } finally {
      setIsFactChecking(false);
    }
  };

  const handleApplyFactCheckCorrections = async () => {
    if (!activeChapter || !content || !factCheckReport) return;
    setIsApplyingFactCheck(true);
    try {
      const newContent = await applyFactCheckCorrections(content, factCheckReport, activeChapter.title, language);
      setContent(newContent);
      
      // Auto save
      const updatedChapter = { ...activeChapter, content: newContent, updatedAt: Date.now() };
      await db.saveChapter(updatedChapter);
      setChapters(chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c));
      setActiveChapterState(updatedChapter);
      
      setIsFactCheckModalOpen(false);
      setFactCheckReport(null);
      toast.success(language === 'zh' ? '信息事实核对完成，已全量更新并校准至草稿文本中！' : 'Fact-check adjustments corrected successfully!');
    } catch (error: any) {
      console.error('Failed to apply factcheck corrections', error);
      toast.error(error.message || 'Correction application failed.');
    } finally {
      setIsApplyingFactCheck(false);
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
    setIsSamplePreviewOpen(true);
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
    <div className="flex-1 flex flex-col h-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* GLOBAL APPLICATION TOP BAR */}
      <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-4 z-20 shrink-0 select-none shadow-sm w-full">
        {/* LEFT COMPONENT */}
        <div className="flex items-center gap-2 shrink-0 min-w-[200px]">
          {/* Back to library */}
          <button 
            onClick={() => setActiveBook(null)}
            className="flex items-center gap-1.5 text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors px-2 py-1.5 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title={language === 'zh' ? '返回书库' : 'Back to Library'}
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">{t('my_books')}</span>
          </button>
          
          <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block"></div>

          {/* Left panel toggle */}
          <button
            onClick={() => setIsOutlineSidebarOpen(!isOutlineSidebarOpen)}
            type="button"
            className={cn(
              "p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shrink-0",
              isOutlineSidebarOpen ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
            )}
            title={isOutlineSidebarOpen ? (language === 'zh' ? '折叠章节大纲' : 'Collapse chapters outline') : (language === 'zh' ? '展开章节大纲' : 'Expand chapters outline')}
          >
            {isOutlineSidebarOpen ? <PanelLeftClose className="w-4 h-4 text-emerald-500" /> : <PanelLeftOpen className="w-4 h-4 text-amber-500" />}
          </button>

          {/* Title breadcrumb */}
          <button 
            onClick={() => setIsBookInfoOpen(true)}
            className="flex items-center gap-1.5 px-2 py-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-850 dark:hover:bg-zinc-800 rounded-md text-xs font-serif font-semibold text-zinc-800 dark:text-zinc-200 select-none max-w-[150px] transition-colors"
            title={language === 'zh' ? '编辑书籍信息' : 'Edit Book Info'}
          >
            <LayoutTemplate className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
            <span className="truncate">{book.title}</span>
          </button>
        </div>

        {/* MIDDLE COMPONENT */}
        <div className="flex items-center justify-center gap-3 shrink-0">
          {/* Zoom controls */}
          {(workspaceMode === 'split' || workspaceMode === 'dtp') && (
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-850 rounded-lg p-0.5 text-xs hidden sm:flex animate-fade-in">
              <button 
                onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}
                className="p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                title={language === 'zh' ? '缩小' : 'Zoom Out'}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="w-9 text-center font-semibold text-zinc-600 dark:text-zinc-300 font-mono text-[10px]">
                {Math.round(zoom * 100)}%
              </span>
              <button 
                onClick={() => setZoom(z => Math.min(2.0, z + 0.1))}
                className="p-1 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded transition-colors"
                title={language === 'zh' ? '放大' : 'Zoom In'}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {(workspaceMode === 'split' || workspaceMode === 'dtp') && (
            <div className="h-4 w-px bg-zinc-200 dark:bg-zinc-800 hidden md:block"></div>
          )}

          {/* View Modes */}
          <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-lg p-1 text-xs shrink-0 font-medium">
            <button
              onClick={() => setWorkspaceMode('story')}
              className={cn(
                "px-3 py-1 rounded-md transition-all duration-150 flex items-center gap-1.5",
                workspaceMode === 'story'
                  ? "bg-white dark:bg-zinc-700 text-zinc-950 dark:text-zinc-50 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-805 dark:hover:text-zinc-300"
              )}
              title={language === 'zh' ? '文本模式' : 'Text Mode'}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{language === 'zh' ? '文本模式' : 'Text'}</span>
            </button>
            <button
              onClick={() => setWorkspaceMode('split')}
              className={cn(
                "px-3 py-1 rounded-md transition-all duration-150 flex items-center gap-1.5",
                workspaceMode === 'split'
                  ? "bg-white dark:bg-zinc-700 text-zinc-950 dark:text-zinc-50 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-805 dark:hover:text-zinc-300"
              )}
              title={language === 'zh' ? '双栏编辑与预览' : 'Split Workspace'}
            >
              <Columns className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{language === 'zh' ? '双栏模式' : 'Split'}</span>
            </button>
            <button
              onClick={() => setWorkspaceMode('dtp')}
              className={cn(
                "px-3 py-1 rounded-md transition-all duration-150 flex items-center gap-1.5",
                workspaceMode === 'dtp'
                  ? "bg-white dark:bg-zinc-700 text-zinc-950 dark:text-zinc-50 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-805 dark:hover:text-zinc-300"
              )}
              title={language === 'zh' ? '排版预览' : 'Layout Preview'}
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{language === 'zh' ? '排版模式' : 'Layout'}</span>
            </button>
            <button
              onClick={() => setIsSamplePreviewOpen(true)}
              className={cn(
                "px-3 py-1 rounded-md transition-all duration-150 flex items-center gap-1.5",
                isSamplePreviewOpen
                  ? "bg-white dark:bg-zinc-700 text-zinc-950 dark:text-zinc-50 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-805 dark:hover:text-zinc-300"
              )}
              title={language === 'zh' ? '书籍样张预览' : 'Sample Book Preview'}
            >
              <BookOpen className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
              <span className="hidden md:inline">{language === 'zh' ? '样张预览' : 'Sample'}</span>
            </button>
          </div>
        </div>

        {/* RIGHT COMPONENT */}
        <div className="flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={() => setIsRightSidebarOpen(!isRightSidebarOpen)}
            className={cn(
              "p-1.5 rounded-md text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors shrink-0",
              isRightSidebarOpen ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200" : "hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
            )}
            title={isRightSidebarOpen ? (language === 'zh' ? '折叠右侧面板' : 'Collapse right panel') : (language === 'zh' ? '展开右侧面板' : 'Expand right panel')}
          >
            {isRightSidebarOpen ? <PanelRightClose className="w-4 h-4 text-emerald-500" /> : <PanelRightOpen className="w-4 h-4 text-amber-500" />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Print Container (Hidden by default, visible in print) */}
        <div id="print-container" className="hidden">
          <h1 className="text-4xl font-extrabold mb-6 text-center select-all">{book.title}</h1>
          <p className="text-gray-605 text-lg mb-12 text-center italic">{book.summary}</p>
          {chapters.map((chapter, index) => {
            const level = chapter.level || 2;
            const isPart = level === 1;
            const isChapter = level === 2;
            const isSection = level === 3;
            
            return (
              <div key={chapter.id} className={cn(
                "mb-8 break-inside-avoid select-all",
                isPart ? "page-break-before mt-16 text-center border-b pb-8" : ""
              )}>
                {isPart ? (
                  <h2 className="text-3xl font-serif font-bold text-emerald-800 dark:text-emerald-450 mb-3">{chapter.title}</h2>
                ) : isChapter ? (
                  <h3 className="text-2xl font-serif font-semibold text-zinc-900 mb-3 mt-6">{chapter.title}</h3>
                ) : (
                  <h4 className="text-xl font-sans font-medium text-zinc-700 mb-2 mt-4">{chapter.title}</h4>
                )}
                
                {chapter.description && (
                  <p className="text-xs text-gray-400 mb-4 italic font-sans">{chapter.description}</p>
                )}
                
                {chapter.image && !isPart && (
                  <img src={chapter.image} alt={chapter.title} className="w-full max-w-xl mx-auto mb-4 rounded-lg shadow-sm" />
                )}
                
                <div className="prose max-w-none font-serif leading-relaxed text-gray-800">
                  <MarkdownRenderer>{chapter.content || ''}</MarkdownRenderer>
                </div>
                {!isPart && <hr className="my-8 border-gray-200" />}
              </div>
            );
          })}
        </div>

      {/* Outline Sidebar - Floating drawer on mobile/tablet for perfect viewport adaptation */}
      <div className={cn(
        "transition-all duration-300 ease-in-out border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 flex flex-col print:hidden overflow-hidden shrink-0 h-full max-md:absolute max-md:z-40 max-md:shadow-2xl",
        isOutlineSidebarOpen ? "w-72 left-0" : "w-0 max-md:-left-72 border-r-0 shadow-none opacity-0 pointer-events-none"
      )}>
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {/* Cover & Theme Entrance */}
          <div className="px-1 mb-4 select-none flex flex-col gap-2">
            <button
              onClick={() => setActiveView('theme')}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm border",
                activeView === 'theme'
                  ? "bg-indigo-600 border-indigo-500 text-white font-semibold"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              )}
            >
              <Sparkles className={cn("w-4 h-4", activeView === 'theme' ? "text-white" : "text-indigo-500 animate-pulse")} />
              <div className="flex-1 text-left">
                <span className="block text-xs uppercase tracking-wider opacity-60 text-[9px] font-semibold">{language === 'zh' ? '核心架构' : 'CORE CONCEPT'}</span>
                <span className="block -mt-1 font-semibold">{language === 'zh' ? '书籍原则' : 'Book Principles'}</span>
              </div>
            </button>

            <button
              onClick={() => setActiveView('cover')}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm border",
                activeView === 'cover'
                  ? "bg-purple-600 border-purple-500 text-white font-semibold"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              )}
            >
              <ImageIcon className={cn("w-4 h-4", activeView === 'cover' ? "text-white" : "text-purple-500")} />
              <div className="flex-1 text-left">
                <span className="block text-xs uppercase tracking-wider opacity-60 text-[9px] font-semibold">{language === 'zh' ? '设计' : 'DESIGN'}</span>
                <span className="block -mt-1 font-semibold">{language === 'zh' ? '封面设计' : 'Cover Design'}</span>
              </div>
            </button>

            <button
              onClick={() => setActiveView('catalogue')}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-all shadow-sm border",
                activeView === 'catalogue'
                  ? "bg-emerald-600 border-emerald-500 text-white font-semibold"
                  : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800/50 border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
              )}
            >
              <LayoutTemplate className={cn("w-4 h-4", activeView === 'catalogue' ? "text-white" : "text-emerald-500")} />
              <div className="flex-1 text-left">
                <span className="block text-xs uppercase tracking-wider opacity-60 text-[9px] font-semibold">{language === 'zh' ? '结构' : 'STRUCTURE'}</span>
                <span className="block -mt-1 font-semibold">{language === 'zh' ? '目录设计' : 'Catalogue Design'}</span>
              </div>
            </button>
          </div>

          <div className="flex items-center justify-between px-2 mb-2 pt-2">
            <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <LayoutTemplate className="w-3.5 h-3.5" />
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
          {chapters.map((chapter) => {
            const level = chapter.level || 2;
            const isPart = level === 1;
            const isChapter = level === 2;
            const isSection = level === 3;
            
            return (
              <button
                key={chapter.id}
                onClick={() => {
                  setActiveView('chapter');
                  setActiveChapter(chapter.id);
                }}
                className={cn(
                  "w-full text-left transition-all flex items-center rounded-lg select-none gap-1",
                  isPart 
                    ? "px-3 py-2 bg-gradient-to-r from-emerald-500/5 to-transparent text-emerald-900 dark:text-emerald-300 font-serif font-bold text-[11px] mt-4 mb-1.5 tracking-wide uppercase border-l-2 border-emerald-500 pr-3"
                    : isChapter
                      ? "px-3 py-1.5 pl-6 pr-3 text-zinc-800 dark:text-zinc-200 font-sans font-semibold text-xs mt-1"
                      : "px-3 py-1 pl-10 pr-3 text-zinc-500 dark:text-zinc-400 font-sans text-[11px]",
                  activeView === 'chapter' && activeChapterId === chapter.id
                    ? isPart
                      ? "bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-300 border-l-[3px] border-emerald-600"
                      : "bg-emerald-100/60 text-emerald-950 dark:bg-emerald-900/15 dark:text-emerald-300 font-medium"
                    : "hover:bg-zinc-100/50 dark:hover:bg-zinc-800/30"
                )}
              >
                {!isPart && (
                  <span className="w-3 text-left text-[10px] opacity-40 font-mono -ml-0.5 shrink-0">
                    {level === 2 ? '章' : '•'}
                  </span>
                )}
                <span className="truncate font-serif text-left max-w-[150px] shrink-0">{chapter.title}</span>
                <span className="flex-1 border-b border-dotted border-zinc-300/60 dark:border-zinc-700/60 mx-1 mb-1 opacity-70" />
                <span className="text-[10px] font-mono opacity-50 shrink-0 select-none mr-1">({chapterPageMap[chapter.id]})</span>
                {chapter.content && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
              </button>
            );
          })}
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
        {activeView === 'cover' && book ? (
          <BookCoverEditor 
            book={book}
            onUpdateBook={setBook}
            onGenerateImageOfPrompt={handleGenerateImageOfPrompt}
            language={language}
          />
        ) : activeView === 'theme' && book ? (
          <DesignThemeEditor
            book={book}
            onUpdateBook={setBook}
            language={language}
          />
        ) : activeView === 'catalogue' && book ? (
          <BookCatalogueEditor
            book={book}
            chapters={chapters}
            language={language}
            onUpdateBook={setBook}
          />
        ) : activeChapter && book ? (
          (activeChapter.level || 2) < 3 ? (
            <ChapterDirectoryView chapter={activeChapter} />
          ) : (
          <TypesetLayoutEditor 
            key={activeChapter.id}
            chapter={activeChapter}
            book={book}
            content={content}
            onContentChange={setContent}
            onUpdateChapter={(updated) => {
              setChapters(chapters.map(c => c.id === updated.id ? updated : c));
              setActiveChapterState(updated);
            }}
            onUpdateBook={setBook}
            isGeneratingContent={isGeneratingContent}
            isGeneratingImage={isGeneratingImage}
            isProofreading={isProofreading}
            onGenerateContent={handleGenerateContent}
            onGenerateImageOfPrompt={handleGenerateImageOfPrompt}
            onProofreadText={handleProofread}
            onFactCheck={handleFactCheck}
            isFactChecking={isFactChecking}
            bookTitle={book.title}
            language={language}
          />
          )
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-650 bg-zinc-50 dark:bg-zinc-950">
            <div className="text-center space-y-3 font-serif">
              <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mx-auto animate-pulse" />
              <p className="text-sm font-medium">{t('select_chapter_hint')}</p>
            </div>
          </div>
        )}
      </div>
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

      {/* Fact-Check Information Verification Dialog Modal */}
      {isFactCheckModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800 text-left animate-scale-up">
            
            <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/45 select-none">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-base font-bold font-serif text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                    {language === 'zh' ? '信息事实核对与常识校对' : 'Fact Check & Verification'}
                  </h2>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">{activeChapter?.title}</p>
                </div>
              </div>
              <button 
                onClick={() => setIsFactCheckModalOpen(false)}
                className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-300 transition-colors p-2"
                disabled={isApplyingFactCheck || isFactChecking}
              >
                {t('close')}
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {isFactChecking ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
                    <span className="absolute inset-0 flex items-center justify-center text-[10px]">🔍</span>
                  </div>
                  <p className="text-xs text-zinc-500 dark:text-zinc-450 font-medium animate-pulse">
                    {language === 'zh' ? '正在逐一校对文内年代、人物、公式与逻辑链（将联网搜索核实）...' : 'Running historical, scientific & logic checks (grounded on web search)...'}
                  </p>
                </div>
              ) : factCheckReport ? (
                <>
                  <div className="bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-500/15 p-4 rounded-xl leading-relaxed text-xs text-emerald-850 dark:text-emerald-300 font-serif">
                    <span className="font-semibold block mb-1 text-emerald-900 dark:text-emerald-250">
                      {language === 'zh' ? '💡 事实核对审计官总批：' : 'Fact-Check Executive Verdict:'}
                    </span>
                    {factCheckReport.overallVerdict}
                  </div>

                  <div>
                    <h3 className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest mb-3 select-none">
                      {language === 'zh' ? '🔍 展开细节校核报告' : 'Factual Claims Verified'}
                    </h3>
                    <ul className="space-y-3">
                      {factCheckReport.items && factCheckReport.items.map((item, index) => {
                        const isVerified = item.status === 'verified';
                        const isWarning = item.status === 'warning';
                        
                        return (
                          <li key={index} className="border border-zinc-150 dark:border-zinc-800 p-4 rounded-xl shadow-xs bg-zinc-50/30 dark:bg-zinc-950/30">
                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className={cn(
                                "px-2.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide flex items-center gap-1",
                                isVerified 
                                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/10" 
                                  : isWarning 
                                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/10" 
                                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/10"
                              )}>
                                {isVerified ? '✓ Verified / 事实吻合' : isWarning ? '⚠ Warn / 需要指正' : '● Safe / 常识合理'}
                              </span>
                              
                              <p className="font-semibold text-xs font-serif text-zinc-850 dark:text-zinc-250">
                                {item.claim}
                              </p>
                            </div>
                            
                            <p className="text-xs text-zinc-600 dark:text-zinc-400 leading-relaxed font-sans mt-1.5 pl-1 pl-1">
                              {item.verdict}
                            </p>

                            {item.sourceSuggestion && (
                              <div className="mt-3 bg-white dark:bg-zinc-900 p-2.5 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-500 dark:text-zinc-400 font-mono flex items-start gap-1">
                                <span className="text-emerald-500 font-bold shrink-0">💡 {language === 'zh' ? '推荐修订：' : 'Suggested revision:'}</span>
                                <span className="italic">{item.sourceSuggestion}</span>
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="py-12 text-center text-zinc-400">
                  <ShieldAlert className="w-12 h-12 text-zinc-350 mx-auto mb-2 animate-pulse" />
                  <p>{language === 'zh' ? '暂无校对报告数据' : 'No audit reports generated'}</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 flex justify-end gap-3 select-none">
              <button
                onClick={() => setIsFactCheckModalOpen(false)}
                className="px-5 py-2.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900 dark:hover:text-zinc-200 transition-colors"
                disabled={isApplyingFactCheck || isFactChecking}
              >
                {language === 'zh' ? '保持原样' : 'Keep As Is'}
              </button>
              
              <button
                onClick={handleApplyFactCheckCorrections}
                disabled={isApplyingFactCheck || isFactChecking || !factCheckReport || !factCheckReport.items?.some(i => i.status === 'warning')}
                className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-40 disabled:hover:bg-emerald-600 shadow-md shadow-emerald-500/10 hover:shadow-emerald-500/20"
              >
                {isApplyingFactCheck ? (
                  <>
                    <Loader2 className="w-3 animate-spin" />
                    {language === 'zh' ? '正在智能改写中...' : 'Applying corrections...'}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5" />
                    {language === 'zh' ? '一键修正并融入草稿' : 'One-click Correct Checked Claims'}
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
