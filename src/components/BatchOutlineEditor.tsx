import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Chapter } from '../lib/db';
import { cn } from '../lib/utils';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';
import { Copy, Save, Sparkles, BookOpen } from 'lucide-react';

interface BatchOutlineEditorProps {
  chapters: Chapter[];
  onImport: (newChapters: Chapter[]) => void;
  bookTitle: string;
}

export function BatchOutlineEditor({ chapters, onImport, bookTitle }: BatchOutlineEditorProps) {
  const { t, i18n } = useTranslation();
  const isZh = i18n.language === 'zh';
  
  const generateMarkdownString = (chaps: Chapter[]) => {
    let md = `# ${bookTitle}\n\n`;
    let currentPart = '';
    
    chaps.forEach((chap) => {
      const level = chap.level || 2;
      
      if (level === 1) {
        md += `## Part: ${chap.title}\n`;
        if (chap.description) md += `> ${chap.description}\n`;
        md += `\n`;
        currentPart = chap.title;
      } else if (level === 2) {
        md += `## ${chap.title}\n`;
        if (chap.description) {
           // write description on new lines
           const lines = chap.description.split('\n');
           lines.forEach(l => {
              if(l.trim()) md += `> ${l}\n`;
           })
        }
      } else if (level === 3) {
        md += `- ${chap.title}\n`;
      }
    });
    return md;
  };

  const [rawText, setRawText] = useState(() => generateMarkdownString(chapters));
  
  useEffect(() => {
     setRawText(generateMarkdownString(chapters));
  }, [chapters]);

  const handleParseAndImport = () => {
    try {
      const lines = rawText.split('\n');
      const newChapters: Chapter[] = [];
      let currentPart: string | null = null;
      let currentChapter: any = null;

      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line) continue;
        
        // Skip Book Title
        if (line.startsWith('# ')) {
          continue;
        }

        // Chapters or Parts
        if (line.startsWith('## ')) {
          const title = line.substring(3).trim();
          
          if (title.toLowerCase().startsWith('part:') || title.startsWith('卷:')) {
             const cleanTitle = title.replace(/^(part:|卷:)\s*/i, '').trim();
             const partChap: any = {
               id: uuidv4(),
               bookId: chapters[0]?.bookId || '',
               title: cleanTitle,
               description: '',
               content: '',
               order: newChapters.length,
               createdAt: Date.now(),
               updatedAt: Date.now(),
               level: 1
             };
             newChapters.push(partChap);
             currentChapter = partChap;
          } else {
             const newChap: any = {
               id: uuidv4(),
               bookId: chapters[0]?.bookId || '',
               title: title,
               description: '',
               content: '',
               order: newChapters.length,
               createdAt: Date.now(),
               updatedAt: Date.now(),
               level: 2
             };
             newChapters.push(newChap);
             currentChapter = newChap;
          }
          continue;
        }

        // Description
        if (line.startsWith('>')) {
          if (currentChapter) {
             const desc = line.substring(1).trim();
             currentChapter.description = currentChapter.description 
                ? `${currentChapter.description}\n${desc}` 
                : desc;
          }
          continue;
        }

        // Sections
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const secTitle = line.substring(2).trim();
          
          const newSec: any = {
             id: uuidv4(),
             bookId: chapters[0]?.bookId || '',
             title: secTitle,
             description: '',
             content: '',
             order: newChapters.length,
             createdAt: Date.now(),
             updatedAt: Date.now(),
             level: 3
          };
          newChapters.push(newSec);
          // If we want sections to have descriptions we'd need to track it as currentSection
          // but for now it's fine.
          currentChapter = newSec; 
          continue;
        }
        
        // Paragraph text assigned as description
        if (currentChapter && !line.startsWith('-') && !line.startsWith('*')) {
          currentChapter.description = currentChapter.description
            ? `${currentChapter.description} ${line}`
            : line;
        }
      }

      // Preserve existing mapping by matching title & level where possible
      const finalMapped = newChapters.map((nc) => {
         const existing = chapters.find(c => c.title === nc.title && c.level === nc.level);
         if (existing) {
            return {
               ...nc,
               id: existing.id,
               content: existing.content,
               image: existing.image,
               createdAt: existing.createdAt
            };
         }
         return nc;
      });

      if (finalMapped.length === 0) {
        toast.error(isZh ? '解析失败：未检测到任何有效的章节标题' : 'Failed to parse: No valid chapters found');
        return;
      }
      
      onImport(finalMapped);
      toast.success(isZh ? `成功导入 ${finalMapped.length} 项结构！` : `Successfully imported ${finalMapped.length} nodes!`);
    } catch (e) {
      console.error(e);
      toast.error(isZh ? '解析异常，请检查文本格式' : 'Parse error, please check text format');
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-zinc-900">
      <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center bg-zinc-50 dark:bg-zinc-950/50">
        <h3 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2 text-sm">
          <BookOpen className="w-4 h-4 text-emerald-600" />
          {isZh ? '文本批量导入 / 手动编辑' : 'Bulk Text Import / Manual Edit'}
        </h3>
        <button
          onClick={handleParseAndImport}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-medium transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {isZh ? '解析并覆盖目录' : 'Parse & Override'}
        </button>
      </div>
      
      <div className="flex-1 p-4 flex flex-col gap-2">
         <textarea
           className="flex-1 w-full p-4 bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-lg text-sm text-zinc-800 dark:text-zinc-200 font-mono focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none leading-relaxed resize-none"
           value={rawText}
           onChange={(e) => setRawText(e.target.value)}
           placeholder={isZh ? `支持格式：\n## 卷: 第一卷 觉醒\n> 这是卷介绍\n## 第一章 神秘的代码\n> 本章介绍... \n- 第1节 发现错误` : `Supported format:\n## Part: Volume 1\n> Intro text\n## Chapter 1\n> Desc... \n- Section 1`}
         />
         <div className="flex justify-between items-center mt-2 text-xs text-zinc-500">
            <span className="flex items-center gap-1.5">
               <Sparkles className="w-3.5 h-3.5 text-amber-500" />
               {isZh ? '提示：可以将这段 Markdown 放入任意 AI 对话窗口批量创作后粘回此处。' : 'Tip: Pass this Markdown to any AI chat to bulk author and paste back here.'}
            </span>
            <button
               onClick={() => {
                 navigator.clipboard.writeText(rawText);
                 toast.success(isZh ? '已复制！' : 'Copied!');
               }}
               className="flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"
            >
               <Copy className="w-3.5 h-3.5" />
               Copy Text
            </button>
         </div>
      </div>
    </div>
  );
}
