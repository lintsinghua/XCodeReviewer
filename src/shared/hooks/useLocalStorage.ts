import { useState, useEffect } from "react";

export function useLocalStorage<T>(
	key: string,
	initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
	// 获取初始值
	const [storedValue, setStoredValue] = useState<T>(() => {
		try {
			const item = window.localStorage.getItem(key);
			return item ? JSON.parse(item) : initialValue;
		} catch (error) {
			console.error(`Error reading localStorage key "${key}":`, error);
			return initialValue;
		}
	});

	// 设置值的函数
	const setValue = (value: T | ((val: T) => T)) => {
		try {
			// 允许传入函数来更新状态
			const valueToStore =
				value instanceof Function ? value(storedValue) : value;
			setStoredValue(valueToStore);
			window.localStorage.setItem(key, JSON.stringify(valueToStore));
		} catch (error) {
			console.error(`Error setting localStorage key "${key}":`, error);
		}
	};

	return [storedValue, setValue];
}

export function useSessionStorage<T>(
	key: string,
	initialValue: T,
): [T, (value: T | ((val: T) => T)) => void] {
	// 获取初始值
	const [storedValue, setStoredValue] = useState<T>(() => {
		try {
			const item = window.sessionStorage.getItem(key);
			return item ? JSON.parse(item) : initialValue;
		} catch (error) {
			console.error(`Error reading sessionStorage key "${key}":`, error);
			return initialValue;
		}
	});

	// 设置值的函数
	const setValue = (value: T | ((val: T) => T)) => {
		try {
			const valueToStore =
				value instanceof Function ? value(storedValue) : value;
			setStoredValue(valueToStore);
			window.sessionStorage.setItem(key, JSON.stringify(valueToStore));
		} catch (error) {
			console.error(`Error setting sessionStorage key "${key}":`, error);
		}
	};

	return [storedValue, setValue];
}
