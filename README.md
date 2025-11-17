# Buscador Semántico - Juegos de Casino

Sistema de búsqueda semántica basado en ontologías OWL para juegos de casino, desarrollado con Node.js, Express y RDFLib.

## Características

- **Búsqueda Semántica**: Busca en la ontología utilizando texto libre
- **Exploración por Clases**: Navega por las clases de la ontología
- **Visualización de Instancias**: Ver todas las instancias y sus propiedades
- **Estadísticas**: Obtén información sobre la estructura de la ontología
- **API REST**: Endpoints RESTful para consumir la ontología
- **Interfaz Moderna**: UI responsive con Bootstrap 5

## Arquitectura del Proyecto

```
buscador_semantico_juegos_casino/
├── config/              # Configuraciones de la aplicación
│   └── constants.js     # Constantes y variables de entorno
├── controllers/         # Controladores de la lógica de negocio
│   └── ontologyController.js
├── services/           # Servicios de la aplicación
│   └── ontologyService.js
├── utils/              # Utilidades y helpers
│   ├── logger.js
│   └── responseHandler.js
├── routes/             # Definición de rutas
│   ├── index.js
│   ├── ontology.js
│   └── users.js
├── views/              # Vistas Pug
│   ├── layout.pug
│   ├── index.pug
│   └── error.pug
├── public/             # Archivos estáticos
│   ├── javascripts/
│   │   └── app.js
│   ├── stylesheets/
│   │   └── style.css
│   └── ontologia_35preguntas.owl
├── app.js              # Configuración principal de Express
├── package.json        # Dependencias del proyecto
└── .env               # Variables de entorno
```

## Instalación

### Requisitos Previos

- Node.js (v14 o superior)
- npm o yarn

### Pasos de Instalación

1. Clonar el repositorio o navegar a la carpeta del proyecto

2. Instalar dependencias:
```powershell
npm install
```

3. Configurar variables de entorno (ya está configurado en `.env`):
```env
PORT=3000
OWL_FILE_PATH=./public/ontologia_35preguntas.owl
ONTOLOGY_NAMESPACE=http://www.semanticweb.org/ontologies/juegos-casino#
```

4. Asegúrate de que tu archivo OWL esté en `public/ontologia_35preguntas.owl`

5. Iniciar el servidor:
```powershell
npm start
```

6. Abrir el navegador en: `http://localhost:3000`

## API REST Endpoints

### Obtener todas las clases
```
GET /api/ontology/classes
```

### Obtener instancias de una clase
```
GET /api/ontology/instances/:className
```

### Buscar por texto
```
GET /api/ontology/search?query=texto
```

### Obtener todas las propiedades
```
GET /api/ontology/properties
```

### Obtener estadísticas
```
GET /api/ontology/stats
```

### Recargar la ontología
```
POST /api/ontology/reload
```

## Tecnologías Utilizadas

### Backend
- **Express.js**: Framework web para Node.js
- **RDFLib**: Librería para trabajar con RDF/OWL
- **dotenv**: Gestión de variables de entorno
- **morgan**: Logger HTTP
- **cors**: Middleware de CORS

### Frontend
- **Pug**: Motor de plantillas
- **Bootstrap 5**: Framework CSS
- **Font Awesome**: Iconos
- **JavaScript Vanilla**: Lógica del cliente

## Estructura de Capas

### 1. **Routes** (Rutas)
Define los endpoints de la API y enruta las peticiones a los controladores correspondientes.

### 2. **Controllers** (Controladores)
Maneja las peticiones HTTP, valida datos y orquesta las llamadas a los servicios.

### 3. **Services** (Servicios)
Contiene la lógica de negocio principal y la interacción con la ontología OWL.

### 4. **Utils** (Utilidades)
Funciones auxiliares como logging, manejo de respuestas, etc.

### 5. **Config** (Configuración)
Centralizamos la configuración de la aplicación.

## Uso de la Aplicación

### Búsqueda por Texto
1. Ingresa un término en el campo de búsqueda
2. Presiona "Buscar" o Enter
3. Los resultados mostrarán todas las instancias que contengan el término

### Exploración por Clases
1. En el panel lateral "Filtros", haz clic en una clase
2. Se mostrarán todas las instancias de esa clase
3. Haz clic en "Ver Propiedades" para ver los detalles

### Ver Estadísticas
1. Haz clic en "Estadísticas" en el menú superior
2. Se mostrará un resumen de la ontología con clases y propiedades

## Personalización

### Cambiar la Ontología
1. Reemplaza el archivo `public/ontologia_35preguntas.owl` con tu ontología
2. Actualiza el `ONTOLOGY_NAMESPACE` en `.env` según tu ontología
3. Reinicia el servidor

### Modificar la UI
- **Estilos**: Edita `public/stylesheets/style.css`
- **Lógica del cliente**: Edita `public/javascripts/app.js`
- **Plantillas**: Edita los archivos en `views/`

## Solución de Problemas

### La ontología no carga
- Verifica que el archivo OWL existe en la ruta correcta
- Revisa los logs de consola para errores de parsing
- Asegúrate de que el formato del archivo es válido RDF/XML

### Errores de CORS
- El middleware CORS está habilitado por defecto
- Si necesitas configuración específica, edita `app.js`

### Puerto en uso
- Cambia el `PORT` en el archivo `.env`
- O cierra la aplicación que está usando el puerto 3000

## Recursos Adicionales

- [RDFLib Documentation](https://github.com/linkeddata/rdflib.js/)
- [Express.js Documentation](https://expressjs.com/)
- [Bootstrap 5 Documentation](https://getbootstrap.com/)
- [Protégé Documentation](https://protege.stanford.edu/)

## Licencia

Este proyecto está bajo la licencia MIT.

## Autor

Desarrollado para el sistema de búsqueda semántica de juegos de casino.

---

**¡Disfruta explorando tu ontología!**

