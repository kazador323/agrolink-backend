const router = require('express').Router()
const auth = require('../middleware/auth')
const Location = require('../models/Location')

// Obtener mi ubicación (usuario autenticado)
router.get('/my', auth(), async (req, res) => {
  const userId = req.user.sub
  const doc = await Location.findOne({ userId })
  res.json(doc || null)
})

// Crear o actualizar (upsert) mi ubicación
router.put('/my', auth(), async (req, res) => {
  const userId = req.user.sub
  const { address, commune, region, latitude, longitude } = req.body

  if (!address || !commune || !region) {
    return res.status(400).json({ error: 'address, commune y region son obligatorios' })
  }
  const loc = await Location.findOneAndUpdate(
    { userId },
    { $set: { address, commune, region, latitude, longitude } },
    { new: true, upsert: true }
  )
  res.json(loc)
})

// (Opcional) Borrar mi ubicación
router.delete('/my', auth(), async (req, res) => {
  const userId = req.user.sub
  await Location.deleteOne({ userId })
  res.json({ ok: true })
})

module.exports = router
