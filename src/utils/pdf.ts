// @ts-ignore
import html2pdf from 'html2pdf.js';
import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const loadPdfDocument = async (file: File) => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  return {
    numPages: pdf.numPages,
    extractPageAsImage: async (pageNumber: number): Promise<string> => {
      const page = await pdf.getPage(pageNumber);
      let scale = 2.0;
      let viewport = page.getViewport({ scale });
      
      // Limit max dimension to 2048 to prevent huge payloads causing 500 errors
      const maxDimension = 2048;
      if (viewport.width > maxDimension || viewport.height > maxDimension) {
        const scaleFactor = Math.min(maxDimension / viewport.width, maxDimension / viewport.height);
        scale = scale * scaleFactor;
        viewport = page.getViewport({ scale });
      }
      
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');
      
      if (!context) throw new Error('Could not create canvas context');
      
      canvas.height = viewport.height;
      canvas.width = viewport.width;
      
      await page.render({
        canvasContext: context,
        viewport: viewport,
        canvas: canvas
      }).promise;
      
      const base64 = canvas.toDataURL('image/jpeg', 0.8);
      return base64.split(',')[1];
    }
  };
};

export const splitPdfToImages = async (file: File): Promise<string[]> => {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const images: string[] = [];

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    let scale = 2.0;
    let viewport = page.getViewport({ scale }); // Higher scale for better OCR
    
    // Limit max dimension to 2048 to prevent huge payloads causing 500 errors
    const maxDimension = 2048;
    if (viewport.width > maxDimension || viewport.height > maxDimension) {
      const scaleFactor = Math.min(maxDimension / viewport.width, maxDimension / viewport.height);
      scale = scale * scaleFactor;
      viewport = page.getViewport({ scale });
    }
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    
    if (!context) continue;
    
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    
    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas
    }).promise;
    
    // Convert canvas to base64 jpeg
    const base64 = canvas.toDataURL('image/jpeg', 0.8);
    // Remove the data:image/jpeg;base64, prefix
    images.push(base64.split(',')[1]);
  }
  
  return images;
};

export const printToPDF = async (htmlContent: string, title: string) => {
  const fullHtml = `
    <div style="padding: 20px; font-family: system-ui, -apple-system, sans-serif; color: #1e293b; line-height: 1.5;">
      <style>
        h1 { color: #4f46e5; text-align: center; margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #cbd5e1; padding: 12px; text-align: left; }
        th { background-color: #f8fafc; font-weight: 600; }
        .question { margin-bottom: 24px; page-break-inside: avoid; background: #f8fafc; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; }
        .q-text { font-size: 1.1em; font-weight: 600; margin-bottom: 12px; }
        .options { margin-left: 20px; margin-bottom: 12px; }
        .option { margin-bottom: 4px; }
        .answer-box { margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1; }
        .answer { font-weight: bold; color: #059669; }
        .explanation { margin-top: 4px; color: #475569; font-size: 0.95em; }
        .html2pdf__page-break { height: 0; page-break-before: always; margin: 0; padding: 0; border: none; }
      </style>
      ${htmlContent}
    </div>
  `;

  const opt = {
    margin:       10,
    filename:     `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`,
    image:        { type: 'jpeg' as const, quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true },
    jsPDF:        { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
    pagebreak:    { mode: ['css', 'legacy'] }
  };

  await html2pdf().set(opt).from(fullHtml).save();
};

export const resizeImageBase64 = (base64Str: string, mimeType: string, maxWidth = 2048, maxHeight = 2048): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = `data:${mimeType};base64,${base64Str}`;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = width * ratio;
        height = height * ratio;
      } else {
        // No need to resize
        resolve(base64Str);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(base64Str);
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const newBase64 = canvas.toDataURL('image/jpeg', 0.8);
      resolve(newBase64.split(',')[1]);
    };
    img.onerror = reject;
  });
};
