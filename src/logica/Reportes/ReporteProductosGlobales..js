const Swal = require('sweetalert2');
const odbc = require('odbc');
const conexiondbsucursal = 'DSN=DBsucursal';
const ExcelJS = require('exceljs');
const mysql = require('mysql2/promise');
const conexiondbfacturas = 'DSN=facturas';

// Configuración optimizada
const CONFIG = {
    BATCH_SIZE: 3, // Sucursales procesadas simultáneamente
    TIMEOUT_CONNECTION: 30000, // 30 segundos
    TIMEOUT_QUERY: 60000, // 60 segundos
    RETRY_ATTEMPTS: 2,
    CACHE_TTL: 300000, // 5 minutos
    MAX_ROWS_VIRTUAL_SCROLL: 1000,
    TOAST_DURATION: 4000
};

// Clase principal optimizada para el manejo del reporte
class ReporteProductosGlobales {
    constructor() {
        this.init();
        
        // Datos principales
        this.datosReporte = [];
        this.sucursalesInfo = [];
        this.columnas = [];
        this.datosOriginales = [];
        this.datosFiltrados = [];
        
        // Paginación y filtros
        this.paginaActual = 1;
        this.registrosPorPagina = 50;
        this.totalRegistros = 0;
        this.ordenActual = { columna: null, direccion: 'asc' };
        this.terminoBusqueda = '';
        
        // Control de procesamiento
        this.tiempoInicio = null;
        this.estadoProcesamiento = new Map();
        this.sucursalesCompletadas = 0;
        this.totalSucursales = 0;
        this.productosAcumulados = 0;
        this.esProcesandoReporte = false;
        
        // Cache para optimización
        this.cacheDepartamentos = new Map();
        this.cacheProveedores = new Map();
        this.ultimaActualizacionCache = 0;
        
        // Performance tracking
        this.metricas = {
            tiempoTotal: 0,
            sucursalesExitosas: 0,
            sucursalesConError: 0,
            productosSegundo: 0,
            erroresConexion: []
        };
    }

    // Inicialización optimizada de la aplicación
    init() {
        
        try {
            this.bindEvents();
            this.configurarPaginacion();
            this.cargarConfiguracionGuardada();
            this.cargarRazonesSociales();
            this.inicializarEstadoVacio();
        } catch (error) {
            this.mostrarToast('Error de inicialización', 'error');
        }
    }
    cancelarProcesamiento() {
        if (!this.esProcesandoReporte) {
            this.mostrarToast('No hay procesamiento en curso', 'info');
            return;
        }
        
        // Mostrar confirmación
        Swal.fire({
            title: '⚠️ Cancelar Procesamiento',
            text: '¿Está seguro que desea cancelar el procesamiento actual?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, Cancelar',
            cancelButtonText: 'Continuar',
            confirmButtonColor: '#ef4444'
        }).then((result) => {
            if (result.isConfirmed) {
                this.esProcesandoReporte = false;
                this.habilitarControles();
                this.ocultarProgresoCompacto();
                this.ocultarProgresoPorSucursales();
                this.mostrarToast('Procesamiento cancelado', 'warning');
                console.log('🛑 Procesamiento cancelado por confirmación del usuario');
            }
        });
    }
    // Vinculación optimizada de eventos
    bindEvents() {
        // Eventos principales del panel de control
        this.addEventListener('selectRazonSocial', 'change', (e) => {
            this.onRazonSocialChange(e.target.value);
        });

        this.addEventListener('btnGenerarReporte', 'click', () => {
            this.generarReporteOptimizado();
        });

        this.addEventListener('btnProbarConexiones', 'click', () => {
            this.probarConexionesSucursales();
        });

        this.addEventListener('btnLimpiar', 'click', () => {
            this.limpiarFormulario();
        });

        // Eventos de exportación
        this.addEventListener('btnExportExcel', 'click', () => {
            this.exportarExcel();
        });

        // Eventos de búsqueda optimizados con debounce
        this.addEventListener('searchInput', 'input', this.debounce((e) => {
            this.buscarEnTablaOptimizada(e.target.value);
        }, 300));
        this.addEventListener('btnCancelar', 'click', () => {
            this.cancelarProcesamiento();
        });
        // Eventos de paginación mejorados
        this.addEventListener('btnFirstPage', 'click', () => this.irAPagina(1));
        this.addEventListener('btnPrevPage', 'click', () => this.irAPagina(this.paginaActual - 1));
        this.addEventListener('btnNextPage', 'click', () => this.irAPagina(this.paginaActual + 1));
        this.addEventListener('btnLastPage', 'click', () => this.irAPagina(this.totalPaginas));

        this.addEventListener('currentPageInput', 'keypress', (e) => {
            if (e.key === 'Enter') {
                const pagina = parseInt(e.target.value);
                if (pagina >= 1 && pagina <= this.totalPaginas) {
                    this.irAPagina(pagina);
                }
            }
        });

        this.addEventListener('pageSize', 'change', (e) => {
            this.registrosPorPagina = parseInt(e.target.value);
            this.paginaActual = 1;
            this.actualizarTablaOptimizada();
        });

        // Eventos de modales
        this.addEventListener('btnToggleColumns', 'click', () => {
            this.mostrarModalColumnas();
        });

        this.addEventListener('closeColumnModal', 'click', () => {
            this.cerrarModal('columnModal');
        });

        this.addEventListener('btnCancelColumns', 'click', () => {
            this.cerrarModal('columnModal');
        });

        this.addEventListener('btnApplyColumns', 'click', () => {
            this.aplicarColumnasSeleccionadas();
        });

        this.addEventListener('closeStatsModal', 'click', () => {
            this.cerrarModal('statsModal');
        });

        // Eventos adicionales
        this.addEventListener('btnRefresh', 'click', () => {
            this.actualizarDatos();
        });

        this.addEventListener('btnFullscreen', 'click', () => {
            this.togglePantallaCompleta();
        });

        // Cerrar modales al hacer clic fuera
        this.addEventListener('columnModal', 'click', (e) => {
            if (e.target.id === 'columnModal') {
                this.cerrarModal('columnModal');
            }
        });

        this.addEventListener('statsModal', 'click', (e) => {
            if (e.target.id === 'statsModal') {
                this.cerrarModal('statsModal');
            }
        });

        // Eventos de teclado para accesibilidad
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.cerrarTodosLosModales();
            }
        });

        // Guardar configuración antes de cerrar
        window.addEventListener('beforeunload', () => {
            this.guardarConfiguracion();
        });
    }

    // Función helper para addEventListener con verificación
    addEventListener(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
        } else {
        }
    }
    async obtenerCostoPonderado(upc) {
        try {
            // Obtener ID de razón social seleccionada
            const idRazonSocial = document.getElementById('selectRazonSocial')?.value;
            
            if (!idRazonSocial) {
                return 0;
            }
            
            const connection = await odbc.connect(conexiondbfacturas);
            
            const query = `
                SELECT 
                    AVG(c.costofacturado) as CostoPromedio
                FROM cuadrecostos c
                WHERE c.FechaFactura >= DATE_FORMAT(CURDATE(), '%Y-01-01')
                AND c.FechaFactura <= CURDATE()
                AND c.Upc = ?
                AND c.IdRazonSocial = ?
                AND c.costofacturado IS NOT NULL
                AND c.costofacturado > 0
            `;
            
            const result = await connection.query(query, [upc, idRazonSocial]);
            await connection.close();
            
            // Si no encuentra datos o el resultado es null, retornar 0
            if (!result || result.length === 0 || !result[0].CostoPromedio) {
                return 0;
            }
            
            return parseFloat(result[0].CostoPromedio) || 0;
            
        } catch (error) {
            return 0;
        }
    }
    async obtenerCostosPonderadosLote(upcs) {
        if (!upcs || upcs.length === 0) return {};
        
        try {
            // Obtener ID de razón social seleccionada
            const idRazonSocial = document.getElementById('selectRazonSocial')?.value;
            
            if (!idRazonSocial) {
                // Retornar todos en 0
                const costosPonderados = {};
                upcs.forEach(upc => {
                    costosPonderados[upc] = 0;
                });
                return costosPonderados;
            }
            
            const connection = await odbc.connect(conexiondbfacturas);
            
            // Crear lista de parámetros para la consulta IN
            const placeholders = upcs.map(() => '?').join(',');
            
            const query = `
                SELECT 
                    c.Upc,
                    AVG(c.costofacturado) as CostoPromedio,
                    COUNT(*) as TotalRegistros
                FROM cuadrecostos c
                WHERE c.FechaFactura >= DATE_FORMAT(CURDATE(), '%Y-01-01')
                AND c.FechaFactura <= CURDATE()
                AND c.Upc IN (${placeholders})
                AND c.IdRazonSocial = ?
                AND c.costofacturado IS NOT NULL
                AND c.costofacturado > 0
                GROUP BY c.Upc
            `;
            
            // Combinar parámetros: UPCs + IdRazonSocial
            const parametros = [...upcs, idRazonSocial];
            
            const result = await connection.query(query, parametros);
            await connection.close();
            
            // Crear mapa de UPC -> CostoPromedio
            const costosPonderados = {};
            
            // Inicializar todos los UPCs en 0
            upcs.forEach(upc => {
                costosPonderados[upc] = 0;
            });
            
            // Actualizar con los valores encontrados
            result.forEach(row => {
                costosPonderados[row.Upc] = parseFloat(row.CostoPromedio) || 0;
            });
            
            return costosPonderados;
            
        } catch (error) {
            // En caso de error, retornar todos en 0
            const costosPonderados = {};
            upcs.forEach(upc => {
                costosPonderados[upc] = 0;
            });
            return costosPonderados;
        }
    }
    // Cargar razones sociales optimizada
    async cargarRazonesSociales() {
        try {
            this.mostrarLoadingGlobal('Cargando razones sociales...');
            
            const connection = await odbc.connect(conexiondbsucursal);
            const query = `
                SELECT 
                    razonessociales.Id, 
                    razonessociales.NombreRazon
                FROM razonessociales
                ORDER BY razonessociales.NombreRazon
            `;
            const result = await connection.query(query);
            await connection.close();

            const select = document.getElementById('selectRazonSocial');
            if (select) {
                select.innerHTML = '<option value="">Seleccione...</option>';

                result.forEach(row => {
                    const option = document.createElement('option');
                    option.value = row.Id;
                    option.textContent = row.NombreRazon;
                    select.appendChild(option);
                });
            }

            this.ocultarLoadingGlobal();

        } catch (error) {
            this.ocultarLoadingGlobal();
            this.mostrarToast('Error al cargar razones sociales', 'error');
        }
    }

    // Evento cuando cambia la razón social optimizado
    async onRazonSocialChange(idRazonSocial) {
        const selectSucursales = document.getElementById('selectSucursales');
        
        if (!selectSucursales) return;
        
        if (!idRazonSocial) {
            selectSucursales.innerHTML = '<option value="">Todas</option>';
            selectSucursales.disabled = true;
            this.sucursalesInfo = [];
            return;
        }

        try {
            this.mostrarLoadingGlobal('Cargando sucursales y bodegas...');
            
            const connection = await odbc.connect(conexiondbsucursal);
            
            // MODIFICAR: Agregar Puerto, TipoSucursal y RazonSocial a la query
            const query = `
                SELECT idSucursal, NombreSucursal, serverr, databasee, Uid, Pwd, Puerto, TipoSucursal, RazonSocial
                FROM sucursales 
                WHERE (RazonSocial = ? OR (RazonSocial = 0 AND TipoSucursal = 3))
                AND Activo = 1 
                ORDER BY NombreSucursal
            `;
            
            const result = await connection.query(query, [idRazonSocial]);
            await connection.close();

            this.sucursalesInfo = result;

            selectSucursales.innerHTML = '<option value="">Todas</option>';
            result.forEach(sucursal => {
                const option = document.createElement('option');
                option.value = sucursal.idSucursal;
                // Determinar tipo basado en TipoSucursal
                const esBodega = sucursal.TipoSucursal === 3 || sucursal.TipoSucursal === '3';
                option.textContent = esBodega ? `🏭 ${sucursal.NombreSucursal}` : `🏪 ${sucursal.NombreSucursal}`;
                
                // Agregar datos de conexión como data attributes, incluyendo el puerto
                option.dataset.serverr = sucursal.serverr;
                option.dataset.databasee = sucursal.databasee;
                option.dataset.uid = sucursal.Uid;
                option.dataset.pwd = sucursal.Pwd;
                option.dataset.puerto = sucursal.Puerto; // Agregar el puerto
                option.dataset.tipoSucursal = sucursal.TipoSucursal;
                option.dataset.razonSocial = sucursal.RazonSocial;
                
                selectSucursales.appendChild(option);
            });

            selectSucursales.disabled = false;
            this.ocultarLoadingGlobal();
            
            // Separar sucursales y bodegas para el mensaje
            const sucursales = result.filter(s => s.TipoSucursal !== 3 && s.TipoSucursal !== '3');
            const bodegas = result.filter(s => s.TipoSucursal === 3 || s.TipoSucursal === '3');
            this.mostrarToast(`${sucursales.length} sucursales + ${bodegas.length} bodegas cargadas`, 'success');

        } catch (error) {
            this.ocultarLoadingGlobal();
            this.mostrarToast('Error al cargar sucursales y bodegas', 'error');
            selectSucursales.disabled = true;
        }
    }

    // Generar reporte optimizado con paralelización
    async generarReporteOptimizado() {
        const idRazonSocial = document.getElementById('selectRazonSocial')?.value;
    
        if (!idRazonSocial) {
            this.mostrarToast('Debe seleccionar una razón social', 'warning');
            return;
        }

        if (this.sucursalesInfo.length === 0) {
            this.mostrarToast('No hay sucursales disponibles', 'warning');
            return;
        }

        if (this.esProcesandoReporte) {
            this.mostrarToast('Ya hay un reporte en proceso', 'info');
            return;
        }

        try {
            this.esProcesandoReporte = true;
            this.tiempoInicio = Date.now();
            this.resetearMetricas();
            
            // NUEVO: Deshabilitar controles al inicio
            this.deshabilitarControles();
            this.habilitarSoloLimpiar();
            
            // Mostrar progreso y preparar estado
            this.mostrarProgresoCompacto();
            this.prepararProcesamiento();
            
            console.log(`🚀 Iniciando reporte para ${this.sucursalesInfo.length} sucursales`);
            
            // Fase 1: Validar conexiones (20% del progreso)
            this.actualizarProgresoDetallado(5, 'Validando conexiones...', '');
            const sucursalesValidas = await this.validarConexionesEnLote();
            
            if (sucursalesValidas.length === 0) {
                throw new Error('No se pudo conectar a ninguna sucursal');
            }

            // Fase 2: Procesar sucursales en paralelo (60% del progreso)
            this.actualizarProgresoDetallado(20, 'Procesando sucursales...', '');
            await this.procesarSucursalesEnParalelo(sucursalesValidas);
            
            // Fase 3: Consolidar y finalizar (20% del progreso)
            this.actualizarProgresoDetallado(80, 'Consolidando datos...', '');
            await this.finalizarReporteOptimizado();
            
            // NUEVO: Habilitar controles al finalizar exitosamente
            this.habilitarControles();
            this.esProcesandoReporte = false;
            
        } catch (error) {
            // NUEVO: Habilitar controles en caso de error también
            this.habilitarControles();
            this.esProcesandoReporte = false;
            this.ocultarProgresoCompacto();
            console.error('❌ Error al generar reporte:', error);
            this.mostrarToast(`Error: ${error.message}`, 'error');
        }
    }

    // Preparar el estado para procesamiento
    prepararProcesamiento() {
        this.datosReporte = [];
        this.columnas = ['upc', 'upcPaquete', 'cantidad', 'descripcion', 'costo', 'precio', 'departamento']; // AGREGAR 'precio'
        this.estadoProcesamiento.clear();
        this.sucursalesCompletadas = 0;
        this.totalSucursales = this.sucursalesInfo.length;
        this.productosAcumulados = 0;
        
        // AGREGAR: Mostrar progreso por sucursales
        this.mostrarProgresoPorSucursales();
        
        // Ocultar resultados anteriores
        this.ocultarResultados();
    }

    // Resetear métricas de performance
    resetearMetricas() {
        this.metricas = {
            tiempoTotal: 0,
            sucursalesExitosas: 0,
            sucursalesConError: 0,
            productosSegundo: 0,
            erroresConexion: []
        };
    }
    deshabilitarControles() {
        const elementosADeshabilitar = [
            'selectRazonSocial',
            'selectSucursales', 
            'btnGenerarReporte',
            'btnProbarConexiones'
        ];
        
        elementosADeshabilitar.forEach(elementId => {
            const elemento = document.getElementById(elementId);
            if (elemento) {
                elemento.disabled = true;
                
                // Agregar clase visual para mostrar que está deshabilitado
                if (elemento.tagName === 'SELECT') {
                    elemento.style.opacity = '0.5';
                    elemento.style.cursor = 'not-allowed';
                } else if (elemento.tagName === 'BUTTON') {
                    elemento.classList.add('loading');
                    // Cambiar texto del botón de generar
                    if (elementId === 'btnGenerarReporte') {
                        elemento.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Procesando...';
                    }
                }
            }
        });
        const btnCancelar = document.getElementById('btnCancelar');
        if (btnCancelar) {
            btnCancelar.style.display = 'inline-flex';
        }
        console.log('🔒 Controles deshabilitados durante procesamiento');
    }

    // Habilitar controles después del procesamiento
    habilitarControles() {
        const elementosAHabilitar = [
            'selectRazonSocial',
            'selectSucursales',
            'btnGenerarReporte', 
            'btnProbarConexiones'
        ];
        
        elementosAHabilitar.forEach(elementId => {
            const elemento = document.getElementById(elementId);
            if (elemento) {
                elemento.disabled = false;
                
                // Restaurar estilos visuales
                if (elemento.tagName === 'SELECT') {
                    elemento.style.opacity = '';
                    elemento.style.cursor = '';
                } else if (elemento.tagName === 'BUTTON') {
                    elemento.classList.remove('loading');
                    // Restaurar texto del botón de generar
                    if (elementId === 'btnGenerarReporte') {
                        elemento.innerHTML = '<i class="fas fa-play"></i> Generar';
                    }
                }
            }
        });
        const btnCancelar = document.getElementById('btnCancelar');
        if (btnCancelar) {
            btnCancelar.style.display = 'none';
        }
        console.log('🔓 Controles habilitados nuevamente');
    }
    habilitarSoloLimpiar() {
        const btnLimpiar = document.getElementById('btnLimpiar');
        if (btnLimpiar) {
            btnLimpiar.disabled = false;
            btnLimpiar.style.opacity = '';
            btnLimpiar.style.cursor = '';
            // Resaltar el botón limpiar
            btnLimpiar.style.boxShadow = '0 0 10px rgba(239, 68, 68, 0.3)';
            btnLimpiar.style.borderColor = '#ef4444';
        }
    }
    // Validar conexiones en lote optimizado
    async validarConexionesEnLote() {
        const sucursalesValidas = [];
        const errores = [];
        
        // AGREGAR: Mostrar lista de progreso al inicio
        this.mostrarProgresoPorSucursales();
        
        // Procesar validaciones en paralelo (máximo 5 simultáneas)
        const BATCH_VALIDATION = 5;
        
        for (let i = 0; i < this.sucursalesInfo.length; i += BATCH_VALIDATION) {
            const lote = this.sucursalesInfo.slice(i, i + BATCH_VALIDATION);
            const progreso = 5 + ((i / this.sucursalesInfo.length) * 15);
            
            this.actualizarProgresoDetallado(
                progreso, 
                'Validando conexiones...', 
                `Verificando ${lote.map(s => s.NombreSucursal).join(', ')}`
            );
            
            const promesasValidacion = lote.map(async (sucursal) => {
                // AGREGAR: Actualizar estado visual por sucursal
                this.actualizarEstadoSucursal(sucursal.idSucursal, 'validando');
                
                try {
                    const esValida = await this.validarConexionSucursal(sucursal);
                    return { sucursal, esValida, error: null };
                } catch (error) {
                    return { sucursal, esValida: false, error };
                }
            });
            
            const resultados = await Promise.allSettled(promesasValidacion);
            
            resultados.forEach(resultado => {
                if (resultado.status === 'fulfilled') {
                    const { sucursal, esValida, error } = resultado.value;
                    if (esValida) {
                        sucursalesValidas.push(sucursal);
                        this.estadoProcesamiento.set(sucursal.idSucursal, 'validada');
                        // No cambiar estado visual aquí, se cambiará en procesamiento
                    } else {
                        errores.push(`${sucursal.NombreSucursal}: ${error?.message || 'Error de conexión'}`);
                        // AGREGAR: Actualizar estado visual de error
                        this.actualizarEstadoSucursal(sucursal.idSucursal, 'error');
                        this.metricas.erroresConexion.push({
                            sucursal: sucursal.NombreSucursal,
                            error: error?.message || 'Error de conexión'
                        });
                    }
                }
            });
        }
        
        if (errores.length > 0) {
            this.mostrarToast(`${errores.length} sucursales no disponibles`, 'warning');
        }
        return sucursalesValidas;
    }

    // Función debounce para optimizar búsquedas
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // Configurar paginación inicial
    configurarPaginacion() {
        this.totalPaginas = Math.ceil(this.totalRegistros / this.registrosPorPagina);
    }

    // Inicializar estado vacío
    inicializarEstadoVacio() {
        this.mostrarEstadoVacio();
    }

    // Mostrar estado vacío
    mostrarEstadoVacio() {
        const emptyState = document.getElementById('emptyState');
        const resultsMain = document.getElementById('resultsMain');
        
        if (emptyState && resultsMain) {
            emptyState.style.display = 'flex';
            resultsMain.style.display = 'none';
        }
    }

    // Ocultar estado vacío y mostrar resultados
    mostrarResultados() {
        const emptyState = document.getElementById('emptyState');
        const resultsMain = document.getElementById('resultsMain');
        
        if (emptyState && resultsMain) {
            emptyState.style.display = 'none';
            resultsMain.style.display = 'flex';
        }
    }

    // Ocultar resultados
    ocultarResultados() {
        const resultsMain = document.getElementById('resultsMain');
        if (resultsMain) {
            resultsMain.style.display = 'none';
        }
    }

    // Cargar configuración guardada
    cargarConfiguracionGuardada() {
        try {
            const config = JSON.parse(localStorage.getItem('reporteProductosConfig') || '{}');
            
            if (config.registrosPorPagina) {
                this.registrosPorPagina = config.registrosPorPagina;
                const pageSize = document.getElementById('pageSize');
                if (pageSize) {
                    pageSize.value = config.registrosPorPagina;
                }
            }
        } catch (error) {
        }
    }

    // Guardar configuración
    guardarConfiguracion() {
        try {
            const config = {
                registrosPorPagina: this.registrosPorPagina,
                ultimaActualizacion: Date.now()
            };
            
            localStorage.setItem('reporteProductosConfig', JSON.stringify(config));
        } catch (error) {
        }
    }
}
ReporteProductosGlobales.prototype.procesarSucursalesEnParalelo = async function(sucursalesValidas) {
    this.totalSucursales = sucursalesValidas.length;
    this.sucursalesCompletadas = 0;
    
    // Procesar en lotes para evitar sobrecarga
    for (let i = 0; i < sucursalesValidas.length; i += CONFIG.BATCH_SIZE) {
        const lote = sucursalesValidas.slice(i, i + CONFIG.BATCH_SIZE);
        const numeroLote = Math.floor(i / CONFIG.BATCH_SIZE) + 1;
        const totalLotes = Math.ceil(sucursalesValidas.length / CONFIG.BATCH_SIZE);
        // Procesar lote en paralelo
        const promesasLote = lote.map(async (sucursal, indiceEnLote) => {
            const indiceGlobal = i + indiceEnLote;
            return this.procesarSucursalOptimizada(sucursal, indiceGlobal);
        });
        
        // Esperar a que termine el lote completo
        const resultados = await Promise.allSettled(promesasLote);
        
        // Procesar resultados del lote
        resultados.forEach((resultado, indiceEnLote) => {
            const sucursal = lote[indiceEnLote];
            if (resultado.status === 'fulfilled') {
                this.consolidarResultadoSucursal(resultado.value, sucursal);
                this.metricas.sucursalesExitosas++;
            } else {
                this.metricas.sucursalesConError++;
                this.metricas.erroresConexion.push({
                    sucursal: sucursal.NombreSucursal,
                    error: resultado.reason.message
                });
            }
            this.sucursalesCompletadas++;
        });
        
        // Actualizar progreso después de cada lote
        const progresoBase = 20; // Ya validamos las conexiones
        const progresoActual = progresoBase + ((this.sucursalesCompletadas / this.totalSucursales) * 60);
        const tiempoTranscurrido = (Date.now() - this.tiempoInicio) / 1000;
        const velocidad = this.productosAcumulados / tiempoTranscurrido;
        
        this.actualizarProgresoDetallado(
            progresoActual,
            `Procesando lote ${numeroLote}/${totalLotes}`,
            `${this.sucursalesCompletadas}/${this.totalSucursales} sucursales • ${this.productosAcumulados.toLocaleString()} productos • ${velocidad.toFixed(0)} prod/seg`
        );
        
        // Pequeña pausa entre lotes para no saturar
        if (i + CONFIG.BATCH_SIZE < sucursalesValidas.length) {
            await this.esperar(100);
        }
    }
};

// Procesar una sucursal específica optimizada
ReporteProductosGlobales.prototype.procesarSucursalOptimizada = async function(sucursal, indice) {
    const inicioSucursal = Date.now();
    this.estadoProcesamiento.set(sucursal.idSucursal, 'procesando');
    
    // Actualizar estado visual
    this.actualizarEstadoSucursal(sucursal.idSucursal, 'procesando');
    
    try {
        const connectionConfig = {
            host: sucursal.serverr,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            port: sucursal.Puerto || 3306, // Usar el puerto de la sucursal o 3306 por defecto
            connectTimeout: CONFIG.TIMEOUT_CONNECTION,
            acquireTimeout: CONFIG.TIMEOUT_CONNECTION,
            timeout: CONFIG.TIMEOUT_QUERY,
            reconnect: true,
            charset: 'utf8mb4',
            supportBigNumbers: true,
            bigNumberStrings: true
        };
        
        const connection = await mysql.createConnection(connectionConfig);
        
        // Obtener ID de razón social seleccionada
        const idRazonSocial = document.getElementById('selectRazonSocial')?.value;
        
        // Determinar si es bodega
        const esBodega = sucursal.TipoSucursal === 3 || sucursal.TipoSucursal === '3';
        
        let query;
        
        if (esBodega) {
            // Para bodegas: NO incluir campos de costo ni precio
            const campoExistencia = `p.Existencia_${idRazonSocial}`;
            
            query = `
                SELECT 
                    p.Upc, 
                    pp.UPCPaquete, 
                    pp.Cantidad, 
                    p.DescLarga, 
                    0 as Costo,
                    0 as Precio,
                    ${campoExistencia} as Existencia, 
                    d.Nombre as NombreDepartamento
                FROM productos p
                LEFT JOIN productospaquetes pp ON p.Upc = pp.UPC
                LEFT JOIN departamentos d ON p.IdDepartamentos = d.Id
                WHERE p.Upc IS NOT NULL 
                AND p.DescLarga IS NOT NULL
                ORDER BY p.Upc
            `;
        } else {
            // Para sucursales: SÍ incluir campos de costo y precio
            const campoPrecio = idRazonSocial === '3' ? 'p.PrecioA' : 'p.Precio';
            const campoExistencia = 'p.Existencia';
            
            query = `
                SELECT 
                    p.Upc, 
                    pp.UPCPaquete, 
                    pp.Cantidad, 
                    p.DescLarga, 
                    p.Costo,
                    ${campoPrecio} as Precio,
                    ${campoExistencia} as Existencia, 
                    d.Nombre as NombreDepartamento
                FROM productos p
                LEFT JOIN productospaquetes pp ON p.Upc = pp.UPC
                LEFT JOIN departamentos d ON p.IdDepartamentos = d.Id
                WHERE p.Upc IS NOT NULL 
                AND p.DescLarga IS NOT NULL
                ORDER BY p.Upc
            `;
        }
        const [result] = await connection.execute(query);
        await connection.end();
        
        const tiempoSucursal = (Date.now() - inicioSucursal) / 1000;
        const productosEncontrados = result.length;
        
        this.estadoProcesamiento.set(sucursal.idSucursal, 'completada');
        
        // Actualizar estado visual con cantidad de productos
        this.actualizarEstadoSucursal(sucursal.idSucursal, 'completada', productosEncontrados);
        return {
            sucursal,
            productos: result,
            tiempo: tiempoSucursal,
            cantidad: productosEncontrados,
            esBodega: esBodega
        };
        
    } catch (error) {
        this.estadoProcesamiento.set(sucursal.idSucursal, 'error');
        this.actualizarEstadoSucursal(sucursal.idSucursal, 'error');
        throw new Error(`${sucursal.NombreSucursal}: ${error.message}`);
    }
};

// Consolidar resultado de una sucursal
ReporteProductosGlobales.prototype.consolidarResultadoSucursal = function(resultado, sucursal) {
    const { productos, esBodega } = resultado;
    this.productosAcumulados += productos.length;
    
    // Crear nombre de columna con indicador de tipo
    const nombreColumnaSucursal = `existencia_${sucursal.NombreSucursal.replace(/\s+/g, '_')}`;
    
    if (!this.columnas.includes(nombreColumnaSucursal)) {
        this.columnas.push(nombreColumnaSucursal);
    }
    
    if (this.datosReporte.length === 0) {
        // Primera sucursal: inicializar datos
        this.datosReporte = productos.map(producto => this.crearProductoLimpio(producto, nombreColumnaSucursal, esBodega));
    } else {
        // Sucursales siguientes: consolidar datos
        this.consolidarDatosSucursalOptimizada(productos, nombreColumnaSucursal, esBodega);
    }
    
    // Log para debugging
    const tipoLog = esBodega ? 'Bodega (solo existencias)' : 'Sucursal (costo+precio+existencias)';
};

// Crear producto limpio y optimizado
ReporteProductosGlobales.prototype.crearProductoLimpio = function(producto, nombreColumnaSucursal, esBodega = false) {
    const costo = esBodega ? 0 : this.parseNumeroSeguro(producto.Costo);
    const precio = esBodega ? 0 : this.parseNumeroSeguro(producto.Precio);
    
    return {
        upc: (producto.Upc || '').toString().trim(),
        upcPaquete: (producto.UPCPaquete || '').toString().trim(),
        cantidad: this.parseNumeroSeguro(producto.Cantidad),
        descripcion: (producto.DescLarga || '').toString().trim(),
        costo: costo,
        precio: precio,
        departamento: (producto.NombreDepartamento || '').toString().trim(),
        [nombreColumnaSucursal]: this.parseNumeroSeguro(producto.Existencia)
    };
};

// Consolidar datos de sucursales adicionales optimizada
ReporteProductosGlobales.prototype.consolidarDatosSucursalOptimizada = function(productos, nombreColumnaSucursal,esBodega = false) {
    // Crear mapa de productos existentes para búsqueda O(1)
    const mapaExistentes = new Map();
    this.datosReporte.forEach((producto, index) => {
        mapaExistentes.set(producto.upc, index);
    });
    
    // Inicializar existencia de esta sucursal en productos existentes
    this.datosReporte.forEach(producto => {
        producto[nombreColumnaSucursal] = 0;
    });
    
    // Procesar productos de la sucursal actual
    productos.forEach(producto => {
        const upc = (producto.Upc || '').toString().trim();
        const indiceExistente = mapaExistentes.get(upc);
        
        if (indiceExistente !== undefined) {
            // Producto existe: actualizar existencia
            this.datosReporte[indiceExistente][nombreColumnaSucursal] = this.parseNumeroSeguro(producto.Existencia);
            
            // Solo actualizar costo/precio si NO es bodega y los valores actuales son 0
            if (!esBodega) {
                const costoNuevo = this.parseNumeroSeguro(producto.Costo);
                const precioNuevo = this.parseNumeroSeguro(producto.Precio);
                
                // Actualizar solo si el producto actual no tiene costo/precio o si el nuevo es mayor que 0
                if (this.datosReporte[indiceExistente].costo === 0 && costoNuevo > 0) {
                    this.datosReporte[indiceExistente].costo = costoNuevo;
                }
                if (this.datosReporte[indiceExistente].precio === 0 && precioNuevo > 0) {
                    this.datosReporte[indiceExistente].precio = precioNuevo;
                }
            }
        } else {
            // Producto nuevo: agregarlo
            const nuevoProducto = this.crearProductoLimpio(producto, nombreColumnaSucursal, esBodega);
            
            // Agregar existencias en 0 para sucursales anteriores
            this.columnas.forEach(columna => {
                if (columna.startsWith('existencia_') && columna !== nombreColumnaSucursal) {
                    nuevoProducto[columna] = 0;
                }
            });
            
            this.datosReporte.push(nuevoProducto);
            // Actualizar el mapa para futuras búsquedas
            mapaExistentes.set(upc, this.datosReporte.length - 1);
        }
    });
};

// Parse seguro de números
ReporteProductosGlobales.prototype.parseNumeroSeguro = function(valor) {
    if (valor === null || valor === undefined || valor === '') return 0;
    const numero = parseFloat(valor);
    return isNaN(numero) ? 0 : numero;
};

// Finalizar reporte optimizado
ReporteProductosGlobales.prototype.finalizarReporteOptimizado = async function() {
    // Pequeña pausa para mostrar 80% antes de finalizar
    await this.esperar(200);
    
    this.actualizarProgresoDetallado(85, 'Organizando datos...', 'Preparando tabla de resultados');
    
    // Preparar datos para visualización
    this.datosOriginales = [...this.datosReporte];
    this.datosFiltrados = [...this.datosReporte];
    this.totalRegistros = this.datosReporte.length;
    this.paginaActual = 1;
    this.configurarPaginacion();
    
    await this.esperar(200);
    this.actualizarProgresoDetallado(90, 'Generando interfaz...', 'Creando tabla de resultados');
    
    // Generar interfaz
    this.generarTablaOptimizada();
    
    await this.esperar(200);
    this.actualizarProgresoDetallado(95, 'Aplicando estilos...', 'Finalizando presentación');
    
    // Actualizar información del reporte
    this.actualizarInfoReporteOptimizada();
    
    await this.esperar(200);
    this.actualizarProgresoDetallado(100, 'Completado', 'Reporte generado exitosamente');
    
    // Mostrar resultados
    setTimeout(() => {
        this.ocultarProgresoCompacto();
        this.mostrarResultados();
        this.actualizarTablaOptimizada();
        
        // Mostrar toast de éxito con estadísticas
        const tiempoTotal = (Date.now() - this.tiempoInicio) / 1000;
        this.metricas.tiempoTotal = tiempoTotal;
        this.metricas.productosSegundo = this.totalRegistros / tiempoTotal;
        
        this.mostrarToast(
            `✅ Reporte completado: ${this.totalRegistros.toLocaleString()} productos de ${this.metricas.sucursalesExitosas} sucursales en ${tiempoTotal.toFixed(1)}s`,
            'success'
        );
    }, 500);
};

// Validar conexión de sucursal optimizada
ReporteProductosGlobales.prototype.validarConexionSucursal = async function(sucursal) {
    try {
        const connectionConfig = {
            host: sucursal.serverr,
            database: sucursal.databasee,
            user: sucursal.Uid,
            password: sucursal.Pwd,
            port: sucursal.Puerto || 3306, // Usar el puerto de la sucursal o 3306 por defecto
            connectTimeout: 10000,
            acquireTimeout: 10000,
            timeout: 15000
        };
        
        const connection = await mysql.createConnection(connectionConfig);
        await connection.execute('SELECT 1 as test');
        await connection.end();
        return true;
    } catch (error) {
        return false;
    }
};

// Probar conexiones de sucursales con interfaz mejorada
ReporteProductosGlobales.prototype.probarConexionesSucursales = async function() {
    const idRazonSocial = document.getElementById('selectRazonSocial')?.value;
    
    if (!idRazonSocial) {
        this.mostrarToast('Seleccione una razón social primero', 'warning');
        return;
    }

    if (this.sucursalesInfo.length === 0) {
        this.mostrarToast('No hay sucursales disponibles', 'warning');
        return;
    }

    try {
        this.mostrarLoadingGlobal('Probando conexiones...');
        
        const resultados = [];
        const tiempoInicio = Date.now();
        
        // Probar conexiones en paralelo (máximo 5 simultáneas)
        const BATCH_SIZE_TEST = 5;
        for (let i = 0; i < this.sucursalesInfo.length; i += BATCH_SIZE_TEST) {
            const lote = this.sucursalesInfo.slice(i, i + BATCH_SIZE_TEST);
            
            const promesasPrueba = lote.map(async (sucursal) => {
                const inicioPrueba = Date.now();
                try {
                    const esValida = await this.validarConexionSucursal(sucursal);
                    const tiempoPrueba = Date.now() - inicioPrueba;
                    return {
                        nombre: sucursal.NombreSucursal,
                        servidor: sucursal.serverr,
                        baseDatos: sucursal.databasee,
                        estado: esValida ? 'Conectado' : 'Error',
                        tiempo: tiempoPrueba,
                        icono: esValida ? '✅' : '❌',
                        clase: esValida ? 'success' : 'error'
                    };
                } catch (error) {
                    const tiempoPrueba = Date.now() - inicioPrueba;
                    return {
                        nombre: sucursal.NombreSucursal,
                        servidor: sucursal.serverr,
                        baseDatos: sucursal.databasee,
                        estado: 'Error',
                        tiempo: tiempoPrueba,
                        error: error.message,
                        icono: '❌',
                        clase: 'error'
                    };
                }
            });
            
            const resultadosLote = await Promise.allSettled(promesasPrueba);
            resultadosLote.forEach(resultado => {
                if (resultado.status === 'fulfilled') {
                    resultados.push(resultado.value);
                }
            });
        }
        
        const tiempoTotal = Date.now() - tiempoInicio;
        const exitosas = resultados.filter(r => r.estado === 'Conectado').length;
        
        this.ocultarLoadingGlobal();
        
        // Mostrar resultados en modal personalizado
        this.mostrarResultadosConexion(resultados, tiempoTotal, exitosas);
        
    } catch (error) {
        this.ocultarLoadingGlobal();
        this.mostrarToast('Error al probar conexiones', 'error');
    }
};

// Mostrar resultados de conexión en modal
ReporteProductosGlobales.prototype.mostrarResultadosConexion = function(resultados, tiempoTotal, exitosas) {
    const resultadosHTML = `
        <div class="connection-results">
            <div class="results-summary">
                <div class="summary-card success">
                    <div class="summary-number">${exitosas}</div>
                    <div class="summary-label">Exitosas</div>
                </div>
                <div class="summary-card error">
                    <div class="summary-number">${resultados.length - exitosas}</div>
                    <div class="summary-label">Con Error</div>
                </div>
                <div class="summary-card info">
                    <div class="summary-number">${(tiempoTotal / 1000).toFixed(1)}s</div>
                    <div class="summary-label">Tiempo Total</div>
                </div>
            </div>
            
            <div class="results-list">
                ${resultados.map(r => `
                    <div class="result-item ${r.clase}">
                        <div class="result-header">
                            <span class="result-icon">${r.icono}</span>
                            <span class="result-name">${r.nombre}</span>
                            <span class="result-time">${r.tiempo}ms</span>
                        </div>
                        <div class="result-details">
                            <small>🖥️ ${r.servidor} • 🗄️ ${r.baseDatos}</small>
                            ${r.error ? `<small class="error-msg">❌ ${r.error}</small>` : ''}
                        </div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    Swal.fire({
        title: '🔌 Prueba de Conexiones',
        html: resultadosHTML,
        icon: 'info',
        confirmButtonColor: '#2563eb',
        width: '700px',
        customClass: {
            popup: 'connection-test-modal'
        }
    });
};

// Función helper para esperar
ReporteProductosGlobales.prototype.esperar = function(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
};

// Actualizar información del reporte optimizada
ReporteProductosGlobales.prototype.actualizarInfoReporteOptimizada = function() {
    const tiempoTotal = this.metricas.tiempoTotal || (Date.now() - this.tiempoInicio) / 1000;
    const ahora = new Date();
    
    this.actualizarElementoTexto('totalProductos', this.totalRegistros.toLocaleString());
    this.actualizarElementoTexto('sucursalesProcesadas', this.metricas.sucursalesExitosas);
    this.actualizarElementoTexto('tiempoProceso', `${tiempoTotal.toFixed(1)}s`);
    this.actualizarElementoTexto('ultimaActualizacion', ahora.toLocaleTimeString());
};

// Helper para actualizar texto de elemento
ReporteProductosGlobales.prototype.actualizarElementoTexto = function(elementId, texto) {
    const elemento = document.getElementById(elementId);
    if (elemento) {
        elemento.textContent = texto;
    }
};
ReporteProductosGlobales.prototype.mostrarToast = function(mensaje, tipo = 'info', duracion = CONFIG.TOAST_DURATION) {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toastId = 'toast_' + Date.now();
    const iconos = {
        success: 'fas fa-check-circle',
        error: 'fas fa-exclamation-circle',
        warning: 'fas fa-exclamation-triangle',
        info: 'fas fa-info-circle'
    };
    
    const toast = document.createElement('div');
    toast.id = toastId;
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 12px;">
            <i class="${iconos[tipo] || iconos.info}" style="font-size: 18px;"></i>
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 2px;">${mensaje}</div>
                <div style="font-size: 12px; opacity: 0.8;">${new Date().toLocaleTimeString()}</div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; cursor: pointer; padding: 4px;">
                <i class="fas fa-times" style="opacity: 0.6;"></i>
            </button>
        </div>
    `;
    
    toastContainer.appendChild(toast);
    
    // Auto-remover después de la duración especificada
    setTimeout(() => {
        if (document.getElementById(toastId)) {
            toast.style.animation = 'slideOutRight 0.3s ease-in forwards';
            setTimeout(() => toast.remove(), 300);
        }
    }, duracion);
};

// Mostrar/Ocultar progreso compacto
ReporteProductosGlobales.prototype.mostrarProgresoCompacto = function() {
    const progressCompact = document.getElementById('progressCompact');
    if (progressCompact) {
        progressCompact.style.display = 'block';
    }
};

ReporteProductosGlobales.prototype.ocultarProgresoCompacto = function() {
    const progressCompact = document.getElementById('progressCompact');
    if (progressCompact) {
        progressCompact.style.display = 'none';
    }
};

// Actualizar progreso detallado
ReporteProductosGlobales.prototype.actualizarProgresoDetallado = function(porcentaje, titulo, detalles) {
    this.actualizarElementoTexto('progressTitle', titulo);
    this.actualizarElementoTexto('progressDetails', detalles);
    this.actualizarElementoTexto('progressPercentage', `${Math.round(porcentaje)}%`);
    
    const progressFill = document.getElementById('progressFillSlim');
    if (progressFill) {
        progressFill.style.width = `${porcentaje}%`;
    }
};

// Loading global optimizado
ReporteProductosGlobales.prototype.mostrarLoadingGlobal = function(mensaje = 'Cargando...') {
    const loadingGlobal = document.getElementById('loadingGlobal');
    const loadingMessage = document.getElementById('loadingMessage');
    
    if (loadingGlobal) {
        loadingGlobal.style.display = 'block';
    }
    if (loadingMessage) {
        loadingMessage.textContent = mensaje;
    }
};

ReporteProductosGlobales.prototype.ocultarLoadingGlobal = function() {
    const loadingGlobal = document.getElementById('loadingGlobal');
    if (loadingGlobal) {
        loadingGlobal.style.display = 'none';
    }
};

// Generar tabla optimizada
ReporteProductosGlobales.prototype.generarTablaOptimizada = function() {
    const thead = document.getElementById('tableHeaders');
    if (!thead) return;
    
    thead.innerHTML = '';
    
    // Encabezados básicos
    const encabezadosBasicos = {
        upc: 'UPC',
        upcPaquete: 'UPC Paquete',
        cantidad: 'Cantidad',
        descripcion: 'Descripción',
        costo: 'Costo',
        precio: 'Precio', // NUEVO
        departamento: 'Departamento'
    };
    
    // Agregar encabezados básicos
    Object.entries(encabezadosBasicos).forEach(([key, label]) => {
        const th = document.createElement('th');
        th.className = 'sortable';
        th.setAttribute('data-column', key);
        th.innerHTML = `
            <div class="header-content">
                <span>${label}</span>
                <i class="fas fa-sort"></i>
            </div>
        `;
        th.addEventListener('click', () => this.ordenarTablaOptimizada(key));
        thead.appendChild(th);
    });
    
    // Agregar encabezados de existencias por sucursal
    this.sucursalesInfo.forEach(sucursal => {
        const nombreColumna = `existencia_${sucursal.NombreSucursal.replace(/\s+/g, '_')}`;
        const th = document.createElement('th');
        th.className = 'sortable';
        th.setAttribute('data-column', nombreColumna);
        th.innerHTML = `
            <div class="header-content">
                <span>${sucursal.NombreSucursal}</span>
                <i class="fas fa-sort"></i>
            </div>
        `;
        th.addEventListener('click', () => this.ordenarTablaOptimizada(nombreColumna));
        thead.appendChild(th);
    });
};

// Actualizar tabla optimizada con scroll virtual
ReporteProductosGlobales.prototype.actualizarTablaOptimizada = function() {
    const tbody = document.getElementById('resultsTableBody');
    if (!tbody) return;
    
    tbody.innerHTML = '';
    
    // Mostrar loading si es necesario
    if (this.datosFiltrados.length > CONFIG.MAX_ROWS_VIRTUAL_SCROLL) {
        this.mostrarLoadingTabla();
    }
    
    // Calcular rango de datos para la página actual
    const inicio = (this.paginaActual - 1) * this.registrosPorPagina;
    const fin = Math.min(inicio + this.registrosPorPagina, this.datosFiltrados.length);
    const datosPagina = this.datosFiltrados.slice(inicio, fin);
    
    // Generar filas optimizadas
    const fragment = document.createDocumentFragment();
    
    datosPagina.forEach((producto, index) => {
        const tr = document.createElement('tr');
        tr.className = 'fade-in';
        tr.style.animationDelay = `${index * 20}ms`;
        
        // Agregar celdas básicas
        ['upc', 'upcPaquete', 'cantidad', 'descripcion', 'costo', 'precio', 'departamento'].forEach(columna => {
            const td = document.createElement('td');
            
            if (columna === 'costo' || columna === 'precio') { // AGREGAR || columna === 'precio'
                td.textContent = this.formatearMoneda(producto[columna]);
                td.setAttribute('data-type', 'number');
            } else if (columna === 'cantidad') {
                td.textContent = this.formatearNumero(producto[columna]);
                td.setAttribute('data-type', 'number');
            } else if (columna === 'descripcion') {
                td.textContent = producto[columna] || '';
                td.title = producto[columna] || '';
            } else {
                td.textContent = producto[columna] || '';
            }
            
            // Resaltar búsqueda
            if (this.terminoBusqueda && td.textContent.toLowerCase().includes(this.terminoBusqueda.toLowerCase())) {
                td.innerHTML = this.resaltarTexto(td.textContent, this.terminoBusqueda);
            }
            
            tr.appendChild(td);
        });
        
        // Agregar celdas de existencias
        this.sucursalesInfo.forEach(sucursal => {
            const nombreColumna = `existencia_${sucursal.NombreSucursal.replace(/\s+/g, '_')}`;
            const td = document.createElement('td');
            const existencia = producto[nombreColumna] || 0;
            
            td.textContent = this.formatearNumero(existencia);
            td.setAttribute('data-type', 'number');
            
            // Agregar clases de color según existencia
            if (existencia > 0) {
                td.style.color = 'var(--success-color)';
                td.style.fontWeight = '600';
            } else {
                td.style.color = 'var(--text-muted)';
            }
            
            tr.appendChild(td);
        });
        
        fragment.appendChild(tr);
    });
    
    tbody.appendChild(fragment);
    
    // Ocultar loading y actualizar controles
    this.ocultarLoadingTabla();
    this.actualizarPaginacionOptimizada();
    this.actualizarContadorBusqueda();
};

// Mostrar/Ocultar loading de tabla
ReporteProductosGlobales.prototype.mostrarLoadingTabla = function() {
    const tableLoading = document.getElementById('tableLoading');
    if (tableLoading) {
        tableLoading.style.display = 'flex';
    }
};

ReporteProductosGlobales.prototype.ocultarLoadingTabla = function() {
    const tableLoading = document.getElementById('tableLoading');
    if (tableLoading) {
        tableLoading.style.display = 'none';
    }
};

// Búsqueda optimizada en tabla
ReporteProductosGlobales.prototype.buscarEnTablaOptimizada = function(termino) {
    this.terminoBusqueda = termino;
    
    if (!termino) {
        this.datosFiltrados = [...this.datosOriginales];
    } else {
        const terminoLower = termino.toLowerCase();
        this.datosFiltrados = this.datosOriginales.filter(producto => {
            return Object.values(producto).some(valor => 
                valor && valor.toString().toLowerCase().includes(terminoLower)
            );
        });
    }
    
    this.totalRegistros = this.datosFiltrados.length;
    this.paginaActual = 1;
    this.actualizarTablaOptimizada();
};

// Actualizar contador de búsqueda
ReporteProductosGlobales.prototype.actualizarContadorBusqueda = function() {
    const searchCounter = document.getElementById('searchCounter');
    if (searchCounter) {
        if (this.terminoBusqueda) {
            searchCounter.textContent = `${this.datosFiltrados.length} encontrados`;
            searchCounter.style.display = 'block';
        } else {
            searchCounter.style.display = 'none';
        }
    }
};

// Ordenar tabla optimizada
ReporteProductosGlobales.prototype.ordenarTablaOptimizada = function(columna) {
    if (this.ordenActual.columna === columna) {
        this.ordenActual.direccion = this.ordenActual.direccion === 'asc' ? 'desc' : 'asc';
    } else {
        this.ordenActual.columna = columna;
        this.ordenActual.direccion = 'asc';
    }
    
    this.datosFiltrados.sort((a, b) => {
        let valorA = a[columna] || '';
        let valorB = b[columna] || '';
        
        // Conversión numérica si es necesario
        if (typeof valorA === 'string' && !isNaN(valorA)) valorA = parseFloat(valorA);
        if (typeof valorB === 'string' && !isNaN(valorB)) valorB = parseFloat(valorB);
        
        let resultado = 0;
        if (valorA < valorB) resultado = -1;
        else if (valorA > valorB) resultado = 1;
        
        return this.ordenActual.direccion === 'asc' ? resultado : -resultado;
    });
    
    this.actualizarIndicadoresOrdenOptimizada();
    this.actualizarTablaOptimizada();
};

// Actualizar indicadores de orden
ReporteProductosGlobales.prototype.actualizarIndicadoresOrdenOptimizada = function() {
    document.querySelectorAll('.sortable').forEach(th => {
        th.classList.remove('asc', 'desc');
    });
    
    const thActual = document.querySelector(`[data-column="${this.ordenActual.columna}"]`);
    if (thActual) {
        thActual.classList.add(this.ordenActual.direccion);
    }
};

// Paginación optimizada
ReporteProductosGlobales.prototype.actualizarPaginacionOptimizada = function() {
    this.totalPaginas = Math.ceil(this.datosFiltrados.length / this.registrosPorPagina);
    
    // Actualizar información
    const inicio = (this.paginaActual - 1) * this.registrosPorPagina + 1;
    const fin = Math.min(this.paginaActual * this.registrosPorPagina, this.datosFiltrados.length);
    
    this.actualizarElementoTexto('showingFrom', this.datosFiltrados.length > 0 ? inicio : 0);
    this.actualizarElementoTexto('showingTo', fin);
    this.actualizarElementoTexto('totalRows', this.datosFiltrados.length.toLocaleString());
    this.actualizarElementoTexto('totalPages', this.totalPaginas);
    
    // Actualizar input de página actual
    const currentPageInput = document.getElementById('currentPageInput');
    if (currentPageInput) {
        currentPageInput.value = this.paginaActual;
        currentPageInput.max = this.totalPaginas;
    }
    
    // Actualizar estado de botones
    this.actualizarBotonEstado('btnFirstPage', this.paginaActual === 1);
    this.actualizarBotonEstado('btnPrevPage', this.paginaActual === 1);
    this.actualizarBotonEstado('btnNextPage', this.paginaActual === this.totalPaginas || this.totalPaginas === 0);
    this.actualizarBotonEstado('btnLastPage', this.paginaActual === this.totalPaginas || this.totalPaginas === 0);
};

// Helper para actualizar estado de botones
ReporteProductosGlobales.prototype.actualizarBotonEstado = function(buttonId, disabled) {
    const button = document.getElementById(buttonId);
    if (button) {
        button.disabled = disabled;
    }
};

// Navegación de páginas
ReporteProductosGlobales.prototype.irAPagina = function(pagina) {
    if (pagina < 1 || pagina > this.totalPaginas) return;
    this.paginaActual = pagina;
    this.actualizarTablaOptimizada();
};

// Exportar Excel optimizado
ReporteProductosGlobales.prototype.exportarExcel = async function() {
    if (!this.datosReporte || this.datosReporte.length === 0) {
        this.mostrarToast('No hay datos para exportar', 'warning');
        return;
    }
    
    try {
        this.mostrarLoadingGlobal('Generando archivo Excel...');
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Reporte Productos');
        
        // Configurar encabezados (agregando Costo Ponderado)
        const encabezados = [
            'UPC', 'UPC Paquete', 'Cantidad', 'Descripción', 'Costo', 'Precio', 'Costo Ponderado', 'Departamento',
            ...this.sucursalesInfo.map(s => s.NombreSucursal)
        ];
        
        const headerRow = worksheet.addRow(encabezados);
        
        // Estilo de encabezados
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2563EB' }
        };
        
        // Obtener ID de razón social seleccionada
        const idRazonSocial = document.getElementById('selectRazonSocial')?.value;
        
        if (!idRazonSocial) {
            this.mostrarToast('Error: No hay razón social seleccionada', 'error');
            this.ocultarLoadingGlobal();
            return;
        }
        
        this.mostrarLoadingGlobal('Calculando costos ponderados...');
        
        // Obtener todos los UPCs únicos
        const upcsUnicos = [...new Set(this.datosReporte.map(p => p.upc))].filter(upc => upc && upc.trim());
        
        // Obtener costos ponderados en lotes para optimizar
        const BATCH_SIZE_COSTOS = 500; // Procesar de 500 en 500
        const costosPonderados = {};
        
        for (let i = 0; i < upcsUnicos.length; i += BATCH_SIZE_COSTOS) {
            const loteUPCs = upcsUnicos.slice(i, i + BATCH_SIZE_COSTOS);
            const progresoCostos = ((i + loteUPCs.length) / upcsUnicos.length) * 30; // 30% del progreso total
            
            this.mostrarLoadingGlobal(`Calculando costos ponderados... ${progresoCostos.toFixed(0)}%`);
            
            const costosLote = await this.obtenerCostosPonderadosLote(loteUPCs);
            Object.assign(costosPonderados, costosLote);
            
            // Pequeña pausa para no bloquear la UI
            await this.esperar(10);
        }
        
        const productosConCostoEncontrados = Object.keys(costosPonderados).filter(k => costosPonderados[k] > 0).length;
        // Agregar datos con costo ponderado
        const totalFilas = this.datosReporte.length;
        const batchSize = 1000;
        
        for (let i = 0; i < totalFilas; i += batchSize) {
            const batch = this.datosReporte.slice(i, i + batchSize);
            const progresoBase = 30; // Ya usamos 30% para costos ponderados
            const progreso = progresoBase + ((i + batch.length) / totalFilas) * 70;
            
            this.mostrarLoadingGlobal(`Procesando datos... ${progreso.toFixed(0)}%`);
            
            batch.forEach(producto => {
                const costoPonderado = costosPonderados[producto.upc] || 0;
                
                const fila = [
                    producto.upc,
                    producto.upcPaquete,
                    producto.cantidad,
                    producto.descripcion,
                    producto.costo,
                    producto.precio,
                    costoPonderado, // Costo Ponderado específico por razón social
                    producto.departamento,
                    ...this.sucursalesInfo.map(sucursal => {
                        const nombreColumna = `existencia_${sucursal.NombreSucursal.replace(/\s+/g, '_')}`;
                        return producto[nombreColumna] || 0;
                    })
                ];
                worksheet.addRow(fila);
            });
            
            // Pequeña pausa para no bloquear la UI
            await this.esperar(10);
        }
        
        // Ajustar ancho de columnas
        worksheet.columns.forEach((column, index) => {
            if (index < 4) {
                column.width = 20; // UPC, UPC Paquete, Cantidad, Descripción
            } else if (index === 4 || index === 5 || index === 6) {
                column.width = 18; // Costo, Precio, Costo Ponderado
            } else if (index === 7) {
                column.width = 25; // Departamento
            } else {
                column.width = 15; // Sucursales
            }
        });
        
        // Formatear columnas de dinero
        worksheet.getColumn(5).numFmt = '"Q"#,##0.00';  // Costo
        worksheet.getColumn(6).numFmt = '"Q"#,##0.00';  // Precio
        worksheet.getColumn(7).numFmt = '"Q"#,##0.00';  // Costo Ponderado
        
        // Agregar filtros automáticos
        worksheet.autoFilter = {
            from: 'A1',
            to: worksheet.getCell(1, encabezados.length).address
        };
        
        // Congelar primera fila
        worksheet.views = [
            {
                state: 'frozen',
                xSplit: 0,
                ySplit: 1,
                topLeftCell: 'A2'
            }
        ];
        
        // Agregar hoja de resumen
        const resumenSheet = workbook.addWorksheet('Resumen');
        const ahora = new Date();
        const razonSocialText = document.getElementById('selectRazonSocial').selectedOptions[0]?.text || 'N/A';
        
        resumenSheet.addRow(['REPORTE DE PRODUCTOS GLOBALES - RESUMEN']);
        resumenSheet.addRow([]);
        resumenSheet.addRow(['Fecha de generación:', ahora.toLocaleString()]);
        resumenSheet.addRow(['Razón Social:', razonSocialText]);
        resumenSheet.addRow(['ID Razón Social:', idRazonSocial]);
        resumenSheet.addRow(['Total productos:', totalFilas.toLocaleString()]);
        resumenSheet.addRow(['Sucursales procesadas:', this.sucursalesInfo.length]);
        resumenSheet.addRow(['Productos con costo ponderado:', productosConCostoEncontrados.toLocaleString()]);
        resumenSheet.addRow(['Porcentaje con costo ponderado:', `${((productosConCostoEncontrados / upcsUnicos.length) * 100).toFixed(1)}%`]);
        resumenSheet.addRow([]);
        resumenSheet.addRow(['SUCURSALES INCLUIDAS:']);
        
        this.sucursalesInfo.forEach((sucursal, index) => {
            const esBodega = sucursal.TipoSucursal === 3 || sucursal.TipoSucursal === '3';
            resumenSheet.addRow([`${index + 1}.`, sucursal.NombreSucursal, esBodega ? '(Bodega)' : '(Sucursal)']);
        });
        
        // Estilo para hoja de resumen
        resumenSheet.getCell('A1').font = { bold: true, size: 16 };
        resumenSheet.getCell('A1').fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2563EB' }
        };
        resumenSheet.getCell('A1').font.color = { argb: 'FFFFFFFF' };
        
        // Generar y descargar archivo
        this.mostrarLoadingGlobal('Descargando archivo...');
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Reporte_Productos_CostoPonderado_RS${idRazonSocial}_${new Date().toISOString().split('T')[0]}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
        
        this.ocultarLoadingGlobal();
        
        // Mostrar estadísticas del resultado
        const porcentajeCostos = ((productosConCostoEncontrados / upcsUnicos.length) * 100).toFixed(1);
        this.mostrarToast(
            `✅ Excel exportado: ${totalFilas.toLocaleString()} productos (${productosConCostoEncontrados} con costo ponderado - ${porcentajeCostos}%)`, 
            'success'
        );
    } catch (error) {
        this.ocultarLoadingGlobal();
        this.mostrarToast(`Error al exportar Excel: ${error.message}`, 'error');
    }
};
// Calcular estadísticas avanzadas
ReporteProductosGlobales.prototype.calcularEstadisticasAvanzadas = function() {
    const totalProductos = this.datosReporte.length;
    const productosConExistencia = this.datosReporte.filter(p => {
        return this.sucursalesInfo.some(sucursal => {
            const nombreColumna = `existencia_${sucursal.NombreSucursal.replace(/\s+/g, '_')}`;
            return (p[nombreColumna] || 0) > 0;
        });
    }).length;
    
    const departamentos = [...new Set(this.datosReporte.map(p => p.departamento))].filter(d => d);
    const costoPromedio = this.datosReporte.reduce((sum, p) => sum + (p.costo || 0), 0) / totalProductos;
    
    const existenciasPorSucursal = this.sucursalesInfo.map(sucursal => {
        const nombreColumna = `existencia_${sucursal.NombreSucursal.replace(/\s+/g, '_')}`;
        const totalExistencia = this.datosReporte.reduce((sum, p) => sum + (p[nombreColumna] || 0), 0);
        return {
            sucursal: sucursal.NombreSucursal,
            existencia: totalExistencia
        };
    });
    
    const maxExistencia = Math.max(...existenciasPorSucursal.map(s => s.existencia));
    
    return {
        totalProductos,
        productosConExistencia,
        porcentajeConExistencia: ((productosConExistencia / totalProductos) * 100).toFixed(1),
        departamentos,
        costoPromedio,
        existenciasPorSucursal,
        maxExistencia
    };
};

// Funciones de modal
ReporteProductosGlobales.prototype.cerrarModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
};

ReporteProductosGlobales.prototype.cerrarTodosLosModales = function() {
    this.cerrarModal('columnModal');
    this.cerrarModal('statsModal');
};

// Limpiar formulario optimizado
ReporteProductosGlobales.prototype.limpiarFormulario = function() {
    if (this.esProcesandoReporte) {
        this.esProcesandoReporte = false;
        console.log('🛑 Procesamiento cancelado por usuario');
        this.mostrarToast('Procesamiento cancelado', 'warning');
    }
    
    // NUEVO: Habilitar todos los controles
    this.habilitarControles();
    
    // Limpiar selects
    this.actualizarElementoValor('selectRazonSocial', '');
    this.actualizarElementoValor('selectSucursales', '');
    this.actualizarElementoValor('searchInput', '');
    
    // Deshabilitar sucursales
    const selectSucursales = document.getElementById('selectSucursales');
    if (selectSucursales) {
        selectSucursales.disabled = true;
    }
    
    // Ocultar secciones
    this.ocultarProgresoCompacto();
    this.ocultarProgresoPorSucursales();
    this.mostrarEstadoVacio();
    
    // Reiniciar datos
    this.datosReporte = [];
    this.sucursalesInfo = [];
    this.datosOriginales = [];
    this.datosFiltrados = [];
    this.terminoBusqueda = '';
    this.totalRegistros = 0;
    this.paginaActual = 1;
    
    // Restaurar estado del botón limpiar
    const btnLimpiar = document.getElementById('btnLimpiar');
    if (btnLimpiar) {
        btnLimpiar.style.boxShadow = '';
        btnLimpiar.style.borderColor = '';
    }
    
    console.log('🧹 Formulario limpiado y controles habilitados');
    this.mostrarToast('Formulario limpiado', 'info');
};

// Helper para actualizar valor de elemento
ReporteProductosGlobales.prototype.actualizarElementoValor = function(elementId, valor) {
    const elemento = document.getElementById(elementId);
    if (elemento) {
        elemento.value = valor;
    }
};

// Funciones de formateo
ReporteProductosGlobales.prototype.formatearMoneda = function(valor) {
    return new Intl.NumberFormat('es-GT', {
        style: 'currency',
        currency: 'GTQ'
    }).format(valor || 0);
};

ReporteProductosGlobales.prototype.formatearNumero = function(valor) {
    return new Intl.NumberFormat('es-GT').format(valor || 0);
};

// Resaltar texto en búsqueda
ReporteProductosGlobales.prototype.resaltarTexto = function(texto, termino) {
    if (!termino) return texto;
    const regex = new RegExp(`(${termino})`, 'gi');
    return texto.replace(regex, '<mark style="background-color: #fef08a; padding: 1px 2px; border-radius: 2px; font-weight: 600;">$1</mark>');
};

// Modal de configuración de columnas
ReporteProductosGlobales.prototype.mostrarModalColumnas = function() {
    const modal = document.getElementById('columnModal');
    const columnsList = document.getElementById('columnsList');
    
    if (!modal || !columnsList) return;
    
    columnsList.innerHTML = '';
    
    // Generar lista de columnas
    const todasLasColumnas = [
        { key: 'upc', label: 'UPC', obligatoria: true },
        { key: 'upcPaquete', label: 'UPC Paquete', obligatoria: false },
        { key: 'cantidad', label: 'Cantidad', obligatoria: false },
        { key: 'descripcion', label: 'Descripción', obligatoria: true },
        { key: 'costo', label: 'Costo', obligatoria: false },
        { key: 'departamento', label: 'Departamento', obligatoria: false },
        ...this.sucursalesInfo.map(sucursal => ({
            key: `existencia_${sucursal.NombreSucursal.replace(/\s+/g, '_')}`,
            label: sucursal.NombreSucursal,
            obligatoria: false
        }))
    ];
    
    todasLasColumnas.forEach(columna => {
        const div = document.createElement('div');
        div.className = 'column-item';
        div.innerHTML = `
            <input type="checkbox" id="col_${columna.key}" value="${columna.key}" 
                   ${columna.obligatoria ? 'checked disabled' : 'checked'}>
            <label for="col_${columna.key}">
                ${columna.label}
                ${columna.obligatoria ? '<small style="color: var(--text-muted);"> (requerida)</small>' : ''}
            </label>
        `;
        columnsList.appendChild(div);
    });
    
    modal.style.display = 'flex';
};

// Aplicar columnas seleccionadas
ReporteProductosGlobales.prototype.aplicarColumnasSeleccionadas = function() {
    const checkboxes = document.querySelectorAll('#columnsList input[type="checkbox"]');
    const columnasOcultas = [];
    
    checkboxes.forEach((checkbox, index) => {
        const columna = checkbox.value;
        const mostrar = checkbox.checked;
        
        // Encontrar las columnas correspondientes en la tabla
        const thElements = document.querySelectorAll(`th[data-column="${columna}"]`);
        const columnIndex = index;
        
        // Mostrar/ocultar columnas
        thElements.forEach(th => {
            th.style.display = mostrar ? '' : 'none';
        });
        
        // Mostrar/ocultar celdas de datos
        document.querySelectorAll(`#resultsTableBody tr`).forEach(tr => {
            const td = tr.cells[columnIndex];
            if (td) {
                td.style.display = mostrar ? '' : 'none';
            }
        });
        
        if (!mostrar) {
            columnasOcultas.push(columna);
        }
    });
    
    this.cerrarModal('columnModal');
    
    if (columnasOcultas.length > 0) {
        this.mostrarToast(`${columnasOcultas.length} columnas ocultadas`, 'info');
    }
};

// Pantalla completa
ReporteProductosGlobales.prototype.togglePantallaCompleta = function() {
    const tableContainer = document.getElementById('tableContainer');
    if (!tableContainer) return;
    
    if (!document.fullscreenElement) {
        tableContainer.requestFullscreen().then(() => {
            this.mostrarToast('Modo pantalla completa activado', 'info');
        }).catch(err => {
        });
    } else {
        document.exitFullscreen().then(() => {
            this.mostrarToast('Modo pantalla completa desactivado', 'info');
        });
    }
};

// Actualizar datos (refrescar)
ReporteProductosGlobales.prototype.actualizarDatos = function() {
    if (this.esProcesandoReporte) {
        this.mostrarToast('Ya hay un proceso en ejecución', 'warning');
        return;
    }
    
    const razonSocial = document.getElementById('selectRazonSocial')?.value;
    if (razonSocial && this.datosReporte.length > 0) {
        this.mostrarToast('Actualizando datos...', 'info');
        this.generarReporteOptimizado();
    } else {
        this.mostrarToast('Seleccione una razón social primero', 'warning');
    }
};

// Funciones adicionales de utilidad
ReporteProductosGlobales.prototype.exportarDatosFiltrados = function(formato = 'excel') {
    if (!this.datosFiltrados || this.datosFiltrados.length === 0) {
        this.mostrarToast('No hay datos filtrados para exportar', 'warning');
        return;
    }
    
    // Confirmar exportación de datos filtrados
    Swal.fire({
        title: '📤 Exportar Datos Filtrados',
        html: `
            <p>¿Exportar solo los datos filtrados?</p>
            <div style="margin: 15px 0; padding: 10px; background: #f0f9ff; border-radius: 6px;">
                <strong>${this.datosFiltrados.length.toLocaleString()}</strong> productos filtrados
                <br><small>de ${this.datosOriginales.length.toLocaleString()} productos totales</small>
            </div>
        `,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Exportar Filtrados',
        cancelButtonText: 'Exportar Todos',
        confirmButtonColor: '#2563eb'
    }).then((result) => {
        if (result.isConfirmed) {
            // Exportar solo filtrados
            const datosOriginalesTemp = this.datosReporte;
            this.datosReporte = this.datosFiltrados;
            
            if (formato === 'excel') {
                this.exportarExcel();
            } else {
            }
            
            this.datosReporte = datosOriginalesTemp;
        } else if (result.dismiss === Swal.DismissReason.cancel) {
            // Exportar todos
            if (formato === 'excel') {
                this.exportarExcel();
            } else {
            }
        }
    });
};

// Función de backup automático
ReporteProductosGlobales.prototype.crearBackupDatos = function() {
    if (this.datosReporte.length === 0) return;
    
    try {
        const backup = {
            timestamp: Date.now(),
            datos: this.datosReporte,
            sucursales: this.sucursalesInfo.map(s => s.NombreSucursal),
            totalProductos: this.datosReporte.length,
            version: '2.0'
        };
        
        localStorage.setItem('reporteBackup', JSON.stringify(backup));
    } catch (error) {
    }
};

// Recuperar backup
ReporteProductosGlobales.prototype.recuperarBackup = function() {
    try {
        const backup = JSON.parse(localStorage.getItem('reporteBackup') || '{}');
        
        if (backup.datos && backup.datos.length > 0) {
            const fecha = new Date(backup.timestamp).toLocaleString();
            
            Swal.fire({
                title: '💾 Backup Disponible',
                html: `
                    <p>Se encontró un backup de datos:</p>
                    <div style="margin: 15px 0; padding: 10px; background: #f0f9ff; border-radius: 6px;">
                        <strong>${backup.totalProductos.toLocaleString()}</strong> productos
                        <br><strong>${backup.sucursales.length}</strong> sucursales
                        <br><small>Creado: ${fecha}</small>
                    </div>
                    <p>¿Desea restaurar estos datos?</p>
                `,
                icon: 'question',
                showCancelButton: true,
                confirmButtonText: 'Restaurar',
                cancelButtonText: 'Cancelar',
                confirmButtonColor: '#2563eb'
            }).then((result) => {
                if (result.isConfirmed) {
                    this.datosReporte = backup.datos;
                    this.datosOriginales = [...backup.datos];
                    this.datosFiltrados = [...backup.datos];
                    this.totalRegistros = backup.datos.length;
                    
                    this.mostrarResultados();
                    this.generarTablaOptimizada();
                    this.actualizarTablaOptimizada();
                    this.actualizarInfoReporteOptimizada();
                    
                    this.mostrarToast('✅ Datos restaurados desde backup', 'success');
                }
            });
        } else {
            this.mostrarToast('No hay backup disponible', 'info');
        }
    } catch (error) {
        this.mostrarToast('Error al recuperar backup', 'error');
    }
};

// Optimización de performance para dispositivos lentos
ReporteProductosGlobales.prototype.optimizarRendimiento = function() {
    // Detectar dispositivo lento
    const isSlowDevice = navigator.hardwareConcurrency <= 2 || 
                        navigator.deviceMemory <= 4 ||
                        /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isSlowDevice) {
        CONFIG.BATCH_SIZE = 2; // Reducir lotes paralelos
        CONFIG.TIMEOUT_CONNECTION = 45000; // Aumentar timeouts
        CONFIG.TIMEOUT_QUERY = 90000;
        this.registrosPorPagina = 25;
        this.mostrarToast('Optimizaciones aplicadas para mejor rendimiento', 'info');
    }
};

// Estadísticas de uso
ReporteProductosGlobales.prototype.trackearUso = function(accion, datos = {}) {
    try {
        const estadisticas = JSON.parse(localStorage.getItem('reporteStats') || '{}');
        
        if (!estadisticas[accion]) {
            estadisticas[accion] = 0;
        }
        estadisticas[accion]++;
        estadisticas.ultimaActividad = Date.now();
        
        localStorage.setItem('reporteStats', JSON.stringify(estadisticas));
    } catch (error) {
        // Silently fail - no critical
    }
};

// Limpieza de memoria
ReporteProductosGlobales.prototype.limpiarMemoria = function() {
    // Limpiar referencias grandes
    if (this.datosOriginales.length > 10000) {
        
        // Forzar garbage collection si está disponible
        if (window.gc) {
            window.gc();
        }
        
        // Limpiar cache
        this.cacheDepartamentos.clear();
        this.cacheProveedores.clear();
    }
};

// Validación de integridad de datos
ReporteProductosGlobales.prototype.validarIntegridadDatos = function() {
    if (this.datosReporte.length === 0) return true;
    
    let errores = 0;
    const muestra = this.datosReporte.slice(0, 100); // Validar muestra
    
    muestra.forEach((producto, index) => {
        // Validar UPC obligatorio
        if (!producto.upc || producto.upc.trim().length === 0) {
            errores++;
        }
        
        // Validar números
        if (isNaN(producto.costo) || isNaN(producto.cantidad)) {
            errores++;
        }
    });
    
    if (errores > 0) {
        this.mostrarToast(`${errores} productos con datos incompletos`, 'warning');
    }
    
    return errores === 0;
};

// Inicializar optimizaciones al cargar
document.addEventListener('DOMContentLoaded', () => {
    if (window.reporteApp) {
        window.reporteApp.optimizarRendimiento();
        
        // Crear backup automático cada 10 minutos si hay datos
        setInterval(() => {
            if (window.reporteApp.datosReporte.length > 0) {
                window.reporteApp.crearBackupDatos();
            }
        }, 600000);
        
        // Limpieza de memoria cada 5 minutos
        setInterval(() => {
            if (window.reporteApp.datosReporte.length > 0) {
                window.reporteApp.limpiarMemoria();
            }
        }, 300000);
    }
});

// Agregar estilos CSS adicionales para las estadísticas
const additionalStyles = `
<style>
.stats-grid {
    display: grid;
    gap: 20px;
}

.stats-section h5 {
    color: var(--text-primary);
    margin-bottom: 15px;
    font-size: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
}

.stats-items {
    display: grid;
    gap: 10px;
}

.stat-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--border-color);
}

.stat-label {
    color: var(--text-secondary);
    font-size: 14px;
}

.stat-value {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 14px;
}

.sucursales-stats {
    display: grid;
    gap: 10px;
}

.sucursal-stat {
    display: grid;
    grid-template-columns: 1fr 2fr auto;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
}

.sucursal-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-primary);
}

.sucursal-bar {
    height: 6px;
    background: var(--bg-tertiary);
    border-radius: 3px;
    overflow: hidden;
}

.sucursal-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--primary-color), var(--accent-color));
    border-radius: 3px;
    transition: width 0.3s ease;
}

.sucursal-value {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-secondary);
    text-align: right;
    min-width: 60px;
}

.connection-test-modal .connection-results {
    text-align: left;
}

.results-summary {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 15px;
    margin-bottom: 20px;
}

.summary-card {
    text-align: center;
    padding: 15px;
    border-radius: 8px;
    border: 2px solid;
}

.summary-card.success {
    background: var(--success-light);
    border-color: var(--success-color);
}

.summary-card.error {
    background: var(--error-light);
    border-color: var(--error-color);
}

.summary-card.info {
    background: var(--info-light);
    border-color: var(--info-color);
}

.summary-number {
    font-size: 24px;
    font-weight: 700;
    margin-bottom: 5px;
}

.summary-label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.results-list {
    max-height: 300px;
    overflow-y: auto;
}

.result-item {
    padding: 10px;
    margin-bottom: 8px;
    border-radius: 6px;
    border-left: 4px solid;
}

.result-item.success {
    background: var(--success-light);
    border-left-color: var(--success-color);
}

.result-item.error {
    background: var(--error-light);
    border-left-color: var(--error-color);
}

.result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 5px;
}

.result-name {
    font-weight: 600;
    font-size: 14px;
}

.result-time {
    font-size: 12px;
    color: var(--text-muted);
    font-family: var(--font-mono);
}

.result-details {
    font-size: 12px;
    color: var(--text-secondary);
}

.error-msg {
    color: var(--error-color);
    font-weight: 500;
    display: block;
    margin-top: 3px;
}
</style>
`;

// Inyectar estilos adicionales
if (!document.getElementById('additional-stats-styles')) {
    const styleElement = document.createElement('div');
    styleElement.id = 'additional-stats-styles';
    styleElement.innerHTML = additionalStyles;
    document.head.appendChild(styleElement);
}
ReporteProductosGlobales.prototype.mostrarProgresoPorSucursales = function() {
    const sucursalesProgressList = document.getElementById('sucursalesProgressList');
    const sucursalesItems = document.getElementById('sucursalesItems');
    
    if (!sucursalesProgressList || !sucursalesItems) return;
    
    // Generar items de sucursales
    sucursalesItems.innerHTML = '';
    
    this.sucursalesInfo.forEach(sucursal => {
        const item = document.createElement('div');
        item.className = 'sucursal-progress-item';
        item.id = `sucursal-item-${sucursal.idSucursal}`;
        
        // CORREGIR: Determinar si es bodega basado en TipoSucursal
        const esBodega = sucursal.TipoSucursal === 3 || sucursal.TipoSucursal === '3';
        const icono = esBodega ? '🏭' : '🏪';
        
        item.innerHTML = `
            <span class="sucursal-status-icon">⏳</span>
            <span class="sucursal-name">${icono} ${sucursal.NombreSucursal}</span>
            <span class="sucursal-products-count">-</span>
        `;
        
        // Agregar clase especial para bodegas
        if (esBodega) {
            item.classList.add('bodega-item');
        }
        
        sucursalesItems.appendChild(item);
    });
    
    sucursalesProgressList.style.display = 'block';
    
    // Debug: Mostrar info de las sucursales
    const bodegas = this.sucursalesInfo.filter(s => s.TipoSucursal === 3 || s.TipoSucursal === '3');
};

// Actualizar estado de sucursal específica
ReporteProductosGlobales.prototype.actualizarEstadoSucursal = function(idSucursal, estado, productosCount = null, campoExistencia = null) {
    const item = document.getElementById(`sucursal-item-${idSucursal}`);
    if (!item) return;
    
    const iconos = {
        'validando': '🔍',
        'procesando': '⚙️',
        'completada': '✅',
        'error': '❌'
    };
    
    // Actualizar clases y contenido
    item.className = `sucursal-progress-item ${estado}`;
    const icon = item.querySelector('.sucursal-status-icon');
    const count = item.querySelector('.sucursal-products-count');
    
    if (icon) icon.textContent = iconos[estado] || '⏳';
    if (count && productosCount !== null) {
        let texto = productosCount.toLocaleString();
        // Agregar info del campo de existencia si está disponible
        if (campoExistencia && estado === 'completada') {
            const campoCorto = campoExistencia.replace('p.', '');
            texto += ` (${campoCorto})`;
        }
        count.textContent = texto;
    }
};

// Ocultar progreso por sucursales
ReporteProductosGlobales.prototype.ocultarProgresoPorSucursales = function() {
    const sucursalesProgressList = document.getElementById('sucursalesProgressList');
    if (sucursalesProgressList) {
        sucursalesProgressList.style.display = 'none';
    }
};

// Inicializar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    try {
        window.reporteApp = new ReporteProductosGlobales();
    } catch (error) {
    }
});

// Manejo de errores globales mejorado
window.addEventListener('error', (event) => {
    if (window.reporteApp) {
        window.reporteApp.mostrarToast('Error inesperado en la aplicación', 'error');
    }
});

window.addEventListener('unhandledrejection', (event) => {
    if (window.reporteApp) {
        window.reporteApp.mostrarToast('Error de procesamiento', 'error');
    }
    event.preventDefault();
});