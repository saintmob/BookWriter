import fs from 'fs';
let code = fs.readFileSync('src/catalogue/TOCPreview.tsx', 'utf8');

code = code.replace(/{sec\.page}/g, '<DynamicPageNumber page={sec.page} id={sec.id} printMode={printMode} />');

fs.writeFileSync('src/catalogue/TOCPreview.tsx', code);
