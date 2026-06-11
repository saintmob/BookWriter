import express from "express";
import path from "path";
import puppeteer from 'puppeteer';
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Increase payload limit for large HTML
  app.use(express.json({ limit: '200mb' }));
  app.use(express.urlencoded({ limit: '200mb', extended: true }));
  
  app.post("/api/export-pdf", async (req, res) => {
    try {
      console.log('Received PDF export request');
      const { html, format, width, height, paperStyle } = req.body;
      
      console.log('Launching browser...');
      const browser = await puppeteer.launch({ 
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--font-render-hinting=none', '--disable-gpu', '--disable-dev-shm-usage'],
        // Set headless appropriately for Chromium
        headless: true
      });
      
      console.log('Opening new page...');
      const page = await browser.newPage();
      
      // We embed the raw HTML directly
      console.log('Setting content...');
      await page.setContent(html, { waitUntil: 'networkidle0' as any });

      // Generate the PDF
      console.log('Generating PDF...');
      const pdf = await page.pdf({
        width: width ? `${width}px` : undefined,
        height: height ? `${height}px` : undefined,
        format: (!width && !height && format) ? format : undefined,
        printBackground: true, // Crucial for background colors and textures!
        margin: { top: 0, right: 0, bottom: 0, left: 0 },
        timeout: 60000 // 60s timeout
      });
      
      console.log('Closing browser...');
      await browser.close();
      
      console.log('Sending PDF response...');
      res.contentType("application/pdf");
      res.send(Buffer.from(pdf));
    } catch (err) {
      console.error('SERVER PDF EXPORT ERROR:', err);
      res.status(500).json({ error: err ? String(err) : 'Unknown error' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist/client');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
