const router = require('express').Router()
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const User = require('../models/User')

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role, phone } = req.body
    if (!['producer', 'consumer'].includes(role)) {
      return res.status(400).json({ error: 'Rol inválido' })
    }
    if (!phone) return res.status(400).json({ error: 'Phone requerido' })
    if (!/^[+0-9\s()-]{6,20}$/.test(phone)) {
      return res.status(400).json({ error: 'Phone inválido' })
    }

    const exists = await User.findOne({ email })
    if (exists) return res.status(400).json({ error: 'Correo ya registrado' })

    const hash = await bcrypt.hash(password, 10)

    const user = await User.create({ name, email, password: hash, role, phone })

    res.json({
      id: user._id,
      email: user.email,
      role: user.role,
      phone: user.phone,
    })
  } catch (err) {
    console.error('[POST /auth/register] error', err)
    res.status(500).json({ error: 'Error en registro' })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  const user = await User.findOne({ email })
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' })

  const ok = await bcrypt.compare(password, user.password)
  if (!ok) return res.status(401).json({ error: 'Credenciales inválidas' })

  const token = jwt.sign(
    { sub: user._id, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  )

  res.json({ token, role: user.role })
})

router.post('/recover', async (req, res) => {
  try {
    const { email, newPassword } = req.body
    if (!email || !newPassword) {
      return res.status(400).json({ error: 'email y newPassword son requeridos' })
    }

    const user = await User.findOne({ email })
    if (!user) {
      return res.status(200).json({ ok: true })
    }

    const hash = await bcrypt.hash(newPassword, 10)
    user.password = hash
    await user.save()

    res.json({ ok: true })
  } catch (err) {
    console.error('[POST /auth/recover] error', err)
    res.status(400).json({ error: 'No se pudo actualizar la contraseña' })
  }
})

module.exports = router
