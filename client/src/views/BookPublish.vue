<template>
  <div class="book-publish">
    <div class="page-header">
      <h2>📖 发布图书</h2>
      <p>分享您的好书，让邻居们也能阅读</p>
    </div>

    <el-card class="form-card">
      <el-form
        :model="formData"
        :rules="rules"
        ref="formRef"
        label-width="120px"
        class="publish-form"
      >
        <el-row :gutter="40">
          <el-col :span="8">
            <div class="cover-upload-section">
              <h3 class="section-title">图书封面</h3>
              <div class="cover-uploader">
                <el-upload
                  class="cover-upload"
                  drag
                  :action="uploadUrl"
                  :show-file-list="false"
                  :on-success="handleUploadSuccess"
                  :on-error="handleUploadError"
                  :before-upload="beforeUpload"
                  accept="image/*"
                  :headers="uploadHeaders"
                >
                  <img v-if="formData.cover_image" :src="formData.cover_image" class="cover-preview" />
                  <div v-else class="upload-placeholder">
                    <el-icon class="upload-icon" :size="60"><Plus /></el-icon>
                    <div class="upload-text">点击或拖拽上传封面</div>
                    <div class="upload-hint">支持 JPG、PNG、GIF，不超过 5MB</div>
                  </div>
                </el-upload>
              </div>
              <el-button
                v-if="formData.cover_image"
                type="danger"
                text
                @click="clearCover"
                class="clear-cover-btn"
              >
                删除封面
              </el-button>
            </div>
          </el-col>

          <el-col :span="16">
            <h3 class="section-title">图书信息</h3>

            <el-form-item label="书名" prop="title">
              <el-input
                v-model="formData.title"
                placeholder="请输入书名"
                size="large"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>

            <el-form-item label="作者" prop="author">
              <el-input
                v-model="formData.author"
                placeholder="请输入作者"
                size="large"
                maxlength="100"
                show-word-limit
              />
            </el-form-item>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="分类" prop="category">
                  <el-select
                    v-model="formData.category"
                    placeholder="请选择分类"
                    size="large"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="cat in bookStore.categories"
                      :key="cat"
                      :label="cat"
                      :value="cat"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="新旧程度" prop="book_condition">
                  <el-select
                    v-model="formData.book_condition"
                    placeholder="请选择新旧程度"
                    size="large"
                    style="width: 100%"
                  >
                    <el-option
                      v-for="item in bookStore.conditionOptions"
                      :key="item.value"
                      :label="item.label"
                      :value="item.value"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item label="出版社">
              <el-input
                v-model="formData.publisher"
                placeholder="请输入出版社（选填）"
                size="large"
                maxlength="100"
              />
            </el-form-item>

            <el-form-item label="图书简介">
              <el-input
                v-model="formData.description"
                type="textarea"
                :rows="4"
                placeholder="请输入图书简介（选填），帮助邻居了解这本书"
                maxlength="500"
                show-word-limit
              />
            </el-form-item>

            <el-divider />

            <h3 class="section-title">您的联系方式</h3>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="您的姓名" prop="owner_name">
                  <el-input
                    v-model="formData.owner_name"
                    placeholder="请输入您的姓名"
                    size="large"
                    maxlength="50"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="联系方式" prop="owner_contact">
                  <el-input
                    v-model="formData.owner_contact"
                    placeholder="手机号或微信号"
                    size="large"
                    maxlength="100"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-form-item>
              <el-button
                type="primary"
                size="large"
                @click="submitPublish"
                :loading="submitting"
                class="submit-btn"
              >
                <el-icon><Check /></el-icon> 发布图书
              </el-button>
              <el-button size="large" @click="resetForm">重置</el-button>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBookStore } from '@/stores/book'
import { uploadAPI } from '@/api'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Check } from '@element-plus/icons-vue'

const router = useRouter()
const bookStore = useBookStore()

const formRef = ref()
const submitting = ref(false)
const uploadUrl = '/api/upload/image'
const uploadHeaders = {}

const formData = ref({
  title: '',
  author: '',
  category: '',
  book_condition: null,
  cover_image: '',
  publisher: '',
  description: '',
  owner_name: '',
  owner_contact: ''
})

const rules = {
  title: [
    { required: true, message: '请输入书名', trigger: 'blur' }
  ],
  author: [
    { required: true, message: '请输入作者', trigger: 'blur' }
  ],
  category: [
    { required: true, message: '请选择分类', trigger: 'change' }
  ],
  book_condition: [
    { required: true, message: '请选择新旧程度', trigger: 'change' }
  ],
  owner_name: [
    { required: true, message: '请输入您的姓名', trigger: 'blur' }
  ],
  owner_contact: [
    { required: true, message: '请输入联系方式', trigger: 'blur' }
  ]
}

const beforeUpload = (file) => {
  const isImage = file.type.startsWith('image/')
  if (!isImage) {
    ElMessage.error('只能上传图片文件')
    return false
  }
  const isLt5M = file.size / 1024 / 1024 < 5
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB')
    return false
  }
  return true
}

const handleUploadSuccess = (response) => {
  if (response.code === 200) {
    formData.value.cover_image = response.data.url
    ElMessage.success('封面上传成功')
  } else {
    ElMessage.error(response.message || '上传失败')
  }
}

const handleUploadError = () => {
  ElMessage.error('封面上传失败，请稍后重试')
}

const clearCover = () => {
  formData.value.cover_image = ''
}

const submitPublish = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    try {
      submitting.value = true

      const bookId = await bookStore.createBook({
        ...formData.value,
        book_condition: formData.value.book_condition
      })

      ElMessageBox.alert(
        `《${formData.value.title}》发布成功！\n\n邻居们现在可以预约这本书了。\n\n温馨提示：请保持联系方式畅通，及时响应预约请求。`,
        '发布成功',
        {
          confirmButtonText: '去看看',
          type: 'success'
        }
      )

      router.push(`/book/${bookId}`)
    } catch (e) {
      ElMessage.error(e.response?.data?.message || '发布失败，请稍后重试')
    } finally {
      submitting.value = false
    }
  })
}

const resetForm = () => {
  formRef.value?.resetFields()
  formData.value.cover_image = ''
}

onMounted(() => {
  bookStore.fetchCategories()
})
</script>

<style scoped>
.book-publish {
  padding: 20px 0;
  max-width: 1200px;
  margin: 0 auto;
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

.form-card {
  padding: 20px;
}

.section-title {
  margin: 0 0 20px 0;
  font-size: 18px;
  color: #303133;
  font-weight: 600;
}

.cover-upload-section {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.cover-uploader {
  width: 100%;
  margin-bottom: 16px;
}

.cover-upload {
  width: 100%;
  aspect-ratio: 3/4;
}

.cover-upload :deep(.el-upload-dragger) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border-radius: 12px;
  overflow: hidden;
}

.cover-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  color: #909399;
  padding: 20px;
}

.upload-icon {
  margin-bottom: 16px;
  color: #c0c4cc;
}

.upload-text {
  font-size: 16px;
  margin-bottom: 8px;
  color: #606266;
}

.upload-hint {
  font-size: 12px;
  color: #c0c4cc;
}

.clear-cover-btn {
  margin-top: 8px;
}

.publish-form {
  padding: 20px 0;
}

.publish-form :deep(.el-form-item) {
  margin-bottom: 24px;
}

.submit-btn {
  min-width: 150px;
}
</style>
