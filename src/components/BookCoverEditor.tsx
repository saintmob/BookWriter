import React, { useState, useRef } from 'react';
import { Book, db } from '../lib/db';
import { Image as ImageIcon, Sparkles, Upload, Loader2, Check, Layout, Type, Sliders, Palette } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

interface BookCoverEditorProps {
  book: Book;
  onUpdateBook: (updated: Book) => void;
  onGenerateImageOfPrompt: (prompt: string) => Promise<string | null>;
  language: string;
}

export function BookCoverEditor({ book, onUpdateBook, onGenerateImageOfPrompt, language }: BookCoverEditorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('A minimalist modern cover background with serene abstract ink wash and flowing gold leaves, professional high end, textured fine paper texture');
  
  const [coverTitle, setCoverTitle] = useState(book.coverTitle || book.title || '');
  const [coverAuthor, setCoverAuthor] = useState(book.coverAuthor || '作者墨笔');
  const [coverPublisher, setCoverPublisher] = useState(book.coverPublisher || '墨笔精选 / InkSpire Edition');
  const [coverLayoutType, setCoverLayoutType] = useState<string>(book.coverLayoutType || 'classic-serif');
  const [coverTextColor, setCoverTextColor] = useState(book.coverTextColor || '#111111');
  const [coverOverlayOpacity, setCoverOverlayOpacity] = useState<number>(book.coverOverlayOpacity !== undefined ? book.coverOverlayOpacity : 0.0);
  const [solidBgColor, setSolidBgColor] = useState(book.coverImage?.startsWith('#') ? book.coverImage : '#f5ebd5');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const saveCoverSettings = async (updates: Partial<Book>) => {
    const updatedBook = {
      ...book,
      ...updates,
      updatedAt: Date.now()
    };
    await db.saveBook(updatedBook);
    onUpdateBook(updatedBook);
  };

  const handleGenerateBackground = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    try {
      toast.info(language === 'zh' ? '正在为您生成艺术封面底图...' : 'Generating artistic cover background...');
      const url = await onGenerateImageOfPrompt(`Artistic elegant book cover background without text: ${prompt}`);
      if (url) {
        await saveCoverSettings({ 
          coverImage: url,
          coverTitle,
          coverAuthor,
          coverPublisher,
          coverLayoutType,
          coverTextColor,
          coverOverlayOpacity
        });
        toast.success(language === 'zh' ? '封面底图生成成功！' : 'Cover background generated successfully!');
      }
    } catch (e) {
      console.error(e);
      toast.error(language === 'zh' ? '生成失败，请重试' : 'Generation failed, please try again');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error(language === 'zh' ? '图片体积太大（需不超过 2MB）' : 'Image is too large (max 2MB)');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result as string;
      await saveCoverSettings({ 
        coverImage: base64,
        coverTitle,
        coverAuthor,
        coverPublisher,
        coverLayoutType,
        coverTextColor,
        coverOverlayOpacity
      });
      toast.success(language === 'zh' ? '封面底图上传成功' : 'Cover uploaded successfully');
    };
    reader.readAsDataURL(file);
  };

  const handleColorPreset = async (hex: string) => {
    setSolidBgColor(hex);
    await saveCoverSettings({
      coverImage: hex,
      coverTitle,
      coverAuthor,
      coverPublisher,
      coverLayoutType,
      coverTextColor,
      coverOverlayOpacity
    });
  };

  const handleTextChange = async (field: 'coverTitle' | 'coverAuthor' | 'coverPublisher' | 'coverTextColor' | 'coverLayoutType' | 'coverOverlayOpacity', value: any) => {
    if (field === 'coverTitle') {
      setCoverTitle(value);
    } else if (field === 'coverAuthor') {
      setCoverAuthor(value);
    } else if (field === 'coverPublisher') {
      setCoverPublisher(value);
    } else if (field === 'coverTextColor') {
      setCoverTextColor(value);
    } else if (field === 'coverLayoutType') {
      setCoverLayoutType(value);
    } else if (field === 'coverOverlayOpacity') {
      setCoverOverlayOpacity(value);
    }

    // Auto save changes inside parent state
    await saveCoverSettings({
      [field]: value
    });
  };

  const colorPresets = [
    { name: 'Warm Warm', hex: '#faf6ee' },
    { name: 'Pure White', hex: '#ffffff' },
    { name: 'Hard Kraft', hex: '#d2b48c' },
    { name: 'Imperial Red', hex: '#8b0000' },
    { name: 'Lapis Blue', hex: '#1e3a5f' },
    { name: 'Jade Green', hex: '#1b4d3e' },
    { name: 'Charcoal Black', hex: '#1a1a1a' },
  ];

  const renders = {
    'classic-serif': (
      <div className="absolute inset-0 p-12 flex flex-col justify-between text-center font-serif" style={{ color: coverTextColor }}>
        {/* Header element */}
        <div className="space-y-2 mt-4">
          <div className="text-xs tracking-[0.4em] uppercase opacity-60 font-medium">{coverPublisher}</div>
          <div className="w-8 h-[1px] bg-current mx-auto opacity-40"></div>
        </div>
        
        {/* Main Title group */}
        <div className="my-auto space-y-6 flex flex-col items-center">
          <h1 className="text-4xl md:text-5xl font-bold leading-tight tracking-wide break-all drop-shadow-sm px-4">
            {coverTitle}
          </h1>
          <div className="w-16 h-[2px] bg-current opacity-60"></div>
          {book.summary && (
            <p className="text-sm italic opacity-80 max-w-sm line-clamp-3 leading-relaxed px-4">
              {book.summary}
            </p>
          )}
        </div>

        {/* Footer author */}
        <div className="mb-4">
          <div className="text-base tracking-[0.2em] font-medium">{coverAuthor}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.3em] opacity-40 font-semibold font-sans">WRITER & AUTHOR</div>
        </div>
      </div>
    ),
    'modern-swiss': (
      <div className="absolute inset-0 p-10 flex flex-col justify-between text-left font-sans" style={{ color: coverTextColor }}>
        {/* Top bar */}
        <div className="flex justify-between items-start border-b-2 border-current pb-4">
          <span className="text-xs uppercase tracking-[0.2em] font-black">{coverPublisher}</span>
          <span className="text-xs font-mono font-bold">ED. 2026</span>
        </div>

        {/* Huge blocky Title */}
        <div className="my-auto">
          <h1 className="text-5xl font-black uppercase tracking-tighter leading-none break-all py-4">
            {coverTitle}
          </h1>
          <p className="border-l-4 border-current pl-4 text-xs font-medium tracking-tight opacity-80 max-w-xs mt-4">
            {book.summary || 'A professional volume created inside InkSpire, formatted utilizing advanced local typesetting architectures.'}
          </p>
        </div>

        {/* Author bio on right bottom side */}
        <div className="flex justify-between items-end border-t border-current pt-4">
          <div className="text-sm font-semibold tracking-wider uppercase">{coverAuthor}</div>
          <div className="text-[9px] font-mono opacity-60">STRETCH NO. 1</div>
        </div>
      </div>
    ),
    'minimalist': (
      <div className="absolute inset-0 p-14 flex flex-col justify-end text-left font-sans" style={{ color: coverTextColor }}>
        {/* Pure blank canvas, title is delicate at the bottom */}
        <div className="space-y-6 max-w-xs mt-auto">
          <div className="text-[10px] tracking-[0.3em] uppercase opacity-50 font-mono">{coverPublisher}</div>
          <h1 className="text-3xl font-light tracking-tight leading-snug break-all font-serif italic">
            {coverTitle}
          </h1>
          <div className="w-10 h-0.5 bg-current opacity-30"></div>
          <div className="text-xs tracking-widest font-bold uppercase opacity-80">{coverAuthor}</div>
        </div>
      </div>
    ),
    'vintage-editorial': (
      <div className="absolute inset-0 p-8 flex flex-col justify-between text-center font-serif border-[12px] border-double m-4" style={{ color: coverTextColor, borderColor: coverTextColor }}>
        {/* Intricate border decoration */}
        <div className="pt-6">
          <div className="text-xs uppercase tracking-[0.3em] opacity-70 italic font-semibold">{coverPublisher}</div>
          <div className="text-[10px] opacity-40 mt-1">***</div>
        </div>

        {/* Centered large display */}
        <div className="my-auto space-y-4">
          <h1 className="text-4xl font-bold leading-tight tracking-wide border-y border-current py-6 px-1 shrink-0 break-all select-none">
            {coverTitle}
          </h1>
          <div className="text-xs tracking-[0.2em] font-sans font-bold opacity-60 py-2">
            LIMITED MANUSCRIPT VERSION
          </div>
        </div>

        {/* Vintage Author footer */}
        <div className="pb-6">
          <div className="w-full h-px bg-current opacity-30 mb-4"></div>
          <div className="text-xs opacity-50 uppercase tracking-widest mb-1">BY THE PEN OF</div>
          <div className="text-lg tracking-[0.15em] font-normal">{coverAuthor}</div>
        </div>
      </div>
    ),
  };

  const isBgImage = book.coverImage && (book.coverImage.startsWith('http') || book.coverImage.startsWith('data:image'));

  return (
    <div className="flex-1 flex flex-col lg:flex-row h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans">
      
      {/* Settings control panel */}
      <div className="w-full lg:w-[480px] border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-y-auto flex flex-col shrink-0 select-none shadow-sm">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-2">
              <Layout className="w-4 h-4 text-purple-600" />
              {language === 'zh' ? '完美书籍封面排版' : 'Aesthetic Cover Typesetting'}
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {language === 'zh' ? '设计高阶排版，渲染独立文字并绑定矢量底图' : 'Design elegant headers over abstract graphics'}
            </p>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Metadata edit */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Type className="w-3.5 h-3.5" />
              {language === 'zh' ? '封面文字叠加' : 'Cover Typography Text'}
            </h3>
            
            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">{language === 'zh' ? '封面主书名' : 'Cover Book Title'}</label>
              <input
                type="text"
                value={coverTitle}
                onChange={(e) => handleTextChange('coverTitle', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-750 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">{language === 'zh' ? '作者署名' : 'Author Name / Signature'}</label>
              <input
                type="text"
                value={coverAuthor}
                onChange={(e) => handleTextChange('coverAuthor', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-750 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">{language === 'zh' ? '版本 / 出版信息' : 'Edition / Publisher Subtitle'}</label>
              <input
                type="text"
                value={coverPublisher}
                onChange={(e) => handleTextChange('coverPublisher', e.target.value)}
                className="w-full px-3 py-2 text-sm bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-750 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          {/* Preset typesetting designs */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Layout className="w-3.5 h-3.5" />
              {language === 'zh' ? '排版设计风格' : 'Typesetting Style Preset'}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'classic-serif', name: language === 'zh' ? '古典衬线' : 'Classic Serif' },
                { id: 'modern-swiss', name: language === 'zh' ? '现代网格' : 'Swiss Modern' },
                { id: 'minimalist', name: language === 'zh' ? '抽象极简' : 'Minimalist' },
                { id: 'vintage-editorial', name: language === 'zh' ? '复古边框' : 'Vintage Board' },
              ].map((layout) => (
                <button
                  key={layout.id}
                  onClick={() => handleTextChange('coverLayoutType', layout.id)}
                  className={cn(
                    "px-3 py-2.5 rounded-xl border text-xs font-medium text-center transition-all flex flex-col items-center justify-center gap-1",
                    coverLayoutType === layout.id
                      ? "border-purple-500 bg-purple-50/50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400"
                      : "border-zinc-200 dark:border-zinc-800 text-zinc-650 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  )}
                >
                  <span className="font-semibold">{layout.name}</span>
                </button>
              ))}
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          {/* Background generator logic */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" />
                {language === 'zh' ? '封面底图背景' : 'Vivid Cover Graphics'}
              </h3>
              <div className="flex gap-1">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="p-1 px-2.5 flex items-center gap-1 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 rounded text-[10px] font-bold text-zinc-600 dark:text-zinc-300 transition-colors"
                  title={language === 'zh' ? '上传图片底纹' : 'Upload custom graphic'}
                >
                  <Upload className="w-3 h-3" />
                  <span>{language === 'zh' ? '上传' : 'Upload'}</span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            {/* Prompt for image */}
            <div className="space-y-2 bg-purple-50/30 dark:bg-purple-950/10 p-4 rounded-xl border border-purple-100/30 dark:border-purple-900/20">
              <div className="text-xs font-semibold text-purple-800 dark:text-purple-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{language === 'zh' ? 'AI 艺术背景画生成装置' : 'AI Fine-Art Background Generator'}</span>
              </div>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                placeholder="Give keywords for abstract textures, oil color painting, minimalist vector art etc."
                className="w-full p-2.5 text-xs bg-white dark:bg-zinc-900 border border-purple-200/50 dark:border-purple-800/30 rounded-lg text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-400 resize-none leading-relaxed"
              />
              <button
                onClick={handleGenerateBackground}
                disabled={isGenerating}
                className="w-full py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-indigo-200 dark:shadow-none flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{language === 'zh' ? '生成装置加载中...' : 'Generating abstract canvas...'}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{language === 'zh' ? '生成艺术无文本底图' : 'Generate Graphic Canvas'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Color presets */}
            <div className="space-y-2">
              <div className="text-xs font-medium text-zinc-400">{language === 'zh' ? '或切换单色纯净背景' : 'Or switch to beautiful solid presets'}</div>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((preset) => (
                  <button
                    key={preset.hex}
                    onClick={() => handleColorPreset(preset.hex)}
                    className={cn(
                      "w-7 h-7 rounded-lg transition-all transform border",
                      book.coverImage === preset.hex ? "scale-110 border-purple-500 shadow-md" : "border-zinc-200 dark:border-zinc-800"
                    )}
                    style={{ backgroundColor: preset.hex }}
                    title={preset.name}
                  />
                ))}
              </div>
            </div>
          </div>

          <hr className="border-zinc-100 dark:border-zinc-800" />

          {/* Details adjustments */}
          <div className="space-y-4">
            <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5" />
              {language === 'zh' ? '高级细节调节' : 'Advanced Layer Settings'}
            </h3>

            {/* Darken glass layer for cover */}
            <div>
              <div className="flex justify-between text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1.5">
                <span>{language === 'zh' ? '背景暗度蒙版 (提高文字可读性)' : 'Overlay Darken Mask'}</span>
                <span className="font-mono">{Math.round(coverOverlayOpacity * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="0.8"
                step="0.05"
                value={coverOverlayOpacity}
                onChange={(e) => handleTextChange('coverOverlayOpacity', parseFloat(e.target.value))}
                className="w-full accent-purple-600 cursor-pointer"
              />
            </div>

            {/* Text Color Selection */}
            <div className="space-y-2">
              <label className="block text-xs font-medium text-zinc-500 dark:text-zinc-400">{language === 'zh' ? '覆字色系' : 'Typeset Font Color'}</label>
              <div className="flex gap-2">
                {[
                  { name: language === 'zh' ? '漆黑' : 'Ink Black', hex: '#111111' },
                  { name: language === 'zh' ? '极白' : 'Pure White', hex: '#ffffff' },
                  { name: language === 'zh' ? '哑金' : 'Matte Gold', hex: '#d4af37' },
                  { name: language === 'zh' ? '象牙' : 'Ebony Cream', hex: '#fdf6e2' },
                ].map((tc) => (
                  <button
                    key={tc.hex}
                    onClick={() => handleTextChange('coverTextColor', tc.hex)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-1.5 transition-all",
                      coverTextColor === tc.hex
                        ? "border-purple-500 bg-purple-50/50 text-purple-700 dark:bg-purple-950/20 dark:text-purple-400"
                        : "border-zinc-200 dark:border-zinc-800 text-zinc-650 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-805"
                    )}
                  >
                    <span className="w-2.5 h-2.5 rounded-full border border-black/10" style={{ backgroundColor: tc.hex }} />
                    <span>{tc.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Preview stage */}
      <div className="flex-1 flex items-center justify-center p-8 overflow-auto bg-zinc-950/95 relative animate-fade-in">
        
        {/* Book Spine simulation */}
        <div className="relative shadow-[0_30px_70px_rgba(0,0,0,0.6)] rounded-r-2xl overflow-hidden border border-zinc-800/20 transition-all cursor-default select-none group"
             style={{ 
               width: '390px', 
               height: '560px',
               backgroundColor: !isBgImage ? solidBgColor : '#18181b',
               backgroundImage: standsAsImage(book.coverImage) ? `url("${book.coverImage}")` : 'none',
               backgroundSize: 'cover',
               backgroundPosition: 'center',
             }}
        >
          {/* Subtle paper grain texture */}
          <div className="absolute inset-0 opacity-[0.05] pointer-events-none mix-blend-overlay z-10" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='1'/%3E%3C/svg%3E")` }} />

          {/* Color mask layer */}
          <div 
            className="absolute inset-0 pointer-events-none transition-colors duration-200 z-10"
            style={{ backgroundColor: `rgba(0, 0, 0, ${coverOverlayOpacity})` }}
          />

          {/* Spine bounding effects */}
          <div className="absolute left-0 top-0 bottom-0 w-6 bg-gradient-to-r from-black/20 via-white/5 to-transparent z-20" />
          <div className="absolute left-6 top-0 bottom-0 w-px bg-black/10 z-20" />

          {/* Page stack margin highlights on right edge */}
          <div className="absolute right-0 top-0 bottom-0 w-2 bg-gradient-to-l from-white/10 to-transparent z-20" />

          {/* Render typography block */}
          <div className="relative h-full w-full z-20">
            {renders[coverLayoutType as keyof typeof renders] || renders['classic-serif']}
          </div>
        </div>

      </div>

    </div>
  );
}

function standsAsImage(url: any): boolean {
  if (!url || typeof url !== 'string') return false;
  return url.startsWith('http') || url.startsWith('data:image');
}
