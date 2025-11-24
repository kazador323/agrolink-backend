const router = require('express').Router()
const Rating = require('../models/Rating')
const Order = require('../models/Order')
const auth = require('../middleware/auth')
const { Types } = require('mongoose')

// Crear rating para pedido entregado
router.post('/', auth('consumer'), async (req, res) => {
  try {
    const userId = req.user.sub
    const { orderId, score, comment } = req.body

    const order = await Order.findById(orderId)
    if (!order || order.status !== 'delivered') {
      return res.status(400).json({ error: 'Pedido no válido para calificación' })
    }
    if (String(order.consumerId) !== String(userId)) {
      return res.status(403).json({ error: 'No puedes calificar pedidos de otros usuarios' })
    }

    const rating = await Rating.create({
      orderId,
      producerId: order.producerId,
      consumerId: order.consumerId,
      score,
      comment
    })

    res.json(rating)
  } catch (err) {
    res.status(400).json({ error: 'Error al registrar calificación' })
  }
})

router.get('/producer/:producerId', async (req, res) => {
  try {
    const { producerId } = req.params
    const agg = await Rating.aggregate([
      { $match: { producerId: new Types.ObjectId(producerId) } },
      {
        $group: {
          _id: '$producerId',
          avgScore: { $avg: '$score' },
          count: { $sum: 1 }
        }
      }
    ])

    if (!agg.length) {
      return res.json({ producerId, avgScore: null, count: 0 })
    }

    res.json({
      producerId,
      avgScore: agg[0].avgScore,
      count: agg[0].count
    })
  } catch (err) {
    console.error('[GET /ratings/producer/:producerId] error', err)
    res.status(400).json({ error: 'Error al obtener calificaciones del productor' })
  }
})

module.exports = router
