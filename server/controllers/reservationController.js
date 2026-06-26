const { reservationService, ServiceError } = require('../services/reservationService')

function handleServiceError(err, res) {
  if (err instanceof ServiceError) {
    const response = {
      code: err.code,
      message: err.message
    }
    if (err.data !== null && err.data !== undefined && typeof err.data !== 'string') {
      response.data = err.data
    } else if (typeof err.data === 'string' && err.code === 500) {
      response.error = err.data
    }
    return res.status(err.code >= 400 && err.code < 600 ? err.code : 500).json(response)
  }
  console.error('Unexpected error:', err)
  return res.status(500).json({
    code: 500,
    message: '服务器内部错误'
  })
}

const reservationController = {
  async create(req, res) {
    try {
      const result = await reservationService.createReservation(req.body)
      res.json({
        code: 200,
        message: result.message,
        data: {
          id: result.id,
          book_id: result.book_id,
          book_title: result.book_title,
          owner_name: result.owner_name,
          owner_contact: result.owner_contact,
          book_status: result.book_status
        }
      })
    } catch (err) {
      handleServiceError(err, res)
    }
  },

  async getList(req, res) {
    try {
      const result = await reservationService.getReservationList(req.query)
      res.json({
        code: 200,
        message: 'success',
        data: result
      })
    } catch (err) {
      handleServiceError(err, res)
    }
  },

  async getMine(req, res) {
    try {
      const result = await reservationService.getMyReservations(req.query)
      res.json({
        code: 200,
        message: 'success',
        data: result
      })
    } catch (err) {
      handleServiceError(err, res)
    }
  },

  async cancel(req, res) {
    try {
      const result = await reservationService.cancelReservation(req.params.id)
      res.json({
        code: 200,
        message: result.message
      })
    } catch (err) {
      handleServiceError(err, res)
    }
  }
}

module.exports = reservationController
