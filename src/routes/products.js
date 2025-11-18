const router = require('express').Router()
const { Types } = require('mongoose')
const Product = require('../models/Product')
const auth = require('../middleware/auth')

/**
 * GET /api/products
 * Listado público con filtros y paginación
 * Query:
 *  - region, commune, category (filtros)
 *  - page (1..N), limit (1..50)
 * Respuesta: { items, page, pageSize, total, totalPages }
 */
router.get('/', async (req, res) => {
  try {
    const { region, commune, category } = req.query
    const page  = Math.max(parseInt(req.query.page || '1', 10), 1)
    const limit = Math.min(Math.max(parseInt(req.query.limit || '9', 10), 1), 50)
    const skip  = (page - 1) * limit

    const match = {}
    if (category) match.category = category

    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'locations',
          localField: 'producerId',
          foreignField: 'userId',
          as: 'producerLocation'
        }
      },
      { $unwind: { path: '$producerLocation', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'producerId',
          foreignField: '_id',
          as: 'producerUser'
        }
      },
      { $unwind: { path: '$producerUser', preserveNullAndEmptyArrays: true } },
    ]

    if (region)  pipeline.push({ $match: { 'producerLocation.region': region } })
    if (commune) pipeline.push({ $match: { 'producerLocation.commune': commune } })

    // proyectamos lo que necesita el front (incluye datos públicos del productor)
    pipeline.push({
      $project: {
        name: 1, description: 1, price: 1, stock: 1, category: 1, imageUrl: 1, producerId: 1, createdAt: 1,
        producerLocation: 1,
        producerPublic: { name: '$producerUser.name', phone: '$producerUser.phone' }
      }
    })

    pipeline.push({ $sort: { createdAt: -1 } })

    // paginación server-side
    pipeline.push({
      $facet: {
        data:  [{ $skip: skip }, { $limit: limit }],
        count: [{ $count: 'total' }]
      }
    })

    const [result] = await Product.aggregate(pipeline)
    const items = result?.data || []
    const total = result?.count?.[0]?.total || 0
    const totalPages = Math.max(Math.ceil(total / limit), 1)

    res.json({ items, page, pageSize: limit, total, totalPages })
  } catch (err) {
    console.error('[GET /products] error', err)
    res.status(500).json({ error: 'Error al listar productos' })
  }
})

/**
 * GET /api/products/categories
 * Devuelve categorías distintas (no vacías)
 */
router.get('/categories', async (_req, res) => {
  try {
    const cats = await Product.distinct('category', { category: { $exists: true, $ne: '' } })
    cats.sort((a,b)=> String(a).localeCompare(String(b)))
    res.json(cats)
  } catch (err) {
    console.error('[GET /products/categories] error', err)
    res.status(500).json({ error: 'Error al obtener categorías' })
  }
})

/**
 * GET /api/products/mine  (auth: producer)
 * Lista los productos del productor autenticado
 */
router.get('/mine', auth('producer'), async (req, res) => {
  try {
    const producerId = req.user.sub
    const products = await Product.find({ producerId }).sort({ createdAt: -1 })
    res.json(products)
  } catch (err) {
    console.error('[GET /products/mine] error', err)
    res.status(500).json({ error: 'Error al listar tus productos' })
  }
})

/**
 * GET /api/products/:id
 * Detalle con ubicación del productor y datos públicos (name/phone)
 * IMPORTANTE: dejar esta ruta DESPUÉS de /categories y /mine para evitar conflictos
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'ID inválido' })
    }

    const pipeline = [
      { $match: { _id: new Types.ObjectId(id) } },
      {
        $lookup: {
          from: 'locations',
          localField: 'producerId',
          foreignField: 'userId',
          as: 'producerLocation'
        }
      },
      { $unwind: { path: '$producerLocation', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'producerId',
          foreignField: '_id',
          as: 'producerUser'
        }
      },
      { $unwind: { path: '$producerUser', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: 1, description: 1, price: 1, stock: 1, category: 1, imageUrl: 1, producerId: 1, createdAt: 1,
          producerLocation: 1,
          producerPublic: { name: '$producerUser.name', phone: '$producerUser.phone' }
        }
      }
    ]

    const result = await Product.aggregate(pipeline)
    if (!result.length) return res.status(404).json({ error: 'Producto no encontrado' })
    res.json(result[0])
  } catch (err) {
    console.error('[GET /products/:id] error', err)
    res.status(500).json({ error: 'Error al obtener producto' })
  }
})

/**
 * POST /api/products  (auth: producer)
 * Crea un producto
 */
router.post('/', auth('producer'), async (req, res) => {
  try {
    const { name, description, price, stock, category, imageUrl } = req.body
    const producerId = req.user.sub

    if (!name || typeof price !== 'number' || typeof stock !== 'number') {
      return res.status(400).json({ error: 'name, price y stock son obligatorios' })
    }

    const product = await Product.create({ name, description, price, stock, category, imageUrl, producerId })
    res.json(product)
  } catch (err) {
    console.error('[POST /products] error', err)
    res.status(400).json({ error: 'Error al crear producto' })
  }
})

/**
 * PUT /api/products/:id  (auth: producer)
 * Actualiza un producto del productor autenticado
 */
router.put('/:id', auth('producer'), async (req, res) => {
  try {
    const _id = req.params.id
    if (!Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ error: 'ID inválido' })
    }
    const producerId = req.user.sub
    const body = (({ name, description, price, stock, category, imageUrl }) =>
      ({ name, description, price, stock, category, imageUrl }))(req.body)

    const p = await Product.findOne({ _id, producerId })
    if (!p) return res.status(404).json({ error: 'Producto no encontrado o sin permisos' })

    Object.assign(p, body)
    await p.save()
    res.json(p)
  } catch (err) {
    console.error('[PUT /products/:id] error', err)
    res.status(400).json({ error: 'Error al actualizar producto' })
  }
})

/**
 * DELETE /api/products/:id  (auth: producer)
 * Elimina un producto del productor autenticado
 */
router.delete('/:id', auth('producer'), async (req, res) => {
  try {
    const _id = req.params.id
    if (!Types.ObjectId.isValid(_id)) {
      return res.status(400).json({ error: 'ID inválido' })
    }
    const producerId = req.user.sub

    const p = await Product.findOne({ _id, producerId })
    if (!p) return res.status(404).json({ error: 'Producto no encontrado o sin permisos' })

    await Product.deleteOne({ _id })
    res.json({ ok: true })
  } catch (err) {
    console.error('[DELETE /products/:id] error', err)
    res.status(400).json({ error: 'Error al eliminar producto' })
  }
})

module.exports = router

