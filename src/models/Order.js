const { Schema, model, Types } = require('mongoose')

const orderSchema = new Schema({
  consumerId: { type: Types.ObjectId, ref: 'User', required: true },
  producerId: { type: Types.ObjectId, ref: 'User', required: true },
  items: [{
    productId: { type: Types.ObjectId, ref: 'Product', required: true },
    name: String,
    price: Number,
    quantity: Number
  }],
  total: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'paid', 'delivered'], default: 'pending' }
}, { timestamps: true })

module.exports = model('Order', orderSchema)
