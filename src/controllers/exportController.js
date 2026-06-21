const pool = require('../db/pool');
const { asyncHandler } = require('../middleware/errors');
const PDFDocument = require('pdfkit');

function csvEscape(val) {
  const s = String(val ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// GET /api/export/csv
const exportCsv = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM customers WHERE shop_owner_id = $1 ORDER BY created_at DESC`,
    [req.shopOwnerId]
  );

  const headers = ['Name', 'Phone', 'Service', 'Total', 'Paid', 'Due', 'Status', 'Created At'];
  const lines = [headers.join(',')];

  result.rows.forEach((c) => {
    lines.push([
      csvEscape(c.name),
      csvEscape(c.phone),
      csvEscape(c.service),
      csvEscape(c.total_amount),
      csvEscape(c.paid_amount),
      csvEscape(c.due_amount),
      csvEscape(c.status),
      csvEscape(new Date(c.created_at).toISOString())
    ].join(','));
  });

  const csv = lines.join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="duetrack-export-${Date.now()}.csv"`);
  res.send(csv);
});

// GET /api/export/pdf
const exportPdf = asyncHandler(async (req, res) => {
  const ownerResult = await pool.query('SELECT shop_name FROM shop_owners WHERE id = $1', [req.shopOwnerId]);
  const shopName = ownerResult.rows[0]?.shop_name || 'DueTrack';

  const result = await pool.query(
    `SELECT * FROM customers WHERE shop_owner_id = $1 ORDER BY created_at DESC`,
    [req.shopOwnerId]
  );

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="duetrack-export-${Date.now()}.pdf"`);

  const doc = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' });
  doc.pipe(res);

  doc.fontSize(18).font('Helvetica-Bold').text(`${shopName} — Customer Due Report`, { align: 'left' });
  doc.fontSize(10).font('Helvetica').fillColor('#5B6660')
    .text(`Generated on ${new Date().toLocaleString('en-IN')}`, { align: 'left' });
  doc.moveDown(1);

  const colX = [36, 180, 320, 480, 560, 640, 720];
  const colW = [144, 140, 160, 80, 80, 80, 80];
  const headers = ['Name', 'Phone', 'Service', 'Total', 'Paid', 'Due', 'Status'];

  function drawRow(y, values, isHeader) {
    doc.font(isHeader ? 'Helvetica-Bold' : 'Helvetica').fontSize(9).fillColor(isHeader ? '#14342B' : '#1C2321');
    values.forEach((v, i) => {
      doc.text(String(v), colX[i], y, { width: colW[i], ellipsis: true });
    });
  }

  let y = doc.y + 6;
  drawRow(y, headers, true);
  y += 16;
  doc.moveTo(36, y).lineTo(800, y).strokeColor('#E5E7E0').stroke();
  y += 8;

  result.rows.forEach((c) => {
    if (y > 540) {
      doc.addPage({ margin: 36, size: 'A4', layout: 'landscape' });
      y = 50;
      drawRow(y, headers, true);
      y += 16;
      doc.moveTo(36, y).lineTo(800, y).strokeColor('#E5E7E0').stroke();
      y += 8;
    }
    drawRow(y, [
      c.name, c.phone, c.service || '-',
      '₹' + Number(c.total_amount).toLocaleString('en-IN'),
      '₹' + Number(c.paid_amount).toLocaleString('en-IN'),
      '₹' + Number(c.due_amount).toLocaleString('en-IN'),
      c.status
    ], false);
    y += 18;
  });

  doc.end();
});

module.exports = { exportCsv, exportPdf };
