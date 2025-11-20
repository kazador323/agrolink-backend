const router = require('express').Router()
const Order = require('../models/Order')
const Product = require('../models/Product')
const auth = require('../middleware/auth')

router.post('/', auth('consumer'), async (req, res) => {
  try {
    const consumerId = req.user.sub
    const { producerId, items, total } = req.body

    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items requeridos' })
    }
    if (!producerId) {
      return res.status(400).json({ error: 'producerId requerido' })
    }
    if (typeof total !== 'number' || total <= 0) {
      return res.status(400).json({ error: 'Total inválido' })
    }

    // Verificar stock de cada item y consistencia de productor
    for (const it of items) {
      const prod = await Product.findById(it.productId)
      if (!prod) return res.status(400).json({ error: `Producto no existe: ${it.productId}` })
      if (String(prod.producerId) !== String(producerId)) {
        return res.status(400).json({ error: 'Todos los items deben ser del mismo productor' })
      }
      if (prod.stock < it.quantity) {
        return res.status(400).json({ error: `Stock insuficiente para ${prod.name || prod.name}` })
      }
    }

    // Descontar stock
    for (const it of items) {
      await Product.updateOne({ _id: it.productId }, { $inc: { stock: -it.quantity } })
    }

    // Crear pedido
    const order = await Order.create({
      consumerId,
      producerId,
      items,
      total,
      status: 'pending' // 'pending' | 'paid' (luego con /payments) | 'delivered'
    })

    // Popular para devolver listo
    await order.populate({ path: 'producerId', select: 'name phone' })
    await order.populate({ path: 'items.productId', select: 'name price imageUrl category' })

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
    if (order.status !== 'paid') {
      return res.status(400).json({ error: 'El pedido debe estar pagado para entregar' })
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

// Listar pedidos del usuario autenticado //

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

    // Detalle de items opcional
    populates.push({ path: 'items.productId', select: 'name price imageUrl category' })

    let q = Order.find(filter).sort({ createdAt: -1 })
    for (const p of populates) q = q.populate(p)

    const orders = await q.lean()
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
