const { pool } = require('../config/database')

const bookController = {
  async getList(req, res) {
    try {
      const {
        category,
        condition,
        status,
        page = 1,
        pageSize = 10,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = req.query

      const whereClauses = []
      const params = []

      if (category) {
        whereClauses.push('category = ?')
        params.push(category)
      }

      if (condition) {
        whereClauses.push('book_condition = ?')
        params.push(parseInt(condition))
      }

      if (status !== undefined) {
        whereClauses.push('status = ?')
        params.push(parseInt(status))
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const validSortColumns = ['created_at', 'book_condition', 'title']
      const validSortOrders = ['asc', 'desc']
      const actualSortBy = validSortColumns.includes(sortBy) ? sortBy : 'created_at'
      const actualSortOrder = validSortOrders.includes(sortOrder.toLowerCase()) ? sortOrder.toLowerCase() : 'desc'

      const countSql = `SELECT COUNT(*) as total FROM books ${whereSql}`
      const [countResult] = await pool.execute(countSql, params)
      const total = countResult[0].total

      const offset = (page - 1) * pageSize
      const listSql = `
        SELECT 
          id, title, author, category, book_condition, 
          cover_image, status, description, owner_name,
          created_at, updated_at
        FROM books 
        ${whereSql}
        ORDER BY ${actualSortBy} ${actualSortOrder}
        LIMIT ? OFFSET ?
      `
      const listParams = [...params, parseInt(pageSize), offset]
      const [list] = await pool.execute(listSql, listParams)

      res.json({
        code: 200,
        message: 'success',
        data: {
          list,
          total,
          page: parseInt(page),
          pageSize: parseInt(pageSize)
        }
      })
    } catch (err) {
      console.error('Get book list error:', err)
      res.status(500).json({
        code: 500,
        message: '获取图书列表失败',
        error: err.message
      })
    }
  },

  async getDetail(req, res) {
    try {
      const { id } = req.params
      const sql = `
        SELECT 
          b.*,
          r.id as reservation_id,
          r.reserver_name,
          r.reserver_contact,
          r.remark as reservation_remark,
          r.created_at as reservation_time
        FROM books b
        LEFT JOIN reservations r ON b.id = r.book_id AND r.status = 1
        WHERE b.id = ?
      `
      const [rows] = await pool.execute(sql, [id])

      if (rows.length === 0) {
        return res.status(404).json({
          code: 404,
          message: '图书不存在'
        })
      }

      const book = rows[0]
      const result = {
        id: book.id,
        title: book.title,
        author: book.author,
        category: book.category,
        book_condition: book.book_condition,
        cover_image: book.cover_image,
        status: book.status,
        publisher: book.publisher,
        description: book.description,
        owner_name: book.owner_name,
        owner_contact: book.owner_contact,
        created_at: book.created_at,
        updated_at: book.updated_at,
        reservation: book.reservation_id ? {
          id: book.reservation_id,
          reserver_name: book.reserver_name,
          reserver_contact: book.reserver_contact,
          remark: book.reservation_remark,
          created_at: book.reservation_time
        } : null
      }

      res.json({
        code: 200,
        message: 'success',
        data: result
      })
    } catch (err) {
      console.error('Get book detail error:', err)
      res.status(500).json({
        code: 500,
        message: '获取图书详情失败',
        error: err.message
      })
    }
  },

  async create(req, res) {
    try {
      const {
        title,
        author,
        category,
        book_condition,
        cover_image,
        publisher,
        description,
        owner_name,
        owner_contact
      } = req.body

      if (!title || !author || !category || !book_condition || !owner_name || !owner_contact) {
        return res.status(400).json({
          code: 400,
          message: '请填写完整信息：书名、作者、分类、新旧程度、发布人姓名和联系方式'
        })
      }

      const condition = parseInt(book_condition)
      if (condition < 1 || condition > 5) {
        return res.status(400).json({
          code: 400,
          message: '新旧程度值无效，范围为1-5'
        })
      }

      const sql = `
        INSERT INTO books 
        (title, author, category, book_condition, cover_image, publisher, description, owner_name, owner_contact)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
      const params = [
        title,
        author,
        category,
        condition,
        cover_image || null,
        publisher || null,
        description || null,
        owner_name,
        owner_contact
      ]

      const [result] = await pool.execute(sql, params)

      res.json({
        code: 200,
        message: '发布成功',
        data: {
          id: result.insertId
        }
      })
    } catch (err) {
      console.error('Create book error:', err)
      res.status(500).json({
        code: 500,
        message: '发布图书失败',
        error: err.message
      })
    }
  },

  async getCategories(req, res) {
    try {
      const sql = `SELECT DISTINCT category FROM books ORDER BY category`
      const [rows] = await pool.execute(sql)
      const categories = rows.map(row => row.category)

      const defaultCategories = ['文学', '科技', '历史', '哲学', '艺术', '教育', '生活', '其他']
      const mergedCategories = [...new Set([...categories, ...defaultCategories])]

      res.json({
        code: 200,
        message: 'success',
        data: mergedCategories
      })
    } catch (err) {
      console.error('Get categories error:', err)
      res.status(500).json({
        code: 500,
        message: '获取分类失败',
        error: err.message
      })
    }
  }
}

module.exports = bookController
