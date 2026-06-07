const fs = require('fs');
let code = fs.readFileSync('src/catalogue/TOCPreview.tsx', 'utf-8');

// 1. replace signatures
code = code.replace(/const renderClassicLayout = \(\) => {/g, 'const renderClassicLayout = (pageChapters: any[]) => {');
code = code.replace(/const renderMinimalLayout = \(\) => {/g, 'const renderMinimalLayout = (pageChapters: any[]) => {');
code = code.replace(/const renderMagazineLayout = \(\) => {/g, 'const renderMagazineLayout = (pageChapters: any[]) => {');
code = code.replace(/const renderPosterLayout = \(\) => {/g, 'const renderPosterLayout = (pageChapters: any[]) => {');
code = code.replace(/const renderGridLayout = \(\) => {/g, 'const renderGridLayout = (pageChapters: any[]) => {');
code = code.replace(/const renderTimelineLayout = \(\) => {/g, 'const renderTimelineLayout = (pageChapters: any[]) => {');
code = code.replace(/const renderImageTextLayout = \(\) => {/g, 'const renderImageTextLayout = (pageChapters: any[]) => {');
code = code.replace(/const renderExperimentalLayout = \(\) => {/g, 'const renderExperimentalLayout = (pageChapters: any[]) => {');

// 2. replace map
code = code.replace(/chapters\.map\(\(ch, idx\) => \{/g, 'pageChapters.map((ch, localIdx) => { const idx = (ch as any).originalIdx ?? localIdx;');

// 3. update renderLayout
code = code.replace(/const renderLayout = \(\) => {/g, 'const renderLayout = (pageChapters: any[]) => {');
code = code.replace(/return renderMinimalLayout\(\);/g, 'return renderMinimalLayout(pageChapters);');
code = code.replace(/return renderMagazineLayout\(\);/g, 'return renderMagazineLayout(pageChapters);');
code = code.replace(/return renderPosterLayout\(\);/g, 'return renderPosterLayout(pageChapters);');
code = code.replace(/return renderGridLayout\(\);/g, 'return renderGridLayout(pageChapters);');
code = code.replace(/return renderTimelineLayout\(\);/g, 'return renderTimelineLayout(pageChapters);');
code = code.replace(/return renderImageTextLayout\(\);/g, 'return renderImageTextLayout(pageChapters);');
code = code.replace(/return renderExperimentalLayout\(\);/g, 'return renderExperimentalLayout(pageChapters);');
code = code.replace(/return renderClassicLayout\(\);/g, 'return renderClassicLayout(pageChapters);');

// 4. Inject chunking logic & new return
const paginationLogic = `
    const getMaxWeightPerPage = () => {
      let base = 25;
      if (selectedLayout === 'magazine') base = 35;
      if (selectedLayout === 'grid') base = 12;
      if (selectedLayout === 'poster') base = 25;
      if (selectedLayout === 'timeline') base = 22;
      if (selectedLayout === 'imagetext') base = 8;
      if (config.density === 'LOOSE') base *= 0.6;
      if (config.density === 'COMPACT') base *= 1.4;
      const heightRatio = targetHeightMm / 297;
      return base * heightRatio;
    };

    const chunkChapters = () => {
       const maxW = getMaxWeightPerPage();
       const pages = [];
       let current = [];
       let curW = 0;
       
       chapters.forEach((ch, idx) => {
          let w = 1.5;
          if (ch.description) w += 1.5;
          w += (ch.sections?.length || 0) * 0.8;
          if (selectedLayout === 'grid' || selectedLayout === 'imagetext') w = 3;
          
          const chWithIdx = { ...ch, originalIdx: idx };
          
          if (curW + w > maxW && current.length > 0) {
             pages.push(current);
             current = [chWithIdx];
             curW = w;
          } else {
             current.push(chWithIdx);
             curW += w;
          }
       });
       if (current.length > 0) pages.push(current);
       if (pages.length === 0) pages.push([]);
       return pages;
    };

    const pages = chunkChapters();

    return (
      <div
        ref={containerRef}
        className="w-full h-full flex flex-col items-center overflow-auto p-4 designer-grid relative gap-8"
      >
        <div ref={paperRef} className="flex flex-col gap-8 shrink-0" style={{ transform: \`scale(\${scale})\`, transformOrigin: 'top center' }}>
          {pages.map((pageChapters, pageIndex) => (
            <div
              key={pageIndex}
              style={{
                ...designStyle,
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.18), 0 0 0 1px rgba(0,0,0,0.03)'
              }}
              className={\`relative shrink-0 overflow-hidden \${config.paperTexture ? 'paper-grain' : ''}\`}
            >
              <div style={marginGuideStyle} />
              {renderLayout(pageChapters)}
              
              {pages.length > 1 && (
                <div className="absolute bottom-2 left-0 w-full text-center text-[9px] scale-90 opacity-40 font-mono p-1 mix-blend-multiply">
                   PAGE {pageIndex + 1} / {pages.length}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  }
);
`;

code = code.replace(/return \([\s\S]+?TOCPreview\.displayName = 'TOCPreview';/, paginationLogic + "\nTOCPreview.displayName = 'TOCPreview';");

fs.writeFileSync('src/catalogue/TOCPreview.tsx', code);
console.log('done');
