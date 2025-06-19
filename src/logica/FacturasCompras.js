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
        console.error('Error: No se encontraron algunos elementos críticos del DOM');
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
        console.error('No se encontraron los elementos de búsqueda');
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
        console.error('Error en la búsqueda:', error);
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
                    console.warn('Error obteniendo nombre de sucursal:', branchError);
                    invoice.NombreSucursal = 'No disponible';
                }
            } else {
                invoice.NombreSucursal = 'No especificada';
            }
            
            return invoice;
        }
        
        return null;
        
    } catch (error) {
        console.error('Error ejecutando la consulta:', error);
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
        console.error('Error consultando sucursal:', error);
        throw error;
    } finally {
        if (branchConnection) {
            try {
                await branchConnection.close();
            } catch (closeError) {
                console.error('Error cerrando conexión de sucursal:', closeError);
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
        { id: 'invoiceDate', type: 'date', fieldName: 'FechaFactura', tipoCambio: 5 }
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
function logUpdateSummary(fieldConfig, newValue) {
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
        'MontoFactura': false
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
    
    console.log(`📊 RESUMEN ACTUALIZACIÓN - Campo: ${getFieldDisplayName(fieldConfig.tipoCambio)}`);
    console.log(`🎯 Nuevo valor: ${newValue}`);
    console.log(`📋 Tablas actualizadas:`, tablesUpdated);
    console.log('🔄 Sincronización completa exitosa');
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
        
        if (fieldConfig.type === 'select') {
            const selectedOption = editElement.options[editElement.selectedIndex];
            newValue = editElement.value;
            newDisplayValue = selectedOption ? selectedOption.text : '';
            
            // *** VALIDACIÓN ADICIONAL PARA RAZÓN SOCIAL ***
            if (fieldConfig.fieldName === 'IdRazon' && !newValue) {
                showErrorToast('Debe seleccionar una razón social válida');
                return;
            }
            
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
        if (newValue.toString() === originalValue.toString()) {
            cancelEdit();
            showInfoToast('No se realizaron cambios');
            return;
        }
        
        // Validaciones específicas
        if (!validateFieldValue(fieldConfig, newValue)) {
            return;
        }
        
        try {
            // Confirmar cambio
            const confirmed = await confirmChange(fieldConfig, currentDisplayValue, newDisplayValue);
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
            await saveFieldChange(fieldConfig, originalValue, newValue);
            
            // Log del resumen completo
            logUpdateSummary(fieldConfig, newValue);
            
            // Cerrar loading
            Swal.close();
            
            // Actualizar la interfaz
            element.innerHTML = newDisplayValue;
            element.classList.add('field-updated');
            
            // Actualizar el objeto currentInvoice
            updateCurrentInvoiceObject(fieldConfig, newValue, newDisplayValue);
            
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
            
            console.error('Error guardando cambio:', error);
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
            // CORREGIDO: Extraer solo la fecha sin la parte de tiempo
            if (invoice.FechaFactura) {
                const dateOnly = invoice.FechaFactura.includes('T') 
                    ? invoice.FechaFactura.split('T')[0] 
                    : invoice.FechaFactura;
                return dateOnly;
            }
            return '';
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
        console.error('Error cargando razones sociales:', error);
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
function validateFieldValue(fieldConfig, value) {
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
            
            // VALIDACIÓN CORREGIDA para fechas
            if (!validateDate(value)) {
                showErrorToast('La fecha no puede ser futura');
                return false;
            }
            break;
    }
    
    return true;
}

// Confirmar cambio
async function confirmChange(fieldConfig, oldDisplayValue, newDisplayValue) {
    const result = await Swal.fire({
        title: '¿Confirmar cambio?',
        html: `
            <div style="text-align: left; margin: 20px 0;">
                <p><strong>Campo:</strong> ${getFieldDisplayName(fieldConfig.tipoCambio)}</p>
                <p><strong>Valor anterior:</strong> ${oldDisplayValue}</p>
                <p><strong>Valor nuevo:</strong> ${newDisplayValue}</p>
            </div>
        `,
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
        5: 'Fecha Factura'
    };
    return names[tipoCambio] || 'Campo';
}

// Guardar cambio en base de datos
async function saveFieldChange(fieldConfig, oldValue, newValue) {
    let connection = null;
    let branchConnection = null;
    
    try {
        // 1. ACTUALIZAR EN LA BASE DE DATOS CENTRAL (DSN=facturas)
        connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        // Actualizar la factura en la base central
        await updateInvoiceField(connection, fieldConfig, newValue);
        
        // Registrar el cambio en el historial
        await logFieldChange(connection, fieldConfig, oldValue, newValue);
        
        await connection.close();
        connection = null;
        
        // 2. ACTUALIZAR EN LA BASE DE DATOS DE LA SUCURSAL (MySQL)
        await updateBranchInventory(fieldConfig, newValue);
        
    } catch (error) {
        // Cerrar conexiones en caso de error
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error cerrando conexión central:', closeError);
            }
        }
        
        throw error;
    }
}
async function updateBranchInventory(fieldConfig, newValue) {
    let branchConnection = null;
    
    try {
        // Verificar que tenemos los datos de conexión de la sucursal
        if (!window.branchConnectionData) {
            console.warn('No hay datos de conexión de sucursal disponibles');
            return; // No es un error crítico, solo advertencia
        }
        
        // Verificar que tenemos el IdInventory
        if (!window.currentInvoice.IdInventory) {
            console.warn('No se encontró IdInventory para actualizar en sucursal');
            return;
        }
        
        // Crear conexión MySQL a la sucursal
        branchConnection = await mysql.createConnection({
            host: window.branchConnectionData.server,
            database: window.branchConnectionData.database,
            user: window.branchConnectionData.user,
            password: window.branchConnectionData.password,
            port: 3306,
            connectTimeout: 10000,
            acquireTimeout: 10000
        });
        
        // Actualizar en las tres tablas de la sucursal
        await updateInventoryField(branchConnection, fieldConfig, newValue);
        await updateBranchFacturasCompras(branchConnection, fieldConfig, newValue);
        await updateBranchOrdenesCompraFactura(branchConnection, fieldConfig, newValue);
        
        console.log('Todas las tablas de sucursal actualizadas exitosamente');
        
    } catch (error) {
        console.error('Error actualizando datos en sucursal:', error);
        // No lanzar error para que no afecte la actualización central
        showWarningToast('Advertencia: No se pudo actualizar completamente la información en la sucursal');
    } finally {
        if (branchConnection) {
            try {
                await branchConnection.end();
            } catch (closeError) {
                console.error('Error cerrando conexión de sucursal:', closeError);
            }
        }
    }
}
async function updateBranchOrdenesCompraFactura(branchConnection, fieldConfig, newValue) {
    let updateQuery;
    let queryParams;
    
    // Mapear los campos de facturas_compras central a ordenescompra_factura sucursal
    const fieldMapping = {
        'Serie': 'Serie_Factura',
        'Numero': 'Numero_Factura', 
        'MontoFactura': 'Monto_Factura',
        'FechaFactura': 'Fecha_Factura',
        'IdRazon': 'IdRazonSocial_Factura'
    };
    
    const ordenField = fieldMapping[fieldConfig.fieldName];
    
    // Todos los campos se mapean a ordenescompra_factura en sucursal
    if (!ordenField) {
        console.log(`Campo ${fieldConfig.fieldName} no reconocido para ordenescompra_factura sucursal`);
        return;
    }
    
    if (fieldConfig.fieldName === 'IdRazon') {
        // Para razón social, actualizar tanto IdRazonSocial_Factura como RazonSocial_Factura
        // Obtener el nombre de la razón social desde la base central
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        const razonQuery = `
            SELECT NombreRazon 
            FROM razonessociales 
            WHERE Id = ?
        `;
        
        const razonResult = await connection.query(razonQuery, [newValue]);
        await connection.close();
        
        if (razonResult.length === 0) {
            throw new Error('Razón social no encontrada para actualizar ordenescompra_factura sucursal');
        }
        
        const nombreRazon = razonResult[0].NombreRazon;
        
        // Actualizar ambos campos en ordenescompra_factura sucursal
        updateQuery = `
            UPDATE ordenescompra_factura 
            SET IdRazonSocial_Factura = ?, RazonSocial_Factura = ?
            WHERE IdInventario = ?
        `;
        
        queryParams = [newValue, nombreRazon, window.currentInvoice.IdInventory];
        
    } else {
        // Para otros campos (Serie_Factura, Numero_Factura, Monto_Factura, Fecha_Factura)
        updateQuery = `
            UPDATE ordenescompra_factura 
            SET ${ordenField} = ? 
            WHERE IdInventario = ?
        `;
        
        queryParams = [newValue, window.currentInvoice.IdInventory];
    }
    
    // Ejecutar la actualización
    const [result] = await branchConnection.execute(updateQuery, queryParams);
    
    // Verificar que se actualizó al menos un registro
    if (result.affectedRows === 0) {
        console.warn(`No se encontró ordenescompra_factura con IdInventario: ${window.currentInvoice.IdInventory} en la sucursal`);
    } else {
        console.log(`ordenescompra_factura actualizada en sucursal. Registros afectados: ${result.affectedRows}`);
    }
}
async function updateBranchFacturasCompras(branchConnection, fieldConfig, newValue) {
    let updateQuery;
    let queryParams;
    
    // Mapear los campos de facturas_compras central a facturas_compras sucursal
    const fieldMapping = {
        'Serie': 'Serie',
        'Numero': 'Numero', 
        'MontoFactura': 'MontoFactura',
        'FechaFactura': 'FechaFactura',
        'IdRazon': 'IdRazon'
    };
    
    const branchField = fieldMapping[fieldConfig.fieldName];
    
    // Todos los campos se mapean a facturas_compras en sucursal
    if (!branchField) {
        console.log(`Campo ${fieldConfig.fieldName} no reconocido para facturas_compras sucursal`);
        return;
    }
    
    if (fieldConfig.fieldName === 'IdRazon') {
        // Para razón social, actualizar tanto IdRazon como NombreRazon
        // Obtener el nombre de la razón social desde la base central
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        const razonQuery = `
            SELECT NombreRazon 
            FROM razonessociales 
            WHERE Id = ?
        `;
        
        const razonResult = await connection.query(razonQuery, [newValue]);
        await connection.close();
        
        if (razonResult.length === 0) {
            throw new Error('Razón social no encontrada para actualizar facturas_compras sucursal');
        }
        
        const nombreRazon = razonResult[0].NombreRazon;
        
        // Actualizar ambos campos en facturas_compras sucursal
        updateQuery = `
            UPDATE facturas_compras 
            SET IdRazon = ?, NombreRazon = ?
            WHERE IdInventarios = ?
        `;
        
        queryParams = [newValue, nombreRazon, window.currentInvoice.IdInventory];
        
    } else {
        // Para otros campos (Serie, Numero, MontoFactura, FechaFactura)
        updateQuery = `
            UPDATE facturas_compras 
            SET ${branchField} = ? 
            WHERE IdInventarios = ?
        `;
        
        queryParams = [newValue, window.currentInvoice.IdInventory];
    }
    
    // Ejecutar la actualización
    const [result] = await branchConnection.execute(updateQuery, queryParams);
    
    // Verificar que se actualizó al menos un registro
    if (result.affectedRows === 0) {
        console.warn(`No se encontró facturas_compras con IdInventarios: ${window.currentInvoice.IdInventory} en la sucursal`);
    } else {
        console.log(`facturas_compras actualizada en sucursal. Registros afectados: ${result.affectedRows}`);
    }
}
// Función para actualizar campo específico en tabla inventarios de sucursal
async function updateInventoryField(branchConnection, fieldConfig, newValue) {
    let updateQuery;
    let queryParams;
    
    // Mapear los campos de facturas_compras a inventarios
    const fieldMapping = {
        'Serie': 'Serie',
        'Numero': 'Numero', 
        'FechaFactura': 'FechaFactura',
        'IdRazon': 'IdRazon',
        'MontoFactura': null // Este campo NO existe en inventarios
    };
    
    const inventoryField = fieldMapping[fieldConfig.fieldName];
    
    // Si el campo no se mapea a inventarios, no hacer nada
    if (inventoryField === null) {
        console.log(`Campo ${fieldConfig.fieldName} no se actualiza en inventarios`);
        return;
    }
    
    if (fieldConfig.fieldName === 'IdRazon') {
        // Para razón social, actualizar tanto IdRazon como NombreRazon
        // Obtener el nombre de la razón social desde la base central
        const connection = await odbc.connect('DSN=facturas;charset=utf8');
        
        const razonQuery = `
            SELECT NombreRazon 
            FROM razonessociales 
            WHERE Id = ?
        `;
        
        const razonResult = await connection.query(razonQuery, [newValue]);
        await connection.close();
        
        if (razonResult.length === 0) {
            throw new Error('Razón social no encontrada para actualizar inventarios sucursal');
        }
        
        const nombreRazon = razonResult[0].NombreRazon;
        
        // Actualizar ambos campos en inventarios
        updateQuery = `
            UPDATE inventarios 
            SET IdRazon = ?, NombreRazon = ?
            WHERE IdInventarios = ?
        `;
        
        queryParams = [newValue, nombreRazon, window.currentInvoice.IdInventory];
        
    } else {
        // Para otros campos (Serie, Numero, FechaFactura)
        updateQuery = `
            UPDATE inventarios 
            SET ${inventoryField} = ? 
            WHERE IdInventarios = ?
        `;
        
        queryParams = [newValue, window.currentInvoice.IdInventory];
    }
    
    // Ejecutar la actualización
    const [result] = await branchConnection.execute(updateQuery, queryParams);
    
    // Verificar que se actualizó al menos un registro
    if (result.affectedRows === 0) {
        console.warn(`No se encontró inventario con IdInventarios: ${window.currentInvoice.IdInventory} en la sucursal`);
    } else {
        console.log(`Inventario actualizado en sucursal. Registros afectados: ${result.affectedRows}`);
    }
}

// Actualizar campo en la tabla facturas_compras
async function updateInvoiceField(connection, fieldConfig, newValue) {
    let updateQuery;
    let queryParams;
    
    if (fieldConfig.fieldName === 'IdRazon') {
        // Para razón social, necesitamos actualizar tanto IdRazon como NombreRazon
        // Primero obtenemos el nombre de la razón social seleccionada
        const razonQuery = `
            SELECT NombreRazon 
            FROM razonessociales 
            WHERE Id = ?
        `;
        
        const razonResult = await connection.query(razonQuery, [newValue]);
        
        if (razonResult.length === 0) {
            throw new Error('Razón social no encontrada');
        }
        
        const nombreRazon = razonResult[0].NombreRazon;
        
        // Actualizar ambos campos
        updateQuery = `
            UPDATE facturas_compras 
            SET IdRazon = ?, NombreRazon = ?
            WHERE Id = ?
        `;
        
        queryParams = [newValue, nombreRazon, window.currentInvoice.Id];
        
    } else {
        // Para otros campos, mantener el comportamiento original
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
async function logFieldChange(connection, fieldConfig, oldValue, newValue) {
    const userId = localStorage.getItem('userId') || '0';
    const userName = localStorage.getItem('userName') || 'Usuario Desconocido';
    
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
    
    await connection.query(insertQuery, [
        fieldConfig.tipoCambio,
        getFieldDisplayName(fieldConfig.tipoCambio),
        oldValue.toString(),
        newValue.toString(),
        window.currentInvoice.IdInventory || '',
        window.currentInvoice.IdSucursalCori || 0,
        window.currentInvoice.NombreSucursal || '',
        window.currentInvoice.Id,
        parseInt(userId),
        userName
    ]);
}

// Actualizar objeto currentInvoice
function updateCurrentInvoiceObject(fieldConfig, newValue, newDisplayValue) {
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
            // *** NUEVO: También actualizar el campo NombreRazon en el objeto ***
            break;
        case 'MontoFactura':
            window.currentInvoice.MontoFactura = newValue;
            break;
        case 'FechaFactura':
            window.currentInvoice.FechaFactura = newValue;
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
        
        // Establecer fecha actual por defecto
        setDefaultDate();
        
        // Mostrar el modal
        showCreditNoteModal();
        
    } catch (error) {
        console.error('Error al abrir formulario de nota de crédito:', error);
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
        console.error('Error cargando tipos de nota de crédito:', error);
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

// Establecer fecha actual por defecto
function setDefaultDate() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const formattedDate = `${year}-${month}-${day}`;
    
    document.getElementById('creditNoteDate').value = formattedDate;
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
function handleCreditNoteSubmit(e) {
    e.preventDefault();
    
    // Validar que se haya seleccionado un concepto
    if (!window.selectedConcept) {
        showErrorToast('Debe seleccionar un tipo de concepto (Mercadería u Otros conceptos)');
        return;
    }
    
    // Obtener datos del formulario
    const formData = getCreditNoteFormData();
    
    // Validar datos
    if (!validateCreditNoteData(formData)) {
        return;
    }
    
    // Mostrar confirmación
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
function validateCreditNoteData(data) {
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
        showErrorToast('Debe seleccionar la fecha de la nota');
        document.getElementById('creditNoteDate').focus();
        return false;
    }
    
    // Validar que la fecha no sea futura
    const selectedDate = new Date(data.date);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // Final del día actual
    
    if (selectedDate > today) {
        showErrorToast('La fecha de la nota no puede ser futura');
        document.getElementById('creditNoteDate').focus();
        return false;
    }
    
    return true;
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
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4caf50',
            cancelButtonColor: '#ff5e6d',
            confirmButtonText: 'Sí, continuar',
            cancelButtonText: 'Cancelar',
            customClass: {
                popup: 'credit-note-confirmation'
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
    }, 350); // Esperar a que termine la animación de cierre del modal
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
        console.error('Error al proceder con mercadería:', error);
        
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

// Mostrar modal de mercadería (simplificado)
function showMerchandiseModal() {
    // Crear y mostrar el modal directamente
    // (los productos ya fueron cargados en proceedWithMerchandiseWithLoading)
    createMerchandiseModal();
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
            connectTimeout: 10000,
            acquireTimeout: 10000
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
        console.error('Error cargando productos del inventario:', error);
        throw new Error(`Error conectando a la base de datos de la sucursal: ${error.message}`);
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (closeError) {
                console.error('Error cerrando conexión MySQL:', closeError);
            }
        }
    }
}

// Crear modal de mercadería
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

// Mostrar productos en el contenedor
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
    
    const productsHTML = products.map((product, index) => `
        <div class="product-item" data-upc="${product.Upc}">
            <div class="product-info">
                <div class="product-main">
                    <div class="product-upc">
                        <i class="fas fa-barcode"></i>
                        <span>${product.Upc}</span>
                    </div>
                    <div class="product-description">
                        <h4>${product.Descripcion}</h4>
                    </div>
                </div>
                <div class="product-details">
                    <div class="product-quantity">
                        <span class="detail-label">Cantidad:</span>
                        <span class="detail-value">${product.Cantidad_Rechequeo || 0}</span>
                    </div>
                    <div class="product-bonus">
                        <span class="detail-label">Bonificación:</span>
                        <span class="detail-value">${product.Bonificacion_Rechequeo || 0}</span>
                    </div>
                </div>
            </div>
            <div class="product-actions">
                <div class="quantity-input-group">
                    <label for="quantity_${index}">Cantidad a devolver:</label>
                    <input type="number" 
                           id="quantity_${index}" 
                           class="quantity-input" 
                           min="0" 
                           max="${product.Cantidad_Rechequeo || 0}"
                           step="1" 
                           value="0"
                           data-upc="${product.Upc}"
                           data-max="${product.Cantidad_Rechequeo || 0}">
                </div>
            </div>
        </div>
    `).join('');
    
    productsContainer.innerHTML = productsHTML;
    document.getElementById('productsCount').textContent = products.length;
    
    // Agregar event listeners a los inputs de cantidad
    const quantityInputs = document.querySelectorAll('.quantity-input');
    quantityInputs.forEach(input => {
        input.addEventListener('input', validateQuantityInput);
        input.addEventListener('change', validateQuantityInput);
    });
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

// Validar input de cantidad
function validateQuantityInput(event) {
    const input = event.target;
    const maxQuantity = parseInt(input.dataset.max);
    const currentValue = parseInt(input.value) || 0;
    
    if (currentValue > maxQuantity) {
        input.value = maxQuantity;
        showErrorToast(`La cantidad máxima disponible es ${maxQuantity}`);
    }
    
    if (currentValue < 0) {
        input.value = 0;
    }
}

// Cerrar modal de mercadería
function closeMerchandiseModalFunc() {
    if (merchandiseModal) {
        merchandiseModal.classList.remove('show');
        
        setTimeout(() => {
            merchandiseModal.remove();
            merchandiseModal = null;
        }, 300);
    }
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
                    showMerchandiseModal();
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
    console.error('Error en nota de crédito:', error);
    
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
        const date = new Date(year, month - 1, day); // month - 1 porque los meses en JS empiezan en 0
        
        // Verificar que la fecha es válida
        if (isNaN(date.getTime())) {
            console.warn('Fecha inválida:', dateString);
            return dateString; // Devolver el string original si no es válida
        }
        
        // Formatear usando Intl.DateTimeFormat sin zona horaria específica
        return new Intl.DateTimeFormat('es-GT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
        
    } catch (error) {
        console.error('Error formateando fecha:', error);
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
    console.error('Error en la búsqueda:', error);
    
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
        console.error('Error guardando nota de crédito:', error);
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error cerrando conexión:', closeError);
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
        console.error('Error guardando nota de crédito:', error);
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error cerrando conexión:', closeError);
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
        console.error('Error obteniendo datos de factura:', error);
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error('Error cerrando conexión:', closeError);
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
        timer: 3000, // Reducido de 5000 a 3000
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

// Resetear al estado inicial
function resetToInitialState() {
    // Limpiar variables globales
    window.currentInvoice = null;
    window.currentCreditNote = null;
    window.selectedMerchandise = null;
    window.selectedConcept = null;
    
    // Resetear variables de edición
    isEditing = false;
    currentEditingElement = null;
    
    // Mostrar panel de búsqueda nuevamente
    showSearchPanel();
}