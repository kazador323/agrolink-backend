const router = require('express').Router()
const Order = require('../models/Order')
const Product = require('../models/Product')
const auth = require('../middleware/auth')
const Location = require('../models/Location')
const { sendEmail } = require('../services/notify')

router.post('/', auth('consumer'), async (req, res) => {
  try {
    const consumerId = req.user.sub
    const { producerId, items } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items requeridos' })
    }
    if (!producerId) {
      return res.status(400).json({ error: 'producerId requerido' })
    }

    let totalCalculado = 0

    for (const it of items) {
      const prod = await Product.findById(it.productId)
      if (!prod) {
        return res.status(400).json({ error: `Producto no existe: ${it.productId}` })
      }
      if (String(prod.producerId) !== String(producerId)) {
        return res.status(400).json({ error: 'Todos los items deben ser del mismo productor' })
      }
      if (prod.stock < it.quantity) {
        return res.status(400).json({ error: `Stock insuficiente para ${prod.name || prod.name}` })
      }

      totalCalculado += Number(prod.price || 0) * Number(it.quantity || 0)
    }

    for (const it of items) {
      await Product.updateOne(
        { _id: it.productId },
        { $inc: { stock: -it.quantity } }
      )
    }

    const order = await Order.create({
      consumerId,
      producerId,
      items,
      total: totalCalculado,
      status: 'pending'
    })

    await order.populate({ path: 'producerId', select: 'name phone email' })
    await order.populate({ path: 'items.productId', select: 'name price imageUrl category' })

    //Notificar al productor por correo, si tiene email
    /*if (order.producerId?.email) {
      await sendEmail(
        order.producerId.email,
        'Nuevo pedido recibido en AgroLink',
        `<p>Hola ${order.producerId.name},</p>
        <p>Has recibido un nuevo pedido por <strong>$${order.total}</strong>.</p>
        <p>Ingresa a AgroLink para ver los detalles.</p>`
      )
    }*/

    res.json(order)
  } catch (err) {
    console.error('[POST /orders] error', err)
    res.status(400).json({ error: 'Error al crear pedido' })
  }
})

router.put('/:id/deliver', auth('producer'), async (req, res) => {
  try {
    const _id = req.params.id
    const userId = req.user.sub

    const order = await Order.findOne({ _id, producerId: userId })
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado o sin permisos' })
    if (order.status !== 'in_transit') {
      return res.status(400).json({ error: 'El pedido debe estar EN REPARTO para entregarlo' })
    }

    order.status = 'delivered'
    await order.save()

    const populated = await Order.findById(order._id)
      .populate({ path: 'consumerId', select: 'name phone' })
      .populate({ path: 'producerId', select: 'name phone' })
      .populate({ path: 'items.productId', select: 'name price imageUrl category' })
      .lean()

    res.json(populated)
  } catch (err) {
    console.error('[PUT /orders/:id/deliver] error', err)
    res.status(400).json({ error: 'Error al entregar pedido' })
  }
})

// Poner pedido en reparto (producer)
router.put('/:id/ship', auth('producer'), async (req, res) => {
  try {
    const _id = req.params.id
    const userId = req.user.sub

    const order = await Order.findOne({ _id, producerId: userId })
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado o sin permisos' })

    if (!['pending', 'paid'].includes(order.status)) {
      return res.status(400).json({ error: 'Solo se puede pasar a En Reparto desde Pendiente o Pagado' })
    }

    order.status = 'in_transit'
    await order.save()

    const populated = await Order.findById(order._id)
      .populate({ path: 'consumerId', select: 'name phone' })
      .populate({ path: 'producerId', select: 'name phone' })
      .populate({ path: 'items.productId', select: 'name price imageUrl category' })
      .lean()

    res.json(populated)
  } catch (err) {
    console.error('[PUT /orders/:id/ship] error', err)
    res.status(400).json({ error: 'Error al actualizar pedido' })
  }
})

// Cancelar pedido (consumer o producer)
router.put('/:id/cancel', auth(), async (req, res) => {
  try {
    const _id = req.params.id
    const userId = req.user.sub
    const role = req.user.role

    const order = await Order.findById(_id)
    if (!order) return res.status(404).json({ error: 'Pedido no encontrado' })

    const isConsumer = String(order.consumerId) === String(userId)
    const isProducer = String(order.producerId) === String(userId)
    const isInvolved = isConsumer || isProducer

    // Solo consumidor, productor o admin
    if (!isInvolved && role !== 'admin') {
      return res.status(403).json({ error: 'Sin permisos para cancelar este pedido' })
    }

    // Reglas por estado
    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'El pedido ya está cancelado' })
    }

    if (order.status === 'delivered') {
      return res.status(400).json({ error: 'No se pueden cancelar pedidos ya entregados' })
    }

    if (order.status === 'in_transit') {
      return res.status(400).json({ error: 'No se pueden cancelar pedidos en reparto' })
    }

    if (order.status === 'pending') {
    } else if (order.status === 'paid') {
      if (!isProducer && role !== 'admin') {
        return res.status(400).json({
          error: 'Solo el productor puede cancelar un pedido pagado (previa coordinación con el consumidor)'
        })
      }
    } else {
      return res.status(400).json({ error: 'No se puede cancelar este pedido en su estado actual' })
    }
    for (const it of order.items) {
      await Product.updateOne(
        { _id: it.productId },
        { $inc: { stock: it.quantity } }
      )
    }

    order.status = 'cancelled'
    await order.save()

    const populated = await Order.findById(order._id)
      .populate({ path: 'consumerId', select: 'name phone' })
      .populate({ path: 'producerId', select: 'name phone' })
      .populate({ path: 'items.productId', select: 'name price imageUrl category' })
      .lean()

    res.json(populated)
  } catch (err) {
    console.error('[PUT /orders/:id/cancel] error', err)
    res.status(400).json({ error: 'Error al cancelar pedido' })
  }
})

router.get('/my', auth(), async (req, res) => {
  try {
    const userId = req.user.sub
    const role = req.user.role

    let filter = {}
    let populates = []

    if (role === 'consumer') {
      filter = { consumerId: userId }
      populates.push({ path: 'producerId', select: 'name phone' })
    } else if (role === 'producer') {
      filter = { producerId: userId }
      populates.push({ path: 'consumerId', select: 'name phone' })
    } else {
      filter = {}
      populates.push({ path: 'consumerId', select: 'name phone' })
      populates.push({ path: 'producerId', select: 'name phone' })
    }

    populates.push({
      path: 'items.productId',
      select: 'name price imageUrl category'
    })

    let q = Order.find(filter).sort({ createdAt: -1 })
    for (const p of populates) q = q.populate(p)

    let orders = await q.lean()

    if (role === 'producer' || role === 'admin') {
      const consumerIds = [
        ...new Set(
          orders
            .map(o => {
              const c = o.consumerId
              return c && (c._id || c)
            })
            .filter(Boolean)
            .map(id => String(id))
        )
      ]

      if (consumerIds.length > 0) {
        const locations = await Location.find({ userId: { $in: consumerIds } })
          .select('userId region comuna')
          .lean()

        const locByUser = {}
        for (const loc of locations) {
          locByUser[String(loc.userId)] = {
            region: loc.region,
            comuna: loc.comuna,
          }
        }

        orders = orders.map(o => {
          const c = o.consumerId
          const cid = c && (c._id || c)
          const key = cid && String(cid)
          return {
            ...o,
            consumerLocation: key && locByUser[key] ? locByUser[key] : null,
          }
        })
      }
    }

    res.json(orders)
  } catch (err) {
    console.error('[GET /orders/my] error', err)
    res.status(400).json({ error: 'Error al listar pedidos' })
  }
})

router.get('/:id', auth(), async (req, res) => {
  try {
    const id = req.params.id
    const userId = req.user.sub
    const role = req.user.role

    const cond = (role === 'admin')
      ? { _id: id }
      : { _id: id, $or: [{ consumerId: userId }, { producerId: userId }] }

    const o = await Order.findOne(cond)
      .populate({ path: 'consumerId', select: 'name phone email' })
      .populate({ path: 'producerId', select: 'name phone email' })
      .populate({ path: 'items.productId', select: 'name price imageUrl category' })
      .lean()

    if (!o) return res.status(404).json({ error: 'Pedido no encontrado' })
    res.json(o)
  } catch (err) {
    console.error('[GET /orders/:id] error', err)
    res.status(400).json({ error: 'Error al obtener pedido' })
  }
})

module.exports = router
