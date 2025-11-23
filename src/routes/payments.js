const router = require('express').Router()
const Payment = require('../models/Payment')
const Order = require('../models/Order')
const auth = require('../middleware/auth')

router.post('/', auth('consumer'), async (req, res) => {
  try {
    const userId = req.user.sub
    const { orderId, amount, method } = req.body

    if (!orderId) {
      return res.status(400).json({ error: 'orderId requerido' })
    }
    if (typeof amount !== 'number' || amount <= 0) {
      return res.status(400).json({ error: 'Monto de pago inválido' })
    }
    if (!method) {
      return res.status(400).json({ error: 'Método de pago requerido' })
    }

    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' })
    }

    if (String(order.consumerId) !== String(userId)) {
      return res.status(403).json({ error: 'No puedes pagar pedidos de otros usuarios' })
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'No se puede pagar un pedido cancelado' })
    }
    if (order.status === 'delivered') {
      return res.status(400).json({ error: 'No se puede pagar un pedido ya entregado' })
    }
    if (order.status === 'paid') {
      return res.status(400).json({ error: 'El pedido ya se encuentra pagado' })
    }

    const existingPayment = await Payment.findOne({ orderId, status: 'confirmed' })
    if (existingPayment) {
      return res.status(400).json({ error: 'Este pedido ya tiene un pago registrado' })
    }

    const orderTotal = Number(order.total || 0)
    if (Number(amount) !== orderTotal) {
      return res.status(400).json({
        error: `Monto inválido: se esperaba ${orderTotal} para este pedido`
      })
    }

    const payment = await Payment.create({
      orderId,
      amount: orderTotal,
      method,
      status: 'confirmed',
    })

    order.status = 'paid'
    await order.save()

    res.json(payment)
  } catch (err) {
    console.error('[POST /payments] error', err)
    res.status(400).json({ error: 'Error al registrar pago' })
  }
})

router.get('/:orderId', auth(), async (req, res) => {
  try {
    const { orderId } = req.params
    const userId = req.user.sub
    const role = req.user.role

    if (!orderId) {
      return res.status(400).json({ error: 'orderId requerido' })
    }

    const order = await Order.findById(orderId)
    if (!order) {
      return res.status(404).json({ error: 'Pedido no encontrado' })
    }

    const isConsumer = String(order.consumerId) === String(userId)
    const isProducer = String(order.producerId) === String(userId)

    if (!isConsumer && !isProducer && role !== 'admin') {
      return res.status(403).json({ error: 'Sin permisos para ver pagos de este pedido' })
    }

    const payments = await Payment.find({ orderId })
      .sort({ createdAt: -1 })
      .lean()

    res.json({
      orderId: order._id,
      orderStatus: order.status,
      orderTotal: order.total,
      payments,
    })
  } catch (err) {
    console.error('[GET /payments/:orderId] error', err)
    res.status(400).json({ error: 'Error al obtener pagos del pedido' })
  }
})

module.exports = router
