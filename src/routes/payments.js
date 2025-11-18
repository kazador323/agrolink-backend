const router = require('express').Router()
const Payment = require('../models/Payment')
const Order = require('../models/Order')
const auth = require('../middleware/auth')

// Simula pago exitoso
router.post('/', auth('consumer'), async (req, res) => {
  try {
    const { orderId, amount, method } = req.body
    const payment = await Payment.create({ orderId, amount, method, status: 'confirmed' })
    await Order.findByIdAndUpdate(orderId, { status: 'paid' })
    res.json(payment)
  } catch (err) {
    res.status(400).json({ error: 'Error al registrar pago' })
  }
})

module.exports = router
