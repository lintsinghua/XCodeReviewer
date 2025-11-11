// 路径别名工具函数
export const paths = {
	// 应用核心
	app: "@/app",

	// 组件
	components: "@/components",
	ui: "@/components/ui",
	layout: "@/components/layout",
	features: "@/components/features",
	common: "@/components/common",

	// 页面
	pages: "@/pages",

	// 功能模块
	analysisFeature: "@/features/analysis",
	projectsFeature: "@/features/projects",
	auditFeature: "@/features/audit",

	// 共享资源
	shared: "@/shared",
	hooks: "@/shared/hooks",
	services: "@/shared/services",
	types: "@/shared/types",
	utils: "@/shared/utils",
	constants: "@/shared/constants",
	config: "@/shared/config",

	// 静态资源
	assets: "@/assets",
	images: "@/assets/images",
	icons: "@/assets/icons",
	styles: "@/assets/styles",
} as const;

// 获取路径的辅助函数
export function getPath(key: keyof typeof paths): string {
	return paths[key];
}
