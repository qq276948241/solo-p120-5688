import { createRouter, createWebHistory } from 'vue-router'
import BookList from '@/views/BookList.vue'
import BookDetail from '@/views/BookDetail.vue'
import BookPublish from '@/views/BookPublish.vue'
import MyReservations from '@/views/MyReservations.vue'

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
  },
  {
    path: '/my-reservations',
    name: 'MyReservations',
    component: MyReservations
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
