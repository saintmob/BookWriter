import React from 'react';
import { Chapter } from '../lib/db';
import { BookOpen } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export function ChapterDirectoryView({ chapter }: { chapter: Chapter }) {
  const { i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  return (
    <div className="flex-1 flex flex-col items-center justify-center text-zinc-400 dark:text-zinc-650 bg-zinc-50 dark:bg-zinc-950 p-8 h-full">
      <div className="max-w-md w-full text-center space-y-6">
        <BookOpen className="w-16 h-16 text-emerald-600/20 dark:text-emerald-400/20 mx-auto" />
        <div className="space-y-4">
          <h2 className="text-3xl font-serif font-bold text-zinc-800 dark:text-zinc-200">{chapter.title}</h2>
          {chapter.description && (
            <p className="text-zinc-500 dark:text-zinc-400 font-serif leading-relaxed italic">{chapter.description}</p>
          )}
        </div>
        <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
          <p className="text-sm font-medium text-zinc-500">
            {isZh ? '这是一个结构层级目录（卷/章）。请在左侧侧边栏选择具体的「节」进行详细文本写作与编辑。' : 'This is a structural directory (Part/Chapter). Please select a specific Section from the sidebar to write and edit content.'}
          </p>
        </div>
      </div>
    </div>
  );
}
