# 💈 Demo archivada: plantilla web para barberías y estéticas

> Esta demo de HTML, CSS y JavaScript se conserva solo como referencia. La aplicación principal aprobada es Next.js y sus instrucciones están en el [README de la raíz](../README.md). No uses esta demo para cuentas ni datos reales.

Sistema web (prototipo funcional) para negocios de barbería y estética: agenda de citas, punto de venta en el local, panel de administración, empleados con permisos, programa de puntos, gráficas, gastos y más.

> **Estado:** demo archivada hecha con HTML, CSS y JavaScript puro. Sus datos se guardan solo en el navegador. La versión aprobada de Next.js está en la raíz; consulta el [README principal](../README.md). Esta demo no comparte cuentas ni datos con la aplicación principal.

---

## 📑 Contenido

1. [Archivos del proyecto](#1-archivos-del-proyecto)
2. [Cómo ejecutarlo](#2-cómo-ejecutarlo)
3. [Usuarios y roles](#3-usuarios-y-roles)
4. [Qué puede hacer cada rol](#4-qué-puede-hacer-cada-rol)
5. [Reglas de negocio importantes](#5-reglas-de-negocio-importantes)
6. [Cómo se guardan los datos](#6-cómo-se-guardan-los-datos)
7. [Mapa del código (`app.js`)](#7-mapa-del-código-appjs)
8. [Guía rápida de prueba](#8-guía-rápida-de-prueba)
9. [Limitaciones conocidas](#9-limitaciones-conocidas)
10. [Versión aprobada](#10-versión-aprobada)
11. [Cómo se creó (historial por etapas)](#11-cómo-se-creó-historial-por-etapas)

---

## 1. Archivos del proyecto

| Archivo | Para qué sirve |
|---|---|
| `demo/index.html` | Estructura de la página: encabezado, contenedor principal y enlaces a los otros archivos. |
| `demo/styles.css` | Estilos, modo claro y oscuro, colores y diseño responsivo. |
| `demo/app.js` | Toda la lógica del sistema (aprox. 65 mil caracteres, escrito de forma compacta). |
| `barberia-plantilla.html` | Versión de un solo archivo (los tres anteriores juntos). |

**Tecnologías:** HTML, CSS y JavaScript sin librerías externas. No necesita instalación ni servidor.

---

## 2. Cómo ejecutarlo

**Opción A: navegador.** Abre `demo/index.html` con doble clic.

**Opción B: Visual Studio Code.**
1. Abre la carpeta del proyecto (Archivo > Abrir carpeta).
2. Instala la extensión **Live Server**.
3. Clic derecho en `demo/index.html` > **Open with Live Server**.

**Consejos para revisar el código**
- Formatea `app.js` con **Shift + Alt + F** (o la extensión Prettier): al estar compacto, se lee mucho mejor.
- Usa **Ctrl + Shift + O** para saltar entre funciones.
- Para reiniciar la demo: F12 > Application > Local Storage > borra la clave `bshop2`.

---

## 3. Usuarios y roles

| Rol | Cómo entra | Cómo se crea |
|---|---|---|
| **Admin** | Usuario `admin` / contraseña `admin123` (demo) | Viene creado. |
| **Empleado** | Nombre de usuario y contraseña | Lo crea el admin en *Empleados y configuración*. |
| **Cliente** | Correo y contraseña | Se registra solo con "Crear cuenta". |

- Empleados y admin entran con **usuario** (no con correo). Los clientes, con **correo**.
- El admin puede **también atender citas** (pestaña *Mi perfil de empleado*).
- Los usuarios no se pueden repetir.

---

## 4. Qué puede hacer cada rol

### 👤 Cliente
- Ver el inicio: riel de imágenes, servicios, productos, promociones, galería, reseñas, redes sociales y mapa.
- Registrarse e iniciar sesión.
- **Agendar cita** con calendario de colores (ver sección 5).
- Elegir empleado o estación (o "sin preferencia").
- Agendar **para otra persona** (indicando si es niño o adulto).
- Llevar **acompañantes** (niño o adulto), con o sin servicio.
- Apartar **productos** para recogerlos el día de la cita.
- Elegir pago: efectivo o en línea (en el demo solo se registra la elección).
- Canjear **puntos** por un servicio gratis.
- Ver su panel **📅 Mi agenda** con las próximas citas, y "Mis citas".
- Dejar una **reseña** (1 a 5 estrellas) en citas completadas.

### 🧑‍🔧 Empleado
Por defecto solo ve **sus** citas y avisos. El admin le activa permisos:

| Permiso | Qué habilita |
|---|---|
| `allCitas` | Ver todas las citas. |
| `graf` | Ver gráficas y comisiones. |
| `gastos` | Panel de gastos. |
| `svEdit` | Agregar y editar sus servicios (precio y duración). |
| `design` | Editar inicio y diseño (logo, imágenes, redes, promociones). |
| `pos` | Usar el punto de venta (activo por defecto). |
| `inv` | Surtir y editar productos. |
| `corte` | Ver el corte de caja general. |
| `caja` | Caja propia y **completar la venta** de sus citas (activo por defecto). |

Siempre puede: ver sus avisos, marcar qué servicios realiza y ver su agenda.

### 🛠️ Admin
Panel con estas pestañas:

| Pestaña | Contenido |
|---|---|
| **Citas** | Ver citas, asignar empleado, cambiar estado, **duración** y **reprogramar** fecha/hora. Ver notificaciones con enlaces a WhatsApp y correo. |
| **Empleados y configuración** | Perfil, horario propio, **usuario y contraseña**, servicios que realiza y permisos. |
| **Precios y promos** | Precio, duración, descuento % y precio de niño por servicio. Texto de promoción simple. |
| **Productos** | Precio, piezas, descuento, costo, mínimo, código de barras. Alerta de inventario bajo y orden de compra por WhatsApp. |
| **Gráficas** | Ventas de los últimos 7 días (cortes y productos) y comisiones por empleado. |
| **Puntos y niveles** | Reglas de puntos, niveles de precio y asignación a clientes. |
| **Colores y datos** | Colores (claro y oscuro), datos del negocio, WhatsApp, correo, Instagram, Google, proveedor. |
| **Gastos** | Registro de gastos y utilidad real del mes. |
| **Corte de caja** | Efectivo, tarjeta, gastos del día y diferencia contra lo contado. |
| **Agenda** | Horario, descanso, días de trabajo, días bloqueados y recordatorios de mañana. |
| **Galería** | Fotos de antes y después. |
| **Inicio y diseño** | Logo, nombre, dirección, redes, imágenes del riel y promociones programadas. |
| **Mi perfil de empleado** | Para que el admin también atienda citas. |

### 🛒 Punto de venta (admin y empleados con permiso)
- Ticket con **productos y servicios** en una sola cuenta.
- **Código de barras**: escribe o escanea el código y presiona Enter.
- **Propina**, forma de pago y cálculo de cambio.
- Descuento automático de piezas y alerta de pocas piezas.
- Último ticket con envío por WhatsApp e impresión.
- Ventas del día (el empleado solo ve las suyas).

### 💵 Caja del empleado
- Cobrar sus citas de hoy (efectivo o tarjeta, propina y producto extra).
- Resumen del día: efectivo, tarjeta, propinas y comisión estimada.
- Cuadre con fondo inicial y efectivo contado.

---

## 5. Reglas de negocio importantes

### Calendario y horarios disponibles
- Colores de cada día: 🟩 muchos horarios · 🟨 pocos (40 % o menos) · 🟥 lleno · ⬜ no disponible.
- **No se pueden elegir** días pasados, días bloqueados ni días en que no se trabaja.
- Las horas aparecen como botones: las apartadas dicen **Ocupada** y las que ya pasaron hoy dicen **Pasó**. No se muestran horas fuera del horario ni dentro del descanso.
- La disponibilidad considera: horario del negocio, descanso, **horario propio del empleado**, citas existentes y **duración total**.
- Al confirmar, la hora se **valida de nuevo**.
- Con "sin preferencia", la hora está libre si hay más empleados trabajando que citas encimadas.
- El cliente solo ve empleados que **realizan el servicio** elegido.

### Duración
- Duración de la cita = duración del servicio + la de los acompañantes que reciben servicio.
- Si el admin cambia los minutos de una cita, las siguientes del mismo empleado y día **se recorren** y se avisa.
- Si cambia la duración de un servicio, se ajustan las citas pendientes de ese servicio.
- Si cambia el horario de un empleado y quedan citas fuera de él, se marcan **"Fuera de horario"** y se genera un aviso.

### Precios y descuentos
- Precio final = precio × (100 − descuento del producto/servicio − descuento del nivel del cliente) %, redondeado.
- El descuento total no pasa de 100 %.
- **Precio de niño:** si el servicio tiene precio de niño (> 0), se usa para niños (cita para otro niño o acompañante niño con servicio).
- **Niveles de precio:** el admin crea niveles (ej. VIP -10 %) y los asigna a clientes selectos.

### Puntos de lealtad
- Cada cita **completada** suma puntos (por defecto 1).
- Con 10 puntos (configurable) el cliente puede canjear **un servicio gratis**.
- Si la cita con canje se cancela, los puntos se devuelven.

### Estados de una cita
`pendiente` → `confirmada` → `completada` (o `cancelada`).
- Al **cancelar**: se devuelven piezas de productos y puntos.
- Al **completar**: se registra la venta (servicio y productos), se suman puntos y se avisa al admin. Una cita completada o cancelada ya no se puede modificar.

### Dinero
- **Utilidad real del mes** = ventas − costo de productos vendidos − gastos.
- **Comisión** = % configurable sobre servicios + productos del mes por empleado.
- **Corte de caja** = efectivo esperado (ventas en efectivo + propinas − gastos + fondo) comparado con el contado.

### Notificaciones
- Se generan al agendar, asignar, reprogramar y completar citas, con fecha, hora, forma de pago y productos.
- El admin las ve todas; cada empleado solo las suyas.
- Para enviarlas hay enlaces **WhatsApp** (`wa.me`) y **Correo** (`mailto`) que abren el mensaje ya escrito.

### Inicio y diseño
- **Riel de imágenes:** horizontal, con avance automático cada 3.5 segundos.
- **Promociones programables:** título, descripción, fecha de inicio y fin. Las activas se muestran; las futuras salen en "Próximamente"; las vencidas se ocultan.
- **Mapa:** Google Maps incrustado con la dirección y botón "Cómo llegar".
- **Logo:** se muestra en el encabezado y en el inicio.
- **Modo oscuro:** botón 🌓, con colores personalizables para claro y oscuro.

---

## 6. Cómo se guardan los datos

Todo se guarda en `localStorage` del navegador, bajo la clave **`bshop2`**, como un solo objeto `S`:

| Campo | Contenido |
|---|---|
| `shop` | Nombre, dirección, teléfono, horario, colores, redes, WhatsApp, correo, logo, comisión… |
| `sch` | Horario: apertura `o`, cierre `c`, descanso `bs`/`be`, intervalo `step`, días `days`. |
| `loy` | Puntos: `need` (para canje) y `per` (por cita). |
| `services` | `{id, n, p, m, d, pk}`: nombre, precio, minutos, descuento %, precio niño. |
| `products` | `{id, n, p, s, d, cost, min, c}`: precio, piezas, descuento, costo, mínimo, código. |
| `staff` | `{id, n, st, tel, bio, so, sc, sv}`: estación, horario propio, servicios que realiza. |
| `users` | `{user, email, pass, name, role, tel, pts, lv, staffId, perms}`. |
| `appts` | Citas: servicio, empleado, fecha, hora, duración, productos, acompañantes, pago, estado… |
| `sales` | Ventas registradas (tipo `corte` o `producto`, monto, pago, propina, empleado). |
| `exp`, `levels`, `blocked` | Gastos, niveles de precio y días bloqueados. |
| `notifs`, `rev`, `gal` | Avisos, reseñas y galería. |
| `rail`, `promos` | Imágenes del riel y promociones. |
| `theme`, `last`, `me` | Tema, último ticket y sesión actual. |

Al cargar, el código **completa los campos que falten** (migración) para no romper datos de versiones anteriores.

---

## 7. Mapa del código (`app.js`)

El archivo está dividido en secciones con comentarios `// ----`:

| Sección | Funciones principales |
|---|---|
| **Utilidades y datos** | `ymd`, `$`, `esc`, `pr` (precio), `price`, `P` (permisos), `save`, `render`, `navbar`. |
| **Vistas del cliente** | `vHome`, `vLogin`, `vReg`, `vBook`, `doBook`, `vMine`. |
| **Vista del empleado** | `vStaff`, `staffExtra`, `saleCell`, `cobrarCita`, `vCaja`. |
| **Punto de venta** | `vPos`, `tkAdd`, `scan`, `cobrar`. |
| **Panel admin** | `vAdmin` y una función por pestaña: `tCitas`, `tStaff`, `tPrecios`, `tProd`, `tGraf`, `tLoy`, `tDis`, `expView`, `tCorte`, `tAgenda`, `tGal`, `tDesign`, `tMia`. |
| **Agenda y calendario** | `info` (estado de cada hora), `slots`, `refSlots`, `bookDur`, `prK`, `shiftFrom`, `setDur`, `resch`, `svMin`. |
| **Empleados** | `permsRow`, `svPanel`, `setAccess`, `addStaff`, `fillStaff`, `adminStaff`. |
| **Avisos** | `apptMsg`, `sendLinks`, `waTo`. |
| **Diseño del inicio** | `railHome`, `promoHome`, `socHome`, `mapHome`, `startRail`, `rd` (compresión de imágenes). |

> Nota: en el archivo hay unas funciones antiguas renombradas con el sufijo `Old` (`slotsOld`, `refSlotsOld`, `addStaffOld`, `permsRowOld`). Ya no se usan y se pueden borrar.

---

## 8. Guía rápida de prueba

1. Entra como **admin** (`admin` / `admin123`).
2. En *Empleados y configuración*, crea un empleado con usuario y contraseña, marca los servicios que realiza y revisa sus permisos.
3. En *Productos*, agrega un producto con costo, piezas y código.
4. En *Inicio y diseño*, sube un logo, una imagen para el riel y programa una promoción.
5. Sal y **crea una cuenta de cliente** con "Crear cuenta".
6. Como cliente, agenda una cita: elige un día del calendario, una hora libre, un producto y un acompañante.
7. Entra como el **empleado**, ve su agenda y pulsa **Completar venta**.
8. Entra otra vez como admin y revisa *Gráficas*, *Gastos*, *Corte de caja* y los puntos del cliente.

---

## 9. Limitaciones conocidas

- **Los datos viven solo en el navegador:** cada persona ve su propia copia y no hay datos compartidos entre dispositivos.
- **Seguridad:** las contraseñas se guardan sin cifrar y los permisos solo **ocultan** pantallas. Para que sean seguros deben aplicarse en un servidor.
- **Pagos en línea:** solo se registra la elección, no se cobra.
- **Notificaciones:** hay que dar clic en el enlace de WhatsApp o correo; no se envían solas. Lo mismo con los recordatorios de mañana.
- **Imágenes:** se comprimen, pero el navegador tiene poco espacio (unos 5 MB). Conviene subir pocas.
- **Mapa de Google:** si el entorno bloquea marcos externos, el mapa incrustado no se ve; el botón "Cómo llegar" sí funciona.
- **Reprogramar** solo acepta horas que caen en el intervalo de la agenda (por ejemplo, cada 30 minutos).
- Al cambiar la duración de un servicio, las citas con acompañantes que reciben servicio solo ajustan el servicio principal.
- No incluye app instalable (PWA).
- El código está compacto y sin pruebas automáticas.

---

## 10. Versión aprobada

La aplicación principal aprobada ya está implementada con:

- **Next.js y TypeScript** en la raíz del proyecto.
- **Supabase** para autenticación, base de datos PostgreSQL y permisos por rol.
- Catálogo, reservas validadas en PostgreSQL y agenda según el rol.

Esta demo antigua no se migra automáticamente. Sus cuentas, contraseñas y datos de `localStorage` no se importan a Supabase. La app principal todavía no incluye Mercado Pago ni todas las funciones de POS descritas en este documento; consulta el [README principal](../README.md) para el alcance vigente.

---

## 11. Cómo se creó (historial por etapas)

El sistema se construyó de forma incremental, a partir de las peticiones del propietario del proyecto:

| Etapa | Qué se agregó |
|---|---|
| **1. Base** | Página del negocio, registro e inicio de sesión de clientes, agenda de citas, pago en efectivo o en línea, tienda en línea, panel admin (citas, colores, notificaciones) y empleados con asignación por nombre o estación. |
| **2. Punto de venta** | Venta en el local con inventario (piezas por producto). |
| **3. Reestructura** | Productos al agendar la cita, entrada por usuario para empleados y admin, panel admin con pestañas, gráficas de ventas, precios, descuentos, promociones y **puntos** de clientes frecuentes. Se quitó la tienda en línea. |
| **4. Más control** | Modo oscuro, avisos por WhatsApp/correo, **niveles de precio**, permisos de empleados y panel de **gastos**. |
| **5. Mejoras de página y POS** | Horarios disponibles, días bloqueados, recordatorios, galería antes/después, reseñas, código de barras, corte de caja, inventario bajo con orden de compra, propinas, comisiones y costo de productos. |
| **6. Agenda del cliente** | Panel de próximas citas, citas para otra persona y acompañantes (niño o adulto). |
| **7. Calendario y tiempos** | Calendario de colores, horas ocupadas, restricciones de fechas y horas, precio de niño, acompañante con servicio, horario por empleado y duración ajustable con recorrido de citas. |
| **8. Empleados** | Servicios por empleado, configuración de permisos, usuario y contraseña asignados por el admin y **caja** propia. |
| **9. Completar venta** | Cobro desde la agenda del empleado, con propina y producto extra. |
| **10. Inicio y diseño** | Perfil de admin como empleado, riel de imágenes, redes sociales, mapa de Google, logo, nombre, ubicación y promociones programadas. |
| **11. Entrega** | Código separado en `index.html`, `styles.css` y `app.js` para revisarlo en VS Code, y este README. |

---

## 🧭 Siguientes pasos sugeridos

1. Revisar el código y probar los flujos de la sección 8.
2. Borrar las funciones `...Old` que ya no se usan.
3. Revisar la sección 10 (producción) y decidir el stack.
4. Diseñar la base de datos antes de conectar un servidor.
