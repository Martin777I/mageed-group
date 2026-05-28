/**
 * MAGED GROUP — Arabic Invoice PDF Generator
 *
 * Uses Puppeteer (headless Chrome) to render an HTML invoice template to PDF.
 * Chrome's native text engine handles Arabic shaping, RTL, and bidi perfectly —
 * no reshaping hacks needed.
 */

const puppeteer = require('puppeteer');
const path = require('path');
const fs = require('fs');
const logger = require('../config/logger');

// ── Load Cairo font as base64 for embedding in HTML ──
const FONT_PATH = path.join(__dirname, '../fonts/Cairo.ttf');
let fontBase64 = '';
try {
  fontBase64 = fs.readFileSync(FONT_PATH).toString('base64');
} catch (err) {
  logger.warn('[PDF] Cairo.ttf not found, falling back to Google Fonts CDN');
}

// ── Singleton browser instance (reused across requests) ──
let browser = null;

async function getBrowser() {
  if (!browser || !browser.isConnected()) {
    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--font-render-hinting=none',
      ],
    };

    // Use system Chromium if PUPPETEER_EXECUTABLE_PATH is set (Railway/Docker)
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
      logger.info(`[PDF] Using Chromium at: ${process.env.PUPPETEER_EXECUTABLE_PATH}`);
    }

    browser = await puppeteer.launch(launchOptions);
  }
  return browser;
}

// ── Graceful shutdown ──
process.on('exit', async () => {
  if (browser) try { await browser.close(); } catch { /* ignore */ }
});

// ── Number formatter ──
function fmtNum(val) {
  return Number(val || 0).toFixed(2);
}

// ── Status label ──
function statusLabel(status) {
  const map = { accepted: 'مقبول', rejected: 'مرفوض', pending: 'قيد المراجعة' };
  return map[status] || status;
}

function statusColor(status) {
  const map = { accepted: '#16a34a', rejected: '#dc2626', pending: '#ca8a04' };
  return map[status] || '#64748b';
}

// ══════════════════════════════════════════════
//  HTML INVOICE TEMPLATE
// ══════════════════════════════════════════════

function buildInvoiceHtml(order) {
  const fontFace = fontBase64
    ? `@font-face {
        font-family: 'Cairo';
        src: url(data:font/truetype;base64,${fontBase64}) format('truetype');
        font-weight: 100 900;
      }`
    : `@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap');`;

  const itemsHtml = order.items
    .map(
      (item, i) => `
      <tr class="${i % 2 === 0 ? 'row-alt' : ''}">
        <td class="num">${i + 1}</td>
        <td class="code">${item.productCode || '—'}</td>
        <td class="name">${item.productName || '—'}</td>
        <td class="qty">${item.quantity}</td>
        <td class="price">${fmtNum(item.price)}</td>
        <td class="total">${fmtNum(item.total)}</td>
      </tr>`
    )
    .join('');

  const dateStr = new Date(order.createdAt).toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<style>
  ${fontFace}

  * { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Cairo', 'Segoe UI', Tahoma, sans-serif;
    direction: rtl;
    color: #1e293b;
    padding: 0;
    margin: 0;
    font-size: 13px;
    line-height: 1.6;
  }

  .page {
    width: 210mm;
    min-height: 297mm;
    padding: 30px 40px;
    margin: 0 auto;
    position: relative;
  }

  /* ── Header ── */
  .header {
    text-align: center;
    padding-bottom: 20px;
    border-bottom: 3px solid #1e3a5f;
    margin-bottom: 25px;
  }

  .header .brand {
    font-size: 32px;
    font-weight: 800;
    color: #1e3a5f;
    letter-spacing: 2px;
    margin-bottom: 2px;
  }

  .header .subtitle {
    font-size: 14px;
    color: #64748b;
    font-weight: 500;
  }

  .header .accent-bar {
    width: 80px;
    height: 3px;
    background: #3b82f6;
    margin: 10px auto 0;
    border-radius: 2px;
  }

  /* ── Invoice Title ── */
  .invoice-title {
    text-align: center;
    font-size: 22px;
    font-weight: 700;
    color: #1e3a5f;
    margin-bottom: 25px;
  }

  /* ── Info Grid ── */
  .info-grid {
    display: flex;
    justify-content: space-between;
    margin-bottom: 30px;
    gap: 20px;
  }

  .info-box {
    flex: 1;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 16px 20px;
  }

  .info-box h3 {
    font-size: 11px;
    color: #94a3b8;
    font-weight: 600;
    margin-bottom: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 4px 0;
    font-size: 12px;
  }

  .info-row .label {
    color: #64748b;
    font-weight: 600;
  }

  .info-row .value {
    color: #1e293b;
    font-weight: 700;
  }

  .status-badge {
    display: inline-block;
    padding: 2px 12px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 700;
    color: white;
    background: ${statusColor(order.status)};
  }

  /* ── Table ── */
  .items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 20px;
    font-size: 12px;
  }

  .items-table thead th {
    background: #1e3a5f;
    color: white;
    padding: 10px 12px;
    font-weight: 700;
    font-size: 11px;
    text-align: center;
    white-space: nowrap;
  }

  .items-table thead th:first-child {
    border-radius: 0 8px 0 0;
  }

  .items-table thead th:last-child {
    border-radius: 8px 0 0 0;
  }

  .items-table tbody td {
    padding: 10px 12px;
    text-align: center;
    border-bottom: 1px solid #e2e8f0;
  }

  .items-table .name {
    text-align: right;
    font-weight: 600;
  }

  .items-table .code {
    font-family: 'Courier New', monospace;
    direction: ltr;
    text-align: center;
    color: #3b82f6;
    font-weight: 600;
  }

  .items-table .num {
    color: #94a3b8;
    width: 40px;
  }

  .row-alt {
    background: #f8fafc;
  }

  /* ── Totals ── */
  .totals-section {
    display: flex;
    justify-content: flex-start;
    margin-bottom: 25px;
  }

  .totals-box {
    background: #1e3a5f;
    color: white;
    padding: 16px 30px;
    border-radius: 8px;
    min-width: 250px;
  }

  .totals-box .total-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 30px;
  }

  .totals-box .total-label {
    font-size: 14px;
    font-weight: 600;
  }

  .totals-box .total-value {
    font-size: 22px;
    font-weight: 800;
    color: #fbbf24;
    direction: ltr;
  }

  /* ── Notes ── */
  .notes {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 8px;
    padding: 14px 18px;
    margin-bottom: 25px;
  }

  .notes h3 {
    font-size: 12px;
    font-weight: 700;
    color: #92400e;
    margin-bottom: 6px;
  }

  .notes p {
    font-size: 12px;
    color: #78350f;
    line-height: 1.7;
  }

  /* ── Footer ── */
  .footer {
    position: absolute;
    bottom: 25px;
    left: 40px;
    right: 40px;
    text-align: center;
    padding-top: 15px;
    border-top: 2px solid #e2e8f0;
  }

  .footer p {
    font-size: 10px;
    color: #94a3b8;
  }

  .footer .accent-bar {
    width: 60px;
    height: 2px;
    background: #3b82f6;
    margin: 8px auto 0;
    border-radius: 1px;
  }
</style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="brand">MAGED GROUP</div>
    <div class="subtitle">قطع غيار الموتوسيكلات والتروسيكلات</div>
    <div class="accent-bar"></div>
  </div>

  <!-- Invoice Title -->
  <div class="invoice-title">فاتورة طلب</div>

  <!-- Info Grid -->
  <div class="info-grid">
    <div class="info-box">
      <h3>بيانات العميل</h3>
      <div class="info-row">
        <span class="label">الاسم:</span>
        <span class="value">${order.customerName || '—'}</span>
      </div>
      <div class="info-row">
        <span class="label">الهاتف:</span>
        <span class="value" dir="ltr">${order.customerPhone || '—'}</span>
      </div>
    </div>
    <div class="info-box">
      <h3>بيانات الطلب</h3>
      <div class="info-row">
        <span class="label">رقم الطلب:</span>
        <span class="value" dir="ltr">${order.orderNumber}</span>
      </div>
      <div class="info-row">
        <span class="label">التاريخ:</span>
        <span class="value">${dateStr}</span>
      </div>
      <div class="info-row">
        <span class="label">الحالة:</span>
        <span class="status-badge">${statusLabel(order.status)}</span>
      </div>
    </div>
  </div>

  <!-- Items Table -->
  <table class="items-table">
    <thead>
      <tr>
        <th>#</th>
        <th>الكود</th>
        <th>الصنف</th>
        <th>الكمية</th>
        <th>السعر</th>
        <th>الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <!-- Total -->
  <div class="totals-section">
    <div class="totals-box">
      <div class="total-row">
        <span class="total-label">الإجمالي الكلي</span>
        <span class="total-value">${fmtNum(order.totalAmount)} EGP</span>
      </div>
    </div>
  </div>

  ${
    order.notes
      ? `<div class="notes">
          <h3>ملاحظات</h3>
          <p>${order.notes}</p>
        </div>`
      : ''
  }

  <!-- Footer -->
  <div class="footer">
    <p>MAGED GROUP — قطع غيار الموتوسيكلات والتروسيكلات</p>
    <div class="accent-bar"></div>
  </div>

</div>
</body>
</html>`;
}

// ══════════════════════════════════════════════
//  PDF GENERATION
// ══════════════════════════════════════════════

async function generateInvoicePdf(order, stream) {
  let page = null;

  try {
    const instance = await getBrowser();
    page = await instance.newPage();

    const html = buildInvoiceHtml(order);

    // Use 'domcontentloaded' instead of 'networkidle0' to avoid timeout
    // when Google Fonts CDN is slow/blocked in the deployment environment
    await page.setContent(html, {
      waitUntil: fontBase64 ? 'domcontentloaded' : 'networkidle0',
      timeout: 15000,
    });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      timeout: 15000,
    });

    stream.end(pdfBuffer);
  } catch (err) {
    logger.error('[PDF] Generation error:', err);
    // If stream is still writable, end it to prevent hanging
    if (!stream.writableEnded) {
      stream.end();
    }
    throw err;
  } finally {
    if (page) {
      try { await page.close(); } catch { /* ignore */ }
    }
  }
}

module.exports = { generateInvoicePdf, buildInvoiceHtml };