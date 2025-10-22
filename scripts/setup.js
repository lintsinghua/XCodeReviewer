#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🚀 XCodeReviewer 项目设置开始...');

// 检查 Node.js 版本
function checkNodeVersion() {
  console.log('📋 检查 Node.js 版本...');
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion < 18) {
    console.error(`❌ Node.js 版本过低，需要 18+，当前版本: ${nodeVersion}`);
    process.exit(1);
  }
  
  console.log(`✅ Node.js 版本检查通过: ${nodeVersion}`);
}

// 检查包管理器
function detectPackageManager() {
  console.log('📦 检查包管理器...');
  
  const managers = ['pnpm', 'yarn', 'npm'];
  
  for (const manager of managers) {
    try {
      execSync(`${manager} --version`, { stdio: 'ignore' });
      console.log(`✅ 使用 ${manager}`);
      return manager;
    } catch (error) {
      // 继续检查下一个
    }
  }
  
  console.error('❌ 未找到包管理器，请安装 npm、yarn 或 pnpm');
  process.exit(1);
}

// 安装依赖
function installDependencies(packageManager) {
  console.log('📥 安装项目依赖...');
  try {
    execSync(`${packageManager} install`, { stdio: 'inherit' });
  } catch (error) {
    console.error('❌ 依赖安装失败');
    process.exit(1);
  }
}

// 设置环境变量
function setupEnvironment() {
  console.log('🔧 检查环境变量配置...');
  
  const envPath = '.env';
  const envExamplePath = '.env.example';
  
  if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
      fs.copyFileSync(envExamplePath, envPath);
      console.log('✅ 已创建 .env 文件，请编辑配置必要的环境变量');
      console.log('');
      console.log('📝 必需配置的环境变量：');
      console.log('   VITE_GEMINI_API_KEY - Google Gemini API 密钥');
      console.log('');
      console.log('📝 可选配置的环境变量：');
      console.log('   VITE_SUPABASE_URL - Supabase 项目 URL');
      console.log('   VITE_SUPABASE_ANON_KEY - Supabase 匿名密钥');
      console.log('   VITE_GITHUB_TOKEN - GitHub 访问令牌');
      console.log('');
      console.log('⚠️  请在启动项目前配置 VITE_GEMINI_API_KEY');
    } else {
      console.error('❌ 未找到 .env.example 文件');
      process.exit(1);
    }
  } else {
    console.log('✅ .env 文件已存在');
  }
}

// 检查 API Key 配置
function checkApiKey() {
  const envPath = '.env';
  
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    
    if (envContent.includes('VITE_GEMINI_API_KEY=your_gemini_api_key_here') || 
        !envContent.includes('VITE_GEMINI_API_KEY=')) {
      console.log('⚠️  请配置 Google Gemini API Key：');
      console.log('   1. 访问 https://makersuite.google.com/app/apikey');
      console.log('   2. 创建 API Key');
      console.log('   3. 在 .env 文件中设置 VITE_GEMINI_API_KEY');
    } else {
      console.log('✅ Gemini API Key 已配置');
    }
  }
}

// 主函数
function main() {
  try {
    checkNodeVersion();
    const packageManager = detectPackageManager();
    installDependencies(packageManager);
    setupEnvironment();
    checkApiKey();
    
    console.log('');
    console.log('🎉 项目设置完成！');
    console.log('');
    console.log('📚 接下来的步骤：');
    console.log(`   1. 编辑 .env 文件，配置必要的环境变量`);
    console.log(`   2. 运行 '${packageManager} dev' 启动开发服务器`);
    console.log('   3. 在浏览器中访问 http://localhost:5173');
    console.log('');
    console.log('📖 更多信息请查看：');
    console.log('   - README.md - 项目介绍和使用指南');
    console.log('   - DEPLOYMENT.md - 部署指南');
    console.log('   - FEATURES.md - 功能特性详解');
    console.log('');
    console.log('🆘 需要帮助？');
    console.log('   - GitHub Issues: https://github.com/lintsinghua/XCodeReviewer/issues');
    console.log('   - 邮箱: tsinghuaiiilove@gmail.com');
    console.log('');
    console.log('Happy coding! 🚀');
    
  } catch (error) {
    console.error('❌ 设置过程中出现错误:', error.message);
    process.exit(1);
  }
}

// 运行主函数
if (require.main === module) {
  main();
}

module.exports = { main };