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

// Elementos del DOM
let searchForm, searchFields, creditNotesContainer, resultsPanel, noResultsPanel;
let searchTypeButtons, exportBtn, printBtn, adjustFiltersBtn;
let creditNoteDetailModal, closeDetailModal;

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
    
    searchTypeButtons = document.querySelectorAll('.search-type-btn');
    exportBtn = document.getElementById('exportBtn');
    printBtn = document.getElementById('printBtn');
    adjustFiltersBtn = document.getElementById('adjustFiltersBtn');
    
    creditNoteDetailModal = document.getElementById('creditNoteDetailModal');
    closeDetailModal = document.getElementById('closeDetailModal');
    
    // Verificar elementos críticos
    if (!searchForm || !searchFields || !creditNotesContainer) {
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
    
    // Configurar campos de búsqueda inicial
    updateSearchFields();
    
    // Ocultar paneles de resultados
    hideAllResultPanels();
}

// Configurar event listeners
function setupEventListeners() {
    // Botones de tipo de búsqueda
    searchTypeButtons.forEach(button => {
        button.addEventListener('click', handleSearchTypeChange);
    });
    
    // Formulario de búsqueda
    if (searchForm) {
        searchForm.addEventListener('submit', handleSearch);
    }
    
    // Limpiar filtros
    const clearFiltersBtn = document.getElementById('clearFilters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
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

// Manejar cambio de tipo de búsqueda
function handleSearchTypeChange(e) {
    e.preventDefault();
    
    // Remover clase active de todos los botones
    searchTypeButtons.forEach(btn => btn.classList.remove('active'));
    
    // Agregar clase active al botón seleccionado
    e.currentTarget.classList.add('active');
    
    // Actualizar tipo de búsqueda actual
    currentSearchType = e.currentTarget.dataset.type;
    
    // Actualizar campos de búsqueda
    updateSearchFields();
}

// Actualizar campos de búsqueda según el tipo
function updateSearchFields() {
    let fieldsHTML = '';
    
    switch (currentSearchType) {
        case 'all':
            fieldsHTML = `
                <div class="search-inputs-group">
                    <div class="input-group">
                        <label>Mostrar todas las notas de crédito</label>
                        <p style="font-size: 14px; color: var(--text-secondary); margin-top: 10px; padding: 15px; background: rgba(110, 120, 255, 0.05); border-radius: 8px;">
                            <i class="fas fa-info-circle" style="margin-right: 8px;"></i>
                            Se mostrarán todas las notas de crédito registradas en el sistema.
                        </p>
                    </div>
                </div>
            `;
            break;
            
        case 'invoice':
            fieldsHTML = `
                <div class="search-inputs-group">
                    <div class="input-group">
                        <label for="invoiceSerie">Serie de Factura</label>
                        <input type="text" id="invoiceSerie" placeholder="Ej: A001, F001, etc.">
                    </div>
                    <div class="input-group">
                        <label for="invoiceNumber">Número de Factura</label>
                        <input type="text" id="invoiceNumber" placeholder="Ej: 123456">
                    </div>
                </div>
            `;
            break;
            
        case 'credit-note':
            fieldsHTML = `
                <div class="search-inputs-group">
                    <div class="input-group">
                        <label for="creditNoteSerie">Serie de Nota de Crédito</label>
                        <input type="text" id="creditNoteSerie" placeholder="Ej: NC001, CR001, etc.">
                    </div>
                    <div class="input-group">
                        <label for="creditNoteNumber">Número de Nota de Crédito</label>
                        <input type="text" id="creditNoteNumber" placeholder="Ej: 789">
                    </div>
                </div>
            `;
            break;
            
        case 'product':
            fieldsHTML = `
                <div class="search-inputs-group">
                    <div class="input-group">
                        <label for="productSearch">UPC o Descripción del Producto</label>
                        <input type="text" id="productSearch" placeholder="Buscar por código UPC o descripción del producto...">
                    </div>
                </div>
            `;
            break;
    }
    
    searchFields.innerHTML = fieldsHTML;
    
    // Animar los nuevos campos
    setTimeout(() => {
        const newInputs = searchFields.querySelectorAll('.input-group');
        newInputs.forEach((input, index) => {
            input.style.opacity = '0';
            input.style.transform = 'translateY(20px)';
            input.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
            
            setTimeout(() => {
                input.style.opacity = '1';
                input.style.transform = 'translateY(0)';
            }, index * 100);
        });
    }, 50);
}

// Manejar búsqueda
async function handleSearch(e) {
    e.preventDefault();
    
    // Mostrar loading
    showLoadingState(true);
    
    try {
        // Construir query según el tipo de búsqueda
        const searchParams = getSearchParameters();
        
        // Validar parámetros de búsqueda específicos
        if (!validateSearchParameters(searchParams)) {
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
        showLoadingState(false);
    }
}

// Validar parámetros de búsqueda
function validateSearchParameters(params) {
    switch (params.type) {
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

// Obtener parámetros de búsqueda
function getSearchParameters() {
    const params = {
        type: currentSearchType
    };
    
    // Parámetros específicos según el tipo de búsqueda
    switch (currentSearchType) {
        case 'invoice':
            params.invoiceSerie = document.getElementById('invoiceSerie')?.value.trim() || '';
            params.invoiceNumber = document.getElementById('invoiceNumber')?.value.trim() || '';
            break;
            
        case 'credit-note':
            params.creditNoteSerie = document.getElementById('creditNoteSerie')?.value.trim() || '';
            params.creditNoteNumber = document.getElementById('creditNoteNumber')?.value.trim() || '';
            break;
            
        case 'product':
            params.productSearch = document.getElementById('productSearch')?.value.trim() || '';
            break;
    }
    
    return params;
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
                <div class="credit-note-header" onclick="toggleCreditNoteDetails(${note.IdNotaCreditoProveedores})">
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
    
    const creditNoteItem = document.querySelector(`[data-id="${creditNoteId}"]`);
    const detailsContainer = document.getElementById(`details-${creditNoteId}`);
    const expandButton = creditNoteItem?.querySelector('.expand-toggle');
    
    // Verificar que todos los elementos existen
    if (!creditNoteItem) {
        return;
    }
    
    if (!detailsContainer) {
        return;
    }
    
    if (!expandButton) {
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
                        <br><br>
                        <button onclick="toggleCreditNoteDetails(${creditNoteId})" 
                                style="padding: 8px 16px; background: var(--primary-color); color: white; border: none; border-radius: 5px; cursor: pointer;">
                            Intentar de nuevo
                        </button>
                    </div>
                `;
            }
        }
        
        detailsContainer.style.display = 'block';
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
        
        await connection.close();
        
        return {
            creditNote: creditNote,
            products: productsResult
        };
        
    } catch (error) {
        console.error('Error detallado en loadCreditNoteDetails:', error);
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

// Ocultar todos los paneles de resultados
function hideAllResultPanels() {
    if (resultsPanel) resultsPanel.style.display = 'none';
    if (noResultsPanel) noResultsPanel.style.display = 'none';
}

// Limpiar todos los filtros
function clearAllFilters() {
    // Limpiar campos específicos de búsqueda
    const searchInputs = searchFields.querySelectorAll('input');
    searchInputs.forEach(input => input.value = '');
    
    // Resetear tipo de búsqueda a "Todas"
    searchTypeButtons.forEach(btn => btn.classList.remove('active'));
    document.getElementById('searchAll').classList.add('active');
    currentSearchType = 'all';
    updateSearchFields();
    
    // Ocultar resultados
    hideAllResultPanels();
    
    showSuccessToast('Filtros limpiados correctamente');
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
        const merchandiseNotes = filteredCreditNotes.filter(note => note.IdConcepto === 1);
        if (merchandiseNotes.length > 0) {
            const productsData = await createProductsSheet();
            if (productsData && productsData.length > 0) {
                const productsSheet = XLSX.utils.aoa_to_sheet(productsData);
                XLSX.utils.book_append_sheet(workbook, productsSheet, 'Productos');
            }
        }
        
        // Generar archivo y descargar
        const fileName = `reporte_notas_credito_${getCurrentDateForFilename()}.xlsx`;
        XLSX.writeFile(workbook, fileName);
        
        // Cerrar loading y mostrar éxito
        Swal.close();
        showSuccessToast('Archivo Excel descargado exitosamente');
        
    } catch (error) {
        console.error('Error exportando Excel:', error);
        Swal.close();
        showErrorToast('Error al exportar los datos');
    }
}

// Crear hoja de resumen
function createSummarySheet() {
    const totalAmount = filteredCreditNotes.reduce((sum, note) => sum + parseFloat(note.Monto || 0), 0);
    const merchandiseNotes = filteredCreditNotes.filter(note => note.IdConcepto === 1).length;
    const conceptNotes = filteredCreditNotes.filter(note => note.IdConcepto === 2).length;
    
    const now = new Date();
    
    return [
        ['REPORTE NOTAS DE CRÉDITO PROVEEDORES'],
        [''],
        ['Fecha de Generación:', formatDate(now)],
        ['Hora de Generación:', now.toLocaleTimeString()],
        ['Usuario:', localStorage.getItem('userName') || 'N/A'],
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
        const merchandiseNotes = filteredCreditNotes.filter(note => note.IdConcepto === 1);
        const allProducts = [];
        
        // Obtener productos para cada nota de mercadería
        for (const note of merchandiseNotes) {
            try {
                const details = await loadCreditNoteDetails(note.IdNotaCreditoProveedores);
                if (details && details.products && details.products.length > 0) {
                    details.products.forEach(product => {
                        allProducts.push([
                            note.Serie + '-' + note.Numero,
                            note.NombreProveedore,
                            product.Upc || '',
                            product.Descripcion || '',
                            parseInt(product.Cantidad || 0)
                        ]);
                    });
                }
            } catch (error) {
                console.warn(`Error cargando productos para nota ${note.IdNotaCreditoProveedores}:`, error);
            }
        }
        
        if (allProducts.length === 0) {
            return null;
        }
        
        const headers = [
            'Nota de Crédito',
            'Proveedor',
            'UPC',
            'Descripción',
            'Cantidad'
        ];
        
        return [
            ['PRODUCTOS DEVUELTOS'],
            [''],
            headers,
            ...allProducts
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
    
    // Crear ventana de impresión
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
        </head>
        <body>
            ${printContent}
        </body>
        </html>
    `);
    
    printWindow.document.close();
    
    // Esperar a que cargue y luego imprimir
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

// Scroll hacia filtros
function scrollToFilters() {
    const searchPanel = document.querySelector('.search-panel');
    if (searchPanel) {
        searchPanel.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start' 
        });
    }
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

// Mostrar estado de carga
function showLoadingState(isLoading) {
    const searchButton = document.querySelector('.search-button');
    const buttonText = searchButton?.querySelector('.button-text');
    const buttonIcon = searchButton?.querySelector('.button-icon');
    
    if (isLoading) {
        if (buttonText) buttonText.textContent = 'Buscando...';
        if (buttonIcon) buttonIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        if (searchButton) {
            searchButton.disabled = true;
            searchButton.style.cursor = 'not-allowed';
        }
    } else {
        if (buttonText) buttonText.textContent = 'Buscar Notas de Crédito';
        if (buttonIcon) buttonIcon.innerHTML = '<i class="fas fa-search"></i>';
        if (searchButton) {
            searchButton.disabled = false;
            searchButton.style.cursor = 'pointer';
        }
    }
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

// Hacer funciones globales para uso en HTML
window.toggleCreditNoteDetails = toggleCreditNoteDetails;
window.loadCreditNoteDetails = loadCreditNoteDetails;
window.displayCreditNoteDetails = displayCreditNoteDetails;
window.goToPage = goToPage;