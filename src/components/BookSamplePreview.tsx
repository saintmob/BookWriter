import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Book, Chapter } from '../lib/db';
import { X, ChevronLeft, ChevronRight, Printer, BookOpen, Minus, Plus, Maximize, ZoomIn, ZoomOut } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { cn } from '../lib/utils';

interface BookSamplePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  chapters: Chapter[];
}

export function BookSamplePreview({ isOpen, onClose, book, chapters }: BookSamplePreviewProps) {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Constants for Book Layout
  const BOOK_WIDTH = 1100;
  const BOOK_HEIGHT = 780;
  const OUTER_PADDING = 80;
  const COLUMN_GAP = 100;
  // Derived Constants
  // Content Width = 1100 - 160 = 940
  // Column Width = (940 - 100) / 2 = 420
  const COLUMN_WIDTH = (BOOK_WIDTH - (OUTER_PADDING * 2) - COLUMN_GAP) / 2;
  const SPREAD_STRIDE = (COLUMN_WIDTH + COLUMN_GAP) * 2; // Distance to scroll for next spread

  // Auto-fit function
  const fitToScreen = () => {
    if (!wrapperRef.current) return;
    
    const padding = 40; // Minimum padding
    const headerHeight = 80; // Toolbar height

    const availableWidth = window.innerWidth - padding * 2;
    const availableHeight = window.innerHeight - headerHeight - padding * 2;

    const scaleX = availableWidth / BOOK_WIDTH;
    const scaleY = availableHeight / BOOK_HEIGHT;

    // Fit to screen, max scale 1.2
    const newScale = Math.min(scaleX, scaleY, 1.2);
    setScale(Math.max(0.1, newScale));
  };

  // Reset page and fit to screen when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
      setTimeout(() => {
        setIsReady(true);
        fitToScreen();
      }, 100);
    } else {
      setIsReady(false);
    }
  }, [isOpen]);

  // Handle window resize
  useEffect(() => {
    if (!isOpen) return;
    const handleResize = () => {
      requestAnimationFrame(fitToScreen);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Calculate total pages based on scrollWidth
  useEffect(() => {
    if (isReady && contentRef.current) {
      const { scrollWidth } = contentRef.current;
      // Calculate total spreads
      // We subtract the initial padding to get "content length" logic roughly
      // But simpler: Math.ceil((scrollWidth - OUTER_PADDING) / SPREAD_STRIDE)
      const pages = Math.ceil((scrollWidth - OUTER_PADDING) / SPREAD_STRIDE);
      setTotalPages(Math.max(1, pages));
    }
  }, [isReady, book, chapters]);

  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  const nextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const prevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(prev => prev - 1);
    }
  };

  const getChapterStartPage = (chapterIdx: number): number => {
    if (!contentRef.current) return 0;
    const el = contentRef.current.querySelector(`[data-chapter-index="${chapterIdx}"]`);
    if (!el) return 0;
    const elRect = el.getBoundingClientRect();
    const contentRect = contentRef.current.getBoundingClientRect();
    const offset = elRect.left - contentRect.left;
    const page = Math.floor(offset / SPREAD_STRIDE);
    return Math.max(0, Math.min(totalPages - 1, page));
  };

  const getCurrentChapterIndex = (): number => {
    if (!contentRef.current) return 0;
    const els = contentRef.current.querySelectorAll('.chapter-start');
    let activeIdx = 0;
    const currentScrollX = currentPage * SPREAD_STRIDE;
    
    els.forEach(el => {
      const elRect = el.getBoundingClientRect();
      const contentRect = contentRef.current!.getBoundingClientRect();
      const offset = elRect.left - contentRect.left;
      const idx = parseInt(el.getAttribute('data-chapter-index') || '0', 10);
      if (offset <= currentScrollX + 50) {
        activeIdx = Math.max(activeIdx, idx);
      }
    });
    
    return activeIdx;
  };

  const goToPrevChapter = () => {
    const currentIdx = getCurrentChapterIndex();
    const currentChapterStartPage = getChapterStartPage(currentIdx);
    
    if (currentPage > currentChapterStartPage) {
      setCurrentPage(currentChapterStartPage);
    } else if (currentIdx > 0) {
      const prevChapterStartPage = getChapterStartPage(currentIdx - 1);
      setCurrentPage(prevChapterStartPage);
    }
  };

  const goToNextChapter = () => {
    const currentIdx = getCurrentChapterIndex();
    if (currentIdx < chapters.length - 1) {
      const nextChapterStartPage = getChapterStartPage(currentIdx + 1);
      setCurrentPage(nextChapterStartPage);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900/95 backdrop-blur-sm text-zinc-100 animate-in fade-in duration-200">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <BookOpen className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('sample_preview')}</h2>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>{t('double_page_view')}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
              <span>{currentPage + 1} / {totalPages || 1}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-zinc-200 flex items-center gap-2 font-medium"
            title={t('print_sample')}
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">{t('print_sample')}</span>
          </button>
          <div className="w-px h-6 bg-zinc-800 mx-2"></div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Preview Area */}
      <div 
        ref={wrapperRef}
        className="flex-1 flex items-center justify-center p-4 overflow-hidden relative bg-zinc-950"
      >
        
        {/* Navigation Buttons - Fixed to screen edges */}
        <button 
          onClick={prevPage}
          disabled={currentPage === 0}
          className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-4 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white disabled:opacity-0 disabled:pointer-events-none transition-all z-40 shadow-xl backdrop-blur-sm border border-zinc-700"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button 
          onClick={nextPage}
          disabled={currentPage >= totalPages - 1}
          className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-4 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white disabled:opacity-0 disabled:pointer-events-none transition-all z-40 shadow-xl backdrop-blur-sm border border-zinc-700"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Zoom Controls */}
        <div className="absolute bottom-6 right-6 flex items-center gap-1 bg-zinc-900/90 backdrop-blur px-2 py-1.5 rounded-lg border border-zinc-800 z-40 shadow-lg">
           <button 
             onClick={() => setScale(s => Math.max(0.2, s - 0.1))}
             className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
             title="Zoom Out"
           >
             <Minus className="w-4 h-4" />
           </button>
           <span className="text-xs font-mono w-12 text-center text-zinc-300 select-none">{Math.round(scale * 100)}%</span>
           <button 
             onClick={() => setScale(s => Math.min(2.0, s + 0.1))}
             className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
             title="Zoom In"
           >
             <Plus className="w-4 h-4" />
           </button>
           <div className="w-px h-4 bg-zinc-800 mx-1"></div>
           <button 
             onClick={fitToScreen}
             className="p-1.5 hover:bg-zinc-800 rounded text-zinc-400 hover:text-white transition-colors"
             title="Fit to Screen"
           >
             <Maximize className="w-4 h-4" />
           </button>
        </div>

        {/* Scalable Container Wrapper */}
        <div 
          className="transition-transform duration-300 ease-out origin-center will-change-transform"
          style={{ transform: `scale(${scale})` }}
        >
          {/* Book Container (Viewport) - Fixed Dimensions */}
          <div 
            ref={containerRef}
            className="relative bg-[#fcfbf9] text-zinc-900 shadow-2xl overflow-hidden"
            style={{
              width: `${BOOK_WIDTH}px`,
              height: `${BOOK_HEIGHT}px`,
            }}
          >
            {/* Paper Texture Effect */}
            <div className="absolute inset-0 opacity-[0.03] pointer-events-none z-0" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")` }}></div>

            {/* Spine Shadow / Binding Effect */}
            <div className="absolute left-1/2 top-0 bottom-0 w-24 -ml-12 bg-gradient-to-r from-transparent via-black/5 to-transparent pointer-events-none z-20 mix-blend-multiply"></div>
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black/5 z-20"></div>

            {/* Content Wrapper (Scrollable/Transformable) */}
            <div 
              ref={contentRef}
              className="h-full transition-transform duration-500 ease-in-out will-change-transform"
              style={{
                transform: `translateX(-${currentPage * SPREAD_STRIDE}px)`,
                columnWidth: `${COLUMN_WIDTH}px`,
                columnGap: `${COLUMN_GAP}px`,
                padding: `60px ${OUTER_PADDING}px 80px ${OUTER_PADDING}px`,
                height: '100%',
                columnFill: 'auto',
                width: 'max-content',
              }}
            >
              {/* Render Content */}
              <div 
                className="prose prose-zinc max-w-none font-serif text-justify leading-relaxed antialiased"
                style={{ width: `${COLUMN_WIDTH}px` }} // Explicitly set width to force column break
              >
                <style>{`
                  .sample-content {
                    font-size: 15px; /* More realistic book font size */
                    line-height: 1.75;
                    color: #27272a;
                  }
                  .sample-content h1 { 
                    margin-top: 0; 
                    font-size: 2.2em; 
                    text-align: center; 
                    margin-bottom: 4rem; 
                    break-before: column; 
                    font-family: "Playfair Display", serif;
                    font-weight: 700;
                    letter-spacing: -0.02em;
                  }
                  .sample-content h2 { 
                    font-size: 1.4em; 
                    margin-top: 3rem; 
                    margin-bottom: 2rem; 
                    font-family: "Playfair Display", serif;
                    font-weight: 600;
                    text-align: center;
                    letter-spacing: 0.05em;
                  }
                  /* Traditional Paragraph Styling */
                  .sample-content p { 
                    margin-bottom: 0; 
                    text-indent: 2em; 
                  }
                  /* No indent for first paragraph after headings */
                  .sample-content h1 + p,
                  .sample-content h2 + p,
                  .sample-content hr + p {
                    text-indent: 0;
                  }
                  /* Add spacing back for non-paragraph elements if needed */
                  .sample-content blockquote {
                    margin: 1.5rem 2rem;
                    font-style: italic;
                    text-indent: 0;
                    color: #52525b;
                  }
                  .sample-content img { 
                    max-width: 100%; 
                    height: auto; 
                    margin: 2rem auto; 
                    display: block; 
                    break-inside: avoid; 
                    box-shadow: 0 2px 8px rgba(0,0,0,0.08);
                    filter: sepia(0.2) contrast(1.05);
                  }
                  .sample-content hr { 
                    border: 0; 
                    text-align: center; 
                    margin: 2.5rem 0; 
                    height: auto;
                    background: none;
                  }
                  .sample-content hr:after { 
                    content: "❦"; 
                    font-size: 1.2em; 
                    color: #a1a1aa; 
                    display: block;
                  }
                  .chapter-start {
                    break-before: column;
                    padding-top: 4rem; /* Sink */
                  }
                `}</style>
                <div className="sample-content">
                   {/* Title Page */}
                   <div style={{ breakAfter: 'column', height: '640px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                      <div className="mb-8 text-xs font-bold tracking-[0.3em] uppercase text-zinc-400">InkSpire Edition</div>
                      <h1 className="text-4xl md:text-5xl font-bold mb-8 tracking-tight text-zinc-900 !text-center !break-before-auto">{book.title}</h1>
                      <div className="w-12 h-1 bg-zinc-900 mb-8"></div>
                      <p className="text-lg italic text-zinc-600 max-w-xs mx-auto leading-relaxed !text-indent-0 !text-center">{book.summary}</p>
                   </div>

                   {chapters.map((chapter, idx) => (
                     <div key={chapter.id} className="chapter-start" data-chapter-id={chapter.id} data-chapter-index={idx}>
                       <div className="text-center mb-12">
                         <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-500 block mb-4">Chapter {idx + 1}</span>
                         <h2 className="!mt-0 !mb-0 !text-2xl border-none">{chapter.title}</h2>
                       </div>
                       
                       {chapter.image && (
                         <img src={chapter.image} alt={chapter.title} className="w-full h-auto mb-8" />
                       )}
                       
                       <MarkdownRenderer floatingImages={chapter.floatingImages || []}>
                         {chapter.content || ''}
                       </MarkdownRenderer>
                       
                       {idx < chapters.length - 1 && <hr />}
                     </div>
                   ))}
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Chapter Navigation Controls (Bottom Left) */}
        <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-zinc-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-zinc-800 z-40 shadow-lg select-none">
          <button
            onClick={goToPrevChapter}
            disabled={currentPage === 0}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded text-zinc-350 hover:text-white hover:bg-zinc-800/80 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title={t('previous_chapter')}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>{t('previous_chapter')}</span>
          </button>
          <div className="w-px h-4 bg-zinc-800"></div>
          <button
            onClick={goToNextChapter}
            disabled={getCurrentChapterIndex() >= chapters.length - 1}
            className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded text-zinc-350 hover:text-white hover:bg-zinc-800/80 transition-colors disabled:opacity-40 disabled:pointer-events-none"
            title={t('next_chapter')}
          >
            <span>{t('next_chapter')}</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Page Number Indicator (Bottom) */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-zinc-900/80 backdrop-blur px-4 py-2 rounded-full text-xs text-zinc-400 border border-zinc-800">
          {t('sample_preview')} • {currentPage + 1} / {totalPages || 1}
        </div>
      </div>

      {/* Print Styles (Hidden in UI, visible when printing) */}
      <style>{`
        @media print {
          @page { margin: 2cm; size: A4; }
          body * { visibility: hidden; }
          #print-container, #print-container * { visibility: visible; }
          #print-container { position: absolute; left: 0; top: 0; width: 100%; }
          .break-inside-avoid { break-inside: avoid; }
          /* Reset colors for print */
          #print-container { color: black; background: white; }
        }
      `}</style>
    </div>
  );
}
