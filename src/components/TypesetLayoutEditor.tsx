import React, { useState, useRef, useEffect } from 'react';
import { Rnd } from 'react-rnd';
import { Settings, ImagePlus, Save, LayoutTemplate, Type, ZoomIn, ZoomOut } from 'lucide-react';
import { Chapter, FloatingImage, PageLayout, TrimFormat, db } from '../lib/db';
import { MarkdownRenderer } from './MarkdownRenderer';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '../lib/utils';

interface TypesetLayoutEditorProps {
  chapter: Chapter;
  content: string;
  onUpdateChapter: (chapter: Chapter) => void;
}

const FORMATS: Record<TrimFormat, { width: number; height: number; label: string }> = {
  a4: { width: 794, height: 1123, label: 'A4 (210x297mm)' },
  letter: { width: 816, height: 1056, label: 'US Letter (8.5x11")' },
  trade: { width: 576, height: 864, label: 'Trade (6x9")' },
  pocket: { width: 408, height: 660, label: 'Pocket (4.25x6.87")' },
};

const DEFAULT_LAYOUT: PageLayout = {
  marginTop: 48,
  marginBottom: 48,
  marginLeft: 48,
  marginRight: 48,
  format: 'a4',
  fontSize: 16,
  lineHeight: 1.6,
};

const PAGE_GAP = 40; // Gap between pages in the viewer

export function TypesetLayoutEditor({ chapter, content, onUpdateChapter }: TypesetLayoutEditorProps) {
  const { t } = useTranslation();
  const [layout, setLayout] = useState<PageLayout>({ ...DEFAULT_LAYOUT, ...chapter.layout });
  const [floatingImages, setFloatingImages] = useState<FloatingImage[]>(chapter.floatingImages || []);
  const [zoom, setZoom] = useState(0.8);
  const [pageCount, setPageCount] = useState(1);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  
  const textContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const workspaceRef = useRef<HTMLDivElement>(null);

  const formatData = FORMATS[layout.format || 'a4'];

  useEffect(() => {
    // Expose API for devtools / AI
    (window as any).__addFloatingImage = (url: string, width: number = 200, height: number = 200) => {
      const newImg: FloatingImage = {
        id: uuidv4(),
        url,
        x: 100,
        y: 100,
        width,
        height,
        opacity: 1,
        borderRadius: 0,
        shadow: 'none',
        objectFit: 'cover',
        blendMode: 'normal',
        layoutMode: 'wrap-left',
        paragraphIndex: 0,
      };
      setFloatingImages(prev => [...prev, newImg]);
      setSelectedImageId(newImg.id);
    };
    return () => {
      delete (window as any).__addFloatingImage;
    };
  }, []);

  useEffect(() => {
    setLayout({ ...DEFAULT_LAYOUT, ...chapter.layout });
    setFloatingImages(chapter.floatingImages || []);
  }, [chapter.id]);

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
    }, 1000);

    return () => clearTimeout(timeout);
  }, [layout, floatingImages, chapter, onUpdateChapter]);

  // Calculate page count based on scroll width of the column container
  useEffect(() => {
    const updatePageCount = () => {
      if (textContainerRef.current) {
        const scrollWidth = textContainerRef.current.scrollWidth;
        const columnFullWidth = formatData.width + PAGE_GAP;
        const count = Math.ceil(scrollWidth / columnFullWidth);
        setPageCount(Math.max(1, count));
      }
    };

    // Delay calculation slightly to allow fonts/styles to apply
    const timeout = setTimeout(updatePageCount, 100);
    const observer = new ResizeObserver(updatePageCount);
    
    if (textContainerRef.current) {
      observer.observe(textContainerRef.current);
    }
    
    return () => {
      clearTimeout(timeout);
      observer.disconnect();
    };
  }, [content, layout, formatData.width]);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const url = event.target?.result as string;
        
        let dropX = 100;
        let dropY = 100;
        let paragraphIndex = 0;

        if (workspaceRef.current) {
          const rect = workspaceRef.current.getBoundingClientRect();
          const targetX = e.clientX - rect.left;
          const targetY = e.clientY - rect.top;
          
          dropX = (targetX + workspaceRef.current.scrollLeft) / zoom - 100;
          dropY = (targetY + workspaceRef.current.scrollTop) / zoom - 100;
        }

        const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
        if (dropTarget && textContainerRef.current) {
          const allParagraphs = Array.from(textContainerRef.current.querySelectorAll('p, h1, h2, h3, h4, ul, ol, blockquote'));
          const closestP = dropTarget.closest('p, h1, h2, h3, h4, ul, ol, blockquote');
          if (closestP) {
            paragraphIndex = allParagraphs.indexOf(closestP as Element);
            if (paragraphIndex === -1) paragraphIndex = 0;
          }
        }

        const newImg: FloatingImage = {
          id: uuidv4(),
          url,
          x: Math.max(0, dropX),
          y: Math.max(0, dropY),
          width: 200,
          height: 200,
          opacity: 1,
          borderRadius: 0,
          shadow: 'none',
          objectFit: 'cover',
          blendMode: 'normal',
          layoutMode: 'wrap-left',
          paragraphIndex: paragraphIndex,
        };
        setFloatingImages(prev => [...prev, newImg]);
        setSelectedImageId(newImg.id);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleLayoutChange = (key: keyof PageLayout, value: string | number) => {
    setLayout(prev => ({ ...prev, [key]: value }));
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const url = event.target?.result as string;
      const newImg: FloatingImage = {
        id: uuidv4(),
        url,
        x: 100,
        y: 100,
        width: 200,
        height: 200,
        opacity: 1,
        borderRadius: 0,
        shadow: 'none',
        objectFit: 'cover',
        blendMode: 'normal',
        layoutMode: 'wrap-left',
        paragraphIndex: 0,
      };
      setFloatingImages(prev => [...prev, newImg]);
      setSelectedImageId(newImg.id);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const saveLayout = async () => {
    const updatedChapter = { 
      ...chapter, 
      layout, 
      floatingImages,
      updatedAt: Date.now()
    };
    await db.saveChapter(updatedChapter);
    onUpdateChapter(updatedChapter);
    toast.success(t('saved'));
  };

  return (
    <div className="flex flex-row relative w-full h-full bg-zinc-100 dark:bg-zinc-950 overflow-hidden">
      {/* Main Designer Area */}
      <div className="flex flex-col flex-1 relative overflow-hidden">
        {/* Typeset Toolbar */}
        <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between px-4 z-20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <LayoutTemplate className="w-5 h-5 text-emerald-600 dark:text-emerald-500" />
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Web Typesetter
              </span>
            </div>
            
            <div className="h-6 w-px bg-zinc-200 dark:bg-zinc-800 hidden sm:block"></div>
            
            <span className="text-xs text-zinc-500 hidden sm:block">
              <span>{`${formatData.label} • ${pageCount} ${pageCount === 1 ? 'Page' : 'Pages'}`}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Zoom Controls */}
            <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-md p-1 mr-2">
              <button 
                onClick={() => setZoom(z => Math.max(0.2, z - 0.1))}
                className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <ZoomOut className="w-4 h-4" />
              </button>
              <span className="text-xs w-10 text-center font-medium text-zinc-600 dark:text-zinc-300">
                {Math.round(zoom * 100)}%
              </span>
              <button 
                onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                className="p-1 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors rounded hover:bg-zinc-200 dark:hover:bg-zinc-700"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-md transition-colors text-zinc-700 dark:text-zinc-200"
            >
              <ImagePlus className="w-4 h-4" />
              <span className="hidden sm:inline">Add Image</span>
            </button>
            <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageUpload} />
            
            <button
              onClick={saveLayout}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 hover:bg-emerald-700 text-white rounded-md transition-colors"
            >
              <Save className="w-4 h-4" />
              <span className="hidden sm:inline">{t('save')}</span>
            </button>
          </div>
        </div>

        {/* Virtual Desktop Workspace */}
        <div 
          ref={workspaceRef}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onClick={() => setSelectedImageId(null)}
          className="flex-1 overflow-auto bg-zinc-200/50 dark:bg-black/40 p-8 flex isolate relative" 
          style={{ alignContent: 'center' }}
        >
          <div 
            className="relative transition-transform origin-top-left mx-auto"
            style={{ 
              transform: `scale(${zoom})`,
              width: formatData.width + (pageCount - 1) * (formatData.width + PAGE_GAP), 
              height: formatData.height 
            }}
          >
            {/* Render virtual page backgrounds */}
            {Array.from({ length: pageCount }).map((_, i) => (
              <div 
                key={i}
                className="absolute bg-white dark:bg-zinc-900 shadow-xl ring-1 ring-black/5 dark:ring-white/10"
                style={{
                  top: 0,
                  left: i * (formatData.width + PAGE_GAP),
                  width: formatData.width,
                  height: formatData.height,
                }}
              >
                {/* Optional: Render Margin Guides */}
                <div 
                  className="absolute border border-blue-500/10 dark:border-blue-400/10 pointer-events-none"
                  style={{
                    top: layout.marginTop,
                    bottom: layout.marginBottom,
                    left: layout.marginLeft,
                    right: layout.marginRight,
                  }}
                />
              </div>
            ))}

            {/* Text Layer (Multi-column pagination) */}
            <div 
              ref={textContainerRef}
              className="absolute top-0 left-0 h-full w-max text-zinc-900 dark:text-zinc-100"
              style={{
                columnWidth: formatData.width,
                columnGap: PAGE_GAP,
                columnFill: 'auto',
                paddingTop: layout.marginTop,
                paddingBottom: layout.marginBottom,
              }}
            >
              <div 
                style={{
                  width: formatData.width - layout.marginLeft - layout.marginRight,
                  marginLeft: layout.marginLeft,
                  marginRight: layout.marginRight,
                  fontSize: layout.fontSize,
                  lineHeight: layout.lineHeight,
                }}
                className="prose prose-zinc dark:prose-invert font-serif max-w-none"
              >
                <MarkdownRenderer 
                  floatingImages={floatingImages}
                  selectedImageId={selectedImageId}
                  onImageClick={setSelectedImageId}
                >
                  {content || `*${t('no_content_yet')}*`}
                </MarkdownRenderer>
              </div>
            </div>

            {/* Floating Object Layer */}
            <div 
              className="absolute top-0 left-0 w-full h-full pointer-events-none"
            >
              {floatingImages.filter(img => !img.layoutMode || img.layoutMode === 'absolute').map((img, i) => (
                <Rnd
                  key={img.id}
                  default={{
                    x: img.x,
                    y: img.y,
                    width: img.width,
                    height: img.height,
                  }}
                  bounds="parent"
                  className={cn(
                    "group float-rnd pointer-events-auto",
                    selectedImageId === img.id ? "z-20 ring-2 ring-emerald-500 ring-offset-1" : "z-10"
                  )}
                  onDragStart={() => setSelectedImageId(img.id)}
                  onDragStop={(e, d) => {
                    const newImgs = [...floatingImages];
                    newImgs[i] = { ...img, x: d.x, y: d.y };
                    setFloatingImages(newImgs);
                  }}
                  onResizeStart={() => setSelectedImageId(img.id)}
                  onResizeStop={(e, direction, ref, delta, position) => {
                    const newImgs = [...floatingImages];
                    newImgs[i] = {
                      ...img,
                      width: parseInt(ref.style.width, 10),
                      height: parseInt(ref.style.height, 10),
                      ...position
                    };
                    setFloatingImages(newImgs);
                  }}
                >
                  <div 
                    className="relative w-full h-full border border-transparent hover:border-emerald-500/50 transition-colors bg-black/5"
                    style={{
                      opacity: img.opacity ?? 1,
                      mixBlendMode: (img.blendMode as any) || 'normal',
                      borderRadius: img.borderRadius ?? 0,
                      boxShadow: img.shadow === 'sm' ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' :
                                 img.shadow === 'md' ? '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' :
                                 img.shadow === 'lg' ? '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' :
                                 img.shadow === 'xl' ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' : 'none',
                      overflow: 'hidden'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedImageId(img.id);
                    }}
                  >
                    <img src={img.url} className="w-full h-full pointer-events-none" style={{ objectFit: (img.objectFit as any) || 'cover' }} alt="" />
                    {selectedImageId === img.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFloatingImages(floatingImages.filter(f => f.id !== img.id));
                          setSelectedImageId(null);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-100 shadow-md z-30"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                      </button>
                    )}
                  </div>
                </Rnd>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right Properties Sidebar */}
      <div className="w-72 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0 h-full overflow-y-auto">
        <div className="h-14 border-b border-zinc-200 dark:border-zinc-800 flex items-center px-5 shrink-0 bg-zinc-50 dark:bg-zinc-950/50">
          {selectedImageId ? (
            <>
              <ImagePlus className="w-4 h-4 text-emerald-600 mr-2" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Image Properties</h3>
            </>
          ) : (
            <>
              <Settings className="w-4 h-4 text-zinc-500 mr-2" />
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Layout Properties</h3>
            </>
          )}
        </div>
        
        <div className="p-5 space-y-8">
          {selectedImageId ? (() => {
            const img = floatingImages.find(f => f.id === selectedImageId);
            if (!img) return null;
            
            const updateImg = (updates: Partial<FloatingImage>) => {
              setFloatingImages(prev => prev.map(f => f.id === img.id ? { ...f, ...updates } : f));
            };

            return (
              <div className="space-y-6">
                <div>
                   <label className="text-xs font-medium text-zinc-500 block mb-1.5">Size & Position (px)</label>
                   <div className="grid grid-cols-2 gap-2 text-sm text-zinc-700 dark:text-zinc-300">
                     <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded flex items-center">
                       <span className="text-zinc-400 mr-2">W</span>
                       <input 
                         type="number" 
                         value={img.width} 
                         onChange={e => updateImg({ width: Number(e.target.value) })}
                         className="bg-transparent w-full outline-none"
                       />
                     </div>
                     <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded flex items-center">
                       <span className="text-zinc-400 mr-2">H</span>
                       <input 
                         type="number" 
                         value={img.height} 
                         onChange={e => updateImg({ height: Number(e.target.value) })}
                         className="bg-transparent w-full outline-none"
                       />
                     </div>
                     <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded">X: {Math.round(img.x)}</div>
                     <div className="bg-zinc-100 dark:bg-zinc-800 p-2 rounded">Y: {Math.round(img.y)}</div>
                   </div>
                   <p className="text-[10px] text-zinc-400 mt-2">Adjust dimensions manually here or drag edges.</p>
                </div>

                <hr className="border-zinc-200 dark:border-zinc-800" />

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Layout Mode</h4>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'absolute', label: 'Absolute', desc: 'Free drag' },
                      { id: 'wrap-left', label: 'Float Left', desc: 'Text wraps right' },
                      { id: 'wrap-right', label: 'Float Right', desc: 'Text wraps left' },
                      { id: 'wrap-center', label: 'Center', desc: 'Block break' }
                    ].map(mode => (
                      <button
                        key={mode.id}
                        onClick={() => updateImg({ layoutMode: mode.id as any })}
                        className={cn(
                          "text-left p-2 text-xs rounded-md border transition-all",
                          (img.layoutMode || 'absolute') === mode.id
                            ? "bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-900/30"
                            : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-300 dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-400"
                        )}
                      >
                        <div className="font-medium">{mode.label}</div>
                        <div className="text-[10px] opacity-70 truncate">{mode.desc}</div>
                      </button>
                    ))}
                  </div>

                  {(img.layoutMode && img.layoutMode !== 'absolute') && (
                    <div className="mt-4 p-3 bg-zinc-50 dark:bg-zinc-800/50 rounded-lg border border-zinc-200 dark:border-zinc-800">
                      <label className="text-xs font-medium text-zinc-500 block mb-2">Block Attachment Index</label>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={() => updateImg({ paragraphIndex: Math.max(0, (img.paragraphIndex || 0) - 1) })}
                          className="px-2 py-1 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded shadow-sm text-xs hover:bg-zinc-50"
                        >
                          Prev
                        </button>
                        <input 
                          type="number"
                          value={img.paragraphIndex || 0}
                          onChange={e => updateImg({ paragraphIndex: Math.max(0, Number(e.target.value)) })}
                          className="w-full text-center text-sm p-1 bg-transparent border-none outline-none"
                        />
                        <button 
                          onClick={() => updateImg({ paragraphIndex: (img.paragraphIndex || 0) + 1 })}
                          className="px-2 py-1 bg-white dark:bg-zinc-700 border border-zinc-200 dark:border-zinc-600 rounded shadow-sm text-xs hover:bg-zinc-50"
                        >
                          Next
                        </button>
                      </div>
                      <p className="text-[10px] text-zinc-400 mt-2 text-center">Move the image to previous or next text block</p>
                    </div>
                  )}
                </div>

                <hr className="border-zinc-200 dark:border-zinc-800" />

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Style</h4>
                  
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5 flex justify-between">
                      Opacity <span>{Math.round((img.opacity ?? 1) * 100)}%</span>
                    </label>
                    <input 
                      type="range" 
                      min="0" max="1" step="0.05"
                      value={img.opacity ?? 1}
                      onChange={e => updateImg({ opacity: Number(e.target.value) })}
                      className="w-full accent-emerald-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">Blend Mode</label>
                    <select 
                      value={img.blendMode || 'normal'}
                      onChange={e => updateImg({ blendMode: e.target.value })}
                      className="w-full text-sm p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-transparent focus:border-emerald-500 outline-none"
                    >
                      <option value="normal">Normal</option>
                      <option value="multiply">Multiply</option>
                      <option value="screen">Screen</option>
                      <option value="overlay">Overlay</option>
                      <option value="darken">Darken</option>
                      <option value="lighten">Lighten</option>
                      <option value="color-dodge">Color Dodge</option>
                      <option value="color-burn">Color Burn</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">Object Fit</label>
                    <select 
                      value={img.objectFit || 'cover'}
                      onChange={e => updateImg({ objectFit: e.target.value as any })}
                      className="w-full text-sm p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-transparent focus:border-emerald-500 outline-none"
                    >
                      <option value="cover">Cover (Fill bounds)</option>
                      <option value="contain">Contain (Show all)</option>
                      <option value="fill">Fill (Stretch)</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1.5">Corner Radius</label>
                      <input 
                        type="number" 
                        value={img.borderRadius ?? 0}
                        onChange={e => updateImg({ borderRadius: Number(e.target.value) })}
                        className="w-full text-sm p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border-transparent outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-zinc-500 block mb-1.5">Shadow</label>
                      <select 
                        value={img.shadow || 'none'}
                        onChange={e => updateImg({ shadow: e.target.value })}
                        className="w-full text-sm p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border-transparent outline-none"
                      >
                        <option value="none">None</option>
                        <option value="sm">Small</option>
                        <option value="md">Medium</option>
                        <option value="lg">Large</option>
                        <option value="xl">Extra Large</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="pt-4 mt-4 border-t border-zinc-200 dark:border-zinc-800">
                  <button 
                    onClick={() => {
                      setFloatingImages(prev => prev.filter(f => f.id !== selectedImageId));
                      setSelectedImageId(null);
                    }}
                    className="w-full py-2 hover:bg-red-50 text-red-600 dark:hover:bg-red-900/30 rounded-md text-sm font-medium transition-colors"
                  >
                    Delete Image
                  </button>
                </div>
              </div>
            );
          })() : (
            <>
              {/* Format Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                  <LayoutTemplate className="w-4 h-4 text-zinc-400" /> <span>Trim Size</span>
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {(Object.keys(FORMATS) as TrimFormat[]).map((f) => (
                    <button
                      key={f}
                      onClick={() => handleLayoutChange('format', f)}
                      className={cn(
                        "text-left p-3 text-sm rounded-lg border transition-all",
                        layout.format === f 
                          ? "bg-emerald-50 border-emerald-500 text-emerald-900 dark:bg-emerald-900/30 dark:border-emerald-500 dark:text-emerald-100 ring-1 ring-emerald-500"
                          : "bg-zinc-50 border-zinc-200 text-zinc-700 hover:border-zinc-300 dark:bg-zinc-800/50 dark:border-zinc-700 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      )}
                    >
                      <div className="font-semibold">{FORMATS[f].label}</div>
                      <div className="text-xs opacity-70 mt-0.5">{FORMATS[f].width} × {FORMATS[f].height}px</div>
                    </button>
                  ))}
                </div>
              </div>

              <hr className="border-zinc-200 dark:border-zinc-800" />

              {/* Typography Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                  <Type className="w-4 h-4 text-zinc-400" /> <span>Typography</span>
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">Font Size (px)</label>
                    <input 
                      type="number" 
                      value={layout.fontSize || 16} 
                      onChange={e => handleLayoutChange('fontSize', Number(e.target.value))}
                      className="w-full text-sm p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">Line Height</label>
                    <input 
                      type="number" 
                      step="0.1"
                      value={layout.lineHeight || 1.6} 
                      onChange={e => handleLayoutChange('lineHeight', Number(e.target.value))}
                      className="w-full text-sm p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              <hr className="border-zinc-200 dark:border-zinc-800" />

              {/* Margins */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                  <div className="w-4 h-4 border-2 border-zinc-400 rounded-sm" /> <span>Page Margins (px)</span>
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">Top</label>
                    <input 
                      type="number" 
                      value={layout.marginTop} 
                      onChange={e => handleLayoutChange('marginTop', Number(e.target.value))}
                      className="w-full text-sm p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">Bottom</label>
                    <input 
                      type="number" 
                      value={layout.marginBottom} 
                      onChange={e => handleLayoutChange('marginBottom', Number(e.target.value))}
                      className="w-full text-sm p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">Left</label>
                    <input 
                      type="number" 
                      value={layout.marginLeft} 
                      onChange={e => handleLayoutChange('marginLeft', Number(e.target.value))}
                      className="w-full text-sm p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-500 block mb-1.5">Right</label>
                    <input 
                      type="number" 
                      value={layout.marginRight} 
                      onChange={e => handleLayoutChange('marginRight', Number(e.target.value))}
                      className="w-full text-sm p-2 bg-zinc-100 dark:bg-zinc-800 rounded-md border border-transparent focus:border-emerald-500 focus:bg-white dark:focus:bg-zinc-900 outline-none transition-colors"
                    />
                  </div>
                </div>
                <p className="text-xs text-zinc-500 mt-2">
                  Drag images onto the page from your desktop to place floating media.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}