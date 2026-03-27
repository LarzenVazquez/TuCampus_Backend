A : Administrador General (Control total del sistema).

A_C : Admin de Cafetería (Gestión de inventario y pedidos de comida).

Al : Alumno (Usuario base, compras y navegación).

A_V : Alumno Vendedor (Alumno verificado para vender en Marketplace).


DROP DATABASE IF EXISTS tucampus_sql;
CREATE DATABASE tucampus_sql;
USE tucampus_sql;

-- 1. TABLA DE USUARIOS (Con lógica de siglas)
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    matricula VARCHAR(50) UNIQUE,
    rol ENUM('A', 'A_C', 'Al', 'A_V') NOT NULL DEFAULT 'Al',
    vendedor_verificado TINYINT(1) DEFAULT 0, -- 0: No, 1: Si
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_rol (rol)
);

-- 2. TABLA DE SESIONES (Tokens JWT)
CREATE TABLE sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) NOT NULL,
    expira_en DATETIME NOT NULL,
    CONSTRAINT fk_session_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- 3. TABLA DE ARCHIVOS (Evidencia de Vendedores / Imágenes)
CREATE TABLE user_files (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    url_archivo VARCHAR(255) NOT NULL,
    file_hash VARCHAR(64) NOT NULL,
    tipo_archivo VARCHAR(50),
    fecha_subida TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_files_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE CASCADE
);

-- 4. TABLA DE LOGS (Auditoría de acciones)
CREATE TABLE activity_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    accion VARCHAR(255) NOT NULL,
    descripcion TEXT,
    ip_address VARCHAR(45),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_logs_user FOREIGN KEY (user_id) 
        REFERENCES users(id) ON DELETE SET NULL
);
