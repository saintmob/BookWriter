import React, { useRef, useState, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Book, Chapter, db } from '../lib/db';
import { cn } from '../lib/utils';
import { Settings2 } from 'lucide-react';
import { toast } from 'sonner';

import { TOCPreview, TOCPreviewHandle } from '../catalogue/TOCPreview';
import { DesignConfig, BookInfo, ChapterItem } from '../catalogue/types';
import { INITIAL_DESIGN_CONFIG, THEME_PALETTES, LAYOUTS_INFO } from '../catalogue/presets';

interface BookCatalogueEditorProps {
  book: Book;
  chapters: Chapter[];
  language: string;
  onUpdateBook: (b: Book) => void;
}

export function BookCatalogueEditor({ book, chapters, language, onUpdateBook }: BookCatalogueEditorProps) {
  const { t } = useTranslation();
  const isZh = language === 'zh';
  
  const [selectedLayout, setSelectedLayout] = useState(book.catalogueConfig?.selectedLayout || 'classic');
  const [designConfig, setDesignConfig] = useState<DesignConfig>(book.catalogueConfig?.designConfig || INITIAL_DESIGN_CONFIG);
  const previewRef = useRef<TOCPreviewHandle>(null);

  // Update book.catalogueConfig when settings change
  useEffect(() => {
    const configToSave = { selectedLayout, designConfig };
    
    // Quick deep equal check to avoid infinite loop
    if (JSON.stringify(book.catalogueConfig) !== JSON.stringify(configToSave)) {
      const updatedBook = { ...book, catalogueConfig: configToSave };
      db.saveBook(updatedBook).then(() => {
        onUpdateBook(updatedBook);
      });
    }
  }, [selectedLayout, designConfig, book, onUpdateBook]);

  // Convert our internal chapters to visual ChapterItems
  const catalogueChapters = useMemo(() => {
    const result: ChapterItem[] = [];
    let currentChapter: ChapterItem | null = null;
    let pageCounter = 12;

    const generatePageFn = () => {
      pageCounter += Math.floor(Math.random() * 20) + 10;
      return String(pageCounter);
    };

    chapters.forEach((ch) => {
      if (ch.level === 1 || ch.level === 2) {
        currentChapter = {
          id: ch.id,
          title: ch.title,
          description: ch.description,
          page: generatePageFn(),
          sections: [],
          imageSeed: result.length + 1
        };
        result.push(currentChapter);
      } else if (ch.level === 3 && currentChapter) {
        currentChapter.sections.push({
          id: ch.id,
          title: ch.title,
          page: generatePageFn()
        });
      }
    });

    if (result.length === 0) {
       result.push({
          id: '1', title: isZh ? '暂无章节内容' : 'No chapters yet', page: '1', sections: [], imageSeed: 1
       })
    }
    return result;
  }, [chapters]);

  const bookInfo: BookInfo = {
    title: book.title || 'Untitled',
    subtitle: book.designTheme?.typography?.headingFont || 'Catalogue Collection',
    author: book.coverAuthor || 'Author'
  };

  return (
    <div className="flex-1 flex flex-col md:flex-row h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950">
      
      {/* Canvas Area */}
      <div className="flex-1 overflow-y-auto relative bg-zinc-100 dark:bg-zinc-900/50 designer-grid">
        <TOCPreview
          ref={previewRef}
          bookInfo={bookInfo}
          chapters={catalogueChapters}
          config={designConfig}
          selectedLayout={selectedLayout}
        />
      </div>

      {/* Editor Panel */}
      <div className="w-full md:w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0 p-4 overflow-y-auto z-10 shadow-xl">
        <h2 className="text-lg font-bold mb-6 flex items-center gap-2 text-zinc-800 dark:text-zinc-100">
           <Settings2 className="w-5 h-5 text-emerald-500" />
           {isZh ? '排版设置' : 'Layout Settings'}
        </h2>
        
        <div className="space-y-6">
           {/* Layouts picker */}
           <div className="space-y-3">
             <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{isZh ? '排版预设' : 'Layout Presets'}</label>
             <div className="space-y-2">
                {LAYOUTS_INFO.map(layout => (
                  <button
                    key={layout.id}
                    onClick={() => setSelectedLayout(layout.id)}
                    className={cn(
                      "w-full p-3 rounded-xl border text-left flex flex-col gap-1 transition-all",
                      selectedLayout === layout.id 
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10" 
                        : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                    )}
                  >
                    <span className={cn("text-xs font-semibold", selectedLayout === layout.id ? "text-emerald-700 dark:text-emerald-300" : "text-zinc-700 dark:text-zinc-300")}>
                      {layout.name}
                    </span>
                    <span className="text-[10px] text-zinc-500 line-clamp-2">{layout.desc}</span>
                  </button>
                ))}
             </div>
           </div>

           {/* Themes picker */}
           <div className="space-y-3 pt-4 border-t border-zinc-100 dark:border-zinc-800">
             <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">{isZh ? '色彩主题' : 'Color Theme'}</label>
             <div className="grid grid-cols-2 gap-2">
               {Object.entries(THEME_PALETTES).map(([key, palette]) => (
                  <button
                    key={key}
                    onClick={() => setDesignConfig({ ...designConfig, themePreset: key as any })}
                    className={cn(
                      "p-2 rounded-lg border flex flex-col gap-2 items-center justify-center transition-all",
                      designConfig.themePreset === key 
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 shadow-sm" 
                        : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 opacity-60 hover:opacity-100"
                    )}
                  >
                    <div className="flex w-full h-8 rounded overflow-hidden shadow-sm border border-black/5">
                      <div className="flex-[2]" style={{ backgroundColor: palette.bg }} />
                      <div className="flex-1" style={{ backgroundColor: palette.primary }} />
                      <div className="flex-1" style={{ backgroundColor: palette.accent }} />
                    </div>
                    <span className="text-[10px] text-zinc-600 dark:text-zinc-400 truncate w-full text-center font-medium">
                      {palette.name.split(' ')[0]}
                    </span>
                  </button>
               ))}
             </div>
           </div>
        </div>
      </div>

    </div>
  );
}
