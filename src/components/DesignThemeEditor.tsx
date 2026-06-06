import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '../store/useStore';
import { Book, DesignTheme, db, PageLayout } from '../lib/db';
import { extractDesignThemeStyle, extractMasterDesignerProfile, parseAndAnalyzeLayoutFromIntent } from '../lib/ai';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Palette, 
  Type, 
  BookOpen, 
  Image as ImageIcon, 
  Trash2, 
  Check, 
  Loader2, 
  Sliders, 
  History, 
  ArrowUpRight, 
  RefreshCw, 
  HelpCircle,
  FileText,
  MousePointerClick,
  SlidersHorizontal,
  ChevronRight,
  Plus,
  Compass,
  ArrowRightLeft,
  LayoutGrid,
  Info,
  Layers,
  Sparkle,
  Grid,
  Save
} from 'lucide-react';
import { toast } from 'sonner';

interface DesignThemeEditorProps {
  book: Book;
  onUpdateBook: (updated: Book) => void;
  language: 'en' | 'zh';
}

interface MasterDesigner {
  id: string;
  name: string;
  nameZh: string;
  vibe: string;
  quote: string;
  colors: {
    dominant: string;
    accent: string;
    background: string;
    text: string;
  };
  typography: {
    headingFont: string;
    bodyFont: string;
    styleVibe: string;
  };
  illustrationStyle: string;
  typesettingGuidelines: string;
  extractedGuidelines: string;
  isCustom?: boolean;
}

interface ReferenceLayout {
  id: string;
  name: string;
  nameZh: string;
  descZh: string;
  descEn: string;
  thumbnailGrid: string; // Describes visual layout cells
  wireframeMock: {
    columns: number;
    marginTop: number;
    marginBottom: number;
    marginLeft: number;
    marginRight: number;
    fontSize: number;
    lineHeight: number;
    paperStyle: 'warm' | 'white' | 'dark' | 'kraft' | 'vintage' | 'glossy' | 'newsprint';
    dropCaps: boolean;
    headerPos: 'hidden' | 'top-center' | 'top-outside' | 'bottom-center' | 'bottom-outside';
  };
}

export function DesignThemeEditor({ book, onUpdateBook, language }: DesignThemeEditorProps) {
  const { t } = useTranslation();
  const { updateBook } = useStore();
  
  const [inspiration, setInspiration] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [activeTab, setActiveTab] = useState<'visual' | 'masters' | 'layout-workshop'>('visual');

  // --- Masters Archive State ---
  const [customMasters, setCustomMasters] = useState<MasterDesigner[]>([]);
  const [showAddMasterModal, setShowAddMasterModal] = useState(false);
  const [isCreatingMaster, setIsCreatingMaster] = useState(false);
  const [customMasterPrompt, setCustomMasterPrompt] = useState('');
  const [newMasterName, setNewMasterName] = useState('');
  const [newMasterQuote, setNewMasterQuote] = useState('');
  const [newMasterColors, setNewMasterColors] = useState({
    dominant: '#9F1239',
    accent: '#F59E0B',
    background: '#FAFAF9',
    text: '#1C1917'
  });
  
  // --- Layout Workshop State ---
  const [selectedRefLayoutId, setSelectedRefLayoutId] = useState<string>('novel-classic');
  const [workshopPhase, setWorkshopPhase] = useState<'ref' | 'wireframe' | 'template' | 'batch'>('ref');
  const [isSynthesizingWireframe, setIsSynthesizingWireframe] = useState(false);
  const [synthesizedWireframe, setSynthesizedWireframe] = useState<any | null>(null);
  const [customWireframePrompt, setCustomWireframePrompt] = useState('');
  const [savedUserTemplates, setSavedUserTemplates] = useState<any[]>([]);

  // Default Master Preset List
  const PRESET_MASTERS: MasterDesigner[] = [
    {
      id: 'jan-tschichold',
      name: 'Jan Tschichold',
      nameZh: '杨·奇肖尔德',
      vibe: language === 'zh' ? '现代主义经典网格 (Bauhaus Swiss)' : 'Modernist Swiss Grid',
      quote: language === 'zh'
        ? '"排版是在空间与意义之间进行绝对平衡的艺术。"'
        : '"Typography is the art of balancing space and meaning."',
      colors: {
        dominant: '#E11D48',
        accent: '#18181B',
        background: '#F4EFE6',
        text: '#1C1917'
      },
      typography: {
        headingFont: language === 'zh' ? '现代粗体黑体 / 瑞士无衬线' : 'Modern Grotesk Sans-Serif',
        bodyFont: language === 'zh' ? '经典准黑体 / 精等线体' : 'Geometric Neutral Sans-Serif',
        styleVibe: language === 'zh' ? '瑞士现代包豪斯' : 'Swiss Functionalism'
      },
      illustrationStyle: language === 'zh'
        ? '几何非对称包豪斯色块构图，高饱红黑色彩对立，纯白蒙版高反差，矢量装饰性线条'
        : 'Geometric Bauhaus abstract blocks, vivid red and solid black offsets, high-contrast monochrome space vector lines',
      typesettingGuidelines: language === 'zh'
        ? '左对齐不缩进，上下边距保持黄金分割，多栏排版（主副栏分级），超高信噪比'
        : 'Left-aligned without first-line indent, golden ratio margins, multi-column setups, pristine information density',
      extractedGuidelines: language === 'zh'
        ? '提倡绝对象征的功能主义排版。通过严谨的非对称布局轴心和经典的红、黑、米黄三色，剥离繁琐装饰，令文字以最高雅理性的力道跃然纸上。'
        : 'A highly functionalist classical aesthetic. By rejecting ornamental flourishes, Tschicholds layout leverages crisp asymmetrical grid guides, balancing vellum warmth with authoritative crimson signposts.'
    },
    {
      id: 'william-morris',
      name: 'William Morris',
      nameZh: '威廉·莫里斯',
      vibe: language === 'zh' ? '工艺美术复古哥特 (Arts & Crafts)' : 'Arts & Crafts Baroque',
      quote: language === 'zh'
        ? '"如果没有追求实用的初衷，或者创造美丽的信念，生活便毫无价值。"'
        : '"Have nothing in your houses that you do not know to be useful or believe to be beautiful."',
      colors: {
        dominant: '#15803D',
        accent: '#D97706',
        background: '#FAF6ED',
        text: '#1C1917'
      },
      typography: {
        headingFont: language === 'zh' ? '古典重装哥特体 / 粗重衬线' : 'Heavy Medieval Blackletter',
        bodyFont: language === 'zh' ? '高厚威尼斯人宋 / 传统古风' : 'Thick Old-Style Venetian Serif',
        styleVibe: language === 'zh' ? '维多利亚工艺美术' : 'Victoria Decorative Gothic'
      },
      illustrationStyle: language === 'zh'
        ? '密集手绘植物花卉藤蔓边框，古典中世纪木版雕刻挂毯，斑驳颗粒黑墨手作纹理'
        : 'Dense hand-drawn floral borders, medieval tapestry woodcuts, rich tactile black ink rustic engraving and organic vines',
      typesettingGuidelines: language === 'zh'
        ? '两端对齐带双页华丽大边框，巨型手绘红底金色首字下沉（Drop Caps），经典单栏，行间距浓密厚足'
        : 'Symmetric dual-page framed layout, giant woodcut red-ink drop caps, classic dense line formatting, zero page blank leakage',
      extractedGuidelines: language === 'zh'
        ? '充满大自然生命力的装饰人文主义美学。纸张呈现典雅的宣纸肌理，运用森林绿与秋叶黄，辅以繁复的木刻插图边框，展现文艺复兴时期的手工温度。'
        : 'An aesthetic honoring organic life and pre-industrial handicrafts. Uses heavy Venetian typography bound by elaborate natural leaf embellishments, perfect for high-fantasy, history, or classical anthologies.'
    },
    {
      id: 'kenya-hara',
      name: 'Kenya Hara',
      nameZh: '原研哉',
      vibe: language === 'zh' ? '东方极简留白美学 (Zen Emptiness)' : 'Japanese Zen Minimalism',
      quote: language === 'zh'
        ? '"白不是一种颜色，而是一种等待被唤醒的虚无留白。"'
        : '"White is not just a color, it is a negative space waiting to be realized."',
      colors: {
        dominant: '#52525B',
        accent: '#09090B',
        background: '#FFFFFF',
        text: '#27272A'
      },
      typography: {
        headingFont: language === 'zh' ? '超细日系教科书宋体 / 白舟极细' : 'Ultra-light Mincho Minimalist',
        bodyFont: language === 'zh' ? '现代极简精等线 / 优雅黑雅' : 'Svelte Neutral Modern Gothic',
        styleVibe: language === 'zh' ? '东方极致虚白禅' : 'Japanese Quietist Zen'
      },
      illustrationStyle: language === 'zh'
        ? '极致侘寂灰度摄影底噪，温润微卷棉质纸张阴影，无彩色灰暗微距质感，空气般的构图'
        : 'Absolute minimalist sepia photography, faint soft shadows on organic cotton paper, airy ethereal layouts with zero visual clutter',
      typesettingGuidelines: language === 'zh'
        ? '四周留白高达35%以上，行间距大幅拉宽，居中短段结构，抛弃任何多余边框点缀'
        : 'Extravagant margins up to 35%, highly spaced airy line heights, floating center paragraphs, zero grid noise lines',
      extractedGuidelines: language === 'zh'
        ? '极致克制、返璞归真的负空间设计。通过剔除一切视觉噪音，把无尽的虚空与洁白还给读者，让墨迹在庞大的纸张视阈中舒缓呼吸，极其适合温润、灵性或哲言题材。'
        : 'Crafted on the paradigm of profound quietness. Features boundless margins and delicate, whispering typography, creating an atmosphere of ultimate intellectual focus.'
    },
    {
      id: 'josef-muller-brockmann',
      name: 'Josef Müller-Brockmann',
      nameZh: '约瑟夫·米勒-布洛克曼',
      vibe: language === 'zh' ? '国际排版风格骨格 (Modular System)' : 'Universal Grid School',
      quote: language === 'zh'
        ? '"网格是一个脚手架，而不是一张不可逾越的网。"'
        : '"The grid system is an aid, not a guarantee."',
      colors: {
        dominant: '#0284C7',
        accent: '#0F172A',
        background: '#FAF9F6',
        text: '#1E293B'
      },
      typography: {
        headingFont: language === 'zh' ? '经典赫尔维蒂卡中黑 / 无衬线标题' : 'Standard Helvetica Neue Bold',
        bodyFont: language === 'zh' ? '等比清晰无衬线体 / 干净段落' : 'Crisp Sans-serif Neutral Body',
        styleVibe: language === 'zh' ? '理性矩阵主义' : 'Modular Precisionism'
      },
      illustrationStyle: language === 'zh'
        ? '精密工业结构线描，平面坐标网格，冷色、理性几何渐变叠印，严谨理性秩序'
        : 'Engineering structure lines schema, technical mathematical lattices, cool geometric screenprint layers, total visual order',
      typesettingGuidelines: language === 'zh'
        ? '强力应用等高三分栏网格，段落行高精准垂直对齐，页边矩形遵循网格倍数，全无衬线字阶分层'
        : 'Strict 3-column structural layout, perfectly aligned vertical vertical grid rhythm, sans-serif weights mapping hierarchical tags',
      extractedGuidelines: language === 'zh'
        ? '国际主义科学而严密的秩序建构。以极度纯净且几何对齐的模块网格，创造极其客观、稳定而且清晰的阅读感，适合具有技术型、科技或科学理性的专著。'
        : 'An archetype of mathematical order. It implements modular, multi-column typesetting frameworks with high contrast and geometric alignment, eliminating any subjective noise.'
    },
    {
      id: 'kohei-sugiura',
      name: 'Kohei Sugiura',
      nameZh: '杉浦康平',
      vibe: language === 'zh' ? '东方多重宇宙曼荼罗 (Asian Cosmic Multiverse)' : 'Asian Cosmic Overlap',
      quote: language === 'zh'
        ? '"杂音中包含着生命的种子；绝对的无菌是虚假的。"'
        : '"Noise contains the seeds of life; absolute silence is artificial."',
      colors: {
        dominant: '#DC2626',
        accent: '#F59E0B',
        background: '#111827',
        text: '#F9FAFB'
      },
      typography: {
        headingFont: language === 'zh' ? '苍劲魏碑/重笔手书汉字体' : 'Dynamic Expressive Calligraphy Brush',
        bodyFont: language === 'zh' ? '紧凑报体宋 / 厚实传统宋体' : 'Dense Traditional Editorial Serif',
        styleVibe: language === 'zh' ? '多维重叠东方曼荼罗' : 'Cosmic Multi-layered Oriental'
      },
      illustrationStyle: language === 'zh'
        ? '星盘、八卦与梵文经咒重叠，星云卤化半色调颗粒网面，重色多色相撞，深邃而具有仪式感'
        : 'Stunning celestial charts, cosmic mandala coordinates, oriental woodcuts over dense halftone screen overlays, occult and majestic atmosphere',
      typesettingGuidelines: language === 'zh'
        ? '双语跨页对照，超大首字叠入底纹中，页眉自带经纬刻度装饰线，正文与评注、侧记（Sidenote）密集穿插'
        : 'Dual-axis text columns, sidebar footnotes overlapping layout background map grids, ritualistic horizontal guides forming cosmological charts',
      extractedGuidelines: language === 'zh'
        ? '将亚洲多维空间观与宇宙万象学融合的“嘈杂”美学。打破经典白页的束缚，在深邃暗色背景上构建出多维文字网络，散发出图腾式的东方神秘气质。'
        : 'A fascinating paradigm marrying East-Asian cosmology with heavy typographic layering. Text overlay designs, compass coordinates, and deep cinnabar accents evoke a ceremonial, spiritual visual feast.'
    }
  ];

  // Reference Layout presets
  const REFERENCE_LAYOUTS: ReferenceLayout[] = [
    {
      id: 'novel-classic',
      name: 'Classic Literary Novel',
      nameZh: '经典古典中长篇小说排版',
      descZh: '单栏宏阔、徐徐展开，注重经典纸张呼吸，首行大号黄金宋体字和优雅的双边对称边框，利于慢阅读。',
      descEn: 'Single full-width text block with generous line spacing, luxurious margins, and subtle drop caps, optimal for deep reading.',
      thumbnailGrid: 'border-2 border-indigo-400 p-3 bg-stone-50 dark:bg-stone-900 rounded-xl space-y-1.5',
      wireframeMock: {
        columns: 1,
        marginTop: 56,
        marginBottom: 56,
        marginLeft: 56,
        marginRight: 56,
        fontSize: 16,
        lineHeight: 1.75,
        paperStyle: 'vintage',
        dropCaps: true,
        headerPos: 'top-center'
      }
    },
    {
      id: 'bento-editorial',
      name: 'Bento Grid Double-Column',
      nameZh: '现代人文双栏格子拼图',
      descZh: '参考现代生活画报，左右分层，主栏排布密集段落、副栏承载注释/照片占位，非常吸睛。',
      descEn: 'Modern layout inspired by editorial catalogs, dividing content into dual aligned grids, offering a rhythmic reader journey.',
      thumbnailGrid: 'border border-zinc-200 p-3 bg-stone-50 dark:bg-stone-900 rounded-xl grid grid-cols-2 gap-1.5',
      wireframeMock: {
        columns: 2,
        marginTop: 40,
        marginBottom: 40,
        marginLeft: 40,
        marginRight: 40,
        fontSize: 14,
        lineHeight: 1.6,
        paperStyle: 'warm',
        dropCaps: false,
        headerPos: 'top-outside'
      }
    },
    {
      id: 'retro-manuscript',
      name: 'Medieval Manuscript Grid',
      nameZh: '中世纪装饰性手印孤本',
      descZh: '重彩色、重装饰，上下留白，正中大段两角带经典木刻花藤，辅以高对比深邃纸张背景。',
      descEn: 'A magnificent dense layouts with massive marginal borders, drop-caps inlays, and dense gothic old-paper style.',
      thumbnailGrid: 'border border-zinc-205 p-3 bg-orange-95/10 rounded-xl relative overflow-hidden',
      wireframeMock: {
        columns: 1,
        marginTop: 72,
        marginBottom: 72,
        marginLeft: 72,
        marginRight: 72,
        fontSize: 15,
        lineHeight: 1.8,
        paperStyle: 'kraft',
        dropCaps: true,
        headerPos: 'bottom-center'
      }
    },
    {
      id: 'cyber-dense',
      name: 'Matrix Technological Columns',
      nameZh: '塞伯棱镜黑底极密多栏',
      descZh: '暗色背景，双栏或多栏紧凑组合，字体极细。顶部放置横坐标辅助度量指示线条，散落数据密闭感。',
      descEn: 'Dark parchment canvas with three columns, horizontal ruler marks, svelte lines, and zero margins waste.',
      thumbnailGrid: 'border border-zinc-200 p-3 bg-zinc-950 rounded-xl grid grid-cols-3 gap-1',
      wireframeMock: {
        columns: 3,
        marginTop: 32,
        marginBottom: 32,
        marginLeft: 32,
        marginRight: 32,
        fontSize: 13,
        lineHeight: 1.5,
        paperStyle: 'dark',
        dropCaps: false,
        headerPos: 'hidden'
      }
    }
  ];

  // Load custom master profiles from localStorage
  useEffect(() => {
    const list = localStorage.getItem(`inkspire_custom_masters_${book.id}`);
    if (list) {
      try {
        setCustomMasters(JSON.parse(list));
      } catch (e) {
        console.error(e);
      }
    }
    const templates = localStorage.getItem(`inkspire_user_templates_${book.id}`);
    if (templates) {
      try {
        setSavedUserTemplates(JSON.parse(templates));
      } catch (e) {
        console.error(e);
      }
    }
  }, [book.id]);

  // Load initial inspiration draft if empty
  useEffect(() => {
    if (!inspiration) {
      setInspiration(
        language === 'zh'
          ? '我想要一种古典侦探说书的排版质感。沉稳优雅、带有一点神秘哥特氛围。主色调偏向深邃的红木古董铜色或墨黛色，纸张是微黄斑驳的复古纸张。字体排版要有华丽的古典首字下沉（Drop Caps），行间距大一些，让书页显得精致透气。插画要像19世纪老报纸上的黑白铜版画、带斑驳木刻线条质感。'
          : 'I want a classic gothic mystery novel aesthetic. Calm, elegant and mysterious. The dominant accent color should be a deep burgundy or dark charcoal, with a warm vintage textured paper background. Typesetting should feature large, ornate drop caps, high line heights for elegance, and spacious margins. Illustrations must look like 19th-century newspaper engravings or hand-carved woodblocks with stippled shading.'
      );
    }
  }, [language]);

  const activeRefLayout = REFERENCE_LAYOUTS.find(r => r.id === selectedRefLayoutId) || REFERENCE_LAYOUTS[0];

  const theme: DesignTheme = book.designTheme || {
    keywords: language === 'zh' ? ['古典主义', '黄金时代', '黑白木刻'] : ['Classicism', 'Golden Age', 'Engraving'],
    colors: {
      dominant: '#8C2E2A',
      accent: '#D4AF37',
      background: '#F9F6F0',
      text: '#1C1917'
    },
    typography: {
      headingFont: language === 'zh' ? '华丽古典宋体/精美衬线' : 'Ornate Serif Modern',
      bodyFont: language === 'zh' ? '高雅书宋/仿宋' : 'Elegant Editorial Garamond',
      styleVibe: language === 'zh' ? '复古古典沙龙' : 'Classic Vintage Salon'
    },
    illustrationStyle: language === 'zh' 
      ? '19世纪古典黑白报纸铜版画风格，高强度木刻排线阴影，深厚斑驳的油墨纹理，古典版画质感，复古细腻' 
      : '19th century classic copperplate engraving style, heavy woodcut line shading, deep textured ink bleed, authentic high contrast monochrome line art',
    typesettingGuidelines: language === 'zh'
      ? '开启首字下沉，两端对齐格式，首行缩进2字符，段落间距较为透气，适合徐徐展开的古典中长文章'
      : 'Enable drop caps, justified paragraphs, classic 2-character indentations, airy paragraph spacing, perfect for vintage book layouts',
    growthMemories: [
      language === 'zh' 
        ? `${new Date().toLocaleDateString()} 成功初始化了符合全书大纲主旨的基底古典主题风格。`
        : `${new Date().toLocaleDateString()} Initialized the baseline classical style guidelines matching the book summary.`
    ],
    extractedGuidelines: language === 'zh'
      ? '该设计风格专为具有古典、优雅或解密底色的作品而设计。背景是模拟富有人文温度的宣纸色调，用高饱和的典雅红木色以及华贵香槟金点缀标志，并在插画生成中强力约束采用19世纪古风铜板雕刻画，打造一种精致如工艺品般的慢阅读体验。'
      : 'Designed specifically for pieces with classic, historical, or mysterious subtones. The parchment background conveys historic warmth, offset by rich burgundy accents and antique gold markers, enforcing fine-art 19th-century engravings for illustration to ensure an artisanal slow-reading flow.'
  };

  const handleExtract = async () => {
    if (!inspiration.trim()) {
      toast.error(language === 'zh' ? '请输入设计意图或参考段落文本' : 'Please input your design intentions or materials');
      return;
    }
    
    setIsExtracting(true);
    try {
      const extracted = await extractDesignThemeStyle(
        book.title,
        book.summary,
        inspiration,
        book.designTheme || null,
        language
      );

      if (extracted && extracted.colors && extracted.keywords) {
        // Record growth memory logs
        const currentDate = new Date().toLocaleDateString();
        const logMsg = language === 'zh'
          ? `${currentDate}：基于用户最新输入「${inspiration.substring(0, 18)}...」吸收演化，增强了${extracted.keywords.join('、')}风，更新了调色板。`
          : `${currentDate}: Evolved styling rules based on inputs "${inspiration.substring(0, 18)}...", updated theme keywords: ${extracted.keywords.join(', ')}.`;

        const prevLogs = theme.growthMemories || [];
        const growthMemories = [logMsg, ...prevLogs].slice(0, 50); // limit logs count to 50
        
        const updatedTheme: DesignTheme = {
          ...extracted,
          growthMemories
        };

        const updatedBook = {
          ...book,
          designTheme: updatedTheme,
          updatedAt: Date.now()
        };

        // Save back to indexedDB & store state
        await updateBook(book.id, { designTheme: updatedTheme });
        onUpdateBook(updatedBook);
        toast.success(language === 'zh' ? '设计风格提取成功！成功注入全书记忆库' : 'Style extracted successfully! Injected into book memory bank');
      } else {
        throw new Error('Invalid metadata package returned by model.');
      }
    } catch (error: any) {
      console.error(error);
      toast.error((language === 'zh' ? '风格提取失败：' : 'Style extraction failed: ') + error.message);
    } finally {
      setIsExtracting(false);
    }
  };

  // Capture master design style into Book Design Theme memory library
  const handleAdoptMaster = async (master: MasterDesigner) => {
    const currentDate = new Date().toLocaleDateString();
    const logMsg = language === 'zh'
      ? `${currentDate}：全书采集引入了名家「${master.nameZh} / ${master.name}」的视觉资产，全方面接管色调（${master.colors.dominant}）、插画及排版方案。`
      : `${currentDate}: Collected master model "${master.name}" visual assets, absorbing dominant color (${master.colors.dominant}), layout patterns and illustration constraints.`;

    const prevLogs = theme.growthMemories || [];
    const growthMemories = [logMsg, ...prevLogs].slice(0, 50);

    const updatedTheme: DesignTheme = {
      keywords: master.vibe.split('(')[0].trim().split(' '),
      colors: { ...master.colors },
      typography: { ...master.typography },
      illustrationStyle: master.illustrationStyle,
      typesettingGuidelines: master.typesettingGuidelines,
      extractedGuidelines: master.extractedGuidelines,
      growthMemories
    };

    const updatedBook = {
      ...book,
      designTheme: updatedTheme,
      coverTextColor: master.colors.dominant, // Automatically adjust cover colors
      updatedAt: Date.now()
    };

    try {
      await updateBook(book.id, {
        designTheme: updatedTheme,
        coverTextColor: master.colors.dominant
      });
      onUpdateBook(updatedBook);
      toast.success(
        language === 'zh'
          ? `成功采集「${master.nameZh}」的设计风格到全书装帧记忆脑中！`
          : `Captured "${master.name}" style guide directly into book design core!`
      );
    } catch (e) {
      toast.error('Failed to capture master styles.');
    }
  };

  // Perform custom AI custom master schema building
  const handleAICreateMaster = async () => {
    if (!customMasterPrompt.trim()) {
      toast.error(language === 'zh' ? '您需要输入描述，例如："西海岸杂志脏排版风格"' : 'Please type a summary or style concept description');
      return;
    }
    setIsCreatingMaster(true);
    try {
      const generated = await extractMasterDesignerProfile(customMasterPrompt, language);
      if (generated && generated.name) {
        const item: MasterDesigner = {
          id: 'custom-' + Date.now(),
          name: generated.name,
          nameZh: generated.nameZh || generated.name,
          vibe: generated.vibe || 'AI Custom Movement',
          quote: generated.quote || '"Design is thinking made visual."',
          colors: generated.colors || {
            dominant: '#18181B',
            accent: '#EA580C',
            background: '#F5F5F4',
            text: '#1C1917'
          },
          typography: generated.typography || {
            headingFont: 'Sans Bold',
            bodyFont: 'Classic Serif',
            styleVibe: 'Custom Grid'
          },
          illustrationStyle: generated.illustrationStyle || 'Standard monochrome hand-drawn line art',
          typesettingGuidelines: generated.typesettingGuidelines || 'Classic margins and normal indents',
          extractedGuidelines: generated.extractedGuidelines || 'A customized style tailored from user inspiration prompt.',
          isCustom: true
        };

        const updatedList = [item, ...customMasters];
        setCustomMasters(updatedList);
        localStorage.setItem(`inkspire_custom_masters_${book.id}`, JSON.stringify(updatedList));
        toast.success(
          language === 'zh'
            ? `AI 成功研析并结构化建立了名家样式物料：「${item.nameZh}」！`
            : `AI successfully generated master styling archive: "${item.name}"!`
        );
        setCustomMasterPrompt('');
        setShowAddMasterModal(false);
      } else {
        throw new Error('Incomplete data package emitted from system.');
      }
    } catch (err: any) {
      toast.error('Failed to analyze designer concept: ' + err.message);
    } finally {
      setIsCreatingMaster(false);
    }
  };

  // Delete custom master profile
  const handleDeleteCustomMaster = (id: string, name: string) => {
    const filtered = customMasters.filter(m => m.id !== id);
    setCustomMasters(filtered);
    localStorage.setItem(`inkspire_custom_masters_${book.id}`, JSON.stringify(filtered));
    toast.success(
      language === 'zh'
        ? `移除了自定义的名家样式：${name}`
        : `Removed custom master profile: ${name}`
    );
  };

  // Phase 2: Trace and extract layout wireframe from reference
  const handleTraceLayout = async () => {
    setIsSynthesizingWireframe(true);
    try {
      const activeObj = referenceLayoutById(selectedRefLayoutId);
      const inputStr = language === 'zh' 
        ? `书籍《${book.title}》, 选定的基础物理格式：${activeObj.nameZh} (格调风格: ${activeObj.name})。补充的自定义需求: ${customWireframePrompt}`
        : `Book "${book.title}", selected base layout: ${activeObj.name} (genre: ${activeObj.name}). Custom refinement prompt: ${customWireframePrompt}`;

      const data = await parseAndAnalyzeLayoutFromIntent(inputStr, language);
      if (data && data.name) {
        setSynthesizedWireframe(data);
        toast.success(
          language === 'zh'
            ? `成功从参考析出精准网格线框图！已自动绘制排版线心拓扑。`
            : `Decoupled precise geometry wireframe layout parameters successfully!`
        );
        setWorkshopPhase('wireframe');
      } else {
        throw new Error('Wireframe extraction payload invalid.');
      }
    } catch (e: any) {
      toast.error('Tracing layout structure failed: ' + e.message);
    } finally {
      setIsSynthesizingWireframe(false);
    }
  };

  // Phase 3: Commit / Internalize into reusable Layout templates
  const handleInternalizeTemplate = () => {
    if (!synthesizedWireframe) return;
    
    const newTemplate = {
      ...synthesizedWireframe,
      id: 'template-' + Date.now(),
      createdAt: Date.now()
    };

    const updated = [newTemplate, ...savedUserTemplates];
    setSavedUserTemplates(updated);
    localStorage.setItem(`inkspire_user_templates_${book.id}`, JSON.stringify(updated));
    toast.success(
      language === 'zh'
        ? `高维网格版式已经成功「内化」整合为模块化版式组合！已进入可重用状态。`
        : `Successfully internalized this typeset wireframe into modular template bundles!`
    );
    setWorkshopPhase('batch');
  };

  // Phase 4: Execute Batch Typeset to all chapters in IDB
  const handleExecuteBatchTypeset = async (templateItem: any) => {
    try {
      // 1. Prepare standard Layout payload matching db PageLayout scheme
      const pageLayoutPayload: PageLayout = {
        marginTop: Number(templateItem.marginTop) || 48,
        marginBottom: Number(templateItem.marginBottom) || 48,
        marginLeft: Number(templateItem.marginLeft) || 48,
        marginRight: Number(templateItem.marginRight) || 48,
        fontSize: Number(templateItem.fontSize) || 15,
        lineHeight: Number(templateItem.lineHeight) || 1.6,
        columns: Number(templateItem.columns) || 1,
        paperStyle: templateItem.paperStyle || 'warm',
        justifyText: templateItem.justifyText !== false,
        firstLineIndent: Number(templateItem.firstLineIndent) || 0,
        paragraphSpacing: Number(templateItem.paragraphSpacing) || 12,
        fontFamily: templateItem.paperStyle === 'dark' ? 'mono' : 'serif',
        dropCaps: templateItem.dropCaps === true,
        headerPos: templateItem.headerPos || 'top-center'
      };

      // 2. Fetch all chapters for active book
      const chaptersList = await db.getChapters(book.id);
      
      // 3. Batch write updated chapters with matching layout overriding inside IndexedDB
      for (const ch of chaptersList) {
        const updatedCh = {
          ...ch,
          layout: pageLayoutPayload,
          updatedAt: Date.now()
        };
        await db.saveChapter(updatedCh);
      }

      // 4. Update the books default overarching layout as well to maintain uniformity
      const updatedBook = {
        ...book,
        layout: pageLayoutPayload,
        updatedAt: Date.now()
      };
      await updateBook(book.id, { layout: pageLayoutPayload });
      onUpdateBook(updatedBook);

      // Trigger UI congratulations
      toast.success(
        language === 'zh'
          ? `🎉 全书版式批量对齐完成！已一键更新全书共 ${chaptersList.length} 个章节。首字下沉，分栏（${pageLayoutPayload.columns}栏），页边距整体同步对齐。`
          : `🎉 Successfully typeset ${chaptersList.length} chapters in a batch! Systemic dimensions are updated matching ${templateItem.name}.`
      );
    } catch (err: any) {
      toast.error('Batch alignment execution failed: ' + err.message);
    }
  };

  const referenceLayoutById = (id: string) => {
    return REFERENCE_LAYOUTS.find(r => r.id === id) || REFERENCE_LAYOUTS[0];
  };

  const handleApplyColorsToCover = async () => {
    try {
      const updatedBook = {
        ...book,
        coverImage: theme.colors.background, // Apply HEX background of theme as Cover background
        coverTextColor: theme.colors.dominant, // Use dominant color for Cover text markup
        updatedAt: Date.now()
      };
      await updateBook(book.id, {
        coverImage: updatedBook.coverImage,
        coverTextColor: updatedBook.coverTextColor
      });
      onUpdateBook(updatedBook);
      toast.success(
        language === 'zh'
          ? '已将主色调 Palette 自动应用到全书封面背景及文字颜色设置中！'
          : 'Successfully applied theme colors to the Book cover layout settings!'
      );
    } catch (err) {
      toast.error('Failed to apply colors to cover configuration.');
    }
  };

  const handleApplyLayoutSuggestions = async () => {
    try {
      const toastId = toast.loading(language === 'zh' ? '正在进行排版反向析出...' : 'Synthesizing layout structure from master theme...');
      try {
        const { parseAndAnalyzeLayoutFromIntent } = await import('../lib/ai');
        const intentPrompt = `You must analyze the following Design Theme Typography Guidelines and establish a robust typesetting configuration: ${theme.typesettingGuidelines}. Base paper color intention on bg hex: ${theme.colors.background}.`;
        const result = await parseAndAnalyzeLayoutFromIntent(intentPrompt, language);
        
        const currentLayout = book.layout || {};
        const updatedLayout = {
          marginTop: Number(result.marginTop) || currentLayout.marginTop || 48,
          marginBottom: Number(result.marginBottom) || currentLayout.marginBottom || 48,
          marginLeft: Number(result.marginLeft) || currentLayout.marginLeft || 48,
          marginRight: Number(result.marginRight) || currentLayout.marginRight || 48,
          fontSize: Number(result.fontSize) || currentLayout.fontSize || 15,
          lineHeight: Number(result.lineHeight) || currentLayout.lineHeight || 1.6,
          columns: Number(result.columns) || currentLayout.columns || 1,
          paperStyle: result.paperStyle || currentLayout.paperStyle || 'warm',
          fontFamily: theme.typography.bodyFont || currentLayout.fontFamily,
          headerPos: result.headerPos || currentLayout.headerPos || 'top-outside',
          format: result.format || currentLayout.format || 'trade',
          chapterTitleStyle: result.chapterTitleStyle || currentLayout.chapterTitleStyle || 'modern',
          sceneBreakStyle: result.sceneBreakStyle || currentLayout.sceneBreakStyle || 'space',
          dropCaps: result.dropCaps !== undefined ? result.dropCaps : (currentLayout.dropCaps ?? false),
          firstLineIndent: Number(result.firstLineIndent) || currentLayout.firstLineIndent || 0,
          paragraphSpacing: Number(result.paragraphSpacing) || currentLayout.paragraphSpacing || 16,
          justifyText: result.justifyText !== false
        };

        const updatedBook = {
          ...book,
          layout: updatedLayout,
          updatedAt: Date.now()
        };

        await updateBook(book.id, { layout: updatedLayout });
        onUpdateBook(updatedBook);

        if (window.confirm(language === 'zh' ? '名家排版参数已提取为全书全局设定！是否要清除各章节独立的排版覆盖，强制全书统一？' : 'Master layout extracted to book global settings! Do you want to clear individual chapter layout overrides to enforce global consistency?')) {
          const chapters = await db.getChapters(book.id);
          for (const chap of chapters) {
             if (chap.layout) {
               await db.saveChapter({ ...chap, layout: undefined });
             }
          }
          toast.success(language === 'zh' ? '已清理章节遗留版式。成功统一全书版面！' : 'Cleared chapter overrides. Universal layout applied!');
        } else {
          toast.success(
            language === 'zh'
              ? '已成功将名家排版信条析出为全书全局参数！(未更改独立设定的章节)'
              : 'Successfully updated central typesetting layouts based on theme suggestions!'
          );
        }
      } catch (aiError) {
        toast.error('AI synthesis failed: ' + (window.document ? 'Check network.' : 'Failed.'));
      } finally {
        toast.dismiss(toastId);
      }
    } catch (err) {
      toast.error('Failed to configure typesetting variables.');
    }
  };

  const handleResetTheme = async () => {
    if (confirm(language === 'zh' ? '确定要重置设计主题吗？' : 'Are you sure you want to restore the default styling config?')) {
      const updatedBook = {
        ...book,
        designTheme: undefined,
        updatedAt: Date.now()
      };
      await updateBook(book.id, { designTheme: undefined });
      onUpdateBook(updatedBook);
      toast.success(language === 'zh' ? '已成功重置风格记忆库' : 'Aesthetic memory bank reset.');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-zinc-50 dark:bg-zinc-950 font-sans relative">
      
      {/* 2-Column Responsive Layout: Large screens side-by-side, smaller screens vertical */}
      <div className="flex-1 flex flex-col xl:flex-row overflow-hidden">
        
        {/* Left Side: interactive Theme Overview / Configuration */}
        <div className="w-full xl:w-[480px] h-full border-r border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex flex-col shrink-0 overflow-y-auto select-none">
          
          <div className="p-5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/40 shrink-0">
            <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-50 flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-indigo-500 fill-indigo-100 dark:fill-none" />
              {language === 'zh' ? '书籍美学风格记忆库' : 'Book Vibe & Schematics Bank'}
            </h2>
            <p className="text-[11px] text-zinc-400 mt-1 leading-normal">
              {language === 'zh' 
                ? '作为整本书的高级美学中枢，自动约束全书封面、多页排版以及AI插画生成的艺术走向。' 
                : 'Formulates book visual pillars, propagating design directives to multi-page layouts, jackets and AI canvas.'}
            </p>
          </div>

          {/* Toggle Tabs */}
          <div className="flex p-1 m-4 rounded-xl bg-zinc-100 dark:bg-zinc-950 select-none text-[11px] font-bold gap-1 shrink-0">
            <button
              onClick={() => setActiveTab('visual')}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                activeTab === 'visual'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <Palette className="w-3.5 h-3.5 text-indigo-505" />
              <span>{language === 'zh' ? '成长主格调' : 'Active Theme'}</span>
            </button>
            <button
              onClick={() => setActiveTab('masters')}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                activeTab === 'masters'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <Compass className="w-3.5 h-3.5 text-emerald-500" />
              <span>{language === 'zh' ? '名家大师馆' : 'Master Archive'}</span>
            </button>
            <button
              onClick={() => setActiveTab('layout-workshop')}
              className={`flex-1 py-1.5 rounded-lg text-center transition-all flex items-center justify-center gap-1 ${
                activeTab === 'layout-workshop'
                  ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50 shadow-sm'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5 text-pink-500" />
              <span>{language === 'zh' ? '排版线框工坊' : 'Layout Grid'}</span>
            </button>
          </div>

          <div className="flex-1 p-5 overflow-y-auto min-h-0">
            <AnimatePresence mode="wait">
              {activeTab === 'visual' && (
                <motion.div
                  key="visual"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-5 text-xs text-zinc-650 dark:text-zinc-300"
                >
                  {/* Philosophy Description card */}
                  <div className="bg-gradient-to-br from-indigo-50/40 to-slate-50/40 dark:from-indigo-950/20 dark:to-slate-950/20 p-4.5 rounded-xl border border-indigo-150/40 dark:border-indigo-900/10">
                    <h3 className="text-zinc-900 dark:text-zinc-200 font-bold mb-1.5 flex items-center gap-1 text-[11px]">
                      <BookOpen className="w-3.5 h-3.5 text-indigo-500" />
                      {language === 'zh' ? '书籍装帧设计原主张' : 'Core Aesthetic Guidelines'}
                    </h3>
                    <p className="leading-relaxed text-zinc-600 dark:text-zinc-300 text-[11px] font-serif italic whitespace-pre-wrap">
                      {theme.extractedGuidelines}
                    </p>
                  </div>

                  {/* Keywords */}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1.5">{language === 'zh' ? '风格意象关键词' : 'Atmospheric Keywords'}</span>
                    <div className="flex flex-wrap gap-1">
                      {theme.keywords.map((k, i) => (
                        <span key={i} className="px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 rounded-md font-medium border border-zinc-200/50 dark:border-zinc-705/30 hover:scale-105 transition-all text-[10px] cursor-default">
                          #{k}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Colors Palette Grid */}
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-bold block mb-1.5">{language === 'zh' ? '风格核心调色板' : 'Color Palette'}</span>
                    <div className="grid grid-cols-4 gap-1.5">
                      <div className="p-2 border border-zinc-150 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-center">
                        <div className="w-6 h-6 rounded-full mx-auto border border-black/10 shadow-inner mb-1" style={{ backgroundColor: theme.colors.dominant }}></div>
                        <span className="block text-[9px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">{language === 'zh' ? '主色' : 'Dominant'}</span>
                        <span className="block text-[8px] font-mono opacity-50">{theme.colors.dominant}</span>
                      </div>
                      <div className="p-2 border border-zinc-150 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-center">
                        <div className="w-6 h-6 rounded-full mx-auto border border-black/10 shadow-inner mb-1" style={{ backgroundColor: theme.colors.accent }}></div>
                        <span className="block text-[9px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">{language === 'zh' ? '点缀' : 'Accent'}</span>
                        <span className="block text-[8px] font-mono opacity-50">{theme.colors.accent}</span>
                      </div>
                      <div className="p-2 border border-zinc-150 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-center">
                        <div className="w-6 h-6 rounded-full mx-auto border border-black/10 shadow-inner mb-1" style={{ backgroundColor: theme.colors.background }}></div>
                        <span className="block text-[9px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">{language === 'zh' ? '背景' : 'Paper'}</span>
                        <span className="block text-[8px] font-mono opacity-50">{theme.colors.background}</span>
                      </div>
                      <div className="p-2 border border-zinc-150 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-center">
                        <div className="w-6 h-6 rounded-full mx-auto border border-black/10 shadow-inner mb-1" style={{ backgroundColor: theme.colors.text }}></div>
                        <span className="block text-[9px] font-semibold text-zinc-800 dark:text-zinc-200 truncate">{language === 'zh' ? '字体' : 'Ink'}</span>
                        <span className="block text-[8px] font-mono opacity-50">{theme.colors.text}</span>
                      </div>
                    </div>
                  </div>

                  {/* Modern Typography preset row */}
                  <div className="border border-zinc-150 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 p-3.5 space-y-2">
                    <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800/60 pb-1.5">
                      <span className="font-bold flex items-center gap-1 text-zinc-800 dark:text-zinc-100">
                        <Type className="w-3.5 h-3.5 text-zinc-400" />
                        {language === 'zh' ? '推荐字体搭配' : 'Fonts Recommendation'}
                      </span>
                      <span className="text-[9px] text-emerald-600 font-bold bg-emerald-50 dark:bg-emerald-950/40 px-1.5 py-0.5 rounded">
                        {theme.typography.styleVibe}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-[11px]">
                      <div>
                        <span className="text-zinc-400 block text-[9px] uppercase font-bold">{language === 'zh' ? '大章标题' : 'Heading Vibe'}</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">{theme.typography.headingFont}</span>
                      </div>
                      <div>
                        <span className="text-zinc-400 block text-[9px] uppercase font-bold">{language === 'zh' ? '正阅读段' : 'Body Copyset'}</span>
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 block">{theme.typography.bodyFont}</span>
                      </div>
                    </div>
                  </div>

                  {/* Core controls */}
                  <div className="p-3 bg-indigo-50/30 dark:bg-indigo-950/10 border border-dashed border-indigo-200 dark:border-indigo-900/60 rounded-xl space-y-3.5">
                    <div>
                      <h4 className="font-bold text-zinc-900 dark:text-zinc-100 text-[11px]">{language === 'zh' ? '多项物理复用控制中心' : 'Physical Multi-distribution'}</h4>
                      <p className="text-[10px] text-zinc-500 mt-0.5 leading-normal">
                        {language === 'zh' 
                          ? '一键分发调色参数、纸质底色。把设计大本营的思想自动打通应用给书籍封面。'
                          : 'Distribute background ink values directly to matching cover parameters.'}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={handleApplyColorsToCover}
                        className="h-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 shadow-sm shrink-0 pointer-events-auto"
                      >
                        <Palette className="w-3 h-3" />
                        {language === 'zh' ? '配色同步到封面' : 'Sync Palette to Cover'}
                      </button>
                      <button
                        onClick={handleApplyLayoutSuggestions}
                        className="h-8 bg-zinc-800 hover:bg-zinc-700 dark:bg-zinc-800 dark:hover:bg-zinc-750 text-zinc-100 hover:text-white font-bold rounded-lg text-[10px] flex items-center justify-center gap-1 shadow-sm shrink-0 pointer-events-auto"
                      >
                        <Sliders className="w-3 h-3" />
                        {language === 'zh' ? '样式同步微排版' : 'Trace Layout Presets'}
                      </button>
                    </div>
                  </div>

                  {/* History Logs */}
                  <div className="border border-zinc-150 dark:border-zinc-800 rounded-xl bg-zinc-50/50 dark:bg-zinc-950/20 overflow-hidden">
                    <span className="bg-zinc-100 dark:bg-zinc-900 border-b border-zinc-150 dark:border-zinc-800 px-3 py-2 block font-bold text-[10px] uppercase text-zinc-500">{language === 'zh' ? '设计记忆生成日志' : 'Growth Memories'}</span>
                    <div className="p-3 max-h-[140px] overflow-y-auto space-y-2 text-[10px] scrollbar-thin">
                      {theme.growthMemories && theme.growthMemories.length > 0 ? (
                        theme.growthMemories.map((log, idx) => (
                          <div key={idx} className="flex gap-1.5">
                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0 mt-1"></span>
                            <span className="text-zinc-650 dark:text-zinc-400 select-text font-mono leading-relaxed">{log}</span>
                          </div>
                        ))
                      ) : (
                        <p className="text-zinc-400">No logs yet.</p>
                      )}
                    </div>
                  </div>

                  {/* Refine inputs */}
                  <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <label className="text-[10px] uppercase font-bold text-zinc-400">{language === 'zh' ? '输入新参考/意图以演化融合' : 'Evolve Design Intent'}</label>
                    <textarea
                      value={inspiration}
                      onChange={(e) => setInspiration(e.target.value)}
                      rows={4}
                      className="w-full p-3 text-[11px] leading-relaxed bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-sans scrollbar-thin select-text"
                    />
                    <button
                      onClick={handleExtract}
                      disabled={isExtracting}
                      className="w-full h-8 bg-zinc-900 hover:bg-black dark:bg-indigo-600 dark:hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold transition-all flex items-center justify-center gap-1 shadow pointer-events-auto"
                    >
                      {isExtracting ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>{language === 'zh' ? '演化融汇美学思维中…' : 'Evolving Master Guidelines...'}</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3 h-3" />
                          <span>{language === 'zh' ? '精微重新提取并演化' : 'Evolve and Grow Aesthetic Brain'}</span>
                        </>
                      )}
                    </button>
                  </div>

                  <button
                    onClick={handleResetTheme}
                    className="w-full py-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-955/20 rounded-md text-[10px] font-bold transition-all"
                  >
                    {language === 'zh' ? '擦除并重置为此书初始设定' : 'Clear Style Guides'}
                  </button>
                </motion.div>
              )}

              {activeTab === 'masters' && (
                <motion.div
                  key="masters"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-zinc-400">{language === 'zh' ? '可增长的名家美学宝典' : 'Collectible Master styles'}</span>
                    <button
                      onClick={() => setShowAddMasterModal(true)}
                      className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-bold pointer-events-auto"
                    >
                      <Plus className="w-3 h-3" />
                      {language === 'zh' ? '创建自定义风格' : 'Add Custom'}
                    </button>
                  </div>

                  {showAddMasterModal && (
                    <motion.div 
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                          <Compass className="w-3.5 h-3.5 text-emerald-500" />
                          {language === 'zh' ? '创建/AI抽取新名家' : 'Synthesize Master Style'}
                        </span>
                        <button onClick={() => setShowAddMasterModal(false)} className="text-zinc-400 hover:text-zinc-200 text-xs font-bold font-mono">X</button>
                      </div>

                      <div className="space-y-2">
                        <p className="text-[10px] text-zinc-500 leading-normal">
                          {language === 'zh'
                            ? '输入你想生成的名家、流派，或用自然语言写出需求，AI 会抽取并丰富结构化的调色板、美学信条。'
                            : 'Type design school or custom designer descriptions. AI parses structured elements.'}
                        </p>
                        <input
                          type="text"
                          value={customMasterPrompt}
                          onChange={(e) => setCustomMasterPrompt(e.target.value)}
                          placeholder={language === 'zh' ? '如：David Carson Grunge 脏乱排版风' : 'e.g. David Carson grunge magazine aesthetics'}
                          className="w-full text-[11px] p-2 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-850 text-zinc-800 dark:text-zinc-200 outline-none focus:ring-1 focus:ring-indigo-505 select-text"
                          disabled={isCreatingMaster}
                        />
                        <button
                          onClick={handleAICreateMaster}
                          disabled={isCreatingMaster || !customMasterPrompt.trim()}
                          className="w-full h-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 pointer-events-auto"
                        >
                          {isCreatingMaster ? (
                            <>
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>{language === 'zh' ? '学术解析建档中…' : 'Extracting historical archives...'}</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3" />
                              <span>{language === 'zh' ? 'AI 抽取建档并增改库中' : 'AI Generate Master Profile'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </motion.div>
                  )}

                  <div className="space-y-3 max-h-[500px] overflow-y-auto scrollbar-thin pr-1">
                    {/* User custom masters first if any */}
                    {customMasters.map((m) => (
                      <div key={m.id} className="border border-emerald-500/30 dark:border-emerald-500/20 rounded-xl bg-emerald-50/5 dark:bg-emerald-950/5 p-4.5 space-y-3 relative overflow-hidden group">
                        <div className="absolute right-3 top-3 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDeleteCustomMaster(m.id, m.nameZh)}
                            className="p-1 hover:bg-zinc-200 dark:hover:bg-zinc-800 text-red-500 rounded"
                            title={language === 'zh' ? '删除名家' : 'Delete profile'}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="px-1.5 py-0.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-mono text-[8px] font-bold rounded uppercase">AI CUSTOM</span>
                            <h4 className="font-bold text-sm text-zinc-900 dark:text-zinc-50">{language === 'zh' ? m.nameZh : m.name}</h4>
                          </div>
                          <span className="text-[10px] text-zinc-400 mt-0.5 block">{m.vibe}</span>
                        </div>

                        <p className="text-[10px] leading-relaxed italic text-zinc-500 font-serif border-l border-zinc-200 dark:border-zinc-800 pl-2">
                          {m.quote}
                        </p>

                        {/* Colors */}
                        <div className="flex gap-2">
                          {Object.values(m.colors).map((c, i) => (
                            <div key={i} className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: c }} />
                          ))}
                        </div>

                        <button
                          onClick={() => handleAdoptMaster(m)}
                          className="w-full h-7 bg-zinc-900 hover:bg-black dark:bg-emerald-600 dark:hover:bg-emerald-700 font-bold text-white text-[10px] rounded-lg flex items-center justify-center gap-1 shadow transition-all pointer-events-auto"
                        >
                          <MousePointerClick className="w-3 h-3 text-emerald-250 animate-bounce" />
                          {language === 'zh' ? '采集此名家美学到项目' : 'Collect Style & Mutate Memory'}
                        </button>
                      </div>
                    ))}

                    {/* Presets */}
                    {PRESET_MASTERS.map((m) => (
                      <div key={m.id} className="border border-zinc-200 dark:border-zinc-805 rounded-xl bg-white dark:bg-zinc-900/60 p-4 space-y-3 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-xs text-zinc-905 dark:text-zinc-50">
                              {language === 'zh' ? m.nameZh : m.name}
                            </h4>
                            <span className="text-[9px] text-indigo-500 font-semibold block">{m.vibe}</span>
                          </div>
                          <div className="flex gap-1">
                            {Object.values(m.colors).map((c, i) => (
                              <div key={i} className="w-3.5 h-3.5 rounded-full border border-black/5" style={{ backgroundColor: c }} />
                            ))}
                          </div>
                        </div>

                        <p className="text-[10px] leading-relaxed italic text-zinc-500 font-serif border-l-2 border-indigo-500/20 pl-2">
                          {m.quote}
                        </p>

                        <div className="text-[10px] text-zinc-400 leading-normal space-y-1">
                          <p><strong className="text-zinc-500">{language === 'zh' ? '插画约束' : 'Art constraints'}:</strong> {m.illustrationStyle.substring(0, 48)}...</p>
                          <p><strong className="text-zinc-500">{language === 'zh' ? '排版教条' : 'Layout rule'}:</strong> {m.typesettingGuidelines.substring(0, 48)}...</p>
                        </div>

                        <button
                          onClick={() => handleAdoptMaster(m)}
                          className="w-full h-7 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 font-bold text-[10px] rounded-lg flex items-center justify-center gap-1 transition-all pointer-events-auto"
                        >
                          <MousePointerClick className="w-3 h-3" />
                          {language === 'zh' ? '采集此名家风格至本项目' : 'Incorporate Mastery Vibe'}
                        </button>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}

              {activeTab === 'layout-workshop' && (
                <motion.div
                  key="layout-workshop"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.15 }}
                  className="space-y-4"
                >
                  {/* Persistent Master Wireframes Header */}
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                      <LayoutGrid className="w-3.5 h-3.5 text-indigo-500" />
                      {language === 'zh' ? '页面原型线框库 (Master Templates)' : 'Master Wireframes'}
                    </span>
                  </div>

                  {savedUserTemplates.length === 0 && !synthesizedWireframe && (
                    <div className="text-center py-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl bg-zinc-50 dark:bg-zinc-900/40 mb-6">
                      <p className="text-zinc-400 text-[11px]">
                        {language === 'zh' ? '暂无持久化的母版线框。请在下方析出一个新线框。' : 'No persistent master layouts. Extract a new wireframe below.'}
                      </p>
                    </div>
                  )}

                  {/* Saved Templates Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {savedUserTemplates.map((t) => (
                      <div key={t.id} className="border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2.5 rounded-xl flex flex-col gap-3 shadow-sm hover:border-indigo-300 dark:hover:border-indigo-700 transition-all select-none group relative">
                        <div className="flex gap-3 h-full">
                           {/* Wireframe Preview Box */}
                           <div className="w-[65px] h-[90px] rounded-[3px] shadow border relative overflow-hidden shrink-0" 
                                style={{ 
                                  backgroundColor: (t.paperStyle === 'dark' || t.paperStyle === 'slate') ? '#18181b' : (t.paperStyle === 'warm' || t.paperStyle === 'vintage') ? '#fdf6e3' : '#ffffff',
                                  borderColor: (t.paperStyle === 'dark' || t.paperStyle === 'slate') ? '#3f3f46' : '#e4e4e7'
                                }}>
                              <div className="absolute border border-indigo-500/30 bg-indigo-500/10 flex gap-[2px] p-[1px]" style={{
                                top: `${Math.min(20, (t.marginTop || 48) / 3.5)}px`, 
                                bottom: `${Math.min(20, (t.marginBottom || 48) / 3.5)}px`, 
                                left: `${Math.min(15, (t.marginLeft || 48) / 3.5)}px`, 
                                right: `${Math.min(15, (t.marginRight || 48) / 3.5)}px`, 
                              }}>
                                  {Array.from({length: t.columns || 1}).map((_, i) => (
                                      <div key={i} className="flex-1 h-full bg-zinc-500/20 rounded-[1px]"></div>
                                  ))}
                              </div>
                              {t.headerPos !== 'hidden' && (
                                <div className="absolute h-[2px] w-[60%] left-[20%] top-[8px] bg-zinc-500/30 rounded-full"></div>
                              )}
                           </div>
                           
                           {/* Info & Actions */}
                           <div className="flex-1 flex flex-col min-w-0 py-0.5">
                             <div className="flex justify-between items-start">
                               <h4 className="font-bold text-[10px] text-zinc-800 dark:text-zinc-200 truncate leading-tight pr-1" title={t.name}>{t.name}</h4>
                               <button onClick={() => {
                                  const filtered = savedUserTemplates.filter(temp => temp.id !== t.id);
                                  setSavedUserTemplates(filtered);
                                  localStorage.setItem(`inkspire_user_templates_${book.id}`, JSON.stringify(filtered));
                               }} className="text-zinc-300 hover:text-red-500 shrink-0"><Trash2 className="w-3 h-3" /></button>
                             </div>
                             <span className="text-[8.5px] text-zinc-400 mt-1 block uppercase font-mono tracking-tighter truncate">cols:{t.columns} | p:{t.paperStyle}</span>
                             <div className="mt-auto pt-1 flex flex-col gap-1.5">
                               <button
                                 onClick={() => handleExecuteBatchTypeset(t)}
                                 className="w-full bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 font-bold text-[9px] py-1 rounded flex items-center justify-center gap-1 transition-all"
                               >
                                 <Layers className="w-3 h-3" />
                                 {language === 'zh' ? '应用全书' : 'Apply All'}
                               </button>
                             </div>
                           </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* AI Extraction Section */}
                  <div className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/50 space-y-4">
                    <span className="font-bold text-[10px] uppercase text-zinc-500 block">
                      {language === 'zh' ? '+ 析出新线框 (AI Deconstruct)' : '+ Extract New Wireframe'}
                    </span>
                    
                    <div className="grid grid-cols-2 gap-2">
                       {REFERENCE_LAYOUTS.map((ref) => (
                         <div
                           key={ref.id}
                           onClick={() => setSelectedRefLayoutId(ref.id)}
                           className={`cursor-pointer rounded-lg p-2 border transition-all text-[10px] h-[70px] flex flex-col justify-center relative overflow-hidden ${
                             selectedRefLayoutId === ref.id 
                               ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30' 
                               : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50'
                           }`}
                         >
                           <div className="font-bold text-zinc-800 dark:text-zinc-200 z-10 leading-tight">
                             {language === 'zh' ? ref.nameZh : ref.name}
                           </div>
                           <div className="text-[8px] text-zinc-400 mt-0.5 z-10 font-mono">
                             COL:{ref.wireframeMock.columns} | {ref.wireframeMock.paperStyle}
                           </div>
                           {/* watermark icon */}
                           <LayoutGrid className="absolute -right-3 -bottom-3 w-14 h-14 text-zinc-100 dark:text-zinc-800/50 -rotate-12 z-0" />
                         </div>
                       ))}
                    </div>

                    <div className="flex gap-2">
                       <input
                         type="text"
                         value={customWireframePrompt}
                         onChange={(e) => setCustomWireframePrompt(e.target.value)}
                         placeholder={language === 'zh' ? '行距略紧，经典白底...' : 'tighter lines...'}
                         className="flex-1 text-[11px] px-2.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 outline-none"
                       />
                       <button
                         onClick={handleTraceLayout}
                         disabled={isSynthesizingWireframe}
                         className="h-9 px-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg flex items-center justify-center gap-1 shadow-md shrink-0"
                       >
                         {isSynthesizingWireframe ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                         {language === 'zh' ? '析出线框' : 'Extract'}
                       </button>
                    </div>

                    {/* Active Unsynthesized Preview */}
                    {synthesizedWireframe && (
                      <div className="mt-3 p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl">
                        <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" />
                          {language === 'zh' ? '成功析出几何数据。是否保存母版？' : 'Geometry extracted. Save as Master?'}
                        </div>
                        <div className="text-[9px] font-mono text-zinc-500 mb-3 ml-4">
                          {synthesizedWireframe.name} ({synthesizedWireframe.columns} col, {synthesizedWireframe.paperStyle})
                        </div>
                        <div className="flex gap-2">
                           <button onClick={() => setSynthesizedWireframe(null)} className="flex-1 h-8 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] rounded shadow-sm text-zinc-600 dark:text-zinc-300">
                             {language === 'zh' ? '取消丢弃' : 'Discard'}
                           </button>
                           <button onClick={handleInternalizeTemplate} className="flex-1 h-8 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold rounded shadow-sm flex justify-center items-center gap-1">
                             <Save className="w-3 h-3" />
                             {language === 'zh' ? '加入母版库' : 'Save as Master'}
                           </button>
                        </div>
                      </div>
                    )}
                  </div>

                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Right Side: Visual Master Guideline Dashboard & interactive simulated sheets */}
        <div className="flex-1 overflow-y-auto bg-zinc-950 p-4 sm:p-8 flex flex-col justify-start items-center relative animate-fade-in custom-scroll-dtp select-text">
          
          <div className="w-full max-w-2xl bg-zinc-900/50 rounded-2xl border border-zinc-800 p-6 md:p-8 space-y-8 shadow-2xl backdrop-blur-md">
            
            {/* Header aesthetic */}
            <div className="flex items-center justify-between border-b border-zinc-800 pb-5 select-none">
              <div>
                <span className="px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/10 font-mono text-[9px] uppercase tracking-wider">
                  {theme.typography.styleVibe}
                </span>
                <h1 className="text-xl md:text-2xl font-bold text-zinc-100 font-serif mt-1">
                  《{book.title}》{language === 'zh' ? '全书物理装帧与美学控制板' : 'Book Master Esthetic Layout Blueprint'}
                </h1>
              </div>
              <LogoDecor />
            </div>

            {/* Simulated Live Book Sheet with current active themes applied */}
            <div className="space-y-3">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block mb-1 select-none">
                {language === 'zh' ? '实时微型版心预览 (Applied Styles Preview)' : 'Typeset Canvas Live Mockup'}
              </span>
              
              <div 
                className="w-full border shadow-2xl rounded-2xl overflow-hidden p-6 md:p-8 select-text font-serif min-h-[300px] transition-all duration-500 flex flex-col justify-between"
                style={{
                  backgroundColor: theme.colors.background,
                  borderColor: theme.colors.dominant + '33',
                  color: theme.colors.text
                }}
              >
                <div>
                  <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider border-b pb-2 mb-6 border-zinc-300 dark:border-zinc-850" style={{ color: theme.colors.dominant }}>
                    <span>CHAPTER 01</span>
                    <span>{book.title}</span>
                  </div>

                  <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-4 text-center font-serif" style={{ color: theme.colors.dominant }}>
                    {language === 'zh' ? '第一章：解密美学之始' : 'Chapter 1: The Code of Aesthetics'}
                  </h2>
                  
                  {/* Actual applied drop caps */}
                  <div className="relative text-xs leading-relaxed text-left pl-1 font-serif select-text">
                    <span 
                      className="float-left text-5xl font-extrabold pr-2.5 pt-1.5 font-serif select-none" 
                      style={{ color: theme.colors.dominant, lineHeight: '0.85' }}
                    >
                      {language === 'zh' ? '美' : 'A'}
                    </span>
                    <p className="mb-4">
                      {language === 'zh' 
                        ? '美学并不是一种悬空的概念，而是通过精确的控制与装帧记忆生长的。当你在这个「设计风格体系」面板中吸收了新的美学或析出了新的线框图时，这些装帧指标便自动成为指路灯。'
                        : 'Esthetics is not an abstract realm; it grows by delicate measurements and structural memories. Placing this growing theme into the book memory ensures absolute stylistic consistency.'}
                    </p>
                    <p>
                      {language === 'zh'
                        ? '这代表着您在这里完成的每一笔设计灵感收集，已经深深印刻在数据库中，成为自动复用到之后各个章节插图和页面的“设计魂”。'
                        : 'Any inspirations traced and saved here immediately establish durable parameters, forging a coherent creative visual engine across generations.'}
                    </p>
                  </div>
                </div>

                <div className="border-t pt-2 mt-8 text-center text-[10px] font-semibold border-zinc-200 dark:border-zinc-800/20" style={{ color: theme.colors.dominant + 'aa' }}>
                  — 1 —
                </div>
              </div>
            </div>

            {/* Dynamic Wireframe visualizer if in workshop phase */}
            {workshopPhase === 'wireframe' && synthesizedWireframe && (
              <div className="space-y-3 p-4 border border-indigo-500/30 rounded-xl bg-zinc-950 text-xs animate-pulse">
                <span className="text-[10px] uppercase tracking-wider text-indigo-400 font-bold block mb-1">
                  [ 正在对齐线框网格系统拓扑 (Geometric Blueprint Visualization) ]
                </span>
                
                {/* Simulated Wireframe blueprint block */}
                <div 
                  className={`w-full rounded-lg border-2 border-dashed border-indigo-500/40 p-4 font-mono text-[9px] relative min-h-[220px] shadow-inner flex flex-col justify-between`}
                  style={{
                    backgroundColor: synthesizedWireframe.paperStyle === 'dark' ? '#18181B' : '#F9F8F6',
                    color: '#4F46E5'
                  }}
                >
                  {/* Top rulers indicators */}
                  <div className="absolute top-0 left-0 right-0 h-4 border-b border-indigo-500/20 flex justify-between px-2 items-center opacity-70">
                    <span>X: 0px</span>
                    <div className="flex gap-2 text-[8px]">
                      <span>RULER RIDGE</span>
                      <span>COLUMN WIDTH: {Math.round(400 / (synthesizedWireframe.columns))}px</span>
                    </div>
                    <span>X: 520px</span>
                  </div>

                  {/* Body wireframe grid overlay */}
                  <div 
                    className="flex-1 mt-6 flex gap-4"
                    style={{
                      paddingTop: `${synthesizedWireframe.marginTop / 4}px`,
                      paddingBottom: `${synthesizedWireframe.marginBottom / 4}px`,
                      paddingLeft: `${synthesizedWireframe.marginLeft / 4}px`,
                      paddingRight: `${synthesizedWireframe.marginRight / 4}px`,
                    }}
                  >
                    {[...Array(Number(synthesizedWireframe.columns) || 1)].map((_, i) => (
                      <div key={i} className="flex-1 border border-indigo-500/30 border-dashed rounded p-2 flex flex-col justify-between bg-indigo-500/[0.02]">
                        <div className="space-y-1.5 opacity-60">
                          {synthesizedWireframe.dropCaps && i === 0 && (
                            <div className="w-6 h-6 border-2 border-indigo-500 bg-indigo-500/10 float-left mr-1 flex items-center justify-center font-bold">CAP</div>
                          )}
                          <div className="h-1 bg-indigo-550 rounded w-full"></div>
                          <div className="h-1 bg-indigo-550 rounded w-5/6"></div>
                          <div className="h-1 bg-indigo-550 rounded w-4/5"></div>
                          <div className="h-1 bg-indigo-550 rounded w-full"></div>
                        </div>
                        <div className="text-[7.5px] text-center opacity-40 uppercase">GUTTER GUIDE</div>
                      </div>
                    ))}
                  </div>

                  {/* Wireframe parameters labels */}
                  <div className="h-6 border-t border-indigo-500/20 flex justify-between items-center text-[8px] opacity-70 px-2 mt-4">
                    <span>GRID SYSTEM: {synthesizedWireframe.columns}栏线板</span>
                    <span>PADDING: {synthesizedWireframe.marginLeft}px | {synthesizedWireframe.marginRight}px</span>
                    <span>CORNER MARKERS</span>
                  </div>
                </div>
              </div>
            )}

            {/* Auto-propagate AI illustration prompt constraints */}
            <div className="space-y-3 select-none">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-bold block">
                {language === 'zh' ? '全局 AI 插画风格强约束前缀' : 'GLOBAL OVERRIDING ILLUSTRATION STYLE'}
              </span>
              
              <div className="p-4 bg-zinc-950 border border-zinc-805 rounded-xl flex items-start gap-3">
                <ImageIcon className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <p className="text-xs text-zinc-300 font-mono leading-relaxed select-all">
                    {theme.illustrationStyle}
                  </p>
                  <p className="text-[9px] text-zinc-500 max-w-lg leading-normal">
                    {language === 'zh'
                      ? '在任何排版页插图生成时，系统在此主题设定下的风格描述将自动追加在画作提示后，确保全书具有绝对连贯、不可动摇的视觉艺术完整度。'
                      : 'While drafting image keywords anywhere in DTP, this overarching prompt suffix is silently appended, protecting visual consistency.'}
                  </p>
                </div>
              </div>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}

function LogoDecor() {
  return (
    <div className="flex gap-1">
      <div className="w-1.5 h-6 bg-zinc-800 rounded-full"></div>
      <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
      <div className="w-1.5 h-6 bg-amber-500 rounded-full"></div>
    </div>
  );
}
