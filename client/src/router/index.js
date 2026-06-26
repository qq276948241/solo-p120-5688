import { createRouter, createWebHistory } from 'vue-router'
import BookList from '@/views/BookList.vue'
import BookDetail from '@/views/BookDetail.vue'
import BookPublish from '@/views/BookPublish.vue'

const routes = [
  {
    path: '/',
    name: 'BookList',
    component: BookList
  },
  {
    path: '/book/:id',
    name: 'BookDetail',
    component: BookDetail
  },
  {
    path: '/publish',
    name: 'BookPublish',
    component: BookPublish
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
