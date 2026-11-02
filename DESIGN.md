# Central de despacho · sistema visual

## Dirección

Centro de operación para 911 Mensajeros Montería: el operador debe leer la cola, entender el servicio seleccionado y asignarlo sin navegar por pantallas decorativas. El lenguaje visual conserva el azul profundo y el cian de la marca, con una densidad más alta que el portal de farmacia.

## Estructura

- Navegación lateral fija con contexto de operación y turno.
- Encabezado con sección, fecha y estado en vivo.
- Despacho dividido en cola y detalle: la lista es escaneable; el detalle contiene la decisión de asignación.
- Tarifas como tabla editable orientada a configuración, con estado confirmado o pendiente.
- En móvil, cola y detalle pasan a una secuencia vertical; no se mantiene una cuadrícula ilegible.

## Reglas

- La cola se alimenta exclusivamente de `delivery_services` y Realtime.
- Solo una cuenta con rol `central` o `admin` puede asignar mediante `assign_delivery_service`.
- Las tarifas pendientes se mantienen como `Por confirmar`.
- Estados visibles siempre incluyen texto, además del tono de color.
- La aplicación no fabrica domiciliarios, pedidos o métricas demo cuando Supabase está conectado.
