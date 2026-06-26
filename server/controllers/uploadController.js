const multer = require('multer')
const path = require('path')
const fs = require('fs')
require('dotenv').config()

const uploadDir = process.env.UPLOAD_DIR || './uploads'
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true })
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    const ext = path.extname(file.originalname)
    cb(null, `cover-${uniqueSuffix}${ext}`)
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (extname && mimetype) {
    return cb(null, true)
  } else {
    cb(new Error('只允许上传图片文件（JPG、PNG、GIF、WEBP）'))
  }
}

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024
  }
})

const uploadController = {
  uploadImage: (req, res) => {
    const uploadSingle = upload.single('image')
    uploadSingle(req, res, (err) => {
      if (err) {
        return res.status(400).json({
          code: 400,
          message: err.message || '上传失败'
        })
      }

      if (!req.file) {
        return res.status(400).json({
          code: 400,
          message: '请选择要上传的图片'
        })
      }

      const imageUrl = `/uploads/${req.file.filename}`
      res.json({
        code: 200,
        message: '上传成功',
        data: {
          url: imageUrl,
          filename: req.file.filename,
          size: req.file.size
        }
      })
    })
  }
}

module.exports = uploadController
