const os = require('os');
const path = require('path');
const fs = require('fs-extra');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      // 排除回环地址、只要IPv4且不是内网本地回环
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return null;
}

const ip = getLocalIP();
console.log('本机IP地址：', ip);

// 模拟环境变量配置
process.env.STORAGE_PATH = './storage';
process.env.LOCAL_STORAGE = './worker_storage';
// 为当前演示设置一个合适的路径
process.env.DETECTION_BASE_PATH = './detection_results';

console.log('='.repeat(80));
console.log('IPA Package Check - Path Configuration Demo');
console.log('='.repeat(80));

// 获取绝对路径的辅助函数
function getAbsolutePath(relativePath) {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return path.resolve(process.cwd(), relativePath);
}

// 获取检测基础路径
function getDetectionBasePath() {
  let defaultPath;
  
  // 根据平台设置默认路径
  if (process.platform === 'win32') {
    defaultPath = 'D:\\upload\\dist';
  } else {
    defaultPath = '/var/lib/detection/results';
  }
  
  const configuredPath = process.env.DETECTION_BASE_PATH || defaultPath;
  return path.isAbsolute(configuredPath) ? configuredPath : path.resolve(process.cwd(), configuredPath);
}

// API服务器路径配置
console.log('\n📁 API Server Storage Configuration:');
console.log('--'.repeat(40));

const apiStoragePath = getAbsolutePath(process.env.STORAGE_PATH);
const tempUploadPath = path.join(apiStoragePath, 'temp');
const ipaStoragePath = path.join(apiStoragePath, 'ipa');

console.log(`Current working directory: ${process.cwd()}`);
console.log(`Storage root (relative): ${process.env.STORAGE_PATH}`);
console.log(`Storage root (absolute): ${apiStoragePath}`);
console.log(`Temp upload path: ${tempUploadPath}`);
console.log(`IPA storage path: ${ipaStoragePath}`);

// Worker路径配置
console.log('\n🔧 Worker Storage Configuration:');
console.log('--'.repeat(40));

const workerStoragePath = getAbsolutePath(process.env.LOCAL_STORAGE);
const detectionBasePath = getDetectionBasePath();

console.log(`Local storage (relative): ${process.env.LOCAL_STORAGE}`);
console.log(`Local storage (absolute): ${workerStoragePath}`);
console.log(`Detection base path: ${detectionBasePath}`);

// 模拟任务文件路径
console.log('\n📂 Sample Task File Paths:');
console.log('--'.repeat(40));

const sampleTaskId = 'sample-task-12345';
const sampleFile1 = 'app1.ipa';
const sampleFile2 = 'app2.ipa';

// API存储的文件路径
const apiFile1Path = path.join(ipaStoragePath, sampleTaskId, sampleFile1);
const apiFile2Path = path.join(ipaStoragePath, sampleTaskId, sampleFile2);

// Worker缓存的文件路径
const workerFile1Path = path.join(workerStoragePath, sampleTaskId, sampleFile1);
const workerFile2Path = path.join(workerStoragePath, sampleTaskId, sampleFile2);

// 检测结果文件路径
const resultFilePath = path.join(detectionBasePath, 'result', sampleTaskId, 'result.json');

console.log('API Server file paths:');
console.log(`  - File 1: ${apiFile1Path}`);
console.log(`  - File 2: ${apiFile2Path}`);
console.log('');
console.log('Worker cache file paths:');
console.log(`  - File 1: ${workerFile1Path}`);
console.log(`  - File 2: ${workerFile2Path}`);
console.log('');
console.log('Detection result file path:');
console.log(`  - Result: ${resultFilePath}`);

// 创建目录演示
console.log('\n🚀 Directory Initialization Demo:');
console.log('--'.repeat(40));

async function initializeDirectories() {
  try {
    // 创建API存储目录
    await fs.ensureDir(apiStoragePath);
    await fs.ensureDir(tempUploadPath);
    await fs.ensureDir(ipaStoragePath);
    console.log('✓ API storage directories created successfully');

    // 创建Worker存储目录
    await fs.ensureDir(workerStoragePath);
    console.log('✓ Worker storage directory created successfully');

    // 创建示例任务目录
    const sampleTaskDir = path.join(ipaStoragePath, sampleTaskId);
    await fs.ensureDir(sampleTaskDir);
    console.log(`✓ Sample task directory created: ${sampleTaskDir}`);

    // 检查目录是否存在
    console.log('\n📋 Directory Status Check:');
    const dirs = [
      { name: 'API Storage Root', path: apiStoragePath },
      { name: 'API Temp Upload', path: tempUploadPath },
      { name: 'API IPA Storage', path: ipaStoragePath },
      { name: 'Worker Storage', path: workerStoragePath },
      { name: 'Sample Task Dir', path: sampleTaskDir }
    ];

    for (const dir of dirs) {
      const exists = await fs.pathExists(dir.path);
      console.log(`  ${exists ? '✓' : '✗'} ${dir.name}: ${dir.path}`);
    }

  } catch (error) {
    console.error('✗ Error initializing directories:', error);
  }
}

// 平台兼容性检查
console.log('\n🖥️  Platform Compatibility:');
console.log('--'.repeat(40));
console.log(`Operating System: ${process.platform}`);
console.log(`Node.js Version: ${process.version}`);
console.log(`Path Separator: ${path.sep}`);

// 运行目录初始化
initializeDirectories().then(() => {
  console.log('\n🚀 Rsync File Transfer Path Demo:');
  console.log('--'.repeat(40));
  
  const sampleTaskId = 'sample-task-12345';
  const sampleFileName = 'app.ipa';
  
  // API服务器存储路径（源）
  const apiSourcePath = path.join(ipaStoragePath, sampleTaskId, sampleFileName);
  
  // Worker本地存储路径（目标）
  const workerTargetPath = path.join(workerStoragePath, sampleTaskId, sampleFileName);
  
  console.log('File Transfer Scenario:');
  console.log(`  Task ID: ${sampleTaskId}`);
  console.log(`  File Name: ${sampleFileName}`);
  console.log('');
  console.log('Source (API Server):');
  console.log(`  ${apiSourcePath}`);
  console.log('');
  console.log('Target (Worker Node):');
  console.log(`  worker-ip:${workerTargetPath}`);
  console.log('');
  
  // 模拟rsync命令
  const rsyncCommand = `rsync -avz --progress "${apiSourcePath}" "worker-ip:${workerTargetPath}"`;
  console.log('Rsync Command:');
  console.log(`  ${rsyncCommand}`);
  console.log('');
  
  // 展示Worker请求参数
  console.log('Worker File Request Payload:');
  console.log(JSON.stringify({
    task_id: sampleTaskId,
    file_name: sampleFileName,
    worker_ip: "192.168.1.100",
    worker_storage_path: workerStoragePath
  }, null, 2));
  
  console.log('\n📋 Path Benefits:');
  console.log('--'.repeat(40));
  console.log('✓ Source uses absolute path from API storage root');
  console.log('✓ Target uses absolute path from Worker storage root');
  console.log('✓ No dependency on temporary directories');
  console.log('✓ Consistent file organization across nodes');
  console.log('✓ Easy to track and debug file locations');
  console.log('✓ Supports multiple concurrent transfers safely');

  console.log('\n🔍 Detection Result Configuration:');
  console.log('--'.repeat(40));
  console.log('Detection result file structure:');
  console.log(`${detectionBasePath}/`);
  console.log(`├── result/`);
  console.log(`│   └── ${sampleTaskId}/`);
  console.log(`│       └── result.json`);
  console.log('');
  console.log('Expected result.json format:');
  console.log(JSON.stringify({
    sim: 0.7252
  }, null, 2));
  console.log('');
  console.log('Detection process:');
  console.log('1. Worker receives task');
  console.log('2. Worker downloads IPA files to local storage');
  console.log('3. Worker reads result from basePath/result/{taskId}/result.json');
  console.log('4. Worker extracts "sim" field as similarity_score');
  console.log('5. Worker updates task status in database');

  console.log('\n='.repeat(80));
  console.log('✅ Path configuration demo completed successfully!');
  console.log('');
  console.log('Key Points:');
  console.log('• All paths are automatically converted to absolute paths');
  console.log('• Relative paths are resolved based on current working directory');
  console.log('• Both API server and Worker use absolute paths for file storage');
  console.log('• File caching uses absolute paths for cross-platform compatibility');
  console.log('• Rsync transfers use absolute paths on both source and target');
  console.log('• Worker provides its storage path to API for accurate targeting');
  console.log('• Detection results are read from JSON files instead of external tools');
  console.log('• Detection base path is configurable via DETECTION_BASE_PATH env var');
  console.log('='.repeat(80));
}).catch((error) => {
  console.error('Demo failed:', error);
});
