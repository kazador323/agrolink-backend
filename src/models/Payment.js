const { Schema, model, Types } = require('mongoose')

const paymentSchema = new Schema({
  orderId: { type: Types.ObjectId, ref: 'Order', required: true },
  amount: { type: Number, required: true },
  method: { type: String, required: true },
  status: { type: String, default: 'confirmed' }
}, { timestamps: true })

module.exports = model('Payment', paymentSchema)
