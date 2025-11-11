/**
 * 本地数据库初始化工具
 * 用于在首次使用时创建默认用户和演示数据
 */

import { localDB } from "../config/localDatabase";
import { api } from "../config/database";

/**
 * 初始化本地数据库
 * 创建默认用户和基础数据
 */
export async function initLocalDatabase(): Promise<void> {
	try {
		// 初始化数据库
		await localDB.init();

		// 检查是否已有用户
		const profileCount = await localDB.getProfilesCount();

		if (profileCount === 0) {
			// 创建默认本地用户
			await api.createProfiles({
				id: "local-user",
				email: "local@xcodereviewer.com",
				full_name: "本地用户",
				role: "admin",
				github_username: "local-user",
			});

			console.log("✅ 本地数据库初始化成功");
		}
	} catch (error) {
		console.error("❌ 本地数据库初始化失败:", error);
		throw error;
	}
}

/**
 * 清空本地数据库
 * 用于重置或清理数据
 */
export async function clearLocalDatabase(): Promise<void> {
	try {
		const dbName = "xcodereviewer_local";
		const request = indexedDB.deleteDatabase(dbName);

		return new Promise((resolve, reject) => {
			request.onsuccess = () => {
				console.log("✅ 本地数据库已清空");
				resolve();
			};
			request.onerror = () => {
				console.error("❌ 清空本地数据库失败");
				reject(request.error);
			};
		});
	} catch (error) {
		console.error("❌ 清空本地数据库失败:", error);
		throw error;
	}
}

/**
 * 导出本地数据库数据
 * 用于备份或迁移
 */
export async function exportLocalDatabase(): Promise<string> {
	try {
		await localDB.init();

		const data = {
			version: 1,
			exportDate: new Date().toISOString(),
			profiles: await localDB.getAllProfiles(),
			projects: await localDB.getProjects(),
			auditTasks: await localDB.getAuditTasks(),
		};

		return JSON.stringify(data, null, 2);
	} catch (error) {
		console.error("❌ 导出数据失败:", error);
		throw error;
	}
}

/**
 * 导入数据到本地数据库
 * 用于恢复备份或迁移数据
 */
export async function importLocalDatabase(jsonData: string): Promise<void> {
	try {
		const data = JSON.parse(jsonData);

		if (!data.version || !data.profiles) {
			throw new Error("无效的数据格式");
		}

		await localDB.init();

		// 导入用户
		for (const profile of data.profiles) {
			await api.createProfiles(profile);
		}

		// 导入项目
		if (data.projects) {
			for (const project of data.projects) {
				await api.createProject(project);
			}
		}

		console.log("✅ 数据导入成功");
	} catch (error) {
		console.error("❌ 导入数据失败:", error);
		throw error;
	}
}
