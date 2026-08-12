import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { waitForThemeColors, debugThemeColors } from './utils/themeColors';
import { logger } from './utils/logger';
import './theme-colors.css';

// Initialize theme system and wait for CSS to load
async function startApp() {
  document.documentElement.classList.remove('dark-theme');
  logger.info('Application starting', { theme: 'light' });
  
  // Wait for theme colors to be available
  const colorsLoaded = await waitForThemeColors();
  
  if (colorsLoaded) {
    logger.debug('Theme colors loaded successfully');
  } else {
    logger.warn('Theme colors may not be fully loaded');
  }
  
  // Debug theme colors in development
  if (import.meta.env.DEV) {
    debugThemeColors();
  }
  
  // Render the app
  createRoot(document.getElementById('root')!).render(
    <App />
  );
}

// Start the application
startApp().catch((error) => {
  logger.error('Failed to start application', { error: error.message, stack: error.stack });
});
