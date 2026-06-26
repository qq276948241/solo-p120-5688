<template>
  <div class="book-detail" v-loading="bookStore.loading">
    <div v-if="book" class="detail-container">
      <el-button @click="goBack" class="back-btn">
        <el-icon><ArrowLeft /></el-icon> 返回列表
      </el-button>

      <el-row :gutter="40">
        <el-col :span="8">
          <div class="book-cover-large">
            <img
              v-if="book.cover_image"
              :src="book.cover_image.startsWith('http') ? book.cover_image : book.cover_image"
              :alt="book.title"
            />
            <div v-else class="no-cover-large">
              <el-icon :size="120" color="#fff"><Reading /></el-icon>
              <span>暂无封面</span>
            </div>
          </div>
          <div class="status-badge" :class="getStatusClass(book.status)">
            {{ getStatusText(book.status) }}
          </div>
        </el-col>

        <el-col :span="16">
          <div class="book-header">
            <h1 class="book-title">{{ book.title }}</h1>
            <div class="book-tags">
              <el-tag type="info" size="large">{{ book.category }}</el-tag>
              <el-tag type="warning" size="large">{{ bookStore.getConditionLabel(book.book_condition) }}</el-tag>
              <el-tag :type="book.status === 0 ? 'success' : 'danger'" size="large">
                {{ getStatusText(book.status) }}
              </el-tag>
            </div>
          </div>

          <el-descriptions :column="2" border class="book-info">
            <el-descriptions-item label="作者">
              {{ book.author }}
            </el-descriptions-item>
            <el-descriptions-item label="出版社">
              {{ book.publisher || '未知' }}
            </el-descriptions-item>
            <el-descriptions-item label="发布人">
              {{ book.owner_name }}
            </el-descriptions-item>
            <el-descriptions-item label="联系方式">
              {{ book.owner_contact }}
            </el-descriptions-item>
            <el-descriptions-item label="发布时间">
              {{ formatDate(book.created_at) }}
            </el-descriptions-item>
            <el-descriptions-item label="更新时间">
              {{ formatDate(book.updated_at) }}
            </el-descriptions-item>
          </el-descriptions>

          <div v-if="book.description" class="book-description">
            <h3>📖 图书简介</h3>
            <p>{{ book.description }}</p>
          </div>

          <div v-if="book.reservation" class="reservation-info">
            <el-alert
              title="该图书已被预约"
              type="warning"
              :closable="false"
              show-icon
            >
              <template #default>
                <p>预约人：{{ book.reservation.reserver_name }}</p>
                <p>预约时间：{{ formatDate(book.reservation.created_at) }}</p>
                <p v-if="book.reservation.remark">备注：{{ book.reservation.remark }}</p>
              </template>
            </el-alert>
          </div>

          <div v-if="book.status === 0" class="reservation-section">
            <h3>🎯 预约这本书</h3>
            <el-form :model="reservationForm" :rules="rules" ref="formRef" label-width="100px">
              <el-form-item label="您的姓名" prop="reserver_name">
                <el-input v-model="reservationForm.reserver_name" placeholder="请输入您的姓名" />
              </el-form-item>
              <el-form-item label="联系方式" prop="reserver_contact">
                <el-input v-model="reservationForm.reserver_contact" placeholder="请输入手机号或微信号" />
              </el-form-item>
              <el-form-item label="备注">
                <el-input
                  v-model="reservationForm.remark"
                  type="textarea"
                  :rows="3"
                  placeholder="可以留言给书主，比如预约交换时间等（选填）"
                />
              </el-form-item>
              <el-form-item>
                <el-button
                  type="primary"
                  size="large"
                  @click="submitReservation"
                  :loading="submitting"
                >
                  <el-icon><Check /></el-icon> 确认预约
                </el-button>
              </el-form-item>
            </el-form>
          </div>

          <div v-else class="reserved-tip">
            <el-alert
              title="抱歉，这本书已经被预约了"
              type="info"
              :closable="false"
              show-icon
            >
              <template #default>
                <p>可以看看其他图书，或者稍后再来看看是否有人取消预约。</p>
                <el-button type="primary" @click="goBack" style="margin-top: 12px;">
                  浏览其他图书
                </el-button>
              </template>
            </el-alert>
          </div>
        </el-col>
      </el-row>
    </div>

    <el-empty v-else-if="!book && !bookStore.loading" description="图书不存在" />
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBookStore } from '@/stores/book'
import { reservationAPI } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft, Reading, Check } from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const bookStore = useBookStore()

const book = ref(null)
const submitting = ref(false)
const formRef = ref()

const reservationForm = ref({
  book_id: parseInt(route.params.id),
  reserver_name: '',
  reserver_contact: '',
  remark: ''
})

const rules = {
  reserver_name: [
    { required: true, message: '请输入您的姓名', trigger: 'blur' }
  ],
  reserver_contact: [
    { required: true, message: '请输入您的联系方式', trigger: 'blur' }
  ]
}

const loadBookDetail = async () => {
  try {
    const id = parseInt(route.params.id)
    const data = await bookStore.fetchBookDetail(id)
    book.value = data
  } catch (e) {
    if (e.response?.status === 404) {
      ElMessage.error('图书不存在')
    } else {
      ElMessage.error('加载图书详情失败')
    }
  }
}

const submitReservation = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    try {
      await ElMessageBox.confirm(
        `确认要预约《${book.value.title}》吗？\n\n预约成功后，请及时联系书主 ${book.value.owner_name}（${book.value.owner_contact}）完成交换。`,
        '确认预约',
        {
          confirmButtonText: '确认预约',
          cancelButtonText: '再想想',
          type: 'info'
        }
      )

      submitting.value = true
      const res = await reservationAPI.create(reservationForm.value)

      ElMessage.success(res.data.message)

      book.value.status = 1
      book.value.reservation = {
        reserver_name: reservationForm.value.reserver_name,
        reserver_contact: reservationForm.value.reserver_contact,
        remark: reservationForm.value.remark,
        created_at: new Date().toISOString()
      }

      ElMessageBox.alert(
        `预约成功！\n\n请联系书主 ${book.value.owner_name}（${book.value.owner_contact}）完成交换。\n\n温馨提示：请文明交流，按时赴约。`,
        '预约成功',
        {
          confirmButtonText: '知道了',
          type: 'success'
        }
      )
    } catch (e) {
      if (e === 'cancel') return

      if (e.response?.status === 409) {
        ElMessage.error(e.response.data.message)
        loadBookDetail()
      } else {
        ElMessage.error(e.response?.data?.message || '预约失败，请稍后重试')
      }
    } finally {
      submitting.value = false
    }
  })
}

const goBack = () => {
  router.push('/')
}

const getStatusText = (status) => {
  const map = { 0: '可预约', 1: '已预约', 2: '已完成' }
  return map[status] || '未知'
}

const getStatusClass = (status) => {
  return status === 0 ? 'status-available' : 'status-reserved'
}

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  loadBookDetail()
})
</script>

<style scoped>
.book-detail {
  padding: 20px 0;
}

.detail-container {
  max-width: 1200px;
  margin: 0 auto;
}

.back-btn {
  margin-bottom: 24px;
}

.book-cover-large {
  width: 100%;
  aspect-ratio: 3/4;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  position: relative;
}

.book-cover-large img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-cover-large {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
  opacity: 0.8;
}

.no-cover-large span {
  margin-top: 16px;
  font-size: 16px;
}

.status-badge {
  position: absolute;
  top: 16px;
  right: 16px;
  padding: 8px 20px;
  border-radius: 24px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}

.status-available {
  background: #67c23a;
}

.status-reserved {
  background: #f56c6c;
}

.book-header {
  margin-bottom: 24px;
}

.book-title {
  margin: 0 0 16px 0;
  font-size: 32px;
  color: #303133;
}

.book-tags {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}

.book-info {
  margin-bottom: 32px;
}

.book-description {
  margin-bottom: 32px;
}

.book-description h3 {
  margin: 0 0 12px 0;
  font-size: 18px;
  color: #303133;
}

.book-description p {
  margin: 0;
  line-height: 1.8;
  color: #606266;
  font-size: 15px;
  background: #f5f7fa;
  padding: 20px;
  border-radius: 8px;
}

.reservation-info {
  margin-bottom: 32px;
}

.reservation-section {
  background: #f5f7fa;
  padding: 24px;
  border-radius: 12px;
}

.reservation-section h3 {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #303133;
}

.reserved-tip {
  margin-top: 24px;
}
</style>
