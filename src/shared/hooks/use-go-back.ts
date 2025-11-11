import { useNavigate } from "react-router-dom";

export function useGoBack() {
	const navigate = useNavigate();

	const goBack = () => {
		if (window.history.length > 1) {
			navigate(-1);
		} else {
			navigate("/");
		}
	};

	return goBack;
}
