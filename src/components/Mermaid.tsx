import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';
import { v4 as uuidv4 } from 'uuid';

mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

interface MermaidProps {
  chart: string;
}

export const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const id = `mermaid-${uuidv4()}`;

  useEffect(() => {
    let isMounted = true;

    const renderChart = async () => {
      try {
        if (!chart) return;
        
        // Reset error state
        setError(null);
        
        // Render the chart
        const { svg: renderedSvg } = await mermaid.render(id, chart);
        
        if (isMounted) {
          setSvg(renderedSvg);
        }
      } catch (err: any) {
        console.error('Mermaid rendering error:', err);
        if (isMounted) {
          setError(err.message || 'Failed to render diagram');
        }
      }
    };

    renderChart();

    return () => {
      isMounted = false;
    };
  }, [chart, id]);

  if (error) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 text-red-600 rounded-md overflow-auto text-sm font-mono">
        <p className="font-bold mb-2">Diagram Error:</p>
        <pre>{error}</pre>
        <pre className="mt-4 text-xs opacity-70">{chart}</pre>
      </div>
    );
  }

  if (!svg) {
    return <div className="animate-pulse bg-zinc-100 dark:bg-zinc-800 h-32 rounded-md flex items-center justify-center text-zinc-400">Rendering diagram...</div>;
  }

  return (
    <div 
      ref={containerRef} 
      className="mermaid flex justify-center my-6 overflow-x-auto bg-white dark:bg-zinc-900 p-4 rounded-lg border border-zinc-200 dark:border-zinc-800"
      dangerouslySetInnerHTML={{ __html: svg }} 
    />
  );
};
