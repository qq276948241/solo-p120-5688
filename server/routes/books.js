const express = require('express')
const router = express.Router()
const bookController = require('../controllers/bookController')

router.get('/categories', bookController.getCategories)
router.get('/:id', bookController.getDetail)
router.get('/', bookController.getList)
router.post('/', bookController.create)

module.exports = router
