const fs = require('fs');
let code = fs.readFileSync('src/catalogue/TOCPreview.tsx', 'utf8');

code = code.replace(/\{pageIndex === 0 && \(\s*\{\/\* Rich Magazine Banner \*\/\}\s*<div/g, '{pageIndex === 0 && (\n              <>\n              {/* Rich Magazine Banner */}\n              <div');
code = code.replace(/VOL\. 26<\/span>\n                <\/div>\n              <\/div>\n            \)\}/g, 'VOL. 26</span>\n                </div>\n              </div>\n              </>\n            )}');

code = code.replace(/\{pageIndex === 0 && \(\s*\{\/\* Timeline Header \*\/\}\s*<div/g, '{pageIndex === 0 && (\n              <>\n              {/* Timeline Header */}\n              <div');
code = code.replace(/mx-auto mt-3" style=\{\{ backgroundColor: accentColor \}\} \/>\n              <\/div>\n            \)\}/g, 'mx-auto mt-3" style={{ backgroundColor: accentColor }} />\n              </div>\n              </>\n            )}');

code = code.replace(/\{pageIndex === 0 && \(\s*\{\/\* High-end design layout header \*\/\}\s*<div/g, '{pageIndex === 0 && (\n              <>\n              {/* High-end design layout header */}\n              <div');
code = code.replace(/<span>\{bookInfo\.title\.substring\(0, 16\)\}\.\.\.<\/span>\n                <\/div>\n              <\/div>\n            \)\}/g, '<span>{bookInfo.title.substring(0, 16)}...</span>\n                </div>\n              </div>\n              </>\n            )}');

fs.writeFileSync('src/catalogue/TOCPreview.tsx', code);
