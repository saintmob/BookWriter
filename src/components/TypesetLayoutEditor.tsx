import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { 
  Settings, 
  ImagePlus, 
  Save, 
  LayoutTemplate, 
  Type, 
  ZoomIn, 
  ZoomOut, 
  Columns, 
  FileText, 
  Sparkles, 
  Loader2, 
  Check, 
  Wand2, 
  Grid, 
  HelpCircle, 
  MessageSquare, 
  Maximize2, 
  Layers, 
  X, 
  Plus, 
  BookOpen, 
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Eye,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen
} from 'lucide-react';
import { Chapter, FloatingImage, PageLayout, TrimFormat, db } from '../lib/db';
import { MarkdownRenderer } from './MarkdownRenderer';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import { ChapterChat } from './ChapterChat';

interface TypesetLayoutEditorProps {
  chapter: Chapter;
  content: string;
  onContentChange: (newContent: string) => void;
  onUpdateChapter: (chapter: Chapter) => void;
  isGeneratingContent?: boolean;
  isGeneratingImage?: boolean;
  isProofreading?: boolean;
  onGenerateContent?: () => Promise<void>;
  onGenerateImageOfPrompt?: (prompt: string) => Promise<string | null>;
  onProofreadText?: () => void;
  bookTitle?: string;
  language?: string;
}

const FORMATS: Record<TrimFormat, { width: number; height: number; label: string; printLabel: string }> = {
  a4: { width: 794, height: 1123, label: 'A4 (210x297mm)', printLabel: 'A4 Standard' },
  letter: { width: 816, height: 1056, label: 'US Letter (8.5x11")', printLabel: 'US Letter' },
  trade: { width: 576, height: 864, label: 'Trade (6x9")', printLabel: 'Digest 6" x 9"' },
  pocket: { width: 408, height: 660, label: 'Pocket (4.25x6.87")', printLabel: 'Pocket Novel' },
};

const DEFAULT_LAYOUT: PageLayout = {
  marginTop: 48,
  marginBottom: 48,
  marginLeft: 48,
  marginRight: 48,
  format: 'a4',
  fontSize: 16,
  lineHeight: 1.6,
  columns: 1,
  paperStyle: 'warm',
  justifyText: true,
  firstLineIndent: 0,
  paragraphSpacing: 16,
  fontFamily: 'serif',
  dropCaps: false,
  headerPos: 'top-center'
};

const PAGE_GAP = 40; // Gap between sheets on canvas

export function TypesetLayoutEditor({ 
  chapter, 
  content, 
  onContentChange, 
  onUpdateChapter,
  isGeneratingContent = false,
  isGeneratingImage = false,
  isProofreading = false,
  onGenerateContent,
  onGenerateImageOfPrompt,
  onProofreadText,
  bookTitle = '',
  language = 'en',
}: TypesetLayoutEditorProps) {
  const { t, i18n } = useTranslation();
  const { 
    isOutlineSidebarOpen, 
    setIsOutlineSidebarOpen, 
    isRightSidebarOpen, 
    setIsRightSidebarOpen, 
    workspaceMode, 
    setWorkspaceMode,
    zoom,
    setZoom
  } = useStore();
  
  // Load settings
  const [layout, setLayout] = useState<PageLayout>(() => {
    return { ...DEFAULT_LAYOUT, ...chapter.layout };
  });
  const [floatingImages, setFloatingImages] = useState<FloatingImage[]>(chapter.floatingImages || []);
  const [pageCount, setPageCount] = useState(1);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [showGuides, setShowGuides] = useState(true);
  const [activeAssetTab, setActiveAssetTab] = useState<'details' | 'assets' | 'ai'>('ai');
  
  // Direct Block Editing Overlay state
  const [editingBlock, setEditingBlock] = useState<{ index: number; text: string } | null>(null);
  
  // Foldable sidebars & property sections to keep layout clean for major visual areas
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({
    paper: false,        // 一、书籍载体纸张风格
    trim: false,         // 二、拼版规格尺寸规格 (对标 InDesign)
    typography: false,   // 三、字形与文本多栏分段
    bleed: false,        // 四、印刷版心四周留白
    guides: false,       // 五、排版辅助显示
    imgMetrics: false,   // 一、插图尺寸与绝对坐标
    imgAlignment: false, // 二、对齐与图文绕排模式
    imgFilters: false,   // 三、滤镜混合与相框羽化
  });

  const toggleSection = (section: string) => {
    setCollapsedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  const textContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const storyEditorTextareaRef = useRef<HTMLTextAreaElement>(null);

  const formatData = FORMATS[layout.format || 'a4'];
  const columnsCount = layout.columns || 1;
  const paperStyle = layout.paperStyle || 'warm';

  // Paper styling sheets classes
  const paperClasses = {
    warm: 'bg-[#faf6ee] text-[#1c1917] border-amber-900/10',
    white: 'bg-white text-zinc-900 border-zinc-200',
    dark: 'bg-[#18181b] text-zinc-100 border-zinc-800',
    kraft: 'bg-[#e6d0a7] text-[#2c1d11] border-amber-800/20',
    vintage: 'bg-[#f4ebd8] text-[#3e2723] border-[#8d6e63]/30 shadow-[inset_0_0_100px_rgba(141,110,99,0.15)]',
    glossy: 'bg-[#f8f9fa] text-[#212529] border-slate-200',
    newsprint: 'bg-[#e2e2df] text-[#2b2b2b] border-[#bcbcba]',
  };

  const currentLanguage = i18n.language || 'zh';

  // Keep internal states in sync with props changes
  useEffect(() => {
    setLayout({ ...DEFAULT_LAYOUT, ...chapter.layout });
    setFloatingImages(chapter.floatingImages || []);
  }, [chapter.id]);

  // Whenever an image is selected, open right sidebar and show image properties tab
  useEffect(() => {
    if (selectedImageId) {
      setIsRightSidebarOpen(true);
      setActiveAssetTab('details');
    }
  }, [selectedImageId, setIsRightSidebarOpen]);

  // Synchronize layout & images changes automatically back to chapter DB with debounce
  useEffect(() => {
    const timeout = setTimeout(async () => {
      const isLayoutEqual = JSON.stringify(layout) === JSON.stringify({ ...DEFAULT_LAYOUT, ...chapter.layout });
      const isImagesEqual = JSON.stringify(floatingImages) === JSON.stringify(chapter.floatingImages || []);
      
      if (!isLayoutEqual || !isImagesEqual) {
        const updatedChapter = { 
          ...chapter, 
          layout, 
          floatingImages,
          updatedAt: Date.now()
        };
        await db.saveChapter(updatedChapter);
        onUpdateChapter(updatedChapter);
      }
    }, 1200);

    return () => clearTimeout(timeout);
  }, [layout, floatingImages, chapter, onUpdateChapter]);

  // Calculate live multi-column page counts based on text wrapper container scroll dimensions
  useEffect(() => {
    const updatePageCount = () => {
      if (textContainerRef.current) {
        const scrollWidth = textContainerRef.current.scrollWidth;
        const columnFullWidth = formatData.width + PAGE_GAP;
        const count = Math.ceil(scrollWidth / columnFullWidth);
        setPageCount(Math.max(1, count));
      }
    };

    const timeout = setTimeout(updatePageCount, 250);
    const observer = new ResizeObserver(updatePageCount);
    
    if (textContainerRef.current) {
      observer.observe(textContainerRef.current);
    }
    
    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [content, layout, formatData.width, floatingImages]);

  // Add dropped images to virtual workspace and anchor them near the closest text paragraph
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        insertNewFloatingImage(url);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleLayoutChange = (key: keyof PageLayout | 'columns' | 'paperStyle', value: any) => {
    setLayout(prev => ({ ...prev, [key]: value }));
  };

  // Safe insertion of a new floating layout image attached to block flow
  const insertNewFloatingImage = (url: string) => {
    const newImg: FloatingImage = {
      id: uuidv4(),
      url,
      x: 30,
      y: 60,
      width: 280,
      height: 200,
      opacity: 1,
      borderRadius: 8,
      shadow: 'md',
      objectFit: 'cover',
      blendMode: 'normal',
      layoutMode: 'wrap-left', // Floats left of text as default wrapped
      paragraphIndex: 1,      // Anchored to paragraph block #1
    };
    setFloatingImages(prev => [...prev, newImg]);
    setSelectedImageId(newImg.id);
    setActiveAssetTab('details');
    toast.success(currentLanguage === 'zh' ? '已向排版版面中添加插图' : 'Image placed onto layout canvas');
    return newImg.id;
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      insertNewFloatingImage(url);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Double click block on canvas opens block-focused editor overlay immediately
  const handleCanvasBlockDoubleClick = (idx: number, currentText: string) => {
    // Locate block text
    const paragraphs = content.split(/\n\n+/);
    if (idx >= 0 && idx < paragraphs.length) {
      setEditingBlock({
        index: idx,
        text: paragraphs[idx]
      });
    }
  };

  // Slices updated block content back into whole Markdown source stream elegantly
  const saveEditingBlockChanges = () => {
    if (!editingBlock) return;
    const paragraphs = content.split(/\n\n+/);
    if (editingBlock.index >= 0 && editingBlock.index < paragraphs.length) {
      paragraphs[editingBlock.index] = editingBlock.text;
      const joined = paragraphs.join('\n\n');
      onContentChange(joined);
      setEditingBlock(null);
      toast.success(currentLanguage === 'zh' ? '在版段落内容已就地更新' : 'Canvas paragraph edited');
    }
  };

  // Helper stats
  const wordCount = content ? content.trim().length : 0;
  const paragraphCount = content ? content.split(/\n\n+/).filter(Boolean).length : 0;

  // Sync scrolling or line highlight feedback: Click index highlights equivalent section in story editor
  const highlightInStoryPlaceholder = (idx: number) => {
    if (storyEditorTextareaRef.current) {
      const value = storyEditorTextareaRef.current.value;
      const paragraphs = value.split(/\n\n+/);
      let charOffset = 0;
      for (let i = 0; i < idx && i < paragraphs.length; i++) {
        charOffset += paragraphs[i].length + 2; // account for newlines
      }
      
      storyEditorTextareaRef.current.focus();
      storyEditorTextareaRef.current.setSelectionRange(charOffset, charOffset + (paragraphs[idx]?.length || 0));
      storyEditorTextareaRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast.info(currentLanguage === 'zh' ? `已在故事编辑器中定位到第 #${idx} 段` : `Focused text segment #${idx}`);
    }
  };

  return (
    <div className="flex flex-row relative w-full h-full bg-zinc-100 dark:bg-zinc-950 overflow-hidden select-none">
      {/* Central Interactive Panels */}
      <div className="flex flex-col flex-1 relative overflow-hidden h-full">

        {/* Workspace Dual Area Wrapper */}
        <div className="flex-1 flex flex-row overflow-hidden relative bg-[#121214] border-t border-zinc-250 dark:border-zinc-800">
          
          {/* 1. STORY MODE WRITER (Markdown panel) */}
          {(workspaceMode === 'story' || workspaceMode === 'split') && (
            <div 
              className={cn(
                "h-full overflow-hidden flex flex-col bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 transition-all duration-300 select-text",
                workspaceMode === 'story' ? "w-full" : "w-1/2"
              )}
            >
              {/* Writer Header */}
              <div className="h-10 border-b border-zinc-150 dark:border-zinc-850 px-3 md:px-4 bg-zinc-50 dark:bg-zinc-950/45 flex items-center justify-between text-xs text-zinc-400 shrink-0 select-none">
                <span className="font-serif font-medium text-zinc-700 dark:text-zinc-300 truncate mr-2" title={currentLanguage === 'zh' ? '故事原稿草稿' : 'Story Workspace'}>
                  {currentLanguage === 'zh' ? '📝 故事原稿' : '📝 Story Source'}
                </span>
                <span className="font-mono bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 p-1 text-[10px] rounded shrink-0 whitespace-nowrap">
                  {paragraphCount} Blks • {wordCount} Chars
                </span>
              </div>

              {/* Textarea container */}
              <div className="flex-1 relative overflow-y-auto p-4 md:p-6 lg:p-10 select-text">
                <textarea
                  ref={storyEditorTextareaRef}
                  value={content}
                  onChange={(e) => onContentChange(e.target.value)}
                  placeholder={currentLanguage === 'zh' ? '在此处撰写或粘贴 Markdown 章节草稿，变化将实时同步并流向右侧排版页...' : 'Draft chapter text in Markdown. Real-time paginated layout flows on the right sheet...'}
                  className="w-full h-full min-h-[70vh] bg-transparent border-none outline-none resize-none font-sans text-base leading-relaxed text-zinc-800 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none p-0 focus:ring-0 select-text"
                />
                
                {isGeneratingContent && (
                  <div className="absolute inset-0 bg-white/70 dark:bg-zinc-950/70 flex flex-col items-center justify-center p-6 space-y-3">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
                    <p className="text-sm font-semibold text-zinc-650 animate-pulse">
                      {currentLanguage === 'zh' ? 'AI 正在极速构起原稿文章流...' : 'AI writer composition engine working...'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. LIVE DTP PAGINATED CANVAS PANEL */}
          {(workspaceMode === 'dtp' || workspaceMode === 'split') && (
            <div 
              ref={workspaceRef}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => setSelectedImageId(null)}
              className={cn(
                "h-full overflow-auto bg-[#1a1a1e] p-8 flex isolate relative select-none justify-center items-start custom-scroll-dtp",
                workspaceMode === 'dtp' ? "w-full" : "w-1/2"
              )}
            >
              {/* Virtual DTP Drawing board frame - styled with standard desktop backing */}
              <div 
                className="relative transition-transform origin-top-left mx-auto my-6"
                style={{ 
                  transform: `scale(${zoom})`,
                  width: formatData.width + (pageCount - 1) * (formatData.width + PAGE_GAP), 
                  height: formatData.height 
                }}
              >
                {/* Virtual A4 or Trade sheets behind the typesetting columns */}
                {Array.from({ length: pageCount }).map((_, i) => (
                  <div 
                    key={i}
                    className={cn(
                      "absolute shadow-2xl transition-colors duration-450 border flex flex-col",
                      paperClasses[paperStyle]
                    )}
                    style={{
                      top: 0,
                      left: i * (formatData.width + PAGE_GAP),
                      width: formatData.width,
                      height: formatData.height,
                    }}
                  >
                    {/* Visual Bleed Guides & Margins lines typically found in Adobe InDesign */}
                    {showGuides && (
                      <>
                        {/* Trim margin board bounds overlay */}
                        <div 
                          className="absolute border border-blue-400/25 dark:border-blue-500/20 pointer-events-none"
                          style={{
                            top: layout.marginTop,
                            bottom: layout.marginBottom,
                            left: layout.marginLeft,
                            right: layout.marginRight,
                          }}
                        />
                        {/* Bleed outline card corners */}
                        <div className="absolute -top-3 -left-3 w-6 h-px bg-red-400/55 pointer-events-none"></div>
                        <div className="absolute -top-3 -left-3 w-px h-6 bg-red-400/55 pointer-events-none"></div>
                        <div className="absolute -bottom-3 -right-3 w-6 h-px bg-red-400/55 pointer-events-none"></div>
                        <div className="absolute -bottom-3 -right-3 w-px h-6 bg-red-400/55 pointer-events-none"></div>
                      </>
                    )}

                    {/* Auto layout page counters and running headers */}
                    {layout.headerPos !== 'hidden' && (
                      <div 
                        className={cn(
                          "absolute w-full px-12 font-sans text-[10px] tracking-widest uppercase opacity-45 pointer-events-none select-none flex items-center",
                          layout.headerPos?.includes('top') ? 'top-6' : 'bottom-6',
                          i % 2 === 0 ? "justify-end" : "justify-start" // Even pages (left) -> justify-end (often title), Odd pages (right) -> justify-start (often chapter)
                        )}
                        style={{
                          top: layout.headerPos?.includes('top') ? Math.max(12, layout.marginTop / 2.5) : undefined,
                          bottom: layout.headerPos?.includes('bottom') ? Math.max(12, layout.marginBottom / 2.5) : undefined,
                        }}
                      >
                        {layout.headerPos?.includes('center') && (
                          <div className="absolute left-0 right-0 text-center font-serif text-[11px]">{i + 1}</div>
                        )}
                        
                        <div className="w-full flex items-center justify-between">
                          {i % 2 === 0 ? (
                            <>
                              {!layout.headerPos?.includes('center') && <span>{i + 1}</span>}
                              <span className="truncate max-w-[60%]">{bookTitle || 'Untitled Book'}</span>
                            </>
                          ) : (
                            <>
                              <span className="truncate max-w-[60%]">{chapter.title || 'Untitled Chapter'}</span>
                              {!layout.headerPos?.includes('center') && <span>{i + 1}</span>}
                            </>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Main multi-column content pagination flow. Uses CSS multi-column for fully integrated live reflow */}
                <div 
                  ref={textContainerRef}
                  className={cn(
                    "absolute top-0 left-0 h-full w-max cursor-text select-text",
                    paperStyle === 'dark' ? 'text-zinc-100' : 'text-zinc-900'
                  )}
                  style={{
                    columnWidth: formatData.width,
                    columnGap: `${PAGE_GAP}px`,
                    columnFill: 'auto',
                    paddingTop: layout.marginTop,
                    paddingBottom: layout.marginBottom,
                    width: formatData.width + (pageCount - 1) * (formatData.width + PAGE_GAP),
                  }}
                >
                  <div 
                    style={{
                      width: formatData.width - layout.marginLeft - layout.marginRight,
                      marginLeft: layout.marginLeft,
                      marginRight: layout.marginRight,
                      fontSize: `${layout.fontSize || 16}px`,
                      lineHeight: layout.lineHeight || 1.6,
                      columnCount: layout.columns || 1,
                      columnGap: '2em',
                      fontFamily: layout.fontFamily === 'sans' ? 'ui-sans-serif, system-ui, sans-serif' : 
                                  layout.fontFamily === 'mono' ? 'ui-monospace, monospace' : 
                                  'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
                      textAlign: layout.justifyText ? 'justify' : 'left',
                      '--paragraph-spacing': `${layout.paragraphSpacing ?? 16}px`,
                      '--first-line-indent': `${layout.firstLineIndent ?? 0}em`,
                    } as React.CSSProperties}
                    className={cn(
                      "prose max-w-none break-words",
                      paperStyle === 'dark' ? 'prose-invert text-zinc-100' : 'prose-zinc text-zinc-850',
                      layout.dropCaps && "prose-p:first-of-type:first-letter:float-left prose-p:first-of-type:first-letter:text-5xl prose-p:first-of-type:first-letter:font-bold prose-p:first-of-type:first-letter:pr-2 prose-p:first-of-type:first-letter:-mt-1",
                      "[&>p]:mb-[var(--paragraph-spacing)] [&>p]:indent-[var(--first-line-indent)]"
                    )}
                  >
                    <MarkdownRenderer 
                      floatingImages={floatingImages}
                      selectedImageId={selectedImageId}
                      onImageClick={setSelectedImageId}
                      showBlockIndices={true}
                    >
                      {content || ''}
                    </MarkdownRenderer>
                  </div>
                </div>

                {/* Direct Canvas Double-Click Detection Cover overlay */}
                {/* Installs click tracking to map point to Markdown text line index for professional linking */}
                <div 
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                >
                  {Array.from({ length: pageCount }).map((_, pageIdx) => {
                    const pageLeftOffset = pageIdx * (formatData.width + PAGE_GAP);
                    
                    return (
                      <div
                        key={pageIdx}
                        className="absolute pointer-events-auto"
                        style={{
                          top: layout.marginTop,
                          left: pageLeftOffset + layout.marginLeft,
                          width: formatData.width - layout.marginLeft - layout.marginRight,
                          height: formatData.height - layout.marginTop - layout.marginBottom,
                        }}
                        onDoubleClick={(e) => {
                          // Standard DTP logic: detect the paragraph block elements that were double-clicked
                          // To trigger quick inline editor
                          const target = e.target as HTMLElement;
                          const blockEl = target.closest('p, h1, h2, h3, h4, ul, ol, blockquote');
                          if (blockEl) {
                            const blocks = Array.from(textContainerRef.current?.querySelectorAll('p, h1, h2, h3, h4, ul, ol, blockquote') || []);
                            const idx = blocks.indexOf(blockEl);
                            if (idx !== -1) {
                              const blockText = blockEl.textContent || '';
                              handleCanvasBlockDoubleClick(idx, blockText);
                            }
                          }
                        }}
                        onClick={(e) => {
                          const target = e.target as HTMLElement;
                          const blockEl = target.closest('p, h1, h2, h3, h4, ul, ol, blockquote');
                          if (blockEl) {
                            const blocks = Array.from(textContainerRef.current?.querySelectorAll('p, h1, h2, h3, h4, ul, ol, blockquote') || []);
                            const idx = blocks.indexOf(blockEl);
                            if (idx !== -1) {
                              highlightInStoryPlaceholder(idx);
                            }
                          }
                        }}
                        title={currentLanguage === 'zh' ? "💡 双击就地修改文字，单击可在 Markdown 中定位聚焦" : "💡 Double-click to edit inline, click to focus in Markdown Editor"}
                      />
                    );
                  })}
                </div>

                {/* Floating Absolute Images Layer - users can drag these freely inside pages bounds */}
                <div 
                  className="absolute top-0 left-0 w-full h-full pointer-events-none z-10"
                >
                  {floatingImages.filter(img => !img.layoutMode || img.layoutMode === 'absolute').map((img, idx) => (
                    <Rnd
                      key={img.id}
                      size={{ width: img.width, height: img.height }}
                      position={{ x: img.x, y: img.y }}
                      bounds="parent"
                      className={cn(
                        "group pointer-events-auto",
                        selectedImageId === img.id ? "z-30 ring-2 ring-emerald-500 ring-offset-2 scale-[1.01]" : "z-20 hover:scale-[1.005]"
                      )}
                      onDragStart={() => setSelectedImageId(img.id)}
                      onDragStop={(e, d) => {
                        setFloatingImages(prev => prev.map(f => f.id === img.id ? { ...f, x: d.x, y: d.y } : f));
                      }}
                      onResizeStart={() => setSelectedImageId(img.id)}
                      onResizeStop={(e, direction, ref, delta, position) => {
                        setFloatingImages(prev => prev.map(f => f.id === img.id ? { 
                          ...f, 
                          width: parseInt(ref.style.width, 10), 
                          height: parseInt(ref.style.height, 10),
                          ...position 
                        } : f));
                      }}
                    >
                      <div 
                        className="relative w-full h-full group"
                        style={{
                          opacity: img.opacity ?? 1,
                          mixBlendMode: (img.blendMode as any) || 'normal',
                          borderRadius: `${img.borderRadius ?? 8}px`,
                          overflow: 'hidden'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedImageId(img.id);
                        }}
                      >
                        <img 
                          src={img.url} 
                          className="w-full h-full pointer-events-none select-none" 
                          referrerPolicy="no-referrer"
                          style={{ objectFit: (img.objectFit as any) || 'cover' }} 
                        />
                        {/* Bleed guid corners */}
                        {showGuides && (
                          <div className="absolute inset-0 border border-emerald-400/50 pointer-events-none"></div>
                        )}
                      </div>
                    </Rnd>
                  ))}
                </div>

              </div>
            </div>
          )}

        </div>
        {!isRightSidebarOpen && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsRightSidebarOpen(true);
            }}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-5 h-12 bg-white dark:bg-zinc-900 border-y border-l border-zinc-200 dark:border-zinc-800 rounded-l-md shadow-md hover:bg-zinc-50 dark:hover:bg-zinc-800 flex items-center justify-center z-40 group transition-all"
            title={currentLanguage === 'zh' ? '展开右侧属性栏' : 'Expand dimensions panel'}
          >
            <ChevronLeft className="w-4 h-4 text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200" />
          </button>
        )}
      </div>

      {/* Right properties workspace sidebar */}
      <div className={cn(
        "transition-all duration-300 ease-in-out bg-white dark:bg-zinc-900 flex flex-col h-full overflow-hidden shadow-xl z-20 relative",
        isRightSidebarOpen ? "w-80 shrink-0 border-l border-zinc-200 dark:border-zinc-800 opacity-100" : "w-0 border-l-0 shadow-none opacity-0 invisible pointer-events-none"
      )}>
        
        {/* Properties Selector Header Tabs */}
        <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center bg-zinc-50 dark:bg-zinc-950/50 p-1.5 gap-1 shrink-0 overflow-x-auto scrollbar-none [&::-webkit-scrollbar]:hidden">
          <button
            onClick={() => setActiveAssetTab('ai')}
            className={cn(
              "flex-1 min-w-[70px] py-1.5 px-1 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0",
              activeAssetTab === 'ai'
                ? "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 shadow-sm border border-emerald-200/50 dark:border-emerald-800/50"
                : "text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400"
            )}
            title={currentLanguage === 'zh' ? 'AI 智能写作与协助' : 'AI Assistant'}
          >
            <Sparkles className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{currentLanguage === 'zh' ? 'AI助手' : 'AI Assistant'}</span>
          </button>

          <button
            onClick={() => setActiveAssetTab('details')}
            className={cn(
              "flex-1 min-w-[70px] py-1.5 px-1 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0",
              activeAssetTab === 'details'
                ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-sm border border-zinc-200/50 dark:border-zinc-750"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            )}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{selectedImageId ? (currentLanguage === 'zh' ? '图像属性' : 'Image Props') : (currentLanguage === 'zh' ? '版面样式' : 'Layout')}</span>
          </button>
          
          <button
            onClick={() => setActiveAssetTab('assets')}
            className={cn(
              "flex-1 min-w-[70px] py-1.5 px-1 rounded-md text-[11px] font-semibold transition-all flex items-center justify-center gap-1.5 shrink-0",
              activeAssetTab === 'assets'
                ? "bg-white dark:bg-zinc-800 text-zinc-950 dark:text-zinc-50 shadow-sm border border-zinc-200/50 dark:border-zinc-750"
                : "text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"
            )}
          >
            <Layers className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">{currentLanguage === 'zh' ? '媒介图库' : 'Assets'}</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden select-none relative">
          {/* TAB A: DETAILED ATTRIBUTE MODIFIERS */}
          {activeAssetTab === 'details' ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              {selectedImageId ? (() => {
              const img = floatingImages.find(f => f.id === selectedImageId);
              if (!img) return null;

              const updateImg = (updates: Partial<FloatingImage>) => {
                setFloatingImages(prev => prev.map(f => f.id === img.id ? { ...f, ...updates } : f));
              };

              return (
                <div className="space-y-4 animate-fade-in text-xs">
                  
                  {/* Photo dimensions block */}
                  <div className="border border-zinc-150 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/20">
                    <button
                      onClick={() => toggleSection('imgMetrics')}
                      type="button"
                      className="w-full h-9 px-3 flex items-center justify-between text-[11px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 transition-colors"
                    >
                      <span>{currentLanguage === 'zh' ? '一、插图尺寸与绝对坐标' : 'Size & Absolute Frame Metrics'}</span>
                      {collapsedSections.imgMetrics ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {!collapsedSections.imgMetrics && (
                      <div className="p-3 space-y-3 animate-fade-in">
                        <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                          <div className="bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 p-2 rounded flex items-center shadow-inner">
                            <span className="text-zinc-400 mr-1.5 select-none text-[10px]">W:</span>
                            <input 
                              type="number"
                              value={img.width}
                              onChange={e => updateImg({ width: Math.max(20, Number(e.target.value)) })}
                              className="bg-transparent w-full outline-none font-bold text-zinc-850 dark:text-zinc-150 focus:ring-0"
                            />
                          </div>
                          
                          <div className="bg-white dark:bg-zinc-850 border border-zinc-200 dark:border-zinc-700 p-2 rounded flex items-center shadow-inner">
                            <span className="text-zinc-400 mr-1.5 select-none text-[10px]">H:</span>
                            <input 
                              type="number"
                              value={img.height}
                              onChange={e => updateImg({ height: Math.max(20, Number(e.target.value)) })}
                              className="bg-transparent w-full outline-none font-bold text-zinc-850 dark:text-zinc-150 focus:ring-0"
                            />
                          </div>

                          <div className="bg-zinc-100 dark:bg-zinc-900 p-2 rounded text-zinc-500 text-center">X: {Math.round(img.x)} px</div>
                          <div className="bg-zinc-100 dark:bg-zinc-900 p-2 rounded text-zinc-500 text-center font-serif">Fixed Y: {Math.round(img.y)} px</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Text Wrapping alignment presets */}
                  <div className="border border-zinc-150 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/20">
                    <button
                      onClick={() => toggleSection('imgAlignment')}
                      type="button"
                      className="w-full h-9 px-3 flex items-center justify-between text-[11px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 transition-colors"
                    >
                      <span>{currentLanguage === 'zh' ? '二、对齐与图文绕排模式' : 'Text Wrap & Grid Presets'}</span>
                      {collapsedSections.imgAlignment ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {!collapsedSections.imgAlignment && (
                      <div className="p-3 space-y-3 animate-fade-in">
                        <div className="grid grid-cols-2 gap-1.5">
                          {[
                            { id: 'absolute', label: currentLanguage === 'zh' ? '页面绝对浮动' : 'Absolute Stamp', desc: currentLanguage === 'zh' ? '置于文字上方自由拖拽' : 'Stamp over pages' },
                            { id: 'wrap-left', label: currentLanguage === 'zh' ? '文字环绕靠左' : 'Left Wrap', desc: currentLanguage === 'zh' ? '靠左，文字向右环绕' : 'Align left flow' },
                            { id: 'wrap-right', label: currentLanguage === 'zh' ? '文字环绕靠右' : 'Right Wrap', desc: currentLanguage === 'zh' ? '靠右，文字向左环绕' : 'Align right flow' },
                            { id: 'wrap-center', label: currentLanguage === 'zh' ? '中央上下绕排' : 'Centered Wrap', desc: currentLanguage === 'zh' ? '单独居中，防止穿插' : 'Independent block' },
                            { id: 'full-width', label: currentLanguage === 'zh' ? '通栏铺满列宽' : 'Full Width', desc: currentLanguage === 'zh' ? '适配整个编辑版心' : 'Spans grid' }
                          ].map(mode => (
                            <button
                              key={mode.id}
                              type="button"
                              onClick={() => updateImg({ layoutMode: mode.id as any })}
                              className={cn(
                                "text-left p-2 rounded-lg border transition-all duration-150",
                                (img.layoutMode || 'absolute') === mode.id
                                  ? "bg-emerald-50 border-emerald-550 text-emerald-950 dark:bg-emerald-950/20 dark:border-emerald-500 dark:text-emerald-350"
                                  : "bg-white dark:bg-zinc-950 border-zinc-205 dark:border-zinc-800 text-zinc-650 hover:border-zinc-350 dark:text-zinc-450"
                              )}
                            >
                              <div className="text-[11px] font-semibold">{mode.label}</div>
                              <div className="text-[9px] opacity-70 mt-0.5 line-clamp-1">{mode.desc}</div>
                            </button>
                          ))}
                        </div>

                        {img.layoutMode && img.layoutMode !== 'absolute' && (
                          <div className="p-3 bg-white dark:bg-zinc-950 rounded-xl border border-zinc-200/60 dark:border-zinc-850">
                            <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1.5">{currentLanguage === 'zh' ? '锚接依附段落编号' : 'Paragraph Anchor Bond'}</label>
                            <div className="flex items-center gap-1">
                              <button 
                                type="button"
                                onClick={() => updateImg({ paragraphIndex: Math.max(0, (img.paragraphIndex || 0) - 1) })}
                                className="p-1 px-2.5 bg-white dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-750 rounded-md text-xs font-semibold hover:bg-zinc-50"
                              >
                                Prev
                              </button>
                              <input 
                                type="number"
                                value={img.paragraphIndex || 0}
                                onChange={e => updateImg({ paragraphIndex: Math.max(0, Number(e.target.value)) })}
                                className="w-full text-center text-xs font-mono font-bold bg-transparent outline-none ring-0 border-none"
                              />
                              <button 
                                type="button"
                                onClick={() => updateImg({ paragraphIndex: (img.paragraphIndex || 0) + 1 })}
                                className="p-1 px-2.5 bg-white dark:bg-zinc-800 border border-zinc-250 dark:border-zinc-750 rounded-md text-xs font-semibold hover:bg-zinc-50"
                              >
                                Next
                              </button>
                            </div>
                            <p className="text-[9px] text-zinc-400 mt-1.5 text-center">
                              {currentLanguage === 'zh' ? '调整编号可使图像在文档不同段落间上下流转' : 'Slide anchor count to shift illustration sequence'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fine Frame details */}
                  <div className="border border-zinc-150 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/20">
                    <button
                      onClick={() => toggleSection('imgFilters')}
                      type="button"
                      className="w-full h-9 px-3 flex items-center justify-between text-[11px] font-bold text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 transition-colors"
                    >
                      <span>{currentLanguage === 'zh' ? '三、滤镜混合与相框羽化' : 'Filters, Blending & Opacity'}</span>
                      {collapsedSections.imgFilters ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </button>
                    {!collapsedSections.imgFilters && (
                      <div className="p-3 space-y-3.5 animate-fade-in">
                        {/* Opacity range slider */}
                        <div>
                          <div className="text-[10px] text-zinc-400 flex justify-between font-mono mb-1">
                            <span>Opacity</span>
                            <span>{Math.round((img.opacity ?? 1) * 100)}%</span>
                          </div>
                          <input 
                            type="range"
                            min="0"
                            max="1"
                            step="0.05"
                            value={img.opacity ?? 1}
                            onChange={e => updateImg({ opacity: Number(e.target.value) })}
                            className="w-full accent-emerald-555 h-1 bg-zinc-200 dark:bg-zinc-800 rounded-lg cursor-pointer"
                          />
                        </div>

                        {/* Blend Mode selector */}
                        <div>
                          <label className="text-[10px] font-medium text-zinc-400 block mb-1">{currentLanguage === 'zh' ? '图片重叠混合层模式' : 'Blend Mode filter'}</label>
                          <select 
                            value={img.blendMode || 'normal'}
                            onChange={e => updateImg({ blendMode: e.target.value })}
                            className="w-full text-xs p-2 bg-white dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 pointer-events-auto"
                          >
                            <option value="normal">Normal</option>
                            <option value="multiply">Multiply (叠加深色)</option>
                            <option value="screen">Screen (剔除黑色)</option>
                            <option value="overlay">Overlay (高反温和)</option>
                            <option value="darken">Darken</option>
                            <option value="lighten">Lighten</option>
                            <option value="color-dodge">Color Dodge</option>
                            <option value="color-burn">Color Burn</option>
                          </select>
                        </div>

                        {/* Crop aspect fill selector */}
                        <div>
                          <label className="text-[10px] font-medium text-zinc-400 block mb-1">{currentLanguage === 'zh' ? '图片相框拉伸裁切' : 'Object Frame Crop'}</label>
                          <select 
                            value={img.objectFit || 'cover'}
                            onChange={e => updateImg({ objectFit: e.target.value as any })}
                            className="w-full text-xs p-2 bg-white dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 pointer-events-auto"
                          >
                            <option value="cover">Cover (智能居中裁切填充)</option>
                            <option value="contain">Contain (保持原始长宽比缩放)</option>
                            <option value="fill">Fill (拉伸填满)</option>
                          </select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-medium text-zinc-400 block mb-1">{currentLanguage === 'zh' ? '相框圆角化 (px)' : 'Border radius'}</label>
                            <input 
                              type="number"
                              value={img.borderRadius ?? 8}
                              onChange={e => updateImg({ borderRadius: Math.max(0, Number(e.target.value)) })}
                              className="w-full text-xs p-2 bg-white dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800"
                            />
                          </div>

                          <div>
                            <label className="text-[10px] font-medium text-zinc-400 block mb-1">{currentLanguage === 'zh' ? '阴影立体感' : 'Shadow strength'}</label>
                            <select 
                              value={img.shadow || 'none'}
                              onChange={e => updateImg({ shadow: e.target.value })}
                              className="w-full text-xs p-2 bg-white dark:bg-[#111113] rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 pointer-events-auto"
                            >
                              <option value="none">None</option>
                              <option value="sm">Small</option>
                              <option value="md">Paper Depth</option>
                              <option value="lg">Elevated</option>
                              <option value="xl">Classic Poster</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  <hr className="border-zinc-250 dark:border-zinc-800" />

                  {/* Remove and Deselect */}
                  <div className="pt-2 text-center flex flex-col gap-2">
                    <button
                      onClick={() => setSelectedImageId(null)}
                      className="w-full py-1.5 hover:bg-zinc-150 border border-zinc-200 dark:border-zinc-800 dark:hover:bg-zinc-800/80 rounded-md text-xs font-semibold text-zinc-650 dark:text-zinc-400 transition-colors pointer-events-auto shadow-sm"
                    >
                      {currentLanguage === 'zh' ? '取消选择该插图 (ESC)' : 'Deselect Illustration'}
                    </button>
                    <button 
                      onClick={async () => {
                        const targetUrl = img.url;
                        setFloatingImages(prev => prev.filter(f => f.id !== selectedImageId));
                        setSelectedImageId(null);
                        
                        // Check if this image matches chapter.image and clear it to ensure consistency across live preview and DB
                        if (chapter.image === targetUrl) {
                          const updatedChapter = {
                            ...chapter,
                            image: undefined,
                            updatedAt: Date.now()
                          };
                          await db.saveChapter(updatedChapter);
                          onUpdateChapter(updatedChapter);
                        }
                        
                        toast.error(currentLanguage === 'zh' ? '该插图已从章节及其版面完全移除' : 'Removed asset completely');
                      }}
                      className="w-full py-1.5 hover:bg-red-50 text-red-600 dark:hover:bg-red-950/20 rounded-md text-xs font-bold transition-all pointer-events-auto"
                    >
                      {currentLanguage === 'zh' ? '⚠️ 从章节中删除该插图' : '🗑️ Delete Image From Paper'}
                    </button>
                  </div>

                </div>
              );
            })() : (
              // DEFAULT SCREEN IF NO IMAGE SELECTED: PAGE/TRIM METRICS EDITING (MIMICKING ADOBE PROPERTIES PANEL)
              <div className="space-y-4 animate-fade-in text-xs">
                
                {/* Visual Preset Selection (Antique vs Dark Velvet etc) */}
                <div className="border border-zinc-150 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/20">
                  <button
                    onClick={() => toggleSection('paper')}
                    type="button"
                    className="w-full h-9 px-3 flex items-center justify-between text-[11px] font-bold text-zinc-500 hover:text-zinc-805 dark:hover:text-zinc-200 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 transition-colors"
                  >
                    <span>{currentLanguage === 'zh' ? '一、书籍载体纸张风格' : 'Paper Aesthetics Preset'}</span>
                    {collapsedSections.paper ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {!collapsedSections.paper && (
                    <div className="p-3 space-y-2 animate-fade-in max-h-60 overflow-y-auto">
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { id: 'warm', label: currentLanguage === 'zh' ? '墨香雅黄' : 'Antique Warm', desc: 'Cream paper [#faf6ee]' },
                          { id: 'white', label: currentLanguage === 'zh' ? '现代冷白' : 'Office White', desc: 'Crisp sheet [#ffffff]' },
                          { id: 'dark', label: currentLanguage === 'zh' ? '玄色沉浸' : 'Ink Noir', desc: 'Dark board [#18181b]' },
                          { id: 'kraft', label: currentLanguage === 'zh' ? '原生牛皮纸' : 'Kraft Board', desc: 'Paper pulp [#e6a7e5]' },
                          { id: 'vintage', label: currentLanguage === 'zh' ? '古典羊皮纸' : 'Vintage Parchment', desc: 'Aged & Textural' },
                          { id: 'glossy', label: currentLanguage === 'zh' ? '铜版亮光纸' : 'Glossy Art Paper', desc: 'Sleek & Cool' },
                          { id: 'newsprint', label: currentLanguage === 'zh' ? '廉价新闻纸' : 'Newsprint Pulp', desc: 'Gritty & Rough' }
                        ].map(theme => (
                          <button
                            key={theme.id}
                            type="button"
                            onClick={() => handleLayoutChange('paperStyle', theme.id)}
                            className={cn(
                              "p-2 rounded-lg border text-left transition-all",
                              paperStyle === theme.id
                                ? "bg-emerald-50/80 border-emerald-500 text-emerald-950 dark:bg-emerald-950/10 dark:border-emerald-500 dark:text-zinc-100 shadow-sm"
                                : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-650 hover:border-zinc-350 dark:text-zinc-400"
                            )}
                          >
                            <div className="text-[11px] font-bold">{theme.label}</div>
                            <div className="text-[9px] opacity-70 mt-1">{theme.desc}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Trim Dimensions and Headers */}
                <div className="border border-zinc-150 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/20">
                  <button
                    onClick={() => toggleSection('trim')}
                    type="button"
                    className="w-full h-9 px-3 flex items-center justify-between text-[11px] font-bold text-zinc-500 hover:text-zinc-805 dark:hover:text-zinc-200 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 transition-colors"
                  >
                    <div className="flex items-center gap-1.5">
                      <span>{currentLanguage === 'zh' ? '二、拼版与书眉位置' : 'Editorial Slices & Folios'}</span>
                      <span title="Corresponds to standard printing book page dimensions.">
                        <HelpCircle className="w-3.5 h-3.5 text-zinc-400" />
                      </span>
                    </div>
                    {collapsedSections.trim ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {!collapsedSections.trim && (
                    <div className="p-3 space-y-3 animate-fade-in max-h-56 overflow-y-auto">
                      <div className="space-y-1.5">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 block">{currentLanguage === 'zh' ? '物理开本规格' : 'Trim Size Formats'}</label>
                        {(Object.keys(FORMATS) as TrimFormat[]).map((f) => (
                          <button
                            key={f}
                            type="button"
                            onClick={() => handleLayoutChange('format', f)}
                            className={cn(
                              "w-full text-left p-2 rounded-md border transition-all flex justify-between items-center",
                              layout.format === f 
                                ? "bg-zinc-100 dark:bg-zinc-805 border-zinc-400 dark:border-zinc-700 ring-1 ring-zinc-500 shadow-sm"
                                : "bg-white dark:bg-zinc-950 border-zinc-200 dark:border-gray-850 hover:border-zinc-300 dark:hover:border-zinc-750"
                            )}
                          >
                            <div>
                              <div className="font-bold text-zinc-900 dark:text-zinc-100">{FORMATS[f].label}</div>
                              <div className="text-[9px] text-zinc-400 mt-0.5">{f === 'pocket' ? 'Standard Novel size' : 'Classic Publishing canvas'}</div>
                            </div>
                            <span className="font-mono text-[9px] opacity-70 bg-zinc-200 dark:bg-zinc-900 p-1 rounded">
                              {FORMATS[f].width} × {FORMATS[f].height} px
                            </span>
                          </button>
                        ))}
                      </div>
                      
                      <div className="space-y-1.5 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <label className="text-[10px] uppercase font-bold text-zinc-400 block">{currentLanguage === 'zh' ? '书眉页码格式' : 'Running Headers & Folios'}</label>
                        <select 
                          value={layout.headerPos || 'top-center'}
                          onChange={e => handleLayoutChange('headerPos', e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300"
                        >
                          <option value="hidden">Hidden {currentLanguage === 'zh' ? '(无书眉)' : ''}</option>
                          <option value="top-center">Top Center {currentLanguage === 'zh' ? '(顶部居中)' : ''}</option>
                          <option value="top-outside">Top Outside {currentLanguage === 'zh' ? '(顶部门外侧)' : ''}</option>
                          <option value="bottom-center">Bottom Center {currentLanguage === 'zh' ? '(底部居中)' : ''}</option>
                          <option value="bottom-outside">Bottom Outside {currentLanguage === 'zh' ? '(底部门外侧)' : ''}</option>
                        </select>
                      </div>
                    </div>
                  )}
                </div>

                {/* Typography specs (Print grade) */}
                <div className="border border-zinc-150 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/20">
                  <button
                    onClick={() => toggleSection('typography')}
                    type="button"
                    className="w-full h-9 px-3 flex items-center justify-between text-[11px] font-bold text-zinc-500 hover:text-zinc-805 dark:hover:text-zinc-200 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 transition-colors"
                  >
                    <span>{currentLanguage === 'zh' ? '三、字形与文本多栏分段' : 'DTP Typography & Layout'}</span>
                    {collapsedSections.typography ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {!collapsedSections.typography && (
                    <div className="p-3 space-y-4 animate-fade-in">
                      
                      {/* Font Family selection */}
                      <div>
                        <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">{currentLanguage === 'zh' ? '书刊字体性格' : 'Typeface Family'}</label>
                        <select 
                          value={layout.fontFamily || 'serif'}
                          onChange={e => handleLayoutChange('fontFamily', e.target.value)}
                          className="w-full text-xs p-2 bg-white dark:bg-zinc-950 rounded-md border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 font-serif"
                        >
                          <option value="serif">Classical Serif {currentLanguage === 'zh' ? '(经典衬线体)' : ''}</option>
                          <option value="sans">Modern Sans {currentLanguage === 'zh' ? '(现代无衬线体)' : ''}</option>
                          <option value="mono">Typewriter/Mono {currentLanguage === 'zh' ? '(等宽打字机)' : ''}</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">{currentLanguage === 'zh' ? '基础字号 (px)' : 'Base Font Size'}</label>
                          <input 
                            type="number"
                            value={layout.fontSize || 16}
                            onChange={e => handleLayoutChange('fontSize', Math.max(10, Number(e.target.value)))}
                            className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">{currentLanguage === 'zh' ? '行间距比例' : 'Line Spacing'}</label>
                          <input 
                            type="number"
                            step="0.1"
                            value={layout.lineHeight || 1.6}
                            onChange={e => handleLayoutChange('lineHeight', Math.max(1.0, Number(e.target.value)))}
                            className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-md"
                          />
                        </div>
                      </div>

                      {/* Advanced Paragraph formats */}
                      <div className="grid grid-cols-2 gap-3 text-xs border-t border-zinc-200 dark:border-zinc-800 pt-3">
                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">{currentLanguage === 'zh' ? '首行缩进 (em)' : 'First Line Indent'}</label>
                          <input 
                            type="number"
                            step="1"
                            value={layout.firstLineIndent ?? 0}
                            onChange={e => handleLayoutChange('firstLineIndent', Math.max(0, Number(e.target.value)))}
                            className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] uppercase font-bold text-zinc-400 block mb-1">{currentLanguage === 'zh' ? '段间距 (px)' : 'Para Spacing'}</label>
                          <input 
                            type="number"
                            value={layout.paragraphSpacing ?? 16}
                            onChange={e => handleLayoutChange('paragraphSpacing', Math.max(0, Number(e.target.value)))}
                            className="w-full p-2 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded-md"
                          />
                        </div>
                      </div>

                      <div className="flex flex-col gap-2 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <label className="flex items-center justify-between p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-850 transition-colors">
                          <div className="flex flex-col">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">{currentLanguage === 'zh' ? '段落两端对齐' : 'Justify Text Format'}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={layout.justifyText !== false}
                            onChange={(e) => handleLayoutChange('justifyText', e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-zinc-55 border-zinc-305"
                          />
                        </label>
                        
                        <label className="flex items-center justify-between p-2 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-200 dark:hover:bg-zinc-850 transition-colors">
                          <div className="flex flex-col">
                            <span className="font-semibold text-zinc-700 dark:text-zinc-300 text-[11px]">{currentLanguage === 'zh' ? '开启首字下沉 (Drop Caps)' : 'Enable Drop Caps'}</span>
                          </div>
                          <input
                            type="checkbox"
                            checked={!!layout.dropCaps}
                            onChange={(e) => handleLayoutChange('dropCaps', e.target.checked)}
                            className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-zinc-55 border-zinc-305"
                          />
                        </label>
                      </div>

                      {/* Columns Presets - fully professional */}
                      <div className="pt-2 border-t border-zinc-200 dark:border-zinc-800">
                        <label className="text-[10px] uppercase font-bold text-zinc-405 block mb-1.5 flex justify-between">
                          <span>{currentLanguage === 'zh' ? '画板分栏数' : 'Page Columns Count'}</span>
                          <span className="font-mono text-emerald-500 font-bold">{columnsCount} Col{columnsCount > 1 && 's'}</span>
                        </label>
                        <div className="grid grid-cols-3 gap-1 p-1 bg-zinc-100 dark:bg-zinc-950 rounded-lg">
                          {[1, 2, 3].map(col => (
                            <button
                              key={col}
                              type="button"
                              onClick={() => handleLayoutChange('columns', col)}
                              className={cn(
                                "py-1 text-xs font-semibold rounded-md transition-all duration-150",
                                columnsCount === col
                                  ? "bg-white dark:bg-zinc-805 text-zinc-900 dark:text-zinc-50 shadow-sm"
                                  : "text-zinc-500 hover:text-zinc-800"
                              )}
                            >
                              {col === 1 ? '1 Col' : col === 2 ? '2 Cols' : '3 Cols'}
                            </button>
                          ))}
                        </div>
                      </div>

                    </div>
                  )}
                </div>

                {/* Bleed padding and margins inputs */}
                <div className="border border-zinc-150 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/20">
                  <button
                    onClick={() => toggleSection('bleed')}
                    type="button"
                    className="w-full h-9 px-3 flex items-center justify-between text-[11px] font-bold text-zinc-500 hover:text-zinc-855 dark:hover:text-zinc-200 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 transition-colors"
                  >
                    <span>{currentLanguage === 'zh' ? '四、印刷版心四周留白' : 'Page Margins Slices (px)'}</span>
                    {collapsedSections.bleed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {!collapsedSections.bleed && (
                    <div className="p-3 space-y-2 animate-fade-in">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <label className="text-[10px] text-zinc-400 mr-1">Top:</label>
                          <input 
                            type="number"
                            value={layout.marginTop}
                            min="0"
                            onChange={e => handleLayoutChange('marginTop', Number(e.target.value))}
                            className="w-full text-xs p-1.5 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded"
                          />
                        </div>
                        
                        <div>
                          <label className="text-[10px] text-zinc-400 mr-1">Bottom:</label>
                          <input 
                            type="number"
                            value={layout.marginBottom}
                            min="0"
                            onChange={e => handleLayoutChange('marginBottom', Number(e.target.value))}
                            className="w-full text-xs p-1.5 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 mr-1">Left:</label>
                          <input 
                            type="number"
                            value={layout.marginLeft}
                            min="0"
                            onChange={e => handleLayoutChange('marginLeft', Number(e.target.value))}
                            className="w-full text-xs p-1.5 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded"
                          />
                        </div>

                        <div>
                          <label className="text-[10px] text-zinc-400 mr-1">Right:</label>
                          <input 
                            type="number"
                            value={layout.marginRight}
                            min="0"
                            onChange={e => handleLayoutChange('marginRight', Number(e.target.value))}
                            className="w-full text-xs p-1.5 bg-white dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-850 rounded"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Guides and Helpers display option */}
                <div className="border border-zinc-150 dark:border-zinc-800 rounded-lg overflow-hidden bg-zinc-50/50 dark:bg-zinc-950/20">
                  <button
                    onClick={() => toggleSection('guides')}
                    type="button"
                    className="w-full h-9 px-3 flex items-center justify-between text-[11px] font-bold text-zinc-500 hover:text-zinc-855 dark:hover:text-zinc-200 uppercase tracking-wider bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 transition-colors"
                  >
                    <span>{currentLanguage === 'zh' ? '五、排版辅助显示' : 'DTP Guideline Helpers'}</span>
                    {collapsedSections.guides ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {!collapsedSections.guides && (
                    <div className="p-3 space-y-2 animate-fade-in">
                      <label className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 cursor-pointer hover:bg-zinc-100/50 dark:hover:bg-zinc-900/50 transition-colors">
                        <span className="font-medium text-zinc-750 dark:text-zinc-300">
                          {currentLanguage === 'zh' ? '显示排版网格和基准辅助线' : 'Display Columns & Gridlines'}
                        </span>
                        <input
                          type="checkbox"
                          checked={showGuides}
                          onChange={(e) => setShowGuides(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-zinc-55 border-zinc-305 dark:bg-zinc-900 dark:border-zinc-750"
                        />
                      </label>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-zinc-50 dark:bg-zinc-955 rounded-xl text-[10px] text-zinc-450 font-serif leading-normal border border-zinc-200/50 dark:border-zinc-850/50">
                  {currentLanguage === 'zh'
                    ? "💡 想要极致的图文混排？拖拽本地图片到中央画板，或点击「插图栏」为它们设置 Float (文字环绕) 或 Absolute 自由盖贴即可！"
                    : "💡 To arrange floating illustrations, drag any picture file in, select it and apply float wrapping and custom margin anchor positions."}
                </div>

              </div>
            )
            }
            </div>
          ) : activeAssetTab === 'assets' ? (
            // TAB B: ASSET STORAGE RACK (COHERENCE CONTROL PANEL)
            <div className="flex-1 overflow-y-auto p-4 space-y-5 animate-fade-in text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-zinc-400 uppercase tracking-widest block">{currentLanguage === 'zh' ? '章节配图一览' : 'Chapter Images Shelf'}</span>
                <span className="font-mono text-[9px] bg-zinc-100 dark:bg-zinc-950 p-1 px-2 rounded-full text-zinc-500">
                  {floatingImages.length} {floatingImages.length === 1 ? 'Asset' : 'Assets'}
                </span>
              </div>

              {/* Local Desk Asset inserter */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-700 dark:text-zinc-250 rounded-lg transition-all border border-zinc-200 dark:border-zinc-700"
                title={currentLanguage === 'zh' ? '添加排版本地照片' : 'Add custom image file'}
              >
                <ImagePlus className="w-4 h-4 text-emerald-500" />
                <span>{currentLanguage === 'zh' ? '上传置入本地插图' : 'Upload Local Image'}</span>
              </button>
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />

              {/* Master chapter cover/hero image links */}
              {chapter.image && (
                <div className="p-3 bg-emerald-50/40 dark:bg-emerald-950/10 border border-emerald-500/20 rounded-xl space-y-2">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-serif font-bold text-emerald-800 dark:text-emerald-400 text-[11px]">Cover Illustration (Linked)</span>
                    <span className="bg-emerald-600 text-white rounded px-1.5 text-[8px] font-bold uppercase tracking-wider">Chapter Cover</span>
                  </div>
                  <div className="aspect-video relative rounded-lg overflow-hidden border border-emerald-500/30">
                    <img src={chapter.image} className="w-full h-full object-cover select-none" referrerPolicy="no-referrer" />
                  </div>
                  
                  {/* Verify link state */}
                  {floatingImages.some(img => img.url === chapter.image) ? (
                    <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-serif flex items-center gap-1 bg-white/20 dark:bg-black/20 p-2 rounded">
                      <Check className="w-3.5 h-3.5 shrink-0" />
                      <span>{currentLanguage === 'zh' ? '已链接同步并置于画板上流式环绕' : 'Synced & rendering on virtual sheets.'}</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => insertNewFloatingImage(chapter.image!)}
                      className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg transition-transform text-[10px]"
                    >
                      {currentLanguage === 'zh' ? '置入本书推荐图到 DTP 画板流中' : 'Import image onto typeset paper'}
                    </button>
                  )}
                </div>
              )}

              {/* Asset grid lists */}
              {floatingImages.length === 0 ? (
                <div className="border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl p-8 text-center text-zinc-400">
                  <ImagePlus className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                  <p className="text-[10px]">{currentLanguage === 'zh' ? '此章节尚无媒体图像数据。点击上方的插图按钮来丰富内容吧！' : 'No photo assets placed in this chapter yet.'}</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold block">{currentLanguage === 'zh' ? '当前章节画板元素树' : 'Placed Illustrations'}</span>
                  <div className="grid grid-cols-2 gap-2">
                    {floatingImages.map((img, idx) => {
                      const isSelected = selectedImageId === img.id;
                      
                      return (
                        <div 
                          key={img.id}
                          onClick={() => {
                            setSelectedImageId(img.id);
                            setActiveAssetTab('details');
                          }}
                          className={cn(
                            "cursor-pointer group p-2 rounded-lg border text-left transition-all relative overflow-hidden bg-zinc-50 dark:bg-zinc-950",
                            isSelected
                              ? "border-emerald-500 bg-emerald-100/10 dark:bg-[#111812]"
                              : "border-zinc-200 dark:border-zinc-800 hover:border-zinc-350"
                          )}
                        >
                          <div className="aspect-video relative rounded overflow-hidden mb-1 border border-zinc-200 dark:border-zinc-800 bg-black/10">
                            <img src={img.url} className="w-full h-full object-cover select-none" referrerPolicy="no-referrer" />
                          </div>
                          
                          <div className="text-[10px] font-bold text-zinc-700 dark:text-zinc-300 truncate">
                            {img.layoutMode === 'absolute' ? 'Absolute Overlay' : `Flow Anchor #${img.paragraphIndex || 0}`}
                          </div>
                          <div className="text-[8px] text-zinc-400 mt-0.5 font-mono line-clamp-1">{img.layoutMode || 'absolute'}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : activeAssetTab === 'ai' ? (
            <div className="flex-1 flex flex-col h-full overflow-hidden">
              <ChapterChat
                content={content}
                chapterTitle={chapter.title}
                bookTitle={bookTitle}
                language={language}
                onApplyContent={(newContent) => {
                  onContentChange(newContent);
                }}
                onClose={() => setIsRightSidebarOpen(false)}
                onGenerateContent={onGenerateContent}
                isGeneratingContent={isGeneratingContent}
                onProofreadText={onProofreadText}
                isProofreading={isProofreading}
                onGenerateImageOfPrompt={onGenerateImageOfPrompt}
                onAddImageToLayout={(url) => {
                   const imgId = insertNewFloatingImage(url);
                   setSelectedImageId(imgId);
                   setActiveAssetTab('details');
                }}
              />
            </div>
          ) : null}

        </div>
      </div>

      {/* QUICK FLOATING TEXT EDIT DIALOG (MAGIC DESK DIRECT EDIT COGNOSCENTI STYLE) */}
      {editingBlock && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4 antialiased select-text">
          <div className="bg-white dark:bg-zinc-900 rounded-xl shadow-2xl w-full max-w-xl flex flex-col overflow-hidden border border-zinc-200 dark:border-zinc-800 animate-scale-up select-text">
            
            <div className="p-4 border-b border-zinc-150 dark:border-zinc-800 flex items-center justify-between bg-zinc-50 dark:bg-zinc-950/40 select-none">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-xs font-bold font-serif text-zinc-700 dark:text-zinc-200">
                  {currentLanguage === 'zh' ? `就地极速排版编辑：第 #${editingBlock.index} 文本段落` : `Direct Canvas Edit: Paragraph #${editingBlock.index}`}
                </span>
              </div>
              <button 
                onClick={() => setEditingBlock(null)}
                className="text-zinc-400 hover:text-zinc-650 dark:hover:text-zinc-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 flex-1 select-text">
              <textarea
                value={editingBlock.text}
                onChange={e => setEditingBlock(prev => prev ? { ...prev, text: e.target.value } : null)}
                className="w-full min-h-[160px] p-3 text-base font-serif bg-zinc-50 dark:bg-zinc-950 rounded-lg outline-none resize-none border border-zinc-200 focus:border-emerald-500 dark:border-zinc-800 dark:focus:border-emerald-600 transition-colors select-text"
              />
              <p className="text-[10px] text-zinc-400 mt-2">
                {currentLanguage === 'zh' ? "💡 完美支持所有标准 Markdown 文本及 LaTeX 语法，修改保存后书籍画板将实时进行多列拼版！" : "Any syntax layout updates will automatically recalculate wraps and page distribution on saving."}
              </p>
            </div>

            <div className="p-3 border-t border-zinc-150 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/40 flex justify-end gap-2 select-none">
              <button
                onClick={() => setEditingBlock(null)}
                className="px-4 py-1.5 text-xs font-semibold text-zinc-650 hover:bg-zinc-150 rounded"
              >
                {currentLanguage === 'zh' ? '取消' : 'Cancel'}
              </button>
              
              <button
                onClick={saveEditingBlockChanges}
                className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 text-white rounded hover:bg-emerald-700 shadow-sm transition-colors"
              >
                {currentLanguage === 'zh' ? '应用段落实时变化' : 'Apply Block Changes'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
