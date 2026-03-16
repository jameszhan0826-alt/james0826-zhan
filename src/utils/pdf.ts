// @ts-ignore
import html2pdf from 'html2pdf.js';

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
