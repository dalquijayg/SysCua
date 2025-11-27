const Swal = require('sweetalert2');
const mysql = require('mysql2/promise');
const odbc = require('odbc');
const conexiondbsucursal = 'DSN=DBsucursal';

// ========== VARIABLES GLOBALES ==========
let currentSection = 'inicio';
let sucursalesSurtiMayoreo = [];
let resultadosVerificacionSurtiMayoreo = [];

// ========== INICIALIZACIÓN ==========
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

function initializeApp() {
    
    // Inicializar eventos del menú
    initializeMenuEvents();
    
    // Inicializar botón de refresh
    initializeRefreshButton();
    
    // Verificar conexiones
    verificarConexiones();
}

// ========== EVENTOS DEL MENÚ ==========
function initializeMenuEvents() {
    const menuItems = document.querySelectorAll('.menu-item');
    
    menuItems.forEach(item => {
        item.addEventListener('click', function() {
            const section = this.getAttribute('data-section');
            changeSection(section);
        });
    });
}

function changeSection(sectionId) {
    // Remover clase active de todos los items del menú
    const menuItems = document.querySelectorAll('.menu-item');
    menuItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Agregar clase active al item seleccionado
    const activeItem = document.querySelector(`[data-section="${sectionId}"]`);
    if (activeItem) {
        activeItem.classList.add('active');
    }
    
    // Ocultar todas las secciones
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });
    
    // Mostrar la sección seleccionada
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
        currentSection = sectionId;
        updateSectionTitle(sectionId);
        
        // Inicializar sección específica
        if (sectionId === 'ventas-megared' && sucursalesMegared.length === 0) {
            initVentasMegared();
        }
        
        if (sectionId === 'ventas-surtimayoreo' && sucursalesSurtiMayoreo.length === 0) {
            initVentasSurtiMayoreo();
        }
        
        if (sectionId === 'ventas-bodegona' && sucursalesBodegonaAntigua.length === 0) {
            initVentasBodegonaAntigua();
        }
        
        if (sectionId === 'nc-megared') {
            initNCMegared();
        }
        
        if (sectionId === 'nc-surtimayoreo') {
            initNCSurtiMayoreo();
        }
        
        if (sectionId === 'nc-bodegona') {
            initNCBodegonaAntigua();
        }
        if (sectionId === 'ingresos-proveedores') {
            initIngresosProveedores();
        }
    }
}

function updateSectionTitle(sectionId) {
    const titles = {
        'ventas-megared': 'Ventas Megared',
        'ventas-surtimayoreo': 'Ventas SurtiMayoreo',
        'ventas-bodegona': 'Ventas Bodegona Antigua',
        'nc-megared': 'Notas de Crédito Megared',
        'nc-surtimayoreo': 'Notas de Crédito SurtiMayoreo',
        'nc-bodegona': 'Notas de Crédito Bodegona Antigua',
        'ingresos-proveedores': 'Ingresos de Proveedores',
        'bonificaciones-surtis': 'Bonificaciones Surtis',
        'facturas-cori': 'Facturas de CORI',
        'inicio': 'Panel de Sincronización'
    };
    
    const titleElement = document.getElementById('section-title');
    if (titleElement && titles[sectionId]) {
        titleElement.textContent = titles[sectionId];
    }
}

// ========== BOTÓN REFRESH ==========
function initializeRefreshButton() {
    const btnRefresh = document.querySelector('.btn-refresh');
    
    if (btnRefresh) {
        btnRefresh.addEventListener('click', () => {
            refreshCurrentSection();
        });
    }
}

function refreshCurrentSection() {
    Swal.fire({
        title: 'Actualizando...',
        text: 'Recargando información',
        icon: 'info',
        timer: 1500,
        showConfirmButton: false,
        background: '#16213e',
        color: '#eaeaea'
    });
}

// ========== VERIFICACIÓN DE CONEXIONES ==========
async function verificarConexiones() {
    try {
        const odbcStatus = await verificarConexionODBC();
    } catch (error) {
        console.error('Error al verificar conexiones:', error);
        mostrarErrorConexion(error);
    }
}

async function verificarConexionODBC() {
    try {
        const connection = await odbc.connect(conexiondbsucursal);
        await connection.close();
        return true;
    } catch (error) {
        console.error('✗ Error en conexión ODBC:', error.message);
        return false;
    }
}

async function verificarConexionMySQL(config) {
    try {
        const connection = await mysql.createConnection(config);
        await connection.end();
        return true;
    } catch (error) {
        console.error('✗ Error en conexión MySQL:', error.message);
        return false;
    }
}

function mostrarErrorConexion(error) {
    Swal.fire({
        title: 'Error de Conexión',
        text: `No se pudo establecer conexión con la base de datos: ${error.message}`,
        icon: 'error',
        confirmButtonText: 'Entendido',
        background: '#16213e',
        color: '#eaeaea',
        confirmButtonColor: '#00d4ff'
    });
}

// ========== FUNCIONES DE UTILIDAD ==========
function showLoading(message = 'Cargando...') {
    Swal.fire({
        title: message,
        allowOutsideClick: false,
        allowEscapeKey: false,
        background: '#16213e',
        color: '#eaeaea',
        didOpen: () => {
            Swal.showLoading();
        }
    });
}

function hideLoading() {
    Swal.close();
}

function showSuccess(message, title = '¡Éxito!') {
    Swal.fire({
        title: title,
        text: message,
        icon: 'success',
        confirmButtonText: 'OK',
        background: '#16213e',
        color: '#eaeaea',
        confirmButtonColor: '#00d4ff'
    });
}

function showError(message, title = 'Error') {
    Swal.fire({
        title: title,
        text: message,
        icon: 'error',
        confirmButtonText: 'OK',
        background: '#16213e',
        color: '#eaeaea',
        confirmButtonColor: '#00d4ff'
    });
}

function showWarning(message, title = 'Advertencia') {
    Swal.fire({
        title: title,
        text: message,
        icon: 'warning',
        confirmButtonText: 'OK',
        background: '#16213e',
        color: '#eaeaea',
        confirmButtonColor: '#00d4ff'
    });
}

async function showConfirm(message, title = '¿Estás seguro?') {
    const result = await Swal.fire({
        title: title,
        text: message,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Sí, continuar',
        cancelButtonText: 'Cancelar',
        background: '#16213e',
        color: '#eaeaea',
        confirmButtonColor: '#00d4ff',
        cancelButtonColor: '#6c757d'
    });
    
    return result.isConfirmed;
}

// ========== VENTAS MEGARED ==========
let sucursalesMegared = [];
let resultadosVerificacionMegared = [];
const BATCH_SIZE_VERIFICACION = 5;

const configLocal = {
    host: '172.30.1.17',
    database: 'Gestion',
    user: 'compras',
    password: 'bode.24451988'
};

async function initVentasMegared() {
    try {
        await cargarSucursalesMegared();
        
        const btnVerificar = document.getElementById('btn-verificar-megared');
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-megared');
        const btnExportar = document.getElementById('btn-exportar-megared');
        
        if (btnVerificar) {
            btnVerificar.addEventListener('click', verificarVentasMegared);
        }
        
        if (btnSincronizarTodas) {
            btnSincronizarTodas.addEventListener('click', sincronizarTodasLasDiferencias);
        }
        
    } catch (error) {
        console.error('Error al inicializar Ventas Megared:', error);
        showError('Error al inicializar la sección: ' + error.message);
    }
}
async function sincronizarTodasLasDiferencias() {
    try {
        // Recopilar todas las diferencias
        const diferenciasParaSincronizar = [];
        
        resultadosVerificacionMegared.forEach(resultado => {
            if (!resultado.errorConexion && resultado.diferencias.length > 0) {
                resultado.diferencias.forEach(dif => {
                    if (!dif.error && dif.diferencia !== 0) {
                        diferenciasParaSincronizar.push({
                            idSucursal: resultado.idSucursal,
                            nombreSucursal: resultado.nombreSucursal,
                            fecha: dif.fecha,
                            cantidadLocal: dif.cantidadLocal,
                            cantidadSucursal: dif.cantidadSucursal,
                            diferencia: dif.diferencia
                        });
                    }
                });
            }
        });
        
        if (diferenciasParaSincronizar.length === 0) {
            showWarning('No hay diferencias para sincronizar');
            return;
        }
        
        // Confirmar sincronización
        const confirmar = await showConfirm(
            `¿Deseas sincronizar todas las diferencias encontradas?\n\nTotal: ${diferenciasParaSincronizar.length} registros con diferencias\nSucursales afectadas: ${new Set(diferenciasParaSincronizar.map(d => d.idSucursal)).size}`,
            'Confirmar Sincronización Masiva'
        );
        
        if (!confirmar) return;
        
        // Deshabilitar botón mientras sincroniza
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-megared');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = true;
        }
        
        showLoading('Sincronizando todas las diferencias...');
        
        let sincronizados = 0;
        let errores = 0;
        
        // Procesar en lotes de 3 para no saturar
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < diferenciasParaSincronizar.length; i += BATCH_SIZE) {
            const lote = diferenciasParaSincronizar.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(diferenciasParaSincronizar.length / BATCH_SIZE);
            
            const promesas = lote.map(async (item) => {
                try {
                    await sincronizarDiferenciaIndividual(item);
                    sincronizados++;
                } catch (error) {
                    errores++;
                    console.error(`  ✗ ${item.nombreSucursal} - ${item.fecha}:`, error.message);
                }
            });
            
            await Promise.all(promesas);
            
            // Actualizar mensaje de progreso
            Swal.update({
                title: 'Sincronizando...',
                html: `
                    <div style="text-align: center;">
                        <p>Procesando lote ${loteNumero} de ${totalLotes}</p>
                        <p style="margin-top: 10px;">
                            <strong style="color: #28a745;">Sincronizados: ${sincronizados}</strong> | 
                            <strong style="color: #dc3545;">Errores: ${errores}</strong>
                        </p>
                    </div>
                `
            });
        }
        
        hideLoading();
        
        // Mostrar resultado
        if (errores === 0) {
            showSuccess(`¡Sincronización completada!\n\n${sincronizados} diferencias sincronizadas correctamente.`);
        } else {
            showWarning(`Sincronización completada con algunos errores.\n\nSincronizados: ${sincronizados}\nErrores: ${errores}`);
        }
        
        // Verificar nuevamente para actualizar la tabla
        const fechaInicio = document.getElementById('fecha-inicio-megared').value;
        const fechaFin = document.getElementById('fecha-fin-megared').value;
        
        await verificarVentasMegared();
        
    } catch (error) {
        hideLoading();
        showError('Error en sincronización masiva: ' + error.message);
        
        // Re-habilitar botón en caso de error
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-megared');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = false;
        }
    }
}
async function sincronizarDiferenciaIndividual(item) {
    try {
        // Buscar la sucursal
        const sucursal = sucursalesMegared.find(s => s.idSucursal == item.idSucursal);
        
        if (!sucursal) {
            throw new Error('No se encontró la información de la sucursal');
        }
        
        // Conectar a base local
        const connLocal = await mysql.createConnection(configLocal);
        
        // 1. Eliminar datos locales existentes
        await connLocal.query(
            'DELETE FROM ventasmegared WHERE Fecha = ? AND IdSucursal = ?',
            [item.fecha, item.idSucursal]
        );
        
        // 2. Conectar a sucursal remota
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        // 3. Obtener datos de la sucursal
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                transaccionesnitido.Id, 
                transaccionesnitido.IdCajas, 
                detalletransaccionesnitido.Upc, 
                productos.DescLarga, 
                detalletransaccionesnitido.Cantidad, 
                detalletransaccionesnitido.CostoUnitario, 
                detalletransaccionesnitido.PrecioUnitario, 
                transaccionesnitido.Fecha, 
                transaccionesnitido.NIT, 
                transaccionesnitido.NombreCliente,
                transaccionesnitido.Serie, 
                transaccionesnitido.NoDocumento, 
                transaccionesnitido.UUID,
                detalletransaccionesnitido.DescCorta,
                detalletransaccionesnitido.Total
            FROM
                transaccionesnitido
                INNER JOIN
                detalletransaccionesnitido
                ON 
                    transaccionesnitido.Id = detalletransaccionesnitido.Idtransacciones AND
                    transaccionesnitido.IdCajas = detalletransaccionesnitido.IdCajas
                LEFT JOIN
                productos
                ON 
                    detalletransaccionesnitido.Upc = productos.Upc
            WHERE
                transaccionesnitido.Fecha = ? AND
                transaccionesnitido.Estado = 1`,
            [item.fecha]
        );
        
        // 4. Insertar datos en base local
        if (datosRemoto.length > 0) {
            const insertQuery = `
                INSERT INTO ventasmegared 
                (IdTransaccion, IdCaja, Upc, Descripcion, DescCorta, Cantidad, CostoUnitario, 
                 PrecioUnitario, Fecha, NIT, NombreCliente, Serie, NoDocumento, UUID, IdSucursal, NombreSucursal, Total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            for (const registro of datosRemoto) {
                await connLocal.query(insertQuery, [
                    registro.Id,
                    registro.IdCajas,
                    registro.Upc,
                    registro.DescLarga,
                    registro.DescCorta,
                    registro.Cantidad,
                    registro.CostoUnitario,
                    registro.PrecioUnitario,
                    registro.Fecha,
                    registro.NIT,
                    registro.NombreCliente,
                    registro.Serie,
                    registro.NoDocumento,
                    registro.UUID,
                    item.idSucursal,
                    item.nombreSucursal,
                    registro.Total
                ]);
            }
        }
        
        // Cerrar conexiones
        await connLocal.end();
        await connRemoto.end();
        
    } catch (error) {
        throw error;
    }
}
async function cargarSucursalesMegared() {
    try {
        showLoading('Cargando sucursales...');
        
        const connection = await odbc.connect(conexiondbsucursal);
        
        const query = `
            SELECT
                idSucursal, 
                NombreSucursal, 
                serverr, 
                databasee, 
                Uid, 
                Pwd,
                Puerto
            FROM
                sucursales
            WHERE
                RazonSocial = 2 AND
                Activo = 1
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        sucursalesMegared = result;
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error al cargar sucursales:', error);
        throw error;
    }
}

async function verificarVentasMegared() {
    try {
        const fechaInicio = document.getElementById('fecha-inicio-megared').value;
        const fechaFin = document.getElementById('fecha-fin-megared').value;
        
        if (!fechaInicio || !fechaFin) {
            showWarning('Por favor selecciona ambas fechas');
            return;
        }
        
        if (new Date(fechaInicio) > new Date(fechaFin)) {
            showWarning('La fecha de inicio no puede ser mayor a la fecha fin');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas verificar las ventas desde ${fechaInicio} hasta ${fechaFin}?`,
            'Confirmar Verificación'
        );
        
        if (!confirmar) return;
        
        // Resetear resultados
        resultadosVerificacionMegared = [];
        
        // Ocultar botón de sincronizar mientras verifica
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-megared');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.style.display = 'none';
            btnSincronizarTodas.disabled = true;
        }
        
        // Mostrar tabla inicial
        mostrarTablaEnProgreso();
        
        // Procesar sucursales en lotes de 5
        const BATCH_SIZE = 5;
        const totalSucursales = sucursalesMegared.length;
        
        for (let i = 0; i < totalSucursales; i += BATCH_SIZE) {
            const lote = sucursalesMegared.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(totalSucursales / BATCH_SIZE);
            
            // Procesar todas las sucursales del lote en paralelo
            const promesas = lote.map((sucursal, index) => {
                const globalIndex = i + index + 1;
                return verificarSucursalMegared(sucursal, fechaInicio, fechaFin);
            });
            
            // Esperar a que todas las sucursales del lote terminen
            await Promise.all(promesas);
            
            // Actualizar tabla después de cada lote
            mostrarResultadosMegared();
        }
        
        // Verificar si hay diferencias
        const hayDiferencias = resultadosVerificacionMegared.some(r => r.diferencias.length > 0);
        
        // Mostrar y habilitar botón de sincronizar todas si hay diferencias
        if (btnSincronizarTodas && hayDiferencias) {
            btnSincronizarTodas.style.display = 'inline-flex';
            btnSincronizarTodas.disabled = false;
        }
        
        showSuccess(`Verificación completada. ${sucursalesMegared.length} sucursales verificadas.`);
        
    } catch (error) {
        showError('Error al verificar ventas: ' + error.message);
    }
}

function mostrarTablaEnProgreso() {
    const container = document.getElementById('container-sucursales-megared');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    html += '<tr>';
    html += '<td colspan="7" class="text-center" style="padding: 40px;">';
    html += '<div class="loading-spinner"></div> Verificando sucursales...';
    html += '</td>';
    html += '</tr>';
    html += '</tbody>';
    html += '</table>';
    
    container.innerHTML = html;
}

async function verificarSucursalMegared(sucursal, fechaInicio, fechaFin) {
    try {
        const diferencias = [];
        
        const fechas = generarRangoFechas(fechaInicio, fechaFin);
        
        // Conectar a base local
        const connLocal = await mysql.createConnection(configLocal);
        
        // Conectar a sucursal remota
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        let connRemoto;
        try {
            connRemoto = await mysql.createConnection(configRemoto);
        } catch (error) {
            console.error(`  ✗ Error conectando a sucursal ${sucursal.NombreSucursal}:`, error.message);
            
            fechas.forEach(fecha => {
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: 'Error de conexión a sucursal'
                });
            });
            
            await connLocal.end();
            
            resultadosVerificacionMegared.push({
                idSucursal: sucursal.idSucursal,
                nombreSucursal: sucursal.NombreSucursal,
                diferencias: diferencias,
                errorConexion: true
            });
            
            return;
        }
        
        // Verificar cada fecha
        for (const fecha of fechas) {
            try {
                // Consultar local
                const [rowsLocal] = await connLocal.query(
                    'SELECT COUNT(*) as total FROM ventasmegared WHERE Fecha = ? AND IdSucursal = ?',
                    [fecha, sucursal.idSucursal]
                );
                
                const cantidadLocal = rowsLocal[0].total;
                
                // Consultar remoto
                const [rowsRemoto] = await connRemoto.query(
                    `SELECT COUNT(*) as total FROM transaccionesnitido 
                     INNER JOIN detalletransaccionesnitido 
                     ON transaccionesnitido.Id = detalletransaccionesnitido.Idtransacciones 
                     AND transaccionesnitido.IdCajas = detalletransaccionesnitido.IdCajas
                     WHERE transaccionesnitido.Fecha = ? 
                     AND transaccionesnitido.Estado = 1`,
                    [fecha]
                );
                
                const cantidadSucursal = rowsRemoto[0].total;
                
                // Si hay diferencia, guardar
                if (cantidadLocal !== cantidadSucursal) {
                    diferencias.push({
                        fecha: fecha,
                        cantidadLocal: cantidadLocal,
                        cantidadSucursal: cantidadSucursal,
                        diferencia: cantidadSucursal - cantidadLocal
                    });
                }
                
            } catch (error) {
                console.error(`  ✗ Error verificando fecha ${fecha}:`, error.message);
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: error.message
                });
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        resultadosVerificacionMegared.push({
            idSucursal: sucursal.idSucursal,
            nombreSucursal: sucursal.NombreSucursal,
            diferencias: diferencias,
            errorConexion: false
        });
        
    } catch (error) {
        console.error(`Error general en sucursal ${sucursal.NombreSucursal}:`, error);
        throw error;
    }
}

function generarRangoFechas(fechaInicio, fechaFin) {
    const fechas = [];
    const inicio = new Date(fechaInicio + 'T00:00:00');
    const fin = new Date(fechaFin + 'T00:00:00');
    
    while (inicio <= fin) {
        fechas.push(inicio.toISOString().split('T')[0]);
        inicio.setDate(inicio.getDate() + 1);
    }
    
    return fechas;
}

function mostrarResultadosMegared() {
    const container = document.getElementById('container-sucursales-megared');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    
    let totalDiferencias = 0;
    let sucursalesConDiferencias = 0;
    let sucursalesSinDiferencias = 0;
    
    resultadosVerificacionMegared.forEach(resultado => {
        if (resultado.errorConexion) {
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-store"></i> ${resultado.nombreSucursal} - <span class="status-badge status-error"><i class="fas fa-exclamation-triangle"></i> Error de Conexión</span></td>`;
            html += '</tr>';
        } else if (resultado.diferencias.length > 0) {
            sucursalesConDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-store"></i> ${resultado.nombreSucursal} <span class="status-badge status-warning" style="margin-left: 10px;">${resultado.diferencias.length} diferencia(s)</span></td>`;
            html += '</tr>';
            
            resultado.diferencias.forEach(dif => {
                totalDiferencias++;
                
                html += '<tr class="fecha-row">';
                html += `<td></td>`;
                html += `<td>${formatearFecha(dif.fecha)}</td>`;
                html += `<td class="text-center">${dif.cantidadLocal}</td>`;
                html += `<td class="text-center">${dif.cantidadSucursal}</td>`;
                
                if (dif.error) {
                    html += `<td class="text-center">-</td>`;
                    html += `<td class="text-center"><span class="status-badge status-error"><i class="fas fa-times"></i> Error</span></td>`;
                    html += `<td class="text-center">-</td>`;
                } else {
                    const difNum = dif.diferencia;
                    const colorDif = difNum > 0 ? 'style="color: #28a745;"' : 'style="color: #dc3545;"';
                    html += `<td class="text-center" ${colorDif}><strong>${difNum > 0 ? '+' : ''}${difNum}</strong></td>`;
                    
                    if (difNum !== 0) {
                        html += `<td class="text-center"><span class="status-badge status-warning"><i class="fas fa-exclamation-circle"></i> Diferencia</span></td>`;
                        html += `<td class="text-center">`;
                        html += `<button class="btn-resync" onclick="resincronizarFecha('${resultado.idSucursal}', '${dif.fecha}')">`;
                        html += `<i class="fas fa-sync"></i> Resincronizar`;
                        html += `</button>`;
                        html += `</td>`;
                    } else {
                        html += `<td class="text-center"><span class="status-badge status-ok"><i class="fas fa-check"></i> OK</span></td>`;
                        html += `<td class="text-center">-</td>`;
                    }
                }
                
                html += '</tr>';
            });
        } else {
            sucursalesSinDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-store"></i> ${resultado.nombreSucursal} <span class="status-badge status-ok" style="margin-left: 10px;"><i class="fas fa-check-circle"></i> Sin Diferencias</span></td>`;
            html += '</tr>';
        }
    });
    html += '</tbody>';
    html += '</table>';
    
    // Agregar resumen al final
    if (resultadosVerificacionMegared.length > 0) {
        html += '<div style="margin-top: 20px; padding: 15px; background: rgba(0, 212, 255, 0.05); border-radius: 8px; display: flex; gap: 20px; flex-wrap: wrap;">';
        html += `<div><strong>Total Sucursales:</strong> ${resultadosVerificacionMegared.length}</div>`;
        html += `<div style="color: #28a745;"><strong>Sin Diferencias:</strong> ${sucursalesSinDiferencias}</div>`;
        html += `<div style="color: #ffc107;"><strong>Con Diferencias:</strong> ${sucursalesConDiferencias}</div>`;
        html += `<div style="color: #dc3545;"><strong>Total Diferencias:</strong> ${totalDiferencias}</div>`;
        html += '</div>';
    }
    
    container.innerHTML = html;
}

// ========== RESINCRONIZACIÓN ==========
async function resincronizarFecha(idSucursal, fecha) {
    try {
        // Buscar la sucursal en el array
        const sucursal = sucursalesMegared.find(s => s.idSucursal == idSucursal);
        
        if (!sucursal) {
            showError('No se encontró la información de la sucursal');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas resincronizar los datos de ${sucursal.NombreSucursal} para la fecha ${formatearFecha(fecha)}?`,
            'Confirmar Resincronización'
        );
        
        if (!confirmar) return;
        
        showLoading('Resincronizando datos...');
        
        // Conectar a base local
        const connLocal = await mysql.createConnection(configLocal);
        await connLocal.query(
            'DELETE FROM ventasmegared WHERE Fecha = ? AND IdSucursal = ?',
            [fecha, idSucursal]
        );

        // 2. Conectar a sucursal remota
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                transaccionesnitido.Id, 
                transaccionesnitido.IdCajas, 
                detalletransaccionesnitido.Upc, 
                productos.DescLarga, 
                detalletransaccionesnitido.Cantidad, 
                detalletransaccionesnitido.CostoUnitario, 
                detalletransaccionesnitido.PrecioUnitario, 
                transaccionesnitido.Fecha, 
                transaccionesnitido.NIT, 
                transaccionesnitido.NombreCliente,
                transaccionesnitido.Serie, 
                transaccionesnitido.NoDocumento, 
                transaccionesnitido.UUID,
                detalletransaccionesnitido.DescCorta,
                detalletransaccionesnitido.Total
            FROM
                transaccionesnitido
                INNER JOIN
                detalletransaccionesnitido
                ON 
                    transaccionesnitido.Id = detalletransaccionesnitido.Idtransacciones AND
                    transaccionesnitido.IdCajas = detalletransaccionesnitido.IdCajas
                LEFT JOIN
                productos
                ON 
                    detalletransaccionesnitido.Upc = productos.Upc
            WHERE
                transaccionesnitido.Fecha = ? AND
                transaccionesnitido.Estado = 1`,
            [fecha]
        );
        
        // 4. Insertar datos en base local
        if (datosRemoto.length > 0) {
            
            const insertQuery = `
                INSERT INTO ventasmegared 
                (IdTransaccion, IdCaja, Upc, Descripcion, DescCorta, Cantidad, CostoUnitario, 
                 PrecioUnitario, Fecha, NIT, NombreCliente, Serie, NoDocumento, UUID, IdSucursal, NombreSucursal, Total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            let insertados = 0;
            for (const registro of datosRemoto) {
                try {
                    await connLocal.query(insertQuery, [
                        registro.Id,
                        registro.IdCajas,
                        registro.Upc,
                        registro.DescLarga,
                        registro.DescCorta,
                        registro.Cantidad,
                        registro.CostoUnitario,
                        registro.PrecioUnitario,
                        registro.Fecha,
                        registro.NIT,
                        registro.NombreCliente,
                        registro.Serie,
                        registro.NoDocumento,
                        registro.UUID,
                        idSucursal,
                        sucursal.NombreSucursal,
                        registro.Total
                    ]);
                    insertados++;
                } catch (error) {
                    console.error(`  ✗ Error insertando registro:`, error.message);
                }
            }
        } else {
            console.log('  ! No hay registros para insertar');
        }
        
        // Cerrar conexiones
        await connLocal.end();
        await connRemoto.end();
        
        hideLoading();
        
        // 5. Verificar nuevamente
        await showSuccess(`Resincronización completada. ${datosRemoto.length} registros sincronizados.`);
        
        // Volver a verificar esta fecha específicamente
        await verificarSucursalMegared(
            sucursal, 
            fecha, 
            fecha
        );
        
        mostrarResultadosMegared();
        
    } catch (error) {
        hideLoading();
        console.error('Error al resincronizar:', error);
        showError('Error al resincronizar: ' + error.message);
    }
}

// Hacer la función global para que pueda ser llamada desde el HTML
window.resincronizarFecha = resincronizarFecha;

function formatearFecha(fecha) {
    const date = new Date(fecha + 'T00:00:00');
    const opciones = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
    return date.toLocaleDateString('es-ES', opciones);
}
async function initVentasSurtiMayoreo() {
    try {
        await cargarSucursalesSurtiMayoreo();
        
        const btnVerificar = document.getElementById('btn-verificar-surtimayoreo');
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-surtimayoreo');
        const btnExportar = document.getElementById('btn-exportar-surtimayoreo');
        
        if (btnVerificar) {
            btnVerificar.addEventListener('click', verificarVentasSurtiMayoreo);
        }
        
        if (btnSincronizarTodas) {
            btnSincronizarTodas.addEventListener('click', sincronizarTodasLasDiferenciasSurtiMayoreo);
        }
        
        if (btnExportar) {
            btnExportar.addEventListener('click', exportarResultadosSurtiMayoreo);
        }
        
    } catch (error) {
        console.error('Error al inicializar Ventas SurtiMayoreo:', error);
        showError('Error al inicializar la sección: ' + error.message);
    }
}

async function cargarSucursalesSurtiMayoreo() {
    try {
        showLoading('Cargando sucursales SurtiMayoreo...');
        
        const connection = await odbc.connect(conexiondbsucursal);
        
        const query = `
            SELECT
                idSucursal, 
                NombreSucursal, 
                serverr, 
                databasee, 
                Uid, 
                Pwd,
                Puerto
            FROM
                sucursales
            WHERE
                RazonSocial = 3 AND
                Activo = 1
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        sucursalesSurtiMayoreo = result;
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error al cargar sucursales SurtiMayoreo:', error);
        throw error;
    }
}

async function verificarVentasSurtiMayoreo() {
    try {
        const fechaInicio = document.getElementById('fecha-inicio-surtimayoreo').value;
        const fechaFin = document.getElementById('fecha-fin-surtimayoreo').value;
        
        if (!fechaInicio || !fechaFin) {
            showWarning('Por favor selecciona ambas fechas');
            return;
        }
        
        if (new Date(fechaInicio) > new Date(fechaFin)) {
            showWarning('La fecha de inicio no puede ser mayor a la fecha fin');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas verificar las ventas SurtiMayoreo desde ${fechaInicio} hasta ${fechaFin}?`,
            'Confirmar Verificación'
        );
        
        if (!confirmar) return;
        
        // Resetear resultados
        resultadosVerificacionSurtiMayoreo = [];
        
        // Ocultar botón de sincronizar mientras verifica
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-surtimayoreo');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.style.display = 'none';
            btnSincronizarTodas.disabled = true;
        }
        
        // Mostrar tabla inicial
        mostrarTablaEnProgresoSurtiMayoreo();
        
        // Procesar sucursales en lotes de 5
        const BATCH_SIZE = 5;
        const totalSucursales = sucursalesSurtiMayoreo.length;
        
        for (let i = 0; i < totalSucursales; i += BATCH_SIZE) {
            const lote = sucursalesSurtiMayoreo.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(totalSucursales / BATCH_SIZE);
            
            const promesas = lote.map((sucursal, index) => {
                const globalIndex = i + index + 1;
                return verificarSucursalSurtiMayoreo(sucursal, fechaInicio, fechaFin);
            });
            
            await Promise.all(promesas);
            mostrarResultadosSurtiMayoreo();
        }
        
        const hayDiferencias = resultadosVerificacionSurtiMayoreo.some(r => r.diferencias.length > 0);
        
        if (btnSincronizarTodas && hayDiferencias) {
            btnSincronizarTodas.style.display = 'inline-flex';
            btnSincronizarTodas.disabled = false;
        }
        
        showSuccess(`Verificación completada. ${sucursalesSurtiMayoreo.length} sucursales verificadas.`);
        
    } catch (error) {
        console.error('Error al verificar ventas SurtiMayoreo:', error);
        showError('Error al verificar ventas: ' + error.message);
    }
}

function mostrarTablaEnProgresoSurtiMayoreo() {
    const container = document.getElementById('container-sucursales-surtimayoreo');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    html += '<tr>';
    html += '<td colspan="7" class="text-center" style="padding: 40px;">';
    html += '<div class="loading-spinner"></div> Verificando sucursales...';
    html += '</td>';
    html += '</tr>';
    html += '</tbody>';
    html += '</table>';
    
    container.innerHTML = html;
}

async function verificarSucursalSurtiMayoreo(sucursal, fechaInicio, fechaFin) {
    try {
        const diferencias = [];
        
        const fechas = generarRangoFechas(fechaInicio, fechaFin);
        
        const connLocal = await mysql.createConnection(configLocal);
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        let connRemoto;
        try {
            connRemoto = await mysql.createConnection(configRemoto);
        } catch (error) {
            console.error(`  ✗ Error conectando a sucursal ${sucursal.NombreSucursal}:`, error.message);
            
            fechas.forEach(fecha => {
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: 'Error de conexión a sucursal'
                });
            });
            
            await connLocal.end();
            
            resultadosVerificacionSurtiMayoreo.push({
                idSucursal: sucursal.idSucursal,
                nombreSucursal: sucursal.NombreSucursal,
                diferencias: diferencias,
                errorConexion: true
            });
            
            return;
        }
        
        for (const fecha of fechas) {
            try {
                const [rowsLocal] = await connLocal.query(
                    'SELECT COUNT(*) as total FROM ventassurtimayoreo WHERE Fecha = ? AND IdSucursal = ?',
                    [fecha, sucursal.idSucursal]
                );
                
                const cantidadLocal = rowsLocal[0].total;
                
                const [rowsRemoto] = await connRemoto.query(
                    `SELECT 
                        COUNT(*) AS total
                    FROM
                        transaccionesnitido
                    INNER JOIN
                        detalletransaccionesnitido
                        ON transaccionesnitido.Id = detalletransaccionesnitido.Idtransacciones
                    INNER JOIN
                        detallepedidos
                        ON detalletransaccionesnitido.Upc = detallepedidos.Codigo
                        AND detallepedidos.IdPedidos = transaccionesnitido.IdUpdate
                    WHERE
                        transaccionesnitido.Fecha = ?
                        AND transaccionesnitido.Estado = 1`,
                    [fecha]
                );
                
                const cantidadSucursal = rowsRemoto[0].total;
                
                if (cantidadLocal !== cantidadSucursal) {
                    diferencias.push({
                        fecha: fecha,
                        cantidadLocal: cantidadLocal,
                        cantidadSucursal: cantidadSucursal,
                        diferencia: cantidadSucursal - cantidadLocal
                    });
                }
                
            } catch (error) {
                console.error(`  ✗ Error verificando fecha ${fecha}:`, error.message);
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: error.message
                });
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        resultadosVerificacionSurtiMayoreo.push({
            idSucursal: sucursal.idSucursal,
            nombreSucursal: sucursal.NombreSucursal,
            diferencias: diferencias,
            errorConexion: false
        });
        
    } catch (error) {
        console.error(`Error general en sucursal ${sucursal.NombreSucursal}:`, error);
        throw error;
    }
}

function mostrarResultadosSurtiMayoreo() {
    const container = document.getElementById('container-sucursales-surtimayoreo');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    
    let totalDiferencias = 0;
    let sucursalesConDiferencias = 0;
    let sucursalesSinDiferencias = 0;
    
    resultadosVerificacionSurtiMayoreo.forEach(resultado => {
        if (resultado.errorConexion) {
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-warehouse"></i> ${resultado.nombreSucursal} - <span class="status-badge status-error"><i class="fas fa-exclamation-triangle"></i> Error de Conexión</span></td>`;
            html += '</tr>';
        } else if (resultado.diferencias.length > 0) {
            sucursalesConDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-warehouse"></i> ${resultado.nombreSucursal} <span class="status-badge status-warning" style="margin-left: 10px;">${resultado.diferencias.length} diferencia(s)</span></td>`;
            html += '</tr>';
            
            resultado.diferencias.forEach(dif => {
                totalDiferencias++;
                
                html += '<tr class="fecha-row">';
                html += `<td></td>`;
                html += `<td>${formatearFecha(dif.fecha)}</td>`;
                html += `<td class="text-center">${dif.cantidadLocal}</td>`;
                html += `<td class="text-center">${dif.cantidadSucursal}</td>`;
                
                if (dif.error) {
                    html += `<td class="text-center">-</td>`;
                    html += `<td class="text-center"><span class="status-badge status-error"><i class="fas fa-times"></i> Error</span></td>`;
                    html += `<td class="text-center">-</td>`;
                } else {
                    const difNum = dif.diferencia;
                    const colorDif = difNum > 0 ? 'style="color: #28a745;"' : 'style="color: #dc3545;"';
                    html += `<td class="text-center" ${colorDif}><strong>${difNum > 0 ? '+' : ''}${difNum}</strong></td>`;
                    
                    if (difNum !== 0) {
                        html += `<td class="text-center"><span class="status-badge status-warning"><i class="fas fa-exclamation-circle"></i> Diferencia</span></td>`;
                        html += `<td class="text-center">`;
                        html += `<button class="btn-resync" onclick="resincronizarFechaSurtiMayoreo('${resultado.idSucursal}', '${dif.fecha}')">`;
                        html += `<i class="fas fa-sync"></i> Resincronizar`;
                        html += `</button>`;
                        html += `</td>`;
                    } else {
                        html += `<td class="text-center"><span class="status-badge status-ok"><i class="fas fa-check"></i> OK</span></td>`;
                        html += `<td class="text-center">-</td>`;
                    }
                }
                
                html += '</tr>';
            });
        } else {
            sucursalesSinDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-warehouse"></i> ${resultado.nombreSucursal} <span class="status-badge status-ok" style="margin-left: 10px;"><i class="fas fa-check-circle"></i> Sin Diferencias</span></td>`;
            html += '</tr>';
        }
    });
    
    html += '</tbody>';
    html += '</table>';
    
    if (resultadosVerificacionSurtiMayoreo.length > 0) {
        html += '<div style="margin-top: 20px; padding: 15px; background: rgba(0, 212, 255, 0.05); border-radius: 8px; display: flex; gap: 20px; flex-wrap: wrap;">';
        html += `<div><strong>Total Sucursales:</strong> ${resultadosVerificacionSurtiMayoreo.length}</div>`;
        html += `<div style="color: #28a745;"><strong>Sin Diferencias:</strong> ${sucursalesSinDiferencias}</div>`;
        html += `<div style="color: #ffc107;"><strong>Con Diferencias:</strong> ${sucursalesConDiferencias}</div>`;
        html += `<div style="color: #dc3545;"><strong>Total Diferencias:</strong> ${totalDiferencias}</div>`;
        html += '</div>';
    }
    
    container.innerHTML = html;
}

async function resincronizarFechaSurtiMayoreo(idSucursal, fecha) {
    try {
        const sucursal = sucursalesSurtiMayoreo.find(s => s.idSucursal == idSucursal);
        
        if (!sucursal) {
            showError('No se encontró la información de la sucursal');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas resincronizar los datos de ${sucursal.NombreSucursal} para la fecha ${formatearFecha(fecha)}?`,
            'Confirmar Resincronización'
        );
        
        if (!confirmar) return;
        
        showLoading('Resincronizando datos...');
        
        const connLocal = await mysql.createConnection(configLocal);
        
        await connLocal.query(
            'DELETE FROM ventassurtimayoreo WHERE Fecha = ? AND IdSucursal = ?',
            [fecha, idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                transaccionesnitido.Id,
                CASE 
                    WHEN detallepedidos.CodUnidad IS NOT NULL AND detallepedidos.CodUnidad <> '' 
                    THEN detallepedidos.CodUnidad
                    ELSE detallepedidos.Codigo
                END AS CodigoFinal,
                CASE 
                    WHEN detallepedidos.CodUnidad IS NOT NULL AND detallepedidos.CodUnidad <> ''
                    THEN detallepedidos.DescUnidad
                    ELSE detallepedidos.Descripcion
                END AS Descripcion,
                CASE
                    WHEN detallepedidos.CodUnidad IS NOT NULL AND detallepedidos.CodUnidad <> '' 
                    THEN detalletransaccionesnitido.Cantidad * detallepedidos.Unidades
                    ELSE detalletransaccionesnitido.Cantidad
                END AS CantidadFinal,
                transaccionesnitido.Fecha,
                CASE 
                    WHEN detallepedidos.CodUnidad IS NOT NULL AND detallepedidos.CodUnidad <> ''
                    THEN detalletransaccionesnitido.CostoUnitario / detallepedidos.Unidades
                    ELSE detalletransaccionesnitido.CostoUnitario
                END AS Costo,
                CASE 
                    WHEN detallepedidos.CodUnidad IS NOT NULL AND detallepedidos.CodUnidad <> ''
                    THEN detalletransaccionesnitido.PrecioUnitario / detallepedidos.Unidades
                    ELSE detalletransaccionesnitido.PrecioUnitario
                END AS Precio,
                transaccionesnitido.NIT,
                transaccionesnitido.NombreCliente,
                transaccionesnitido.DireccionCliente,
                transaccionesnitido.NoDocumento,
                transaccionesnitido.Serie,
                transaccionesnitido.UUID
            FROM
                transaccionesnitido
            INNER JOIN
                detalletransaccionesnitido
                ON transaccionesnitido.Id = detalletransaccionesnitido.Idtransacciones
            INNER JOIN
                detallepedidos
                ON detalletransaccionesnitido.Upc = detallepedidos.Codigo
                AND detallepedidos.IdPedidos = transaccionesnitido.IdUpdate
            WHERE
                transaccionesnitido.Fecha = ? AND
                transaccionesnitido.Estado = 1`,
            [fecha]
        );
        
        if (datosRemoto.length > 0) {
            const insertQuery = `
                INSERT INTO ventassurtimayoreo 
                (IdTransaccion, Upc, Descripcion, Cantidad, Fecha, Costo, Precio, NIT, NombreCliente, NoDocumento, Serie, UUID, IdSucursal, NombreSucursal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            let insertados = 0;
            for (const registro of datosRemoto) {
                try {
                    await connLocal.query(insertQuery, [
                        registro.Id,
                        registro.CodigoFinal,
                        registro.Descripcion,
                        registro.CantidadFinal,
                        registro.Fecha,
                        registro.Costo,
                        registro.Precio,
                        registro.NIT,
                        registro.NombreCliente,
                        registro.NoDocumento,
                        registro.Serie,
                        registro.UUID,
                        idSucursal,
                        sucursal.NombreSucursal
                    ]);
                    insertados++;
                } catch (error) {
                    console.error(`  ✗ Error insertando registro:`, error.message);
                }
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        hideLoading();
        
        await showSuccess(`Resincronización completada. ${datosRemoto.length} registros sincronizados.`);
        
        await verificarSucursalSurtiMayoreo(sucursal, fecha, fecha);
        mostrarResultadosSurtiMayoreo();
        
    } catch (error) {
        hideLoading();
        console.error('Error al resincronizar SurtiMayoreo:', error);
        showError('Error al resincronizar: ' + error.message);
    }
}

async function sincronizarTodasLasDiferenciasSurtiMayoreo() {
    try {
        const diferenciasParaSincronizar = [];
        
        resultadosVerificacionSurtiMayoreo.forEach(resultado => {
            if (!resultado.errorConexion && resultado.diferencias.length > 0) {
                resultado.diferencias.forEach(dif => {
                    if (!dif.error && dif.diferencia !== 0) {
                        diferenciasParaSincronizar.push({
                            idSucursal: resultado.idSucursal,
                            nombreSucursal: resultado.nombreSucursal,
                            fecha: dif.fecha,
                            cantidadLocal: dif.cantidadLocal,
                            cantidadSucursal: dif.cantidadSucursal,
                            diferencia: dif.diferencia
                        });
                    }
                });
            }
        });
        
        if (diferenciasParaSincronizar.length === 0) {
            showWarning('No hay diferencias para sincronizar');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas sincronizar todas las diferencias encontradas?\n\nTotal: ${diferenciasParaSincronizar.length} registros con diferencias\nSucursales afectadas: ${new Set(diferenciasParaSincronizar.map(d => d.idSucursal)).size}`,
            'Confirmar Sincronización Masiva'
        );
        
        if (!confirmar) return;
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-surtimayoreo');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = true;
        }
        
        showLoading('Sincronizando todas las diferencias...');
        
        let sincronizados = 0;
        let errores = 0;
        
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < diferenciasParaSincronizar.length; i += BATCH_SIZE) {
            const lote = diferenciasParaSincronizar.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(diferenciasParaSincronizar.length / BATCH_SIZE);
            
            const promesas = lote.map(async (item) => {
                try {
                    await sincronizarDiferenciaIndividualSurtiMayoreo(item);
                    sincronizados++;
                } catch (error) {
                    errores++;
                    console.error(`  ✗ ${item.nombreSucursal} - ${item.fecha}:`, error.message);
                }
            });
            
            await Promise.all(promesas);
            
            Swal.update({
                title: 'Sincronizando...',
                html: `
                    <div style="text-align: center;">
                        <p>Procesando lote ${loteNumero} de ${totalLotes}</p>
                        <p style="margin-top: 10px;">
                            <strong style="color: #28a745;">Sincronizados: ${sincronizados}</strong> | 
                            <strong style="color: #dc3545;">Errores: ${errores}</strong>
                        </p>
                    </div>
                `
            });
        }
        
        hideLoading();
        
        if (errores === 0) {
            showSuccess(`¡Sincronización completada!\n\n${sincronizados} diferencias sincronizadas correctamente.`);
        } else {
            showWarning(`Sincronización completada con algunos errores.\n\nSincronizados: ${sincronizados}\nErrores: ${errores}`);
        }
        
        await verificarVentasSurtiMayoreo();
        
    } catch (error) {
        hideLoading();
        console.error('Error en sincronización masiva SurtiMayoreo:', error);
        showError('Error en sincronización masiva: ' + error.message);
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-surtimayoreo');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = false;
        }
    }
}

async function sincronizarDiferenciaIndividualSurtiMayoreo(item) {
    try {
        const sucursal = sucursalesSurtiMayoreo.find(s => s.idSucursal == item.idSucursal);
        
        if (!sucursal) {
            throw new Error('No se encontró la información de la sucursal');
        }
        
        const connLocal = await mysql.createConnection(configLocal);
        
        await connLocal.query(
            'DELETE FROM ventassurtimayoreo WHERE Fecha = ? AND IdSucursal = ?',
            [item.fecha, item.idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                transaccionesnitido.Id,
                CASE 
                    WHEN detallepedidos.CodUnidad IS NOT NULL AND detallepedidos.CodUnidad <> '' 
                    THEN detallepedidos.CodUnidad
                    ELSE detallepedidos.Codigo
                END AS CodigoFinal,
                CASE 
                    WHEN detallepedidos.CodUnidad IS NOT NULL AND detallepedidos.CodUnidad <> ''
                    THEN detallepedidos.DescUnidad
                    ELSE detallepedidos.Descripcion
                END AS Descripcion,
                CASE
                    WHEN detallepedidos.CodUnidad IS NOT NULL AND detallepedidos.CodUnidad <> '' 
                    THEN detalletransaccionesnitido.Cantidad * detallepedidos.Unidades
                    ELSE detalletransaccionesnitido.Cantidad
                END AS CantidadFinal,
                transaccionesnitido.Fecha,
                CASE 
                    WHEN detallepedidos.CodUnidad IS NOT NULL AND detallepedidos.CodUnidad <> ''
                    THEN detalletransaccionesnitido.CostoUnitario / detallepedidos.Unidades
                    ELSE detalletransaccionesnitido.CostoUnitario
                END AS Costo,
                CASE 
                    WHEN detallepedidos.CodUnidad IS NOT NULL AND detallepedidos.CodUnidad <> ''
                    THEN detalletransaccionesnitido.PrecioUnitario / detallepedidos.Unidades
                    ELSE detalletransaccionesnitido.PrecioUnitario
                END AS Precio,
                transaccionesnitido.NIT,
                transaccionesnitido.NombreCliente,
                transaccionesnitido.DireccionCliente,
                transaccionesnitido.NoDocumento,
                transaccionesnitido.Serie,
                transaccionesnitido.UUID
            FROM
                transaccionesnitido
            INNER JOIN
                detalletransaccionesnitido
                ON transaccionesnitido.Id = detalletransaccionesnitido.Idtransacciones
            INNER JOIN
                detallepedidos
                ON detalletransaccionesnitido.Upc = detallepedidos.Codigo
                AND detallepedidos.IdPedidos = transaccionesnitido.IdUpdate
            WHERE
                transaccionesnitido.Fecha = ? AND
                transaccionesnitido.Estado = 1`,
            [item.fecha]
        );
        
        if (datosRemoto.length > 0) {
            const insertQuery = `
                INSERT INTO ventassurtimayoreo 
                (IdTransaccion, Upc, Descripcion, Cantidad, Fecha, Costo, Precio, NIT, NombreCliente, NoDocumento, Serie, UUID, IdSucursal, NombreSucursal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            for (const registro of datosRemoto) {
                await connLocal.query(insertQuery, [
                    registro.Id,
                    registro.CodigoFinal,
                    registro.Descripcion,
                    registro.CantidadFinal,
                    registro.Fecha,
                    registro.Costo,
                    registro.Precio,
                    registro.NIT,
                    registro.NombreCliente,
                    registro.NoDocumento,
                    registro.Serie,
                    registro.UUID,
                    item.idSucursal,
                    item.nombreSucursal
                ]);
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
    } catch (error) {
        throw error;
    }
}

async function exportarResultadosSurtiMayoreo() {
    try {
        const datosExportar = [];
        
        resultadosVerificacionSurtiMayoreo.forEach(resultado => {
            resultado.diferencias.forEach(dif => {
                datosExportar.push({
                    'ID Sucursal': resultado.idSucursal,
                    'Sucursal': resultado.nombreSucursal,
                    'Fecha': dif.fecha,
                    'Cantidad Local': dif.cantidadLocal,
                    'Cantidad Sucursal': dif.cantidadSucursal,
                    'Diferencia': dif.diferencia,
                    'Observación': dif.error || (dif.diferencia === 0 ? 'OK' : 'Diferencia encontrada')
                });
            });
        });
        
        if (datosExportar.length === 0) {
            showWarning('No hay diferencias para exportar');
            return;
        }
        
    } catch (error) {
        console.error('Error al exportar:', error);
        showError('Error al exportar: ' + error.message);
    }
}

// Hacer funciones globales
window.resincronizarFechaSurtiMayoreo = resincronizarFechaSurtiMayoreo;
window.sincronizarTodasLasDiferenciasSurtiMayoreo = sincronizarTodasLasDiferenciasSurtiMayoreo;
// ========== VENTAS BODEGONA ANTIGUA ==========
let sucursalesBodegonaAntigua = [];
let resultadosVerificacionBodegonaAntigua = [];

async function initVentasBodegonaAntigua() {
    try {
        await cargarSucursalesBodegonaAntigua();
        
        const btnVerificar = document.getElementById('btn-verificar-bodegona');
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-bodegona');
        const btnExportar = document.getElementById('btn-exportar-bodegona');
        
        if (btnVerificar) {
            btnVerificar.addEventListener('click', verificarVentasBodegonaAntigua);
        }
        
        if (btnSincronizarTodas) {
            btnSincronizarTodas.addEventListener('click', sincronizarTodasLasDiferenciasBodegonaAntigua);
        }
        
        if (btnExportar) {
            btnExportar.addEventListener('click', exportarResultadosBodegonaAntigua);
        }
        
    } catch (error) {
        console.error('Error al inicializar Ventas Bodegona Antigua:', error);
        showError('Error al inicializar la sección: ' + error.message);
    }
}

async function cargarSucursalesBodegonaAntigua() {
    try {
        showLoading('Cargando sucursales Bodegona Antigua...');
        
        const connection = await odbc.connect(conexiondbsucursal);
        
        const query = `
            SELECT
                idSucursal, 
                NombreSucursal, 
                serverr, 
                databasee, 
                Uid, 
                Pwd,
                Puerto
            FROM
                sucursales
            WHERE
                RazonSocial = 1 AND
                Activo = 1
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        sucursalesBodegonaAntigua = result;
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error al cargar sucursales Bodegona Antigua:', error);
        throw error;
    }
}

async function verificarVentasBodegonaAntigua() {
    try {
        const fechaInicio = document.getElementById('fecha-inicio-bodegona').value;
        const fechaFin = document.getElementById('fecha-fin-bodegona').value;
        
        if (!fechaInicio || !fechaFin) {
            showWarning('Por favor selecciona ambas fechas');
            return;
        }
        
        if (new Date(fechaInicio) > new Date(fechaFin)) {
            showWarning('La fecha de inicio no puede ser mayor a la fecha fin');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas verificar las ventas Bodegona Antigua desde ${fechaInicio} hasta ${fechaFin}?`,
            'Confirmar Verificación'
        );
        
        if (!confirmar) return;
        
        // Resetear resultados
        resultadosVerificacionBodegonaAntigua = [];
        
        // Ocultar botón de sincronizar mientras verifica
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-bodegona');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.style.display = 'none';
            btnSincronizarTodas.disabled = true;
        }
        
        // Mostrar tabla inicial
        mostrarTablaEnProgresoBodegonaAntigua();
        
        // Procesar sucursales en lotes de 5
        const BATCH_SIZE = 5;
        const totalSucursales = sucursalesBodegonaAntigua.length;
        
        for (let i = 0; i < totalSucursales; i += BATCH_SIZE) {
            const lote = sucursalesBodegonaAntigua.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(totalSucursales / BATCH_SIZE);
            
            const promesas = lote.map((sucursal, index) => {
                const globalIndex = i + index + 1;
                return verificarSucursalBodegonaAntigua(sucursal, fechaInicio, fechaFin);
            });
            
            await Promise.all(promesas);
            mostrarResultadosBodegonaAntigua();
        }
        
        const hayDiferencias = resultadosVerificacionBodegonaAntigua.some(r => r.diferencias.length > 0);
        
        if (btnSincronizarTodas && hayDiferencias) {
            btnSincronizarTodas.style.display = 'inline-flex';
            btnSincronizarTodas.disabled = false;
        }
        
        showSuccess(`Verificación completada. ${sucursalesBodegonaAntigua.length} sucursales verificadas.`);
        
    } catch (error) {
        console.error('Error al verificar ventas Bodegona Antigua:', error);
        showError('Error al verificar ventas: ' + error.message);
    }
}

function mostrarTablaEnProgresoBodegonaAntigua() {
    const container = document.getElementById('container-sucursales-bodegona');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    html += '<tr>';
    html += '<td colspan="7" class="text-center" style="padding: 40px;">';
    html += '<div class="loading-spinner"></div> Verificando sucursales...';
    html += '</td>';
    html += '</tr>';
    html += '</tbody>';
    html += '</table>';
    
    container.innerHTML = html;
}

async function verificarSucursalBodegonaAntigua(sucursal, fechaInicio, fechaFin) {
    try {
        const diferencias = [];
        
        const fechas = generarRangoFechas(fechaInicio, fechaFin);
        
        const connLocal = await mysql.createConnection(configLocal);
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        let connRemoto;
        try {
            connRemoto = await mysql.createConnection(configRemoto);
        } catch (error) {
            console.error(`  ✗ Error conectando a sucursal ${sucursal.NombreSucursal}:`, error.message);
            
            fechas.forEach(fecha => {
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: 'Error de conexión a sucursal'
                });
            });
            
            await connLocal.end();
            
            resultadosVerificacionBodegonaAntigua.push({
                idSucursal: sucursal.idSucursal,
                nombreSucursal: sucursal.NombreSucursal,
                diferencias: diferencias,
                errorConexion: true
            });
            
            return;
        }
        
        for (const fecha of fechas) {
            try {
                // Consultar local - tabla ventasbodegonaantigua
                const [rowsLocal] = await connLocal.query(
                    'SELECT COUNT(*) as total FROM ventasbodegonaantigua WHERE Fecha = ? AND IdSucursal = ?',
                    [fecha, sucursal.idSucursal]
                );
                
                const cantidadLocal = rowsLocal[0].total;
                
                // Consultar remoto - misma query que Megared
                const [rowsRemoto] = await connRemoto.query(
                    `SELECT COUNT(*) as total FROM transaccionesnitido 
                     INNER JOIN detalletransaccionesnitido 
                     ON transaccionesnitido.Id = detalletransaccionesnitido.Idtransacciones 
                     AND transaccionesnitido.IdCajas = detalletransaccionesnitido.IdCajas
                     WHERE transaccionesnitido.Fecha = ? 
                     AND transaccionesnitido.Estado = 1`,
                    [fecha]
                );
                
                const cantidadSucursal = rowsRemoto[0].total;
                
                if (cantidadLocal !== cantidadSucursal) {
                    diferencias.push({
                        fecha: fecha,
                        cantidadLocal: cantidadLocal,
                        cantidadSucursal: cantidadSucursal,
                        diferencia: cantidadSucursal - cantidadLocal
                    });
                }
                
            } catch (error) {
                console.error(`  ✗ Error verificando fecha ${fecha}:`, error.message);
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: error.message
                });
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        resultadosVerificacionBodegonaAntigua.push({
            idSucursal: sucursal.idSucursal,
            nombreSucursal: sucursal.NombreSucursal,
            diferencias: diferencias,
            errorConexion: false
        });
        
    } catch (error) {
        console.error(`Error general en sucursal ${sucursal.NombreSucursal}:`, error);
        throw error;
    }
}

function mostrarResultadosBodegonaAntigua() {
    const container = document.getElementById('container-sucursales-bodegona');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    
    let totalDiferencias = 0;
    let sucursalesConDiferencias = 0;
    let sucursalesSinDiferencias = 0;
    
    resultadosVerificacionBodegonaAntigua.forEach(resultado => {
        if (resultado.errorConexion) {
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-building"></i> ${resultado.nombreSucursal} - <span class="status-badge status-error"><i class="fas fa-exclamation-triangle"></i> Error de Conexión</span></td>`;
            html += '</tr>';
        } else if (resultado.diferencias.length > 0) {
            sucursalesConDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-building"></i> ${resultado.nombreSucursal} <span class="status-badge status-warning" style="margin-left: 10px;">${resultado.diferencias.length} diferencia(s)</span></td>`;
            html += '</tr>';
            
            resultado.diferencias.forEach(dif => {
                totalDiferencias++;
                
                html += '<tr class="fecha-row">';
                html += `<td></td>`;
                html += `<td>${formatearFecha(dif.fecha)}</td>`;
                html += `<td class="text-center">${dif.cantidadLocal}</td>`;
                html += `<td class="text-center">${dif.cantidadSucursal}</td>`;
                
                if (dif.error) {
                    html += `<td class="text-center">-</td>`;
                    html += `<td class="text-center"><span class="status-badge status-error"><i class="fas fa-times"></i> Error</span></td>`;
                    html += `<td class="text-center">-</td>`;
                } else {
                    const difNum = dif.diferencia;
                    const colorDif = difNum > 0 ? 'style="color: #28a745;"' : 'style="color: #dc3545;"';
                    html += `<td class="text-center" ${colorDif}><strong>${difNum > 0 ? '+' : ''}${difNum}</strong></td>`;
                    
                    if (difNum !== 0) {
                        html += `<td class="text-center"><span class="status-badge status-warning"><i class="fas fa-exclamation-circle"></i> Diferencia</span></td>`;
                        html += `<td class="text-center">`;
                        html += `<button class="btn-resync" onclick="resincronizarFechaBodegonaAntigua('${resultado.idSucursal}', '${dif.fecha}')">`;
                        html += `<i class="fas fa-sync"></i> Resincronizar`;
                        html += `</button>`;
                        html += `</td>`;
                    } else {
                        html += `<td class="text-center"><span class="status-badge status-ok"><i class="fas fa-check"></i> OK</span></td>`;
                        html += `<td class="text-center">-</td>`;
                    }
                }
                
                html += '</tr>';
            });
        } else {
            sucursalesSinDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-building"></i> ${resultado.nombreSucursal} <span class="status-badge status-ok" style="margin-left: 10px;"><i class="fas fa-check-circle"></i> Sin Diferencias</span></td>`;
            html += '</tr>';
        }
    });
    
    html += '</tbody>';
    html += '</table>';
    
    if (resultadosVerificacionBodegonaAntigua.length > 0) {
        html += '<div style="margin-top: 20px; padding: 15px; background: rgba(0, 212, 255, 0.05); border-radius: 8px; display: flex; gap: 20px; flex-wrap: wrap;">';
        html += `<div><strong>Total Sucursales:</strong> ${resultadosVerificacionBodegonaAntigua.length}</div>`;
        html += `<div style="color: #28a745;"><strong>Sin Diferencias:</strong> ${sucursalesSinDiferencias}</div>`;
        html += `<div style="color: #ffc107;"><strong>Con Diferencias:</strong> ${sucursalesConDiferencias}</div>`;
        html += `<div style="color: #dc3545;"><strong>Total Diferencias:</strong> ${totalDiferencias}</div>`;
        html += '</div>';
    }
    
    container.innerHTML = html;
}

async function resincronizarFechaBodegonaAntigua(idSucursal, fecha) {
    try {
        const sucursal = sucursalesBodegonaAntigua.find(s => s.idSucursal == idSucursal);
        
        if (!sucursal) {
            showError('No se encontró la información de la sucursal');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas resincronizar los datos de ${sucursal.NombreSucursal} para la fecha ${formatearFecha(fecha)}?`,
            'Confirmar Resincronización'
        );
        
        if (!confirmar) return;
        
        showLoading('Resincronizando datos...');
        
        const connLocal = await mysql.createConnection(configLocal);
        
        // Eliminar datos locales de la tabla ventasbodegonaantigua
        await connLocal.query(
            'DELETE FROM ventasbodegonaantigua WHERE Fecha = ? AND IdSucursal = ?',
            [fecha, idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        // Obtener datos de la sucursal - misma query que Megared
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                transaccionesnitido.Id, 
                transaccionesnitido.IdCajas, 
                detalletransaccionesnitido.Upc, 
                productos.DescLarga, 
                detalletransaccionesnitido.Cantidad, 
                detalletransaccionesnitido.CostoUnitario, 
                detalletransaccionesnitido.PrecioUnitario, 
                transaccionesnitido.Fecha, 
                transaccionesnitido.NIT, 
                transaccionesnitido.NombreCliente,
                transaccionesnitido.Serie, 
                transaccionesnitido.NoDocumento, 
                transaccionesnitido.UUID,
                detalletransaccionesnitido.DescCorta,
                detalletransaccionesnitido.Total
            FROM
                transaccionesnitido
                INNER JOIN
                detalletransaccionesnitido
                ON 
                    transaccionesnitido.Id = detalletransaccionesnitido.Idtransacciones AND
                    transaccionesnitido.IdCajas = detalletransaccionesnitido.IdCajas
                LEFT JOIN
                productos
                ON 
                    detalletransaccionesnitido.Upc = productos.Upc
            WHERE
                transaccionesnitido.Fecha = ? AND
                transaccionesnitido.Estado = 1`,
            [fecha]
        );
        
        // Insertar en ventasbodegonaantigua
        if (datosRemoto.length > 0) {
            const insertQuery = `
                INSERT INTO ventasbodegonaantigua 
                (IdTransaccion, IdCaja, Upc, Descripcion, DescCorta, Cantidad, CostoUnitario, 
                 PrecioUnitario, Fecha, NIT, NombreCliente, Serie, NoDocumento, UUID, IdSucursal, NombreSucursal, Total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            let insertados = 0;
            for (const registro of datosRemoto) {
                try {
                    await connLocal.query(insertQuery, [
                        registro.Id,
                        registro.IdCajas,
                        registro.Upc,
                        registro.DescLarga,
                        registro.DescCorta,
                        registro.Cantidad,
                        registro.CostoUnitario,
                        registro.PrecioUnitario,
                        registro.Fecha,
                        registro.NIT,
                        registro.NombreCliente,
                        registro.Serie,
                        registro.NoDocumento,
                        registro.UUID,
                        idSucursal,
                        sucursal.NombreSucursal,
                        registro.Total
                    ]);
                    insertados++;
                } catch (error) {
                    console.error(`  ✗ Error insertando registro:`, error.message);
                }
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        hideLoading();
        
        await showSuccess(`Resincronización completada. ${datosRemoto.length} registros sincronizados.`);
        
        await verificarSucursalBodegonaAntigua(sucursal, fecha, fecha);
        mostrarResultadosBodegonaAntigua();
        
    } catch (error) {
        hideLoading();
        console.error('Error al resincronizar Bodegona Antigua:', error);
        showError('Error al resincronizar: ' + error.message);
    }
}

async function sincronizarTodasLasDiferenciasBodegonaAntigua() {
    try {
        const diferenciasParaSincronizar = [];
        
        resultadosVerificacionBodegonaAntigua.forEach(resultado => {
            if (!resultado.errorConexion && resultado.diferencias.length > 0) {
                resultado.diferencias.forEach(dif => {
                    if (!dif.error && dif.diferencia !== 0) {
                        diferenciasParaSincronizar.push({
                            idSucursal: resultado.idSucursal,
                            nombreSucursal: resultado.nombreSucursal,
                            fecha: dif.fecha,
                            cantidadLocal: dif.cantidadLocal,
                            cantidadSucursal: dif.cantidadSucursal,
                            diferencia: dif.diferencia
                        });
                    }
                });
            }
        });
        
        if (diferenciasParaSincronizar.length === 0) {
            showWarning('No hay diferencias para sincronizar');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas sincronizar todas las diferencias encontradas?\n\nTotal: ${diferenciasParaSincronizar.length} registros con diferencias\nSucursales afectadas: ${new Set(diferenciasParaSincronizar.map(d => d.idSucursal)).size}`,
            'Confirmar Sincronización Masiva'
        );
        
        if (!confirmar) return;
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-bodegona');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = true;
        }
        
        showLoading('Sincronizando todas las diferencias...');
        
        let sincronizados = 0;
        let errores = 0;
        
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < diferenciasParaSincronizar.length; i += BATCH_SIZE) {
            const lote = diferenciasParaSincronizar.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(diferenciasParaSincronizar.length / BATCH_SIZE);
            
            const promesas = lote.map(async (item) => {
                try {
                    await sincronizarDiferenciaIndividualBodegonaAntigua(item);
                    sincronizados++;
                } catch (error) {
                    errores++;
                    console.error(`  ✗ ${item.nombreSucursal} - ${item.fecha}:`, error.message);
                }
            });
            
            await Promise.all(promesas);
            
            Swal.update({
                title: 'Sincronizando...',
                html: `
                    <div style="text-align: center;">
                        <p>Procesando lote ${loteNumero} de ${totalLotes}</p>
                        <p style="margin-top: 10px;">
                            <strong style="color: #28a745;">Sincronizados: ${sincronizados}</strong> | 
                            <strong style="color: #dc3545;">Errores: ${errores}</strong>
                        </p>
                    </div>
                `
            });
        }
        
        hideLoading();
        
        if (errores === 0) {
            showSuccess(`¡Sincronización completada!\n\n${sincronizados} diferencias sincronizadas correctamente.`);
        } else {
            showWarning(`Sincronización completada con algunos errores.\n\nSincronizados: ${sincronizados}\nErrores: ${errores}`);
        }
        
        await verificarVentasBodegonaAntigua();
        
    } catch (error) {
        hideLoading();
        console.error('Error en sincronización masiva Bodegona Antigua:', error);
        showError('Error en sincronización masiva: ' + error.message);
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-bodegona');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = false;
        }
    }
}

async function sincronizarDiferenciaIndividualBodegonaAntigua(item) {
    try {
        const sucursal = sucursalesBodegonaAntigua.find(s => s.idSucursal == item.idSucursal);
        
        if (!sucursal) {
            throw new Error('No se encontró la información de la sucursal');
        }
        
        const connLocal = await mysql.createConnection(configLocal);
        
        await connLocal.query(
            'DELETE FROM ventasbodegonaantigua WHERE Fecha = ? AND IdSucursal = ?',
            [item.fecha, item.idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                transaccionesnitido.Id, 
                transaccionesnitido.IdCajas, 
                detalletransaccionesnitido.Upc, 
                productos.DescLarga, 
                detalletransaccionesnitido.Cantidad, 
                detalletransaccionesnitido.CostoUnitario, 
                detalletransaccionesnitido.PrecioUnitario, 
                transaccionesnitido.Fecha, 
                transaccionesnitido.NIT, 
                transaccionesnitido.NombreCliente,
                transaccionesnitido.Serie, 
                transaccionesnitido.NoDocumento, 
                transaccionesnitido.UUID,
                detalletransaccionesnitido.DescCorta,
                detalletransaccionesnitido.Total
            FROM
                transaccionesnitido
                INNER JOIN
                detalletransaccionesnitido
                ON 
                    transaccionesnitido.Id = detalletransaccionesnitido.Idtransacciones AND
                    transaccionesnitido.IdCajas = detalletransaccionesnitido.IdCajas
                LEFT JOIN
                productos
                ON 
                    detalletransaccionesnitido.Upc = productos.Upc
            WHERE
                transaccionesnitido.Fecha = ? AND
                transaccionesnitido.Estado = 1`,
            [item.fecha]
        );
        
        if (datosRemoto.length > 0) {
            const insertQuery = `
                INSERT INTO ventasbodegonaantigua 
                (IdTransaccion, IdCaja, Upc, Descripcion, DescCorta, Cantidad, CostoUnitario, 
                 PrecioUnitario, Fecha, NIT, NombreCliente, Serie, NoDocumento, UUID, IdSucursal, NombreSucursal, Total)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            for (const registro of datosRemoto) {
                await connLocal.query(insertQuery, [
                    registro.Id,
                    registro.IdCajas,
                    registro.Upc,
                    registro.DescLarga,
                    registro.DescCorta,
                    registro.Cantidad,
                    registro.CostoUnitario,
                    registro.PrecioUnitario,
                    registro.Fecha,
                    registro.NIT,
                    registro.NombreCliente,
                    registro.Serie,
                    registro.NoDocumento,
                    registro.UUID,
                    item.idSucursal,
                    item.nombreSucursal,
                    registro.Total
                ]);
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
    } catch (error) {
        throw error;
    }
}

async function exportarResultadosBodegonaAntigua() {
    try {
        const datosExportar = [];
        
        resultadosVerificacionBodegonaAntigua.forEach(resultado => {
            resultado.diferencias.forEach(dif => {
                datosExportar.push({
                    'ID Sucursal': resultado.idSucursal,
                    'Sucursal': resultado.nombreSucursal,
                    'Fecha': dif.fecha,
                    'Cantidad Local': dif.cantidadLocal,
                    'Cantidad Sucursal': dif.cantidadSucursal,
                    'Diferencia': dif.diferencia,
                    'Observación': dif.error || (dif.diferencia === 0 ? 'OK' : 'Diferencia encontrada')
                });
            });
        });
        
        if (datosExportar.length === 0) {
            showWarning('No hay diferencias para exportar');
            return;
        }
        
        const fechaActual = new Date().toISOString().split('T')[0];
        await exportarAExcel(
            datosExportar, 
            `Verificacion_Ventas_BodegonaAntigua_${fechaActual}`,
            'Diferencias Ventas'
        );
        
    } catch (error) {
        console.error('Error al exportar:', error);
        showError('Error al exportar: ' + error.message);
    }
}

// Hacer funciones globales
window.resincronizarFechaBodegonaAntigua = resincronizarFechaBodegonaAntigua;
window.sincronizarTodasLasDiferenciasBodegonaAntigua = sincronizarTodasLasDiferenciasBodegonaAntigua;
// ========== NOTAS DE CRÉDITO MEGARED ==========
let resultadosVerificacionNCMegared = [];

async function initNCMegared() {
    try {
        // Reutilizamos las sucursales de Ventas Megared
        if (sucursalesMegared.length === 0) {
            await cargarSucursalesMegared();
        }
        
        const btnVerificar = document.getElementById('btn-verificar-nc-megared');
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-megared');
        const btnExportar = document.getElementById('btn-exportar-nc-megared');
        
        if (btnVerificar) {
            btnVerificar.addEventListener('click', verificarNCMegared);
        }
        
        if (btnSincronizarTodas) {
            btnSincronizarTodas.addEventListener('click', sincronizarTodasLasDiferenciasNCMegared);
        }
        
        if (btnExportar) {
            btnExportar.addEventListener('click', exportarResultadosNCMegared);
        }
        
    } catch (error) {
        console.error('Error al inicializar NC Megared:', error);
        showError('Error al inicializar la sección: ' + error.message);
    }
}

async function verificarNCMegared() {
    try {
        const fechaInicio = document.getElementById('fecha-inicio-nc-megared').value;
        const fechaFin = document.getElementById('fecha-fin-nc-megared').value;
        
        if (!fechaInicio || !fechaFin) {
            showWarning('Por favor selecciona ambas fechas');
            return;
        }
        
        if (new Date(fechaInicio) > new Date(fechaFin)) {
            showWarning('La fecha de inicio no puede ser mayor a la fecha fin');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas verificar las notas de crédito Megared desde ${fechaInicio} hasta ${fechaFin}?`,
            'Confirmar Verificación'
        );
        
        if (!confirmar) return;
        
        resultadosVerificacionNCMegared = [];
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-megared');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.style.display = 'none';
            btnSincronizarTodas.disabled = true;
        }
        
        mostrarTablaEnProgresoNCMegared();
        
        const BATCH_SIZE = 5;
        const totalSucursales = sucursalesMegared.length;
        
        for (let i = 0; i < totalSucursales; i += BATCH_SIZE) {
            const lote = sucursalesMegared.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(totalSucursales / BATCH_SIZE);
            
            const promesas = lote.map((sucursal, index) => {
                const globalIndex = i + index + 1;
                return verificarSucursalNCMegared(sucursal, fechaInicio, fechaFin);
            });
            
            await Promise.all(promesas);
            mostrarResultadosNCMegared();
        }
        
        const hayDiferencias = resultadosVerificacionNCMegared.some(r => r.diferencias.length > 0);
        
        if (btnSincronizarTodas && hayDiferencias) {
            btnSincronizarTodas.style.display = 'inline-flex';
            btnSincronizarTodas.disabled = false;
        }
        
        showSuccess(`Verificación completada. ${sucursalesMegared.length} sucursales verificadas.`);
        
    } catch (error) {
        console.error('Error al verificar NC Megared:', error);
        showError('Error al verificar notas de crédito: ' + error.message);
    }
}

function mostrarTablaEnProgresoNCMegared() {
    const container = document.getElementById('container-sucursales-nc-megared');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    html += '<tr>';
    html += '<td colspan="7" class="text-center" style="padding: 40px;">';
    html += '<div class="loading-spinner"></div> Verificando sucursales...';
    html += '</td>';
    html += '</tr>';
    html += '</tbody>';
    html += '</table>';
    
    container.innerHTML = html;
}

async function verificarSucursalNCMegared(sucursal, fechaInicio, fechaFin) {
    try {
        const diferencias = [];
        
        const fechas = generarRangoFechas(fechaInicio, fechaFin);
        
        const connLocal = await mysql.createConnection(configLocal);
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        let connRemoto;
        try {
            connRemoto = await mysql.createConnection(configRemoto);
        } catch (error) {
            console.error(`  ✗ Error conectando a sucursal ${sucursal.NombreSucursal}:`, error.message);
            
            fechas.forEach(fecha => {
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: 'Error de conexión a sucursal'
                });
            });
            
            await connLocal.end();
            
            resultadosVerificacionNCMegared.push({
                idSucursal: sucursal.idSucursal,
                nombreSucursal: sucursal.NombreSucursal,
                diferencias: diferencias,
                errorConexion: true
            });
            
            return;
        }
        
        for (const fecha of fechas) {
            try {
                const [rowsLocal] = await connLocal.query(
                    'SELECT COUNT(*) as total FROM notacreditomegared WHERE Fecha = ? AND IdSucursal = ?',
                    [fecha, sucursal.idSucursal]
                );
                
                const cantidadLocal = rowsLocal[0].total;
                
                const [rowsRemoto] = await connRemoto.query(
                    `SELECT 
                        COUNT(*) AS total
                    FROM
                        notascredito
                    INNER JOIN
                        detallenotascredito
                        ON notascredito.Id = detallenotascredito.Idtransacciones
                    LEFT JOIN 
                        productos
                        ON detallenotascredito.Upc = productos.Upc
                    WHERE
                        notascredito.Fecha = ?
                        AND notascredito.Estado = 1`,
                    [fecha]
                );
                
                const cantidadSucursal = rowsRemoto[0].total;
                
                if (cantidadLocal !== cantidadSucursal) {
                    diferencias.push({
                        fecha: fecha,
                        cantidadLocal: cantidadLocal,
                        cantidadSucursal: cantidadSucursal,
                        diferencia: cantidadSucursal - cantidadLocal
                    });
                }
                
            } catch (error) {
                console.error(`  ✗ Error verificando fecha ${fecha}:`, error.message);
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: error.message
                });
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        resultadosVerificacionNCMegared.push({
            idSucursal: sucursal.idSucursal,
            nombreSucursal: sucursal.NombreSucursal,
            diferencias: diferencias,
            errorConexion: false
        });
        
    } catch (error) {
        console.error(`Error general en sucursal ${sucursal.NombreSucursal}:`, error);
        throw error;
    }
}

function mostrarResultadosNCMegared() {
    const container = document.getElementById('container-sucursales-nc-megared');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    
    let totalDiferencias = 0;
    let sucursalesConDiferencias = 0;
    let sucursalesSinDiferencias = 0;
    
    resultadosVerificacionNCMegared.forEach(resultado => {
        if (resultado.errorConexion) {
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-receipt"></i> ${resultado.nombreSucursal} - <span class="status-badge status-error"><i class="fas fa-exclamation-triangle"></i> Error de Conexión</span></td>`;
            html += '</tr>';
        } else if (resultado.diferencias.length > 0) {
            sucursalesConDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-receipt"></i> ${resultado.nombreSucursal} <span class="status-badge status-warning" style="margin-left: 10px;">${resultado.diferencias.length} diferencia(s)</span></td>`;
            html += '</tr>';
            
            resultado.diferencias.forEach(dif => {
                totalDiferencias++;
                
                html += '<tr class="fecha-row">';
                html += `<td></td>`;
                html += `<td>${formatearFecha(dif.fecha)}</td>`;
                html += `<td class="text-center">${dif.cantidadLocal}</td>`;
                html += `<td class="text-center">${dif.cantidadSucursal}</td>`;
                
                if (dif.error) {
                    html += `<td class="text-center">-</td>`;
                    html += `<td class="text-center"><span class="status-badge status-error"><i class="fas fa-times"></i> Error</span></td>`;
                    html += `<td class="text-center">-</td>`;
                } else {
                    const difNum = dif.diferencia;
                    const colorDif = difNum > 0 ? 'style="color: #28a745;"' : 'style="color: #dc3545;"';
                    html += `<td class="text-center" ${colorDif}><strong>${difNum > 0 ? '+' : ''}${difNum}</strong></td>`;
                    
                    if (difNum !== 0) {
                        html += `<td class="text-center"><span class="status-badge status-warning"><i class="fas fa-exclamation-circle"></i> Diferencia</span></td>`;
                        html += `<td class="text-center">`;
                        html += `<button class="btn-resync" onclick="resincronizarFechaNCMegared('${resultado.idSucursal}', '${dif.fecha}')">`;
                        html += `<i class="fas fa-sync"></i> Resincronizar`;
                        html += `</button>`;
                        html += `</td>`;
                    } else {
                        html += `<td class="text-center"><span class="status-badge status-ok"><i class="fas fa-check"></i> OK</span></td>`;
                        html += `<td class="text-center">-</td>`;
                    }
                }
                
                html += '</tr>';
            });
        } else {
            sucursalesSinDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-receipt"></i> ${resultado.nombreSucursal} <span class="status-badge status-ok" style="margin-left: 10px;"><i class="fas fa-check-circle"></i> Sin Diferencias</span></td>`;
            html += '</tr>';
        }
    });
    
    html += '</tbody>';
    html += '</table>';
    
    if (resultadosVerificacionNCMegared.length > 0) {
        html += '<div style="margin-top: 20px; padding: 15px; background: rgba(0, 212, 255, 0.05); border-radius: 8px; display: flex; gap: 20px; flex-wrap: wrap;">';
        html += `<div><strong>Total Sucursales:</strong> ${resultadosVerificacionNCMegared.length}</div>`;
        html += `<div style="color: #28a745;"><strong>Sin Diferencias:</strong> ${sucursalesSinDiferencias}</div>`;
        html += `<div style="color: #ffc107;"><strong>Con Diferencias:</strong> ${sucursalesConDiferencias}</div>`;
        html += `<div style="color: #dc3545;"><strong>Total Diferencias:</strong> ${totalDiferencias}</div>`;
        html += '</div>';
    }
    
    container.innerHTML = html;
}

async function resincronizarFechaNCMegared(idSucursal, fecha) {
    try {
        const sucursal = sucursalesMegared.find(s => s.idSucursal == idSucursal);
        
        if (!sucursal) {
            showError('No se encontró la información de la sucursal');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas resincronizar las notas de crédito de ${sucursal.NombreSucursal} para la fecha ${formatearFecha(fecha)}?`,
            'Confirmar Resincronización'
        );
        
        if (!confirmar) return;
        
        showLoading('Resincronizando datos...');
        
        const connLocal = await mysql.createConnection(configLocal);
        
        await connLocal.query(
            'DELETE FROM notacreditomegared WHERE Fecha = ? AND IdSucursal = ?',
            [fecha, idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                notascredito.Id,
                notascredito.IdCajas, 
                detallenotascredito.Upc, 
                productos.DescLarga, 
                detallenotascredito.DescCorta,
                detallenotascredito.CostoUnitario, 
                detallenotascredito.PrecioUnitario, 
                detallenotascredito.Cantidad, 
                notascredito.Fecha, 
                notascredito.NIT, 
                notascredito.NombreCliente,
                notascredito.Serie, 
                notascredito.NoDocumento, 
                notascredito.UUID
            FROM
                notascredito
                INNER JOIN
                detallenotascredito
                ON 
                    notascredito.Id = detallenotascredito.Idtransacciones
                LEFT JOIN
                productos
                ON 
                    detallenotascredito.Upc = productos.Upc
            WHERE
                notascredito.Fecha = ? AND
                notascredito.Estado = 1`,
            [fecha]
        );
        
        if (datosRemoto.length > 0) {
            const insertQuery = `
                INSERT INTO notacreditomegared 
                (IdNotaCredito, IdCaja, Upc, Descripcion, DescCorta, Cantidad, CostoUnitario, 
                 PrecioUnitario, Fecha, NIT, NombreCliente, Serie, NoDocumento, UUID, IdSucursal, NombreSucursal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            let insertados = 0;
            for (const registro of datosRemoto) {
                try {
                    await connLocal.query(insertQuery, [
                        registro.Id,
                        registro.IdCajas,
                        registro.Upc,
                        registro.DescLarga,
                        registro.DescCorta,
                        registro.Cantidad,
                        registro.CostoUnitario,
                        registro.PrecioUnitario,
                        registro.Fecha,
                        registro.NIT,
                        registro.NombreCliente,
                        registro.Serie,
                        registro.NoDocumento,
                        registro.UUID,
                        idSucursal,
                        sucursal.NombreSucursal
                    ]);
                    insertados++;
                } catch (error) {
                    console.error(`  ✗ Error insertando registro:`, error.message);
                }
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        hideLoading();
        
        await showSuccess(`Resincronización completada. ${datosRemoto.length} registros sincronizados.`);
        
        await verificarSucursalNCMegared(sucursal, fecha, fecha);
        mostrarResultadosNCMegared();
        
    } catch (error) {
        hideLoading();
        console.error('Error al resincronizar NC Megared:', error);
        showError('Error al resincronizar: ' + error.message);
    }
}

async function sincronizarTodasLasDiferenciasNCMegared() {
    try {
        const diferenciasParaSincronizar = [];
        
        resultadosVerificacionNCMegared.forEach(resultado => {
            if (!resultado.errorConexion && resultado.diferencias.length > 0) {
                resultado.diferencias.forEach(dif => {
                    if (!dif.error && dif.diferencia !== 0) {
                        diferenciasParaSincronizar.push({
                            idSucursal: resultado.idSucursal,
                            nombreSucursal: resultado.nombreSucursal,
                            fecha: dif.fecha,
                            cantidadLocal: dif.cantidadLocal,
                            cantidadSucursal: dif.cantidadSucursal,
                            diferencia: dif.diferencia
                        });
                    }
                });
            }
        });
        
        if (diferenciasParaSincronizar.length === 0) {
            showWarning('No hay diferencias para sincronizar');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas sincronizar todas las diferencias encontradas?\n\nTotal: ${diferenciasParaSincronizar.length} registros con diferencias\nSucursales afectadas: ${new Set(diferenciasParaSincronizar.map(d => d.idSucursal)).size}`,
            'Confirmar Sincronización Masiva'
        );
        
        if (!confirmar) return;
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-megared');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = true;
        }
        
        showLoading('Sincronizando todas las diferencias...');
        
        let sincronizados = 0;
        let errores = 0;
        
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < diferenciasParaSincronizar.length; i += BATCH_SIZE) {
            const lote = diferenciasParaSincronizar.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(diferenciasParaSincronizar.length / BATCH_SIZE);
            
            const promesas = lote.map(async (item) => {
                try {
                    await sincronizarDiferenciaIndividualNCMegared(item);
                    sincronizados++;
                } catch (error) {
                    errores++;
                    console.error(`  ✗ ${item.nombreSucursal} - ${item.fecha}:`, error.message);
                }
            });
            
            await Promise.all(promesas);
            
            Swal.update({
                title: 'Sincronizando...',
                html: `
                    <div style="text-align: center;">
                        <p>Procesando lote ${loteNumero} de ${totalLotes}</p>
                        <p style="margin-top: 10px;">
                            <strong style="color: #28a745;">Sincronizados: ${sincronizados}</strong> | 
                            <strong style="color: #dc3545;">Errores: ${errores}</strong>
                        </p>
                    </div>
                `
            });
        }
        
        hideLoading();
        
        if (errores === 0) {
            showSuccess(`¡Sincronización completada!\n\n${sincronizados} diferencias sincronizadas correctamente.`);
        } else {
            showWarning(`Sincronización completada con algunos errores.\n\nSincronizados: ${sincronizados}\nErrores: ${errores}`);
        }
        
        await verificarNCMegared();
        
    } catch (error) {
        hideLoading();
        console.error('Error en sincronización masiva NC Megared:', error);
        showError('Error en sincronización masiva: ' + error.message);
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-megared');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = false;
        }
    }
}

async function sincronizarDiferenciaIndividualNCMegared(item) {
    try {
        const sucursal = sucursalesMegared.find(s => s.idSucursal == item.idSucursal);
        
        if (!sucursal) {
            throw new Error('No se encontró la información de la sucursal');
        }
        
        const connLocal = await mysql.createConnection(configLocal);
        
        await connLocal.query(
            'DELETE FROM notacreditomegared WHERE Fecha = ? AND IdSucursal = ?',
            [item.fecha, item.idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                notascredito.Id,
                notascredito.IdCajas, 
                detallenotascredito.Upc, 
                productos.DescLarga, 
                detallenotascredito.DescCorta,
                detallenotascredito.CostoUnitario, 
                detallenotascredito.PrecioUnitario, 
                detallenotascredito.Cantidad, 
                notascredito.Fecha, 
                notascredito.NIT, 
                notascredito.NombreCliente,
                notascredito.Serie, 
                notascredito.NoDocumento, 
                notascredito.UUID
            FROM
                notascredito
                INNER JOIN
                detallenotascredito
                ON 
                    notascredito.Id = detallenotascredito.Idtransacciones
                LEFT JOIN
                productos
                ON 
                    detallenotascredito.Upc = productos.Upc
            WHERE
                notascredito.Fecha = ? AND
                notascredito.Estado = 1`,
            [item.fecha]
        );
        
        if (datosRemoto.length > 0) {
            const insertQuery = `
                INSERT INTO notacreditomegared 
                (IdNotaCredito, IdCaja, Upc, Descripcion, DescCorta, Cantidad, CostoUnitario, 
                 PrecioUnitario, Fecha, NIT, NombreCliente, Serie, NoDocumento, UUID, IdSucursal, NombreSucursal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            for (const registro of datosRemoto) {
                await connLocal.query(insertQuery, [
                    registro.Id,
                    registro.IdCajas,
                    registro.Upc,
                    registro.DescLarga,
                    registro.DescCorta,
                    registro.Cantidad,
                    registro.CostoUnitario,
                    registro.PrecioUnitario,
                    registro.Fecha,
                    registro.NIT,
                    registro.NombreCliente,
                    registro.Serie,
                    registro.NoDocumento,
                    registro.UUID,
                    item.idSucursal,
                    item.nombreSucursal
                ]);
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
    } catch (error) {
        throw error;
    }
}

async function exportarResultadosNCMegared() {
    try {
        const datosExportar = [];
        
        resultadosVerificacionNCMegared.forEach(resultado => {
            resultado.diferencias.forEach(dif => {
                datosExportar.push({
                    'ID Sucursal': resultado.idSucursal,
                    'Sucursal': resultado.nombreSucursal,
                    'Fecha': dif.fecha,
                    'Cantidad Local': dif.cantidadLocal,
                    'Cantidad Sucursal': dif.cantidadSucursal,
                    'Diferencia': dif.diferencia,
                    'Observación': dif.error || (dif.diferencia === 0 ? 'OK' : 'Diferencia encontrada')
                });
            });
        });
        
        if (datosExportar.length === 0) {
            showWarning('No hay diferencias para exportar');
            return;
        }
        
        const fechaActual = new Date().toISOString().split('T')[0];
        await exportarAExcel(
            datosExportar, 
            `Verificacion_NC_Megared_${fechaActual}`,
            'Diferencias NC'
        );
        
    } catch (error) {
        console.error('Error al exportar:', error);
        showError('Error al exportar: ' + error.message);
    }
}

// Hacer funciones globales
window.resincronizarFechaNCMegared = resincronizarFechaNCMegared;
window.sincronizarTodasLasDiferenciasNCMegared = sincronizarTodasLasDiferenciasNCMegared;
let resultadosVerificacionNCBodegonaAntigua = [];

async function initNCBodegonaAntigua() {
    try {
        // Reutilizamos las sucursales de Ventas Bodegona Antigua
        if (sucursalesBodegonaAntigua.length === 0) {
            await cargarSucursalesBodegonaAntigua();
        }
        
        const btnVerificar = document.getElementById('btn-verificar-nc-bodegona');
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-bodegona');
        const btnExportar = document.getElementById('btn-exportar-nc-bodegona');
        
        if (btnVerificar) {
            btnVerificar.addEventListener('click', verificarNCBodegonaAntigua);
        }
        
        if (btnSincronizarTodas) {
            btnSincronizarTodas.addEventListener('click', sincronizarTodasLasDiferenciasNCBodegonaAntigua);
        }
        
        if (btnExportar) {
            btnExportar.addEventListener('click', exportarResultadosNCBodegonaAntigua);
        }
        
    } catch (error) {
        console.error('Error al inicializar NC Bodegona Antigua:', error);
        showError('Error al inicializar la sección: ' + error.message);
    }
}

async function verificarNCBodegonaAntigua() {
    try {
        const fechaInicio = document.getElementById('fecha-inicio-nc-bodegona').value;
        const fechaFin = document.getElementById('fecha-fin-nc-bodegona').value;
        
        if (!fechaInicio || !fechaFin) {
            showWarning('Por favor selecciona ambas fechas');
            return;
        }
        
        if (new Date(fechaInicio) > new Date(fechaFin)) {
            showWarning('La fecha de inicio no puede ser mayor a la fecha fin');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas verificar las notas de crédito Bodegona Antigua desde ${fechaInicio} hasta ${fechaFin}?`,
            'Confirmar Verificación'
        );
        
        if (!confirmar) return;
        
        resultadosVerificacionNCBodegonaAntigua = [];
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-bodegona');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.style.display = 'none';
            btnSincronizarTodas.disabled = true;
        }
        
        mostrarTablaEnProgresoNCBodegonaAntigua();
        
        const BATCH_SIZE = 5;
        const totalSucursales = sucursalesBodegonaAntigua.length;
        
        for (let i = 0; i < totalSucursales; i += BATCH_SIZE) {
            const lote = sucursalesBodegonaAntigua.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(totalSucursales / BATCH_SIZE);
            
            const promesas = lote.map((sucursal, index) => {
                const globalIndex = i + index + 1;
                return verificarSucursalNCBodegonaAntigua(sucursal, fechaInicio, fechaFin);
            });
            
            await Promise.all(promesas);
            mostrarResultadosNCBodegonaAntigua();
        }
        
        const hayDiferencias = resultadosVerificacionNCBodegonaAntigua.some(r => r.diferencias.length > 0);
        
        if (btnSincronizarTodas && hayDiferencias) {
            btnSincronizarTodas.style.display = 'inline-flex';
            btnSincronizarTodas.disabled = false;
        }
        
        showSuccess(`Verificación completada. ${sucursalesBodegonaAntigua.length} sucursales verificadas.`);
        
    } catch (error) {
        console.error('Error al verificar NC Bodegona Antigua:', error);
        showError('Error al verificar notas de crédito: ' + error.message);
    }
}

function mostrarTablaEnProgresoNCBodegonaAntigua() {
    const container = document.getElementById('container-sucursales-nc-bodegona');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    html += '<tr>';
    html += '<td colspan="7" class="text-center" style="padding: 40px;">';
    html += '<div class="loading-spinner"></div> Verificando sucursales...';
    html += '</td>';
    html += '</tr>';
    html += '</tbody>';
    html += '</table>';
    
    container.innerHTML = html;
}

async function verificarSucursalNCBodegonaAntigua(sucursal, fechaInicio, fechaFin) {
    try {
        const diferencias = [];
        
        const fechas = generarRangoFechas(fechaInicio, fechaFin);
        
        const connLocal = await mysql.createConnection(configLocal);
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        let connRemoto;
        try {
            connRemoto = await mysql.createConnection(configRemoto);
        } catch (error) {
            console.error(`  ✗ Error conectando a sucursal ${sucursal.NombreSucursal}:`, error.message);
            
            fechas.forEach(fecha => {
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: 'Error de conexión a sucursal'
                });
            });
            
            await connLocal.end();
            
            resultadosVerificacionNCBodegonaAntigua.push({
                idSucursal: sucursal.idSucursal,
                nombreSucursal: sucursal.NombreSucursal,
                diferencias: diferencias,
                errorConexion: true
            });
            
            return;
        }
        
        for (const fecha of fechas) {
            try {
                const [rowsLocal] = await connLocal.query(
                    'SELECT COUNT(*) as total FROM notacreditobodegonaantigua WHERE Fecha = ? AND IdSucursal = ?',
                    [fecha, sucursal.idSucursal]
                );
                
                const cantidadLocal = rowsLocal[0].total;
                
                const [rowsRemoto] = await connRemoto.query(
                    `SELECT 
                        COUNT(*) AS total
                    FROM
                        notascredito
                    INNER JOIN
                        detallenotascredito
                        ON notascredito.Id = detallenotascredito.Idtransacciones
                    LEFT JOIN 
                        productos
                        ON detallenotascredito.Upc = productos.Upc
                    WHERE
                        notascredito.Fecha = ?
                        AND notascredito.Estado = 1`,
                    [fecha]
                );
                
                const cantidadSucursal = rowsRemoto[0].total;
                
                if (cantidadLocal !== cantidadSucursal) {
                    diferencias.push({
                        fecha: fecha,
                        cantidadLocal: cantidadLocal,
                        cantidadSucursal: cantidadSucursal,
                        diferencia: cantidadSucursal - cantidadLocal
                    });
                }
                
            } catch (error) {
                console.error(`  ✗ Error verificando fecha ${fecha}:`, error.message);
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: error.message
                });
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        resultadosVerificacionNCBodegonaAntigua.push({
            idSucursal: sucursal.idSucursal,
            nombreSucursal: sucursal.NombreSucursal,
            diferencias: diferencias,
            errorConexion: false
        });
        
    } catch (error) {
        console.error(`Error general en sucursal ${sucursal.NombreSucursal}:`, error);
        throw error;
    }
}

function mostrarResultadosNCBodegonaAntigua() {
    const container = document.getElementById('container-sucursales-nc-bodegona');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    
    let totalDiferencias = 0;
    let sucursalesConDiferencias = 0;
    let sucursalesSinDiferencias = 0;
    
    resultadosVerificacionNCBodegonaAntigua.forEach(resultado => {
        if (resultado.errorConexion) {
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-receipt"></i> ${resultado.nombreSucursal} - <span class="status-badge status-error"><i class="fas fa-exclamation-triangle"></i> Error de Conexión</span></td>`;
            html += '</tr>';
        } else if (resultado.diferencias.length > 0) {
            sucursalesConDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-receipt"></i> ${resultado.nombreSucursal} <span class="status-badge status-warning" style="margin-left: 10px;">${resultado.diferencias.length} diferencia(s)</span></td>`;
            html += '</tr>';
            
            resultado.diferencias.forEach(dif => {
                totalDiferencias++;
                
                html += '<tr class="fecha-row">';
                html += `<td></td>`;
                html += `<td>${formatearFecha(dif.fecha)}</td>`;
                html += `<td class="text-center">${dif.cantidadLocal}</td>`;
                html += `<td class="text-center">${dif.cantidadSucursal}</td>`;
                
                if (dif.error) {
                    html += `<td class="text-center">-</td>`;
                    html += `<td class="text-center"><span class="status-badge status-error"><i class="fas fa-times"></i> Error</span></td>`;
                    html += `<td class="text-center">-</td>`;
                } else {
                    const difNum = dif.diferencia;
                    const colorDif = difNum > 0 ? 'style="color: #28a745;"' : 'style="color: #dc3545;"';
                    html += `<td class="text-center" ${colorDif}><strong>${difNum > 0 ? '+' : ''}${difNum}</strong></td>`;
                    
                    if (difNum !== 0) {
                        html += `<td class="text-center"><span class="status-badge status-warning"><i class="fas fa-exclamation-circle"></i> Diferencia</span></td>`;
                        html += `<td class="text-center">`;
                        html += `<button class="btn-resync" onclick="resincronizarFechaNCBodegonaAntigua('${resultado.idSucursal}', '${dif.fecha}')">`;
                        html += `<i class="fas fa-sync"></i> Resincronizar`;
                        html += `</button>`;
                        html += `</td>`;
                    } else {
                        html += `<td class="text-center"><span class="status-badge status-ok"><i class="fas fa-check"></i> OK</span></td>`;
                        html += `<td class="text-center">-</td>`;
                    }
                }
                
                html += '</tr>';
            });
        } else {
            sucursalesSinDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-receipt"></i> ${resultado.nombreSucursal} <span class="status-badge status-ok" style="margin-left: 10px;"><i class="fas fa-check-circle"></i> Sin Diferencias</span></td>`;
            html += '</tr>';
        }
    });
    
    html += '</tbody>';
    html += '</table>';
    
    if (resultadosVerificacionNCBodegonaAntigua.length > 0) {
        html += '<div style="margin-top: 20px; padding: 15px; background: rgba(0, 212, 255, 0.05); border-radius: 8px; display: flex; gap: 20px; flex-wrap: wrap;">';
        html += `<div><strong>Total Sucursales:</strong> ${resultadosVerificacionNCBodegonaAntigua.length}</div>`;
        html += `<div style="color: #28a745;"><strong>Sin Diferencias:</strong> ${sucursalesSinDiferencias}</div>`;
        html += `<div style="color: #ffc107;"><strong>Con Diferencias:</strong> ${sucursalesConDiferencias}</div>`;
        html += `<div style="color: #dc3545;"><strong>Total Diferencias:</strong> ${totalDiferencias}</div>`;
        html += '</div>';
    }
    
    container.innerHTML = html;
}

async function resincronizarFechaNCBodegonaAntigua(idSucursal, fecha) {
    try {
        const sucursal = sucursalesBodegonaAntigua.find(s => s.idSucursal == idSucursal);
        
        if (!sucursal) {
            showError('No se encontró la información de la sucursal');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas resincronizar las notas de crédito de ${sucursal.NombreSucursal} para la fecha ${formatearFecha(fecha)}?`,
            'Confirmar Resincronización'
        );
        
        if (!confirmar) return;
        
        showLoading('Resincronizando datos...');
        
        const connLocal = await mysql.createConnection(configLocal);
        
        await connLocal.query(
            'DELETE FROM notacreditobodegonaantigua WHERE Fecha = ? AND IdSucursal = ?',
            [fecha, idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                notascredito.Id,
                notascredito.IdCajas, 
                detallenotascredito.Upc, 
                productos.DescLarga, 
                detallenotascredito.DescCorta,
                detallenotascredito.CostoUnitario, 
                detallenotascredito.PrecioUnitario, 
                detallenotascredito.Cantidad, 
                notascredito.Fecha, 
                notascredito.NIT, 
                notascredito.NombreCliente,
                notascredito.Serie, 
                notascredito.NoDocumento, 
                notascredito.UUID
            FROM
                notascredito
                INNER JOIN
                detallenotascredito
                ON 
                    notascredito.Id = detallenotascredito.Idtransacciones
                LEFT JOIN
                productos
                ON 
                    detallenotascredito.Upc = productos.Upc
            WHERE
                notascredito.Fecha = ? AND
                notascredito.Estado = 1`,
            [fecha]
        );
        
        if (datosRemoto.length > 0) {
            const insertQuery = `
                INSERT INTO notacreditobodegonaantigua 
                (IdNotaCredito, IdCaja, Upc, Descripcion, DescCorta, Cantidad, CostoUnitario, 
                 PrecioUnitario, Fecha, NIT, NombreCliente, Serie, NoDocumento, UUID, IdSucursal, NombreSucursal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            let insertados = 0;
            for (const registro of datosRemoto) {
                try {
                    await connLocal.query(insertQuery, [
                        registro.Id,
                        registro.IdCajas,
                        registro.Upc,
                        registro.DescLarga,
                        registro.DescCorta,
                        registro.Cantidad,
                        registro.CostoUnitario,
                        registro.PrecioUnitario,
                        registro.Fecha,
                        registro.NIT,
                        registro.NombreCliente,
                        registro.Serie,
                        registro.NoDocumento,
                        registro.UUID,
                        idSucursal,
                        sucursal.NombreSucursal
                    ]);
                    insertados++;
                } catch (error) {
                    console.error(`  ✗ Error insertando registro:`, error.message);
                }
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        hideLoading();
        
        await showSuccess(`Resincronización completada. ${datosRemoto.length} registros sincronizados.`);
        
        await verificarSucursalNCBodegonaAntigua(sucursal, fecha, fecha);
        mostrarResultadosNCBodegonaAntigua();
        
    } catch (error) {
        hideLoading();
        console.error('Error al resincronizar NC Bodegona Antigua:', error);
        showError('Error al resincronizar: ' + error.message);
    }
}

async function sincronizarTodasLasDiferenciasNCBodegonaAntigua() {
    try {
        const diferenciasParaSincronizar = [];
        
        resultadosVerificacionNCBodegonaAntigua.forEach(resultado => {
            if (!resultado.errorConexion && resultado.diferencias.length > 0) {
                resultado.diferencias.forEach(dif => {
                    if (!dif.error && dif.diferencia !== 0) {
                        diferenciasParaSincronizar.push({
                            idSucursal: resultado.idSucursal,
                            nombreSucursal: resultado.nombreSucursal,
                            fecha: dif.fecha,
                            cantidadLocal: dif.cantidadLocal,
                            cantidadSucursal: dif.cantidadSucursal,
                            diferencia: dif.diferencia
                        });
                    }
                });
            }
        });
        
        if (diferenciasParaSincronizar.length === 0) {
            showWarning('No hay diferencias para sincronizar');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas sincronizar todas las diferencias encontradas?\n\nTotal: ${diferenciasParaSincronizar.length} registros con diferencias\nSucursales afectadas: ${new Set(diferenciasParaSincronizar.map(d => d.idSucursal)).size}`,
            'Confirmar Sincronización Masiva'
        );
        
        if (!confirmar) return;
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-bodegona');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = true;
        }
        
        showLoading('Sincronizando todas las diferencias...');
        
        let sincronizados = 0;
        let errores = 0;
        
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < diferenciasParaSincronizar.length; i += BATCH_SIZE) {
            const lote = diferenciasParaSincronizar.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(diferenciasParaSincronizar.length / BATCH_SIZE);
            
            const promesas = lote.map(async (item) => {
                try {
                    await sincronizarDiferenciaIndividualNCBodegonaAntigua(item);
                    sincronizados++;
                } catch (error) {
                    errores++;
                    console.error(`  ✗ ${item.nombreSucursal} - ${item.fecha}:`, error.message);
                }
            });
            
            await Promise.all(promesas);
            
            Swal.update({
                title: 'Sincronizando...',
                html: `
                    <div style="text-align: center;">
                        <p>Procesando lote ${loteNumero} de ${totalLotes}</p>
                        <p style="margin-top: 10px;">
                            <strong style="color: #28a745;">Sincronizados: ${sincronizados}</strong> | 
                            <strong style="color: #dc3545;">Errores: ${errores}</strong>
                        </p>
                    </div>
                `
            });
        }
        
        hideLoading();
        
        if (errores === 0) {
            showSuccess(`¡Sincronización completada!\n\n${sincronizados} diferencias sincronizadas correctamente.`);
        } else {
            showWarning(`Sincronización completada con algunos errores.\n\nSincronizados: ${sincronizados}\nErrores: ${errores}`);
        }
        
        await verificarNCBodegonaAntigua();
        
    } catch (error) {
        hideLoading();
        console.error('Error en sincronización masiva NC Bodegona Antigua:', error);
        showError('Error en sincronización masiva: ' + error.message);
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-bodegona');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = false;
        }
    }
}

async function sincronizarDiferenciaIndividualNCBodegonaAntigua(item) {
    try {
        const sucursal = sucursalesBodegonaAntigua.find(s => s.idSucursal == item.idSucursal);
        
        if (!sucursal) {
            throw new Error('No se encontró la información de la sucursal');
        }
        
        const connLocal = await mysql.createConnection(configLocal);
        
        await connLocal.query(
            'DELETE FROM notacreditobodegonaantigua WHERE Fecha = ? AND IdSucursal = ?',
            [item.fecha, item.idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                notascredito.Id,
                notascredito.IdCajas, 
                detallenotascredito.Upc, 
                productos.DescLarga, 
                detallenotascredito.DescCorta,
                detallenotascredito.CostoUnitario, 
                detallenotascredito.PrecioUnitario, 
                detallenotascredito.Cantidad, 
                notascredito.Fecha, 
                notascredito.NIT, 
                notascredito.NombreCliente,
                notascredito.Serie, 
                notascredito.NoDocumento, 
                notascredito.UUID
            FROM
                notascredito
                INNER JOIN
                detallenotascredito
                ON 
                    notascredito.Id = detallenotascredito.Idtransacciones
                LEFT JOIN
                productos
                ON 
                    detallenotascredito.Upc = productos.Upc
            WHERE
                notascredito.Fecha = ? AND
                notascredito.Estado = 1`,
            [item.fecha]
        );
        
        if (datosRemoto.length > 0) {
            const insertQuery = `
                INSERT INTO notacreditobodegonaantigua 
                (IdNotaCredito, IdCaja, Upc, Descripcion, DescCorta, Cantidad, CostoUnitario, 
                 PrecioUnitario, Fecha, NIT, NombreCliente, Serie, NoDocumento, UUID, IdSucursal, NombreSucursal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            for (const registro of datosRemoto) {
                await connLocal.query(insertQuery, [
                    registro.Id,
                    registro.IdCajas,
                    registro.Upc,
                    registro.DescLarga,
                    registro.DescCorta,
                    registro.Cantidad,
                    registro.CostoUnitario,
                    registro.PrecioUnitario,
                    registro.Fecha,
                    registro.NIT,
                    registro.NombreCliente,
                    registro.Serie,
                    registro.NoDocumento,
                    registro.UUID,
                    item.idSucursal,
                    item.nombreSucursal
                ]);
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
    } catch (error) {
        throw error;
    }
}

async function exportarResultadosNCBodegonaAntigua() {
    try {
        const datosExportar = [];
        
        resultadosVerificacionNCBodegonaAntigua.forEach(resultado => {
            resultado.diferencias.forEach(dif => {
                datosExportar.push({
                    'ID Sucursal': resultado.idSucursal,
                    'Sucursal': resultado.nombreSucursal,
                    'Fecha': dif.fecha,
                    'Cantidad Local': dif.cantidadLocal,
                    'Cantidad Sucursal': dif.cantidadSucursal,
                    'Diferencia': dif.diferencia,
                    'Observación': dif.error || (dif.diferencia === 0 ? 'OK' : 'Diferencia encontrada')
                });
            });
        });
        
        if (datosExportar.length === 0) {
            showWarning('No hay diferencias para exportar');
            return;
        }
        
        const fechaActual = new Date().toISOString().split('T')[0];
        await exportarAExcel(
            datosExportar, 
            `Verificacion_NC_BodegonaAntigua_${fechaActual}`,
            'Diferencias NC'
        );
        
    } catch (error) {
        console.error('Error al exportar:', error);
        showError('Error al exportar: ' + error.message);
    }
}

// Hacer funciones globales
window.resincronizarFechaNCBodegonaAntigua = resincronizarFechaNCBodegonaAntigua;
window.sincronizarTodasLasDiferenciasNCBodegonaAntigua = sincronizarTodasLasDiferenciasNCBodegonaAntigua;
// ========== NOTAS DE CRÉDITO SURTIMAYOREO ==========
let resultadosVerificacionNCSurtiMayoreo = [];

async function initNCSurtiMayoreo() {
    try {
        // Reutilizamos las sucursales de Ventas SurtiMayoreo
        if (sucursalesSurtiMayoreo.length === 0) {
            await cargarSucursalesSurtiMayoreo();
        }
        
        const btnVerificar = document.getElementById('btn-verificar-nc-surtimayoreo');
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-surtimayoreo');
        const btnExportar = document.getElementById('btn-exportar-nc-surtimayoreo');
        
        if (btnVerificar) {
            btnVerificar.addEventListener('click', verificarNCSurtiMayoreo);
        }
        
        if (btnSincronizarTodas) {
            btnSincronizarTodas.addEventListener('click', sincronizarTodasLasDiferenciasNCSurtiMayoreo);
        }
        
        if (btnExportar) {
            btnExportar.addEventListener('click', exportarResultadosNCSurtiMayoreo);
        }
        
    } catch (error) {
        console.error('Error al inicializar NC SurtiMayoreo:', error);
        showError('Error al inicializar la sección: ' + error.message);
    }
}

async function verificarNCSurtiMayoreo() {
    try {
        const fechaInicio = document.getElementById('fecha-inicio-nc-surtimayoreo').value;
        const fechaFin = document.getElementById('fecha-fin-nc-surtimayoreo').value;
        
        if (!fechaInicio || !fechaFin) {
            showWarning('Por favor selecciona ambas fechas');
            return;
        }
        
        if (new Date(fechaInicio) > new Date(fechaFin)) {
            showWarning('La fecha de inicio no puede ser mayor a la fecha fin');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas verificar las notas de crédito SurtiMayoreo desde ${fechaInicio} hasta ${fechaFin}?`,
            'Confirmar Verificación'
        );
        
        if (!confirmar) return;
        
        resultadosVerificacionNCSurtiMayoreo = [];
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-surtimayoreo');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.style.display = 'none';
            btnSincronizarTodas.disabled = true;
        }
        
        mostrarTablaEnProgresoNCSurtiMayoreo();
        
        const BATCH_SIZE = 5;
        const totalSucursales = sucursalesSurtiMayoreo.length;
        
        for (let i = 0; i < totalSucursales; i += BATCH_SIZE) {
            const lote = sucursalesSurtiMayoreo.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(totalSucursales / BATCH_SIZE);
            
            const promesas = lote.map((sucursal, index) => {
                const globalIndex = i + index + 1;
                return verificarSucursalNCSurtiMayoreo(sucursal, fechaInicio, fechaFin);
            });
            
            await Promise.all(promesas);
            mostrarResultadosNCSurtiMayoreo();
        }
        
        const hayDiferencias = resultadosVerificacionNCSurtiMayoreo.some(r => r.diferencias.length > 0);
        
        if (btnSincronizarTodas && hayDiferencias) {
            btnSincronizarTodas.style.display = 'inline-flex';
            btnSincronizarTodas.disabled = false;
        }
        
        showSuccess(`Verificación completada. ${sucursalesSurtiMayoreo.length} sucursales verificadas.`);
        
    } catch (error) {
        console.error('Error al verificar NC SurtiMayoreo:', error);
        showError('Error al verificar notas de crédito: ' + error.message);
    }
}

function mostrarTablaEnProgresoNCSurtiMayoreo() {
    const container = document.getElementById('container-sucursales-nc-surtimayoreo');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    html += '<tr>';
    html += '<td colspan="7" class="text-center" style="padding: 40px;">';
    html += '<div class="loading-spinner"></div> Verificando sucursales...';
    html += '</td>';
    html += '</tr>';
    html += '</tbody>';
    html += '</table>';
    
    container.innerHTML = html;
}

async function verificarSucursalNCSurtiMayoreo(sucursal, fechaInicio, fechaFin) {
    try {
        const diferencias = [];
        
        const fechas = generarRangoFechas(fechaInicio, fechaFin);
        
        const connLocal = await mysql.createConnection(configLocal);
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        let connRemoto;
        try {
            connRemoto = await mysql.createConnection(configRemoto);
        } catch (error) {
            console.error(`  ✗ Error conectando a sucursal ${sucursal.NombreSucursal}:`, error.message);
            
            fechas.forEach(fecha => {
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: 'Error de conexión a sucursal'
                });
            });
            
            await connLocal.end();
            
            resultadosVerificacionNCSurtiMayoreo.push({
                idSucursal: sucursal.idSucursal,
                nombreSucursal: sucursal.NombreSucursal,
                diferencias: diferencias,
                errorConexion: true
            });
            
            return;
        }
        
        for (const fecha of fechas) {
            try {
                const [rowsLocal] = await connLocal.query(
                    'SELECT COUNT(*) as total FROM notascreditosurtimayoreo WHERE Fecha = ? AND IdSucursal = ?',
                    [fecha, sucursal.idSucursal]
                );
                
                const cantidadLocal = rowsLocal[0].total;
                
                const [rowsRemoto] = await connRemoto.query(
                    `SELECT 
                        COUNT(*) AS total
                    FROM
                        notascredito
                    INNER JOIN
                        detallenotascredito
                        ON notascredito.Id = detallenotascredito.Idtransacciones
                    LEFT JOIN 
                        productos
                        ON detallenotascredito.Upc = productos.Upc
                    WHERE
                        notascredito.Fecha = ?
                        AND notascredito.Estado = 1`,
                    [fecha]
                );
                
                const cantidadSucursal = rowsRemoto[0].total;
                
                if (cantidadLocal !== cantidadSucursal) {
                    diferencias.push({
                        fecha: fecha,
                        cantidadLocal: cantidadLocal,
                        cantidadSucursal: cantidadSucursal,
                        diferencia: cantidadSucursal - cantidadLocal
                    });
                }
                
            } catch (error) {
                console.error(`  ✗ Error verificando fecha ${fecha}:`, error.message);
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: error.message
                });
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        resultadosVerificacionNCSurtiMayoreo.push({
            idSucursal: sucursal.idSucursal,
            nombreSucursal: sucursal.NombreSucursal,
            diferencias: diferencias,
            errorConexion: false
        });
        
    } catch (error) {
        console.error(`Error general en sucursal ${sucursal.NombreSucursal}:`, error);
        throw error;
    }
}

function mostrarResultadosNCSurtiMayoreo() {
    const container = document.getElementById('container-sucursales-nc-surtimayoreo');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    
    let totalDiferencias = 0;
    let sucursalesConDiferencias = 0;
    let sucursalesSinDiferencias = 0;
    
    resultadosVerificacionNCSurtiMayoreo.forEach(resultado => {
        if (resultado.errorConexion) {
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-receipt"></i> ${resultado.nombreSucursal} - <span class="status-badge status-error"><i class="fas fa-exclamation-triangle"></i> Error de Conexión</span></td>`;
            html += '</tr>';
        } else if (resultado.diferencias.length > 0) {
            sucursalesConDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-receipt"></i> ${resultado.nombreSucursal} <span class="status-badge status-warning" style="margin-left: 10px;">${resultado.diferencias.length} diferencia(s)</span></td>`;
            html += '</tr>';
            
            resultado.diferencias.forEach(dif => {
                totalDiferencias++;
                
                html += '<tr class="fecha-row">';
                html += `<td></td>`;
                html += `<td>${formatearFecha(dif.fecha)}</td>`;
                html += `<td class="text-center">${dif.cantidadLocal}</td>`;
                html += `<td class="text-center">${dif.cantidadSucursal}</td>`;
                
                if (dif.error) {
                    html += `<td class="text-center">-</td>`;
                    html += `<td class="text-center"><span class="status-badge status-error"><i class="fas fa-times"></i> Error</span></td>`;
                    html += `<td class="text-center">-</td>`;
                } else {
                    const difNum = dif.diferencia;
                    const colorDif = difNum > 0 ? 'style="color: #28a745;"' : 'style="color: #dc3545;"';
                    html += `<td class="text-center" ${colorDif}><strong>${difNum > 0 ? '+' : ''}${difNum}</strong></td>`;
                    
                    if (difNum !== 0) {
                        html += `<td class="text-center"><span class="status-badge status-warning"><i class="fas fa-exclamation-circle"></i> Diferencia</span></td>`;
                        html += `<td class="text-center">`;
                        html += `<button class="btn-resync" onclick="resincronizarFechaNCSurtiMayoreo('${resultado.idSucursal}', '${dif.fecha}')">`;
                        html += `<i class="fas fa-sync"></i> Resincronizar`;
                        html += `</button>`;
                        html += `</td>`;
                    } else {
                        html += `<td class="text-center"><span class="status-badge status-ok"><i class="fas fa-check"></i> OK</span></td>`;
                        html += `<td class="text-center">-</td>`;
                    }
                }
                
                html += '</tr>';
            });
        } else {
            sucursalesSinDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-receipt"></i> ${resultado.nombreSucursal} <span class="status-badge status-ok" style="margin-left: 10px;"><i class="fas fa-check-circle"></i> Sin Diferencias</span></td>`;
            html += '</tr>';
        }
    });
    
    html += '</tbody>';
    html += '</table>';
    
    if (resultadosVerificacionNCSurtiMayoreo.length > 0) {
        html += '<div style="margin-top: 20px; padding: 15px; background: rgba(0, 212, 255, 0.05); border-radius: 8px; display: flex; gap: 20px; flex-wrap: wrap;">';
        html += `<div><strong>Total Sucursales:</strong> ${resultadosVerificacionNCSurtiMayoreo.length}</div>`;
        html += `<div style="color: #28a745;"><strong>Sin Diferencias:</strong> ${sucursalesSinDiferencias}</div>`;
        html += `<div style="color: #ffc107;"><strong>Con Diferencias:</strong> ${sucursalesConDiferencias}</div>`;
        html += `<div style="color: #dc3545;"><strong>Total Diferencias:</strong> ${totalDiferencias}</div>`;
        html += '</div>';
    }
    
    container.innerHTML = html;
}

async function resincronizarFechaNCSurtiMayoreo(idSucursal, fecha) {
    try {
        const sucursal = sucursalesSurtiMayoreo.find(s => s.idSucursal == idSucursal);
        
        if (!sucursal) {
            showError('No se encontró la información de la sucursal');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas resincronizar las notas de crédito de ${sucursal.NombreSucursal} para la fecha ${formatearFecha(fecha)}?`,
            'Confirmar Resincronización'
        );
        
        if (!confirmar) return;
        
        showLoading('Resincronizando datos...');
        
        const connLocal = await mysql.createConnection(configLocal);
        
        await connLocal.query(
            'DELETE FROM notascreditosurtimayoreo WHERE Fecha = ? AND IdSucursal = ?',
            [fecha, idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                notascredito.Id,
                notascredito.IdCajas, 
                detallenotascredito.Upc, 
                productos.DescLarga, 
                detallenotascredito.DescCorta,
                detallenotascredito.CostoUnitario, 
                detallenotascredito.PrecioUnitario, 
                detallenotascredito.Cantidad, 
                notascredito.Fecha, 
                notascredito.NIT, 
                notascredito.NombreCliente,
                notascredito.Serie, 
                notascredito.NoDocumento, 
                notascredito.UUID
            FROM
                notascredito
                INNER JOIN
                detallenotascredito
                ON 
                    notascredito.Id = detallenotascredito.Idtransacciones
                LEFT JOIN
                productos
                ON 
                    detallenotascredito.Upc = productos.Upc
            WHERE
                notascredito.Fecha = ? AND
                notascredito.Estado = 1`,
            [fecha]
        );
        
        if (datosRemoto.length > 0) {
            const insertQuery = `
                INSERT INTO notascreditosurtimayoreo 
                (IdNotaCredito, IdCaja, Upc, Descripcion, DescCorta, Cantidad, CostoUnitario, 
                 PrecioUnitario, Fecha, NIT, NombreCliente, Serie, NoDocumento, UUID, IdSucursal, NombreSucursal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            let insertados = 0;
            for (const registro of datosRemoto) {
                try {
                    await connLocal.query(insertQuery, [
                        registro.Id,
                        registro.IdCajas,
                        registro.Upc,
                        registro.DescLarga,
                        registro.DescCorta,
                        registro.Cantidad,
                        registro.CostoUnitario,
                        registro.PrecioUnitario,
                        registro.Fecha,
                        registro.NIT,
                        registro.NombreCliente,
                        registro.Serie,
                        registro.NoDocumento,
                        registro.UUID,
                        idSucursal,
                        sucursal.NombreSucursal
                    ]);
                    insertados++;
                } catch (error) {
                    console.error(`  ✗ Error insertando registro:`, error.message);
                }
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        hideLoading();
        
        await showSuccess(`Resincronización completada. ${datosRemoto.length} registros sincronizados.`);
        
        await verificarSucursalNCSurtiMayoreo(sucursal, fecha, fecha);
        mostrarResultadosNCSurtiMayoreo();
        
    } catch (error) {
        hideLoading();
        console.error('Error al resincronizar NC SurtiMayoreo:', error);
        showError('Error al resincronizar: ' + error.message);
    }
}

async function sincronizarTodasLasDiferenciasNCSurtiMayoreo() {
    try {
        const diferenciasParaSincronizar = [];
        
        resultadosVerificacionNCSurtiMayoreo.forEach(resultado => {
            if (!resultado.errorConexion && resultado.diferencias.length > 0) {
                resultado.diferencias.forEach(dif => {
                    if (!dif.error && dif.diferencia !== 0) {
                        diferenciasParaSincronizar.push({
                            idSucursal: resultado.idSucursal,
                            nombreSucursal: resultado.nombreSucursal,
                            fecha: dif.fecha,
                            cantidadLocal: dif.cantidadLocal,
                            cantidadSucursal: dif.cantidadSucursal,
                            diferencia: dif.diferencia
                        });
                    }
                });
            }
        });
        
        if (diferenciasParaSincronizar.length === 0) {
            showWarning('No hay diferencias para sincronizar');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas sincronizar todas las diferencias encontradas?\n\nTotal: ${diferenciasParaSincronizar.length} registros con diferencias\nSucursales afectadas: ${new Set(diferenciasParaSincronizar.map(d => d.idSucursal)).size}`,
            'Confirmar Sincronización Masiva'
        );
        
        if (!confirmar) return;
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-surtimayoreo');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = true;
        }
        
        showLoading('Sincronizando todas las diferencias...');
        
        let sincronizados = 0;
        let errores = 0;
        
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < diferenciasParaSincronizar.length; i += BATCH_SIZE) {
            const lote = diferenciasParaSincronizar.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(diferenciasParaSincronizar.length / BATCH_SIZE);
            
            const promesas = lote.map(async (item) => {
                try {
                    await sincronizarDiferenciaIndividualNCSurtiMayoreo(item);
                    sincronizados++;
                } catch (error) {
                    errores++;
                    console.error(`  ✗ ${item.nombreSucursal} - ${item.fecha}:`, error.message);
                }
            });
            
            await Promise.all(promesas);
            
            Swal.update({
                title: 'Sincronizando...',
                html: `
                    <div style="text-align: center;">
                        <p>Procesando lote ${loteNumero} de ${totalLotes}</p>
                        <p style="margin-top: 10px;">
                            <strong style="color: #28a745;">Sincronizados: ${sincronizados}</strong> | 
                            <strong style="color: #dc3545;">Errores: ${errores}</strong>
                        </p>
                    </div>
                `
            });
        }
        
        hideLoading();
        
        if (errores === 0) {
            showSuccess(`¡Sincronización completada!\n\n${sincronizados} diferencias sincronizadas correctamente.`);
        } else {
            showWarning(`Sincronización completada con algunos errores.\n\nSincronizados: ${sincronizados}\nErrores: ${errores}`);
        }
        
        await verificarNCSurtiMayoreo();
        
    } catch (error) {
        hideLoading();
        console.error('Error en sincronización masiva NC SurtiMayoreo:', error);
        showError('Error en sincronización masiva: ' + error.message);
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-nc-surtimayoreo');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = false;
        }
    }
}

async function sincronizarDiferenciaIndividualNCSurtiMayoreo(item) {
    try {
        const sucursal = sucursalesSurtiMayoreo.find(s => s.idSucursal == item.idSucursal);
        
        if (!sucursal) {
            throw new Error('No se encontró la información de la sucursal');
        }
        
        const connLocal = await mysql.createConnection(configLocal);
        
        await connLocal.query(
            'DELETE FROM notascreditosurtimayoreo WHERE Fecha = ? AND IdSucursal = ?',
            [item.fecha, item.idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                notascredito.Id,
                notascredito.IdCajas, 
                detallenotascredito.Upc, 
                productos.DescLarga, 
                detallenotascredito.DescCorta,
                detallenotascredito.CostoUnitario, 
                detallenotascredito.PrecioUnitario, 
                detallenotascredito.Cantidad, 
                notascredito.Fecha, 
                notascredito.NIT, 
                notascredito.NombreCliente,
                notascredito.Serie, 
                notascredito.NoDocumento, 
                notascredito.UUID
            FROM
                notascredito
                INNER JOIN
                detallenotascredito
                ON 
                    notascredito.Id = detallenotascredito.Idtransacciones
                LEFT JOIN
                productos
                ON 
                    detallenotascredito.Upc = productos.Upc
            WHERE
                notascredito.Fecha = ? AND
                notascredito.Estado = 1`,
            [item.fecha]
        );
        
        if (datosRemoto.length > 0) {
            const insertQuery = `
                INSERT INTO notascreditosurtimayoreo 
                (IdNotaCredito, IdCaja, Upc, Descripcion, DescCorta, Cantidad, CostoUnitario, 
                 PrecioUnitario, Fecha, NIT, NombreCliente, Serie, NoDocumento, UUID, IdSucursal, NombreSucursal)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;
            
            for (const registro of datosRemoto) {
                await connLocal.query(insertQuery, [
                    registro.Id,
                    registro.IdCajas,
                    registro.Upc,
                    registro.DescLarga,
                    registro.DescCorta,
                    registro.Cantidad,
                    registro.CostoUnitario,
                    registro.PrecioUnitario,
                    registro.Fecha,
                    registro.NIT,
                    registro.NombreCliente,
                    registro.Serie,
                    registro.NoDocumento,
                    registro.UUID,
                    item.idSucursal,
                    item.nombreSucursal
                ]);
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
    } catch (error) {
        throw error;
    }
}

async function exportarResultadosNCSurtiMayoreo() {
    try {
        const datosExportar = [];
        
        resultadosVerificacionNCSurtiMayoreo.forEach(resultado => {
            resultado.diferencias.forEach(dif => {
                datosExportar.push({
                    'ID Sucursal': resultado.idSucursal,
                    'Sucursal': resultado.nombreSucursal,
                    'Fecha': dif.fecha,
                    'Cantidad Local': dif.cantidadLocal,
                    'Cantidad Sucursal': dif.cantidadSucursal,
                    'Diferencia': dif.diferencia,
                    'Observación': dif.error || (dif.diferencia === 0 ? 'OK' : 'Diferencia encontrada')
                });
            });
        });
        
        if (datosExportar.length === 0) {
            showWarning('No hay diferencias para exportar');
            return;
        }
        
        const fechaActual = new Date().toISOString().split('T')[0];
        await exportarAExcel(
            datosExportar, 
            `Verificacion_NC_SurtiMayoreo_${fechaActual}`,
            'Diferencias NC'
        );
        
    } catch (error) {
        console.error('Error al exportar:', error);
        showError('Error al exportar: ' + error.message);
    }
}

// Hacer funciones globales
window.resincronizarFechaNCSurtiMayoreo = resincronizarFechaNCSurtiMayoreo;
window.sincronizarTodasLasDiferenciasNCSurtiMayoreo = sincronizarTodasLasDiferenciasNCSurtiMayoreo;
// ========== INGRESOS DE PROVEEDORES ==========
let sucursalesIngresos = [];
let resultadosVerificacionIngresos = [];

async function initIngresosProveedores() {
    try {
        await cargarSucursalesIngresos();
        
        const btnVerificar = document.getElementById('btn-verificar-ingresos');
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-ingresos');
        const btnExportar = document.getElementById('btn-exportar-ingresos');
        
        if (btnVerificar) {
            btnVerificar.addEventListener('click', verificarIngresosProveedores);
        }
        
        if (btnSincronizarTodas) {
            btnSincronizarTodas.addEventListener('click', sincronizarTodasLasDiferenciasIngresos);
        }
        
        if (btnExportar) {
            btnExportar.addEventListener('click', exportarResultadosIngresos);
        }
        
    } catch (error) {
        console.error('Error al inicializar Ingresos de Proveedores:', error);
        showError('Error al inicializar la sección: ' + error.message);
    }
}

async function cargarSucursalesIngresos() {
    try {
        showLoading('Cargando sucursales...');
        
        const connection = await odbc.connect(conexiondbsucursal);
        
        const query = `
            SELECT
                idSucursal, 
                NombreSucursal, 
                serverr, 
                databasee, 
                Uid, 
                Pwd,
                Puerto
            FROM
                sucursales
            WHERE
                TipoSucursal IN (1, 2, 3) AND
                Activo = 1
        `;
        
        const result = await connection.query(query);
        await connection.close();
        
        sucursalesIngresos = result;
        
        hideLoading();
        
    } catch (error) {
        hideLoading();
        console.error('Error al cargar sucursales:', error);
        throw error;
    }
}

async function verificarIngresosProveedores() {
    try {
        const fechaInicio = document.getElementById('fecha-inicio-ingresos').value;
        const fechaFin = document.getElementById('fecha-fin-ingresos').value;
        
        if (!fechaInicio || !fechaFin) {
            showWarning('Por favor selecciona ambas fechas');
            return;
        }
        
        if (new Date(fechaInicio) > new Date(fechaFin)) {
            showWarning('La fecha de inicio no puede ser mayor a la fecha fin');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas verificar los ingresos de proveedores desde ${fechaInicio} hasta ${fechaFin}?`,
            'Confirmar Verificación'
        );
        
        if (!confirmar) return;
        
        resultadosVerificacionIngresos = [];
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-ingresos');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.style.display = 'none';
            btnSincronizarTodas.disabled = true;
        }
        
        mostrarTablaEnProgresoIngresos();
        
        const BATCH_SIZE = 5;
        const totalSucursales = sucursalesIngresos.length;
        
        for (let i = 0; i < totalSucursales; i += BATCH_SIZE) {
            const lote = sucursalesIngresos.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(totalSucursales / BATCH_SIZE);
            
            const promesas = lote.map((sucursal, index) => {
                const globalIndex = i + index + 1;
                return verificarSucursalIngresos(sucursal, fechaInicio, fechaFin);
            });
            
            await Promise.all(promesas);
            mostrarResultadosIngresos();
        }
        
        const hayDiferencias = resultadosVerificacionIngresos.some(r => r.diferencias.length > 0);
        
        if (btnSincronizarTodas && hayDiferencias) {
            btnSincronizarTodas.style.display = 'inline-flex';
            btnSincronizarTodas.disabled = false;
        }
        
        showSuccess(`Verificación completada. ${sucursalesIngresos.length} sucursales verificadas.`);
        
    } catch (error) {
        console.error('Error al verificar ingresos:', error);
        showError('Error al verificar ingresos: ' + error.message);
    }
}

function mostrarTablaEnProgresoIngresos() {
    const container = document.getElementById('container-sucursales-ingresos');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    html += '<tr>';
    html += '<td colspan="7" class="text-center" style="padding: 40px;">';
    html += '<div class="loading-spinner"></div> Verificando sucursales...';
    html += '</td>';
    html += '</tr>';
    html += '</tbody>';
    html += '</table>';
    
    container.innerHTML = html;
}

async function verificarSucursalIngresos(sucursal, fechaInicio, fechaFin) {
    try {
        const diferencias = [];
        
        const fechas = generarRangoFechas(fechaInicio, fechaFin);
        
        const connLocal = await mysql.createConnection(configLocal);
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        let connRemoto;
        try {
            connRemoto = await mysql.createConnection(configRemoto);
        } catch (error) {
            console.error(`  ✗ Error conectando a sucursal ${sucursal.NombreSucursal}:`, error.message);
            
            fechas.forEach(fecha => {
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: 'Error de conexión a sucursal'
                });
            });
            
            await connLocal.end();
            
            resultadosVerificacionIngresos.push({
                idSucursal: sucursal.idSucursal,
                nombreSucursal: sucursal.NombreSucursal,
                diferencias: diferencias,
                errorConexion: true
            });
            
            return;
        }
        
        for (const fecha of fechas) {
            try {
                const [rowsLocal] = await connLocal.query(
                    'SELECT COUNT(*) as total FROM ingresosinventarios WHERE FechaRecepcion = ? AND IdSucursal = ?',
                    [fecha, sucursal.idSucursal]
                );
                
                const cantidadLocal = rowsLocal[0].total;
                
                const [rowsRemoto] = await connRemoto.query(
                    `SELECT 
                        COUNT(*) AS total
                    FROM
                        detalleinventarios
                    INNER JOIN 
                        inventarios 
                        ON detalleinventarios.IdInventarios = inventarios.idInventarios
                    LEFT JOIN 
                        proveedores_facturas 
                        ON inventarios.IdProveedores = proveedores_facturas.Id
                    INNER JOIN 
                        razonessociales 
                        ON inventarios.IdRazon = razonessociales.Id
                    LEFT JOIN 
                        productos 
                        ON detalleinventarios.Upc = productos.Upc
                    INNER JOIN 
                        estado_operaciones 
                        ON inventarios.Estado = estado_operaciones.IdEstado
                    WHERE
                        inventarios.IdProveedores > 0
                        AND inventarios.Fecha = ?
                        AND detalleinventarios.Detalle_Rechequeo = 0`,
                    [fecha]
                );
                
                const cantidadSucursal = rowsRemoto[0].total;
                
                if (cantidadLocal !== cantidadSucursal) {
                    diferencias.push({
                        fecha: fecha,
                        cantidadLocal: cantidadLocal,
                        cantidadSucursal: cantidadSucursal,
                        diferencia: cantidadSucursal - cantidadLocal
                    });
                }
                
            } catch (error) {
                console.error(`  ✗ Error verificando fecha ${fecha}:`, error.message);
                diferencias.push({
                    fecha: fecha,
                    cantidadLocal: 0,
                    cantidadSucursal: 0,
                    diferencia: 0,
                    error: error.message
                });
            }
        }
        
        await connLocal.end();
        await connRemoto.end();
        
        resultadosVerificacionIngresos.push({
            idSucursal: sucursal.idSucursal,
            nombreSucursal: sucursal.NombreSucursal,
            diferencias: diferencias,
            errorConexion: false
        });
        
    } catch (error) {
        console.error(`Error general en sucursal ${sucursal.NombreSucursal}:`, error);
        throw error;
    }
}

function mostrarResultadosIngresos() {
    const container = document.getElementById('container-sucursales-ingresos');
    
    if (!container) return;
    
    let html = '<table class="data-table">';
    html += '<thead>';
    html += '<tr>';
    html += '<th>Sucursal</th>';
    html += '<th>Fecha</th>';
    html += '<th class="text-center">Local</th>';
    html += '<th class="text-center">Sucursal</th>';
    html += '<th class="text-center">Diferencia</th>';
    html += '<th class="text-center">Estado</th>';
    html += '<th class="text-center">Acciones</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    
    let totalDiferencias = 0;
    let sucursalesConDiferencias = 0;
    let sucursalesSinDiferencias = 0;
    
    resultadosVerificacionIngresos.forEach(resultado => {
        if (resultado.errorConexion) {
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-truck-loading"></i> ${resultado.nombreSucursal} - <span class="status-badge status-error"><i class="fas fa-exclamation-triangle"></i> Error de Conexión</span></td>`;
            html += '</tr>';
        } else if (resultado.diferencias.length > 0) {
            sucursalesConDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-truck-loading"></i> ${resultado.nombreSucursal} <span class="status-badge status-warning" style="margin-left: 10px;">${resultado.diferencias.length} diferencia(s)</span></td>`;
            html += '</tr>';
            
            resultado.diferencias.forEach(dif => {
                totalDiferencias++;
                
                html += '<tr class="fecha-row">';
                html += `<td></td>`;
                html += `<td>${formatearFecha(dif.fecha)}</td>`;
                html += `<td class="text-center">${dif.cantidadLocal}</td>`;
                html += `<td class="text-center">${dif.cantidadSucursal}</td>`;
                
                if (dif.error) {
                    html += `<td class="text-center">-</td>`;
                    html += `<td class="text-center"><span class="status-badge status-error"><i class="fas fa-times"></i> Error</span></td>`;
                    html += `<td class="text-center">-</td>`;
                } else {
                    const difNum = dif.diferencia;
                    const colorDif = difNum > 0 ? 'style="color: #28a745;"' : 'style="color: #dc3545;"';
                    html += `<td class="text-center" ${colorDif}><strong>${difNum > 0 ? '+' : ''}${difNum}</strong></td>`;
                    
                    if (difNum !== 0) {
                        html += `<td class="text-center"><span class="status-badge status-warning"><i class="fas fa-exclamation-circle"></i> Diferencia</span></td>`;
                        html += `<td class="text-center">`;
                        html += `<button class="btn-resync" onclick="resincronizarFechaIngresos('${resultado.idSucursal}', '${dif.fecha}')">`;
                        html += `<i class="fas fa-sync"></i> Resincronizar`;
                        html += `</button>`;
                        html += `</td>`;
                    } else {
                        html += `<td class="text-center"><span class="status-badge status-ok"><i class="fas fa-check"></i> OK</span></td>`;
                        html += `<td class="text-center">-</td>`;
                    }
                }
                
                html += '</tr>';
            });
        } else {
            sucursalesSinDiferencias++;
            html += '<tr class="sucursal-header">';
            html += `<td colspan="7"><i class="fas fa-truck-loading"></i> ${resultado.nombreSucursal} <span class="status-badge status-ok" style="margin-left: 10px;"><i class="fas fa-check-circle"></i> Sin Diferencias</span></td>`;
            html += '</tr>';
        }
    });
    
    html += '</tbody>';
    html += '</table>';
    
    if (resultadosVerificacionIngresos.length > 0) {
        html += '<div style="margin-top: 20px; padding: 15px; background: rgba(0, 212, 255, 0.05); border-radius: 8px; display: flex; gap: 20px; flex-wrap: wrap;">';
        html += `<div><strong>Total Sucursales:</strong> ${resultadosVerificacionIngresos.length}</div>`;
        html += `<div style="color: #28a745;"><strong>Sin Diferencias:</strong> ${sucursalesSinDiferencias}</div>`;
        html += `<div style="color: #ffc107;"><strong>Con Diferencias:</strong> ${sucursalesConDiferencias}</div>`;
        html += `<div style="color: #dc3545;"><strong>Total Diferencias:</strong> ${totalDiferencias}</div>`;
        html += '</div>';
    }
    
    container.innerHTML = html;
}

async function resincronizarFechaIngresos(idSucursal, fecha) {
    try {
        const sucursal = sucursalesIngresos.find(s => s.idSucursal == idSucursal);
        
        if (!sucursal) {
            showError('No se encontró la información de la sucursal');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas resincronizar los ingresos de proveedores de ${sucursal.NombreSucursal} para la fecha ${formatearFecha(fecha)}?`,
            'Confirmar Resincronización'
        );
        
        if (!confirmar) return;
        
        showLoading('Resincronizando datos...');
        
        const connLocal = await mysql.createConnection(configLocal);
        
        await connLocal.query(
            'DELETE FROM ingresosinventarios WHERE FechaRecepcion = ? AND IdSucursal = ?',
            [fecha, idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                inventarios.idInventarios, 
                detalleinventarios.Upc, 
                COALESCE(productos.DescLarga, detalleinventarios.Descripcion) AS DescLarga,
                detalleinventarios.Cantidad_Rechequeo, 
                CASE 
                  WHEN detalleinventarios.UnidadesFardo IS NULL OR detalleinventarios.UnidadesFardo = '' OR detalleinventarios.UnidadesFardo = 0 
                  THEN detalleinventarios.Bonificacion_Rechequeo 
                  ELSE detalleinventarios.Bonificacion_Rechequeo * detalleinventarios.UnidadesFardo 
                END AS Bonificacion,
                detalleinventarios.Costo, 
                inventarios.FechaFactura, 
                inventarios.Fecha,
                inventarios.IdProveedores, 
                proveedores_facturas.Nombre AS Proveedor, 
                inventarios.Numero, 
                inventarios.Serie,
                inventarios.IdRazon,
                razonessociales.NombreRazon,  
                estado_operaciones.Estado,
                inventarios.Operacion,
                CASE 
                  WHEN inventarios.ReFacturarRS = 0 THEN 'Factura Sin problemas'
                  WHEN inventarios.ReFacturarRS = 1 THEN 'Refacturación'
                  ELSE 'Otro'
                END AS ReFacturarRS
            FROM
                detalleinventarios
                INNER JOIN inventarios ON detalleinventarios.IdInventarios = inventarios.idInventarios
                LEFT JOIN proveedores_facturas ON inventarios.IdProveedores = proveedores_facturas.Id
                INNER JOIN razonessociales ON inventarios.IdRazon = razonessociales.Id
                LEFT JOIN productos ON detalleinventarios.Upc = productos.Upc
                INNER JOIN estado_operaciones ON inventarios.Estado = estado_operaciones.IdEstado
            WHERE
                inventarios.IdProveedores > 0 AND
                inventarios.Fecha = ? AND
                detalleinventarios.Detalle_Rechequeo = 0`,
            [fecha]
        );
        
        if (datosRemoto.length > 0) {
        const insertQuery = `
            INSERT INTO ingresosinventarios 
            (IdInventario, Upc, Descripcion, Cantidad, Bonificacion, Costo, FechaFactura, 
            FechaRecepcion, IdProveedor, Proveedor, NumeroFactura, SerieFactura, 
            IdRazonSocial, RazonSocial, Estado, Operacion, ReFacturarRS, IdSucursal, NombreSucursal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        let insertados = 0;
        for (const registro of datosRemoto) {
            try {
                await connLocal.query(insertQuery, [
                    registro.idInventarios,
                    registro.Upc,
                    registro.DescLarga,
                    registro.Cantidad_Rechequeo,
                    registro.Bonificacion,
                    registro.Costo,
                    registro.FechaFactura,
                    registro.Fecha,
                    registro.IdProveedores,
                    registro.Proveedor,
                    registro.Numero,
                    registro.Serie,
                    registro.IdRazon,
                    registro.NombreRazon,
                    registro.Estado,
                    registro.Operacion,
                    registro.ReFacturarRS,
                    idSucursal,
                    sucursal.NombreSucursal
                ]);
                insertados++;
            } catch (error) {
                console.error(`  ✗ Error insertando registro:`, error.message);
            }
        }
    }
        
        await connLocal.end();
        await connRemoto.end();
        
        hideLoading();
        
        await showSuccess(`Resincronización completada. ${datosRemoto.length} registros sincronizados.`);
        
        await verificarSucursalIngresos(sucursal, fecha, fecha);
        mostrarResultadosIngresos();
        
    } catch (error) {
        hideLoading();
        console.error('Error al resincronizar Ingresos:', error);
        showError('Error al resincronizar: ' + error.message);
    }
}

async function sincronizarTodasLasDiferenciasIngresos() {
    try {
        const diferenciasParaSincronizar = [];
        
        resultadosVerificacionIngresos.forEach(resultado => {
            if (!resultado.errorConexion && resultado.diferencias.length > 0) {
                resultado.diferencias.forEach(dif => {
                    if (!dif.error && dif.diferencia !== 0) {
                        diferenciasParaSincronizar.push({
                            idSucursal: resultado.idSucursal,
                            nombreSucursal: resultado.nombreSucursal,
                            fecha: dif.fecha,
                            cantidadLocal: dif.cantidadLocal,
                            cantidadSucursal: dif.cantidadSucursal,
                            diferencia: dif.diferencia
                        });
                    }
                });
            }
        });
        
        if (diferenciasParaSincronizar.length === 0) {
            showWarning('No hay diferencias para sincronizar');
            return;
        }
        
        const confirmar = await showConfirm(
            `¿Deseas sincronizar todas las diferencias encontradas?\n\nTotal: ${diferenciasParaSincronizar.length} registros con diferencias\nSucursales afectadas: ${new Set(diferenciasParaSincronizar.map(d => d.idSucursal)).size}`,
            'Confirmar Sincronización Masiva'
        );
        
        if (!confirmar) return;
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-ingresos');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = true;
        }
        
        showLoading('Sincronizando todas las diferencias...');
        
        let sincronizados = 0;
        let errores = 0;
        
        const BATCH_SIZE = 3;
        
        for (let i = 0; i < diferenciasParaSincronizar.length; i += BATCH_SIZE) {
            const lote = diferenciasParaSincronizar.slice(i, i + BATCH_SIZE);
            const loteNumero = Math.floor(i / BATCH_SIZE) + 1;
            const totalLotes = Math.ceil(diferenciasParaSincronizar.length / BATCH_SIZE);
            
            const promesas = lote.map(async (item) => {
                try {
                    await sincronizarDiferenciaIndividualIngresos(item);
                    sincronizados++;
                } catch (error) {
                    errores++;
                    console.error(`  ✗ ${item.nombreSucursal} - ${item.fecha}:`, error.message);
                }
            });
            
            await Promise.all(promesas);
            
            Swal.update({
                title: 'Sincronizando...',
                html: `
                    <div style="text-align: center;">
                        <p>Procesando lote ${loteNumero} de ${totalLotes}</p>
                        <p style="margin-top: 10px;">
                            <strong style="color: #28a745;">Sincronizados: ${sincronizados}</strong> | 
                            <strong style="color: #dc3545;">Errores: ${errores}</strong>
                        </p>
                    </div>
                `
            });
        }
        
        hideLoading();
        
        if (errores === 0) {
            showSuccess(`¡Sincronización completada!\n\n${sincronizados} diferencias sincronizadas correctamente.`);
        } else {
            showWarning(`Sincronización completada con algunos errores.\n\nSincronizados: ${sincronizados}\nErrores: ${errores}`);
        }
        
        await verificarIngresosProveedores();
        
    } catch (error) {
        hideLoading();
        console.error('Error en sincronización masiva Ingresos:', error);
        showError('Error en sincronización masiva: ' + error.message);
        
        const btnSincronizarTodas = document.getElementById('btn-sincronizar-todas-ingresos');
        if (btnSincronizarTodas) {
            btnSincronizarTodas.disabled = false;
        }
    }
}

async function sincronizarDiferenciaIndividualIngresos(item) {
    try {
        const sucursal = sucursalesIngresos.find(s => s.idSucursal == item.idSucursal);
        
        if (!sucursal) {
            throw new Error('No se encontró la información de la sucursal');
        }
        
        const connLocal = await mysql.createConnection(configLocal);
        
        await connLocal.query(
            'DELETE FROM ingresosinventarios WHERE FechaRecepcion = ? AND IdSucursal = ?',
            [item.fecha, item.idSucursal]
        );
        
        const configRemoto = {
            host: sucursal.serverr,
            port: sucursal.Puerto || 3306,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            connectTimeout: 10000
        };
        
        const connRemoto = await mysql.createConnection(configRemoto);
        
        const [datosRemoto] = await connRemoto.query(
            `SELECT
                inventarios.idInventarios, 
                detalleinventarios.Upc, 
                COALESCE(productos.DescLarga, detalleinventarios.Descripcion) AS DescLarga,
                detalleinventarios.Cantidad_Rechequeo, 
                CASE 
                  WHEN detalleinventarios.UnidadesFardo IS NULL OR detalleinventarios.UnidadesFardo = '' OR detalleinventarios.UnidadesFardo = 0 
                  THEN detalleinventarios.Bonificacion_Rechequeo 
                  ELSE detalleinventarios.Bonificacion_Rechequeo * detalleinventarios.UnidadesFardo 
                END AS Bonificacion,
                detalleinventarios.Costo, 
                inventarios.FechaFactura, 
                inventarios.Fecha,
                inventarios.IdProveedores, 
                proveedores_facturas.Nombre AS Proveedor, 
                inventarios.Numero, 
                inventarios.Serie,
                inventarios.IdRazon,
                razonessociales.NombreRazon,  
                estado_operaciones.Estado,
                inventarios.Operacion,
                CASE 
                  WHEN inventarios.ReFacturarRS = 0 THEN 'Factura Sin problemas'
                  WHEN inventarios.ReFacturarRS = 1 THEN 'Refacturación'
                  ELSE 'Otro'
                END AS ReFacturarRS
            FROM
                detalleinventarios
                INNER JOIN inventarios ON detalleinventarios.IdInventarios = inventarios.idInventarios
                LEFT JOIN proveedores_facturas ON inventarios.IdProveedores = proveedores_facturas.Id
                INNER JOIN razonessociales ON inventarios.IdRazon = razonessociales.Id
                LEFT JOIN productos ON detalleinventarios.Upc = productos.Upc
                INNER JOIN estado_operaciones ON inventarios.Estado = estado_operaciones.IdEstado
            WHERE
                inventarios.IdProveedores > 0 AND
                inventarios.Fecha = ? AND
                detalleinventarios.Detalle_Rechequeo = 0`,
            [item.fecha]
        );
        
        if (datosRemoto.length > 0) {
        const insertQuery = `
            INSERT INTO ingresosinventarios 
            (IdInventario, Upc, Descripcion, Cantidad, Bonificacion, Costo, FechaFactura, 
            FechaRecepcion, IdProveedor, Proveedor, NumeroFactura, SerieFactura, 
            IdRazonSocial, RazonSocial, Estado, Operacion, ReFacturarRS, IdSucursal, NombreSucursal)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        for (const registro of datosRemoto) {
            await connLocal.query(insertQuery, [
                registro.idInventarios,
                registro.Upc,
                registro.DescLarga,
                registro.Cantidad_Rechequeo,
                registro.Bonificacion,
                registro.Costo,
                registro.FechaFactura,
                registro.Fecha,
                registro.IdProveedores,
                registro.Proveedor,
                registro.Numero,
                registro.Serie,
                registro.IdRazon,
                registro.NombreRazon,
                registro.Estado,
                registro.Operacion,
                registro.ReFacturarRS,
                item.idSucursal,
                item.nombreSucursal
            ]);
        }
    }
        
        await connLocal.end();
        await connRemoto.end();
        
    } catch (error) {
        throw error;
    }
}

async function exportarResultadosIngresos() {
    try {
        const datosExportar = [];
        
        resultadosVerificacionIngresos.forEach(resultado => {
            resultado.diferencias.forEach(dif => {
                datosExportar.push({
                    'ID Sucursal': resultado.idSucursal,
                    'Sucursal': resultado.nombreSucursal,
                    'Fecha': dif.fecha,
                    'Cantidad Local': dif.cantidadLocal,
                    'Cantidad Sucursal': dif.cantidadSucursal,
                    'Diferencia': dif.diferencia,
                    'Observación': dif.error || (dif.diferencia === 0 ? 'OK' : 'Diferencia encontrada')
                });
            });
        });
        
        if (datosExportar.length === 0) {
            showWarning('No hay diferencias para exportar');
            return;
        }
        
        const fechaActual = new Date().toISOString().split('T')[0];
        await exportarAExcel(
            datosExportar, 
            `Verificacion_Ingresos_Proveedores_${fechaActual}`,
            'Diferencias Ingresos'
        );
        
    } catch (error) {
        console.error('Error al exportar:', error);
        showError('Error al exportar: ' + error.message);
    }
}

// Hacer funciones globales
window.resincronizarFechaIngresos = resincronizarFechaIngresos;
window.sincronizarTodasLasDiferenciasIngresos = sincronizarTodasLasDiferenciasIngresos;
window.sincronizarTodasLasDiferencias = sincronizarTodasLasDiferencias;