import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { bookAPI } from '@/api'

export const useBookStore = defineStore('book', () => {
  const books = ref([])
  const total = ref(0)
  const loading = ref(false)
  const currentBook = ref(null)
  const categories = ref([])

  const conditionOptions = [
    { value: 1, label: '全新' },
    { value: 2, label: '九成新' },
    { value: 3, label: '八成新' },
    { value: 4, label: '七成新' },
    { value: 5, label: '六成新及以下' }
  ]

  const getConditionLabel = (condition) => {
    const item = conditionOptions.find(c => c.value === condition)
    return item ? item.label : '未知'
  }

  const fetchBooks = async (params = {}) => {
    loading.value = true
    try {
      const res = await bookAPI.getList(params)
      books.value = res.data.data.list
      total.value = res.data.data.total
    } finally {
      loading.value = false
    }
  }

  const fetchBookDetail = async (id) => {
    loading.value = true
    try {
      const res = await bookAPI.getDetail(id)
      currentBook.value = res.data.data
      return res.data.data
    } finally {
      loading.value = false
    }
  }

  const fetchCategories = async () => {
    try {
      const res = await bookAPI.getCategories()
      categories.value = res.data.data
    } catch (e) {
      categories.value = ['文学', '科技', '历史', '哲学', '艺术', '教育', '生活', '其他']
    }
  }

  const createBook = async (data) => {
    const res = await bookAPI.create(data)
    return res.data.data
  }

  return {
    books,
    total,
    loading,
    currentBook,
    categories,
    conditionOptions,
    getConditionLabel,
    fetchBooks,
    fetchBookDetail,
    fetchCategories,
    createBook
  }
})
