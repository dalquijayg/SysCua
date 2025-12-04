const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const conexionfacturas = 'DSN=DBsucursal';
const Swal = require('sweetalert2');
const mysql = require('mysql2/promise');
const XLSX = require('xlsx');

// Variables globales
let tipoOperacion = null; // 'venta' o 'venta-compra'
let sucursalVende = null;
let sucursalCompra = null;
let productosAgregados = [];
let conexionSucursalVende = null;
let conexionSucursalCompra = null;

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
    inicializarApp();
});

// Función principal de inicialización
function inicializarApp() {
    cargarUsuario();
    configurarFechaActual();
    configurarEventos();
}

// Cargar información del usuario
function cargarUsuario() {
    const userName = localStorage.getItem('userName');
    if (userName) {
        document.getElementById('userName').textContent = userName;
    }
}

// Configurar fecha actual por defecto
function configurarFechaActual() {
    const fechaInput = document.getElementById('fechaFactura');
    const today = new Date().toISOString().split('T')[0];
    fechaInput.value = today;
}

// Seleccionar tipo de operación
function seleccionarTipo(tipo) {
    tipoOperacion = tipo;
    
    // Ocultar selector de tipo
    document.getElementById('tipoOperacionContainer').style.display = 'none';
    
    // Mostrar formulario
    document.getElementById('formularioContainer').style.display = 'flex';
    
    // Actualizar badge de tipo
    const tipoBadge = document.getElementById('tipoBadge');
    if (tipo === 'venta') {
        tipoBadge.textContent = 'Solo Venta';
        tipoBadge.className = 'tipo-badge tipo-venta';
        // Ocultar grupo de sucursal que compra
        document.getElementById('sucursalCompraGroup').style.display = 'none';
    } else {
        tipoBadge.textContent = 'Venta-Compra';
        tipoBadge.className = 'tipo-badge tipo-venta-compra';
        // Mostrar grupo de sucursal que compra
        document.getElementById('sucursalCompraGroup').style.display = 'flex';
    }
}

// Cambiar tipo de operación
function cambiarTipoOperacion() {
    // Si hay productos, preguntar antes
    if (productosAgregados.length > 0 || sucursalVende || sucursalCompra) {
        Swal.fire({
            icon: 'warning',
            title: '¿Cambiar tipo de operación?',
            text: 'Se perderán todos los datos ingresados',
            showCancelButton: true,
            confirmButtonText: 'Sí, cambiar',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ff5e6d'
        }).then((result) => {
            if (result.isConfirmed) {
                resetearFormulario();
            }
        });
    } else {
        resetearFormulario();
    }
}

// Resetear formulario completo
async function resetearFormulario() {
    // Cerrar conexiones
    if (conexionSucursalVende) {
        try {
            await conexionSucursalVende.end();
        } catch (error) {
            console.error('Error al cerrar conexión vende:', error);
        }
        conexionSucursalVende = null;
    }
    
    if (conexionSucursalCompra) {
        try {
            await conexionSucursalCompra.end();
        } catch (error) {
            console.error('Error al cerrar conexión compra:', error);
        }
        conexionSucursalCompra = null;
    }
    
    // Resetear variables
    tipoOperacion = null;
    sucursalVende = null;
    sucursalCompra = null;
    productosAgregados = [];
    
    // Limpiar campos
    document.getElementById('fechaFactura').value = new Date().toISOString().split('T')[0];
    document.getElementById('serieFactura').value = '';
    document.getElementById('numeroFactura').value = '';
    
    // Limpiar sucursal que vende
    const searchVende = document.getElementById('searchSucursalVende');
    searchVende.value = '';
    searchVende.readOnly = false;
    searchVende.style.cursor = 'text';
    document.getElementById('clearSucursalVende').style.display = 'none';
    actualizarEstadoConexion('connectionStatusVende', 'disconnected', 'Sin conexión');
    
    // Limpiar sucursal que compra
    const searchCompra = document.getElementById('searchSucursalCompra');
    searchCompra.value = '';
    searchCompra.readOnly = false;
    searchCompra.style.cursor = 'text';
    document.getElementById('clearSucursalCompra').style.display = 'none';
    actualizarEstadoConexion('connectionStatusCompra', 'disconnected', 'Sin conexión');
    
    // Limpiar productos
    document.getElementById('searchProducto').disabled = true;
    document.getElementById('searchProducto').value = '';
    document.getElementById('clearProducto').style.display = 'none';
    
    actualizarTablaProductos();
    actualizarTotal();
    validarFormulario();
    
    // Ocultar formulario y mostrar selector de tipo
    document.getElementById('formularioContainer').style.display = 'none';
    document.getElementById('tipoOperacionContainer').style.display = 'flex';
}

// Configurar todos los eventos
function configurarEventos() {
    // Búsqueda de sucursal que vende
    const searchSucursalVende = document.getElementById('searchSucursalVende');
    searchSucursalVende.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !searchSucursalVende.readOnly) {
            e.preventDefault();
            buscarSucursales(searchSucursalVende.value, 'vende');
        }
    });

    searchSucursalVende.addEventListener('input', (e) => {
        if (searchSucursalVende.readOnly) return;
        
        const btnClear = document.getElementById('clearSucursalVende');
        btnClear.style.display = e.target.value ? 'flex' : 'none';
        
        if (!e.target.value) {
            document.getElementById('sucursalVendeResults').style.display = 'none';
        }
    });

    // Limpiar búsqueda de sucursal que vende
    document.getElementById('clearSucursalVende').addEventListener('click', () => {
        if (sucursalVende) {
            removerSucursal('vende');
        } else {
            searchSucursalVende.value = '';
            searchSucursalVende.focus();
            document.getElementById('clearSucursalVende').style.display = 'none';
            document.getElementById('sucursalVendeResults').style.display = 'none';
        }
    });

    // Búsqueda de sucursal que compra
    const searchSucursalCompra = document.getElementById('searchSucursalCompra');
    searchSucursalCompra.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !searchSucursalCompra.readOnly) {
            e.preventDefault();
            buscarSucursales(searchSucursalCompra.value, 'compra');
        }
    });

    searchSucursalCompra.addEventListener('input', (e) => {
        if (searchSucursalCompra.readOnly) return;
        
        const btnClear = document.getElementById('clearSucursalCompra');
        btnClear.style.display = e.target.value ? 'flex' : 'none';
        
        if (!e.target.value) {
            document.getElementById('sucursalCompraResults').style.display = 'none';
        }
    });

    // Limpiar búsqueda de sucursal que compra
    document.getElementById('clearSucursalCompra').addEventListener('click', () => {
        if (sucursalCompra) {
            removerSucursal('compra');
        } else {
            searchSucursalCompra.value = '';
            searchSucursalCompra.focus();
            document.getElementById('clearSucursalCompra').style.display = 'none';
            document.getElementById('sucursalCompraResults').style.display = 'none';
        }
    });

    // Búsqueda de productos
    const searchProducto = document.getElementById('searchProducto');
    searchProducto.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarProductos(searchProducto.value);
        }
    });

    searchProducto.addEventListener('input', (e) => {
        const btnClear = document.getElementById('clearProducto');
        btnClear.style.display = e.target.value ? 'flex' : 'none';
        
        if (!e.target.value) {
            document.getElementById('productoResults').style.display = 'none';
        }
    });

    // Limpiar búsqueda de producto
    document.getElementById('clearProducto').addEventListener('click', () => {
        searchProducto.value = '';
        searchProducto.focus();
        document.getElementById('clearProducto').style.display = 'none';
        document.getElementById('productoResults').style.display = 'none';
    });

    // Botón cambiar tipo
    document.getElementById('btnCambiarTipo').addEventListener('click', cambiarTipoOperacion);

    // Botón guardar
    document.getElementById('btnGuardar').addEventListener('click', guardarFactura);
    
    // Botón importar Excel
    document.getElementById('btnImportExcel').addEventListener('click', () => {
        document.getElementById('fileExcelInput').click();
    });
    
    // Input de archivo Excel
    document.getElementById('fileExcelInput').addEventListener('change', handleExcelImport);

    // Cerrar resultados al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            document.getElementById('sucursalVendeResults').style.display = 'none';
            document.getElementById('sucursalCompraResults').style.display = 'none';
            document.getElementById('productoResults').style.display = 'none';
        }
    });
    
    // Validación en tiempo real
    document.getElementById('fechaFactura').addEventListener('change', validarFormulario);
    document.getElementById('serieFactura').addEventListener('input', validarFormulario);
    document.getElementById('numeroFactura').addEventListener('input', validarFormulario);
}

// Buscar sucursales
async function buscarSucursales(termino, tipo) {
    if (!termino || termino.trim() === '') {
        Swal.fire({
            icon: 'warning',
            title: 'Campo vacío',
            text: 'Por favor ingresa un término de búsqueda',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }

    try {
        const connection = await odbc.connect(conexionfacturas);
        
        const query = `
            SELECT
                sucursales.idSucursal, 
                sucursales.NombreSucursal, 
                sucursales.serverr, 
                sucursales.databasee, 
                sucursales.Uid, 
                sucursales.Pwd, 
                sucursales.RazonSocial, 
                razonessociales.NombreRazon
            FROM
                sucursales
                INNER JOIN razonessociales
                ON sucursales.RazonSocial = razonessociales.Id
            WHERE
                sucursales.TipoSucursal IN (1,2) AND
                sucursales.Activo = 1 AND
                sucursales.RazonSocial IN (1,2,3) AND
                REPLACE(LOWER(sucursales.NombreSucursal), ' ', '') LIKE REPLACE(LOWER(?), ' ', '')
            ORDER BY sucursales.NombreSucursal
        `;

        const terminoBusqueda = `%${termino}%`;
        const results = await connection.query(query, [terminoBusqueda]);
        
        await connection.close();
        
        mostrarResultadosSucursales(results, tipo);
        
    } catch (error) {
        console.error('Error al buscar sucursales:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de búsqueda',
            text: 'No se pudieron cargar las sucursales. Verifica la conexión.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

// Mostrar resultados de búsqueda de sucursales
function mostrarResultadosSucursales(results, tipo) {
    const resultsContainerId = tipo === 'vende' ? 'sucursalVendeResults' : 'sucursalCompraResults';
    const resultsContainer = document.getElementById(resultsContainerId);
    
    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No se encontraron sucursales</p>
            </div>
        `;
        resultsContainer.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = '';
    
    results.forEach(sucursal => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <h4><i class="fas fa-store"></i> ${sucursal.NombreSucursal}</h4>
            <p>${sucursal.NombreRazon}</p>
        `;
        
        item.addEventListener('click', () => seleccionarSucursal(sucursal, tipo));
        resultsContainer.appendChild(item);
    });
    
    resultsContainer.style.display = 'block';
}

async function seleccionarSucursal(sucursal, tipo) {
    // Verificar que no se seleccione la misma sucursal para ambos roles
    if (tipoOperacion === 'venta-compra') {
        if (tipo === 'vende' && sucursalCompra && sucursal.idSucursal === sucursalCompra.idSucursal) {
            Swal.fire({
                icon: 'warning',
                title: 'Sucursal duplicada',
                text: 'No puedes seleccionar la misma sucursal para vender y comprar',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
        
        if (tipo === 'compra' && sucursalVende && sucursal.idSucursal === sucursalVende.idSucursal) {
            Swal.fire({
                icon: 'warning',
                title: 'Sucursal duplicada',
                text: 'No puedes seleccionar la misma sucursal para vender y comprar',
                confirmButtonColor: '#6e78ff'
            });
            return;
        }
    }
    
    // Ocultar resultados
    const resultsContainerId = tipo === 'vende' ? 'sucursalVendeResults' : 'sucursalCompraResults';
    document.getElementById(resultsContainerId).style.display = 'none';
    
    // Cambiar estado a "conectando"
    const statusId = tipo === 'vende' ? 'connectionStatusVende' : 'connectionStatusCompra';
    actualizarEstadoConexion(statusId, 'connecting', 'Conectando...');
    
    // Probar conexión
    const conexionExitosa = await probarConexionSucursal(sucursal, tipo);
    
    if (conexionExitosa) {
        if (tipo === 'vende') {
            sucursalVende = sucursal;
        } else {
            sucursalCompra = sucursal;
        }
        
        mostrarSucursalSeleccionada(sucursal, tipo);
        actualizarEstadoConexion(statusId, 'connected', 'Conectado');
        
        // Habilitar búsqueda de productos solo si está seleccionada la sucursal que vende
        if (tipo === 'vende') {
            document.getElementById('searchProducto').disabled = false;
            document.getElementById('btnImportExcel').disabled = false;
        }
        
        validarFormulario();
    } else {
        actualizarEstadoConexion(statusId, 'error', 'Error de conexión');
        
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: `No se pudo conectar a la base de datos de ${sucursal.NombreSucursal}`,
            confirmButtonColor: '#6e78ff'
        });
    }
}

// Probar conexión con la sucursal
async function probarConexionSucursal(sucursal, tipo) {
    try {
        const config = {
            host: sucursal.serverr,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            database: sucursal.databasee,
            connectTimeout: 10000
        };
        
        const conexion = await mysql.createConnection(config);
        
        // Probar la conexión con una consulta simple
        await conexion.query('SELECT 1');
        
        // Guardar la conexión según el tipo
        if (tipo === 'vende') {
            conexionSucursalVende = conexion;
        } else {
            conexionSucursalCompra = conexion;
        }
        
        return true;
    } catch (error) {
        console.error(`Error al conectar con la sucursal (${tipo}):`, error);
        return false;
    }
}

// Mostrar sucursal seleccionada
function mostrarSucursalSeleccionada(sucursal, tipo) {
    const searchInputId = tipo === 'vende' ? 'searchSucursalVende' : 'searchSucursalCompra';
    const btnClearId = tipo === 'vende' ? 'clearSucursalVende' : 'clearSucursalCompra';
    
    const searchInput = document.getElementById(searchInputId);
    const btnClear = document.getElementById(btnClearId);
    
    // Mostrar en el campo de búsqueda
    searchInput.value = `${sucursal.NombreSucursal} "${sucursal.NombreRazon}"`;
    searchInput.readOnly = true;
    searchInput.style.cursor = 'not-allowed';
    
    // Mostrar botón de limpiar
    btnClear.style.display = 'flex';
    btnClear.innerHTML = '<i class="fas fa-times"></i>';
}

// Remover sucursal seleccionada
async function removerSucursal(tipo) {
    const sucursal = tipo === 'vende' ? sucursalVende : sucursalCompra;
    const conexion = tipo === 'vende' ? conexionSucursalVende : conexionSucursalCompra;
    
    // Si hay productos y se está removiendo la sucursal que vende, preguntar antes
    if (tipo === 'vende' && productosAgregados.length > 0) {
        const confirmar = await Swal.fire({
            icon: 'warning',
            title: '¿Remover sucursal?',
            text: 'Se perderán todos los productos agregados',
            showCancelButton: true,
            confirmButtonText: 'Sí, remover',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#ff5e6d'
        });
        
        if (!confirmar.isConfirmed) {
            return;
        }
        
        // Limpiar productos
        productosAgregados = [];
        actualizarTablaProductos();
    }
    
    // Cerrar conexión si existe
    if (conexion) {
        try {
            await conexion.end();
        } catch (error) {
            console.error('Error al cerrar conexión:', error);
        }
        
        if (tipo === 'vende') {
            conexionSucursalVende = null;
            sucursalVende = null;
        } else {
            conexionSucursalCompra = null;
            sucursalCompra = null;
        }
    }
    
    // Restaurar campo de búsqueda
    const searchInputId = tipo === 'vende' ? 'searchSucursalVende' : 'searchSucursalCompra';
    const btnClearId = tipo === 'vende' ? 'clearSucursalVende' : 'clearSucursalCompra';
    const statusId = tipo === 'vende' ? 'connectionStatusVende' : 'connectionStatusCompra';
    
    const searchInput = document.getElementById(searchInputId);
    searchInput.value = '';
    searchInput.readOnly = false;
    searchInput.style.cursor = 'text';
    searchInput.focus();
    
    document.getElementById(btnClearId).style.display = 'none';
    actualizarEstadoConexion(statusId, 'disconnected', 'Sin conexión');
    
    // Deshabilitar búsqueda de productos si se removió la sucursal que vende
    if (tipo === 'vende') {
        document.getElementById('searchProducto').disabled = true;
        document.getElementById('searchProducto').value = '';
        document.getElementById('clearProducto').style.display = 'none';
        document.getElementById('btnImportExcel').disabled = true;
    }
    
    validarFormulario();
}

// Actualizar estado de conexión
function actualizarEstadoConexion(statusId, estado, texto) {
    const statusElement = document.getElementById(statusId);
    
    // Remover todas las clases de estado
    statusElement.classList.remove('disconnected', 'connected', 'connecting', 'error');
    
    // Agregar la clase correspondiente
    statusElement.classList.add(estado);
}

// Buscar productos (siempre desde la sucursal que vende)
async function buscarProductos(termino) {
    if (!sucursalVende) {
        Swal.fire({
            icon: 'warning',
            title: 'Sucursal no seleccionada',
            text: 'Por favor selecciona una sucursal que vende primero',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    if (!termino || termino.trim() === '') {
        Swal.fire({
            icon: 'warning',
            title: 'Campo vacío',
            text: 'Por favor ingresa un término de búsqueda',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }

    try {
        const terminoLimpio = termino.trim();
        const esUPC = /^\d+$/.test(terminoLimpio);
        
        let query;
        let params;
        
        if (esUPC) {
            query = `
                SELECT
                    productos.Upc, 
                    productos.DescLarga, 
                    productos.DescCorta, 
                    productos.Costo, 
                    productos.Precio
                FROM
                    productos
                WHERE
                    productos.Upc LIKE ?
                LIMIT 50
            `;
            params = [`%${terminoLimpio}%`];
        } else {
            const palabras = terminoLimpio.toLowerCase().split(/\s+/).filter(p => p.length > 0);
            
            const condiciones = palabras.map(() => 
                `(LOWER(REPLACE(productos.DescLarga, ' ', '')) LIKE ? OR 
                  LOWER(REPLACE(productos.DescCorta, ' ', '')) LIKE ?)`
            ).join(' AND ');
            
            query = `
                SELECT
                    productos.Upc, 
                    productos.DescLarga, 
                    productos.DescCorta, 
                    productos.Costo, 
                    productos.Precio
                FROM
                    productos
                WHERE
                    ${condiciones}
                ORDER BY 
                    CASE 
                        WHEN LOWER(productos.DescLarga) LIKE ? THEN 1
                        WHEN LOWER(productos.DescCorta) LIKE ? THEN 2
                        ELSE 3
                    END,
                    productos.DescLarga
                LIMIT 50
            `;
            
            params = [];
            palabras.forEach(palabra => {
                params.push(`%${palabra}%`, `%${palabra}%`);
            });
            
            params.push(`%${terminoLimpio}%`, `%${terminoLimpio}%`);
        }
        
        const [results] = await conexionSucursalVende.query(query, params);
        
        if (results.length === 0 && !esUPC) {
            const queryFlexible = `
                SELECT
                    productos.Upc, 
                    productos.DescLarga, 
                    productos.DescCorta, 
                    productos.Costo, 
                    productos.Precio
                FROM
                    productos
                WHERE
                    LOWER(REPLACE(productos.DescLarga, ' ', '')) LIKE ? OR
                    LOWER(REPLACE(productos.DescCorta, ' ', '')) LIKE ? OR
                    productos.Upc LIKE ?
                ORDER BY 
                    CASE 
                        WHEN LOWER(productos.DescLarga) LIKE ? THEN 1
                        WHEN LOWER(productos.DescCorta) LIKE ? THEN 2
                        WHEN productos.Upc LIKE ? THEN 3
                        ELSE 4
                    END,
                    productos.DescLarga
                LIMIT 50
            `;
            
            const terminoFlexible = `%${terminoLimpio.toLowerCase().replace(/\s+/g, '')}%`;
            const terminoOriginal = `%${terminoLimpio}%`;
            
            const [resultsFlexible] = await conexionSucursalVende.query(queryFlexible, [
                terminoFlexible, 
                terminoFlexible,
                terminoOriginal,
                terminoOriginal,
                terminoOriginal,
                terminoOriginal
            ]);
            
            mostrarResultadosProductos(resultsFlexible);
        } else {
            mostrarResultadosProductos(results);
        }
        
    } catch (error) {
        console.error('Error al buscar productos:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error de búsqueda',
            text: 'No se pudieron cargar los productos.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

// Mostrar resultados de búsqueda de productos
function mostrarResultadosProductos(results) {
    const resultsContainer = document.getElementById('productoResults');
    
    if (results.length === 0) {
        resultsContainer.innerHTML = `
            <div class="no-results">
                <i class="fas fa-search"></i>
                <p>No se encontraron productos</p>
            </div>
        `;
        resultsContainer.style.display = 'block';
        return;
    }

    resultsContainer.innerHTML = '';
    
    results.forEach(producto => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <h4><i class="fas fa-box"></i> ${producto.DescLarga}</h4>
            <p>${producto.DescCorta || ''}</p>
            <div class="result-details">
                <span><i class="fas fa-barcode"></i> UPC: ${producto.Upc}</span>
                <span><i class="fas fa-dollar-sign"></i> Costo: Q ${parseFloat(producto.Costo).toFixed(2)}</span>
                <span><i class="fas fa-tag"></i> Precio: Q ${parseFloat(producto.Precio).toFixed(2)}</span>
            </div>
        `;
        
        item.addEventListener('click', () => agregarProducto(producto));
        resultsContainer.appendChild(item);
    });
    
    resultsContainer.style.display = 'block';
}

// Agregar producto a la tabla
function agregarProducto(producto) {
    const existe = productosAgregados.find(p => p.Upc === producto.Upc);
    
    if (existe) {
        Swal.fire({
            icon: 'info',
            title: 'Producto ya agregado',
            text: 'Este producto ya está en la lista. Puedes modificar la cantidad.',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }

    productosAgregados.push({
        Upc: producto.Upc,
        DescLarga: producto.DescLarga,
        Cantidad: 1,
        Costo: parseFloat(producto.Costo),
        Precio: parseFloat(producto.Precio),
        Subtotal: parseFloat(producto.Precio)
    });

    document.getElementById('productoResults').style.display = 'none';
    document.getElementById('searchProducto').value = '';
    document.getElementById('clearProducto').style.display = 'none';

    actualizarTablaProductos();
    actualizarTotal();
    validarFormulario();
}

// Actualizar tabla de productos
function actualizarTablaProductos() {
    const tbody = document.getElementById('productosBody');
    
    if (productosAgregados.length === 0) {
        tbody.innerHTML = `
            <tr class="empty-state">
                <td colspan="7">
                    <i class="fas fa-inbox"></i>
                    <p>No hay productos agregados</p>
                    <small>Selecciona una sucursal y busca productos para agregar</small>
                </td>
            </tr>
        `;
        document.getElementById('productCount').textContent = '0 productos';
        return;
    }

    tbody.innerHTML = '';
    
    productosAgregados.forEach((producto, index) => {
        const row = document.createElement('tr');
        
        // Verificar si el producto no fue encontrado
        const productoNoEncontrado = producto.DescLarga === 'PRODUCTO NO ENCONTRADO';
        
        row.innerHTML = `
            <td>${producto.Upc}</td>
            <td>
                ${productoNoEncontrado ? `
                    <input type="text" 
                           placeholder="Escribe la descripción..." 
                           value="" 
                           data-index="${index}"
                           class="input-descripcion input-descripcion-editable"
                           style="width: 100%; background: #fef3cd; border-color: #ffc107; color: #1a202c;">
                ` : `
                    ${producto.DescLarga}
                `}
            </td>
            <td>
                <input type="number" 
                       min="1" 
                       step="1" 
                       value="${producto.Cantidad}" 
                       data-index="${index}"
                       class="input-cantidad">
            </td>
            <td>
                <input type="number" 
                       min="0" 
                       step="0.01" 
                       value="${producto.Costo.toFixed(2)}" 
                       data-index="${index}"
                       class="input-costo">
            </td>
            <td>
                <input type="number" 
                       min="0" 
                       step="0.01" 
                       value="${producto.Precio.toFixed(2)}" 
                       data-index="${index}"
                       class="input-precio">
            </td>
            <td>Q ${producto.Subtotal.toFixed(2)}</td>
            <td>
                <button class="btn-delete" data-index="${index}">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });

    configurarEventosTabla();
    
    document.getElementById('productCount').textContent = `${productosAgregados.length} producto${productosAgregados.length !== 1 ? 's' : ''}`;
}

// Configurar eventos de la tabla
function configurarEventosTabla() {
    // Eventos de descripción editable
    document.querySelectorAll('.input-descripcion').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            const descripcion = e.target.value.trim();
            
            // Actualizar la descripción en el array
            productosAgregados[index].DescLarga = descripcion || 'PRODUCTO NO ENCONTRADO';
        });
    });

    document.querySelectorAll('.input-cantidad').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            const cantidad = parseInt(e.target.value) || 1;
            
            if (cantidad < 1) {
                e.target.value = 1;
                return;
            }
            
            productosAgregados[index].Cantidad = cantidad;
            calcularSubtotal(index);
        });
    });

    document.querySelectorAll('.input-costo').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            const costo = parseFloat(e.target.value) || 0;
            
            productosAgregados[index].Costo = costo;
        });
    });

    document.querySelectorAll('.input-precio').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            const precio = parseFloat(e.target.value) || 0;
            
            productosAgregados[index].Precio = precio;
            calcularSubtotal(index);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(button => {
        button.addEventListener('click', (e) => {
            const index = parseInt(e.target.closest('button').dataset.index);
            eliminarProducto(index);
        });
    });
}

// Calcular subtotal de un producto
function calcularSubtotal(index) {
    const producto = productosAgregados[index];
    producto.Subtotal = producto.Cantidad * producto.Precio;
    
    const row = document.querySelectorAll('#productosBody tr')[index];
    if (row) {
        const subtotalCell = row.querySelector('td:nth-child(6)');
        subtotalCell.textContent = `Q ${producto.Subtotal.toFixed(2)}`;
    }
    
    actualizarTotal();
}

// Eliminar producto
async function eliminarProducto(index) {
    const confirmar = await Swal.fire({
        icon: 'warning',
        title: '¿Eliminar producto?',
        text: '¿Estás seguro de eliminar este producto?',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#ff5e6d'
    });

    if (confirmar.isConfirmed) {
        productosAgregados.splice(index, 1);
        actualizarTablaProductos();
        actualizarTotal();
        validarFormulario();
    }
}

// Actualizar total general
function actualizarTotal() {
    const total = productosAgregados.reduce((sum, producto) => sum + producto.Subtotal, 0);
    document.getElementById('totalGeneral').textContent = `Q ${total.toFixed(2)}`;
}

// Validar formulario para habilitar botón guardar
function validarFormulario() {
    const fecha = document.getElementById('fechaFactura').value;
    const serie = document.getElementById('serieFactura').value;
    const numero = document.getElementById('numeroFactura').value;
    const btnGuardar = document.getElementById('btnGuardar');
    
    let valido = fecha && 
                 serie && 
                 numero && 
                 sucursalVende && 
                 productosAgregados.length > 0;
    
    // Si es venta-compra, también debe tener sucursal que compra
    if (tipoOperacion === 'venta-compra') {
        valido = valido && sucursalCompra !== null;
    }
    
    btnGuardar.disabled = !valido;
}

// Guardar factura
async function guardarFactura() {
    const fecha = document.getElementById('fechaFactura').value;
    const serie = document.getElementById('serieFactura').value;
    const numero = document.getElementById('numeroFactura').value;
    
    // Validar que haya productos
    if (productosAgregados.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Sin productos',
            text: 'Debes agregar al menos un producto para guardar la factura',
            confirmButtonColor: '#6e78ff'
        });
        return;
    }
    
    // Validar que todos los productos tengan descripción
    const productosSinDescripcion = productosAgregados.filter(p => 
        !p.DescLarga || 
        p.DescLarga.trim() === '' || 
        p.DescLarga === 'PRODUCTO NO ENCONTRADO'
    );
    
    if (productosSinDescripcion.length > 0) {
        const listaUPCs = productosSinDescripcion.map(p => `• ${p.Upc}`).join('<br>');
        
        Swal.fire({
            icon: 'warning',
            title: 'Productos sin descripción',
            html: `
                <p>Hay <strong>${productosSinDescripcion.length}</strong> producto(s) sin descripción válida:</p>
                <div style="max-height: 150px; overflow-y: auto; text-align: left; padding: 0.8rem; background: #2d3748; border-radius: 5px; margin: 1rem 0; border: 1px solid #4a5568;">
                    <div style="color: #fbbf24; font-size: 0.9rem;">${listaUPCs}</div>
                </div>
                <p style="color: #f59e0b; font-size: 0.9rem;">
                    <strong>⚠️ Por favor escribe las descripciones en los campos amarillos antes de guardar.</strong>
                </p>
            `,
            confirmButtonColor: '#6e78ff',
            confirmButtonText: 'Entendido'
        });
        return;
    }
    
    // Confirmar guardado
    const confirmar = await Swal.fire({
        icon: 'question',
        title: '¿Guardar factura?',
        html: `
            <div style="text-align: left;">
                <p><strong>Tipo:</strong> ${tipoOperacion === 'venta' ? 'Solo Venta' : 'Venta-Compra'}</p>
                <p><strong>Fecha:</strong> ${fecha}</p>
                <p><strong>Serie/Número:</strong> ${serie}-${numero}</p>
                <p><strong>Sucursal Vende:</strong> ${sucursalVende.NombreSucursal}</p>
                ${tipoOperacion === 'venta-compra' ? `<p><strong>Sucursal Compra:</strong> ${sucursalCompra.NombreSucursal}</p>` : ''}
                <p><strong>Productos:</strong> ${productosAgregados.length}</p>
                <p><strong>Total:</strong> Q ${productosAgregados.reduce((sum, p) => sum + p.Subtotal, 0).toFixed(2)}</p>
            </div>
        `,
        showCancelButton: true,
        confirmButtonText: 'Sí, guardar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#6e78ff',
        cancelButtonColor: '#6c757d'
    });
    
    if (!confirmar.isConfirmed) {
        return;
    }
    
    // Mostrar loading
    Swal.fire({
        title: 'Guardando factura...',
        html: 'Por favor espera mientras se guarda la información',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    try {
        // Obtener datos del usuario logueado
        const userId = localStorage.getItem('userId');
        const userName = localStorage.getItem('userName');
        
        if (!userId || !userName) {
            throw new Error('No se encontró la información del usuario. Por favor inicia sesión nuevamente.');
        }
        
        // Preparar datos para guardar
        const total = productosAgregados.reduce((sum, p) => sum + p.Subtotal, 0);
        
        const datosFactura = {
            // Sucursal que vende
            IdSucursal: sucursalVende.idSucursal,
            NombreSucursal: sucursalVende.NombreSucursal,
            IdRazonSocial: sucursalVende.RazonSocial,
            RazonSocial: sucursalVende.NombreRazon,
            
            // Sucursal que compra (si aplica, sino guardar '0')
            IdSucursalCliente: tipoOperacion === 'venta-compra' ? sucursalCompra.idSucursal : '0',
            SucursalCliente: tipoOperacion === 'venta-compra' ? sucursalCompra.NombreSucursal : '0',
            IdRazonSocialCliente: tipoOperacion === 'venta-compra' ? sucursalCompra.RazonSocial : '0',
            RazonSocialCliente: tipoOperacion === 'venta-compra' ? sucursalCompra.NombreRazon : '0',
            
            // Datos de la factura
            FechaFactura: fecha,
            Serie: serie,
            NoDocumento: numero,
            Total: total,
            TipoFactura: tipoOperacion === 'venta' ? 1 : 2, // 1 = venta, 2 = venta-compra
            
            // Usuario
            IdUsuario: userId,
            NombreUsuario: userName,
            
            // Productos
            productos: productosAgregados
        };
        
        // Guardar en la base de datos
        const idFacturaGenerado = await guardarEnBaseDatos(datosFactura);
        
        // Éxito
        Swal.fire({
            icon: 'success',
            title: '¡Factura guardada!',
            html: `
                <div style="text-align: left;">
                    <p>La factura se ha registrado correctamente.</p>
                    <br>
                    <p><strong>ID Generado:</strong> ${idFacturaGenerado}</p>
                    <p><strong>Serie/Número:</strong> ${serie}-${numero}</p>
                    <p><strong>Total:</strong> Q ${total.toFixed(2)}</p>
                    <p><strong>Productos:</strong> ${productosAgregados.length}</p>
                </div>
            `,
            confirmButtonText: 'Finalizar',
            confirmButtonColor: '#6e78ff'
        }).then(() => {
            // Resetear formulario para crear otra factura
            resetearFormulario();
        });
        
    } catch (error) {
        console.error('Error al guardar factura:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: error.message || 'No se pudo guardar la factura. Por favor intenta nuevamente.',
            confirmButtonColor: '#6e78ff'
        });
    }
}

// Guardar en la base de datos
async function guardarEnBaseDatos(datos) {
    let conexionGestion = null;
    
    try {
        // Conectar a la base de datos de Gestión
        const config = {
            host: '172.30.1.100',
            user: 'Gestion',
            password: 'Gestion.2445',
            database: 'Gestion'
        };
        
        conexionGestion = await mysql.createConnection(config);
        
        // Iniciar transacción
        await conexionGestion.beginTransaction();
        
        try {
            // 1. Insertar en la tabla principal FacturasManualesFEL
            const queryFactura = `
                INSERT INTO FacturasManualesFEL 
                (IdSucusal, NombreSucursal, IdRazonSocial, RazonSocial,
                 IdSucursalCliente, SucursalCliente, IdRazonSocialCliente, RazonSocialCliente,
                 FechaFactura, Serie, NoDocumento, Total, TipoFactura,
                 IdUsuario, NombreUsuario)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            const valoresFactura = [
                datos.IdSucursal,
                datos.NombreSucursal,
                datos.IdRazonSocial,
                datos.RazonSocial,
                datos.IdSucursalCliente,
                datos.SucursalCliente,
                datos.IdRazonSocialCliente,
                datos.RazonSocialCliente,
                datos.FechaFactura,
                datos.Serie,
                datos.NoDocumento,
                datos.Total,
                datos.TipoFactura,
                datos.IdUsuario,
                datos.NombreUsuario
            ];
            
            const [resultFactura] = await conexionGestion.query(queryFactura, valoresFactura);
            const idFacturaGenerado = resultFactura.insertId;
            
            console.log('ID de factura generado:', idFacturaGenerado);
            
            // 2. Insertar el detalle de productos
            const queryDetalle = `
                INSERT INTO FacturasManualesFELDetalle 
                (IdFacturasVentasCompras, Upc, Descripcion, Cantidad, Costo, Precio)
                VALUES (?, ?, ?, ?, ?, ?)
            `;
            
            // Insertar cada producto
            for (const producto of datos.productos) {
                const valoresDetalle = [
                    idFacturaGenerado,
                    producto.Upc,
                    producto.DescLarga,
                    producto.Cantidad,
                    producto.Costo,
                    producto.Precio
                ];
                
                await conexionGestion.query(queryDetalle, valoresDetalle);
            }
            
            // Confirmar transacción
            await conexionGestion.commit();
            
            console.log('Factura y detalle guardados correctamente');
            
            return idFacturaGenerado;
            
        } catch (error) {
            // Revertir transacción en caso de error
            await conexionGestion.rollback();
            throw error;
        }
        
    } catch (error) {
        console.error('Error en guardarEnBaseDatos:', error);
        throw new Error(`Error al guardar en la base de datos: ${error.message}`);
    } finally {
        // Cerrar conexión
        if (conexionGestion) {
            try {
                await conexionGestion.end();
            } catch (error) {
                console.error('Error al cerrar conexión:', error);
            }
        }
    }
}

// ==================== IMPORTACIÓN DE EXCEL ====================

// Manejar importación de Excel
async function handleExcelImport(event) {
    const file = event.target.files[0];
    
    if (!file) return;
    
    // Validar que sea un archivo Excel
    const validExtensions = ['.xlsx', '.xls'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!validExtensions.includes(fileExtension)) {
        Swal.fire({
            icon: 'error',
            title: 'Archivo no válido',
            text: 'Por favor selecciona un archivo Excel (.xlsx o .xls)',
            confirmButtonColor: '#6e78ff'
        });
        event.target.value = '';
        return;
    }
    
    try {
        // Mostrar loading
        Swal.fire({
            title: 'Procesando archivo...',
            html: 'Leyendo datos del archivo Excel',
            allowOutsideClick: false,
            didOpen: () => {
                Swal.showLoading();
            }
        });
        
        const data = await readExcelFile(file);
        
        if (data && data.length > 0) {
            await procesarDatosExcel(data);
        } else {
            Swal.fire({
                icon: 'warning',
                title: 'Archivo vacío',
                text: 'El archivo no contiene datos para importar',
                confirmButtonColor: '#6e78ff'
            });
        }
        
    } catch (error) {
        console.error('Error al importar Excel:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al importar',
            text: error.message || 'No se pudo procesar el archivo Excel',
            confirmButtonColor: '#6e78ff'
        });
    } finally {
        // Limpiar input para permitir cargar el mismo archivo nuevamente
        event.target.value = '';
    }
}

// Leer archivo Excel
function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Obtener la primera hoja
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convertir a JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                    raw: false,
                    defval: ''
                });
                
                resolve(jsonData);
            } catch (error) {
                reject(new Error('Error al leer el archivo Excel'));
            }
        };
        
        reader.onerror = () => {
            reject(new Error('Error al leer el archivo'));
        };
        
        reader.readAsArrayBuffer(file);
    });
}

// Procesar datos del Excel
async function procesarDatosExcel(data) {
    // Validar encabezados requeridos
    const encabezadosRequeridos = ['UPC', 'Cantidad'];
    const encabezadosOpcionales = ['Descripcion', 'Descripción', 'Costo', 'Precio'];
    
    const primeraFila = data[0];
    const encabezadosArchivo = Object.keys(primeraFila);
    
    // Normalizar nombres de encabezados (quitar espacios, acentos, etc.)
    const normalizeHeader = (header) => {
        return header.trim().toLowerCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, ""); // Quitar acentos
    };
    
    const encabezadosNormalizados = encabezadosArchivo.map(h => normalizeHeader(h));
    
    // Verificar encabezados requeridos
    const faltantes = encabezadosRequeridos.filter(req => {
        const reqNorm = normalizeHeader(req);
        return !encabezadosNormalizados.includes(reqNorm);
    });
    
    if (faltantes.length > 0) {
        throw new Error(`Faltan columnas requeridas: ${faltantes.join(', ')}\n\nColumnas mínimas necesarias: UPC, Cantidad`);
    }
    
    // Mapear encabezados del archivo a nombres estándar
    const headerMap = {};
    encabezadosArchivo.forEach(header => {
        const normalized = normalizeHeader(header);
        if (normalized === 'upc') headerMap['UPC'] = header;
        if (normalized === 'descripcion') headerMap['Descripcion'] = header;
        if (normalized === 'cantidad') headerMap['Cantidad'] = header;
        if (normalized === 'costo') headerMap['Costo'] = header;
        if (normalized === 'precio') headerMap['Precio'] = header;
    });
    
    // Mostrar progreso
    Swal.fire({
        title: 'Importando productos...',
        html: `<div>Procesando <span id="progressCount">0</span> de ${data.length} productos</div>`,
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });
    
    let importados = 0;
    let errores = 0;
    let productosSinDescripcion = [];
    
    for (let i = 0; i < data.length; i++) {
        const fila = data[i];
        
        // Actualizar progreso
        document.getElementById('progressCount').textContent = i + 1;
        
        try {
            // Obtener UPC (requerido)
            const upc = (fila[headerMap['UPC']] || '').toString().trim();
            
            if (!upc) {
                console.warn(`Fila ${i + 1}: UPC vacío, se omite`);
                errores++;
                continue;
            }
            
            // Verificar si el producto ya existe en la lista
            const existe = productosAgregados.find(p => p.Upc === upc);
            if (existe) {
                console.warn(`Fila ${i + 1}: Producto ${upc} ya existe, se omite`);
                continue;
            }
            
            // Obtener otros campos
            let descripcion = (fila[headerMap['Descripcion']] || '').toString().trim();
            const cantidad = parseFloat(fila[headerMap['Cantidad']] || '1') || 1;
            let costo = parseFloat(fila[headerMap['Costo']] || '0') || 0;
            let precio = parseFloat(fila[headerMap['Precio']] || '0') || 0;
            
            // Si no tiene descripción, buscarla en la base de datos
            if (!descripcion) {
                const productoDb = await buscarProductoPorUPC(upc);
                
                if (productoDb) {
                    descripcion = productoDb.DescLarga;
                    // Si tampoco tiene costo/precio, usar los de la BD
                    if (costo === 0) costo = parseFloat(productoDb.Costo) || 0;
                    if (precio === 0) precio = parseFloat(productoDb.Precio) || 0;
                } else {
                    descripcion = 'PRODUCTO NO ENCONTRADO';
                    productosSinDescripcion.push(upc);
                }
            }
            
            // Agregar producto
            productosAgregados.push({
                Upc: upc,
                DescLarga: descripcion,
                Cantidad: cantidad,
                Costo: costo,
                Precio: precio,
                Subtotal: cantidad * precio
            });
            
            importados++;
            
        } catch (error) {
            console.error(`Error procesando fila ${i + 1}:`, error);
            errores++;
        }
    }
    
    // Actualizar tabla
    actualizarTablaProductos();
    actualizarTotal();
    validarFormulario();
    
    // Mostrar resultado
    let mensaje = `<p>✅ <strong>${importados}</strong> productos importados correctamente</p>`;
    
    if (errores > 0) {
        mensaje += `<p>⚠️ <strong>${errores}</strong> filas con errores u omitidas</p>`;
    }
    
    if (productosSinDescripcion.length > 0) {
        mensaje += `<br><p>⚠️ <strong>${productosSinDescripcion.length}</strong> productos no encontrados en la base de datos:</p>`;
        mensaje += `<div style="max-height: 150px; overflow-y: auto; text-align: left; padding: 0.5rem; background: #2d3748; border-radius: 5px; margin-top: 0.5rem; border: 1px solid #4a5568;">`;
        productosSinDescripcion.forEach(upc => {
            mensaje += `<div style="font-size: 0.85rem; color: #fbbf24; padding: 0.2rem 0;">• ${upc}</div>`;
        });
        mensaje += `</div>`;
        mensaje += `<p style="margin-top: 0.8rem; font-size: 0.9rem; color: #f59e0b;"><strong>⚠️ Recuerda escribir las descripciones manualmente antes de guardar.</strong></p>`;
    }
    
    Swal.fire({
        icon: importados > 0 ? 'success' : 'warning',
        title: importados > 0 ? '¡Importación completada!' : 'Importación con advertencias',
        html: mensaje,
        confirmButtonColor: '#6e78ff'
    });
}

// Buscar producto por UPC en la base de datos
async function buscarProductoPorUPC(upc) {
    if (!conexionSucursalVende) return null;
    
    try {
        const query = `
            SELECT
                Upc, 
                DescLarga, 
                DescCorta, 
                Costo, 
                Precio
            FROM
                productos
            WHERE
                Upc = ?
            LIMIT 1
        `;
        
        const [results] = await conexionSucursalVende.query(query, [upc]);
        
        return results.length > 0 ? results[0] : null;
        
    } catch (error) {
        console.error(`Error al buscar producto ${upc}:`, error);
        return null;
    }
}