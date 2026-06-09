const fs = require('fs');
let code = fs.readFileSync('src/catalogue/TOCPreview.tsx', 'utf8');

function replaceHeader(layoutName, regexPattern, replacement) {
  code = code.replace(regexPattern, replacement);
}

replaceHeader('classic', 
  /\{\/\* Header section with book info \*\/\}[\s\S]*?\{\/\* Core Chapters \*\/\}/, 
  `{pageIndex === 0 && (\n              <>\n                {/* Header section with book info */}\n                <div className="flex justify-between items-baseline border-b border-stone-200 pb-3 mb-8">\n                  <span className="text-xs uppercase tracking-widest font-sans opacity-60 truncate max-w-[65%]">\n                    {bookInfo.title}\n                  </span>\n                  <span className="text-xs font-serif italic opacity-60">CONTENTS</span>\n                </div>\n\n                {/* Document Header Title */}\n                <div className="text-center mb-12">\n                  <h1 className="text-3xl font-semibold tracking-wide font-serif mb-2">目录</h1>\n                  <p className="text-xs uppercase tracking-widest text-stone-400 font-mono">Table of Contents</p>\n                  <div className="w-12 h-[1px] bg-stone-300 mx-auto mt-4" style={{ backgroundColor: primaryColor }} />\n                </div>\n              </>\n            )}\n\n            {/* Core Chapters */}`
);

replaceHeader('minimal',
  /\{\/\* Header: Clean thin title \*\/\}[\s\S]*?\{\/\* Content List \*\/\}/,
  `{pageIndex === 0 && (\n              <>\n                {/* Header: Clean thin title */}\n                <div className="mb-14">\n                  <span className="text-[10px] uppercase tracking-widest font-mono opacity-40 block mb-2">Book Index</span>\n                  <h1 className="text-xl tracking-tight font-light opacity-80" style={{ color: secondaryColor }}>\n                    {bookInfo.title}\n                  </h1>\n                </div>\n\n                {/* Huge Contents Indicator */}\n                <div className="mb-12">\n                  <span className="text-6xl font-light tracking-tighter opacity-10 block pr-8 -ml-1">\n                    CONTENTS\n                  </span>\n                </div>\n              </>\n            )}\n\n            {/* Content List */}`
);

replaceHeader('magazine',
  /\{\/\* Rich Magazine Banner \*\/\}[\s\S]*?\{\/\* Featured Article Layout Block \*\/\}/,
  `{pageIndex === 0 && (\n              {/* Rich Magazine Banner */}\n              <div className="grid grid-cols-3 gap-4 border-b-2 border-current pb-4 mb-8">\n                <div className="col-span-2">\n                  <p className="text-[10px] font-mono tracking-wider uppercase opacity-65">EDITORIAL PORTFOLIO</p>\n                  <h1 className="text-3xl font-black uppercase tracking-tighter mt-1">\n                    CONTENTS\n                  </h1>\n                </div>\n                <div className="text-right flex flex-col justify-end">\n                  <span className="text-xs uppercase font-extrabold px-3 py-1 text-white inline-block self-end" style={{ backgroundColor: accentColor }}>\n                    ISSUE #04\n                  </span>\n                  <span className="text-[9px] font-mono opacity-50 mt-1">VOL. 26</span>\n                </div>\n              </div>\n            )}\n\n            {/* Featured Article Layout Block */}`
);

replaceHeader('poster',
  /\{\/\* Rotated structural background giant word \*\/\}[\s\S]*?\{\/\* Poster Alternating Chapters \*\/\}/,
  `{pageIndex === 0 && (\n            <>\n              {/* Rotated structural background giant word */}\n              <div className="absolute -left-10 top-20 text-[100px] font-black tracking-widest text-stone-100 select-none rotate-90 origin-top-left pointer-events-none uppercase opacity-[0.06]" style={{ color: \`\${accentColor}10\` }}>\n                INDEX\n              </div>\n\n              <div>\n                {/* Header with visual weight */}\n                <div className="mb-14 relative z-10">\n                  <div className="w-10 h-1.5 mb-3" style={{ backgroundColor: accentColor }} />\n                  <h1 className="text-4xl font-extrabold tracking-tight font-display mb-1">\n                    {bookInfo.title}\n                  </h1>\n                  <p className="text-xs uppercase tracking-widest font-mono opacity-50 mt-1">\n                    {bookInfo.subtitle}\n                  </p>\n                </div>\n              </div>\n            </>\n          )}\n\n          <div>\n            {/* Poster Alternating Chapters */}`
);

replaceHeader('grid',
  /\{\/\* Structured blueprint details \*\/\}[\s\S]*?\{\/\* Clean grid boxes \*\/\}/,
  `{pageIndex === 0 && (\n              <>\n                {/* Structured blueprint details */}\n                <div className="grid grid-cols-4 gap-2 text-[9px] font-mono uppercase opacity-50 border-b pb-4 mb-6">\n                  <div>\n                    <span className="block text-stone-400">Scale:</span>\n                    <span className="font-semibold text-stone-800">1 : 1.25</span>\n                  </div>\n                  <div>\n                    <span className="block text-stone-400">Type:</span>\n                    <span className="font-semibold text-stone-800">Grid Catalog</span>\n                  </div>\n                  <div className="col-span-2 text-right">\n                    <span className="block text-stone-400">Document Source:</span>\n                    <span className="font-semibold text-stone-800 truncate block">{bookInfo.title}</span>\n                  </div>\n                </div>\n\n                {/* Huge Grid Headline */}\n                <div className="mb-6 flex justify-between items-baseline">\n                  <h1 className="text-xl font-bold tracking-wide font-mono">GRID SCHEMA SPEC.</h1>\n                  <span className="text-xs font-mono font-bold" style={{ color: accentColor }}>[00 / INDEX]</span>\n                </div>\n              </>\n            )}\n\n            {/* Clean grid boxes */}`
);

replaceHeader('timeline',
  /\{\/\* Timeline Header \*\/\}[\s\S]*?\{\/\* Timeline Grid Flow \*\/\}/,
  `{pageIndex === 0 && (\n              {/* Timeline Header */}\n              <div className="mb-10 text-center relative">\n                <span className="text-[10px] uppercase tracking-[0.2em] font-mono opacity-50 block mb-1">CHRONOLOGICAL SUMMARY</span>\n                <h1 className="text-2xl font-light font-serif">{bookInfo.title}</h1>\n                <p className="text-xs italic text-stone-400 mt-1">时空之镜 · 目录索引</p>\n                <div className="w-8 h-[2px] bg-stone-200 mx-auto mt-3" style={{ backgroundColor: accentColor }} />\n              </div>\n            )}\n\n            {/* Timeline Grid Flow */}`
);

replaceHeader('imagetext',
  /\{\/\* High-end design layout header \*\/\}[\s\S]*?\{\/\* Visual Book Catalog items \*\/\}/,
  `{pageIndex === 0 && (\n              {/* High-end design layout header */}\n              <div className="flex justify-between items-start mb-8">\n                <div>\n                  <h1 className="text-xl font-bold uppercase tracking-tight font-sans">\n                    EXHIBIT INDEX\n                  </h1>\n                  <p className="text-[10px] font-mono opacity-50 uppercase tracking-widest mt-0.5">\n                    Visual Gallery List\n                  </p>\n                </div>\n                <div className="text-right text-[9px] font-mono uppercase opacity-50">\n                  <span>{bookInfo.title.substring(0, 16)}...</span>\n                </div>\n              </div>\n            )}\n\n            {/* Visual Book Catalog items */}`
);

replaceHeader('experimental',
  /\{\/\* Subtle design crop marks in the corners \*\/\}[\s\S]*?\{\/\* Scattered index rows \*\/\}/,
  `{pageIndex === 0 && (\n            <>\n              {/* Subtle design crop marks in the corners */}\n              <div className="absolute top-2 left-2 text-[9px] font-mono opacity-25 select-none">[+] CROP_L_TOP</div>\n              <div className="absolute top-2 right-2 text-[9px] font-mono opacity-25 select-none">CROP_R_TOP [+]</div>\n              <div className="absolute bottom-2 left-2 text-[9px] font-mono opacity-25 select-none">[+] CROP_L_BOT</div>\n              <div className="absolute bottom-2 right-2 text-[9px] font-mono opacity-25 select-none">CROP_R_BOT [+]</div>\n\n              <div>\n                {/* Header: Disordered design */}\n                <div className="mb-10 relative">\n                  <div className="absolute top-0 right-0 border-r-2 border-b-2 border-current w-12 h-12" style={{ color: accentColor }} />\n                  <span className="inline-block bg-black text-white px-2 py-0.5 text-[9px] font-mono font-bold leading-none mb-3 rotate-[-3deg]" style={{ backgroundColor: accentColor }}>\n                    AVANT-GARDE SPECS\n                  </span>\n                  <h1 className="text-3xl font-black italic tracking-widest font-mono uppercase mt-1">\n                    KINETIC\n                  </h1>\n                  <h2 className="text-sm font-bold uppercase tracking-tighter opacity-80" style={{ color: secondaryColor }}>\n                    INDEX OF WORKFLOWS\n                  </h2>\n                </div>\n              </div>\n            </>\n          )}\n\n          <div>\n            {/* Scattered index rows */}`
);

fs.writeFileSync('src/catalogue/TOCPreview.tsx', code);
console.log('updated TOC preview');
