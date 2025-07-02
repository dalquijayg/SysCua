const odbc = require('odbc');
const Swal = require('sweetalert2');
const mysql = require('mysql2/promise');

// ===== VARIABLES GLOBALES =====
let searchForm, searchSerie, searchNumber, searchButton, buttonText, buttonIcon;
let resultsPanel, notFoundPanel, newSearchBtn, tryAgainBtn, addCreditNoteBtn;
let creditNoteModal, closeCreditNoteModal, cancelCreditNote, creditNoteForm;
let merchandiseBtn, otherConceptsBtn;
let merchandiseModal, closeMerchandiseModal, productSearchInput, productsContainer;
let modificationReasonModal, closeModificationReasonModal, modificationReasonForm;
let modificationBtn, refacturationBtn;
let selectedModificationReason = null;
let isModificationMode = false;
let refacturingReasonModal, closeRefacturingReasonModal, refacturingReasonForm;
let selectedRefacturingReason = null;
let isRefacturingMode = false;
let originalFieldValues = {};

// Variables para edición inline
let isEditing = false;
let currentEditingElement = null;

let refacturingFields = {};
let refacturingCompletedFields = 0;
let updateRefacturingBtn;
let refacturingUpdateRow;

// ===== GESTIÓN UNIVERSAL DE MODALES =====
class ModalManager {
    static showModal(modalId, focusElementId = null, focusDelay = 300) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;
        
        modal.style.display = 'flex';
        
        setTimeout(() => {
            modal.classList.add('show');
        }, 10);
        
        if (focusElementId) {
            setTimeout(() => {
                const element = document.getElementById(focusElementId);
                if (element) element.focus();
            }, focusDelay);
        }
        
        return true;
    }
    
    static closeModal(modalId, onClose = null) {
        const modal = document.getElementById(modalId);
        if (!modal) return false;
        
        modal.classList.remove('show');
        
        setTimeout(() => {
            modal.style.display = 'none';
            if (onClose) onClose();
        }, 300);
        
        return true;
    }
    
    static removeModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('show');
            setTimeout(() => modal.remove(), 300);
        }
    }
}

// ===== GESTIÓN UNIVERSAL DE CONEXIONES =====
class DatabaseManager {
    static async executeWithConnection(connectionString, queryFunc) {
        let connection = null;
        
        try {
            // CAMBIO: Verificar si es string (ODBC) o objeto (MySQL)
            if (typeof connectionString === 'string' && connectionString.startsWith('DSN=')) {
                // Conexión ODBC
                connection = await odbc.connect(connectionString);
            } else if (typeof connectionString === 'object') {
                // Conexión MySQL - connectionString es el objeto de configuración
                connection = await mysql.createConnection(connectionString);
            } else {
                throw new Error('Tipo de conexión no válido');
            }
            
            const result = await queryFunc(connection);
            return result;
            
        } catch (error) {
            console.error('Database error:', error);
            throw error;
        } finally {
            if (connection) {
                try {
                    if (connection.close) {
                        await connection.close(); // ODBC
                    } else {
                        await connection.end(); // MySQL
                    }
                } catch (closeError) {
                    console.error('Error closing connection:', closeError);
                }
            }
        }
    }
    
    static async loadSelectOptions(tableName, valueField, textField, whereClause = '', orderBy = null) {
        const connectionString = 'DSN=facturas;charset=utf8';
        
        return await this.executeWithConnection(connectionString, async (connection) => {
            const orderClause = orderBy ? `ORDER BY ${orderBy}` : `ORDER BY ${textField}`;
            const where = whereClause ? `WHERE ${whereClause}` : '';
            const query = `SELECT ${valueField}, ${textField} FROM ${tableName} ${where} ${orderClause}`;
            
            const result = await connection.query(query);
            return result;
        });
    }
    
    static async updateBranchTables(fieldConfig, newValue, selectedProvider = null) {
        if (!window.branchConnectionData || !window.currentInvoice.IdInventory) {
            return;
        }
        
        const connectionConfig = {
            host: window.branchConnectionData.server,
            database: window.branchConnectionData.database,
            user: window.branchConnectionData.user,
            password: window.branchConnectionData.password,
            port: 3306,
            connectTimeout: 10000
        };
        
        // CAMBIO: Pasar el objeto de configuración directamente, no como string
        await this.executeWithConnection(connectionConfig, async (connection) => {
            // Actualizar las 3 tablas de sucursal
            await this.updateInventoryTable(connection, fieldConfig, newValue, selectedProvider);
            await this.updateFacturasComprasTable(connection, fieldConfig, newValue, selectedProvider);
            await this.updateOrdenesCompraTable(connection, fieldConfig, newValue, selectedProvider);
        });
    }
    
    static async updateInventoryTable(connection, fieldConfig, newValue, selectedProvider) {
        const fieldMapping = {
            'Serie': 'Serie',
            'Numero': 'Numero', 
            'FechaFactura': 'FechaFactura',
            'IdRazon': 'IdRazon',
            'NIT': 'IdProveedores'
        };
        
        const field = fieldMapping[fieldConfig.fieldName];
        if (!field) return;
        
        let query, params;
        
        if (fieldConfig.fieldName === 'IdRazon') {
            const razones = await this.getCentralData('razonessociales', 'NombreRazon', 'Id', newValue);
            const nombreRazon = razones.length > 0 ? razones[0].NombreRazon : '';
            
            query = `UPDATE inventarios SET IdRazon = ?, NombreRazon = ? WHERE IdInventarios = ?`;
            params = [newValue, nombreRazon, window.currentInvoice.IdInventory];
            
        } else if (fieldConfig.fieldName === 'NIT' && selectedProvider) {
            query = `UPDATE inventarios SET IdProveedores = ?, Proveedor = ? WHERE IdInventarios = ?`;
            params = [selectedProvider.Id, selectedProvider.Nombre, window.currentInvoice.IdInventory];
            
        } else {
            query = `UPDATE inventarios SET ${field} = ? WHERE IdInventarios = ?`;
            params = [newValue, window.currentInvoice.IdInventory];
        }
        
        // CAMBIO: Usar execute en lugar de query para MySQL2
        const [result] = await connection.execute(query, params);
        return result;
    }
    
    static async updateFacturasComprasTable(connection, fieldConfig, newValue, selectedProvider) {
        const fieldMapping = {
            'Serie': 'Serie',
            'Numero': 'Numero', 
            'MontoFactura': 'MontoFactura',
            'FechaFactura': 'FechaFactura',
            'IdRazon': 'IdRazon',
            'NIT': 'IdProveedor'
        };
        
        const field = fieldMapping[fieldConfig.fieldName];
        if (!field) return;
        
        let query, params;
        
        if (fieldConfig.fieldName === 'IdRazon') {
            const razones = await this.getCentralData('razonessociales', 'NombreRazon', 'Id', newValue);
            const nombreRazon = razones.length > 0 ? razones[0].NombreRazon : '';
            
            query = `UPDATE facturas_compras SET IdRazon = ?, NombreRazon = ? WHERE IdInventarios = ?`;
            params = [newValue, nombreRazon, window.currentInvoice.IdInventory];
            
        } else if (fieldConfig.fieldName === 'NIT' && selectedProvider) {
            query = `UPDATE facturas_compras SET IdProveedor = ?, NombreProveedor = ? WHERE IdInventarios = ?`;
            params = [selectedProvider.Id, selectedProvider.Nombre, window.currentInvoice.IdInventory];
            
        } else {
            query = `UPDATE facturas_compras SET ${field} = ? WHERE IdInventarios = ?`;
            params = [newValue, window.currentInvoice.IdInventory];
        }
        
        // CAMBIO: Usar execute en lugar de query para MySQL2
        const [result] = await connection.execute(query, params);
        return result;
    }
    
    static async updateOrdenesCompraTable(connection, fieldConfig, newValue, selectedProvider) {
        const fieldMapping = {
            'Serie': 'Serie_Factura',
            'Numero': 'Numero_Factura', 
            'MontoFactura': 'Monto_Factura',
            'FechaFactura': 'Fecha_Factura',
            'IdRazon': 'IdRazonSocial_Factura',
            'NIT': 'IdProveedor_Factura'
        };
        
        const field = fieldMapping[fieldConfig.fieldName];
        if (!field) return;
        
        let query, params;
        
        if (fieldConfig.fieldName === 'IdRazon') {
            const razones = await this.getCentralData('razonessociales', 'NombreRazon', 'Id', newValue);
            const nombreRazon = razones.length > 0 ? razones[0].NombreRazon : '';
            
            query = `UPDATE ordenescompra_factura SET IdRazonSocial_Factura = ?, RazonSocial_Factura = ? WHERE IdInventario = ?`;
            params = [newValue, nombreRazon, window.currentInvoice.IdInventory];
            
        } else if (fieldConfig.fieldName === 'NIT' && selectedProvider) {
            query = `UPDATE ordenescompra_factura SET IdProveedor_Factura = ?, NITProveedor_Factura = ?, NombreProveedor_Factura = ? WHERE IdInventario = ?`;
            params = [selectedProvider.Id, selectedProvider.NIT, selectedProvider.Nombre, window.currentInvoice.IdInventory];
            
        } else {
            query = `UPDATE ordenescompra_factura SET ${field} = ? WHERE IdInventario = ?`;
            params = [newValue, window.currentInvoice.IdInventory];
        }
        
        // CAMBIO: Usar execute en lugar de query para MySQL2
        const [result] = await connection.execute(query, params);
        return result;
    }
    
    static async getCentralData(table, selectField, whereField, whereValue) {
        const connectionString = 'DSN=facturas;charset=utf8';
        
        return await this.executeWithConnection(connectionString, async (connection) => {
            const query = `SELECT ${selectField} FROM ${table} WHERE ${whereField} = ?`;
            return await connection.query(query, [whereValue]);
        });
    }
    
    static async getBranchConnectionData(branchId) {
        const connectionString = 'DSN=DBsucursal';
        
        return await this.executeWithConnection(connectionString, async (connection) => {
            const query = `
                SELECT 
                    sucursales.NombreSucursal,
                    sucursales.serverr,
                    sucursales.databasee,
                    sucursales.Uid,
                    sucursales.Pwd
                FROM sucursales
                WHERE sucursales.idSucursal = ?
            `;
            
            const result = await connection.query(query, [branchId]);
            
            if (result.length > 0) {
                window.branchConnectionData = {
                    server: result[0].serverr,
                    database: result[0].databasee,
                    user: result[0].Uid,
                    password: result[0].Pwd
                };
                
                return result[0].NombreSucursal;
            } else {
                return 'Sucursal no encontrada';
            }
        });
    }
}

// ===== GESTIÓN UNIVERSAL DE SELECTS =====
class SelectManager {
    static async populateSelect(selectId, data, valueField, textField, defaultText = 'Seleccione una opción...') {
        const select = document.getElementById(selectId);
        if (!select) return false;
        
        // Limpiar select
        select.innerHTML = `<option value="">${defaultText}</option>`;
        
        // Agregar opciones
        data.forEach(item => {
            const option = document.createElement('option');
            option.value = item[valueField];
            option.textContent = item[textField];
            select.appendChild(option);
        });
        
        return true;
    }
    
    static async loadCreditNoteTypes() {
        const data = await DatabaseManager.loadSelectOptions(
            'TiposNotaCredito', 
            'IdTipoNotasCredito', 
            'TipoNotaCredito'
        );
        
        return this.populateSelect(
            'creditNoteType', 
            data, 
            'IdTipoNotasCredito', 
            'TipoNotaCredito',
            'Seleccione un tipo...'
        );
    }
    
    static async loadModificationReasons() {
        const data = await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
            const query = `
                SELECT IdRazonModificacion, RazonModificacion 
                FROM TiposModificacion_Refacturacion 
                WHERE Motivo = 2 
                ORDER BY RazonModificacion
            `;
            return await connection.query(query);
        });
        
        return this.populateSelect(
            'modificationReason',
            data,
            'IdRazonModificacion',
            'RazonModificacion',
            'Seleccione un motivo...'
        );
    }
    
    static async loadRefacturingReasons() {
        const data = await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
            const query = `
                SELECT IdRazonModificacion, RazonModificacion 
                FROM TiposModificacion_Refacturacion 
                WHERE Motivo = 1 
                ORDER BY RazonModificacion
            `;
            return await connection.query(query);
        });
        
        return this.populateSelect(
            'refacturingReason',
            data,
            'IdRazonModificacion',
            'RazonModificacion',
            'Seleccione un motivo...'
        );
    }
    
    static async loadSocialReasons(currentIdRazon = null) {
        const data = await DatabaseManager.loadSelectOptions(
            'razonessociales', 
            'Id', 
            'NombreRazon'
        );
        
        const select = document.createElement('select');
        select.className = 'inline-edit-select';
        
        // Agregar opción por defecto
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Seleccione una razón social...';
        select.appendChild(defaultOption);
        
        // Agregar opciones
        data.forEach(razon => {
            const option = document.createElement('option');
            option.value = razon.Id;
            option.textContent = razon.NombreRazon;
            
            if (razon.Id.toString() === currentIdRazon.toString()) {
                option.selected = true;
            }
            
            select.appendChild(option);
        });
        
        return select;
    }
}

// ===== GESTIÓN UNIVERSAL DE NOTIFICACIONES =====
class NotificationManager {
    static showToast(type, message, duration = 3000) {
        const config = {
            success: { icon: 'success', class: 'success-toast' },
            error: { icon: 'error', class: 'error-toast', duration: 4000 },
            warning: { icon: 'warning', class: 'warning-toast', duration: 3500 },
            info: { icon: 'info', class: 'info-toast', duration: 2500 }
        };
        
        const settings = config[type] || config.info;
        
        Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: settings.duration || duration,
            timerProgressBar: true,
            customClass: {
                popup: settings.class
            },
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer);
                toast.addEventListener('mouseleave', Swal.resumeTimer);
            }
        }).fire({
            icon: settings.icon,
            title: message
        });
    }
    
    static showLoading(title, html = 'Por favor espere...') {
        return Swal.fire({
            title: title,
            html: html,
            allowOutsideClick: false,
            allowEscapeKey: false,
            showConfirmButton: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
    }
    
    static closeLoading() {
        Swal.close();
    }
    
    static async showConfirmation(title, html, confirmText = 'Confirmar', cancelText = 'Cancelar') {
        const result = await Swal.fire({
            title: title,
            html: html,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#4caf50',
            cancelButtonColor: '#ff5e6d',
            confirmButtonText: confirmText,
            cancelButtonText: cancelText
        });
        
        return result.isConfirmed;
    }
    
    static async showError(title, message, confirmText = 'Entendido') {
        return await Swal.fire({
            icon: 'error',
            title: title,
            text: message,
            confirmButtonColor: '#6e78ff',
            confirmButtonText: confirmText
        });
    }
    
    static async showSuccess(title, html, confirmText = 'Continuar', timer = null) {
        const config = {
            title: title,
            html: html,
            icon: 'success',
            confirmButtonColor: '#6e78ff',
            confirmButtonText: confirmText
        };
        
        if (timer) {
            config.timer = timer;
            config.timerProgressBar = true;
        }
        
        return await Swal.fire(config);
    }
}

// ===== VALIDACIONES UNIVERSALES =====
class ValidationManager {
    static validateQuantity(input, min = 0, max = null) {
        const value = parseInt(input.value) || min;
        
        if (value < min) {
            input.value = min;
            NotificationManager.showToast('warning', `La cantidad no puede ser menor a ${min}`);
            return false;
        }
        
        if (max && value > max) {
            input.value = max;
            NotificationManager.showToast('warning', `La cantidad no puede ser mayor a ${max}`);
            return false;
        }
        
        return true;
    }
    
    static validateDate(dateString) {
        if (!dateString) return false;
        
        try {
            const [year, month, day] = dateString.split('-').map(Number);
            const inputDate = new Date(year, month - 1, day);
            const today = new Date();
            today.setHours(23, 59, 59, 999);
            
            return inputDate <= today;
        } catch (error) {
            return false;
        }
    }
    
    static validateFieldValue(fieldConfig, value, selectedProvider = null) {
        switch (fieldConfig.fieldName) {
            case 'Serie':
            case 'Numero':
                if (!value || value.trim() === '') {
                    NotificationManager.showToast('error', 'El campo no puede estar vacío');
                    return false;
                }
                if (value.length > 50) {
                    NotificationManager.showToast('error', 'El valor es demasiado largo (máximo 50 caracteres)');
                    return false;
                }
                break;
                
            case 'MontoFactura':
                if (!value || value <= 0) {
                    NotificationManager.showToast('error', 'El monto debe ser mayor a 0');
                    return false;
                }
                if (value > 999999999.99) {
                    NotificationManager.showToast('error', 'El monto es demasiado grande');
                    return false;
                }
                break;
                
            case 'IdRazon':
                if (!value) {
                    NotificationManager.showToast('error', 'Debe seleccionar una razón social');
                    return false;
                }
                break;
                
            case 'FechaFactura':
                if (!value) {
                    NotificationManager.showToast('error', 'Debe seleccionar una fecha');
                    return false;
                }
                if (!this.validateDate(value)) {
                    NotificationManager.showToast('error', 'La fecha no puede ser futura');
                    return false;
                }
                break;
                
            case 'NIT':
                if (!value || value.trim() === '') {
                    NotificationManager.showToast('error', 'Debe ingresar un NIT');
                    return false;
                }
                if (!selectedProvider) {
                    NotificationManager.showToast('error', 'Debe seleccionar un proveedor válido con el NIT ingresado');
                    return false;
                }
                break;
        }
        
        return true;
    }
    
    static async validateCreditNoteExists(serie, numero, idFactura) {
        return await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
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
            return result.length > 0 ? result[0] : null;
        });
    }
}
// ===== INICIALIZACIÓN DEL DOM =====
document.addEventListener('DOMContentLoaded', () => {
    initializeElements();
    initializeApp();
    setupEventListeners();
    
    // Enfocar el primer input de búsqueda al cargar
    setTimeout(() => {
        if (searchSerie) {
            searchSerie.focus();
        }
    }, 100);
});

// Inicializar elementos del DOM
function initializeElements() {
    searchForm = document.getElementById('searchForm');
    searchSerie = document.getElementById('searchSerie');
    searchNumber = document.getElementById('searchNumber');
    searchButton = document.querySelector('.search-button');
    modificationBtn = document.getElementById('modificationBtn');
    refacturationBtn = document.getElementById('refacturationBtn');
    modificationReasonModal = document.getElementById('modificationReasonModal');
    closeModificationReasonModal = document.getElementById('closeModificationReasonModal');
    modificationReasonForm = document.getElementById('modificationReasonForm');
    refacturingReasonModal = document.getElementById('refacturingReasonModal');
    closeRefacturingReasonModal = document.getElementById('closeRefacturingReasonModal');
    refacturingReasonForm = document.getElementById('refacturingReasonForm');
    updateRefacturingBtn = document.getElementById('updateRefacturingBtn');
    refacturingUpdateRow = document.getElementById('refacturingUpdateRow');
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
}

// Configurar event listeners
function setupEventListeners() {
    // Event Listeners principales
    searchForm.addEventListener('submit', handleSearch);
    newSearchBtn.addEventListener('click', resetSearch);
    tryAgainBtn.addEventListener('click', resetSearch);
    addCreditNoteBtn.addEventListener('click', handleAddCreditNote);
    searchButton.addEventListener('mousedown', createRippleEffect);
    
    // Event Listeners del modal
    if (closeCreditNoteModal) closeCreditNoteModal.addEventListener('click', () => {
        ModalManager.closeModal('creditNoteModal', clearCreditNoteForm);
    });
    if (cancelCreditNote) cancelCreditNote.addEventListener('click', () => {
        ModalManager.closeModal('creditNoteModal', clearCreditNoteForm);
    });
    if (creditNoteForm) creditNoteForm.addEventListener('submit', handleCreditNoteSubmit);
    if (merchandiseBtn) merchandiseBtn.addEventListener('click', () => selectConceptType('mercaderia'));
    if (otherConceptsBtn) otherConceptsBtn.addEventListener('click', () => selectConceptType('otros'));
    if (modificationBtn) modificationBtn.addEventListener('click', handleModification);
    if (refacturationBtn) refacturationBtn.addEventListener('click', handleRefacturation);
    if (closeModificationReasonModal) closeModificationReasonModal.addEventListener('click', () => {
        ModalManager.closeModal('modificationReasonModal', () => {
            document.getElementById('modificationReasonForm').reset();
            selectedModificationReason = null;
        });
    });
    if (modificationReasonForm) modificationReasonForm.addEventListener('submit', handleModificationReasonSubmit);
    if (closeRefacturingReasonModal) closeRefacturingReasonModal.addEventListener('click', () => {
        ModalManager.closeModal('refacturingReasonModal', () => {
            document.getElementById('refacturingReasonForm').reset();
            selectedRefacturingReason = null;
        });
    });
    if (refacturingReasonForm) refacturingReasonForm.addEventListener('submit', handleRefacturingReasonSubmit);

    // Event listener para cancelar refacturación
    const cancelRefacturingReason = document.getElementById('cancelRefacturingReason');
    if (cancelRefacturingReason) cancelRefacturingReason.addEventListener('click', () => {
        ModalManager.closeModal('refacturingReasonModal', () => {
            document.getElementById('refacturingReasonForm').reset();
            selectedRefacturingReason = null;
        });
    });
    if (updateRefacturingBtn) updateRefacturingBtn.addEventListener('click', handleRefacturingUpdate);
}

// ===== INICIALIZACIÓN DE LA APLICACIÓN =====
function initializeApp() {
    animatePageElements();
    loadUserInfo();
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

// ===== BÚSQUEDA DE FACTURAS =====
async function handleSearch(e) {
    e.preventDefault();
    
    // Verificar que los elementos existen antes de acceder a sus valores
    const serieElement = document.getElementById('searchSerie');
    const numberElement = document.getElementById('searchNumber');
    
    if (!serieElement || !numberElement) {
        NotificationManager.showToast('error', 'Error: No se encontraron los campos de búsqueda');
        return;
    }
    
    const serieValue = serieElement.value.trim();
    const numberValue = numberElement.value.trim();
    
    if (!serieValue || !numberValue) {
        NotificationManager.showToast('error', 'Por favor ingrese tanto la serie como el número de la factura');
        shakeSearchPanel();
        return;
    }

    // Cambiar botón a estado de carga
    setLoadingState(true);
    
    try {
        const invoice = await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
            return await searchInvoice(connection, serieValue, numberValue);
        });
        
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
                    const branchName = await DatabaseManager.getBranchConnectionData(invoice.IdSucursalCori);
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

// Mostrar resultados de la factura
function displayInvoiceResults(invoice) {
    // Ocultar otros paneles
    notFoundPanel.style.display = 'none';
    
    // Ocultar el panel de búsqueda con animación
    hideSearchPanel();
    
    // Llenar los datos
    populateInvoiceData(invoice);
    
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
    }, 300);

    NotificationManager.showToast('success', 'Factura encontrada exitosamente');
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

    NotificationManager.showToast('warning', 'No se encontró ninguna factura con los criterios especificados');
}

// ===== GESTIÓN DE MODIFICACIÓN Y REFACTURACIÓN =====
async function handleModification() {
    if (!window.currentInvoice) {
        NotificationManager.showToast('error', 'No hay una factura seleccionada');
        return;
    }

    try {
        await SelectManager.loadModificationReasons();
        ModalManager.showModal('modificationReasonModal', 'modificationReason');
    } catch (error) {
        NotificationManager.showToast('error', 'Error al cargar los motivos de modificación: ' + error.message);
    }
}

async function handleRefacturation() {
    if (!window.currentInvoice) {
        NotificationManager.showToast('error', 'No hay una factura seleccionada');
        return;
    }

    try {
        await SelectManager.loadRefacturingReasons();
        ModalManager.showModal('refacturingReasonModal', 'refacturingReason');
    } catch (error) {
        NotificationManager.showToast('error', 'Error al cargar los motivos de refacturación: ' + error.message);
    }
}

// Manejar envío del formulario de motivo de modificación
function handleModificationReasonSubmit(e) {
    e.preventDefault();
    
    const reasonId = document.getElementById('modificationReason').value;
    const reasonText = document.getElementById('modificationReason').selectedOptions[0]?.text;
    
    if (!reasonId) {
        NotificationManager.showToast('error', 'Debe seleccionar un motivo de modificación');
        return;
    }
    
    // Guardar en window object para mayor persistencia
    window.selectedModificationReason = {
        id: reasonId,
        text: reasonText
    };
    
    selectedModificationReason = window.selectedModificationReason;
    
    // Cerrar modal
    ModalManager.closeModal('modificationReasonModal');
    
    // Habilitar modo modificación
    enableModificationMode();
}

// Manejar envío del formulario de motivo de refacturación
function handleRefacturingReasonSubmit(e) {
    e.preventDefault();
    
    const reasonId = document.getElementById('refacturingReason').value;
    const reasonText = document.getElementById('refacturingReason').selectedOptions[0]?.text;
    
    if (!reasonId) {
        NotificationManager.showToast('error', 'Debe seleccionar un motivo de refacturación');
        return;
    }
    
    // Guardar el motivo seleccionado
    window.selectedRefacturingReason = {
        id: reasonId,
        text: reasonText
    };
    
    selectedRefacturingReason = window.selectedRefacturingReason;
    
    // Cerrar modal
    ModalManager.closeModal('refacturingReasonModal');
    
    // Habilitar modo refacturación
    enableRefacturingMode();
}

// Habilitar modo modificación
function enableModificationMode() {
    isModificationMode = true;
    
    // Configurar campos editables
    setupEditableFields();
    
    // Cambiar apariencia de los campos editables
    const editableElements = document.querySelectorAll('.editable-field');
    editableElements.forEach(element => {
        element.style.border = '2px dashed var(--warning-color)';
        element.style.backgroundColor = 'rgba(255, 167, 38, 0.05)';
        element.style.cursor = 'pointer';
        
        // Agregar indicador visual de que es editable
        if (!element.querySelector('.edit-indicator')) {
            const indicator = document.createElement('span');
            indicator.className = 'edit-indicator';
            indicator.innerHTML = '✏️';
            indicator.style.cssText = `
                position: absolute;
                top: 2px;
                right: 5px;
                font-size: 10px;
                opacity: 0.7;
                pointer-events: none;
            `;
            element.style.position = 'relative';
            element.appendChild(indicator);
        }
    });
    
    NotificationManager.showToast('success', `Modo modificación habilitado: ${selectedModificationReason.text}`);
    showModificationBanner();
    makeFieldsImmediatelyEditable();
}

// Habilitar modo refacturación
function enableRefacturingMode() {
    isRefacturingMode = true;
    isModificationMode = false;
    
    // Guardar valores originales antes de limpiar
    saveOriginalFieldValues();
    
    // Inicializar campos de refacturación
    initializeRefacturingFields();
    
    // Limpiar los campos editables
    clearEditableFields();
    
    // Configurar campos para refacturación (no editables individualmente)
    setupRefacturingFields();
    
    // Mostrar el botón de actualización
    showRefacturingUpdateButton();
    
    NotificationManager.showToast('success', `Modo refacturación habilitado: ${selectedRefacturingReason.text}`);
    showRefacturingBanner();
}

// Configurar campos editables
function setupEditableFields() {
    if (!isModificationMode) {
        return;
    }
    
    const editableFields = [
        { id: 'invoiceSerie', type: 'text', fieldName: 'Serie', tipoCambio: 1 },
        { id: 'invoiceNumber', type: 'text', fieldName: 'Numero', tipoCambio: 2 },
        { id: 'socialReason', type: 'select', fieldName: 'IdRazon', tipoCambio: 3 },
        { id: 'invoiceAmount', type: 'number', fieldName: 'MontoFactura', tipoCambio: 4 },
        { id: 'invoiceDate', type: 'date', fieldName: 'FechaFactura', tipoCambio: 5 },
        { id: 'providerNit', type: 'provider-nit', fieldName: 'NIT', tipoCambio: 6 }
    ];

    editableFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.classList.add('editable-field');
        }
    });
}

// Configurar campos editables para refacturación
function setupEditableFieldsForRefactoring() {
    const editableFields = [
        { id: 'invoiceSerie', type: 'text', fieldName: 'Serie', tipoCambio: 1 },
        { id: 'invoiceNumber', type: 'text', fieldName: 'Numero', tipoCambio: 2 },
        { id: 'socialReason', type: 'select', fieldName: 'IdRazon', tipoCambio: 3 },
        { id: 'invoiceAmount', type: 'number', fieldName: 'MontoFactura', tipoCambio: 4 },
        { id: 'invoiceDate', type: 'date', fieldName: 'FechaFactura', tipoCambio: 5 },
        { id: 'providerNit', type: 'provider-nit', fieldName: 'NIT', tipoCambio: 6 }
    ];

    editableFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.classList.add('editable-field');
        }
    });
}

// Guardar valores originales de los campos
function saveOriginalFieldValues() {
    originalFieldValues = {
        invoiceSerie: document.getElementById('invoiceSerie').textContent,
        invoiceNumber: document.getElementById('invoiceNumber').textContent,
        socialReason: document.getElementById('socialReason').textContent,
        invoiceAmount: document.getElementById('invoiceAmount').textContent,
        invoiceDate: document.getElementById('invoiceDate').textContent,
        providerNit: document.getElementById('providerNit').textContent
    };
}

// Limpiar campos editables para refacturación
function clearEditableFields() {
    const fieldsTolear = [
        'invoiceSerie',
        'invoiceNumber', 
        'socialReason',
        'invoiceAmount',
        'invoiceDate',
        'providerNit'
    ];
    
    fieldsTolear.forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element) {
            element.textContent = '';
            element.style.minHeight = '20px';
            element.style.border = '1px dashed #ccc';
            element.style.padding = '5px';
            
            // Agregar placeholder visual
            const placeholder = document.createElement('span');
            placeholder.style.color = '#999';
            placeholder.style.fontStyle = 'italic';
            placeholder.textContent = 'Campo requerido - clic para editar';
            element.appendChild(placeholder);
        }
    });
}

// Hacer campos inmediatamente editables
function makeFieldsImmediatelyEditable() {
    const editableFields = [
        { id: 'invoiceSerie', type: 'text', fieldName: 'Serie', tipoCambio: 1 },
        { id: 'invoiceNumber', type: 'text', fieldName: 'Numero', tipoCambio: 2 },
        { id: 'socialReason', type: 'select', fieldName: 'IdRazon', tipoCambio: 3 },
        { id: 'invoiceAmount', type: 'number', fieldName: 'MontoFactura', tipoCambio: 4 },
        { id: 'invoiceDate', type: 'date', fieldName: 'FechaFactura', tipoCambio: 5 },
        { id: 'providerNit', type: 'provider-nit', fieldName: 'NIT', tipoCambio: 6 }
    ];

    editableFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.addEventListener('click', () => {
                if (isModificationMode && !isEditing) {
                    enableInlineEdit(element, field);
                }
            });
            
            element.title = 'Clic para editar';
        }
    });
}

// Hacer campos inmediatamente editables para refacturación
function makeFieldsImmediatelyEditableForRefactoring() {
    const editableFields = [
        { id: 'invoiceSerie', type: 'text', fieldName: 'Serie', tipoCambio: 1 },
        { id: 'invoiceNumber', type: 'text', fieldName: 'Numero', tipoCambio: 2 },
        { id: 'socialReason', type: 'select', fieldName: 'IdRazon', tipoCambio: 3 },
        { id: 'invoiceAmount', type: 'number', fieldName: 'MontoFactura', tipoCambio: 4 },
        { id: 'invoiceDate', type: 'date', fieldName: 'FechaFactura', tipoCambio: 5 },
        { id: 'providerNit', type: 'provider-nit', fieldName: 'NIT', tipoCambio: 6 }
    ];

    editableFields.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.addEventListener('click', () => {
                if (isRefacturingMode && !isEditing) {
                    enableInlineEditForRefactoring(element, field);
                }
            });
            
            element.title = 'Clic para editar (REQUERIDO)';
        }
    });
}
// ===== EDICIÓN INLINE =====
// Habilitar edición inline
// Habilitar edición inline
async function enableInlineEdit(element, fieldConfig) {
    if (isEditing) {
        NotificationManager.showToast('warning', 'Ya hay un campo en edición. Complete la edición actual primero.');
        return;
    }

    isEditing = true;
    currentEditingElement = element;
    
    const originalValue = getOriginalValue(element, fieldConfig);
    const currentDisplayValue = element.textContent.trim();
    
    // Crear el elemento de edición
    let editElement;
    
    if (fieldConfig.type === 'select' && fieldConfig.fieldName === 'IdRazon') {
        editElement = await SelectManager.loadSocialReasons(window.currentInvoice.IdRazon);
    } else if (fieldConfig.type === 'provider-nit') {
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
                NotificationManager.showToast('error', 'Debe seleccionar una razón social válida');
                return;
            }
            
        } else if (fieldConfig.type === 'provider-nit') {
            newValue = editElement.mainInput.value.trim();
            selectedProvider = editElement.selectedProvider;
            
            if (!selectedProvider) {
                NotificationManager.showToast('error', 'Debe seleccionar un proveedor válido');
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
            if (selectedProvider && selectedProvider.NIT === originalValue) {
                cancelEdit();
                NotificationManager.showToast('info', 'No se realizaron cambios');
                return;
            }
        } else {
            if (newValue.toString() === originalValue.toString()) {
                cancelEdit();
                NotificationManager.showToast('info', 'No se realizaron cambios');
                return;
            }
        }
        
        // Validaciones específicas
        if (!ValidationManager.validateFieldValue(fieldConfig, newValue, selectedProvider)) {
            return;
        }
        
        try {
            // Confirmar cambio
            const confirmed = await confirmChange(fieldConfig, currentDisplayValue, newDisplayValue, selectedProvider);
            if (!confirmed) {
                return;
            }
            
            // Mostrar loading durante la actualización
            NotificationManager.showLoading('Actualizando Sistema Completo...', `
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
            `);
            
            // Guardar en base de datos (central y sucursal)
            await saveFieldChange(fieldConfig, originalValue, newValue, selectedProvider);
            
            // Cerrar loading
            NotificationManager.closeLoading();
            
            // Actualizar la interfaz
            element.innerHTML = newDisplayValue;
            element.classList.add('field-updated');
            
            // Actualizar el objeto currentInvoice
            updateCurrentInvoiceObject(fieldConfig, newValue, newDisplayValue, selectedProvider);
            
            // Resetear estado
            isEditing = false;
            currentEditingElement = null;
            
            // Mensaje de éxito
            NotificationManager.showToast('success', '🎉 Sistema sincronizado exitosamente (Central + Sucursal)');
            
            // Quitar resaltado después de un tiempo
            setTimeout(() => {
                element.classList.remove('field-updated');
            }, 3000);
            
        } catch (error) {
            NotificationManager.closeLoading();
            NotificationManager.showToast('error', '❌ Error al sincronizar el sistema: ' + error.message);
        }
    };
    
    const cancelEdit = () => {
        element.innerHTML = originalHTML;
        isEditing = false;
        currentEditingElement = null;
    };
    
    // Event listeners para los botones
    const saveBtn = actionButtons.querySelector('.save-btn');
    const cancelBtn = actionButtons.querySelector('.cancel-btn');

    // Usar addEventListener con manejo mejorado de eventos
    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        
        // Deshabilitar botón temporalmente para evitar clics múltiples
        saveBtn.disabled = true;
        
        try {
            await handleSave();
        } finally {
            if (saveBtn) saveBtn.disabled = false;
        }
    }, { passive: false });

    cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        cancelEdit();
    }, { passive: false });

    // Event listener para Enter y Escape
    const keydownHandler = async (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            
            // Deshabilitar temporalmente para evitar múltiples ejecuciones
            if (!editElement.disabled) {
                editElement.disabled = true;
                try {
                    await handleSave();
                } finally {
                    if (editElement) editElement.disabled = false;
                }
            }
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelEdit();
        }
    };

    editElement.addEventListener('keydown', keydownHandler, { passive: false });

    // También agregar al elemento contenedor como respaldo para Escape
    element.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelEdit();
        }
    }, { passive: false, once: true });
}

// Función especial para editar en modo refacturación
async function enableInlineEditForRefactoring(element, fieldConfig) {
    if (isEditing) {
        NotificationManager.showToast('warning', 'Ya hay un campo en edición. Complete la edición actual primero.');
        return;
    }

    isEditing = true;
    currentEditingElement = element;
    
    const originalValue = getOriginalValueForRefactoring(fieldConfig);
    const currentValue = '';
    
    // Limpiar el placeholder
    element.innerHTML = '';
    
    // Crear el elemento de edición
    let editElement;
    
    if (fieldConfig.type === 'select' && fieldConfig.fieldName === 'IdRazon') {
        editElement = await SelectManager.loadSocialReasons('');
    } else if (fieldConfig.type === 'provider-nit') {
        editElement = await createProviderNitInput('');
    } else {
        editElement = createInputElement(fieldConfig.type, '');
    }
    
    // Reemplazar el contenido del span con el elemento de edición
    element.appendChild(editElement);
    
    // Agregar botones de acción
    const actionButtons = createActionButtons();
    element.appendChild(actionButtons);
    
    // Enfocar el elemento
    if (editElement.focus) {
        editElement.focus();
    }
    
    // Manejar eventos (lógica específica para refacturación)
    const handleSave = async () => {
        let newValue;
        let newDisplayValue;
        let selectedProvider = null;
        
        if (fieldConfig.type === 'select') {
            const selectedOption = editElement.options[editElement.selectedIndex];
            newValue = editElement.value;
            newDisplayValue = selectedOption ? selectedOption.text : '';
            
            if (!newValue) {
                NotificationManager.showToast('error', 'Debe seleccionar un valor para continuar con la refacturación');
                return;
            }
            
        } else if (fieldConfig.type === 'provider-nit') {
            newValue = editElement.mainInput.value.trim();
            selectedProvider = editElement.selectedProvider;
            
            if (!selectedProvider) {
                NotificationManager.showToast('error', 'Debe seleccionar un proveedor válido para continuar con la refacturación');
                return;
            }
            
            newDisplayValue = formatNIT(selectedProvider.NIT);
            
        } else if (fieldConfig.type === 'number') {
            newValue = parseFloat(editElement.value);
            if (!newValue || newValue <= 0) {
                NotificationManager.showToast('error', 'Debe ingresar un monto válido para continuar con la refacturación');
                return;
            }
            newDisplayValue = formatCurrency(newValue);
        } else if (fieldConfig.type === 'date') {
            newValue = editElement.value;
            if (!newValue) {
                NotificationManager.showToast('error', 'Debe seleccionar una fecha para continuar con la refacturación');
                return;
            }
            newDisplayValue = formatDate(newValue);
        } else {
            newValue = editElement.value.trim();
            if (!newValue) {
                NotificationManager.showToast('error', 'Este campo es requerido para continuar con la refacturación');
                return;
            }
            newDisplayValue = newValue;
        }
        
        // Validaciones específicas
        if (!ValidationManager.validateFieldValue(fieldConfig, newValue, selectedProvider)) {
            return;
        }
        
        try {
            // Confirmar cambio (usando valor original guardado)
            const confirmed = await confirmRefacturingChange(fieldConfig, originalValue, newDisplayValue, selectedProvider);
            if (!confirmed) {
                return;
            }
            
            // Mostrar loading durante la actualización
            NotificationManager.showLoading('Actualizando Sistema Completo...', `
                <div style="text-align: center; margin: 20px 0;">
                    <div class="loading-spinner"></div>
                    <p style="margin-top: 15px; font-weight: 600;">Refacturando datos en:</p>
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
            `);
            
            // Guardar en base de datos usando la lógica de refacturación
            await saveRefacturingFieldChange(fieldConfig, originalValue, newValue, selectedProvider);
            
            // Cerrar loading
            NotificationManager.closeLoading();
            
            // Actualizar la interfaz
            element.innerHTML = newDisplayValue;
            element.classList.add('field-updated');
            
            // Actualizar el objeto currentInvoice
            updateCurrentInvoiceObject(fieldConfig, newValue, newDisplayValue, selectedProvider);
            
            // Resetear estado
            isEditing = false;
            currentEditingElement = null;
            
            // Mensaje de éxito
            NotificationManager.showToast('success', '🎉 Campo refacturado exitosamente (Central + Sucursal)');
            
            // Quitar resaltado después de un tiempo
            setTimeout(() => {
                element.classList.remove('field-updated');
            }, 3000);
            
        } catch (error) {
            NotificationManager.closeLoading();
            NotificationManager.showToast('error', '❌ Error al refacturar: ' + error.message);
        }
    };
    
    const cancelEdit = () => {
        // En refacturación, volver a mostrar placeholder
        element.innerHTML = '';
        const placeholder = document.createElement('span');
        placeholder.style.color = '#999';
        placeholder.style.fontStyle = 'italic';
        placeholder.textContent = 'Campo requerido - clic para editar';
        element.appendChild(placeholder);
        
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

// ===== CREACIÓN DE ELEMENTOS DE EDICIÓN =====
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
            
            const result = await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
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
                return await connection.query(query, [nit, searchPattern, nit]);
            });
            
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
        }, 500);
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

// Crear botones de acción
function createActionButtons() {
    const container = document.createElement('div');
    container.className = 'inline-edit-actions';
    
    const saveBtn = document.createElement('button');
    saveBtn.type = 'button'; // CAMBIO: Especificar tipo
    saveBtn.className = 'save-btn';
    saveBtn.innerHTML = '<i class="fas fa-check"></i>';
    saveBtn.title = 'Guardar cambios';
    
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button'; // CAMBIO: Especificar tipo
    cancelBtn.className = 'cancel-btn';
    cancelBtn.innerHTML = '<i class="fas fa-times"></i>';
    cancelBtn.title = 'Cancelar edición';
    
    container.appendChild(saveBtn);
    container.appendChild(cancelBtn);
    
    return container;
}

// ===== FUNCIONES DE OBTENCIÓN DE VALORES =====
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

// Obtener valor original para refacturación
function getOriginalValueForRefactoring(fieldConfig) {
    switch (fieldConfig.fieldName) {
        case 'Serie':
            return window.currentInvoice.Serie || '';
        case 'Numero':
            return window.currentInvoice.Numero || '';
        case 'IdRazon':
            return window.currentInvoice.IdRazon || '';
        case 'MontoFactura':
            return window.currentInvoice.MontoFactura || 0;
        case 'FechaFactura':
            if (window.currentInvoice.FechaFactura) {
                const dateOnly = window.currentInvoice.FechaFactura.includes('T') 
                    ? window.currentInvoice.FechaFactura.split('T')[0] 
                    : window.currentInvoice.FechaFactura;
                return dateOnly;
            }
            return '';
        case 'NIT':
            return window.currentInvoice.NIT || '';
        default:
            return '';
    }
}

// ===== CONFIRMACIONES =====
// Confirmar cambio
async function confirmChange(fieldConfig, oldDisplayValue, newDisplayValue, selectedProvider = null) {
    let changeDetails = `
        <div style="text-align: left; margin: 20px 0;">
            <p><strong>Campo:</strong> ${getFieldDisplayName(fieldConfig.tipoCambio)}</p>
            <p><strong>Valor anterior:</strong> ${oldDisplayValue}</p>
            <p><strong>Valor nuevo:</strong> ${newDisplayValue}</p>
    `;
    
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
    
    return await NotificationManager.showConfirmation(
        '¿Confirmar cambio?',
        changeDetails,
        'Sí, guardar cambio',
        'Cancelar'
    );
}

// Confirmar cambio de refacturación
async function confirmRefacturingChange(fieldConfig, originalValue, newDisplayValue, selectedProvider = null) {
    let changeDetails = `
        <div style="text-align: left; margin: 20px 0;">
            <p><strong>Campo:</strong> ${getFieldDisplayName(fieldConfig.tipoCambio)}</p>
            <p><strong>Valor original:</strong> ${originalFieldValues[getFieldElementId(fieldConfig)] || 'No disponible'}</p>
            <p><strong>Valor nuevo:</strong> ${newDisplayValue}</p>
    `;
    
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
    
    changeDetails += `
            <hr style="margin: 15px 0;">
            <p style="color: #29b6f6; font-weight: 600;">
                <i class="fas fa-redo"></i> 
                Refacturación en progreso
            </p>
        </div>`;
    
    return await NotificationManager.showConfirmation(
        '¿Confirmar refacturación?',
        changeDetails,
        'Sí, refacturar',
        'Cancelar'
    );
}

// Función auxiliar para obtener ID del elemento por fieldConfig
function getFieldElementId(fieldConfig) {
    const mapping = {
        'Serie': 'invoiceSerie',
        'Numero': 'invoiceNumber',
        'IdRazon': 'socialReason',
        'MontoFactura': 'invoiceAmount',
        'FechaFactura': 'invoiceDate',
        'NIT': 'providerNit'
    };
    return mapping[fieldConfig.fieldName] || '';
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

// ===== GUARDADO EN BASE DE DATOS =====
// Guardar cambio en base de datos
async function saveFieldChange(fieldConfig, oldValue, newValue, selectedProvider = null) {
    try {
        // 1. ACTUALIZAR EN LA BASE DE DATOS CENTRAL (DSN=facturas)
        await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
            // Actualizar la factura en la base central
            await updateInvoiceField(connection, fieldConfig, newValue, selectedProvider);
            
            // Registrar el cambio en el historial
            await logFieldChange(connection, fieldConfig, oldValue, newValue, selectedProvider);
        });
        
        // 2. ACTUALIZAR EN LA BASE DE DATOS DE LA SUCURSAL (MySQL)
        await DatabaseManager.updateBranchTables(fieldConfig, newValue, selectedProvider);
        
    } catch (error) {
        throw error;
    }
}

// Guardar cambio de refacturación (usa TipoModificacion = '1')
async function saveRefacturingFieldChange(fieldConfig, oldValue, newValue, selectedProvider = null) {
    try {
        // 1. ACTUALIZAR EN LA BASE DE DATOS CENTRAL (DSN=facturas)
        await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
            // Actualizar la factura en la base central
            await updateInvoiceField(connection, fieldConfig, newValue, selectedProvider);
            
            // Registrar el cambio en el historial CON REFACTURACIÓN
            await logRefacturingFieldChange(connection, fieldConfig, oldValue, newValue, selectedProvider);
        });
        
        // 2. ACTUALIZAR EN LA BASE DE DATOS DE LA SUCURSAL (MySQL)
        await DatabaseManager.updateBranchTables(fieldConfig, newValue, selectedProvider);
        
    } catch (error) {
        throw error;
    }
}

// Actualizar campo en la tabla facturas_compras
async function updateInvoiceField(connection, fieldConfig, newValue, selectedProvider = null) {
    let updateQuery;
    let queryParams;
    
    if (fieldConfig.fieldName === 'IdRazon') {
        // Para razón social
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
        // Para cambio de proveedor
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
        // Para otros campos
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
    
    // Determinar qué tipo de modificación es
    let modificationReason = null;
    let tipoModificacion = '2'; // Por defecto modificación
    
    if (isRefacturingMode && selectedRefacturingReason) {
        modificationReason = selectedRefacturingReason;
        tipoModificacion = '1';
    } else if (isModificationMode && selectedModificationReason) {
        modificationReason = selectedModificationReason;
        tipoModificacion = '2';
    } else {
        modificationReason = window.selectedRefacturingReason || window.selectedModificationReason;
        tipoModificacion = window.selectedRefacturingReason ? '1' : '2';
    }
    
    let valorAnterior = oldValue.toString();
    let valorNuevo = newValue.toString();
    
    // Para cambios de proveedor, registrar información más detallada
    if (fieldConfig.fieldName === 'NIT' && selectedProvider) {
        const originalProvider = `${window.currentInvoice.Nombre} (${formatNIT(window.currentInvoice.NIT)})`;
        const newProvider = `${selectedProvider.Nombre} (${formatNIT(selectedProvider.NIT)})`;
        
        valorAnterior = originalProvider;
        valorNuevo = newProvider;
    }
    
    // Para cambios de razón social, guardar NOMBRES en lugar de IDs
    if (fieldConfig.fieldName === 'IdRazon') {
        try {
            const oldRazonName = window.currentInvoice.NombreRazon || 'No disponible';
            const newRazonQuery = `SELECT NombreRazon FROM razonessociales WHERE Id = ?`;
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
            NombreUsuario,
            TipoModificacion,
            IdRazonModificacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const insertParams = [
        fieldConfig.tipoCambio,
        getFieldDisplayName(fieldConfig.tipoCambio),
        valorAnterior,
        valorNuevo,
        window.currentInvoice.IdInventory || '',
        window.currentInvoice.IdSucursalCori || 0,
        window.currentInvoice.NombreSucursal || '',
        window.currentInvoice.Id,
        parseInt(userId),
        userName,
        tipoModificacion, // '1' para refacturación, '2' para modificación
        modificationReason ? modificationReason.id : null
    ];
    
    try {
        const result = await connection.query(insertQuery, insertParams);
        return result;
    } catch (error) {
        throw error;
    }
}

// Registrar cambio de refacturación en historial
async function logRefacturingFieldChange(connection, fieldConfig, oldValue, newValue, selectedProvider = null) {
    const userId = localStorage.getItem('userId') || '0';
    const userName = localStorage.getItem('userName') || 'Usuario Desconocido';
    
    let valorAnterior = oldValue.toString();
    let valorNuevo = newValue.toString();
    
    // Para cambios de proveedor, registrar información más detallada
    if (fieldConfig.fieldName === 'NIT' && selectedProvider) {
        const originalProvider = `${window.currentInvoice.Nombre} (${formatNIT(window.currentInvoice.NIT)})`;
        const newProvider = `${selectedProvider.Nombre} (${formatNIT(selectedProvider.NIT)})`;
        
        valorAnterior = originalProvider;
        valorNuevo = newProvider;
    }
    
    // Para cambios de razón social, guardar NOMBRES en lugar de IDs
    if (fieldConfig.fieldName === 'IdRazon') {
        try {
            const oldRazonName = window.currentInvoice.NombreRazon || 'No disponible';
            const newRazonQuery = `SELECT NombreRazon FROM razonessociales WHERE Id = ?`;
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
            NombreUsuario,
            TipoModificacion,
            IdRazonModificacion
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    // Usar selectedRefacturingReason en lugar de selectedModificationReason
    const refacturingReason = window.selectedRefacturingReason || selectedRefacturingReason;
    
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
            userName,
            '1', // TipoModificacion para refacturación
            refacturingReason ? refacturingReason.id : null // IdRazonModificacion
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

// ===== FUNCIONES DE BANNER Y DESACTIVACIÓN =====
function showModificationBanner() {
    // Crear banner si no existe
    let banner = document.getElementById('modificationBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'modificationBanner';
        banner.className = 'modification-banner';
        banner.innerHTML = `
            <i class="fas fa-edit" style="font-size: 20px;"></i>
            <div class="banner-content">
                <div class="banner-title">Modo Modificación Activo</div>
                <p class="banner-subtitle">Motivo: ${selectedModificationReason.text}</p>
                <small style="font-size: 12px; opacity: 0.8;">
                    <i class="fas fa-info-circle"></i> 
                    Haz clic en cualquier campo naranja para editarlo
                </small>
            </div>
            <button onclick="disableModificationMode()" class="deactivate-btn">
                <i class="fas fa-times"></i> Desactivar
            </button>
        `;
        
        // Insertar después del panel header
        const resultsPanel = document.getElementById('resultsPanel');
        const panelHeader = resultsPanel.querySelector('.panel-header');
        panelHeader.insertAdjacentElement('afterend', banner);
    }
}

function showRefacturingBanner() {
    // Crear banner si no existe
    let banner = document.getElementById('refacturingBanner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'refacturingBanner';
        banner.className = 'refactoring-banner';
        banner.innerHTML = `
            <i class="fas fa-redo" style="font-size: 20px;"></i>
            <div class="banner-content">
                <div class="banner-title">Modo Refacturación Activo</div>
                <p class="banner-subtitle">Motivo: ${selectedRefacturingReason.text}</p>
                <small style="font-size: 12px; opacity: 0.8;">
                    <i class="fas fa-exclamation-triangle"></i> 
                    Todos los campos han sido limpiados y deben ser rellenados
                </small>
            </div>
            <button onclick="disableRefacturingMode()" class="deactivate-btn">
                <i class="fas fa-times"></i> Desactivar
            </button>
        `;
        
        // Insertar después del panel header
        const resultsPanel = document.getElementById('resultsPanel');
        const panelHeader = resultsPanel.querySelector('.panel-header');
        panelHeader.insertAdjacentElement('afterend', banner);
    }
}

// Desactivar modo modificación
function disableModificationMode() {
    isModificationMode = false;
    selectedModificationReason = null;
    
    // Remover estilos de campos editables
    const editableElements = document.querySelectorAll('.editable-field');
    editableElements.forEach(element => {
        element.style.border = '';
        element.style.backgroundColor = '';
        element.style.cursor = '';
        element.style.position = '';
        element.classList.remove('editable-field');
        element.title = '';
        
        // Remover indicador de edición
        const indicator = element.querySelector('.edit-indicator');
        if (indicator) {
            indicator.remove();
        }
        
        // Remover todos los event listeners
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
    });
    
    // Remover banner
    const banner = document.getElementById('modificationBanner');
    if (banner) {
        banner.remove();
    }
    
    NotificationManager.showToast('info', 'Modo modificación desactivado');
}

// Desactivar modo refacturación
function disableRefacturingMode() {
    isRefacturingMode = false;
    selectedRefacturingReason = null;
    
    // Ocultar botón de actualización
    hideRefacturingUpdateButton();
    
    // Restaurar valores originales
    restoreOriginalFieldValues();
    
    // Limpiar datos de refacturación
    refacturingFields = {};
    refacturingCompletedFields = 0;
    
    // Remover estilos de campos editables
    const editableElements = document.querySelectorAll('.refacturation-field-pending, .refacturation-field-completed');
    editableElements.forEach(element => {
        element.style.border = '';
        element.style.backgroundColor = '';
        element.style.cursor = '';
        element.style.position = '';
        element.classList.remove('refacturation-field-pending', 'refacturation-field-completed');
        element.title = '';
        
        // Remover event listeners
        const newElement = element.cloneNode(true);
        element.parentNode.replaceChild(newElement, element);
    });
    
    // Remover banner
    const banner = document.getElementById('refacturingBanner');
    if (banner) {
        banner.remove();
    }
    
    NotificationManager.showToast('info', 'Modo refacturación desactivado');
}

function restoreOriginalFieldValues() {
    Object.keys(originalFieldValues).forEach(fieldId => {
        const element = document.getElementById(fieldId);
        if (element && originalFieldValues[fieldId]) {
            element.textContent = originalFieldValues[fieldId];
        }
    });
}
// ===== GESTIÓN DE NOTAS DE CRÉDITO =====
async function handleAddCreditNote() {
    if (!window.currentInvoice) {
        NotificationManager.showToast('error', 'No hay una factura seleccionada');
        return;
    }

    try {
        // Cargar tipos de nota de crédito
        await SelectManager.loadCreditNoteTypes();
        
        // Llenar información de la factura original
        fillOriginalInvoiceInfo();
        
        // NUEVO: Verificar si existen notas de crédito para esta factura
        await checkExistingCreditNotes();
        
        // Mostrar el modal
        ModalManager.showModal('creditNoteModal', 'creditNoteType');
        
    } catch (error) {
        handleCreditNoteError(error);
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

// Limpiar formulario de nota de crédito
function clearCreditNoteForm() {
    creditNoteForm.reset();
    
    // Remover selección de conceptos
    merchandiseBtn.classList.remove('selected');
    otherConceptsBtn.classList.remove('selected');
    
    // Limpiar variable de concepto seleccionado
    window.selectedConcept = null;
    
    // NUEVO: Limpiar notificación de notas existentes
    hideExistingCreditNotesNotification();
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
        NotificationManager.showToast('error', 'Debe seleccionar un tipo de concepto (Mercadería u Otros conceptos)');
        return;
    }
    const formData = getCreditNoteFormData();
    const isValid = await validateCreditNoteData(formData);
    if (!isValid) {
        return;
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
    // Validaciones básicas
    if (!data.typeId) {
        NotificationManager.showToast('error', 'Debe seleccionar un tipo de nota de crédito');
        document.getElementById('creditNoteType').focus();
        return false;
    }
    
    if (!data.amount || data.amount <= 0) {
        NotificationManager.showToast('error', 'El monto debe ser mayor a 0');
        document.getElementById('creditNoteAmount').focus();
        return false;
    }
    
    if (data.amount > data.originalInvoice.MontoFactura) {
        NotificationManager.showToast('error', 'El monto de la nota de crédito no puede ser mayor al monto de la factura original');
        document.getElementById('creditNoteAmount').focus();
        return false;
    }
    
    if (!data.serie) {
        NotificationManager.showToast('error', 'Debe ingresar la serie de la nota');
        document.getElementById('creditNoteSerie').focus();
        return false;
    }
    
    if (!data.number) {
        NotificationManager.showToast('error', 'Debe ingresar el número de la nota');
        document.getElementById('creditNoteNumber').focus();
        return false;
    }
    
    if (!data.date) {
        NotificationManager.showToast('error', '⚠️ Debe seleccionar la fecha de la nota de crédito');
        document.getElementById('creditNoteDate').focus();
        
        // Resaltar visualmente el campo
        const dateField = document.getElementById('creditNoteDate');
        dateField.style.borderColor = '#ff5e6d';
        dateField.style.boxShadow = '0 0 0 3px rgba(255, 94, 109, 0.2)';
        
        dateField.addEventListener('input', function() {
            this.style.borderColor = '';
            this.style.boxShadow = '';
        }, { once: true });
        
        return false;
    }
    
    // Validar que la fecha no sea futura
    if (!ValidationManager.validateDate(data.date)) {
        NotificationManager.showToast('error', 'La fecha de la nota no puede ser futura');
        document.getElementById('creditNoteDate').focus();
        return false;
    }
    
    // Verificar duplicidad
    try {
        NotificationManager.showLoading('Validando...', 'Verificando que la nota de crédito no exista');
        
        const existingNote = await ValidationManager.validateCreditNoteExists(
            data.serie, 
            data.number, 
            data.originalInvoice.Id
        );
        
        NotificationManager.closeLoading();
        
        if (existingNote) {
            // CAMBIO: Usar Swal directamente con z-index personalizado
            const result = await Swal.fire({
                title: '⚠️ Nota de Crédito Duplicada',
                html: `
                    <div style="text-align: left; margin: 20px 0;">
                        <p><strong>Ya existe una nota de crédito con estos datos:</strong></p>
                        <hr style="margin: 15px 0;">
                        <p><strong>Serie-Número:</strong> ${existingNote.Serie}-${existingNote.Numero}</p>
                        <p><strong>Factura:</strong> ${data.originalInvoice.Serie}-${data.originalInvoice.Numero}</p>
                        <p><strong>Proveedor:</strong> ${existingNote.Proveedor}</p>
                        <p><strong>Monto:</strong> ${formatCurrency(existingNote.Monto)}</p>
                        <p><strong>Fecha:</strong> ${formatDate(existingNote.FechaNotaCredito)}</p>
                        <hr style="margin: 15px 0;">
                        <p style="color: #ff9800; font-weight: 600;">
                            <i class="fas fa-exclamation-triangle"></i> 
                            ¿Desea continuar a pesar del duplicado?
                        </p>
                        <p style="color: #6c757d; font-size: 14px; font-style: italic;">
                            Nota: Se guardará la nueva nota de crédito con los mismos datos.
                        </p>
                    </div>
                `,
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#ff9800',
                cancelButtonColor: '#6c757d',
                confirmButtonText: 'Sí, continuar',
                cancelButtonText: 'Cancelar',
                allowOutsideClick: false,
                allowEscapeKey: true,
                // SOLUCIÓN: Z-index más alto que los modales
                customClass: {
                    container: 'swal2-container-front'
                },
                didOpen: () => {
                    // Asegurar z-index máximo
                    const swalContainer = document.querySelector('.swal2-container');
                    if (swalContainer) {
                        swalContainer.style.zIndex = '99999';
                    }
                }
            });
            
            const shouldContinue = result.isConfirmed;
            
            if (!shouldContinue) {
                // Si elige cancelar, enfocar el campo serie para editar
                document.getElementById('creditNoteSerie').focus();
                document.getElementById('creditNoteSerie').select();
                return false;
            }
            
            // Si elige continuar, seguir con la validación normal
            NotificationManager.showToast('info', 'Continuando con nota de crédito duplicada');
        }
        
        return true;
        
    } catch (error) {
        NotificationManager.closeLoading();
        await NotificationManager.showError('Error de Validación', 'Error al validar la nota de crédito. Intente nuevamente.');
        return false;
    }
}

// Confirmar creación de nota de crédito
function confirmCreditNoteCreation(data) {
    const conceptText = data.conceptType === 'mercaderia' ? 'Mercadería' : 'Otros Conceptos';
    
    // Cerrar el modal de nota de crédito ANTES de mostrar la confirmación
    ModalManager.closeModal('creditNoteModal', clearCreditNoteForm);
    
    // Pequeña pausa para que termine la animación de cierre
    setTimeout(async () => {
        const confirmed = await NotificationManager.showConfirmation('¿Confirmar Nota de Crédito?', `
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
        `, 'Sí, continuar', 'Cancelar');
        
        if (confirmed) {
            // Proceder según el tipo de concepto seleccionado
            if (data.conceptType === 'mercaderia') {
                proceedWithMerchandiseWithLoading(data);
            } else {
                proceedWithOtherConcepts(data);
            }
        } else {
            // Si cancela, volver a mostrar el modal de nota de crédito
            setTimeout(() => {
                ModalManager.showModal('creditNoteModal', 'creditNoteType');
                restoreCreditNoteFormData(data);
            }, 100);
        }
    }, 350);
}

// Restaurar datos del formulario de nota de crédito
function restoreCreditNoteFormData(data) {
    document.getElementById('creditNoteType').value = data.typeId;
    document.getElementById('creditNoteAmount').value = data.amount;
    document.getElementById('creditNoteSerie').value = data.serie;
    document.getElementById('creditNoteNumber').value = data.number;
    document.getElementById('creditNoteDate').value = data.date;
    
    if (data.conceptType === 'mercaderia') {
        merchandiseBtn.classList.add('selected');
        window.selectedConcept = 'mercaderia';
    } else if (data.conceptType === 'otros') {
        otherConceptsBtn.classList.add('selected');
        window.selectedConcept = 'otros';
    }
}

// ===== GESTIÓN DE MERCADERÍA =====
// Proceder con mercadería con loading
async function proceedWithMerchandiseWithLoading(data) {
    window.currentCreditNote = data;
    
    NotificationManager.showLoading('Cargando productos...', `
        <div style="display: flex; flex-direction: column; align-items: center; gap: 20px;">
            <div class="loading-spinner"></div>
            <p>Conectando a la base de datos de la sucursal</p>
            <p style="font-size: 14px; color: #6c757d;">Por favor espere...</p>
        </div>
    `);
    
    try {
        if (!window.branchConnectionData) {
            throw new Error('No se encontraron los datos de conexión de la sucursal');
        }
        
        if (!data.originalInvoice.IdInventory) {
            throw new Error('No se encontró el ID de inventario en la factura');
        }
        
        await loadInventoryProducts();
        NotificationManager.closeLoading();
        
        setTimeout(() => {
            createMerchandiseModal();
        }, 200);
        
    } catch (error) {
        NotificationManager.closeLoading();
        
        setTimeout(() => {
            NotificationManager.showError('Error al cargar productos', error.message);
        }, 100);
    }
}

// Cargar productos del inventario usando MySQL2
async function loadInventoryProducts() {
    const connectionData = window.branchConnectionData;
    const inventoryId = window.currentCreditNote.originalInvoice.IdInventory;
    
    const connectionConfig = {
        host: connectionData.server,
        database: connectionData.database,
        user: connectionData.user,
        password: connectionData.password,
        port: 3306,
        connectTimeout: 10000
    };
    
    const rows = await DatabaseManager.executeWithConnection(connectionConfig, async (connection) => {
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
        
        // CAMBIO: Usar execute y destructuring para MySQL2
        const [rows] = await connection.execute(query, [inventoryId]);
        return rows;
    });
    
    window.inventoryProducts = rows;
    window.filteredProducts = rows;
    
    return rows;
}

// Crear modal de mercadería
function createMerchandiseModal() {
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
                    <div class="product-search-section">
                        <div class="search-input-group">
                            <div class="search-input-icon">
                                <i class="fas fa-search"></i>
                            </div>
                            <input type="text" id="productSearchInput" placeholder="Buscar por UPC o descripción...">
                            <div class="search-input-line"></div>
                        </div>
                    </div>
                    
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
    ModalManager.showModal('merchandiseModal', 'productSearchInput');
}

// Cerrar modal de mercadería
function closeMerchandiseModalFunc() {
    removeF1ProductSearch();
    
    if (merchandiseModal) {
        ModalManager.removeModal('merchandiseModal');
        merchandiseModal = null;
    }
}

// Mostrar productos
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
        input.addEventListener('input', (e) => ValidationManager.validateQuantity(e.target, 0));
        input.addEventListener('change', (e) => ValidationManager.validateQuantity(e.target, 0));
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
        NotificationManager.showToast('error', 'Debe seleccionar al menos un producto con cantidad mayor a 0');
        return;
    }
    
    window.selectedMerchandise = selectedProducts;
    
    closeMerchandiseModalFunc();
    
    setTimeout(async () => {
        const totalItems = selectedProducts.reduce((sum, product) => sum + product.quantityToReturn, 0);
        
        const confirmed = await NotificationManager.showConfirmation('¿Confirmar selección?', `
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
        `, 'Sí, guardar', 'Cancelar');
        
        if (confirmed) {
            NotificationManager.showLoading('Guardando...', 'Por favor espere mientras se guarda la nota de crédito y los productos.');
            
            const success = await saveMerchandiseCreditNote(window.currentCreditNote, selectedProducts);
            
            NotificationManager.closeLoading();
            
            if (success) {
                setTimeout(() => {
                    resetToInitialStateComplete();
                }, 1500);
            }
            
        } else {
            setTimeout(() => {
                createMerchandiseModal();
                restoreMerchandiseSelection(selectedProducts);
            }, 100);
        }
    }, 350);
}

function restoreMerchandiseSelection(selectedProducts) {
    setTimeout(() => {
        selectedProducts.forEach(product => {
            const input = document.querySelector(`input[data-upc="${product.Upc}"]`);
            if (input) {
                input.value = product.quantityToReturn;
            }
        });
    }, 100);
}

// ===== FUNCIONALIDAD F1 - PRODUCTOS ADICIONALES =====
function setupF1ProductSearch() {
    document.addEventListener('keydown', handleF1KeyPress);
}

function removeF1ProductSearch() {
    document.removeEventListener('keydown', handleF1KeyPress);
}

function handleF1KeyPress(event) {
    const merchandiseModal = document.getElementById('merchandiseModal');
    if (!merchandiseModal || !merchandiseModal.classList.contains('show')) {
        return;
    }
    
    if (event.key === 'F1') {
        event.preventDefault();
        openAdditionalProductsModal();
    }
}

async function openAdditionalProductsModal() {
    try {
        NotificationManager.showLoading('Preparando búsqueda...', 'Cargando catálogo de productos');
        
        await createAdditionalProductsModal();
        
        NotificationManager.closeLoading();
        
        ModalManager.showModal('additionalProductsModal', 'additionalProductSearch');
        
    } catch (error) {
        NotificationManager.closeLoading();
        NotificationManager.showToast('error', 'Error al cargar el catálogo de productos: ' + error.message);
    }
}

// ===== OTROS CONCEPTOS =====
function proceedWithOtherConcepts(data) {
    window.currentCreditNote = data;
    showOtherConceptsModal();
}

function showOtherConceptsModal() {
    createOtherConceptsModal();
}

function createOtherConceptsModal() {
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
    
    document.body.insertAdjacentHTML('beforeend', modalHTML);
    
    const otherConceptsModal = document.getElementById('otherConceptsModal');
    const closeOtherConceptsModal = document.getElementById('closeOtherConceptsModal');
    const observationText = document.getElementById('observationText');
    const charCount = document.getElementById('charCount');
    const otherConceptsForm = document.getElementById('otherConceptsForm');
    
    // Event listeners
    closeOtherConceptsModal.addEventListener('click', () => ModalManager.removeModal('otherConceptsModal'));
    document.getElementById('cancelOtherConcepts').addEventListener('click', () => ModalManager.removeModal('otherConceptsModal'));
    document.getElementById('saveOtherConcepts').addEventListener('click', saveOtherConceptsNote);
    otherConceptsForm.addEventListener('submit', handleOtherConceptsSubmit);
    
    // Contador de caracteres
    observationText.addEventListener('input', updateCharacterCount);
    
    // Cerrar modal al hacer clic fuera
    otherConceptsModal.addEventListener('click', (e) => {
        if (e.target === otherConceptsModal) {
            ModalManager.removeModal('otherConceptsModal');
        }
    });
    
    // Mostrar modal con animación
    ModalManager.showModal('otherConceptsModal', 'observationText');
}

// Actualizar contador de caracteres
function updateCharacterCount() {
    const observationText = document.getElementById('observationText');
    const charCount = document.getElementById('charCount');
    
    if (observationText && charCount) {
        const currentLength = observationText.value.length;
        charCount.textContent = currentLength;
        
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
        NotificationManager.showToast('error', 'Debe ingresar una observación para la nota de crédito');
        observationText.focus();
        return;
    }
    
    if (observation.length < 10) {
        NotificationManager.showToast('error', 'La observación debe tener al menos 10 caracteres');
        observationText.focus();
        return;
    }
    
    // Mostrar confirmación
    NotificationManager.showConfirmation('¿Guardar Nota de Crédito?', `
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
    `, 'Sí, guardar', 'Cancelar').then(async (confirmed) => {
        if (confirmed) {
            ModalManager.removeModal('otherConceptsModal');
            
            NotificationManager.showLoading('Guardando...', 'Por favor espere mientras se guarda la nota de crédito.');
            
            const success = await saveOtherConceptsCreditNote(window.currentCreditNote, observation);
            
            NotificationManager.closeLoading();
        }
    });
}

// ===== GUARDADO EN BASE DE DATOS =====
// Guardar nota de crédito - Otros Conceptos
async function saveOtherConceptsCreditNote(data, observation) {
    try {
        const result = await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
            const creditNoteData = await prepareCreditNoteData(data, observation);
            
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
            
            return await connection.query(insertQuery, [
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
        });
        
        showSaveSuccessMessage(data, 'Otros Conceptos');
        
        setTimeout(() => {
            resetToInitialStateComplete();
        }, 1500);
        
        return true;
        
    } catch (error) {
        showSaveErrorMessage(error);
        return false;
    }
}

// Guardar nota de crédito - Mercadería
async function saveMerchandiseCreditNote(data, selectedProducts) {
    try {
        const result = await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
            const creditNoteData = await prepareCreditNoteData(data, 'Devolución de productos');
            
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
            const getIdQuery = `SELECT LAST_INSERT_ID() as IdNTCProveedor`;
            const idResult = await connection.query(getIdQuery);
            const idNTCProveedor = idResult[0].IdNTCProveedor;
            
            // Insertar productos en NCTProveedoresDetalle
            await saveProductDetails(connection, idNTCProveedor, selectedProducts);
            
            return result;
        });
        
        showSaveSuccessMessage(data, 'Mercadería', selectedProducts.length);
        
        return true;
        
    } catch (error) {
        showSaveErrorMessage(error);
        return false;
    }
}

// Preparar datos de la nota de crédito
async function prepareCreditNoteData(data, observaciones) {
    const userId = localStorage.getItem('userId') || '0';
    const userName = localStorage.getItem('userName') || 'Usuario Desconocido';
    
    const facturaData = await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
        const facturaQuery = `SELECT IdProveedor FROM facturas_compras WHERE Id = ?`;
        const result = await connection.query(facturaQuery, [data.originalInvoice.Id]);
        return result[0];
    });
    
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
    
    NotificationManager.showSuccess('¡Nota de Crédito Guardada!', `
        <div style="text-align: left; margin: 20px 0;">
            <p><strong>Serie-Número:</strong> ${data.serie}-${data.number}</p>
            <p><strong>Monto:</strong> ${formatCurrency(data.amount)}</p>
            <p><strong>Tipo:</strong> ${tipo}</p>
            <hr style="margin: 15px 0;">
            <p style="color: #4caf50; font-weight: 600;">${detailMessage}</p>
        </div>
    `, 'Continuar', 3000);
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
    
    NotificationManager.showError('Error al Guardar', errorMessage);
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
    
    NotificationManager.showError('Error en Nota de Crédito', errorMessage);
}

// ===== NAVEGACIÓN Y RESET =====
// Resetear búsqueda
function resetSearch() {
    const serieElement = document.getElementById('searchSerie');
    const numberElement = document.getElementById('searchNumber');
    
    if (serieElement) serieElement.value = '';
    if (numberElement) numberElement.value = '';
    
    hideAllResultPanels();
    showSearchPanel();
    disableModificationMode();
    disableRefacturingMode();
    
    window.currentInvoice = null;
    isEditing = false;
    currentEditingElement = null;
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
    
    hideAllResultPanels();
    showSearchPanel();
    
    setTimeout(() => {
        NotificationManager.showToast('success', 'Puede realizar una nueva búsqueda de factura');
    }, 800);
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
        
        setTimeout(() => {
            const serieElement = document.getElementById('searchSerie');
            if (serieElement) {
                serieElement.focus();
            }
        }, 100);
        
        setTimeout(() => {
            searchPanel.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'start' 
            });
        }, 200);
    }, 50);
}

// ===== FUNCIONES UTILITARIAS =====
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
    
    const nitString = String(nit).trim();
    
    if (!nitString) return '-';
    
    if (nitString.includes('-')) {
        return nitString;
    }
    
    if (nitString.toUpperCase().endsWith('K')) {
        const nitNumber = nitString.slice(0, -1);
        return `${nitNumber}-K`;
    }
    
    if (/^\d+$/.test(nitString) && nitString.length > 1) {
        if (nitString.length >= 7) {
            const nitNumber = nitString.slice(0, -1);
            const verifier = nitString.slice(-1);
            return `${nitNumber}-${verifier}`;
        }
    }
    
    return nitString;
}

// Formatear fecha
function formatDate(dateString) {
    if (!dateString) return '-';
    
    try {
        let dateOnly = dateString;
        if (dateString.includes('T')) {
            dateOnly = dateString.split('T')[0];
        }
        
        const [year, month, day] = dateOnly.split('-').map(Number);
        const date = new Date(year, month - 1, day); 
        
        if (isNaN(date.getTime())) {
            return dateString;
        }
        
        return new Intl.DateTimeFormat('es-GT', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        }).format(date);
        
    } catch (error) {
        return dateString;
    }
}

// Manejar errores de búsqueda
function handleSearchError(error) {
    let errorMessage = 'Error al buscar la factura. ';
    
    if (error.message && error.message.includes('connection')) {
        errorMessage += 'Verifique la conexión a la base de datos.';
    } else if (error.message && error.message.includes('timeout')) {
        errorMessage += 'La consulta tardó demasiado tiempo. Intente nuevamente.';
    } else {
        errorMessage += 'Por favor intente nuevamente.';
    }
    
    NotificationManager.showError('Error de búsqueda', errorMessage);
    shakeSearchPanel();
}

// ===== FUNCIONES ADICIONALES (PARA MODAL DE PRODUCTOS ADICIONALES) =====
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
        
        // Limpiar y preparar términos de búsqueda
        const searchTerms = prepareSearchTerms(query);
        
        // Construir consulta dinámica
        const { searchQuery, searchParams } = buildDynamicSearchQuery(searchTerms);
        
        const [rows] = await connection.execute(searchQuery, searchParams);
        
        // Mostrar resultados
        displayAdditionalProducts(rows, query);
        
    } catch (error) {
        showAdditionalSearchError(error.message);
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (closeError) {
                // Silenciar error de cierre
            }
        }
    }
}
function prepareSearchTerms(query) {
    return query
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Quitar tildes
        .replace(/[^\w\s]/g, ' ') // Reemplazar caracteres especiales por espacios
        .split(/\s+/) // Dividir por espacios
        .filter(term => term.length >= 2) // Solo términos de 2+ caracteres
        .slice(0, 6); // Máximo 6 términos para evitar consultas muy complejas
}
function buildDynamicSearchQuery(searchTerms) {
    if (searchTerms.length === 0) {
        return {
            searchQuery: `
                SELECT productos.Upc, productos.DescLarga
                FROM productos
                WHERE 1=0
            `,
            searchParams: []
        };
    }
    
    // Construir condiciones de búsqueda
    let conditions = [];
    let params = [];
    
    searchTerms.forEach(term => {
        // Buscar en UPC (exacto y parcial)
        conditions.push(`productos.Upc LIKE ?`);
        params.push(`%${term}%`);
        
        // Buscar en descripción (con normalización)
        conditions.push(`LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
            productos.DescLarga,
            'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u')
        ) LIKE ?`);
        params.push(`%${term}%`);
    });
    
    // Construir consulta final
    const searchQuery = `
        SELECT DISTINCT
            productos.Upc,
            productos.DescLarga,
            (
                CASE 
                    WHEN productos.Upc = ? THEN 100
                    WHEN productos.Upc LIKE ? THEN 90
                    ${searchTerms.map(() => `WHEN LOWER(productos.DescLarga) LIKE ? THEN 80`).join(' ')}
                    ELSE 50
                END
                ${searchTerms.map(() => `+ (CASE WHEN LOWER(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
                    productos.DescLarga,
                    'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u')
                ) LIKE ? THEN 10 ELSE 0 END)`).join(' ')}
            ) as relevance_score
        FROM productos
        WHERE (${conditions.join(' OR ')})
        ORDER BY relevance_score DESC, productos.DescLarga ASC
        LIMIT 50
    `;
    
    // Parámetros para scoring
    const scoringParams = [
        searchTerms[0], // UPC exacto
        `${searchTerms[0]}%`, // UPC que empiece con el primer término
        ...searchTerms.map(term => `%${term}%`), // Descripción con cada término
        ...searchTerms.map(term => `%${term}%`)  // Para el scoring adicional
    ];
    
    return {
        searchQuery,
        searchParams: [...scoringParams, ...params]
    };
}
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
function highlightSearchTerm(text, term) {
    if (!term) return text;
    
    // Preparar términos de búsqueda para highlighting
    const searchTerms = prepareSearchTerms(term);
    let highlightedText = text;
    
    searchTerms.forEach(searchTerm => {
        const regex = new RegExp(`(${escapeRegExp(searchTerm)})`, 'gi');
        highlightedText = highlightedText.replace(regex, '<mark>$1</mark>');
    });
    
    return highlightedText;
}
function escapeRegExp(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
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
function removeSelectedAdditionalProduct(index) {
    const product = window.selectedAdditionalProducts[index];
    window.selectedAdditionalProducts.splice(index, 1);
    updateSelectedAdditionalDisplay();
    showInfoToast(`Producto removido: ${product.Upc}`);
}
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
//Funcion de la refacturaciòn//

// Inicializar campos de refacturación
function initializeRefacturingFields() {
    refacturingFields = {
        invoiceSerie: { value: '', completed: false, required: true },
        invoiceNumber: { value: '', completed: false, required: true },
        socialReason: { value: '', completed: false, required: true },
        invoiceAmount: { value: '', completed: false, required: true },
        invoiceDate: { value: '', completed: false, required: true },
        providerNit: { value: '', selectedProvider: null, completed: false, required: true }
    };
    refacturingCompletedFields = 0;
}

// Configurar campos para refacturación
function setupRefacturingFields() {
    const fieldConfigs = [
        { id: 'invoiceSerie', type: 'text', fieldName: 'Serie', tipoCambio: 1 },
        { id: 'invoiceNumber', type: 'text', fieldName: 'Numero', tipoCambio: 2 },
        { id: 'socialReason', type: 'select', fieldName: 'IdRazon', tipoCambio: 3 },
        { id: 'invoiceAmount', type: 'number', fieldName: 'MontoFactura', tipoCambio: 4 },
        { id: 'invoiceDate', type: 'date', fieldName: 'FechaFactura', tipoCambio: 5 },
        { id: 'providerNit', type: 'provider-nit', fieldName: 'NIT', tipoCambio: 6 }
    ];

    fieldConfigs.forEach(field => {
        const element = document.getElementById(field.id);
        if (element) {
            element.classList.add('refacturation-field-pending');
            element.classList.remove('editable-field');
            element.title = 'Campo requerido para refacturación - clic para editar';
            
            // Agregar event listener para editar
            element.addEventListener('click', () => {
                if (isRefacturingMode) {
                    openRefacturingFieldEditor(field);
                }
            });
        }
    });
}

// Mostrar botón de actualización
function showRefacturingUpdateButton() {
    if (refacturingUpdateRow) {
        refacturingUpdateRow.style.display = 'flex';
        updateRefacturingCounter();
    }
}

// Ocultar botón de actualización
function hideRefacturingUpdateButton() {
    if (refacturingUpdateRow) {
        refacturingUpdateRow.style.display = 'none';
    }
}

// Actualizar contador de campos
function updateRefacturingCounter() {
    const counter = document.querySelector('.fields-counter');
    const totalFields = Object.keys(refacturingFields).length;
    
    if (counter) {
        counter.textContent = `(${refacturingCompletedFields}/${totalFields} campos)`;
    }
    
    // Habilitar/deshabilitar botón
    if (updateRefacturingBtn) {
        updateRefacturingBtn.disabled = refacturingCompletedFields < totalFields;
    }
}

// Abrir editor de campo específico
async function openRefacturingFieldEditor(fieldConfig) {
    if (isEditing) {
        NotificationManager.showToast('warning', 'Ya hay un campo en edición. Complete la edición actual primero.');
        return;
    }

    const element = document.getElementById(fieldConfig.id);
    const currentValue = refacturingFields[fieldConfig.id].value;
    
    // Usar la lógica de edición existente pero adaptada
    await enableInlineEditForRefacturingField(element, fieldConfig);
}

// Edición inline adaptada para refacturación
async function enableInlineEditForRefacturingField(element, fieldConfig) {
    if (isEditing) return;

    isEditing = true;
    currentEditingElement = element;
    
    const currentValue = refacturingFields[fieldConfig.id].value;
    
    // Limpiar el contenido
    element.innerHTML = '';
    element.classList.remove('refacturation-field-pending', 'refacturation-field-completed');
    
    // Crear elemento de edición
    let editElement;
    
    if (fieldConfig.type === 'select' && fieldConfig.fieldName === 'IdRazon') {
        editElement = await SelectManager.loadSocialReasons('');
    } else if (fieldConfig.type === 'provider-nit') {
        editElement = await createProviderNitInput('');
    } else {
        editElement = createInputElement(fieldConfig.type, currentValue);
    }
    
    element.appendChild(editElement);
    
    // Agregar botones de acción
    const actionButtons = createActionButtons();
    element.appendChild(actionButtons);
    
    // Enfocar elemento
    if (editElement.focus) {
        editElement.focus();
    }
    
    // Manejar eventos
    const handleSave = async () => {
        let newValue;
        let newDisplayValue;
        let selectedProvider = null;
        
        // Obtener valor según tipo de campo
        if (fieldConfig.type === 'select') {
            const selectedOption = editElement.options[editElement.selectedIndex];
            newValue = editElement.value;
            newDisplayValue = selectedOption ? selectedOption.text : '';
            
            if (!newValue) {
                NotificationManager.showToast('error', 'Debe seleccionar un valor');
                return;
            }
            
        } else if (fieldConfig.type === 'provider-nit') {
            newValue = editElement.mainInput.value.trim();
            selectedProvider = editElement.selectedProvider;
            
            if (!selectedProvider) {
                NotificationManager.showToast('error', 'Debe seleccionar un proveedor válido');
                return;
            }
            
            newDisplayValue = formatNIT(selectedProvider.NIT);
            
        } else if (fieldConfig.type === 'number') {
            newValue = parseFloat(editElement.value);
            if (!newValue || newValue <= 0) {
                NotificationManager.showToast('error', 'Debe ingresar un valor válido');
                return;
            }
            newDisplayValue = formatCurrency(newValue);
            
        } else if (fieldConfig.type === 'date') {
            newValue = editElement.value;
            if (!newValue) {
                NotificationManager.showToast('error', 'Debe seleccionar una fecha');
                return;
            }
            newDisplayValue = formatDate(newValue);
            
        } else {
            newValue = editElement.value.trim();
            if (!newValue) {
                NotificationManager.showToast('error', 'Este campo es requerido');
                return;
            }
            newDisplayValue = newValue;
        }
        
        // Validar campo
        if (!ValidationManager.validateFieldValue(fieldConfig, newValue, selectedProvider)) {
            return;
        }
        
        // Guardar en el objeto de refacturación
        refacturingFields[fieldConfig.id].value = newValue;
        refacturingFields[fieldConfig.id].completed = true;
        
        if (selectedProvider) {
            refacturingFields[fieldConfig.id].selectedProvider = selectedProvider;
        }
        
        // CAMBIO: Actualizar interfaz inmediatamente y de forma visible
        element.innerHTML = newDisplayValue;
        element.classList.add('refacturation-field-completed');
        
        // Forzar repaint del elemento
        element.offsetHeight; // Trigger reflow
        
        // Actualizar contador
        updateCompletedFieldsCount();
        
        // Resetear estado
        isEditing = false;
        currentEditingElement = null;
        
        NotificationManager.showToast('success', 'Campo completado correctamente');
    };
    
    const cancelEdit = () => {
        const wasCompleted = refacturingFields[fieldConfig.id].completed;
        
        if (wasCompleted) {
            // Restaurar valor guardado
            const savedValue = refacturingFields[fieldConfig.id].value;
            const savedProvider = refacturingFields[fieldConfig.id].selectedProvider;
            
            let displayValue;
            if (fieldConfig.type === 'provider-nit' && savedProvider) {
                displayValue = formatNIT(savedProvider.NIT);
            } else if (fieldConfig.type === 'number') {
                displayValue = formatCurrency(savedValue);
            } else if (fieldConfig.type === 'date') {
                displayValue = formatDate(savedValue);
            } else {
                displayValue = savedValue;
            }
            
            element.innerHTML = displayValue;
            element.classList.add('refacturation-field-completed');
        } else {
            // Volver a mostrar placeholder
            element.innerHTML = '';
            const placeholder = document.createElement('span');
            placeholder.style.color = '#999';
            placeholder.style.fontStyle = 'italic';
            placeholder.textContent = 'Campo requerido - clic para editar';
            element.appendChild(placeholder);
            element.classList.add('refacturation-field-pending');
        }
        
        isEditing = false;
        currentEditingElement = null;
    };
    
    // CAMBIO: Event listeners mejorados con mejor especificidad
    const saveBtn = actionButtons.querySelector('.save-btn');
    const cancelBtn = actionButtons.querySelector('.cancel-btn');
    
    // Remover event listeners previos si existen
    saveBtn.removeEventListener('click', handleSave);
    cancelBtn.removeEventListener('click', cancelEdit);
    
    // Agregar nuevos event listeners
    saveBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await handleSave();
    });
    
    cancelBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        cancelEdit();
    });
    
    // Enter y Escape
    const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            handleSave();
        } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            cancelEdit();
        }
    };
    
    editElement.addEventListener('keydown', handleKeyDown);
    
    // CAMBIO: También agregar el event listener al elemento principal por si acaso
    element.addEventListener('keydown', handleKeyDown);
}

// Actualizar count de campos completados
function updateCompletedFieldsCount() {
    refacturingCompletedFields = Object.values(refacturingFields).filter(field => field.completed).length;
    updateRefacturingCounter();
    
    // CAMBIO: Forzar actualización visual del botón
    if (updateRefacturingBtn) {
        const isAllCompleted = refacturingCompletedFields >= Object.keys(refacturingFields).length;
        updateRefacturingBtn.disabled = !isAllCompleted;
        
        // Cambiar visualmente el botón
        if (isAllCompleted) {
            updateRefacturingBtn.classList.remove('disabled');
            updateRefacturingBtn.style.opacity = '1';
            updateRefacturingBtn.style.cursor = 'pointer';
        } else {
            updateRefacturingBtn.classList.add('disabled');
            updateRefacturingBtn.style.opacity = '0.6';
            updateRefacturingBtn.style.cursor = 'not-allowed';
        }
        
        // Forzar repaint
        updateRefacturingBtn.offsetHeight;
    }
}

// Manejar actualización masiva de refacturación
async function handleRefacturingUpdate() {
    if (refacturingCompletedFields < Object.keys(refacturingFields).length) {
        NotificationManager.showToast('error', 'Debe completar todos los campos antes de actualizar');
        return;
    }
    
    // Confirmación
    const confirmed = await NotificationManager.showConfirmation(
        '¿Confirmar Refacturación Completa?',
        `
        <div style="text-align: left; margin: 20px 0;">
            <p><strong>Se actualizarán todos los campos de la factura:</strong></p>
            <hr style="margin: 15px 0;">
            ${Object.entries(refacturingFields).map(([key, field]) => {
                const label = getFieldLabelByKey(key);
                let value = field.value;
                
                if (key === 'providerNit' && field.selectedProvider) {
                    value = `${field.selectedProvider.Nombre} (${formatNIT(field.selectedProvider.NIT)})`;
                } else if (key === 'invoiceAmount') {
                    value = formatCurrency(field.value);
                } else if (key === 'invoiceDate') {
                    value = formatDate(field.value);
                }
                
                return `<p style="margin: 5px 0;"><strong>${label}:</strong> ${value}</p>`;
            }).join('')}
            <hr style="margin: 15px 0;">
            <p style="color: #29b6f6; font-weight: 600;">
                <i class="fas fa-redo"></i> 
                Motivo: ${selectedRefacturingReason.text}
            </p>
        </div>
        `,
        'Sí, actualizar todo',
        'Cancelar'
    );
    
    if (!confirmed) return;
    
    // Mostrar loading
    NotificationManager.showLoading('Actualizando Refacturación...', `
        <div style="text-align: center; margin: 20px 0;">
            <div class="loading-spinner"></div>
            <p style="margin-top: 15px; font-weight: 600;">Procesando refacturación completa:</p>
            <div style="text-align: left; margin: 15px 0; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                <p style="margin: 5px 0;"><strong>Sistema Central:</strong></p>
                <p style="margin: 2px 0; font-size: 14px;">• Actualizando facturas_compras</p>
                <p style="margin: 2px 0; font-size: 14px;">• Registrando en historial</p>
                <br>
                <p style="margin: 5px 0;"><strong>Sucursal:</strong></p>
                <p style="margin: 2px 0; font-size: 14px;">• Sincronizando inventarios</p>
                <p style="margin: 2px 0; font-size: 14px;">• Actualizando órdenes</p>
            </div>
            <p style="font-size: 14px; color: #6c757d;">Por favor espere...</p>
        </div>
    `);
    
    try {
        // Ejecutar todas las actualizaciones
        await executeCompleteRefactoring();
        
        NotificationManager.closeLoading();
        
        // Éxito
        await NotificationManager.showSuccess(
            '🎉 Refacturación Completada',
            `
            <div style="text-align: center; margin: 20px 0;">
                <p style="font-size: 16px; margin-bottom: 15px;">
                    <strong>Todos los campos han sido actualizados exitosamente</strong>
                </p>
                <div style="background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 15px 0;">
                    <p style="margin: 5px 0; color: #4caf50;">✅ Sistema central sincronizado</p>
                    <p style="margin: 5px 0; color: #4caf50;">✅ Base de sucursal actualizada</p>
                    <p style="margin: 5px 0; color: #4caf50;">✅ Historial registrado</p>
                </div>
                <p style="font-size: 14px; color: #6c757d;">La refacturación se ha completado correctamente</p>
            </div>
            `,
            'Continuar',
            4000
        );
        
        // Salir del modo refacturación
        disableRefacturingMode();
        
    } catch (error) {
        NotificationManager.closeLoading();
        NotificationManager.showError(
            'Error en Refacturación',
            `No se pudo completar la refacturación: ${error.message}`
        );
    }
}

// Ejecutar refacturación completa
async function executeCompleteRefactoring() {
    // Preparar todos los cambios
    const fieldConfigs = [
        { id: 'invoiceSerie', fieldName: 'Serie', tipoCambio: 1 },
        { id: 'invoiceNumber', fieldName: 'Numero', tipoCambio: 2 },
        { id: 'socialReason', fieldName: 'IdRazon', tipoCambio: 3 },
        { id: 'invoiceAmount', fieldName: 'MontoFactura', tipoCambio: 4 },
        { id: 'invoiceDate', fieldName: 'FechaFactura', tipoCambio: 5 },
        { id: 'providerNit', fieldName: 'NIT', tipoCambio: 6 }
    ];
    
    // Actualizar base de datos central y sucursal
    await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
        // Actualizar todos los campos en la base central
        for (const fieldConfig of fieldConfigs) {
            const fieldData = refacturingFields[fieldConfig.id];
            const originalValue = getOriginalValueForRefactoring(fieldConfig);
            
            await updateInvoiceField(connection, fieldConfig, fieldData.value, fieldData.selectedProvider);
            await logRefacturingFieldChange(connection, fieldConfig, originalValue, fieldData.value, fieldData.selectedProvider);
            
            // Actualizar en sucursal
            await DatabaseManager.updateBranchTables(fieldConfig, fieldData.value, fieldData.selectedProvider);
        }
    });
    
    // Actualizar objeto currentInvoice
    updateCurrentInvoiceFromRefactoring();
}

// Actualizar currentInvoice desde refacturación
function updateCurrentInvoiceFromRefactoring() {
    Object.entries(refacturingFields).forEach(([key, field]) => {
        switch (key) {
            case 'invoiceSerie':
                window.currentInvoice.Serie = field.value;
                break;
            case 'invoiceNumber':
                window.currentInvoice.Numero = field.value;
                break;
            case 'socialReason':
                window.currentInvoice.IdRazon = field.value;
                // Buscar nombre de razón social
                break;
            case 'invoiceAmount':
                window.currentInvoice.MontoFactura = field.value;
                break;
            case 'invoiceDate':
                window.currentInvoice.FechaFactura = field.value;
                break;
            case 'providerNit':
                if (field.selectedProvider) {
                    window.currentInvoice.NIT = field.selectedProvider.NIT;
                    window.currentInvoice.Nombre = field.selectedProvider.Nombre;
                    window.currentInvoice.IdProveedor = field.selectedProvider.Id;
                }
                break;
        }
    });
}

// Obtener etiqueta de campo por clave
function getFieldLabelByKey(key) {
    const labels = {
        'invoiceSerie': 'Serie',
        'invoiceNumber': 'Número',
        'socialReason': 'Razón Social',
        'invoiceAmount': 'Monto',
        'invoiceDate': 'Fecha',
        'providerNit': 'Proveedor'
    };
    return labels[key] || key;
}
// Verificar notas de crédito existentes
async function checkExistingCreditNotes() {
    try {
        const existingNotes = await DatabaseManager.executeWithConnection('DSN=facturas;charset=utf8', async (connection) => {
            const query = `
                SELECT 
                    nc.IdNotaCreditoProveedores,
                    nc.Serie,
                    nc.Numero,
                    nc.Monto,
                    nc.FechaNotaCredito,
                    nc.Observaciones,
                    tnc.TipoNotaCredito,
                    CASE 
                        WHEN nc.IdConcepto = 1 THEN 'Mercadería'
                        WHEN nc.IdConcepto = 2 THEN 'Otros Conceptos'
                        ELSE 'No especificado'
                    END as TipoConcepto,
                    nc.NombreUsuario,
                    nc.FechaRegistro
                FROM NCTProveedores nc
                LEFT JOIN TiposNotaCredito tnc ON nc.TipoNotaCredito = tnc.IdTipoNotasCredito
                WHERE nc.IdFacturaCompras = ?
                ORDER BY nc.FechaRegistro DESC
            `;
            
            return await connection.query(query, [window.currentInvoice.Id]);
        });
        
        if (existingNotes.length > 0) {
            showExistingCreditNotesNotification(existingNotes);
        } else {
            hideExistingCreditNotesNotification();
        }
        
    } catch (error) {
        console.error('Error al verificar notas de crédito existentes:', error);
        hideExistingCreditNotesNotification();
    }
}
function showExistingCreditNotesNotification(existingNotes) {
    // Buscar si ya existe la notificación
    let notification = document.getElementById('existingCreditNotesNotification');
    
    if (!notification) {
        // Crear la notificación
        notification = document.createElement('div');
        notification.id = 'existingCreditNotesNotification';
        notification.className = 'existing-credit-notes-notification';
        
        // Insertar después del modal-header
        const modalContent = document.querySelector('#creditNoteModal .modal-content');
        if (modalContent) {
            modalContent.insertBefore(notification, modalContent.firstChild);
        }
    }
    
    const totalAmount = existingNotes.reduce((sum, note) => sum + parseFloat(note.Monto || 0), 0);
    
    notification.innerHTML = `
        <div class="notification-header">
            <div class="notification-icon">
                <i class="fas fa-exclamation-circle"></i>
            </div>
            <div class="notification-content">
                <h4>⚠️ Existen ${existingNotes.length} nota(s) de crédito para esta factura</h4>
                <p>Total acumulado: <strong>${formatCurrency(totalAmount)}</strong></p>
            </div>
            <button class="view-notes-btn" id="viewExistingNotesBtn">
                <i class="fas fa-eye"></i>
                Ver Notas
            </button>
        </div>
        
        <div class="notes-list" id="notesList" style="display: none;">
            <div class="notes-header">
                <h5><i class="fas fa-list"></i> Notas de Crédito Registradas:</h5>
            </div>
            <div class="notes-container">
                ${existingNotes.map((note, index) => `
                    <div class="note-item">
                        <div class="note-main-info">
                            <div class="note-series-number">
                                <i class="fas fa-file-invoice"></i>
                                <strong>${note.Serie}-${note.Numero}</strong>
                                <span class="note-concept-badge ${note.TipoConcepto === 'Mercadería' ? 'merchandise' : 'other'}">${note.TipoConcepto}</span>
                            </div>
                            <div class="note-amount">
                                ${formatCurrency(note.Monto)}
                            </div>
                        </div>
                        <div class="note-details">
                            <div class="note-detail-item">
                                <span class="detail-label">Tipo:</span>
                                <span class="detail-value">${note.TipoNotaCredito || 'No especificado'}</span>
                            </div>
                            <div class="note-detail-item">
                                <span class="detail-label">Fecha:</span>
                                <span class="detail-value">${formatDate(note.FechaNotaCredito)}</span>
                            </div>
                            <div class="note-detail-item">
                                <span class="detail-label">Usuario:</span>
                                <span class="detail-value">${note.NombreUsuario || 'No registrado'}</span>
                            </div>
                            ${note.Observaciones ? `
                                <div class="note-detail-item full-width">
                                    <span class="detail-label">Observación:</span>
                                    <span class="detail-value observation">${note.Observaciones}</span>
                                </div>
                            ` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    // Agregar event listener para mostrar/ocultar las notas
    const viewNotesBtn = document.getElementById('viewExistingNotesBtn');
    const notesList = document.getElementById('notesList');
    
    if (viewNotesBtn && notesList) {
        viewNotesBtn.addEventListener('click', () => {
            const isVisible = notesList.style.display !== 'none';
            
            if (isVisible) {
                notesList.style.display = 'none';
                viewNotesBtn.innerHTML = '<i class="fas fa-eye"></i> Ver Notas';
            } else {
                notesList.style.display = 'block';
                viewNotesBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Ocultar';
                
                // Scroll suave hacia las notas
                setTimeout(() => {
                    notesList.scrollIntoView({ 
                        behavior: 'smooth', 
                        block: 'nearest' 
                    });
                }, 100);
            }
        });
    }
}

// Ocultar notificación de notas de crédito existentes
function hideExistingCreditNotesNotification() {
    const notification = document.getElementById('existingCreditNotesNotification');
    if (notification) {
        notification.remove();
    }
}