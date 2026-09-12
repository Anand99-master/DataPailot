const { DatabaseSync } = require('node:sqlite');
const fs = require('fs');

const dbFile = 'data/datapilot_demo.sqlite';
if (fs.existsSync(dbFile)) {
  fs.unlinkSync(dbFile);
}

const db = new DatabaseSync(dbFile);

db.exec(`
  CREATE TABLE customers (
    customer_id INTEGER PRIMARY KEY AUTOINCREMENT,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE products (
    product_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    stock_quantity INTEGER NOT NULL
  );
`);

db.exec(`
  CREATE TABLE orders (
    order_id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    FOREIGN KEY(customer_id) REFERENCES customers(customer_id)
  );
`);

db.exec(`
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

const stmtCustomers = db.prepare('INSERT INTO customers (first_name, last_name, email) VALUES (?, ?, ?)');
stmtCustomers.run('Alice', 'Smith', 'alice@example.com');
stmtCustomers.run('Bob', 'Jones', 'bob@example.com');
stmtCustomers.run('Charlie', 'Brown', 'charlie@example.com');

const stmtProducts = db.prepare('INSERT INTO products (name, category, price, stock_quantity) VALUES (?, ?, ?, ?)');
stmtProducts.run('Laptop', 'Electronics', 999.99, 50);
stmtProducts.run('Smartphone', 'Electronics', 599.99, 100);
stmtProducts.run('Desk Chair', 'Furniture', 149.99, 20);

const stmtOrders = db.prepare('INSERT INTO orders (customer_id, status, total_amount) VALUES (?, ?, ?)');
stmtOrders.run(1, 'COMPLETED', 1149.98);
stmtOrders.run(2, 'PENDING', 599.99);

const stmtItems = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)');
stmtItems.run(1, 1, 1, 999.99);
stmtItems.run(1, 3, 1, 149.99);
stmtItems.run(2, 2, 1, 599.99);

db.close();
console.log('Demo SQLite created.');
