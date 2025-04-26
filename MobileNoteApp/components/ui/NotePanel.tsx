import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  PanResponder,
  Image,
  Button,
  Alert,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import { Svg, Path } from 'react-native-svg';
import * as ImagePicker from 'expo-image-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { useFileManagement, FileManagementState, CanvasFolder } from '../../contexts/FileManagementContext';
import { useLocalSearchParams } from 'expo-router';

enum TextBoxState {
  UNSELECTED = 'unselected',
  SELECTED = 'selected',
  EDITING = 'editing',
}

interface TextBox {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  isBold: boolean;
  isItalic: boolean;
  width: number;
  state: TextBoxState;
}

interface ImageElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  uri: string;
}

// Each stroke is just an array of [x, y] points
type Stroke = { x: number; y: number }[];

// Convert an array of points into an SVG path string
function pointsToSvgPath(points: Stroke): string {
  if (points.length === 0) return '';
  // Move to first point, then line-to every subsequent point
  const d = points.map((p, i) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`));
  return d.join(' ');
}

const NotePanel = () => {
  const { state, setState, loadCanvasData } = useFileManagement();
  const params = useLocalSearchParams();
  const [mode, setMode] = useState<'text' | 'draw' | 'pan'>('pan');
  // ========== Text Boxes ==========
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [selectedTextBox, setSelectedTextBox] = useState<string | null>(null);
  // ========== Images ==========
  const [images, setImages] = useState<ImageElement[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // ========== Drawing Strokes ==========
  const [paths, setPaths] = useState<Stroke[]>([]); // all strokes
  const [currentPath, setCurrentPath] = useState<Stroke>([]); // current stroke being drawn
  const [strokeColor, setStrokeColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [brushType, setBrushType] = useState('pen');
  
  const canvasRef = useRef<View>(null);

  // Initialize canvas data from router params
  useEffect(() => {
    if (params.canvasData) {
      try {
        const canvasData = JSON.parse(params.canvasData as string);
        
        // Initialize text boxes
        const textElements = canvasData.elements.filter((el: any) => el.type === 'text');
        const newTextBoxes = textElements.map((el: any) => ({
          id: el.id,
          x: el.data.position.x,
          y: el.data.position.y,
          text: el.data.content,
          fontSize: el.data.font_size,
          color: el.data.color,
          isBold: el.data.style.bold,
          isItalic: el.data.style.italic,
          width: 200,
          state: TextBoxState.UNSELECTED,
        }));
        setTextBoxes(newTextBoxes);

        // Initialize images
        const imageElements = canvasData.elements.filter((el: any) => el.type === 'image');
        const newImages = imageElements.map((el: any) => ({
          id: el.id,
          x: el.data.position.x,
          y: el.data.position.y,
          width: el.data.width,
          height: el.data.height,
          uri: el.data.uri,
        }));
        setImages(newImages);

        // Initialize paths and stroke properties
        const strokeElements = canvasData.elements.filter((el: any) => el.type === 'stroke');
        if (strokeElements.length > 0) {
          // Use the properties from the first stroke element
          const firstStroke = strokeElements[0];
          setStrokeColor(firstStroke.data.color || '#ffffff');
          setStrokeWidth(firstStroke.data.brush_size || 3);
          setBrushType(firstStroke.data.brush_type || 'pen');
        }
        const newPaths = strokeElements.map((el: any) => 
          el.data.points.map((point: any) => ({ x: point.x, y: point.y }))
        );
        setPaths(newPaths);
      } catch (error) {
        console.error('Error parsing canvas data:', error);
      }
    }
  }, [params.canvasData]);

  // Function to update canvasFile.elements
  const updateCanvasElements = () => {
    if (!state.currentFolder) return;
    
    const elements: Array<{
      id: string;
      type: string;
      data: any;
      created_at: string;
      updated_at: string;
    }> = [];
    
    // Add stroke elements
    paths.forEach((path, index) => {
      elements.push({
        id: `stroke-${index}`,
        type: 'stroke',
        data: {
          points: path.map(point => ({
            x: point.x,
            y: point.y,
            pressure: 0.5,
            tilt: 0
          })),
          color: strokeColor,
          brush_size: strokeWidth,
          brush_type: brushType
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });
    
    // Add text elements
    textBoxes.forEach((textBox, index) => {
      elements.push({
        id: `text-${index}`,
        type: 'text',
        data: {
          content: textBox.text,
          position: {
            x: textBox.x,
            y: textBox.y
          },
          font_family: 'Arial',
          font_size: textBox.fontSize,
          color: textBox.color,
          style: {
            bold: textBox.isBold,
            italic: textBox.isItalic,
            underline: false
          }
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });
    
    // Add image elements
    images.forEach((image, index) => {
      elements.push({
        id: `image-${index}`,
        type: 'image',
        data: {
          uri: image.uri,
          position: {
            x: image.x,
            y: image.y
          },
          width: image.width,
          height: image.height
        },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    });
    
    // Update the canvasFile in the state
    setState((prevState: FileManagementState) => {
      if (!prevState.currentFolder) return prevState;
      
      const updatedFolders = prevState.folders.map((folder: CanvasFolder) => 
        folder.id === prevState.currentFolder?.id
          ? {
              ...folder,
              canvasFile: {
                ...folder.canvasFile,
                elements: elements
              }
            }
          : folder
      );
      
      return {
        ...prevState,
        folders: updatedFolders,
        currentFolder: {
          ...prevState.currentFolder,
          canvasFile: {
            ...prevState.currentFolder.canvasFile,
            elements: elements
          }
        }
      };
    });
  };

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => mode === 'draw',
    onMoveShouldSetPanResponder: () => mode === 'draw',
    onPanResponderGrant: (evt) => {
      console.log("Drawing started");
      const x = evt.nativeEvent.locationX;
      const y = evt.nativeEvent.locationY;
      setCurrentPath([{ x, y }]);
    },
    onPanResponderMove: (evt) => {
      const x = evt.nativeEvent.locationX;
      const y = evt.nativeEvent.locationY;
      setCurrentPath((prev) => [...prev, { x, y }]);
    },
    onPanResponderRelease: () => {
      console.log("Drawing finished");
      setPaths((prev) => {
        const newPaths = [...prev, currentPath];
        // Update canvas elements after paths change
        setTimeout(updateCanvasElements, 0);
        return newPaths;
      });
      setCurrentPath([]);
    },
  }), [mode, currentPath, updateCanvasElements]);

  // Create a ref to store the initial position of the selected textbox when dragging starts.
  const selectedTextBoxInitial = useRef({ x: 0, y: 0 });
  const selectedTextBoxRef = useRef<string | null>(null);
  useEffect(() => {
    selectedTextBoxRef.current = selectedTextBox;
  }, [selectedTextBox]);

  // In your component, define the pan responder for textboxes:
  const textBoxPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => {
        console.log('onStartShouldSetPanResponder called');
        return mode === 'pan'; // Ensure this returns true in pan mode
      },
      onMoveShouldSetPanResponder: () => mode === 'pan',
      onPanResponderGrant: (evt, gestureState) => {
        const boxId = selectedTextBox;
        console.log('Pan started for textbox:', boxId);
        console.log('All textbox IDs:', textBoxes.map(b => b.id));
        
        const currentBox = textBoxes.find(b => b.id === boxId);
        if (currentBox) {
          selectedTextBoxInitial.current = { 
            x: currentBox.x || 0, 
            y: currentBox.y || 0 
          };
          console.log('Initial position:', selectedTextBoxInitial.current);
        } else {
          console.error('Could not find textbox with ID:', boxId);
          console.error('TextBoxes array:', JSON.stringify(textBoxes));
        }
      },
      onPanResponderMove: (evt, gestureState) => {
        const newX = selectedTextBoxInitial.current.x + gestureState.dx;
        const newY = selectedTextBoxInitial.current.y + gestureState.dy;
        // console.log('New position:', { x: newX, y: newY });
      
        // Use the ref value in the update
        setTextBoxes(prevTextBoxes => {
          const updatedTextBoxes = prevTextBoxes.map(box =>
            box.id === selectedTextBoxRef.current
              ? { ...box, x: newX, y: newY }
              : box
          );
          // console.log('Updated textBoxes:', updatedTextBoxes);
          return updatedTextBoxes;
        });
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Optionally update any final state or perform cleanup.
        console.log('Textbox dragging finished');
        // Update canvas elements after textbox movement
        setTimeout(updateCanvasElements, 0);
      },
    })
  );

  // console.log('textBoxPanResponder:', textBoxPanResponder.current);

  const handleUndo = () => {
    setPaths((prev) => {
      const newPaths = prev.slice(0, -1);
      // Update canvas elements after paths change
      setTimeout(updateCanvasElements, 0);
      return newPaths;
    });
  };

  const handleCanvasPress = (e: any) => {
    if (mode === 'text') {
      const newTextBox: TextBox = {
        id: Date.now().toString(),
        x: e.nativeEvent.locationX,
        y: e.nativeEvent.locationY,
        text: '',
        fontSize: 16,
        color: '#000000',
        isBold: false,
        isItalic: false,
        width: 200,
        state: TextBoxState.SELECTED,
      };
      setTextBoxes([...textBoxes, newTextBox]);
      setSelectedTextBox(newTextBox.id);
      // Update canvas elements after textBoxes change
      setTimeout(updateCanvasElements, 0);
    }
  };

  const handleTextBoxPress = (id: string) => {
    console.log('TextBox pressed:', id);
    setSelectedTextBox(id);
  };
  const handleStyleChange = (event: React.MouseEvent<HTMLElement>, id: string) => {
    setSelectedTextBox(id);
    // setStyleAnchorEl(event.currentTarget);
  };

  const handleImagePress = (id: string) => {
    if (mode === 'pan') {
      setSelectedImage(id);
    }
  };

  const handleAddImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      const newImage: ImageElement = {
        id: Date.now().toString(),
        x: 50,
        y: 50,
        width: 200,
        height: 200,
        uri: result.assets[0].uri,
      };
      setImages([...images, newImage]);
      // Update canvas elements after images change
      setTimeout(updateCanvasElements, 0);
    }
  };

  const handleDeleteImage = () => {
    if (selectedImage) {
      setImages(images.filter((img) => img.id !== selectedImage));
      setSelectedImage(null);
      // Update canvas elements after images change
      setTimeout(updateCanvasElements, 0);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.modeButtons}>
          <FontAwesome.Button name="hand-grab-o" size={18} backgroundColor={mode === 'pan' ? 'gray' : 'black'} onPress={() => setMode('pan')} style={styles.button} >
            Pan Mode
          </FontAwesome.Button>
          <FontAwesome.Button name="text-height" size={18} backgroundColor={mode === 'text' ? 'gray' : 'black'} onPress={() => setMode('text')} style={styles.button} >
            Text Mode
          </FontAwesome.Button>
          <FontAwesome.Button name="paint-brush" size={18} backgroundColor={mode === 'draw' ? 'gray' : 'black'} onPress={() => setMode('draw')} style={styles.button}>
            Draw Mode
          </FontAwesome.Button>
        </View>
        <View style={styles.toolControls}>
          <View style={styles.colorPicker}>
            <TouchableOpacity 
              style={[styles.colorButton, { backgroundColor: '#ffffff' }]} 
              onPress={() => setStrokeColor('#ffffff')} 
            />
            <TouchableOpacity 
              style={[styles.colorButton, { backgroundColor: '#ff0000' }]} 
              onPress={() => setStrokeColor('#ff0000')} 
            />
            <TouchableOpacity 
              style={[styles.colorButton, { backgroundColor: '#00ff00' }]} 
              onPress={() => setStrokeColor('#00ff00')} 
            />
            <TouchableOpacity 
              style={[styles.colorButton, { backgroundColor: '#0000ff' }]} 
              onPress={() => setStrokeColor('#0000ff')} 
            />
            <TouchableOpacity 
              style={[styles.colorButton, { backgroundColor: '#ffff00' }]} 
              onPress={() => setStrokeColor('#ffff00')} 
            />
            <TouchableOpacity 
              style={[styles.colorButton, { backgroundColor: '#ff00ff' }]} 
              onPress={() => setStrokeColor('#ff00ff')} 
            />
            <TouchableOpacity 
              style={[styles.colorButton, { backgroundColor: '#00ffff' }]} 
              onPress={() => setStrokeColor('#00ffff')} 
            />
            <TouchableOpacity 
              style={[styles.colorButton, { backgroundColor: '#ffa500' }]} 
              onPress={() => setStrokeColor('#ffa500')} 
            />
          </View>
          <View style={styles.brushSizePicker}>
            <TouchableOpacity 
              style={[styles.brushSizeButton, strokeWidth === 1 && styles.selectedBrushSize]} 
              onPress={() => setStrokeWidth(1)} 
            >
              <Text style={styles.brushSizeText}>1</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.brushSizeButton, strokeWidth === 2 && styles.selectedBrushSize]} 
              onPress={() => setStrokeWidth(2)} 
            >
              <Text style={styles.brushSizeText}>2</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.brushSizeButton, strokeWidth === 3 && styles.selectedBrushSize]} 
              onPress={() => setStrokeWidth(3)} 
            >
              <Text style={styles.brushSizeText}>3</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.brushSizeButton, strokeWidth === 4 && styles.selectedBrushSize]} 
              onPress={() => setStrokeWidth(4)} 
            >
              <Text style={styles.brushSizeText}>4</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.brushSizeButton, strokeWidth === 5 && styles.selectedBrushSize]} 
              onPress={() => setStrokeWidth(5)} 
            >
              <Text style={styles.brushSizeText}>5</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.brushSizeButton, strokeWidth === 8 && styles.selectedBrushSize]} 
              onPress={() => setStrokeWidth(8)} 
            >
              <Text style={styles.brushSizeText}>8</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.undoContainer}>
            <FontAwesome.Button 
              name="undo" 
              size={16} 
              backgroundColor={'black'} 
              onPress={handleUndo} 
              style={styles.undoButton}
            >
              Undo
            </FontAwesome.Button>
          </View>
        </View>
      </View>

      {/* === Divider === */}
      <View style={{ width: 2, backgroundColor: 'gray', marginVertical: 5 }} />

      <View
        style={styles.canvas}
        ref={canvasRef}
        onStartShouldSetResponder={() => true}
        onResponderRelease={handleCanvasPress}
        {...(mode === 'draw' ? panResponder.panHandlers : {})}
      >
        <Svg style={StyleSheet.absoluteFill}>
          {paths.map((stroke, idx) => (
            <Path
              key={`stroke-${idx}-${Math.random()}`}
              d={pointsToSvgPath(stroke)}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
            />
          ))}
          {currentPath.length > 0 && (
            <Path
              d={pointsToSvgPath(currentPath)}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              fill="none"
            />
          )}
        </Svg>
              

        {/* Render text boxes */}
        { textBoxes.map((box) => (
          <View
            key={box.id}
            style={[
              styles.textBox,
              {
                position: 'absolute',
                left: box.x,
                top: box.y,
                width: box.width,
                borderColor: selectedTextBox === box.id ? '#6a99e6' : 'gray',
                zIndex: 10,
              },
            ]}
            {...(mode === 'pan' && selectedTextBox === box.id
              ? textBoxPanResponder.current.panHandlers
              : {})}
          >
            <TouchableOpacity
              onPress={() => handleTextBoxPress(box.id)}
            >
              <TextInput
                style={{
                  fontSize: box.fontSize,
                  color: 'white',
                  fontWeight: box.isBold ? 'bold' : 'normal',
                  fontStyle: box.isItalic ? 'italic' : 'normal',
                }}
                value={box.text}
                onChangeText={(text) =>
                  setTextBoxes((prev) =>
                    prev.map((b) => (b.id === box.id ? { ...b, text } : b))
                  )
                }
                editable={mode === 'text' && selectedTextBox === box.id}
                pointerEvents={mode === 'text' ? 'auto' : 'none'}
              />
            </TouchableOpacity>
          </View>
        ))}

        {/* Render images */}
        {images.map((img) => (
          <TouchableOpacity
            key={img.id}
            style={{
              position: 'absolute',
              left: img.x,
              top: img.y,
              width: img.width,
              height: img.height,
            }}
            onPress={() => handleImagePress(img.id)}
          >
            <Image
              source={{ uri: img.uri }}
              style={{
                width: img.width,
                height: img.height,
                borderWidth: selectedImage === img.id ? 2 : 0,
                borderColor: 'blue',
              }}
            />
          </TouchableOpacity>
        ))}

        <View style={styles.footer}>
        {selectedImage ? (
          <TouchableOpacity onPress={handleDeleteImage} style={styles.deleteImageButton}>
            <Text style={styles.buttonText}>Delete Image</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleAddImage} style={styles.insertImageButton}>
            <Text style={styles.buttonText}>Insert Image</Text>
          </TouchableOpacity>
        )}
      </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080808',
  },
  toolbar: {
    flexDirection: 'column',
    padding: 10,
    backgroundColor: '#0a0a0a',
  },
  modeButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 5,
    marginBottom: 10,
  },
  toolControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  button: {
    padding: 10,
    borderRadius: 5,
    borderColor: '#757474',
    borderWidth: 1,
  },
  canvas: {
    position: 'relative',
    flex: 1,
    marginLeft: 5,
    marginRight: 5,
    backgroundColor: '#17171a',
  },
  textBox: {
    position: 'absolute',
    borderWidth: 1,
    padding: 5,
    backgroundColor: 'transparent',
  },
  footer: {
    padding: 10,
    position: 'absolute',
    bottom: 5,
    right: 5,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 10,
    // backgroundColor: '#2e2b2b',
  },
  insertImageButton: {
    backgroundColor: '#007bff',
    padding: 10,
    borderRadius: 5,
  },
  deleteImageButton: {
    backgroundColor: '#e8171e',
    padding: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  buttonText: {
    color: '#fff',
  },
  colorPicker: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
    maxWidth: '60%',
  },
  colorButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#757474',
  },
  brushSizePicker: {
    flexDirection: 'row',
    gap: 5,
    flexWrap: 'wrap',
    maxWidth: '30%',
  },
  brushSizeButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#757474',
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBrushSize: {
    backgroundColor: '#757474',
  },
  brushSizeText: {
    color: '#ffffff',
    fontSize: 12,
  },
  undoContainer: {
    marginLeft: 'auto',
  },
  undoButton: {
    padding: 8,
  },
});

export default NotePanel;