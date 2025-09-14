const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
  transactionDate: {
    type: Date,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  transactionType: {
    type: String,
    enum: ['debit', 'credit'],
    required: true
  },
  category: {
    type: String,
    default: 'Uncategorized'
  },
  balance: {
    type: Number
  },
  receiptNo: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for better query performance
transactionSchema.index({ transactionDate: -1 });
transactionSchema.index({ category: 1 });

module.exports = mongoose.model('Transaction', transactionSchema);