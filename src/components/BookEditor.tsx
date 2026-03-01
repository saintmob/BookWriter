import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { db, Chapter, Book } from '../lib/db';
import { generateChapterContent, generateImage } from '../lib/ai';
import { Loader2, Sparkles, Image as ImageIcon, Save, Check, Trash2 } from 'lucide-react';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

export function BookEditor() {
  const { t } = useTranslation();
  const { activeBookId, activeChapterId, setActiveChapter, deleteBook, language } = useStore();
  
  const [book, setBook] = useState<Book | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [activeChapter, setActiveChapterState] = useState<Chapter | null>(null);
  
  const [isGeneratingContent, setIsGeneratingContent] = useState(false);
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  
  const [content, setContent] = useState('');
  const [isPreview, setIsPreview] = useState(false);

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

  const handleSave = async () => {
    if (!activeChapter) return;
    setIsSaving(true);
    try {
      const updatedChapter = { ...activeChapter, content, updatedAt: Date.now() };
      await db.saveChapter(updatedChapter);
      setChapters(chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c));
      setActiveChapterState(updatedChapter);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (error) {
      console.error('Failed to save', error);
    } finally {
      setIsSaving(false);
    }
  };

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

  if (!book) return <div className="flex-1 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>;

  return (
    <div className="flex-1 flex h-screen overflow-hidden bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 transition-colors duration-200">
      {/* Outline Sidebar */}
      <div className="w-72 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 flex flex-col">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="font-serif font-bold text-lg truncate" title={book.title}>{book.title}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">{book.summary}</p>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="text-xs font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-2">
            {t('chapters')}
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
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {activeChapter ? (
          <>
            {/* Toolbar */}
            <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm z-10">
              <h3 className="font-serif font-semibold text-lg truncate">{activeChapter.title}</h3>
              
              <div className="flex items-center gap-2">
                <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-md p-1">
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

                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>

                <button
                  onClick={handleGenerateContent}
                  disabled={isGeneratingContent}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-900/30 dark:hover:bg-emerald-900/50 dark:text-emerald-300 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isGeneratingContent ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                  {t('generate_content')}
                </button>
                
                <button
                  onClick={handleGenerateImage}
                  disabled={isGeneratingImage || !content}
                  className="flex items-center gap-2 px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-800 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-200 rounded-md text-sm font-medium transition-colors disabled:opacity-50"
                >
                  {isGeneratingImage ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  {t('generate_image')}
                </button>

                <div className="w-px h-6 bg-zinc-200 dark:bg-zinc-800 mx-1"></div>

                <button
                  onClick={handleSave}
                  disabled={isSaving}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50",
                    saveSuccess 
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" 
                      : "bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900"
                  )}
                >
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {saveSuccess ? t('saved') : t('save')}
                </button>
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
    </div>
  );
}
