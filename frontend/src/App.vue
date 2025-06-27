<template>
  <div id="app" class="app-container">
    <el-container class="layout-container">
      <!-- 顶部导航 -->
      <el-header class="header">
        <div class="header-content">
          <h1 class="title">IPA包代码相似度检测平台</h1>
          <div class="nav-buttons">
            <el-button 
              type="primary" 
              :icon="Upload" 
              @click="$router.push('/')"
              :class="{ active: $route.path === '/' }"
            >
              上传检测
            </el-button>
            <el-button 
              type="info" 
              :icon="List" 
              @click="$router.push('/history')"
              :class="{ active: $route.path === '/history' }"
            >
              检测历史
            </el-button>
          </div>
        </div>
      </el-header>

      <!-- 主体内容 -->
      <el-main class="main-content">
        <router-view></router-view>
      </el-main>

      <!-- 底部 -->
      <el-footer class="footer">
        <div class="footer-content">
          <p>&copy; 2024 IPA包代码相似度检测平台. All rights reserved.</p>
          <p>内网部署版本 v1.0.0</p>
        </div>
      </el-footer>
    </el-container>
  </div>
</template>

<script setup lang="ts">
import { Upload, List } from '@element-plus/icons-vue'
</script>

<style scoped>
.app-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.layout-container {
  min-height: 100vh;
}

.header {
  background: rgba(255, 255, 255, 0.95);
  backdrop-filter: blur(10px);
  border-bottom: 1px solid #e4e7ed;
  padding: 0;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 100%;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.title {
  font-size: 24px;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.nav-buttons {
  display: flex;
  gap: 12px;
}

.nav-buttons .el-button.active {
  background: #409eff;
  border-color: #409eff;
  color: white;
}

.main-content {
  padding: 20px;
  min-height: calc(100vh - 120px);
}

.footer {
  background: rgba(255, 255, 255, 0.9);
  border-top: 1px solid #e4e7ed;
  height: 80px;
}

.footer-content {
  text-align: center;
  color: #666;
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
}

.footer-content p {
  margin: 4px 0;
  font-size: 14px;
}
</style>

<style>
body {
  margin: 0;
  font-family: 'Helvetica Neue', Helvetica, 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', '微软雅黑', Arial, sans-serif;
}

#app {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}
</style> 