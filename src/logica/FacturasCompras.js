const odbc = require('odbc');
const Swal = require('sweetalert2');
const mysql = require('mysql2/promise');

// Variables globales para elementos del DOM
let searchForm, searchSerie, searchNumber, searchButton, buttonText, buttonIcon;
let resultsPanel, notFoundPanel, newSearchBtn, tryAgainBtn, addCreditNoteBtn;
let creditNoteModal, closeCreditNoteModal, cancelCreditNote, creditNoteForm;
let merchandiseBtn, otherConceptsBtn;
let merchandiseModal, closeMerchandiseModal, productSearchInput, productsContainer;

// Variables para edición inline
let isEditing = false;
let currentEditingElement = null;

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar elementos del DOM
    searchForm = document.getElementById('searchForm');
    searchSerie = document.getElementById('searchSerie');
    searchNumber = document.getElementById('searchNumber');
    searchButton = document.querySelector('.search-button');
    
    // Verificar que los elementos críticos existen
    if (!searchForm || !searchSerie || !searchNumber || !searchButton) {
        return;
    }
    
    buttonText = searchButton.querySelector('.button-text');
    buttonIcon = searchButton.querySelector('.button-icon');
    resultsPanel = document.getElementById('resultsPanel');
    notFoundPanel = document.getElementById('notFoundPanel');
    newSearchBtn = document.getElementById('newSearchBtn');
    tryAgainBtn = document.getElementById('tryAgainBtn');
    addCreditNoteBtn = document.getElementById('addCreditNoteBtn');
    
    // Elementos del modal
    creditNoteModal = document.getElementById('creditNoteModal');
    closeCreditNoteModal = document.getElementById('closeCreditNoteModal');
    cancelCreditNote = document.getElementById('cancelCreditNote');
    creditNoteForm = document.getElementById('creditNoteForm');
    merchandiseBtn = document.getElementById('merchandiseBtn');
    otherConceptsBtn = document.getElementById('otherConceptsBtn');

    // Inicialización
    initializeApp();

    // Event Listeners
    searchForm.addEventListener('submit', handleSearch);
    newSearchBtn.addEventListener('click', resetSearch);
    tryAgainBtn.addEventListener('click', resetSearch);
    addCreditNoteBtn.addEventListener('click', handleAddCreditNote);
    searchButton.addEventListener('mousedown', createRippleEffect);
    
    // Event Listeners del modal
    if (closeCreditNoteModal) closeCreditNoteModal.addEventListener('click', closeCreditNoteModalFunc);
    if (cancelCreditNote) cancelCreditNote.addEventListener('click', closeCreditNoteModalFunc);
    if (creditNoteForm) creditNoteForm.addEventListener('submit', handleCreditNoteSubmit);
    if (merchandiseBtn) merchandiseBtn.addEventListener('click', () => selectConceptType('mercaderia'));
    if (otherConceptsBtn) otherConceptsBtn.addEventListener('click', () => selectConceptType('otros'));
    
    // Cerrar modal al hacer clic fuera
    if (creditNoteModal) {
        creditNoteModal.addEventListener('click', (e) => {
            if (e.target === creditNoteModal) {
                closeCreditNoteModalFunc();
            }
        });
    }

    // Enfocar el primer input de búsqueda al cargar
    setTimeout(() => {
        if (searchSerie) {
            searchSerie.focus();
        }
    }, 100);
});

// Inicializar la aplicación
function initializeApp() {
    // Animar elementos de entrada
    animatePageElements();
    
    // Cargar información del usuario
    loadUserInfo();
    
    // Ocultar paneles de resultados inicialmente
    hideAllResultPanels();
}

// Animar elementos de la página secuencialmente
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

// Cargar información del usuario desde localStorage
function loadUserInfo() {
    const userName = localStorage.getItem('userName');
    const userNameElement = document.getElementById('userName');
    
    if (userName && userNameElement) {
        userNameElement.textContent = userName;
        
        // Animación para el nombre del usuario
        setTimeout(() => {
            userNameElement.style.opacity = '0';
            setTimeout(() => {
                userNameElement.style.opacity = '1';
                userNameElement.style.transition = 'opacity 0.3s ease';
            }, 100);
        }, 500);
    }
}

// Ocultar todos los paneles de resultados
function hideAllResultPanels() {
    resultsPanel.style.display = 'none';
    notFoundPanel.style.display = 'none';
}

// Manejar la búsqueda de facturas
async function handleSearch(e) {
    e.preventDefault();
    
    // Verificar que los elementos existen antes de acceder a sus valores
    const serieElement = document.getElementById('searchSerie');
    const numberElement = document.getElementById('searchNumber');
    
    if (!serieElement || !numberElement) {
        showErrorToast('Error: No se encontraron los campos de búsqueda');
        return;
    }
    
    const serieValue = serieElement.value.trim();
    const numberValue = numberElement.value.trim();
    
    if (!serieValue || !numberValue) {
        showErrorToast('Por favor ingrese tanto la serie como el número de la factura');
        shakeSearchPanel();
        return;
    }

    // Cambiar botón a estado de carga
    setLoadingState(true);
    
    try {
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        const invoice = await searchInvoice(connection, serieValue, numberValue);
        
        await connection.close();
        
        if (invoice) {
            displayInvoiceResults(invoice);
        } else {
            showNotFoundPanel();
        }
        
    } catch (error) {
        handleSearchError(error);
    } finally {
        setLoadingState(false);
    }
}

// Buscar factura en la base de datos
async function searchInvoice(connection, serie, numero) {
    try {
        const query = `
            SELECT
                facturas_compras.Id, 
                proveedores_facturas.Nombre, 
                facturas_compras.NombreUsuarioIngresa, 
                razonessociales.NombreRazon, 
                facturas_compras.Serie, 
                facturas_compras.Numero, 
                facturas_compras.MontoFactura, 
                facturas_compras.FechaRecepcion, 
                facturas_compras.FechaFactura, 
                facturas_compras.IdInventory, 
                facturas_compras.IdSucursalCori,
                facturas_compras.NIT,
                facturas_compras.IdRazon
            FROM
                facturas_compras
                INNER JOIN proveedores_facturas
                ON facturas_compras.IdProveedor = proveedores_facturas.Id
                INNER JOIN razonessociales
                ON facturas_compras.IdRazon = razonessociales.Id
            WHERE facturas_compras.Serie = ? AND facturas_compras.Numero = ?
        `;
        
        const result = await connection.query(query, [serie, numero]);
        
        if (result.length > 0) {
            const invoice = result[0];
            
            // Obtener el nombre de la sucursal si existe IdSucursalCori
            if (invoice.IdSucursalCori) {
                try {
                    const branchName = await getBranchName(invoice.IdSucursalCori);
                    invoice.NombreSucursal = branchName;
                } catch (branchError) {
                    invoice.NombreSucursal = 'No disponible';
                }
            } else {
                invoice.NombreSucursal = 'No especificada';
            }
            
            return invoice;
        }
        
        return null;
        
    } catch (error) {
        throw error;
    }
}

// Obtener nombre de la sucursal y datos de conexión
async function getBranchName(branchId) {
    let branchConnection = null;
    
    try {
        branchConnection = await odbc.connect('DSN=DBsucursal');
        
        const branchQuery = `
            SELECT 
                sucursales.NombreSucursal,
                sucursales.serverr,
                sucursales.databasee,
                sucursales.Uid,
                sucursales.Pwd
            FROM sucursales
            WHERE sucursales.idSucursal = ?
        `;
        
        const branchResult = await branchConnection.query(branchQuery, [branchId]);
        
        if (branchResult.length > 0) {
            // Guardar datos de conexión para uso posterior
            window.branchConnectionData = {
                server: branchResult[0].serverr,
                database: branchResult[0].databasee,
                user: branchResult[0].Uid,
                password: branchResult[0].Pwd
            };
            
            return branchResult[0].NombreSucursal;
        } else {
            return 'Sucursal no encontrada';
        }
        
    } catch (error) {
        throw error;
    } finally {
        if (branchConnection) {
            try {
                await branchConnection.close();
            } catch (closeError) {
            }
        }
    }
}

// Mostrar resultados de la factura
function displayInvoiceResults(invoice) {
    // Ocultar otros paneles
    notFoundPanel.style.display = 'none';
    
    // Ocultar el panel de búsqueda con animación
    hideSearchPanel();
    
    // Llenar los datos
    populateInvoiceData(invoice);
    
    // Configurar campos editables
    setupEditableFields();
    
    // Mostrar el panel de resultados con animación después de ocultar la búsqueda
    setTimeout(() => {
        resultsPanel.style.display = 'block';
        resultsPanel.style.opacity = '0';
        resultsPanel.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            resultsPanel.style.opacity = '1';
            resultsPanel.style.transform = 'translateY(0)';
            resultsPanel.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            
            // Hacer scroll hacia los resultados
            resultsPanel.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    }, 300); // Esperar a que termine la animación de ocultar

    // Mostrar mensaje de éxito
    showSuccessToast('Factura encontrada exitosamente');
}

// Llenar los datos de la factura en el panel
function populateInvoiceData(invoice) {
    document.getElementById('invoiceId').textContent = invoice.Id || '-';
    document.getElementById('invoiceSerie').textContent = invoice.Serie || '-';
    document.getElementById('invoiceNumber').textContent = invoice.Numero || '-';
    document.getElementById('invoiceAmount').textContent = formatCurrency(invoice.MontoFactura) || '-';
    document.getElementById('providerName').textContent = invoice.Nombre || '-';
    document.getElementById('providerNit').textContent = formatNIT(invoice.NIT) || '-';
    document.getElementById('socialReason').textContent = invoice.NombreRazon || '-';
    document.getElementById('invoiceDate').textContent = formatDate(invoice.FechaFactura) || '-';
    document.getElementById('receptionDate').textContent = formatDate(invoice.FechaRecepcion) || '-';
    document.getElementById('userWhoEntered').textContent = invoice.NombreUsuarioIngresa || '-';
    document.getElementById('inventoryId').textContent = invoice.IdInventory || '-';
    document.getElementById('branchName').textContent = invoice.NombreSucursal || '-';
    
    // Guardar datos de la factura para uso posterior
    window.currentInvoice = invoice;
}
// Configurar campos editables
function setupEditableFields() {
    const editableFields = [
        { id: 'invoiceSerie', type: 'text', fieldName: 'Serie', tipoCambio: 1 },
        { id: 'invoiceNumber', type: 'text', fieldName: 'Numero', tipoCambio: 2 },
        { id: 'socialReason', type: 'select', fieldName: 'IdRazon', tipoCambio: 3 },
        { id: 'invoiceAmount', type: 'number', fieldName: 'MontoFactura', tipoCambio: 4 },
        { id: 'invoiceDate', type: 'date', fieldName: 'FechaFactura', tipoCambio: 5 },
        // NUEVO: Agregar edición de proveedor por NIT
        { id: 'providerNit', type: 'provider-nit', fieldName: 'NIT', tipoCambio: 6 }
    ];

    editableFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            // Agregar clase para indicar que es editable
            element.classList.add('editable-field');
            
            // Agregar evento de doble clic
            element.addEventListener('dblclick', () => enableInlineEdit(element, field));
            
            // Agregar indicador visual
            element.title = 'Doble clic para editar';
        }
    });
}

function logUpdateSummary(fieldConfig, newValue, selectedProvider = null) {
    const tablesUpdated = [];
    
    // Central
    tablesUpdated.push('✅ facturas_compras (Central)');
    tablesUpdated.push('✅ CambiosFacturasHistorial (Central)');
    
    // Sucursal - inventarios
    const inventoryMapping = {
        'Serie': true,
        'Numero': true, 
        'FechaFactura': true,
        'IdRazon': true,
        'MontoFactura': false,
        'NIT': true // NUEVO: El proveedor sí se actualiza en inventarios
    };
    
    if (inventoryMapping[fieldConfig.fieldName]) {
        tablesUpdated.push('✅ inventarios (Sucursal)');
    } else {
        tablesUpdated.push('⏭️ inventarios (Campo no aplicable)');
    }
    
    // Sucursal - facturas_compras
    tablesUpdated.push('✅ facturas_compras (Sucursal)');
    
    // Sucursal - ordenescompra_factura
    tablesUpdated.push('✅ ordenescompra_factura (Sucursal)');
    
    let displayValue = newValue;
    if (fieldConfig.fieldName === 'NIT' && selectedProvider) {
        displayValue = `${selectedProvider.Nombre} (${formatNIT(selectedProvider.NIT)})`;
    }
}
// Crear input especial para NIT de proveedor con búsqueda automática
async function createProviderNitInput(currentNit) {
    const container = document.createElement('div');
    container.className = 'provider-nit-container';
    
    // Input para el NIT
    const nitInput = document.createElement('input');
    nitInput.type = 'text';
    nitInput.className = 'inline-edit-input provider-nit-input';
    nitInput.value = currentNit || '';
    nitInput.placeholder = 'Ingrese el NIT del proveedor';
    
    // Contenedor de información del proveedor
    const providerInfo = document.createElement('div');
    providerInfo.className = 'provider-info-display';
    providerInfo.style.marginTop = '8px';
    
    // Función para buscar proveedor por NIT
    const searchProvider = async (nit) => {
        if (!nit || nit.trim().length < 3) {
            providerInfo.innerHTML = '';
            return null;
        }
        
        try {
            providerInfo.innerHTML = `
                <div class="provider-searching">
                    <i class="fas fa-spinner fa-spin"></i> Buscando proveedor...
                </div>
            `;
            
            const connection = await odbc.connect('DSN=facturas;charset=utf8');
            
            const query = `
                SELECT 
                    Id,
                    Nombre,
                    NIT
                FROM proveedores_facturas 
                WHERE NIT = ? OR NIT LIKE ?
                ORDER BY 
                    CASE WHEN NIT = ? THEN 1 ELSE 2 END,
                    Nombre
                LIMIT 5
            `;
            
            const searchPattern = `%${nit}%`;
            const result = await connection.query(query, [nit, searchPattern, nit]);
            await connection.close();
            
            if (result.length === 0) {
                providerInfo.innerHTML = `
                    <div class="provider-not-found">
                        <i class="fas fa-exclamation-triangle"></i>
                        <span>No se encontró proveedor con NIT: ${nit}</span>
                    </div>
                `;
                return null;
            }
            
            if (result.length === 1) {
                const provider = result[0];
                providerInfo.innerHTML = `
                    <div class="provider-found">
                        <i class="fas fa-check-circle"></i>
                        <div class="provider-details">
                            <strong>${provider.Nombre}</strong>
                            <div class="provider-nit">NIT: ${formatNIT(provider.NIT)}</div>
                        </div>
                    </div>
                `;
                return provider;
            }
            
            // Múltiples resultados - mostrar lista para selección
            const optionsHtml = result.map((provider, index) => `
                <div class="provider-option" data-provider-id="${provider.Id}" data-provider-nit="${provider.NIT}" data-provider-name="${provider.Nombre}">
                    <i class="fas fa-building"></i>
                    <div class="provider-option-details">
                        <strong>${provider.Nombre}</strong>
                        <div class="provider-option-nit">NIT: ${formatNIT(provider.NIT)}</div>
                    </div>
                    <button type="button" class="select-provider-btn" data-index="${index}">
                        <i class="fas fa-check"></i>
                    </button>
                </div>
            `).join('');
            
            providerInfo.innerHTML = `
                <div class="provider-multiple">
                    <div class="provider-multiple-header">
                        <i class="fas fa-list"></i>
                        <span>Se encontraron ${result.length} proveedores. Seleccione uno:</span>
                    </div>
                    <div class="provider-options">
                        ${optionsHtml}
                    </div>
                </div>
            `;
            
            // Agregar event listeners para selección
            providerInfo.querySelectorAll('.select-provider-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const index = parseInt(e.target.closest('.select-provider-btn').dataset.index);
                    const selectedProvider = result[index];
                    
                    // Actualizar el input con el NIT seleccionado
                    nitInput.value = selectedProvider.NIT;
                    
                    // Mostrar el proveedor seleccionado
                    providerInfo.innerHTML = `
                        <div class="provider-selected">
                            <i class="fas fa-check-circle"></i>
                            <div class="provider-details">
                                <strong>${selectedProvider.Nombre}</strong>
                                <div class="provider-nit">NIT: ${formatNIT(selectedProvider.NIT)}</div>
                            </div>
                        </div>
                    `;
                    
                    // Guardar proveedor seleccionado
                    container.selectedProvider = selectedProvider;
                });
            });
            
            return null; // No hay selección automática
            
        } catch (error) {
            providerInfo.innerHTML = `
                <div class="provider-error">
                    <i class="fas fa-exclamation-triangle"></i>
                    <span>Error al buscar proveedor: ${error.message}</span>
                </div>
            `;
            return null;
        }
    };
    
    // Búsqueda con debounce
    let searchTimeout;
    nitInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const nit = e.target.value.trim();
        
        searchTimeout = setTimeout(async () => {
            const provider = await searchProvider(nit);
            if (provider) {
                container.selectedProvider = provider;
            }
        }, 500); // Debounce de 500ms
    });
    
    // Búsqueda inicial si hay valor
    if (currentNit) {
        setTimeout(() => searchProvider(currentNit), 100);
    }
    
    container.appendChild(nitInput);
    container.appendChild(providerInfo);
    
    // Exponer el input principal para el manejo de eventos
    container.mainInput = nitInput;
    
    return container;
}
// Habilitar edición inline
async function enableInlineEdit(element, fieldConfig) {
    if (isEditing) {
        showWarningToast('Ya hay un campo en edición. Complete la edición actual primero.');
        return;
    }

    isEditing = true;
    currentEditingElement = element;
    
    const originalValue = getOriginalValue(element, fieldConfig);
    const currentDisplayValue = element.textContent.trim();
    
    // Crear el elemento de edición
    let editElement;
    
    if (fieldConfig.type === 'select' && fieldConfig.fieldName === 'IdRazon') {
        editElement = await createSocialReasonSelect(window.currentInvoice.IdRazon);
    } else if (fieldConfig.type === 'provider-nit') {
        // NUEVO: Crear input especial para NIT de proveedor
        editElement = await createProviderNitInput(originalValue);
    } else {
        editElement = createInputElement(fieldConfig.type, originalValue);
    }
    
    // Reemplazar el contenido del span con el elemento de edición
    const originalHTML = element.innerHTML;
    element.innerHTML = '';
    element.appendChild(editElement);
    
    // Agregar botones de acción
    const actionButtons = createActionButtons();
    element.appendChild(actionButtons);
    
    // Enfocar el elemento
    if (editElement.focus) {
        editElement.focus();
        if (fieldConfig.type === 'text' || fieldConfig.type === 'number') {
            editElement.select();
        }
    }
    
    // Manejar eventos
    const handleSave = async () => {
        let newValue;
        let newDisplayValue;
        let selectedProvider = null;
        
        if (fieldConfig.type === 'select') {
            const selectedOption = editElement.options[editElement.selectedIndex];
            newValue = editElement.value;
            newDisplayValue = selectedOption ? selectedOption.text : '';
            
            if (fieldConfig.fieldName === 'IdRazon' && !newValue) {
                showErrorToast('Debe seleccionar una razón social válida');
                return;
            }
            
        } else if (fieldConfig.type === 'provider-nit') {
            // NUEVO: Manejo especial para proveedor por NIT
            newValue = editElement.mainInput.value.trim();
            selectedProvider = editElement.selectedProvider;
            
            if (!selectedProvider) {
                showErrorToast('Debe seleccionar un proveedor válido');
                return;
            }
            
            newDisplayValue = formatNIT(selectedProvider.NIT);
            
        } else if (fieldConfig.type === 'number') {
            newValue = parseFloat(editElement.value);
            newDisplayValue = formatCurrency(newValue);
        } else if (fieldConfig.type === 'date') {
            newValue = editElement.value;
            newDisplayValue = formatDate(newValue);
        } else {
            newValue = editElement.value.trim();
            newDisplayValue = newValue;
        }
        
        // Validar que hay cambios
        if (fieldConfig.type === 'provider-nit') {
            // Para proveedor, comparar por ID
            if (selectedProvider && selectedProvider.NIT === originalValue) {
                cancelEdit();
                showInfoToast('No se realizaron cambios');
                return;
            }
        } else {
            if (newValue.toString() === originalValue.toString()) {
                cancelEdit();
                showInfoToast('No se realizaron cambios');
                return;
            }
        }
        
        // Validaciones específicas
        if (!validateFieldValue(fieldConfig, newValue, selectedProvider)) {
            return;
        }
        
        try {
            // Confirmar cambio
            const confirmed = await confirmChange(fieldConfig, currentDisplayValue, newDisplayValue, selectedProvider);
            if (!confirmed) {
                return;
            }
            
            // Mostrar loading durante la actualización
            Swal.fire({
                title: 'Actualizando Sistema Completo...',
                html: `
                    <div style="text-align: center; margin: 20px 0;">
                        <div class="loading-spinner"></div>
                        <p style="margin-top: 15px; font-weight: 600;">Sincronizando datos en:</p>
                        <div style="text-align: left; margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                            <p style="margin: 5px 0;"><strong>Sistema Central:</strong></p>
                            <p style="margin: 2px 0; font-size: 14px;">• facturas_compras</p>
                            <p style="margin: 2px 0; font-size: 14px;">• CambiosFacturasHistorial</p>
                            <br>
                            <p style="margin: 5px 0;"><strong>Sucursal:</strong></p>
                            <p style="margin: 2px 0; font-size: 14px;">• inventarios</p>
                            <p style="margin: 2px 0; font-size: 14px;">• facturas_compras</p>
                            <p style="margin: 2px 0; font-size: 14px;">• ordenescompra_factura</p>
                        </div>
                        <p style="font-size: 14px; color: #6c757d;">Por favor espere...</p>
                    </div>
                `,
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            // Guardar en base de datos (central y sucursal)
            await saveFieldChange(fieldConfig, originalValue, newValue, selectedProvider);
            
            // Log del resumen completo
            logUpdateSummary(fieldConfig, newValue, selectedProvider);
            
            // Cerrar loading
            Swal.close();
            
            // Actualizar la interfaz
            element.innerHTML = newDisplayValue;
            element.classList.add('field-updated');
            
            // Actualizar el objeto currentInvoice
            updateCurrentInvoiceObject(fieldConfig, newValue, newDisplayValue, selectedProvider);
            
            // Resetear estado
            isEditing = false;
            currentEditingElement = null;
            
            // Mensaje de éxito más específico
            showSuccessToast('🎉 Sistema sincronizado exitosamente (Central + Sucursal)');
            
            // Quitar resaltado después de un tiempo
            setTimeout(() => {
                element.classList.remove('field-updated');
            }, 3000);
            
        } catch (error) {
            // Cerrar loading si está abierto
            Swal.close();
            showErrorToast('❌ Error al sincronizar el sistema: ' + error.message);
        }
    };
    
    const cancelEdit = () => {
        element.innerHTML = originalHTML;
        isEditing = false;
        currentEditingElement = null;
    };
    
    // Event listeners para los botones
    actionButtons.querySelector('.save-btn').addEventListener('click', handleSave);
    actionButtons.querySelector('.cancel-btn').addEventListener('click', cancelEdit);
    
    // Event listener para Enter y Escape
    editElement.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelEdit();
        }
    });
}

// Obtener valor original del campo
function getOriginalValue(element, fieldConfig) {
    const invoice = window.currentInvoice;
    
    switch (fieldConfig.fieldName) {
        case 'Serie':
            return invoice.Serie || '';
        case 'Numero':
            return invoice.Numero || '';
        case 'IdRazon':
            return invoice.IdRazon || '';
        case 'MontoFactura':
            return invoice.MontoFactura || 0;
        case 'FechaFactura':
            if (invoice.FechaFactura) {
                const dateOnly = invoice.FechaFactura.includes('T') 
                    ? invoice.FechaFactura.split('T')[0] 
                    : invoice.FechaFactura;
                return dateOnly;
            }
            return '';
        case 'NIT':
            return invoice.NIT || '';
        default:
            return '';
    }
}

function validateDate(dateString) {
    if (!dateString) return false;
    
    try {
        // Separar los componentes
        const [year, month, day] = dateString.split('-').map(Number);
        
        // Crear fecha local sin zona horaria
        const inputDate = new Date(year, month - 1, day);
        const today = new Date();
        
        // Establecer las horas para comparar solo fechas
        today.setHours(23, 59, 59, 999);
        
        return inputDate <= today;
        
    } catch (error) {
        return false;
    }
}

// Crear elemento de entrada
function createInputElement(type, value) {
    const input = document.createElement('input');
    input.type = type;
    input.className = 'inline-edit-input';
    
    if (type === 'number') {
        input.step = '0.01';
        input.min = '0.01';
        input.value = value || '';
    } else if (type === 'date') {
        input.value = value || '';
    } else {
        input.value = value || '';
    }
    
    return input;
}

// Crear select para razón social
async function createSocialReasonSelect(currentIdRazon) {
    const select = document.createElement('select');
    select.className = 'inline-edit-select';
    
    try {
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        const query = `
            SELECT Id, NombreRazon 
            FROM razonessociales 
            ORDER BY NombreRazon
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Agregar opción por defecto
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Seleccione una razón social...';
        select.appendChild(defaultOption);
        
        // Agregar opciones
        result.forEach(razon => {
            const option = document.createElement('option');
            option.value = razon.Id;
            option.textContent = razon.NombreRazon;
            
            if (razon.Id.toString() === currentIdRazon.toString()) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });
        
    } catch (error) {
        showErrorToast('Error cargando razones sociales');
    }
    
    return select;
}

// Crear botones de acción
function createActionButtons() {
    const container = document.createElement('div');
    container.className = 'inline-edit-actions';
    
    const saveBtn = document.createElement('button');
    saveBtn.className = 'save-btn';
    saveBtn.innerHTML = '<i class="fas fa-check"></i>';
    saveBtn.title = 'Guardar cambios';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'cancel-btn';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
    cancelBtn.title = 'Cancelar edición';
    
    container.appendChild(saveBtn);
    container.appendChild(cancelBtn);
    
    return container;
}

// Validar valor del campo
function validateFieldValue(fieldConfig, value, selectedProvider = null) {
    switch (fieldConfig.fieldName) {
        case 'Serie':
        case 'Numero':
            if (!value || value.trim() === '') {
                showErrorToast('El campo no puede estar vacío');
                return false;
            }
            if (value.length > 50) {
                showErrorToast('El valor es demasiado largo (máximo 50 caracteres)');
                return false;
            }
            break;
            
        case 'MontoFactura':
            if (!value || value <= 0) {
                showErrorToast('El monto debe ser mayor a 0');
                return false;
            }
            if (value > 999999999.99) {
                showErrorToast('El monto es demasiado grande');
                return false;
            }
            break;
            
        case 'IdRazon':
            if (!value) {
                showErrorToast('Debe seleccionar una razón social');
                return false;
            }
            break;
            
        case 'FechaFactura':
            if (!value) {
                showErrorToast('Debe seleccionar una fecha');
                return false;
            }
            if (!validateDate(value)) {
                showErrorToast('La fecha no puede ser futura');
                return false;
            }
            break;
            
        // NUEVO: Validar NIT y proveedor
        case 'NIT':
            if (!value || value.trim() === '') {
                showErrorToast('Debe ingresar un NIT');
                return false;
            }
            if (!selectedProvider) {
                showErrorToast('Debe seleccionar un proveedor válido con el NIT ingresado');
                return false;
            }
            break;
    }
    
    return true;
}

// Confirmar cambio
async function confirmChange(fieldConfig, oldDisplayValue, newDisplayValue, selectedProvider = null) {
    let changeDetails = `
        <div style="text-align: left; margin: 20px 0;">
            <p><strong>Campo:</strong> ${getFieldDisplayName(fieldConfig.tipoCambio)}</p>
            <p><strong>Valor anterior:</strong> ${oldDisplayValue}</p>
            <p><strong>Valor nuevo:</strong> ${newDisplayValue}</p>
    `;
    
    // NUEVO: Agregar detalles del proveedor si aplica
    if (fieldConfig.fieldName === 'NIT' && selectedProvider) {
        changeDetails += `
            <hr style="margin: 15px 0;">
            <p><strong>Proveedor seleccionado:</strong></p>
            <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; margin: 5px 0;">
                <p style="margin: 2px 0;"><strong>Nombre:</strong> ${selectedProvider.Nombre}</p>
                <p style="margin: 2px 0;"><strong>NIT:</strong> ${formatNIT(selectedProvider.NIT)}</p>
                <p style="margin: 2px 0;"><strong>ID:</strong> ${selectedProvider.Id}</p>
            </div>
        `;
    }
    
    changeDetails += `</div>`;
    
    const result = await Swal.fire({
        title: '¿Confirmar cambio?',
        html: changeDetails,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4caf50',
        cancelButtonColor: '#ff5e6d',
        confirmButtonText: 'Sí, guardar cambio',
        cancelButtonText: 'Cancelar'
    });
    
    return result.isConfirmed;
}

// Obtener nombre del campo para mostrar
function getFieldDisplayName(tipoCambio) {
    const names = {
        1: 'Serie',
        2: 'Número',
        3: 'Razón Social',
        4: 'Monto Facturado',
        5: 'Fecha Factura',
        6: 'Proveedor'
    };
    return names[tipoCambio] || 'Campo';
}

// Guardar cambio en base de datos
async function saveFieldChange(fieldConfig, oldValue, newValue, selectedProvider = null) {
    let connection = null;
    
    try {
        // 1. ACTUALIZAR EN LA BASE DE DATOS CENTRAL (DSN=facturas)
        connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        // Actualizar la factura en la base central
        await updateInvoiceField(connection, fieldConfig, newValue, selectedProvider);
        
        // Registrar el cambio en el historial
        await logFieldChange(connection, fieldConfig, oldValue, newValue, selectedProvider);
        
        await connection.close();
        connection = null;
        
        // 2. ACTUALIZAR EN LA BASE DE DATOS DE LA SUCURSAL (MySQL)
        await updateBranchInventory(fieldConfig, newValue, selectedProvider);
        
    } catch (error) {
        // Cerrar conexiones en caso de error
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
            }
        }
        
        throw error;
    }
}

async function updateBranchInventory(fieldConfig, newValue, selectedProvider = null) {
    let branchConnection = null;
    
    try {
        // Verificar que tenemos los datos de conexión de la sucursal
        if (!window.branchConnectionData) {
            return;
        }
        
        // Verificar que tenemos el IdInventory
        if (!window.currentInvoice.IdInventory) {
            return;
        }
        
        // Crear conexión MySQL a la sucursal
        branchConnection = await mysql.createConnection({
            host: window.branchConnectionData.server,
            database: window.branchConnectionData.database,
            user: window.branchConnectionData.user,
            password: window.branchConnectionData.password,
            port: 3306,
            connectTimeout: 10000
        });
        
        // Actualizar en las tres tablas de la sucursal
        await updateInventoryField(branchConnection, fieldConfig, newValue, selectedProvider);
        await updateBranchFacturasCompras(branchConnection, fieldConfig, newValue, selectedProvider);
        await updateBranchOrdenesCompraFactura(branchConnection, fieldConfig, newValue, selectedProvider);
        
    } catch (error) {
        showWarningToast('Advertencia: No se pudo actualizar completamente la información en la sucursal');
    } finally {
        if (branchConnection) {
            try {
                await branchConnection.end();
            } catch (closeError) {
            }
        }
    }
}
async function updateBranchOrdenesCompraFactura(branchConnection, fieldConfig, newValue, selectedProvider = null) {
    let updateQuery;
    let queryParams;
    
    const fieldMapping = {
        'Serie': 'Serie_Factura',
        'Numero': 'Numero_Factura', 
        'MontoFactura': 'Monto_Factura',
        'FechaFactura': 'Fecha_Factura',
        'IdRazon': 'IdRazonSocial_Factura',
        'NIT': 'IdProveedor_Factura' // NUEVO: Mapear NIT a IdProveedor_Factura
    };
    
    const ordenField = fieldMapping[fieldConfig.fieldName];
    
    if (!ordenField) {
        return;
    }
    
    if (fieldConfig.fieldName === 'IdRazon') {
        // Código existente para razón social
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        const razonQuery = `SELECT NombreRazon FROM razonessociales WHERE Id = ?`;
        const razonResult = await connection.query(razonQuery, [newValue]);
        await connection.close();
        
        if (razonResult.length === 0) {
            throw new Error('Razón social no encontrada para actualizar ordenescompra_factura sucursal');
        }
        
        const nombreRazon = razonResult[0].NombreRazon;
        updateQuery = `
            UPDATE ordenescompra_factura 
            SET IdRazonSocial_Factura = ?, RazonSocial_Factura = ?
            WHERE IdInventario = ?
        `;
        queryParams = [newValue, nombreRazon, window.currentInvoice.IdInventory];
        
    } else if (fieldConfig.fieldName === 'NIT') {
        // NUEVO: Para cambio de proveedor
        if (!selectedProvider) {
            throw new Error('No se proporcionó información del proveedor para actualizar ordenescompra_factura sucursal');
        }
        
        updateQuery = `
            UPDATE ordenescompra_factura 
            SET IdProveedor_Factura = ?, NITProveedor_Factura = ?, NombreProveedor_Factura = ?
            WHERE IdInventario = ?
        `;
        queryParams = [selectedProvider.Id, selectedProvider.NIT, selectedProvider.Nombre, window.currentInvoice.IdInventory];
        
    } else {
        // Para otros campos
        updateQuery = `
            UPDATE ordenescompra_factura 
            SET ${ordenField} = ? 
            WHERE IdInventario = ?
        `;
        queryParams = [newValue, window.currentInvoice.IdInventory];
    }
    
    const [result] = await branchConnection.execute(updateQuery, queryParams);
    
    if (result.affectedRows === 0) {

    } else {

    }
}

async function updateBranchFacturasCompras(branchConnection, fieldConfig, newValue, selectedProvider = null) {
    let updateQuery;
    let queryParams;
    
    const fieldMapping = {
        'Serie': 'Serie',
        'Numero': 'Numero', 
        'MontoFactura': 'MontoFactura',
        'FechaFactura': 'FechaFactura',
        'IdRazon': 'IdRazon',
        'NIT': 'IdProveedor' // NUEVO: Mapear NIT a IdProveedor
    };
    
    const branchField = fieldMapping[fieldConfig.fieldName];
    
    if (!branchField) {
        return;
    }
    
    if (fieldConfig.fieldName === 'IdRazon') {
        // Código existente para razón social
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        const razonQuery = `SELECT NombreRazon FROM razonessociales WHERE Id = ?`;
        const razonResult = await connection.query(razonQuery, [newValue]);
        await connection.close();
        
        if (razonResult.length === 0) {
            throw new Error('Razón social no encontrada para actualizar facturas_compras sucursal');
        }
        
        const nombreRazon = razonResult[0].NombreRazon;
        updateQuery = `
            UPDATE facturas_compras 
            SET IdRazon = ?, NombreRazon = ?
            WHERE IdInventarios = ?
        `;
        queryParams = [newValue, nombreRazon, window.currentInvoice.IdInventory];
        
    } else if (fieldConfig.fieldName === 'NIT') {
        // NUEVO: Para cambio de proveedor
        if (!selectedProvider) {
            throw new Error('No se proporcionó información del proveedor para actualizar facturas_compras sucursal');
        }
        
        updateQuery = `
            UPDATE facturas_compras 
            SET IdProveedor = ?, NombreProveedor = ?
            WHERE IdInventarios = ?
        `;
        queryParams = [selectedProvider.Id, selectedProvider.Nombre, window.currentInvoice.IdInventory];
        
    } else {
        // Para otros campos
        updateQuery = `
            UPDATE facturas_compras 
            SET ${branchField} = ? 
            WHERE IdInventarios = ?
        `;
        queryParams = [newValue, window.currentInvoice.IdInventory];
    }
    
    const [result] = await branchConnection.execute(updateQuery, queryParams);
    
    if (result.affectedRows === 0) {

    } else {

    }
}

// Función para actualizar campo específico en tabla inventarios de sucursal
async function updateInventoryField(branchConnection, fieldConfig, newValue, selectedProvider = null) {
    let updateQuery;
    let queryParams;
    
    const fieldMapping = {
        'Serie': 'Serie',
        'Numero': 'Numero', 
        'FechaFactura': 'FechaFactura',
        'IdRazon': 'IdRazon',
        'MontoFactura': null,
        'NIT': 'IdProveedores' // NUEVO: Mapear NIT a IdProveedores
    };
    
    const inventoryField = fieldMapping[fieldConfig.fieldName];
    
    if (inventoryField === null) {
        return;
    }
    
    if (fieldConfig.fieldName === 'IdRazon') {
        // Código existente para razón social
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        const razonQuery = `SELECT NombreRazon FROM razonessociales WHERE Id = ?`;
        const razonResult = await connection.query(razonQuery, [newValue]);
        await connection.close();
        
        if (razonResult.length === 0) {
            throw new Error('Razón social no encontrada para actualizar inventarios sucursal');
        }
        
        const nombreRazon = razonResult[0].NombreRazon;
        updateQuery = `
            UPDATE inventarios 
            SET IdRazon = ?, NombreRazon = ?
            WHERE IdInventarios = ?
        `;
        queryParams = [newValue, nombreRazon, window.currentInvoice.IdInventory];
        
    } else if (fieldConfig.fieldName === 'NIT') {
        // NUEVO: Para cambio de proveedor
        if (!selectedProvider) {
            throw new Error('No se proporcionó información del proveedor para actualizar inventarios sucursal');
        }
        
        updateQuery = `
            UPDATE inventarios 
            SET IdProveedores = ?, Proveedor = ?
            WHERE IdInventarios = ?
        `;
        queryParams = [selectedProvider.Id, selectedProvider.Nombre, window.currentInvoice.IdInventory];
        
    } else {
        // Para otros campos
        updateQuery = `
            UPDATE inventarios 
            SET ${inventoryField} = ? 
            WHERE IdInventarios = ?
        `;
        queryParams = [newValue, window.currentInvoice.IdInventory];
    }
    
    const [result] = await branchConnection.execute(updateQuery, queryParams);
    
    if (result.affectedRows === 0) {

    } else {

    }
}

// Actualizar campo en la tabla facturas_compras
async function updateInvoiceField(connection, fieldConfig, newValue, selectedProvider = null) {
    let updateQuery;
    let queryParams;
    
    if (fieldConfig.fieldName === 'IdRazon') {
        // Para razón social (código existente)
        const razonQuery = `SELECT NombreRazon FROM razonessociales WHERE Id = ?`;
        const razonResult = await connection.query(razonQuery, [newValue]);
        
        if (razonResult.length === 0) {
            throw new Error('Razón social no encontrada');
        }
        
        const nombreRazon = razonResult[0].NombreRazon;
        updateQuery = `
            UPDATE facturas_compras 
            SET IdRazon = ?, NombreRazon = ?
            WHERE Id = ?
        `;
        queryParams = [newValue, nombreRazon, window.currentInvoice.Id];
        
    } else if (fieldConfig.fieldName === 'NIT') {
        // NUEVO: Para cambio de proveedor
        if (!selectedProvider) {
            throw new Error('No se proporcionó información del proveedor seleccionado');
        }
        
        updateQuery = `
            UPDATE facturas_compras 
            SET IdProveedor = ?, NombreProveedor = ?, NIT = ?
            WHERE Id = ?
        `;
        queryParams = [selectedProvider.Id, selectedProvider.Nombre, selectedProvider.NIT, window.currentInvoice.Id];
        
    } else {
        // Para otros campos (código existente)
        updateQuery = `
            UPDATE facturas_compras 
            SET ${fieldConfig.fieldName} = ? 
            WHERE Id = ?
        `;
        queryParams = [newValue, window.currentInvoice.Id];
    }
    
    await connection.query(updateQuery, queryParams);
}

// Registrar cambio en historial
async function logFieldChange(connection, fieldConfig, oldValue, newValue, selectedProvider = null) {
    const userId = localStorage.getItem('userId') || '0';
    const userName = localStorage.getItem('userName') || 'Usuario Desconocido';
    
    let valorAnterior = oldValue.toString();
    let valorNuevo = newValue.toString();
    
    // NUEVO: Para cambios de proveedor, registrar información más detallada
    if (fieldConfig.fieldName === 'NIT' && selectedProvider) {
        const currentProvider = `${window.currentInvoice.Nombre} (${formatNIT(window.currentInvoice.NIT)})`;
        const newProvider = `${selectedProvider.Nombre} (${formatNIT(selectedProvider.NIT)})`;
        
        valorAnterior = currentProvider;
        valorNuevo = newProvider;
    }
    
    // NUEVO: Para cambios de razón social, guardar NOMBRES en lugar de IDs
    if (fieldConfig.fieldName === 'IdRazon') {
        try {
            // Obtener nombre de la razón social anterior
            const oldRazonName = window.currentInvoice.NombreRazon || 'No disponible';
            
            // Obtener nombre de la nueva razón social
            const newRazonQuery = `
                SELECT NombreRazon 
                FROM razonessociales 
                WHERE Id = ?
            `;
            
            const newRazonResult = await connection.query(newRazonQuery, [newValue]);
            const newRazonName = newRazonResult.length > 0 ? newRazonResult[0].NombreRazon : 'No encontrada';
            
            valorAnterior = oldRazonName;
            valorNuevo = newRazonName;
            
        } catch (error) {
            valorAnterior = `ID: ${oldValue}`;
            valorNuevo = `ID: ${newValue}`;
        }
    }
    
    const insertQuery = `
        INSERT INTO CambiosFacturasHistorial (
            IdTipoCambio,
            TipoCambio,
            ValorAnterior,
            ValorNuevo,
            IdInventario,
            IdSucursal,
            Sucursal,
            IdFacturasCompras,
            IdUsuario,
            NombreUsuario
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
        const result = await connection.query(insertQuery, [
            fieldConfig.tipoCambio,
            getFieldDisplayName(fieldConfig.tipoCambio),
            valorAnterior,
            valorNuevo,
            window.currentInvoice.IdInventory || '',
            window.currentInvoice.IdSucursalCori || 0,
            window.currentInvoice.NombreSucursal || '',
            window.currentInvoice.Id,
            parseInt(userId),
            userName
        ]);
        return result;
        
    } catch (error) {
        throw error;
    }
}

// Actualizar objeto currentInvoice
function updateCurrentInvoiceObject(fieldConfig, newValue, newDisplayValue, selectedProvider = null) {
   switch (fieldConfig.fieldName) {
       case 'Serie':
           window.currentInvoice.Serie = newValue;
           break;
       case 'Numero':
           window.currentInvoice.Numero = newValue;
           break;
       case 'IdRazon':
           window.currentInvoice.IdRazon = newValue;
           window.currentInvoice.NombreRazon = newDisplayValue;
           break;
       case 'MontoFactura':
           window.currentInvoice.MontoFactura = newValue;
           break;
       case 'FechaFactura':
           window.currentInvoice.FechaFactura = newValue;
           break;
       // NUEVO: Actualizar información del proveedor
       case 'NIT':
           if (selectedProvider) {
               window.currentInvoice.NIT = selectedProvider.NIT;
               window.currentInvoice.Nombre = selectedProvider.Nombre;
               window.currentInvoice.IdProveedor = selectedProvider.Id;
               
               // Actualizar también la UI del proveedor
               const providerNameElement = document.getElementById('providerName');
               if (providerNameElement) {
                   providerNameElement.textContent = selectedProvider.Nombre;
               }
           }
           break;
   }
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

// Mostrar panel de no encontrado
function showNotFoundPanel() {
    resultsPanel.style.display = 'none';
    
    // Ocultar el panel de búsqueda
    hideSearchPanel();
    
    // Mostrar panel de no encontrado después de ocultar la búsqueda
    setTimeout(() => {
        notFoundPanel.style.display = 'block';
        notFoundPanel.style.opacity = '0';
        notFoundPanel.style.transform = 'translateY(30px)';
        
        setTimeout(() => {
            notFoundPanel.style.opacity = '1';
            notFoundPanel.style.transform = 'translateY(0)';
            notFoundPanel.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
            
            // Hacer scroll hacia el panel
            notFoundPanel.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 100);
    }, 300);

    showWarningToast('No se encontró ninguna factura con los criterios especificados');
}

// Resetear búsqueda
function resetSearch() {
    // Obtener elementos de forma segura
    const serieElement = document.getElementById('searchSerie');
    const numberElement = document.getElementById('searchNumber');
    
    // Limpiar formulario
    if (serieElement) serieElement.value = '';
    if (numberElement) numberElement.value = '';
    
    // Ocultar paneles de resultados
    hideAllResultPanels();
    
    // Mostrar el panel de búsqueda con animación
    showSearchPanel();
    
    // Limpiar datos guardados
    window.currentInvoice = null;
    isEditing = false;
    currentEditingElement = null;
}

// Ocultar panel de búsqueda con animación
function hideSearchPanel() {
    const searchPanel = document.querySelector('.search-panel');
    
    searchPanel.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    searchPanel.style.opacity = '0';
    searchPanel.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
        searchPanel.style.display = 'none';
    }, 300);
}

// Mostrar panel de búsqueda con animación
function showSearchPanel() {
    const searchPanel = document.querySelector('.search-panel');
    
    searchPanel.style.display = 'block';
    searchPanel.style.opacity = '0';
    searchPanel.style.transform = 'translateY(-20px)';
    
    setTimeout(() => {
        searchPanel.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        searchPanel.style.opacity = '1';
        searchPanel.style.transform = 'translateY(0)';
        
        // Enfocar el input después de mostrar el panel
        setTimeout(() => {
            const serieElement = document.getElementById('searchSerie');
            if (serieElement) {
                serieElement.focus();
            }
        }, 100);
        
        // Hacer scroll hacia el panel de búsqueda
        setTimeout(() => {
            searchPanel.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 200);
    }, 50);
}

// Manejar agregar nota de crédito
async function handleAddCreditNote() {
    if (!window.currentInvoice) {
        showErrorToast('No hay una factura seleccionada');
        return;
    }

    try {
        // Cargar tipos de nota de crédito
        await loadCreditNoteTypes();
        
        // Llenar información de la factura original
        fillOriginalInvoiceInfo();
        
        // Mostrar el modal
        showCreditNoteModal();
        
    } catch (error) {
        handleCreditNoteError(error);
    }
}

// Cargar tipos de nota de crédito
async function loadCreditNoteTypes() {
    try {
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        const query = `
            SELECT
                TiposNotaCredito.IdTipoNotasCredito, 
                TiposNotaCredito.TipoNotaCredito
            FROM TiposNotaCredito
            ORDER BY TiposNotaCredito.TipoNotaCredito
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        // Llenar el select
        const creditNoteTypeSelect = document.getElementById('creditNoteType');
        creditNoteTypeSelect.innerHTML = '<option value="">Seleccione un tipo...</option>';
        
        result.forEach(type => {
            const option = document.createElement('option');
            option.value = type.IdTipoNotasCredito;
            option.textContent = type.TipoNotaCredito;
            creditNoteTypeSelect.appendChild(option);
        });
        
    } catch (error) {
        throw error;
    }
}

// Llenar información de la factura original
function fillOriginalInvoiceInfo() {
    const invoice = window.currentInvoice;
    
    document.getElementById('originalInvoiceNumber').textContent = 
        `${invoice.Serie || ''}-${invoice.Numero || ''}`;
    document.getElementById('originalInvoiceAmount').textContent = 
        formatCurrency(invoice.MontoFactura);
    document.getElementById('originalProvider').textContent = 
        invoice.Nombre || 'No disponible';
}

// Mostrar modal de nota de crédito
function showCreditNoteModal() {
    creditNoteModal.style.display = 'flex';
    
    // Añadir clase para animación
    setTimeout(() => {
        creditNoteModal.classList.add('show');
    }, 10);
    
    // Enfocar el primer campo
    setTimeout(() => {
        document.getElementById('creditNoteType').focus();
    }, 300);
}

// Cerrar modal de nota de crédito
function closeCreditNoteModalFunc() {
    creditNoteModal.classList.remove('show');
    
    setTimeout(() => {
        creditNoteModal.style.display = 'none';
        clearCreditNoteForm();
    }, 300);
}

// Limpiar formulario de nota de crédito
function clearCreditNoteForm() {
    creditNoteForm.reset();
    
    // Remover selección de conceptos
    merchandiseBtn.classList.remove('selected');
    otherConceptsBtn.classList.remove('selected');
    
    // Limpiar variable de concepto seleccionado
    window.selectedConcept = null;
}

// Seleccionar tipo de concepto
function selectConceptType(conceptType) {
    // Remover selección anterior
    merchandiseBtn.classList.remove('selected');
    otherConceptsBtn.classList.remove('selected');
    
    // Seleccionar el concepto actual
    if (conceptType === 'mercaderia') {
        merchandiseBtn.classList.add('selected');
    } else if (conceptType === 'otros') {
        otherConceptsBtn.classList.add('selected');
    }
    
    // Guardar el concepto seleccionado
    window.selectedConcept = conceptType;
}

// Manejar envío del formulario de nota de crédito
async function handleCreditNoteSubmit(e) {
    e.preventDefault();
    if (!window.selectedConcept) {
        showErrorToast('Debe seleccionar un tipo de concepto (Mercadería u Otros conceptos)');
        return;
    }
    const formData = getCreditNoteFormData();
    const isValid = await validateCreditNoteData(formData);
    if (!isValid) {
        return; // No continuar si hay errores o duplicados
    }
    confirmCreditNoteCreation(formData);
}

// Obtener datos del formulario
function getCreditNoteFormData() {
    return {
        typeId: document.getElementById('creditNoteType').value,
        typeName: document.getElementById('creditNoteType').selectedOptions[0]?.text || '',
        amount: parseFloat(document.getElementById('creditNoteAmount').value),
        serie: document.getElementById('creditNoteSerie').value.trim(),
        number: document.getElementById('creditNoteNumber').value.trim(),
        date: document.getElementById('creditNoteDate').value,
        conceptType: window.selectedConcept,
        originalInvoice: window.currentInvoice
    };
}

// Validar datos de la nota de crédito
async function validateCreditNoteData(data) {
    // Validaciones básicas existentes
    if (!data.typeId) {
        showErrorToast('Debe seleccionar un tipo de nota de crédito');
        document.getElementById('creditNoteType').focus();
        return false;
    }
    
    if (!data.amount || data.amount <= 0) {
        showErrorToast('El monto debe ser mayor a 0');
        document.getElementById('creditNoteAmount').focus();
        return false;
    }
    
    if (data.amount > data.originalInvoice.MontoFactura) {
        showErrorToast('El monto de la nota de crédito no puede ser mayor al monto de la factura original');
        document.getElementById('creditNoteAmount').focus();
        return false;
    }
    
    if (!data.serie) {
        showErrorToast('Debe ingresar la serie de la nota');
        document.getElementById('creditNoteSerie').focus();
        return false;
    }
    
    if (!data.number) {
        showErrorToast('Debe ingresar el número de la nota');
        document.getElementById('creditNoteNumber').focus();
        return false;
    }
    
    if (!data.date) {
        showErrorToast('⚠️ Debe seleccionar la fecha de la nota de crédito');
        document.getElementById('creditNoteDate').focus();
        
        // Opcional: Resaltar visualmente el campo
        const dateField = document.getElementById('creditNoteDate');
        dateField.style.borderColor = '#ff5e6d';
        dateField.style.boxShadow = '0 0 0 3px rgba(255, 94, 109, 0.2)';
        
        // Remover resaltado después de que el usuario interactúe
        dateField.addEventListener('input', function() {
            this.style.borderColor = '';
            this.style.boxShadow = '';
        }, { once: true });
        
        return false;
    }
    
    // Validar que la fecha no sea futura
    const selectedDate = new Date(data.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (selectedDate > today) {
        showErrorToast('La fecha de la nota no puede ser futura');
        document.getElementById('creditNoteDate').focus();
        return false;
    }
    
    // *** VERIFICAR DUPLICIDAD ***
    try {
        // Mostrar loading durante validación CON Z-INDEX ALTO
        Swal.fire({
            title: 'Validando...',
            text: 'Verificando que la nota de crédito no exista',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            // *** AGREGAR CONFIGURACIÓN DE Z-INDEX ***
            customClass: {
                container: 'swal2-container-front'
            },
            didOpen: () => {
                Swal.showLoading();
                // Forzar z-index específicamente
                const swalContainer = document.querySelector('.swal2-container');
                if (swalContainer) {
                    swalContainer.style.zIndex = '99999';
                    swalContainer.style.position = 'fixed';
                }
            }
        });
        
        const existingNote = await validateCreditNoteExists(
            data.serie, 
            data.number, 
            data.originalInvoice.Id
        );
        
        // Cerrar loading
        Swal.close();
        
        if (existingNote) {
            // *** MOSTRAR ERROR CON Z-INDEX MÁXIMO ***
            await Swal.fire({
                icon: 'error',
                title: 'Nota de Crédito Duplicada',
                html: `
                    <div style="text-align: left; margin: 20px 0;">
                        <p><strong>⚠️ Ya existe una nota de crédito con estos datos:</strong></p>
                        <hr style="margin: 15px 0;">
                        <p><strong>Serie-Número:</strong> ${existingNote.Serie}-${existingNote.Numero}</p>
                        <p><strong>Factura:</strong> ${data.originalInvoice.Serie}-${data.originalInvoice.Numero}</p>
                        <p><strong>Proveedor:</strong> ${existingNote.Proveedor}</p>
                        <p><strong>Monto:</strong> ${formatCurrency(existingNote.Monto)}</p>
                        <p><strong>Fecha:</strong> ${formatDate(existingNote.FechaNotaCredito)}</p>
                        <hr style="margin: 15px 0;">
                        <p style="color: #ff5e6d; font-weight: 600;">
                            <i class="fas fa-exclamation-circle"></i> 
                            Por favor cambie la serie o número de la nota de crédito
                        </p>
                    </div>
                `,
                confirmButtonColor: '#6e78ff',
                confirmButtonText: 'Entendido',
                // *** CONFIGURACIÓN DE Z-INDEX CRÍTICA ***
                customClass: {
                    container: 'swal2-validation-error'
                },
                backdrop: true,
                allowOutsideClick: false,
                didOpen: () => {
                    // Forzar z-index máximo
                    const swalContainer = document.querySelector('.swal2-container');
                    const swalPopup = document.querySelector('.swal2-popup');
                    
                    if (swalContainer) {
                        swalContainer.style.zIndex = '999999';
                        swalContainer.style.position = 'fixed';
                        swalContainer.style.top = '0';
                        swalContainer.style.left = '0';
                        swalContainer.style.width = '100%';
                        swalContainer.style.height = '100%';
                    }
                    
                    if (swalPopup) {
                        swalPopup.style.zIndex = '1000000';
                        swalPopup.style.position = 'relative';
                    }
                },
                willClose: () => {
                    // Limpiar estilos después de cerrar
                    const swalContainer = document.querySelector('.swal2-container');
                    if (swalContainer) {
                        swalContainer.style.zIndex = '';
                        swalContainer.style.position = '';
                    }
                }
            });
            
            // Enfocar el campo de serie para que lo cambien
            document.getElementById('creditNoteSerie').focus();
            document.getElementById('creditNoteSerie').select();
            
            return false; // No continuar
        }
        
        // Si llegamos aquí, no hay duplicados
        return true;
        
    } catch (error) {
        // Cerrar loading si hay error
        Swal.close();
        
        // *** MOSTRAR ERROR CON Z-INDEX ALTO ***
        await Swal.fire({
            icon: 'error',
            title: 'Error de Validación',
            text: 'Error al validar la nota de crédito. Intente nuevamente.',
            confirmButtonColor: '#6e78ff',
            customClass: {
                container: 'swal2-validation-error'
            },
            didOpen: () => {
                const swalContainer = document.querySelector('.swal2-container');
                if (swalContainer) {
                    swalContainer.style.zIndex = '999999';
                }
            }
        });
        
        return false;
    }
}
// Confirmar creación de nota de crédito
function confirmCreditNoteCreation(data) {
    const conceptText = data.conceptType === 'mercaderia' ? 'Mercadería' : 'Otros Conceptos';
    
    // Cerrar el modal de nota de crédito ANTES de mostrar la confirmación
    closeCreditNoteModalFunc();
    
    // Pequeña pausa para que termine la animación de cierre
    setTimeout(() => {
        Swal.fire({
            title: '¿Confirmar Nota de Crédito?',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>Tipo:</strong> ${data.typeName}</p>
                    <p><strong>Serie-Número:</strong> ${data.serie}-${data.number}</p>
                    <p><strong>Monto:</strong> ${formatCurrency(data.amount)}</p>
                    <p><strong>Fecha:</strong> ${formatDate(data.date)}</p>
                    <p><strong>Concepto:</strong> ${conceptText}</p>
                    <hr style="margin: 15px 0;">
                    <p><strong>Factura Original:</strong> ${data.originalInvoice.Serie}-${data.originalInvoice.Numero}</p>
                    <hr style="margin: 15px 0;">
                    <p style="color: #4caf50; font-weight: 600;">
                        <i class="fas fa-check-circle"></i> 
                        ✅ Validación exitosa: No hay duplicados
                    </p>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4caf50',
            cancelButtonColor: '#ff5e6d',
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Cancelar',
            customClass: {
                popup: 'credit-note-confirmation',
                container: 'swal2-container-front'
            }
        }).then((result) => {
            if (result.isConfirmed) {
                // Proceder según el tipo de concepto seleccionado
                if (data.conceptType === 'mercaderia') {
                    proceedWithMerchandiseWithLoading(data);
                } else {
                    proceedWithOtherConcepts(data);
                }
            } else {
                // Si cancela, volver a mostrar el modal de nota de crédito
                setTimeout(() => {
                    showCreditNoteModal();
                    // Restaurar los datos del formulario
                    restoreCreditNoteFormData(data);
                }, 100);
            }
        });
    }, 350);
}

// Proceder con mercadería con loading
async function proceedWithMerchandiseWithLoading(data) {
    // Guardar datos de la nota de crédito
    window.currentCreditNote = data;
    
    // Mostrar loading
    Swal.fire({
        title: 'Cargando productos...',
        html: `
            <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
                <div class="loading-spinner"></div>
                <p>Conectando a la base de datos de la sucursal</p>
                <p style="font-size: 14px; color: #6c757d;">Por favor espere...</p>
            </div>
        `,
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        },
        customClass: {
            popup: 'loading-popup'
        }
    });
    
    try {
        // Verificar que tenemos los datos de conexión y el IdInventory
        if (!window.branchConnectionData) {
            throw new Error('No se encontraron los datos de conexión de la sucursal');
        }
        
        if (!data.originalInvoice.IdInventory) {
            throw new Error('No se encontró el ID de inventario en la factura');
        }
        
        // Cargar productos del inventario
        await loadInventoryProducts();
        
        // Cerrar el loading
        Swal.close();
        
        // Pequeña pausa antes de mostrar el modal de productos
        setTimeout(() => {
            // Crear y mostrar el modal de mercadería
            createMerchandiseModal();
        }, 200);
        
    } catch (error) {
        
        // Cerrar loading y mostrar error
        Swal.close();
        
        setTimeout(() => {
            Swal.fire({
                icon: 'error',
                title: 'Error al cargar productos',
                text: error.message,
                confirmButtonColor: '#6e78ff',
                confirmButtonText: 'Entendido'
            });
        }, 100);
    }
}

// Restaurar datos del formulario de nota de crédito
function restoreCreditNoteFormData(data) {
    // Restaurar valores del formulario
    document.getElementById('creditNoteType').value = data.typeId;
    document.getElementById('creditNoteAmount').value = data.amount;
    document.getElementById('creditNoteSerie').value = data.serie;
    document.getElementById('creditNoteNumber').value = data.number;
    document.getElementById('creditNoteDate').value = data.date;
    
    // Restaurar selección de concepto
    if (data.conceptType === 'mercaderia') {
        merchandiseBtn.classList.add('selected');
        window.selectedConcept = 'mercaderia';
    } else if (data.conceptType === 'otros') {
        otherConceptsBtn.classList.add('selected');
        window.selectedConcept = 'otros';
    }
}

// Proceder con otros conceptos
function proceedWithOtherConcepts(data) {
    // Guardar datos de la nota de crédito
    window.currentCreditNote = data;
    
    // Mostrar modal de otros conceptos
    showOtherConceptsModal();
}

// Mostrar modal de otros conceptos
function showOtherConceptsModal() {
    // Crear y mostrar el modal
    createOtherConceptsModal();
}

// Crear modal de otros conceptos
function createOtherConceptsModal() {
    // Verificar si ya existe el modal
    let existingModal = document.getElementById('otherConceptsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHTML = `
        <div class="modal-overlay" id="otherConceptsModal">
            <div class="modal-container other-concepts-modal">
                <div class="modal-header">
                    <div class="modal-icon">
                        <i class="fas fa-receipt"></i>
                    </div>
                    <div class="modal-title">
                        <h2>Otros Conceptos</h2>
                        <p>Nota de crédito para la factura ${window.currentCreditNote.originalInvoice.Serie}-${window.currentCreditNote.originalInvoice.Numero}</p>
                    </div>
                    <button class="modal-close" id="closeOtherConceptsModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-content">
                    <!-- Información de la nota de crédito -->
                    <div class="credit-note-summary">
                        <h3><i class="fas fa-file-invoice"></i> Resumen de la Nota de Crédito</h3>
                        <div class="summary-details">
                            <div class="summary-item">
                                <span class="summary-label">Tipo:</span>
                                <span class="summary-value">${window.currentCreditNote.typeName}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Serie-Número:</span>
                                <span class="summary-value">${window.currentCreditNote.serie}-${window.currentCreditNote.number}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Monto:</span>
                                <span class="summary-value amount">${formatCurrency(window.currentCreditNote.amount)}</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Fecha:</span>
                                <span class="summary-value">${formatDate(window.currentCreditNote.date)}</span>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Formulario de observación -->
                    <form id="otherConceptsForm" class="other-concepts-form">
                        <div class="observation-section">
                            <h3><i class="fas fa-comment-alt"></i> Observación</h3>
                            <p class="observation-description">
                                Ingrese la razón o motivo por el cual se está emitiendo esta nota de crédito:
                            </p>
                            
                            <div class="observation-input-group">
                                <label for="observationText">Motivo de la nota de crédito</label>
                                <textarea 
                                    id="observationText" 
                                    class="observation-textarea" 
                                    rows="6"
                                    maxlength="500"
                                    placeholder="Ej: Descuento por volumen, Ajuste de precio, Error en facturación, Devolución de productos defectuosos, etc."
                                    required></textarea>
                                <div class="character-counter">
                                    <span id="charCount">0</span>/500 caracteres
                                </div>
                            </div>
                        </div>
                        
                        <!-- Botones de acción -->
                        <div class="modal-actions">
                            <button type="button" class="btn-secondary" id="cancelOtherConcepts">
                                <i class="fas fa-times"></i>
                                Cancelar
                            </button>
                            <button type="submit" class="btn-primary" id="saveOtherConcepts">
                                <i class="fas fa-save"></i>
                                Guardar Nota de Crédito
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Obtener referencias a elementos
    const otherConceptsModal = document.getElementById('otherConceptsModal');
    const closeOtherConceptsModal = document.getElementById('closeOtherConceptsModal');
    const observationText = document.getElementById('observationText');
    const charCount = document.getElementById('charCount');
    const otherConceptsForm = document.getElementById('otherConceptsForm');
    
    // Event listeners
    closeOtherConceptsModal.addEventListener('click', closeOtherConceptsModalFunc);
    document.getElementById('cancelOtherConcepts').addEventListener('click', closeOtherConceptsModalFunc);
    document.getElementById('saveOtherConcepts').addEventListener('click', saveOtherConceptsNote);
    otherConceptsForm.addEventListener('submit', handleOtherConceptsSubmit);
    
    // Contador de caracteres
    observationText.addEventListener('input', updateCharacterCount);
    
    // Cerrar modal al hacer clic fuera
    otherConceptsModal.addEventListener('click', (e) => {
        if (e.target === otherConceptsModal) {
            closeOtherConceptsModalFunc();
        }
    });
    
    // Mostrar modal con animación
    otherConceptsModal.style.display = 'flex';
    setTimeout(() => {
        otherConceptsModal.classList.add('show');
    }, 10);
    
    // Enfocar textarea
    setTimeout(() => {
        observationText.focus();
    }, 300);
}

// Cerrar modal de otros conceptos
function closeOtherConceptsModalFunc() {
    const otherConceptsModal = document.getElementById('otherConceptsModal');
    if (otherConceptsModal) {
        otherConceptsModal.classList.remove('show');
        
        setTimeout(() => {
            otherConceptsModal.remove();
        }, 300);
    }
}

// Actualizar contador de caracteres
function updateCharacterCount() {
    const observationText = document.getElementById('observationText');
    const charCount = document.getElementById('charCount');
    
    if (observationText && charCount) {
        const currentLength = observationText.value.length;
        charCount.textContent = currentLength;
        
        // Cambiar color si se acerca al límite
        const counter = charCount.parentElement;
        if (currentLength > 450) {
            counter.style.color = 'var(--error-color)';
        } else if (currentLength > 400) {
            counter.style.color = 'var(--warning-color)';
        } else {
            counter.style.color = 'var(--text-secondary)';
        }
    }
}

// Manejar envío del formulario de otros conceptos
function handleOtherConceptsSubmit(e) {
    e.preventDefault();
    saveOtherConceptsNote();
}

// Guardar nota de otros conceptos
function saveOtherConceptsNote() {
    const observationText = document.getElementById('observationText');
    const observation = observationText.value.trim();
    
    if (!observation) {
        showErrorToast('Debe ingresar una observación para la nota de crédito');
        observationText.focus();
        return;
    }
    
    if (observation.length < 10) {
        showErrorToast('La observación debe tener al menos 10 caracteres');
        observationText.focus();
        return;
    }
    
    // Mostrar confirmación
    Swal.fire({
        title: '¿Guardar Nota de Crédito?',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>Tipo:</strong> ${window.currentCreditNote.typeName}</p>
                <p><strong>Serie-Número:</strong> ${window.currentCreditNote.serie}-${window.currentCreditNote.number}</p>
                <p><strong>Monto:</strong> ${formatCurrency(window.currentCreditNote.amount)}</p>
                <p><strong>Concepto:</strong> Otros Conceptos</p>
                <hr style="margin: 15px 0;">
                <p><strong>Observación:</strong></p>
                <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-style: italic; max-height: 100px; overflow-y: auto;">
                    "${observation}"
                </div>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4caf50',
        cancelButtonColor: '#ff5e6d',
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar'
    }).then(async (result) => {
        if (result.isConfirmed) {
            // Cerrar modal
            closeOtherConceptsModalFunc();
            
            // Mostrar loading
            Swal.fire({
                title: 'Guardando...',
                text: 'Por favor espere mientras se guarda la nota de crédito.',
                allowOutsideClick: false,
                allowEscapeKey: false,
                showConfirmButton: false,
                didOpen: () => {
                    Swal.showLoading();
                }
            });
            
            // Guardar en base de datos
            const success = await saveOtherConceptsCreditNote(window.currentCreditNote, observation);
            
            // Cerrar loading
            Swal.close();
        }
    });
}

// Cargar productos del inventario usando MySQL2
async function loadInventoryProducts() {
    let connection = null;
    
    try {
        const connectionData = window.branchConnectionData;
        const inventoryId = window.currentCreditNote.originalInvoice.IdInventory;
        
        // Crear conexión MySQL2
        connection = await mysql.createConnection({
            host: connectionData.server,
            database: connectionData.database,
            user: connectionData.user,
            password: connectionData.password,
            port: 3306,
            connectTimeout: 10000
        });
        
        // Consultar productos
        const query = `
            SELECT
                detalleinventarios.Upc, 
                detalleinventarios.Descripcion, 
                detalleinventarios.Cantidad_Rechequeo, 
                detalleinventarios.Bonificacion_Rechequeo
            FROM detalleinventarios
            WHERE detalleinventarios.IdInventarios = ? AND
                  detalleinventarios.Detalle_Rechequeo = 0
            ORDER BY detalleinventarios.Descripcion
        `;
        
        const [rows] = await connection.execute(query, [inventoryId]);
        
        // Guardar productos para búsqueda
        window.inventoryProducts = rows;
        window.filteredProducts = rows;
        
        return rows;
        
    } catch (error) {
        throw new Error(`Error conectando a la base de datos de la sucursal: ${error.message}`);
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (closeError) {
            }
        }
    }
}

// ===== FUNCIONALIDAD F1 - AGREGAR PRODUCTOS ADICIONALES =====

// Agregar event listener para F1 cuando esté en el modal de mercadería
function setupF1ProductSearch() {
    document.addEventListener('keydown', handleF1KeyPress);
}

// Remover event listener cuando se cierre el modal
function removeF1ProductSearch() {
    document.removeEventListener('keydown', handleF1KeyPress);
}

// Manejar presión de tecla F1
function handleF1KeyPress(event) {
    // Solo funciona si estamos en el modal de mercadería
    const merchandiseModal = document.getElementById('merchandiseModal');
    if (!merchandiseModal || !merchandiseModal.classList.contains('show')) {
        return;
    }
    
    if (event.key === 'F1') {
        event.preventDefault();
        openAdditionalProductsModal();
    }
}

// Abrir modal de productos adicionales
async function openAdditionalProductsModal() {
    try {
        // Mostrar loading mientras se prepara el modal
        Swal.fire({
            title: 'Preparando búsqueda...',
            text: 'Cargando catálogo de productos',
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        // Crear el modal
        await createAdditionalProductsModal();
        
        // Cerrar loading
        Swal.close();
        
        // Mostrar el modal
        showAdditionalProductsModal();
        
    } catch (error) {
        Swal.close();
        showErrorToast('Error al cargar el catálogo de productos: ' + error.message);
    }
}

// Crear modal de productos adicionales
async function createAdditionalProductsModal() {
    // Verificar si ya existe el modal
    let existingModal = document.getElementById('additionalProductsModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHTML = `
        <div class="modal-overlay" id="additionalProductsModal">
            <div class="modal-container additional-products-modal">
                <div class="modal-header">
                    <div class="modal-icon">
                        <i class="fas fa-plus-circle"></i>
                    </div>
                    <div class="modal-title">
                        <h2>Agregar Productos Adicionales</h2>
                        <p>Buscar productos del catálogo para agregar a la nota de crédito</p>
                    </div>
                    <button class="modal-close" id="closeAdditionalProductsModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-content">
                    <!-- Información de ayuda -->
                    <div class="help-section">
                        <div class="help-icon">
                            <i class="fas fa-info-circle"></i>
                        </div>
                        <div class="help-text">
                            <p><strong>Presiona F1</strong> para abrir esta ventana desde el modal de mercadería</p>
                            <p>Busca productos por UPC o descripción y agrégalos a tu nota de crédito</p>
                        </div>
                    </div>
                    
                    <!-- Buscador de productos -->
                    <div class="additional-search-section">
                        <div class="search-input-group">
                            <div class="search-input-icon">
                                <i class="fas fa-search"></i>
                            </div>
                            <input type="text" id="additionalProductSearch" 
                                   placeholder="Buscar por UPC o descripción del producto..."
                                   autocomplete="off">
                            <div class="search-input-line"></div>
                        </div>
                        <div class="search-help">
                            <small>Escribe al menos 3 caracteres para iniciar la búsqueda</small>
                        </div>
                    </div>
                    
                    <!-- Lista de productos encontrados -->
                    <div class="additional-products-section">
                        <div class="additional-products-header">
                            <h3><i class="fas fa-list"></i> Resultados de Búsqueda</h3>
                            <div class="additional-products-count">
                                <span id="additionalProductsCount">0</span> productos encontrados
                            </div>
                        </div>
                        
                        <div class="additional-products-container" id="additionalProductsContainer">
                            <div class="no-search-yet">
                                <div class="no-search-icon">
                                    <i class="fas fa-search"></i>
                                </div>
                                <p>Escribe en el campo de búsqueda para encontrar productos</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Productos seleccionados para agregar -->
                    <div class="selected-additional-section" id="selectedAdditionalSection" style="display: none;">
                        <div class="selected-header">
                            <h3><i class="fas fa-cart-plus"></i> Productos Seleccionados</h3>
                            <div class="selected-count">
                                <span id="selectedAdditionalCount">0</span> productos
                            </div>
                        </div>
                        
                        <div class="selected-additional-container" id="selectedAdditionalContainer">
                            <!-- Los productos seleccionados aparecerán aquí -->
                        </div>
                    </div>
                    
                    <!-- Botones de acción -->
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" id="cancelAdditionalProducts">
                            <i class="fas fa-times"></i>
                            Cancelar
                        </button>
                        <button type="button" class="btn-primary" id="addSelectedProducts" disabled>
                            <i class="fas fa-plus"></i>
                            Agregar Productos (<span id="addButtonCount">0</span>)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Configurar event listeners
    setupAdditionalProductsEventListeners();
}

// Configurar event listeners del modal
function setupAdditionalProductsEventListeners() {
    const additionalProductSearch = document.getElementById('additionalProductSearch');
    const closeAdditionalProductsModal = document.getElementById('closeAdditionalProductsModal');
    const cancelAdditionalProducts = document.getElementById('cancelAdditionalProducts');
    const addSelectedProducts = document.getElementById('addSelectedProducts');
    const additionalProductsModal = document.getElementById('additionalProductsModal');
    
    // Event listeners
    closeAdditionalProductsModal.addEventListener('click', closeAdditionalProductsModalFunc);
    cancelAdditionalProducts.addEventListener('click', closeAdditionalProductsModalFunc);
    addSelectedProducts.addEventListener('click', confirmAddSelectedProducts);
    
    // Cerrar modal al hacer clic fuera
    additionalProductsModal.addEventListener('click', (e) => {
        if (e.target === additionalProductsModal) {
            closeAdditionalProductsModalFunc();
        }
    });
    
    // Búsqueda con debounce
    let searchTimeout;
    additionalProductSearch.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        const query = e.target.value.trim();
        
        if (query.length >= 3) {
            searchTimeout = setTimeout(() => {
                searchAdditionalProducts(query);
            }, 300); // Debounce de 300ms
        } else {
            showNoSearchYet();
        }
    });
    
    // Manejar Enter en búsqueda
    additionalProductSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const query = e.target.value.trim();
            if (query.length >= 3) {
                clearTimeout(searchTimeout);
                searchAdditionalProducts(query);
            }
        }
    });
    
    // Inicializar arrays para productos seleccionados
    window.selectedAdditionalProducts = [];
}

// Buscar productos adicionales en la base de datos
async function searchAdditionalProducts(query) {
    let connection = null;
    
    try {
        // Mostrar loading en el contenedor
        showAdditionalSearchLoading();
        
        // Conectar a la base de datos de la sucursal
        const connectionData = window.branchConnectionData;
        
        connection = await mysql.createConnection({
            host: connectionData.server,
            database: connectionData.database,
            user: connectionData.user,
            password: connectionData.password,
            port: 3306,
            connectTimeout: 10000
        });
        
        // Consultar productos
        const searchQuery = `
            SELECT
                productos.Upc,
                productos.DescLarga
            FROM productos
            WHERE (productos.Upc LIKE ? OR productos.DescLarga LIKE ?)
            ORDER BY productos.DescLarga
            LIMIT 50
        `;
        
        const searchPattern = `%${query}%`;
        const [rows] = await connection.execute(searchQuery, [searchPattern, searchPattern]);
        
        // Mostrar resultados
        displayAdditionalProducts(rows, query);
        
    } catch (error) {
        showAdditionalSearchError(error.message);
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (closeError) {
            }
        }
    }
}

// Mostrar loading durante búsqueda
function showAdditionalSearchLoading() {
    const container = document.getElementById('additionalProductsContainer');
    container.innerHTML = `
        <div class="additional-search-loading">
            <div class="loading-spinner"></div>
            <p>Buscando productos...</p>
        </div>
    `;
    document.getElementById('additionalProductsCount').textContent = '0';
}

// Mostrar estado inicial (sin búsqueda)
function showNoSearchYet() {
    const container = document.getElementById('additionalProductsContainer');
    container.innerHTML = `
        <div class="no-search-yet">
            <div class="no-search-icon">
                <i class="fas fa-search"></i>
            </div>
            <p>Escribe en el campo de búsqueda para encontrar productos</p>
        </div>
    `;
    document.getElementById('additionalProductsCount').textContent = '0';
}

// Mostrar error en búsqueda
function showAdditionalSearchError(errorMessage) {
    const container = document.getElementById('additionalProductsContainer');
    container.innerHTML = `
        <div class="additional-search-error">
            <div class="error-icon">
                <i class="fas fa-exclamation-triangle"></i>
            </div>
            <p>Error al buscar productos:</p>
            <p class="error-detail">${errorMessage}</p>
        </div>
    `;
    document.getElementById('additionalProductsCount').textContent = '0';
}

// Mostrar productos encontrados
function displayAdditionalProducts(products, query) {
    const container = document.getElementById('additionalProductsContainer');
    
    if (!products || products.length === 0) {
        container.innerHTML = `
            <div class="no-additional-products">
                <div class="no-products-icon">
                    <i class="fas fa-search-minus"></i>
                </div>
                <p>No se encontraron productos para: <strong>"${query}"</strong></p>
                <p class="search-suggestion">Intenta con otros términos de búsqueda</p>
            </div>
        `;
        document.getElementById('additionalProductsCount').textContent = '0';
        return;
    }
    
    const productsHTML = products.map((product, index) => `
        <div class="additional-product-item" data-upc="${product.Upc}">
            <div class="additional-product-info">
                <div class="additional-product-upc">
                    <i class="fas fa-barcode"></i>
                    <span>${product.Upc}</span>
                </div>
                <div class="additional-product-description">
                    <h4>${highlightSearchTerm(product.DescLarga, query)}</h4>
                </div>
            </div>
            <div class="additional-product-actions">
                <div class="additional-quantity-group">
                    <label for="additional_quantity_${index}">Cantidad:</label>
                    <input type="number" 
                           id="additional_quantity_${index}" 
                           class="additional-quantity-input" 
                           min="1" 
                           step="1" 
                           value="1"
                           data-upc="${product.Upc}">
                </div>
                <button type="button" class="select-additional-btn" 
                        onclick="selectAdditionalProduct('${product.Upc}', '${product.DescLarga.replace(/'/g, "\\'")}', ${index})">
                    <i class="fas fa-plus"></i>
                    Seleccionar
                </button>
            </div>
        </div>
    `).join('');
    
    container.innerHTML = productsHTML;
    document.getElementById('additionalProductsCount').textContent = products.length;
    
    // Agregar event listeners a los inputs de cantidad
    const quantityInputs = document.querySelectorAll('.additional-quantity-input');
    quantityInputs.forEach(input => {
        input.addEventListener('change', validateAdditionalQuantity);
    });
}

// Resaltar término de búsqueda
function highlightSearchTerm(text, term) {
    if (!term) return text;
    
    const regex = new RegExp(`(${term})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// Validar cantidad adicional
function validateAdditionalQuantity(event) {
    const input = event.target;
    const value = parseInt(input.value) || 1;
    
    if (value < 1) {
        input.value = 1;
    }
}

// Seleccionar producto adicional
function selectAdditionalProduct(upc, description, index) {
    const quantityInput = document.getElementById(`additional_quantity_${index}`);
    const quantity = parseInt(quantityInput.value) || 1;
    
    // Verificar si el producto ya está seleccionado
    const existingProduct = window.selectedAdditionalProducts.find(p => p.Upc === upc);
    
    if (existingProduct) {
        // Si ya existe, sumar la cantidad
        existingProduct.quantityToReturn += quantity;
        showInfoToast(`Cantidad actualizada para ${upc}: ${existingProduct.quantityToReturn}`);
    } else {
        // Agregar nuevo producto
        window.selectedAdditionalProducts.push({
            Upc: upc,
            Descripcion: description,
            quantityToReturn: quantity,
            isAdditional: true // Marcar como producto adicional
        });
        showSuccessToast(`Producto agregado: ${upc}`);
    }
    
    // Actualizar display de productos seleccionados
    updateSelectedAdditionalDisplay();
    
    // Limpiar cantidad y deshabilitar botón temporalmente
    quantityInput.value = 1;
    const button = quantityInput.closest('.additional-product-item').querySelector('.select-additional-btn');
    button.disabled = true;
    button.innerHTML = '<i class="fas fa-check"></i> Agregado';
    button.classList.add('selected');
    
    // Rehabilitar botón después de un momento
    setTimeout(() => {
        button.disabled = false;
        button.innerHTML = '<i class="fas fa-plus"></i> Seleccionar';
        button.classList.remove('selected');
    }, 2000);
}

// Actualizar display de productos seleccionados
function updateSelectedAdditionalDisplay() {
    const selectedSection = document.getElementById('selectedAdditionalSection');
    const selectedContainer = document.getElementById('selectedAdditionalContainer');
    const selectedCount = document.getElementById('selectedAdditionalCount');
    const addButtonCount = document.getElementById('addButtonCount');
    const addButton = document.getElementById('addSelectedProducts');
    
    const count = window.selectedAdditionalProducts.length;
    
    if (count === 0) {
        selectedSection.style.display = 'none';
        addButton.disabled = true;
    } else {
        selectedSection.style.display = 'block';
        addButton.disabled = false;
        
        // Generar HTML de productos seleccionados
        const selectedHTML = window.selectedAdditionalProducts.map((product, index) => `
            <div class="selected-additional-item">
                <div class="selected-product-info">
                    <div class="selected-product-upc">
                        <i class="fas fa-barcode"></i>
                        <span>${product.Upc}</span>
                    </div>
                    <div class="selected-product-description">
                        <span>${product.Descripcion}</span>
                    </div>
                    <div class="selected-product-quantity">
                        <strong>Cantidad: ${product.quantityToReturn}</strong>
                    </div>
                </div>
                <button type="button" class="remove-selected-btn" 
                        onclick="removeSelectedAdditionalProduct(${index})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `).join('');
        
        selectedContainer.innerHTML = selectedHTML;
    }
    
    selectedCount.textContent = count;
    addButtonCount.textContent = count;
}

// Remover producto seleccionado
function removeSelectedAdditionalProduct(index) {
    const product = window.selectedAdditionalProducts[index];
    window.selectedAdditionalProducts.splice(index, 1);
    updateSelectedAdditionalDisplay();
    showInfoToast(`Producto removido: ${product.Upc}`);
}

// Mostrar modal de productos adicionales
function showAdditionalProductsModal() {
    const modal = document.getElementById('additionalProductsModal');
    modal.style.display = 'flex';
    
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
    
    // Enfocar el campo de búsqueda
    setTimeout(() => {
        document.getElementById('additionalProductSearch').focus();
    }, 300);
}

// Cerrar modal de productos adicionales
function closeAdditionalProductsModalFunc() {
    const modal = document.getElementById('additionalProductsModal');
    if (modal) {
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.remove();
            // Limpiar variables
            window.selectedAdditionalProducts = [];
        }, 300);
    }
}

// Confirmar agregar productos seleccionados
function confirmAddSelectedProducts() {
    if (!window.selectedAdditionalProducts || window.selectedAdditionalProducts.length === 0) {
        showErrorToast('No hay productos seleccionados para agregar');
        return;
    }
    
    const totalProducts = window.selectedAdditionalProducts.length;
    const totalQuantity = window.selectedAdditionalProducts.reduce((sum, p) => sum + p.quantityToReturn, 0);
    
    Swal.fire({
        title: '¿Agregar productos seleccionados?',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>Productos a agregar:</strong> ${totalProducts}</p>
                <p><strong>Cantidad total:</strong> ${totalQuantity}</p>
                <hr style="margin: 15px 0;">
                <div style="max-height: 200px; overflow-y: auto;">
                    ${window.selectedAdditionalProducts.map(p => `
                        <p style="margin: 5px 0;">
                            <strong>${p.Upc}</strong> - ${p.Descripcion} 
                            <span style="color: #4caf50;">(${p.quantityToReturn})</span>
                        </p>
                    `).join('')}
                </div>
                <hr style="margin: 15px 0;">
                <p style="color: #ff9800; font-weight: 600;">
                    <i class="fas fa-info-circle"></i> 
                    Estos productos se agregarán a tu selección actual de mercadería
                </p>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#4caf50',
        cancelButtonColor: '#ff5e6d',
        confirmButtonText: 'Sí, agregar',
        cancelButtonText: 'Cancelar',
        // *** AGREGAR ESTAS LÍNEAS PARA Z-INDEX ***
        customClass: {
            container: 'swal2-container-front'
        },
        backdrop: true,
        allowOutsideClick: false,
        // Configurar z-index específicamente
        didOpen: () => {
            const swalContainer = document.querySelector('.swal2-container');
            if (swalContainer) {
                swalContainer.style.zIndex = '99999';
            }
        }
    }).then((result) => {
        if (result.isConfirmed) {
            addProductsToMerchandiseSelection();
            closeAdditionalProductsModalFunc();
            showSuccessToast(`${totalProducts} productos agregados exitosamente`);
        }
    });
}

// Agregar productos a la selección de mercadería
function addProductsToMerchandiseSelection() {
    // Agregar productos adicionales al array global de productos de inventario
    window.selectedAdditionalProducts.forEach(additionalProduct => {
        // Verificar si ya existe en los productos de inventario
        const existingProduct = window.inventoryProducts.find(p => p.Upc === additionalProduct.Upc);
        
        if (!existingProduct) {
            // Si no existe, agregarlo al array de productos de inventario
            window.inventoryProducts.push({
                Upc: additionalProduct.Upc,
                Descripcion: additionalProduct.Descripcion,
                Cantidad_Rechequeo: 0, // No tiene cantidad en inventario original
                Bonificacion_Rechequeo: 0,
                isAdditional: true // Marcar como adicional
            });
        }
    });
    
    // Actualizar el display de productos en el modal de mercadería
    if (window.filteredProducts) {
        // Agregar también a los productos filtrados si existe una búsqueda activa
        window.selectedAdditionalProducts.forEach(additionalProduct => {
            const existingInFiltered = window.filteredProducts.find(p => p.Upc === additionalProduct.Upc);
            if (!existingInFiltered) {
                window.filteredProducts.push({
                    Upc: additionalProduct.Upc,
                    Descripcion: additionalProduct.Descripcion,
                    Cantidad_Rechequeo: 0,
                    Bonificacion_Rechequeo: 0,
                    isAdditional: true
                });
            }
        });
        
        displayProducts(window.filteredProducts);
    } else {
        displayProducts(window.inventoryProducts);
    }
    
    // Pre-llenar las cantidades de los productos adicionales
    setTimeout(() => {
        window.selectedAdditionalProducts.forEach(additionalProduct => {
            const quantityInput = document.querySelector(`input[data-upc="${additionalProduct.Upc}"]`);
            if (quantityInput) {
                quantityInput.value = additionalProduct.quantityToReturn;
                // Marcar el item como adicional visualmente
                const productItem = quantityInput.closest('.product-item');
                if (productItem) {
                    productItem.classList.add('additional-product');
                }
            }
        });
    }, 100);
}

// CREAR MODAL DE MERCADERÍA (MODIFICADO PARA SOPORTE F1)
function createMerchandiseModal() {
    // Verificar si ya existe el modal
    let existingModal = document.getElementById('merchandiseModal');
    if (existingModal) {
        existingModal.remove();
    }
    
    const modalHTML = `
        <div class="modal-overlay" id="merchandiseModal">
            <div class="modal-container merchandise-modal">
                <div class="modal-header">
                    <div class="modal-icon">
                        <i class="fas fa-boxes"></i>
                    </div>
                    <div class="modal-title">
                        <h2>Seleccionar Mercadería</h2>
                        <p>Productos de la factura ${window.currentCreditNote.originalInvoice.Serie}-${window.currentCreditNote.originalInvoice.Numero}</p>
                    </div>
                    <div class="f1-help-indicator">
                        <div class="f1-help">
                            <kbd>F1</kbd> 
                            <span>Agregar productos adicionales</span>
                        </div>
                    </div>
                    <button class="modal-close" id="closeMerchandiseModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                
                <div class="modal-content">
                    <!-- Buscador de productos -->
                    <div class="product-search-section">
                        <div class="search-input-group">
                            <div class="search-input-icon">
                                <i class="fas fa-search"></i>
                            </div>
                            <input type="text" id="productSearchInput" placeholder="Buscar por UPC o descripción...">
                            <div class="search-input-line"></div>
                        </div>
                    </div>
                    
                    <!-- Lista de productos -->
                    <div class="products-section">
                        <div class="products-header">
                            <h3><i class="fas fa-list"></i> Productos Disponibles</h3>
                            <div class="products-count">
                                <span id="productsCount">0</span> productos encontrados
                            </div>
                        </div>
                        
                        <div class="products-container" id="productsContainer">
                            <!-- Los productos se cargarán aquí -->
                        </div>
                    </div>
                    
                    <!-- Botones de acción -->
                    <div class="modal-actions">
                        <button type="button" class="btn-secondary" id="cancelMerchandise">
                            <i class="fas fa-times"></i>
                            Cancelar
                        </button>
                        <button type="button" class="btn-primary" id="saveMerchandise">
                            <i class="fas fa-save"></i>
                            Guardar Selección
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Agregar modal al DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    // Obtener referencias a elementos
    merchandiseModal = document.getElementById('merchandiseModal');
    closeMerchandiseModal = document.getElementById('closeMerchandiseModal');
    productSearchInput = document.getElementById('productSearchInput');
    productsContainer = document.getElementById('productsContainer');
    
    // Event listeners
    closeMerchandiseModal.addEventListener('click', closeMerchandiseModalFunc);
    document.getElementById('cancelMerchandise').addEventListener('click', closeMerchandiseModalFunc);
    document.getElementById('saveMerchandise').addEventListener('click', saveMerchandiseSelection);
    productSearchInput.addEventListener('input', filterProducts);
    
    // Cerrar modal al hacer clic fuera
    merchandiseModal.addEventListener('click', (e) => {
        if (e.target === merchandiseModal) {
            closeMerchandiseModalFunc();
        }
    });
    
    // Configurar F1 para productos adicionales
    setupF1ProductSearch();
    
    // Mostrar productos iniciales
    displayProducts(window.inventoryProducts);
    
    // Mostrar modal con animación
    merchandiseModal.style.display = 'flex';
    setTimeout(() => {
        merchandiseModal.classList.add('show');
    }, 10);
    
    // Enfocar buscador
    setTimeout(() => {
        productSearchInput.focus();
    }, 300);
}

// CERRAR MODAL DE MERCADERÍA (MODIFICADO PARA LIMPIAR F1)
function closeMerchandiseModalFunc() {
    // Limpiar event listener de F1
    removeF1ProductSearch();
    
    if (merchandiseModal) {
        merchandiseModal.classList.remove('show');
        
        setTimeout(() => {
            merchandiseModal.remove();
            merchandiseModal = null;
        }, 300);
    }
}

// MOSTRAR PRODUCTOS (MODIFICADO PARA MANEJAR PRODUCTOS ADICIONALES)
function displayProducts(products) {
    if (!products || products.length === 0) {
        productsContainer.innerHTML = `
            <div class="no-products">
                <div class="no-products-icon">
                    <i class="fas fa-box-open"></i>
                </div>
                <p>No se encontraron productos</p>
            </div>
        `;
        document.getElementById('productsCount').textContent = '0';
        return;
    }
    
    const productsHTML = products.map((product, index) => {
        const isAdditional = product.isAdditional || false;
        const availableText = isAdditional ? 'Producto adicional' : `Disponible: ${product.Cantidad_Rechequeo || 0}`;
        
        return `
            <div class="product-item ${isAdditional ? 'additional-product' : ''}" data-upc="${product.Upc}">
                <div class="product-info">
                    <div class="product-main">
                        <div class="product-upc">
                            <i class="fas fa-barcode"></i>
                            <span>${product.Upc}</span>
                            ${isAdditional ? '<span class="additional-badge"><i class="fas fa-plus"></i> Adicional</span>' : ''}
                        </div>
                        <div class="product-description">
                            <h4>${product.Descripcion}</h4>
                        </div>
                    </div>
                    <div class="product-details">
                        <div class="product-quantity">
                            <span class="detail-label">${availableText}</span>
                            ${!isAdditional ? `<span class="detail-value">${product.Cantidad_Rechequeo || 0}</span>` : ''}
                        </div>
                        ${!isAdditional ? `
                            <div class="product-bonus">
                                <span class="detail-label">Bonificación:</span>
                                <span class="detail-value">${product.Bonificacion_Rechequeo || 0}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
                <div class="product-actions">
                    <div class="quantity-input-group">
                        <label for="quantity_${index}">Cantidad a devolver:</label>
                        <input type="number" 
                               id="quantity_${index}" 
                               class="quantity-input" 
                               min="0"
                               step="1" 
                               value="0"
                               data-upc="${product.Upc}"
                               data-additional="${isAdditional}">
                    </div>
                </div>
            </div>
        `;
    }).join('');
    
    productsContainer.innerHTML = productsHTML;
    document.getElementById('productsCount').textContent = products.length;
    
    // Agregar event listeners a los inputs de cantidad
    const quantityInputs = document.querySelectorAll('.quantity-input');
    quantityInputs.forEach(input => {
        input.addEventListener('input', validateQuantityInput);
        input.addEventListener('change', validateQuantityInput);
    });
}

// VALIDAR INPUT DE CANTIDAD (MODIFICADO PARA PRODUCTOS ADICIONALES)
function validateQuantityInput(event) {
    const input = event.target;
    const currentValue = parseInt(input.value) || 0;
    if (currentValue < 0) {
        input.value = 0;
        showWarningToast('La cantidad no puede ser negativa');
    }
}

// Filtrar productos por búsqueda
function filterProducts() {
    const searchTerm = productSearchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        window.filteredProducts = window.inventoryProducts;
    } else {
        window.filteredProducts = window.inventoryProducts.filter(product => 
            product.Upc.toLowerCase().includes(searchTerm) ||
            product.Descripcion.toLowerCase().includes(searchTerm)
        );
    }
    
    displayProducts(window.filteredProducts);
}

// Guardar selección de mercadería
function saveMerchandiseSelection() {
    const quantityInputs = document.querySelectorAll('.quantity-input');
    const selectedProducts = [];
    
    quantityInputs.forEach(input => {
        const quantity = parseInt(input.value) || 0;
        if (quantity > 0) {
            const upc = input.dataset.upc;
            const product = window.inventoryProducts.find(p => p.Upc === upc);
            if (product) {
                selectedProducts.push({
                    ...product,
                    quantityToReturn: quantity
                });
            }
        }
    });
    
    if (selectedProducts.length === 0) {
        showErrorToast('Debe seleccionar al menos un producto con cantidad mayor a 0');
        return;
    }
    
    // Guardar productos seleccionados
    window.selectedMerchandise = selectedProducts;
    
    // *** CERRAR EL MODAL PRIMERO ***
    closeMerchandiseModalFunc();
    
    // Esperar a que termine la animación de cierre del modal
    setTimeout(() => {
        // Calcular totales para la confirmación
        const totalItems = selectedProducts.reduce((sum, product) => sum + product.quantityToReturn, 0);
        
        // Mostrar confirmación DESPUÉS de cerrar el modal
        Swal.fire({
            title: '¿Confirmar selección?',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>Productos seleccionados:</strong> ${selectedProducts.length}</p>
                    <p><strong>Total de artículos:</strong> ${totalItems}</p>
                    <hr style="margin: 15px 0;">
                    <div style="max-height: 200px; overflow-y: auto;">
                        ${selectedProducts.map(p => `
                            <p style="margin: 5px 0;">
                                <strong>${p.Upc}</strong> - ${p.Descripcion} 
                                <span style="color: #4caf50;">(${p.quantityToReturn})</span>
                            </p>
                        `).join('')}
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4caf50',
            cancelButtonColor: '#ff5e6d',
            confirmButtonText: 'Sí, guardar',
            cancelButtonText: 'Cancelar'
        }).then(async (result) => {
            if (result.isConfirmed) {
                // Mostrar loading
                Swal.fire({
                    title: 'Guardando...',
                    text: 'Por favor espere mientras se guarda la nota de crédito y los productos.',
                    allowOutsideClick: false,
                    allowEscapeKey: false,
                    showConfirmButton: false,
                    didOpen: () => {
                        Swal.showLoading();
                    }
                });
                
                // Guardar en base de datos
                const success = await saveMerchandiseCreditNote(window.currentCreditNote, selectedProducts);
                
                // Cerrar loading
                Swal.close();
                
                // *** SI GUARDÓ EXITOSAMENTE, REGRESAR A LA PANTALLA INICIAL ***
                if (success) {
                    // Pequeña pausa para que el usuario vea el mensaje de éxito
                    setTimeout(() => {
                        resetToInitialStateComplete();
                    }, 1500); // 1.5 segundos después del mensaje de éxito
                }
                
            } else {
                // Si cancela, volver a mostrar el modal de mercadería
                setTimeout(() => {
                    createMerchandiseModal();
                    // Restaurar las cantidades seleccionadas
                    restoreMerchandiseSelection(selectedProducts);
                }, 100);
            }
        });
    }, 350); // Esperar a que termine la animación de cierre del modal (300ms + margen)
}

function resetToInitialStateComplete() {
    // Limpiar variables globales
    window.currentInvoice = null;
    window.currentCreditNote = null;
    window.selectedMerchandise = null;
    window.selectedConcept = null;
    window.inventoryProducts = null;
    window.filteredProducts = null;
    window.branchConnectionData = null;
    
    // Resetear variables de edición
    isEditing = false;
    currentEditingElement = null;
    
    // Limpiar formulario de búsqueda
    const serieElement = document.getElementById('searchSerie');
    const numberElement = document.getElementById('searchNumber');
    
    if (serieElement) serieElement.value = '';
    if (numberElement) numberElement.value = '';
    
    // Ocultar todos los paneles de resultados
    hideAllResultPanels();
    
    // Mostrar el panel de búsqueda con animación
    showSearchPanel();
    
    // Mostrar mensaje de que puede hacer una nueva búsqueda
    setTimeout(() => {
        showSuccessToast('Puede realizar una nueva búsqueda de factura');
    }, 800);
}

function restoreMerchandiseSelection(selectedProducts) {
    // Esperar un poco para que el modal se haya creado completamente
    setTimeout(() => {
        selectedProducts.forEach(product => {
            const input = document.querySelector(`input[data-upc="${product.Upc}"]`);
            if (input) {
                input.value = product.quantityToReturn;
            }
        });
    }, 100);
}

// Manejar errores de nota de crédito
function handleCreditNoteError(error) {
    
    let errorMessage = 'Error al procesar la nota de crédito. ';
    
    if (error.message && error.message.includes('connection')) {
        errorMessage += 'Verifique la conexión a la base de datos.';
    } else if (error.message && error.message.includes('TiposNotaCredito')) {
        errorMessage += 'No se pudieron cargar los tipos de nota de crédito.';
    } else {
        errorMessage += 'Por favor intente nuevamente.';
    }
    
    Swal.fire({
        icon: 'error',
        title: 'Error en Nota de Crédito',
        text: errorMessage,
        confirmButtonColor: '#6e78ff'
    });
}

// FUNCIONES DE GUARDADO EN BASE DE DATOS

// Guardar nota de crédito - Otros Conceptos
async function saveOtherConceptsCreditNote(data, observation) {
    let connection = null;
    
    try {
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        // Preparar datos para insertar
        const creditNoteData = await prepareCreditNoteData(data, observation);
        
        // Insertar en NCTProveedores
        const insertQuery = `
            INSERT INTO NCTProveedores (
                IdFacturaCompras,
                IdProveedor,
                NombreProveedore,
                NIT,
                Monto,
                Serie,
                Numero,
                TipoNotaCredito,
                FechaNotaCredito,
                Observaciones,
                IdUsuario,
                NombreUsuario,
                IdConcepto
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2)
        `;
        
        const result = await connection.query(insertQuery, [
            creditNoteData.IdFacturaCompras,
            creditNoteData.IdProveedor,
            creditNoteData.NombreProveedore,
            creditNoteData.NIT,
            creditNoteData.Monto,
            creditNoteData.Serie,
            creditNoteData.Numero,
            creditNoteData.TipoNotaCredito,
            creditNoteData.FechaNotaCredito,
            creditNoteData.Observaciones,
            creditNoteData.IdUsuario,
            creditNoteData.NombreUsuario
        ]);
        
        await connection.close();
        
        // Mostrar mensaje de éxito
        showSaveSuccessMessage(data, 'Otros Conceptos');
        
        // *** REGRESAR A LA PANTALLA INICIAL DESPUÉS DE GUARDAR OTROS CONCEPTOS ***
        setTimeout(() => {
            resetToInitialStateComplete();
        }, 1500);
        
        return true;
        
    } catch (error) {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
            }
        }
        
        showSaveErrorMessage(error);
        return false;
    }
}
// Guardar nota de crédito - Mercadería
async function saveMerchandiseCreditNote(data, selectedProducts) {
    let connection = null;
    
    try {
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        // Preparar datos para insertar
        const creditNoteData = await prepareCreditNoteData(data, 'Devolución de productos');
        
        // Insertar en NCTProveedores
        const insertQuery = `
            INSERT INTO NCTProveedores (
                IdFacturaCompras,
                IdProveedor,
                NombreProveedore,
                NIT,
                Monto,
                Serie,
                Numero,
                TipoNotaCredito,
                FechaNotaCredito,
                Observaciones,
                IdUsuario,
                NombreUsuario,
                IdConcepto
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `;
        
        const result = await connection.query(insertQuery, [
            creditNoteData.IdFacturaCompras,
            creditNoteData.IdProveedor,
            creditNoteData.NombreProveedore,
            creditNoteData.NIT,
            creditNoteData.Monto,
            creditNoteData.Serie,
            creditNoteData.Numero,
            creditNoteData.TipoNotaCredito,
            creditNoteData.FechaNotaCredito,
            creditNoteData.Observaciones,
            creditNoteData.IdUsuario,
            creditNoteData.NombreUsuario
        ]);
        
        // Obtener el ID generado de la nota de crédito
        const getIdQuery = `
            SELECT LAST_INSERT_ID() as IdNTCProveedor
        `;
        
        const idResult = await connection.query(getIdQuery);
        const idNTCProveedor = idResult[0].IdNTCProveedor;
        
        // Insertar productos en NCTProveedoresDetalle
        await saveProductDetails(connection, idNTCProveedor, selectedProducts);
        
        await connection.close();
        
        // Mostrar mensaje de éxito
        showSaveSuccessMessage(data, 'Mercadería', selectedProducts.length);
        
        return true;
        
    } catch (error) {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
            }
        }
        
        showSaveErrorMessage(error);
        return false;
    }
}

// Preparar datos de la nota de crédito
async function prepareCreditNoteData(data, observaciones) {
    const userId = localStorage.getItem('userId') || '0';
    const userName = localStorage.getItem('userName') || 'Usuario Desconocido';
    
    // Obtener datos adicionales de la factura
    let connection = null;
    let facturaData = null;
    
    try {
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        const facturaQuery = `
            SELECT IdProveedor
            FROM facturas_compras 
            WHERE Id = ?
        `;
        
        const facturaResult = await connection.query(facturaQuery, [data.originalInvoice.Id]);
        facturaData = facturaResult[0];
        
        await connection.close();
        
    } catch (error) {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
            }
        }
        throw error;
    }
    
    return {
        IdFacturaCompras: data.originalInvoice.Id,
        IdProveedor: facturaData ? facturaData.IdProveedor : null,
        NombreProveedore: data.originalInvoice.Nombre,
        NIT: data.originalInvoice.NIT,
        Monto: data.amount,
        Serie: data.serie,
        Numero: data.number,
        TipoNotaCredito: data.typeId,
        FechaNotaCredito: data.date,
        Observaciones: observaciones,
        IdUsuario: parseInt(userId),
        NombreUsuario: userName
    };
}

async function saveProductDetails(connection, idNTCProveedor, selectedProducts) {
    const insertDetailQuery = `
        INSERT INTO NCTProveedoresDetalle (
            IdNTCProveedor,
            Upc,
            Descripcion,
            Cantidad
        ) VALUES (?, ?, ?, ?)
    `;
    
    // Insertar cada producto seleccionado
    for (const product of selectedProducts) {
        await connection.query(insertDetailQuery, [
            idNTCProveedor,
            product.Upc,
            product.Descripcion,
            product.quantityToReturn.toString()
        ]);
    }
}

function showSaveSuccessMessage(data, tipo, productCount = 0) {
    let detailMessage = '';
    
    if (tipo === 'Mercadería') {
        detailMessage = `Se guardaron ${productCount} productos seleccionados.`;
    } else {
        detailMessage = 'La observación ha sido registrada correctamente.';
    }
    
    Swal.fire({
        title: '¡Nota de Crédito Guardada!',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>Serie-Número:</strong> ${data.serie}-${data.number}</p>
                <p><strong>Monto:</strong> ${formatCurrency(data.amount)}</p>
                <p><strong>Tipo:</strong> ${tipo}</p>
                <hr style="margin: 15px 0;">
                <p style="color: #4caf50; font-weight: 600;">${detailMessage}</p>
            </div>
        `,
        icon: 'success',
        confirmButtonColor: '#6e78ff',
        confirmButtonText: 'Continuar',
        timer: 3000,
        timerProgressBar: true
    });
}

function showSaveErrorMessage(error) {
    let errorMessage = 'Error al guardar la nota de crédito. ';
    
    if (error.message && error.message.includes('connection')) {
        errorMessage += 'Problema de conexión con la base de datos.';
    } else if (error.message && error.message.includes('Duplicate')) {
        errorMessage += 'Ya existe una nota de crédito con esta serie y número.';
    } else {
        errorMessage += 'Por favor intente nuevamente.';
    }
    
    Swal.fire({
        icon: 'error',
        title: 'Error al Guardar',
        text: errorMessage,
        confirmButtonColor: '#6e78ff',
        confirmButtonText: 'Entendido'
    });
}

// FUNCIONES DE UTILIDAD Y UI

// Cambiar estado de carga del botón
function setLoadingState(isLoading) {
    if (isLoading) {
        buttonText.textContent = 'Buscando...';
        buttonIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        searchButton.disabled = true;
        searchButton.style.cursor = 'not-allowed';
    } else {
        buttonText.textContent = 'Buscar Factura';
        buttonIcon.innerHTML = '<i class="fas fa-search"></i>';
        searchButton.disabled = false;
        searchButton.style.cursor = 'pointer';
    }
}

// Crear efecto de onda en el botón
function createRippleEffect(event) {
    const button = event.currentTarget;
    
    // Remover ripples anteriores
    const existingRipples = button.querySelectorAll('.ripple');
    existingRipples.forEach(ripple => ripple.remove());
    
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
    circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
    circle.classList.add('ripple');
    
    button.appendChild(circle);
    
    // Remover el elemento después de la animación
    setTimeout(() => {
        if (circle.parentNode) {
            circle.parentNode.removeChild(circle);
        }
    }, 600);
}

// Efecto de vibración para el panel de búsqueda
function shakeSearchPanel() {
    const searchPanel = document.querySelector('.search-panel');
    searchPanel.classList.add('shake');
    setTimeout(() => {
        searchPanel.classList.remove('shake');
    }, 800);
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

// Formatear NIT
function formatNIT(nit) {
    if (!nit) return '-';
    
    // Limpiar el NIT de espacios y convertir a string
    const nitString = String(nit).trim();
    
    if (!nitString) return '-';
    
    // Si ya tiene formato (contiene guión), devolverlo tal como está
    if (nitString.includes('-')) {
        return nitString;
    }
    
    // Si termina en K, separar el dígito verificador
    if (nitString.toUpperCase().endsWith('K')) {
        const nitNumber = nitString.slice(0, -1);
        return `${nitNumber}-K`;
    }
    
    // Si es solo números y tiene más de 1 dígito, intentar formatear
    if (/^\d+$/.test(nitString) && nitString.length > 1) {
        // Para NITs largos (más de 6 dígitos), separar el último dígito como verificador
        if (nitString.length >= 7) {
            const nitNumber = nitString.slice(0, -1);
            const verifier = nitString.slice(-1);
            return `${nitNumber}-${verifier}`;
        }
    }
    
    // Si no se puede formatear, devolver tal como está
    return nitString;
}

// Formatear fecha
function formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
        // Extraer solo la parte de la fecha si viene con tiempo
        let dateOnly = dateString;
        if (dateString.includes('T')) {
            dateOnly = dateString.split('T')[0];
        }
        
        // Separar los componentes de la fecha
        const [year, month, day] = dateOnly.split('-').map(Number);
        
        // Crear la fecha usando el constructor específico (evita problemas de zona horaria)
        const date = new Date(year, month - 1, day); 
        
        // Verificar que la fecha es válida
        if (isNaN(date.getTime())) {
            return dateString; // Devolver el string original si no es válida
        }
        
        // Formatear usando Intl.DateTimeFormat sin zona horaria específica
        return new Intl.DateTimeFormat('es-GT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
        
    } catch (error) {
        return dateString;
    }
}

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

// Manejar errores de búsqueda
function handleSearchError(error) {
    
    let errorMessage = 'Error al buscar la factura. ';
    
    // Determinar tipo de error
    if (error.message && error.message.includes('connection')) {
        errorMessage += 'Verifique la conexión a la base de datos.';
    } else if (error.message && error.message.includes('timeout')) {
        errorMessage += 'La consulta tardó demasiado tiempo. Intente nuevamente.';
    } else {
        errorMessage += 'Por favor intente nuevamente.';
    }
    
    Swal.fire({
        icon: 'error',
        title: 'Error de búsqueda',
        text: errorMessage,
        confirmButtonColor: '#6e78ff',
        backdrop: `
            rgba(255, 94, 109, 0.2)
            url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ff5e6d' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0l8 6 8-6v4l-8 6-8-6zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0l8 6 8-6v4l-8 6-8-6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")
            left center/contain no-repeat
        `
    });
    
    shakeSearchPanel();
}
async function validateCreditNoteExists(serie, numero, idFactura) {
    let connection = null;
    
    try {
        connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        const query = `
            SELECT 
                IdNotaCreditoProveedores,
                Serie,
                Numero,
                IdFacturaCompras,
                NombreProveedore as Proveedor,
                Monto,
                FechaNotaCredito
            FROM NCTProveedores 
            WHERE Serie = ? AND Numero = ? AND IdFacturaCompras = ?
        `;
        
        const result = await connection.query(query, [serie, numero, idFactura]);
        await connection.close();
        
        return result.length > 0 ? result[0] : null;
        
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