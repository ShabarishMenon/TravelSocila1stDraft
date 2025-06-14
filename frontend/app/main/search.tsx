import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, FlatList, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const router = useRouter();

  const handleSearch = async (text: string) => {
    setQuery(text);
    if (text.trim().length === 0) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    setSearched(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch(`https://577e-31-205-71-190.ngrok-free.app/api/users/search?q=${encodeURIComponent(text)}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) {
        setResults(data);
      } else {
        setResults([]);
      }
    } catch (err) {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        placeholder="Search by name, username, or email..."
        value={query}
        onChangeText={handleSearch}
        autoCapitalize="none"
      />
      {loading && <ActivityIndicator size="large" color="#2f95dc" style={{ marginTop: 24 }} />}
      {!loading && searched && results.length === 0 && (
        <Text style={styles.noResults}>No users found.</Text>
      )}
      <FlatList
        data={results}
        keyExtractor={item => item._id}
        renderItem={({ item }) => (
          <TouchableOpacity onPress={() => router.push({ pathname: '/user_profile/user-profile', params: { userId: item._id } })}>
            <View style={styles.userCard}>
              <Image
                source={item.avatar ? { uri: item.avatar.startsWith('http') ? item.avatar : `https://577e-31-205-71-190.ngrok-free.app${item.avatar}` } : require('../../assets/images/icon.png')}
                style={styles.avatar}
              />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.username}>{item.username}</Text>
                <Text style={styles.email}>{item.email}</Text>
                {item.bio ? <Text style={styles.bio}>{item.bio}</Text> : null}
              </View>
            </View>
          </TouchableOpacity>
        )}
        style={{ marginTop: 16 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  noResults: {
    marginTop: 32,
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#ccc',
  },
  username: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  email: {
    fontSize: 14,
    color: '#888',
  },
  bio: {
    fontSize: 13,
    color: '#444',
    marginTop: 2,
  },
});
