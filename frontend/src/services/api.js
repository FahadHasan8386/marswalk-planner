
import axios from "axios";

// --------------------------------------------------
// API CONFIGURATION
// --------------------------------------------------

const API_BASE_URL = "http://127.0.0.1:8001";

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 120000,
  headers: {
    "Content-Type": "application/json",
  },
});

// --------------------------------------------------
// ERROR HANDLING
// --------------------------------------------------

const handleApiError = (error) => {
  if (error.response) {
    const detail = error.response.data?.detail;

    if (Array.isArray(detail)) {
      throw new Error(
        detail.map((item) => item.msg).join(", ")
      );
    }

    throw new Error(
      typeof detail === "string"
        ? detail
        : "Backend request failed."
    );
  }

  if (error.code === "ECONNABORTED") {
    throw new Error("The backend request timed out.");
  }

  throw new Error(
    "Cannot connect to the MARSWALK backend. Make sure FastAPI is running."
  );
};

// --------------------------------------------------
// SHARED REQUEST HELPERS
// --------------------------------------------------

const postRequest = async (url, data) => {
  try {
    const response = await api.post(url, data);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

const getRequest = async (url, config = {}) => {
  try {
    const response = await api.get(url, config);
    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

// --------------------------------------------------
// ROVER MISSION API
// POST /api/rover/mission/plan
// --------------------------------------------------

export const planRoverMission = (missionData) =>
  postRequest("/api/rover/mission/plan", missionData);

// --------------------------------------------------
// ROVER ROUTE COMPARISON API
// POST /api/rover/routes/compare
// --------------------------------------------------

export const compareRoverRoutes = (comparisonData) =>
  postRequest("/api/rover/routes/compare", comparisonData);

// --------------------------------------------------
// ROVER ENERGY API
// POST /api/rover/energy
// --------------------------------------------------

export const calculateRoverEnergy = (energyData) =>
  postRequest("/api/rover/energy", energyData);

// --------------------------------------------------
// ROVER ENERGY HEALTH
// GET /api/rover/energy/health
// --------------------------------------------------

export const getRoverEnergyHealth = () =>
  getRequest("/api/rover/energy/health");

// --------------------------------------------------
// LEGACY ROUTE PLANNING API
// --------------------------------------------------

export const planRoute = (routeData) =>
  postRequest("/api/routes/plan", routeData);

// --------------------------------------------------
// LEGACY ROUTE COMPARISON API
// --------------------------------------------------

export const compareRoutes = (routeData) =>
  postRequest("/api/routes/compare", routeData);

// --------------------------------------------------
// TERRAIN ANALYSIS API
// --------------------------------------------------

export const analyzeTerrain = (terrainData) =>
  postRequest("/api/terrain/analyze", terrainData);

// --------------------------------------------------
// MISSION PLANNING API
// --------------------------------------------------

export const planMission = (missionData) =>
  postRequest("/api/missions/plan", missionData);

// --------------------------------------------------
// GEMINI EXPLANATION API
// --------------------------------------------------

export const explainMission = (missionData) =>
  postRequest("/api/gemini/explain", missionData);

// --------------------------------------------------
// RASTER INFORMATION
// --------------------------------------------------

export const getRasterInfo = () =>
  getRequest("/api/raster/info");

// --------------------------------------------------
// RASTER ELEVATION
// --------------------------------------------------

export const getRasterElevation = (x, y) =>
  getRequest("/api/raster/elevation", {
    params: { x, y },
  });

// --------------------------------------------------
// RASTER TERRAIN
// --------------------------------------------------

export const getRasterTerrain = (x, y) =>
  getRequest("/api/raster/terrain", {
    params: { x, y },
  });

// --------------------------------------------------
// AI TERRAIN INTELLIGENCE API
// POST /api/terrain-ai/predict
// Image upload using multipart/form-data
// --------------------------------------------------

export const predictTerrain = async (imageFile) => {
  try {
    const formData = new FormData();

    formData.append("file", imageFile);

    const response = await axios.post(
      `${API_BASE_URL}/api/terrain-ai/predict`,
      formData,
      {
        timeout: 180000,
      }
    );

    return response.data;
  } catch (error) {
    handleApiError(error);
  }
};

// --------------------------------------------------
// DEFAULT EXPORT
// --------------------------------------------------

export default api;
