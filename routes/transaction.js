const express = require('express');
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const Transaction = require('../models/Transaction');
const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname)
  }
});

const upload = multer({ 
  storage: storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

// Upload and process M-Pesa CSV
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results = [];
    
    // Read and process CSV file
    fs.createReadStream(req.file.path)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        try {
          // Process transactions (M-Pesa CSV format specific parsing)
          const transactions = results.map(row => {
            // Parse M-Pesa CSV format - adjust based on your CSV structure
            const amount = parseFloat(row.Amount || row['Transaction Amount']);
            const description = row.Description || row.Narrative || '';
            
            return {
              transactionDate: new Date(row.Date || row['Completion Time']),
              description: description,
              amount: Math.abs(amount),
              transactionType: amount < 0 ? 'debit' : 'credit',
              balance: parseFloat(row['Balance'] || 0),
              receiptNo: row['Receipt No.'] || '',
              category: categorizeTransaction(description)
            };
          }).filter(tx => tx.description && !isNaN(tx.amount));

          // Save to database
          await Transaction.insertMany(transactions);
          
          // Clean up uploaded file
          fs.unlinkSync(req.file.path);
          
          res.json({ 
            success: true, 
            message: 'File processed successfully', 
            count: transactions.length 
          });
        } catch (error) {
          // Clean up file on error
          if (fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
          }
          res.status(500).json({ error: error.message });
        }
      })
      .on('error', (error) => {
        if (fs.existsSync(req.file.path)) {
          fs.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: error.message });
      });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get all transactions with optional filters
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 50, category, type, startDate, endDate } = req.query;
    
    // Build filter object
    const filter = {};
    if (category && category !== 'all') filter.category = category;
    if (type && type !== 'all') filter.transactionType = type;
    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate) filter.transactionDate.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .sort({ transactionDate: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Transaction.countDocuments(filter);

    res.json({
      transactions,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      total
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get spending by category
router.get('/categories', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const matchStage = {};
    if (startDate || endDate) {
      matchStage.transactionDate = {};
      if (startDate) matchStage.transactionDate.$gte = new Date(startDate);
      if (endDate) matchStage.transactionDate.$lte = new Date(endDate);
    }

    const categories = await Transaction.aggregate([
      { $match: { ...matchStage, transactionType: 'debit' } },
      {
        $group: {
          _id: '$category',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json(categories);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly spending
router.get('/monthly', async (req, res) => {
  try {
    const monthlyData = await Transaction.aggregate([
      { $match: { transactionType: 'debit' } },
      {
        $group: {
          _id: {
            year: { $year: '$transactionDate' },
            month: { $month: '$transactionDate' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } }
    ]);

    res.json(monthlyData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update transaction category
router.put('/:id/category', async (req, res) => {
  try {
    const { category } = req.body;
    const transaction = await Transaction.findByIdAndUpdate(
      req.params.id,
      { category },
      { new: true }
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json(transaction);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete transaction
router.delete('/:id', async (req, res) => {
  try {
    const transaction = await Transaction.findByIdAndDelete(req.params.id);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Helper function to categorize based on description
function categorizeTransaction(description) {
  const desc = description.toLowerCase();
  
  // M-Pesa specific patterns
  if (desc.includes('airtime') || desc.includes('fuliza')) return 'Airtime';
  if (desc.includes('paybill') || desc.includes('pbl')) {
    if (desc.includes('kplc') || desc.includes('power') || desc.includes('electricity')) return 'Electricity';
    if (desc.includes('water') || desc.includes('nwsc')) return 'Water';
    if (desc.includes('tv') || desc.includes('gotv') || desc.includes('startimes') || desc.includes('dstv')) return 'TV Subscription';
    if (desc.includes('internet') || desc.includes('safaricom') || desc.includes('wifi')) return 'Internet';
  }
  if (desc.includes('send money') || desc.includes('sent to') || desc.includes('to') ) return 'Money Transfer';
  if (desc.includes('withdraw') || desc.includes('atm')) return 'Cash Withdrawal';
  if (desc.includes('jumia') || desc.includes('amazon') || desc.includes('ebay') || desc.includes('alibaba')) return 'Online Shopping';
  if (desc.includes('supermarket') || desc.includes('nakumatt') || desc.includes('tuskys') || desc.includes('naivas') || desc.includes('carrefour')) return 'Groceries';
  if (desc.includes('restaurant') || desc.includes('cafe') || desc.includes('food') || desc.includes('kfc') || desc.includes('java')) return 'Dining';
  if (desc.includes('uber') || desc.includes('taxi') || desc.includes('bolt') || desc.includes('matatu') || desc.includes('bus')) return 'Transport';
  if (desc.includes('hotel') || desc.includes('lodging') || desc.includes('accommodation')) return 'Accommodation';
  if (desc.includes('hospital') || desc.includes('clinic') || desc.includes('medical') || desc.includes('pharmacy')) return 'Healthcare';
  if (desc.includes('school') || desc.includes('fee') || desc.includes('education') || desc.includes('university')) return 'Education';
  
  return 'Other';
}

module.exports = router;