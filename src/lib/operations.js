import { supabase } from './supabase.js';
import { usernameToAuthEmail } from './auth.js';

export const SERVICE_LABELS = {
  home: 'Domicilio en efectivo',
  buy: 'Compra',
  cross: 'Cruce',
  home_buy: 'Domicilio con compra',
  home_cross: 'Domicilio con cruce',
  home_buy_cross: 'Domicilio compra y cruce',
  change: 'Cambio de menuda'
};

export const STATUS_LABELS = {
  unassigned: 'Sin asignar',
  assigned: 'Asignado',
  enroute: 'En camino',
  delivered: 'Entregado',
  cancelled: 'Cancelado'
};

export async function listServices() {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') };
  // Lo abierto siempre y lo cerrado de los últimos 45 días; los reportes usan sus propias consultas.
  const since = new Date(Date.now() - 45 * 86400000).toISOString();
  return supabase.from('visible_services').select('*').or(`status.in.(unassigned,assigned,enroute),created_at.gte.${since}`).order('created_at', { ascending: true });
}

export async function listCouriers() {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') };
  return supabase.from('profiles').select('id, full_name, phone, role, active, branch_id, zone, vehicle, available, last_lat, last_lng, last_location_at').eq('role', 'courier').eq('active', true).order('full_name');
}

export async function listProfiles() {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') };
  return supabase.from('profiles').select('id, username, full_name, phone, role, branch_id, zone, vehicle, active, available, created_at, updated_at').order('full_name');
}

export async function listBranches() {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') };
  return supabase.from('branches').select('id, code, name, address, neighborhood, phone, latitude, longitude, zone_id, active, location_confirmed').order('code');
}

export async function billingReport(from, to) {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') };
  return supabase.rpc('billing_report', { p_from: from, p_to: to });
}

export async function companyEarnings(from, to) {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') };
  return supabase.rpc('company_earnings', { p_from: from, p_to: to });
}

export async function payrollReport(from, to) {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') };
  return supabase.rpc('payroll_report', { p_from: from, p_to: to });
}

export async function setProfileActive(profileId, active) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') };
  return supabase.rpc('admin_set_profile_active', { p_user_id: profileId, p_active: active }).single();
}

export async function updateProfile(profileId, role, branchCode, zone, vehicle) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') };
  return supabase.rpc('admin_update_profile', {
    p_user_id: profileId,
    p_role: role,
    p_branch_code: branchCode || null,
    p_zone: zone || null,
    p_vehicle: vehicle || null
  }).single();
}

export async function createUser(values) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') };
  // `email` is only a compatibility alias for an older deployed function.
  // The UI and the current function use `username`; no real email is shown or sent.
  return supabase.functions.invoke('admin-create-user', {
    body: { ...values, email: usernameToAuthEmail(values.username) }
  });
}

export async function setBranchActive(branchCode, active) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') };
  return supabase.rpc('admin_set_branch_active', { p_branch_code: branchCode, p_active: active }).single();
}

export async function listRates() {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') };
  return supabase.from('service_rates').select('id, service_type, payment_method, label, price_cop, price_confirmed, general_price_cop, courier_price_cop, general_price_confirmed, courier_price_confirmed, notes, updated_at').order('service_type');
}

export async function assignService(serviceId, courierId) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') };
  return supabase.rpc('assign_delivery_service', { p_service_id: serviceId, p_courier_id: courierId }).single();
}

export async function cancelService(serviceId, reason) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') };
  return supabase.rpc('cancel_delivery_service', { p_service_id: serviceId, p_reason: reason || null }).single();
}

export async function reassignService(serviceId, courierId, reason) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') };
  return supabase.rpc('reassign_delivery_service', { p_service_id: serviceId, p_courier_id: courierId, p_reason: reason || null }).single();
}

// El paso de entrega muestra los datos del cliente; debe quedar igual a lo corregido.
function routeAfterEdit(service, patch) {
  if (!Array.isArray(service.route_plan) || !service.route_plan.length) return undefined;
  const payment = patch.payment_method ?? service.payment_method;
  return service.route_plan.map(step => step.key === 'delivery' ? {
    ...step,
    title: `Entregar a ${patch.customer_name || service.customer_name || 'el cliente'}`,
    detail: [patch.delivery_address ?? service.delivery_address, patch.customer_phone ?? service.customer_phone, payment === 'card' ? 'Cobrar con datáfono.' : payment === 'cash' ? 'Cobrar en efectivo.' : null].filter(Boolean).join(' · ')
  } : step);
}

export async function updateService(service, patch) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') };
  const route = routeAfterEdit(service, patch);
  const result = await supabase.rpc('update_delivery_workflow', { p_service_id: service.id, p_patch: route ? { ...patch, route_plan: route } : patch }).single();
  if (!result.error && service.assigned_courier_id) {
    await supabase.functions.invoke('send-push-notification', { body: { service_id: service.id, event_type: 'service_updated' } });
  }
  return result;
}

export async function sendRemovedPush(serviceId) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') };
  return supabase.functions.invoke('send-push-notification', { body: { service_id: serviceId, event_type: 'service_reassigned' } });
}

export async function listWorkload() {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') };
  return supabase.rpc('courier_workload');
}

export async function getCourierRoute(courierId) {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') };
  return supabase.rpc('courier_route', { p_courier: courierId });
}

export async function listReassignments(serviceId) {
  if (!supabase) return { data: [], error: new Error('Supabase no está configurado.') };
  return supabase.from('service_events').select('id, payload, created_at').eq('service_id', serviceId).eq('event_type', 'reassigned').order('created_at');
}

export async function sendAssignmentPush(serviceId) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') };
  return supabase.functions.invoke('send-push-notification', { body: { service_id: serviceId } });
}

export async function updateRate(rateId, generalPriceCop, courierPriceCop, generalConfirmed, courierConfirmed) {
  if (!supabase) return { data: null, error: new Error('Supabase no está configurado.') };
  return supabase.from('service_rates').update({
    general_price_cop: generalPriceCop === '' ? null : Number(generalPriceCop),
    courier_price_cop: courierPriceCop === '' ? null : Number(courierPriceCop),
    general_price_confirmed: Boolean(generalConfirmed),
    courier_price_confirmed: Boolean(courierConfirmed),
    // Compatibilidad con clientes antiguos: fee_cop siempre representa el pago al domiciliario.
    price_cop: courierPriceCop === '' ? null : Number(courierPriceCop),
    price_confirmed: Boolean(courierConfirmed)
  }).eq('id', rateId).select().single();
}

export function subscribeToOperations(onChange, onStatus = () => {}) {
  if (!supabase) return () => {};
  let connected = false;
  const channel = supabase.channel('central-operations');
  ['delivery_services', 'service_rates', 'profiles', 'branches', 'zones', 'payroll_paid_days'].forEach(table => {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange);
  });
  // Si se cayó la conexión, al volver se recupera lo que pasó mientras tanto.
  channel.subscribe(status => {
    if (status !== 'SUBSCRIBED') {
      onStatus(status === 'CLOSED' ? 'offline' : 'reconnecting');
      return;
    }
    onStatus('live');
    if (connected) onChange();
    connected = true;
  });
  return () => { void supabase.removeChannel(channel); };
}
