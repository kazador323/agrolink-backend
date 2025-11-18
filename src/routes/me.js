const router = require('express').Router()
const auth = require('../middleware/auth')
const User = require('../models/User')

// GET /api/me
router.get('/', auth(), async (req, res) => {
  const u = await User.findById(req.user.sub).select('name email phone role')
  res.json(u)
})

// PUT /api/me  (permitir actualizar name/email/phone)
router.put('/', auth(), async (req, res) => {
  const { name, email, phone } = req.body
  if (!name || !email || !phone) return res.status(400).json({ error: 'name, email y phone son obligatorios' })
  if (!/^[+0-9\s()-]{6,20}$/.test(phone)) return res.status(400).json({ error: 'Phone inválido' })

  // evitar colisión de email
  const exists = await User.findOne({ _id: { $ne: req.user.sub }, email })
  if (exists) return res.status(400).json({ error: 'Email ya está en uso' })

  const u = await User.findByIdAndUpdate(req.user.sub, { name, email, phone }, { new: true, select: 'name email phone role' })
  res.json(u)
})

module.exports = router
