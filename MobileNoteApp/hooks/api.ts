import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Base API configuration
const BASE_URL = 'http://10.8.117.210:8001/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for authentication
apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth API endpoints
export const authAPI = {
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/auth/login', { email, password });
    await AsyncStorage.setItem('authToken', response.data.token);
    return response.data;
  },
  
  register: async (name: string, email: string, password: string) => {
    const response = await apiClient.post('/auth/register', { name, email, password });
    return response.data;
  },
  
  logout: async () => {
    await AsyncStorage.removeItem('authToken');
    return { success: true };
  },
  
  getCurrentUser: async () => {
    const response = await apiClient.get('/auth/user');
    return response.data;
  },
};

// Canvas API endpoints
export const canvasAPI = {
  createCanvas: async (canvasData: { title: string; content: any }) => {
    const response = await apiClient.post('/canvas/', canvasData);
    return response.data;
  },
  
  getCanvas: async (id: string) => {
    const response = await apiClient.get(`/canvas/${id}`);
    return response.data;
  },
  
  updateCanvas: async (id: string, canvasData: { title?: string; content?: any }) => {
    const response = await apiClient.put(`/canvas/${id}`, canvasData);
    return response.data;
  },
};

// Files API endpoints
export const filesAPI = {
  uploadFile: async (file: { uri: string; name: string; type: string }, title: string) => {
    // Create a FormData object
    const formData = new FormData();
    
    // Log the file details for debugging
    console.log('Uploading file:', {
      uri: file.uri,
      name: file.name,
      type: file.type
    });
    
    // Append the file to the FormData - match the format expected by the server
    formData.append('file', {
      uri: file.uri,
      name: file.name,
      type: file.type
    } as any);
    
    // Append the title field
    formData.append('title', title);
    
    // Send the request with the FormData
    const response = await apiClient.post('/files', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    
    console.log('Upload response:', response.data);
    return response.data;
  },
  
  getFileInfo: async (id: string) => {
    const response = await apiClient.get(`/files/${id}`);
    return response.data;
  },
};

// QA API endpoints
export const qaAPI = {
  askQuestion: async (question: string, context?: { fileIds?: string[] }) => {
    const response = await apiClient.post('/qa/ask', { question, ...context });
    return response.data;
  },
};

export default {
  auth: authAPI,
  canvas: canvasAPI,
  files: filesAPI,
  qa: qaAPI,
};