const xlsx = require('xlsx');
const odbc = require('odbc');
const Swal = require('sweetalert2');
const conexionfacturas = 'DSN=facturas';

// Variables globales para la virtualización
let allData = [];
let displayedData = [];
const BATCH_SIZE = 100; // Cargar 100 filas a la vez
const ROW_HEIGHT = 41; // Altura aproximada de cada fila en px
let isLoading = false;

// Variables globales para autocomplete de proveedor
let allProviders = [];
let selectedProviderId = null;

// Variables globales para autocomplete de sucursal
let allSucursales = [];
let selectedSucursalNombre = null;

const conexionsucursales = 'DSN=DBsucursal';

async function conectar() {
    try {
        const connection = await odbc.connect(conexionfacturas);
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error);
        throw error;
    }
}

async function conectarSucursales() {
    try {
        const connection = await odbc.connect(conexionsucursales);
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('Error al conectar a la base de datos de sucursales:', error);
        throw error;
    }
}

async function populateDepartmentMultiSelect(connection, query) {
    try {
        const result = await connection.query(query);
        const selectContainer = document.querySelector('#department-select .select-items');
        
        if (!selectContainer) {
            console.error('No se encontró el contenedor de elementos seleccionables');
            return;
        }
        
        result.forEach(row => {
            const div = document.createElement('div');
            div.className = 'checkbox-container';
            div.innerHTML = `
                <input type="checkbox" id="dept-${row.Id}" value="${row.Id}">
                <label for="dept-${row.Id}">${row.Nombre}</label>
            `;
            selectContainer.appendChild(div);
        });

        // Manejar la apertura/cierre del dropdown
        const select = document.querySelector('#department-select');
        const selected = select ? select.querySelector('.select-selected') : null;
        
        if (selected) {
            selected.addEventListener('click', function(e) {
                e.stopPropagation();
                const selectItems = this.nextElementSibling;
                if (selectItems) {
                    selectItems.classList.toggle('select-hide');
                    this.classList.toggle('select-arrow-active');
                } else {
                    console.error('No se encontró el elemento de elementos seleccionables');
                }
            });
        } else {
            console.error('No se encontró el elemento seleccionado');
        }

        // Cerrar todos los select boxes cuando se hace clic fuera
        document.addEventListener('click', closeAllSelect);

        // Actualizar el texto seleccionado
        const checkboxes = selectContainer.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateSelectedText);
        });
    } catch (error) {
        console.error('Error al poblar el multiselect de departamentos:', error);
        throw error;
    }
}

function closeAllSelect(elmnt) {
    const selectItems = document.getElementsByClassName('select-items');
    const selectSelected = document.getElementsByClassName('select-selected');
    for (let i = 0; i < selectSelected.length; i++) {
        if (elmnt != selectSelected[i]) {
            selectSelected[i].classList.remove('select-arrow-active');
        }
    }
    for (let i = 0; i < selectItems.length; i++) {
        if (elmnt != selectItems[i]) {
            selectItems[i].classList.add('select-hide');
        }
    }
}

function updateSelectedText() {
    const checkboxes = document.querySelectorAll('#department-select input[type="checkbox"]');
    const selectedText = document.querySelector('#department-select .select-selected');
    if (!selectedText) {
        console.error('No se encontró el elemento de texto seleccionado');
        return;
    }
    const selectedDepts = Array.from(checkboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.nextElementSibling.textContent);
    
    selectedText.textContent = selectedDepts.length > 0 ? selectedDepts.join(', ') : 'Seleccionar Departamento';
}

// Función para búsqueda difusa (fuzzy matching)
function fuzzyMatch(searchTerm, targetText) {
    const normalize = (text) => {
        return text
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "") // Remove accents
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
    };

    const search = normalize(searchTerm);
    const target = normalize(targetText);

    if (!search) return { matches: false, score: 0, highlights: [] };

    // Exact match (100 points)
    if (target.includes(search)) {
        return {
            matches: true,
            score: 100,
            highlights: [{ start: target.indexOf(search), end: target.indexOf(search) + search.length }]
        };
    }

    // Word matching (90 points)
    const targetWords = target.split(' ');
    const searchWords = search.split(' ');

    let wordMatches = 0;
    searchWords.forEach(searchWord => {
        if (targetWords.some(targetWord => targetWord.startsWith(searchWord))) {
            wordMatches++;
        }
    });

    if (wordMatches > 0) {
        return {
            matches: true,
            score: 90,
            highlights: []
        };
    }

    // Initials matching (70 points)
    const initials = targetWords.map(word => word[0]).join('');
    if (initials.includes(search)) {
        return {
            matches: true,
            score: 70,
            highlights: []
        };
    }

    // Sequential character matching (60 points)
    let searchIndex = 0;
    for (let i = 0; i < target.length && searchIndex < search.length; i++) {
        if (target[i] === search[searchIndex]) {
            searchIndex++;
        }
    }

    if (searchIndex === search.length) {
        return {
            matches: true,
            score: 60,
            highlights: []
        };
    }

    return { matches: false, score: 0, highlights: [] };
}

// Función para filtrar y mostrar proveedores
function filterProviders(searchTerm) {
    const dropdown = document.getElementById('provider-dropdown');

    if (!searchTerm) {
        dropdown.style.display = 'none';
        return;
    }

    // Filtrar proveedores que coincidan
    const matches = allProviders
        .map(provider => ({
            ...provider,
            matchResult: fuzzyMatch(searchTerm, provider.Nombre)
        }))
        .filter(provider => provider.matchResult.matches)
        .sort((a, b) => b.matchResult.score - a.matchResult.score)
        .slice(0, 10); // Mostrar máximo 10 resultados

    if (matches.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item no-results">No se encontraron coincidencias</div>';
        dropdown.style.display = 'block';
        return;
    }

    // Mostrar resultados
    dropdown.innerHTML = matches.map(provider =>
        `<div class="autocomplete-item" data-id="${provider.Id}">${provider.Nombre}</div>`
    ).join('');

    dropdown.style.display = 'block';

    // Agregar eventos de click a los items
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', function() {
            selectProvider(this.dataset.id, this.textContent);
        });
    });
}

// Función para seleccionar un proveedor
function selectProvider(id, name) {
    document.getElementById('provider').value = id;
    document.getElementById('provider-input').value = name;
    document.getElementById('provider-dropdown').style.display = 'none';
    document.getElementById('clear-provider-btn').style.display = 'flex';
    selectedProviderId = id;
}

// Función para limpiar selección de proveedor
function limpiarSeleccionProveedor() {
    document.getElementById('provider').value = '';
    document.getElementById('provider-input').value = '';
    document.getElementById('provider-dropdown').style.display = 'none';
    document.getElementById('clear-provider-btn').style.display = 'none';
    selectedProviderId = null;
}

// Función para filtrar y mostrar sucursales
function filterSucursales(searchTerm) {
    const dropdown = document.getElementById('sucursal-dropdown');

    if (!searchTerm) {
        dropdown.style.display = 'none';
        return;
    }

    // Filtrar sucursales que coincidan
    const matches = allSucursales
        .map(sucursal => ({
            ...sucursal,
            matchResult: fuzzyMatch(searchTerm, sucursal.NombreSucursal)
        }))
        .filter(sucursal => sucursal.matchResult.matches)
        .sort((a, b) => b.matchResult.score - a.matchResult.score)
        .slice(0, 10); // Mostrar máximo 10 resultados

    if (matches.length === 0) {
        dropdown.innerHTML = '<div class="autocomplete-item no-results">No se encontraron coincidencias</div>';
        dropdown.style.display = 'block';
        return;
    }

    // Mostrar resultados
    dropdown.innerHTML = matches.map(sucursal =>
        `<div class="autocomplete-item" data-nombre="${sucursal.NombreSucursal}">${sucursal.NombreSucursal}</div>`
    ).join('');

    dropdown.style.display = 'block';

    // Agregar eventos de click a los items
    dropdown.querySelectorAll('.autocomplete-item').forEach(item => {
        item.addEventListener('click', function() {
            selectSucursal(this.dataset.nombre);
        });
    });
}

// Función para seleccionar una sucursal
function selectSucursal(nombre) {
    document.getElementById('sucursal').value = nombre;
    document.getElementById('sucursal-input').value = nombre;
    document.getElementById('sucursal-dropdown').style.display = 'none';
    document.getElementById('clear-sucursal-btn').style.display = 'flex';
    selectedSucursalNombre = nombre;
}

// Función para limpiar selección de sucursal
function limpiarSeleccionSucursal() {
    document.getElementById('sucursal').value = '';
    document.getElementById('sucursal-input').value = '';
    document.getElementById('sucursal-dropdown').style.display = 'none';
    document.getElementById('clear-sucursal-btn').style.display = 'none';
    selectedSucursalNombre = null;
}

// Función para ejecutar una consulta y llenar un combobox
async function populateCombobox(connection, query, comboboxId) {
    try {
        const result = await connection.query(query);
        const combobox = document.getElementById(comboboxId);

        // Limpiar opciones existentes
        combobox.innerHTML = '<option value="">Seleccionar</option>';

        // Añadir nuevas opciones
        result.forEach(row => {
            const option = document.createElement('option');
            option.value = row.Id;
            option.textContent = row.Nombre || row.NombreCompleto;
            combobox.appendChild(option);
        });
    } catch (error) {
        console.error(`Error al poblar el combobox ${comboboxId}:`, error);
        throw error;
    }
}

// Función para cargar proveedores en autocomplete
async function loadProvidersForAutocomplete(connection) {
    try {
        const result = await connection.query('SELECT proveedores_facturas.Id, proveedores_facturas.Nombre FROM proveedores_facturas');
        allProviders = result;

        // Configurar el input de búsqueda
        const providerInput = document.getElementById('provider-input');
        const clearBtn = document.getElementById('clear-provider-btn');

        providerInput.addEventListener('input', function() {
            filterProviders(this.value);
            clearBtn.style.display = this.value ? 'flex' : 'none';
        });

        providerInput.addEventListener('focus', function() {
            if (this.value) {
                filterProviders(this.value);
            }
        });

        clearBtn.addEventListener('click', function() {
            limpiarSeleccionProveedor();
            providerInput.focus();
        });

        // Cerrar dropdown al hacer click fuera
        document.addEventListener('click', function(e) {
            const dropdown = document.getElementById('provider-dropdown');
            if (!e.target.closest('.autocomplete-wrapper')) {
                dropdown.style.display = 'none';
            }
        });
    } catch (error) {
        console.error('Error al cargar proveedores:', error);
        throw error;
    }
}

// Función para cargar sucursales en autocomplete
async function loadSucursalesForAutocomplete(connectionSucursales) {
    try {
        const result = await connectionSucursales.query(`
            SELECT
                sucursales.idSucursal,
                sucursales.NombreSucursal
            FROM
                sucursales
            WHERE
                sucursales.Activo = 1
                AND sucursales.TipoSucursal IN (1, 2, 3)
            ORDER BY
                sucursales.NombreSucursal ASC
        `);
        allSucursales = result;

        // Configurar el input de búsqueda
        const sucursalInput = document.getElementById('sucursal-input');
        const clearBtn = document.getElementById('clear-sucursal-btn');

        sucursalInput.addEventListener('input', function() {
            filterSucursales(this.value);
            clearBtn.style.display = this.value ? 'flex' : 'none';
        });

        sucursalInput.addEventListener('focus', function() {
            if (this.value) {
                filterSucursales(this.value);
            }
        });

        clearBtn.addEventListener('click', function() {
            limpiarSeleccionSucursal();
            sucursalInput.focus();
        });
    } catch (error) {
        console.error('Error al cargar sucursales:', error);
        throw error;
    }
}

// Función principal para poblar todos los comboboxes
async function populateAllComboboxes() {
    let connection;
    let connectionSucursales;
    try {
        connection = await conectar();
        connectionSucursales = await conectarSucursales();

        await loadProvidersForAutocomplete(connection);
        await loadSucursalesForAutocomplete(connectionSucursales);

        await populateDepartmentMultiSelect(
            connection,
            'SELECT Costosdep.Id, Costosdep.Nombre FROM Costosdep WHERE Costosdep.Activo = 1'
        );

        await populateCombobox(
            connection,
            `SELECT usuarios.Id, CONCAT(usuarios.Nombres, ' ', usuarios.Apellidos) AS NombreCompleto
             FROM usuarios
             WHERE usuarios.Activo = 1
               AND usuarios.IdNivel IN (11, 30)`,
            'user'
        );
    } catch (error) {
        console.error('Error al poblar los comboboxes:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error',
            text: 'Ha ocurrido un error al cargar los datos',
            footer: `<details>
                        <summary>Detalles del error (para soporte técnico)</summary>
                        <p>${error.message}</p>
                        <p>Stack: ${error.stack}</p>
                    </details>`,
            confirmButtonText: 'Entendido'
        });
    } finally {
        if (connection) {
            try {
                await connection.close();
                console.log('Conexión a la base de datos cerrada');
            } catch (closeError) {
                console.error('Error al cerrar la conexión:', closeError);
            }
        }
        if (connectionSucursales) {
            try {
                await connectionSucursales.close();
                console.log('Conexión a la base de datos de sucursales cerrada');
            } catch (closeError) {
                console.error('Error al cerrar la conexión de sucursales:', closeError);
            }
        }
    }
}

// Ejecutar la función cuando el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {
    populateAllComboboxes();
    setupVirtualScroll();
});

// Función para mostrar errores de forma genérica
function showError(title, text, error) {
    Swal.fire({
        icon: 'error',
        title: title,
        text: text,
        footer: `<details>
                    <summary>Detalles del error (para soporte técnico)</summary>
                    <p>${error.message}</p>
                    <p>Stack: ${error.stack}</p>
                </details>`,
        confirmButtonText: 'Entendido'
    });
}

function formatofecha(dateString) {
    if (!dateString) return '';
    // Parseamos la fecha asumiendo que está en UTC
    const date = new Date(dateString + 'T00:00:00Z');

    // Ajustamos la fecha a la zona horaria local
    const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);

    // Formateamos la fecha
    return localDate.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// Función para formatear valores numéricos (mostrar 0.00 en lugar de vacío)
function formatNumericValue(value) {
    if (value === null || value === undefined || value === '') {
        return '0.00';
    }
    const numValue = parseFloat(value);
    if (isNaN(numValue)) {
        return '0.00';
    }
    return numValue.toFixed(2);
}

async function performSearch() {
    Swal.fire({
        title: 'Cargando Historial de cuadre',
        html: '<div id="progress-text">Consultando base de datos...</div>',
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });
    
    let connection;
    try {
        connection = await conectar();

        const proveedor = document.getElementById('provider').value;
        const sucursal = document.getElementById('sucursal').value;
        const departamentos = Array.from(document.querySelectorAll('#department-select input[type="checkbox"]:checked')).map(cb => cb.value);
        const usuario = document.getElementById('user').value;
        const fechaInicio = document.getElementById('start-date').value;
        const fechaFin = document.getElementById('end-date').value;
        const idInventario = document.getElementById('id-inventory').value;
        const numeroFactura = document.getElementById('invoice-number').value;
        const serie = document.getElementById('serie').value;
        const upc = document.getElementById('upc').value;

        let query = `
            SELECT
                cuadrecostos.Idcuadre, 
                cuadrecostos.Upc, 
                cuadrecostos.Descripcion, 
                proveedores_facturas.Nombre AS Proveedor, 
                cuadrecostos.FechaFactura, 
                cuadrecostos.NoFactura, 
                cuadrecostos.Serie, 
                cuadrecostos.costosistema, 
                cuadrecostos.costofacturado, 
                cuadrecostos.CostoFacSinDescuento,
                cuadrecostos.diferencia, 
                cuadrecostos.sucursal, 
                cuadrecostos.fechacuadre, 
                Costosdep.Nombre AS Departamento, 
                cuadrecostos.Costofiscal, 
                cuadrecostos.Iva, 
                cuadrecostos.CantidadIngresada, 
                razonessociales.NombreRazon, 
                cuadrecostos.BonificacionIngresada, 
                cuadrecostos.Usuario
            FROM
                cuadrecostos
                LEFT JOIN proveedores_facturas ON cuadrecostos.Proveedor = proveedores_facturas.Id
                LEFT JOIN Costosdep ON cuadrecostos.Departamento = Costosdep.Id
                LEFT JOIN razonessociales ON cuadrecostos.IdRazonSocial = razonessociales.Id
                LEFT JOIN usuarios ON cuadrecostos.IdUsuario = usuarios.Id
            WHERE 1=1
        `;

        const params = [];

        if (proveedor) {
            query += ' AND cuadrecostos.Proveedor = ?';
            params.push(proveedor);
        }

        if (sucursal) {
            query += ' AND cuadrecostos.sucursal = ?';
            params.push(sucursal);
        }

        if (departamentos.length > 0) {
            query += ` AND cuadrecostos.Departamento IN (${departamentos.map(() => '?').join(',')})`;
            params.push(...departamentos);
        }

        if (usuario) {
            query += ' AND cuadrecostos.IdUsuario = ?';
            params.push(usuario);
        }

        if (fechaInicio && fechaFin) {
            query += ' AND cuadrecostos.fechacuadre BETWEEN ? AND ?';
            params.push(formatDateForInput(fechaInicio), formatDateForInput(fechaFin));
        }

        if (idInventario) {
            query += ' AND cuadrecostos.Idcuadre = ?';
            params.push(idInventario);
        }

        if (numeroFactura) {
            query += ' AND cuadrecostos.NoFactura = ?';
            params.push(numeroFactura);
        }

        if (serie) {
            query += ' AND cuadrecostos.Serie = ?';
            params.push(serie);
        }

        if (upc) {
            query += ' AND cuadrecostos.Upc = ?';
            params.push(upc.padStart(13, '0'));
        }
        query += ' ORDER BY cuadrecostos.FechaFactura DESC';
        // Si no se ha aplicado ningún filtro, advertir al usuario
        if (params.length === 0) {
            const result = await Swal.fire({
                icon: 'warning',
                title: 'Sin filtros aplicados',
                text: 'No has aplicado ningún filtro. Esto puede resultar en una gran cantidad de datos. ¿Deseas continuar?',
                showCancelButton: true,
                confirmButtonText: 'Sí, continuar',
                cancelButtonText: 'Cancelar'
            });
            
            if (!result.isConfirmed) {
                if (connection) await connection.close();
                return;
            }
            
            // Solo limitamos a 10,000 si no hay filtros para proteger la memoria
            query += ' LIMIT 10000'; 
        }

        // Actualizar progreso
        document.getElementById('progress-text').textContent = 'Obteniendo registros...';

        const result = await connection.query(query, params);
        
        // Guardar todos los datos
        allData = result;
        displayedData = [];
        
        Swal.close();
        
        // Limpiar la tabla
        const tbody = document.querySelector('#data-table tbody');
        tbody.innerHTML = '';
        
        // Cargar el primer lote
        loadMoreRows();

    } catch (error) {
        console.error('Error al realizar la búsqueda:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error en la búsqueda',
            text: 'Ocurrió un error al buscar los datos.',
            footer: `<details>
                        <summary>Detalles del error (para soporte técnico)</summary>
                        <p>${error.message}</p>
                        <p>Stack: ${error.stack}</p>
                    </details>`,
            confirmButtonText: 'Entendido'
        });
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

function formatDateForInput(dateString) {
    const date = new Date(dateString + 'T00:00:00Z');
    const localDate = new Date(date.getTime() + date.getTimezoneOffset() * 60000);
    return localDate.toISOString().split('T')[0];
}

// Cargar más filas (virtualización)
function loadMoreRows() {
    if (isLoading || displayedData.length >= allData.length) return;
    
    isLoading = true;
    const start = displayedData.length;
    const end = Math.min(start + BATCH_SIZE, allData.length);
    const batch = allData.slice(start, end);
    
    const tbody = document.querySelector('#data-table tbody');
    const fragment = document.createDocumentFragment();
    
    batch.forEach(row => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${row.Idcuadre || ''}</td>
            <td>${row.Upc || ''}</td>
            <td>${row.Descripcion || ''}</td>
            <td>${row.Departamento || ''}</td>
            <td>${row.Proveedor || ''}</td>
            <td>${row.CantidadIngresada || ''}</td>
            <td>${row.BonificacionIngresada || ''}</td>
            <td>${formatofecha(row.FechaFactura)}</td>
            <td>${row.NoFactura || ''}</td>
            <td>${row.Serie || ''}</td>
            <td>${formatNumericValue(row.costosistema)}</td>
            <td>${formatNumericValue(row.costofacturado)}</td>
            <td>${formatNumericValue(row.CostoFacSinDescuento)}</td>
            <td>${formatNumericValue(row.Costofiscal)}</td>
            <td>${formatNumericValue(row.diferencia)}</td>
            <td>${row.sucursal || ''}</td>
            <td>${formatofecha(row.fechacuadre)}</td>
            <td>${row.Usuario || ''}</td>
            <td>${row.NombreRazon || ''}</td>
        `;
        fragment.appendChild(tr);
    });
    
    tbody.appendChild(fragment);
    displayedData.push(...batch);
    
    // Actualizar contador en consola
    console.log(`Cargadas ${displayedData.length} de ${allData.length} filas`);
    
    isLoading = false;
}

// Configurar el scroll infinito
function setupVirtualScroll() {
    const tableContainer = document.querySelector('.data-table > div');
    if (!tableContainer) return;
    
    tableContainer.addEventListener('scroll', () => {
        const scrollTop = tableContainer.scrollTop;
        const scrollHeight = tableContainer.scrollHeight;
        const clientHeight = tableContainer.clientHeight;
        
        // Si está cerca del final (últimos 200px), cargar más
        if (scrollHeight - scrollTop - clientHeight < 200) {
            loadMoreRows();
        }
    });
}

function exportToExcel() {
    if (allData.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin datos',
            text: 'No hay datos para exportar. Por favor realiza una búsqueda primero.',
            confirmButtonText: 'Entendido'
        });
        return;
    }
    
    // Mostrar progreso
    Swal.fire({
        title: 'Exportando a Excel',
        allowOutsideClick: false,
        showConfirmButton: false,
        willOpen: () => {
            Swal.showLoading();
        }
    });
    
    // Usar setTimeout para no bloquear el UI
    setTimeout(() => {
        try {
            // Crear los datos para el Excel
            const headers = [
                'Id Inventario', 'UPC', 'Descripción', 'Departamento', 'Proveedor',
                'Unidades Ingresadas', 'Bonificación', 'Fecha Factura', 'No. Factura',
                'Serie', 'Costo Sistema', 'Costo Facturado', 'Costo Fac Sin Descuento', 
                'Costo Fiscal', 'Diferencia', 'Sucursal', 'Fecha de Cuadre', 'Usuario', 
                'Razón Social'
            ];
            
            const data = [headers];
            
            // Procesar por lotes para mostrar progreso
            allData.forEach((row, index) => {

                data.push([
                    row.Idcuadre || '',
                    String(row.Upc || '').padStart(13, '0'),
                    row.Descripcion || '',
                    row.Departamento || '',
                    row.Proveedor || '',
                    row.CantidadIngresada || '',
                    row.BonificacionIngresada || '',
                    formatofecha(row.FechaFactura),
                    row.NoFactura || '',
                    row.Serie || '',
                    formatNumericValue(row.costosistema),
                    formatNumericValue(row.costofacturado),
                    formatNumericValue(row.CostoFacSinDescuento),
                    formatNumericValue(row.Costofiscal),
                    formatNumericValue(row.diferencia),
                    row.sucursal || '',
                    formatofecha(row.fechacuadre),
                    row.Usuario || '',
                    row.NombreRazon || ''
                ]);
            });
            
            // Crear la hoja de trabajo
            const ws = xlsx.utils.aoa_to_sheet(data);
            
            // Formatear la columna UPC como texto
            const range = xlsx.utils.decode_range(ws['!ref']);
            const upcColumnIndex = 1;
            
            for (let row = range.s.r + 1; row <= range.e.r; row++) {
                const cellAddress = xlsx.utils.encode_cell({r: row, c: upcColumnIndex});
                if (ws[cellAddress]) {
                    ws[cellAddress].t = 's';
                    ws[cellAddress].z = '@';
                }
            }
            
            // Crear el libro de trabajo
            const wb = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(wb, ws, "Historial de Cuadre");
            
            // Generar el archivo
            const wbout = xlsx.write(wb, {bookType:'xlsx', type:'binary'});
            const blob = new Blob([s2ab(wbout)], {type:"application/octet-stream"});
            
            // Crear enlace de descarga
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            const timestamp = new Date().toISOString().slice(0, 10);
            a.download = `historial_cuadre_${timestamp}.xlsx`;
            
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                
                Swal.fire({
                    icon: 'success',
                    title: 'Exportación Completada',
                    html: `<p>El archivo de Excel se ha descargado exitosamente.</p>
                           <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                               Total de registros: <strong>${allData.length.toLocaleString()}</strong>
                           </p>`,
                    timer: 3000,
                    showConfirmButton: false
                });
            }, 100);
            
        } catch (error) {
            console.error('Error al exportar:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error en la exportación',
                text: 'No se pudo generar el archivo Excel.',
                footer: `<details>
                            <summary>Detalles del error</summary>
                            <p>${error.message}</p>
                        </details>`
            });
        }
    }, 100);
}

// Función auxiliar para convertir string a ArrayBuffer
function s2ab(s) {
    const buf = new ArrayBuffer(s.length);
    const view = new Uint8Array(buf);
    for (let i = 0; i < s.length; i++) view[i] = s.charCodeAt(i) & 0xFF;
    return buf;
}

// Agregar evento al botón de búsqueda
document.getElementById('search-btn').addEventListener('click', performSearch);
document.getElementById('export-btn').addEventListener('click', exportToExcel);

// Capturar errores no manejados
window.addEventListener('error', function(event) {
    showError('Error Inesperado', 'Ha ocurrido un error inesperado en la aplicación', event.error);
});

// Capturar promesas rechazadas no manejadas
window.addEventListener('unhandledrejection', function(event) {
    showError('Error en Promesa No Manejada', 'Ha ocurrido un error en una operación asíncrona', event.reason);
});