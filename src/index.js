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
let VentasMegared = null;
let VentasSurti = null;
let NotasMegared = null;
let NotasSurti = null;
let FacturasBoni = null;
let VentasBodegonaAntigua = null;
let NotasBodegonaAntigua = null;
let UpdateFacturas = null;
let ReporteNCT = null;
let HitorialFacCompras = null;
let ExistenciasGlobalesProductos = null;

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
ipcMain.on('open-VMegared-window', () => {
  if (VentasMegared) {
      // Si la ventana ya está abierta, enfócala
      VentasMegared.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      VentasMegared = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });

      VentasMegared.maximize();
      VentasMegared.loadFile(path.join(__dirname, 'vistas/DetalleVentasMegared.html'));

      // Manejar el evento de cierre de la ventana
      VentasMegared.on('closed', () => {
        VentasMegared = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});
ipcMain.on('open-VSurti-window', () => {
  if (VentasSurti) {
      // Si la ventana ya está abierta, enfócala
      VentasSurti.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      VentasSurti = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });

      VentasSurti.maximize();
      VentasSurti.loadFile(path.join(__dirname, 'vistas/DetalleVentasSurti.html'));

      // Manejar el evento de cierre de la ventana
      VentasSurti.on('closed', () => {
        VentasSurti = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});
ipcMain.on('open-NMegared-window', () => {
  if (NotasMegared) {
      // Si la ventana ya está abierta, enfócala
      NotasMegared.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      NotasMegared = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });

      NotasMegared.maximize();
      NotasMegared.loadFile(path.join(__dirname, 'vistas/DetalleNotasCreditoMegared.html'));

      // Manejar el evento de cierre de la ventana
      NotasMegared.on('closed', () => {
        NotasMegared = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});
ipcMain.on('open-NSurti-window', () => {
  if (NotasSurti) {
      // Si la ventana ya está abierta, enfócala
      NotasSurti.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      NotasSurti = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });

      NotasSurti.maximize();
      NotasSurti.loadFile(path.join(__dirname, 'vistas/DetalleNotasCreditoSurti.html'));

      // Manejar el evento de cierre de la ventana
      NotasSurti.on('closed', () => {
        NotasSurti = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});
ipcMain.on('open-FBonificaciones-window', () => {
  if (FacturasBoni) {
      // Si la ventana ya está abierta, enfócala
      FacturasBoni.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      FacturasBoni = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });

      FacturasBoni.maximize();
      FacturasBoni.loadFile(path.join(__dirname, 'vistas/FacturasBonificaciones.html'));

      // Manejar el evento de cierre de la ventana
      FacturasBoni.on('closed', () => {
        FacturasBoni = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});
ipcMain.on('open-VBodegonaAntigua-window', () => {
  if (VentasBodegonaAntigua) {
      // Si la ventana ya está abierta, enfócala
      VentasBodegonaAntigua.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      VentasBodegonaAntigua = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });

      VentasBodegonaAntigua.maximize();
      VentasBodegonaAntigua.loadFile(path.join(__dirname, 'vistas/DetalleVentasBodegonaAntigua.html'));

      // Manejar el evento de cierre de la ventana
      VentasBodegonaAntigua.on('closed', () => {
        VentasBodegonaAntigua = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});
ipcMain.on('open-NBodegonaAntigua-window', () => {
  if (NotasBodegonaAntigua) {
      // Si la ventana ya está abierta, enfócala
      NotasBodegonaAntigua.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      NotasBodegonaAntigua = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });

      NotasBodegonaAntigua.maximize();
      NotasBodegonaAntigua.loadFile(path.join(__dirname, 'vistas/DetalleNotasBodegonaAntigua.html'));

      // Manejar el evento de cierre de la ventana
      NotasBodegonaAntigua.on('closed', () => {
        NotasBodegonaAntigua = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});
ipcMain.on('open-ExistenciasGlobales-window', () => {
  if (ExistenciasGlobalesProductos) {
      // Si la ventana ya está abierta, enfócala
      ExistenciasGlobalesProductos.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      ExistenciasGlobalesProductos = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });

      ExistenciasGlobalesProductos.maximize();
      ExistenciasGlobalesProductos.loadFile(path.join(__dirname, 'vistas/ReporteProductosGlobales.html'));

      // Manejar el evento de cierre de la ventana
      ExistenciasGlobalesProductos.on('closed', () => {
        ExistenciasGlobalesProductos = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});
ipcMain.on('open-actualizarFacturasLink-window', () => {
  if (UpdateFacturas) {
      // Si la ventana ya está abierta, enfócala
      UpdateFacturas.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      UpdateFacturas = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });
      
      UpdateFacturas.maximize();
      UpdateFacturas.loadFile(path.join(__dirname, 'vistas/FacturasCompras.html'));

      // Manejar el evento de cierre de la ventana
      UpdateFacturas.on('closed', () => {
        UpdateFacturas = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});
ipcMain.on('open-reporteNCT-window', () => {
  if (ReporteNCT) {
      // Si la ventana ya está abierta, enfócala
      ReporteNCT.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      ReporteNCT = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });
      
      ReporteNCT.maximize();
      ReporteNCT.loadFile(path.join(__dirname, 'vistas/ReporteNCTProveedor.html'));

      // Manejar el evento de cierre de la ventana
      ReporteNCT.on('closed', () => {
        ReporteNCT = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});
ipcMain.on('open-HisotrialFC-window', () => {
  if (HitorialFacCompras) {
      // Si la ventana ya está abierta, enfócala
      HitorialFacCompras.focus();
  } else {
      // Si no está abierta, crea una nueva ventana
      HitorialFacCompras = new BrowserWindow({
          webPreferences: {
              nodeIntegration: true,
              contextIsolation: false,
              webSecurity: false,
              enableRemoteModule: true
          },
          icon: path.join(__dirname, 'ingresos.ico'),  // Asegúrate de tener este ícono
          autoHideMenuBar: true
      });
      
      HitorialFacCompras.maximize();
      HitorialFacCompras.loadFile(path.join(__dirname, 'vistas/HistorialFacturasCompras.html'));

      // Manejar el evento de cierre de la ventana
      HitorialFacCompras.on('closed', () => {
        HitorialFacCompras = null; // Limpiar la referencia cuando se cierre la ventana
      });
  }
});