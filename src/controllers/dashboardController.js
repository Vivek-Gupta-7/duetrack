const pool = require('../db/pool');
const { asyncHandler } = require('../middleware/errors');

// GET /api/dashboard/stats
const getStats = asyncHandler(async (req, res) => {
  const ownerId = req.shopOwnerId;

  const counts = await pool.query(
    `SELECT
       COUNT(*)::int AS total_customers,
       COUNT(*) FILTER (WHERE status = 'Pending')::int AS pending_customers,
       COUNT(*) FILTER (WHERE status = 'Paid')::int AS paid_customers,
       COALESCE(SUM(due_amount), 0) AS total_due_amount,
       COALESCE(SUM(paid_amount), 0) AS total_collected_amount
     FROM customers WHERE shop_owner_id = $1`,
    [ownerId]
  );

  const today = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS today_collection
     FROM payments
     WHERE shop_owner_id = $1 AND paid_at::date = now()::date`,
    [ownerId]
  );

  const row = counts.rows[0];

  res.json({
    totalCustomers: row.total_customers,
    pendingCustomers: row.pending_customers,
    paidCustomers: row.paid_customers,
    totalDueAmount: Number(row.total_due_amount),
    totalCollectedAmount: Number(row.total_collected_amount),
    todaysCollection: Number(today.rows[0].today_collection)
  });
});

// GET /api/dashboard/recent
const getRecent = asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT * FROM customers WHERE shop_owner_id = $1 ORDER BY created_at DESC LIMIT 5`,
    [req.shopOwnerId]
  );
  res.json({
    customers: result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      service: row.service,
      total: Number(row.total_amount),
      paid: Number(row.paid_amount),
      due: Number(row.due_amount),
      status: row.status,
      createdAt: row.created_at
    }))
  });
});

module.exports = { getStats, getRecent };
