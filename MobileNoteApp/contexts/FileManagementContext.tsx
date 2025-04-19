import React, { createContext, useContext, useEffect, useState } from "react";
import * as FileSystem from "expo-file-system";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as DocumentPicker from "expo-document-picker";
import api from "../hooks/api";

/**
 * Types
 */
export interface FileItem {
  id: string;
  name: string;
  type: "canvas" | "file";
  path: string;
  size?: number;
  lastModified?: Date;
}

export interface CanvasFolder {
  id: string;
  name: string;
  canvasFile: FileItem;
  files: FileItem[];
}

export interface FileManagementState {
  currentPath: string[]; // array of folder ids representing breadcrumb
  folders: CanvasFolder[];
  currentFolder?: CanvasFolder;
}

interface FileManagementContextType {
  state: FileManagementState;
  navigateToFolder: (folderId: string) => void;
  navigateUp: () => void;
  pickAndUploadFile: () => Promise<void>;
  deleteFile: (fileId: string) => void;
  deleteFolder: (folderId: string) => void;
  createCanvasFolder: (name: string) => Promise<void>;
}

const STORAGE_KEY = "@file_management_state_v1";
const PROJECTS_DIR = `${FileSystem.documentDirectory}projects/`;

const initialTestData: FileManagementState = {
    currentPath: [],
    folders: [
      {
        id: '1',
        name: 'Project 1',
        canvasFile: {
          id: 'canvas1',
          name: 'Canvas 1',
          type: 'canvas',
          path: '/canvas1',
          lastModified: new Date(Date.now()),
        },
        files: [
          {
            id: 'file1',
            name: 'Reference Document 1.pdf',
            type: 'file',
            path: '/project1/reference1.pdf',
            size: 1024 * 1024,
            lastModified: new Date(Date.now()),
          },
        ],
      },
      {
        id: '2',
        name: 'Project 2',
        canvasFile: {
          id: 'canvas2',
          name: 'Canvas 2',
          type: 'canvas',
          path: '/canvas2',
          lastModified: new Date(),
        },
        files: [
          {
            id: 'file2',
            name: 'Image 1.jpg',
            type: 'file',
            path: '/project2/image1.jpg',
            size: 2 * 1024 * 1024,
            lastModified: new Date(),
          },
        ],
      },
    ],
  };

const FileManagementContext = createContext<FileManagementContextType | undefined>(
  undefined
);

export const FileManagementProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<FileManagementState>(initialTestData);

  /**
   * Initial bootstrap: ensure projects directory exists and load saved state.
   */
  useEffect(() => {
    (async () => {
      await ensureProjectsDir();
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed: FileManagementState = JSON.parse(saved);
          setState(parsed);
        } catch (e) {
          console.warn("Failed to parse saved file management state", e);
        }
      }
    })();
  }, []);

  /** Persist state */
  useEffect(() => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  /** Helpers */
  const ensureProjectsDir = async () => {
    const dirInfo = await FileSystem.getInfoAsync(PROJECTS_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(PROJECTS_DIR, { intermediates: true });
    }
  };

  const navigateToFolder = (folderId: string) => {
    const folder = state.folders.find((f) => f.id === folderId);
    if (folder) {
      setState((prev) => ({
        ...prev,
        currentPath: [...prev.currentPath, folderId],
        currentFolder: folder,
      }));
    }
  };

  const navigateUp = () => {
    setState((prev) => {
      const newPath = prev.currentPath.slice(0, -1);
      const parentId = newPath[newPath.length - 1];
      return {
        ...prev,
        currentPath: newPath,
        currentFolder: prev.folders.find((f) => f.id === parentId),
      };
    });
  };

  /**
   * Pick a file via system picker and copy into current folder
   */
  const pickAndUploadFile = async (): Promise<void> => {
    if (!state.currentFolder) return;
    const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: false });
    if (!res.canceled) {
      try {
        const successResult = res as DocumentPicker.DocumentPickerSuccessResult;
        const file = successResult.assets[0];
            
        const fileUri = successResult.assets[0].uri;
        const fileName = successResult.assets[0].name ?? `file_${Date.now()}`;
        const fileSize = successResult.assets[0].size ?? 0;
        const destUri = fileUri || `${state.currentFolder.id}/${fileName}`;

        const newFile: FileItem = {
            id: `${(state.currentFolder.files.length + 1).toString()}`,
            name: fileName,
            type: "file",
            path: destUri,
            size: fileSize,
            lastModified: new Date(Date.now()),
        };

        setState(prev => ({
            ...prev,
            folders: prev.folders.map(folder => 
              folder.id === state.currentFolder?.id
                ? { ...folder, files: [...folder.files, newFile] }
                : folder
            ),
            currentFolder: {
              ...state.currentFolder!,
              files: [...state.currentFolder!.files, newFile],
            },
        }));
        } catch (error) {
          console.error("Error uploading file:", error);
        }
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!state.currentFolder) return;
    const file = state.currentFolder.files.find((f) => f.id === fileId);
    if (file) {
      setState((prev) => {
        const updatedFolders = prev.folders.map((folder) =>
          folder.id === state.currentFolder!.id
            ? { ...folder, files: folder.files.filter((f) => f.id !== fileId) }
            : folder
        );
        return {
          ...prev,
          folders: updatedFolders,
          currentFolder: {
            ...state.currentFolder!,
            files: state.currentFolder!.files.filter((f) => f.id !== fileId),
          },
        };
      });
    }
  };

  const deleteFolder = async (folderId: string) => {
    setState((prev) => ({
      ...prev,
      folders: prev.folders.filter((f) => f.id !== folderId),
      currentPath: prev.currentPath.filter((id) => id !== folderId),
      currentFolder: prev.currentFolder?.id === folderId ? undefined : prev.currentFolder,
    }));
  };

  const createCanvasFolder = async (name: string) => {
    const id = (state.folders.length + 1).toString();

    const canvasFile: FileItem = {
      id: id,
      name: `${name} Canvas`,
      type: "canvas",
      path: `/${name}/canvas`,
      lastModified: new Date(Date.now()),
    };

    const newFolder: CanvasFolder = {
      id,
      name,
      canvasFile,
      files: [],
    };

    setState((prev) => ({ ...prev, folders: [...prev.folders, newFolder] }));
  };

  return (
    <FileManagementContext.Provider
      value={{
        state,
        navigateToFolder,
        navigateUp,
        pickAndUploadFile,
        deleteFile,
        deleteFolder,
        createCanvasFolder,
      }}
    >
      {children}
    </FileManagementContext.Provider>
  );
};

export const useFileManagement = () => {
  const ctx = useContext(FileManagementContext);
  if (!ctx) throw new Error("useFileManagement must be used within provider");
  return ctx;
};
