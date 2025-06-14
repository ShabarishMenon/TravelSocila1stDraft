import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Button, Alert, Image, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';

export default function AddPostScreen() {
  const [text, setText] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setImage(result.assets[0].uri);
    }
  };

  const handleAddPost = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      let formData = new FormData();
      formData.append('text', text);
      if (image) {
        const filename = image.split('/').pop() || 'photo.jpg';
        const match = /\.([\w]+)$/.exec(filename);
        const type = match ? `image/${match[1]}` : 'image';
        formData.append('photo', {
          uri: image,
          name: filename,
          type,
        } as any);
      }
      const res = await fetch('https://577e-31-205-71-190.ngrok-free.app/api/posts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        Alert.alert('Success', 'Post added!');
        setText('');
        setImage(null);
      } else {
        Alert.alert('Error', data.message || 'Failed to add post');
      }
    } catch (err) {
      Alert.alert('Error', 'Network error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Add Post</Text>
      <TextInput
        style={styles.input}
        placeholder="What's on your mind?"
        value={text}
        onChangeText={setText}
        multiline
        numberOfLines={4}
      />
      {image && (
        <Image source={{ uri: image }} style={styles.preview} />
      )}
      <TouchableOpacity style={styles.imageButton} onPress={pickImage}>
        <Text style={styles.imageButtonText}>{image ? 'Change Photo' : 'Add Photo'}</Text>
      </TouchableOpacity>
      <Button title={loading ? 'Posting...' : 'Post'} onPress={handleAddPost} disabled={loading || !text.trim()} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    width: '100%',
    minHeight: 80,
    marginBottom: 16,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  preview: {
    width: 200,
    height: 200,
    borderRadius: 12,
    marginBottom: 16,
    resizeMode: 'cover',
  },
  imageButton: {
    backgroundColor: '#2f95dc',
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 8,
    marginBottom: 16,
  },
  imageButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
