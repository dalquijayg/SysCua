const odbc = require('odbc');
const Swal = require('sweetalert2');
const XLSX = require('xlsx');

// Variables globales
let currentSearchType = 'all';
let currentPage = 1;
let itemsPerPage = 10;
let totalRecords = 0;
let allCreditNotes = [];
let filteredCreditNotes = [];

// Variables adicionales para el panel compacto
let isSearchPanelCollapsed = false;
let searchPanel = null;

// Elementos del DOM
let searchForm, searchFields, creditNotesContainer, resultsPanel, noResultsPanel;
let searchTypeButtons, exportBtn, printBtn, adjustFiltersBtn;
let creditNoteDetailModal, closeDetailModal;
let clearFiltersInlineBtn = null;

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
    searchForm = document.getElementById('searchForm');
    searchFields = document.getElementById('searchFields');
    creditNotesContainer = document.getElementById('creditNotesContainer');
    resultsPanel = document.getElementById('resultsPanel');
    noResultsPanel = document.getElementById('noResultsPanel');
    searchPanel = document.querySelector('.search-panel');
    
    searchTypeButtons = document.querySelectorAll('.search-type-btn');
    exportBtn = document.getElementById('exportBtn');
    printBtn = document.getElementById('printBtn');
    adjustFiltersBtn = document.getElementById('adjustFiltersBtn');
    clearFiltersInlineBtn = document.getElementById('clearFiltersInline');
    
    creditNoteDetailModal = document.getElementById('creditNoteDetailModal');
    closeDetailModal = document.getElementById('closeDetailModal');
    
    // Verificar elementos críticos
    if (!searchForm || !creditNotesContainer) {
        console.error('Error: No se encontraron elementos críticos del DOM');
        return;
    }
}

// Inicializar la aplicación
function initializeApp() {
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
}

// Configurar event listeners
function setupEventListeners() {
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
    
    // Configurar fechas por defecto y validación
    setupInlineDateFields();
    
    // Agregar botón de toggle al panel
    setTimeout(() => {
        addToggleButtonToPanel();
    }, 100);
}

// Animar elementos de la página
function animatePageElements() {
    const elements = [
        document.querySelector('.search-panel')
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

// Función para agregar el botón de toggle al panel
function addToggleButtonToPanel() {
    if (!searchPanel) return;
    
    const panelHeader = searchPanel.querySelector('.panel-header');
    if (!panelHeader) return;
    
    // Verificar si ya existe el botón
    if (panelHeader.querySelector('.panel-toggle')) return;
    
    const toggleButton = document.createElement('button');
    toggleButton.className = 'panel-toggle';
    toggleButton.type = 'button';
    toggleButton.innerHTML = '<i class="fas fa-chevron-up"></i>';
    toggleButton.title = 'Colapsar panel de búsqueda';
    
    toggleButton.addEventListener('click', toggleSearchPanel);
    
    panelHeader.style.position = 'relative';
    panelHeader.appendChild(toggleButton);
}

// Función para toggle del panel de búsqueda
function toggleSearchPanel() {
    if (!searchPanel) return;
    
    const toggleButton = searchPanel.querySelector('.panel-toggle');
    const toggleIcon = toggleButton.querySelector('i');
    
    isSearchPanelCollapsed = !isSearchPanelCollapsed;
    
    if (isSearchPanelCollapsed) {
        searchPanel.classList.add('collapsed');
        toggleIcon.className = 'fas fa-chevron-down';
        toggleButton.title = 'Expandir panel de búsqueda';
    } else {
        searchPanel.classList.remove('collapsed');
        toggleIcon.className = 'fas fa-chevron-up';
        toggleButton.title = 'Colapsar panel de búsqueda';
    }
}

// Función para colapsar automáticamente cuando hay resultados
function autoCollapsePanel() {
    if (!searchPanel || isSearchPanelCollapsed) return;
    
    // Auto-colapsar solo si hay resultados
    if (filteredCreditNotes && filteredCreditNotes.length > 0) {
        setTimeout(() => {
            toggleSearchPanel();
        }, 800); // Delay para que el usuario vea los resultados primero
    }
}

// Configurar campos de fecha inline
function setupInlineDateFields() {
    const fechaInicio = document.getElementById('fechaInicioInline');
    const fechaFin = document.getElementById('fechaFinInline');
    
    if (fechaInicio && fechaFin) {
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
    }
}

// Manejar cambio de tipo de búsqueda INLINE
function handleSearchTypeChangeInline(e) {
    e.preventDefault();
    
    // Remover clase active de todos los botones
    searchTypeButtons.forEach(btn => btn.classList.remove('active'));
    
    // Agregar clase active al botón seleccionado
    e.currentTarget.classList.add('active');
    
    // Actualizar tipo de búsqueda actual
    currentSearchType = e.currentTarget.dataset.type;
    
    // Actualizar campos visibles
    updateInlineFields();
    
    // Actualizar indicador de filtros
    setTimeout(updateFiltersIndicator, 100);
}

// Actualizar campos visibles según el tipo inline
function updateInlineFields() {
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
    }
}

// Validar rango de fechas inline
function validateInlineDateRange() {
    const fechaInicio = document.getElementById('fechaInicioInline');
    const fechaFin = document.getElementById('fechaFinInline');
    
    if (fechaInicio && fechaFin && fechaInicio.value && fechaFin.value) {
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
    } else {
        setTimeout(updateFiltersIndicator, 100);
    }
    return true;
}

// Función para mostrar indicador de filtros activos
function updateFiltersIndicator() {
    if (!searchPanel) return;
    
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
}

// Obtener parámetros de búsqueda inline
function getInlineSearchParameters() {
    const params = {
        type: currentSearchType
    };
    
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
    }
    
    return params;
}

// Validar parámetros inline
function validateInlineSearchParameters(params) {
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
            }
            break;
            
        case 'invoice':
            if (!params.invoiceSerie && !params.invoiceNumber) {
                showErrorToast('Debe ingresar al menos la serie o el número de la factura');
                return false;
            }
            break;
            
        case 'credit-note':
            if (!params.creditNoteSerie && !params.creditNoteNumber) {
                showErrorToast('Debe ingresar al menos la serie o el número de la nota de crédito');
                return false;
            }
            break;
            
        case 'product':
            if (!params.productSearch || params.productSearch.length < 3) {
                showErrorToast('Debe ingresar al menos 3 caracteres para buscar por producto');
                return false;
            }
            break;
    }
    return true;
}

// Ocultar todos los paneles de resultados
function hideAllResultPanels() {
    if (resultsPanel) resultsPanel.style.display = 'none';
    if (noResultsPanel) noResultsPanel.style.display = 'none';
}
// Manejar búsqueda inline
async function handleSearchInline(e) {
    e.preventDefault();
    
    // Mostrar loading
    showLoadingStateInline(true);
    
    try {
        // Construir query según el tipo de búsqueda
        const searchParams = getInlineSearchParameters();
        
        // Validar parámetros de búsqueda
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
            
            displayResults();
        } else {
            showNoResults();
        }
        
    } catch (error) {
        console.error('Error en la búsqueda:', error);
        handleSearchError(error);
    } finally {
        showLoadingStateInline(false);
    }
}

// Ejecutar búsqueda en la base de datos
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
        
        // Agregar joins y condiciones según el tipo de búsqueda
        const { whereClause, queryParams } = buildWhereClause(params);
        
        if (whereClause) {
            query += ` WHERE ${whereClause}`;
        }
        
        query += ` ORDER BY NCTProveedores.FechaHoraRegistro DESC`;
        
        const result = await connection.query(query, queryParams);
        return result;
        
    } catch (error) {
        console.error('Error ejecutando búsqueda:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error cerrando conexión:', closeError);
            }
        }
    }
}

// Construir cláusula WHERE y parámetros
function buildWhereClause(params) {
    const conditions = [];
    const queryParams = [];
    
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
                conditions.push('facturas_compras.Serie = ?');
                queryParams.push(params.invoiceSerie);
            }
            if (params.invoiceNumber) {
                conditions.push('facturas_compras.Numero = ?');
                queryParams.push(params.invoiceNumber);
            }
            break;
            
        case 'credit-note':
            if (params.creditNoteSerie) {
                conditions.push('NCTProveedores.Serie = ?');
                queryParams.push(params.creditNoteSerie);
            }
            if (params.creditNoteNumber) {
                conditions.push('NCTProveedores.Numero = ?');
                queryParams.push(params.creditNoteNumber);
            }
            break;
            
        case 'product':
            if (params.productSearch) {
                conditions.push(`EXISTS (
                    SELECT 1 FROM NCTProveedoresDetalle 
                    WHERE NCTProveedoresDetalle.IdNTCProveedor = NCTProveedores.IdNotaCreditoProveedores
                    AND (NCTProveedoresDetalle.Upc LIKE ? OR NCTProveedoresDetalle.Descripcion LIKE ?)
                )`);
                const searchTerm = `%${params.productSearch}%`;
                queryParams.push(searchTerm, searchTerm);
            }
            break;
    }
    
    const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '';
    
    return { whereClause, queryParams };
}

// Mostrar resultados
function displayResults() {
    // Mostrar panel de resultados
    hideAllResultPanels();
    resultsPanel.style.display = 'block';
    
    // Actualizar contador de resultados
    updateResultsCount();
    
    // Mostrar resumen
    displayResultsSummary();
    
    // Mostrar notas de crédito
    displayCreditNotes();
    
    // Mostrar paginación
    displayPagination();
    
    // Actualizar indicador de filtros
    updateFiltersIndicator();
    
    // Animar panel
    setTimeout(() => {
        resultsPanel.style.opacity = '0';
        resultsPanel.style.transform = 'translateY(30px)';
        resultsPanel.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        
        setTimeout(() => {
            resultsPanel.style.opacity = '1';
            resultsPanel.style.transform = 'translateY(0)';
            
            // Scroll hacia resultados
            resultsPanel.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
            
            // Auto-colapsar panel después del scroll
            autoCollapsePanel();
        }, 100);
    }, 50);
    
    showSuccessToast(`Se encontraron ${totalRecords} nota(s) de crédito`);
}

// Actualizar contador de resultados
function updateResultsCount() {
    const resultsCount = document.getElementById('resultsCount');
    if (resultsCount) {
        const text = totalRecords === 1 ? '1 registro encontrado' : `${totalRecords} registros encontrados`;
        resultsCount.textContent = text;
    }
}

// Mostrar resumen de resultados
function displayResultsSummary() {
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
}

// Mostrar notas de crédito
function displayCreditNotes() {
    if (!creditNotesContainer) return;
    
    // Calcular registros para la página actual
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageRecords = filteredCreditNotes.slice(startIndex, endIndex);
    
    if (pageRecords.length === 0) {
        creditNotesContainer.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-secondary);">
                <i class="fas fa-inbox" style="font-size: 48px; margin-bottom: 15px; opacity: 0.5;"></i>
                <p>No hay registros para mostrar en esta página.</p>
            </div>
        `;
        return;
    }
    
    // Generar HTML para cada nota de crédito
    const creditNotesHTML = pageRecords.map((note, index) => {
        const isMerchandise = note.IdConcepto === 1;
        const iconClass = isMerchandise ? 'merchandise' : 'concept';
        const iconType = isMerchandise ? 'fas fa-boxes' : 'fas fa-receipt';
        const statusText = isMerchandise ? 'Mercadería' : 'Otros Conceptos';
        
        return `
            <div class="credit-note-item" data-id="${note.IdNotaCreditoProveedores}">
                <div class="credit-note-header" onclick="window.toggleCreditNoteDetails(${note.IdNotaCreditoProveedores})">
                    <div class="credit-note-icon ${iconClass}">
                        <i class="${iconType}"></i>
                    </div>
                    <div class="credit-note-main">
                        <div class="credit-note-info">
                            <div class="credit-note-number">${note.Serie || ''}-${note.Numero || ''}</div>
                            <div class="credit-note-provider">${note.NombreProveedore || 'Sin proveedor'}</div>
                            <div class="credit-note-type">${note.TipoNotaCredito || 'Sin tipo'}</div>
                        </div>
                        <div class="credit-note-amount">
                            <span class="amount-value">${formatCurrency(note.Monto)}</span>
                            <span class="amount-label">Monto</span>
                        </div>
                        <div class="credit-note-date">
                            <span class="date-value">${formatDate(note.FechaHoraRegistro)}</span>
                            <span class="date-label">Fecha</span>
                        </div>
                        <div class="credit-note-status">
                            <span class="status-badge ${iconClass}">${statusText}</span>
                        </div>
                        <button class="expand-toggle" type="button">
                            <i class="fas fa-chevron-down"></i>
                        </button>
                    </div>
                </div>
                <div class="credit-note-details" id="details-${note.IdNotaCreditoProveedores}">
                    <!-- Los detalles se cargarán dinámicamente -->
                </div>
            </div>
        `;
    }).join('');
    
    creditNotesContainer.innerHTML = creditNotesHTML;
    
    // Animar elementos
    const creditNoteItems = creditNotesContainer.querySelectorAll('.credit-note-item');
    creditNoteItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateY(20px)';
        item.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
        
        setTimeout(() => {
            item.style.opacity = '1';
            item.style.transform = 'translateY(0)';
        }, index * 100);
    });
}

// Toggle detalles de nota de crédito
async function toggleCreditNoteDetails(creditNoteId) {
    console.log('Expandiendo nota:', creditNoteId); // Para debug
    
    const creditNoteItem = document.querySelector(`[data-id="${creditNoteId}"]`);
    const detailsContainer = document.getElementById(`details-${creditNoteId}`);
    const expandButton = creditNoteItem?.querySelector('.expand-toggle');
    
    console.log('Elementos encontrados:', {creditNoteItem, detailsContainer, expandButton}); // Para debug
    
    // Verificar que todos los elementos existen
    if (!creditNoteItem || !detailsContainer || !expandButton) {
        console.error('No se encontraron todos los elementos necesarios');
        return;
    }
    
    const isExpanded = creditNoteItem.classList.contains('expanded');
    
    if (isExpanded) {
        creditNoteItem.classList.remove('expanded');
        expandButton.classList.remove('expanded');
        detailsContainer.style.display = 'none';
    } else {
        creditNoteItem.classList.add('expanded');
        expandButton.classList.add('expanded');
        detailsContainer.style.display = 'block';
        
        // Cargar detalles si no están cargados
        if (detailsContainer.innerHTML.trim() === '') {
            detailsContainer.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <i class="fas fa-spinner fa-spin" style="font-size: 18px; color: var(--primary-color);"></i> 
                    <span style="margin-left: 10px;">Cargando detalles...</span>
                </div>
            `;
            
            try {
                const details = await loadCreditNoteDetails(creditNoteId);
                displayCreditNoteDetails(creditNoteId, details);
            } catch (error) {
                console.error('Error cargando detalles:', error);
                detailsContainer.innerHTML = `
                    <div style="text-align: center; padding: 20px; color: var(--error-color);">
                        <i class="fas fa-exclamation-triangle" style="font-size: 18px;"></i>
                        <span style="margin-left: 10px;">Error cargando detalles: ${error.message}</span>
                    </div>
                `;
            }
        }
    }
}

// Cargar detalles de nota de crédito
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
        console.error('Error detallado en loadCreditNoteDetails:', error);
        throw error;
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error cerrando conexión:', closeError);
            }
        }
    }
}

// Mostrar detalles de nota de crédito
function displayCreditNoteDetails(creditNoteId, details) {
    const detailsContainer = document.getElementById(`details-${creditNoteId}`);
    if (!detailsContainer) {
        return;
    }
    
    if (!details || !details.creditNote) {
        detailsContainer.innerHTML = `
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
        <div class="details-content">
            <!-- Información de la factura original -->
            <div class="original-invoice-section">
                <h4><i class="fas fa-file-invoice-dollar"></i> Factura Original</h4>
                <div class="invoice-details-grid">
                    <div class="invoice-detail-item">
                        <span class="detail-label">Serie-Número</span>
                        <span class="detail-value">${creditNote.SeriaFacturaRecibida || 'N/A'}-${creditNote.NumeroFacturaRecibida || 'N/A'}</span>
                    </div>
                    <div class="invoice-detail-item">
                        <span class="detail-label">Monto Factura</span>
                        <span class="detail-value amount">${formatCurrency(creditNote.MontoFactura)}</span>
                    </div>
                    <div class="invoice-detail-item">
                        <span class="detail-label">Fecha Factura</span>
                        <span class="detail-value">${formatDate(creditNote.FechaFactura)}</span>
                    </div>
                    <div class="invoice-detail-item">
                        <span class="detail-label">Fecha Recepción</span>
                        <span class="detail-value">${formatDate(creditNote.FechaRecepcion)}</span>
                    </div>
                    <div class="invoice-detail-item">
                        <span class="detail-label">Estado</span>
                        <span class="detail-value">${creditNote.EstadoFactura || 'No disponible'}</span>
                    </div>
                    <div class="invoice-detail-item">
                        <span class="detail-label">Razón Social</span>
                        <span class="detail-value">${creditNote.NombreRazon || 'No disponible'}</span>
                    </div>
                </div>
            </div>
    `;
    
    if (hasProducts) {
        // Mostrar productos
        detailsHTML += `
            <div class="products-section">
                <h4><i class="fas fa-boxes"></i> Productos Devueltos</h4>
                <table class="products-table">
                    <thead>
                        <tr>
                            <th>UPC</th>
                            <th>Descripción</th>
                            <th>Cantidad</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${products.map(product => `
                            <tr>
                                <td><span class="product-upc">${product.Upc || 'N/A'}</span></td>
                                <td>${product.Descripcion || 'Sin descripción'}</td>
                                <td><span class="product-quantity">${product.Cantidad || 0}</span></td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } else if (creditNote.IdConcepto === 2 && creditNote.Observaciones) {
        // Mostrar observaciones para otros conceptos
        detailsHTML += `
            <div class="observations-section">
                <h4><i class="fas fa-comment-alt"></i> Observaciones</h4>
                <div class="observation-text">${creditNote.Observaciones}</div>
            </div>
        `;
    } else {
        // Mostrar mensaje cuando no hay información adicional
        detailsHTML += `
            <div style="text-align: center; padding: 20px; color: var(--text-secondary);">
                <i class="fas fa-info-circle" style="font-size: 18px;"></i>
                <span style="margin-left: 10px;">No hay información adicional disponible para esta nota de crédito.</span>
            </div>
        `;
    }
    
    detailsHTML += `
        </div>
    `;
    
    detailsContainer.innerHTML = detailsHTML;
}

// Mostrar paginación
function displayPagination() {
    const paginationContainer = document.getElementById('paginationContainer');
    if (!paginationContainer) return;
    
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
            Página ${currentPage} de ${totalPages}
        </div>
    `;
    
    paginationContainer.innerHTML = paginationHTML;
}

// Ir a página
function goToPage(page) {
    const totalPages = Math.ceil(totalRecords / itemsPerPage);
    
    if (page < 1 || page > totalPages || page === currentPage) return;
    
    currentPage = page;
    displayCreditNotes();
    displayPagination();
    
    // Scroll hacia arriba de los resultados
    creditNotesContainer.scrollIntoView({ 
        behavior: 'smooth', 
        block: 'start' 
    });
}

// Mostrar sin resultados
function showNoResults() {
    hideAllResultPanels();
    noResultsPanel.style.display = 'block';
    
    setTimeout(() => {
        noResultsPanel.style.opacity = '0';
        noResultsPanel.style.transform = 'translateY(30px)';
        noResultsPanel.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        
        setTimeout(() => {
            noResultsPanel.style.opacity = '1';
            noResultsPanel.style.transform = 'translateY(0)';
            
            noResultsPanel.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    }, 50);
    
    showWarningToast('No se encontraron notas de crédito con los criterios especificados');
}
// Limpiar filtros inline
function clearAllFiltersInline() {
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
            input.style.borderColor = 'var(--border-color)';
        }
    });
    
    // Resetear a "Mostrar Todas"
    searchTypeButtons.forEach(btn => btn.classList.remove('active'));
    document.getElementById('searchAll').classList.add('active');
    currentSearchType = 'all';
    updateInlineFields();
    
    // Configurar fechas por defecto
    setupInlineDateFields();
    
    // Ocultar resultados
    hideAllResultPanels();
    
    // Expandir panel si está colapsado
    if (isSearchPanelCollapsed) {
        toggleSearchPanel();
    }
    
    // Actualizar indicador de filtros
    updateFiltersIndicator();
    
    showSuccessToast('Filtros limpiados correctamente');
}

// Mostrar estado de carga inline
function showLoadingStateInline(isLoading) {
    const searchButton = document.querySelector('.search-button-inline');
    const buttonText = searchButton?.querySelector('.button-text');
    const buttonIcon = searchButton?.querySelector('.button-icon');
    
    if (isLoading) {
        if (buttonText) buttonText.textContent = 'Buscando...';
        if (buttonIcon) buttonIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        if (searchButton) {
            searchButton.disabled = true;
            searchButton.style.cursor = 'not-allowed';
            searchButton.style.opacity = '0.7';
        }
    } else {
        if (buttonText) buttonText.textContent = 'Buscar';
        if (buttonIcon) buttonIcon.innerHTML = '<i class="fas fa-search"></i>';
        if (searchButton) {
            searchButton.disabled = false;
            searchButton.style.cursor = 'pointer';
            searchButton.style.opacity = '1';
        }
    }
}

// Función para scroll optimizado hacia filtros
function scrollToFilters() {
    if (!searchPanel) return;
    
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
        
        // Focus en el primer campo visible
        setTimeout(() => {
            const firstVisibleInput = document.querySelector('.search-inputs-inline input:not([style*="display: none"])');
            if (firstVisibleInput) {
                firstVisibleInput.focus();
            }
        }, 300);
    }, isSearchPanelCollapsed ? 300 : 0);
}

// Cerrar modal de detalle
function closeDetailModalFunc() {
    if (creditNoteDetailModal) {
        creditNoteDetailModal.classList.remove('show');
        
        setTimeout(() => {
            creditNoteDetailModal.style.display = 'none';
        }, 300);
    }
}

// Manejar exportación
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

// Exportar a Excel
async function exportToExcel() {
    try {
        // Mostrar loading
        Swal.fire({
            title: 'Generando Excel...',
            text: 'Por favor espere mientras se genera el archivo.',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Crear libro de trabajo
        const workbook = XLSX.utils.book_new();
        
        // Hoja 1: Resumen
        const summaryData = createSummarySheet();
        const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');
        
        // Hoja 2: Detalle de Notas de Crédito
        const detailData = createDetailSheet();
        const detailSheet = XLSX.utils.aoa_to_sheet(detailData);
        XLSX.utils.book_append_sheet(workbook, detailSheet, 'Detalle Notas');
        
        // Hoja 3: Productos (solo si hay notas de mercadería)
        const productsData = await createProductsSheet();
        if (productsData && productsData.length > 0) {
            const productsSheet = XLSX.utils.aoa_to_sheet(productsData);
            XLSX.utils.book_append_sheet(workbook, productsSheet, 'Detalle Completo');
        }
        
        // Generar el archivo como ArrayBuffer
        const excelBuffer = XLSX.write(workbook, { 
            bookType: 'xlsx', 
            type: 'array' 
        });
        
        // Cerrar el loading de generación
        Swal.close();
        
        // Crear blob desde el buffer
        const blob = new Blob([excelBuffer], { 
            type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });
        
        // Nombre sugerido para el archivo
        const suggestedFileName = `reporte_notas_credito_${getCurrentDateForFilename()}.xlsx`;
        
        // Verificar si el navegador soporta File System Access API
        if ('showSaveFilePicker' in window) {
            try {
                const fileHandle = await window.showSaveFilePicker({
                    suggestedName: suggestedFileName,
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
                    console.warn('Error con showSaveFilePicker, usando fallback:', error);
                    downloadFileWithFallback(blob, suggestedFileName);
                }
            }
        } else {
            downloadFileWithFallback(blob, suggestedFileName);
        }
        
    } catch (error) {
        console.error('Error exportando Excel:', error);
        Swal.close();
        showErrorToast('Error al exportar los datos');
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
        console.error('Error en downloadFileWithFallback:', error);
        showErrorToast('Error al descargar el archivo');
    }
}

// Crear hoja de resumen
function createSummarySheet() {
    const totalAmount = filteredCreditNotes.reduce((sum, note) => sum + parseFloat(note.Monto || 0), 0);
    const merchandiseNotes = filteredCreditNotes.filter(note => note.IdConcepto === 1).length;
    const conceptNotes = filteredCreditNotes.filter(note => note.IdConcepto === 2).length;
    
    const now = new Date();
    
    // Obtener información del filtro aplicado
    const searchParams = getInlineSearchParameters();
    let filterInfo = '';
    
    switch (searchParams.type) {
        case 'all':
            if (searchParams.fechaInicio && searchParams.fechaFin) {
                filterInfo = `Rango de fechas: ${formatDate(searchParams.fechaInicio)} - ${formatDate(searchParams.fechaFin)}`;
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
        ['REPORTE NOTAS DE CRÉDITO PROVEEDORES'],
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
        ['Tipo', 'Cantidad', 'Porcentaje'],
        ['Mercadería', merchandiseNotes, `${((merchandiseNotes / filteredCreditNotes.length) * 100).toFixed(1)}%`],
        ['Otros Conceptos', conceptNotes, `${((conceptNotes / filteredCreditNotes.length) * 100).toFixed(1)}%`]
    ];
}

// Crear hoja de detalle
function createDetailSheet() {
    const headers = [
        'ID Nota',
        'Serie Nota',
        'Número Nota',
        'Proveedor',
        'NIT',
        'Monto',
        'Tipo Nota',
        'Fecha Registro',
        'Usuario',
        'Serie Factura',
        'Número Factura',
        'Monto Factura',
        'Estado Factura',
        'Razón Social',
        'Tipo Concepto',
        'Observaciones'
    ];
    
    const data = [
        ['DETALLE DE NOTAS DE CRÉDITO'],
        [''],
        headers,
        ...filteredCreditNotes.map(note => [
            note.IdNotaCreditoProveedores || '',
            note.Serie || '',
            note.Numero || '',
            note.NombreProveedore || '',
            note.NIT || '',
            parseFloat(note.Monto || 0),
            note.TipoNotaCredito || '',
            formatDateForExcel(note.FechaHoraRegistro),
            note.NombreUsuario || '',
            note.SeriaFacturaRecibida || '',
            note.NumeroFacturaRecibida || '',
            parseFloat(note.MontoFactura || 0),
            note.EstadoFactura || '',
            note.NombreRazon || '',
            note.IdConcepto === 1 ? 'Mercadería' : 'Otros Conceptos',
            note.Observaciones || ''
        ])
    ];
    
    return data;
}

// Crear hoja de productos (asíncrona)
async function createProductsSheet() {
    try {
        const allRecords = [];
        
        for (const note of filteredCreditNotes) {
            const baseRecord = [
                note.Serie + '-' + note.Numero,
                note.NombreProveedore || '',
                parseFloat(note.Monto || 0),
                formatDateForExcel(note.FechaHoraRegistro),
                note.SeriaFacturaRecibida + '-' + note.NumeroFacturaRecibida,
                parseFloat(note.MontoFactura || 0),
                formatDateForExcel(note.FechaFactura)
            ];
            
            // Si es nota de mercadería, intentar cargar productos
            if (note.IdConcepto === 1) {
                try {
                    const details = await loadCreditNoteDetails(note.IdNotaCreditoProveedores);
                    if (details && details.products && details.products.length > 0) {
                        // Agregar cada producto como una fila
                        details.products.forEach(product => {
                            allRecords.push([
                                ...baseRecord,
                                product.Upc || '',
                                product.Descripcion || '',
                                parseInt(product.Cantidad || 0)
                            ]);
                        });
                    } else {
                        // Nota de mercadería sin productos
                        allRecords.push([
                            ...baseRecord,
                            '',
                            '',
                            ''
                        ]);
                    }
                } catch (error) {
                    console.warn(`Error cargando productos para nota ${note.IdNotaCreditoProveedores}:`, error);
                    // En caso de error, agregar sin productos
                    allRecords.push([
                        ...baseRecord,
                        '',
                        '',
                        ''
                    ]);
                }
            } else {
                // Nota de otros conceptos (sin productos)
                allRecords.push([
                    ...baseRecord,
                    '',
                    '',
                    ''
                ]);
            }
        }
        
        const headers = [
            'Nota de Crédito',
            'Proveedor',
            'Monto Nota',
            'Fecha Nota',
            'Factura Original',
            'Monto Factura',
            'Fecha Factura',
            'UPC',
            'Descripción',
            'Cantidad'
        ];
        
        return [
            ['DETALLE COMPLETO - NOTAS DE CRÉDITO Y PRODUCTOS'],
            [''],
            headers,
            ...allRecords
        ];
        
    } catch (error) {
        console.error('Error creando hoja de productos:', error);
        return null;
    }
}

// Manejar impresión
function handlePrint() {
    if (!filteredCreditNotes || filteredCreditNotes.length === 0) {
        showErrorToast('No hay datos para imprimir');
        return;
    }
    
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
                table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
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
}

// Generar contenido para impresión
function generatePrintContent() {
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
                    </tr>
                `).join('')}
            </tbody>
        </table>
        
        <div class="footer">
            <p>Sistema de Inventarios - Reporte generado automáticamente</p>
        </div>
    `;
}

// Manejar errores de búsqueda
function handleSearchError(error) {
    console.error('Error en la búsqueda:', error);
    
    let errorMessage = 'Error al buscar notas de crédito. ';
    
    if (error.message && error.message.includes('connection')) {
        errorMessage += 'Verifique la conexión a la base de datos.';
    } else if (error.message && error.message.includes('timeout')) {
        errorMessage += 'La consulta tardó demasiado tiempo. Intente con filtros más específicos.';
    } else {
        errorMessage += 'Por favor intente nuevamente.';
    }
    
    Swal.fire({
        icon: 'error',
        title: 'Error de búsqueda',
        text: errorMessage,
        confirmButtonColor: '#6e78ff'
    });
}

// Funciones de formato
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
        console.error('Error formateando fecha:', error);
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

// Funciones de toast
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

// Funciones helper para obtener y aplicar estados
function getFiltersState() {
    return {
        searchType: currentSearchType,
        parameters: getInlineSearchParameters(),
        hasActiveFilters: searchPanel?.classList.contains('has-filters') || false,
        isCollapsed: isSearchPanelCollapsed
    };
}

function applyFiltersState(state) {
    if (!state) return;
    
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
    
    if (state.isCollapsed && !isSearchPanelCollapsed) {
        toggleSearchPanel();
    }
    
    updateFiltersIndicator();
}

// Hacer funciones globales para uso en HTML
window.handleSearchTypeChangeInline = handleSearchTypeChangeInline;
window.handleSearchInline = handleSearchInline;
window.clearAllFiltersInline = clearAllFiltersInline;
window.toggleSearchPanel = toggleSearchPanel;
window.toggleCreditNoteDetails = toggleCreditNoteDetails;
window.loadCreditNoteDetails = loadCreditNoteDetails;
window.displayCreditNoteDetails = displayCreditNoteDetails;
window.goToPage = goToPage;
window.getFiltersState = getFiltersState;
window.applyFiltersState = applyFiltersState;