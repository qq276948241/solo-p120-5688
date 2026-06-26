const { pool } = require('../config/database')

class ServiceError extends Error {
  constructor(code, message, data = null) {
    super(message)
    this.code = code
    this.data = data
  }
}

const statusMap = {
  1: { text: '待交换', type: 'warning' },
  2: { text: '已完成', type: 'success' },
  3: { text: '已取消', type: 'info' }
}

const reservationService = {
  async createReservation({ book_id, reserver_name, reserver_contact, remark }) {
    if (!book_id || !reserver_name || !reserver_contact) {
      throw new ServiceError(400, '请填写完整信息：图书ID、预约人姓名和联系方式')
    }

    const bookId = parseInt(book_id)
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      const [bookRows] = await connection.execute(
        'SELECT id, title, status, owner_name, owner_contact FROM books WHERE id = ? FOR UPDATE',
        [bookId]
      )

      if (bookRows.length === 0) {
        await connection.rollback()
        throw new ServiceError(404, '图书不存在')
      }

      const book = bookRows[0]

      if (book.status !== 0) {
        await connection.rollback()
        const statusText = book.status === 1 ? '已被预约' : book.status === 2 ? '已完成交换' : '状态异常'
        throw new ServiceError(409, `抱歉，《${book.title}》${statusText}，无法重复预约`, {
          book_status: book.status
        })
      }

      const [existingRows] = await connection.execute(
        'SELECT id, reserver_name FROM reservations WHERE book_id = ? AND status = 1',
        [bookId]
      )

      if (existingRows.length > 0) {
        await connection.rollback()
        throw new ServiceError(409, `抱歉，《${book.title}》已被 ${existingRows[0].reserver_name} 预约，无法重复预约`, {
          book_status: 1,
          reserver_name: existingRows[0].reserver_name
        })
      }

      const [updateResult] = await connection.execute(
        'UPDATE books SET status = 1, updated_at = NOW() WHERE id = ? AND status = 0',
        [bookId]
      )

      if (updateResult.affectedRows === 0) {
        await connection.rollback()
        throw new ServiceError(409, `抱歉，《${book.title}》刚刚已被其他人预约，请刷新页面查看最新状态`, {
          book_status: 1
        })
      }

      const [insertResult] = await connection.execute(
        `INSERT INTO reservations 
         (book_id, reserver_name, reserver_contact, remark, status) 
         VALUES (?, ?, ?, ?, 1)`,
        [bookId, reserver_name, reserver_contact, remark || null]
      )

      await connection.commit()

      return {
        id: insertResult.insertId,
        book_id: bookId,
        book_title: book.title,
        owner_name: book.owner_name,
        owner_contact: book.owner_contact,
        book_status: 1,
        message: `预约《${book.title}》成功！请联系书主 ${book.owner_name}（${book.owner_contact}）完成交换`
      }
    } catch (err) {
      if (connection && err instanceof ServiceError) {
        throw err
      }
      if (connection) {
        await connection.rollback()
      }

      if (err.code === 'ER_DUP_ENTRY' && err.sqlMessage.includes('uk_book_status')) {
        const [bookRows] = await pool.execute(
          'SELECT title, status FROM books WHERE id = ?',
          [bookId]
        )
        const bookTitle = bookRows[0]?.title || '该图书'
        throw new ServiceError(409, `抱歉，《${bookTitle}》已被其他人预约，无法重复预约`, {
          book_status: 1
        })
      }

      console.error('Create reservation service error:', err)
      throw new ServiceError(500, '预约失败，请稍后重试', err.message)
    } finally {
      if (connection) {
        connection.release()
      }
    }
  },

  async getReservationList({ book_id, reserver_name, status, page = 1, pageSize = 10 } = {}) {
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

    if (status !== undefined && status !== '') {
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

    return {
      list,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  },

  async getMyReservations({ userId, status, page = 1, pageSize = 10 } = {}) {
    if (!userId) {
      throw new ServiceError(400, '请提供 userId 参数')
    }

    const whereClauses = ['r.reserver_name = ?']
    const params = [userId]

    if (status !== undefined && status !== '') {
      whereClauses.push('r.status = ?')
      params.push(parseInt(status))
    }

    const whereSql = `WHERE ${whereClauses.join(' AND ')}`

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
        b.book_condition,
        b.category,
        b.owner_name,
        b.owner_contact,
        b.status as book_status
      FROM reservations r
      LEFT JOIN books b ON r.book_id = b.id
      ${whereSql}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `
    const listParams = [...params, parseInt(pageSize), offset]
    const [list] = await pool.execute(listSql, listParams)

    const listWithStatus = list.map(item => ({
      ...item,
      status_text: statusMap[item.status]?.text || '未知',
      status_type: statusMap[item.status]?.type || 'info'
    }))

    return {
      list: listWithStatus,
      total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    }
  },

  async cancelReservation(id) {
    if (!id) {
      throw new ServiceError(400, '请提供预约ID')
    }

    const reservationId = parseInt(id)
    const connection = await pool.getConnection()

    try {
      await connection.beginTransaction()

      const [reservationRows] = await connection.execute(
        'SELECT id, book_id, status FROM reservations WHERE id = ? FOR UPDATE',
        [reservationId]
      )

      if (reservationRows.length === 0) {
        await connection.rollback()
        throw new ServiceError(404, '预约记录不存在')
      }

      const reservation = reservationRows[0]

      if (reservation.status !== 1) {
        await connection.rollback()
        throw new ServiceError(400, '该预约状态不支持取消')
      }

      await connection.execute(
        'UPDATE reservations SET status = 3, updated_at = NOW() WHERE id = ?',
        [reservationId]
      )

      await connection.execute(
        'UPDATE books SET status = 0, updated_at = NOW() WHERE id = ?',
        [reservation.book_id]
      )

      await connection.commit()

      return {
        message: '预约已取消，图书已重新开放预约'
      }
    } catch (err) {
      if (connection && err instanceof ServiceError) {
        throw err
      }
      if (connection) {
        await connection.rollback()
      }
      console.error('Cancel reservation service error:', err)
      throw new ServiceError(500, '取消预约失败', err.message)
    } finally {
      if (connection) {
        connection.release()
      }
    }
  }
}

module.exports = {
  reservationService,
  ServiceError
}
