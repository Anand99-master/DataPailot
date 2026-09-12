const sqlite3 = require('sqlite3');
const { open } = require('sqlite');
const fs = require('fs');

async function createDb() {
  const dbFile = 'data/datapilot_demo.sqlite';
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
  }
  
  const db = await open({
    filename: dbFile,
    driver: sqlite3.Database
  });

  await db.exec(`
    CREATE TABLE customers (
      customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    
    CREATE TABLE products (
      product_id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      price DECIMAL(10, 2) NOT NULL,
      stock_quantity INTEGER NOT NULL
    );
    
    CREATE TABLE orders (
      order_id INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id INTEGER NOT NULL,
      order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT NOT NULL,
      total_amount DECIMAL(10, 2) NOT NULL,
      FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
    );
    
    CREATE TABLE order_items (
      order_item_id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      unit_price DECIMAL(10, 2) NOT NULL,
      FOREIGN KEY(order_id) REFERENCES orders(order_id),
      FOREIGN KEY(product_id) REFERENCES products(product_id)
    );
  `);

  await db.exec(`
    INSERT INTO customers (first_name, last_name, email) VALUES 
      ('Alice', 'Smith', 'alice@example.com'),
      ('Bob', 'Jones', 'bob@example.com'),
      ('Charlie', 'Brown', 'charlie@example.com');
      
    INSERT INTO products (name, category, price, stock_quantity) VALUES
      ('Laptop', 'Electronics', 999.99, 50),
      ('Smartphone', 'Electronics', 599.99, 100),
      ('Desk Chair', 'Furniture', 149.99, 20);
      
    INSERT INTO orders (customer_id, status, total_amount) VALUES
      (1, 'COMPLETED', 1149.98),
      (2, 'PENDING', 599.99);
      
    INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES
      (1, 1, 1, 999.99),
      (1, 3, 1, 149.99),
      (2, 2, 1, 599.99);
  `);
  
  await db.close();
  console.log('Demo SQLite database created at', dbFile);
}

createDb().catch(console.error);
