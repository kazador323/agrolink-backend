const jwt = require('jsonwebtoken')

function auth(requiredRole) {
  return (req, res, next) => {
    const header = req.headers.authorization
    if (!header) return res.status(401).json({ error: 'Token requerido' })

    const token = header.replace('Bearer ', '')
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      req.user = payload

      if (requiredRole && payload.role !== requiredRole && payload.role !== 'admin') {
        return res.status(403).json({ error: 'Permisos insuficientes' })
      }

      next()
    } catch (err) {
      return res.status(401).json({ error: 'Token inválido o expirado' })
    }
  }
}

module.exports = auth
