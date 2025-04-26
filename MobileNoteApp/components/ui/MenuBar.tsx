import React, { useState, useRef } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { canvasAPI } from "../../hooks/api";
import { useFileManagement } from "../../contexts/FileManagementContext";
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';

interface MenuBarProps {
  notePanelRef: React.RefObject<any>;
}

export default function AppBar({ notePanelRef }: MenuBarProps) {
  const [showExitDialog, setShowExitDialog] = useState(false);
  const router = useRouter();
  const { state, setState } = useFileManagement();

  const handleExitCanvas = () => {
    setShowExitDialog(true);
  };

  const clearCurrentCanvas = () => {
    if (state.currentFolder) {
      setState((prev) => ({
        ...prev,
        folders: prev.folders.map(folder => 
          folder.id === state.currentFolder?.id
            ? { 
                ...folder, 
                canvasFile: {
                  ...folder.canvasFile,
                  elements: []
                }
              }
            : folder
        ),
        currentFolder: state.currentFolder ? {
          ...state.currentFolder,
          canvasFile: {
            ...state.currentFolder.canvasFile,
            elements: []
          }
        } : undefined
      }));
    }
  };

  const handleConfirmExit = async (shouldSave: boolean) => {
    if (shouldSave && state.currentFolder) {
      try {
        // Get the current canvas data
        const canvasId = state.currentFolder.canvasFile.id;
        const canvasTitle = state.currentFolder.canvasFile.title;

        // Capture screenshot of the canvas
        let screenshotUri: string | null = null;
        let base64Image: string | undefined = undefined;
        try {
          const canvasRef = notePanelRef.current?.getCanvasRef();
          if (canvasRef) {
            // First capture as PNG (to preserve quality)
            screenshotUri = await captureRef(canvasRef, {
              height: state.currentFolder.canvasFile.height,
              width: state.currentFolder.canvasFile.width,
              quality: 1,
              format: 'png',
              result: 'tmpfile'
            });
            
            if (screenshotUri) {
              // Convert RGBA to RGB using ImageManipulator
              const manipulatedImage = await ImageManipulator.manipulateAsync(
                screenshotUri,
                [{ resize: { width: state.currentFolder.canvasFile.width, height: state.currentFolder.canvasFile.height } }],
                { format: ImageManipulator.SaveFormat.JPEG, compress: 1 }
              );

              // Read the JPEG file and convert to base64
              const base64 = await FileSystem.readAsStringAsync(manipulatedImage.uri, {
                encoding: FileSystem.EncodingType.Base64
              });
              base64Image = `data:image/jpeg;base64,${base64}`;
              
              // Clean up the temporary files
              try {
                await FileSystem.deleteAsync(screenshotUri);
                await FileSystem.deleteAsync(manipulatedImage.uri);
              } catch (e) {
                console.warn('Failed to delete temporary screenshot files:', e);
              }
              
              console.log("Base64 image generated:", base64Image.substring(0, 100) + "..."); // Log first 100 chars
            }
          }
        } catch (error) {
          console.error("Error capturing screenshot:", error);
        }
        
        // Convert the elements to the format expected by the API
        const elements = state.currentFolder.canvasFile.elements.map((element, index) => {
          if (element.type === 'stroke') {
            const processedStroke = {
              id: `stroke-${index}`,
              type: 'stroke',
              data: {
                points: element.data.points.map((point: { x: number; y: number; pressure?: number; tilt?: number }) => ({
                  x: point.x,
                  y: point.y,
                  pressure: point.pressure || 0.5,
                  tilt: point.tilt || 0
                })),
                color: element.data.color || '#000000',
                brush_size: element.data.brush_size || 2.0,
                brush_type: element.data.brush_type || 'pen'
              },
              created_at: element.created_at || new Date().toISOString(),
              updated_at: element.updated_at || new Date().toISOString()
            };
            return processedStroke;
          } else if (element.type === 'text') {
            return {
              id: `text-${index}`,
              type: 'text',
              data: {
                content: element.data.content || '',
                position: {
                  x: element.data.position?.x || 0,
                  y: element.data.position?.y || 0
                },
                font_family: element.data.font_family || 'Arial',
                font_size: element.data.font_size || 16,
                color: element.data.color || '#000000',
                style: {
                  bold: element.data.style?.bold || false,
                  italic: element.data.style?.italic || false,
                  underline: element.data.style?.underline || false
                }
              },
              created_at: element.created_at || new Date().toISOString(),
              updated_at: element.updated_at || new Date().toISOString()
            };
          } else if (element.type === 'image') {
            return {
              id: `image-${index}`,
              type: 'image',
              data: {
                uri: element.data.uri || '',
                position: {
                  x: element.data.position?.x || 0,
                  y: element.data.position?.y || 0
                },
                width: element.data.width || 200,
                height: element.data.height || 200
              },
              created_at: element.created_at || new Date().toISOString(),
              updated_at: element.updated_at || new Date().toISOString()
            };
          }
          return element;
        });
        
        // Prepare the canvas data
        const canvasData = {
          title: canvasTitle,
          elements: elements,
          image: base64Image
        };
        
        console.log("Sending canvas data:", {
          title: canvasData.title,
          elementsCount: canvasData.elements.length,
          hasImage: !!canvasData.image
        });
        
        // Call the API to update the canvas
        await canvasAPI.updateCanvas(canvasId, canvasData);
        
        console.log("Canvas saved successfully");
      } catch (error) {
        console.error("Error saving canvas:", error);
      }
    } else {
      clearCurrentCanvas();
    }
    
    setShowExitDialog(false);
    router.back();
  };

  return (
    <View style={styles.appBar}>
      <Text style={styles.title}>OmniNote</Text>
      
      <TouchableOpacity style={styles.headerButton}>
        <Text style={styles.buttonText}>FILE</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerButton}>
        <Text style={styles.buttonText}>EDIT</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerButton}>
        <Text style={styles.buttonText}>SETTINGS</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.headerButton} onPress={handleExitCanvas}>
        <FontAwesome name="sign-out" size={18} color="#fff" />
      </TouchableOpacity>

      {/* Exit Dialog */}
      <Modal
        visible={showExitDialog}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowExitDialog(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Exit Canvas</Text>
            <Text style={styles.modalText}>Do you want to save your changes before exiting?</Text>
            <View style={styles.modalActions}>
              <TouchableOpacity 
                style={[styles.modalButton, styles.cancelButton]} 
                onPress={() => setShowExitDialog(false)}
              >
                <Text style={styles.buttonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.dontSaveButton]} 
                onPress={() => handleConfirmExit(false)}
              >
                <Text style={styles.buttonText}>Don't Save</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.modalButton, styles.saveButton]} 
                onPress={() => handleConfirmExit(true)}
              >
                <Text style={styles.buttonText}>Save & Exit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  appBar: {
    height: 68, // Typical app bar height
    backgroundColor: "#080808", // Transparent background
    elevation: 0, // No shadow (similar to Material-UI's elevation={0})
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16, // Padding for content
  },
  title: {
    color: "#fff", // White text color
    fontSize: 20, // Equivalent to Typography variant="h6"
    fontWeight: "bold",
    flex: 1, // Makes the title take up available space
  },
  headerButton: {
    marginLeft: 10,
    padding: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold'
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#1a1a1a',
    borderRadius: 10,
    padding: 20,
    width: '80%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: '#444',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  modalText: {
    color: '#fff',
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalButton: {
    padding: 10,
    borderRadius: 5,
    minWidth: 80,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#444',
  },
  dontSaveButton: {
    backgroundColor: '#e8171e',
  },
  saveButton: {
    backgroundColor: '#007bff',
  },
});