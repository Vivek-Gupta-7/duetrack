const pool = require('../db/pool');
const { ApiError, asyncHandler } = require('../middleware/errors');

const PHONE_RE = /^\+?[0-9]{7,15}$/;

function toPublicCustomer(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    service: row.service,
    total: Number(row.total_amount),
    paid: Number(row.paid_amount),
    due: Number(row.due_amount),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function toPublicPayment(row) {
  return {
    id: row.id,
    customerId: row.customer_id,
    amount: Number(row.amount),
    note: row.note,
    paidAt: row.paid_at
  };
}

async function getOwnedCustomer(client, customerId, shopOwnerId) {
  const result = await client.query(
    'SELECT * FROM customers WHERE id = $1 AND shop_owner_id = $2',
    [customerId, shopOwnerId]
  );
  return result.rows[0] || null;
}

// ---------------------------------------------------------------
// GET /api/customers  (list, with optional search/status/sort)
// ---------------------------------------------------------------
const listCustomers = asyncHandler(async (req, res) => {
  const { search = '', status = 'all', sort = 'newest' } = req.query;

  const clauses = ['shop_owner_id = $1'];
  const params = [req.shopOwnerId];

  if (search) {
    params.push(`%${search}%`);
    clauses.push(`(name ILIKE $${params.length} OR phone ILIKE $${params.length} OR service ILIKE $${params.length})`);
  }
  if (status === 'pending') clauses.push(`status = 'Pending'`);
  if (status === 'paid') clauses.push(`status = 'Paid'`);

  const order = sort === 'oldest' ? 'ASC' : 'DESC';

  const result = await pool.query(
    `SELECT * FROM customers WHERE ${clauses.join(' AND ')} ORDER BY created_at ${order}`,
    params
  );

  res.json({ customers: result.rows.map(toPublicCustomer) });
});

// ---------------------------------------------------------------
// GET /api/customers/:id  (with payment history)
// ---------------------------------------------------------------
const getCustomer = asyncHandler(async (req, res) => {
  const customer = await getOwnedCustomer(pool, req.params.id, req.shopOwnerId);
  if (!customer) throw new ApiError(404, 'Customer record not found.');

  const payments = await pool.query(
    'SELECT * FROM payments WHERE customer_id = $1 ORDER BY paid_at DESC',
    [customer.id]
  );

  res.json({ customer: toPublicCustomer(customer), payments: payments.rows.map(toPublicPayment) });
});

// ---------------------------------------------------------------
// POST /api/customers  (create)
// ---------------------------------------------------------------
const createCustomer = asyncHandler(async (req, res) => {
  const { name, phone, service = '', total, paid = 0 } = req.body;

  if (!name || String(name).trim().length < 2) throw new ApiError(400, 'Enter the customer name.');
  if (!phone || !PHONE_RE.test(String(phone).replace(/[\s-]/g, ''))) throw new ApiError(400, 'Enter a valid phone number.');

  const totalAmount = Number(total);
  const paidAmount = Number(paid) || 0;
  if (isNaN(totalAmount) || totalAmount < 0) throw new ApiError(400, 'Enter a valid total amount.');
  if (paidAmount < 0) throw new ApiError(400, 'Paid amount cannot be negative.');
  if (paidAmount > totalAmount) throw new ApiError(400, 'Paid amount cannot exceed the total amount.');

  const dueAmount = totalAmount - paidAmount;
  const status = dueAmount <= 0 ? 'Paid' : 'Pending';

  const result = await pool.query(
    `INSERT INTO customers (shop_owner_id, name, phone, service, total_amount, paid_amount, due_amount, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
    [req.shopOwnerId, String(name).trim(), String(phone).trim(), String(service).trim(), totalAmount, paidAmount, dueAmount, status]
  );
  const customer = result.rows[0];

  // If an initial payment was made at creation time, log it in history too.
  if (paidAmount > 0) {
    await pool.query(
      `INSERT INTO payments (customer_id, shop_owner_id, amount, note) VALUES ($1,$2,$3,$4)`,
      [customer.id, req.shopOwnerId, paidAmount, 'Initial payment at record creation']
    );
  }

  res.status(201).json({ customer: toPublicCustomer(customer) });
});

// ---------------------------------------------------------------
// PUT /api/customers/:id  (edit core details — not payments)
// ---------------------------------------------------------------
const updateCustomer = asyncHandler(async (req, res) => {
  const existing = await getOwnedCustomer(pool, req.params.id, req.shopOwnerId);
  if (!existing) throw new ApiError(404, 'Customer record not found.');

  const { name, phone, service, total } = req.body;

  if (!name || String(name).trim().length < 2) throw new ApiError(400, 'Enter the customer name.');
  if (!phone || !PHONE_RE.test(String(phone).replace(/[\s-]/g, ''))) throw new ApiError(400, 'Enter a valid phone number.');

  const totalAmount = Number(total);
  if (isNaN(totalAmount) || totalAmount < 0) throw new ApiError(400, 'Enter a valid total amount.');
  if (Number(existing.paid_amount) > totalAmount) {
    throw new ApiError(400, 'Total amount cannot be less than the amount already paid (₹' + existing.paid_amount + ').');
  }

  const dueAmount = totalAmount - Number(existing.paid_amount);
  const status = dueAmount <= 0 ? 'Paid' : 'Pending';

  const result = await pool.query(
    `UPDATE customers SET name=$1, phone=$2, service=$3, total_amount=$4, due_amount=$5, status=$6, updated_at=now()
     WHERE id=$7 AND shop_owner_id=$8 RETURNING *`,
    [String(name).trim(), String(phone).trim(), String(service || '').trim(), totalAmount, dueAmount, status, existing.id, req.shopOwnerId]
  );

  res.json({ customer: toPublicCustomer(result.rows[0]) });
});

// ---------------------------------------------------------------
// DELETE /api/customers/:id
// ---------------------------------------------------------------
const deleteCustomer = asyncHandler(async (req, res) => {
  const existing = await getOwnedCustomer(pool, req.params.id, req.shopOwnerId);
  if (!existing) throw new ApiError(404, 'Customer record not found.');

  await pool.query('DELETE FROM customers WHERE id = $1 AND shop_owner_id = $2', [existing.id, req.shopOwnerId]);
  res.json({ success: true, deletedId: existing.id, name: existing.name });
});

// ---------------------------------------------------------------
// POST /api/customers/:id/payments  (record a partial/full payment)
// This is the auto-recalculation + auto-status-change logic.
// ---------------------------------------------------------------
const addPayment = asyncHandler(async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await getOwnedCustomer(client, req.params.id, req.shopOwnerId);
    if (!existing) throw new ApiError(404, 'Customer record not found.');

    const amount = Number(req.body.amount);
    const note = String(req.body.note || '').trim();

    if (isNaN(amount) || amount <= 0) throw new ApiError(400, 'Enter a valid payment amount.');
    if (amount > Number(existing.due_amount)) {
      throw new ApiError(400, `Payment cannot exceed the remaining due amount (₹${existing.due_amount}).`);
    }

    const newPaid = Number(existing.paid_amount) + amount;
    const newDue = Number(existing.total_amount) - newPaid;
    const newStatus = newDue <= 0 ? 'Paid' : 'Pending';

    const updated = await client.query(
      `UPDATE customers SET paid_amount=$1, due_amount=$2, status=$3, updated_at=now()
       WHERE id=$4 RETURNING *`,
      [newPaid, newDue < 0 ? 0 : newDue, newStatus, existing.id]
    );

    const paymentRow = await client.query(
      `INSERT INTO payments (customer_id, shop_owner_id, amount, note) VALUES ($1,$2,$3,$4) RETURNING *`,
      [existing.id, req.shopOwnerId, amount, note]
    );

    await client.query('COMMIT');

    res.status(201).json({
      customer: toPublicCustomer(updated.rows[0]),
      payment: toPublicPayment(paymentRow.rows[0])
    });
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
});

// ---------------------------------------------------------------
// GET /api/customers/:id/payments  (history only)
// ---------------------------------------------------------------
const listPayments = asyncHandler(async (req, res) => {
  const existing = await getOwnedCustomer(pool, req.params.id, req.shopOwnerId);
  if (!existing) throw new ApiError(404, 'Customer record not found.');

  const result = await pool.query('SELECT * FROM payments WHERE customer_id = $1 ORDER BY paid_at DESC', [existing.id]);
  res.json({ payments: result.rows.map(toPublicPayment) });
});

// ---------------------------------------------------------------
// GET /api/customers/:id/whatsapp-link  (generate reminder message)
// Free approach: builds a wa.me deep link with a pre-filled message.
// Opening it on the shop owner's device/browser launches WhatsApp
// with the message ready to send — no paid API required.
// ---------------------------------------------------------------
const getWhatsappLink = asyncHandler(async (req, res) => {
  const existing = await getOwnedCustomer(pool, req.params.id, req.shopOwnerId);
  if (!existing) throw new ApiError(404, 'Customer record not found.');

  const ownerResult = await pool.query('SELECT shop_name FROM shop_owners WHERE id = $1', [req.shopOwnerId]);
  const shopName = ownerResult.rows[0]?.shop_name || 'Your shop';

  const digits = String(existing.phone).replace(/[^0-9]/g, '');
  // Default to India country code if a 10-digit local number was stored,
  // matching the phone validation pattern used in the original UI.
  const phoneForWa = digits.length === 10 ? '91' + digits : digits;

  const message = existing.status === 'Paid'
    ? `Hi ${existing.name}, this is ${shopName}. Thank you for clearing your due of ₹${existing.total_amount}. We appreciate your business!`
    : `Hi ${existing.name}, this is a reminder from ${shopName}. Your pending due is ₹${existing.due_amount} (out of ₹${existing.total_amount} for ${existing.service || 'your purchase'}). Please clear it at your earliest convenience. Thank you!`;

  const link = `https://wa.me/${phoneForWa}?text=${encodeURIComponent(message)}`;
  res.json({ link, message });
});

module.exports = {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addPayment,
  listPayments,
  getWhatsappLink
};
