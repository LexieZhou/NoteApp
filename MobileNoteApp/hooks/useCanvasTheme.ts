import { useTheme } from '../contexts/ThemeContext';

export function useCanvasTheme() {
  const { darkMode } = useTheme();

  return {
    backgroundColor: darkMode ? '#1e1e1e' : '#ffffff',
    strokeColor: darkMode ? '#ffffff' : '#000000',
    gridColor: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
  };
} 