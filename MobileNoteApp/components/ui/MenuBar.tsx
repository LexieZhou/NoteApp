import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

export default function AppBar() {
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
  }
});