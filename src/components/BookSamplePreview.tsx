import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Book, Chapter } from '../lib/db';
import { X, ChevronLeft, ChevronRight, Printer, BookOpen } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
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
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  // Reset page when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentPage(0);
      // Allow some time for layout to settle before calculating pages
      setTimeout(() => setIsReady(true), 300);
    } else {
      setIsReady(false);
    }
  }, [isOpen]);

  // Calculate total pages based on scrollWidth
  useEffect(() => {
    if (isReady && contentRef.current && containerRef.current) {
      const { scrollWidth } = contentRef.current;
      const { clientWidth } = containerRef.current;
      
      // clientWidth is the width of the viewport (showing 2 pages)
      // scrollWidth is the total width of the content
      // Total pages (spreads) = Math.ceil(scrollWidth / clientWidth)
      
      const pages = Math.ceil(scrollWidth / clientWidth);
      setTotalPages(pages);
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

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900/95 backdrop-blur-sm text-zinc-100 animate-in fade-in duration-200">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 shrink-0">
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
      <div className="flex-1 flex items-center justify-center p-4 overflow-hidden relative bg-zinc-950">
        
        {/* Navigation Buttons */}
        <button 
          onClick={prevPage}
          disabled={currentPage === 0}
          className="absolute left-4 md:left-8 top-1/2 -translate-y-1/2 p-4 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white disabled:opacity-0 disabled:pointer-events-none transition-all z-30 shadow-xl backdrop-blur-sm border border-zinc-700"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <button 
          onClick={nextPage}
          disabled={currentPage >= totalPages - 1}
          className="absolute right-4 md:right-8 top-1/2 -translate-y-1/2 p-4 rounded-full bg-zinc-800/80 hover:bg-zinc-700 text-white disabled:opacity-0 disabled:pointer-events-none transition-all z-30 shadow-xl backdrop-blur-sm border border-zinc-700"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Book Container (Viewport) */}
        <div 
          ref={containerRef}
          className="relative bg-[#f5f5f0] text-zinc-900 shadow-2xl overflow-hidden transition-all duration-300 ease-in-out origin-center"
          style={{
            width: '1000px', // 2 * 500px pages (Standard spread width)
            height: '700px', // Fixed height (Standard page height ratio)
            maxWidth: '90vw',
            maxHeight: '85vh',
            // Aspect ratio maintenance if screen is small
            aspectRatio: '1000 / 700'
          }}
        >
          {/* Spine Shadow / Binding Effect */}
          <div className="absolute left-1/2 top-0 bottom-0 w-16 -ml-8 bg-gradient-to-r from-transparent via-black/5 to-transparent pointer-events-none z-20 mix-blend-multiply"></div>
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black/10 z-20"></div>

          {/* Content Wrapper (Scrollable/Transformable) */}
          <div 
            ref={contentRef}
            className="h-full transition-transform duration-500 ease-in-out will-change-transform"
            style={{
              transform: `translateX(-${currentPage * 100}%)`, // Move by 100% of viewport width
              columnWidth: '440px', // Page width minus margins (approx 500 - 60)
              columnGap: '120px', // Gap between pages (60px margin * 2)
              padding: '50px 60px', // Top/Bottom padding, Left/Right padding for first/last columns
              height: '100%',
              columnFill: 'auto', // Fill columns sequentially
              width: 'max-content', // Allow width to grow as needed
            }}
          >
            {/* Render Content */}
            <div className="prose prose-zinc max-w-none font-serif text-justify leading-relaxed text-sm">
              <style>{`
                .sample-content h1 { 
                  margin-top: 0; 
                  font-size: 2.5em; 
                  text-align: center; 
                  margin-bottom: 3rem; 
                  break-before: column; 
                  font-family: "Playfair Display", serif;
                }
                .sample-content h2 { 
                  font-size: 1.8em; 
                  margin-top: 2rem; 
                  margin-bottom: 1.5rem; 
                  font-family: "Playfair Display", serif;
                  border-bottom: 1px solid #e5e5e5;
                  padding-bottom: 0.5rem;
                }
                .sample-content p { 
                  margin-bottom: 1.2em; 
                  text-indent: 2em; 
                  font-size: 1.05em;
                  line-height: 1.8;
                }
                .sample-content img { 
                  max-width: 100%; 
                  height: auto; 
                  margin: 2rem auto; 
                  display: block; 
                  break-inside: avoid; 
                  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                  border-radius: 2px;
                }
                .sample-content hr { 
                  border: 0; 
                  text-align: center; 
                  margin: 3rem 0; 
                }
                .sample-content hr:after { 
                  content: "❦"; 
                  font-size: 1.5em; 
                  color: #a1a1aa; 
                }
                .chapter-start {
                  break-before: column;
                  padding-top: 2rem;
                }
              `}</style>
              <div className="sample-content w-[440px]"> {/* Constrain width for correct column flow calculation */}
                 {/* Title Page */}
                 <div style={{ breakAfter: 'column', height: '600px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                    <h1 className="text-5xl font-bold mb-6 tracking-tight">{book.title}</h1>
                    <p className="text-xl italic text-zinc-600 max-w-md mx-auto leading-relaxed">{book.summary}</p>
                    <div className="mt-24 text-xs uppercase tracking-widest text-zinc-400">Generated by InkSpire</div>
                 </div>

                 {chapters.map((chapter, idx) => (
                   <div key={chapter.id} className="chapter-start">
                     <div className="text-center mb-10 mt-4">
                       <span className="text-xs uppercase tracking-[0.2em] text-zinc-500 block mb-2">Chapter {idx + 1}</span>
                       <h2 className="text-3xl font-bold mt-0 border-none">{chapter.title}</h2>
                     </div>
                     
                     {chapter.image && (
                       <img src={chapter.image} alt={chapter.title} className="w-full h-auto rounded-sm shadow-sm mb-8 grayscale-[0.1]" />
                     )}
                     
                     <ReactMarkdown 
                       components={{
                         p: ({node, ...props}) => <p {...props} />,
                       }}
                     >
                       {chapter.content || ''}
                     </ReactMarkdown>
                     
                     {idx < chapters.length - 1 && <hr />}
                   </div>
                 ))}
              </div>
            </div>
          </div>
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
