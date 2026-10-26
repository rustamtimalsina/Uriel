import axios from "axios";

const STORAGE_KEY = "apiBaseUrl";
const DEFAULT_BASE_URL = "http://127.0.0.1:8000";

function readStoredBaseUrl() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  if (import.meta.env.VITE_API_BASE_URL) {
    return import.meta.env.VITE_API_BASE_URL;
  }
  // If running in production on a remote domain (e.g. Render / Docker), use current window origin
  if (
    typeof window !== "undefined" &&
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1"
  ) {
    return window.location.origin;
  }
  return DEFAULT_BASE_URL;
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

export const listChatSessions = () => apiClient.get("/chat/sessions");
export const createChatSession = (title = "New Conversation") => apiClient.post("/chat/sessions", { title });
export const getChatSession = (sessionId) => apiClient.get(`/chat/sessions/${sessionId}`);
export const deleteChatSession = (sessionId) => apiClient.delete(`/chat/sessions/${sessionId}`);
export const sendChatMessage = (sessionId, data) => apiClient.post(`/chat/sessions/${sessionId}/message`, data, { timeout: 60000 });

export const streamChatMessage = async (sessionId, data, onEvent, onError) => {
  const baseUrl = apiClient.defaults.baseURL;
  const url = `${baseUrl}/chat/sessions/${sessionId}/message/stream`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(errText || `HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const trimmed = part.trim();
        if (trimmed.startsWith("data: ")) {
          try {
            const eventData = JSON.parse(trimmed.slice(6));
            onEvent(eventData);
          } catch {
            // Ignore parse error
          }
        }
      }
    }
  } catch (err) {
    if (onError) onError(err);
    else throw err;
  }
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

export const getDocumentSummary = (docId) => {
  return apiClient.get(`/documents/${docId}/summary`, { timeout: 60000 });
};

export const uploadDocument = (file) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiClient.post("/documents/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
};

export const deleteDocument = (docId) => {
  return apiClient.delete(`/documents/${docId}`);
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
