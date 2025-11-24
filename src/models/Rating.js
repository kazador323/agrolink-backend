const { Schema, model, Types } = require('mongoose')
const ratingSchema = new Schema({
  orderId:   { type: Types.ObjectId, ref: 'Order', required: true, unique: true },
  producerId:{ type: Types.ObjectId, ref: 'User', required: true },
  consumerId:{ type: Types.ObjectId, ref: 'User', required: true },
  score:     { type: Number, min: 1, max: 5, required: true },
  comment:   String
}, { timestamps: true })

module.exports = model('Rating', ratingSchema)