import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { db, Chapter, Book } from '../lib/db';
import { generateChapterContent, generateImage } from '../lib/ai';
import { Loader2, Sparkles, Image as ImageIcon, Check, Trash2, Edit2, Eye, ListPlus, Download, FileText, Printer, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { OutlineEditorModal } from './OutlineEditorModal';

export function BookEditor() {
  const { t } = useTranslation();
  const { activeBookId, activeChapterId, setActiveChapter, deleteBook, language } = useStore();
  
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapter, setActiveChapterState] = useState<Chapter | null>(null);
  
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [content, setContent] = useState('');
  const [isPreview, setIsPreview] = useState(false);
  const [isOutlineEditorOpen, setIsOutlineEditorOpen] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setShowExportMenu(false);
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
      alert('Failed to generate content: ' + (error.message || error));
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
      }
    } catch (error: any) {
      console.error('Failed to generate image', error);
      alert('Failed to generate image: ' + (error.message || error));
    } finally {
      setIsGeneratingImage(false);
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
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  };

  const handlePrint = () => {
    window.print();
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
              <ReactMarkdown>{chapter.content || ''}</ReactMarkdown>
            </div>
            <hr className="my-8 border-gray-200" />
          </div>
        ))}
      </div>

      {/* Outline Sidebar */}
      <div className="w-72 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col print:hidden">
        {/* ... (sidebar content) ... */}
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-serif font-bold text-lg truncate" title={book.title}>{book.title}</h2>
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

        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => {
              if (confirm('Are you sure you want to delete this book?')) {
                deleteBook(book.id);
              }
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30 rounded-lg text-sm font-medium transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {t('delete_book')}
          </button>
        </div>
      </div>

      {/* Main Editor */}
      <div className="flex-1 flex flex-col overflow-hidden relative print:hidden">
        {activeChapter ? (
          <>
            {/* Toolbar */}
            <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 md:px-6 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm z-10 gap-4">
              <h3 className="font-serif font-semibold text-lg truncate flex-1 min-w-0" title={activeChapter.title}>{activeChapter.title}</h3>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-md p-1 hidden sm:flex">
                  <button
                    onClick={() => setIsPreview(false)}
                    className={cn("px-3 py-1 text-sm font-medium rounded-sm transition-colors", !isPreview ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => setIsPreview(true)}
                    className={cn("px-3 py-1 text-sm font-medium rounded-sm transition-colors", isPreview ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-zinc-100" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300")}
                  >
                    Preview
                  </button>
                </div>

                {/* Mobile Toggle for Edit/Preview */}
                <button
                   onClick={() => setIsPreview(!isPreview)}
                   className="sm:hidden p-2 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md"
                >
                  {isPreview ? <Edit2 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>

                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block"></div>

                <button
                  onClick={handleGenerateContent}
                  disabled={isGeneratingContent}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-300 rounded-md text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                  title={t('generate_content')}
                >
                  {isGeneratingContent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  <span className="hidden lg:inline">{t('generate_content')}</span>
                </button>
                
                <button
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage || !content}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 rounded-md text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
                  title={t('generate_image')}
                >
                  {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  <span className="hidden lg:inline">{t('generate_image')}</span>
                </button>

                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1 hidden sm:block"></div>

                {/* Export Menu */}
                <div className="relative" ref={exportMenuRef}>
                  <button
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 rounded-md text-sm font-medium transition-colors whitespace-nowrap"
                  >
                    <Download className="w-4 h-4" />
                    <span className="hidden sm:inline">{t('export')}</span>
                    <ChevronDown className="w-3 h-3 opacity-50" />
                  </button>

                  {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-zinc-800 rounded-lg shadow-lg border border-zinc-200 dark:border-zinc-700 py-1 z-50">
                      <button
                        onClick={handleExportMarkdown}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                      >
                        <FileText className="w-4 h-4" />
                        Export Markdown
                      </button>
                      <button
                        onClick={handlePrint}
                        className="w-full text-left px-4 py-2 text-sm text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-700 flex items-center gap-2"
                      >
                        <Printer className="w-4 h-4" />
                        Print / Save PDF
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Editor Area */}
            <div className="flex-1 overflow-y-auto p-8 md:p-12 lg:px-24">
              <div className="max-w-3xl mx-auto space-y-8 pb-32">
                {activeChapter.image && (
                  <div className="relative group rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-sm">
                    <img src={activeChapter.image} alt={activeChapter.title} className="w-full h-auto object-cover aspect-video" referrerPolicy="no-referrer" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={handleGenerateImage}
                        className="bg-white/20 hover:bg-white/30 backdrop-blur-md text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 transition-colors"
                      >
                        <Sparkles className="w-4 h-4" /> Regenerate Image
                      </button>
                    </div>
                  </div>
                )}

                {isPreview ? (
                  <div className="prose prose-zinc dark:prose-invert max-w-none font-serif text-lg leading-relaxed">
                    <ReactMarkdown>{content || '*No content yet.*'}</ReactMarkdown>
                  </div>
                ) : (
                  <textarea
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={t('chapter_content_placeholder')}
                    className="w-full min-h-[500px] bg-transparent border-none outline-none resize-none font-serif text-lg leading-relaxed text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600"
                  />
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-zinc-400 dark:text-zinc-600">
            Select a chapter to start writing
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
    </div>
  );
}
