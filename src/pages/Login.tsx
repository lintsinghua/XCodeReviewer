import { LoginPanel } from "miaoda-auth-react";
import { api } from "@/shared/config/database";

const login_config = {
	title: "XCodeReviewer",
	desc: "登录以开始代码质量分析",
	onLoginSuccess: async (user: any) => {
		try {
			const existingProfile = await api.getProfilesById(user.id);
			if (!existingProfile) {
				const ProfilesLength = await api.getProfilesCount();
				const isFirstUser = ProfilesLength === 0;
				await api.createProfiles({
					id: user.id,
					phone: user.phone,
					role: isFirstUser ? "admin" : "member",
				});
			}
		} catch (error) {
			console.error("User initialization failed:", error);
		}
	},
	privacyPolicyUrl: import.meta.env.VITE_PRIVACY_POLICY_URL,
	userPolicyUrl: import.meta.env.VITE_USER_POLICY_URL,
	showPolicy: import.meta.env.VITE_SHOW_POLICY,
	policyPrefix: import.meta.env.VITE_POLICY_PREFIX,
};

export default function Login() {
	return (
		<div
			className="min-h-screen bg-gradient-to-br from-red-50/30 via-white to-red-50/20 flex items-center justify-center p-4"
			style={{
				backgroundImage: `linear-gradient(rgba(59, 130, 246, 0.1), rgba(99, 102, 241, 0.1)), url('https://miaoda-site-img.cdn.bcebos.com/30639cc7-9e0c-45fa-8987-a5389e64f8e9/images/94d4a1a8-923b-11f0-b78c-5a8ff2041e7f_0.jpg')`,
				backgroundSize: "cover",
				backgroundPosition: "center",
				backgroundRepeat: "no-repeat",
			}}
		>
			<div className="w-full max-w-md">
				<div className="text-center mb-8">
					<div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-primary to-accent rounded-full mb-4 shadow-lg">
						<svg
							className="w-8 h-8 text-white"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
						>
							<path
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth={2}
								d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
							/>
						</svg>
					</div>
					<h1 className="text-3xl font-bold text-gray-900 mb-2">
						XCodeReviewer
					</h1>
					<p className="text-gray-600">基于AI的代码质量分析平台</p>
				</div>

				<div className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl p-8 border border-gray-100">
					<LoginPanel {...login_config} />
				</div>

				<div className="text-center mt-6 text-sm text-gray-600 bg-white/80 backdrop-blur-sm rounded-lg p-3">
					<p>🔍 支持代码仓库审计和即时代码分析</p>
					<p>🛡️ 提供安全漏洞检测和性能优化建议</p>
				</div>
			</div>
		</div>
	);
}
