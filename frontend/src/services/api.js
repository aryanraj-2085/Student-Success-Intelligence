const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api'

export async function getDashboard() {
  const response = await fetch(`${API_BASE}/dashboard`)
  if (!response.ok) throw new Error('Could not load cohort data. Is the API running?')
  return response.json()
}

export async function createIntervention(payload) {
  const response = await fetch(`${API_BASE}/interventions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error('Could not save the intervention.')
  return response.json()
}

export async function updateIntervention(id, status, note = '') {
  const params = new URLSearchParams({ status, note })
  const response = await fetch(`${API_BASE}/interventions/${id}?${params}`, { method: 'PATCH' })
  if (!response.ok) throw new Error('Could not update the intervention.')
  return response.json()
}