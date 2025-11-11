import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import Header from "@/components/layout/Header";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import routes, { type RouteConfig } from "./app/routes";

function App() {
	return (
		<BrowserRouter>
			<Toaster position="top-right" />
			<Routes>
				{routes.map((route: RouteConfig) => {
					const Component = route.component;

					return (
						<Route
							key={route.path}
							path={route.path}
							element={
								// Auth页面使用自己的全屏布局，其他页面使用通用布局
								route.path === "/auth" ? (
									<Component />
								) : (
									<div className="min-h-screen gradient-bg">
										<Header />
										<main className="container-responsive py-4 md:py-6">
											{route.protected ? (
												<ProtectedRoute>
													<Component />
												</ProtectedRoute>
											) : (
												<Component />
											)}
										</main>
									</div>
								)
							}
						/>
					);
				})}
				<Route path="*" element={<Navigate to="/" replace />} />
			</Routes>
		</BrowserRouter>
	);
}

export default App;
