const { Schema, model, models } = require('mongoose')

const userSchema = new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true }, // ← único aquí
  password: { type: String, required: true },
  role: { type: String, enum: ['producer','consumer','admin'], required: true },
  phone: { type: String, required: true, trim: true },
}, { timestamps: true })


module.exports = models.User || model('User', userSchema)