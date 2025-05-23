import React, { useState, useRef, useMemo, useEffect, forwardRef } from 'react';
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
import { GestureHandlerRootView, PinchGestureHandler, PanGestureHandler, GestureEvent } from 'react-native-gesture-handler';
import Animated, { useAnimatedGestureHandler, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

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
  scale?: number;
}

// Each stroke is just an array of [x, y] points
type Stroke = { x: number; y: number }[];

// Smooth points using a moving average with reduced smoothing
function smoothPoints(points: Stroke): Stroke {
  if (points.length < 3) return points;
  
  const smoothed: Stroke = [];
  const windowSize = 2; // Reduced window size for less smoothing
  const smoothingFactor = 0.3; // Reduced smoothing factor
  
  for (let i = 0; i < points.length; i++) {
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    
    // Calculate moving average with reduced window
    for (let j = Math.max(0, i - windowSize + 1); j <= Math.min(points.length - 1, i + windowSize - 1); j++) {
      sumX += points[j].x;
      sumY += points[j].y;
      count++;
    }
    
    // Apply smoothing factor to blend original and smoothed points
    const smoothedX = (sumX / count) * smoothingFactor + points[i].x * (1 - smoothingFactor);
    const smoothedY = (sumY / count) * smoothingFactor + points[i].y * (1 - smoothingFactor);
    
    smoothed.push({
      x: smoothedX,
      y: smoothedY
    });
  }
  
  return smoothed;
}

// Convert an array of points into an SVG path string
function pointsToSvgPath(points: Stroke): string {
  if (points.length === 0) return '';
  
  // Smooth the points using the modified algorithm
  const smoothedPoints = smoothPoints(points);
  
  // Use a simpler path construction for more natural strokes
  let d = `M${smoothedPoints[0].x},${smoothedPoints[0].y}`;
  
  for (let i = 1; i < smoothedPoints.length; i++) {
    d += ` L${smoothedPoints[i].x},${smoothedPoints[i].y}`;
  }
  
  return d;
}

const NotePanel = forwardRef((props, ref) => {
  const { state, setState, loadCanvasData } = useFileManagement();
  const params = useLocalSearchParams();
  const [mode, setMode] = useState<'text' | 'draw' | 'pan'>('pan');
  // ========== Text Boxes ==========
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [selectedTextBox, setSelectedTextBox] = useState<string | null>(null);
  // ========== Images ==========
  const [images, setImages] = useState<ImageElement[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [imageScales, setImageScales] = useState<{ [key: string]: number }>({});
  const [resizingImage, setResizingImage] = useState<string | null>(null);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const [activeCorner, setActiveCorner] = useState<string | null>(null);
  // Add state for image dragging
  const [imageDragStart, setImageDragStart] = useState({ x: 0, y: 0 });
  const [isDraggingImage, setIsDraggingImage] = useState(false);
  // ========== Drawing Strokes ==========
  const [paths, setPaths] = useState<Stroke[]>([]); // all strokes
  const [currentPath, setCurrentPath] = useState<Stroke>([]); // current stroke being drawn
  const [strokeColor, setStrokeColor] = useState('#ffffff');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [brushType, setBrushType] = useState('pen');
  const [showTextStyleControls, setShowTextStyleControls] = useState(false);
  
  const canvasRef = useRef<View>(null);
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const pinchRef = useRef(null);

  type PinchContext = {
    startScale: number;
  };

  const pinchGestureHandler = useAnimatedGestureHandler<GestureEvent<{ scale: number }>, PinchContext>({
    onStart: (_, ctx) => {
      ctx.startScale = scale.value;
    },
    onActive: (event, ctx) => {
      // Limit the scale between 1 and 3
      const newScale = Math.min(Math.max(ctx.startScale * event.scale, 1), 3);
      scale.value = newScale;
    },
    onEnd: () => {
      savedScale.value = scale.value;
    },
  });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ scale: scale.value }],
    };
  });

  const handleImagePinch = useAnimatedGestureHandler<GestureEvent<{ scale: number }>, PinchContext>({
    onStart: (_, ctx) => {
      if (selectedImage) {
        ctx.startScale = imageScales[selectedImage] || 1;
      }
    },
    onActive: (event, ctx) => {
      if (selectedImage) {
        const newScale = Math.min(Math.max(ctx.startScale * event.scale, 0.5), 3);
        setImageScales(prev => ({
          ...prev,
          [selectedImage]: newScale
        }));
      }
    },
    onEnd: () => {
      if (selectedImage) {
        setImages(prev => prev.map(img => 
          img.id === selectedImage 
            ? { ...img, scale: imageScales[selectedImage] || 1 }
            : img
        ));
        setTimeout(updateCanvasElements, 0);
      }
    },
  });

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
          scale: el.data.scale,
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
        const currentBox = textBoxes.find(b => b.id === boxId);
        if (currentBox) {
          selectedTextBoxInitial.current = { 
            x: currentBox.x || 0, 
            y: currentBox.y || 0 
          };
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
        // console.log('Textbox dragging finished');
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
        color: '#ffffff',
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
    if (mode === 'pan') {
      setSelectedImage(null);
      setSelectedTextBox(null);
    }
  };

  const handleTextBoxPress = (id: string) => {
    // console.log('TextBox pressed:', id);
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

  const getImageDimensions = async (uri: string) => {
    return new Promise<{ width: number; height: number }>((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => {
          resolve({ width, height });
        },
        (error) => {
          console.error('Error getting image dimensions:', error);
          reject(error);
        }
      );
    });
  };

  const handleAddImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      try {
        const { width: originalWidth, height: originalHeight } = await getImageDimensions(result.assets[0].uri);
        
        // Set a base width and calculate height to maintain aspect ratio
        const baseWidth = 200;
        const aspectRatio = originalHeight / originalWidth;
        const calculatedHeight = baseWidth * aspectRatio;

        const newImage: ImageElement = {
          id: Date.now().toString(),
          x: 50,
          y: 50,
          width: baseWidth,
          height: calculatedHeight,
          uri: result.assets[0].uri,
          scale: 1,
        };
        setImages([...images, newImage]);
        setImageScales(prev => ({ ...prev, [newImage.id]: 1 }));
        // Update canvas elements after images change
        setTimeout(updateCanvasElements, 0);
      } catch (error) {
        console.error('Error processing image:', error);
        Alert.alert('Error', 'Failed to process the selected image');
      }
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

  const handleTextStyleChange = (property: string, value: any) => {
    if (selectedTextBox) {
      setTextBoxes(prev => {
        const updated = prev.map(box => 
          box.id === selectedTextBox 
            ? { ...box, [property]: value }
            : box
        );
        return updated;
      });
      // Update canvas elements after text style change
      setTimeout(() => {
        updateCanvasElements();
      }, 0);
    }
  };

  const handleResizeStart = (id: string, corner: string) => {
    const image = images.find(img => img.id === id);
    if (image) {
      setResizingImage(id);
      setActiveCorner(corner);
      setResizeStart({
        x: image.x,
        y: image.y,
        width: image.width,
        height: image.height
      });
    }
  };

  const handleResizeMove = (gestureState: any) => {
    if (!resizingImage || !activeCorner) return;

    const image = images.find(img => img.id === resizingImage);
    if (!image) return;

    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    let newX = resizeStart.x;
    let newY = resizeStart.y;

    // Calculate new dimensions based on which corner is being dragged
    switch (activeCorner) {
      case 'topLeft':
        newWidth = resizeStart.width - gestureState.translationX;
        newHeight = resizeStart.height - gestureState.translationY;
        newX = resizeStart.x + gestureState.translationX;
        newY = resizeStart.y + gestureState.translationY;
        break;
      case 'topRight':
        newWidth = resizeStart.width + gestureState.translationX;
        newHeight = resizeStart.height - gestureState.translationY;
        newY = resizeStart.y + gestureState.translationY;
        break;
      case 'bottomLeft':
        newWidth = resizeStart.width - gestureState.translationX;
        newHeight = resizeStart.height + gestureState.translationY;
        newX = resizeStart.x + gestureState.translationX;
        break;
      case 'bottomRight':
        newWidth = resizeStart.width + gestureState.translationX;
        newHeight = resizeStart.height + gestureState.translationY;
        break;
    }

    // Maintain aspect ratio
    const aspectRatio = image.height / image.width;
    if (Math.abs(gestureState.translationX) > Math.abs(gestureState.translationY)) {
      newHeight = newWidth * aspectRatio;
    } else {
      newWidth = newHeight / aspectRatio;
    }

    // Update image dimensions
    setImages(prev => prev.map(img => 
      img.id === resizingImage 
        ? { ...img, x: newX, y: newY, width: newWidth, height: newHeight }
        : img
    ));
  };

  const handleResizeEnd = () => {
    if (resizingImage) {
      setTimeout(updateCanvasElements, 0);
      setResizingImage(null);
      setActiveCorner(null);
    }
  };

  const onPanGestureEvent = (corner: string) => {
    return (event: GestureEvent<{ translationX: number; translationY: number }>) => {
      if (selectedImage) {
        handleResizeStart(selectedImage, corner);
        handleResizeMove(event.nativeEvent);
      }
    };
  };

  const createCornerPanResponder = (corner: string) => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        if (selectedImage) {
          handleResizeStart(selectedImage, corner);
        }
      },
      onPanResponderMove: (_, gestureState) => {
        handleResizeMove(gestureState);
      },
      onPanResponderRelease: handleResizeEnd,
      onPanResponderTerminate: handleResizeEnd,
    });
  };

  const topLeftPanResponder = useMemo(() => createCornerPanResponder('topLeft'), [selectedImage, images]);
  const topRightPanResponder = useMemo(() => createCornerPanResponder('topRight'), [selectedImage, images]);
  const bottomLeftPanResponder = useMemo(() => createCornerPanResponder('bottomLeft'), [selectedImage, images]);
  const bottomRightPanResponder = useMemo(() => createCornerPanResponder('bottomRight'), [selectedImage, images]);

  // Add image pan responder
  const imagePanResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      if (selectedImage) {
        const image = images.find(img => img.id === selectedImage);
        if (image) {
          setImageDragStart({ x: image.x, y: image.y });
          setIsDraggingImage(true);
        }
      }
    },
    onPanResponderMove: (evt, gestureState) => {
      if (selectedImage && isDraggingImage) {
        // Simple direct movement without any scaling or complex calculations
        const newX = imageDragStart.x + gestureState.dx;
        const newY = imageDragStart.y + gestureState.dy;
        
        setImages(prevImages => prevImages.map(img =>
          img.id === selectedImage
            ? { ...img, x: newX, y: newY }
            : img
        ));
      }
    },
    onPanResponderRelease: () => {
      setIsDraggingImage(false);
      setTimeout(updateCanvasElements, 0);
    },
    onPanResponderTerminate: () => {
      setIsDraggingImage(false);
      setTimeout(updateCanvasElements, 0);
    },
  }), [mode, selectedImage, images, imageDragStart, isDraggingImage]);

  const renderCanvasContent = () => (
    <>
      {/* Add grid background */}
      <View style={styles.gridBackground}>
        {Array.from({ length: 50 }).map((_, i) => (
          <View
            key={`horizontal-${i}`}
            style={[
              styles.gridLine,
              {
                top: i * 20,
                width: '100%',
                height: 1,
              },
            ]}
          />
        ))}
        {Array.from({ length: 50 }).map((_, i) => (
          <View
            key={`vertical-${i}`}
            style={[
              styles.gridLine,
              {
                left: i * 20,
                height: '100%',
                width: 1,
              },
            ]}
          />
        ))}
      </View>

      <Svg style={StyleSheet.absoluteFill}>
        {paths.map((stroke, idx) => (
          <Path
            key={`stroke-${idx}-${Math.random()}`}
            d={pointsToSvgPath(stroke)}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        ))}
        {currentPath.length > 0 && (
          <Path
            d={pointsToSvgPath(currentPath)}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        )}
      </Svg>

      {/* Render text boxes */}
      {textBoxes.map((box) => (
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
          <View style={styles.textBoxHeader}>
            <TouchableOpacity
              onPress={() => handleTextBoxPress(box.id)}
              style={styles.textBoxContent}
            >
              <TextInput
                style={{
                  fontSize: box.fontSize,
                  color: box.color,
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
            {selectedTextBox === box.id && (
              <TouchableOpacity
                onPress={() => {
                  setShowTextStyleControls(!showTextStyleControls);
                }}
                style={styles.textStyleButton}
              >
                <FontAwesome name="cog" size={16} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      ))}

      {/* Text Style Controls */}
      {showTextStyleControls && selectedTextBox && (
        <View style={[
          styles.textStyleControls,
          {
            position: 'absolute',
            left: (textBoxes.find(b => b.id === selectedTextBox)?.x || 0) + (textBoxes.find(b => b.id === selectedTextBox)?.width || 0) + 10,
            top: textBoxes.find(b => b.id === selectedTextBox)?.y || 0,
          }
        ]}>
          <View style={styles.textStyleSection}>
            <Text style={styles.textStyleLabel}>Color:</Text>
            <View style={styles.textColorPicker}>
              <TouchableOpacity 
                style={[styles.colorButton, { backgroundColor: '#ffffff' }]} 
                onPress={() => handleTextStyleChange('color', '#ffffff')} 
              />
              <TouchableOpacity 
                style={[styles.colorButton, { backgroundColor: '#ff0000' }]} 
                onPress={() => handleTextStyleChange('color', '#ff0000')} 
              />
              <TouchableOpacity 
                style={[styles.colorButton, { backgroundColor: '#00ff00' }]} 
                onPress={() => handleTextStyleChange('color', '#00ff00')} 
              />
              <TouchableOpacity 
                style={[styles.colorButton, { backgroundColor: '#0000ff' }]} 
                onPress={() => handleTextStyleChange('color', '#0000ff')} 
              />
              <TouchableOpacity 
                style={[styles.colorButton, { backgroundColor: '#ffff00' }]} 
                onPress={() => handleTextStyleChange('color', '#ffff00')} 
              />
              <TouchableOpacity 
                style={[styles.colorButton, { backgroundColor: '#ff00ff' }]} 
                onPress={() => handleTextStyleChange('color', '#ff00ff')} 
              />
            </View>
          </View>
          <View style={styles.textStyleSection}>
            <Text style={styles.textStyleLabel}>Size:</Text>
            <View style={styles.textSizePicker}>
              <TouchableOpacity 
                style={[styles.textSizeButton, textBoxes.find(b => b.id === selectedTextBox)?.fontSize === 12 && styles.selectedTextSize]} 
                onPress={() => handleTextStyleChange('fontSize', 12)} 
              >
                <Text style={styles.textSizeText}>12</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.textSizeButton, textBoxes.find(b => b.id === selectedTextBox)?.fontSize === 16 && styles.selectedTextSize]} 
                onPress={() => handleTextStyleChange('fontSize', 16)} 
              >
                <Text style={styles.textSizeText}>16</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.textSizeButton, textBoxes.find(b => b.id === selectedTextBox)?.fontSize === 20 && styles.selectedTextSize]} 
                onPress={() => handleTextStyleChange('fontSize', 20)} 
              >
                <Text style={styles.textSizeText}>20</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.textSizeButton, textBoxes.find(b => b.id === selectedTextBox)?.fontSize === 24 && styles.selectedTextSize]} 
                onPress={() => handleTextStyleChange('fontSize', 24)} 
              >
                <Text style={styles.textSizeText}>24</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.textSizeButton, textBoxes.find(b => b.id === selectedTextBox)?.fontSize === 28 && styles.selectedTextSize]} 
                onPress={() => handleTextStyleChange('fontSize', 28)} 
              >
                <Text style={styles.textSizeText}>28</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.textSizeButton, textBoxes.find(b => b.id === selectedTextBox)?.fontSize === 32 && styles.selectedTextSize]} 
                onPress={() => handleTextStyleChange('fontSize', 32)} 
              >
                <Text style={styles.textSizeText}>32</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Render images */}
      {images.map((img) => (
        <View
          key={img.id}
          style={{
            position: 'absolute',
            left: img.x,
            top: img.y,
            width: img.width,
            height: img.height,
            zIndex: 10,
          }}
          {...(mode === 'pan' && selectedImage === img.id ? imagePanResponder.panHandlers : {})}
        >
          <TouchableOpacity
            onPress={() => handleImagePress(img.id)}
            style={{ 
              width: '100%', 
              height: '100%',
              backgroundColor: 'transparent', // Make the touch area transparent
            }}
            activeOpacity={1} // Prevent opacity change on press
          >
            <Image
              source={{ uri: img.uri }}
              style={{
                width: '100%',
                height: '100%',
                borderWidth: selectedImage === img.id ? 2 : 0,
                borderColor: 'blue',
              }}
            />
          </TouchableOpacity>
          
          {/* Resize handles */}
          {selectedImage === img.id && mode === 'pan' && (
            <>
              <PanGestureHandler
                onGestureEvent={onPanGestureEvent('topLeft')}
                onEnded={handleResizeEnd}
              >
                <View style={[styles.resizeHandle, styles.topLeft]} />
              </PanGestureHandler>
              <PanGestureHandler
                onGestureEvent={onPanGestureEvent('topRight')}
                onEnded={handleResizeEnd}
              >
                <View style={[styles.resizeHandle, styles.topRight]} />
              </PanGestureHandler>
              <PanGestureHandler
                onGestureEvent={onPanGestureEvent('bottomLeft')}
                onEnded={handleResizeEnd}
              >
                <View style={[styles.resizeHandle, styles.bottomLeft]} />
              </PanGestureHandler>
              <PanGestureHandler
                onGestureEvent={onPanGestureEvent('bottomRight')}
                onEnded={handleResizeEnd}
              >
                <View style={[styles.resizeHandle, styles.bottomRight]} />
              </PanGestureHandler>
            </>
          )}
        </View>
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
    </>
  );

  // Expose the canvasRef to the parent component
  React.useImperativeHandle(ref, () => ({
    getCanvasRef: () => canvasRef.current
  }));

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

      <GestureHandlerRootView style={{ flex: 1 }}>
        <View style={styles.canvasContainer}>
          {mode === 'pan' ? (
            <PinchGestureHandler
              ref={pinchRef}
              onGestureEvent={pinchGestureHandler}
            >
              <Animated.View style={[styles.canvas, animatedStyle]}>
                <View
                  ref={canvasRef}
                  onStartShouldSetResponder={() => true}
                  onResponderRelease={handleCanvasPress}
                  style={styles.canvas}
                >
                  {renderCanvasContent()}
                </View>
              </Animated.View>
            </PinchGestureHandler>
          ) : (
            <View
              style={styles.canvas}
              ref={canvasRef}
              onStartShouldSetResponder={() => true}
              onResponderRelease={handleCanvasPress}
              {...(mode === 'draw' ? panResponder.panHandlers : {})}
            >
              {renderCanvasContent()}
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </View>
  );
});

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
  canvasContainer: {
    flex: 1,
    marginLeft: 5,
    marginRight: 5,
    backgroundColor: '#17171a',
    overflow: 'hidden',
    position: 'relative',
  },
  canvas: {
    position: 'relative',
    flex: 1,
    backgroundColor: '#17171a',
    width: '100%',
    height: '100%',
  },
  textBox: {
    position: 'absolute',
    borderWidth: 1,
    padding: 5,
    backgroundColor: 'transparent',
    height: 40,
    width: 100,
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
    zIndex: 1000,
    backgroundColor: 'rgba(23, 23, 26, 0.8)',
    borderRadius: 5,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
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
  textBoxHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  textBoxContent: {
    flex: 1,
  },
  textStyleButton: {
    padding: 5,
    marginLeft: 5,
  },
  textStyleControls: {
    backgroundColor: '#2e2b2b',
    padding: 10,
    borderRadius: 6,
    zIndex: 1000,
    width: 120,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  textStyleSection: {
    marginBottom: 8,
  },
  textStyleLabel: {
    color: '#ffffff',
    marginBottom: 2,
    fontSize: 12,
    fontWeight: '500',
  },
  textColorPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 4,
  },
  textSizePicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  textSizeButton: {
    width: 25,
    height: 25,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#757474',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
  },
  selectedTextSize: {
    backgroundColor: '#757474',
  },
  textSizeText: {
    color: '#ffffff',
    fontSize: 11,
  },
  gridBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 0,
  },
  gridLine: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  resizeHandle: {
    position: 'absolute',
    width: 20,
    height: 20,
    backgroundColor: 'white',
    borderWidth: 1,
    borderColor: 'blue',
    borderRadius: 10,
  },
  topLeft: {
    top: -10,
    left: -10,
  },
  topRight: {
    top: -10,
    right: -10,
  },
  bottomLeft: {
    bottom: -10,
    left: -10,
  },
  bottomRight: {
    bottom: -10,
    right: -10,
  },
});

export default NotePanel;