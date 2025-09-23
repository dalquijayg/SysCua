// Importaciones (mantenemos las que indicaste y agregamos mysql2)
const Swal = require('sweetalert2');
const odbc = require('odbc');
const conexiondbsucursal = 'DSN=DBsucursal';
const ExcelJS = require('exceljs');
const mysql = require('mysql2/promise'); // Para conexiones a MySQL
const Chart = require('chart.js/auto');

// Variables globales
let allData = []; // Almacena todos los datos de inventario
let currentPage = 1;
const itemsPerPage = 100;
let sucursales = []; // Almacena información de las sucursales
let filteredData = []; // Datos filtrados actualmente visibles
let charts = {}; // Almacena las referencias a los gráficos

// Nuevas variables globales para el panel de sucursales
let sucursalesEstado = {}; // Almacena el estado de cada sucursal: 'pendiente', 'cargando', 'completo', 'error'
let sucursalStats = {}; // Estadísticas por sucursal: {productos, facturas}
let procesandoSucursal = false; // Control para evitar múltiples reintento simultáneos

// Nuevas variables para búsqueda por UPC
let upcList = []; // Lista de UPCs procesados para búsqueda
let upcSearchActive = false; // Indica si hay una búsqueda por UPC activa

// Objeto para mantener estadísticas (modificado)
const stats = {
    totalProductos: 0,
    totalProveedores: new Set(),
    totalSucursales: 0,
    totalFacturas: new Set() // Nuevo contador para facturas
};

async function conectar() {
    try {
        const connection = await odbc.connect(conexiondbsucursal);
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error);
        throw error;
    }
}

// Inicializar la aplicación cuando el DOM esté cargado
document.addEventListener('DOMContentLoaded', () => {
    initializeDatePickers();
    setupEventListeners();
    loadTheme();
    
    // Establecer fechas predeterminadas (actual y 7 días atrás)
    const today = new Date();
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(today.getDate() - 7);
    
    document.getElementById('fechaInicio').value = formatDate(oneWeekAgo);
    document.getElementById('fechaFin').value = formatDate(today);

    // Cargar las sucursales al iniciar
    obtenerSucursales();
    
    // Inicializar el panel de sucursales
    initializeSucursalesPanel();
    
    // Inicializar funcionalidad de UPC
    initializeUPCSearch();
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

// Inicializar funcionalidad de búsqueda por UPC
function initializeUPCSearch() {
    const upcInput = document.getElementById('busquedaUPC');
    const btnLimpiarUPC = document.getElementById('btnLimpiarUPC');
    const btnValidarUPC = document.getElementById('btnValidarUPC');
    
    // Event listener para el textarea de UPC con debounce
    upcInput.addEventListener('input', debounce(function() {
        processUPCInput(this.value);
    }, 300));
    
    // Event listener para limpiar UPCs
    btnLimpiarUPC.addEventListener('click', function() {
        clearUPCSearch();
    });
    
    // Event listener para validar UPCs
    btnValidarUPC.addEventListener('click', function() {
        showUPCList();
    });
}

// Procesar la entrada de UPCs
function processUPCInput(inputValue) {
    const upcCount = document.getElementById('upcCount');
    const upcStatus = document.getElementById('upcStatus');
    
    if (!inputValue.trim()) {
        upcList = [];
        upcSearchActive = false;
        upcCount.textContent = '0 UPCs ingresados';
        upcStatus.textContent = '';
        upcStatus.className = 'upc-status';
        return;
    }
    
    // Procesar y limpiar los UPCs
    const rawUPCs = inputValue
        .split(/[,\s\n\r]+/) // Dividir por comas, espacios, saltos de línea
        .map(upc => upc.trim()) // Eliminar espacios
        .filter(upc => upc.length > 0); // Filtrar vacíos
    
    // Validar UPCs (deben ser numéricos y tener longitud razonable)
    const validUPCs = [];
    const invalidUPCs = [];
    
    rawUPCs.forEach(upc => {
        if (/^\d+$/.test(upc) && upc.length >= 4 && upc.length <= 20) {
            validUPCs.push(upc);
        } else {
            invalidUPCs.push(upc);
        }
    });
    
    // Remover duplicados
    upcList = [...new Set(validUPCs)];
    upcSearchActive = upcList.length > 0;
    
    // Actualizar la interfaz
    updateUPCStatus(upcList.length, invalidUPCs.length);
}

// Actualizar el estado de la búsqueda de UPC
function updateUPCStatus(validCount, invalidCount) {
    const upcCount = document.getElementById('upcCount');
    const upcStatus = document.getElementById('upcStatus');
    
    upcCount.textContent = `${validCount} UPCs válidos`;
    
    if (invalidCount > 0) {
        upcStatus.textContent = `${invalidCount} UPCs inválidos encontrados`;
        upcStatus.className = 'upc-status warning';
    } else if (validCount > 0) {
        upcStatus.textContent = 'Listos para buscar';
        upcStatus.className = 'upc-status valid';
    } else {
        upcStatus.textContent = '';
        upcStatus.className = 'upc-status';
    }
}

// Limpiar la búsqueda de UPC
function clearUPCSearch() {
    document.getElementById('busquedaUPC').value = '';
    upcList = [];
    upcSearchActive = false;
    updateUPCStatus(0, 0);
    
    // Mostrar confirmación
    Swal.fire({
        icon: 'success',
        title: 'UPCs limpiados',
        text: 'Se ha limpiado la lista de UPCs para búsqueda',
        timer: 1500,
        showConfirmButton: false,
        toast: true,
        position: 'top-end'
    });
}

// Mostrar la lista de UPCs en un modal
function showUPCList() {
    if (upcList.length === 0) {
        Swal.fire({
            icon: 'info',
            title: 'Sin UPCs',
            text: 'No hay UPCs válidos para mostrar',
            confirmButtonColor: '#6a9ff5'
        });
        return;
    }
    
    // Clonar el template
    const template = document.getElementById('listaUPCTemplate');
    const modalHTML = template.innerHTML;
    
    Swal.fire({
        title: 'Lista de UPCs para Búsqueda',
        html: modalHTML,
        width: 700,
        showCancelButton: true,
        confirmButtonText: 'Cerrar',
        cancelButtonText: 'Buscar Ahora',
        confirmButtonColor: '#6a9ff5',
        cancelButtonColor: '#ff9a76',
        didOpen: () => {
            // Llenar el modal con los UPCs
            document.getElementById('totalUPCsModal').textContent = upcList.length;
            
            const listaContainer = document.getElementById('listaUPCsModal');
            listaContainer.innerHTML = '';
            
            upcList.forEach(upc => {
                const upcItem = document.createElement('div');
                upcItem.className = 'upc-item';
                upcItem.textContent = upc;
                listaContainer.appendChild(upcItem);
            });
            
            // Event listener para copiar la lista
            document.getElementById('btnCopiarUPCs').addEventListener('click', function() {
                const upcText = upcList.join(', ');
                navigator.clipboard.writeText(upcText).then(() => {
                    Swal.fire({
                        icon: 'success',
                        title: 'Copiado',
                        text: 'Lista de UPCs copiada al portapapeles',
                        timer: 1500,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                }).catch(() => {
                    // Fallback para navegadores que no soportan clipboard API
                    const textArea = document.createElement('textarea');
                    textArea.value = upcText;
                    document.body.appendChild(textArea);
                    textArea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textArea);
                    
                    Swal.fire({
                        icon: 'success',
                        title: 'Copiado',
                        text: 'Lista de UPCs copiada al portapapeles',
                        timer: 1500,
                        showConfirmButton: false,
                        toast: true,
                        position: 'top-end'
                    });
                });
            });
        }
    }).then((result) => {
        if (result.dismiss === Swal.DismissReason.cancel) {
            // El usuario hizo clic en "Buscar Ahora"
            iniciarConsulta();
        }
    });
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
        });
    });
    
    // Filtros
    document.getElementById('filtraSucursal').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroProveedor').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroRazon').addEventListener('change', aplicarFiltros);
    document.getElementById('filtroEstado').addEventListener('change', aplicarFiltros);
    
    // Detectar clic en una fila para mostrar detalles
    document.getElementById('datosInventarios').addEventListener('click', (e) => {
        // Encontrar la fila más cercana
        const row = e.target.closest('tr');
        if (row) {
            const index = row.getAttribute('data-index');
            if (index !== null) {
                mostrarDetalleProducto(filteredData[parseInt(index)]);
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
        const stats = sucursalStats[sucursal.idSucursal] || { productos: 0, facturas: 0 };
        
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
                        <span class="stat-productos" title="Productos"><i class="fas fa-boxes"></i> ${stats.productos}</span>
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
    
    const stats = sucursalStats[sucursal.idSucursal] || { productos: 0, facturas: 0 };
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
        confirmButtonColor: '#6a9ff5',
        showCancelButton: estado === 'error',
        cancelButtonText: 'Reintentar',
        cancelButtonColor: '#ff9a76',
        didOpen: () => {
            // Llenar los campos con la información de la sucursal
            document.getElementById('detalleSucursalId').textContent = sucursal.idSucursal;
            document.getElementById('detalleSucursalNombre').textContent = sucursal.NombreSucursal;
            document.getElementById('detalleSucursalProductos').textContent = stats.productos;
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

// Obtener las sucursales de la base de datos principal
async function obtenerSucursales() {
    mostrarCargando(true, 'Conectando a la base de datos principal...');
    
    try {
        // Conectar a la base de datos usando ODBC
        const connection = await conectar();
        
        // Ejecutar la consulta para obtener las sucursales (incluyendo Puerto)
        const query = `
            SELECT idSucursal, NombreSucursal, serverr, databasee, Uid, Pwd, Puerto
            FROM sucursales
            WHERE TipoSucursal IN (1, 2, 3) AND Activo = 1
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
            sucursalStats[sucursal.idSucursal] = { productos: 0, facturas: 0 };
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
            selectSucursal.appendChild(option);
        });
        
        // Mostrar las sucursales en el panel lateral
        mostrarSucursalesEnPanel();
        
        Swal.fire({
            icon: 'success',
            title: 'Conexión exitosa',
            text: `Se han encontrado ${sucursales.length} sucursales disponibles`,
            confirmButtonColor: '#6a9ff5'
        });
        
    } catch (error) {
        console.error('Error al obtener sucursales:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: 'No se pudieron obtener las sucursales. ' + error.message,
            confirmButtonColor: '#6a9ff5'
        });
    } finally {
        mostrarCargando(false);
    }
}

// Iniciar la consulta de datos (modificada para incluir búsqueda por UPC)
async function iniciarConsulta() {
    // Validar las fechas
    const fechaInicio = document.getElementById('fechaInicio').value;
    const fechaFin = document.getElementById('fechaFin').value;
    
    if (!fechaInicio || !fechaFin) {
        Swal.fire({
            icon: 'warning',
            title: 'Fechas requeridas',
            text: 'Por favor, seleccione un rango de fechas para la consulta',
            confirmButtonColor: '#6a9ff5'
        });
        return;
    }
    
    // Validar que haya sucursales disponibles
    if (sucursales.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'No hay sucursales',
            text: 'No se encontraron sucursales disponibles para consultar',
            confirmButtonColor: '#6a9ff5'
        });
        return;
    }
    
    // Determinar si es búsqueda por UPC
    const searchMode = upcSearchActive ? 'UPC' : 'general';
    
    // Mostrar información sobre el tipo de búsqueda
    let searchInfo = `Iniciando búsqueda ${searchMode}...`;
    if (searchMode === 'UPC') {
        searchInfo = `Buscando ${upcList.length} productos específicos...`;
    }
    
    // Reiniciar variables
    allData = [];
    filteredData = [];
    stats.totalProductos = 0;
    stats.totalProveedores = new Set();
    stats.totalFacturas = new Set();
    
    // Reiniciar estadísticas de sucursales pero mantener las que están en error
    sucursales.forEach(sucursal => {
        if (sucursalesEstado[sucursal.idSucursal] !== 'error') {
            sucursalesEstado[sucursal.idSucursal] = 'pendiente';
        }
        sucursalStats[sucursal.idSucursal] = { productos: 0, facturas: 0 };
    });
    
    // Actualizar el panel de sucursales
    mostrarSucursalesEnPanel();
    
    // Mostrar la barra de progreso
    const progressBar = document.getElementById('progressBar');
    const progressInfo = document.getElementById('progressInfo');
    progressBar.style.width = '0%';
    progressInfo.textContent = searchInfo;
    
    // Mostrar el overlay de carga
    mostrarCargando(true, searchInfo);
    
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
                const sucursalData = await consultarInventarioSucursal(
                    sucursal, 
                    fechaInicio, 
                    fechaFin, 
                    searchMode === 'UPC' ? upcList : null
                );
                
                // Agregar los datos al conjunto global
                if (sucursalData && sucursalData.length > 0) {
                    // Recopilar facturas únicas de esta sucursal
                    const facturasSet = new Set();
                    
                    // Añadir el ID y nombre de la sucursal a cada registro
                    sucursalData.forEach(item => {
                        item.idSucursal = sucursal.idSucursal;
                        item.NombreSucursal = sucursal.NombreSucursal;
                        
                        // Asegurarnos de que los IDs sean números
                        if (item.IdProveedores) {
                            item.IdProveedores = parseInt(item.IdProveedores);
                        }
                        
                        if (item.IdRazon) {
                            item.IdRazon = parseInt(item.IdRazon);
                        }
                        
                        // Registrar el proveedor para estadísticas
                        if (item.Proveedor) {
                            stats.totalProveedores.add(item.Proveedor);
                        }
                        
                        // Registrar la factura para estadísticas globales y por sucursal
                        if (item.Serie && item.Numero) {
                            const facturaId = `${item.Serie}-${item.Numero}`;
                            stats.totalFacturas.add(facturaId);
                            facturasSet.add(facturaId);
                        }
                    });
                    
                    allData = [...allData, ...sucursalData];
                    stats.totalProductos += sucursalData.length;
                    
                    // Actualizar estadísticas de la sucursal
                    sucursalStats[sucursal.idSucursal] = {
                        productos: sucursalData.length,
                        facturas: facturasSet.size
                    };
                } else {
                    // No se encontraron datos, pero la consulta fue exitosa
                    sucursalStats[sucursal.idSucursal] = {
                        productos: 0,
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
        progressInfo.textContent = `Consulta ${searchMode} finalizada. Se encontraron ${allData.length} registros en total.`;
        
        // Actualizar contadores
        actualizarContadores();
        
        // Actualizar filtros
        actualizarFiltros();
        
        // Mostrar los datos
        filteredData = [...allData];
        mostrarPagina();
        
        // Mensaje de éxito
        if (allData.length > 0) {
            const mensaje = searchMode === 'UPC' 
                ? `Se encontraron ${allData.length} registros para ${upcList.length} UPCs en ${sucursales.length} sucursales`
                : `Se encontraron ${allData.length} registros en ${sucursales.length} sucursales`;
                
            Swal.fire({
                icon: 'success',
                title: 'Consulta exitosa',
                text: mensaje,
                confirmButtonColor: '#6a9ff5'
            });
        } else {
            const mensaje = searchMode === 'UPC' 
                ? 'No se encontraron registros para los UPCs especificados en el periodo seleccionado'
                : 'No se encontraron registros para el periodo seleccionado';
                
            Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: mensaje,
                confirmButtonColor: '#6a9ff5'
            });
        }
        
    } catch (error) {
        console.error('Error en la consulta general:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error en la consulta',
            text: 'Ocurrió un error durante la consulta. ' + error.message,
            confirmButtonColor: '#6a9ff5'
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
            confirmButtonColor: '#6a9ff5'
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
            confirmButtonColor: '#6a9ff5'
        });
        procesandoSucursal = false;
        return;
    }
    
    const searchMode = upcSearchActive ? 'UPC' : 'general';
    
    try {
        // Actualizar estado de la sucursal a 'cargando'
        sucursalesEstado[sucursal.idSucursal] = 'cargando';
        mostrarSucursalesEnPanel();
        
        // Mostrar el overlay de carga
        const mensaje = searchMode === 'UPC' 
            ? `Reintentando búsqueda de ${upcList.length} UPCs para: ${sucursal.NombreSucursal}`
            : `Reintentando consulta para: ${sucursal.NombreSucursal}`;
            
        mostrarCargando(true, mensaje);
        
        // Consultar los datos de esta sucursal
        const sucursalData = await consultarInventarioSucursal(
            sucursal, 
            fechaInicio, 
            fechaFin, 
            searchMode === 'UPC' ? upcList : null
        );
        
        // Recopilar facturas únicas de esta sucursal
        const facturasSet = new Set();
        
        // Remover datos previos de esta sucursal si existen
        allData = allData.filter(item => item.idSucursal !== sucursal.idSucursal);
        
        if (sucursalData && sucursalData.length > 0) {
            // Añadir el ID y nombre de la sucursal a cada registro
            sucursalData.forEach(item => {
                item.idSucursal = sucursal.idSucursal;
                item.NombreSucursal = sucursal.NombreSucursal;
                
                // Asegurarnos de que los IDs sean números
                if (item.IdProveedores) {
                    item.IdProveedores = parseInt(item.IdProveedores);
                }
                
                if (item.IdRazon) {
                    item.IdRazon = parseInt(item.IdRazon);
                }
                
                // Registrar el proveedor para estadísticas
                if (item.Proveedor) {
                    stats.totalProveedores.add(item.Proveedor);
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
                productos: sucursalData.length,
                facturas: facturasSet.size
            };
            
            // Aplicar filtros actuales a los nuevos datos
            filteredData = [...allData];
            aplicarFiltros();
            
            // Actualizar la visualización
            mostrarPagina();
            
            // Marcar la sucursal como completada
            sucursalesEstado[sucursal.idSucursal] = 'completo';
            
            const mensaje = searchMode === 'UPC' 
                ? `Se encontraron ${sucursalData.length} registros para los UPCs especificados en ${sucursal.NombreSucursal}`
                : `Se encontraron ${sucursalData.length} registros en ${sucursal.NombreSucursal}`;
                
            Swal.fire({
                icon: 'success',
                title: 'Reintentar exitoso',
                text: mensaje,
                confirmButtonColor: '#6a9ff5'
            });
        } else {
            // No se encontraron datos, pero la consulta fue exitosa
            sucursalStats[sucursal.idSucursal] = {
                productos: 0,
                facturas: 0
            };
            
            // Marcar la sucursal como completada
            sucursalesEstado[sucursal.idSucursal] = 'completo';
            
            const mensaje = searchMode === 'UPC' 
                ? `No se encontraron registros para los UPCs especificados en ${sucursal.NombreSucursal} para el periodo seleccionado`
                : `No se encontraron registros en ${sucursal.NombreSucursal} para el periodo seleccionado`;
                
            Swal.fire({
                icon: 'info',
                title: 'Sin resultados',
                text: mensaje,
                confirmButtonColor: '#6a9ff5'
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
            confirmButtonColor: '#6a9ff5'
        });
    } finally {
        mostrarCargando(false);
        procesandoSucursal = false;
        mostrarSucursalesEnPanel();
    }
}

// Recalcular estadísticas totales
function recalcularEstadisticasTotales() {
    stats.totalProductos = 0;
    stats.totalProveedores = new Set();
    stats.totalFacturas = new Set();
    
    allData.forEach(item => {
        stats.totalProductos++;
        
        if (item.Proveedor) {
            stats.totalProveedores.add(item.Proveedor);
        }
        
        if (item.Serie && item.Numero) {
            stats.totalFacturas.add(`${item.Serie}-${item.Numero}`);
        }
    });
    
    // Actualizar los contadores en la interfaz
    actualizarContadores();
}

// Consultar inventario de una sucursal específica (modificada para incluir búsqueda por UPC)
async function consultarInventarioSucursal(sucursal, fechaInicio, fechaFin, upcList = null) {
    try {
        // Crear la configuración de conexión MySQL incluyendo el puerto
        const connectionConfig = {
            host: sucursal.serverr,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            database: sucursal.databasee
        };

        // Agregar el puerto si está definido y no es nulo/vacío
        if (sucursal.Puerto && sucursal.Puerto !== '' && sucursal.Puerto !== 0) {
            connectionConfig.port = parseInt(sucursal.Puerto);
        }
        
        // Crear la conexión a MySQL para esta sucursal
        const connection = await mysql.createConnection(connectionConfig);
        
        // Construir la consulta SQL base
        let query = `
            SELECT
                inventarios.idInventarios, 
                detalleinventarios.Upc, 
                COALESCE(productos.DescLarga, detalleinventarios.Descripcion) AS DescLarga,
                detalleinventarios.Cantidad_Rechequeo, 
                CASE 
                  WHEN detalleinventarios.UnidadesFardo IS NULL OR detalleinventarios.UnidadesFardo = '' OR detalleinventarios.UnidadesFardo = 0 
                  THEN detalleinventarios.Bonificacion_Rechequeo 
                  ELSE detalleinventarios.Bonificacion_Rechequeo * detalleinventarios.UnidadesFardo 
                END AS Bonificacion,
                detalleinventarios.Costo, 
                inventarios.FechaFactura, 
                inventarios.Fecha,
                inventarios.IdProveedores, 
                proveedores_facturas.Nombre AS Proveedor, 
                inventarios.Numero, 
                inventarios.Serie,
                inventarios.IdRazon,
                razonessociales.NombreRazon,  
                estado_operaciones.Estado,
                CASE 
                  WHEN inventarios.ReFacturarRS = 0 THEN 'Factura Sin problemas'
                  WHEN inventarios.ReFacturarRS = 1 THEN 'Refacturación'
                  ELSE 'Otro'
                END AS ReFacturarRS
            FROM
                detalleinventarios
                INNER JOIN inventarios ON detalleinventarios.IdInventarios = inventarios.idInventarios
                LEFT JOIN proveedores_facturas ON inventarios.IdProveedores = proveedores_facturas.Id
                INNER JOIN razonessociales ON inventarios.IdRazon = razonessociales.Id
                LEFT JOIN productos ON detalleinventarios.Upc = productos.Upc
                INNER JOIN estado_operaciones ON inventarios.Estado = estado_operaciones.IdEstado
            WHERE
                inventarios.IdProveedores > 0 AND
                inventarios.Fecha BETWEEN ? AND ? AND
                detalleinventarios.Detalle_Rechequeo = 0
        `;
        
        // Preparar los parámetros de la consulta
        const queryParams = [fechaInicio, fechaFin];
        
        // Si hay búsqueda por UPC, agregar la condición
        if (upcList && upcList.length > 0) {
            const placeholders = upcList.map(() => '?').join(',');
            query += ` AND detalleinventarios.Upc IN (${placeholders})`;
            queryParams.push(...upcList);
        }
        
        // Ejecutar la consulta
        const [rows] = await connection.execute(query, queryParams);
        
        // Cerrar la conexión
        await connection.end();
        
        return rows;
        
    } catch (error) {
        console.error(`Error al consultar la sucursal ${sucursal.NombreSucursal}:`, error);
        
        // Agregar información específica del puerto en el error si fue un problema de conexión
        if (error.code === 'ECONNREFUSED' && sucursal.Puerto) {
            console.error(`Puerto configurado: ${sucursal.Puerto}`);
            error.message += ` (Puerto: ${sucursal.Puerto})`;
        }
        
        throw error;
    }
}

// Mostrar una página de datos
function mostrarPagina() {
    const tbody = document.getElementById('datosInventarios');
    tbody.innerHTML = '';
    
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
            <td>${item.Cantidad_Rechequeo}</td>
            <td>${item.Bonificacion}</td>
            <td>${formatCurrency(item.Costo)}</td>
            <td>${formatDate(new Date(item.FechaFactura))}</td>
            <td>${item.Proveedor || 'Sin proveedor'}</td>
            <td>${item.Numero}</td>
            <td>${item.Serie}</td>
            <td>${item.NombreRazon}</td>
            <td>${item.Estado}</td>
            <td>${item.ReFacturarRS}</td>
        `;
        
        tbody.appendChild(tr);
    }
    
    // Actualizar la información de paginación
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    document.getElementById('paginaActual').textContent = `Página ${currentPage} de ${totalPages || 1}`;
    
    // Habilitar/deshabilitar botones de navegación
    document.getElementById('btnAnterior').disabled = currentPage <= 1;
    document.getElementById('btnSiguiente').disabled = currentPage >= totalPages;
}

// Actualizar los contadores de estadísticas
function actualizarContadores() {
    document.getElementById('totalSucursales').textContent = stats.totalSucursales;
    document.getElementById('totalProductos').textContent = stats.totalProductos;
    document.getElementById('totalProveedores').textContent = stats.totalProveedores.size;
    document.getElementById('totalFacturas').textContent = stats.totalFacturas.size;
}

// Actualizar los filtros basados en los datos disponibles
function actualizarFiltros() {
    // Obtener elementos select
    const filtroProveedor = document.getElementById('filtroProveedor');
    const filtroRazon = document.getElementById('filtroRazon');
    const filtroEstado = document.getElementById('filtroEstado');
    
    // Limpiar opciones existentes (excepto la primera)
    filtroProveedor.innerHTML = '<option value="todos">Todos los proveedores</option>';
    filtroRazon.innerHTML = '<option value="todas">Todas las razones</option>';
    filtroEstado.innerHTML = '<option value="todos">Todos los estados</option>';
    
    // Conjuntos para evitar duplicados - usamos Map para mantener ID y nombre
    const proveedores = new Map(); // Map<ID, Nombre>
    const razones = new Map();     // Map<ID, Nombre>
    const estados = new Set();
    
    // Recopilar valores únicos
    allData.forEach(item => {
        if (item.Proveedor && item.IdProveedores) {
            proveedores.set(item.IdProveedores, item.Proveedor);
        }
        
        if (item.NombreRazon && item.IdRazon) {
            razones.set(item.IdRazon, item.NombreRazon);
        }
        
        if (item.Estado) {
            estados.add(item.Estado);
        }
    });
    
    // Agregar opciones para proveedores - usando el ID como valor
    proveedores.forEach((nombre, id) => {
        const option = document.createElement('option');
        option.value = id;  // Usamos el ID como valor
        option.textContent = nombre;
        filtroProveedor.appendChild(option);
    });
    
    // Agregar opciones para razones sociales - usando el ID como valor
    razones.forEach((nombre, id) => {
        const option = document.createElement('option');
        option.value = id;  // Usamos el ID como valor
        option.textContent = nombre;
        filtroRazon.appendChild(option);
    });
    
    // Agregar opciones para estados
    estados.forEach(estado => {
        const option = document.createElement('option');
        option.value = estado;
        option.textContent = estado;
        filtroEstado.appendChild(option);
    });
}

// Aplicar filtros a los datos
function aplicarFiltros() {
    const sucursalSeleccionada = document.getElementById('filtraSucursal').value;
    const proveedorSeleccionado = document.getElementById('filtroProveedor').value;
    const razonSeleccionada = document.getElementById('filtroRazon').value;
    const estadoSeleccionado = document.getElementById('filtroEstado').value;
    
    filteredData = allData.filter(item => {
        // Filtrar por sucursal
        if (sucursalSeleccionada !== 'todas' && item.idSucursal != sucursalSeleccionada) {
            return false;
        }
        
        // Filtrar por proveedor (usando ID)
        if (proveedorSeleccionado !== 'todos' && 
            item.IdProveedores != proveedorSeleccionado) {
            return false;
        }
        
        // Filtrar por razón social (usando ID)
        if (razonSeleccionada !== 'todas' && 
            item.IdRazon != razonSeleccionada) {
            return false;
        }
        
        // Filtrar por estado
        if (estadoSeleccionado !== 'todos' && item.Estado !== estadoSeleccionado) {
            return false;
        }
        
        return true;
    });
    
    // Resetear la paginación y mostrar resultados
    currentPage = 1;
    mostrarPagina();
}

// Actualizar gráficos con los datos actuales
function actualizarGraficos() {
    if (filteredData.length === 0) return;
    
    // Gráfico de top 5 productos
    const productosCount = {};
    filteredData.forEach(item => {
        const producto = item.DescLarga || `UPC: ${item.Upc}`;
        productosCount[producto] = (productosCount[producto] || 0) + item.Cantidad_Rechequeo;
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
    
    // Gráfico de distribución por proveedor
    const proveedoresCount = {};
    filteredData.forEach(item => {
        const proveedor = item.Proveedor || 'Sin proveedor';
        proveedoresCount[proveedor] = (proveedoresCount[proveedor] || 0) + 1;
    });
    
    // Ordenar y obtener top 10
    const topProveedores = Object.entries(proveedoresCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    charts.proveedores.data.labels = topProveedores.map(p => {
        const nombre = p[0];
        return nombre.length > 15 ? nombre.substring(0, 15) + '...' : nombre;
    });
    charts.proveedores.data.datasets[0].data = topProveedores.map(p => p[1]);
    charts.proveedores.update();
    
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

// Exportar los datos a Excel (modificada para incluir información de búsqueda UPC)
async function exportarExcel() {
    if (filteredData.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay datos para exportar. Realice una consulta primero.',
            confirmButtonColor: '#6a9ff5'
        });
        return;
    }
    
    mostrarCargando(true, 'Generando archivo Excel...');
    
    try {
        // Crear un nuevo libro de Excel
        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'Sistema de Inventarios';
        workbook.lastModifiedBy = 'Usuario';
        workbook.created = new Date();
        workbook.modified = new Date();
        
        // Crear una hoja de datos general
        const worksheetGeneral = workbook.addWorksheet('Inventarios');
        
        // Definir encabezados
        worksheetGeneral.columns = [
            { header: 'Sucursal', key: 'sucursal', width: 15 },
            { header: 'UPC', key: 'upc', width: 15 },
            { header: 'Descripción', key: 'descripcion', width: 30 },
            { header: 'Cantidad', key: 'cantidad', width: 10 },
            { header: 'Bonificación', key: 'bonificacion', width: 12 },
            { header: 'Costo', key: 'costo', width: 12 },
            { header: 'Fecha Factura', key: 'fechaFactura', width: 15 },
            { header: 'Proveedor', key: 'proveedor', width: 20 },
            { header: 'Número', key: 'numero', width: 10 },
            { header: 'Serie', key: 'serie', width: 10 },
            { header: 'Razón Social', key: 'razon', width: 20 },
            { header: 'Estado', key: 'estado', width: 15 },
            { header: 'ReFacturar', key: 'refacturar', width: 15 }
        ];
        
        // Dar formato a la fila de encabezados
        worksheetGeneral.getRow(1).font = { bold: true };
        worksheetGeneral.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '6a9ff5' }
        };
        
        // Agregar los datos
        filteredData.forEach(item => {
            worksheetGeneral.addRow({
                sucursal: item.NombreSucursal,
                upc: item.Upc,
                descripcion: item.DescLarga || 'Sin descripción',
                cantidad: item.Cantidad_Rechequeo,
                bonificacion: item.Bonificacion,
                costo: item.Costo,
                fechaFactura: new Date(item.FechaFactura),
                proveedor: item.Proveedor || 'Sin proveedor',
                numero: item.Numero,
                serie: item.Serie,
                razon: item.NombreRazon,
                estado: item.Estado,
                refacturar: item.ReFacturarRS
            });
        });
        
        // Formato para los números
        worksheetGeneral.getColumn('costo').numFmt = '"Q"#,##0.00';
        worksheetGeneral.getColumn('fechaFactura').numFmt = 'dd/mm/yyyy';
        
        // Crear una hoja de resumen por sucursales
        const worksheetResumen = workbook.addWorksheet('Resumen por Sucursal');
        
        // Definir encabezados del resumen
        worksheetResumen.columns = [
            { header: 'Sucursal', key: 'sucursal', width: 20 },
            { header: 'Total Productos', key: 'productos', width: 15 },
            { header: 'Total Facturas', key: 'facturas', width: 15 },
            { header: 'Estado', key: 'estado', width: 15 }
        ];
        
        // Dar formato a la fila de encabezados
        worksheetResumen.getRow(1).font = { bold: true };
        worksheetResumen.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: '6a9ff5' }
        };
        
        // Agregar datos de resumen por sucursal
        sucursales.forEach(sucursal => {
            const stats = sucursalStats[sucursal.idSucursal] || { productos: 0, facturas: 0 };
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
                productos: stats.productos,
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
                    fgColor: { argb: '52c41a' } // Verde
                };
            } else if (estado === 'error') {
                estadoCell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'f5222d' } // Rojo
                };
            }
        });
        
        // Si hay búsqueda por UPC, crear hoja adicional con la información de búsqueda
        if (upcSearchActive && upcList.length > 0) {
            const worksheetUPC = workbook.addWorksheet('Búsqueda por UPC');
            
            // Información de la búsqueda
            worksheetUPC.columns = [
                { header: 'UPC Buscado', key: 'upc', width: 15 },
                { header: 'Encontrado', key: 'encontrado', width: 12 },
                { header: 'Registros', key: 'registros', width: 10 }
            ];
            
            // Dar formato a la fila de encabezados
            worksheetUPC.getRow(1).font = { bold: true };
            worksheetUPC.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'ffd166' }
            };
            
            // Analizar cuáles UPCs se encontraron
            const upcResults = {};
            upcList.forEach(upc => {
                upcResults[upc] = filteredData.filter(item => item.Upc === upc).length;
            });
            
            // Agregar resultados de búsqueda UPC
            Object.entries(upcResults).forEach(([upc, count]) => {
                worksheetUPC.addRow({
                    upc: upc,
                    encontrado: count > 0 ? 'Sí' : 'No',
                    registros: count
                });
                
                // Colorear según si se encontró o no
                const lastRow = worksheetUPC.lastRow;
                const encontradoCell = lastRow.getCell(2);
                
                if (count > 0) {
                    encontradoCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: '52c41a' } // Verde
                    };
                } else {
                    encontradoCell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'f5222d' } // Rojo
                    };
                }
            });
            
            // Agregar resumen de la búsqueda UPC
            worksheetUPC.addRow({});
            worksheetUPC.addRow({ upc: 'RESUMEN:' });
            worksheetUPC.addRow({ 
                upc: 'Total UPCs buscados:', 
                encontrado: upcList.length 
            });
            worksheetUPC.addRow({ 
                upc: 'UPCs encontrados:', 
                encontrado: Object.values(upcResults).filter(count => count > 0).length 
            });
            worksheetUPC.addRow({ 
                upc: 'Total registros:', 
                encontrado: filteredData.length 
            });
        }
        
        // Generar el archivo
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Crear un blob y descargar
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = window.URL.createObjectURL(blob);
        
        const fechaInicio = document.getElementById('fechaInicio').value;
        const fechaFin = document.getElementById('fechaFin').value;
        
        // Nombre del archivo según el tipo de búsqueda
        let fileName = `Inventarios_${fechaInicio}_a_${fechaFin}`;
        if (upcSearchActive && upcList.length > 0) {
            fileName += `_UPC_${upcList.length}productos`;
        }
        fileName += '.xlsx';
        
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        
        // Limpiar
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        const mensaje = upcSearchActive 
            ? `El archivo Excel ha sido generado con ${filteredData.length} registros para ${upcList.length} UPCs`
            : `El archivo Excel ha sido generado con ${filteredData.length} registros`;
            
        Swal.fire({
            icon: 'success',
            title: 'Exportación exitosa',
            text: mensaje,
            confirmButtonColor: '#6a9ff5'
        });
        
    } catch (error) {
        console.error('Error al exportar a Excel:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de exportación',
            text: 'No se pudo generar el archivo Excel. ' + error.message,
            confirmButtonColor: '#6a9ff5'
        });
    } finally {
        mostrarCargando(false);
    }
}

// Mostrar detalle de un producto
function mostrarDetalleProducto(item) {
    // Clonar el template
    const template = document.getElementById('detalleProductoTemplate');
    const detalleHTML = template.innerHTML;
    
    Swal.fire({
        title: 'Detalle del Producto',
        html: detalleHTML,
        width: 800,
        confirmButtonText: 'Cerrar',
        confirmButtonColor: '#6a9ff5',
        didOpen: () => {
            // Llenar los campos con la información del producto
            document.getElementById('detalleUpc').textContent = item.Upc;
            document.getElementById('detalleDescripcion').textContent = item.DescLarga || 'Sin descripción';
            document.getElementById('detalleCantidad').textContent = item.Cantidad_Rechequeo;
            document.getElementById('detalleBonificacion').textContent = item.Bonificacion;
            document.getElementById('detalleCosto').textContent = formatCurrency(item.Costo);
            document.getElementById('detalleProveedor').textContent = item.Proveedor || 'Sin proveedor';
            document.getElementById('detalleFactura').textContent = `${item.Serie}-${item.Numero} (${formatDate(new Date(item.FechaFactura))})`;
            document.getElementById('detalleEstado').textContent = item.Estado;
        }
    });
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

// Procesar los datos por lotes para mejorar el rendimiento
function procesarPorLotes(items, batchSize, processFn, completeFn) {
    let index = 0;
    
    function procesarLote() {
        const start = index;
        const end = Math.min(index + batchSize, items.length);
        
        for (let i = start; i < end; i++) {
            processFn(items[i], i);
        }
        
        index = end;
        
        if (index < items.length) {
            // Procesar el siguiente lote en el próximo ciclo del event loop
            setTimeout(procesarLote, 0);
        } else {
            // Completar el procesamiento
            if (completeFn) completeFn();
        }
    }
    
    // Iniciar procesamiento
    procesarLote();
}

// Función para buscar coincidencias en una cadena, ignorando mayúsculas y acentos
function coincide(texto, busqueda) {
    if (!busqueda || busqueda.trim() === '') return true;
    
    // Normalizar ambos textos (eliminar acentos)
    const textoNormalizado = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const busquedaNormalizada = busqueda.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    
    return textoNormalizado.includes(busquedaNormalizada);
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
    return text.substr(0, maxLength) + '...';
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
        confirmButtonColor: '#6a9ff5'
    });
}

// Exportación de módulos para entornos modernos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        iniciarConsulta,
        obtenerSucursales,
        exportarExcel,
        reintentarConsultaSucursal,
        processUPCInput,
        clearUPCSearch,
        showUPCList
    };
}