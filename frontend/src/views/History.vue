<template>
  <div class="history-container">
    <h1 class="page-title">检测历史</h1>
    
    <el-card shadow="hover">
      <template #header>
        <div class="card-header">
          <h3>历史记录</h3>
          <el-button @click="loadTasks" :loading="loading" :icon="Refresh">
            刷新
          </el-button>
        </div>
      </template>

      <div v-if="tasks.length > 0" class="tasks-table">
        <el-table :data="tasks" style="width: 100%" stripe>
          <el-table-column prop="task_id" label="任务ID" width="180">
            <template #default="scope">
              <code class="task-id">{{ scope.row.task_id.slice(0, 8) }}...</code>
            </template>
          </el-table-column>
          
          <el-table-column label="文件" min-width="200">
            <template #default="scope">
              <div class="file-names">
                <p>{{ scope.row.file1_name }}</p>
                <p>{{ scope.row.file2_name }}</p>
              </div>
            </template>
          </el-table-column>
          
          <el-table-column prop="status" label="状态" width="120">
            <template #default="scope">
              <el-tag :type="getStatusType(scope.row.status)">
                {{ getStatusText(scope.row.status) }}
              </el-tag>
            </template>
          </el-table-column>
          
          <el-table-column prop="similarity_score" label="相似度" width="120">
            <template #default="scope">
              <span v-if="scope.row.similarity_score !== null">
                {{ Math.round(scope.row.similarity_score * 100) }}%
              </span>
              <span v-else>-</span>
            </template>
          </el-table-column>
          
          <el-table-column prop="created_at" label="创建时间" width="180">
            <template #default="scope">
              {{ formatTime(scope.row.created_at) }}
            </template>
          </el-table-column>
          
          <el-table-column label="操作" width="180">
            <template #default="scope">
              <div class="action-buttons">
                <el-button 
                  type="primary" 
                  size="small" 
                  @click="viewTask(scope.row.task_id)"
                  text
                >
                  查看详情
                </el-button>
                <el-button 
                  v-if="scope.row.status === 'failed'"
                  type="warning" 
                  size="small" 
                  @click="retryTask(scope.row.task_id)"
                  :loading="retryingTasks.has(scope.row.task_id)"
                  text
                >
                  重试
                </el-button>
              </div>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <div v-else-if="!loading" class="empty-state">
        <el-empty description="暂无检测记录">
          <el-button type="primary" @click="$router.push('/')">
            开始检测
          </el-button>
        </el-empty>
      </div>

      <div v-if="loading" class="loading-state">
        <el-skeleton :rows="5" animated />
      </div>

      <!-- 分页控件 -->
      <div v-if="!loading && tasks.length > 0" class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50, 100]"
          :total="totalTasks"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="handleSizeChange"
          @current-change="handleCurrentChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Refresh } from '@element-plus/icons-vue'
import { taskApi, type TaskStatus } from '../api'

const router = useRouter()
const loading = ref(false)
const tasks = ref<TaskStatus[]>([])
const retryingTasks = ref(new Set<string>())

// 分页相关
const currentPage = ref(1)
const pageSize = ref(20)
const totalTasks = ref(0)

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
    pending: '等待中',
    processing: '检测中',
    completed: '已完成',
    failed: '失败'
  }
  return texts[status] || status
}

const formatTime = (timeStr: string) => {
  const date = new Date(timeStr)
  // 将UTC时间转换为东八区时间 (UTC+8)
  const localDate = new Date(date.getTime() - (8 * 60 * 60 * 1000))
  return localDate.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit', 
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  })
}

const viewTask = (taskId: string) => {
  router.push(`/task/${taskId}`)
}

const retryTask = async (taskId: string) => {
  try {
    retryingTasks.value.add(taskId)
    
    await taskApi.retryTask(taskId)
    
    ElMessage.success('任务已重置，将重新开始检测')
    
    // 重新加载任务列表
    await loadTasks()
  } catch (error: any) {
    if (error.response?.data?.error) {
      ElMessage.error(`重试失败: ${error.response.data.error}`)
    } else if (error.message) {
      ElMessage.error(`重试失败: ${error.message}`)
    } else {
      ElMessage.error('重试失败')
    }
  } finally {
    retryingTasks.value.delete(taskId)
  }
}

const loadTasks = async () => {
  loading.value = true
  try {
    const offset = (currentPage.value - 1) * pageSize.value
    const result = await taskApi.getAllTasks(pageSize.value, offset)
    tasks.value = result.tasks
    totalTasks.value = result.total
  } catch (error) {
    console.error('Failed to load tasks:', error)
    ElMessage.error('加载任务列表失败')
  } finally {
    loading.value = false
  }
}

// 分页事件处理
const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1 // 重置到第一页
  loadTasks()
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
  loadTasks()
}

onMounted(() => {
  loadTasks()
})
</script>

<style scoped>
.history-container {
  max-width: 1200px;
  margin: 0 auto;
}

.page-title {
  margin-bottom: 20px;
  color: #2c3e50;
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

.task-id {
  font-family: monospace;
  background: #f5f7fa;
  padding: 2px 6px;
  border-radius: 3px;
}

.file-names p {
  margin: 2px 0;
  font-size: 14px;
  color: #666;
  word-break: break-all;
}

.empty-state,
.loading-state {
  padding: 40px 0;
}

.pagination-container {
  padding: 20px 0;
  display: flex;
  justify-content: center;
}

.action-buttons {
  display: flex;
  gap: 8px;
  align-items: center;
}
</style> 