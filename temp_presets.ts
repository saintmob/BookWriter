/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BookInfo, ChapterItem, DesignConfig } from '../types';

export const INITIAL_BOOK_INFO: BookInfo = {
  title: '筑物之美：现代主义建筑的叙事与光影',
  subtitle: 'Structural Poetry: Narrative & Play of Light in Modern Architecture',
  author: '林格轩（Lin Gexuan） 编著'
};

export const INITIAL_CHAPTERS: ChapterItem[] = [
  {
    id: 'ch-1',
    title: '重返包豪斯：形式追随功能的现代起点',
    subtitle: 'Revisiting Bauhaus: Where Form Follows Function',
    page: '14',
    description: '审视十九世纪末至二十世纪初，欧洲先锋设计思潮的滥觞，以及包豪斯学校在工业文明冲突中所奠定的现代几何美学秩序。',
    sections: [
      { id: 'sec-1-1', title: '德绍校舍的玻璃帷幕与流动空间', page: '18' },
      { id: 'sec-1-2', title: '格罗皮乌斯的艺术与技术新统一', page: '29' },
      { id: 'sec-1-3', title: '康定斯基的色彩、点线面美学实践', page: '35' }
    ],
    imageSeed: 1
  },
  {
    id: 'ch-2',
    title: '萨伏伊别墅：萨伏耶的白色几何叙事诗',
    subtitle: 'Villa Savoye: Poetics of the Five Points of Architecture',
    page: '42',
    description: '柯布西耶“新建筑五要素”的化身，一栋架空在草坡之上的白色立方体，如何通过横向长窗和漫步屋顶，重新解构人与自然的关系。',
    sections: [
      { id: 'sec-2-1', title: '底层架空：立柱作为空间的隐形支点', page: '46' },
      { id: 'sec-2-2', title: '自由平面与自由立面的逻辑演变', page: '54' },
      { id: 'sec-2-3', title: '屋顶花园：将失去的泥土还给天空', page: '62' }
    ],
    imageSeed: 2
  },
  {
    id: 'ch-3',
    title: '流水山庄：赖特有机建筑与巨石的对话',
    subtitle: 'Fallingwater: Wright’s Organic Dialogue with Natural Stones',
    page: '78',
    description: '走出机械美学，赖特在宾夕法尼亚森林中将钢筋混凝土悬臂梁直接伸入瀑布之上，完成了自然、材料与居住者灵魂的极致联调。',
    sections: [
      { id: 'sec-3-1', title: '悬挑美学：跨越溪谷的水平延伸力学', page: '82' },
      { id: 'sec-3-2', title: '本地粗石与质感：使建筑如同地盘中生长', page: '91' },
      { id: 'sec-3-3', title: '光影流转：没有边界的通角玻璃窗设计', page: '99' }
    ],
    imageSeed: 3
  },
  {
    id: 'ch-4',
    title: '朗香教堂：雕塑感空间与神秘光的倾泻',
    subtitle: 'Notre Dame du Haut: Sculptural Contours and Divine Shadows',
    page: '110',
    description: '晚期柯布西耶放弃纯粹主义纪律，转向深邃的有机蟹壳屋顶。不规则的厚重墙身和彩色玻璃采光窗，构筑了一座凝固光之交响。',
    sections: [
      { id: 'sec-4-1', title: '南墙错落光窗：斑斓的实体光柱折射', page: '114' },
      { id: 'sec-4-2', title: '混凝土曲面屋顶的轻质漂浮悬空幻觉', page: '125' },
      { id: 'sec-4-3', title: '声学空间：大理石祈祷室的虚空共鸣', page: '136' }
    ],
    imageSeed: 4
  },
  {
    id: 'ch-5',
    title: '路易·康的静谧与光明：萨克生物研究所',
    subtitle: 'Louis Kahn: Silence, Light & the Central Plaza of Salk Institute',
    page: '148',
    description: '对称的混凝土体量框架，中央一条细窄的水渠流向太平洋与严丝合缝的地平线。纯粹、原始、肃穆，光与阴影在这里找到了归宿。',
    sections: [
      { id: 'sec-5-1', title: '质感清水混凝土与柚木百叶的温暖温差', page: '152' },
      { id: 'sec-5-2', title: '作为生命之源的中央水渠与空间轴线', page: '161' },
      { id: 'sec-5-3', title: '自然光如何勾勒大理石阶的粗野边纹', page: '172' }
    ],
    imageSeed: 5
  },
  {
    id: 'ch-6',
    title: '安藤忠雄：水之教堂与风的和弦',
    subtitle: 'Tadao Ando: Church on the Water and Concrete Epiphany',
    page: '184',
    description: '清水混凝土一笔画就的极简清水墙，在四季交替的水库镜面前，十字架屹立在波光粼粼的微风中，完成东方禅意的空间留白。',
    sections: [
      { id: 'sec-6-1', title: '双层方形体量的嵌套与折返漫步路径', page: '188' },
      { id: 'sec-6-2', title: '巨型滑门开合：无物理屏障的声景合一', page: '197' },
      { id: 'sec-6-3', title: '冰与雪之歌：北海道冷色调下的纯净几何', page: '206' }
    ],
    imageSeed: 6
  }
];

export interface ColorPalette {
  name: string;
  primary: string;
  secondary: string;
  bg: string;
  text: string;
  accent: string;
  cardBg: string;
}

export const THEME_PALETTES: Record<string, ColorPalette> = {
  BLACK_WHITE: {
    name: '黑白极简 (Monochromatic Mono)',
    primary: '#111111',
    secondary: '#555555',
    bg: '#00000002', // Transparent base for paper rendering
    text: '#111111',
    accent: '#000000',
    cardBg: '#ffffff'
  },
  CREAM_PAPER: {
    name: '米白纸张 (Classic Ivory Book)',
    primary: '#24211a',
    secondary: '#5e574a',
    bg: '#fbf8f3',
    text: '#2e2a22',
    accent: '#8d7858',
    cardBg: '#faf6f0'
  },
  BOLD_ART: {
    name: '高饱和艺术风 (Vibrant Avant-Garde)',
    primary: '#1d22d3', // Klein Blue
    secondary: '#ff5400', // Neon Orange
    bg: '#fffbf4',
    text: '#121212',
    accent: '#e71c23', // Red accent
    cardBg: '#ffffff'
  },
  LUXE_GOLD: {
    name: '金色华丽风 (Imperial Gold & Obsidian)',
    primary: '#cc9c4c', // Brushed gold
    secondary: '#8a8885',
    bg: '#141416', // Slate dark body
    text: '#f1f1f1',
    accent: '#e2b36e',
    cardBg: '#1e1e24'
  },
  RETRO_BROWN: {
    name: '复古咖啡风 (Retro Tobacco & Clay)',
    primary: '#4a3728', // Espresso
    secondary: '#7a6755',
    bg: '#f4ece2',
    text: '#3d2f23',
    accent: '#b26e3c', // Terracotta
    cardBg: '#f2eae0'
  }
};

export const INITIAL_DESIGN_CONFIG: DesignConfig = {
  pageSize: 'A4_PORTRAIT',
  customWidth: 170,
  customHeight: 240,
  fontFamily: 'SERIF',
  themePreset: 'CREAM_PAPER',
  customPrimaryColor: '#24211a',
  customBgColor: '#fbf8f3',
  density: 'STANDARD',
  numberStyle: 'NUM_ONLY',
  prefixStyle: 'NUM_01',
  showMargins: true,
  pagePadding: 24, // 24mm default margins
  paperTexture: true,
  columnCount: 1
};

// Help helper triggers for randomizing options
export const FONT_OPTIONS: { id: string; label: string; class: string }[] = [
  { id: 'SERIF', label: '宋体 / 衬线风 (Serif)', class: 'font-serif' },
  { id: 'SANS', label: '黑体 / 无衬线 (Sans)', class: 'font-sans' },
  { id: 'DISPLAY', label: '艺术标题风 (Display)', class: 'font-display' },
  { id: 'MONO', label: '现代英文 / 极客 (Mono)', class: 'font-mono' }
];

export const PAGE_SIZES: { id: string; label: string; width: number; height: number }[] = [
  { id: 'A4_PORTRAIT', label: 'A4 竖版 (210 × 297 mm)', width: 210, height: 297 },
  { id: 'A5_PORTRAIT', label: 'A5 竖版 (148 × 210 mm)', width: 148, height: 210 },
  { id: 'SQUARE', label: '艺术方形 (210 × 210 mm)', width: 210, height: 210 },
  { id: 'CUSTOM', label: '自定义尺寸 (Custom Dimensions)', width: 170, height: 240 }
];

// Aesthetic templates or layouts helper descriptions
export const LAYOUTS_INFO = [
  {
    id: 'classic',
    name: '1. 经典书籍目录',
    desc: '整体规整、清晰，章节标题与页码用精致导线相连。适合学术界、正规出版物、典雅文集。',
    icon: 'AlignLeft'
  },
  {
    id: 'minimal',
    name: '2. 现代极简目录',
    desc: '大量留白、干净宁静。章节序号与页码精巧，无多余装饰，展现无声的设计力量。',
    icon: 'Maximize'
  },
  {
    id: 'magazine',
    name: '3. 艺术杂志感目录',
    desc: '大号数字编号、双分栏结构、高彩度标牌，洋溢着前卫杂志与独立季刊的艺术感。',
    icon: 'LayoutGrid'
  },
  {
    id: 'poster',
    name: '4. 海报错位目录',
    desc: '极致的字体字号对比，大胆的重叠、右移、纵横交织混排。充满张力的硬朗视觉宣泄。',
    icon: 'Compass'
  },
  {
    id: 'grid',
    name: '5. 网格蓝图目录',
    desc: '严格细致的建筑系网格，每章位于特制边框区块。极其理性的设计作品集、摄影册风。',
    icon: 'GridIcon'
  },
  {
    id: 'timeline',
    name: '6. 历史时间轴目录',
    desc: '中央以贯穿垂直细线作为纽带，章节作圆点节点散落，记录线性的时空、步骤。',
    icon: 'Clock'
  },
  {
    id: 'imagetext',
    name: '7. 图文艺术混排',
    desc: '目录内置高品质色域、抽象几何印记板块与摄影展页。极具奢华感的手工艺、摄影集范。',
    icon: 'Image'
  },
  {
    id: 'experimental',
    name: '8. 实验性反叛目录',
    desc: '打破常规、字体重叠、行距交错、斜体旋转，装饰线自由伸展。为独立艺术出版特制。',
    icon: 'Sparkles'
  }
];

export const CHAPTER_NUMBER_PRESETS = [
  { id: 'NUM_01', label: '01 / 02 / 03' },
  { id: 'CHAP_01', label: 'Chapter 01' },
  { id: 'CHINESE_01', label: '第一章 / 第二章' },
  { id: 'CHINESE_TRAD', label: '壹 / 贰 / 叁' },
  { id: 'NONE', label: '无编号' }
];

export const PAGE_NUMBER_PRESETS = [
  { id: 'NUM_ONLY', label: '单纯页码' },
  { id: 'CHAPTER_NUM', label: '序号 — 页码' },
  { id: 'DOTS', label: '· 12 · 括弧点' },
  { id: 'RIGHT_VERTICAL', label: '精致右侧竖排' },
  { id: 'HIDDEN', label: '隐藏显示' }
];

