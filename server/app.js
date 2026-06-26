const express = require('express')
const cors = require('cors')
const path = require('path')
require('dotenv').config()

const { initDatabase } = require('./config/database')

const booksRouter = require('./routes/books')
const reservationsRouter = require('./routes/reservations')
const uploadRouter = require('./routes/upload')

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/uploads', express.static(path.join(__dirname, 'uploads')))

app.get('/api/health', (req, res) => {
  res.json({
    code: 200,
    message: 'ok',
    data: {
      timestamp: new Date().toISOString()
    }
  })
})

app.use('/api/books', booksRouter)
app.use('/api/reservations', reservationsRouter)
app.use('/api/upload', uploadRouter)

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err)
  res.status(500).json({
    code: 500,
    message: '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  })
})

app.use((req, res) => {
  res.status(404).json({
    code: 404,
    message: '接口不存在'
  })
})

async function startServer() {
  try {
    await initDatabase()
    app.listen(PORT, () => {
      console.log(`🚀 Server is running on http://localhost:${PORT}`)
      console.log(`📚 Book Exchange API is ready`)
    })
  } catch (err) {
    console.error('Failed to start server:', err)
    process.exit(1)
  }
}

startServer()
