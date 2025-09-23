const odbc = require('odbc');
const Swal = require('sweetalert2');
const XLSX = require('xlsx');

// Variables globales
let currentData = [];
let filteredData = [];
let currentPage = 1;
let pageSize = 25;
let totalRecords = 0;
let isLoading = false;

// Elementos del DOM
let filtersForm, fechaDesde, fechaHasta, tipoCambio, tipoModificacion, razonModificacion;
let serieFactura, numeroFactura;
let resultsContainer, resultsHeader, changesTable, changesTableBody;
let tableLoading, tableEmpty, welcomeState, paginationContainer;
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
    serieFactura = document.getElementById('serieFactura');
    numeroFactura = document.getElementById('numeroFactura');
    
    // Contenedores principales
    resultsContainer = document.getElementById('resultsContainer');
    resultsHeader = document.getElementById('resultsHeader');
    
    // Tabla y estados
    changesTable = document.getElementById('changesTable');
    changesTableBody = document.getElementById('changesTableBody');
    tableLoading = document.getElementById('tableLoading');
    tableEmpty = document.getElementById('tableEmpty');
    welcomeState = document.getElementById('welcomeState');
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
    
    // Asegurar que los filtros sean visibles
    ensureFiltersVisible();
    
    // Mostrar estado de bienvenida
    showWelcomeState();
}

// Asegurar que los filtros sean visibles
function ensureFiltersVisible() {
    const filtersPanel = document.querySelector('.filters-panel-compact');
    const filtersHeader = document.querySelector('.filters-header');
    const filtersForm = document.querySelector('.filters-form-inline');
    const filtersGrid = document.querySelector('.filters-grid');
    
    if (filtersPanel) {
        filtersPanel.style.display = 'block';
        filtersPanel.style.visibility = 'visible';
        filtersPanel.style.height = 'auto';
        filtersPanel.style.minHeight = '70px';
    }
    
    if (filtersHeader) {
        filtersHeader.style.display = 'flex';
        filtersHeader.style.visibility = 'visible';
    }
    
    if (filtersForm) {
        filtersForm.style.display = 'block';
        filtersForm.style.visibility = 'visible';
    }
    
    if (filtersGrid) {
        filtersGrid.style.display = 'grid';
        filtersGrid.style.visibility = 'visible';
        filtersGrid.style.opacity = '1';
    }
    
    // Asegurar que todos los filter-items sean visibles
    const filterItems = document.querySelectorAll('.filter-item');
    filterItems.forEach(item => {
        item.style.display = 'flex';
        item.style.visibility = 'visible';
    });
    
    console.log('✅ Filtros forzados a ser visibles');
}

// Animar elementos de la página
function animatePageElements() {
    const elements = [
        document.querySelector('.filters-panel-compact'),
        document.querySelector('.results-container')
    ];

    elements.forEach((element, index) => {
        if (element) {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            
            setTimeout(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, 100 + (index * 50));
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
    if (typeof date === 'string') {
        const [year, month, day] = date.split('T')[0].split('-').map(Number);
        date = new Date(year, month - 1, day);
    }
    
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
    document.getElementById('nuevaBusqueda').addEventListener('click', showWelcomeState);
    document.getElementById('exportExcel').addEventListener('click', exportToExcel);
    
    // Paginación
    document.getElementById('pageSize').addEventListener('change', handlePageSizeChange);
    document.getElementById('firstPage').addEventListener('click', () => goToPage(1));
    document.getElementById('prevPage').addEventListener('click', () => goToPage(currentPage - 1));
    document.getElementById('nextPage').addEventListener('click', () => goToPage(currentPage + 1));
    document.getElementById('lastPage').addEventListener('click', () => goToPage(Math.ceil(totalRecords / pageSize)));
    
    // Teclas de acceso rápido
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

// Manejar cambio de tipo de modificación
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

// Cargar razones de modificación
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
    
    // Validar rango máximo (1 año)
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
        razonModificacion: razonModificacion.value || null,
        serieFactura: serieFactura.value.trim() || null,
        numeroFactura: numeroFactura.value.trim() || null
    };
}

// Buscar en historial de cambios
async function searchChangesHistory(filters) {
    let connection = null;
    
    try {
        connection = await odbc.connect('DSN=facturas;charset=utf8');
        
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
                CambiosFacturasHistorial.ManeraRefacturacion,
                CambiosFacturasHistorial.SerieNumeroNotaCredito,
                CambiosFacturasHistorial.TipoModificacion,
                CambiosFacturasHistorial.IdRazonModificacion,
                -- Datos de la factura
                facturas_compras.Serie as FacturaSerie,
                facturas_compras.Numero as FacturaNumero,
                facturas_compras.MontoFactura as FacturaMonto,
                facturas_compras.FechaFactura as FacturaFecha,
                -- Razón de modificación
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
        
        // Filtros por factura
        if (filters.serieFactura) {
            query += ` AND facturas_compras.Serie LIKE ?`;
            queryParams.push(`%${filters.serieFactura}%`);
        }
        if (filters.numeroFactura) {
            query += ` AND facturas_compras.Numero LIKE ?`;
            queryParams.push(`%${filters.numeroFactura}%`);
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
    
    // Actualizar estado del botón de exportación
    updateExportButtonState();
    
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

// Mostrar estado de bienvenida
function showWelcomeState() {
    hideAllStates();
    welcomeState.style.display = 'flex';
    resultsHeader.style.display = 'none';
    paginationContainer.style.display = 'none';
    
    // Limpiar datos
    currentData = [];
    filteredData = [];
    currentPage = 1;
    totalRecords = 0;
    
    // Actualizar stats
    updateStats(0);
    
    // Ocultar botón de exportación
    updateExportButtonState();
    
    // Animar entrada
    welcomeState.style.opacity = '0';
    setTimeout(() => {
        welcomeState.style.opacity = '1';
        welcomeState.style.transition = 'opacity 0.5s ease';
    }, 100);
}

// Mostrar resultados
function showResults(filters) {
    hideAllStates();
    resultsHeader.style.display = 'flex';
    
    // Actualizar período mostrado
    const desde = formatDateDisplay(filters.fechaDesde);
    const hasta = formatDateDisplay(filters.fechaHasta);
    resultsPeriod.textContent = `${desde} - ${hasta}`;
    
    // Animar entrada
    resultsHeader.style.opacity = '0';
    setTimeout(() => {
        resultsHeader.style.opacity = '1';
        resultsHeader.style.transition = 'opacity 0.5s ease';
    }, 100);
}

// Mostrar resultados vacíos
function showEmptyResults() {
    hideAllStates();
    tableEmpty.style.display = 'flex';
    resultsHeader.style.display = 'flex';
    paginationContainer.style.display = 'none';
}

// Ocultar todos los estados
function hideAllStates() {
    welcomeState.style.display = 'none';
    tableEmpty.style.display = 'none';
    tableLoading.style.display = 'none';
}

// Mostrar loading
function showLoading() {
    isLoading = true;
    hideAllStates();
    tableLoading.style.display = 'flex';
    
    // Deshabilitar formulario
    const formElements = filtersForm.querySelectorAll('input, select, button');
    formElements.forEach(el => el.disabled = true);
    
    // Cambiar botón de búsqueda
    const searchBtn = filtersForm.querySelector('.btn-search');
    const buttonText = searchBtn.querySelector('.search-text');
    const buttonIcon = searchBtn.querySelector('.search-icon');
    
    if (buttonText) buttonText.textContent = 'Buscando...';
    if (buttonIcon) buttonIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    
    // Agregar clase de loading
    document.body.classList.add('loading');
}

// Ocultar loading
function hideLoading() {
    isLoading = false;
    tableLoading.style.display = 'none';
    
    // Rehabilitar formulario
    const formElements = filtersForm.querySelectorAll('input, select, button');
    formElements.forEach(el => el.disabled = false);
    
    // Restaurar botón de búsqueda
    const searchBtn = filtersForm.querySelector('.btn-search');
    const buttonText = searchBtn.querySelector('.search-text');
    const buttonIcon = searchBtn.querySelector('.search-icon');
    
    if (buttonText) buttonText.textContent = 'Buscar';
    if (buttonIcon) buttonIcon.innerHTML = '<i class="fas fa-search"></i>';
    
    // Remover clase de loading
    document.body.classList.remove('loading');
}

// Eliminar funciones de vista compacta/expandida ya que no se necesitan

// Manejar atajos de teclado
function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + Enter para buscar
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isLoading) {
            filtersForm.dispatchEvent(new Event('submit'));
        }
    }
    
    // F5 para nueva búsqueda
    if (e.key === 'F5') {
        e.preventDefault();
        showWelcomeState();
    }
    
    // Ctrl + R para limpiar filtros
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        clearFilters();
    }
    
    // Teclas de navegación de páginas
    if (totalRecords > pageSize) {
        if (e.key === 'ArrowLeft' && e.altKey) {
            e.preventDefault();
            goToPage(currentPage - 1);
        }
        if (e.key === 'ArrowRight' && e.altKey) {
            e.preventDefault();
            goToPage(currentPage + 1);
        }
    }
}
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
    
    // Mostrar tabla
    hideAllStates();
    changesTable.style.display = 'table';
    
    // Configurar paginación
    setupPagination();
    
    // Actualizar información de paginación
    updatePaginationInfo();
}

// Crear fila de tabla expandida
function createTableRow(record) {
    const row = document.createElement('tr');
    
    row.innerHTML = `
        <td class="col-tipo">
            <span class="change-type type-${record.IdTipoCambio}">
                ${getChangeTypeIcon(record.IdTipoCambio)}
                ${escapeHtml(record.TipoCambio)}
            </span>
        </td>
        <td class="col-anterior">
            <div class="value-old" title="${escapeHtml(record.ValorAnterior)}">
                ${escapeHtml(record.ValorAnterior)}
            </div>
        </td>
        <td class="col-nuevo">
            <div class="value-new" title="${escapeHtml(record.ValorNuevo)}">
                ${escapeHtml(record.ValorNuevo)}
            </div>
        </td>
        <td class="col-inventario">
            <span class="inventory-id">${record.IdInventario || '-'}</span>
        </td>
        <td class="col-factura">
            <div class="factura-info">
                <div class="factura-serie">${formatFacturaSerieNumero(record.FacturaSerie, record.FacturaNumero)}</div>
                <div class="factura-fecha">${formatDateDisplay(record.FacturaFecha)}</div>
            </div>
        </td>
        <td class="col-monto text-right">
            <span class="monto-factura">${formatCurrency(record.FacturaMonto)}</span>
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
        <td class="col-motivo">
            <div class="motivo-info">
                <div class="motivo-tipo">${getTipoModificacionText(record.TipoModificacion)}</div>
                <div class="motivo-razon">${escapeHtml(record.RazonModificacion) || '-'}</div>
            </div>
        </td>
        <td class="col-refacturacion">
            <div class="refacturacion-info">
                <div class="refacturacion-manera ${getManeraRefacturacionClass(record.ManeraRefacturacion)}">
                    ${getManeraRefacturacionText(record.ManeraRefacturacion)}
                </div>
                ${record.SerieNumeroNotaCredito && record.SerieNumeroNotaCredito !== '0' ? 
                    `<div class="refacturacion-nota">${escapeHtml(record.SerieNumeroNotaCredito)}</div>` : 
                    ''
                }
            </div>
        </td>
    `;
    
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

// Formatear serie y número de factura
function formatFacturaSerieNumero(serie, numero) {
    if (!serie && !numero) return '-';
    if (!serie) return numero;
    if (!numero) return serie;
    return `${serie}-${numero}`;
}

// Formatear moneda
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

// Obtener texto de tipo de modificación
function getTipoModificacionText(tipo) {
    switch(tipo) {
        case 1: return 'Modificación';
        case 2: return 'Refacturación';
        default: return '-';
    }
}

// Obtener texto de manera de refacturación
function getManeraRefacturacionText(manera) {
    if (!manera) return '-';
    switch(manera) {
        case 1: return 'Anulación';
        case 2: return 'Nota de Crédito';
        default: return `Tipo ${manera}`;
    }
}

// Obtener clase CSS para manera de refacturación
function getManeraRefacturacionClass(manera) {
    switch(manera) {
        case 1: return 'anulacion';
        case 2: return 'nota-credito';
        default: return '';
    }
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
        
        if (typeof dateString === 'string' && dateString.includes('-')) {
            const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
            date = new Date(year, month - 1, day);
        } else {
            date = new Date(dateString);
        }
        
        if (isNaN(date.getTime())) {
            return dateString;
        }
        
        return new Intl.DateTimeFormat('es-GT', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            timeZone: 'America/Guatemala'
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
        
        if (typeof dateTimeString === 'string') {
            if (dateTimeString.includes('T') || dateTimeString.includes(' ')) {
                date = new Date(dateTimeString);
            } else {
                date = new Date(dateTimeString + 'T00:00:00');
            }
        } else {
            date = new Date(dateTimeString);
        }
        
        if (isNaN(date.getTime())) {
            return '';
        }
        
        return new Intl.DateTimeFormat('es-GT', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'America/Guatemala'
        }).format(date);
        
    } catch (error) {
        return '';
    }
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
}

// Cambiar tamaño de página
function handlePageSizeChange(e) {
    const newPageSize = parseInt(e.target.value);
    
    if (newPageSize === pageSize) return;
    
    pageSize = newPageSize;
    currentPage = 1;
    
    displayTableData();
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
    
    // Limpiar filtros de factura
    serieFactura.value = '';
    numeroFactura.value = '';
    
    // Enfocar primer campo
    fechaDesde.focus();
    
    showInfoToast('Filtros restablecidos');
}

// Manejar errores de búsqueda
function handleSearchError(error) {
    console.error('❌ Error en búsqueda:', error);
    
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
    
    // Mostrar estado de bienvenida si no hay datos
    if (currentData.length === 0) {
        showWelcomeState();
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

// ===== ATAJOS DE TECLADO =====

// Manejar atajos de teclado
function handleKeyboardShortcuts(e) {
    // Ctrl/Cmd + Enter para buscar
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (!isLoading) {
            filtersForm.dispatchEvent(new Event('submit'));
        }
    }
    
    // F5 para nueva búsqueda
    if (e.key === 'F5') {
        e.preventDefault();
        showWelcomeState();
    }
    
    // Ctrl + R para limpiar filtros
    if ((e.ctrlKey || e.metaKey) && e.key === 'r') {
        e.preventDefault();
        clearFilters();
    }
    
    // Teclas de navegación de páginas
    if (totalRecords > pageSize) {
        if (e.key === 'ArrowLeft' && e.altKey) {
            e.preventDefault();
            goToPage(currentPage - 1);
        }
        if (e.key === 'ArrowRight' && e.altKey) {
            e.preventDefault();
            goToPage(currentPage + 1);
        }
    }
    
    // Toggle vista compacta/expandida
    if (e.key === 'v' && e.ctrlKey) {
        e.preventDefault();
        setTableView(currentView === 'compact' ? 'expanded' : 'compact');
    }
}

// ===== FUNCIONES DE EXPORTACIÓN =====

// Exportar datos a Excel
async function exportToExcel() {
    if (currentData.length === 0) {
        showWarningToast('No hay datos para exportar');
        return;
    }
    
    try {
        // Mostrar mensaje de preparación
        showInfoToast('Preparando archivo Excel...');
        
        // Preparar los datos para Excel
        const excelData = prepareDataForExcel(currentData);
        
        // Crear libro de trabajo
        const workbook = XLSX.utils.book_new();
        
        // Crear hoja de trabajo con los datos
        const worksheet = XLSX.utils.json_to_sheet(excelData, {
            header: [
                'TipoCambio',
                'ValorAnterior',
                'ValorNuevo',
                'IdInventario',
                'FacturaSerie',
                'FacturaNumero',
                'SerieNumeroCompleto',
                'MontoFactura',
                'FechaFactura',
                'Sucursal',
                'Usuario',
                'FechaCambio',
                'HoraCambio',
                'TipoModificacion',
                'RazonModificacion',
                'ManeraRefacturacion',
                'NotaCredito',
                'IdFacturasCompras'
            ]
        });
        
        // Establecer anchos de columna
        const columnWidths = [
            { wch: 20 }, // Tipo de Cambio
            { wch: 25 }, // Valor Anterior
            { wch: 25 }, // Valor Nuevo
            { wch: 15 }, // ID Inventario
            { wch: 12 }, // Serie
            { wch: 15 }, // Número
            { wch: 20 }, // Serie-Número Completo
            { wch: 15 }, // Monto
            { wch: 15 }, // Fecha Factura
            { wch: 25 }, // Sucursal
            { wch: 25 }, // Usuario
            { wch: 15 }, // Fecha Cambio
            { wch: 12 }, // Hora
            { wch: 18 }, // Tipo Modificación
            { wch: 30 }, // Razón
            { wch: 20 }, // Manera Refacturación
            { wch: 20 }, // Nota Crédito
            { wch: 15 }  // ID Facturas
        ];
        
        worksheet['!cols'] = columnWidths;
        
        // Agregar formato a los encabezados
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        for (let col = range.s.c; col <= range.e.c; col++) {
            const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
            if (!worksheet[cellAddress]) continue;
            
            worksheet[cellAddress].s = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "6e78ff" } },
                alignment: { horizontal: "center" },
                border: {
                    top: { style: "thin" },
                    bottom: { style: "thin" },
                    left: { style: "thin" },
                    right: { style: "thin" }
                }
            };
        }
        
        // Agregar la hoja al libro
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Historial de Cambios');
        
        // Crear hoja de resumen
        const summaryData = generateSummaryData(currentData);
        const summaryWorksheet = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summaryWorksheet, 'Resumen');
        
        // Generar nombre de archivo sugerido
        const suggestedFileName = generateExcelFileName();
        
        // Verificar si el navegador soporta la API de File System Access
        if ('showSaveFilePicker' in window) {
            try {
                // Usar la API moderna de File System Access
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: suggestedFileName,
                    types: [
                        {
                            description: 'Archivos Excel',
                            accept: {
                                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                            }
                        }
                    ]
                });
                
                // Crear el archivo Excel como buffer
                const excelBuffer = XLSX.write(workbook, { 
                    bookType: 'xlsx', 
                    type: 'array' 
                });
                
                // Escribir el archivo en la ubicación seleccionada
                const writable = await fileHandle.createWritable();
                await writable.write(excelBuffer);
                await writable.close();
                
                showSuccessToast(`Archivo Excel guardado exitosamente`);
                
            } catch (error) {
                if (error.name === 'AbortError') {
                    showInfoToast('Exportación cancelada por el usuario');
                } else {
                    console.error('Error con File System Access API:', error);
                    // Fallback al método tradicional
                    downloadExcelFile(workbook, suggestedFileName);
                }
            }
        } else {
            // Fallback para navegadores que no soportan File System Access API
            downloadExcelFile(workbook, suggestedFileName);
        }
        
    } catch (error) {
        console.error('Error exportando a Excel:', error);
        showErrorToast('Error al exportar a Excel. Intente nuevamente.');
    }
}

// Función de fallback para descargar archivo Excel
function downloadExcelFile(workbook, fileName) {
    try {
        // Escribir archivo usando el método tradicional
        XLSX.writeFile(workbook, fileName);
        showSuccessToast(`Archivo Excel descargado: ${fileName}`);
        showInfoToast('Su navegador no soporta selector de ubicación. El archivo se descargó en la carpeta predeterminada.');
    } catch (error) {
        console.error('Error en descarga tradicional:', error);
        showErrorToast('Error al descargar el archivo Excel');
    }
}

// Preparar datos para Excel
function prepareDataForExcel(data) {
    return data.map(record => ({
        TipoCambio: record.TipoCambio || '',
        ValorAnterior: record.ValorAnterior || '',
        ValorNuevo: record.ValorNuevo || '',
        IdInventario: record.IdInventario || '',
        FacturaSerie: record.FacturaSerie || '',
        FacturaNumero: record.FacturaNumero || '',
        SerieNumeroCompleto: formatFacturaSerieNumero(record.FacturaSerie, record.FacturaNumero),
        MontoFactura: record.FacturaMonto || 0,
        FechaFactura: formatDateForExcel(record.FacturaFecha),
        Sucursal: record.Sucursal || '',
        Usuario: record.NombreUsuario || '',
        FechaCambio: formatDateForExcel(record.FechaCambio),
        HoraCambio: formatTimeForExcel(record.FechaHoraCambio),
        TipoModificacion: getTipoModificacionText(record.TipoModificacion),
        RazonModificacion: record.RazonModificacion || '',
        ManeraRefacturacion: getManeraRefacturacionText(record.ManeraRefacturacion),
        NotaCredito: record.SerieNumeroNotaCredito || '',
        IdFacturasCompras: record.IdFacturasCompras || ''
    }));
}

// Generar datos de resumen para Excel
function generateSummaryData(data) {
    const stats = generateChangeStats();
    
    if (!stats) return [];
    
    const summary = [
        { Concepto: 'RESUMEN GENERAL', Valor: '' },
        { Concepto: 'Total de cambios', Valor: stats.totalChanges },
        { Concepto: 'Usuarios activos', Valor: Object.keys(stats.changesByUser).length },
        { Concepto: 'Días con actividad', Valor: Object.keys(stats.changesByDay).length },
        { Concepto: '', Valor: '' },
        { Concepto: 'TOP USUARIOS', Valor: '' }
    ];
    
    stats.topUsers.forEach((user, index) => {
        summary.push({
            Concepto: `${index + 1}. ${user.user}`,
            Valor: `${user.count} cambios`
        });
    });
    
    summary.push({ Concepto: '', Valor: '' });
    summary.push({ Concepto: 'TIPOS DE CAMBIO MÁS FRECUENTES', Valor: '' });
    
    stats.topTypes.forEach((type, index) => {
        summary.push({
            Concepto: `${index + 1}. ${type.type}`,
            Valor: `${type.count} cambios`
        });
    });
    
    return summary;
}

// Formatear fecha para Excel
function formatDateForExcel(dateString) {
    if (!dateString) return '';
    
    try {
        let date;
        if (typeof dateString === 'string' && dateString.includes('-')) {
            const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
            date = new Date(year, month - 1, day);
        } else {
            date = new Date(dateString);
        }
        
        if (isNaN(date.getTime())) return dateString;
        
        return date.toLocaleDateString('es-GT');
    } catch (error) {
        return dateString;
    }
}

// Formatear hora para Excel
function formatTimeForExcel(dateTimeString) {
    if (!dateTimeString) return '';
    
    try {
        const date = new Date(dateTimeString);
        if (isNaN(date.getTime())) return '';
        
        return date.toLocaleTimeString('es-GT', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    } catch (error) {
        return '';
    }
}

// Generar nombre de archivo Excel
function generateExcelFileName() {
    const now = new Date();
    const timestamp = now.toISOString().slice(0, 19).replace(/[:.]/g, '-');
    const dateRange = `${fechaDesde.value}_al_${fechaHasta.value}`;
    return `Historial_Cambios_Facturas_${dateRange}_${timestamp}.xlsx`;
}

// Actualizar estado del botón de exportación
function updateExportButtonState() {
    const exportBtn = document.getElementById('exportExcel');
    if (exportBtn) {
        exportBtn.disabled = currentData.length === 0;
        exportBtn.style.display = currentData.length === 0 ? 'none' : 'flex';
    }
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
            if (filters.tipoModificacion) tipoModificacion.value = filters.tipoModificacion;
        }
        
    } catch (error) {
        console.warn('Error cargando preferencias:', error);
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
            tipoModificacion: tipoModificacion.value
        };
        localStorage.setItem('historial_filters', JSON.stringify(filters));
        
    } catch (error) {
        console.warn('Error guardando preferencias:', error);
    }
}

// Event listener para guardar preferencias antes de salir
window.addEventListener('beforeunload', () => {
    saveUserPreferences();
});

// Monitor de rendimiento (solo en modo desarrollo)
function performanceMonitor() {
    if (performance && performance.memory && localStorage.getItem('debug_mode') === 'true') {
        const memory = performance.memory;
        console.log('📊 Memory usage:', {
            used: Math.round(memory.usedJSHeapSize / 1048576) + ' MB',
            total: Math.round(memory.totalJSHeapSize / 1048576) + ' MB',
            limit: Math.round(memory.jsHeapSizeLimit / 1048576) + ' MB'
        });
    }
}

// Ejecutar monitor cada 30 segundos en modo desarrollo
if (localStorage.getItem('debug_mode') === 'true') {
    setInterval(performanceMonitor, 30000);
}

// ===== INICIALIZACIÓN FINAL =====

// Validar que todos los elementos se inicializaron correctamente
function validateInitialization() {
    const requiredElements = [
        'filtersForm', 'fechaDesde', 'fechaHasta', 'resultsContainer', 
        'changesTable', 'paginationContainer'
    ];
    
    for (const elementId of requiredElements) {
        if (!document.getElementById(elementId)) {
            console.error(`❌ Elemento requerido no encontrado: ${elementId}`);
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
    
    console.log('✅ Aplicación inicializada correctamente');
});

// ===== FUNCIONES GLOBALES EXPUESTAS =====

// Hacer funciones disponibles globalmente
window.goToPage = goToPage;
window.showStatsModal = showStatsModal;
window.exportToExcel = exportToExcel;

// Exportar funciones principales para testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        searchChangesHistory,
        generateChangeStats,
        formatDateDisplay,
        formatTimeDisplay,
        formatCurrency,
        escapeHtml,
        validateDates,
        getTipoModificacionText,
        getManeraRefacturacionText,
        exportToExcel
    };
}