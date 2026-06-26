const { pool } = require('../config/database')

const reservationController = {
  async create(req, res) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      const {
        book_id,
        reserver_name,
        reserver_contact,
        remark
      } = req.body

      if (!book_id || !reserver_name || !reserver_contact) {
        await connection.rollback()
        return res.status(400).json({
          code: 400,
          message: '请填写完整信息：图书ID、预约人姓名和联系方式'
        })
      }

      const bookId = parseInt(book_id)

      const [bookRows] = await connection.execute(
        'SELECT id, title, status, owner_name, owner_contact FROM books WHERE id = ? FOR UPDATE',
        [bookId]
      )

      if (bookRows.length === 0) {
        await connection.rollback()
        return res.status(404).json({
          code: 404,
          message: '图书不存在'
        })
      }

      const book = bookRows[0]

      if (book.status !== 0) {
        await connection.rollback()
        const statusText = book.status === 1 ? '已被预约' : book.status === 2 ? '已完成交换' : '状态异常'
        return res.status(409).json({
          code: 409,
          message: `抱歉，《${book.title}》${statusText}，无法重复预约`,
          data: {
            book_status: book.status
          }
        })
      }

      const [existingRows] = await connection.execute(
        'SELECT id, reserver_name FROM reservations WHERE book_id = ? AND status = 1',
        [bookId]
      )

      if (existingRows.length > 0) {
        await connection.rollback()
        return res.status(409).json({
          code: 409,
          message: `抱歉，《${book.title}》已被 ${existingRows[0].reserver_name} 预约，无法重复预约`,
          data: {
            book_status: 1,
            reserver_name: existingRows[0].reserver_name
          }
        })
      }

      const [updateResult] = await connection.execute(
        'UPDATE books SET status = 1, updated_at = NOW() WHERE id = ? AND status = 0',
        [bookId]
      )

      if (updateResult.affectedRows === 0) {
        await connection.rollback()
        return res.status(409).json({
          code: 409,
          message: `抱歉，《${book.title}》刚刚已被其他人预约，请刷新页面查看最新状态`,
          data: {
            book_status: 1
          }
        })
      }

      const [insertResult] = await connection.execute(
        `INSERT INTO reservations 
         (book_id, reserver_name, reserver_contact, remark, status) 
         VALUES (?, ?, ?, ?, 1)`,
        [bookId, reserver_name, reserver_contact, remark || null]
      )

      await connection.commit()

      res.json({
        code: 200,
        message: `预约《${book.title}》成功！请联系书主 ${book.owner_name}（${book.owner_contact}）完成交换`,
        data: {
          id: insertResult.insertId,
          book_id: bookId,
          book_title: book.title,
          owner_name: book.owner_name,
          owner_contact: book.owner_contact,
          book_status: 1
        }
      })
    } catch (err) {
      await connection.rollback()
      console.error('Create reservation error:', err)

      if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage.includes('uk_book_status')) {
        const { book_id } = req.body
        const [bookRows] = await pool.execute(
          'SELECT title, status FROM books WHERE id = ?',
          [parseInt(book_id)]
        )
        const bookTitle = bookRows[0]?.title || '该图书'

        return res.status(409).json({
          code: 409,
          message: `抱歉，《${bookTitle}》已被其他人预约，无法重复预约`,
          data: {
            book_status: 1
          }
        })
      }

      res.status(500).json({
        code: 500,
        message: '预约失败，请稍后重试',
        error: err.message
      })
    } finally {
      connection.release()
    }
  },

  async getList(req, res) {
    try {
      const {
        book_id,
        reserver_name,
        status,
        page = 1,
        pageSize = 10
      } = req.query

      const whereClauses = []
      const params = []

      if (book_id) {
        whereClauses.push('r.book_id = ?')
        params.push(parseInt(book_id))
      }

      if (reserver_name) {
        whereClauses.push('r.reserver_name LIKE ?')
        params.push(`%${reserver_name}%`)
      }

      if (status !== undefined) {
        whereClauses.push('r.status = ?')
        params.push(parseInt(status))
      }

      const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : ''

      const countSql = `SELECT COUNT(*) as total FROM reservations r ${whereSql}`
      const [countResult] = await pool.execute(countSql, params)
      const total = countResult[0].total

      const offset = (page - 1) * pageSize
      const listSql = `
        SELECT 
          r.*,
          b.title as book_title,
          b.author as book_author,
          b.cover_image as book_cover,
          b.owner_name,
          b.owner_contact
        FROM reservations r
        LEFT JOIN books b ON r.book_id = b.id
        ${whereSql}
        ORDER BY r.created_at DESC
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
      console.error('Get reservation list error:', err)
      res.status(500).json({
        code: 500,
        message: '获取预约列表失败',
        error: err.message
      })
    }
  },

  async cancel(req, res) {
    const connection = await pool.getConnection()
    try {
      await connection.beginTransaction()

      const { id } = req.params

      const [reservationRows] = await connection.execute(
        'SELECT id, book_id, status FROM reservations WHERE id = ? FOR UPDATE',
        [parseInt(id)]
      )

      if (reservationRows.length === 0) {
        await connection.rollback()
        return res.status(404).json({
          code: 404,
          message: '预约记录不存在'
        })
      }

      const reservation = reservationRows[0]

      if (reservation.status !== 1) {
        await connection.rollback()
        return res.status(400).json({
          code: 400,
          message: '该预约状态不支持取消'
        })
      }

      await connection.execute(
        'UPDATE reservations SET status = 3, updated_at = NOW() WHERE id = ?',
        [parseInt(id)]
      )

      await connection.execute(
        'UPDATE books SET status = 0, updated_at = NOW() WHERE id = ?',
        [reservation.book_id]
      )

      await connection.commit()

      res.json({
        code: 200,
        message: '预约已取消，图书已重新开放预约'
      })
    } catch (err) {
      await connection.rollback()
      console.error('Cancel reservation error:', err)
      res.status(500).json({
        code: 500,
        message: '取消预约失败',
        error: err.message
      })
    } finally {
      connection.release()
    }
  }
}

module.exports = reservationController
