import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Tabs } from 'expo-router';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
  focused?: boolean;
}) {
  // If focused, force color to black
  const iconColor = props.focused ? '#000' : props.color;
  return <FontAwesome size={28} style={{ marginBottom: -3 }} name={props.name} color={iconColor} />;
}

export default function MainLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: Colors[colorScheme ?? 'light'].tabIconDefault,
        headerTitle: '',
        headerLeft: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 10 }}>
            <FontAwesome name="globe" size={28} color="#000" />
          </View>
        ),
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginRight: 10 }}>
            <Pressable onPress={() => router.push('/notifications')} style={{ marginHorizontal: 14 }}>
              <TabBarIcon name="bell-o" color={Colors[colorScheme ?? 'light'].tabIconDefault} focused={true} />
            </Pressable>
            <Pressable onPress={() => router.push('/add-post')} style={{ marginHorizontal: 14 }}>
              <TabBarIcon name="plus-square-o" color={Colors[colorScheme ?? 'light'].tabIconDefault} focused={true} />
            </Pressable>
            <Pressable onPress={() => router.push('/chat')} style={{ marginHorizontal: 14 }}>
              <TabBarIcon name="comment-o" color={Colors[colorScheme ?? 'light'].tabIconDefault} focused={true} />
            </Pressable>
          </View>
        ),
      })}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="home" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="search" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="control-panel"
        options={{
          title: 'Control Panel',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="sliders" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="booking"
        options={{
          title: 'Booking',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="calendar" color={color} focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => <TabBarIcon name="user" color={color} focused={focused} />,
        }}
      />
      {/* Do NOT add user-profile as a tab here! */}
    </Tabs>
  );
}
