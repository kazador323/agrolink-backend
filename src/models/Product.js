const { Schema, model, Types } = require('mongoose')

const productSchema = new Schema({
  name: { type: String, required: true },
  description: String,
  price: { type: Number, required: true },
  stock: { type: Number, required: true },
  category: String,
  imageUrl: String,
  producerId: { type: Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true })

module.exports = model('Product', productSchema)
