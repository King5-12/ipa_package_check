import { createRouter, createWebHistory } from 'vue-router'
import Upload from '../views/Upload.vue'
import History from '../views/History.vue'
import TaskDetail from '../views/TaskDetail.vue'

const routes = [
  {
    path: '/',
    name: 'Upload',
    component: Upload
  },
  {
    path: '/history',
    name: 'History',
    component: History
  },
  {
    path: '/task/:taskId',
    name: 'TaskDetail',
    component: TaskDetail,
    props: true
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router 