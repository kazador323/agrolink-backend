require('dotenv').config()
const express = require('express')
const cors = require('cors')
const mongoose = require('mongoose')

// Rutas
const authRoutes = require('./routes/auth')
const productRoutes = require('./routes/products')
const orderRoutes = require('./routes/orders')
const paymentRoutes = require('./routes/payments')
const ratingRoutes = require('./routes/ratings')
const locationRoutes = require('./routes/location')
const meRoutes = require('./routes/me')

const app = express()

/* ====== CORS ======
   En Render define FRONT_ORIGIN = https://tu-front.vercel.app
   En local sigue valiendo http://localhost:5173
*/
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  process.env.FRONT_ORIGIN, // p.ej. https://agrolink.vercel.app
].filter(Boolean)

app.use(cors({
  origin: (origin, cb) => {
    // Permite tools como curl/postman (sin origin)
    if (!origin) return cb(null, true)
    if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true)
    return cb(new Error('Not allowed by CORS'))
  },
  credentials: true,
}))

app.use(express.json())

/* ====== HEALTHCHECK ====== */
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: process.env.NODE_ENV || 'development', time: new Date().toISOString() })
})

/* ====== RUTAS PÚBLICAS/PROTEGIDAS ====== */
app.use('/api/location', locationRoutes)
app.use('/api/me', meRoutes)
app.use('/api/auth', authRoutes)
app.use('/api/products', productRoutes)
app.use('/api/orders', orderRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/ratings', ratingRoutes)

/* ====== MONGODB ====== */
const MONGODB_URI = process.env.MONGODB_URI
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI no definido en variables de entorno')
  process.exit(1)
}

// Opcional: evita warnings y mejora DX
mongoose.set('strictQuery', true)

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ Conectado a MongoDB Atlas'))
  .catch(err => {
    console.error('❌ Error de conexión MongoDB:', err.message)
    process.exit(1)
  })

/* ====== BOOT ====== */
const PORT = process.env.PORT || 4000
const server = app.listen(PORT, () => {
  console.log(`🚀 API escuchando en puerto ${PORT}`)
})

/* ====== SHUTDOWN LIMPIO ====== */
async function shutdown(signal) {
  console.log(`\n${signal} recibido, cerrando servidor...`)

  try {
    // Cerrar el servidor HTTP primero
    await new Promise((resolve, reject) => {
      server.close(err => {
        if (err) return reject(err)
        return resolve()
      })
    })

    // Cerrar conexión a Mongo (sin callback)
    await mongoose.connection.close(false) // o simplemente: await mongoose.connection.close()
    console.log('🟡 Conexión Mongo cerrada. Bye!')

    process.exit(0)
  } catch (err) {
    console.error('❌ Error al cerrar la app:', err)
    process.exit(1)
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
