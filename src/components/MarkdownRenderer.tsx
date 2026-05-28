import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Mermaid } from './Mermaid';
import { FloatingImage } from '../lib/db';

interface MarkdownRendererProps {
  children: string;
  floatingImages?: FloatingImage[];
  selectedImageId?: string | null;
  onImageClick?: (id: string) => void;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ 
  children, 
  floatingImages = [], 
  selectedImageId,
  onImageClick
}) => {
  let elementIndex = 0;

  const renderWithImages = (tagName: any, props: any, isBlock: boolean = true) => {
    const Tag = tagName;
    if (!isBlock) return <Tag {...props} />;
    
    const idx = elementIndex++;
    const imgs = floatingImages.filter(img => img.paragraphIndex === idx && img.layoutMode && img.layoutMode !== 'absolute');
    
    if (imgs.length === 0) {
      return <Tag {...props} />;
    }

    return (
      <Tag {...props}>
        {imgs.map(img => {
          const floatStyle = 
            img.layoutMode === 'wrap-left' ? 'left' : 
            img.layoutMode === 'wrap-right' ? 'right' : 
            'none';
            
          const isCenter = img.layoutMode === 'wrap-center';
          const isSelected = selectedImageId === img.id;

          return (
            <span 
              key={img.id}
              onClick={(e) => {
                e.stopPropagation();
                if (onImageClick) onImageClick(img.id);
              }}
              className={isSelected ? "ring-2 ring-emerald-500 ring-offset-1" : ""}
              style={{
                float: floatStyle,
                display: isCenter ? 'block' : 'inline-block',
                margin: isCenter ? '1rem auto' : img.layoutMode === 'wrap-left' ? '0.25rem 1rem 0.5rem 0' : '0.25rem 0 0.5rem 1rem',
                width: img.width,
                height: img.height,
                opacity: img.opacity ?? 1,
                mixBlendMode: (img.blendMode as any) || 'normal',
                borderRadius: img.borderRadius ?? 0,
                boxShadow: img.shadow === 'sm' ? '0 1px 2px 0 rgb(0 0 0 / 0.05)' :
                           img.shadow === 'md' ? '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' :
                           img.shadow === 'lg' ? '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)' :
                           img.shadow === 'xl' ? '0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)' : 'none',
                overflow: 'hidden',
                position: 'relative',
                zIndex: img.zIndex ?? 10,
                cursor: 'pointer',
                clear: isCenter ? 'both' : 'none',
              }}
            >
              <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: (img.objectFit as any) || 'cover', display: 'block' }} />
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
