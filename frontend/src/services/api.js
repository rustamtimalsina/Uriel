import axios from "axios";

const STORAGE_KEY = "apiBaseUrl";
const DEFAULT_BASE_URL = "http://127.0.0.1:8000";

function readStoredBaseUrl() {
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_BASE_URL;
}

const apiClient = axios.create({
  baseURL: readStoredBaseUrl(),
  timeout: 15000,
});

export const setApiBaseUrl = (url) => {
  const normalized = url.trim().replace(/\/+$/, "");
  localStorage.setItem(STORAGE_KEY, normalized);
  apiClient.defaults.baseURL = normalized;
};

export const getApiBaseUrl = () => apiClient.defaults.baseURL;

export const testBackendConnection = async (url) => {
  const normalized = url.trim().replace(/\/+$/, "");
  const response = await axios.get(`${normalized}/config`, { timeout: 5000 });
  return response.data;
};

export const searchDocuments = (searchRequest) => {
  return apiClient.post("/search", searchRequest);
};

export const askAI = (askRequest) => {
  return apiClient.post("/search/ask", askRequest, { timeout: 60000 });
};

export const getConfig = () => {
  return apiClient.get("/config");
};

export const getDocuments = () => {
  return apiClient.get("/documents");
};

export const getDocument = (docId) => {
  return apiClient.get(`/documents/${docId}`);
};

export const getDocumentContent = (docId) => {
  return apiClient.get(`/documents/${docId}/content`);
};

export const getIndexStats = () => {
  return apiClient.get("/index/stats");
};

export const getRelatedDocuments = (docId) => {
  return apiClient.get(`/documents/${docId}/related`);
};

export const updatePreprocessingConfig = (data) => {
  return apiClient.put("/config/preprocessing", data);
};

export const updateRankingConfig = (data) => {
  return apiClient.put("/config/ranking", data);
};

export const updateQueryExpansionConfig = (data) => {
  return apiClient.put("/config/query-expansion", data);
};

export const buildIndex = (sync = false) => {
  return apiClient.post(`/index/build${sync ? "?sync=true" : ""}`);
};

export const getIndexStatus = () => {
  return apiClient.get("/index/status");
};

export const rebuildIndex = () => {
  return apiClient.post("/index/rebuild");
};

export const getDirectories = () => {
  return apiClient.get("/config/directories");
};

export const addDirectory = (path) => {
  return apiClient.post("/config/directories", { path });
};

export const removeDirectory = (dirId) => {
  return apiClient.delete(`/config/directories/${dirId}`);
};

export const completeOnboarding = () => {
  return apiClient.put("/config/onboarding/complete");
};

export const buildDocumentFileUrl = (docId) => {
  return `${apiClient.defaults.baseURL}/documents/${docId}/file`;
};

export default apiClient;
