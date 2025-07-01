<template>
  <div class="task-detail-container">
    <div class="page-header">
      <el-button @click="$router.go(-1)" :icon="ArrowLeft" class="back-button">
        返回
      </el-button>
      <h1 class="page-title">检测任务详情</h1>
    </div>

    <el-row :gutter="20">
      <!-- 任务状态卡片 -->
      <el-col :span="24" :lg="16">
        <el-card class="status-card" shadow="hover">
          <template #header>
            <div class="card-header">
              <h3>任务状态</h3>
              <el-button 
                v-if="!isCompleted" 
                @click="refreshStatus" 
                :loading="refreshing"
                :icon="Refresh"
                circle
                size="small"
              />
            </div>
          </template>

          <div v-if="task" class="task-status">
            <!-- 任务ID -->
            <div class="status-item">
              <label>任务ID:</label>
              <div class="task-id">
                <code>{{ task.task_id }}</code>
                <el-button 
                  @click="copyTaskId" 
                  :icon="DocumentCopy" 
                  text 
                  size="small"
                  class="copy-button"
                />
              </div>
            </div>

            <!-- 状态指示器 -->
            <div class="status-item">
              <label>当前状态:</label>
              <div class="status-indicator">
                <el-tag :type="getStatusType(task.status)" size="large">
                  <el-icon class="status-icon">
                    <component :is="getStatusIcon(task.status)" />
                  </el-icon>
                  {{ getStatusText(task.status) }}
                </el-tag>
              </div>
            </div>

            <!-- 进度条 -->
            <div class="status-item">
              <label>检测进度:</label>
              <el-progress 
                :percentage="task.progress || 0"
                :status="getProgressStatus(task.status)"
                :stroke-width="12"
                class="progress-bar"
              />
            </div>

            <!-- 时间信息 -->
            <div class="status-item">
              <label>创建时间:</label>
              <span>{{ formatTime(task.created_at) }}</span>
            </div>

            <div class="status-item">
              <label>更新时间:</label>
              <span>{{ formatTime(task.updated_at) }}</span>
            </div>

            <!-- 相似度结果 -->
            <div v-if="task.similarity_score !== null && task.similarity_score !== undefined" class="similarity-result">
              <h4>检测结果</h4>
              <div class="similarity-display">
                <div class="similarity-circle">
                  <el-progress 
                    type="circle" 
                    :percentage="Math.round(task.similarity_score * 100)"
                    :width="120"
                    :stroke-width="10"
                    :color="getSimilarityColor(task.similarity_score)"
                  />
                </div>
                <div class="similarity-text">
                  <h2>{{ Math.round(task.similarity_score * 100) }}%</h2>
                  <p class="similarity-label">代码相似度</p>
                  <p class="similarity-description">{{ getSimilarityDescription(task.similarity_score) }}</p>
                </div>
              </div>
            </div>

            <!-- 错误信息 -->
            <div v-if="task.error_message" class="error-message">
              <h4>错误信息</h4>
              <el-alert
                :title="task.error_message"
                type="error"
                :closable="false"
                show-icon
              />
            </div>
          </div>

          <div v-else class="loading-state">
            <el-skeleton :rows="6" animated />
          </div>
        </el-card>
      </el-col>

      <!-- 操作面板 -->
      <el-col :span="24" :lg="8">
        <el-card class="actions-card" shadow="hover">
          <template #header>
            <h3>操作</h3>
          </template>

          <div class="actions">
            <el-button 
              type="primary" 
              @click="startNewTask"
              :icon="Plus"
              size="large"
              class="action-button"
            >
              新建检测任务
            </el-button>

            <el-button 
              @click="viewHistory"
              :icon="List"
              size="large" 
              class="action-button"
            >
              查看历史记录
            </el-button>

            <!-- <el-button 
              v-if="task && task.status === 'completed'"
              @click="downloadReport"
              :icon="Download"
              size="large"
              class="action-button"
            >
              下载报告
            </el-button> -->

            <!-- <el-button 
              v-if="task && ['pending', 'processing'].includes(task.status)"
              @click="cancelTask"
              type="danger"
              :icon="Close"
              size="large"
              class="action-button"
            >
              取消任务
            </el-button> -->
          </div>
        </el-card>

        <!-- 文件信息卡片 -->
        <el-card v-if="task" class="files-card" shadow="hover">
          <template #header>
            <h3>检测文件</h3>
          </template>

          <div class="files-info">
            <div class="file-item">
              <el-icon class="file-icon"><Document /></el-icon>
              <div class="file-details">
                <p class="file-name">{{ task.file1_name }}</p>
                <p class="file-label">IPA文件 1</p>
              </div>
            </div>

            <div class="vs-divider">
              <span>VS</span>
            </div>

            <div class="file-item">
              <el-icon class="file-icon"><Document /></el-icon>
              <div class="file-details">
                <p class="file-name">{{ task.file2_name }}</p>
                <p class="file-label">IPA文件 2</p>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { 
  ArrowLeft, Refresh, DocumentCopy, Clock, Loading, 
  CircleCheck, WarningFilled, Plus, List, Download, 
  Close, Document 
} from '@element-plus/icons-vue'
import { taskApi, type TaskStatus } from '../api'

interface Props {
  taskId: string
}

const props = defineProps<Props>()
const router = useRouter()

// 响应式数据
const task = ref<TaskStatus | null>(null)
const refreshing = ref(false)
const pollingInterval = ref<number | null>(null)

// 计算属性
const isCompleted = computed(() => {
  return task.value && ['completed', 'failed'].includes(task.value.status)
})

// 状态相关方法
const getStatusType = (status: string) => {
  const types = {
    pending: 'info',
    processing: 'warning',
    completed: 'success',
    failed: 'danger'
  }
  return types[status] || 'info'
}

const getStatusText = (status: string) => {
  const texts = {
    pending: '等待处理',
    processing: '正在检测',
    completed: '检测完成',
    failed: '检测失败'
  }
  return texts[status] || status
}

const getStatusIcon = (status: string) => {
  const icons = {
    pending: Clock,
    processing: Loading,
    completed: CircleCheck,
    failed: WarningFilled
  }
  return icons[status] || Clock
}

const getProgressStatus = (status: string) => {
  if (status === 'completed') return 'success'
  if (status === 'failed') return 'exception'
  return undefined
}

const getSimilarityColor = (score: number) => {
  if (score >= 0.8) return '#f56c6c'
  if (score >= 0.6) return '#e6a23c'
  if (score >= 0.4) return '#409eff'
  return '#67c23a'
}

const getSimilarityDescription = (score: number) => {
  if (score >= 0.9) return '极高相似度'
  if (score >= 0.8) return '高相似度'
  if (score >= 0.6) return '中等相似度'
  if (score >= 0.4) return '低相似度'
  return '极低相似度'
}

// 操作方法
const refreshStatus = async () => {
  try {
    refreshing.value = true
    await loadTaskStatus()
  } catch (error) {
    ElMessage.error(`刷新失败: ${error.message}`)
  } finally {
    refreshing.value = false
  }
}

const copyTaskId = async () => {
  if (!task.value) return
  
  try {
    await navigator.clipboard.writeText(task.value.task_id)
    ElMessage.success('任务ID已复制到剪贴板')
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

const startNewTask = () => {
  router.push('/')
}

const viewHistory = () => {
  router.push('/history')
}

const downloadReport = () => {
  ElMessage.info('报告下载功能开发中...')
}

const cancelTask = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要取消这个检测任务吗？',
      '确认取消',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )
    
    ElMessage.info('任务取消功能开发中...')
  } catch {
    // 用户取消
  }
}

// 工具方法
const formatTime = (timeStr: string) => {
  const date = new Date(timeStr)
  return date.toLocaleString('zh-CN')
}

const loadTaskStatus = async () => {
  try {
    task.value = await taskApi.getTaskStatus(props.taskId)
  } catch (error) {
    ElMessage.error(`加载任务状态失败: ${error.message}`)
    router.push('/')
  }
}

const startPolling = () => {
  pollingInterval.value = setInterval(async () => {
    if (!isCompleted.value) {
      await loadTaskStatus()
    } else {
      stopPolling()
    }
  }, 3000) // 每3秒轮询一次
}

const stopPolling = () => {
  if (pollingInterval.value) {
    clearInterval(pollingInterval.value)
    pollingInterval.value = null
  }
}

// 生命周期
onMounted(async () => {
  await loadTaskStatus()
  if (!isCompleted.value) {
    startPolling()
  }
})

onUnmounted(() => {
  stopPolling()
})
</script>

<style scoped>
.task-detail-container {
  max-width: 1200px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
  gap: 16px;
}

.back-button {
  margin-right: 8px;
}

.page-title {
  margin: 0;
  color: #2c3e50;
  font-size: 24px;
  font-weight: 600;
}

.status-card,
.actions-card,
.files-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h3 {
  margin: 0;
  color: #2c3e50;
}

.task-status {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 16px;
}

.status-item label {
  min-width: 80px;
  font-weight: 500;
  color: #666;
}

.task-id {
  display: flex;
  align-items: center;
  gap: 8px;
}

.task-id code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  background: #f5f7fa;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 14px;
}

.copy-button {
  margin-left: 4px;
}

.status-indicator {
  display: flex;
  align-items: center;
}

.status-icon {
  margin-right: 4px;
}

.progress-bar {
  flex: 1;
  max-width: 400px;
}

.similarity-result {
  margin-top: 30px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
}

.similarity-result h4 {
  margin: 0 0 20px 0;
  color: #2c3e50;
}

.similarity-display {
  display: flex;
  align-items: center;
  gap: 30px;
}

.similarity-circle {
  flex-shrink: 0;
}

.similarity-text h2 {
  margin: 0 0 8px 0;
  font-size: 32px;
  font-weight: 600;
  color: #2c3e50;
}

.similarity-label {
  margin: 0 0 8px 0;
  font-size: 16px;
  color: #666;
}

.similarity-description {
  margin: 0;
  font-size: 14px;
  color: #999;
}

.error-message {
  margin-top: 20px;
}

.error-message h4 {
  margin: 0 0 12px 0;
  color: #f56c6c;
}

.loading-state {
  padding: 20px 0;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.action-button {
  width: 100%;
  justify-content: flex-start;
}

.files-info {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
}

.file-icon {
  font-size: 24px;
  color: #409eff;
}

.file-details {
  flex: 1;
}

.file-name {
  margin: 0 0 4px 0;
  font-weight: 500;
  color: #2c3e50;
  word-break: break-all;
}

.file-label {
  margin: 0;
  font-size: 12px;
  color: #666;
}

.vs-divider {
  text-align: center;
  position: relative;
}

.vs-divider::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  background: #dcdfe6;
}

.vs-divider span {
  background: white;
  padding: 0 12px;
  color: #999;
  font-size: 12px;
  font-weight: 500;
}

@media (max-width: 768px) {
  .similarity-display {
    flex-direction: column;
    text-align: center;
    gap: 20px;
  }
  
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .back-button {
    margin-right: 0;
  }
}
</style> 