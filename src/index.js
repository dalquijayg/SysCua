const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const {autoUpdater} = require('electron-updater')
const log = require('electron-log');
const { DiffieHellman } = require('crypto');
log.transports.file.resolvePathFn = () => path.join('C:/Users/USUARIO/Desktop/Cuadre y Gestion', 'logs/main.log');
log.log("Version de la App " + app.getVersion());

if (process.env.NODE_ENV !== 'production') {
  require('electron-reload')(__dirname, {});
}

let mainWindow;
let cuadreWindow = null;
let historialwindow = null;
let criteriowindow = null;
let ingresosWindow = null;

app.on('ready',  createWindow)

autoUpdater.on('update-available', (info) => {
  log.info("update available");
  mainWindow.webContents.send('update_available');
});

autoUpdater.on('update-downloaded', (info) => {
  log.info("update-downloaded");
  mainWindow.webContents.send('update_downloaded');
});

ipcMain.on('restart_app', () => {
  autoUpdater.quitAndInstall();
});
function createWindow() {
  mainWindow = new BrowserWindow({
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false,
      enableRemoteModule: true
    },
    icon: path.join(__dirname, 'menu.ico'),
    autoHideMenuBar: true
  });

  mainWindow.maximize();
  mainWindow.loadFile(path.join(__dirname, 'vistas/inicio.html'));
  
  mainWindow.webContents.once('dom-ready', ()=>{
    autoUpdater.checkForUpdatesAndNotify();
  });
}



app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
ipcMain.on('open-cuadre-window', () => {
  if (cuadreWindow) {
    // Si la ventana ya está abierta, enfócala
    cuadreWindow.focus();
  } else {
    // Si no está abierta, crea una nueva ventana
    cuadreWindow = new BrowserWindow({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        enableRemoteModule: true
      },
      icon: path.join(__dirname, 'factura.ico'),
      autoHideMenuBar: true
    });

    cuadreWindow.maximize();
    cuadreWindow.loadFile(path.join(__dirname, 'vistas/Cuadre.html'));

    // Manejar el evento de cierre de la ventana
    cuadreWindow.on('closed', () => {
      cuadreWindow = null; // Limpiar la referencia cuando se cierre la ventana
    });
  }
});
ipcMain.on('open-historial-window', () => {
  if (historialwindow) {
    // Si la ventana ya está abierta, enfócala
    historialwindow.focus();
  } else {
    // Si no está abierta, crea una nueva ventana
    historialwindow = new BrowserWindow({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        enableRemoteModule: true
      },
      icon: path.join(__dirname, 'escribiendo.ico'),
      autoHideMenuBar: true
    });

    historialwindow.maximize();
    historialwindow.loadFile(path.join(__dirname, 'vistas/historialcuadre.html'));

    // Manejar el evento de cierre de la ventana
    historialwindow.on('closed', () => {
      historialwindow = null; // Limpiar la referencia cuando se cierre la ventana
    });
  }
});
ipcMain.on('open-criterio-window', () => {
  if (criteriowindow) {
    // Si la ventana ya está abierta, enfócala
    criteriowindow.focus();
  } else {
    // Si no está abierta, crea una nueva ventana
    criteriowindow = new BrowserWindow({
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        webSecurity: false,
        enableRemoteModule: true
      },
      icon: path.join(__dirname, 'Criterio.ico'),
      autoHideMenuBar: true
    });

    criteriowindow.maximize();
    criteriowindow.loadFile(path.join(__dirname, 'vistas/Criterio.html'));

    // Manejar el evento de cierre de la ventana
    criteriowindow.on('closed', () => {
      criteriowindow = null; // Limpiar la referencia cuando se cierre la ventana
    });
  }
});
ipcMain.on('open-ingresos-window', () => {
  if (ingresosWindow) {
      // Si la ventana ya está abierta, enfócala
      ingresosWindow.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      ingresosWindow = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });

      ingresosWindow.maximize();
      ingresosWindow.loadFile(path.join(__dirname, 'vistas/Ingresos.html'));

      // Manejar el evento de cierre de la ventana
      ingresosWindow.on('closed', () => {
          ingresosWindow = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});