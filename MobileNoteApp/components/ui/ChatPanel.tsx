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
import DropDownPicker from 'react-native-dropdown-picker';
import FontAwesome from '@expo/vector-icons/FontAwesome';

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
  const [fileValue, setFileValue] = useState([]);
  const [fileItems, setFileItems] = useState([
    {label: 'file1', value: 'file1'},
    {label: 'file2', value: 'file2'},
    {label: 'file3', value: 'file3'},
    {label: 'file4', value: 'file4'},
  ]);

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
        <View style={styles.picker}>
        <DropDownPicker
          placeholder="Select a model"
          open={open}
          value={value}
          items={items}
          // theme={"DARK"}
          setOpen={setOpen}
          setValue={setValue}
          setItems={setItems}
          style={{
            borderColor: '#757474',
            borderRadius: 5,
            backgroundColor: '#080808',
          }}
          containerStyle={{width: 160}}
          textStyle={{
            color: '#FFFFFF',
            fontSize: 16,
          }}
          dropDownContainerStyle={{
            backgroundColor: '#080808',
          }}
          />
          <DropDownPicker
            placeholder="Attach files"
            multiple={true}
            min={0}
            max={5}
            open={fileOpen}
            value={fileValue}
            items={fileItems}
            // theme={"DARK"}
            setOpen={setFileOpen}
            setValue={setFileValue}
            setItems={setFileItems}
            style={{
              borderColor: '#757474',
              borderRadius: 5,
              backgroundColor: '#080808',
            }}
            containerStyle={{width: 240}}
            textStyle={{
              color: '#FFFFFF',
              fontSize: 16,
            }}
            dropDownContainerStyle={{
              backgroundColor: '#080808',
            }}
          />
        </View>

        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Type your message..."
          />
          <View style={styles.imageButton}>
          <FontAwesome.Button name="image" size={18} backgroundColor="gray" onPress={handleImageSelect} >
          </FontAwesome.Button>
          </View>
          <View style={styles.sendButton}>
          <FontAwesome.Button name="paper-plane" size={18} backgroundColor="#007bff" onPress={handleSend} >
            Send
          </FontAwesome.Button>
          </View>
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
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'flex-start',
      padding: 20,
      borderTopWidth: 1,
      borderColor: '#757474',
    },
    picker: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 20,
      marginRight: 10,
      marginLeft: 10,
      marginBottom: 10,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems:'center',
      padding: 10
    },
      textInput: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#757474',
        borderRadius: 5,
        padding: 10,
        marginRight: 10,
      },
      imageButton: {
        backgroundColor: 'black',
        borderRadius: 5,
      },
      sendButton: {
        backgroundColor: '#007bff',
        borderRadius: 5,
        marginLeft: 10,
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