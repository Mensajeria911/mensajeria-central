# Central independiente de despacho

Aplicación web separada para el equipo de 911 Mensajeros Montería. Su responsabilidad es recibir los servicios publicados por las farmacias, priorizar la cola, asignar cada servicio a un domiciliario habilitado y mantener las tarifas operativas.

## Ejecutar

```bash
npm install
npm run dev
```

La app usa Supabase Auth con sesión persistente y RLS. El perfil debe tener rol `central` o `admin`. Durante el desarrollo dentro de este workspace, Vite lee el `.env.local` de la raíz mediante `envDir`.

## Responsabilidad del repositorio

Este repositorio no contiene el portal de farmacia ni la aplicación Android. La coordinación ocurre mediante las tablas, funciones RPC y canales Realtime de Supabase.
