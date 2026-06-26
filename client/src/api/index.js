import axios from 'axios'

const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

export const bookAPI = {
  getList(params) {
    return request.get('/books', { params })
  },
  getDetail(id) {
    return request.get(`/books/${id}`)
  },
  create(data) {
    return request.post('/books', data)
  },
  getCategories() {
    return request.get('/books/categories')
  }
}

export const reservationAPI = {
  create(data) {
    return request.post('/reservations', data)
  },
  getMine(params) {
    return request.get('/reservations/mine', { params })
  },
  cancel(id) {
    return request.put(`/reservations/${id}/cancel`)
  }
}

export const uploadAPI = {
  uploadImage(file) {
    const formData = new FormData()
    formData.append('image', file)
    return request.post('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
}

export default request
