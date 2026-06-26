<template>
  <div class="my-reservations">
    <div class="page-header">
      <h2>📋 我的预约</h2>
      <p>查看您预约过的所有图书</p>
    </div>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="当前用户">
          <el-input v-model="filters.userId" placeholder="请输入您的姓名" style="width: 150px" />
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable @change="loadReservations">
            <el-option label="全部" value="" />
            <el-option label="待交换" :value="1" />
            <el-option label="已完成" :value="2" />
            <el-option label="已取消" :value="3" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadReservations" :loading="store.loading">
            <el-icon><Refresh /></el-icon> 查询
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div v-if="!filters.userId" class="user-tip">
      <el-alert type="info" :closable="false" show-icon>
        请在上方输入您的姓名来查看您的预约记录
      </el-alert>
    </div>

    <div v-else class="reservation-list" v-loading="store.loading">
      <div v-if="store.reservations.length === 0 && !store.loading">
        <el-empty description="暂无预约记录" />
      </div>

      <el-card
        v-for="item in store.reservations"
        :key="item.id"
        class="reservation-card"
        shadow="hover"
      >
        <el-row :gutter="20">
          <el-col :span="4">
            <div class="book-cover">
              <img
                v-if="item.book_cover"
                :src="item.book_cover.startsWith('http') ? item.book_cover : item.book_cover"
                :alt="item.book_title"
              />
              <div v-else class="no-cover">
                <el-icon :size="40" color="#c0c4cc"><Reading /></el-icon>
              </div>
            </div>
          </el-col>
          <el-col :span="14">
            <div class="book-info">
              <h3 class="book-title">
                {{ item.book_title }}
                <el-tag :type="item.status_type" size="small" class="status-tag">
                  {{ item.status_text }}
                </el-tag>
              </h3>
              <p class="book-author">作者：{{ item.book_author }}</p>
              <div class="book-meta">
                <el-tag size="small" type="info">{{ item.category }}</el-tag>
                <span class="condition">{{ getConditionLabel(item.book_condition) }}</span>
              </div>
              <div class="owner-info">
                <p><strong>书主：</strong>{{ item.owner_name }}（{{ item.owner_contact }}）</p>
                <p><strong>预约时间：</strong>{{ formatDate(item.created_at) }}</p>
                <p v-if="item.remark"><strong>备注：</strong>{{ item.remark }}</p>
              </div>
            </div>
          </el-col>
          <el-col :span="6" class="action-col">
            <el-button
              v-if="item.status === 1"
              type="danger"
              @click="handleCancel(item)"
              class="cancel-btn"
            >
              <el-icon><Close /></el-icon> 取消预约
            </el-button>
            <el-tag v-else :type="item.status_type" size="large" effect="light">
              {{ item.status_text }}
            </el-tag>
          </el-col>
        </el-row>
      </el-card>

      <div class="pagination" v-if="store.total > 0">
        <el-pagination
          v-model:current-page="filters.page"
          v-model:page-size="filters.pageSize"
          :page-sizes="[5, 10, 20]"
          :total="store.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="loadReservations"
          @current-change="loadReservations"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useReservationStore } from '@/stores/reservation'
import { useBookStore } from '@/stores/book'
import { Refresh, Reading, Close } from '@element-plus/icons-vue'

const store = useReservationStore()
const bookStore = useBookStore()

const filters = ref({
  userId: '',
  status: '',
  page: 1,
  pageSize: 10
})

const loadReservations = async () => {
  if (!filters.value.userId) return
  localStorage.setItem('bookExchange_user', filters.value.userId)
  await store.fetchMyReservations({
    ...filters.value,
    status: filters.value.status !== '' ? filters.value.status : undefined
  })
}

const handleCancel = async (item) => {
  const success = await store.cancelReservation(item.id, item.book_title)
  if (success) {
    loadReservations()
  }
}

const getConditionLabel = (condition) => {
  return bookStore.getConditionLabel(condition)
}

const formatDate = (date) => {
  if (!date) return ''
  return new Date(date).toLocaleString('zh-CN')
}

onMounted(() => {
  const savedUser = localStorage.getItem('bookExchange_user')
  if (savedUser) {
    filters.value.userId = savedUser
    loadReservations()
  }
})
</script>

<style scoped>
.my-reservations {
  padding: 20px 0;
}

.page-header {
  margin-bottom: 24px;
}

.page-header h2 {
  margin: 0 0 8px 0;
  font-size: 28px;
  color: #303133;
}

.page-header p {
  margin: 0;
  color: #909399;
  font-size: 14px;
}

.filter-card {
  margin-bottom: 24px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.user-tip {
  margin-bottom: 24px;
}

.reservation-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.reservation-card {
  transition: all 0.3s ease;
}

.reservation-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.book-cover {
  width: 100%;
  aspect-ratio: 3/4;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-cover {
  opacity: 0.8;
}

.book-info {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.book-title {
  margin: 0 0 8px 0;
  font-size: 20px;
  color: #303133;
  display: flex;
  align-items: center;
  gap: 12px;
}

.status-tag {
  font-weight: 500;
}

.book-author {
  margin: 0 0 12px 0;
  color: #606266;
  font-size: 14px;
}

.book-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.condition {
  font-size: 12px;
  color: #909399;
}

.owner-info {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.owner-info p {
  margin: 4px 0;
  color: #606266;
  font-size: 13px;
}

.action-col {
  display: flex;
  align-items: center;
  justify-content: flex-end;
}

.cancel-btn {
  width: 100%;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 24px;
}
</style>
