# M-Pesa Expense Tracker & Analyzer

A comprehensive expense tracking application that analyzes M-Pesa transactions, automatically categorizes spending, and generates detailed reports.

## Features

- Upload M-Pesa CSV statements
- Automatic transaction categorization
- Spending analysis by category
- Monthly trend visualization
- Custom category editing
- Report generation

## Tech Stack

- Node.js
- Express.js
- MongoDB
- Bootstrap 5
- Chart.js

## Installation

1. Clone the repository
2. Install dependencies: `npm install`
3. Start MongoDB service
4. Create a `.env` file with your configuration
5. Start the application: `npm run dev`

## Usage

1. Export your M-Pesa statement as CSV from the M-Pesa app or website
2. Upload the CSV file using the drag-and-drop interface
3. View categorized transactions and spending analytics
4. Generate reports for specific date ranges

## API Endpoints

- `POST /api/transactions/upload` - Upload and process M-Pesa CSV
- `GET /api/transactions` - Get transactions with pagination and filters
- `GET /api/transactions/categories` - Get spending by category
- `GET /api/transactions/monthly` - Get monthly spending trends
- `PUT /api/transactions/:id/category` - Update transaction category
- `DELETE /api/transactions/:id` - Delete a transaction