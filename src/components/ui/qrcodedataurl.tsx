/**
 * 二维码生成组件
 *
 * 基于QRCode.js的React封装组件，可将任意文本转换为二维码图片
 *
 * 使用示例：
 * import QRCodeDataUrl from './components/qrcodedataurl'
 *
 * function App() {
 *   return <QRCodeDataUrl text="https://example.com" /> // 替换为有效URL
 * }
 */

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";

interface QRCodeDataUrlProps {
	/**
	 * 需要编码为二维码的文本内容
	 * 可以是URL、文本、联系方式等
	 * 示例: "https://example.com" 或 "CONTACT:1234567890"
	 */
	text: string;

	/**
	 * 二维码图片宽度(像素)
	 * @default 128
	 */
	width?: number;

	/**
	 * 二维码前景色(有效CSS颜色值)
	 * @default "#000000" (黑色)
	 */
	color?: string;

	/**
	 * 二维码背景色(有效CSS颜色值)
	 * @default "#ffffff" (白色)
	 */
	backgroundColor?: string;

	/**
	 * 自定义CSS类名
	 */
	className?: string;
}

/**
 * 二维码生成组件
 * @param {QRCodeDataUrlProps} props - 组件属性
 */
const QRCodeDataUrl: React.FC<QRCodeDataUrlProps> = ({
	text,
	width = 128,
	color = "#000000",
	backgroundColor = "#ffffff",
	className = "",
}) => {
	const [dataUrl, setDataUrl] = useState<string>("");

	useEffect(() => {
		const generateQR = async () => {
			try {
				const url = await QRCode.toDataURL(text, {
					width,
					color: {
						dark: color,
						light: backgroundColor,
					},
				});
				setDataUrl(url);
			} catch (err) {
				console.error("生成二维码失败:", err);
			}
		};

		generateQR();
	}, [text, width, color, backgroundColor]);

	return (
		<div className={`qr-code-container ${className}`}>
			{dataUrl ? (
				<img
					src={dataUrl}
					alt={`二维码: ${text}`}
					width={width}
					height={width}
				/>
			) : (
				<div>生成二维码中...</div>
			)}
		</div>
	);
};

export default QRCodeDataUrl;
