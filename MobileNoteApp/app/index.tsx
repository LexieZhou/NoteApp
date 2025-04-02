import { Text, View } from "react-native";
import React from "react";
import MenuBar from "../components/ui/MenuBar";
import ChatPanel from "../components/ui/ChatPanel";
import NotePanel from "../components/ui/NotePanel";
import { SafeAreaView } from 'react-native';

export default function Index() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{display: 'flex', flexDirection: 'column', height: '100%', width: '100%'}}>
        {/* Menu Bar
        <View style={{flex: 0, height: '12%'}}>
          <MenuBar />
        </View> */}

        {/* NoteApp Content */}
        <View style={{display: 'flex', flexDirection: 'row', height: '100%', overflow: 'hidden'}}>
          <View style={{flex: 2/5}}>
            <ChatPanel />
          </View>
          <View style={{flex: 3/5}}>
            <NotePanel />
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
