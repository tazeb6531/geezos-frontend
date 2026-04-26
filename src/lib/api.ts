/**
 * GeezOS API Client
 * All calls to the FastAPI backend
 */
import axios from 'axios'

const API_URL = process.env.NEXT_PUBLIC_API_URL ||
  'https://geezos-api-a0gcdncwefdchgf3.eastus2-01.azurewebsites.net'

export const api = axios.create({
  baseURL: API_URL,
  timeout: 30000,
})

// ── LOADS ──────────────────────────────────────────────────────────────────
export const loadsApi = {
  list:       (filters = {}) => api.get('/api/loads/', { params: filters }),
  get:        (id: number)   => api.get(`/api/loads/${id}`),
  create:     (data: any)    => api.post('/api/loads/', data),
  update:     (id: number, data: any) => api.put(`/api/loads/${id}`, data),
  updateStatus: (id: number, status: string) =>
    api.patch(`/api/loads/${id}/status`, { status }),
  delete:     (id: number)   => api.delete(`/api/loads/${id}`),
  stats:      ()             => api.get('/api/loads/stats'),
  nextNumber: ()             => api.get('/api/loads/next-number'),
  exportCsv:  ()             => api.get('/api/loads/export/csv', { responseType: 'blob' }),
  extract:    (file: File) => {
    const form = new FormData()
    form.append('file', file)
    return api.post('/api/loads/extract', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60000,
    })
  },
  docStatus:  (id: number)   => api.get(`/api/loads/${id}/doc-status`),
  getDocs:    (id: number)   => api.get(`/api/loads/${id}/documents`),
  uploadDoc:  (id: number, file: File, docType: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('doc_type', docType)
    return api.post(`/api/loads/${id}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
  },
  getDocUrl:  (loadId: number, docId: number) =>
    api.get(`/api/loads/${loadId}/documents/${docId}/url`),
  deleteDoc:  (loadId: number, docId: number) =>
    api.delete(`/api/loads/${loadId}/documents/${docId}`),
  crossCheck: (id: number)   => api.post(`/api/loads/${id}/cross-check`),
  downloadZip: (id: number)  =>
    api.get(`/api/loads/${id}/documents/zip`, { responseType: 'blob' }),
}

// ── DRIVERS ────────────────────────────────────────────────────────────────
export const driversApi = {
  list:       (activeOnly = true) =>
    api.get('/api/drivers/', { params: { active_only: activeOnly } }),
  get:        (id: number) => api.get(`/api/drivers/${id}`),
  stats:      (id: number) => api.get(`/api/drivers/${id}/stats`),
  create:     (data: any)  => api.post('/api/drivers/', data),
  update:     (id: number, data: any) => api.put(`/api/drivers/${id}`, data),
  deactivate: (id: number) => api.patch(`/api/drivers/${id}/deactivate`),
}

// ── TRUCKS ─────────────────────────────────────────────────────────────────
export const trucksApi = {
  list:       (activeOnly = true) =>
    api.get('/api/trucks/', { params: { active_only: activeOnly } }),
  get:        (id: number) => api.get(`/api/trucks/${id}`),
  create:     (data: any)  => api.post('/api/trucks/', data),
  update:     (id: number, data: any) => api.put(`/api/trucks/${id}`, data),
  deactivate: (id: number) => api.patch(`/api/trucks/${id}/deactivate`),
}

// ── PAYROLL ────────────────────────────────────────────────────────────────
export const payrollApi = {
  list:     (driverId?: number) =>
    api.get('/api/payroll/', { params: driverId ? { driver_id: driverId } : {} }),
  preview:  (data: any)  => api.post('/api/payroll/preview', data),
  confirm:  (data: any)  => api.post('/api/payroll/confirm', data),
  pdfUrl:   (id: number) => api.get(`/api/payroll/${id}/pdf-url`),
  email:    (data: any)  => api.post('/api/payroll/email', data),
  advances: (driverId?: number) =>
    api.get('/api/payroll/advances', { params: driverId ? { driver_id: driverId } : {} }),
  addAdvance:    (data: any)  => api.post('/api/payroll/advances', data),
  deleteAdvance: (id: number) => api.delete(`/api/payroll/advances/${id}`),
}

// ── ACCOUNTING ─────────────────────────────────────────────────────────────
export const accountingApi = {
  summary:     () => api.get('/api/accounting/summary'),
  byBroker:    () => api.get('/api/accounting/by-broker'),
  byDriver:    () => api.get('/api/accounting/by-driver'),
  byTruck:     () => api.get('/api/accounting/by-truck'),
  byMonth:     () => api.get('/api/accounting/by-month'),
  byRoute:     () => api.get('/api/accounting/by-route'),
  outstanding: () => api.get('/api/accounting/outstanding'),
}

// ── SETTINGS ───────────────────────────────────────────────────────────────
export const settingsApi = {
  getCompany:   () => api.get('/api/settings/company'),
  saveCompany:  (data: any) => api.put('/api/settings/company', data),
  getAll:       () => api.get('/api/settings/'),
  set:          (key: string, value: string) =>
    api.post('/api/settings/', { key, value }),
  testEmail:    (to: string) =>
    api.post('/api/settings/test-email', { to_email: to }),
  clearAll:     () =>
    api.post('/api/settings/clear-all-loads', { confirm_token: 'DELETE ALL', delete_files: true }),
  stats:        () => api.get('/api/settings/stats'),
}
