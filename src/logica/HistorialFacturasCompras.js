const odbc = require('odbc');
const Swal = require('sweetalert2');

// Variables globales
let currentData = [];
let filteredData = [];
let currentPage = 1;
let pageSize = 25;
let totalRecords = 0;
let isLoading = false;
let tipoModificacion, razonModificacion;
let razonesModificacion = []; 

// Elementos del DOM
let filtersForm, fechaDesde, fechaHasta, tipoCambio, usuarioFiltro;
let resultsPanel, changesTable, changesTableBody;
let tableLoading, tableEmpty, paginationContainer;
let totalChanges, resultsCount, resultsPeriod;

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar elementos del DOM
    initializeDOMElements();
    
    // Inicializar la aplicación
    initializeApp();
    
    // Configurar event listeners
    setupEventListeners();
});

// Inicializar elementos del DOM
function initializeDOMElements() {
    // Formulario y filtros
    filtersForm = document.getElementById('filtersForm');
    fechaDesde = document.getElementById('fechaDesde');
    fechaHasta = document.getElementById('fechaHasta');
    tipoCambio = document.getElementById('tipoCambio');
    tipoModificacion = document.getElementById('tipoModificacion');
    razonModificacion = document.getElementById('razonModificacion');
    
    // Paneles principales
    resultsPanel = document.getElementById('resultsPanel');
    
    // Tabla y estados
    changesTable = document.getElementById('changesTable');
    changesTableBody = document.getElementById('changesTableBody');
    tableLoading = document.getElementById('tableLoading');
    tableEmpty = document.getElementById('tableEmpty');
    paginationContainer = document.getElementById('paginationContainer');
    
    // Elementos de información
    totalChanges = document.getElementById('totalChanges');
    resultsCount = document.getElementById('resultsCount');
    resultsPeriod = document.getElementById('resultsPeriod');
    
    // Verificar elementos críticos
    if (!filtersForm || !fechaDesde || !fechaHasta) {
        showErrorToast('Error al inicializar la aplicación');
        return false;
    }
    
    return true;
}

// Inicializar la aplicación
function initializeApp() {
    
    // Animar elementos de entrada
    animatePageElements();
    
    // Cargar información del usuario
    loadUserInfo();
    
    // Establecer fechas por defecto
    setDefaultDates();
    
    // Mostrar panel de bienvenida
    showWelcomePanel();
}

// Animar elementos de la página
function animatePageElements() {
    const elements = [
        document.querySelector('.filters-panel'),
        document.querySelector('.welcome-panel')
    ];

    elements.forEach((element, index) => {
        if (element) {
            element.style.opacity = '0';
            element.style.transform = 'translateY(30px)';
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            
            setTimeout(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, 200 + (index * 100));
        }
    });
}

// Cargar información del usuario
function loadUserInfo() {
    const userName = localStorage.getItem('userName');
    const userNameElement = document.getElementById('userName');
    
    if (userName && userNameElement) {
        userNameElement.textContent = userName;
    }
}

// Establecer fechas por defecto (último mes)
function setDefaultDates() {
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());
    
    fechaDesde.value = formatDateForInput(lastMonth);
    fechaHasta.value = formatDateForInput(today);
}

// Formatear fecha para input
function formatDateForInput(date) {
    // Si viene como string, convertir a Date
    if (typeof date === 'string') {
        const [year, month, day] = date.split('T')[0].split('-').map(Number);
        date = new Date(year, month - 1, day);
    }
    
    // Obtener componentes locales
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// Configurar event listeners
function setupEventListeners() {
    // Formulario de filtros
    filtersForm.addEventListener('submit', handleSearch);
    tipoModificacion.addEventListener('change', handleTipoModificacionChange);
    // Botones de acción
    document.getElementById('limpiarFiltros').addEventListener('click', clearFilters);
    document.getElementById('nuevaBusqueda').addEventListener('click', showWelcomePanel);
    
    // Paginación
    document.getElementById('pageSize').addEventListener('change', handlePageSizeChange);
    document.getElementById('firstPage').addEventListener('click', () => goToPage(1));
    document.getElementById('prevPage').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('nextPage').addEventListener('click', () => goToPage(currentPage + 1));
    document.getElementById('lastPage').addEventListener('click', () => goToPage(Math.ceil(totalRecords / pageSize)));
    
    // Modal de detalles
    document.getElementById('closeChangeDetailModal').addEventListener('click', closeChangeDetailModal);
    document.getElementById('closeDetailModal').addEventListener('click', closeChangeDetailModal);
    
    // Cerrar modal al hacer clic fuera
    document.getElementById('changeDetailModal').addEventListener('click', (e) => {
        if (e.target.id === 'changeDetailModal') {
            closeChangeDetailModal();
        }
    });
}
async function handleTipoModificacionChange() {
    const tipo = tipoModificacion.value;
    
    // Limpiar y deshabilitar razón de modificación
    razonModificacion.innerHTML = '<option value="">Seleccione una razón</option>';
    razonModificacion.disabled = !tipo;
    
    if (!tipo) return;
    
    try {
        // Cargar razones de modificación
        const razones = await loadRazonesModificacion(tipo);
        
        razones.forEach(razon => {
            const option = document.createElement('option');
            option.value = razon.IdRazonModificacion;
            option.textContent = razon.RazonModificacion;
            razonModificacion.appendChild(option);
        });
        
        razonModificacion.disabled = false;
        
    } catch (error) {
        console.error('Error cargando razones:', error);
        showErrorToast('Error al cargar las razones de modificación');
    }
}
async function loadRazonesModificacion(motivo) {
    let connection = null;
    
    try {
        connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        const query = `
            SELECT
                TiposModificacion_Refacturacion.IdRazonModificacion, 
                TiposModificacion_Refacturacion.RazonModificacion
            FROM
                TiposModificacion_Refacturacion
            WHERE
                TiposModificacion_Refacturacion.Motivo = ?
            ORDER BY TiposModificacion_Refacturacion.RazonModificacion
        `;
        
        const result = await connection.query(query, [motivo]);
        await connection.close();
        return result;
        
    } catch (error) {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {}
        }
        throw error;
    }
}
// Manejar búsqueda
async function handleSearch(e) {
    e.preventDefault();
    
    if (isLoading) return;
    
    // Validar fechas
    if (!validateDates()) {
        return;
    }
    
    // Obtener datos del formulario
    const formData = getFormData();
    
    // Mostrar loading
    showLoading();
    
    try {
        
        // Realizar búsqueda en base de datos
        const data = await searchChangesHistory(formData);
        
        // Procesar y mostrar resultados
        processSearchResults(data, formData);
        
    } catch (error) {
        handleSearchError(error);
    } finally {
        hideLoading();
    }
}

// Validar fechas
function validateDates() {
    const desde = new Date(fechaDesde.value);
    const hasta = new Date(fechaHasta.value);
    const today = new Date();
    
    if (!fechaDesde.value || !fechaHasta.value) {
        showErrorToast('Debe seleccionar ambas fechas');
        return false;
    }
    
    if (desde > hasta) {
        showErrorToast('La fecha desde no puede ser mayor a la fecha hasta');
        fechaDesde.focus();
        return false;
    }
    
    if (desde > today) {
        showErrorToast('La fecha desde no puede ser futura');
        fechaDesde.focus();
        return false;
    }
    
    // Validar rango máximo (ej: 1 año)
    const daysDiff = Math.ceil((hasta - desde) / (1000 * 60 * 60 * 24));
    if (daysDiff > 365) {
        showWarningToast('El rango de fechas es muy amplio. Se recomienda un período menor a 1 año.');
    }
    
    return true;
}

// Obtener datos del formulario
function getFormData() {
    return {
        fechaDesde: fechaDesde.value,
        fechaHasta: fechaHasta.value,
        tipoCambio: tipoCambio.value || null,
        tipoModificacion: tipoModificacion.value || null,
        razonModificacion: razonModificacion.value || null
    };
}
// Buscar en historial de cambios
async function searchChangesHistory(filters) {
    let connection = null;
    
    try {
        connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        // Query mejorada con JOIN a facturas_compras
        let query = `
            SELECT
                CambiosFacturasHistorial.IdTipoCambio, 
                CambiosFacturasHistorial.TipoCambio, 
                CambiosFacturasHistorial.ValorAnterior, 
                CambiosFacturasHistorial.ValorNuevo, 
                CambiosFacturasHistorial.IdInventario, 
                CambiosFacturasHistorial.Sucursal, 
                CambiosFacturasHistorial.NombreUsuario, 
                CambiosFacturasHistorial.FechaCambio, 
                CambiosFacturasHistorial.FechaHoraCambio,
                CambiosFacturasHistorial.IdFacturasCompras,
                CambiosFacturasHistorial.IdSucursal,
                CambiosFacturasHistorial.IdUsuario,
                -- Datos de la factura
                facturas_compras.Serie as FacturaSerie,
                facturas_compras.Numero as FacturaNumero,
                facturas_compras.MontoFactura as FacturaMonto,
                facturas_compras.FechaFactura as FacturaFecha,
                CambiosFacturasHistorial.TipoModificacion,
                CambiosFacturasHistorial.IdRazonModificacion,
                razones.RazonModificacion
            FROM CambiosFacturasHistorial
            LEFT JOIN facturas_compras ON CambiosFacturasHistorial.IdFacturasCompras = facturas_compras.Id
            LEFT JOIN TiposModificacion_Refacturacion as razones ON CambiosFacturasHistorial.IdRazonModificacion = razones.IdRazonModificacion
            WHERE CambiosFacturasHistorial.FechaCambio >= ? 
            AND CambiosFacturasHistorial.FechaCambio <= ?
        `;
        
        const queryParams = [filters.fechaDesde, filters.fechaHasta];
        
        // Agregar filtros opcionales
        if (filters.tipoCambio) {
            query += ` AND CambiosFacturasHistorial.IdTipoCambio = ?`;
            queryParams.push(filters.tipoCambio);
        }
        if (filters.tipoModificacion) {
            query += ` AND CambiosFacturasHistorial.TipoModificacion = ?`;
            queryParams.push(filters.tipoModificacion);
        }

        if (filters.razonModificacion) {
            query += ` AND CambiosFacturasHistorial.IdRazonModificacion = ?`;
            queryParams.push(filters.razonModificacion);
        }
        // Ordenar por fecha más reciente
        query += ` ORDER BY CambiosFacturasHistorial.FechaHoraCambio DESC`;
        
        const result = await connection.query(query, queryParams);
        await connection.close();
        return result;
        
    } catch (error) {
        console.error('❌ Error en query de búsqueda:', error);
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error cerrando conexión:', closeError);
            }
        }
        throw error;
    }
}

// Procesar resultados de búsqueda
function processSearchResults(data, filters) {
    currentData = data;
    filteredData = data;
    totalRecords = data.length;
    currentPage = 1;
    
    // Actualizar estadísticas
    updateStats(data.length);
    
    if (data.length === 0) {
        showEmptyResults();
    } else {
        showResults(filters);
        displayTableData();
        setupPagination();
    }
}

// Actualizar estadísticas
function updateStats(count) {
    totalChanges.textContent = count.toLocaleString();
    resultsCount.textContent = count.toLocaleString();
}

// Mostrar panel de bienvenida
function showWelcomePanel() {
    hideAllPanels();
    
    // Limpiar datos
    currentData = [];
    filteredData = [];
    currentPage = 1;
    totalRecords = 0;
    
    // Actualizar stats
    updateStats(0);
}

// Mostrar resultados
function showResults(filters) {
    hideAllPanels();
    resultsPanel.style.display = 'flex';
    
    // Actualizar período mostrado
    const desde = formatDateDisplay(filters.fechaDesde);
    const hasta = formatDateDisplay(filters.fechaHasta);
    resultsPeriod.textContent = `${desde} - ${hasta}`;
    
    // Animar entrada
    resultsPanel.style.opacity = '0';
    resultsPanel.style.transform = 'translateY(20px)';
    
    setTimeout(() => {
        resultsPanel.style.opacity = '1';
        resultsPanel.style.transform = 'translateY(0)';
        resultsPanel.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    }, 100);
}

// Mostrar resultados vacíos
function showEmptyResults() {
    hideAllPanels();
    resultsPanel.style.display = 'flex';
    tableEmpty.style.display = 'flex';
}

// Ocultar todos los paneles
function hideAllPanels() {
    resultsPanel.style.display = 'none';
    tableEmpty.style.display = 'none';
    tableLoading.style.display = 'none';
}

// Mostrar loading
function showLoading() {
    isLoading = true;
    tableLoading.style.display = 'flex';
    
    // Deshabilitar formulario
    const formElements = filtersForm.querySelectorAll('input, select, button');
    formElements.forEach(el => el.disabled = true);
    
    // Cambiar botón de búsqueda
    const searchBtn = filtersForm.querySelector('.search-button');
    const buttonText = searchBtn.querySelector('.button-text');
    const buttonIcon = searchBtn.querySelector('.button-icon');
    
    buttonText.textContent = 'Buscando...';
    buttonIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
}

// Ocultar loading
function hideLoading() {
    isLoading = false;
    tableLoading.style.display = 'none';
    
    // Rehabilitar formulario
    const formElements = filtersForm.querySelectorAll('input, select, button');
    formElements.forEach(el => el.disabled = false);
    
    // Restaurar botón de búsqueda
    const searchBtn = filtersForm.querySelector('.search-button');
    const buttonText = searchBtn.querySelector('.button-text');
    const buttonIcon = searchBtn.querySelector('.button-icon');
    
    buttonText.textContent = 'Buscar Cambios';
    buttonIcon.innerHTML = '<i class="fas fa-search"></i>';
}

// Mostrar datos en tabla
function displayTableData() {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const pageData = filteredData.slice(startIndex, endIndex);
    
    changesTableBody.innerHTML = '';
    
    if (pageData.length === 0) {
        showEmptyResults();
        return;
    }
    
    pageData.forEach(record => {
        const row = createTableRow(record);
        changesTableBody.appendChild(row);
    });
    
    // Actualizar información de paginación
    updatePaginationInfo();
}
// Crear fila de tabla
function createTableRow(record) {
    const row = document.createElement('tr');
    
    // Crear el botón de acción sin onclick inline
    const actionButton = document.createElement('button');
    actionButton.className = 'action-btn';
    actionButton.title = 'Ver detalles';
    actionButton.innerHTML = '<i class="fas fa-eye"></i>';
    
    // Agregar event listener directamente
    actionButton.addEventListener('click', () => {
        showChangeDetail(record);
    });
    
    row.innerHTML = `
        <td class="col-tipo">
            <span class="change-type type-${record.IdTipoCambio}">
                ${getChangeTypeIcon(record.IdTipoCambio)}
                ${record.TipoCambio}
            </span>
        </td>
        <td class="col-anterior">
            <div class="value-display value-old" title="${escapeHtml(record.ValorAnterior)}">
                ${escapeHtml(record.ValorAnterior)}
            </div>
        </td>
        <td class="col-nuevo">
            <div class="value-display value-new" title="${escapeHtml(record.ValorNuevo)}">
                ${escapeHtml(record.ValorNuevo)}
            </div>
        </td>
        <td class="col-inventario">
            <span class="inventory-id">${record.IdInventario || '-'}</span>
        </td>
        <td class="col-sucursal">
            <span title="${escapeHtml(record.Sucursal)}">${escapeHtml(record.Sucursal) || '-'}</span>
        </td>
        <td class="col-usuario">
            <span class="user-name" title="${escapeHtml(record.NombreUsuario)}">
                ${escapeHtml(record.NombreUsuario)}
            </span>
        </td>
        <td class="col-fecha">
            <div class="change-date">
                <div class="date">${formatDateDisplay(record.FechaCambio)}</div>
                <div class="time">${formatTimeDisplay(record.FechaHoraCambio)}</div>
            </div>
        </td>
        <td class="col-acciones">
            <!-- El botón se agregará después -->
        </td>
    `;
    
    // Agregar el botón de acción a la última celda
    const actionCell = row.querySelector('.col-acciones');
    actionCell.appendChild(actionButton);
    
    return row;
}

// Obtener ícono para tipo de cambio
function getChangeTypeIcon(typeId) {
    const icons = {
        1: '<i class="fas fa-hashtag"></i>', // Serie
        2: '<i class="fas fa-list-ol"></i>', // Número
        3: '<i class="fas fa-building"></i>', // Razón Social
        4: '<i class="fas fa-dollar-sign"></i>', // Monto
        5: '<i class="fas fa-calendar"></i>', // Fecha
        6: '<i class="fas fa-truck"></i>' // Proveedor
    };
    return icons[typeId] || '<i class="fas fa-edit"></i>';
}

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
    if (!text && text !== 0) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Formatear fecha para mostrar
function formatDateDisplay(dateString) {
    if (!dateString) return '-';
    
    try {
        let date;
        
        // Si la fecha viene como string YYYY-MM-DD (común en SQL)
        if (typeof dateString === 'string' && dateString.includes('-')) {
            // Dividir la fecha manualmente para evitar problemas de zona horaria
            const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
            // Crear fecha local sin conversión UTC
            date = new Date(year, month - 1, day); // month - 1 porque los meses en JS empiezan en 0
        } else {
            // Para otros formatos, usar Date normal
            date = new Date(dateString);
        }
        
        // Verificar que la fecha es válida
        if (isNaN(date.getTime())) {
            return dateString; // Devolver el string original si no es válida
        }
        
        // Formatear usando Intl.DateTimeFormat con zona horaria específica
        return new Intl.DateTimeFormat('es-GT', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'America/Guatemala' // Forzar zona horaria de Guatemala
        }).format(date);
        
    } catch (error) {
        return dateString;
    }
}

// Formatear hora para mostrar
function formatTimeDisplay(dateTimeString) {
    if (!dateTimeString) return '';
    
    try {
        let date;
        
        // Manejar diferentes formatos de fecha/hora
        if (typeof dateTimeString === 'string') {
            // Si viene con fecha y hora completa
            if (dateTimeString.includes('T') || dateTimeString.includes(' ')) {
                date = new Date(dateTimeString);
            } else {
                // Si es solo fecha, agregar tiempo por defecto
                date = new Date(dateTimeString + 'T00:00:00');
            }
        } else {
            date = new Date(dateTimeString);
        }
        
        // Verificar validez
        if (isNaN(date.getTime())) {
            return '';
        }
        
        return new Intl.DateTimeFormat('es-GT', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'America/Guatemala' // Forzar zona horaria de Guatemala
        }).format(date);
        
    } catch (error) {
        return '';
    }
}

// Mostrar detalles del cambio
function showChangeDetail(record) {
    const modal = document.getElementById('changeDetailModal');
    const content = document.getElementById('changeDetailContent');
    const subtitle = document.getElementById('changeDetailSubtitle');
    
    // Actualizar título
    subtitle.textContent = `${record.TipoCambio} - ${formatDateDisplay(record.FechaCambio)}`;
    
    // Generar contenido del modal
    content.innerHTML = `
        <div class="detail-section">
            <h4><i class="fas fa-info-circle"></i> Información del Cambio</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>Tipo de Cambio:</label>
                    <span class="highlight">${record.TipoCambio}</span>
                </div>
                <div class="detail-item">
                    <label>Usuario:</label>
                    <span>${record.NombreUsuario}</span>
                </div>
                <div class="detail-item">
                    <label>Fecha:</label>
                    <span>${formatDateDisplay(record.FechaCambio)}</span>
                </div>
                <div class="detail-item">
                    <label>Hora:</label>
                    <span>${formatTimeDisplay(record.FechaHoraCambio)}</span>
                </div>
                <div class="detail-item">
                    <label>ID Inventario:</label>
                    <span>${record.IdInventario || '-'}</span>
                </div>
                <div class="detail-item">
                    <label>Sucursal:</label>
                    <span>${record.Sucursal || '-'}</span>
                </div>
                div class="detail-item">
                    <label>Motivo de Modificación:</label>
                    <span class="highlight">${record.TipoModificacion === 1 ? 'Modificación' : record.TipoModificacion === 2 ? 'Refacturación' : '-'}</span>
                </div>
                <div class="detail-item">
                    <label>Razón de Modificación:</label>
                    <span>${record.RazonModificacion || '-'}</span>
                </div>
            </div>
        </div>
        
        <div class="detail-section">
            <h4><i class="fas fa-exchange-alt"></i> Comparación de Valores</h4>
            <div class="change-comparison">
                <div class="comparison-before">
                    <h5>Valor Anterior</h5>
                    <div class="comparison-value">${record.ValorAnterior}</div>
                </div>
                <div class="comparison-arrow">
                    <i class="fas fa-arrow-right"></i>
                </div>
                <div class="comparison-after">
                    <h5>Valor Nuevo</h5>
                    <div class="comparison-value">${record.ValorNuevo}</div>
                </div>
            </div>
        </div>
        
        ${record.IdFacturasCompras ? `
        <div class="detail-section">
            <h4><i class="fas fa-file-invoice"></i> Información de la Factura</h4>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>ID Factura:</label>
                    <span class="highlight">${record.IdFacturasCompras}</span>
                </div>
                <div class="detail-item">
                    <label>Serie-Número:</label>
                    <span class="highlight">${formatFacturaSerieNumero(record.FacturaSerie, record.FacturaNumero)}</span>
                </div>
                <div class="detail-item">
                    <label>Monto Factura:</label>
                    <span class="highlight">${formatCurrency(record.FacturaMonto)}</span>
                </div>
                <div class="detail-item">
                    <label>Fecha Factura:</label>
                    <span>${formatDateDisplay(record.FacturaFecha)}</span>
                </div>
            </div>
            
            ${generateFacturaActions(record.IdFacturasCompras, record.FacturaSerie, record.FacturaNumero)}
        </div>
        ` : `
        <div class="detail-section">
            <h4><i class="fas fa-exclamation-triangle"></i> Sin Información de Factura</h4>
            <p style="color: var(--text-secondary); font-style: italic;">
                No se encontró información de factura asociada a este cambio.
            </p>
        </div>
        `}
    `;
    
    // Mostrar modal
    modal.style.display = 'flex';
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}
function generateFacturaActions(facturaId, serie, numero) {
    const serieNumero = formatFacturaSerieNumero(serie, numero);
    
    return `
        <div class="factura-actions" style="margin-top: 15px; padding-top: 15px; border-top: 1px solid var(--border-color);">
            <h5 style="margin-bottom: 10px; color: var(--text-secondary);">
                <i class="fas fa-tools"></i> Acciones Disponibles
            </h5>
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <button class="btn-action-small" onclick="copyFacturaInfo('${serieNumero}')" title="Copiar información">
                    <i class="fas fa-copy"></i>
                    Copiar Info
                </button>
                <button class="btn-action-small" onclick="searchFacturaChanges(${facturaId})" title="Ver todos los cambios de esta factura">
                    <i class="fas fa-history"></i>
                    Ver Cambios
                </button>
            </div>
        </div>
    `;
}
function searchFacturaChanges(facturaId) {
    // Cerrar el modal actual
    closeChangeDetailModal();
    
    // Mostrar confirmación
    Swal.fire({
        title: '¿Buscar cambios de esta factura?',
        text: `Se mostrarán todos los cambios registrados para la factura ID: ${facturaId}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#6e78ff',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, buscar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            performFacturaSpecificSearch(facturaId);
        }
    });
}
async function performFacturaSpecificSearch(facturaId) {
    try {
        showLoading();
        
        // Establecer un rango amplio de fechas
        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 2); // 2 años atrás
        
        fechaDesde.value = formatDateForInput(startDate);
        fechaHasta.value = formatDateForInput(endDate);
        
        // Limpiar otros filtros
        tipoCambio.value = '';
        usuarioFiltro.value = '';
        
        // Buscar cambios para esta factura específica
        const data = await searchFacturaSpecificChanges(facturaId);
        
        // Procesar resultados
        currentData = data;
        filteredData = data;
        totalRecords = data.length;
        currentPage = 1;
        
        updateStats(data.length);
        
        if (data.length === 0) {
            showWarningToast('No se encontraron cambios para esta factura');
            showEmptyResults();
        } else {
            showResults({
                fechaDesde: fechaDesde.value,
                fechaHasta: fechaHasta.value
            });
            displayTableData();
            setupPagination();
            showSuccessToast(`Se encontraron ${data.length} cambios para esta factura`);
        }
        
    } catch (error) {
        handleSearchError(error);
    } finally {
        hideLoading();
    }
}
async function searchFacturaSpecificChanges(facturaId) {
    let connection = null;
    
    try {
        connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        const query = `
            SELECT
                CambiosFacturasHistorial.IdTipoCambio, 
                CambiosFacturasHistorial.TipoCambio, 
                CambiosFacturasHistorial.ValorAnterior, 
                CambiosFacturasHistorial.ValorNuevo, 
                CambiosFacturasHistorial.IdInventario, 
                CambiosFacturasHistorial.Sucursal, 
                CambiosFacturasHistorial.NombreUsuario, 
                CambiosFacturasHistorial.FechaCambio, 
                CambiosFacturasHistorial.FechaHoraCambio,
                CambiosFacturasHistorial.IdFacturasCompras,
                CambiosFacturasHistorial.IdSucursal,
                CambiosFacturasHistorial.IdUsuario,
                -- Datos de la factura
                facturas_compras.Serie as FacturaSerie,
                facturas_compras.Numero as FacturaNumero,
                facturas_compras.MontoFactura as FacturaMonto,
                facturas_compras.FechaFactura as FacturaFecha
            FROM CambiosFacturasHistorial
            LEFT JOIN facturas_compras ON CambiosFacturasHistorial.IdFacturasCompras = facturas_compras.Id
            WHERE CambiosFacturasHistorial.IdFacturasCompras = ?
            ORDER BY CambiosFacturasHistorial.FechaHoraCambio DESC
        `;
        
        const result = await connection.query(query, [facturaId]);
        await connection.close();
        
        return result;
        
    } catch (error) {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
            }
        }
        throw error;
    }
}
function copyFacturaInfo(serieNumero) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(serieNumero).then(() => {
            showSuccessToast('Información copiada al portapapeles');
        }).catch(() => {
            showErrorToast('No se pudo copiar la información');
        });
    } else {
        // Fallback para navegadores antiguos
        const textArea = document.createElement('textarea');
        textArea.value = serieNumero;
        document.body.appendChild(textArea);
        textArea.select();
        try {
            document.execCommand('copy');
            showSuccessToast('Información copiada al portapapeles');
        } catch (err) {
            showErrorToast('No se pudo copiar la información');
        }
        document.body.removeChild(textArea);
    }
}

function formatFacturaSerieNumero(serie, numero) {
    if (!serie && !numero) return '-';
    if (!serie) return numero;
    if (!numero) return serie;
    return `${serie}-${numero}`;
}
function formatCurrency(amount) {
    if (!amount && amount !== 0) return '-';
    
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount)) return '-';
    
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ',
        minimumFractionDigits: 2
    }).format(numericAmount);
}
// Cerrar modal de detalles
function closeChangeDetailModal() {
    const modal = document.getElementById('changeDetailModal');
    modal.classList.remove('show');
    
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// ===== PAGINACIÓN =====

// Configurar paginación
function setupPagination() {
    const totalPages = Math.ceil(totalRecords / pageSize);
    
    if (totalPages <= 1) {
        paginationContainer.style.display = 'none';
        return;
    }
    
    paginationContainer.style.display = 'flex';
    updatePaginationControls(totalPages);
    updatePaginationInfo();
}

// Actualizar controles de paginación
function updatePaginationControls(totalPages) {
    const firstPageBtn = document.getElementById('firstPage');
    const prevPageBtn = document.getElementById('prevPage');
    const nextPageBtn = document.getElementById('nextPage');
    const lastPageBtn = document.getElementById('lastPage');
    const pagesContainer = document.getElementById('paginationPages');
    
    // Habilitar/deshabilitar botones
    firstPageBtn.disabled = currentPage === 1;
    prevPageBtn.disabled = currentPage === 1;
    nextPageBtn.disabled = currentPage === totalPages;
    lastPageBtn.disabled = currentPage === totalPages;
    
    // Generar páginas
    pagesContainer.innerHTML = '';
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-page ${i === currentPage ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.onclick = () => goToPage(i);
        pagesContainer.appendChild(pageBtn);
    }
}

// Actualizar información de paginación
function updatePaginationInfo() {
    const showingFrom = document.getElementById('showingFrom');
    const showingTo = document.getElementById('showingTo');
    const totalRecordsElement = document.getElementById('totalRecords');
    
    const startIndex = (currentPage - 1) * pageSize + 1;
    const endIndex = Math.min(currentPage * pageSize, totalRecords);
    
    showingFrom.textContent = totalRecords > 0 ? startIndex : 0;
    showingTo.textContent = endIndex;
    totalRecordsElement.textContent = totalRecords.toLocaleString();
}

// Ir a página específica
function goToPage(page) {
    const totalPages = Math.ceil(totalRecords / pageSize);
    
    if (page < 1 || page > totalPages || page === currentPage) {
        return;
    }
    
    currentPage = page;
    displayTableData();
    updatePaginationControls(totalPages);
}

// Cambiar tamaño de página
function handlePageSizeChange(e) {
    const newPageSize = parseInt(e.target.value);
    
    if (newPageSize === pageSize) return;
    
    pageSize = newPageSize;
    currentPage = 1;
    
    displayTableData();
    setupPagination();
}

// ===== FUNCIONES DE UTILIDAD =====

// Limpiar filtros
function clearFilters() {
    // Restablecer fechas por defecto
    setDefaultDates();
    
    // Limpiar otros filtros
    tipoCambio.value = '';
    tipoModificacion.value = '';
    razonModificacion.value = '';
    razonModificacion.disabled = true;
    razonModificacion.innerHTML = '<option value="">Seleccione primero el motivo</option>';
    // Enfocar primer campo
    fechaDesde.focus();
    
    showInfoToast('Filtros restablecidos');
}

// Manejar errores de búsqueda
function handleSearchError(error) {
   
   let errorMessage = 'Error al buscar en el historial. ';
   
   if (error.message && error.message.includes('connection')) {
       errorMessage += 'Verifique la conexión a la base de datos.';
   } else if (error.message && error.message.includes('timeout')) {
       errorMessage += 'La consulta tardó demasiado tiempo. Intente con un rango menor.';
   } else if (error.message && error.message.includes('syntax')) {
       errorMessage += 'Error en la consulta SQL. Contacte al administrador.';
   } else {
       errorMessage += 'Por favor intente nuevamente.';
   }
   
   Swal.fire({
       icon: 'error',
       title: 'Error en la búsqueda',
       text: errorMessage,
       confirmButtonColor: '#6e78ff',
       backdrop: `
           rgba(255, 94, 109, 0.2)
           url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ff5e6d' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0l8 6 8-6v4l-8 6-8-6zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0l8 6 8-6v4l-8 6-8-6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")
           left center/contain no-repeat
       `
   });
   
   // Mostrar panel de bienvenida si no hay datos
   if (currentData.length === 0) {
       showWelcomePanel();
   }
}
// ===== FUNCIONES DE ANÁLISIS =====

// Generar estadísticas de los cambios
function generateChangeStats() {
   if (currentData.length === 0) return null;
   
   const stats = {
       totalChanges: currentData.length,
       changesByType: {},
       changesByUser: {},
       changesByDay: {},
       topUsers: [],
       topTypes: []
   };
   
   // Análisis por tipo de cambio
   currentData.forEach(record => {
       // Por tipo
       if (!stats.changesByType[record.TipoCambio]) {
           stats.changesByType[record.TipoCambio] = 0;
       }
       stats.changesByType[record.TipoCambio]++;
       
       // Por usuario
       if (!stats.changesByUser[record.NombreUsuario]) {
           stats.changesByUser[record.NombreUsuario] = 0;
       }
       stats.changesByUser[record.NombreUsuario]++;
       
       // Por día
       const day = record.FechaCambio;
       if (!stats.changesByDay[day]) {
           stats.changesByDay[day] = 0;
       }
       stats.changesByDay[day]++;
   });
   
   // Top usuarios (top 5)
   stats.topUsers = Object.entries(stats.changesByUser)
       .sort((a, b) => b[1] - a[1])
       .slice(0, 5)
       .map(([user, count]) => ({ user, count }));
   
   // Top tipos (top 5)
   stats.topTypes = Object.entries(stats.changesByType)
       .sort((a, b) => b[1] - a[1])
       .slice(0, 5)
       .map(([type, count]) => ({ type, count }));
   
   return stats;
}

// Mostrar estadísticas en modal
function showStatsModal() {
   const stats = generateChangeStats();
   
   if (!stats) {
       showWarningToast('No hay datos para generar estadísticas');
       return;
   }
   
   Swal.fire({
       title: 'Estadísticas del Período',
       html: `
           <div style="text-align: left;">
               <h4 style="color: #6e78ff; margin-bottom: 15px;">📊 Resumen General</h4>
               <p><strong>Total de cambios:</strong> ${stats.totalChanges.toLocaleString()}</p>
               <p><strong>Usuarios activos:</strong> ${Object.keys(stats.changesByUser).length}</p>
               <p><strong>Días con actividad:</strong> ${Object.keys(stats.changesByDay).length}</p>
               
               <h4 style="color: #6e78ff; margin: 20px 0 15px;">🏆 Top Usuarios</h4>
               ${stats.topUsers.map((item, index) => `
                   <p style="margin: 5px 0;">
                       ${index + 1}. <strong>${item.user}</strong> - ${item.count} cambios
                   </p>
               `).join('')}
               
               <h4 style="color: #6e78ff; margin: 20px 0 15px;">📈 Tipos de Cambio Más Frecuentes</h4>
               ${stats.topTypes.map((item, index) => `
                   <p style="margin: 5px 0;">
                       ${index + 1}. <strong>${item.type}</strong> - ${item.count} cambios
                   </p>
               `).join('')}
           </div>
       `,
       icon: 'info',
       confirmButtonColor: '#6e78ff',
       confirmButtonText: 'Cerrar',
       width: '600px'
   });
}

// ===== FUNCIONES DE TOAST =====

// Mostrar toast de éxito
function showSuccessToast(message) {
   Swal.mixin({
       toast: true,
       position: 'top-end',
       showConfirmButton: false,
       timer: 3000,
       timerProgressBar: true,
       customClass: {
           popup: 'success-toast'
       },
       didOpen: (toast) => {
           toast.addEventListener('mouseenter', Swal.stopTimer);
           toast.addEventListener('mouseleave', Swal.resumeTimer);
       }
   }).fire({
       icon: 'success',
       title: message
   });
}

// Mostrar toast de error
function showErrorToast(message) {
   Swal.mixin({
       toast: true,
       position: 'top-end',
       showConfirmButton: false,
       timer: 4000,
       timerProgressBar: true,
       customClass: {
           popup: 'error-toast'
       },
       didOpen: (toast) => {
           toast.addEventListener('mouseenter', Swal.stopTimer);
           toast.addEventListener('mouseleave', Swal.resumeTimer);
       }
   }).fire({
       icon: 'error',
       title: message
   });
}

// Mostrar toast de advertencia
function showWarningToast(message) {
   Swal.mixin({
       toast: true,
       position: 'top-end',
       showConfirmButton: false,
       timer: 3500,
       timerProgressBar: true,
       customClass: {
           popup: 'warning-toast'
       },
       didOpen: (toast) => {
           toast.addEventListener('mouseenter', Swal.stopTimer);
           toast.addEventListener('mouseleave', Swal.resumeTimer);
       }
   }).fire({
       icon: 'warning',
       title: message
   });
}

// Mostrar toast informativo
function showInfoToast(message) {
   Swal.mixin({
       toast: true,
       position: 'top-end',
       showConfirmButton: false,
       timer: 2500,
       timerProgressBar: true,
       customClass: {
           popup: 'info-toast'
       },
       didOpen: (toast) => {
           toast.addEventListener('mouseenter', Swal.stopTimer);
           toast.addEventListener('mouseleave', Swal.resumeTimer);
       }
   }).fire({
       icon: 'info',
       title: message
   });
}

// ===== FUNCIONES DE TECLADO =====

// Atajos de teclado
document.addEventListener('keydown', (e) => {
   // Ctrl/Cmd + Enter para buscar
   if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
       e.preventDefault();
       if (!isLoading) {
           filtersForm.dispatchEvent(new Event('submit'));
       }
   }
   
   // Escape para cerrar modales
   if (e.key === 'Escape') {
       const modal = document.getElementById('changeDetailModal');
       if (modal.classList.contains('show')) {
           closeChangeDetailModal();
       }
   }
   
   // F5 para nueva búsqueda
   if (e.key === 'F5') {
       e.preventDefault();
       showWelcomePanel();
   }
});

// ===== FUNCIONES DE INICIALIZACIÓN ADICIONALES =====

// Verificar conexión a base de datos al cargar
async function checkDatabaseConnection() {
   try {
       
       const connection = await odbc.connect('DSN=facturas;charset=utf8');
       await connection.query('SELECT 1 as test');
       await connection.close();
       return true;
       
   } catch (error) {
       console.error('❌ Error de conexión a base de datos:', error);
       
       Swal.fire({
           icon: 'error',
           title: 'Error de Conexión',
           text: 'No se pudo conectar a la base de datos. Verifique la configuración.',
           confirmButtonColor: '#6e78ff',
           backdrop: 'rgba(255, 94, 109, 0.2)'
       });
       
       return false;
   }
}

// Cargar configuración de usuario
function loadUserPreferences() {
   try {
       // Cargar tamaño de página preferido
       const savedPageSize = localStorage.getItem('historial_pageSize');
       if (savedPageSize && document.getElementById('pageSize')) {
           document.getElementById('pageSize').value = savedPageSize;
           pageSize = parseInt(savedPageSize);
       }
       
       // Cargar filtros guardados
       const savedFilters = localStorage.getItem('historial_filters');
       if (savedFilters) {
           const filters = JSON.parse(savedFilters);
           if (filters.tipoCambio) tipoCambio.value = filters.tipoCambio;
           if (filters.usuario) usuarioFiltro.value = filters.usuario;
       }
       
   } catch (error) {
   }
}

// Guardar configuración de usuario
function saveUserPreferences() {
   try {
       // Guardar tamaño de página
       localStorage.setItem('historial_pageSize', pageSize.toString());
       
       // Guardar filtros actuales
       const filters = {
           tipoCambio: tipoCambio.value,
           usuario: usuarioFiltro.value
       };
       localStorage.setItem('historial_filters', JSON.stringify(filters));
       
   } catch (error) {
   }
}

// Event listener para guardar preferencias antes de salir
window.addEventListener('beforeunload', () => {
   saveUserPreferences();
});

// Monitor de rendimiento
function performanceMonitor() {
   if (performance && performance.memory) {
       const memory = performance.memory;
   }
}

// Ejecutar monitor cada 30 segundos en modo desarrollo
if (localStorage.getItem('debug_mode') === 'true') {
   setInterval(performanceMonitor, 30000);
}

// ===== INICIALIZACIÓN FINAL =====

// Verificar si todos los elementos se inicializaron correctamente
function validateInitialization() {
   const requiredElements = [
       'filtersForm', 'fechaDesde', 'fechaHasta', 'resultsPanel', 
       'changesTable', 'paginationContainer'
   ];
   
   for (const elementId of requiredElements) {
       if (!document.getElementById(elementId)) {
           return false;
       }
   }
   return true;
}

// Configuración final al cargar
document.addEventListener('DOMContentLoaded', () => {
   // Validar inicialización
   if (!validateInitialization()) {
       showErrorToast('Error en la inicialización de la aplicación');
       return;
   }
   
   // Cargar preferencias
   loadUserPreferences();
   
   // Verificar conexión (opcional, en background)
   setTimeout(() => {
       checkDatabaseConnection();
   }, 1000);
});

// ===== FUNCIONES GLOBALES EXPUESTAS =====

// Hacer funciones disponibles globalmente para onclick handlers
window.showChangeDetail = showChangeDetail;
window.goToPage = goToPage;
window.showStatsModal = showStatsModal;

// Exportar funciones principales para testing
if (typeof module !== 'undefined' && module.exports) {
   module.exports = {
       searchChangesHistory,
       generateChangeStats,
       formatDateDisplay,
       formatTimeDisplay,
       escapeHtml
   };
}