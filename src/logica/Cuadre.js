const odbc = require('odbc');
const conexionsucuales = 'DSN=DBsucursal'; // Ajusta tu DSN aquí
const mysql = require('mysql2/promise');
const Swal = require('sweetalert2');
const conexionfacturas = 'DSN=facturas';
const conexionlocal = 'DNS=local';

let isShiftPressed = false;
let startCell = null;
let endCell = null;
let copiedContent = "";

    async function conectar() {
    try {
            const connection = await odbc.connect(conexionsucuales);
            await connection.query('SET NAMES utf8mb4');
            return connection;
        } catch (error) {
            console.error('Error al conectar a la base de datos:', error);
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
                throw error;
        }
    }
        async function loadSucursales() {
            try {
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
            } catch (error) {
                console.error('Error al cargar las sucursales:', error);
            }
        }
    function actualizarTotalFactura() {
        const preciosFacturados = document.querySelectorAll('.precio-facturado-input');
        let total = 0;
        preciosFacturados.forEach(input => {
            const valor = parseFloat(input.value) || 0;
            total += valor;
        });
        document.getElementById('total-factura').textContent = total.toFixed(2);
    }
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
    async function obtenerInventario(sucursalData, idInventario) {
        Swal.fire({
            title: 'Cargando inventario',
            text: 'Por favor espere...',
            allowOutsideClick: false,
            allowEscapeKey: false,
            allowEnterKey: false,
            showConfirmButton: false,
            willOpen: () => {
                Swal.showLoading();
            }
        });
    
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
                    detalleinventarios.Cantidad,
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
                    inventarios.idInventarios = ?
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
                            Cantidad: row.Cantidad,
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
            Swal.fire({
                icon: 'error',
                title: 'Error al obtener inventario',
                html: `<pre style="text-align: left;">${error.message}</pre>`,
                customClass: {
                    popup: 'swal-wide'
                }
            });
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
            console.error('Error al conectar a la base de datos especial:', error);
            throw error;
        }
    }
    
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
                        Swal.fire({
                            icon: 'error',
                            title: 'Error de cálculo',
                            text: 'La expresión ingresada no es válida.'
                        });
                    }
                }
            }
        });
    }
    
    function mostrarInventario(inventario) {
        
        document.getElementById('descuento-btn').addEventListener('click', () => {
            const rows = document.querySelectorAll('#detalle-inventario tbody tr');
            rows.forEach(aplicarDescuentoAFila);
            rows.forEach(row => {
                const precioFacturadoInput = row.querySelector('.precio-facturado-input');
                const descuentoInput = row.querySelector('.descuento-input');
                const costoFacturadoCell = row.querySelector('.costo-facturado-cell');
                const diferenciaCell = row.querySelector('.diferencia-cell');
                const cantidadInput = row.querySelector('.cantidad-input');
                const bonificacionInput = row.querySelector('.bonificacion-input');
                const costoInput = row.querySelector('.costo-input');
        
                let precioFacturadoOriginal = parseFloat(precioFacturadoInput.dataset.originalValue || precioFacturadoInput.value);
                let descuentoPorcentaje = parseFloat(descuentoInput.value);
        
                if (!isNaN(descuentoPorcentaje) && !isNaN(precioFacturadoOriginal) && descuentoPorcentaje > 0) {
                    // Aplicar el descuento en porcentaje
                    let nuevoPrecioFacturado = precioFacturadoOriginal - (precioFacturadoOriginal * (descuentoPorcentaje / 100));
                    precioFacturadoInput.value = nuevoPrecioFacturado.toFixed(2);
        
                    // Recalcular Costo Facturado y Diferencia
                    const cantidadTotal = parseFloat(cantidadInput.value) + parseFloat(bonificacionInput.value);
                    if (cantidadTotal > 0) {
                        const costoFacturado = nuevoPrecioFacturado / cantidadTotal;
                        const diferencia = costoFacturado - parseFloat(costoInput.value);
        
                        costoFacturadoCell.textContent = costoFacturado.toFixed(2);
                        diferenciaCell.textContent = diferencia.toFixed(2);
                    } else {
                        costoFacturadoCell.textContent = '';
                        diferenciaCell.textContent = '';
                    }
                }
            });
        });
        
        // Mostrar la información general del inventario
        document.getElementById('fecha').innerText = formatearFecha(inventario.info.Fecha);
        document.getElementById('serie').innerText = inventario.info.Serie;
        document.getElementById('numero').innerText = inventario.info.Numero;
        document.getElementById('fecha-factura').innerText = formatearFecha(inventario.info.FechaFactura);
        const departamentoElement = document.getElementById('departamento');
        departamentoElement.innerText = inventario.info.Departamento;
        departamentoElement.dataset.idDepartamento = inventario.info.IdDepartamentos;
        
        const proveedorElement = document.getElementById('proveedor');
        proveedorElement.innerText = inventario.info.Proveedor;
        proveedorElement.dataset.idProveedor = inventario.info.IdProveedores;
        
        const razonSocialElement = document.getElementById('razon-social');
        razonSocialElement.innerText = inventario.info.RazonSocial;
        razonSocialElement.dataset.idRazon = inventario.info.IdRazon;
        document.getElementById('observaciones').innerText = inventario.info.Observaciones;
        document.getElementById('criterio-cuadre').innerText = inventario.criterioCuadre;
        // Mostrar los detalles del inventario
        const tbody = document.getElementById('detalle-inventario').querySelector('tbody');
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
                    ${tipoSucursal === '2' ? `<td class="costo-alterno-column"><input type="number" value="${detalle.CostoAlterno || ''}" class="costo-alterno-input" readonly></td>` : ''}
                    <td class="bonificacion-column"><input type="number" value="${detalle.Bonificacion}" class="bonificacion-input"></td>
                    <td class="precio-column"><input type="text" value="${detalle.PrecioFacturado || ''}" class="precio-facturado-input"></td>
                    <td class="descuento-column"><input type="number" value="${detalle.Descuento || ''}" class="descuento-input"></td>
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
                const costoFacturadoCell = tr.querySelector('.costo-facturado-cell');
                const diferenciaCell = tr.querySelector('.diferencia-cell');
                
                calcularPrecioFacturado(precioFacturadoInput);
                // Función para calcular y actualizar Costo Facturado y Diferencia
                const actualizarCostos = () => {
                    const cantidadTotal = parseFloat(cantidadInput.value) + parseFloat(bonificacionInput.value);
                    let precioFacturado = parseFloat(precioFacturadoInput.dataset.originalValue || precioFacturadoInput.value);
    
                    if (cantidadTotal > 0 && !isNaN(precioFacturado)) {
                        const descuento = parseFloat(descuentoInput.value) || 0;
                        precioFacturado -= descuento;
    
                        const costoFacturado = precioFacturado / cantidadTotal;
                        const diferencia = costoFacturado - parseFloat(costoInput.value);
    
                        costoFacturadoCell.textContent = costoFacturado.toFixed(2);
                        diferenciaCell.textContent = diferencia.toFixed(2);
                    } else {
                        costoFacturadoCell.textContent = '';
                        diferenciaCell.textContent = '';
                    }
                };
                const inputs = tr.querySelectorAll('input');
                inputs.forEach(input => {
                    input.addEventListener('input', actualizarCostos);
                });
                // Guardar el valor original del Precio Facturado
                precioFacturadoInput.dataset.originalValue = detalle.PrecioFacturado;
    
                // Eventos para recalcular cuando se cambia Precio Facturado, Cantidad, Bonificación o Descuento
                precioFacturadoInput.addEventListener('input', () => {
                    precioFacturadoInput.dataset.originalValue = precioFacturadoInput.value;
                    actualizarCostos();
                    actualizarTotalFactura();
                });
    
                cantidadInput.addEventListener('input', actualizarCostos);
                bonificacionInput.addEventListener('input', actualizarCostos);
                descuentoInput.addEventListener('input', actualizarCostos);
            });
        } else {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="${tipoSucursal === '2' ? '10' : '9'}">No hay detalles disponibles</td>`;
            tbody.appendChild(tr);
        }
        actualizarTotalFactura();
        asignarEventosTeclado();
        actualizarEstructuraTabla();
    }   
    function actualizarEstructuraTabla() {
        const rows = document.querySelectorAll('#detalle-inventario tbody tr');
        rows.forEach(row => {
            const cells = row.children;
            cells[0].classList.add('upc-column');
            cells[1].classList.add('descripcion-column');
            cells[2].classList.add('cantidad-column');
            // Asegúrate de agregar las clases correspondientes a las demás columnas si es necesario
        });
    }
    
    function formatearFecha(fecha) {
        const date = new Date(fecha);
        const dia = String(date.getDate()).padStart(2, '0');
        const mes = String(date.getMonth() + 1).padStart(2, '0');
        const anio = date.getFullYear();
        return `${dia}-${mes}-${anio}`;
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
    function asignarEventosTeclado() {
        const table = document.getElementById('detalle-inventario');
        table.addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                e.preventDefault();
                navigateTable(e);
            }
        });
    }
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
        table.querySelectorAll('.selected').forEach(cell => cell.classList.remove('selected'));
    
        // Highlight cells
        for (let i = Math.min(startRowIndex, endRowIndex); i <= Math.max(startRowIndex, endRowIndex); i++) {
            rows[i].children[cellIndex].classList.add('selected');
        }
    }
    
    function handlePaste(e) {
        if (e.key === 'v' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            const selectedCells = document.querySelectorAll('.selected');
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
        document.querySelectorAll('.selected').forEach(cell => cell.classList.remove('selected'));
        startCell = null;
        endCell = null;
    }
    function formatearFechaParaMySQL(fechaString) {
        if (!fechaString) return null;
        const partes = fechaString.split('-');
        if (partes.length !== 3) return null;
        return `${partes[2]}-${partes[1]}-${partes[0]}`;
    }
    async function verificarExistenciaInventario(idInventario, idSucursal) {
        let connection;
        try {
            connection = await odbc.connect(conexionfacturas);
            const query = `
                SELECT COUNT(*) as count 
                FROM cuadre
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
    
    async function guardarCuadre() {
        const preciosFacturados = document.querySelectorAll('#detalle-inventario .precio-facturado-input');
        const camposVacios = Array.from(preciosFacturados).filter(input => input.value.trim() === '');
    
        if (camposVacios.length > 0) {
            Swal.fire({
                icon: 'warning',
                title: 'Campos incompletos',
                text: `Hay ${camposVacios.length} campo(s) de Precio Facturado sin completar. Por favor, llene todos los campos antes de guardar.`,
                confirmButtonText: 'Entendido'
            });
            return;
        }
    
        try {
            await realizarGuardado();
        } catch (error) {
            console.error('Error en el proceso de guardado:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Ocurrió un error al intentar guardar la información.'
            });
        }
    }
    function obtenerFechaLocal() {
        const ahora = new Date();
        const offset = ahora.getTimezoneOffset() * 60000; // offset en milisegundos
        const fechaLocal = new Date(ahora.getTime() - offset);
        return fechaLocal.toISOString().slice(0, 19).replace('T', ' ');
    }
    async function realizarGuardado() {
        const idInventario = document.getElementById('inventario-id').value;
        const idSucursal = document.getElementById('sucursal-select').value;
        
        // Verificar si el cuadre existe
        const existeInventario = await verificarExistenciaInventario(idInventario, idSucursal);
        
        let mensajeInicial = existeInventario ? 
            'Actualizando información del cuadre...' : 
            'Guardando nuevo cuadre...';

        Swal.fire({
            title: mensajeInicial,
            text: 'Por favor espere...',
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
            connection = await conectarfacturas();
            
            const sucursalSelect = document.getElementById('sucursal-select');
            const fechaFactura = formatearFechaParaMySQL(document.getElementById('fecha-factura')?.innerText);
            const numero = document.getElementById('numero')?.innerText;
            const serie = document.getElementById('serie')?.innerText;
            const nombreSucursal = sucursalSelect?.options[sucursalSelect.selectedIndex]?.text;
            const fechaCuadre = obtenerFechaLocal();
            const usuario = localStorage.getItem('userName');
            const idUsuario = localStorage.getItem('userId');

            const idProveedores = document.getElementById('proveedor')?.dataset?.idProveedor || null;
            const idDepartamentos = document.getElementById('departamento')?.dataset?.idDepartamento || null;
            const idRazon = document.getElementById('razon-social')?.dataset?.idRazon || null;

            const rows = document.querySelectorAll('#detalle-inventario tbody tr');
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

                const rowData = [
                    idInventario, upc, descripcion, idProveedores, idDepartamentos, fechaFactura, 
                    numero, serie, costo, costoFacturado, diferencia, idSucursal, nombreSucursal, 
                    fechaCuadre, usuario, cantidad, idRazon, bonificacion, costoFiscal, iva, idUsuario
                ];

                const query = `
                    INSERT INTO cuadrecostos (
                        IdCuadre, Upc, Descripcion, Proveedor, Departamento, FechaFactura, 
                        NoFactura, Serie, costosistema, costofacturado, diferencia, 
                        IdSucursal, sucursal, fechacuadre, Usuario, CantidadIngresada, 
                        IdRazonSocial, BonificacionIngresada, Costofiscal, Iva, IdUsuario
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;

                await connection.query(query, rowData);
                processedRows++;
            }
            let mensajeExito = existeInventario ?
                'Cuadre actualizado exitosamente' :
                'Nuevo cuadre guardado exitosamente';

            Swal.fire({
                icon: 'success',
                title: mensajeExito,
                text: `Se han ${existeInventario ? 'actualizado' : 'guardado'} ${processedRows} filas correctamente.`
            }).then((result) => {
                if (result.isConfirmed) {
                    limpiarFormulario();
                }
            });

        } catch (error) {
            console.error('Error detallado al guardar el cuadre:', error);
            let errorMessage = 'Ocurrió un error al guardar el cuadre. Detalles:\n\n';
            
            if (error.message) errorMessage += `Mensaje: ${error.message}\n`;
            if (error.sqlState) errorMessage += `Estado SQL: ${error.sqlState}\n`;
            if (error.code) errorMessage += `Código: ${error.code}\n`;
            if (error.stack) errorMessage += `Stack: ${error.stack}\n`;

            Swal.fire({
                icon: 'error',
                title: 'Error al guardar',
                html: `<pre class="error-content">${errorMessage}</pre>`,
                customClass: {
                    popup: 'error-popup'
                }
            });
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
    function limpiarFormulario() {
        const inventarioIdInput = document.getElementById('inventario-id');
        inventarioIdInput.value = '';
    
        // Limpiar información del inventario
        const infoElements = ['fecha', 'serie', 'numero', 'fecha-factura', 'departamento', 'proveedor', 'razon-social', 'observaciones', 'criterio-cuadre'];
        infoElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.innerText = '';
                // Limpiar también los data-attributes
                element.removeAttribute('data-id-departamento');
                element.removeAttribute('data-id-proveedor');
                element.removeAttribute('data-id-razon');
            }
        });

        // Limpiar tabla de detalles
        const tbody = document.querySelector('#detalle-inventario tbody');
        if (tbody) {
            tbody.innerHTML = '';
        }
        inventarioIdInput.focus();
        console.log('Formulario limpiado exitosamente (manteniendo la sucursal seleccionada)');
    }
    
    // Add these event listeners to your existing code
    document.addEventListener('keydown', handleMultiSelect);
    document.addEventListener('keyup', handleKeyUp);
    document.addEventListener('keydown', handlePaste);
    
    document.addEventListener('DOMContentLoaded', () => {
        const sucursalSelect = document.getElementById('sucursal-select');
        const buscarBtn = document.getElementById('buscar-btn');
        const inventarioIdInput = document.getElementById('inventario-id');
        const table = document.getElementById('detalle-inventario');
        const guardarBtn = document.getElementById('guardar-btn');
        const accordionButton = document.querySelector('.accordion-button');
        const accordionContent = document.getElementById('inventarioContent');

        accordionButton.addEventListener('click', function() {
            this.classList.toggle('collapsed');
            accordionContent.classList.toggle('collapsed');
            
            if (!accordionContent.classList.contains('collapsed')) {
                accordionContent.style.maxHeight = accordionContent.scrollHeight + "px";
            } else {
                accordionContent.style.maxHeight = 0;
            }
        });

        // Inicializar el acordeón como expandido
        accordionContent.style.maxHeight = accordionContent.scrollHeight + "px";
        // Obtener sucursales al cargar la página
        loadSucursales();
        InicializartodasfilasUpc();
        ActualizarUpcdinamicamente();
        guardarBtn.addEventListener('click', guardarCuadre);
        buscarBtn.addEventListener('click', async () => {
            const idInventario = inventarioIdInput.value;
            const sucursalData = sucursalSelect.selectedOptions[0]?.dataset;
            const idSucursal = sucursalSelect.value;
            const nombreSucursal = sucursalSelect.selectedOptions[0]?.text;
    
            if (!idInventario || !sucursalData) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Advertencia',
                    text: 'Debe seleccionar una sucursal e ingresar un ID de inventario.'
                });
                return;
            }
    
            try {
                // Primero verificamos si el cuadre ya existe
                const existeInventario = await verificarExistenciaInventario(idInventario, idSucursal);
                
                if (existeInventario) {
                    const result = await Swal.fire({
                        icon: 'warning',
                        title: 'Cuadre Existente',
                        text: `Ya existe información guardada para el inventario ${idInventario} de la sucursal ${nombreSucursal}. ¿Desea continuar y sobrescribir?`,
                        showCancelButton: true,
                        confirmButtonText: 'Sí, continuar',
                        cancelButtonText: 'No, cancelar'
                    });
    
                    if (!result.isConfirmed) {
                        limpiarFormulario();
                        return;
                    }
                }
    
                // Si el usuario confirma o no existe el cuadre, procedemos con la búsqueda
                const inventario = await obtenerInventario(sucursalData, idInventario);
                if (inventario) {
                    mostrarInventario(inventario);
                }
            } catch (error) {
                console.error('Error al buscar el inventario:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'Error',
                    text: 'Ocurrió un error al buscar el inventario.'
                });
            }
        });
        document.getElementById('detalle-inventario').addEventListener('keydown', (e) => {
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
                e.preventDefault();
                navigateTable(e);
            }
        });
        searchWindow = document.getElementById('searchWindow');
        searchInput = document.getElementById('searchInput');
        searchButton = document.getElementById('searchButton');

        document.addEventListener('keydown', handleSearchShortcut);
        searchButton.addEventListener('click', performSearch);
        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                performSearch();
            }
        });
    });
    function handleSearchShortcut(e) {
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            toggleSearchWindow();
        }
    }
    
    function toggleSearchWindow() {
        if (searchWindow.style.display === 'none') {
            searchWindow.style.display = 'block';
            searchInput.focus();
        } else {
            searchWindow.style.display = 'none';
        }
    }
    
    function performSearch() {
        const searchTerm = searchInput.value.toLowerCase();
        const rows = document.querySelectorAll('#detalle-inventario tbody tr');
        let found = false;
        
        for (let i = 0; i < rows.length; i++) {
            const descriptionCell = rows[i].querySelector('td:nth-child(2)');
            if (descriptionCell && descriptionCell.textContent.toLowerCase().includes(searchTerm)) {
                // Desplazarse a la fila encontrada
                rows[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                
                // Resaltar la fila encontrada
                rows[i].style.backgroundColor = 'yellow';
                setTimeout(() => {
                    rows[i].style.backgroundColor = '';
                }, 2000);  // Quitar el resaltado después de 2 segundos
    
                found = true;
                break;
            }
        }
    
        if (!found) {
            alert('No se encontró ninguna coincidencia.');
        }
    
        toggleSearchWindow();  // Cerrar la ventana de búsqueda
    }
    function agregarfila() {
        const tbody = document.querySelector('#detalle-inventario tbody');
        const newRow = document.createElement('tr');
        newRow.innerHTML = `
            <td class="upc-column"><input type="text" class="upc-input"></td>
            <td class="descripcion-column"></td>
            <td class="cantidad-column"><input type="number" class="cantidad-input"></td>
            <td class="costo-column"><input type="number" class="costo-input"></td>
            <td class="costo-alterno-column"><input type="number" class="costo-input"></td>
            <td class="bonificacion-column"><input type="number" class="bonificacion-input"></td>
            <td class="precio-column"><input type="text" class="precio-facturado-input"></td>
            <td class="descuento-column"><input type="number" class="descuento-input"></td>
            <td class="costo-facturado-column costo-facturado-cell"></td>
            <td class="diferencia-column diferencia-cell"></td>
        `;
        tbody.appendChild(newRow);
    
        // Aplicar los mismos estilos y eventos a los nuevos inputs
        const inputs = newRow.querySelectorAll('input');
        const upcInput = newRow.querySelector('.upc-input');
        inputs.forEach(input => {
            input.style.width = '100%';
            input.addEventListener('input', actualizarCostos);
        });
        upcInput.addEventListener('blur', manejarUpc);
        upcInput.addEventListener('keydown', manejarUpckeydown);
    
        const precioFacturadoInput = newRow.querySelector('.precio-facturado-input');
        calcularPrecioFacturado(precioFacturadoInput);
        actualizarTotalFactura();
    }
    function actualizarCostos() {
        const row = this.closest('tr');
        const cantidadInput = row.querySelector('.cantidad-input');
        const bonificacionInput = row.querySelector('.bonificacion-input');
        const precioFacturadoInput = row.querySelector('.precio-facturado-input');
        const costoInput = row.querySelector('.costo-input');
        const costoFacturadoCell = row.querySelector('.costo-facturado-cell');
        const diferenciaCell = row.querySelector('.diferencia-cell');
        const descuentoInput = row.querySelector('.descuento-input');
    
        const cantidadTotal = parseFloat(cantidadInput.value) + parseFloat(bonificacionInput.value);
        let precioFacturado = parseFloat(precioFacturadoInput.value);
        const costo = parseFloat(costoInput.value);
    
        if (cantidadTotal > 0 && !isNaN(precioFacturado) && !isNaN(costo)) {
            const descuento = parseFloat(descuentoInput.value) || 0;
            precioFacturado -= (precioFacturado * (descuento / 100));
    
            const costoFacturado = precioFacturado / cantidadTotal;
            const diferencia = costoFacturado - costo;
    
            costoFacturadoCell.textContent = costoFacturado.toFixed(2);
            diferenciaCell.textContent = diferencia.toFixed(2);
        } else {
            costoFacturadoCell.textContent = '';
            diferenciaCell.textContent = '';
        }
        actualizarTotalFactura();
    }
    // Función para eliminar una fila
    function eliminarfila(row) {
        const inputs = row.querySelectorAll('input');
        const hasData = Array.from(inputs).some(input => input.value.trim() !== '');
    
        if (hasData) {
            Swal.fire({
                title: '¿Está seguro?',
                text: "Esta fila contiene datos. ¿Desea eliminarla?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: 'Sí, eliminar',
                cancelButtonText: 'Cancelar'
            }).then((result) => {
                if (result.isConfirmed) {
                    row.remove();
                    Swal.fire(
                        'Eliminado',
                        'La fila ha sido eliminada.',
                        'success'
                    );
                }
            });
        } else {
            row.remove();
            actualizarTotalFactura();
        }
    }
    
    // Evento para manejar las teclas
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey) {
            if (e.key === '+') {
                e.preventDefault();
                agregarfila();
            } else if (e.key === '-') {
                e.preventDefault();
                const focusedElement = document.activeElement;
                const row = focusedElement.closest('tr');
                if (row) {
                    eliminarfila(row);
                }
            }
        }
    });
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
            Swal.fire({
                icon: 'error',
                title: 'Error de formato',
                text: 'El UPC debe tener 13 dígitos después del formateo.'
            });
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
                    const producto = await buscarProducto(upc, sucursalData);
                    if (producto) {
                        actualizarFilaConProducto(input, producto);
                    } else {
                        Swal.fire({
                            icon: 'warning',
                            title: 'Producto no encontrado',
                            text: 'No se encontró un producto con el UPC proporcionado.'
                        });
                    }
                } catch (error) {
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'Ocurrió un error al buscar el producto.'
                    });
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
        }
        if (costoInput) {
            costoInput.value = producto.Costo || '';
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
    
        observer.observe(document.querySelector('#detalle-inventario tbody'), { childList: true, subtree: true });
    }
    function InicializartodasfilasUpc() {
        const upcInputs = document.querySelectorAll('#detalle-inventario .upc-input');
        upcInputs.forEach(input => {
            input.removeEventListener('blur', manejarUpc);
            input.removeEventListener('keydown', manejarUpckeydown);
            input.addEventListener('blur', manejarUpc);
            input.addEventListener('keydown', manejarUpckeydown);
        });
    }
    async function buscarProducto(upc, sucursalData) {
        let connection;
        try {
            if (sucursalData.tipoSucursal === '3') {
                const productoEspecial = await buscarProductoEspecial(upc);
                if (productoEspecial) {
                    // Asumimos que la función buscarProductoEspecial ya incluye DescLarga
                    // Si no es así, necesitarías modificar esa función también
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
    async function buscarYActualizarProducto(input) {
        const upc = input.value;
        const row = input.closest('tr');
        const sucursalSelect = document.getElementById('sucursal-select');
        const sucursalData = sucursalSelect.selectedOptions[0].dataset;
    
        try {
            const producto = await buscarProducto(upc, sucursalData);
            if (producto) {
                row.querySelector('td:nth-child(2)').textContent = producto.DescLarga;
                row.querySelector('.costo-input').value = producto.Costo;
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'Producto no encontrado',
                    text: 'No se encontró un producto con el UPC proporcionado.'
                });
            }
        } catch (error) {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Ocurrió un error al buscar el producto.'
            });
        }
    
        navegarsiguientecelda(input);
    }
    function aplicarDescuentoAFila(row) {
        const precioFacturadoInput = row.querySelector('.precio-facturado-input');
        const descuentoInput = row.querySelector('.descuento-input');
        const costoFacturadoCell = row.querySelector('.costo-facturado-cell');
        const diferenciaCell = row.querySelector('.diferencia-cell');
        const cantidadInput = row.querySelector('.cantidad-input');
        const bonificacionInput = row.querySelector('.bonificacion-input');
        const costoInput = row.querySelector('.costo-input');
    
        let precioFacturadoOriginal = parseFloat(precioFacturadoInput.dataset.originalValue || precioFacturadoInput.value);
        let descuentoPorcentaje = parseFloat(descuentoInput.value);
    
        if (!isNaN(descuentoPorcentaje) && !isNaN(precioFacturadoOriginal) && descuentoPorcentaje > 0) {
            // Aplicar el descuento en porcentaje
            let nuevoPrecioFacturado = precioFacturadoOriginal - (precioFacturadoOriginal * (descuentoPorcentaje / 100));
            precioFacturadoInput.value = nuevoPrecioFacturado.toFixed(2);
    
            // Recalcular Costo Facturado y Diferencia
            const cantidadTotal = parseFloat(cantidadInput.value) + parseFloat(bonificacionInput.value);
            if (cantidadTotal > 0) {
                const costoFacturado = nuevoPrecioFacturado / cantidadTotal;
                const diferencia = costoFacturado - parseFloat(costoInput.value);
    
                costoFacturadoCell.textContent = costoFacturado.toFixed(2);
                diferenciaCell.textContent = diferencia.toFixed(2);
            } else {
                costoFacturadoCell.textContent = '';
                diferenciaCell.textContent = '';
            }
        }
    }
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
window.onload = loadSucursales;