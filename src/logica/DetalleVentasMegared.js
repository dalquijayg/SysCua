// Importaciones (mantenemos las mismas dependencias)
const Swal = require('sweetalert2');
const odbc = require('odbc');
const conexiondbsucursal = 'DSN=DBsucursal';
const ExcelJS = require('exceljs');
const mysql = require('mysql2/promise'); // Para conexiones a MySQL
const Chart = require('chart.js/auto');

// Variables globales
let allData = []; // Almacena todos los datos de ventas
let currentPage = 1;
const itemsPerPage = 100;
let sucursales = []; // Almacena información de las sucursales
let filteredData = []; // Datos filtrados actualmente visibles
let charts = {}; // Almacena las referencias a los gráficos

// Variables para el panel de sucursales
let sucursalesEstado = {}; // Almacena el estado de cada sucursal: 'pendiente', 'cargando', 'completo', 'error'
let sucursalStats = {}; // Estadísticas por sucursal: {ventas, facturas}
let procesandoSucursal = false; // Control para evitar múltiples reintento simultáneos

// Objeto para mantener estadísticas
const stats = {
    totalVentas: 0,
    totalClientes: new Set(),
    totalSucursales: 0,
    totalFacturas: new Set()
};

// Inicializar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    initializeDatePickers();
    setupEventListeners();
    loadTheme();
    
    // Establecer fechas predeterminadas (actual y 30 días atrás)
    const today = new Date();
    const oneMonthAgo = new Date();
    oneMonthAgo.setDate(today.getDate() - 30);
    
    document.getElementById('fechaInicio').value = formatDate(oneMonthAgo);
    document.getElementById('fechaFin').value = formatDate(today);

    // Cargar las sucursales al iniciar
    obtenerSucursales();
    
    // Inicializar el panel de sucursales
    initializeSucursalesPanel();
});

// Función para inicializar los selectores de fecha
function initializeDatePickers() {
    const dateConfig = {
        dateFormat: 'Y-m-d',
        locale: {
            firstDayOfWeek: 1
        },
        altInput: true,
        altFormat: 'd/m/Y',
    };
    
    flatpickr('#fechaInicio', dateConfig);
    flatpickr('#fechaFin', dateConfig);
}

// Inicializar el panel de sucursales 
function initializeSucursalesPanel() {
    // Configurar el botón para colapsar/expandir el panel
    document.getElementById('collapseBtn').addEventListener('click', function() {
        const panel = document.querySelector('.sucursales-panel');
        const icon = this.querySelector('i');
        
        if (panel.classList.contains('collapsed')) {
            panel.classList.remove('collapsed');
            icon.className = 'fas fa-chevron-right';
        } else {
            panel.classList.add('collapsed');
            icon.className = 'fas fa-chevron-left';
        }
    });
    
    // Configurar la búsqueda de sucursales
    document.getElementById('buscarSucursal').addEventListener('input', function() {
        const busqueda = this.value.toLowerCase();
        const elementos = document.querySelectorAll('.sucursal-item');
        
        elementos.forEach(elemento => {
            const nombre = elemento.querySelector('.sucursal-nombre').textContent.toLowerCase();
            if (nombre.includes(busqueda)) {
                elemento.style.display = '';
            } else {
                elemento.style.display = 'none';
            }
        });
    });
}

// Configurar los listeners de eventos
function setupEventListeners() {
    // Botón de búsqueda
    document.getElementById('btnBuscar').addEventListener('click', () => {
        iniciarConsulta();
    });
    
    // Botón de exportar a Excel
    document.getElementById('btnExportar').addEventListener('click', () => {
        exportarExcel();
    });
    
    // Cambio de tema
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);
    
    // Paginación
    document.getElementById('btnAnterior').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            mostrarPagina();
        }
    });
    
    document.getElementById('btnSiguiente').addEventListener('click', () => {
        const totalPages = Math.ceil(filteredData.length / itemsPerPage);
        if (currentPage < totalPages) {
            currentPage++;
            mostrarPagina();
        }
    });
    
    // Tabs
    document.querySelectorAll('.tab-btn').forEach(button => {
        button.addEventListener('click', () => {
            const tabId = button.getAttribute('data-tab');
            
            // Desactivar todos los tabs y contenidos
            document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
            
            // Activar el tab seleccionado
            button.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            // Si seleccionó la pestaña de resúmenes, actualizar gráficos
            if (tabId === 'resumenes' && allData.length > 0) {
                actualizarGraficos();
            }
        });
    });
    
    // Filtros
    document.getElementById('filtraSucursal').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroCliente').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroSerie').addEventListener('input', debounce(aplicarFiltros, 300)); // Con debounce para el campo de texto
    document.getElementById('filtroProducto').addEventListener('input', debounce(aplicarFiltros, 300));
    
    // Detectar clic en una fila para mostrar detalles
    document.getElementById('datosVentas').addEventListener('click', (e) => {
        // Encontrar la fila más cercana
        const row = e.target.closest('tr');
        if (row) {
            const index = row.getAttribute('data-index');
            if (index !== null) {
                mostrarDetalleVenta(filteredData[parseInt(index)]);
            }
        }
    });
}

// Función para mostrar las sucursales en el panel lateral
function mostrarSucursalesEnPanel() {
    const listaSucursales = document.getElementById('listaSucursales');
    listaSucursales.innerHTML = '';
    
    sucursales.forEach(sucursal => {
        // Determinar el estado de la sucursal
        const estado = sucursalesEstado[sucursal.idSucursal] || 'pendiente';
        const stats = sucursalStats[sucursal.idSucursal] || { ventas: 0, facturas: 0 };
        
        const sucursalItem = document.createElement('div');
        sucursalItem.className = `sucursal-item ${estado}`;
        sucursalItem.dataset.id = sucursal.idSucursal;
        
        let iconoEstado = '';
        let botonAccion = '';
        
        switch (estado) {
            case 'pendiente':
                iconoEstado = '<i class="fas fa-clock estado-icon"></i>';
                break;
            case 'cargando':
                iconoEstado = '<i class="fas fa-spinner fa-spin estado-icon"></i>';
                break;
            case 'completo':
                iconoEstado = '<i class="fas fa-check-circle estado-icon"></i>';
                break;
            case 'error':
                iconoEstado = '<i class="fas fa-exclamation-circle estado-icon"></i>';
                botonAccion = '<button class="btn-reintentar"><i class="fas fa-sync-alt"></i> Reintentar</button>';
                break;
        }
        
        sucursalItem.innerHTML = `
            <div class="sucursal-info">
                <div class="sucursal-estado">
                    ${iconoEstado}
                </div>
                <div class="sucursal-detalle">
                    <div class="sucursal-nombre">${sucursal.NombreSucursal}</div>
                    <div class="sucursal-stats">
                        <span class="stat-ventas" title="Ventas"><i class="fas fa-shopping-cart"></i> ${stats.ventas}</span>
                        <span class="stat-facturas" title="Facturas"><i class="fas fa-file-invoice"></i> ${stats.facturas}</span>
                    </div>
                </div>
                ${botonAccion}
            </div>
        `;
        
        // Agregar evento para mostrar detalles al hacer clic
        sucursalItem.querySelector('.sucursal-detalle').addEventListener('click', () => {
            mostrarDetalleSucursal(sucursal);
        });
        
        // Agregar evento al botón de reintentar si existe
        const botonReintentar = sucursalItem.querySelector('.btn-reintentar');
        if (botonReintentar) {
            botonReintentar.addEventListener('click', (e) => {
                e.stopPropagation(); // Evitar que se abra el detalle
                reintentarConsultaSucursal(sucursal);
            });
        }
        
        listaSucursales.appendChild(sucursalItem);
    });
}

// Función para mostrar detalle de una sucursal
function mostrarDetalleSucursal(sucursal) {
    // Clonar el template
    const template = document.getElementById('detalleSucursalTemplate');
    const detalleHTML = template.innerHTML;
    
    const stats = sucursalStats[sucursal.idSucursal] || { ventas: 0, facturas: 0 };
    const estado = sucursalesEstado[sucursal.idSucursal] || 'pendiente';
    
    let estadoTexto = '';
    switch (estado) {
        case 'pendiente': estadoTexto = 'Pendiente'; break;
        case 'cargando': estadoTexto = 'Cargando datos...'; break;
        case 'completo': estadoTexto = 'Completado'; break;
        case 'error': estadoTexto = 'Error en la consulta'; break;
    }
    
    Swal.fire({
        title: 'Detalle de la Sucursal',
        html: detalleHTML,
        width: 600,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#d32f2f',
        showCancelButton: estado === 'error',
        cancelButtonText: 'Reintentar',
        cancelButtonColor: '#e74c3c',
        didOpen: () => {
            // Llenar los campos con la información de la sucursal
            document.getElementById('detalleSucursalId').textContent = sucursal.idSucursal;
            document.getElementById('detalleSucursalNombre').textContent = sucursal.NombreSucursal;
            document.getElementById('detalleSucursalVentas').textContent = stats.ventas;
            document.getElementById('detalleSucursalFacturas').textContent = stats.facturas;
            document.getElementById('detalleSucursalEstado').textContent = estadoTexto;
            
            // Aplicar color según el estado
            const estadoElement = document.getElementById('detalleSucursalEstado');
            if (estado === 'completo') {
                estadoElement.style.color = 'var(--success-color)';
            } else if (estado === 'error') {
                estadoElement.style.color = 'var(--error-color)';
            } else if (estado === 'cargando') {
                estadoElement.style.color = 'var(--primary-color)';
            }
        }
    }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) {
            reintentarConsultaSucursal(sucursal);
        }
    });
}

// Mostrar detalle de una venta
function mostrarDetalleVenta(item) {
    // Clonar el template
    const template = document.getElementById('detalleVentaTemplate');
    const detalleHTML = template.innerHTML;
    
    Swal.fire({
        title: 'Detalle de la Venta',
        html: detalleHTML,
        width: 800,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#d32f2f',
        didOpen: () => {
            // Llenar los campos con la información de la venta
            document.getElementById('detalleUpc').textContent = item.Upc;
            document.getElementById('detalleDescripcion').textContent = item.DescLarga || 'Sin descripción';
            document.getElementById('detalleCantidad').textContent = item.Cantidad;
            document.getElementById('detalleCosto').textContent = formatCurrency(item.CostoUnitario);
            document.getElementById('detallePrecio').textContent = formatCurrency(item.PrecioUnitario);
            document.getElementById('detalleCliente').textContent = item.NombreCliente || 'Sin cliente';
            document.getElementById('detalleNIT').textContent = item.NIT || 'C/F';
            document.getElementById('detalleFactura').textContent = `${item.Serie}-${item.NoDocumento} (${formatDate(new Date(item.Fecha))})`;
        }
    });
}
// Obtener las sucursales de la base de datos principal
async function obtenerSucursales() {
    mostrarCargando(true, 'Conectando a la base de datos principal...');
    
    try {
        // Conectar a la base de datos usando ODBC
        const connection = await odbc.connect(conexiondbsucursal);
        
        // Ejecutar la consulta para obtener las sucursales Megared
        const query = `
            SELECT idSucursal, NombreSucursal, serverr, databasee, Uid, Pwd, Puerto
            FROM sucursales
            WHERE RazonSocial = 2 AND Activo = 1
        `;
        
        const result = await connection.query(query);
        
        // Cerrar la conexión ODBC
        await connection.close();
        
        // Almacenar las sucursales y actualizar la interfaz
        sucursales = result;
        stats.totalSucursales = sucursales.length;
        
        // Inicializar el estado de cada sucursal
        sucursales.forEach(sucursal => {
            sucursalesEstado[sucursal.idSucursal] = 'pendiente';
            sucursalStats[sucursal.idSucursal] = { ventas: 0, facturas: 0 };
        });
        
        actualizarContadores();
        
        // Llenar el selector de sucursales
        const selectSucursal = document.getElementById('filtraSucursal');
        // Limpiar opciones existentes (excepto la primera)
        selectSucursal.innerHTML = '<option value="todas">Todas las sucursales</option>';
        
        sucursales.forEach(sucursal => {
            const option = document.createElement('option');
            option.value = sucursal.idSucursal;  // Usamos el ID como valor
            option.textContent = sucursal.NombreSucursal;
            // Agregar todos los datos de conexión como data attributes, incluyendo el puerto
            option.dataset.serverr = sucursal.serverr;
            option.dataset.databasee = sucursal.databasee;
            option.dataset.uid = sucursal.Uid;
            option.dataset.pwd = sucursal.Pwd;
            option.dataset.puerto = sucursal.Puerto; // Agregar el puerto
            selectSucursal.appendChild(option);
        });
        
        // Mostrar las sucursales en el panel lateral
        mostrarSucursalesEnPanel();
        
        Swal.fire({
            icon: 'success',
            title: 'Conexión exitosa',
            text: `Se han encontrado ${sucursales.length} sucursales disponibles`,
            confirmButtonColor: '#d32f2f'
        });
        
    } catch (error) {
        console.error('Error al obtener sucursales:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudieron obtener las sucursales. ' + error.message,
            confirmButtonColor: '#d32f2f'
        });
    } finally {
        mostrarCargando(false);
    }
}

// Iniciar la consulta de datos
async function iniciarConsulta() {
    // Validar las fechas
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    
    if (!fechaInicio || !fechaFin) {
        Swal.fire({
            icon: 'warning',
            title: 'Fechas requeridas',
            text: 'Por favor, seleccione un rango de fechas para la consulta',
            confirmButtonColor: '#d32f2f'
        });
        return;
    }
    
    // Validar que haya sucursales disponibles
    if (sucursales.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'No hay sucursales',
            text: 'No se encontraron sucursales disponibles para consultar',
            confirmButtonColor: '#d32f2f'
        });
        return;
    }
    
    // Reiniciar variables
    allData = [];
    filteredData = [];
    stats.totalVentas = 0;
    stats.totalClientes = new Set();
    stats.totalFacturas = new Set();
    
    // Reiniciar estadísticas de sucursales pero mantener las que están en error
    sucursales.forEach(sucursal => {
        if (sucursalesEstado[sucursal.idSucursal] !== 'error') {
            sucursalesEstado[sucursal.idSucursal] = 'pendiente';
        }
        sucursalStats[sucursal.idSucursal] = { ventas: 0, facturas: 0 };
    });
    
    // Actualizar el panel de sucursales
    mostrarSucursalesEnPanel();
    
    // Mostrar la barra de progreso
    const progressBar = document.getElementById('progressBar');
    const progressInfo = document.getElementById('progressInfo');
    progressBar.style.width = '0%';
    progressInfo.textContent = 'Iniciando consulta...';
    
    // Mostrar el overlay de carga
    mostrarCargando(true, 'Consultando datos de ventas...');
    
    try {
        // Para cada sucursal, hacer la consulta
        for (let i = 0; i < sucursales.length; i++) {
            const sucursal = sucursales[i];
            
            // Si la sucursal está en error, saltarla
            if (sucursalesEstado[sucursal.idSucursal] === 'error') {
                continue;
            }
            
            progressBar.style.width = `${(i / sucursales.length) * 100}%`;
            progressInfo.textContent = `Consultando sucursal ${i+1} de ${sucursales.length}: ${sucursal.NombreSucursal}`;
            
            // Actualizar estado de la sucursal a 'cargando'
            sucursalesEstado[sucursal.idSucursal] = 'cargando';
            mostrarSucursalesEnPanel();
            
            try {
                // Consultar los datos de esta sucursal
                const sucursalData = await consultarVentasSucursal(sucursal, fechaInicio, fechaFin);
                
                // Recopilar facturas únicas de esta sucursal
                const facturasSet = new Set();
                
                // Agregar los datos al conjunto global
                if (sucursalData && sucursalData.length > 0) {
                    // Añadir el ID y nombre de la sucursal a cada registro
                    sucursalData.forEach(item => {
                        item.idSucursal = sucursal.idSucursal;
                        item.NombreSucursal = sucursal.NombreSucursal;
                        
                        // Registrar el cliente para estadísticas
                        if (item.NombreCliente) {
                            stats.totalClientes.add(item.NIT || item.NombreCliente);
                        }
                        
                        // Registrar la factura para estadísticas globales y por sucursal
                        if (item.Serie && item.NoDocumento) {
                            const facturaId = `${item.Serie}-${item.NoDocumento}`;
                            stats.totalFacturas.add(facturaId);
                            facturasSet.add(facturaId);
                        }
                    });
                    
                    allData = [...allData, ...sucursalData];
                    stats.totalVentas += sucursalData.length;
                    
                    // Actualizar estadísticas de la sucursal
                    sucursalStats[sucursal.idSucursal] = {
                        ventas: sucursalData.length,
                        facturas: facturasSet.size
                    };
                } else {
                    // No se encontraron datos, pero la consulta fue exitosa
                    sucursalStats[sucursal.idSucursal] = {
                        ventas: 0,
                        facturas: 0
                    };
                }
                
                // Marcar la sucursal como completada
                sucursalesEstado[sucursal.idSucursal] = 'completo';
                
            } catch (error) {
                console.error(`Error al consultar la sucursal ${sucursal.NombreSucursal}:`, error);
                // Marcar la sucursal como error
                sucursalesEstado[sucursal.idSucursal] = 'error';
                // Continuar con la siguiente sucursal
            }
            
            // Actualizar el panel de sucursales en cada iteración
            mostrarSucursalesEnPanel();
        }
        
        // Completar la barra de progreso
        progressBar.style.width = '100%';
        progressInfo.textContent = `Consulta finalizada. Se encontraron ${allData.length} registros en total.`;
        
        // Actualizar contadores
        actualizarContadores();
        
        // Actualizar filtros
        actualizarFiltros();
        
        // Mostrar los datos
        filteredData = [...allData];
        mostrarPagina();
        
        // Inicializar gráficos
        if (typeof Chart !== 'undefined') {
            inicializarGraficos();
        } else {
            console.error('Error: Chart.js no está disponible');
        }
        
        // Mensaje de éxito
        if (allData.length > 0) {
            Swal.fire({
                icon: 'success',
                title: 'Consulta exitosa',
                text: `Se encontraron ${allData.length} registros en ${sucursales.length} sucursales`,
                confirmButtonColor: '#d32f2f'
            });
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: 'No se encontraron registros para el periodo seleccionado',
                confirmButtonColor: '#d32f2f'
            });
        }
        
    } catch (error) {
        console.error('Error en la consulta general:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error en la consulta',
            text: 'Ocurrió un error durante la consulta. ' + error.message,
            confirmButtonColor: '#d32f2f'
        });
    } finally {
        mostrarCargando(false);
    }
}

// Función para reintentar la consulta de una sucursal específica
async function reintentarConsultaSucursal(sucursal) {
    // Evitar múltiples reintentos simultáneos
    if (procesandoSucursal) {
        Swal.fire({
            icon: 'warning',
            title: 'Procesando...',
            text: 'Ya hay una sucursal siendo procesada. Por favor, espere.',
            confirmButtonColor: '#d32f2f'
        });
        return;
    }
    
    procesandoSucursal = true;
    
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    
    if (!fechaInicio || !fechaFin) {
        Swal.fire({
            icon: 'warning',
            title: 'Fechas requeridas',
            text: 'Por favor, seleccione un rango de fechas para la consulta',
            confirmButtonColor: '#d32f2f'
        });
        procesandoSucursal = false;
        return;
    }
    
    try {
        // Actualizar estado de la sucursal a 'cargando'
        sucursalesEstado[sucursal.idSucursal] = 'cargando';
        mostrarSucursalesEnPanel();
        
        // Mostrar el overlay de carga
        mostrarCargando(true, `Reintentando consulta para: ${sucursal.NombreSucursal}`);
        
        // Consultar los datos de esta sucursal (ya usa el puerto gracias a consultarVentasSucursal actualizada)
        const sucursalData = await consultarVentasSucursal(sucursal, fechaInicio, fechaFin);
        
        // Recopilar facturas únicas de esta sucursal
        const facturasSet = new Set();
        
        // Remover datos previos de esta sucursal si existen
        allData = allData.filter(item => item.idSucursal !== sucursal.idSucursal);
        
        if (sucursalData && sucursalData.length > 0) {
            // Añadir el ID y nombre de la sucursal a cada registro
            sucursalData.forEach(item => {
                item.idSucursal = sucursal.idSucursal;
                item.NombreSucursal = sucursal.NombreSucursal;
                
                // Registrar el cliente para estadísticas
                if (item.NombreCliente) {
                    stats.totalClientes.add(item.NIT || item.NombreCliente);
                }
                
                // Registrar la factura para estadísticas globales y por sucursal
                if (item.Serie && item.NoDocumento) {
                    const facturaId = `${item.Serie}-${item.NoDocumento}`;
                    stats.totalFacturas.add(facturaId);
                    facturasSet.add(facturaId);
                }
            });
            
            // Agregar los nuevos datos
            allData = [...allData, ...sucursalData];
            
            // Actualizar estadísticas totales
            recalcularEstadisticasTotales();
            
            // Actualizar estadísticas de la sucursal
            sucursalStats[sucursal.idSucursal] = {
                ventas: sucursalData.length,
                facturas: facturasSet.size
            };
            
            // Aplicar filtros actuales a los nuevos datos
            filteredData = [...allData];
            aplicarFiltros();
            
            // Actualizar la visualización
            mostrarPagina();
            
            if (document.getElementById('resumenes').classList.contains('active')) {
                actualizarGraficos();
            }
            
            // Marcar la sucursal como completada
            sucursalesEstado[sucursal.idSucursal] = 'completo';
            
            Swal.fire({
                icon: 'success',
                title: 'Reintentar exitoso',
                text: `Se encontraron ${sucursalData.length} registros en ${sucursal.NombreSucursal}`,
                confirmButtonColor: '#d32f2f'
            });
        } else {
            // No se encontraron datos, pero la consulta fue exitosa
            sucursalStats[sucursal.idSucursal] = {
                ventas: 0,
                facturas: 0
            };
            
            // Marcar la sucursal como completada
            sucursalesEstado[sucursal.idSucursal] = 'completo';
            
            Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: `No se encontraron registros en ${sucursal.NombreSucursal} para el periodo seleccionado`,
                confirmButtonColor: '#d32f2f'
            });
        }
    } catch (error) {
        console.error(`Error al reintentar consulta en sucursal ${sucursal.NombreSucursal}:`, error);
        // Mantener la sucursal en estado de error
        sucursalesEstado[sucursal.idSucursal] = 'error';
        
        Swal.fire({
            icon: 'error',
            title: 'Error al reintentar',
            text: `No se pudo consultar la sucursal ${sucursal.NombreSucursal}. ${error.message}`,
            confirmButtonColor: '#d32f2f'
        });
    } finally {
        mostrarCargando(false);
        procesandoSucursal = false;
        mostrarSucursalesEnPanel();
    }
}

// Recalcular estadísticas totales
function recalcularEstadisticasTotales() {
    stats.totalVentas = 0;
    stats.totalClientes = new Set();
    stats.totalFacturas = new Set();
    
    allData.forEach(item => {
        stats.totalVentas++;
        
        if (item.NombreCliente) {
            stats.totalClientes.add(item.NIT || item.NombreCliente);
        }
        
        if (item.Serie && item.NoDocumento) {
            stats.totalFacturas.add(`${item.Serie}-${item.NoDocumento}`);
        }
    });
    
    // Actualizar los contadores en la interfaz
    actualizarContadores();
}

// Consultar ventas de una sucursal específica
async function consultarVentasSucursal(sucursal, fechaInicio, fechaFin) {
    try {
        // Crear la conexión a MySQL para esta sucursal incluyendo el puerto
        const connection = await mysql.createConnection({
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306, // Usar el puerto de la sucursal o 3306 por defecto
            user: sucursal.Uid,
            password: sucursal.Pwd,
            database: sucursal.databasee
        });
        
        // Consulta SQL para ventas Megared
        const query = `
            SELECT
                transaccionesnitido.Id, 
                transaccionesnitido.IdCajas, 
                detalletransaccionesnitido.Upc, 
                productos.DescLarga, 
                detalletransaccionesnitido.Cantidad, 
                detalletransaccionesnitido.CostoUnitario, 
                detalletransaccionesnitido.PrecioUnitario, 
                transaccionesnitido.Fecha, 
                transaccionesnitido.NIT, 
                transaccionesnitido.NombreCliente, 
                transaccionesnitido.DireccionCliente, 
                transaccionesnitido.Serie, 
                transaccionesnitido.NoDocumento, 
                transaccionesnitido.UUID
            FROM
                transaccionesnitido
                INNER JOIN
                detalletransaccionesnitido
                ON 
                    transaccionesnitido.Id = detalletransaccionesnitido.Idtransacciones AND
                    transaccionesnitido.IdCajas = detalletransaccionesnitido.IdCajas
                INNER JOIN
                productos
                ON 
                    detalletransaccionesnitido.Upc = productos.Upc
            WHERE
                transaccionesnitido.Fecha BETWEEN ? AND ? AND
                transaccionesnitido.Estado = 1
        `;
        
        // Ejecutar la consulta
        const [rows] = await connection.execute(query, [fechaInicio, fechaFin]);
        
        // Cerrar la conexión
        await connection.end();
        
        return rows;
        
    } catch (error) {
        console.error(`Error al consultar la sucursal ${sucursal.NombreSucursal}:`, error);
        throw error;
    }
}
// Mostrar una página de datos
function mostrarPagina() {
    const tbody = document.getElementById('datosVentas');
    tbody.innerHTML = '';
    
    // Asegurarnos de que filteredData contiene los datos correctos
    if (filteredData.length === 0 && allData.length > 0) {
        filteredData = [...allData];
    }
    
    const start = (currentPage - 1) * itemsPerPage;
    const end = Math.min(start + itemsPerPage, filteredData.length);
    
    for (let i = start; i < end; i++) {
        const item = filteredData[i];
        const tr = document.createElement('tr');
        tr.setAttribute('data-index', i);
        
        tr.innerHTML = `
            <td>${item.NombreSucursal}</td>
            <td>${item.Upc}</td>
            <td>${item.DescLarga || 'Sin descripción'}</td>
            <td>${item.Cantidad}</td>
            <td>${formatCurrency(item.CostoUnitario)}</td>
            <td>${formatCurrency(item.PrecioUnitario)}</td>
            <td>${formatDate(new Date(item.Fecha))}</td>
            <td>${item.NIT || 'C/F'}</td>
            <td>${item.NombreCliente || 'Sin nombre'}</td>
            <td>${item.NoDocumento}</td>
            <td>${item.Serie}</td>
            <td>${truncateText(item.UUID || '', 12)}</td>
        `;
        
        tbody.appendChild(tr);
    }
    
    // Actualizar la información de paginación
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    
    // Asegurarse de que totalPages nunca sea cero
    const displayTotalPages = totalPages || 1;
    document.getElementById('paginaActual').textContent = `Página ${currentPage} de ${displayTotalPages}`;
    
    // Habilitar/deshabilitar botones de navegación
    document.getElementById('btnAnterior').disabled = currentPage <= 1;
    document.getElementById('btnSiguiente').disabled = currentPage >= totalPages || totalPages === 0;
    
    // Depuración para identificar problemas
    console.log(`Mostrando página ${currentPage} de ${totalPages}`);
    console.log(`Total registros: ${filteredData.length}, Items por página: ${itemsPerPage}`);
}

// Actualizar los contadores de estadísticas
function actualizarContadores() {
    document.getElementById('totalSucursales').textContent = stats.totalSucursales;
    document.getElementById('totalVentas').textContent = stats.totalVentas;
    document.getElementById('totalClientes').textContent = stats.totalClientes.size;
    document.getElementById('totalFacturas').textContent = stats.totalFacturas.size;
}

// Actualizar los filtros basados en los datos disponibles
function actualizarFiltros() {
    // Obtener elementos select
    const filtroCliente = document.getElementById('filtroCliente');
    
    // Limpiar opciones existentes (excepto la primera)
    filtroCliente.innerHTML = '<option value="todos">Todos los clientes</option>';
    
    // Conjuntos para evitar duplicados
    const clientes = new Map(); // Map<NIT/Nombre, NombreCliente>
    
    // Recopilar valores únicos
    allData.forEach(item => {
        if (item.NombreCliente) {
            const key = item.NIT || item.NombreCliente;
            clientes.set(key, item.NombreCliente);
        }
    });
    
    // Agregar opciones para clientes
    clientes.forEach((nombre, id) => {
        const option = document.createElement('option');
        option.value = id;
        option.textContent = nombre;
        filtroCliente.appendChild(option);
    });
}

// Aplicar filtros a los datos
function aplicarFiltros() {
    const sucursalSeleccionada = document.getElementById('filtraSucursal').value;
    const clienteSeleccionado = document.getElementById('filtroCliente').value;
    const serieFiltro = document.getElementById('filtroSerie').value.toLowerCase();
    const productoFiltro = document.getElementById('filtroProducto').value.toLowerCase();
    
    filteredData = allData.filter(item => {
        // Filtrar por sucursal
        if (sucursalSeleccionada !== 'todas' && item.idSucursal != sucursalSeleccionada) {
            return false;
        }
        
        // Filtrar por cliente
        if (clienteSeleccionado !== 'todos') {
            const clienteKey = item.NIT || item.NombreCliente;
            if (clienteKey !== clienteSeleccionado) {
                return false;
            }
        }
        
        // Filtrar por serie (texto ingresado)
        if (serieFiltro && !item.Serie.toLowerCase().includes(serieFiltro)) {
            return false;
        }
        
        // Filtrar por producto (UPC o descripción)
        if (productoFiltro) {
            const upc = (item.Upc || '').toLowerCase();
            const descripcion = (item.DescLarga || '').toLowerCase();
            
            if (!upc.includes(productoFiltro) && !descripcion.includes(productoFiltro)) {
                return false;
            }
        }
        
        return true;
    });
    
    // Resetear la paginación y mostrar resultados
    currentPage = 1;
    mostrarPagina();
    
    // Actualizar gráficos si corresponde
    if (document.getElementById('resumenes').classList.contains('active')) {
        actualizarGraficos();
    }
}

// Inicializar los gráficos
function inicializarGraficos() {
    // Comprobar si Chart está disponible
    if (typeof Chart === 'undefined') {
        console.error('Error: Chart.js no está disponible');
        return; // Salir de la función
    }
    
    // Destruir gráficos existentes si los hay
    Object.values(charts).forEach(chart => {
        if (chart) chart.destroy();
    });
    
    try {
        // Crear gráficos vacíos
        const ctxProductos = document.getElementById('chartProductos');
        if (ctxProductos) {
            charts.productos = new Chart(ctxProductos, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Cantidad',
                        data: [],
                        backgroundColor: '#d32f2f'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            display: false
                        },
                        title: {
                            display: true,
                            text: 'Top 5 Productos por Cantidad'
                        }
                    }
                }
            });
        }
        
        const ctxClientes = document.getElementById('chartClientes');
        if (ctxClientes) {
            charts.clientes = new Chart(ctxClientes, {
                type: 'doughnut',
                data: {
                    labels: [],
                    datasets: [{
                        data: [],
                        backgroundColor: [
                            '#d32f2f', '#388e3c', '#ffa000', '#8e24aa', '#0288d1',
                            '#f44336', '#4caf50', '#ffb300', '#9c27b0', '#03a9f4'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        legend: {
                            position: 'right'
                        },
                        title: {
                            display: true,
                            text: 'Distribución por Cliente'
                        }
                    }
                }
            });
        }
        
        const ctxSucursales = document.getElementById('chartSucursales');
        if (ctxSucursales) {
            charts.sucursales = new Chart(ctxSucursales, {
                type: 'bar',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Ventas',
                        data: [],
                        backgroundColor: '#388e3c'
                    }]
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Cantidad de Ventas por Sucursal'
                        }
                    }
                }
            });
        }
        
        // Actualizar los gráficos con datos
        actualizarGraficos();
        
    } catch (error) {
        console.error('Error al inicializar gráficos:', error);
    }
}

// Actualizar gráficos con los datos actuales
function actualizarGraficos() {
    if (filteredData.length === 0) return;
    
    // Gráfico de top 5 productos
    const productosCount = {};
    filteredData.forEach(item => {
        const producto = item.DescLarga || `UPC: ${item.Upc}`;
        productosCount[producto] = (productosCount[producto] || 0) + item.Cantidad;
    });
    
    // Ordenar y obtener top 5
    const topProductos = Object.entries(productosCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    charts.productos.data.labels = topProductos.map(p => {
        // Acortar nombres muy largos
        const nombre = p[0];
        return nombre.length > 20 ? nombre.substring(0, 20) + '...' : nombre;
    });
    charts.productos.data.datasets[0].data = topProductos.map(p => p[1]);
    charts.productos.update();
    
    // Gráfico de distribución por cliente
    const clientesCount = {};
    filteredData.forEach(item => {
        const cliente = item.NombreCliente || 'Cliente Final';
        clientesCount[cliente] = (clientesCount[cliente] || 0) + 1;
    });
    
    // Ordenar y obtener top 10
    const topClientes = Object.entries(clientesCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    charts.clientes.data.labels = topClientes.map(c => {
        const nombre = c[0];
        return nombre.length > 15 ? nombre.substring(0, 15) + '...' : nombre;
    });
    charts.clientes.data.datasets[0].data = topClientes.map(c => c[1]);
    charts.clientes.update();
    
    // Gráfico por sucursal
    const sucursalesCount = {};
    filteredData.forEach(item => {
        sucursalesCount[item.NombreSucursal] = (sucursalesCount[item.NombreSucursal] || 0) + 1;
    });
    
    const sucursalesData = Object.entries(sucursalesCount).sort((a, b) => b[1] - a[1]);
    
    charts.sucursales.data.labels = sucursalesData.map(s => s[0]);
    charts.sucursales.data.datasets[0].data = sucursalesData.map(s => s[1]);
    charts.sucursales.update();
}

// Exportar los datos a Excel
async function exportarExcel() {
    if (filteredData.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay datos para exportar. Realice una consulta primero.',
            confirmButtonColor: '#d32f2f'
        });
        return;
    }
    
    mostrarCargando(true, 'Generando archivo Excel...');
    
    try {
        // Crear un nuevo libro de Excel
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema de Ventas Megared';
        workbook.lastModifiedBy = 'Usuario';
        workbook.created = new Date();
        workbook.modified = new Date();
        
        // Crear una hoja de datos general
        const worksheetGeneral = workbook.addWorksheet('Ventas');
        
        // Definir encabezados
        worksheetGeneral.columns = [
            { header: 'Sucursal', key: 'sucursal', width: 15 },
            { header: 'UPC', key: 'upc', width: 15 },
            { header: 'Descripción', key: 'descripcion', width: 30 },
            { header: 'Cantidad', key: 'cantidad', width: 10 },
            { header: 'Costo', key: 'costo', width: 12 },
            { header: 'Precio', key: 'precio', width: 12 },
            { header: 'Fecha', key: 'fecha', width: 15 },
            { header: 'NIT', key: 'nit', width: 15 },
            { header: 'Cliente', key: 'cliente', width: 25 },
            { header: 'Documento', key: 'documento', width: 12 },
            { header: 'Serie', key: 'serie', width: 10 },
            { header: 'UUID', key: 'uuid', width: 40 },
            { header: 'ID Caja', key: 'idcaja', width: 10 }
        ];
        
        // Dar formato a la fila de encabezados
        worksheetGeneral.getRow(1).font = { bold: true };
        worksheetGeneral.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'D32F2F' }
        };
        
        // Agregar los datos
        filteredData.forEach(item => {
            worksheetGeneral.addRow({
                sucursal: item.NombreSucursal,
                upc: item.Upc,
                descripcion: item.DescLarga || 'Sin descripción',
                cantidad: item.Cantidad,
                costo: item.CostoUnitario,
                precio: item.PrecioUnitario,
                fecha: new Date(item.Fecha),
                nit: item.NIT || 'C/F',
                cliente: item.NombreCliente || 'Sin nombre',
                documento: item.NoDocumento,
                serie: item.Serie,
                uuid: item.UUID,
                idcaja: item.IdCajas
            });
        });
        
        // Formato para los números
        worksheetGeneral.getColumn('costo').numFmt = '"Q"#,##0.00';
        worksheetGeneral.getColumn('precio').numFmt = '"Q"#,##0.00';
        worksheetGeneral.getColumn('fecha').numFmt = 'dd/mm/yyyy';
        
        // Crear una hoja de resumen por sucursales
        const worksheetResumen = workbook.addWorksheet('Resumen por Sucursal');
        
        // Definir encabezados del resumen
        worksheetResumen.columns = [
            { header: 'Sucursal', key: 'sucursal', width: 20 },
            { header: 'Total Ventas', key: 'ventas', width: 15 },
            { header: 'Total Facturas', key: 'facturas', width: 15 },
            { header: 'Estado', key: 'estado', width: 15 }
        ];
        
        // Dar formato a la fila de encabezados
        worksheetResumen.getRow(1).font = { bold: true };
        worksheetResumen.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'D32F2F' }
        };
        
        // Agregar datos de resumen por sucursal
        sucursales.forEach(sucursal => {
            const stats = sucursalStats[sucursal.idSucursal] || { ventas: 0, facturas: 0 };
            const estado = sucursalesEstado[sucursal.idSucursal] || 'pendiente';
            
            let estadoTexto = '';
            switch (estado) {
                case 'pendiente': estadoTexto = 'Pendiente'; break;
                case 'cargando': estadoTexto = 'Cargando'; break;
                case 'completo': estadoTexto = 'Completado'; break;
                case 'error': estadoTexto = 'Error'; break;
            }
            
            worksheetResumen.addRow({
                sucursal: sucursal.NombreSucursal,
                ventas: stats.ventas,
                facturas: stats.facturas,
                estado: estadoTexto
            });
            
            // Aplicar colores según el estado
            const lastRow = worksheetResumen.lastRow;
            const estadoCell = lastRow.getCell(4); // Columna de estado
            
            if (estado === 'completo') {
                estadoCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: '388E3C' } // Verde
                };
            } else if (estado === 'error') {
                estadoCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'D32F2F' } // Rojo
                };
            }
        });
        
        // Generar el archivo
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Crear un blob y descargar
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        
        const fechaInicio = document.getElementById('fechaInicio').value;
        const fechaFin = document.getElementById('fechaFin').value;
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `VentasMegared_${fechaInicio}_a_${fechaFin}.xlsx`;
        document.body.appendChild(a);
        a.click();
        
        // Limpiar
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        Swal.fire({
            icon: 'success',
            title: 'Exportación exitosa',
            text: 'El archivo Excel ha sido generado correctamente',
            confirmButtonColor: '#d32f2f'
        });
        
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de exportación',
            text: 'No se pudo generar el archivo Excel. ' + error.message,
            confirmButtonColor: '#d32f2f'
        });
    } finally {
        mostrarCargando(false);
    }
}

// Mostrar u ocultar el overlay de carga
function mostrarCargando(mostrar, mensaje = 'Procesando...') {
    const overlay = document.getElementById('loadingOverlay');
    
    if (mostrar) {
        overlay.querySelector('p').textContent = mensaje;
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
        // Forzar el redibujado del DOM para asegurar que el overlay se oculte
        setTimeout(() => {
            document.body.style.overflow = 'auto';
        }, 100);
    }
}

// Cambiar el tema de la aplicación
function toggleTheme() {
    const body = document.body;
    const themeButton = document.getElementById('themeToggle').querySelector('i');
    
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        themeButton.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.add('dark-theme');
        themeButton.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    }
}

// Cargar el tema guardado
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.getElementById('themeToggle').querySelector('i').className = 'fas fa-sun';
    }
}

// Formatear número como moneda
function formatCurrency(value) {
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 2
    }).format(value);
}

// Formatear fecha en formato yyyy-mm-dd
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// Función para debounce (retrasar la ejecución de una función)
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Función para truncar texto largo
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// Función para manejar errores de conexión
function manejarErrorConexion(error, contexto) {
    console.error(`Error en ${contexto}:`, error);
    
    let mensaje = 'Ocurrió un error inesperado.';
    
    // Intentar obtener un mensaje de error más específico
    if (error.sqlMessage) {
        mensaje = error.sqlMessage;
    } else if (error.message) {
        mensaje = error.message;
    }
    
    // Si es un error de conexión, dar un mensaje más amigable
    if (mensaje.includes('ECONNREFUSED') || mensaje.includes('ETIMEDOUT')) {
        mensaje = 'No se pudo conectar al servidor de la base de datos. Verifique la conexión de red.';
    } else if (mensaje.includes('Access denied')) {
        mensaje = 'Acceso denegado. Verifique las credenciales de la base de datos.';
    }
    
    Swal.fire({
        icon: 'error',
        title: 'Error',
        text: mensaje,
        confirmButtonColor: '#d32f2f'
    });
}

// Exportación de módulos para entornos modernos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        iniciarConsulta,
        obtenerSucursales,
        exportarExcel,
        reintentarConsultaSucursal
    };
}