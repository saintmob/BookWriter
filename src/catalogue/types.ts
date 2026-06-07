/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface SectionItem {
  id: string;
  title: string;
  page: string;
}

export interface ChapterItem {
  id: string;
  number?: string;
  title: string;
  subtitle?: string;
  page: string;
  description?: string; // Optional chapter introductory paragraph
  sections: SectionItem[];
  imageSeed?: number; // For rendering unique elegant shapes/graphics in grid and art layouts
}

export type PageSize = 'A4_PORTRAIT' | 'A5_PORTRAIT' | 'SQUARE' | 'CUSTOM';

export interface PageDimension {
  width: number; // in mm
  height: number; // in mm
}

export type FontFamily = 'SERIF' | 'SANS' | 'DISPLAY' | 'MONO';

export type ThemePreset = 'BLACK_WHITE' | 'CREAM_PAPER' | 'BOLD_ART' | 'LUXE_GOLD' | 'RETRO_BROWN' | 'CUSTOM';

export type Density = 'LOOSE' | 'STANDARD' | 'COMPACT';

export type NumberStyle = 'NUM_ONLY' | 'CHAPTER_NUM' | 'DOTS' | 'RIGHT_VERTICAL' | 'HIDDEN';

export type ChapterPrefixStyle = 'NUM_01' | 'CHAP_01' | 'CHINESE_01' | 'CHINESE_TRAD' | 'NONE';

export interface BookInfo {
  title: string;
  subtitle: string;
  author: string;
}

export interface DesignConfig {
  pageSize: PageSize;
  customWidth: number; // mm
  customHeight: number; // mm
  fontFamily: FontFamily;
  themePreset: ThemePreset;
  customPrimaryColor: string;
  customBgColor: string;
  density: Density;
  numberStyle: NumberStyle;
  prefixStyle: ChapterPrefixStyle;
  showMargins: boolean;
  pagePadding: number; // in mm (to adjust margins directly)
  paperTexture: boolean;
  columnCount: 1 | 2 | 3;
}
