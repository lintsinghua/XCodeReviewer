import React from "react";
import { Code } from "lucide-react";

const Footer: React.FC = () => {
	const currentYear = new Date().getFullYear();

	return (
		<footer className="bg-white border-t border-gray-200/60 mt-16">
			<div className="container-responsive py-8">
				<div className="text-center">
					<div className="flex items-center justify-center space-x-2 mb-4">
						<div className="w-6 h-6 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
							<Code className="w-4 h-4 text-white" />
						</div>
						<span className="text-lg font-semibold text-gray-900">
							XCodeReviewer
						</span>
					</div>
					<p className="text-gray-500 text-sm">
						© {currentYear} XCodeReviewer. 致力于提升代码质量，保障软件安全.
					</p>
				</div>
			</div>
		</footer>
	);
};

export default Footer;
