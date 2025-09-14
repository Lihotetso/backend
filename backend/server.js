const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const cors = require('cors');
const lockfile = require('proper-lockfile');

const app = express();
const PORT = 5000;
const DB_FILE = path.join(__dirname, 'db.json');

// Middleware
app.use(cors());
app.use(express.json());

// Initialize database
const initializeDB = async () => {
  try {
    await fs.access(DB_FILE);
    // Validate JSON structure
    const data = await fs.readFile(DB_FILE, 'utf8');
    if (!data.trim()) {
      console.log('db.json is empty, initializing with default structure');
      await fs.writeFile(DB_FILE, JSON.stringify({ products: [], transactions: [], customers: [] }, null, 2));
    } else {
      JSON.parse(data); // Test parsing
    }
  } catch (error) {
    console.log('Initializing db.json due to error:', error.message);
    await fs.writeFile(DB_FILE, JSON.stringify({ products: [], transactions: [], customers: [] }, null, 2));
  }
};
initializeDB();

// Helper function to read database with locking
const readDB = async () => {
  let release;
  try {
    release = await lockfile.lock(DB_FILE);
    const data = await fs.readFile(DB_FILE, 'utf8');
    if (!data.trim()) {
      console.error('db.json is empty');
      throw new Error('Database file is empty');
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Error reading db.json:', error.message);
    throw error;
  } finally {
    if (release) await release();
  }
};

// Helper function to write to database with locking
const writeDB = async (data) => {
  let release;
  try {
    release = await lockfile.lock(DB_FILE);
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error writing to db.json:', error.message);
    throw error;
  } finally {
    if (release) await release();
  }
};

// Get all products
app.get('/api/products', async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.products);
  } catch (error) {
    res.status(500).json({ error: 'Error reading products: ' + error.message });
  }
});

// Add new product
app.post('/api/products', async (req, res) => {
  try {
    const db = await readDB();
    const newProduct = {
      id: req.body.id,
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      price: parseFloat(req.body.price),
      quantity: parseInt(req.body.quantity)
    };
    db.products.push(newProduct);
    await writeDB(db);
    res.status(201).json(newProduct);
  } catch (error) {
    res.status(500).json({ error: 'Error adding product: ' + error.message });
  }
});

// Update product
app.put('/api/products/:id', async (req, res) => {
  try {
    const db = await readDB();
    const productId = parseInt(req.params.id);
    const productIndex = db.products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const updatedProduct = {
      id: productId,
      name: req.body.name,
      description: req.body.description,
      category: req.body.category,
      price: parseFloat(req.body.price),
      quantity: parseInt(req.body.quantity)
    };
    db.products[productIndex] = updatedProduct;
    await writeDB(db);
    res.json(updatedProduct);
  } catch (error) {
    res.status(500).json({ error: 'Error updating product: ' + error.message });
  }
});

// Delete product
app.delete('/api/products/:id', async (req, res) => {
  try {
    const db = await readDB();
    const productId = parseInt(req.params.id);
    const productIndex = db.products.findIndex(p => p.id === productId);
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }
    db.products.splice(productIndex, 1);
    await writeDB(db);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error deleting product: ' + error.message });
  }
});

// Get all customers
app.get('/api/customers', async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.customers);
  } catch (error) {
    res.status(500).json({ error: 'Error reading customers: ' + error.message });
  }
});

// Add new customer
app.post('/api/customers', async (req, res) => {
  try {
    const db = await readDB();
    const newCustomer = {
      id: req.body.id,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone || ''
    };
    db.customers.push(newCustomer);
    await writeDB(db);
    res.status(201).json(newCustomer);
  } catch (error) {
    res.status(500).json({ error: 'Error adding customer: ' + error.message });
  }
});

// Update customer
app.put('/api/customers/:id', async (req, res) => {
  try {
    const db = await readDB();
    const customerId = parseInt(req.params.id);
    const customerIndex = db.customers.findIndex(c => c.id === customerId);
    if (customerIndex === -1) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const updatedCustomer = {
      id: customerId,
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone || ''
    };
    db.customers[customerIndex] = updatedCustomer;
    await writeDB(db);
    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ error: 'Error updating customer: ' + error.message });
  }
});

// Delete customer
app.delete('/api/customers/:id', async (req, res) => {
  try {
    const db = await readDB();
    const customerId = parseInt(req.params.id);
    const customerIndex = db.customers.findIndex(c => c.id === customerId);
    if (customerIndex === -1) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    db.customers.splice(customerIndex, 1);
    await writeDB(db);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: 'Error deleting customer: ' + error.message });
  }
});

// Handle stock transactions
app.post('/api/transactions', async (req, res) => {
  try {
    const db = await readDB();
    const { productId, customerId, quantity, type } = req.body;
    const productIndex = db.products.findIndex(p => p.id === parseInt(productId));
    if (productIndex === -1) {
      return res.status(404).json({ error: 'Product not found' });
    }
    const customerIndex = db.customers.findIndex(c => c.id === parseInt(customerId));
    if (customerId && customerIndex === -1) {
      return res.status(404).json({ error: 'Customer not found' });
    }
    const product = db.products[productIndex];
    const parsedQuantity = parseInt(quantity);
    if (isNaN(parsedQuantity) || parsedQuantity <= 0) {
      return res.status(400).json({ error: 'Invalid quantity' });
    }
    if (type === 'add') {
      product.quantity += parsedQuantity;
    } else if (type === 'deduct') {
      if (product.quantity < parsedQuantity) {
        return res.status(400).json({ error: 'Insufficient stock' });
      }
      product.quantity -= parsedQuantity;
    } else {
      return res.status(400).json({ error: 'Invalid transaction type' });
    }
    const transaction = {
      id: Date.now(),
      productId: parseInt(productId),
      customerId: customerId ? parseInt(customerId) : null,
      quantity: parsedQuantity,
      type,
      timestamp: req.body.timestamp
    };
    db.transactions.push(transaction);
    await writeDB(db);
    res.json(product);
  } catch (error) {
    res.status(500).json({ error: 'Error processing transaction: ' + error.message });
  }
});

// Get transaction history
app.get('/api/transactions', async (req, res) => {
  try {
    const db = await readDB();
    res.json(db.transactions);
  } catch (error) {
    res.status(500).json({ error: 'Error reading transactions: ' + error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});