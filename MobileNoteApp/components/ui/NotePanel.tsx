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


  const canvasRef = useRef<View>(null);

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
      setPaths((prev) => [...prev, currentPath]);
      setCurrentPath([]);
    },
  }), [mode, currentPath]);
  

  const handleUndo = () => {
    setPaths((prev) => prev.slice(0, -1));
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
    }
  };

  const handleTextBoxPress = (id: string) => {
    if (mode === 'text') {
      setSelectedTextBox(id);
    }
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
    }
  };

  const handleDeleteImage = () => {
    if (selectedImage) {
      setImages(images.filter((img) => img.id !== selectedImage));
      setSelectedImage(null);
    }
  };


  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
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
              stroke="white"
              strokeWidth={3}
              fill="none"
            />
          ))}
          {/* Optionally, render the currentPath being drawn */}
          {currentPath.length > 0 && (
            <Path
              d={pointsToSvgPath(currentPath)}
              stroke="white"
              strokeWidth={3}
            />
          )}
        </Svg>
              

        {/* Render text boxes */}
        {textBoxes.map((box) => (
          <View
            key={box.id}
          >
            <View
            style={[
              styles.textBox,
              {
                left: box.x,
                top: box.y,
                width: box.width,
                borderColor: selectedTextBox === box.id ? '#6a99e6' : 'gray',
              },
            ]}
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
                  prev.map((b) =>
                    b.id === box.id ? { ...b, text } : b
                  )
                )
              }
              onFocus={() => handleTextBoxPress(box.id)}
            />
            </View>
            {mode === 'text' && selectedTextBox === box.id && (
              <FontAwesome.Button name="edit" size={18} backgroundColor="black" onPress={() => handleStyleChange} >
            </FontAwesome.Button>
            )}
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
    flexDirection: 'row',
    justifyContent: 'flex-start',
    gap: 5,
    padding: 10,
    backgroundColor: '#0a0a0a',
  },
  button: {
    padding: 10,
    borderRadius: 5,
    borderColor: '#757474',
    borderWidth: 1,
  },
  canvas: {
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
  }
});

export default NotePanel;