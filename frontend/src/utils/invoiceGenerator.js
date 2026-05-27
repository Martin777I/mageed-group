/**
 * MAGED GROUP — Client-Side Invoice Generator
 *
 * Generates a beautiful Arabic invoice as HTML and opens it in a
 * new browser window with auto-print dialog.
 * 
 * This approach is 100% reliable because:
 * - No server-side Chromium/Puppeteer needed
 * - Browser handles Arabic/RTL text perfectly
 * - Works on all platforms and hosting providers
 */

function fmtNum(val) {
  return Number(val || 0).toFixed(2);
}

function statusLabel(status) {
  const map = { accepted: 'مقبول', rejected: 'مرفوض', pending: 'قيد المراجعة' };
  return map[status] || status;
}

function statusColor(status) {
  const map = { accepted: '#16a34a', rejected: '#dc2626', pending: '#ca8a04' };
  return map[status] || '#64748b';
}

export function generateInvoiceHtml(order) {
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
<title>فاتورة ${order.orderNumber}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;600;700;800&display=swap');

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

  /* ── Print-specific styles ── */
  @media print {
    body { margin: 0; padding: 0; }
    .page { padding: 20px 30px; }
    .no-print { display: none !important; }
    @page {
      size: A4;
      margin: 0;
    }
  }

  /* ── Screen-only toolbar ── */
  .print-toolbar {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #1e293b;
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    z-index: 1000;
    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
  }

  .print-toolbar button {
    padding: 8px 24px;
    border: none;
    border-radius: 8px;
    font-family: 'Cairo', sans-serif;
    font-size: 14px;
    font-weight: 700;
    cursor: pointer;
    transition: all 0.2s;
  }

  .btn-print {
    background: #3b82f6;
    color: white;
  }

  .btn-print:hover {
    background: #2563eb;
  }

  .btn-close {
    background: #475569;
    color: white;
  }

  .btn-close:hover {
    background: #64748b;
  }

  @media print {
    .print-toolbar { display: none !important; }
    body { padding-top: 0 !important; }
  }

  @media screen {
    body { padding-top: 60px; background: #94a3b8; }
    .page {
      background: white;
      box-shadow: 0 4px 30px rgba(0,0,0,0.2);
      margin: 20px auto;
      border-radius: 4px;
    }
  }
</style>
</head>
<body>

<!-- Print Toolbar (hidden when printing) -->
<div class="print-toolbar no-print">
  <button class="btn-print" onclick="window.print()">🖨️ طباعة / حفظ PDF</button>
  <button class="btn-close" onclick="window.close()">✕ إغلاق</button>
</div>

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

/**
 * Opens invoice in a new window for printing/saving as PDF
 */
export function openInvoice(order) {
  const html = generateInvoiceHtml(order);
  const printWindow = window.open('', '_blank');
  
  if (!printWindow) {
    throw new Error('popup_blocked');
  }

  printWindow.document.write(html);
  printWindow.document.close();
}
