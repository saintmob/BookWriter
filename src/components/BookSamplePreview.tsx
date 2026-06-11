import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Book, Chapter, PageLayout } from '../lib/db';
import { X, ChevronLeft, ChevronRight, Printer, BookOpen, Minus, Plus, Maximize, FileText } from 'lucide-react';
import { MarkdownRenderer } from './MarkdownRenderer';
import { cn } from '../lib/utils';
import { TOCPreview } from '../catalogue/TOCPreview';
import { INITIAL_DESIGN_CONFIG } from '../catalogue/presets';
import { toast } from 'sonner';

interface BookSamplePreviewProps {
  isOpen: boolean;
  onClose: () => void;
  book: Book;
  chapters: Chapter[];
}

export function BookSamplePreview({ isOpen, onClose, book, chapters }: BookSamplePreviewProps) {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language || 'zh';
  const [currentPage, setCurrentPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [scale, setScale] = useState(1);
  const contentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  const baseLayout: Partial<PageLayout> = book.layout || chapters[0]?.layout || {};
  
  const FORMATS: Record<string, { width: number, height: number }> = {
    a4: { width: 794, height: 1123 },
    letter: { width: 816, height: 1056 },
    trade: { width: 576, height: 864 },
    pocket: { width: 408, height: 653 },
    landscape: { width: 1123, height: 794 },
    square: { width: 864, height: 864 },
  };
  const formatData = FORMATS[baseLayout.format || 'a4'] || FORMATS.a4;

  const [catalogueChapters, setCatalogueChapters] = useState<any[]>([]);
  const [chapterPageMap, setChapterPageMap] = useState<Record<string, number>>({});
  const [tocPageCount, setTocPageCount] = useState(1);
  const [chapterPageCounts, setChapterPageCounts] = useState<Record<string, number>>({});

  // Constants for Book Layout
  const SINGLE_PAGE_WIDTH = formatData.width;
  const SINGLE_PAGE_HEIGHT = formatData.height;
  const BOOK_WIDTH = SINGLE_PAGE_WIDTH * 2;
  const BOOK_HEIGHT = SINGLE_PAGE_HEIGHT;
  const PAGE_GAP = 0;
  const SPREAD_STRIDE = BOOK_WIDTH;

  const fontFamilyCss = baseLayout.fontFamily === 'sans' ? 'ui-sans-serif, system-ui, sans-serif' : 
                        baseLayout.fontFamily === 'mono' ? 'ui-monospace, monospace' : 
                        'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';

  const paperClasses = {
    warm: 'bg-[#faf6ee] text-[#1c1917]',
    white: 'bg-white text-zinc-900',
    dark: 'bg-[#18181b] text-zinc-100',
    kraft: 'bg-[#e6d0a7] text-[#2c1d11]',
    vintage: 'bg-[#f4ebd8] text-[#3e2723]',
    glossy: 'bg-[#f8f9fa] text-[#212529]',
    newsprint: 'bg-[#e2e2df] text-[#2b2b2b]',
  };
  const currentPaperClass = paperClasses[(baseLayout.paperStyle || 'warm') as keyof typeof paperClasses] || paperClasses.warm;

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
      window.requestAnimationFrame(fitToScreen);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isOpen]);

  // Calculate starting pages for all chapters dynamically using exact container scrollWidths
  useEffect(() => {
    if (isReady && contentRef.current) {
      const updatePageCalculations = () => {
        if (!contentRef.current) return;
        
        // 1. Measure TOC page count
        const tocEl = contentRef.current.querySelector('.preview-toc-section');
        let tocPages = 1;
        if (tocEl) {
          const pagesQuery = tocEl.querySelectorAll('.pagedjs-toc-page');
          tocPages = pagesQuery.length > 0 ? pagesQuery.length : 1;
          setTocPageCount(tocPages);
        }
        
        const preChaptersPagesExact = 1 + tocPages;
        const preChaptersPagesAligned = preChaptersPagesExact % 2 === 0 ? preChaptersPagesExact : preChaptersPagesExact + 1;
        
        const newPageMap: Record<string, number> = {};
        const measuredCounts: Record<string, number> = {};
        let accumPages = 1 + preChaptersPagesAligned; // Chapters start at Page 2 + tocPages aligned
        let totalSinglePages = preChaptersPagesAligned;
        
        chapters.forEach((chapter) => {
          const el = contentRef.current?.querySelector(`[data-chapter-id="${chapter.id}"] .chapter-inner-content`);
          let pagesInChapter = 1;
          if (el) {
            pagesInChapter = Math.max(1, Math.round(el.scrollWidth / SINGLE_PAGE_WIDTH));
          } else {
            // fallback estimate
            const charCount = chapter.content?.length || 0;
            pagesInChapter = Math.max(1, Math.ceil(charCount / 500));
          }
          
          measuredCounts[chapter.id] = pagesInChapter;
          newPageMap[chapter.id] = accumPages;
          
          const chapterPagesAligned = pagesInChapter % 2 === 0 ? pagesInChapter : pagesInChapter + 1;
          accumPages += chapterPagesAligned;
          totalSinglePages += chapterPagesAligned;
        });
        
        setChapterPageMap(newPageMap);
        const spreads = Math.ceil(totalSinglePages / 2);
        setTotalPages(Math.max(1, spreads));

        // Sync measured page counts to avoid render shifts on complex elements
        let countsChanged = false;
        chapters.forEach((ch) => {
          if (measuredCounts[ch.id] !== chapterPageCounts[ch.id]) {
            countsChanged = true;
          }
        });
        if (countsChanged) {
          setChapterPageCounts(measuredCounts);
        }
      };
      
      updatePageCalculations();
      const h1 = setTimeout(updatePageCalculations, 100);
      const h2 = setTimeout(updatePageCalculations, 350);
      const h3 = setTimeout(updatePageCalculations, 1200);
      
      return () => {
        clearTimeout(h1);
        clearTimeout(h2);
        clearTimeout(h3);
      };
    }
  }, [isReady, chapters, book, SINGLE_PAGE_WIDTH, isOpen]);

  // Map chapters schema for catalog preview with computed start pages
  useEffect(() => {
    const result: any[] = [];
    let currentChapter: any = null;
    const pageMap: Record<string, number> = {};
    let pageCounter = 3;

    chapters.forEach((ch) => {
      pageMap[ch.id] = chapterPageMap[ch.id] || pageCounter;
      if (ch.level === 1) {
        pageCounter += 2;
      } else {
        const charCount = ch.content?.length || 0;
        const estPages = Math.max(1, Math.ceil(charCount / 500));
        pageCounter += estPages;
      }
    });

    chapters.forEach((ch) => {
      if (ch.level === 1 || ch.level === 2) {
        currentChapter = {
          id: ch.id,
          title: ch.title,
          description: ch.description,
          page: String(pageMap[ch.id]),
          sections: [],
          imageSeed: result.length + 1
        };
        result.push(currentChapter);
      } else if (ch.level === 3 && currentChapter) {
        currentChapter.sections.push({
          id: ch.id,
          title: ch.title,
          page: String(pageMap[ch.id])
        });
      }
    });

    if (result.length === 0) {
       result.push({
          id: '1', title: 'No chapters yet', page: '1', sections: [], imageSeed: 1
       });
    }
    setCatalogueChapters(result);
  }, [chapters, chapterPageMap]);

  const paperBgColor = currentPaperClass.includes('zinc-900') || currentPaperClass.includes('18181b') ? '#18181b' : 
                       currentPaperClass.includes('faf6ee') ? '#faf6ee' : 
                       currentPaperClass.includes('e6d0a7') ? '#e6d0a7' : 
                       currentPaperClass.includes('f4ebd8') ? '#f4ebd8' : 
                       currentPaperClass.includes('e2e2df') ? '#e2e2df' : '#ffffff';
                       
  const paperTextColor = currentPaperClass.includes('zinc-900') || currentPaperClass.includes('18181b') ? '#eeeeee' : '#1c1917';

  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen) return null;

  const handleExportPDF = async () => {
    try {
      setIsExporting(true);
      toast.info(currentLanguage === 'zh' ? '正在建立分层排版模型，即将下载矢量 PDF...' : 'Structuring typeset layout, preparing PDF...');
      
      const printPagesWrapper = wrapperRef.current?.querySelector('.print-pages-wrapper');
      if (!printPagesWrapper) throw new Error("Print pages wrapper not found");
      
      // Inline helper to convert blob URLs inside the DOM to base64 so Puppeteer doesn't miss them
      const blobUrlToBase64 = async (url: string): Promise<string> => {
        try {
          if (!url.startsWith('blob:')) return url;
          const response = await fetch(url);
          const blob = await response.blob();
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(blob);
          });
        } catch (e) {
          console.error('Failed to convert blob image to base64:', e);
          return url;
        }
      };

      // Clone and sanitize DOM for base64 embeddings
      const tempContainer = printPagesWrapper.cloneNode(true) as HTMLElement;
      const imgs = Array.from(tempContainer.querySelectorAll('img'));
      for (const img of imgs) {
        const src = img.getAttribute('src');
        if (src && src.startsWith('blob:')) {
          const base64 = await blobUrlToBase64(src);
          img.setAttribute('src', base64);
        }
      }
      const printPagesHTML = tempContainer.outerHTML;

      // Extract all current stylesheets and CSS Rules
      let combinedCSS = '';
      for (const sheet of Array.from(document.styleSheets)) {
        try {
          if (sheet.cssRules) {
            combinedCSS += Array.from(sheet.cssRules).map(rule => rule.cssText).join('\n') + '\n';
          }
        } catch (e) {
          // Cross-origin safe fallback: we will grab basic styles & inline nodes
        }
      }
      
      // Merge with manual style nodes 
      const inlineStyles = Array.from(document.querySelectorAll('style')).map(s => s.textContent || '').join('\n');
      if (inlineStyles.trim() && !combinedCSS.includes(inlineStyles.slice(0, 100))) {
        combinedCSS += '\n' + inlineStyles;
      }

      // Safeguard essential link CSS files (Google fonts or Tailwind CDN stylesheets)
      const externalCDNs = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
        .map(el => {
          const href = el.getAttribute('href');
          if (href && (href.startsWith('http') || href.startsWith('//'))) {
            return el.outerHTML;
          }
          return '';
        }).filter(Boolean).join('\n');

      const printWidth = SINGLE_PAGE_WIDTH;
      const printHeight = SINGLE_PAGE_HEIGHT;

      // Complete, self-contained HTML page
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          ${externalCDNs}
          <style>
            ${combinedCSS}
          </style>
          <style>
            @page {
              size: ${printWidth}px ${printHeight}px;
              margin: 0;
            }
            html, body {
              background-color: ${paperBgColor} !important;
              color: ${paperTextColor} !important;
              margin: 0 !important;
              padding: 0 !important;
              width: ${printWidth}px !important;
              height: ${printHeight}px !important;
              overflow: hidden !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .print-pages-wrapper {
              display: block !important;
              width: ${printWidth}px !important;
              height: auto !important;
              margin: 0 !important;
              padding: 0 !important;
            }
            .print-physical-page {
              display: block !important;
              break-after: page !important;
              page-break-after: always !important;
              overflow: hidden !important;
              position: relative !important;
              box-sizing: border-box !important;
              width: ${printWidth}px !important;
              height: ${printHeight}px !important;
              background-color: ${paperBgColor} !important;
              color: ${paperTextColor} !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          </style>
        </head>
        <body>
          ${printPagesHTML}
        </body>
        </html>
      `;

      const jsonString = JSON.stringify({
        html: htmlContent,
        width: printWidth,
        height: printHeight
      });
      
      let bodyData: any = jsonString;
      let headers: HeadersInit = { 'Content-Type': 'application/json' };
      
      if (typeof window.CompressionStream !== 'undefined') {
        try {
          const encoder = new TextEncoder();
          const stream = new ReadableStream({
            start(controller) {
              controller.enqueue(encoder.encode(jsonString));
              controller.close();
            }
          }).pipeThrough(new CompressionStream('gzip'));
          bodyData = await new Response(stream).blob();
          headers['Content-Encoding'] = 'gzip';
        } catch (compressErr) {
          console.warn('Gzip compression failed, falling back to uncompressed payload:', compressErr);
          bodyData = jsonString;
          headers = { 'Content-Type': 'application/json' };
        }
      }

      const response = await fetch('/api/export-pdf', {
        method: 'POST',
        headers,
        body: bodyData,
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${book.title || 'book'}_typeset_specimen.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);
      toast.success(currentLanguage === 'zh' ? 'PDF 导出成功！' : 'PDF Exported Successfully!');
    } catch (err: any) {
      console.error(err);
      toast.error(currentLanguage === 'zh' ? '导出 PDF 失败，请重试' : 'Failed to export PDF, please try again.');
    } finally {
      setIsExporting(false);
    }
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
    const ch = chapters[chapterIdx];
    if (!ch) return 0;
    const startPage = chapterPageMap[ch.id] || 3;
    const spreadIndex = Math.floor((startPage - 1) / 2);
    return Math.max(0, Math.min(totalPages - 1, spreadIndex));
  };

  const getCurrentChapterIndex = (): number => {
    const currentSinglePage = currentPage * 2 + 1;
    let activeIdx = 0;
    chapters.forEach((ch, idx) => {
      const startPage = chapterPageMap[ch.id] || 3;
      if (startPage <= currentSinglePage) {
        activeIdx = idx;
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

  const renderBookContentForPrint = () => {
    const marginLeft = baseLayout.marginLeft ?? 80;
    const marginRight = baseLayout.marginRight ?? 80;
    const marginTop = baseLayout.marginTop ?? 60;
    const marginBottom = baseLayout.marginBottom ?? 60;

    const pages: React.ReactNode[] = [];

    // --- Page 1: Title Page ---
    pages.push(
      <div 
        key="print-page-title" 
        className={cn("print-physical-page", currentPaperClass)}
        style={{
          width: `${SINGLE_PAGE_WIDTH}px`,
          height: `${SINGLE_PAGE_HEIGHT}px`,
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
          paddingTop: `${marginTop}px`,
          paddingBottom: `${marginBottom}px`,
          paddingLeft: `${marginLeft}px`,
          paddingRight: `${marginRight}px`,
          breakAfter: 'page',
          pageBreakAfter: 'always',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          textAlign: 'center',
          backgroundColor: paperBgColor,
          color: paperTextColor,
        }}
      >
        <div className="mb-8 text-xs font-bold tracking-[0.3em] uppercase opacity-50">InkSpire Edition</div>
        <h1 className="text-4xl font-bold mb-8 tracking-tight !text-center">{book.title}</h1>
        <div className="w-12 h-1 bg-current opacity-20 mb-8"></div>
        <p className="text-lg italic opacity-85 max-w-xs mx-auto leading-relaxed !text-indent-0 !text-center">{book.summary}</p>
        
        {/* Footer Page Number */}
        <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] font-mono opacity-50">1</div>
      </div>
    );

    // --- Pages for TOC ---
    for (let tocIdx = 0; tocIdx < tocPageCount; tocIdx++) {
      pages.push(
        <div 
          key={`print-page-toc-${tocIdx}`} 
          className={cn("print-physical-page", currentPaperClass)}
          style={{
            width: `${SINGLE_PAGE_WIDTH}px`,
            height: `${SINGLE_PAGE_HEIGHT}px`,
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
            breakAfter: 'page',
            pageBreakAfter: 'always',
            backgroundColor: paperBgColor,
            color: paperTextColor,
          }}
        >
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: `${SINGLE_PAGE_WIDTH}px`,
            height: `${SINGLE_PAGE_HEIGHT}px`,
            overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute',
              top: 0,
              left: `${-tocIdx * SINGLE_PAGE_WIDTH}px`,
              width: `${tocPageCount * SINGLE_PAGE_WIDTH}px`,
              height: '100%',
            }}>
              <TOCPreview 
                bookInfo={{ title: book.title, subtitle: book.designTheme?.typography?.headingFont || 'Catalogue', author: book.coverAuthor || 'Author' }}
                chapters={catalogueChapters}
                config={book.catalogueConfig?.designConfig || INITIAL_DESIGN_CONFIG}
                selectedLayout={book.catalogueConfig?.selectedLayout || 'classic'}
                printMode={true}
                singlePageWidth={SINGLE_PAGE_WIDTH}
              />
            </div>
          </div>
          
          {/* Footer Page Number */}
          <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] font-mono opacity-50">
            {2 + tocIdx}
          </div>
        </div>
      );
    }

    // --- TOC Aligned Transition Page if Odd ---
    const isTOCPreOdd = (1 + tocPageCount) % 2 !== 0;
    if (isTOCPreOdd) {
      pages.push(
        <div 
          key="print-page-toc-blank" 
          className={cn("print-physical-page", currentPaperClass)}
          style={{
            width: `${SINGLE_PAGE_WIDTH}px`,
            height: `${SINGLE_PAGE_HEIGHT}px`,
            position: 'relative',
            overflow: 'hidden',
            boxSizing: 'border-box',
            breakAfter: 'page',
            pageBreakAfter: 'always',
            backgroundColor: paperBgColor,
            color: paperTextColor,
          }}
        >
          <div className="absolute inset-0 flex items-center justify-center opacity-[0.08]">
            <span className="text-4xl font-serif italic">Catalogue</span>
          </div>
          {/* Footer Page Number */}
          <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] font-mono opacity-50">
            {1 + tocPageCount + 1}
          </div>
        </div>
      );
    }

    // --- Pages for Chapters ---
    chapters.forEach((chapter) => {
      const chapterPageCount = chapterPageCounts[chapter.id] || 1;
      const startPage = chapterPageMap[chapter.id] || (1 + (tocPageCount % 2 === 0 ? tocPageCount : tocPageCount + 1) + 1);

      const isOdd = chapterPageCount % 2 !== 0;
      const totalRenderedPages = isOdd ? chapterPageCount + 1 : chapterPageCount;

      for (let pageIdx = 0; pageIdx < totalRenderedPages; pageIdx++) {
        const overallPageNum = startPage + pageIdx;

        if (pageIdx === chapterPageCount && isOdd) {
          pages.push(
            <div 
              key={`print-page-chapter-blank-${chapter.id}`} 
              className={cn("print-physical-page", currentPaperClass)}
              style={{
                width: `${SINGLE_PAGE_WIDTH}px`,
                height: `${SINGLE_PAGE_HEIGHT}px`,
                position: 'relative',
                overflow: 'hidden',
                boxSizing: 'border-box',
                breakAfter: 'page',
                pageBreakAfter: 'always',
                backgroundColor: paperBgColor,
                color: paperTextColor,
              }}
            >
              <div className="absolute inset-0 flex items-center justify-center opacity-[0.08]">
                <span className="text-4xl">❦</span>
              </div>
              {/* Footer Page Number */}
              <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] font-mono opacity-50">
                {overallPageNum}
              </div>
            </div>
          );
          continue;
        }

        pages.push(
          <div 
            key={`print-page-chapter-${chapter.id}-${pageIdx}`} 
            className={cn("print-physical-page", currentPaperClass)}
            style={{
              width: `${SINGLE_PAGE_WIDTH}px`,
              height: `${SINGLE_PAGE_HEIGHT}px`,
              position: 'relative',
              overflow: 'hidden',
              boxSizing: 'border-box',
              breakAfter: 'page',
              pageBreakAfter: 'always',
              backgroundColor: paperBgColor,
              color: paperTextColor,
            }}
          >
            {/* Viewport wrapper for multi-column slicing */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: `${SINGLE_PAGE_WIDTH}px`,
              height: `${SINGLE_PAGE_HEIGHT}px`,
              overflow: 'hidden',
            }}>
              <div 
                className={cn(
                  "prose max-w-none antialiased break-words",
                  baseLayout.paperStyle === 'dark' ? 'prose-invert text-zinc-100' : 'prose-zinc text-zinc-850',
                  // Drop Caps variants
                  baseLayout.dropCaps && baseLayout.dropCapsStyle === 'gothic' && "[&_.chapter-body-content>p:first-of-type]:first-letter:float-left [&_.chapter-body-content>p:first-of-type]:first-letter:text-6xl [&_.chapter-body-content>p:first-of-type]:first-letter:font-bold [&_.chapter-body-content>p:first-of-type]:first-letter:pr-2 [&_.chapter-body-content>p:first-of-type]:first-letter:mt-1 [&_.chapter-body-content>p:first-of-type]:first-letter:font-serif",
                  baseLayout.dropCaps && baseLayout.dropCapsStyle === 'minimal' && "[&_.chapter-body-content>p:first-of-type]:first-letter:float-left [&_.chapter-body-content>p:first-of-type]:first-letter:text-5xl [&_.chapter-body-content>p:first-of-type]:first-letter:font-light [&_.chapter-body-content>p:first-of-type]:first-letter:pr-3 [&_.chapter-body-content>p:first-of-type]:first-letter:-mt-1",
                  baseLayout.dropCaps && baseLayout.dropCapsStyle === 'modern' && "[&_.chapter-body-content>p:first-of-type]:first-letter:float-left [&_.chapter-body-content>p:first-of-type]:first-letter:text-5xl [&_.chapter-body-content>p:first-of-type]:first-letter:font-black [&_.chapter-body-content>p:first-of-type]:first-letter:pr-2 [&_.chapter-body-content>p:first-of-type]:first-letter:pt-1 [&_.chapter-body-content>p:first-of-type]:first-letter:font-sans",
                  baseLayout.dropCaps && (!baseLayout.dropCapsStyle || baseLayout.dropCapsStyle === 'standard') && "[&_.chapter-body-content>p:first-of-type]:first-letter:float-left [&_.chapter-body-content>p:first-of-type]:first-letter:text-5xl [&_.chapter-body-content>p:first-of-type]:first-letter:font-bold [&_.chapter-body-content>p:first-of-type]:first-letter:pr-2 [&_.chapter-body-content>p:first-of-type]:first-letter:-mt-1",
                  
                  "[&_p]:mt-0 [&_p]:mb-[var(--paragraph-spacing)] [&_p]:[text-indent:var(--first-line-indent)] [&_p]:indent-0",
                  "[&_.chapter-body-content>p:first-of-type]:!indent-0 [&_.chapter-body-content>p:first-of-type]:[text-indent:0]",
                  "[&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:font-bold [&_h3]:text-xl [&_h3]:[break-before:avoid-column] [&_h3]:[break-inside:avoid]",
                  "[&_h4]:mt-6 [&_h4]:mb-3 [&_h4]:font-semibold [&_h4]:text-lg [&_h4]:[break-before:avoid-column] [&_h4]:[break-inside:avoid]",
                  "[&_pre]:[break-inside:avoid-column] [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:bg-black/5 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:text-sm",
                  "[&_blockquote]:[break-inside:avoid-column] [&_blockquote]:pl-4 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-350 [&_blockquote]:italic [&_blockquote]:my-4 [&_blockquote]:max-w-full",
                  "[&_table]:[break-inside:avoid-column] [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:w-full [&_table]:my-4",
                  "[&_ul]:[break-inside:avoid-column] [&_ul]:pl-5 [&_ul]:mb-4",
                  "[&_ol]:[break-inside:avoid-column] [&_ol]:pl-5 [&_ol]:mb-4",
                  "[&_li]:mb-1",
                  "[&_img]:[break-inside:avoid-column] [&_img]:max-w-full"
                )}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: `${-pageIdx * SINGLE_PAGE_WIDTH}px`,
                  width: `${chapterPageCount * SINGLE_PAGE_WIDTH}px`,
                  height: `${BOOK_HEIGHT - marginTop - marginBottom}px`,
                  marginTop: `${marginTop}px`,
                  marginBottom: `${marginBottom}px`,
                  paddingLeft: `${marginLeft}px`,
                  paddingRight: `${marginRight}px`,
                  columnWidth: `${SINGLE_PAGE_WIDTH - marginLeft - marginRight}px`,
                  columnGap: `${marginLeft + marginRight}px`,
                  columnFill: 'auto',
                  boxSizing: 'border-box',
                  fontFamily: fontFamilyCss,
                  fontSize: `${baseLayout.fontSize || 16}px`,
                  lineHeight: baseLayout.lineHeight || 1.6,
                  textAlign: baseLayout.justifyText !== false ? 'justify' : 'left',
                  hyphens: baseLayout.hyphenation ? 'auto' : 'none',
                  textRendering: 'optimizeLegibility',
                  fontFeatureSettings: '"liga" 1, "kern" 1, "onum" 1, "pnum" 1',
                  '--paragraph-spacing': `${baseLayout.paragraphSpacing ?? 16}px`,
                  '--first-line-indent': `${baseLayout.firstLineIndent ?? 0}em`,
                  letterSpacing: baseLayout.dnaTensionStyle === 'rigid' ? '-0.01em' : 
                                 baseLayout.dnaTensionStyle === 'fluid' ? '0.02em' : 
                                 baseLayout.dnaTensionStyle === 'fractured' ? '0.04em' : 
                                 baseLayout.dnaTensionStyle === 'compressed' ? '-0.03em' : 'normal',
                  wordSpacing: baseLayout.dnaTensionStyle === 'fractured' ? '0.15em' : 'normal',
                } as React.CSSProperties}
              >
                {baseLayout.chapterTitleStyle && baseLayout.chapterTitleStyle !== 'hidden' ? (
                  <div className={cn(
                    "mb-12 break-after-avoid whitespace-pre-wrap",
                    baseLayout.chapterTitleStyle === 'classical' ? "text-center mt-12 mb-16" : 
                    baseLayout.chapterTitleStyle === 'modern' ? "text-left border-b-2 border-inherit pb-4 mb-10" : 
                    baseLayout.chapterTitleStyle === 'ornate' ? "text-center mt-16 mb-20 border-y py-4 border-inherit" :
                    baseLayout.chapterTitleStyle === 'bold' ? "text-left mt-8 mb-16" :
                    "text-left" // minimal
                  )}>
                    {baseLayout.chapterTitleStyle === 'ornate' && <div className="text-center text-xl opacity-50 mb-2">❦</div>}
                    <h2 className={cn(
                      "!m-0 !border-none leading-tight",
                      baseLayout.chapterTitleStyle === 'classical' ? "!text-4xl !font-normal !font-serif" : 
                      baseLayout.chapterTitleStyle === 'modern' ? "!text-5xl !font-sans font-bold tracking-tight" : 
                      baseLayout.chapterTitleStyle === 'ornate' ? "!text-4xl !font-serif italic tracking-widest uppercase" :
                      baseLayout.chapterTitleStyle === 'bold' ? "!text-6xl !font-sans font-black tracking-tighter uppercase" :
                      "!text-2xl !font-serif italic"
                    )}>
                      {chapter.title}
                    </h2>
                    {baseLayout.chapterTitleStyle === 'ornate' && <div className="text-center text-xl opacity-50 mt-2">❦</div>}
                  </div>
                ) : (null)}
                
                <div className="chapter-body-content relative">
                  <MarkdownRenderer 
                    floatingImages={chapter.floatingImages || []}
                    sceneBreakStyle={baseLayout.sceneBreakStyle}
                  >
                    {(chapter.content || '').replace(/^\s*#\s+[^\n]+(?:\n+|$)/, '')}
                  </MarkdownRenderer>
                </div>
              </div>
            </div>

            {/* Absolute Images Overlay for this specific page index */}
            {(chapter.floatingImages || [])
              .filter(img => !img.layoutMode || img.layoutMode === 'absolute')
              .filter(img => {
                const EDIT_PAGE_GAP = 40;
                const srcWidth = SINGLE_PAGE_WIDTH + EDIT_PAGE_GAP;
                const imgPageIndex = Math.floor(img.x / srcWidth);
                return imgPageIndex === pageIdx;
              })
              .map(img => {
                const EDIT_PAGE_GAP = 40;
                const srcWidth = SINGLE_PAGE_WIDTH + EDIT_PAGE_GAP;
                const localX = img.x % srcWidth;
                const localY = img.y;

                return (
                  <div 
                    key={img.id}
                    className="absolute"
                    style={{
                      left: localX + "px",
                      top: localY + "px",
                      width: img.width + "px",
                      height: img.autoSize ? 'auto' : img.height + "px",
                      opacity: img.opacity ?? 1,
                      mixBlendMode: (img.blendMode as any) || 'normal',
                      borderRadius: (img.borderRadius ?? 8) + "px",
                      overflow: 'hidden',
                      zIndex: 10,
                    }}
                  >
                    <img 
                      src={img.url} 
                      alt="" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: (img.objectFit as any) || 'cover', 
                        objectPosition: img.objectPosition || 'center',
                        display: 'block',
                        filter: (img.grayscale ? 'grayscale(100%) ' : '') + (img.sepia ? 'sepia(100%) ' : '') + (img.invert ? 'invert(100%)' : '')
                      }} 
                      referrerPolicy="no-referrer"
                    />
                  </div>
                );
              })}

            {/* Footer Page Number */}
            <div className="absolute bottom-6 left-0 right-0 text-center text-[10px] font-mono opacity-50">
              {overallPageNum}
            </div>
          </div>
        );
      }
    });

    return (
      <div className="print-pages-wrapper">
        {pages}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 print:static print:h-auto print:block z-50 flex flex-col bg-zinc-950 text-zinc-100 animate-in fade-in duration-200">
      {/* Header / Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 shrink-0 z-50 print:hidden">
        <div className="flex items-center gap-4">
          <div className="p-2 bg-emerald-500/10 rounded-lg">
            <BookOpen className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{book.title || t('sample_preview')}</h2>
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <span>{t('double_page_view')}</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
              <span>{(currentPage + 1) + " / " + (totalPages || 1)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <div className="flex items-center bg-zinc-800 rounded-lg p-0.5 border border-zinc-700 mr-2">
            <button
               onClick={() => setScale(s => Math.max(0.2, s - 0.1))}
               className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
               title={t('zoom_out')}
            >
               <Minus className="w-4 h-4" />
            </button>
            <span className="text-xs px-2 font-mono text-zinc-300 min-w-[3.5rem] text-center">
               {Math.round(scale * 100) + "%"}
            </span>
            <button
               onClick={() => setScale(s => Math.min(2, s + 0.1))}
               className="p-1.5 hover:bg-zinc-700 rounded text-zinc-400 hover:text-zinc-100 transition-colors"
               title={t('zoom_in')}
            >
               <Plus className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-zinc-700 mx-1"></div>
            <button
               onClick={fitToScreen}
               className="p-1.5 hover:bg-zinc-700 rounded text-zinc-350 hover:text-zinc-100 transition-colors text-xs font-semibold px-2"
               title={t('fit_to_screen')}
            >
               {t('fit')}
            </button>
          </div>

          <button
            onClick={handleExportPDF}
            disabled={isExporting}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg transition-colors flex items-center gap-2 font-medium disabled:opacity-50 disabled:pointer-events-none"
            title={currentLanguage === 'zh' ? '导出矢量 PDF 文件' : 'Export Vector PDF'}
          >
            <Printer className="w-4 h-4" />
            <span>
              {isExporting ? (currentLanguage === 'zh' ? '正在生成...' : 'Generating...') : (currentLanguage === 'zh' ? '导出 PDF' : 'Export PDF')}
            </span>
          </button>
          <div className="w-px h-6 bg-zinc-800 mx-2"></div>
          <button
            onClick={onClose}
            className="p-2 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Main Preview Container */}
      <div 
        className="flex-1 overflow-auto flex items-center justify-center p-6 relative select-none print:bg-white print:p-0 print:overflow-visible bg-zinc-950"
        ref={containerRef}
      >
        <div 
          ref={wrapperRef}
          className="relative transition-all duration-300 print:static print:transform-none print:w-auto print:h-auto"
          style={{
            width: BOOK_WIDTH + "px",
            height: BOOK_HEIGHT + "px",
            transform: 'scale(' + scale + ')',
            transformOrigin: 'center center',
          }}
        >
          {/* Print container - only visible during print/pdf generation */}
          <div className="print-container hidden print:block print:w-full print:h-auto">
            {renderBookContentForPrint()}
          </div>

          {/* Screen double-page spread container */}
          <div className="h-full relative overflow-hidden bg-zinc-900 rounded-xl shadow-2xl border border-zinc-800 print:hidden"
               style={{ width: BOOK_WIDTH + "px", height: BOOK_HEIGHT + "px" }}>
            {/* Ambient Spine / Fold Shadows */}
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[40px] bg-gradient-to-r from-black/20 via-black/40 to-black/20 z-30 pointer-events-none" />
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[2px] bg-black/50 z-30 pointer-events-none" />

            {/* Left Page Edge Ambient Gradient */}
            <div className="absolute inset-y-0 left-0 w-[20px] bg-gradient-to-r from-black/10 to-transparent z-30 pointer-events-none" />
            {/* Right Page Edge Ambient Gradient */}
            <div className="absolute inset-y-0 right-0 w-[20px] bg-gradient-to-l from-black/10 to-transparent z-30 pointer-events-none" />

            {/* Inner Content Scroller Layout */}
            <div 
              ref={contentRef}
              className={"h-full flex flex-row transition-transform duration-500 ease-in-out will-change-transform z-10 relative " + currentPaperClass}
              style={{
                transform: 'translateX(-' + (currentPage * SPREAD_STRIDE) + 'px)',
                height: '100%',
                width: 'max-content',
              }}
            >
              {/* Sibling 1: Title Page */}
              <div 
                className="h-full shrink-0 flex flex-col justify-center items-center text-center relative border-r border-[#000000]/5"
                style={{ 
                  width: SINGLE_PAGE_WIDTH + "px",
                  paddingTop: baseLayout.marginTop ?? 60,
                  paddingBottom: baseLayout.marginBottom ?? 60,
                  paddingLeft: baseLayout.marginLeft ?? 80,
                  paddingRight: baseLayout.marginRight ?? 80,
                }}
              >
                <div className="mb-8 text-xs font-bold tracking-[0.3em] uppercase opacity-50">InkSpire Edition</div>
                <h1 className="text-4xl md:text-5xl font-bold mb-8 tracking-tight !text-center">{book.title}</h1>
                <div className="w-12 h-1 bg-current opacity-20 mb-8"></div>
                <p className="text-lg italic opacity-80 max-w-xs mx-auto leading-relaxed !text-indent-0 !text-center">{book.summary}</p>
              </div>

              {/* Sibling 2: Table of Contents */}
              <div 
                className="h-full shrink-0 relative preview-toc-section flex flex-row border-r border-[#000000]/5"
                style={{
                  width: `${tocPageCount * SINGLE_PAGE_WIDTH}px`,
                  height: '100%',
                }}
              >
                <TOCPreview 
                  bookInfo={{ title: book.title, subtitle: book.designTheme?.typography?.headingFont || 'Catalogue', author: book.coverAuthor || 'Author' }}
                  chapters={catalogueChapters}
                  config={book.catalogueConfig?.designConfig || INITIAL_DESIGN_CONFIG}
                  selectedLayout={book.catalogueConfig?.selectedLayout || 'classic'}
                  printMode={true}
                  singlePageWidth={SINGLE_PAGE_WIDTH}
                />
              </div>

              {/* Sibling 3+: Chapters List */}
              {chapters.map((chapter) => {
                const marginLeft = baseLayout.marginLeft ?? 80;
                const marginRight = baseLayout.marginRight ?? 80;
                const marginTop = baseLayout.marginTop ?? 60;
                const marginBottom = baseLayout.marginBottom ?? 60;
                
                return (
                  <div 
                    key={chapter.id} 
                    data-chapter-id={chapter.id}
                    className="preview-chapter-section h-full shrink-0 relative border-r border-[#000000]/5 overflow-hidden"
                    style={{
                      height: '100%',
                      width: chapterPageCounts[chapter.id] 
                        ? `${(chapterPageCounts[chapter.id] % 2 === 0 ? chapterPageCounts[chapter.id] : chapterPageCounts[chapter.id] + 1) * SINGLE_PAGE_WIDTH}px` 
                        : 'max-content',
                    }}
                  >
                    <div
                      className={cn(
                        "chapter-inner-content prose max-w-none antialiased break-words",
                        baseLayout.paperStyle === 'dark' ? 'prose-invert text-zinc-100' : 'prose-zinc text-zinc-850',
                        // Drop Caps variants
                        baseLayout.dropCaps && baseLayout.dropCapsStyle === 'gothic' && "[&_.chapter-body-content>p:first-of-type]:first-letter:float-left [&_.chapter-body-content>p:first-of-type]:first-letter:text-6xl [&_.chapter-body-content>p:first-of-type]:first-letter:font-bold [&_.chapter-body-content>p:first-of-type]:first-letter:pr-2 [&_.chapter-body-content>p:first-of-type]:first-letter:mt-1 [&_.chapter-body-content>p:first-of-type]:first-letter:font-serif",
                        baseLayout.dropCaps && baseLayout.dropCapsStyle === 'minimal' && "[&_.chapter-body-content>p:first-of-type]:first-letter:float-left [&_.chapter-body-content>p:first-of-type]:first-letter:text-5xl [&_.chapter-body-content>p:first-of-type]:first-letter:font-light [&_.chapter-body-content>p:first-of-type]:first-letter:pr-3 [&_.chapter-body-content>p:first-of-type]:first-letter:-mt-1",
                        baseLayout.dropCaps && baseLayout.dropCapsStyle === 'modern' && "[&_.chapter-body-content>p:first-of-type]:first-letter:float-left [&_.chapter-body-content>p:first-of-type]:first-letter:text-5xl [&_.chapter-body-content>p:first-of-type]:first-letter:font-black [&_.chapter-body-content>p:first-of-type]:first-letter:pr-2 [&_.chapter-body-content>p:first-of-type]:first-letter:pt-1 [&_.chapter-body-content>p:first-of-type]:first-letter:font-sans",
                        baseLayout.dropCaps && (!baseLayout.dropCapsStyle || baseLayout.dropCapsStyle === 'standard') && "[&_.chapter-body-content>p:first-of-type]:first-letter:float-left [&_.chapter-body-content>p:first-of-type]:first-letter:text-5xl [&_.chapter-body-content>p:first-of-type]:first-letter:font-bold [&_.chapter-body-content>p:first-of-type]:first-letter:pr-2 [&_.chapter-body-content>p:first-of-type]:first-letter:-mt-1",
                        
                        "[&_p]:mt-0 [&_p]:mb-[var(--paragraph-spacing)] [&_p]:[text-indent:var(--first-line-indent)] [&_p]:indent-0",
                        "[&_.chapter-body-content>p:first-of-type]:!indent-0 [&_.chapter-body-content>p:first-of-type]:[text-indent:0]",
                        "[&_h2]:[break-after:avoid-column]",
                        "[&_h3]:mt-8 [&_h3]:mb-4 [&_h3]:font-bold [&_h3]:text-xl [&_h3]:[break-before:avoid-column] [&_h3]:[break-inside:avoid]",
                        "[&_h4]:mt-6 [&_h4]:mb-3 [&_h4]:font-semibold [&_h4]:text-lg [&_h4]:[break-before:avoid-column] [&_h4]:[break-inside:avoid]",
                        "[&_pre]:[break-inside:avoid-column] [&_pre]:max-w-full [&_pre]:overflow-x-auto [&_pre]:bg-black/5 [&_pre]:p-4 [&_pre]:rounded-lg [&_pre]:text-sm",
                        "[&_blockquote]:[break-inside:avoid-column] [&_blockquote]:pl-4 [&_blockquote]:border-l-4 [&_blockquote]:border-zinc-350 [&_blockquote]:italic [&_blockquote]:my-4 [&_blockquote]:max-w-full",
                        "[&_table]:[break-inside:avoid-column] [&_table]:max-w-full [&_table]:overflow-x-auto [&_table]:w-full [&_table]:my-4",
                        "[&_ul]:[break-inside:avoid-column] [&_ul]:pl-5 [&_ul]:mb-4",
                        "[&_ol]:[break-inside:avoid-column] [&_ol]:pl-5 [&_ol]:mb-4",
                        "[&_li]:mb-1",
                        "[&_img]:[break-inside:avoid-column] [&_img]:max-w-full"
                      )}
                      style={{
                        height: `${BOOK_HEIGHT - marginTop - marginBottom}px`,
                        marginTop: `${marginTop}px`,
                        marginBottom: `${marginBottom}px`,
                        paddingLeft: `${marginLeft}px`,
                        paddingRight: `${marginRight}px`,
                        columnWidth: `${SINGLE_PAGE_WIDTH - marginLeft - marginRight}px`,
                        columnGap: `${marginLeft + marginRight}px`,
                        columnFill: 'auto',
                        width: chapterPageCounts[chapter.id] 
                          ? `${(chapterPageCounts[chapter.id] % 2 === 0 ? chapterPageCounts[chapter.id] : chapterPageCounts[chapter.id] + 1) * SINGLE_PAGE_WIDTH}px` 
                          : 'max-content',
                        boxSizing: 'border-box' as any,
                        fontFamily: fontFamilyCss,
                        fontSize: `${baseLayout.fontSize || 16}px`,
                        lineHeight: baseLayout.lineHeight || 1.6,
                        textAlign: baseLayout.justifyText !== false ? 'justify' : 'left',
                        hyphens: baseLayout.hyphenation ? 'auto' : 'none',
                        textRendering: 'optimizeLegibility',
                        fontFeatureSettings: '"liga" 1, "kern" 1, "onum" 1, "pnum" 1',
                        '--paragraph-spacing': `${baseLayout.paragraphSpacing ?? 16}px`,
                        '--first-line-indent': `${baseLayout.firstLineIndent ?? 0}em`,
                        letterSpacing: baseLayout.dnaTensionStyle === 'rigid' ? '-0.01em' : 
                                       baseLayout.dnaTensionStyle === 'fluid' ? '0.02em' : 
                                       baseLayout.dnaTensionStyle === 'fractured' ? '0.04em' : 
                                       baseLayout.dnaTensionStyle === 'compressed' ? '-0.03em' : 'normal',
                        wordSpacing: baseLayout.dnaTensionStyle === 'fractured' ? '0.15em' : 'normal',
                      } as React.CSSProperties}
                    >
                      {baseLayout.chapterTitleStyle && baseLayout.chapterTitleStyle !== 'hidden' ? (
                        <div className={cn(
                          "mb-12 break-after-avoid whitespace-pre-wrap",
                          baseLayout.chapterTitleStyle === 'classical' ? "text-center mt-12 mb-16" : 
                          baseLayout.chapterTitleStyle === 'modern' ? "text-left border-b-2 border-inherit pb-4 mb-10" : 
                          baseLayout.chapterTitleStyle === 'ornate' ? "text-center mt-16 mb-20 border-y py-4 border-inherit" :
                          baseLayout.chapterTitleStyle === 'bold' ? "text-left mt-8 mb-16" :
                          "text-left" // minimal
                        )}>
                          {baseLayout.chapterTitleStyle === 'ornate' && <div className="text-center text-xl opacity-50 mb-2">❦</div>}
                          <h2 className={cn(
                            "!m-0 !border-none leading-tight",
                            baseLayout.chapterTitleStyle === 'classical' ? "!text-4xl !font-normal !font-serif" : 
                            baseLayout.chapterTitleStyle === 'modern' ? "!text-5xl !font-sans font-bold tracking-tight" : 
                            baseLayout.chapterTitleStyle === 'ornate' ? "!text-4xl !font-serif italic tracking-widest uppercase" :
                            baseLayout.chapterTitleStyle === 'bold' ? "!text-6xl !font-sans font-black tracking-tighter uppercase" :
                            "!text-2xl !font-serif italic"
                          )}>
                            {chapter.title}
                          </h2>
                          {baseLayout.chapterTitleStyle === 'ornate' && <div className="text-center text-xl opacity-50 mt-2">❦</div>}
                        </div>
                      ) : (null)}
                      
                      <div className="chapter-body-content relative">
                        <MarkdownRenderer 
                          floatingImages={chapter.floatingImages || []}
                          sceneBreakStyle={baseLayout.sceneBreakStyle}
                        >
                          {(chapter.content || '').replace(/^\s*#\s+[^\n]+(?:\n+|$)/, '')}
                        </MarkdownRenderer>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Page Footer Overlay (Double Page Numbers) */}
            {isReady && Array.from({ length: totalPages }).map((_, i) => (
              <div 
                key={i}
                className="absolute bottom-6 left-0 right-0 h-4 z-20 pointer-events-none select-none flex justify-between"
                style={{
                  transform: 'translateX(' + ((i - currentPage) * SPREAD_STRIDE) + 'px)',
                  transition: 'transform 0.5s ease-in-out',
                  width: BOOK_WIDTH + "px",
                  fontFamily: fontFamilyCss,
                  color: paperTextColor,
                  opacity: 0.5,
                }}
              >
                {/* Left Page Number */}
                <div 
                  className="absolute text-center text-[10px] font-mono"
                  style={{
                    left: '0px',
                    width: SINGLE_PAGE_WIDTH + "px",
                  }}
                >
                  {i * 2 + 1}
                </div>
                {/* Right Page Number */}
                <div 
                  className="absolute text-center text-[10px] font-mono"
                  style={{
                    left: SINGLE_PAGE_WIDTH + "px",
                    width: SINGLE_PAGE_WIDTH + "px",
                  }}
                >
                  {i * 2 + 2}
                </div>
              </div>
            ))}

            {/* Screen Preview Absolute Images Overlay Layer */}
            {isReady && (
              <div 
                className="absolute top-0 bottom-0 left-0 pointer-events-none transition-transform duration-500 ease-in-out z-25"
                style={{
                  transform: 'translateX(-' + (currentPage * SPREAD_STRIDE) + 'px)',
                  width: (totalPages * SPREAD_STRIDE) + "px",
                  paddingTop: baseLayout.marginTop ?? 60,
                  paddingBottom: baseLayout.marginBottom ?? 60,
                }}
              >
                {chapters.map(chapter => {
                  const chapterStartPage = chapterPageMap[chapter.id];
                  if (!chapterStartPage) return null;
                  const chapterOffset = (chapterStartPage - 1) * SINGLE_PAGE_WIDTH;
                  
                  return (chapter.floatingImages || [])
                    .filter(img => !img.layoutMode || img.layoutMode === 'absolute')
                    .map(img => {
                      const EDIT_PAGE_GAP = 40;
                      const srcWidth = SINGLE_PAGE_WIDTH + EDIT_PAGE_GAP;
                      const pageIndex = Math.floor(img.x / srcWidth);
                      const localX = img.x % srcWidth;
                      const localY = img.y;
                      const screenXLeft = chapterOffset + pageIndex * SINGLE_PAGE_WIDTH + localX;

                      return (
                        <div 
                          key={img.id}
                          className="absolute"
                          style={{
                            left: screenXLeft + "px",
                            top: localY + "px",
                            width: img.width + "px",
                            height: img.autoSize ? "auto" : img.height + "px",
                            opacity: img.opacity ?? 1,
                            mixBlendMode: (img.blendMode as any) || 'normal',
                            borderRadius: (img.borderRadius ?? 8) + 'px',
                            overflow: 'hidden'
                          }}
                        >
                          <img 
                            src={img.url} 
                            alt="" 
                            style={{ 
                              width: '100%', 
                              height: '100%', 
                              objectFit: (img.objectFit as any) || 'cover', 
                              objectPosition: img.objectPosition || 'center',
                              display: 'block',
                              filter: (img.grayscale ? 'grayscale(100%) ' : '') + (img.sepia ? 'sepia(100%) ' : '') + (img.invert ? 'invert(100%)' : '')
                            }} 
                            referrerPolicy="no-referrer"
                          />
                        </div>
                      );
                    });
                })}
              </div>
            )}
          </div>

          {/* Chapter Navigation Controls (Bottom Left) */}
          <div className="absolute bottom-6 left-6 flex items-center gap-2 bg-zinc-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-zinc-800 z-45 shadow-lg select-none print:hidden">
            <button
              onClick={goToPrevChapter}
              disabled={currentPage === 0}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded text-zinc-300 hover:text-white hover:bg-zinc-800/80 transition-colors disabled:opacity-40 disabled:pointer-events-none"
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

          {/* Navigation Controls (Page switcher - Bottom Right) */}
          <div className="absolute bottom-6 right-6 flex items-center gap-2 bg-zinc-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-zinc-800 z-45 shadow-lg select-none print:hidden">
            <button
              onClick={prevPage}
              disabled={currentPage === 0}
              className="p-1 hover:bg-zinc-800 rounded disabled:opacity-45 disabled:pointer-events-none text-zinc-300 hover:text-white transition-all"
              title={t('previous_page')}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs text-zinc-400 select-none">
              {(currentPage + 1) + " / " + (totalPages || 1)}
            </span>
            <button
              onClick={nextPage}
              disabled={currentPage === totalPages - 1}
              className="p-1 hover:bg-zinc-800 rounded disabled:opacity-45 disabled:pointer-events-none text-zinc-300 hover:text-white transition-all"
              title={t('next_page')}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
