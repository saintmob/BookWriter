const fs = require('fs');
let code = fs.readFileSync('src/catalogue/TOCPreview.tsx', 'utf8');

const regex = /const render([A-Za-z]+)Layout = \(pageChapters: any\[\]\) => \{/g;
code = code.replace(regex, 'const render$1Layout = (pageChapters: any[], pageIndex: number) => {');

fs.writeFileSync('src/catalogue/TOCPreview.tsx', code);
