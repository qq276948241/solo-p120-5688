const mysql = require('mysql2/promise')
require('dotenv').config()

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+08:00'
})

async function initDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD
    })

    await connection.execute(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`)
    await connection.end()

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS books (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        author VARCHAR(255) NOT NULL,
        category VARCHAR(100) NOT NULL,
        book_condition TINYINT NOT NULL COMMENT '1-全新, 2-九成新, 3-八成新, 4-七成新, 5-六成新及以下',
        cover_image VARCHAR(500),
        status TINYINT DEFAULT 0 COMMENT '0-可预约, 1-已预约, 2-已完成',
        publisher VARCHAR(255),
        description TEXT,
        owner_name VARCHAR(100) NOT NULL,
        owner_contact VARCHAR(200) NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_category (category),
        INDEX idx_condition (book_condition),
        INDEX idx_status (status),
        INDEX idx_created_at (created_at)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS reservations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT NOT NULL,
        reserver_name VARCHAR(100) NOT NULL,
        reserver_contact VARCHAR(200) NOT NULL,
        remark TEXT,
        status TINYINT DEFAULT 1 COMMENT '1-预约中, 2-已完成, 3-已取消',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_book_status (book_id, status),
        INDEX idx_book_id (book_id),
        INDEX idx_reserver (reserver_name),
        FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `)

    console.log('Database initialized successfully')
  } catch (err) {
    console.error('Database initialization failed:', err)
    throw err
  }
}

module.exports = { pool, initDatabase }
