import { Text, View } from "react-native";
import React, { useRef } from "react";
import MenuBar from "../../components/ui/MenuBar";
import ChatPanel from "../../components/ui/ChatPanel";
import NotePanel from "../../components/ui/NotePanel";
import { SafeAreaView, StyleSheet } from 'react-native';
import * as MediaLibrary from 'expo-media-library';

const Separator = () => <View style={styles.separator} />;

export default function Index() {
  const [status, requestPermission] = MediaLibrary.usePermissions();
  const notePanelRef = useRef(null);

  if (status === null) {
    requestPermission();
  }
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{display: 'flex', flexDirection: 'column', height: '100%', width: '100%'}}>
        <View style={{flex: 0, height: '8%'}}>
          <MenuBar notePanelRef={notePanelRef} />
        </View>

        {/* NoteApp Content */}
        <View style={{display: 'flex', flexDirection: 'row', height: '92%', overflow: 'hidden'}}>
          <View style={{flex: 2/5}}>
            <ChatPanel />
          </View>
          <View style={{width: 1, backgroundColor: 'gray'}} />
          <View style={{flex: 3/5}}>
            <NotePanel ref={notePanelRef} />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  separator: {
    marginVertical: 8,
    borderBottomColor: '#fff',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
