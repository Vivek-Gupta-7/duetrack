const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/auth');
const {
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  addPayment,
  listPayments,
  getWhatsappLink
} = require('../controllers/customersController');

router.use(requireAuth); // every route below requires a logged-in shop owner

router.get('/', listCustomers);
router.post('/', createCustomer);
router.get('/:id', getCustomer);
router.put('/:id', updateCustomer);
router.delete('/:id', deleteCustomer);

router.get('/:id/payments', listPayments);
router.post('/:id/payments', addPayment);

router.get('/:id/whatsapp-link', getWhatsappLink);

module.exports = router;
