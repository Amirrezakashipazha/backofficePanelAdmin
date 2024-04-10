const query = {
  table: {
    admins: {
      create: `
        CREATE TABLE IF NOT EXISTS admins (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(255) NOT NULL,
          password VARCHAR(255) NOT NULL, 
          role VARCHAR(50) DEFAULT 'admin',
          status VARCHAR(255) NOT NULL DEFAULT "active",
          avatar VARCHAR(255) DEFAULT NULL DEFAULT "http://localhost:3000/assets/images/svg/no-avatar.svg", 
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
        `,
      add: `
        INSERT INTO admins (username, password,status,avatar) VALUES (?, ?,?,?)
      `,
      delete: `DELETE FROM admins WHERE id = ?`,
      get: `
        SELECT * FROM admins
      `,
      select: {
        username: `SELECT * FROM admins WHERE username = ?`,
        id: ` SELECT * FROM admins WHERE id = ?`,
      },
    },
    users: {
      create: `
        CREATE TABLE IF NOT EXISTS users (
            id INT AUTO_INCREMENT PRIMARY KEY,
            username VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL UNIQUE,
            password VARCHAR(255) NOT NULL ,
            status VARCHAR(255) NOT NULL,
            avatar VARCHAR(255) DEFAULT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`,
      add: `
        INSERT INTO users (username, email, password, status, avatar) VALUES (?, ?, ?, ?, ?)
      `,
      delete: `DELETE FROM users WHERE id = ?`,
      get: `
        SELECT * FROM users
      `,
      select: {
        email: `SELECT * FROM users WHERE email = ?`,
        id: ` SELECT * FROM users WHERE id = ?`,
      },
    },
    products: {
      create: `
      CREATE TABLE IF NOT EXISTS products (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          category VARCHAR(255) NOT NULL, 
          description VARCHAR(255) ,
          price INT NOT NULL,
          discount INT DEFAULT 0,
          total_price INT NOT NULL,
          status VARCHAR(255) NOT NULL,
          image JSON NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      add: `
      INSERT INTO products (name, category, description, price, discount, total_price, status, image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `,
      get: `
        SELECT * FROM products
      `,
      delete: `DELETE FROM products WHERE id = ?`,
      select: {
        id: ` SELECT * FROM products WHERE id = ?`,
      },
    },
    categories: {
      create: `
      CREATE TABLE IF NOT EXISTS categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL UNIQUE,
          description VARCHAR(255) ,
          status VARCHAR(255) NOT NULL,
          image VARCHAR(255) DEFAULT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      add: `
      INSERT INTO categories (name, description, status, image) VALUES (?, ?, ?, ?)
      `,
      get: `
        SELECT * FROM categories
      `,
      delete: `DELETE FROM categories WHERE id = ?`,
      select: {
        id: ` SELECT * FROM categories WHERE id = ?`,
      },
    },
    orders: {
      create: `
      CREATE TABLE IF NOT EXISTS orders (
          id INT AUTO_INCREMENT PRIMARY KEY,
          user_id INT NOT NULL,
          product_id INT NOT NULL,
          status  VARCHAR(255) NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      get: `
      SELECT * FROM orders
    `,
      delete: `DELETE FROM orders WHERE id = ?`,
      select: {
        id: ` SELECT * FROM orders WHERE id = ?`,
      },
    },
    sale: {
      create: `
      CREATE TABLE IF NOT EXISTS sale (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        product_id INT NOT NULL,
        status  VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
    },
    setting: {
      create: `
      CREATE TABLE IF NOT EXISTS setting (
        id INT AUTO_INCREMENT PRIMARY KEY,
        logo VARCHAR(255) DEFAULT NULL,
        meta_description VARCHAR(255) DEFAULT NULL,
        phone VARCHAR(255) DEFAULT NULL,
        email VARCHAR(255) DEFAULT NULL,
        address VARCHAR(255) DEFAULT NULL,
        icon VARCHAR(255) DEFAULT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,
      add: `
      INSERT INTO setting (logo ,meta_description ,phone ,email ,address,icon) VALUES (?, ?, ?, ?,?,?)
      `,
      get: `
        SELECT * FROM setting
      `,
      delete: `DELETE FROM setting WHERE id = ?`,
      select: {
        id: ` SELECT * FROM setting WHERE id = ?`,
      },
    },
  },
};

export { query };
