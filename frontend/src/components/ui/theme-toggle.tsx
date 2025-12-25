/**
 * Theme Toggle Component
 * Cyberpunk-styled theme switcher with smooth animations
 */

import { useTheme } from "next-themes";
import { useEffect, useState, useCallback } from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { cn } from "@/shared/utils/utils";

interface ThemeToggleProps {
  collapsed?: boolean;
  className?: string;
}

// Enable smooth theme transition
const enableTransition = () => {
  const html = document.documentElement;
  html.classList.add('theme-transition');

  // Remove transition class after animation completes
  setTimeout(() => {
    html.classList.remove('theme-transition');
  }, 280);
};

export function ThemeToggle({ collapsed = false, className }: ThemeToggleProps) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Smooth theme change handler
  const handleThemeChange = useCallback((newTheme: string) => {
    enableTransition();
    setTheme(newTheme);
  }, [setTheme]);

  if (!mounted) {
    return (
      <div className={cn("h-10 w-full animate-pulse rounded-lg bg-muted", className)} />
    );
  }

  const themes = [
    { value: "light", icon: Sun, label: "浅色" },
    { value: "dark", icon: Moon, label: "深色" },
    { value: "system", icon: Monitor, label: "系统" },
  ];

  const currentTheme = themes.find((t) => t.value === theme) || themes[2];
  const CurrentIcon = currentTheme.icon;

  // Cycle through themes
  const cycleTheme = () => {
    const currentIndex = themes.findIndex((t) => t.value === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    handleThemeChange(themes[nextIndex].value);
  };

  // Collapsed mode - single button
  if (collapsed) {
    return (
      <button
        onClick={cycleTheme}
        className={cn(
          "flex items-center justify-center w-full h-10 rounded-lg",
          "border border-transparent transition-colors duration-200",
          "dark:text-muted-foreground dark:hover:text-primary dark:hover:bg-primary/10 dark:hover:border-primary/30",
          "text-muted-foreground hover:text-primary hover:bg-primary/5 hover:border-primary/20",
          className
        )}
        title={`当前: ${currentTheme.label}模式`}
      >
        <CurrentIcon
          className={cn(
            "w-6 h-6 transition-transform duration-200",
            resolvedTheme === "dark" && "text-amber-400",
            resolvedTheme === "light" && "text-orange-500"
          )}
        />
      </button>
    );
  }

  // Expanded mode - segmented control
  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="text-xs text-muted-foreground dark:text-muted-foreground font-mono uppercase tracking-wider">
          主题
        </span>
      </div>
      <div
        className={cn(
          "flex items-center gap-1 p-1 mx-3 mb-2 rounded-lg",
          "dark:cyber-bg-elevated dark:border dark:border-[#1a2535]",
          "bg-muted border border-border"
        )}
      >
        {themes.map(({ value, icon: Icon, label }) => {
          const isActive = theme === value;
          return (
            <button
              key={value}
              onClick={() => handleThemeChange(value)}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md transition-all duration-200",
                "text-xs font-mono uppercase tracking-wider",
                isActive
                  ? cn(
                      "dark:bg-primary/20 dark:text-primary dark:border dark:border-primary/40",
                      "bg-white text-primary border border-primary/30 shadow-sm"
                    )
                  : cn(
                      "dark:text-muted-foreground dark:hover:text-foreground dark:hover:bg-[#151a22]",
                      "text-muted-foreground hover:text-muted-foreground hover:bg-background"
                    )
              )}
              title={`${label}模式`}
            >
              <Icon
                className={cn(
                  "w-3.5 h-3.5 transition-all duration-200",
                  isActive && value === "dark" && "text-amber-400",
                  isActive && value === "light" && "text-orange-500",
                  isActive && value === "system" && "text-cyan-400"
                )}
              />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Compact version for dropdown menus
export function ThemeToggleCompact({ className }: { className?: string }) {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleToggle = useCallback(() => {
    enableTransition();
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  }, [setTheme, resolvedTheme]);

  if (!mounted) return null;

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={handleToggle}
      className={cn(
        "relative flex items-center justify-center w-10 h-10 rounded-lg",
        "dark:cyber-bg-elevated dark:border dark:border-[#1a2535] dark:hover:border-primary/50",
        "bg-muted border border-border hover:border-primary/50",
        "group transition-colors duration-200",
        className
      )}
      title={isDark ? "切换到浅色模式" : "切换到深色模式"}
    >
      {/* Sun icon */}
      <Sun
        className={cn(
          "absolute w-5 h-5 transition-all duration-250",
          isDark
            ? "opacity-0 rotate-90 scale-0"
            : "opacity-100 rotate-0 scale-100 text-orange-500"
        )}
      />
      {/* Moon icon */}
      <Moon
        className={cn(
          "absolute w-5 h-5 transition-all duration-250",
          isDark
            ? "opacity-100 rotate-0 scale-100 text-amber-400"
            : "opacity-0 -rotate-90 scale-0"
        )}
      />
    </button>
  );
}

export default ThemeToggle;
