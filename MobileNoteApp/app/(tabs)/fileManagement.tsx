import React, { useState } from "react";
import { View, Text, TouchableOpacity, FlatList, StyleSheet, Modal, TextInput } from "react-native";
import { useFileManagement } from "../../contexts/FileManagementContext";
import { AntDesign, Feather, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

const colors = {
    bg: '#080808',
    fg: '#fff',
    border: '#444',
    accent: '#1e90ff', 
  };

const FileManagement: React.FC = () => {
  const {
    state,
    navigateToFolder,
    navigateUp,
    pickAndUploadFile,
    deleteFile,
    deleteFolder,
    createCanvasFolder,
  } = useFileManagement();

  const [newFolderModal, setNewFolderModal] = useState(false);
  const [folderName, setFolderName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string; isFolder: boolean } | null>(null);
  // change tab
  const router = useRouter();
  const onCanvasOpen = (projectID: string) => {
    router.push({
        pathname: "/(tabs)",
        params: { projectID },
    });
    }

  const renderFolderItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => navigateToFolder(item.id)}
    >
      <AntDesign name="folder1" size={32} color={colors.fg}/>
      <Text style={{ color: colors.fg }} numberOfLines={1}>{item.name}</Text>
      <TouchableOpacity
        style={styles.deleteBtn}
        onPress={() => setDeleteConfirm({ id: item.id, name: item.name, isFolder: true })}
      >
        <MaterialIcons name="delete" size={20} color={colors.fg}/>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderFileItem = ({ item }: any) => (
    <TouchableOpacity
      style={styles.item}
      onPress={() => (item.type === "canvas" ? onCanvasOpen(item.uri) : {/* open with share */})}
    >
      <Feather color={colors.fg}  name={item.type === "canvas" ? "image" : "file"} size={32} />
      <Text style={{ color: colors.fg }} numberOfLines={1}>{item.name}</Text>
      {item.type === "file" && (
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => setDeleteConfirm({ id: item.id, name: item.name, isFolder: false })}
        >
          <MaterialIcons name="delete" size={20} color={colors.fg}/>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {state.currentPath.length > 0 && (
          <TouchableOpacity onPress={navigateUp} style={styles.backBtn}>
            <AntDesign name="arrowleft" size={24} color={colors.fg}/>
            <Text style={{ marginLeft: 4, color: colors.fg }}>Back</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Content */}
      {state.currentFolder ? (
        <FlatList
          data={[state.currentFolder.canvasFile, ...state.currentFolder.files, { id: "__add", type: "add" }]}
          keyExtractor={(item: any) => item.id}
          numColumns={3}
          renderItem={({ item }: any) => {
            if (item.id === "__add") {
              return (
                <TouchableOpacity style={styles.addItem} onPress={pickAndUploadFile}>
                  <AntDesign name="plus" size={32} color={colors.fg}/>
                </TouchableOpacity>
              );
            }
            return renderFileItem({ item });
          }}
          contentContainerStyle={styles.list}
        />
      ) : (
        <FlatList
          data={[...state.folders, { id: "__new", type: "new" }]}
          keyExtractor={(item: any) => item.id}
          numColumns={3}
          renderItem={({ item }: any) => {
            if (item.id === "__new") {
              return (
                <TouchableOpacity style={styles.addItem} onPress={() => setNewFolderModal(true)}>
                  <Feather name="folder-plus" size={32} color={colors.fg}/>
                </TouchableOpacity>
              );
            }
            return renderFolderItem({ item });
          }}
          contentContainerStyle={styles.list}
        />
      )}

      {/* New Folder Modal */}
      <Modal visible={newFolderModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>New Canvas Folder</Text>
            <TextInput
              placeholder="Folder name"
              value={folderName}
              onChangeText={setFolderName}
              style={styles.input}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity onPress={() => setNewFolderModal(false)} style={styles.modalButton}>
                <Text style={{color: colors.fg}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={async () => {
                  if (folderName.trim()) {
                    await createCanvasFolder(folderName.trim());
                    setFolderName("");
                    setNewFolderModal(false);
                  }
                }}
              >
                <Text style={{color: colors.fg}}>Create</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Delete confirm modal */}
      <Modal visible={!!deleteConfirm} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              Delete "{deleteConfirm?.name}"?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalButton} onPress={() => setDeleteConfirm(null)}>
                <Text style={{color: colors.fg}}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={async () => {
                  if (deleteConfirm) {
                    if (deleteConfirm.isFolder) await deleteFolder(deleteConfirm.id);
                    else await deleteFile(deleteConfirm.id);
                    setDeleteConfirm(null);
                  }
                }}
              >
                <Text style={{ color: "red" }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default FileManagement;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.bg, marginTop: 16 },
  
    header: { flexDirection: 'row', alignItems: 'center', padding: 8 },
  
    backBtn: { flexDirection: 'row', alignItems: 'center' },
  
    list: { padding: 8 },
  
    item: {
      flex: 1,
      margin: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      alignItems: 'center',
      position: 'relative',
    },
  
    deleteBtn: { 
        position: 'absolute', 
        top: 4, 
        right: 4,
        padding: 4,
    },
  
    addItem: {
      flex: 1,
      margin: 8,
      padding: 12,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      alignItems: 'center',
      justifyContent: 'center',
    },
  
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',  // darker overlay
      justifyContent: 'center',
      alignItems: 'center',
    },
  
    modalContent: {
      width: '40%',
      backgroundColor: colors.bg,
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },

    modalButton: {
        padding: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: colors.border,   
    },
  
    modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 12, color: colors.fg },
  
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      padding: 8,
      marginBottom: 12,
      color: colors.fg,
    },
  
    modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 16 },
  });
  
