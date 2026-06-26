const express = require('express')
const router = express.Router()
const reservationController = require('../controllers/reservationController')

router.get('/', reservationController.getList)
router.post('/', reservationController.create)
router.put('/:id/cancel', reservationController.cancel)

module.exports = router
