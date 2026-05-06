# Clínica Magna — Sistema de Gestión Dental

## Requisitos previos

Necesitas instalar **Node.js** (versión 18 o superior):
👉 Descarga desde: https://nodejs.org/es/ (elegir la versión LTS)

---

## Instalación y primera ejecución

Abre una terminal (PowerShell o CMD) en la carpeta del proyecto y ejecuta:

```bash
# 1. Instalar dependencias
npm install

# 2. Crear la base de datos SQLite y las tablas
npx prisma db push

# 3. Iniciar el servidor de desarrollo
npm run dev
```

Abre el navegador en **http://localhost:3000**

Al iniciar, haz clic en el botón **"Cargar datos demo"** en el Dashboard para poblar la base de datos con datos de prueba.

---

## Módulos disponibles

| Módulo | Descripción |
|--------|-------------|
| **Dashboard** | Resumen general: citas del día, estadísticas, pacientes recientes |
| **Pacientes** | Listado, búsqueda, ficha clínica, evoluciones, historial |
| **Agenda** | Calendario semanal, gestión de citas por box y profesional |
| **Presupuestos** | Creación de presupuestos con ítems, estados y seguimiento de pagos |
| **Finanzas** | Registro de cobros y gastos, resumen mensual por categoría |
| **Configuración** | Usuarios del sistema e info técnica |

---

## Comandos útiles

```bash
npm run dev          # Iniciar en modo desarrollo
npx prisma studio    # Explorar la base de datos visualmente (http://localhost:5555)
npx prisma db push   # Re-crear tablas (no borra datos si ya existen)
```

---

## Stack tecnológico

- **Next.js 14** (App Router)
- **Prisma ORM** + **SQLite** (base de datos local, archivo `prisma/dev.db`)
- **Tailwind CSS** (estilos)
- **TypeScript**
- **Lucide React** (íconos)
