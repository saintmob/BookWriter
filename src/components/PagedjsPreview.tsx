import React, { useEffect, useRef, useState } from 'react';
import { Previewer } from 'pagedjs';

interface PagedjsPreviewProps {
  contentElement?: HTMLElement | null; // Pass the hidden element reference 
  contentHtml?: string;
  css: string;
  onProcessed?: (totalPages: number) => void;
  scale?: number;
}

export function PagedjsPreview({ contentElement, contentHtml, css, onProcessed, scale = 1 }: PagedjsPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isProcessing, setIsProcessing] = useState(true);

  useEffect(() => {
    let previewer: typeof Previewer | any = null;

    const runPreview = async () => {
      if (!containerRef.current) return;
      if (!contentElement && !contentHtml) return;

      setIsProcessing(true);
      containerRef.current.innerHTML = '';
      
      const cssBlob = new Blob([css], { type: 'text/css' });
      const cssUrl = URL.createObjectURL(cssBlob);
      
      previewer = new Previewer();
      
      try {
        const input = contentElement ? contentElement.innerHTML : contentHtml;
        
        const flow = await previewer.preview(input, [cssUrl], containerRef.current);
        URL.revokeObjectURL(cssUrl);
        setIsProcessing(false);
        if (onProcessed) {
          onProcessed(flow.total);
        }
      } catch (e) {
        console.error("Pagedjs processing error", e);
        setIsProcessing(false);
      }
    };

    runPreview();

    return () => {
      if (previewer) {
        // cleanup if necessary
      }
    };
    // We intentionally don't put contentElement in bounds to avoid infinite loops, we rely on contentHtml or a stable trigger
  }, [contentHtml, css]);

  return (
    <div className="pagedjs-wrapper relative w-full h-full overflow-auto bg-zinc-950 flex flex-col items-center py-10">
      {isProcessing && (
         <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 text-emerald-500 z-50">
            <div className="animate-pulse flex items-center gap-2">
               <div className="w-4 h-4 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
               Processing Print Layout...
            </div>
         </div>
      )}
      <div 
         ref={containerRef} 
         className="pagedjs-container origin-top transform transition-transform will-change-transform pb-20" 
         style={{ transform: `scale(${scale})` }}
      />
    </div>
  );
}
