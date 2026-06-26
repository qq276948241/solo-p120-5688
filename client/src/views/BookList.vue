<template>
  <div class="book-list">
    <div class="page-header">
      <h2>📚 图书列表</h2>
      <p>与邻居分享好书，让知识流动起来</p>
    </div>

    <el-card class="filter-card">
      <el-form :inline="true" :model="filters" class="filter-form">
        <el-form-item label="分类">
          <el-select v-model="filters.category" placeholder="全部分类" clearable @change="handleFilterChange">
            <el-option label="全部分类" value="" />
            <el-option
              v-for="cat in bookStore.categories"
              :key="cat"
              :label="cat"
              :value="cat"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="新旧程度">
          <el-select v-model="filters.condition" placeholder="全部" clearable @change="handleFilterChange">
            <el-option label="全部" value="" />
            <el-option
              v-for="item in bookStore.conditionOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="状态">
          <el-select v-model="filters.status" placeholder="全部" clearable @change="handleFilterChange">
            <el-option label="全部" value="" />
            <el-option label="可预约" :value="0" />
            <el-option label="已预约" :value="1" />
          </el-select>
        </el-form-item>
        <el-form-item label="排序">
          <el-select v-model="filters.sortBy" @change="handleFilterChange">
            <el-option label="最新发布" value="created_at" />
            <el-option label="最新的书" value="book_condition" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="loadBooks" :loading="bookStore.loading">
            <el-icon><Refresh /></el-icon> 刷新
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <div class="book-grid" v-loading="bookStore.loading">
      <el-card
        v-for="book in bookStore.books"
        :key="book.id"
        class="book-card"
        shadow="hover"
        @click="goToDetail(book.id)"
      >
        <div class="book-cover">
          <img
            v-if="book.cover_image"
            :src="book.cover_image.startsWith('http') ? book.cover_image : book.cover_image"
            :alt="book.title"
          />
          <div v-else class="no-cover">
            <el-icon :size="60" color="#c0c4cc"><Reading /></el-icon>
            <span>暂无封面</span>
          </div>
          <div class="book-status" :class="getStatusClass(book.status)">
            {{ getStatusText(book.status) }}
          </div>
          <div class="book-condition">
            {{ bookStore.getConditionLabel(book.book_condition) }}
          </div>
        </div>
        <div class="book-info">
          <h3 class="book-title">{{ book.title }}</h3>
          <p class="book-author">作者：{{ book.author }}</p>
          <div class="book-meta">
            <el-tag size="small" type="info">{{ book.category }}</el-tag>
            <span class="owner">书主：{{ book.owner_name }}</span>
          </div>
          <p v-if="book.description" class="book-desc">{{ book.description }}</p>
          <div class="book-footer">
            <span class="publish-time">{{ formatDate(book.created_at) }}</span>
            <el-button type="primary" size="small" @click.stop="goToDetail(book.id)">
              {{ book.status === 0 ? '立即预约' : '查看详情' }}
            </el-button>
          </div>
        </div>
      </el-card>

      <el-empty v-if="!bookStore.loading && bookStore.books.length === 0" description="暂无图书，快去发布一本吧！" />
    </div>

    <div class="pagination" v-if="bookStore.total > 0">
      <el-pagination
        v-model:current-page="filters.page"
        v-model:page-size="filters.pageSize"
        :page-sizes="[12, 24, 48]"
        :total="bookStore.total"
        layout="total, sizes, prev, pager, next, jumper"
        @size-change="handleFilterChange"
        @current-change="handleFilterChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookStore } from '@/stores/book'
import { ElMessage } from 'element-plus'
import { Refresh, Reading } from '@element-plus/icons-vue'

const router = useRouter()
const bookStore = useBookStore()

const filters = ref({
  category: '',
  condition: '',
  status: '',
  sortBy: 'created_at',
  sortOrder: 'desc',
  page: 1,
  pageSize: 12
})

const loadBooks = async () => {
  try {
    await bookStore.fetchBooks({
      ...filters.value,
      condition: filters.value.condition || undefined,
      status: filters.value.status !== '' ? filters.value.status : undefined,
      category: filters.value.category || undefined
    })
  } catch (e) {
    ElMessage.error('加载图书列表失败')
  }
}

const handleFilterChange = () => {
  filters.value.page = 1
  loadBooks()
}

const goToDetail = (id) => {
  router.push(`/book/${id}`)
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
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分钟前`
  if (hours < 24) return `${hours}小时前`
  if (days < 7) return `${days}天前`
  return d.toLocaleDateString('zh-CN')
}

onMounted(() => {
  bookStore.fetchCategories()
  loadBooks()
})
</script>

<style scoped>
.book-list {
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

.filter-form {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
}

.filter-form :deep(.el-form-item) {
  margin-bottom: 0;
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 24px;
}

.book-card {
  cursor: pointer;
  transition: all 0.3s ease;
  overflow: hidden;
}

.book-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.book-cover {
  position: relative;
  width: 100%;
  height: 200px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.no-cover {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #fff;
  opacity: 0.8;
}

.no-cover span {
  margin-top: 8px;
  font-size: 14px;
}

.book-status {
  position: absolute;
  top: 12px;
  left: 12px;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
}

.status-available {
  background: #67c23a;
}

.status-reserved {
  background: #f56c6c;
}

.book-condition {
  position: absolute;
  top: 12px;
  right: 12px;
  padding: 4px 12px;
  background: rgba(0, 0, 0, 0.6);
  border-radius: 20px;
  font-size: 12px;
  color: #fff;
}

.book-info {
  padding: 16px;
}

.book-title {
  margin: 0 0 8px 0;
  font-size: 18px;
  color: #303133;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.book-author {
  margin: 0 0 12px 0;
  color: #606266;
  font-size: 14px;
}

.book-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.owner {
  font-size: 12px;
  color: #909399;
}

.book-desc {
  margin: 0 0 16px 0;
  color: #606266;
  font-size: 13px;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.book-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 12px;
  border-top: 1px solid #ebeef5;
}

.publish-time {
  font-size: 12px;
  color: #c0c4cc;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 32px;
}
</style>
