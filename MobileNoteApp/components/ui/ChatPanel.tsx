import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  images?: {
    id: string;
    url: string;
    fileName: string;
  }[];
}

const ChatPanel = () => {
    const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  const [selectedModel, setSelectedModel] = useState('key0');
  const models = [
    { label: "Model 1", value: 'key0' },
    { label: "Model 2", value: 'key1' },
  ];

  const handleSend = () => {
    if (!input.trim() && selectedImages.length === 0) return;

    const userMessage: Message = {
      id: Date.now(),
      content: input.trim(),
      isUser: true,
      images: selectedImages.map((url, index) => ({
        id: `${Date.now()}-${index}`,
        url,
        fileName: `Image-${index}`,
      })),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedImages([]);
  };
  const handleImageSelect = () => {
    // Simulate image selection (replace with actual image picker logic)
    const newImage = 'https://via.placeholder.com/150';
    setSelectedImages((prev) => [...prev, newImage]);
  };

  const renderMessage = ({ item }: { item: Message }) => (
    <View
      style={[
        styles.messageContainer,
        item.isUser ? styles.userMessage : styles.aiMessage,
      ]}
    >
      <Text style={styles.messageText}>{item.content}</Text>
      {item.images && (
        <View style={styles.imageContainer}>
          {item.images.map((image) => (
            <Image
              key={image.id}
              source={{ uri: image.url }}
              style={styles.messageImage}
            />
          ))}
        </View>
      )}
    </View>
  );
  return (
    <View style={styles.container}>
      <FlatList
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.messageList}
      />

      <View style={styles.footer}>
        <View>
          <Picker
            selectedValue={selectedModel}
            onValueChange={(itemValue) => setSelectedModel(itemValue)}
            mode="dropdown"
            style={styles.picker}
          >
            {models.map((model) => (
              <Picker.Item key={model.value} label={model.label} value={model.value} />
            ))}
          </Picker>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Type your message..."
          />
          <TouchableOpacity onPress={handleImageSelect} style={styles.imageButton}>
            <Text style={styles.buttonText}>Add Image</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleSend} style={styles.sendButton}>
            <Text style={styles.buttonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
      {selectedImages.length > 0 && (
        <ScrollView horizontal style={styles.selectedImagesContainer}>
          {selectedImages.map((uri, index) => (
            <View key={index} style={styles.selectedImageWrapper}>
              <Image source={{ uri }} style={styles.selectedImage} />
              <TouchableOpacity
                style={styles.deleteImageButton}
                onPress={() =>
                  setSelectedImages((prev) =>
                    prev.filter((_, i) => i !== index)
                  )
                }
              >
                <Text style={styles.deleteImageText}>X</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>
      )}
    </View>
  );

};

const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#080808',
    },
    messageList: {
      padding: 10,
    },
    messageContainer: {
      marginBottom: 10,
      padding: 10,
      borderRadius: 10,
      maxWidth: '70%',
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: '#7b87ab',
    },
    aiMessage: {
      alignSelf: 'flex-start',
      backgroundColor: '#4f5157',
    },
    messageText: {
      color: '#ffffff',
    },
    imageContainer: {
      marginTop: 5,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    messageImage: {
        width: 100,
        height: 100,
        marginRight: 5,
        borderRadius: 5,
      },
      footer: {
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        padding: 10,
        borderTopWidth: 1,
        borderColor: '#ccc',
      },
      picker: {
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        height: 40,
        width: 440,
      },
      inputContainer: {
        flexDirection: 'row',
        alignItems:'center',
        padding: 10
      },
      textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        padding: 10,
        marginRight: 10,
      },
      imageButton: {
        backgroundColor: '#6c757d',
        padding: 10,
        borderRadius: 5,
        marginRight: 10,
      },
      sendButton: {
        backgroundColor: '#007bff',
        padding: 10,
        borderRadius: 5,
      },
      buttonText: {
        color: '#fff',
      },
      selectedImagesContainer: {
        padding: 10,
        borderTopWidth: 1,
        borderColor: '#ccc',
      },
      selectedImageWrapper: {
        position: 'relative',
        marginRight: 10,
      },
      selectedImage: {
        width: 100,
        height: 100,
        borderRadius: 5,
      },
      deleteImageButton: {
        position: 'absolute',
        top: 5,
        right: 5,
        backgroundColor: 'red',
        borderRadius: 10,
        padding: 5,
      },
      deleteImageText: {
        color: '#fff',
        fontSize: 12,
      },
    });
export default ChatPanel;