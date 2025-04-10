const odbc = require('odbc');
const conexionsucuales = 'DSN=DBsucursal'; // Ajusta tu DSN aquí
const mysql = require('mysql2/promise');
const Swal = require('sweetalert2');
const conexionfacturas = 'DSN=facturas';
const conexionlocal = 'DNS=local';

// Variables para selección múltiple y copiar/pegar
let isShiftPressed = false;
let startCell = null;
let endCell = null;
let copiedContent = "";

// Conexiones a bases de datos
async function conectar() {
    try {
        const connection = await odbc.connect(conexionsucuales);
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error);
        mostrarError('Error de conexión', 'No se pudo conectar a la base de datos de sucursales');
        throw error;
    }
}

async function conectarfacturas() {
    try {
        const connection = await odbc.connect(conexionfacturas);
        await connection.query('SET NAMES utf8mb4');
        return connection;
    } catch (error) {
        console.error('Error al conectar a la base de datos:', error);
        mostrarError('Error de conexión', 'No se pudo conectar a la base de datos de facturas');
        throw error;
    }
}

async function conectarEspecial() {
    try {
        const connection = await mysql.createConnection({
            host: '172.30.1.18',
            user: 'compras',
            password: 'bode.24451988',
            database: 'superpos1'
        });
        return connection;
    } catch (error) {
        console.error('Error al conectar a la base de datos especial:', error);
        mostrarError('Error de conexión', 'No se pudo conectar a la base de datos especial');
        throw error;
    }
}

async function conexionsurtialterno() {
    try {
        const connection = await mysql.createConnection({
            host: '172.30.1.25',
            user: 'compras',
            password: 'bode.24451988',
            database: 'sinc_costos_surtimayoreo'
        });
        return connection;
    } catch (error) {
        console.error('Error al conectar a la base de datos alterna:', error);
        mostrarError('Error de conexión', 'No se pudo conectar a la base de datos alterna');
        throw error;
    }
}

// Carga inicial de sucursales
async function loadSucursales() {
    try {
        mostrarCargando('Cargando sucursales...');
        
        const connection = await conectar();
        const result = await connection.query(`
            SELECT
                sucursales.idSucursal, 
                sucursales.TipoSucursal,
                sucursales.NombreSucursal, 
                sucursales.serverr, 
                sucursales.databasee, 
                sucursales.Uid, 
                sucursales.Pwd
            FROM
                sucursales
            WHERE
                sucursales.TipoSucursal IN (1,2,3) AND
                sucursales.Activo = 1
            ORDER BY
                sucursales.NombreSucursal ASC
        `);
        
        const select = document.getElementById('sucursal-select');
        result.forEach(row => {
            const option = document.createElement('option');
            option.value = row.idSucursal;
            option.dataset.tipoSucursal = row.TipoSucursal;
            option.textContent = row.NombreSucursal;
            option.dataset.serverr = row.serverr;
            option.dataset.databasee = row.databasee;
            option.dataset.uid = row.Uid;
            option.dataset.pwd = row.Pwd;
            select.appendChild(option);
        });

        connection.close();
        Swal.close();
    } catch (error) {
        console.error('Error al cargar las sucursales:', error);
        mostrarError('Error', 'No se pudieron cargar las sucursales');
    }
}

// Obtención de criterio de cuadre
async function obtenerCriterioCuadre(idProveedor) {
    try {
        const connection = await conectarfacturas();
        const query = `
            SELECT
                HistorialCriterioCuadres.Criterio_Cuadre
            FROM
                HistorialCriterioCuadres
            WHERE
                HistorialCriterioCuadres.Activo = 1 AND
                HistorialCriterioCuadres.IdProveedor = ?
        `;
        const result = await connection.query(query, [idProveedor]);
        await connection.close();

        if (result.length > 0) {
            return result[0].Criterio_Cuadre;
        } else {
            return "No se encontró criterio de cuadre para este proveedor.";
        }
    } catch (error) {
        console.error('Error al obtener el criterio de cuadre:', error);
        return "Error al obtener el criterio de cuadre.";
    }
}

// Funciones de utilidad para la UI
function mostrarCargando(mensaje = 'Procesando...') {
    Swal.fire({
        title: mensaje,
        text: 'Por favor espere...',
        allowOutsideClick: false,
        allowEscapeKey: false,
        allowEnterKey: false,
        showConfirmButton: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

function mostrarError(titulo, mensaje, detalles = null) {
    let html = mensaje;
    
    if (detalles) {
        html += `<br><div class="error-details"><pre>${detalles}</pre></div>`;
    }
    
    Swal.fire({
        icon: 'error',
        title: titulo,
        html: html,
        customClass: {
            popup: 'error-popup'
        }
    });
}

function mostrarExito(titulo, mensaje, callback = null) {
    Swal.fire({
        icon: 'success',
        title: titulo,
        text: mensaje,
        confirmButtonText: 'Aceptar'
    }).then((result) => {
        if (result.isConfirmed && callback) {
            callback();
        }
    });
}

function mostrarConfirmacion(titulo, mensaje, callback) {
    Swal.fire({
        title: titulo,
        text: mensaje,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar'
    }).then((result) => {
        if (result.isConfirmed && callback) {
            callback();
        }
    });
}

// Funciones de formateo
function formatearFecha(fecha) {
    if (!fecha) return '';
    
    const date = new Date(fecha);
    const dia = String(date.getDate()).padStart(2, '0');
    const mes = String(date.getMonth() + 1).padStart(2, '0');
    const anio = date.getFullYear();
    
    return `${dia}-${mes}-${anio}`;
}

function formatearFechaParaMySQL(fechaString) {
    if (!fechaString) return null;
    
    const partes = fechaString.split('-');
    if (partes.length !== 3) return null;
    
    return `${partes[2]}-${partes[1]}-${partes[0]}`;
}

// Función para obtener la fecha actual con formato para MySQL
function obtenerFechaLocal() {
    const ahora = new Date();
    const offset = ahora.getTimezoneOffset() * 60000; // offset en milisegundos
    const fechaLocal = new Date(ahora.getTime() - offset);
    
    return fechaLocal.toISOString().slice(0, 19).replace('T', ' ');
}
async function obtenerInventario(sucursalData, idInventario) {
    mostrarCargando('Cargando inventario...');

    let connection;
    let alternoConnection;
    try {
        connection = await mysql.createConnection({
            host: sucursalData.serverr,
            user: sucursalData.uid,
            database: sucursalData.databasee,
            password: sucursalData.pwd
        });

        const [rows] = await connection.execute(`
            SELECT
                inventarios.Fecha,
                inventarios.Serie,
                inventarios.Numero,
                inventarios.FechaFactura,
                inventarios.IdDepartamentos,
                departamentos.Nombre AS Departamento,
                inventarios.IdProveedores,
                proveedores.Nombre AS Proveedor,
                inventarios.IdRazon,
                razonessociales.NombreRazon as RazonSocial,
                inventarios.Observaciones,
                detalleinventarios.Upc,
                productos.DescLarga,
                detalleinventarios.Cantidad_Rechequeo,
                productos.Costo,
                productos.Nivel1,
                CASE 
                    WHEN detalleinventarios.UnidadesFardo IS NULL OR detalleinventarios.UnidadesFardo = '' OR detalleinventarios.UnidadesFardo = 0 
                    THEN detalleinventarios.CantidadBonificada 
                    ELSE detalleinventarios.CantidadBonificada * detalleinventarios.UnidadesFardo 
                END AS Bonificacion
            FROM
                detalleinventarios
                INNER JOIN inventarios ON detalleinventarios.IdInventarios = inventarios.idInventarios
                LEFT JOIN departamentos ON inventarios.IdDepartamentos = departamentos.Id
                LEFT JOIN proveedores ON inventarios.IdProveedores = proveedores.Id
                LEFT JOIN razonessociales ON inventarios.IdRazon = razonessociales.Id
                LEFT JOIN productos ON detalleinventarios.Upc = productos.Upc
            WHERE
                inventarios.idInventarios = ? AND
				detalleinventarios.Detalle_Rechequeo = 0
        `, [idInventario]);

        const inventarioInfo = rows[0] ? {
            Fecha: rows[0].Fecha,
            Serie: rows[0].Serie,
            Numero: rows[0].Numero,
            FechaFactura: rows[0].FechaFactura,
            IdDepartamentos: rows[0].IdDepartamentos,
            Departamento: rows[0].Departamento,
            IdProveedores: rows[0].IdProveedores,
            Proveedor: rows[0].Proveedor,
            IdRazon: rows[0].IdRazon,
            RazonSocial: rows[0].RazonSocial,
            Observaciones: rows[0].Observaciones
        } : null;

        let detalles = [];

        if (sucursalData.tipoSucursal === '2') {
            alternoConnection = await conexionsurtialterno();
            for (const row of rows) {
                const [costoAlterno] = await alternoConnection.execute(
                    'SELECT Costo FROM productos WHERE Upc = ?',
                    [row.Upc]
                );
                detalles.push({
                    Upc: row.Upc,
                    DescLarga: row.DescLarga,
                    Cantidad: row.Cantidad,
                    Costo: row.Costo,
                    CostoAlterno: costoAlterno[0] ? costoAlterno[0].Costo : null,
                    Bonificacion: row.Bonificacion,
                    Nivel1: row.Nivel1,
                    PrecioFacturado: row.PrecioFacturado || ''
                });
            }
        } else if (sucursalData.tipoSucursal === '1' || sucursalData.tipoSucursal === '3') {
            for (const row of rows) {
                try {
                    const productoEspecial = await buscarProductoEspecial(row.Upc);
                    detalles.push({
                        Upc: row.Upc,
                        DescLarga: row.DescLarga,
                        Cantidad: row.Cantidad_Rechequeo,
                        Costo: productoEspecial ? productoEspecial.Costo : row.Costo,
                        Bonificacion: row.Bonificacion,
                        Nivel1: productoEspecial ? productoEspecial.Nivel1 : row.Nivel1,
                        PrecioFacturado: row.PrecioFacturado || ''
                    });
                } catch (errorProducto) {
                    console.error(`Error al buscar producto especial para UPC ${row.Upc}:`, errorProducto);
                    detalles.push({
                        Upc: row.Upc,
                        DescLarga: row.DescLarga,
                        Cantidad: row.Cantidad,
                        Costo: row.Costo,
                        Bonificacion: row.Bonificacion,
                        Nivel1: row.Nivel1,
                        PrecioFacturado: row.PrecioFacturado || ''
                    });
                }
            }
        } else {
            detalles = rows.map(row => ({
                Upc: row.Upc,
                DescLarga: row.DescLarga,
                Cantidad: row.Cantidad,
                Costo: row.Costo,
                Bonificacion: row.Bonificacion,
                Nivel1: row.Nivel1,
                PrecioFacturado: row.PrecioFacturado || ''
            }));
        }

        const criterioCuadre = await obtenerCriterioCuadre(inventarioInfo.IdProveedores);
        Swal.close();
        
        return { info: inventarioInfo, detalles: detalles, criterioCuadre: criterioCuadre };
    } catch (error) {
        console.error('Error detallado al obtener el inventario:', error);
        mostrarError(
            'Error al obtener inventario', 
            'No se pudo cargar la información del inventario', 
            error.message
        );
        return null;
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (closeError) {
                console.error("Error al cerrar la conexión principal:", closeError);
            }
        }
        if (alternoConnection) {
            try {
                await alternoConnection.end();
            } catch (closeError) {
                console.error("Error al cerrar la conexión alterna:", closeError);
            }
        }
    }
}

// Buscar producto especial
async function buscarProductoEspecial(upc) {
    let connection;
    try {
        connection = await conectarEspecial();
        const [rows] = await connection.execute(
            'SELECT DescLarga, Costo, Nivel1 FROM productos WHERE Upc = ?',
            [upc]
        );
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error('Error detallado al buscar el producto en la base especial:', error);
        let errorMessage = `Error al buscar producto con UPC ${upc}. Detalles:\n\n`;
        
        if (error.message) {
            errorMessage += `Mensaje: ${error.message}\n`;
        }
        if (error.code) {
            errorMessage += `Código: ${error.code}\n`;
        }
        if (error.errno) {
            errorMessage += `Errno: ${error.errno}\n`;
        }
        if (error.sqlState) {
            errorMessage += `Estado SQL: ${error.sqlState}\n`;
        }
        if (error.sqlMessage) {
            errorMessage += `Mensaje SQL: ${error.sqlMessage}\n`;
        }
        
        throw new Error(errorMessage);
    } finally {
        if (connection) {
            try {
                await connection.end();
            } catch (closeError) {
                console.error("Error al cerrar la conexión especial:", closeError);
            }
        }
    }
}

// Buscar producto normal
async function buscarProducto(upc, sucursalData) {
    let connection;
    try {
        if (sucursalData.tipoSucursal === '3') {
            const productoEspecial = await buscarProductoEspecial(upc);
            if (productoEspecial) {
                return productoEspecial;
            }
        } else {
            connection = await mysql.createConnection({
                host: sucursalData.serverr,
                user: sucursalData.uid,
                database: sucursalData.databasee,
                password: sucursalData.pwd
            });

            const [rows] = await connection.execute(
                'SELECT DescLarga, Costo, Nivel1 FROM productos WHERE Upc = ?',
                [upc]
            );

            if (rows.length > 0) {
                return rows[0];
            }
        }
        return null;
    } catch (error) {
        console.error('Error al buscar el producto:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.end();
        }
    }
}

// Verificar si ya existe un cuadre para el inventario
async function verificarExistenciaInventario(idInventario, idSucursal) {
    let connection;
    try {
        connection = await odbc.connect(conexionfacturas);
        const query = `
            SELECT COUNT(*) as count 
            FROM cuadrecostos
            WHERE IdCuadre = ? AND IdSucursal = ?
        `;
        const result = await connection.query(query, [idInventario, idSucursal]);
        return result[0].count > 0;
    } catch (error) {
        console.error('Error al verificar existencia del inventario:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

// Mostrar información del inventario en la interfaz
// Función corregida para mostrar el inventario con coherencia en el cálculo de descuentos
function mostrarInventario(inventario) {
    // Mostrar la información general del inventario
    document.getElementById('fecha').textContent = formatearFecha(inventario.info.Fecha);
    document.getElementById('serie').textContent = inventario.info.Serie;
    document.getElementById('numero').textContent = inventario.info.Numero;
    document.getElementById('fecha-factura').textContent = formatearFecha(inventario.info.FechaFactura);
    
    const departamentoElement = document.getElementById('departamento');
    departamentoElement.textContent = inventario.info.Departamento;
    departamentoElement.dataset.idDepartamento = inventario.info.IdDepartamentos;
    
    const proveedorElement = document.getElementById('proveedor');
    proveedorElement.textContent = inventario.info.Proveedor;
    proveedorElement.dataset.idProveedor = inventario.info.IdProveedores;
    
    const razonSocialElement = document.getElementById('razon-social');
    razonSocialElement.textContent = inventario.info.RazonSocial;
    razonSocialElement.dataset.idRazon = inventario.info.IdRazon;
    
    document.getElementById('observaciones').textContent = inventario.info.Observaciones;
    document.getElementById('criterio-cuadre').textContent = inventario.criterioCuadre;
    
    // Mostrar los detalles del inventario
    const tbody = document.querySelector('.data-table tbody');
    tbody.innerHTML = ''; // Limpiar la tabla antes de agregar nuevas filas
    
    const sucursalSelect = document.getElementById('sucursal-select');
    const tipoSucursal = sucursalSelect.selectedOptions[0].dataset.tipoSucursal;

    // Mostrar u ocultar la columna de Costo Alterno
    const costoAlternoHeader = document.querySelector('th.costo-alterno-column');
    costoAlternoHeader.style.display = tipoSucursal === '2' ? '' : 'none';

    if (inventario.detalles && inventario.detalles.length > 0) {
        inventario.detalles.forEach(detalle => {
            const tr = document.createElement('tr');
            if (detalle.Nivel1 > 0) {
                tr.classList.add('nivel1-destacado');
            }
            tr.innerHTML = `
                <td class="upc-column"><input type="text" value="${detalle.Upc}" class="upc-input"></td>
                <td class="descripcion-column">${detalle.DescLarga || ''}</td>
                <td class="cantidad-column"><input type="number" value="${detalle.Cantidad || ''}" class="cantidad-input"></td>
                <td class="costo-column"><input type="number" value="${detalle.Costo || ''}" class="costo-input"></td>
                ${tipoSucursal === '2' ? 
                  `<td class="costo-alterno-column"><input type="number" value="${detalle.CostoAlterno || ''}" class="costo-alterno-input" readonly></td>` : 
                  `<td class="costo-alterno-column" style="display: none;"><input type="number" value="${detalle.CostoAlterno || ''}" class="costo-alterno-input" readonly></td>`
                }
                <td class="bonificacion-column"><input type="number" value="${detalle.Bonificacion}" class="bonificacion-input"></td>
                <td class="precio-column"><input type="text" value="${detalle.PrecioFacturado || ''}" class="precio-facturado-input"></td>
                <td class="descuento-column"><input type="number" value="${detalle.Descuento || '0'}" class="descuento-input"></td>
                <td class="costo-facturado-column costo-facturado-cell"></td>
                <td class="diferencia-column diferencia-cell"></td>
            `;
            tbody.appendChild(tr);

            // Obtener elementos de input
            const precioFacturadoInput = tr.querySelector('.precio-facturado-input');
            const cantidadInput = tr.querySelector('.cantidad-input');
            const bonificacionInput = tr.querySelector('.bonificacion-input');
            const costoInput = tr.querySelector('.costo-input');
            const descuentoInput = tr.querySelector('.descuento-input');
            
            // Aplicar calculadora para el precio facturado
            calcularPrecioFacturado(precioFacturadoInput);
            
            // Asignar función de actualizar costos a todos los inputs
            const inputs = tr.querySelectorAll('input');
            inputs.forEach(input => {
                input.addEventListener('input', actualizarCostos);
            });
            
            // Guardar el valor original del Precio Facturado
            precioFacturadoInput.dataset.originalValue = detalle.PrecioFacturado;

            // Eventos específicos para cada campo
            precioFacturadoInput.addEventListener('input', () => {
                precioFacturadoInput.dataset.originalValue = precioFacturadoInput.value;
                actualizarTotalFactura();
            });

            // Inicializar eventos UPC
            const upcInput = tr.querySelector('.upc-input');
            upcInput.addEventListener('blur', manejarUpc);
            upcInput.addEventListener('keydown', manejarUpckeydown);
            
            // Ejecutar cálculo inicial para mostrar los valores correctos
            if (cantidadInput) {
                cantidadInput.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
    } else {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="${tipoSucursal === '2' ? '10' : '9'}" class="no-data">No hay detalles disponibles</td>`;
        tbody.appendChild(tr);
    }
    
    // Actualizar total y asignar eventos
    actualizarTotalFactura();
    asignarEventosTeclado();
    
    // Mostrar panel de información si está colapsado
    const infoContent = document.getElementById('info-content');
    if (infoContent && !infoContent.classList.contains('open')) {
        document.getElementById('info-header').click();
    }
    
    // Añadir una animación suave para mostrar los datos
    const tablaContainer = document.querySelector('.table-container');
    tablaContainer.style.opacity = "0";
    setTimeout(() => {
        tablaContainer.style.transition = "opacity 0.5s ease";
        tablaContainer.style.opacity = "1";
    }, 100);
}

// Actualizar total de la factura
function actualizarTotalFactura() {
    const preciosFacturados = document.querySelectorAll('.precio-facturado-input');
    let total = 0;
    
    preciosFacturados.forEach(input => {
        const valor = parseFloat(input.value) || 0;
        total += valor;
    });
    
    const totalElement = document.getElementById('total-factura');
    totalElement.textContent = total.toFixed(2);
    
    // Añadir efecto de animación al cambiar el total
    totalElement.classList.add('animate-update');
    setTimeout(() => {
        totalElement.classList.remove('animate-update');
    }, 500);
}

// Calcular expresión en campo de precio facturado
function calcularPrecioFacturado(input) {
    input.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            let expresion = this.value.trim();
            if (expresion.includes('+') || expresion.includes('-') || expresion.includes('*') || expresion.includes('/')) {
                try {
                    // Evaluar la expresión y redondear a 2 decimales
                    let resultado = Math.round(eval(expresion) * 100) / 100;
                    this.value = resultado;
                    this.dataset.originalValue = resultado;
                    // Disparar el evento 'input' para recalcular los costos
                    this.dispatchEvent(new Event('input', { bubbles: true }));
                } catch (error) {
                    console.error('Error al evaluar la expresión:', error);
                    mostrarError('Error de cálculo', 'La expresión ingresada no es válida.');
                }
            }
        }
    });
}
function navigateTable(e) {
    const currentCell = e.target.closest('td');
    const currentRow = currentCell.parentElement;
    const table = currentRow.closest('table');
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const rowIndex = rows.indexOf(currentRow);
    const cells = Array.from(currentRow.children);
    const cellIndex = cells.indexOf(currentCell);

    let nextCell;

    switch (e.key) {
        case 'ArrowUp':
            if (rowIndex > 0) {
                nextCell = rows[rowIndex - 1].children[cellIndex];
            }
            break;
        case 'ArrowDown':
        case 'Enter':
            if (rowIndex < rows.length - 1) {
                nextCell = rows[rowIndex + 1].children[cellIndex];
            }
            break;
        case 'ArrowLeft':
            if (cellIndex > 0) {
                // Si estamos en la columna de Cantidad, movernos a UPC
                if (currentCell.classList.contains('cantidad-column')) {
                    nextCell = cells.find(cell => cell.classList.contains('upc-column'));
                } else {
                    nextCell = cells[cellIndex - 1];
                }
            }
            break;
        case 'ArrowRight':
            if (cellIndex < cells.length - 1) {
                // Si estamos en la columna de UPC, movernos a Cantidad
                if (currentCell.classList.contains('upc-column')) {
                    nextCell = cells.find(cell => cell.classList.contains('cantidad-column'));
                } else {
                    nextCell = cells[cellIndex + 1];
                }
            }
            break;
    }

    if (nextCell) {
        const input = nextCell.querySelector('input');
        if (input) {
            input.focus();
            input.select();
        } else if (nextCell.classList.contains('descripcion-column')) {
            // Si la celda siguiente es la descripción, pasar a la siguiente celda editable
            navigateTable({
                key: e.key,
                target: nextCell
            });
        }
    }

    // Prevenir el comportamiento por defecto para Enter
    if (e.key === 'Enter') {
        e.preventDefault();
    }
}

// Asignar eventos de teclado para la navegación
function asignarEventosTeclado() {
    const table = document.querySelector('.data-table');
    
    table.addEventListener('keydown', (e) => {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
            e.preventDefault();
            navigateTable(e);
        }
    });
}

// Manejo de selección múltiple
function handleMultiSelect(e) {
    if (e.key === 'Shift') {
        isShiftPressed = true;
    }

    if (isShiftPressed && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        e.preventDefault();
        const currentCell = e.target.closest('td');
        
        if (!startCell) {
            startCell = currentCell;
        }
        endCell = currentCell;

        highlightCells();
    }
}

function handleKeyUp(e) {
    if (e.key === 'Shift') {
        isShiftPressed = false;
    }
}

function highlightCells() {
    if (!startCell || !endCell) return;

    const table = startCell.closest('table');
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const startRowIndex = rows.indexOf(startCell.parentElement);
    const endRowIndex = rows.indexOf(endCell.parentElement);
    const cellIndex = Array.from(startCell.parentElement.children).indexOf(startCell);

    // Clear previous selection
    table.querySelectorAll('.selected-cell').forEach(cell => cell.classList.remove('selected-cell'));

    // Highlight cells
    for (let i = Math.min(startRowIndex, endRowIndex); i <= Math.max(startRowIndex, endRowIndex); i++) {
        rows[i].children[cellIndex].classList.add('selected-cell');
    }
}

// Manejo de copiar/pegar
function handlePaste(e) {
    if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const selectedCells = document.querySelectorAll('.selected-cell');
        if (selectedCells.length === 0) return;

        navigator.clipboard.readText().then(text => {
            selectedCells.forEach(cell => {
                const input = cell.querySelector('input');
                if (input) {
                    input.value = text;
                    // Trigger any necessary recalculation
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            });

            // Deselect all cells after pasting
            deselectAllCells();
        });
    }
}

function deselectAllCells() {
    document.querySelectorAll('.selected-cell').forEach(cell => cell.classList.remove('selected-cell'));
    startCell = null;
    endCell = null;
}

// Manejo de UPC
function formatUPC(input) {
    let value = input.value.trim();
    
    // Comprobar si es un código de balanza (empieza con P o p)
    if (value.toLowerCase().startsWith('p')) {
        // Eliminar la 'P' inicial y cualquier caracter no numérico
        value = value.substring(1).replace(/\D/g, '');
        
        // Asegurarse de que hay al menos 3 dígitos después de la 'P'
        if (value.length >= 3) {
            // Formatear como 2500 + los siguientes 3 dígitos + ceros hasta completar 13 dígitos
            value = '2500' + value.substring(0, 3).padEnd(9, '0');
        } else {
            // Si no hay suficientes dígitos, rellenar con ceros
            value = '2500' + value.padEnd(9, '0');
        }
    } else {
        // Para UPC estándar, eliminar caracteres no numéricos
        value = value.replace(/\D/g, '');
    }

    // Asegurarse de que el valor final tiene 13 dígitos
    value = value.padStart(13, '0');

    // Limitar a 13 dígitos si excede
    value = value.slice(0, 13);

    if (value.length !== 13) {
        mostrarError('Error de formato', 'El UPC debe tener 13 dígitos después del formateo.');
        return null;
    }

    input.value = value;
    return value;
}

function manejarUpc(event) {
    const input = event.target;
    formatUPC(input);
}

// Función para manejar el evento keydown en el input UPC
async function manejarUpckeydown(event) {
    if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const input = event.target;
        const upc = formatUPC(input);
        if (upc) {
            const sucursalSelect = document.getElementById('sucursal-select');
            const sucursalData = sucursalSelect.selectedOptions[0].dataset;

            try {
                mostrarCargando('Buscando producto...');
                const producto = await buscarProducto(upc, sucursalData);
                Swal.close();
                
                if (producto) {
                    actualizarFilaConProducto(input, producto);
                } else {
                    mostrarError('Producto no encontrado', 'No se encontró un producto con el UPC proporcionado.');
                }
            } catch (error) {
                Swal.close();
                mostrarError('Error', 'Ocurrió un error al buscar el producto.');
            }
        }
        navegarsiguientecelda(input);
    }
}

function actualizarFilaConProducto(input, producto) {
    const row = input.closest('tr');
    const descripcionCell = row.querySelector('td:nth-child(2)');
    const costoInput = row.querySelector('.costo-input');

    if (descripcionCell) {
        descripcionCell.textContent = producto.DescLarga || 'Descripción no disponible';
        // Añadir animación para indicar actualización
        descripcionCell.classList.add('cell-updated');
        setTimeout(() => {
            descripcionCell.classList.remove('cell-updated');
        }, 1000);
    }
    if (costoInput) {
        costoInput.value = producto.Costo || '';
        costoInput.classList.add('cell-updated');
        setTimeout(() => {
            costoInput.classList.remove('cell-updated');
        }, 1000);
    }
    if (producto.Nivel1 > 0) {
        row.classList.add('nivel1-destacado');
    } else {
        row.classList.remove('nivel1-destacado');
    }
}

// Función para navegar a la siguiente celda
function navegarsiguientecelda(currentInput) {
    const currentCell = currentInput.closest('td');
    const nextCell = currentCell.nextElementSibling;
    if (nextCell) {
        const nextInput = nextCell.querySelector('input');
        if (nextInput) {
            nextInput.focus();
        }
    }
}

// Inicializar eventos UPC para todas las filas
function InicializartodasfilasUpc() {
    const upcInputs = document.querySelectorAll('.data-table .upc-input');
    upcInputs.forEach(input => {
        input.removeEventListener('blur', manejarUpc);
        input.removeEventListener('keydown', manejarUpckeydown);
        input.addEventListener('blur', manejarUpc);
        input.addEventListener('keydown', manejarUpckeydown);
    });
}

// Observar cambios en la tabla para actualizar eventos UPC
function ActualizarUpcdinamicamente() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const newUPCInputs = node.querySelectorAll('.upc-input');
                        newUPCInputs.forEach(input => {
                            input.addEventListener('blur', manejarUpc);
                            input.addEventListener('keydown', manejarUpckeydown);
                        });
                    }
                });
            }
        });
    });

    observer.observe(document.querySelector('.data-table tbody'), { childList: true, subtree: true });
}

// Aplicar descuento a todas las filas
// Función corregida para aplicar el descuento manteniendo el valor original del campo
function aplicarDescuentoGlobal() {
    const rows = document.querySelectorAll('.data-table tbody tr');
    let filasActualizadas = 0;
    
    // Verificar si hay filas para procesar
    if (rows.length === 0) {
        mostrarError('Sin datos', 'No hay filas de productos para aplicar descuento.');
        return;
    }
    
    // Mostrar indicador de carga
    mostrarCargando('Aplicando descuentos...');
    
    // Procesar cada fila
    rows.forEach(row => {
        const descuentoInput = row.querySelector('.descuento-input');
        const precioFacturadoInput = row.querySelector('.precio-facturado-input');
        const cantidadInput = row.querySelector('.cantidad-input');
        const bonificacionInput = row.querySelector('.bonificacion-input');
        const costoInput = row.querySelector('.costo-input');
        const costoFacturadoCell = row.querySelector('.costo-facturado-cell');
        const diferenciaCell = row.querySelector('.diferencia-cell');
        
        // Verificar que existan los elementos necesarios y que tengan valores
        if (descuentoInput && precioFacturadoInput && cantidadInput && 
            bonificacionInput && costoInput && costoFacturadoCell && diferenciaCell) {
            
            const descuentoPorcentaje = parseFloat(descuentoInput.value) || 0;
            const precioFacturado = parseFloat(precioFacturadoInput.value) || 0;
            const cantidad = parseFloat(cantidadInput.value) || 0;
            const bonificacion = parseFloat(bonificacionInput.value) || 0;
            const costo = parseFloat(costoInput.value) || 0;
            const cantidadTotal = cantidad + bonificacion;
            
            if (descuentoPorcentaje > 0 && precioFacturado > 0 && cantidadTotal > 0) {
                // Calcular el monto de descuento basado en el porcentaje
                const montoDescuento = precioFacturado * (descuentoPorcentaje / 100);
                
                // Calcular el precio con descuento y el costo facturado
                const precioConDescuento = Math.max(0, precioFacturado - montoDescuento);
                const costoFacturado = precioConDescuento / cantidadTotal;
                const diferencia = costoFacturado - costo;
                
                // Actualizar las celdas calculadas (NO el campo de descuento)
                costoFacturadoCell.textContent = costoFacturado.toFixed(2);
                diferenciaCell.textContent = diferencia.toFixed(2);
                
                // IMPORTANTE: Marcar este descuento como porcentual para el guardado
                descuentoInput.setAttribute('data-porcentual', 'true');
                
                // Aplicar clases según diferencia
                if (diferencia > 0) {
                    diferenciaCell.classList.add('diferencia-positiva');
                    diferenciaCell.classList.remove('diferencia-negativa');
                } else if (diferencia < 0) {
                    diferenciaCell.classList.add('diferencia-negativa');
                    diferenciaCell.classList.remove('diferencia-positiva');
                } else {
                    diferenciaCell.classList.remove('diferencia-positiva', 'diferencia-negativa');
                }
                
                // Añadir efectos visuales para indicar actualización
                costoFacturadoCell.classList.add('cell-updated');
                diferenciaCell.classList.add('cell-updated');
                descuentoInput.classList.add('descuento-porcentual'); // Clase visual opcional
                setTimeout(() => {
                    costoFacturadoCell.classList.remove('cell-updated');
                    diferenciaCell.classList.remove('cell-updated');
                }, 1000);
                
                filasActualizadas++;
            }
        }
    });
    
    // Cerrar indicador de carga
    Swal.close();
    
    // Actualizar el total general
    actualizarTotalFactura();
    
    // Mostrar mensaje de éxito
    if (filasActualizadas > 0) {
        
    } else {
        mostrarInfo(
            'Sin cambios', 
            'No se aplicaron descuentos. Verifique que los productos tengan valores en los campos de precio y descuento.'
        );
    }
}
function agregarEstiloDescuentoPorcentual() {
    const estilo = document.createElement('style');
    estilo.textContent = `
        .descuento-porcentual {
            background-color: rgba(107, 213, 225, 0.2) !important;
            color: var(--primary-dark) !important;
            font-weight: 600 !important;
        }
        .descuento-porcentual::after {
            content: "%";
            position: relative;
            display: inline;
            margin-left: 2px;
            color: var(--accent-color);
        }
    `;
    document.head.appendChild(estilo);
}
// Función adicional para mostrar mensajes informativos si no existe
if (typeof mostrarInfo !== 'function') {
    function mostrarInfo(titulo, mensaje) {
        Swal.fire({
            icon: 'info',
            title: titulo,
            text: mensaje,
            confirmButtonText: 'Entendido'
        });
    }
}

// Agregar nueva fila a la tabla
function agregarfila() {
    const tbody = document.querySelector('.data-table tbody');
    const sucursalSelect = document.getElementById('sucursal-select');
    const tipoSucursal = sucursalSelect?.selectedOptions[0]?.dataset?.tipoSucursal || '';
    
    // Crear nueva fila
    const newRow = document.createElement('tr');
    
    // Configurar HTML de la fila asegurando que todas las columnas estén presentes
    // y con las clases correctas para mantener la estructura de la tabla
    newRow.innerHTML = `
        <td class="upc-column"><input type="text" class="upc-input"></td>
        <td class="descripcion-column"></td>
        <td class="cantidad-column"><input type="number" class="cantidad-input" value="0"></td>
        <td class="costo-column"><input type="number" class="costo-input" value="0"></td>
        ${tipoSucursal === '2' ? 
            `<td class="costo-alterno-column"><input type="number" class="costo-alterno-input" readonly></td>` : 
            `<td class="costo-alterno-column" style="display: none;"><input type="number" class="costo-alterno-input" readonly></td>`
        }
        <td class="bonificacion-column"><input type="number" class="bonificacion-input" value="0"></td>
        <td class="precio-column"><input type="text" class="precio-facturado-input" value="0"></td>
        <td class="descuento-column"><input type="number" class="descuento-input" value="0"></td>
        <td class="costo-facturado-column costo-facturado-cell">0.00</td>
        <td class="diferencia-column diferencia-cell">0.00</td>
    `;
    
    tbody.appendChild(newRow);

    // Aplicar los mismos estilos y eventos a los nuevos inputs
    const inputs = newRow.querySelectorAll('input');
    const upcInput = newRow.querySelector('.upc-input');
    
    inputs.forEach(input => {
        input.addEventListener('input', actualizarCostos);
    });
    
    upcInput.addEventListener('blur', manejarUpc);
    upcInput.addEventListener('keydown', manejarUpckeydown);

    const precioFacturadoInput = newRow.querySelector('.precio-facturado-input');
    calcularPrecioFacturado(precioFacturadoInput);
    
    // Añadir animación para la nueva fila
    newRow.classList.add('row-new');
    setTimeout(() => {
        newRow.classList.remove('row-new');
    }, 1000);
    
    // Verificar si la columna costo-alterno debe estar visible
    const costoAlternoCell = newRow.querySelector('.costo-alterno-column');
    if (costoAlternoCell) {
        costoAlternoCell.style.display = tipoSucursal === '2' ? '' : 'none';
    }
    
    // Ejecutar el cálculo inicial de costos para la nueva fila
    const cantidadInput = newRow.querySelector('.cantidad-input');
    if (cantidadInput) {
        cantidadInput.dispatchEvent(new Event('input', { bubbles: true }));
    }
    
    // Enfocar el nuevo campo UPC
    upcInput.focus();
    
    // Actualizar el total
    actualizarTotalFactura();
    
    return newRow;
}

// Actualizar costos dentro de una fila
function actualizarCostos() {
    const row = this.closest('tr');
    if (!row) return; // Evitar errores si no encuentra la fila
    
    const cantidadInput = row.querySelector('.cantidad-input');
    const bonificacionInput = row.querySelector('.bonificacion-input');
    const precioFacturadoInput = row.querySelector('.precio-facturado-input');
    const costoInput = row.querySelector('.costo-input');
    const costoFacturadoCell = row.querySelector('.costo-facturado-cell');
    const diferenciaCell = row.querySelector('.diferencia-cell');
    const descuentoInput = row.querySelector('.descuento-input');

    // Verificar que se encontraron todos los elementos necesarios
    if (!cantidadInput || !bonificacionInput || !precioFacturadoInput || 
        !costoInput || !costoFacturadoCell || !diferenciaCell) {
        console.error('Error: No se encontraron todos los elementos necesarios en la fila');
        return;
    }

    const cantidad = parseFloat(cantidadInput.value) || 0;
    const bonificacion = parseFloat(bonificacionInput.value) || 0;
    const cantidadTotal = cantidad + bonificacion;
    const precioFacturado = parseFloat(precioFacturadoInput.value) || 0;
    const costo = parseFloat(costoInput.value) || 0;
    const descuento = parseFloat(descuentoInput.value) || 0;

    if (cantidadTotal > 0 && !isNaN(precioFacturado)) {
        // Aplicar descuento como valor ABSOLUTO (no como porcentaje)
        const precioConDescuento = Math.max(0, precioFacturado - descuento);
        
        // Dividir el precio con descuento entre la cantidad total
        const costoFacturado = precioConDescuento / cantidadTotal;
        const diferencia = costoFacturado - costo;

        // Formatear a 2 decimales para mostrar
        costoFacturadoCell.textContent = costoFacturado.toFixed(2);
        diferenciaCell.textContent = diferencia.toFixed(2);
        
        // Aplicar clases según diferencia
        if (diferencia > 0) {
            diferenciaCell.classList.add('diferencia-positiva');
            diferenciaCell.classList.remove('diferencia-negativa');
        } else if (diferencia < 0) {
            diferenciaCell.classList.add('diferencia-negativa');
            diferenciaCell.classList.remove('diferencia-positiva');
        } else {
            diferenciaCell.classList.remove('diferencia-positiva', 'diferencia-negativa');
        }
    } else {
        // Valores predeterminados si no hay cantidades válidas
        costoFacturadoCell.textContent = '0.00';
        diferenciaCell.textContent = '0.00';
        diferenciaCell.classList.remove('diferencia-positiva', 'diferencia-negativa');
    }
    
    // Actualizar el total general
    actualizarTotalFactura();
}

// Eliminar fila seleccionada
function eliminarfila(row) {
    const inputs = row.querySelectorAll('input');
    const hasData = Array.from(inputs).some(input => input.value.trim() !== '');

    if (hasData) {
        mostrarConfirmacion(
            '¿Eliminar fila?',
            "Esta fila contiene datos. ¿Está seguro de eliminarla?",
            () => {
                // Añadir animación de salida
                row.classList.add('row-delete');
                setTimeout(() => {
                    row.remove();
                    actualizarTotalFactura();
                    mostrarExito('Fila eliminada', 'La fila se ha eliminado correctamente.');
                }, 400);
            }
        );
    } else {
        // Animación de salida para filas sin datos
        row.classList.add('row-delete');
        setTimeout(() => {
            row.remove();
            actualizarTotalFactura();
        }, 400);
    }
}

// Abrir ventana de búsqueda
function toggleSearchWindow() {
    const searchWindow = document.getElementById('searchWindow');
    const searchInput = document.getElementById('searchInput');
    
    if (searchWindow.style.display === 'none' || !searchWindow.style.display) {
        searchWindow.style.display = 'block';
        searchInput.focus();
    } else {
        searchWindow.style.display = 'none';
    }
}

// Realizar búsqueda en la tabla
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    if (!searchTerm) {
        mostrarError('Búsqueda vacía', 'Por favor ingrese un término de búsqueda.');
        return;
    }
    
    const rows = document.querySelectorAll('.data-table tbody tr');
    let found = false;
    
    // Primero eliminar cualquier resaltado anterior
    rows.forEach(row => {
        row.classList.remove('highlight-row');
    });
    
    for (let i = 0; i < rows.length; i++) {
        const descriptionCell = rows[i].querySelector('td:nth-child(2)');
        const upcCell = rows[i].querySelector('.upc-input');
        
        const descripcionMatch = descriptionCell && 
                                 descriptionCell.textContent.toLowerCase().includes(searchTerm);
        const upcMatch = upcCell && 
                         upcCell.value.toLowerCase().includes(searchTerm);
        
        if (descripcionMatch || upcMatch) {
            // Desplazarse a la fila encontrada
            rows[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Resaltar la fila encontrada
            rows[i].classList.add('highlight-row');
            
            found = true;
            
            // Cerrar la ventana de búsqueda después de un breve retraso
            setTimeout(() => {
                toggleSearchWindow();
            }, 800);
            
            break;
        }
    }
    
    if (!found) {
        mostrarError('No encontrado', 'No se encontró ninguna coincidencia.');
    }
}

// Guardar cuadre de inventario
async function guardarCuadre() {
    const preciosFacturados = document.querySelectorAll('.data-table .precio-facturado-input');
    const camposVacios = Array.from(preciosFacturados).filter(input => input.value.trim() === '');

    if (camposVacios.length > 0) {
        mostrarError(
            'Campos incompletos',
            `Hay ${camposVacios.length} campo(s) de Precio Facturado sin completar. Por favor, llene todos los campos antes de guardar.`
        );
        
        // Resaltar campos vacíos
        camposVacios.forEach(input => {
            const cell = input.closest('td');
            cell.classList.add('campo-vacio');
            setTimeout(() => {
                cell.classList.remove('campo-vacio');
            }, 3000);
        });
        
        // Desplazarse al primer campo vacío
        camposVacios[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        camposVacios[0].focus();
        
        return;
    }

    try {
        await realizarGuardado();
    } catch (error) {
        console.error('Error en el proceso de guardado:', error);
        mostrarError(
            'Error al guardar',
            'Ocurrió un error al intentar guardar la información.',
            error.message
        );
    }
}
// Proceso de guardado
async function realizarGuardado() {
    const idInventario = document.getElementById('inventario-id').value;
    const idSucursal = document.getElementById('sucursal-select').value;
    
    // Verificar si el cuadre existe
    const existeInventario = await verificarExistenciaInventario(idInventario, idSucursal);
    
    let mensajeInicial = existeInventario ? 
        'Actualizando información del cuadre...' : 
        'Guardando nuevo cuadre...';

    mostrarCargando(mensajeInicial);

    let connection;
    try {
        connection = await conectarfacturas();
        
        const sucursalSelect = document.getElementById('sucursal-select');
        const fechaFactura = formatearFechaParaMySQL(document.getElementById('fecha-factura')?.textContent);
        const numero = document.getElementById('numero')?.textContent;
        const serie = document.getElementById('serie')?.textContent;
        const nombreSucursal = sucursalSelect?.options[sucursalSelect.selectedIndex]?.text;
        const fechaCuadre = obtenerFechaLocal();
        const usuario = localStorage.getItem('userName') || 'Usuario';
        const idUsuario = localStorage.getItem('userId') || '0';

        const idProveedores = document.getElementById('proveedor')?.dataset?.idProveedor || null;
        const idDepartamentos = document.getElementById('departamento')?.dataset?.idDepartamento || null;
        const idRazon = document.getElementById('razon-social')?.dataset?.idRazon || null;

        const rows = document.querySelectorAll('.data-table tbody tr');
        let processedRows = 0;

        if (existeInventario) {
            // Primero eliminamos los registros existentes
            await connection.query('DELETE FROM cuadrecostos WHERE IdCuadre = ? AND IdSucursal = ?', 
                [idInventario, idSucursal]);
        }

        for (const row of rows) {
            const upc = row.querySelector('.upc-input')?.value || '';
            const descripcion = row.querySelector('td:nth-child(2)')?.textContent || '';
            const cantidad = parseFloat(row.querySelector('.cantidad-input')?.value) || 0;
            const costo = parseFloat(row.querySelector('.costo-input')?.value) || 0;
            const bonificacion = parseFloat(row.querySelector('.bonificacion-input')?.value) || 0;
            const diferencia = parseFloat(row.querySelector('.diferencia-cell')?.textContent) || 0;
            const costoFacturado = parseFloat(row.querySelector('.costo-facturado-cell')?.textContent) || 0;
            const costoFiscal = costoFacturado / 1.12;
            const iva = costoFiscal * 0.12;
            
            // Obtener el valor original del descuento
            const descuentoInput = row.querySelector('.descuento-input');
            let descuentoValor = parseFloat(descuentoInput?.value) || 0;
            
            // Determinar si es un descuento porcentual o monetario
            // Si la fila ha sido procesada por el botón "Aplicar Descuento", usamos el flag
            let descuentoFactura = '';
            
            // Verificar si este descuento está marcado como porcentual
            if (descuentoInput && descuentoInput.hasAttribute('data-porcentual') && 
                descuentoInput.getAttribute('data-porcentual') === 'true') {
                // Es un descuento porcentual, guardar con %
                descuentoFactura = descuentoValor + '%';
            } else {
                // Es un descuento monetario, guardar el valor tal cual
                descuentoFactura = descuentoValor.toString();
            }
            
            // Evitar guardar filas vacías
            if (!upc) continue;

            const rowData = [
                idInventario, upc, descripcion, idProveedores, idDepartamentos, fechaFactura, 
                numero, serie, costo, costoFacturado, diferencia, idSucursal, nombreSucursal, 
                fechaCuadre, usuario, cantidad, idRazon, bonificacion, costoFiscal, iva, idUsuario, descuentoFactura
            ];

            const query = `
                INSERT INTO cuadrecostos (
                    IdCuadre, Upc, Descripcion, Proveedor, Departamento, FechaFactura, 
                    NoFactura, Serie, costosistema, costofacturado, diferencia, 
                    IdSucursal, sucursal, fechacuadre, Usuario, CantidadIngresada, 
                    IdRazonSocial, BonificacionIngresada, Costofiscal, Iva, IdUsuario, Descuentofactura
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            await connection.query(query, rowData);
            processedRows++;
            
            // Actualizar el indicador de progreso cada 10 filas
            if (processedRows % 10 === 0) {
                Swal.update({
                    title: mensajeInicial,
                    text: `Procesando... (${processedRows} de ${rows.length} filas)`
                });
            }
        }
        
        Swal.close();
        
        let mensajeExito = existeInventario ?
            'Cuadre actualizado exitosamente' :
            'Nuevo cuadre guardado exitosamente';

        mostrarExito(
            mensajeExito, 
            `Se han ${existeInventario ? 'actualizado' : 'guardado'} ${processedRows} filas correctamente.`,
            limpiarFormulario
        );

    } catch (error) {
        console.error('Error detallado al guardar el cuadre:', error);
        let errorMessage = 'Ocurrió un error al guardar el cuadre. Detalles:\n\n';
        
        if (error.message) errorMessage += `Mensaje: ${error.message}\n`;
        if (error.sqlState) errorMessage += `Estado SQL: ${error.sqlState}\n`;
        if (error.code) errorMessage += `Código: ${error.code}\n`;
        
        throw new Error(errorMessage);
    } finally {
        if (connection) {
            try {
                await connection.close();
            } catch (closeError) {
                console.error("Error al cerrar la conexión:", closeError);
            }
        }
    }
}

// Limpiar formulario
function limpiarFormulario() {
    const inventarioIdInput = document.getElementById('inventario-id');
    inventarioIdInput.value = '';

    // Limpiar información del inventario
    const infoElements = ['fecha', 'serie', 'numero', 'fecha-factura', 'departamento', 'proveedor', 'razon-social', 'observaciones', 'criterio-cuadre'];
    infoElements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = '';
            // Limpiar también los data-attributes
            element.removeAttribute('data-id-departamento');
            element.removeAttribute('data-id-proveedor');
            element.removeAttribute('data-id-razon');
        }
    });

    // Limpiar tabla de detalles
    const tbody = document.querySelector('.data-table tbody');
    if (tbody) {
        tbody.innerHTML = '';
    }
    
    // Reiniciar el total
    document.getElementById('total-factura').textContent = '0.00';
    
    // Darle foco al campo de ID de inventario
    inventarioIdInput.focus();
    
    console.log('Formulario limpiado exitosamente (manteniendo la sucursal seleccionada)');
}
function exportarAExcel() {
    // Obtener la tabla
    const table = document.querySelector('.data-table');
    if (!table) {
        mostrarError('Error', 'No se encuentra la tabla de datos para exportar.');
        return;
    }
    
    // Obtener encabezados
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
    
    // Filtrar encabezados ocultos (si hay alguna columna que no debe exportarse)
    const visibleHeaders = headers.filter((header, index) => {
        const th = table.querySelector(`thead th:nth-child(${index + 1})`);
        return getComputedStyle(th).display !== 'none';
    });
    
    // Obtener filas de datos
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    
    // Crear array para contener todos los datos
    let dataArray = [visibleHeaders];
    
    // Procesar cada fila
    rows.forEach(row => {
        // Saltarse filas vacías o mensajes "No hay datos"
        if (row.classList.contains('no-data')) return;
        
        const rowData = [];
        
        // Obtener celdas y procesar cada una según su tipo
        row.querySelectorAll('td').forEach((cell, index) => {
            // Verificar si la celda está visible
            if (getComputedStyle(cell).display === 'none') return;
            
            let cellValue = '';
            
            // Procesar según el tipo de celda
            if (cell.classList.contains('upc-column')) {
                // Para UPC, tomar el valor del input
                cellValue = cell.querySelector('input')?.value || '';
            } else if (cell.classList.contains('descripcion-column')) {
                // Para descripción, tomar el texto directo
                cellValue = cell.textContent.trim();
            } else if (cell.classList.contains('cantidad-column') || 
                       cell.classList.contains('costo-column') || 
                       cell.classList.contains('bonificacion-column') ||
                       cell.classList.contains('precio-column') ||
                       cell.classList.contains('descuento-column')) {
                // Para campos numéricos editables, tomar el valor del input
                cellValue = cell.querySelector('input')?.value || '0';
            } else if (cell.classList.contains('costo-facturado-column') || 
                       cell.classList.contains('diferencia-column')) {
                // Para campos calculados, tomar el texto de la celda
                cellValue = cell.textContent.trim() || '0';
            }
            
            rowData.push(cellValue);
        });
        
        // Añadir la fila de datos solo si tiene contenido
        if (rowData.some(cell => cell !== '')) {
            dataArray.push(rowData);
        }
    });
    
    // Convertir el array a formato TSV (Tab-Separated Values) para Excel
    const tsvContent = dataArray.map(row => row.join('\t')).join('\n');
    
    // Copiar al portapapeles
    copyToClipboard(tsvContent).then(() => {
        // Mostrar notificación de éxito
        showCopyNotification();
    }).catch(err => {
        mostrarError('Error al copiar', 'No se pudieron copiar los datos al portapapeles.');
        console.error('Error al copiar:', err);
    });
}

// Función para copiar texto al portapapeles
async function copyToClipboard(text) {
    try {
        // Método moderno (API Clipboard)
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(text);
            return true;
        } else {
            // Método alternativo para contextos no seguros
            const textArea = document.createElement('textarea');
            textArea.value = text;
            
            // Hacer el textarea no visible
            textArea.style.position = 'fixed';
            textArea.style.opacity = '0';
            
            document.body.appendChild(textArea);
            textArea.select();
            
            // Copiar selección
            const result = document.execCommand('copy');
            
            // Limpiar
            document.body.removeChild(textArea);
            
            if (!result) {
                throw new Error('No se pudo copiar el texto');
            }
            return true;
        }
    } catch (err) {
        console.error('Error al copiar al portapapeles:', err);
        throw err;
    }
}

// Mostrar notificación de copiado exitoso
function showCopyNotification() {
    // Remover notificación previa si existe
    const existingNotification = document.querySelector('.copy-notification');
    if (existingNotification) {
        document.body.removeChild(existingNotification);
    }
    
    // Crear nueva notificación
    const notification = document.createElement('div');
    notification.className = 'copy-notification';
    notification.textContent = 'Datos copiados al portapapeles';
    
    // Añadir al DOM
    document.body.appendChild(notification);
    
    // Eliminar después de la animación
    setTimeout(() => {
        if (notification.parentNode) {
            notification.parentNode.removeChild(notification);
        }
    }, 3000);
}
// Inicialización del documento
document.addEventListener('DOMContentLoaded', () => {
    // Inicialización de elementos principales
    const sucursalSelect = document.getElementById('sucursal-select');
    const buscarBtn = document.getElementById('buscar-btn');
    const inventarioIdInput = document.getElementById('inventario-id');
    const guardarBtn = document.getElementById('guardar-btn');
    const descuentoBtn = document.getElementById('descuento-btn');
    const addRowBtn = document.querySelector('.add-row');
    const searchTableBtn = document.querySelector('.search-table');
    const closeSearchBtn = document.getElementById('closeSearch');
    const searchBtn = document.getElementById('searchButton');
    const searchInput = document.getElementById('searchInput');
    
    // Panel colapsable
    const infoHeader = document.getElementById('info-header');
    const infoContent = document.getElementById('info-content');
    const exportBtn = document.getElementById('export-excel-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportarAExcel);
    }
    if (infoHeader && infoContent) {
        infoHeader.addEventListener('click', function() {
            this.classList.toggle('collapsed');
            infoContent.classList.toggle('open');
            
            const toggleIcon = this.querySelector('.toggle-icon');
            if (infoContent.classList.contains('open')) {
                toggleIcon.textContent = '▼';
            } else {
                toggleIcon.textContent = '▶';
            }
        });
        
        // Inicializar el panel como abierto
        infoContent.classList.add('open');
    }
    
    // Cargar sucursales al iniciar
    loadSucursales();
    
    // Inicializar eventos UPC
    InicializartodasfilasUpc();
    ActualizarUpcdinamicamente();
    agregarEstiloDescuentoPorcentual();
    // Asignar eventos de botones principales
    if (guardarBtn) {
        guardarBtn.addEventListener('click', guardarCuadre);
    }
    
    if (buscarBtn && inventarioIdInput) {
        buscarBtn.addEventListener('click', async () => {
            const idInventario = inventarioIdInput.value;
            const sucursalData = sucursalSelect.selectedOptions[0]?.dataset;
            const idSucursal = sucursalSelect.value;
            const nombreSucursal = sucursalSelect.selectedOptions[0]?.text;
    
            if (!idInventario || !sucursalData) {
                mostrarError(
                    'Advertencia', 
                    'Debe seleccionar una sucursal e ingresar un ID de inventario.'
                );
                return;
            }
    
            try {
                // Primero verificamos si el cuadre ya existe
                const existeInventario = await verificarExistenciaInventario(idInventario, idSucursal);
                
                if (existeInventario) {
                    mostrarConfirmacion(
                        'Cuadre Existente',
                        `Ya existe información guardada para el inventario ${idInventario} de la sucursal ${nombreSucursal}. ¿Desea continuar y sobrescribir?`,
                        async () => {
                            const inventario = await obtenerInventario(sucursalData, idInventario);
                            if (inventario) {
                                mostrarInventario(inventario);
                            }
                        }
                    );
                } else {
                    // Si no existe el cuadre, procedemos con la búsqueda
                    const inventario = await obtenerInventario(sucursalData, idInventario);
                    if (inventario) {
                        mostrarInventario(inventario);
                    }
                }
            } catch (error) {
                console.error('Error al buscar el inventario:', error);
                mostrarError(
                    'Error', 
                    'Ocurrió un error al buscar el inventario.',
                    error.message
                );
            }
        });
        
        // Permitir usar Enter en el campo ID para buscar
        inventarioIdInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                buscarBtn.click();
            }
        });
    }
    
    // Evento para aplicar descuento
    if (descuentoBtn) {
        descuentoBtn.addEventListener('click', aplicarDescuentoGlobal);
    }
    
    // Evento para agregar fila
    if (addRowBtn) {
        addRowBtn.addEventListener('click', agregarfila);
    }
    
    // Eventos para búsqueda
    if (searchTableBtn) {
        searchTableBtn.addEventListener('click', toggleSearchWindow);
    }
    
    if (closeSearchBtn) {
        closeSearchBtn.addEventListener('click', () => {
            document.getElementById('searchWindow').style.display = 'none';
        });
    }
    
    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', performSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                performSearch();
            }
        });
    }
    
    // Cerrar búsqueda al hacer clic fuera
    window.addEventListener('click', (e) => {
        const searchWindow = document.getElementById('searchWindow');
        if (e.target === searchWindow) {
            searchWindow.style.display = 'none';
        }
    });
    
    // Eventos para atajos de teclado
    document.addEventListener('keydown', (e) => {
        // Ctrl+B para abrir búsqueda
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            toggleSearchWindow();
        }
        
        // Ctrl++ para agregar fila
        if (e.ctrlKey && e.key === '+') {
            e.preventDefault();
            agregarfila();
        }
        
        // Ctrl+- para eliminar fila
        if (e.ctrlKey && e.key === '-') {
            e.preventDefault();
            const focusedElement = document.activeElement;
            const row = focusedElement.closest('tr');
            if (row) {
                eliminarfila(row);
            }
        }
        
        // Manejo de selección múltiple
        handleMultiSelect(e);
        
        // Manejo de pegado
        handlePaste(e);
    });
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            exportarAExcel();
        }
    });
    
    document.addEventListener('keyup', handleKeyUp);
    
    // Animación inicial
    const mainContent = document.querySelector('.main-content');
    const sidePanel = document.querySelector('.side-panel');
    
    if (mainContent && sidePanel) {
        mainContent.style.opacity = "0";
        sidePanel.style.opacity = "0";
        
        setTimeout(() => {
            sidePanel.style.transition = "opacity 0.5s ease";
            sidePanel.style.opacity = "1";
            
            setTimeout(() => {
                mainContent.style.transition = "opacity 0.5s ease";
                mainContent.style.opacity = "1";
            }, 200);
        }, 100);
    }
    
    // Ajuste dinámico de altura de tabla para maximizar espacio visible
    function ajustarAlturaTabla() {
        const tableContainer = document.querySelector('.table-container');
        if (tableContainer) {
            const headerHeight = document.querySelector('.app-header').offsetHeight;
            const infoHeaderHeight = document.querySelector('.collapsible-header').offsetHeight;
            const actionsBarHeight = document.querySelector('.actions-bar')?.offsetHeight || 0;
            const sectionTitleHeight = document.querySelector('.section-title')?.offsetHeight || 0;
            const windowHeight = window.innerHeight;
            const otherElements = headerHeight + infoHeaderHeight + actionsBarHeight + sectionTitleHeight + 40; // Margen adicional
            
            const maxHeight = windowHeight - otherElements;
            tableContainer.style.maxHeight = `${maxHeight}px`;
        }
    }
    
    // Ajustar altura inicial y en cada cambio de tamaño de ventana
    ajustarAlturaTabla();
    window.addEventListener('resize', ajustarAlturaTabla);
});

// Obtener elemento activo al inicio
function getFocusableElements() {
    return Array.from(document.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
        .filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null);
}

// Mejora de accesibilidad para teclas Tab
function setupTabNavigation() {
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            const focusableElements = getFocusableElements();
            const firstElement = focusableElements[0];
            const lastElement = focusableElements[focusableElements.length - 1];
            
            if (e.shiftKey && document.activeElement === firstElement) {
                e.preventDefault();
                lastElement.focus();
            } else if (!e.shiftKey && document.activeElement === lastElement) {
                e.preventDefault();
                firstElement.focus();
            }
        }
    });
}

// Inicializar navegación por Tab
setupTabNavigation();

// Añadir animaciones CSS dinámicas
function agregarAnimacionesCSS() {
    const styleElement = document.createElement('style');
    styleElement.textContent = `
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        @keyframes fadeInOut {
            0% { opacity: 0.6; }
            50% { opacity: 1; }
            100% { opacity: 0.6; }
        }
        
        .animate-update {
            animation: pulse 0.5s ease;
        }
        
        .cell-updated {
            animation: fadeInOut 1s ease;
            background-color: rgba(46, 204, 113, 0.2);
        }
        
        .row-new {
            animation: fadeInOut 1s ease;
            background-color: rgba(52, 152, 219, 0.2);
        }
        
        .row-delete {
            animation: fadeOut 0.4s ease forwards;
            pointer-events: none;
        }
        
        .campo-vacio {
            animation: errorPulse 2s infinite;
            background-color: rgba(231, 76, 60, 0.2);
        }
        
        .diferencia-positiva {
            color: #27ae60;
            font-weight: 500;
        }
        
        .diferencia-negativa {
            color: #e74c3c;
            font-weight: 500;
        }
        
        @keyframes fadeOut {
            from { opacity: 1; transform: translateX(0); }
            to { opacity: 0; transform: translateX(-20px); }
        }
        
        @keyframes errorPulse {
            0% { background-color: rgba(231, 76, 60, 0.2); }
            50% { background-color: rgba(231, 76, 60, 0.4); }
            100% { background-color: rgba(231, 76, 60, 0.2); }
        }
        
        .highlight-row {
            animation: highlightPulse 2s ease-in-out;
            background-color: rgba(241, 196, 15, 0.3) !important;
        }
        
        @keyframes highlightPulse {
            0% { background-color: rgba(241, 196, 15, 0.5); }
            100% { background-color: rgba(241, 196, 15, 0.3); }
        }
    `;
    
    document.head.appendChild(styleElement);
}

// Ejecutar al inicio
agregarAnimacionesCSS();