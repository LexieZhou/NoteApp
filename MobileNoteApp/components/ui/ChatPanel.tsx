import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  FlatList,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import DropDownPicker from 'react-native-dropdown-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { qaAPI } from '../../hooks/api';
import { useFileManagement } from '../../contexts/FileManagementContext';

interface Message {
  id: number;
  content: string;
  isUser: boolean;
  images?: {
    id: string;
    url: string;
    fileName: string;
  }[];
  files?: {
    id: string;
    name: string;
    uri: string;
    type: string;
  }[];
}

interface FileItem {
  label: string;
  value: string;
}

const ChatPanel = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [selectedImages, setSelectedImages] = useState<string[]>([]);
  // model picker
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(null);
  const [items, setItems] = useState([
    {label: 'GPT-4o', value: 'GPT-4o'},
    {label: 'GPT-4', value: 'GPT-4'},
    {label: 'Qwen-2.5', value: 'Qwen-2.5'},
    {label: 'Claude-3.7', value: 'Claude-3.7'},
  ]);

  // file picker
  const [fileOpen, setFileOpen] = useState(false);
  const [fileValue, setFileValue] = useState<string[]>([]);
  const [fileItems, setFileItems] = useState<FileItem[]>([]);

  const { state, clearMessages } = useFileManagement();
  const [isLoading, setIsLoading] = useState(false);

  // Update file items when current folder changes
  useEffect(() => {
    if (state.currentFolder) {
      const folderFiles = state.currentFolder.files.map(file => ({
        label: file.name,
        value: file.id
      }));
      setFileItems(folderFiles);
    }
  }, [state.currentFolder]);

  // Clear messages when currentFolder changes
  useEffect(() => {
    setMessages([]);
    setInput('');
    setSelectedImages([]);
    setFileValue([]);
  }, [state.currentFolder]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please grant permission to access your photos.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setSelectedImages((prev) => [...prev, result.assets[0].uri]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && selectedImages.length === 0 && fileValue.length === 0) return;

    const userMessage: Message = {
      id: Date.now(),
      content: input.trim(),
      isUser: true,
      images: selectedImages.map((url, index) => ({
        id: `${Date.now()}-${index}`,
        url,
        fileName: `Image-${index}`,
      })),
      files: fileValue.map((fileId) => {
        const file = state.currentFolder?.files.find(f => f.id === fileId);
        return {
          id: fileId,
          name: file?.name || 'Unknown file',
          uri: file?.path || '',
          type: 'document'
        };
      })
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setSelectedImages([]);
    setFileValue([]);
    
    if (state.currentFolder?.canvasFile?.id) {
      setIsLoading(true);
      try {
        const contextFileIds = fileValue.length > 0 
          ? fileValue 
          : undefined;
        
        const response = await qaAPI.askQuestion(
          state.currentFolder.canvasFile.id,
          userMessage.content,
          contextFileIds
        );
        
        const aiMessage: Message = {
          id: Date.now() + 1,
          content: response.answer || "I couldn't generate an answer.",
          isUser: false
        };
        
        setMessages((prev) => [...prev, aiMessage]);
      } catch (error) {
        console.error("Error asking question:", error);
        
        const errorMessage: Message = {
          id: Date.now() + 1,
          content: "Sorry, I encountered an error while processing your question.",
          isUser: false
        };
        
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    } else {
      const noCanvasMessage: Message = {
        id: Date.now() + 1,
        content: "Please open a canvas first to ask questions about it.",
        isUser: false
      };
      
      setMessages((prev) => [...prev, noCanvasMessage]);
    }
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

      {isLoading && (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Thinking...</Text>
        </View>
      )}

      <View style={styles.footer}>
        <View style={styles.picker}>
          <View style={styles.dropdownWrapper}>
            <FontAwesome name="cog" size={15} color="#FFFFFF" style={styles.dropdownIcon} />
            <DropDownPicker
              placeholder="Select a model"
              open={open}
              value={value}
              items={items}
              setOpen={setOpen}
              setValue={setValue}
              setItems={setItems}
              style={styles.dropdownStyle}
              containerStyle={styles.dropdownContainer}
              textStyle={styles.dropdownText}
              dropDownContainerStyle={styles.dropdownMenu}
            />
          </View>
          <View style={styles.dropdownWrapper}>
            <FontAwesome name="file" size={15} color="#FFFFFF" style={styles.dropdownIcon} />
            <DropDownPicker
              placeholder="Attach files"
              open={fileOpen}
              value={fileValue}
              items={fileItems}
              setOpen={setFileOpen}
              setValue={setFileValue}
              setItems={setFileItems}
              multiple={true}
              style={styles.dropdownStyle}
              containerStyle={styles.dropdownContainer}
              textStyle={styles.dropdownText}
              dropDownContainerStyle={styles.dropdownMenu}
            />
          </View>
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Type your message..."
            placeholderTextColor="#757474"
            multiline
          />
          <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
            <FontAwesome name="image" size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.sendButton} onPress={handleSend}>
            <FontAwesome name="paper-plane" size={20} color="#FFFFFF" />
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
                onPress={() => setSelectedImages(prev => prev.filter((_, i) => i !== index))}
              >
                <Text style={styles.deleteImageText}>×</Text>
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
      maxWidth: '80%',
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: '#007AFF',
    },
    aiMessage: {
      alignSelf: 'flex-start',
      backgroundColor: '#333333',
    },
    messageText: {
      color: '#FFFFFF',
      fontSize: 16,
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
      padding: 10,
      borderTopWidth: 1,
      borderColor: '#333333',
    },
    picker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      backgroundColor: '#1C1C1E',
      borderRadius: 25,
      marginTop: 10,
    },
    textInput: {
      flex: 1,
      color: '#FFFFFF',
      fontSize: 16,
      paddingHorizontal: 10,
      minHeight: 40,
    },
    imageButton: {
      padding: 10,
      marginHorizontal: 5,
    },
    sendButton: {
      backgroundColor: '#007AFF',
      padding: 10,
      borderRadius: 20,
      marginLeft: 5,
    },
    dropdownWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginLeft: 10,
      marginRight: 10,
    },
    dropdownIcon: {
      marginRight: 4,
    },
    dropdownStyle: {
      backgroundColor: '#1C1C1E',
      borderColor: '#333333',
      borderRadius: 10,
      minHeight: 40,
    },
    dropdownContainer: {
      width: 150,
    },
    dropdownText: {
      color: '#FFFFFF',
      fontSize: 14,
    },
    dropdownMenu: {
      backgroundColor: '#1C1C1E',
      borderColor: '#333333',
    },
    attachButton: {
      padding: 10,
      backgroundColor: '#333333',
      borderRadius: 10,
      marginLeft: 10,
    },
    selectedImagesContainer: {
      padding: 10,
      backgroundColor: '#1C1C1E',
    },
    selectedImageWrapper: {
      marginRight: 10,
      position: 'relative',
    },
    selectedImage: {
      width: 80,
      height: 80,
      borderRadius: 10,
    },
    deleteImageButton: {
      position: 'absolute',
      top: -5,
      right: -5,
      backgroundColor: '#FF3B30',
      borderRadius: 12,
      width: 24,
      height: 24,
      justifyContent: 'center',
      alignItems: 'center',
    },
    deleteImageText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: 'bold',
    },
    loadingContainer: {
      padding: 10,
      alignItems: 'center',
    },
    loadingText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontStyle: 'italic',
    },
  });
export default ChatPanel;