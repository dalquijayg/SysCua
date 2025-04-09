const odbc = require('odbc');
const Swal = require('sweetalert2');

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('loginForm');
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const usernameInput = document.getElementById('username');
    const loginButton = document.querySelector('.login-button');

    // Efecto de animación para los inputs cuando se carga la página
    animateFormElements();

    // Alternar visibilidad de la contraseña
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.classList.toggle('fa-eye');
        togglePassword.classList.toggle('fa-eye-slash');
    });

    // Mostrar efecto de onda al hacer clic en el botón de login
    loginButton.addEventListener('mousedown', createRippleEffect);

    // Manejar envío del formulario
    loginForm.addEventListener('submit', handleLogin);

    // Si hay username guardado, recuperarlo
    const savedUsername = localStorage.getItem('lastUsername');
    if (savedUsername) {
        usernameInput.value = savedUsername;
        // Trigger para activar el efecto del label
        if (usernameInput.value) {
            const event = new Event('input', { bubbles: true });
            usernameInput.dispatchEvent(event);
        }
        // Enfocar el campo de contraseña automáticamente
        passwordInput.focus();
    } else {
        // Enfocar el campo de usuario
        usernameInput.focus();
    }
});

// Animar los elementos del formulario secuencialmente
function animateFormElements() {
    const elements = [
        document.querySelector('.logo-container'),
        document.querySelector('.welcome-text'),
        ...document.querySelectorAll('.input-group'),
        document.querySelector('.login-button'),
        document.querySelector('.version-info')
    ];

    elements.forEach((element, index) => {
        if (element) {
            element.style.opacity = '0';
            element.style.transform = 'translateY(20px)';
            element.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
            
            setTimeout(() => {
                element.style.opacity = '1';
                element.style.transform = 'translateY(0)';
            }, 100 + (index * 100));
        }
    });
}

// Crear efecto de onda al hacer clic en el botón de login
function createRippleEffect(event) {
    const button = event.currentTarget;
    
    const circle = document.createElement('span');
    const diameter = Math.max(button.clientWidth, button.clientHeight);
    const radius = diameter / 2;
    
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.left = `${event.clientX - button.offsetLeft - radius}px`;
    circle.style.top = `${event.clientY - button.offsetTop - radius}px`;
    circle.classList.add('ripple');
    
    const ripple = button.querySelector('.ripple');
    if (ripple) {
        ripple.remove();
    }
    
    button.appendChild(circle);
}

// Manejar el intento de inicio de sesión
async function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const loginButton = document.querySelector('.login-button');
    const buttonText = loginButton.querySelector('.button-text');
    const buttonIcon = loginButton.querySelector('.button-icon');
    
    if (!username || !password) {
        shakeForm();
        showErrorToast('Por favor complete todos los campos');
        return;
    }

    // Cambiar el botón a estado de carga
    buttonText.textContent = 'Verificando...';
    buttonIcon.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    loginButton.disabled = true;

    try {
        const connection = await odbc.connect('DSN=facturas');
        const user = await authenticateUser(connection, username, password);

        if (user) {
            // Guardar el nombre de usuario para la próxima vez
            localStorage.setItem('lastUsername', username);
            handleSuccessfulLogin(user);
        } else {
            // Restaurar el botón a su estado original
            buttonText.textContent = 'Iniciar Sesión';
            buttonIcon.innerHTML = '<i class="fas fa-arrow-right"></i>';
            loginButton.disabled = false;
            shakeForm();
        }

        await connection.close();
    } catch (error) {
        // Restaurar el botón a su estado original
        buttonText.textContent = 'Iniciar Sesión';
        buttonIcon.innerHTML = '<i class="fas fa-arrow-right"></i>';
        loginButton.disabled = false;
        handleLoginError(error);
        shakeForm();
    }
}

// Efecto de vibración para el formulario en caso de error
function shakeForm() {
    const loginForm = document.getElementById('loginForm');
    loginForm.classList.add('shake');
    setTimeout(() => {
        loginForm.classList.remove('shake');
    }, 800);
}

// Mostrar toast de error
function showErrorToast(message) {
    Swal.mixin({
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true,
        didOpen: (toast) => {
            toast.addEventListener('mouseenter', Swal.stopTimer);
            toast.addEventListener('mouseleave', Swal.resumeTimer);
        }
    }).fire({
        icon: 'error',
        title: message
    });
}

// Autenticar usuario
async function authenticateUser(connection, username, password) {
    const userExists = await connection.query('SELECT 1 FROM usuarios WHERE Usuario = ?', [username]);

    if (userExists.length === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Usuario no encontrado',
            text: 'El usuario ingresado no existe en el sistema.',
            confirmButtonColor: '#6e78ff'
        });
        return null;
    }

    const result = await connection.query(
        'SELECT Id, CONCAT(usuarios.Nombres, " ", usuarios.Apellidos) AS NombreCompleto, Activo, IdNivel FROM usuarios WHERE Usuario = ? AND Password = ?',
        [username, password]
    );

    if (result.length === 0) {
        Swal.fire({
            icon: 'error',
            title: 'Contraseña incorrecta',
            text: 'La contraseña ingresada es incorrecta. Por favor inténtelo nuevamente.',
            confirmButtonColor: '#6e78ff'
        });
        return null;
    }

    return result[0];
}

// Manejar inicio de sesión exitoso
function handleSuccessfulLogin(user) {
    console.log('Datos del usuario:', user);

    if (Number(user.Activo) !== 1) {
        Swal.fire({
            icon: 'error',
            title: 'Usuario desactivado',
            text: 'Tu cuenta está desactivada. Por favor contacta al administrador del sistema.',
            confirmButtonColor: '#6e78ff'
        });
        // Restaurar el botón a su estado original
        const buttonText = document.querySelector('.button-text');
        const buttonIcon = document.querySelector('.button-icon');
        const loginButton = document.querySelector('.login-button');
        buttonText.textContent = 'Iniciar Sesión';
        buttonIcon.innerHTML = '<i class="fas fa-arrow-right"></i>';
        loginButton.disabled = false;
    } else if (Number(user.IdNivel) !== 11 && Number(user.IdNivel) !== 30) {
        Swal.fire({
            icon: 'error',
            title: 'Acceso denegado',
            text: 'No tienes los permisos necesarios para acceder a esta aplicación.',
            confirmButtonColor: '#6e78ff'
        });
        // Restaurar el botón a su estado original
        const buttonText = document.querySelector('.button-text');
        const buttonIcon = document.querySelector('.button-icon');
        const loginButton = document.querySelector('.login-button');
        buttonText.textContent = 'Iniciar Sesión';
        buttonIcon.innerHTML = '<i class="fas fa-arrow-right"></i>';
        loginButton.disabled = false;
    } else {
        localStorage.setItem('userName', user.NombreCompleto);
        localStorage.setItem('userId', user.Id);
        
        // Actualizar texto del botón a "Accediendo..."
        const buttonText = document.querySelector('.button-text');
        buttonText.textContent = 'Accediendo...';
        
        // Mostrar mensaje de bienvenida con animación
        Swal.fire({
            icon: 'success',
            title: `¡Bienvenido, ${user.NombreCompleto}!`,
            text: 'Inicio de sesión exitoso.',
            showConfirmButton: false,
            timer: 2000,
            timerProgressBar: true,
            didOpen: () => {
                Swal.showLoading();
            }
        }).then(() => {
            // Animación de desvanecimiento antes de redirigir
            document.body.style.transition = 'opacity 0.5s ease';
            document.body.style.opacity = '0';
            
            setTimeout(() => {
                window.location.href = 'Menu.html';
            }, 500);
        });
    }
}

// Manejar error de inicio de sesión
function handleLoginError(error) {
    console.error('Error de conexión:', error);
    Swal.fire({
        icon: 'error',
        title: 'Error de conexión',
        text: 'No se pudo conectar a la base de datos. Por favor verifica tu conexión e inténtalo nuevamente.',
        confirmButtonColor: '#6e78ff'
    });
}