import { Tabs } from 'expo-router';
import React from 'react';
import { Platform } from 'react-native';

import { HapticTab } from '../../components/HapticTab';
import { IconSymbol } from '../../components/ui/IconSymbol';
import TabBarBackground from '../../components/ui/TabBarBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { FileManagementProvider } from '../../contexts/FileManagementContext';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <FileManagementProvider>
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarBackground: TabBarBackground,
        tabBarStyle: Platform.select({
          ios: {
            // Use a transparent background on iOS to show the blur effect
            // position: 'absolute',
          },
          default: {},
        }),
      }}>
      <Tabs.Screen
        name="fileManagement"
        options={{
          title: 'File',
          headerShown: false,
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="folder" color={color} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Note',
          headerShown: false,
          tabBarIcon: ({ color }) => <IconSymbol size={25} name="house.fill" color={color} />,
        }}
      />
    </Tabs>
    </FileManagementProvider>
  );
}