import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Mermaid } from './Mermaid';
import { FloatingImage } from '../lib/db';
import { cn } from '../lib/utils';

interface MarkdownRendererProps {
  children: string;
  floatingImages?: FloatingImage[];
  selectedImageId?: string | null;
  onImageClick?: (id: string) => void;
  showBlockIndices?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  children, 
  floatingImages = [], 
  selectedImageId,
  onImageClick,
  showBlockIndices = false,
}) => {
  let elementIndex = 0;

  const renderWithImages = (tagName: any, props: any, isBlock: boolean = true) => {
    const Tag = tagName;
    if (!isBlock) return <Tag {...props} />;
    
    const idx = elementIndex++;
    const imgs = floatingImages.filter(img => img.paragraphIndex === idx && img.layoutMode && img.layoutMode !== 'absolute');
    
    // Aesthetic paragraph index indicator for precise anchoring (pretext style)
    const blockIndexIndicator = showBlockIndices ? (
      <span 
        className="absolute -left-10 top-1.5 text-[9px] font-mono select-none px-1 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 border border-zinc-200/50 dark:border-zinc-700/50 opacity-0 group-hover:opacity-100 hover:text-emerald-600 dark:hover:text-emerald-500 hover:border-emerald-500/50 transition-all cursor-pointer z-10 pointer-events-auto shadow-sm"
        title={`Paragraph / Block ID: #${idx}`}
        onClick={(e) => {
          e.stopPropagation();
        }}
      >
        #{idx}
      </span>
    ) : null;

    if (imgs.length === 0) {
      return (
        <Tag 
          {...props} 
          className={cn(
            props.className, 
            showBlockIndices && "relative group pl-2 border-l border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-colors"
          )}
        >
          {blockIndexIndicator}
          {props.children}
        </Tag>
      );
    }

    return (
      <Tag 
        {...props} 
        className={cn(
          props.className, 
          showBlockIndices && "relative group pl-2 border-l border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-colors"
        )}
      >
        {blockIndexIndicator}
        {imgs.map(img => {
          const floatStyle = 
            img.layoutMode === 'wrap-left' ? 'left' : 
            img.layoutMode === 'wrap-right' ? 'right' : 
            'none';
            
          const isCenter = img.layoutMode === 'wrap-center';
          const isFullWidth = img.layoutMode === 'full-width';
          const isSelected = selectedImageId === img.id;

          return (
            <span 
              key={img.id}
              onClick={(e) => {
                e.stopPropagation();
                if (onImageClick) onImageClick(img.id);
              }}
              className={cn(
                "inline-block transition-all duration-200 select-none",
                isSelected 
                  ? "ring-2 ring-emerald-500 ring-offset-4 dark:ring-offset-zinc-900 scale-[1.01] shadow-md z-30" 
                  : "hover:ring-1 hover:ring-zinc-400/50 dark:hover:ring-zinc-500/50 hover:scale-[1.005] z-10"
              )}
              style={{
                float: floatStyle as any,
                display: (isCenter || isFullWidth) ? 'block' : 'inline-block',
                margin: (isCenter || isFullWidth) 
                  ? '1.5rem auto' 
                  : img.layoutMode === 'wrap-left' 
                    ? '0.35rem 1.75rem 0.65rem 0' 
                    : '0.35rem 0 0.65rem 1.75rem',
                width: isFullWidth ? '100%' : `${img.width}px`,
                height: isFullWidth ? 'auto' : `${img.height}px`,
                opacity: img.opacity ?? 1,
                mixBlendMode: (img.blendMode as any) || 'normal',
                borderRadius: `${img.borderRadius ?? 0}px`,
                boxShadow: img.shadow === 'sm' ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' :
                           img.shadow === 'md' ? '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' :
                           img.shadow === 'lg' ? '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' :
                           img.shadow === 'xl' ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' : 'none',
                overflow: 'hidden',
                position: 'relative',
                cursor: 'pointer',
                clear: (isCenter || isFullWidth) ? 'both' : 'none',
              }}
            >
              <img 
                src={img.url} 
                alt="" 
                style={{ 
                  width: '100%', 
                  height: '100%', 
                  objectFit: (img.objectFit as any) || 'cover', 
                  display: 'block' 
                }} 
              />
            </span>
          );
        })}
        {props.children}
      </Tag>
    );
  };

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        p(props) { return renderWithImages('p', props); },
        h1(props) { return renderWithImages('h1', props); },
        h2(props) { return renderWithImages('h2', props); },
        h3(props) { return renderWithImages('h3', props); },
        h4(props) { return renderWithImages('h4', props); },
        ul(props) { return renderWithImages('ul', props); },
        ol(props) { return renderWithImages('ol', props); },
        blockquote(props) { return renderWithImages('blockquote', props); },
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          
          if (!inline && language === 'mermaid') {
            return renderWithImages('div', { children: <Mermaid chart={String(children).replace(/\n$/, '')} /> });
          }
          
          return (
            <code className={className} {...props}>
              {children}
            </code>
          );
        }
      }}
    >
      {children}
    </ReactMarkdown>
  );
};
