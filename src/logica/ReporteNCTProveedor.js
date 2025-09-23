const odbc = require('odbc');
const Swal = require('sweetalert2');
const XLSX = require('xlsx');

let currentSearchType = 'all';
let currentPage = 1;
let itemsPerPage = 50; // Aumentamos para mejor rendimiento en tabla
let totalRecords = 0;
let allCreditNotes = [];
let filteredCreditNotes = [];

// Variables para el panel de búsqueda
let isSearchPanelCollapsed = false;
let searchPanel = null;

// Elementos del DOM
let searchForm, searchFields, creditNotesTable, creditNotesTableBody, resultsPanel, noResultsPanel;
let searchTypeButtons, exportBtn, printBtn, adjustFiltersBtn;
let creditNoteDetailModal, closeDetailModal;
let clearFiltersInlineBtn = null;
let loadingOverlay = null;

// Variables para control de filas expandidas
let expandedRows = new Set();

document.addEventListener('DOMContentLoaded', () => {
    
    // Inicializar elementos del DOM
    initializeDOMElements();
    
    // Inicializar la aplicación
    initializeApp();
    
    // Configurar event listeners
    setupEventListeners();
});

function initializeDOMElements() {
    
    // Elementos principales
    searchForm = document.getElementById('searchForm');
    searchFields = document.getElementById('searchFields');
    creditNotesTable = document.getElementById('creditNotesTable');
    creditNotesTableBody = document.getElementById('creditNotesTableBody');
    resultsPanel = document.getElementById('resultsPanel');
    noResultsPanel = document.getElementById('noResultsPanel');
    searchPanel = document.querySelector('.search-panel');
    loadingOverlay = document.getElementById('loadingOverlay');
    
    // Botones de tipo de búsqueda
    searchTypeButtons = document.querySelectorAll('.search-type-btn');
    
    // Botones de acción
    exportBtn = document.getElementById('exportBtn');
    printBtn = document.getElementById('printBtn');
    adjustFiltersBtn = document.getElementById('adjustFiltersBtn');
    clearFiltersInlineBtn = document.getElementById('clearFiltersInline');
    
    // Modal de detalle
    creditNoteDetailModal = document.getElementById('creditNoteDetailModal');
    closeDetailModal = document.getElementById('closeDetailModal');
    
    // Verificar elementos críticos
    if (!searchForm || !creditNotesTable || !creditNotesTableBody) {
        showErrorToast('Error al inicializar la aplicación. Recargue la página.');
        return false;
    }
    return true;
}

function initializeApp() {
    
    try {
        // Animar elementos de entrada
        animatePageElements();
        
        // Cargar información del usuario
        loadUserInfo();
        
        // Configurar campos inline por defecto
        updateInlineFields();
        
        // Configurar fechas por defecto
        setupInlineDateFields();
        
        // Ocultar paneles de resultados
        hideAllResultPanels();
        
        // Configurar tabla inicial
        setupInitialTable();
    } catch (error) {
        showErrorToast('Error al configurar la aplicación');
    }
}

function setupEventListeners() {
    
    try {
        // Botones de tipo de búsqueda
        searchTypeButtons.forEach(button => {
            button.addEventListener('click', handleSearchTypeChangeInline);
        });
        
        // Formulario de búsqueda
        if (searchForm) {
            searchForm.addEventListener('submit', handleSearchInline);
        }
        
        // Limpiar filtros (botón inline)
        if (clearFiltersInlineBtn) {
            clearFiltersInlineBtn.addEventListener('click', clearAllFiltersInline);
        }
        
        // Botones de acción
        if (exportBtn) exportBtn.addEventListener('click', handleExport);
        if (printBtn) printBtn.addEventListener('click', handlePrint);
        if (adjustFiltersBtn) adjustFiltersBtn.addEventListener('click', scrollToFilters);
        
        // Modal de detalle
        if (closeDetailModal) {
            closeDetailModal.addEventListener('click', closeDetailModalFunc);
        }
        
        // Cerrar modal al hacer clic fuera
        if (creditNoteDetailModal) {
            creditNoteDetailModal.addEventListener('click', (e) => {
                if (e.target === creditNoteDetailModal) {
                    closeDetailModalFunc();
                }
            });
        }
        
        // Eventos de teclado para accesibilidad
        document.addEventListener('keydown', handleKeyboardNavigation);
        
        // Configurar fechas por defecto y validación
        setupInlineDateFields();
        
        // Agregar botón de toggle al panel (con delay para asegurar DOM)
        setTimeout(() => {
            addToggleButtonToPanel();
        }, 100);
        
        // Event listener para redimensionamiento de ventana
        window.addEventListener('resize', handleWindowResize);
        
    } catch (error) {
        showErrorToast('Error en la configuración de eventos');
    }
}

function animatePageElements() {
    
    const elements = [
        document.querySelector('.search-panel'),
        document.querySelector('.results-panel')
    ];

    elements.forEach((element, index) => {
        if (element) {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            
            setTimeout(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, 100 + (index * 150));
        }
    });
}

function loadUserInfo() {
    
    try {
        const userName = localStorage.getItem('userName');
        const userNameElement = document.getElementById('userName');
        
        if (userName && userNameElement) {
            userNameElement.textContent = userName;
        } else {
        }
    } catch (error) {
    }
}

function addToggleButtonToPanel() {
    if (!searchPanel) {
        return;
    }
    
    const panelHeader = searchPanel.querySelector('.panel-header');
    if (!panelHeader) {
        return;
    }
    
    // Verificar si ya existe el botón
    if (panelHeader.querySelector('.panel-toggle')) {
        return;
    }
    
    const toggleButton = document.createElement('button');
    toggleButton.className = 'panel-toggle';
    toggleButton.type = 'button';
    toggleButton.innerHTML = '<i class="fas fa-chevron-up"></i>';
    toggleButton.title = 'Colapsar panel de búsqueda';
    
    toggleButton.addEventListener('click', toggleSearchPanel);
    
    panelHeader.appendChild(toggleButton);
}

function toggleSearchPanel() {
    if (!searchPanel) return;
    
    const toggleButton = searchPanel.querySelector('.panel-toggle');
    const toggleIcon = toggleButton?.querySelector('i');
    
    isSearchPanelCollapsed = !isSearchPanelCollapsed;
    
    if (isSearchPanelCollapsed) {
        searchPanel.classList.add('collapsed');
        if (toggleIcon) toggleIcon.className = 'fas fa-chevron-down';
        if (toggleButton) toggleButton.title = 'Expandir panel de búsqueda';
    } else {
        searchPanel.classList.remove('collapsed');
        if (toggleIcon) toggleIcon.className = 'fas fa-chevron-up';
        if (toggleButton) toggleButton.title = 'Colapsar panel de búsqueda';
    }
}

function autoCollapsePanel() {
    if (!searchPanel || isSearchPanelCollapsed) return;
    
    // Auto-colapsar solo si hay resultados
    if (filteredCreditNotes && filteredCreditNotes.length > 0) {
        setTimeout(() => {
            toggleSearchPanel();
        }, 1000); // Delay para que el usuario vea los resultados primero
    }
}

function setupInlineDateFields() {
    const fechaInicio = document.getElementById('fechaInicioInline');
    const fechaFin = document.getElementById('fechaFinInline');
    
    if (fechaInicio && fechaFin) {
        try {
            // Configurar fecha fin como hoy
            const today = new Date();
            fechaFin.value = today.toISOString().split('T')[0];
            
            // Configurar fecha inicio como 30 días atrás por defecto
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(today.getDate() - 30);
            fechaInicio.value = thirtyDaysAgo.toISOString().split('T')[0];
            
            // Agregar event listeners para validación
            fechaInicio.addEventListener('change', validateInlineDateRange);
            fechaFin.addEventListener('change', validateInlineDateRange);
        } catch (error) {
        }
    } else {
    }
}

function handleSearchTypeChangeInline(e) {
    e.preventDefault();
    try {
        // Remover clase active de todos los botones
        searchTypeButtons.forEach(btn => btn.classList.remove('active'));
        
        // Agregar clase active al botón seleccionado
        e.currentTarget.classList.add('active');
        
        // Actualizar tipo de búsqueda actual
        const newSearchType = e.currentTarget.dataset.type;
        currentSearchType = newSearchType;
        
        // Actualizar campos visibles
        updateInlineFields();
        
        // Actualizar indicador de filtros
        setTimeout(updateFiltersIndicator, 100);
        
    } catch (error) {
        showErrorToast('Error al cambiar el tipo de búsqueda');
    }
}

function updateInlineFields() {
    
    try {
        // Ocultar todos los campos
        const dateFields = document.querySelector('.date-fields-inline');
        const serieInput = document.querySelector('.serie-input');
        const numeroInput = document.querySelector('.numero-input');
        const productInput = document.querySelector('.product-input');
        const searchInfo = document.getElementById('searchInfoInline');
        
        // Ocultar todos primero
        if (dateFields) dateFields.style.display = 'none';
        if (serieInput) serieInput.style.display = 'none';
        if (numeroInput) numeroInput.style.display = 'none';
        if (productInput) productInput.style.display = 'none';
        if (searchInfo) searchInfo.style.display = 'none';
        
        // Actualizar clase del formulario para CSS
        const searchMainRow = document.querySelector('.search-main-row');
        if (searchMainRow) {
            searchMainRow.className = `search-main-row search-type-${currentSearchType}`;
        }
        
        // Mostrar campos según el tipo
        switch (currentSearchType) {
            case 'all':
                if (dateFields) dateFields.style.display = 'flex';
                break;
                
            case 'invoice':
            case 'credit-note':
                if (serieInput) serieInput.style.display = 'block';
                if (numeroInput) numeroInput.style.display = 'block';
                break;
                
            case 'product':
                if (productInput) productInput.style.display = 'block';
                break;
                
            default:
        }
        
    } catch (error) {
    }
}

function validateInlineDateRange() {
    
    const fechaInicio = document.getElementById('fechaInicioInline');
    const fechaFin = document.getElementById('fechaFinInline');
    
    if (fechaInicio && fechaFin && fechaInicio.value && fechaFin.value) {
        try {
            const startDate = new Date(fechaInicio.value);
            const endDate = new Date(fechaFin.value);
            
            // Limpiar clases previas
            fechaInicio.classList.remove('valid', 'invalid');
            fechaFin.classList.remove('valid', 'invalid');
            
            if (startDate > endDate) {
                showWarningToast('La fecha de inicio no puede ser mayor que la fecha de fin');
                fechaInicio.classList.add('invalid');
                fechaFin.classList.add('invalid');
                return false;
            } else {
                fechaInicio.classList.add('valid');
                fechaFin.classList.add('valid');
                setTimeout(updateFiltersIndicator, 100);
                return true;
            }
        } catch (error) {
            return false;
        }
    } else {
        setTimeout(updateFiltersIndicator, 100);
    }
    return true;
}

function updateFiltersIndicator() {
    if (!searchPanel) return;
    
    try {
        const params = getInlineSearchParameters();
        let hasActiveFilters = false;
        
        switch (params.type) {
            case 'all':
                hasActiveFilters = params.fechaInicio || params.fechaFin;
                break;
            case 'invoice':
                hasActiveFilters = params.invoiceSerie || params.invoiceNumber;
                break;
            case 'credit-note':
                hasActiveFilters = params.creditNoteSerie || params.creditNoteNumber;
                break;
            case 'product':
                hasActiveFilters = params.productSearch && params.productSearch.length >= 3;
                break;
        }
        
        if (hasActiveFilters) {
            searchPanel.classList.add('has-filters');
        } else {
            searchPanel.classList.remove('has-filters');
        }
        
    } catch (error) {
    }
}

function setupInitialTable() {
    
    try {
        if (!creditNotesTableBody) {
            return;
        }
        
        // Limpiar tabla
        creditNotesTableBody.innerHTML = '';
        
        // Mostrar mensaje inicial
        creditNotesTableBody.innerHTML = `
            <tr>
                <td colspan="9" style="text-align: center; padding: 60px 20px; color: var(--text-secondary);">
                    <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                        <i class="fas fa-search" style="font-size: 48px; opacity: 0.3;"></i>
                        <h3 style="margin: 0; font-weight: 600;">Realizar Búsqueda</h3>
                        <p style="margin: 0; font-size: 14px;">Configure los filtros y presione "Buscar" para ver las notas de crédito</p>
                    </div>
                </td>
            </tr>
        `;
        
    } catch (error) {
    }
}

function hideAllResultPanels() {
    try {
        if (resultsPanel) resultsPanel.style.display = 'none';
        if (noResultsPanel) noResultsPanel.style.display = 'none';
    } catch (error) {
    }
}

function handleKeyboardNavigation(e) {
    // ESC para cerrar modal
    if (e.key === 'Escape') {
        if (creditNoteDetailModal && creditNoteDetailModal.style.display !== 'none') {
            closeDetailModalFunc();
        }
    }
    
    // Ctrl + F para enfocar búsqueda
    if (e.ctrlKey && e.key === 'f') {
        e.preventDefault();
        const firstVisibleInput = document.querySelector('.search-inputs-inline input:not([style*="display: none"])');
        if (firstVisibleInput) {
            firstVisibleInput.focus();
        }
    }
}

function handleWindowResize() {
    // Ajustar tabla si es necesario
    if (creditNotesTable && filteredCreditNotes.length > 0) {
    }
}
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

function showLoadingOverlay(message = 'Cargando datos...') {
    if (loadingOverlay) {
        const loadingText = loadingOverlay.querySelector('.loading-text');
        if (loadingText) {
            loadingText.textContent = message;
        }
        loadingOverlay.style.display = 'flex';
    }
}

function hideLoadingOverlay() {
    if (loadingOverlay) {
        loadingOverlay.style.display = 'none';
    }
}

function getInlineSearchParameters() {
    
    const params = {
        type: currentSearchType
    };
    
    try {
        switch (currentSearchType) {
            case 'all':
                params.fechaInicio = document.getElementById('fechaInicioInline')?.value || '';
                params.fechaFin = document.getElementById('fechaFinInline')?.value || '';
                break;
                
            case 'invoice':
                params.invoiceSerie = document.getElementById('serieInline')?.value.trim() || '';
                params.invoiceNumber = document.getElementById('numeroInline')?.value.trim() || '';
                break;
                
            case 'credit-note':
                params.creditNoteSerie = document.getElementById('serieInline')?.value.trim() || '';
                params.creditNoteNumber = document.getElementById('numeroInline')?.value.trim() || '';
                break;
                
            case 'product':
                params.productSearch = document.getElementById('productSearchInline')?.value.trim() || '';
                break;
                
            default:
        }
        return params;
        
    } catch (error) {
        return { type: 'all' };
    }
}

function validateInlineSearchParameters(params) {
    try {
        switch (params.type) {
            case 'all':
                if (params.fechaInicio && params.fechaFin) {
                    const startDate = new Date(params.fechaInicio);
                    const endDate = new Date(params.fechaFin);
                    
                    if (startDate > endDate) {
                        showErrorToast('La fecha de inicio no puede ser mayor que la fecha de fin');
                        return false;
                    }
                    
                    const today = new Date();
                    today.setHours(23, 59, 59, 999);
                    
                    if (endDate > today) {
                        showErrorToast('La fecha de fin no puede ser futura');
                        return false;
                    }
                    
                    // Validar que no sea un rango muy amplio (más de 2 años)
                    const diffTime = Math.abs(endDate - startDate);
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays > 730) {
                        showWarningToast('Se recomienda un rango de fechas menor a 2 años para mejor rendimiento');
                    }
                }
                break;
                
            case 'invoice':
                if (!params.invoiceSerie && !params.invoiceNumber) {
                    showErrorToast('Debe ingresar al menos la serie o el número de la factura');
                    return false;
                }
                
                if (params.invoiceSerie && params.invoiceSerie.length < 2) {
                    showErrorToast('La serie debe tener al menos 2 caracteres');
                    return false;
                }
                break;
                
            case 'credit-note':
                if (!params.creditNoteSerie && !params.creditNoteNumber) {
                    showErrorToast('Debe ingresar al menos la serie o el número de la nota de crédito');
                    return false;
                }
                
                if (params.creditNoteSerie && params.creditNoteSerie.length < 2) {
                    showErrorToast('La serie debe tener al menos 2 caracteres');
                    return false;
                }
                break;
                
            case 'product':
                if (!params.productSearch || params.productSearch.length < 3) {
                    showErrorToast('Debe ingresar al menos 3 caracteres para buscar por producto');
                    return false;
                }
                
                // Validar que no tenga caracteres especiales peligrosos
                if (/[<>'"%;()&+]/.test(params.productSearch)) {
                    showErrorToast('El término de búsqueda contiene caracteres no permitidos');
                    return false;
                }
                break;
                
            default:
                showErrorToast('Tipo de búsqueda no válido');
                return false;
        }
        return true;
        
    } catch (error) {
        showErrorToast('Error en la validación de parámetros');
        return false;
    }
}

async function handleSearchInline(e) {
    e.preventDefault();
    
    // Mostrar loading
    showLoadingStateInline(true);
    showLoadingOverlay('Buscando notas de crédito...');
    
    try {
        // Obtener y validar parámetros
        const searchParams = getInlineSearchParameters();
        
        if (!validateInlineSearchParameters(searchParams)) {
            return;
        }
        
        // Ejecutar búsqueda
        const results = await executeSearch(searchParams);
        
        // Procesar resultados
        if (results && results.length > 0) {
            
            allCreditNotes = results;
            filteredCreditNotes = results;
            totalRecords = results.length;
            currentPage = 1;
            expandedRows.clear(); // Limpiar filas expandidas
            
            displayResults();
            
            // Auto-colapsar panel después de mostrar resultados
            setTimeout(() => {
                autoCollapsePanel();
            }, 1500);
            
        } else {
            showNoResults();
        }
        
    } catch (error) {
        handleSearchError(error);
    } finally {
        showLoadingStateInline(false);
        hideLoadingOverlay();
    }
}

async function executeSearch(params) {
    let connection = null;
    
    try {
        connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        // Construir query base
        let query = `
            SELECT DISTINCT
                NCTProveedores.IdNotaCreditoProveedores, 
                NCTProveedores.NombreProveedore, 
                NCTProveedores.NIT, 
                NCTProveedores.Monto, 
                NCTProveedores.Serie, 
                NCTProveedores.Numero, 
                NCTProveedores.IdConcepto,
                TiposNotaCredito.TipoNotaCredito, 
                NCTProveedores.Observaciones, 
                NCTProveedores.FechaHoraRegistro, 
                NCTProveedores.NombreUsuario, 
                facturas_compras.Serie AS SeriaFacturaRecibida, 
                facturas_compras.Numero AS NumeroFacturaRecibida, 
                estado_facturas.Estado AS EstadoFactura, 
                facturas_compras.MontoFactura, 
                facturas_compras.FechaRecepcion, 
                facturas_compras.FechaFactura, 
                facturas_compras.IdInventory, 
                facturas_compras.IdSucursalCori, 
                razonessociales.NombreRazon,
                CASE 
                    WHEN NCTProveedores.IdConcepto = 1 THEN 'Mercadería'
                    WHEN NCTProveedores.IdConcepto = 2 THEN 'Otros Conceptos'
                    ELSE 'Sin Clasificar'
                END AS TipoConcepto
            FROM NCTProveedores
            INNER JOIN TiposNotaCredito
                ON NCTProveedores.TipoNotaCredito = TiposNotaCredito.IdTipoNotasCredito
            INNER JOIN facturas_compras
                ON NCTProveedores.IdFacturaCompras = facturas_compras.Id
            INNER JOIN estado_facturas
                ON facturas_compras.Estado = estado_facturas.IdEstado
            INNER JOIN razonessociales
                ON facturas_compras.IdRazon = razonessociales.Id
        `;
        
        // Construir condiciones WHERE y parámetros
        const { whereClause, queryParams } = buildWhereClause(params);
        
        if (whereClause) {
            query += ` WHERE ${whereClause}`;
        }
        
        // Ordenar por fecha descendente para mostrar más recientes primero
        query += ` ORDER BY NCTProveedores.FechaHoraRegistro DESC`;
        
        // Ejecutar query con timeout
        const result = await Promise.race([
            connection.query(query, queryParams),
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error('Timeout en la consulta')), 30000)
            )
        ]);
        return result;
        
    } catch (error) {
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
            }
        }
    }
}

function buildWhereClause(params) {
    
    const conditions = [];
    const queryParams = [];
    
    try {
        // Filtros específicos según tipo de búsqueda
        switch (params.type) {
            case 'all':
                // Filtros por rango de fechas
                if (params.fechaInicio) {
                    conditions.push('NCTProveedores.FechaHoraRegistro >= ?');
                    queryParams.push(params.fechaInicio + ' 00:00:00');
                }
                if (params.fechaFin) {
                    conditions.push('NCTProveedores.FechaHoraRegistro <= ?');
                    queryParams.push(params.fechaFin + ' 23:59:59');
                }
                break;
                
            case 'invoice':
                if (params.invoiceSerie) {
                    conditions.push('UPPER(facturas_compras.Serie) LIKE UPPER(?)');
                    queryParams.push(`%${params.invoiceSerie}%`);
                }
                if (params.invoiceNumber) {
                    conditions.push('facturas_compras.Numero LIKE ?');
                    queryParams.push(`%${params.invoiceNumber}%`);
                }
                break;
                
            case 'credit-note':
                if (params.creditNoteSerie) {
                    conditions.push('UPPER(NCTProveedores.Serie) LIKE UPPER(?)');
                    queryParams.push(`%${params.creditNoteSerie}%`);
                }
                if (params.creditNoteNumber) {
                    conditions.push('NCTProveedores.Numero LIKE ?');
                    queryParams.push(`%${params.creditNoteNumber}%`);
                }
                break;
                
            case 'product':
                if (params.productSearch) {
                    conditions.push(`EXISTS (
                        SELECT 1 FROM NCTProveedoresDetalle 
                        WHERE NCTProveedoresDetalle.IdNTCProveedor = NCTProveedores.IdNotaCreditoProveedores
                        AND (
                            UPPER(NCTProveedoresDetalle.Upc) LIKE UPPER(?) 
                            OR UPPER(NCTProveedoresDetalle.Descripcion) LIKE UPPER(?)
                        )
                    )`);
                    const searchTerm = `%${params.productSearch}%`;
                    queryParams.push(searchTerm, searchTerm);
                }
                break;
                
            default:
        }
        
        const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';
        
        return { whereClause, queryParams };
        
    } catch (error) {
        return { whereClause: '', queryParams: [] };
    }
}

function handleSearchError(error) {
    
    let errorMessage = 'Error al buscar notas de crédito. ';
    
    // Clasificar tipos de error
    if (error.message) {
        if (error.message.includes('connection') || error.message.includes('connect')) {
            errorMessage += 'Verifique la conexión a la base de datos.';
        } else if (error.message.includes('timeout') || error.message.includes('Timeout')) {
            errorMessage += 'La consulta tardó demasiado tiempo. Intente con filtros más específicos.';
        } else if (error.message.includes('syntax') || error.message.includes('SQL')) {
            errorMessage += 'Error en la consulta. Contacte al administrador.';
        } else if (error.message.includes('permission') || error.message.includes('access')) {
            errorMessage += 'No tiene permisos para acceder a los datos.';
        } else {
            errorMessage += 'Por favor intente nuevamente.';
        }
    } else {
        errorMessage += 'Error desconocido. Contacte al soporte técnico.';
    }
    
    Swal.fire({
        icon: 'error',
        title: 'Error de búsqueda',
        text: errorMessage,
        confirmButtonColor: '#6e78ff',
        footer: 'Si el problema persiste, contacte al administrador del sistema'
    });
}

function clearAllFiltersInline() {
    
    try {
        // Limpiar todos los campos inline
        const fechaInicio = document.getElementById('fechaInicioInline');
        const fechaFin = document.getElementById('fechaFinInline');
        const serie = document.getElementById('serieInline');
        const numero = document.getElementById('numeroInline');
        const product = document.getElementById('productSearchInline');
        
        if (fechaInicio) fechaInicio.value = '';
        if (fechaFin) fechaFin.value = '';
        if (serie) serie.value = '';
        if (numero) numero.value = '';
        if (product) product.value = '';
        
        // Limpiar estilos de validación
        [fechaInicio, fechaFin, serie, numero, product].forEach(input => {
            if (input) {
                input.classList.remove('valid', 'invalid');
                input.style.borderColor = '';
            }
        });
        
        // Resetear a "Mostrar Todas"
        searchTypeButtons.forEach(btn => btn.classList.remove('active'));
        const searchAllBtn = document.getElementById('searchAll');
        if (searchAllBtn) {
            searchAllBtn.classList.add('active');
        }
        currentSearchType = 'all';
        updateInlineFields();
        
        // Configurar fechas por defecto
        setupInlineDateFields();
        
        // Limpiar resultados
        allCreditNotes = [];
        filteredCreditNotes = [];
        totalRecords = 0;
        currentPage = 1;
        expandedRows.clear();
        
        // Ocultar resultados y mostrar estado inicial
        hideAllResultPanels();
        setupInitialTable();
        
        // Expandir panel si está colapsado
        if (isSearchPanelCollapsed) {
            toggleSearchPanel();
        }
        
        // Actualizar indicador de filtros
        updateFiltersIndicator();
        
        showSuccessToast('Filtros limpiados correctamente');
        
    } catch (error) {
        showErrorToast('Error al limpiar los filtros');
    }
}

function showLoadingStateInline(isLoading) {
    try {
        const searchButton = document.querySelector('.search-button-inline');
        const buttonText = searchButton?.querySelector('.button-text');
        const buttonIcon = searchButton?.querySelector('.button-icon');
        
        if (isLoading) {
            if (buttonText) buttonText.textContent = 'Buscando...';
            if (buttonIcon) buttonIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
            if (searchButton) {
                searchButton.disabled = true;
                searchButton.classList.add('loading');
                searchButton.style.cursor = 'not-allowed';
                searchButton.style.opacity = '0.8';
            }
        } else {
            if (buttonText) buttonText.textContent = 'Buscar';
            if (buttonIcon) buttonIcon.innerHTML = '<i class="fas fa-search"></i>';
            if (searchButton) {
                searchButton.disabled = false;
                searchButton.classList.remove('loading');
                searchButton.style.cursor = 'pointer';
                searchButton.style.opacity = '1';
            }
        }
    } catch (error) {
    }
}

function scrollToFilters() {
    try {
        if (!searchPanel) {
            return;
        }
        
        // Expandir panel si está colapsado
        if (isSearchPanelCollapsed) {
            toggleSearchPanel();
        }
        
        // Scroll suave hacia el panel
        setTimeout(() => {
            searchPanel.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
            
            // Focus en el primer campo visible después del scroll
            setTimeout(() => {
                const firstVisibleInput = document.querySelector('.search-inputs-inline input:not([style*="display: none"])');
                if (firstVisibleInput) {
                    firstVisibleInput.focus();
                }
            }, 500);
        }, isSearchPanelCollapsed ? 400 : 0);
        
    } catch (error) {
    }
}
function getFiltersState() {
    try {
        return {
            searchType: currentSearchType,
            parameters: getInlineSearchParameters(),
            hasActiveFilters: searchPanel?.classList.contains('has-filters') || false,
            isCollapsed: isSearchPanelCollapsed,
            currentPage: currentPage,
            totalRecords: totalRecords
        };
    } catch (error) {
        return null;
    }
}

function applyFiltersState(state) {
    if (!state) {
        return;
    }
    
    try {
        if (state.searchType) {
            currentSearchType = state.searchType;
            searchTypeButtons.forEach(btn => btn.classList.remove('active'));
            const targetBtn = document.querySelector(`[data-type="${state.searchType}"]`);
            if (targetBtn) targetBtn.classList.add('active');
            updateInlineFields();
        }
        
        if (state.parameters) {
            const params = state.parameters;
            
            switch (params.type) {
                case 'all':
                    const fechaInicio = document.getElementById('fechaInicioInline');
                    const fechaFin = document.getElementById('fechaFinInline');
                    if (fechaInicio && params.fechaInicio) fechaInicio.value = params.fechaInicio;
                    if (fechaFin && params.fechaFin) fechaFin.value = params.fechaFin;
                    break;
                    
                case 'invoice':
                case 'credit-note':
                    const serie = document.getElementById('serieInline');
                    const numero = document.getElementById('numeroInline');
                    if (serie && (params.invoiceSerie || params.creditNoteSerie)) {
                        serie.value = params.invoiceSerie || params.creditNoteSerie;
                    }
                    if (numero && (params.invoiceNumber || params.creditNoteNumber)) {
                        numero.value = params.invoiceNumber || params.creditNoteNumber;
                    }
                    break;
                    
                case 'product':
                    const product = document.getElementById('productSearchInline');
                    if (product && params.productSearch) product.value = params.productSearch;
                    break;
            }
        }
        
        if (state.currentPage) {
            currentPage = state.currentPage;
        }
        
        if (state.totalRecords) {
            totalRecords = state.totalRecords;
        }
        
        if (state.isCollapsed && !isSearchPanelCollapsed) {
            toggleSearchPanel();
        }
        
        updateFiltersIndicator();
        
    } catch (error) {
    }
}

function displayResults() {
    
    try {
        // Mostrar panel de resultados
        hideAllResultPanels();
        resultsPanel.style.display = 'flex';
        
        // Actualizar contador de resultados
        updateResultsCount();
        
        // Mostrar resumen estadístico
        displayResultsSummary();
        
        // Renderizar tabla de notas de crédito
        displayCreditNotesTable();
        
        // Mostrar paginación
        displayPagination();
        
        // Actualizar indicador de filtros
        updateFiltersIndicator();
        
        // Animar panel de resultados
        setTimeout(() => {
            resultsPanel.classList.add('animate-slide-up');
            
            // Scroll hacia resultados
            resultsPanel.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
        
        showSuccessToast(`Se encontraron ${totalRecords} nota(s) de crédito`);
        
    } catch (error) {
        showErrorToast('Error al mostrar los resultados');
    }
}
function updateResultsCount() {
    try {
        const resultsCount = document.getElementById('resultsCount');
        if (resultsCount) {
            const text = totalRecords === 1 ? '1 registro encontrado' : `${totalRecords} registros encontrados`;
            resultsCount.textContent = text;
        }
    } catch (error) {
    }
}

function displayResultsSummary() {
    try {
        const resultsSummary = document.getElementById('resultsSummary');
        if (!resultsSummary) return;
        
        // Calcular estadísticas
        const totalAmount = filteredCreditNotes.reduce((sum, note) => sum + parseFloat(note.Monto || 0), 0);
        const merchandiseNotes = filteredCreditNotes.filter(note => note.IdConcepto === 1).length;
        const conceptNotes = filteredCreditNotes.filter(note => note.IdConcepto === 2).length;
        
        resultsSummary.innerHTML = `
            <div class="summary-item">
                <div class="summary-label">Total Notas</div>
                <div class="summary-value">${totalRecords}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Monto Total</div>
                <div class="summary-value">${formatCurrency(totalAmount)}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Mercadería</div>
                <div class="summary-value">${merchandiseNotes}</div>
            </div>
            <div class="summary-item">
                <div class="summary-label">Otros Conceptos</div>
                <div class="summary-value">${conceptNotes}</div>
            </div>
        `;
        
    } catch (error) {
    }
}

function displayCreditNotesTable() {
    if (!creditNotesTableBody) {
        return;
    }
    
    try {
        // Calcular registros para la página actual
        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const pageRecords = filteredCreditNotes.slice(startIndex, endIndex);
        
        if (pageRecords.length === 0) {
            creditNotesTableBody.innerHTML = `
                <tr>
                    <td colspan="9" style="text-align: center; padding: 40px 20px; color: var(--text-secondary);">
                        <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                            <i class="fas fa-inbox" style="font-size: 48px; opacity: 0.5;"></i>
                            <p>No hay registros para mostrar en esta página.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }
        
        // Generar HTML para cada fila
        const tableRows = pageRecords.map((note, index) => {
            const rowId = `row-${note.IdNotaCreditoProveedores}`;
            const detailRowId = `detail-${note.IdNotaCreditoProveedores}`;
            const isExpanded = expandedRows.has(note.IdNotaCreditoProveedores);
            
            return `
                <tr class="credit-note-row ${isExpanded ? 'expanded' : ''}" id="${rowId}">
                    <td>
                        <button class="expand-btn ${isExpanded ? 'expanded' : ''}" 
                                onclick="toggleCreditNoteDetails(${note.IdNotaCreditoProveedores})"
                                title="Ver detalles">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </td>
                    <td>
                        <span class="nota-credito">${note.Serie || ''}-${note.Numero || ''}</span>
                    </td>
                    <td>
                        <span class="proveedor-name" title="${note.NombreProveedore || 'Sin proveedor'}">${note.NombreProveedore || 'Sin proveedor'}</span>
                    </td>
                    <td>
                        <span class="tipo-nota">${note.TipoNotaCredito || 'Sin tipo'}</span>
                    </td>
                    <td>
                        <span class="monto-value">${formatCurrency(note.Monto)}</span>
                    </td>
                    <td>
                        <span class="fecha-value">${formatDate(note.FechaHoraRegistro)}</span>
                    </td>
                    <td>
                        <span class="factura-original">${note.SeriaFacturaRecibida || ''}-${note.NumeroFacturaRecibida || ''}</span>
                    </td>
                    <td>
                        <span class="concepto-badge ${note.IdConcepto === 1 ? 'mercaderia' : 'concepto'}">
                            ${note.IdConcepto === 1 ? 'Mercadería' : 'Otros Conceptos'}
                        </span>
                    </td>
                    <td>
                        <span class="usuario-name">${note.NombreUsuario || 'N/A'}</span>
                    </td>
                </tr>
                <tr class="detail-row ${isExpanded ? 'show' : ''}" id="${detailRowId}">
                    <td colspan="9">
                        <div class="detail-content" id="detail-content-${note.IdNotaCreditoProveedores}">
                            ${isExpanded ? '<div style="text-align: center; padding: 20px;"><i class="fas fa-spinner fa-spin"></i> Cargando detalles...</div>' : ''}
                        </div>
                    </td>
                </tr>
            `;
        }).join('');
        
        creditNotesTableBody.innerHTML = tableRows;
        
        // Cargar detalles para filas ya expandidas
        pageRecords.forEach(note => {
            if (expandedRows.has(note.IdNotaCreditoProveedores)) {
                loadCreditNoteDetailsAsync(note.IdNotaCreditoProveedores);
            }
        });
        
        // Animar filas
        const rows = creditNotesTableBody.querySelectorAll('.credit-note-row');
        rows.forEach((row, index) => {
            row.style.opacity = '0';
            row.style.transform = 'translateY(10px)';
            row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            
            setTimeout(() => {
                row.style.opacity = '1';
                row.style.transform = 'translateY(0)';
            }, index * 50);
        });
        
    } catch (error) {
        showErrorToast('Error al mostrar los datos en la tabla');
    }
}

async function toggleCreditNoteDetails(creditNoteId) {
    
    try {
        const row = document.getElementById(`row-${creditNoteId}`);
        const detailRow = document.getElementById(`detail-${creditNoteId}`);
        const expandBtn = row?.querySelector('.expand-btn');
        
        if (!row || !detailRow || !expandBtn) {
            return;
        }
        
        const isCurrentlyExpanded = expandedRows.has(creditNoteId);
        
        if (isCurrentlyExpanded) {
            // Colapsar
            expandedRows.delete(creditNoteId);
            row.classList.remove('expanded');
            detailRow.classList.remove('show');
            expandBtn.classList.remove('expanded');
        } else {
            // Expandir
            expandedRows.add(creditNoteId);
            row.classList.add('expanded');
            detailRow.classList.add('show');
            expandBtn.classList.add('expanded');
            
            // Cargar detalles
            await loadCreditNoteDetailsAsync(creditNoteId);
        }
        
    } catch (error) {
        showErrorToast('Error al mostrar/ocultar detalles');
    }
}

async function loadCreditNoteDetailsAsync(creditNoteId) {
    try {
        const detailContent = document.getElementById(`detail-content-${creditNoteId}`);
        if (!detailContent) return;
        
        // Mostrar loading
        detailContent.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fas fa-spinner fa-spin" style="font-size: 18px; color: var(--primary-color);"></i> 
                <span style="margin-left: 10px;">Cargando detalles...</span>
            </div>
        `;
        
        const details = await loadCreditNoteDetails(creditNoteId);
        displayCreditNoteDetailsInTable(creditNoteId, details);
        
    } catch (error) {
        const detailContent = document.getElementById(`detail-content-${creditNoteId}`);
        if (detailContent) {
            detailContent.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--error-color);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 18px;"></i>
                    <span style="margin-left: 10px;">Error cargando detalles: ${error.message}</span>
                </div>
            `;
        }
    }
}

async function loadCreditNoteDetails(creditNoteId) {
    let connection = null;
    
    try {
        connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        // Obtener información completa de la nota de crédito
        const creditNoteQuery = `
            SELECT
                NCTProveedores.IdNotaCreditoProveedores, 
                NCTProveedores.NombreProveedore, 
                NCTProveedores.NIT, 
                NCTProveedores.Monto, 
                NCTProveedores.Serie, 
                NCTProveedores.Numero, 
                NCTProveedores.IdConcepto,
                TiposNotaCredito.TipoNotaCredito, 
                NCTProveedores.Observaciones, 
                NCTProveedores.FechaHoraRegistro, 
                NCTProveedores.NombreUsuario, 
                facturas_compras.Serie AS SeriaFacturaRecibida, 
                facturas_compras.Numero AS NumeroFacturaRecibida, 
                estado_facturas.Estado AS EstadoFactura, 
                facturas_compras.MontoFactura, 
                facturas_compras.FechaRecepcion, 
                facturas_compras.FechaFactura, 
                facturas_compras.IdInventory, 
                facturas_compras.IdSucursalCori, 
                razonessociales.NombreRazon
            FROM NCTProveedores
            INNER JOIN TiposNotaCredito
                ON NCTProveedores.TipoNotaCredito = TiposNotaCredito.IdTipoNotasCredito
            INNER JOIN facturas_compras
                ON NCTProveedores.IdFacturaCompras = facturas_compras.Id
            INNER JOIN estado_facturas
                ON facturas_compras.Estado = estado_facturas.IdEstado
            INNER JOIN razonessociales
                ON facturas_compras.IdRazon = razonessociales.Id
            WHERE NCTProveedores.IdNotaCreditoProveedores = ?
        `;
        
        const creditNoteResult = await connection.query(creditNoteQuery, [creditNoteId]);
        
        if (!creditNoteResult || creditNoteResult.length === 0) {
            throw new Error('No se encontraron datos para la nota de crédito');
        }
        
        const creditNote = creditNoteResult[0];
        
        // Obtener detalles de productos (si existen)
        const productsQuery = `
            SELECT
                NCTProveedoresDetalle.Upc, 
                NCTProveedoresDetalle.Descripcion, 
                NCTProveedoresDetalle.Cantidad
            FROM NCTProveedoresDetalle
            WHERE NCTProveedoresDetalle.IdNTCProveedor = ?
            ORDER BY NCTProveedoresDetalle.Descripcion
        `;
        
        const productsResult = await connection.query(productsQuery, [creditNoteId]);
        
        return {
            creditNote: creditNote,
            products: productsResult
        };
        
    } catch (error) {
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
            }
        }
    }
}

function displayCreditNoteDetailsInTable(creditNoteId, details) {
    const detailContent = document.getElementById(`detail-content-${creditNoteId}`);
    if (!detailContent) return;
    
    try {
        if (!details || !details.creditNote) {
            detailContent.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--error-color);">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span style="margin-left: 10px;">No se pudieron cargar los detalles</span>
                </div>
            `;
            return;
        }
        
        const { creditNote, products } = details;
        const hasProducts = creditNote.IdConcepto === 1 && products && products.length > 0;
        
        let detailsHTML = `
            <div style="padding: 20px; background: rgba(110, 120, 255, 0.02); border-left: 4px solid var(--primary-color);">
                
                <!-- Información de la factura original -->
                <div style="background: rgba(76, 175, 80, 0.05); border: 1px solid rgba(76, 175, 80, 0.2); border-radius: 8px; padding: 15px; margin-bottom: 15px;">
                    <h4 style="font-size: 14px; font-weight: 700; color: var(--success-color); margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-file-invoice-dollar"></i> Factura Original
                    </h4>
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px;">
                        <div>
                            <span style="font-size: 10px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; display: block;">Serie-Número</span>
                            <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">${creditNote.SeriaFacturaRecibida || 'N/A'}-${creditNote.NumeroFacturaRecibida || 'N/A'}</span>
                        </div>
                        <div>
                            <span style="font-size: 10px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; display: block;">Monto Factura</span>
                            <span style="font-size: 12px; font-weight: 600; color: var(--success-color);">${formatCurrency(creditNote.MontoFactura)}</span>
                        </div>
                        <div>
                            <span style="font-size: 10px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; display: block;">Fecha Factura</span>
                            <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">${formatDate(creditNote.FechaFactura)}</span>
                        </div>
                        <div>
                            <span style="font-size: 10px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; display: block;">Estado</span>
                            <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">${creditNote.EstadoFactura || 'No disponible'}</span>
                        </div>
                        <div>
                            <span style="font-size: 10px; font-weight: 600; color: var(--text-secondary); text-transform: uppercase; display: block;">Razón Social</span>
                            <span style="font-size: 12px; font-weight: 600; color: var(--text-primary);">${creditNote.NombreRazon || 'No disponible'}</span>
                        </div>
                    </div>
                </div>
        `;
        
        if (hasProducts) {
            // Mostrar productos en tabla compacta
            detailsHTML += `
                <div style="margin-bottom: 15px;">
                    <h4 style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-boxes"></i> Productos Devueltos (${products.length})
                    </h4>
                    <div style="max-height: 200px; overflow-y: auto; border: 1px solid var(--border-color); border-radius: 6px;">
                        <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
                            <thead style="background: var(--bg-color); position: sticky; top: 0;">
                                <tr>
                                    <th style="padding: 8px; text-align: left; font-weight: 600; border-bottom: 1px solid var(--border-color);">UPC</th>
                                    <th style="padding: 8px; text-align: left; font-weight: 600; border-bottom: 1px solid var(--border-color);">Descripción</th>
                                    <th style="padding: 8px; text-align: center; font-weight: 600; border-bottom: 1px solid var(--border-color);">Cantidad</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${products.map(product => `
                                    <tr style="border-bottom: 1px solid var(--border-light);">
                                        <td style="padding: 6px 8px;">
                                            <span style="font-family: 'Courier New', monospace; font-weight: 600; color: var(--primary-color); background: var(--bg-color); padding: 2px 6px; border-radius: 4px; font-size: 10px;">
                                                ${product.Upc || 'N/A'}
                                            </span>
                                        </td>
                                        <td style="padding: 6px 8px; color: var(--text-primary);">${product.Descripcion || 'Sin descripción'}</td>
                                        <td style="padding: 6px 8px; text-align: center; font-weight: 600; color: var(--success-color);">${product.Cantidad || 0}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                </div>
            `;
        } else if (creditNote.IdConcepto === 2 && creditNote.Observaciones) {
            // Mostrar observaciones para otros conceptos
            detailsHTML += `
                <div style="background: rgba(255, 182, 193, 0.1); border: 1px solid rgba(255, 182, 193, 0.3); border-radius: 8px; padding: 15px;">
                    <h4 style="font-size: 14px; font-weight: 700; color: var(--text-primary); margin-bottom: 10px; display: flex; align-items: center; gap: 8px;">
                        <i class="fas fa-comment-alt"></i> Observaciones
                    </h4>
                    <div style="font-size: 13px; color: var(--text-primary); line-height: 1.5; font-style: italic; background: white; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color);">
                        ${creditNote.Observaciones}
                    </div>
                </div>
            `;
        } else {
            // Mostrar mensaje cuando no hay información adicional
            detailsHTML += `
                <div style="text-align: center; padding: 15px; color: var(--text-secondary); background: rgba(0,0,0,0.02); border-radius: 6px;">
                    <i class="fas fa-info-circle" style="font-size: 16px;"></i>
                    <span style="margin-left: 8px; font-size: 12px;">No hay información adicional disponible para esta nota de crédito.</span>
                </div>
            `;
        }
        
        detailsHTML += `</div>`;
        
        detailContent.innerHTML = detailsHTML;
        
    } catch (error) {
        detailContent.innerHTML = `
            <div style="text-align: center; padding: 20px; color: var(--error-color);">
                <i class="fas fa-exclamation-triangle"></i>
                <span style="margin-left: 10px;">Error mostrando detalles</span>
            </div>
        `;
    }
}

function displayPagination() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;
    
    try {
        const totalPages = Math.ceil(totalRecords / itemsPerPage);
        
        if (totalPages <= 1) {
            paginationContainer.innerHTML = '';
            return;
        }
        
        let paginationHTML = `
            <button class="pagination-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''}>
                <i class="fas fa-chevron-left"></i>
            </button>
        `;
        
        // Mostrar páginas
        const startPage = Math.max(1, currentPage - 2);
        const endPage = Math.min(totalPages, currentPage + 2);
        
        if (startPage > 1) {
            paginationHTML += `<button class="pagination-btn" onclick="goToPage(1)">1</button>`;
            if (startPage > 2) {
                paginationHTML += `<span style="padding: 0 10px; color: var(--text-secondary);">...</span>`;
            }
        }
        
        for (let i = startPage; i <= endPage; i++) {
            paginationHTML += `
                <button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">
                    ${i}
                </button>
            `;
        }
        
        if (endPage < totalPages) {
            if (endPage < totalPages - 1) {
                paginationHTML += `<span style="padding: 0 10px; color: var(--text-secondary);">...</span>`;
            }
            paginationHTML += `<button class="pagination-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
        }
        
        paginationHTML += `
            <button class="pagination-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''}>
                <i class="fas fa-chevron-right"></i>
            </button>
        `;
        
        paginationHTML += `
            <div class="pagination-info">
                Página ${currentPage} de ${totalPages} (${totalRecords} registros)
            </div>
        `;
        
        paginationContainer.innerHTML = paginationHTML;
        
    } catch (error) {
    }
}

function goToPage(page) {
    try {
        const totalPages = Math.ceil(totalRecords / itemsPerPage);
        
        if (page < 1 || page > totalPages || page === currentPage) {
            return;
        }
        
        currentPage = page;
        
        // Limpiar filas expandidas al cambiar página
        expandedRows.clear();
        
        displayCreditNotesTable();
        displayPagination();
        
        // Scroll hacia arriba de la tabla
        if (creditNotesTable) {
            creditNotesTable.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }
        
    } catch (error) {
        showErrorToast('Error al cambiar de página');
    }
}

function showNoResults() {
    try {
        hideAllResultPanels();
        noResultsPanel.style.display = 'flex';
        
        setTimeout(() => {
            noResultsPanel.classList.add('animate-fade-in');
            
            noResultsPanel.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
        
        showWarningToast('No se encontraron notas de crédito con los criterios especificados');
        
    } catch (error) {
    }
}
function closeDetailModalFunc() {
    try {
        if (creditNoteDetailModal) {
            creditNoteDetailModal.classList.remove('show');
            
            setTimeout(() => {
                creditNoteDetailModal.style.display = 'none';
            }, 300);
        }
    } catch (error) {
    }
}

function handleExport() {
    if (!filteredCreditNotes || filteredCreditNotes.length === 0) {
        showErrorToast('No hay datos para exportar');
        return;
    }
    
    Swal.fire({
        title: 'Exportar Datos',
        text: `¿Desea exportar ${filteredCreditNotes.length} registro(s)?`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4caf50',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Sí, exportar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed) {
            exportToExcel();
        }
    });
}

async function exportToExcel() {
    try {
        
        // Mostrar loading
        showLoadingOverlay('Generando archivo Excel...');
        
        // Crear libro de trabajo
        const workbook = XLSX.utils.book_new();
        
        // Hoja 1: Resumen (mantener como está)
        const summaryData = createSummarySheet();
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
        
        // Hoja 2: Detalle Completo (nueva estructura)
        const completeDetailData = await createCompleteDetailSheet();
        if (completeDetailData && completeDetailData.length > 0) {
            const detailSheet = XLSX.utils.aoa_to_sheet(completeDetailData);
            XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle Completo');
        }
        
        // Generar el archivo
        const excelBuffer = XLSX.write(workbook, { 
            bookType: 'xlsx', 
            type: 'array' 
        });
        
        // Crear blob y descargar
        const blob = new Blob([excelBuffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        const fileName = `reporte_notas_credito_completo_${getCurrentDateForFilename()}.xlsx`;
        
        // Usar File System Access API si está disponible
        if ('showSaveFilePicker' in window) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: 'Archivos Excel',
                        accept: {
                            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
                        }
                    }]
                });
                
                const writable = await fileHandle.createWritable();
                await writable.write(blob);
                await writable.close();
                
                showSuccessToast('Archivo Excel guardado exitosamente');
                
            } catch (error) {
                if (error.name !== 'AbortError') {
                    downloadFileWithFallback(blob, fileName);
                }
            }
        } else {
            downloadFileWithFallback(blob, fileName);
        }
        
    } catch (error) {
        showErrorToast('Error al exportar los datos');
    } finally {
        hideLoadingOverlay();
    }
}
async function createCompleteDetailSheet() {
    try {
        
        const allRecords = [];
        
        // Headers de la hoja
        const headers = [
            // Información de la Nota de Crédito
            'ID Nota Crédito',
            'Serie Nota Crédito',
            'Número Nota Crédito',
            'Monto Nota Crédito',
            'Tipo Nota Crédito',
            'Concepto Nota Crédito',
            'Fecha Nota Crédito',
            'Usuario Nota Crédito',
            'Observaciones Nota Crédito',
            
            // Información del Proveedor
            'Proveedor',
            'NIT Proveedor',
            
            // Información de la Factura Original
            'Serie Factura Original',
            'Número Factura Original',
            'Monto Factura Original',
            'Fecha Factura Original',
            'Fecha Recepción Factura',
            'Estado Factura',
            'Razón Social',
            'ID Inventario',
            'ID Sucursal',
            
            // Información del Producto (si aplica)
            'UPC Producto',
            'Descripción Producto',
            'Cantidad Producto'
        ];
        
        // Procesar cada nota de crédito
        for (const note of filteredCreditNotes) {
            try {
                // Obtener detalles completos de la nota
                const details = await loadCreditNoteDetails(note.IdNotaCreditoProveedores);
                
                // Datos base de la nota y factura
                const baseRecord = [
                    // Información de la Nota de Crédito
                    note.IdNotaCreditoProveedores || '',
                    note.Serie || '',
                    note.Numero || '',
                    parseFloat(note.Monto || 0),
                    note.TipoNotaCredito || '',
                    note.IdConcepto === 1 ? 'Mercadería' : 'Otros Conceptos',
                    formatDateForExcel(note.FechaHoraRegistro),
                    note.NombreUsuario || '',
                    note.Observaciones || '',
                    
                    // Información del Proveedor
                    note.NombreProveedore || '',
                    note.NIT || '',
                    
                    // Información de la Factura Original
                    note.SeriaFacturaRecibida || '',
                    note.NumeroFacturaRecibida || '',
                    parseFloat(note.MontoFactura || 0),
                    formatDateForExcel(note.FechaFactura),
                    formatDateForExcel(note.FechaRecepcion),
                    note.EstadoFactura || '',
                    note.NombreRazon || '',
                    note.IdInventory || '',
                    note.IdSucursalCori || ''
                ];
                
                // Si es nota de mercadería y tiene productos
                if (note.IdConcepto === 1 && details && details.products && details.products.length > 0) {
                    // Agregar una fila por cada producto
                    details.products.forEach(product => {
                        allRecords.push([
                            ...baseRecord,
                            product.Upc || '',
                            product.Descripcion || '',
                            parseInt(product.Cantidad || 0)
                        ]);
                    });
                } else {
                    // Nota sin productos o de otros conceptos
                    allRecords.push([
                        ...baseRecord,
                        '', // UPC vacío
                        '', // Descripción vacía
                        ''  // Cantidad vacía
                    ]);
                }
                
            } catch (error) {
                
                // Agregar registro con datos básicos aunque falle la carga de detalles
                const errorRecord = [
                    // Información de la Nota de Crédito
                    note.IdNotaCreditoProveedores || '',
                    note.Serie || '',
                    note.Numero || '',
                    parseFloat(note.Monto || 0),
                    note.TipoNotaCredito || '',
                    note.IdConcepto === 1 ? 'Mercadería' : 'Otros Conceptos',
                    formatDateForExcel(note.FechaHoraRegistro),
                    note.NombreUsuario || '',
                    note.Observaciones || '',
                    
                    // Información del Proveedor
                    note.NombreProveedore || '',
                    note.NIT || '',
                    
                    // Información de la Factura Original
                    note.SeriaFacturaRecibida || '',
                    note.NumeroFacturaRecibida || '',
                    parseFloat(note.MontoFactura || 0),
                    formatDateForExcel(note.FechaFactura),
                    formatDateForExcel(note.FechaRecepcion),
                    note.EstadoFactura || '',
                    note.NombreRazon || '',
                    note.IdInventory || '',
                    note.IdSucursalCori || '',
                    
                    // Productos vacíos
                    'ERROR CARGANDO',
                    'Error al cargar productos',
                    ''
                ];
                
                allRecords.push(errorRecord);
            }
        }
        
        // Construir la estructura final con título y headers
        const finalData = [
            ['DETALLE COMPLETO - NOTAS DE CRÉDITO CON INFORMACIÓN DE FACTURAS Y PRODUCTOS'],
            [''],
            ['Generado el:', formatDate(new Date())],
            ['Total de registros:', allRecords.length],
            [''],
            headers,
            ...allRecords
        ];
        return finalData;
        
    } catch (error) {
        return [
            ['ERROR AL GENERAR DETALLE COMPLETO'],
            [''],
            ['Error:', error.message || 'Error desconocido'],
            ['Fecha:', formatDate(new Date())]
        ];
    }
}
function downloadFileWithFallback(blob, fileName) {
    try {
        const url = URL.createObjectURL(blob);
        const downloadLink = document.createElement('a');
        downloadLink.href = url;
        downloadLink.download = fileName;
        downloadLink.style.display = 'none';
        
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
        URL.revokeObjectURL(url);
        
        showSuccessToast('Archivo Excel descargado exitosamente');
        
    } catch (error) {
        showErrorToast('Error al descargar el archivo');
    }
}

function createSummarySheet() {
    try {
        const totalAmount = filteredCreditNotes.reduce((sum, note) => sum + parseFloat(note.Monto || 0), 0);
        const merchandiseNotes = filteredCreditNotes.filter(note => note.IdConcepto === 1).length;
        const conceptNotes = filteredCreditNotes.filter(note => note.IdConcepto === 2).length;
        
        const now = new Date();
        const searchParams = getInlineSearchParameters();
        let filterInfo = '';
        
        switch (searchParams.type) {
            case 'all':
                if (searchParams.fechaInicio && searchParams.fechaFin) {
                    filterInfo = `Rango: ${formatDate(searchParams.fechaInicio)} - ${formatDate(searchParams.fechaFin)}`;
                } else if (searchParams.fechaInicio) {
                    filterInfo = `Desde: ${formatDate(searchParams.fechaInicio)}`;
                } else if (searchParams.fechaFin) {
                    filterInfo = `Hasta: ${formatDate(searchParams.fechaFin)}`;
                } else {
                    filterInfo = 'Todas las notas de crédito';
                }
                break;
            case 'invoice':
                filterInfo = `Factura: ${searchParams.invoiceSerie || ''}-${searchParams.invoiceNumber || ''}`;
                break;
            case 'credit-note':
                filterInfo = `Nota de Crédito: ${searchParams.creditNoteSerie || ''}-${searchParams.creditNoteNumber || ''}`;
                break;
            case 'product':
                filterInfo = `Producto: ${searchParams.productSearch || ''}`;
                break;
        }
        
        return [
            ['REPORTE NOTAS DE CRÉDITO PROVEEDORES - RESUMEN EJECUTIVO'],
            [''],
            ['Fecha de Generación:', formatDate(now)],
            ['Hora de Generación:', now.toLocaleTimeString()],
            ['Usuario:', localStorage.getItem('userName') || 'N/A'],
            ['Filtro aplicado:', filterInfo],
            [''],
            ['RESUMEN ESTADÍSTICO'],
            [''],
            ['Total de Notas:', filteredCreditNotes.length],
            ['Monto Total:', parseFloat(totalAmount.toFixed(2))],
            ['Notas de Mercadería:', merchandiseNotes],
            ['Notas de Otros Conceptos:', conceptNotes],
            [''],
            ['DISTRIBUCIÓN POR TIPO'],
            [''],
            ['Tipo', 'Cantidad', 'Porcentaje', 'Monto Promedio'],
            [
                'Mercadería', 
                merchandiseNotes, 
                `${((merchandiseNotes / filteredCreditNotes.length) * 100).toFixed(1)}%`,
                merchandiseNotes > 0 ? parseFloat((filteredCreditNotes.filter(n => n.IdConcepto === 1).reduce((sum, n) => sum + parseFloat(n.Monto || 0), 0) / merchandiseNotes).toFixed(2)) : 0
            ],
            [
                'Otros Conceptos', 
                conceptNotes, 
                `${((conceptNotes / filteredCreditNotes.length) * 100).toFixed(1)}%`,
                conceptNotes > 0 ? parseFloat((filteredCreditNotes.filter(n => n.IdConcepto === 2).reduce((sum, n) => sum + parseFloat(n.Monto || 0), 0) / conceptNotes).toFixed(2)) : 0
            ],
            [''],
            ['ANÁLISIS ADICIONAL'],
            [''],
            ['Monto Máximo:', Math.max(...filteredCreditNotes.map(n => parseFloat(n.Monto || 0)))],
            ['Monto Mínimo:', Math.min(...filteredCreditNotes.map(n => parseFloat(n.Monto || 0)))],
            ['Monto Promedio:', parseFloat((totalAmount / filteredCreditNotes.length).toFixed(2))]
        ];
    } catch (error) {
        return [['Error generando resumen:', error.message]];
    }
}

function handlePrint() {
    if (!filteredCreditNotes || filteredCreditNotes.length === 0) {
        showErrorToast('No hay datos para imprimir');
        return;
    }
    
    try {
        const printWindow = window.open('', '_blank');
        const printContent = generatePrintContent();
        
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reporte Notas de Crédito Proveedores</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { color: #333; margin-bottom: 5px; }
                    .header p { color: #666; margin: 0; }
                    .summary { background: #f5f5f5; padding: 15px; margin-bottom: 20px; border-radius: 5px; }
                    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
                    .summary-item { text-align: center; }
                    .summary-label { font-size: 12px; color: #666; text-transform: uppercase; }
                    .summary-value { font-size: 18px; font-weight: bold; color: #333; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
                    th, td { border: 1px solid #ddd; padding: 6px; text-align: left; }
                    th { background-color: #f5f5f5; font-weight: bold; }
                    .amount { text-align: right; font-weight: bold; color: #28a745; }
                    .date { text-align: center; }
                    .footer { margin-top: 30px; text-align: center; font-size: 12px; color: #666; }
                    @media print {
                        body { margin: 0; }
                        .no-print { display: none; }
                    }
                </style>
            </head>
            <body>
                ${printContent}
            </body>
            </html>
        `);
        
        printWindow.document.close();
        
        setTimeout(() => {
            printWindow.print();
            printWindow.close();
        }, 250);
        
    } catch (error) {
        showErrorToast('Error al imprimir');
    }
}

function generatePrintContent() {
    try {
        const now = new Date();
        const totalAmount = filteredCreditNotes.reduce((sum, note) => sum + parseFloat(note.Monto || 0), 0);
        const merchandiseNotes = filteredCreditNotes.filter(note => note.IdConcepto === 1).length;
        const conceptNotes = filteredCreditNotes.filter(note => note.IdConcepto === 2).length;
        
        return `
            <div class="header">
                <h1>Reporte Notas de Crédito Proveedores</h1>
                <p>Generado el ${formatDate(now)} - ${now.toLocaleTimeString()}</p>
            </div>
            
            <div class="summary">
                <div class="summary-grid">
                    <div class="summary-item">
                        <div class="summary-label">Total Notas</div>
                        <div class="summary-value">${filteredCreditNotes.length}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Monto Total</div>
                        <div class="summary-value">${formatCurrency(totalAmount)}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Mercadería</div>
                        <div class="summary-value">${merchandiseNotes}</div>
                    </div>
                    <div class="summary-item">
                        <div class="summary-label">Otros Conceptos</div>
                        <div class="summary-value">${conceptNotes}</div>
                    </div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Nota de Crédito</th>
                        <th>Proveedor</th>
                        <th>Tipo</th>
                        <th>Monto</th>
                        <th>Fecha</th>
                        <th>Factura Original</th>
                        <th>Concepto</th>
                        <th>Usuario</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredCreditNotes.map(note => `
                        <tr>
                            <td>${note.Serie || ''}-${note.Numero || ''}</td>
                            <td>${note.NombreProveedore || ''}</td>
                            <td>${note.TipoNotaCredito || ''}</td>
                            <td class="amount">${formatCurrency(note.Monto)}</td>
                            <td class="date">${formatDate(note.FechaHoraRegistro)}</td>
                            <td>${note.SeriaFacturaRecibida || ''}-${note.NumeroFacturaRecibida || ''}</td>
                            <td>${note.IdConcepto === 1 ? 'Mercadería' : 'Otros Conceptos'}</td>
                            <td>${note.NombreUsuario || ''}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
            
            <div class="footer">
                <p>Sistema de Inventarios - Reporte generado automáticamente</p>
            </div>
        `;
    } catch (error) {
        return '<p>Error generando contenido de impresión</p>';
    }
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

function formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        
        return new Intl.DateTimeFormat('es-GT', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            timeZone: 'America/Guatemala'
        }).format(date);
    } catch (error) {
        return dateString;
    }
}

function formatDateForExcel(dateString) {
    if (!dateString) return '';
    
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date;
    } catch (error) {
        return dateString;
    }
}

function getCurrentDateForFilename() {
    const now = new Date();
    return now.toISOString().split('T')[0].replace(/-/g, '');
}
// Hacer funciones globales para uso en HTML
window.toggleCreditNoteDetails = toggleCreditNoteDetails;
window.loadCreditNoteDetails = loadCreditNoteDetails;
window.displayCreditNoteDetailsInTable = displayCreditNoteDetailsInTable;
window.goToPage = goToPage;
window.handleExport = handleExport;
window.handlePrint = handlePrint;
window.closeDetailModalFunc = closeDetailModalFunc;
// Hacer funciones globales para uso en HTML
window.handleSearchTypeChangeInline = handleSearchTypeChangeInline;
window.handleSearchInline = handleSearchInline;
window.clearAllFiltersInline = clearAllFiltersInline;
window.toggleSearchPanel = toggleSearchPanel;
window.scrollToFilters = scrollToFilters;
window.getFiltersState = getFiltersState;
window.applyFiltersState = applyFiltersState;
