<template>
  <div class="upload-container">
    <el-card class="upload-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <h2>
            <el-icon><Upload /></el-icon>
            IPA包检测
          </h2>
          <p class="subtitle">选择两个IPA文件进行代码相似度检测</p>
        </div>
      </template>

      <el-form :model="form" label-width="100px" class="upload-form">
        <!-- 文件上传区域 -->
        <div class="upload-area">
          <!-- 第一个文件 -->
          <div class="file-upload-section">
            <el-form-item label="IPA文件1:">
              <el-upload
                ref="upload1"
                v-model:file-list="fileList1"
                :auto-upload="false"
                :limit="1"
                :on-change="handleFile1Change"
                :on-remove="handleFile1Remove"
                :before-upload="beforeUpload"
                accept=".ipa"
                drag
                class="upload-dragger"
              >
                <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                <div class="el-upload__text">将IPA文件拖到此处，或<em>点击上传</em></div>
                <template #tip>
                  <div class="el-upload__tip">只能上传IPA文件，且不超过2G</div>
                </template>
              </el-upload>
            </el-form-item>
          </div>

          <!-- 第二个文件 -->
          <div class="file-upload-section">
            <el-form-item label="IPA文件2:">
              <el-upload
                ref="upload2"
                v-model:file-list="fileList2"
                :auto-upload="false"
                :limit="1"
                :on-change="handleFile2Change"
                :on-remove="handleFile2Remove"
                :before-upload="beforeUpload"
                accept=".ipa"
                drag
                class="upload-dragger"
              >
                <el-icon class="el-icon--upload"><UploadFilled /></el-icon>
                <div class="el-upload__text">将IPA文件拖到此处，或<em>点击上传</em></div>
                <template #tip>
                  <div class="el-upload__tip">只能上传IPA文件，且不超过2G</div>
                </template>
              </el-upload>
            </el-form-item>
          </div>
        </div>

        <!-- 文件信息显示 -->
        <div v-if="file1 || file2" class="file-info">
          <h3>选择的文件</h3>
          <el-row :gutter="20">
            <el-col :span="12">
              <el-card v-if="file1" class="file-card">
                <div class="file-item">
                  <el-icon class="file-icon"><Document /></el-icon>
                  <div class="file-details">
                    <p class="file-name">{{ file1.name }}</p>
                    <p class="file-size">{{ formatFileSize(file1.size) }}</p>
                  </div>
                </div>
              </el-card>
              <el-card v-else class="file-card empty">
                <div class="empty-state">
                  <el-icon><Plus /></el-icon>
                  <p>请选择第一个IPA文件</p>
                </div>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-card v-if="file2" class="file-card">
                <div class="file-item">
                  <el-icon class="file-icon"><Document /></el-icon>
                  <div class="file-details">
                    <p class="file-name">{{ file2.name }}</p>
                    <p class="file-size">{{ formatFileSize(file2.size) }}</p>
                  </div>
                </div>
              </el-card>
              <el-card v-else class="file-card empty">
                <div class="empty-state">
                  <el-icon><Plus /></el-icon>
                  <p>请选择第二个IPA文件</p>
                </div>
              </el-card>
            </el-col>
          </el-row>
        </div>

        <!-- 提交按钮 -->
        <div class="submit-section">
          <el-button
            type="primary"
            size="large"
            :loading="uploading"
            :disabled="!canSubmit"
            @click="submitTask"
            class="submit-button"
          >
            <el-icon><Check /></el-icon>
            {{ uploading ? '正在提交...' : '开始检测' }}
          </el-button>
        </div>
      </el-form>
    </el-card>

    <!-- 最近任务卡片 -->
    <el-card v-if="recentTasks.length > 0" class="recent-tasks-card" shadow="hover">
      <template #header>
        <h3>最近的检测任务</h3>
      </template>
      <div class="recent-tasks">
        <div v-for="task in recentTasks" :key="task.task_id" class="task-item" @click="viewTask(task.task_id)">
          <div class="task-info">
            <p class="task-id">{{ task.task_id.slice(0, 8) }}...</p>
            <p class="task-time">{{ formatTime(task.created_at) }}</p>
          </div>
          <el-tag :type="getStatusType(task.status)">
            {{ getStatusText(task.status) }}
          </el-tag>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Upload, UploadFilled, Document, Plus, Check } from '@element-plus/icons-vue';
import { taskApi, type TaskStatus } from '../api';

const router = useRouter();

// 响应式数据
const form = ref({});
const uploading = ref(false);
const fileList1 = ref([]);
const fileList2 = ref([]);
const file1 = ref<File | null>(null);
const file2 = ref<File | null>(null);
const recentTasks = ref<TaskStatus[]>([]);

// 计算属性
const canSubmit = computed(() => {
  return file1.value && file2.value && !uploading.value;
});

// 文件处理方法
const handleFile1Change = (file: any) => {
  file1.value = file.raw;
};

const handleFile1Remove = () => {
  file1.value = null;
};

const handleFile2Change = (file: any) => {
  file2.value = file.raw;
};

const handleFile2Remove = () => {
  file2.value = null;
};

const beforeUpload = (file: File) => {
  const isIPA = file.name.toLowerCase().endsWith('.ipa');
  const isLt200M = file.size / 1024 / 1024 < 2000;

  if (!isIPA) {
    ElMessage.error('只能上传IPA文件!');
    return false;
  }
  if (!isLt200M) {
    ElMessage.error('文件大小不能超过2G!');
    return false;
  }
  return true;
};

// 提交任务
const submitTask = async () => {
  if (!file1.value || !file2.value) {
    ElMessage.warning('请选择两个IPA文件');
    return;
  }
  // 校验两个文件名需要不一样
  if (file1.value.name === file2.value.name) {
    ElMessage.warning('两个文件名不能一样');
    return;
  }
  // 检查文件名是否包含debug
  if (file1.value.name.toLowerCase().includes('debug') || file2.value.name.toLowerCase().includes('debug')) {
    ElMessage.warning('请上传Release包,不能上传Debug包');
    return;
  }

  try {
    uploading.value = true;
    const response = await taskApi.createTask(file1.value, file2.value);

    ElMessage.success('任务创建成功!');

    // 跳转到任务详情页
    router.push(`/task/${response.task_id}`);

    // 清除文件选择
    file1.value = null;
    file2.value = null;
    fileList1.value = [];
    fileList2.value = [];
  } catch (error) {
    ElMessage.error(`任务创建失败: ${error.message}`);
  } finally {
    uploading.value = false;
  }
};

// 工具方法
const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatTime = (timeStr: string) => {
  const date = new Date(timeStr);
  return date.toLocaleString('zh-CN');
};

const getStatusType = (status: string) => {
  const types = {
    pending: 'info',
    processing: 'warning',
    completed: 'success',
    failed: 'danger',
  };
  return types[status] || 'info';
};

const getStatusText = (status: string) => {
  const texts = {
    pending: '等待中',
    processing: '检测中',
    completed: '已完成',
    failed: '失败',
  };
  return texts[status] || status;
};

const viewTask = (taskId: string) => {
  router.push(`/task/${taskId}`);
};

// 加载最近任务
const loadRecentTasks = async () => {
  try {
    // 获取最近的5个任务
    const result = await taskApi.getAllTasks(5, 0);
    recentTasks.value = result.tasks;
  } catch (error) {
    console.error('Failed to load recent tasks:', error);
  }
};

onMounted(() => {
  loadRecentTasks();
});
</script>

<style scoped>
.upload-container {
  max-width: 1000px;
  margin: 0 auto;
}

.upload-card {
  margin-bottom: 20px;
}

.card-header {
  text-align: center;
}

.card-header h2 {
  margin: 0 0 10px 0;
  color: #2c3e50;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.subtitle {
  color: #666;
  margin: 0;
  font-size: 14px;
}

.upload-form {
  padding: 20px 0;
}

.upload-area {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 30px;
  margin-bottom: 30px;
}

.file-upload-section {
  min-height: 200px;
}

.upload-dragger {
  width: 100%;
}

.file-info {
  margin-bottom: 30px;
}

.file-info h3 {
  margin-bottom: 15px;
  color: #2c3e50;
}

.file-card {
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-card.empty {
  border: 2px dashed #dcdfe6;
  background: #fafbfc;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
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

.file-size {
  margin: 0;
  font-size: 12px;
  color: #666;
}

.empty-state {
  text-align: center;
  color: #999;
}

.empty-state .el-icon {
  font-size: 24px;
  margin-bottom: 8px;
}

.empty-state p {
  margin: 0;
  font-size: 14px;
}

.submit-section {
  text-align: center;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.submit-button {
  min-width: 200px;
  height: 50px;
  font-size: 16px;
}

.recent-tasks-card {
  max-height: 400px;
  overflow-y: auto;
}

.recent-tasks {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.task-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.3s;
}

.task-item:hover {
  border-color: #409eff;
  background: #f0f9ff;
}

.task-info {
  flex: 1;
}

.task-id {
  margin: 0 0 4px 0;
  font-family: monospace;
  font-weight: 500;
  color: #2c3e50;
}

.task-time {
  margin: 0;
  font-size: 12px;
  color: #666;
}

@media (max-width: 768px) {
  .upload-area {
    grid-template-columns: 1fr;
    gap: 20px;
  }

  .file-info .el-row {
    margin: 0;
  }

  .file-info .el-col {
    margin-bottom: 15px;
  }
}
</style>
