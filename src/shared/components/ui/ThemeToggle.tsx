import React from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../../context/useTheme";

type ThemeToggleProps = {
  className?: string;
};

const ThemeToggle: React.FC<ThemeToggleProps> = ({ className = "" }) => {
  const { theme, setTheme } = useTheme();

  return (
    <div className={`theme-segment ${className}`}>
      <button
        type="button"
        className="theme-segment-btn"
        data-active={theme === "light"}
        onClick={() => setTheme("light")}
        aria-pressed={theme === "light"}
      >
        <Sun size={14} />
        Yorug'
      </button>
      <button
        type="button"
        className="theme-segment-btn"
        data-active={theme === "dark"}
        onClick={() => setTheme("dark")}
        aria-pressed={theme === "dark"}
      >
        <Moon size={14} />
        Qorong'u
      </button>
    </div>
  );
};

export default ThemeToggle;
