const router = require('express').Router()
const auth = require('../middleware/auth')
const User = require('../models/User')

router.get('/', auth(), async (req, res) => {
  const u = await User.findById(req.user.sub).select('name email phone role region comuna')
  res.json(u)
})

router.put('/', auth(), async (req, res) => {
  const { name, email, phone, region, comuna } = req.body

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'name, email y phone son obligatorios' })
  }
  if (!/^[+0-9\s()-]{6,20}$/.test(phone)) {
    return res.status(400).json({ error: 'Phone inválido' })
  }

  const exists = await User.findOne({ _id: { $ne: req.user.sub }, email })
  if (exists) {
    return res.status(400).json({ error: 'Email ya está en uso' })
  }

  const update = { name, email, phone }

  if (typeof region === 'string') update.region = region
  if (typeof comuna === 'string') update.comuna = comuna

  const u = await User.findByIdAndUpdate(
    req.user.sub,
    update,
    { new: true, select: 'name email phone role region comuna' }
  )

  res.json(u)
})

module.exports = router
