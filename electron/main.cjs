const { app, BrowserWindow, globalShortcut } = require('electron');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false, // For easier prototyping
      webSecurity: false // Allow loading local resources like Unity WebGL
    },
    backgroundColor: '#0f172a',
    frame: false, // Frameless for immersion
    fullscreen: true, // Start in fullscreen for immersion
    // icon: path.join(__dirname, '../public/favicon.ico') 
  });
  
  mainWindow.maximize(); // Auto maximize
 // In dev: load from localhost
  // In prod: load from build file
  const startUrl = 'http://localhost:3000';
  
  // Custom Loading Screen
  // Instead of loading index.html directly, we could load a splash screen
  // But for now, we just rely on React's speed.
  // We can inject a script to show a splash overlay until React mounts
  mainWindow.loadURL(startUrl);

  // Global Shortcuts
  globalShortcut.register('F11', () => {
    mainWindow.setFullScreen(!mainWindow.isFullScreen());
  });

  globalShortcut.register('Escape', () => {
    if (mainWindow.isFullScreen()) mainWindow.setFullScreen(false);
  });

  // Open DevTools in dev mode
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
