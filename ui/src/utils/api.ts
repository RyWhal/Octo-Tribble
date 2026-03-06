export interface Endpoint {
  id: string;
  name: string | null;
  created_at: string;
  expires_at: string;
  request_count: number;
}

export interface WebhookRequest {
  id: string;
  endpoint_id: string;
  received_at: string;
  method: string;
  path: string;
  headers: string; // JSON string
  body: string;
  content_type: string;
  source_ip: string;
}

async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text().catch(() => 'Unknown error');
    let message = text;
    try {
      const json = JSON.parse(text);
      message = json.error ?? text;
    } catch {
      // keep raw text
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function listEndpoints(): Promise<Endpoint[]> {
  return apiFetch<Endpoint[]>('/api/endpoints');
}

export async function createEndpoint(params: { name?: string; expiry?: string }): Promise<Endpoint> {
  return apiFetch<Endpoint>('/api/endpoints', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function updateEndpoint(id: string, params: { name?: string | null; expiry?: string }): Promise<Endpoint> {
  return apiFetch<Endpoint>(`/api/endpoints/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
}

export async function deleteEndpoint(id: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/endpoints/${id}`, { method: 'DELETE' });
}

export async function listRequests(endpointId: string): Promise<WebhookRequest[]> {
  return apiFetch<WebhookRequest[]>(`/api/endpoints/${endpointId}/requests`);
}

export async function clearRequests(endpointId: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/endpoints/${endpointId}/requests`, { method: 'DELETE' });
}

export async function deleteWebhookRequest(requestId: string): Promise<void> {
  await apiFetch<{ ok: boolean }>(`/api/requests/${requestId}`, { method: 'DELETE' });
}

export function ingestUrl(endpointId: string): string {
  return `${window.location.origin}/in/${endpointId}`;
}
