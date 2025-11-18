const { Schema, model, models, Types } = require('mongoose')

const locationSchema = new Schema({
  userId:   { type: Types.ObjectId, ref: 'User', required: true, unique: true }, // ← único aquí
  address:  { type: String, required: true, trim: true },
  commune:  { type: String, required: true, trim: true },
  region:   { type: String, required: true, trim: true },
  latitude: { type: Number },
  longitude:{ type: Number },
}, { timestamps: true })


module.exports = models.Location || model('Location', locationSchema)
