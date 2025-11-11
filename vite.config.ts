import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";
import path from "path";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		svgr({
			svgrOptions: {
				icon: true,
				exportType: "named",
				namedExport: "ReactComponent",
			},
		}),
	],
	resolve: {
		alias: {
			"@": path.resolve(__dirname, "./src"),
		},
	},
	build: {
		rollupOptions: {
			output: {
				manualChunks: {
					vendor: ["react", "react-dom", "react-router-dom"],
					ui: [
						"@radix-ui/react-dialog",
						"@radix-ui/react-select",
						"@radix-ui/react-tabs",
						"@radix-ui/react-progress",
					],
					charts: ["recharts"],
					ai: ["@google/generative-ai"],
					utils: ["clsx", "tailwind-merge", "date-fns", "sonner"],
				},
			},
		},
		chunkSizeWarningLimit: 1000,
		sourcemap: false,
		minify: "terser",
		terserOptions: {
			compress: {
				drop_console: true,
				drop_debugger: true,
			},
		},
	},
	server: {
		port: 5173,
		host: true,
		open: true,
		cors: {
			origin: true,
			credentials: true,
			methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
			allowedHeaders: [
				"Authorization",
				"Content-Type",
				"X-DashScope-SSE",
				"X-Requested-With",
			],
		},
		proxy: {
			// 后端API代理
			"/api": {
				target: "http://localhost:8000",
				changeOrigin: true,
				secure: false,
				rewrite: (path) => path,
			},
			// WebSocket代理
			"/ws": {
				target: "ws://localhost:8000",
				changeOrigin: true,
				ws: true,
			},
			"/dashscope-proxy": {
				target: "https://dashscope.aliyuncs.com",
				changeOrigin: true,
				secure: true,
				rewrite: (path) => path.replace(/^\/dashscope-proxy/, ""),
				configure: (proxy) => {
					proxy.on("proxyReq", (proxyReq) => {
						proxyReq.setHeader("origin", "https://dashscope.aliyuncs.com");
					});
				},
			},
		},
	},
	preview: {
		port: 5173,
		host: true,
	},
	optimizeDeps: {
		include: [
			"react",
			"react-dom",
			"react-router-dom",
			"@google/generative-ai",
			"recharts",
			"sonner",
		],
	},
});
