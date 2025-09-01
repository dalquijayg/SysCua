// Importaciones (mantenemos las mismas dependencias)
const Swal = require('sweetalert2');
const odbc = require('odbc');
const conexiondbsucursal = 'DSN=DBsucursal';
const ExcelJS = require('exceljs');
const mysql = require('mysql2/promise'); // Para conexiones a MySQL
const Chart = require('chart.js/auto');

// Variables globales
let allData = []; // Almacena todos los datos de facturas de bonificaciones
let currentPage = 1;
const itemsPerPage = 100;
let sucursales = []; // Almacena información de las sucursales
let filteredData = []; // Datos filtrados actualmente visibles
let charts = {}; // Almacena las referencias a los gráficos

// Variables para el panel de sucursales
let sucursalesEstado = {}; // Almacena el estado de cada sucursal: 'pendiente', 'cargando', 'completo', 'error'
let sucursalStats = {}; // Estadísticas por sucursal: {bonificaciones, facturas}
let procesandoSucursal = false; // Control para evitar múltiples reintento simultáneos

// Objeto para mantener estadísticas
const stats = {
    totalBonificaciones: 0,
    totalRazones: new Set(),
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
    document.getElementById('filtroRazonEmite').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroSerie').addEventListener('input', debounce(aplicarFiltros, 300)); // Con debounce para el campo de texto
    document.getElementById('filtroProducto').addEventListener('input', debounce(aplicarFiltros, 300));
    
    // Detectar clic en una fila para mostrar detalles
    document.getElementById('datosFacturas').addEventListener('click', (e) => {
        // Encontrar la fila más cercana
        const row = e.target.closest('tr');
        if (row) {
            const index = row.getAttribute('data-index');
            if (index !== null) {
                mostrarDetalleFactura(filteredData[parseInt(index)]);
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
        const stats = sucursalStats[sucursal.idSucursal] || { bonificaciones: 0, facturas: 0 };
        
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
                        <span class="stat-bonificaciones" title="Bonificaciones"><i class="fas fa-gift"></i> ${stats.bonificaciones}</span>
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
    
    const stats = sucursalStats[sucursal.idSucursal] || { bonificaciones: 0, facturas: 0 };
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
        confirmButtonColor: '#2196f3',
        showCancelButton: estado === 'error',
        cancelButtonText: 'Reintentar',
        cancelButtonColor: '#e74c3c',
        didOpen: () => {
            // Llenar los campos con la información de la sucursal
            document.getElementById('detalleSucursalId').textContent = sucursal.idSucursal;
            document.getElementById('detalleSucursalNombre').textContent = sucursal.NombreSucursal;
            document.getElementById('detalleSucursalBonificaciones').textContent = stats.bonificaciones;
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

// Mostrar detalle de una factura de bonificación
function mostrarDetalleFactura(item) {
    // Clonar el template
    const template = document.getElementById('detalleFacturaTemplate');
    const detalleHTML = template.innerHTML;
    
    Swal.fire({
        title: 'Detalle de la Factura de Bonificación',
        html: detalleHTML,
        width: 800,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#2196f3',
        didOpen: () => {
            // Llenar los campos con la información de la factura
            document.getElementById('detalleUpc').textContent = item.Upc;
            document.getElementById('detalleDescripcion').textContent = item.Descripcion || 'Sin descripción';
            document.getElementById('detalleCantidad').textContent = item.Cantidad;
            document.getElementById('detallePrecio').textContent = formatCurrency(item.Precio);
            document.getElementById('detalleFecha').textContent = formatDate(new Date(item.Fecha));
            document.getElementById('detalleRazonEmite').textContent = item.RazonSocialEmite || 'N/A';
            document.getElementById('detalleRazonRecibe').textContent = item.RazonSocialRecibe || 'N/A';
            document.getElementById('detalleFactura').textContent = `${item.Serie}-${item.Numero}`;
        }
    });
}
// Obtener las sucursales de la base de datos principal
async function obtenerSucursales() {
    mostrarCargando(true, 'Conectando a la base de datos principal...');
    
    try {
        // Conectar a la base de datos usando ODBC
        const connection = await odbc.connect(conexiondbsucursal);
        
        // Ejecutar la consulta para obtener las sucursales (RazonSocial = 3)
        const query = `
            SELECT idSucursal, NombreSucursal, serverr, databasee, Uid, Pwd, Puerto
            FROM sucursales
            WHERE RazonSocial = 3 AND Activo = 1
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
            sucursalStats[sucursal.idSucursal] = { bonificaciones: 0, facturas: 0 };
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
            confirmButtonColor: '#2196f3'
        });
        
    } catch (error) {
        console.error('Error al obtener sucursales:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudieron obtener las sucursales. ' + error.message,
            confirmButtonColor: '#2196f3'
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
            confirmButtonColor: '#2196f3'
        });
        return;
    }
    
    // Validar que haya sucursales disponibles
    if (sucursales.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'No hay sucursales',
            text: 'No se encontraron sucursales disponibles para consultar',
            confirmButtonColor: '#2196f3'
        });
        return;
    }
    
    // Reiniciar variables
    allData = [];
    filteredData = [];
    stats.totalBonificaciones = 0;
    stats.totalRazones = new Set();
    stats.totalFacturas = new Set();
    
    // Reiniciar estadísticas de sucursales pero mantener las que están en error
    sucursales.forEach(sucursal => {
        if (sucursalesEstado[sucursal.idSucursal] !== 'error') {
            sucursalesEstado[sucursal.idSucursal] = 'pendiente';
        }
        sucursalStats[sucursal.idSucursal] = { bonificaciones: 0, facturas: 0 };
    });
    
    // Actualizar el panel de sucursales
    mostrarSucursalesEnPanel();
    
    // Mostrar la barra de progreso
    const progressBar = document.getElementById('progressBar');
    const progressInfo = document.getElementById('progressInfo');
    progressBar.style.width = '0%';
    progressInfo.textContent = 'Iniciando consulta...';
    
    // Mostrar el overlay de carga
    mostrarCargando(true, 'Consultando facturas de bonificaciones...');
    
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
                const sucursalData = await consultarFacturasBonificacionesSucursal(sucursal, fechaInicio, fechaFin);
                
                // Recopilar facturas únicas de esta sucursal
                const facturasSet = new Set();
                
                // Agregar los datos al conjunto global
                if (sucursalData && sucursalData.length > 0) {
                    // Añadir el ID y nombre de la sucursal a cada registro
                    sucursalData.forEach(item => {
                        item.idSucursal = sucursal.idSucursal;
                        item.NombreSucursal = sucursal.NombreSucursal;
                        
                        // Registrar las razones sociales para estadísticas
                        if (item.RazonSocialEmite) {
                            stats.totalRazones.add(item.RazonSocialEmite);
                        }
                        if (item.RazonSocialRecibe) {
                            stats.totalRazones.add(item.RazonSocialRecibe);
                        }
                        
                        // Registrar la factura para estadísticas globales y por sucursal
                        if (item.Serie && item.Numero) {
                            const facturaId = `${item.Serie}-${item.Numero}`;
                            stats.totalFacturas.add(facturaId);
                            facturasSet.add(facturaId);
                        }
                    });
                    
                    allData = [...allData, ...sucursalData];
                    stats.totalBonificaciones += sucursalData.length;
                    
                    // Actualizar estadísticas de la sucursal
                    sucursalStats[sucursal.idSucursal] = {
                        bonificaciones: sucursalData.length,
                        facturas: facturasSet.size
                    };
                } else {
                    // No se encontraron datos, pero la consulta fue exitosa
                    sucursalStats[sucursal.idSucursal] = {
                        bonificaciones: 0,
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
                confirmButtonColor: '#2196f3'
            });
        } else {
            Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: 'No se encontraron registros para el periodo seleccionado',
                confirmButtonColor: '#2196f3'
            });
        }
        
    } catch (error) {
        console.error('Error en la consulta general:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error en la consulta',
            text: 'Ocurrió un error durante la consulta. ' + error.message,
            confirmButtonColor: '#2196f3'
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
            confirmButtonColor: '#2196f3'
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
            confirmButtonColor: '#2196f3'
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
        
        // Consultar los datos de esta sucursal (ya usa el puerto gracias a consultarFacturasBonificacionesSucursal actualizada)
        const sucursalData = await consultarFacturasBonificacionesSucursal(sucursal, fechaInicio, fechaFin);
        
        // Recopilar facturas únicas de esta sucursal
        const facturasSet = new Set();
        
        // Remover datos previos de esta sucursal si existen
        allData = allData.filter(item => item.idSucursal !== sucursal.idSucursal);
        
        if (sucursalData && sucursalData.length > 0) {
            // Añadir el ID y nombre de la sucursal a cada registro
            sucursalData.forEach(item => {
                item.idSucursal = sucursal.idSucursal;
                item.NombreSucursal = sucursal.NombreSucursal;
                
                // Registrar las razones sociales para estadísticas
                if (item.RazonSocialEmite) {
                    stats.totalRazones.add(item.RazonSocialEmite);
                }
                if (item.RazonSocialRecibe) {
                    stats.totalRazones.add(item.RazonSocialRecibe);
                }
                
                // Registrar la factura para estadísticas globales y por sucursal
                if (item.Serie && item.Numero) {
                    const facturaId = `${item.Serie}-${item.Numero}`;
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
                bonificaciones: sucursalData.length,
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
                confirmButtonColor: '#2196f3'
            });
        } else {
            // No se encontraron datos, pero la consulta fue exitosa
            sucursalStats[sucursal.idSucursal] = {
                bonificaciones: 0,
                facturas: 0
            };
            
            // Marcar la sucursal como completada
            sucursalesEstado[sucursal.idSucursal] = 'completo';
            
            Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: `No se encontraron registros en ${sucursal.NombreSucursal} para el periodo seleccionado`,
                confirmButtonColor: '#2196f3'
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
            confirmButtonColor: '#2196f3'
        });
    } finally {
        mostrarCargando(false);
        procesandoSucursal = false;
        mostrarSucursalesEnPanel();
    }
}

// Recalcular estadísticas totales
function recalcularEstadisticasTotales() {
    stats.totalBonificaciones = 0;
    stats.totalRazones = new Set();
    stats.totalFacturas = new Set();
    
    allData.forEach(item => {
        stats.totalBonificaciones++;
        
        if (item.RazonSocialEmite) {
            stats.totalRazones.add(item.RazonSocialEmite);
        }
        if (item.RazonSocialRecibe) {
            stats.totalRazones.add(item.RazonSocialRecibe);
        }
        
        if (item.Serie && item.Numero) {
            stats.totalFacturas.add(`${item.Serie}-${item.Numero}`);
        }
    });
    
    // Actualizar los contadores en la interfaz
    actualizarContadores();
}

// Consultar facturas de bonificaciones de una sucursal específica
async function consultarFacturasBonificacionesSucursal(sucursal, fechaInicio, fechaFin) {
    try {
        // Crear la conexión a MySQL para esta sucursal incluyendo el puerto
        const connection = await mysql.createConnection({
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306, // Usar el puerto de la sucursal o 3306 por defecto
            user: sucursal.Uid,
            password: sucursal.Pwd,
            database: sucursal.databasee
        });
        
        // Consulta SQL para facturas de bonificaciones
        const query = `
            SELECT
                facturasbonificaciones.Id, 
                detallefacturasbonificaciones.Upc, 
                detallefacturasbonificaciones.Descripcion, 
                detallefacturasbonificaciones.Cantidad, 
                detallefacturasbonificaciones.Precio, 
                facturasbonificaciones.Serie, 
                facturasbonificaciones.Numero, 
                facturasbonificaciones.UUID, 
                facturasbonificaciones.Fecha, 
                facturasbonificaciones.IdRazonesEmite, 
                facturasbonificaciones.IdRazonesRecibe, 
                facturasbonificaciones.RazonSocialEmite, 
                facturasbonificaciones.RazonSocialRecibe
            FROM
                facturasbonificaciones
                INNER JOIN
                detallefacturasbonificaciones
                ON 
                    facturasbonificaciones.Id = detallefacturasbonificaciones.IdFacturasBonificaciones
            WHERE
                facturasbonificaciones.Fecha BETWEEN ? AND ?
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
// Función para formatear fechas (YYYY-MM-DD)
function formatDate(date) {
    const d = new Date(date);
    let month = '' + (d.getMonth() + 1);
    let day = '' + d.getDate();
    const year = d.getFullYear();

    if (month.length < 2) month = '0' + month;
    if (day.length < 2) day = '0' + day;

    return [year, month, day].join('-');
}

// Función para formatear moneda
function formatCurrency(amount) {
    return new Intl.NumberFormat('es-MX', {
        style: 'currency',
        currency: 'MXN'
    }).format(amount);
}

// Función para mostrar/ocultar el indicador de carga
function mostrarCargando(mostrar, mensaje = 'Cargando...') {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (mostrar) {
        loadingOverlay.querySelector('p').textContent = mensaje;
        loadingOverlay.classList.remove('hidden');
    } else {
        loadingOverlay.classList.add('hidden');
    }
}

// Función para actualizar los contadores en la interfaz
function actualizarContadores() {
    document.getElementById('totalSucursales').textContent = stats.totalSucursales;
    document.getElementById('totalBonificaciones').textContent = stats.totalBonificaciones;
    document.getElementById('totalRazones').textContent = stats.totalRazones.size;
    document.getElementById('totalFacturas').textContent = stats.totalFacturas.size;
}

// Función para mostrar la página actual de datos
function mostrarPagina() {
    const tabla = document.getElementById('datosFacturas');
    tabla.innerHTML = '';
    
    // Calcular índices de inicio y fin para la paginación
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    
    // Si no hay datos
    if (filteredData.length === 0) {
        const row = document.createElement('tr');
        const cell = document.createElement('td');
        cell.colSpan = 11;
        cell.textContent = 'No se encontraron registros';
        cell.style.textAlign = 'center';
        row.appendChild(cell);
        tabla.appendChild(row);
    } else {
        // Mostrar los datos de la página actual
        for (let i = startIndex; i < endIndex; i++) {
            const item = filteredData[i];
            const row = document.createElement('tr');
            row.setAttribute('data-index', i);
            
            // Crear celdas para cada propiedad
            row.innerHTML = `
                <td>${item.NombreSucursal || 'N/A'}</td>
                <td>${item.Upc || 'N/A'}</td>
                <td>${item.Descripcion || 'Sin descripción'}</td>
                <td>${item.Cantidad || 0}</td>
                <td>${formatCurrency(item.Precio || 0)}</td>
                <td>${formatDate(item.Fecha)}</td>
                <td>${item.Serie || 'N/A'}</td>
                <td>${item.Numero || 'N/A'}</td>
                <td>${item.RazonSocialEmite || 'N/A'}</td>
                <td>${item.RazonSocialRecibe || 'N/A'}</td>
                <td>${item.UUID || 'N/A'}</td>
            `;
            
            tabla.appendChild(row);
        }
    }
    
    // Actualizar la información de la paginación
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    document.getElementById('paginaActual').textContent = `Página ${currentPage} de ${totalPages || 1}`;
    
    // Habilitar/deshabilitar botones de paginación
    document.getElementById('btnAnterior').disabled = currentPage <= 1;
    document.getElementById('btnSiguiente').disabled = currentPage >= totalPages || totalPages === 0;
}

// Función para aplicar filtros a los datos
function aplicarFiltros() {
    const filtroSucursal = document.getElementById('filtraSucursal').value;
    const filtroRazon = document.getElementById('filtroRazonEmite').value;
    const filtroSerie = document.getElementById('filtroSerie').value.toLowerCase();
    const filtroProducto = document.getElementById('filtroProducto').value.toLowerCase();
    
    // Aplicar todos los filtros a la vez
    filteredData = allData.filter(item => {
        // Filtro de sucursal
        if (filtroSucursal !== 'todas' && item.idSucursal !== parseInt(filtroSucursal)) {
            return false;
        }
        
        // Filtro de razón social
        if (filtroRazon !== 'todas' && item.RazonSocialEmite !== filtroRazon) {
            return false;
        }
        
        // Filtro de serie
        if (filtroSerie !== '' && (!item.Serie || !item.Serie.toLowerCase().includes(filtroSerie))) {
            return false;
        }
        
        // Filtro de producto (por UPC o descripción)
        if (filtroProducto !== '') {
            const upcMatch = item.Upc && item.Upc.toLowerCase().includes(filtroProducto);
            const descMatch = item.Descripcion && item.Descripcion.toLowerCase().includes(filtroProducto);
            if (!upcMatch && !descMatch) {
                return false;
            }
        }
        
        return true;
    });
    
    // Resetear a la primera página y mostrar resultados
    currentPage = 1;
    mostrarPagina();
}

// Función para actualizar los filtros disponibles basados en los datos
function actualizarFiltros() {
    // Actualizar filtro de razón social que emite
    const selectRazon = document.getElementById('filtroRazonEmite');
    
    // Guardar el valor actual si existe
    const valorActual = selectRazon.value;
    
    // Limpiar opciones existentes (excepto la primera)
    selectRazon.innerHTML = '<option value="todas">Todas las razones</option>';
    
    // Obtener razones sociales únicas que emiten
    const razonesEmite = new Set();
    allData.forEach(item => {
        if (item.RazonSocialEmite && item.RazonSocialEmite.trim() !== '') {
            razonesEmite.add(item.RazonSocialEmite);
        }
    });
    
    // Agregar las opciones al select
    razonesEmite.forEach(razon => {
        const option = document.createElement('option');
        option.value = razon;
        option.textContent = razon;
        selectRazon.appendChild(option);
    });
    
    // Restaurar el valor seleccionado si existe
    if (valorActual !== 'todas' && [...razonesEmite].includes(valorActual)) {
        selectRazon.value = valorActual;
    }
}

// Función para exportar a Excel
async function exportarExcel() {
    if (filteredData.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay datos para exportar',
            confirmButtonColor: '#2196f3'
        });
        return;
    }
    
    mostrarCargando(true, 'Generando archivo Excel...');
    
    try {
        // Crear un nuevo libro de Excel
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Facturas de Bonificaciones');
        
        // Definir las columnas
        worksheet.columns = [
            { header: 'Sucursal', key: 'sucursal', width: 20 },
            { header: 'UPC', key: 'upc', width: 15 },
            { header: 'Descripción', key: 'descripcion', width: 30 },
            { header: 'Cantidad', key: 'cantidad', width: 10 },
            { header: 'Precio', key: 'precio', width: 15 },
            { header: 'Fecha', key: 'fecha', width: 15 },
            { header: 'Serie', key: 'serie', width: 10 },
            { header: 'Número', key: 'numero', width: 10 },
            { header: 'Razón Emite', key: 'razonEmite', width: 25 },
            { header: 'Razón Recibe', key: 'razonRecibe', width: 25 },
            { header: 'UUID', key: 'uuid', width: 40 }
        ];
        
        // Estilo para la cabecera
        worksheet.getRow(1).font = {
            bold: true,
            color: { argb: '2196F3' }
        };
        
        // Añadir los datos
        filteredData.forEach(item => {
            worksheet.addRow({
                sucursal: item.NombreSucursal || '',
                upc: item.Upc || '',
                descripcion: item.Descripcion || '',
                cantidad: item.Cantidad || 0,
                precio: item.Precio || 0,
                fecha: item.Fecha ? new Date(item.Fecha) : null,
                serie: item.Serie || '',
                numero: item.Numero || '',
                razonEmite: item.RazonSocialEmite || '',
                razonRecibe: item.RazonSocialRecibe || '',
                uuid: item.UUID || ''
            });
        });
        
        // Formatear la columna de precios
        worksheet.getColumn('precio').numFmt = '"$"#,##0.00';
        
        // Formatear la columna de fechas
        worksheet.getColumn('fecha').numFmt = 'dd/mm/yyyy';
        
        // Generar el archivo
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Crear un blob con el buffer
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        // Crear URL para descargar
        const url = window.URL.createObjectURL(blob);
        
        // Crear un enlace y simular clic para descargar
        const a = document.createElement('a');
        a.href = url;
        
        // Nombre del archivo con fecha actual
        const fechaArchivo = new Date().toISOString().slice(0, 10);
        a.download = `Facturas_Bonificaciones_${fechaArchivo}.xlsx`;
        
        document.body.appendChild(a);
        a.click();
        
        // Limpiar
        setTimeout(() => {
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 0);
        
        Swal.fire({
            icon: 'success',
            title: 'Exportación exitosa',
            text: `Se ha exportado un archivo con ${filteredData.length} registros`,
            confirmButtonColor: '#2196f3'
        });
        
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error en la exportación',
            text: 'No se pudo generar el archivo Excel. ' + error.message,
            confirmButtonColor: '#2196f3'
        });
    } finally {
        mostrarCargando(false);
    }
}

// Función para inicializar los gráficos
function inicializarGraficos() {
    // Destruir gráficos existentes si los hay
    if (charts.productos) charts.productos.destroy();
    if (charts.razones) charts.razones.destroy();
    if (charts.sucursales) charts.sucursales.destroy();
    
    // Si no hay datos, no crear gráficos
    if (filteredData.length === 0) return;
    
    // Configuración común para los gráficos
    const commonOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                position: 'bottom',
                labels: {
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-color')
                }
            }
        }
    };
    
    // 1. Gráfico de productos más bonificados
    const productosData = {};
    filteredData.forEach(item => {
        const producto = item.Descripcion || `UPC: ${item.Upc}`;
        if (!productosData[producto]) {
            productosData[producto] = 0;
        }
        productosData[producto] += parseInt(item.Cantidad) || 1;
    });
    
    // Ordenar y tomar los top 5
    const topProductos = Object.entries(productosData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const ctxProductos = document.getElementById('chartProductos').getContext('2d');
    charts.productos = new Chart(ctxProductos, {
        type: 'bar',
        data: {
            labels: topProductos.map(p => truncateString(p[0], 20)),
            datasets: [{
                label: 'Cantidad',
                data: topProductos.map(p => p[1]),
                backgroundColor: [
                    '#2196f3', '#ff9800', '#8bc34a', '#03a9f4', '#673ab7'
                ],
                borderWidth: 1
            }]
        },
        options: {
            ...commonOptions,
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color')
                    }
                },
                x: {
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color')
                    }
                }
            }
        }
    });
    
    // 2. Gráfico de distribución por razón social
    const razonesData = {};
    filteredData.forEach(item => {
        const razon = item.RazonSocialEmite || 'Sin razón social';
        if (!razonesData[razon]) {
            razonesData[razon] = 0;
        }
        razonesData[razon]++;
    });
    
    const ctxRazones = document.getElementById('chartRazones').getContext('2d');
    charts.razones = new Chart(ctxRazones, {
        type: 'pie',
        data: {
            labels: Object.keys(razonesData),
            datasets: [{
                data: Object.values(razonesData),
                backgroundColor: [
                    '#2196f3', '#ff9800', '#8bc34a', '#03a9f4', '#673ab7', 
                    '#e91e63', '#f44336', '#009688', '#ffeb3b', '#795548'
                ],
                borderWidth: 1
            }]
        },
        options: commonOptions
    });
    
    // 3. Gráfico de bonificaciones por sucursal
    const sucursalesData = {};
    filteredData.forEach(item => {
        const sucursal = item.NombreSucursal || 'Sin sucursal';
        if (!sucursalesData[sucursal]) {
            sucursalesData[sucursal] = 0;
        }
        sucursalesData[sucursal]++;
    });
    
    const ctxSucursales = document.getElementById('chartSucursales').getContext('2d');
    charts.sucursales = new Chart(ctxSucursales, {
        type: 'doughnut',
        data: {
            labels: Object.keys(sucursalesData),
            datasets: [{
                data: Object.values(sucursalesData),
                backgroundColor: [
                    '#2196f3', '#ff9800', '#8bc34a', '#03a9f4', '#673ab7', 
                    '#e91e63', '#f44336', '#009688', '#ffeb3b', '#795548'
                ],
                borderWidth: 1
            }]
        },
        options: commonOptions
    });
}

// Función para actualizar los gráficos con datos filtrados
function actualizarGraficos() {
    // Si no hay gráficos inicializados, crearlos
    if (!charts.productos) {
        inicializarGraficos();
        return;
    }
    
    // Si no hay datos, limpiar los gráficos
    if (filteredData.length === 0) {
        charts.productos.data.labels = [];
        charts.productos.data.datasets[0].data = [];
        charts.razones.data.labels = [];
        charts.razones.data.datasets[0].data = [];
        charts.sucursales.data.labels = [];
        charts.sucursales.data.datasets[0].data = [];
        
        charts.productos.update();
        charts.razones.update();
        charts.sucursales.update();
        return;
    }
    
    // 1. Actualizar gráfico de productos
    const productosData = {};
    filteredData.forEach(item => {
        const producto = item.Descripcion || `UPC: ${item.Upc}`;
        if (!productosData[producto]) {
            productosData[producto] = 0;
        }
        productosData[producto] += parseInt(item.Cantidad) || 1;
    });
    
    const topProductos = Object.entries(productosData)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    charts.productos.data.labels = topProductos.map(p => truncateString(p[0], 20));
    charts.productos.data.datasets[0].data = topProductos.map(p => p[1]);
    charts.productos.update();
    
    // 2. Actualizar gráfico de razones sociales
    const razonesData = {};
    filteredData.forEach(item => {
        const razon = item.RazonSocialEmite || 'Sin razón social';
        if (!razonesData[razon]) {
            razonesData[razon] = 0;
        }
        razonesData[razon]++;
    });
    
    charts.razones.data.labels = Object.keys(razonesData);
    charts.razones.data.datasets[0].data = Object.values(razonesData);
    charts.razones.update();
    
    // 3. Actualizar gráfico de sucursales
    const sucursalesData = {};
    filteredData.forEach(item => {
        const sucursal = item.NombreSucursal || 'Sin sucursal';
        if (!sucursalesData[sucursal]) {
            sucursalesData[sucursal] = 0;
        }
        sucursalesData[sucursal]++;
    });
    
    charts.sucursales.data.labels = Object.keys(sucursalesData);
    charts.sucursales.data.datasets[0].data = Object.values(sucursalesData);
    charts.sucursales.update();
}

// Función para truncar strings largos
function truncateString(str, length) {
    if (str.length <= length) return str;
    return str.substring(0, length) + '...';
}

// Función para cambiar el tema (claro/oscuro)
function toggleTheme() {
    const body = document.body;
    const themeIcon = document.querySelector('#themeToggle i');
    
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        themeIcon.className = 'fas fa-moon';
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.add('dark-theme');
        themeIcon.className = 'fas fa-sun';
        localStorage.setItem('theme', 'dark');
    }
    
    // Actualizar gráficos si existen
    if (charts.productos) {
        actualizarGraficos();
    }
}

// Función para cargar el tema guardado
function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        document.querySelector('#themeToggle i').className = 'fas fa-sun';
    }
}

// Función de debounce para evitar múltiples llamadas rápidas
function debounce(func, delay) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}