const router = require('express').Router()
const Rating = require('../models/Rating')
const Order = require('../models/Order')
const auth = require('../middleware/auth')

// Crear rating para pedido entregado
router.post('/', auth('consumer'), async (req, res) => {
  try {
    const { orderId, score, comment } = req.body
    const order = await Order.findById(orderId)
    if (!order || order.status !== 'delivered') {
      return res.status(400).json({ error: 'Pedido no válido para calificación' })
    }
    const rating = await Rating.create({ orderId, score, comment })
    res.json(rating)
  } catch (err) {
    res.status(400).json({ error: 'Error al registrar calificación' })
  }
})

module.exports = router
