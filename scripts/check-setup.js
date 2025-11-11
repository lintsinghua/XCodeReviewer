#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

console.log("🔍 检查项目设置...");

// 检查必要文件
const requiredFiles = [
	"src/main.tsx",
	"src/App.tsx",
	"src/index.css",
	"src/components/common/PageMeta.tsx",
	"src/components/common/Header.tsx",
	"src/components/common/Footer.tsx",
	"src/pages/Dashboard.tsx",
	"src/pages/Projects.tsx",
	"src/pages/InstantAnalysis.tsx",
	"src/pages/AuditTasks.tsx",
	"src/pages/ProjectDetail.tsx",
	"src/pages/TaskDetail.tsx",
	"src/pages/AdminDashboard.tsx",
	"src/services/codeAnalysis.ts",
	"src/services/repoScan.ts",
	"src/services/repoZipScan.ts",
	"src/db/supabase.ts",
	"src/types/types.ts",
	"src/lib/utils.ts",
	"src/routes.tsx",
	"package.json",
	"vite.config.ts",
	"tailwind.config.js",
	"tsconfig.json",
	"tsconfig.app.json",
];

let missingFiles = [];

for (const file of requiredFiles) {
	if (!fs.existsSync(file)) {
		missingFiles.push(file);
	}
}

if (missingFiles.length > 0) {
	console.log("❌ 缺少以下文件:");
	missingFiles.forEach((file) => console.log(`   - ${file}`));
	process.exit(1);
} else {
	console.log("✅ 所有必要文件都存在");
}

// 检查环境变量文件
if (!fs.existsSync(".env") && !fs.existsSync(".env.example")) {
	console.log("⚠️  缺少环境变量文件");
} else {
	console.log("✅ 环境变量文件存在");
}

// 检查node_modules
if (!fs.existsSync("node_modules")) {
	console.log("❌ 缺少 node_modules，请运行 npm install");
	process.exit(1);
} else {
	console.log("✅ 依赖已安装");
}

// 检查关键依赖
const packageJson = JSON.parse(fs.readFileSync("package.json", "utf8"));
const requiredDeps = [
	"react",
	"react-dom",
	"react-router-dom",
	"@google/generative-ai",
	"@supabase/supabase-js",
	"tailwindcss",
	"vite",
	"typescript",
];

let missingDeps = [];
for (const dep of requiredDeps) {
	if (!packageJson.dependencies[dep] && !packageJson.devDependencies[dep]) {
		missingDeps.push(dep);
	}
}

if (missingDeps.length > 0) {
	console.log("❌ 缺少以下依赖:");
	missingDeps.forEach((dep) => console.log(`   - ${dep}`));
	process.exit(1);
} else {
	console.log("✅ 所有关键依赖都存在");
}

console.log("");
console.log("🎉 项目设置检查完成！");
console.log("");
console.log("📝 下一步:");
console.log("   1. 确保 .env 文件中配置了 VITE_GEMINI_API_KEY");
console.log("   2. 运行 npm run dev 启动开发服务器");
console.log("   3. 在浏览器中访问 http://localhost:5173");
