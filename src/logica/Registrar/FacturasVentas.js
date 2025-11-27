const { ipcRenderer } = require('electron');
const odbc = require('odbc');
const conexionfacturas = 'DSN=DBsucursal';
const Swal = require('sweetalert2');
const mysql = require('mysql2/promise');

// Variables globales
let sucursalSeleccionada = null;
let productosAgregados = [];
let conexionSucursal = null;

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

// Configurar todos los eventos
function configurarEventos() {
    // Búsqueda de sucursal
    const searchSucursal = document.getElementById('searchSucursal');
    searchSucursal.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !searchSucursal.readOnly) {
            e.preventDefault();
            buscarSucursales(searchSucursal.value);
        }
    });

    searchSucursal.addEventListener('input', (e) => {
        if (searchSucursal.readOnly) return; // No permitir edición si hay sucursal seleccionada
        
        const btnClear = document.getElementById('clearSucursal');
        btnClear.style.display = e.target.value ? 'flex' : 'none';
        
        if (!e.target.value) {
            document.getElementById('sucursalResults').style.display = 'none';
        }
    });

    // Limpiar búsqueda de sucursal (ahora también remueve la selección)
    document.getElementById('clearSucursal').addEventListener('click', () => {
        if (sucursalSeleccionada) {
            removerSucursal();
        } else {
            searchSucursal.value = '';
            searchSucursal.focus();
            document.getElementById('clearSucursal').style.display = 'none';
            document.getElementById('sucursalResults').style.display = 'none';
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

    // Botón guardar
    document.getElementById('btnGuardar').addEventListener('click', guardarFactura);

    // Cerrar resultados al hacer clic fuera
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-container')) {
            document.getElementById('sucursalResults').style.display = 'none';
            document.getElementById('productoResults').style.display = 'none';
        }
    });
}

// Buscar sucursales
async function buscarSucursales(termino) {
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
        
        // Query mejorada para búsqueda flexible
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
        
        mostrarResultadosSucursales(results);
        
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
function mostrarResultadosSucursales(results) {
    const resultsContainer = document.getElementById('sucursalResults');
    
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
        
        item.addEventListener('click', () => seleccionarSucursal(sucursal));
        resultsContainer.appendChild(item);
    });
    
    resultsContainer.style.display = 'block';
}
async function seleccionarSucursal(sucursal) {
    // Ocultar resultados
    document.getElementById('sucursalResults').style.display = 'none';
    
    // Cambiar estado a "conectando"
    actualizarEstadoConexion('connecting', 'Conectando...');
    
    // Probar conexión
    const conexionExitosa = await probarConexionSucursal(sucursal);
    
    if (conexionExitosa) {
        sucursalSeleccionada = sucursal;
        mostrarSucursalSeleccionada(sucursal);
        actualizarEstadoConexion('connected', 'Conectado');
        
        // Habilitar búsqueda de productos
        document.getElementById('searchProducto').disabled = false;
        
        validarFormulario();
    } else {
        actualizarEstadoConexion('error', 'Error de conexión');
        
        Swal.fire({
            icon: 'error',
            title: 'Error de conexión',
            text: `No se pudo conectar a la base de datos de ${sucursal.NombreSucursal}`,
            confirmButtonColor: '#6e78ff'
        });
    }
}

// Probar conexión con la sucursal
async function probarConexionSucursal(sucursal) {
    try {
        const config = {
            host: sucursal.serverr,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            database: sucursal.databasee,
            connectTimeout: 10000
        };
        
        conexionSucursal = await mysql.createConnection(config);
        
        // Probar la conexión con una consulta simple
        await conexionSucursal.query('SELECT 1');
        
        return true;
    } catch (error) {
        console.error('Error al conectar con la sucursal:', error);
        conexionSucursal = null;
        return false;
    }
}

// Mostrar sucursal seleccionada
function mostrarSucursalSeleccionada(sucursal) {
    const searchInput = document.getElementById('searchSucursal');
    const btnClear = document.getElementById('clearSucursal');
    
    // Mostrar en el campo de búsqueda
    searchInput.value = `${sucursal.NombreSucursal} "${sucursal.NombreRazon}"`;
    searchInput.readOnly = true; // Hacer el campo de solo lectura
    searchInput.style.cursor = 'not-allowed';
    
    // Mostrar botón de limpiar
    btnClear.style.display = 'flex';
    btnClear.innerHTML = '<i class="fas fa-times"></i>';
}

// Remover sucursal seleccionada
async function removerSucursal() {
    // Si hay productos, preguntar antes de remover
    if (productosAgregados.length > 0) {
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
    if (conexionSucursal) {
        try {
            await conexionSucursal.end();
        } catch (error) {
            console.error('Error al cerrar conexión:', error);
        }
        conexionSucursal = null;
    }
    
    sucursalSeleccionada = null;
    
    // Restaurar campo de búsqueda
    const searchInput = document.getElementById('searchSucursal');
    searchInput.value = '';
    searchInput.readOnly = false;
    searchInput.style.cursor = 'text';
    searchInput.focus();
    
    // Ocultar botón de limpiar
    document.getElementById('clearSucursal').style.display = 'none';
    
    actualizarEstadoConexion('disconnected', 'Sin conexión');
    
    // Deshabilitar búsqueda de productos y limpiar
    document.getElementById('searchProducto').disabled = true;
    document.getElementById('searchProducto').value = '';
    document.getElementById('clearProducto').style.display = 'none';
    
    validarFormulario();
}

// Actualizar estado de conexión
function actualizarEstadoConexion(estado, texto) {
    const statusElement = document.getElementById('connectionStatus');
    
    // Remover todas las clases de estado
    statusElement.classList.remove('disconnected', 'connected', 'connecting', 'error');
    
    // Agregar la clase correspondiente
    statusElement.classList.add(estado);
    
    // Actualizar texto
    statusElement.querySelector('span').textContent = texto;
}

// Buscar productos
async function buscarProductos(termino) {
    if (!sucursalSeleccionada) {
        Swal.fire({
            icon: 'warning',
            title: 'Sucursal no seleccionada',
            text: 'Por favor selecciona una sucursal primero',
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
        // Limpiar y preparar el término de búsqueda
        const terminoLimpio = termino.trim();
        
        // Detectar si es búsqueda por UPC (solo números) o por descripción
        const esUPC = /^\d+$/.test(terminoLimpio);
        
        let query;
        let params;
        
        if (esUPC) {
            // Búsqueda exacta y parcial por UPC
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
            // Búsqueda avanzada por descripción
            // Separar palabras del término de búsqueda
            const palabras = terminoLimpio.toLowerCase().split(/\s+/).filter(p => p.length > 0);
            
            // Crear condiciones para cada palabra (búsqueda tipo "contiene todas las palabras")
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
            
            // Construir parámetros: cada palabra se busca sin espacios
            params = [];
            palabras.forEach(palabra => {
                params.push(`%${palabra}%`, `%${palabra}%`);
            });
            
            // Agregar parámetros para el ordenamiento (buscar coincidencias exactas primero)
            params.push(`%${terminoLimpio}%`, `%${terminoLimpio}%`);
        }
        
        const [results] = await conexionSucursal.query(query, params);
        
        // Si no hay resultados con búsqueda estricta, intentar búsqueda más flexible
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
            
            const [resultsFlexible] = await conexionSucursal.query(queryFlexible, [
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
    // Verificar si el producto ya existe
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

    // Agregar producto al array
    productosAgregados.push({
        Upc: producto.Upc,
        DescLarga: producto.DescLarga,
        Cantidad: 1,
        Costo: parseFloat(producto.Costo),
        Precio: parseFloat(producto.Precio),
        Subtotal: parseFloat(producto.Precio)
    });

    // Ocultar resultados y limpiar búsqueda
    document.getElementById('productoResults').style.display = 'none';
    document.getElementById('searchProducto').value = '';
    document.getElementById('clearProducto').style.display = 'none';

    // Actualizar tabla
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
        row.innerHTML = `
            <td>${producto.Upc}</td>
            <td>${producto.DescLarga}</td>
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

    // Agregar eventos a los inputs y botones
    configurarEventosTabla();
    
    // Actualizar contador
    document.getElementById('productCount').textContent = `${productosAgregados.length} producto${productosAgregados.length !== 1 ? 's' : ''}`;
}

// Configurar eventos de la tabla
function configurarEventosTabla() {
    // Eventos de cantidad
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

    // Eventos de costo
    document.querySelectorAll('.input-costo').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            const costo = parseFloat(e.target.value) || 0;
            
            productosAgregados[index].Costo = costo;
            // No afecta al subtotal, solo es informativo
        });
    });

    // Eventos de precio
    document.querySelectorAll('.input-precio').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            const precio = parseFloat(e.target.value) || 0;
            
            productosAgregados[index].Precio = precio;
            calcularSubtotal(index);
        });
    });

    // Eventos de eliminar
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
    
    // Actualizar la celda del subtotal
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
    
    const valido = fecha && 
                   serie && 
                   numero && 
                   sucursalSeleccionada && 
                   productosAgregados.length > 0;
    
    btnGuardar.disabled = !valido;
}

// Agregar validación en tiempo real a los campos
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('fechaFactura').addEventListener('change', validarFormulario);
    document.getElementById('serieFactura').addEventListener('input', validarFormulario);
    document.getElementById('numeroFactura').addEventListener('input', validarFormulario);
});

// Guardar factura
async function guardarFactura() {
    // Obtener datos del formulario
    const fecha = document.getElementById('fechaFactura').value;
    const serie = document.getElementById('serieFactura').value;
    const numero = document.getElementById('numeroFactura').value;
    
    // Preparar datos para guardar
    const datosFactura = {
        fecha: fecha,
        serie: serie,
        numero: numero,
        sucursal: sucursalSeleccionada,
        productos: productosAgregados,
        total: productosAgregados.reduce((sum, p) => sum + p.Subtotal, 0)
    };
    
    console.log('Datos a guardar:', datosFactura);
    
    // Aquí implementarás la lógica de guardado según tus necesidades
    Swal.fire({
        icon: 'info',
        title: 'Función pendiente',
        text: 'La función de guardado está lista para implementar según tus especificaciones.',
        confirmButtonColor: '#6e78ff'
    });
    
    // Ejemplo de lo que harías:
    /*
    try {
        // Guardar en la base de datos
        await guardarEnBaseDatos(datosFactura);
        
        Swal.fire({
            icon: 'success',
            title: '¡Factura guardada!',
            text: 'La factura se ha registrado correctamente.',
            confirmButtonColor: '#6e78ff'
        }).then(() => {
            // Limpiar formulario o redirigir
            limpiarFormulario();
        });
        
    } catch (error) {
        console.error('Error al guardar:', error);
        Swal.fire({
            icon: 'error',
            title: 'Error al guardar',
            text: 'No se pudo guardar la factura.',
            confirmButtonColor: '#6e78ff'
        });
    }
    */
}

// Limpiar formulario
function limpiarFormulario() {
    document.getElementById('fechaFactura').value = new Date().toISOString().split('T')[0];
    document.getElementById('serieFactura').value = '';
    document.getElementById('numeroFactura').value = '';
    
    if (conexionSucursal) {
        conexionSucursal.end();
        conexionSucursal = null;
    }
    
    sucursalSeleccionada = null;
    productosAgregados = [];
    
    document.getElementById('selectedSucursal').style.display = 'none';
    actualizarEstadoConexion('disconnected', 'Sin conexión');
    document.getElementById('searchProducto').disabled = true;
    
    actualizarTablaProductos();
    actualizarTotal();
    validarFormulario();
}