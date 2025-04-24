import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Modal } from "react-native";
import { useRouter } from "expo-router";
import FontAwesome from '@expo/vector-icons/FontAwesome';

export default function AppBar() {
  const [showExitDialog, setShowExitDialog] = useState(false);
  const router = useRouter();

  const handleExitCanvas = () => {
    setShowExitDialog(true);
  };

  const handleConfirmExit = (shouldSave: boolean) => {
    if (shouldSave) {
      // call the update canvas api
      console.log("Saving canvas before exit");
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