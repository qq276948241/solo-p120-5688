import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { reservationAPI } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'

export const useReservationStore = defineStore('reservation', () => {
  const reservations = ref([])
  const total = ref(0)
  const loading = ref(false)

  const pendingCount = computed(() => 
    reservations.value.filter(r => r.status === 1).length
  )

  const fetchMyReservations = async (params = {}) => {
    loading.value = true
    try {
      const res = await reservationAPI.getMine(params)
      reservations.value = res.data.data.list
      total.value = res.data.data.total
      return res.data.data
    } catch (e) {
      ElMessage.error(e.response?.data?.message || '获取预约列表失败')
      throw e
    } finally {
      loading.value = false
    }
  }

  const cancelReservation = async (id, bookTitle) => {
    try {
      await ElMessageBox.confirm(
        `确定要取消《${bookTitle}》的预约吗？`,
        '取消预约',
        {
          confirmButtonText: '确定取消',
          cancelButtonText: '再想想',
          type: 'warning'
        }
      )

      await reservationAPI.cancel(id)
      ElMessage.success('预约已取消')

      const index = reservations.value.findIndex(r => r.id === id)
      if (index !== -1) {
        reservations.value[index].status = 3
        reservations.value[index].status_text = '已取消'
        reservations.value[index].status_type = 'info'
      }

      return true
    } catch (e) {
      if (e !== 'cancel') {
        ElMessage.error(e.response?.data?.message || '取消失败')
      }
      return false
    }
  }

  return {
    reservations,
    total,
    loading,
    pendingCount,
    fetchMyReservations,
    cancelReservation
  }
})
