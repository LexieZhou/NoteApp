import React, { useState, useRef, useEffect } from 'react';
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
import * as ImagePicker from 'expo-image-picker';

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

const NotePanel = () => {
  const [mode, setMode] = useState<'text' | 'draw' | 'pan'>('pan');
  const [textBoxes, setTextBoxes] = useState<TextBox[]>([]);
  const [selectedTextBox, setSelectedTextBox] = useState<string | null>(null);
  const [images, setImages] = useState<ImageElement[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const canvasRef = useRef<View>(null);

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
        <TouchableOpacity onPress={() => setMode('pan')} style={styles.button}>
          <Text>Pan</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('text')} style={styles.button}>
          <Text>Text</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMode('draw')} style={styles.button}>
          <Text>Draw</Text>
        </TouchableOpacity>
      </View>

      <View
        style={styles.canvas}
        ref={canvasRef}
        onStartShouldSetResponder={() => true}
        onResponderRelease={handleCanvasPress}
      >
        {textBoxes.map((box) => (
          <View
            key={box.id}
            style={[
              styles.textBox,
              {
                left: box.x,
                top: box.y,
                width: box.width,
                borderColor: selectedTextBox === box.id ? 'blue' : 'gray',
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
        ))}

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
      </View>

      <View style={styles.footer}>
        <Button title="Add Image" onPress={handleAddImage} />
        {selectedImage && (
          <Button title="Delete Image" onPress={handleDeleteImage} color="red" />
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 10,
    backgroundColor: '#f0f0f0',
  },
  button: {
    padding: 10,
    backgroundColor: '#ddd',
    borderRadius: 5,
  },
  canvas: {
    flex: 1,
    backgroundColor: '#fff',
  },
  textBox: {
    position: 'absolute',
    borderWidth: 1,
    padding: 5,
    backgroundColor: '#fff',
  },
  footer: {
    padding: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default NotePanel;