import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Alert, Image, TouchableOpacity, Modal, TextInput, Button, Platform, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer'; // Add this import
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';

// Define the Post type for TypeScript
interface Post {
  _id: string;
  user: { _id: string; username: string };
  text?: string;
  photo?: string;
  createdAt: string;
  likes?: string[];
  saves?: string[];
  comments?: Array<{ user: { _id: string; username: string } | string; text: string; createdAt?: string }>;

}

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [tab, setTab] = useState<'Post'|'Itinerary'|'Trip'|'Review'>('Post');
  const [userInfo, setUserInfo] = useState({
    name: '',
    location: '',
    bio: '',
    trips: 0,
    reviews: 0,
    years: 0,
    avatar: null as string | null, // add avatar field
  });
  const [editVisible, setEditVisible] = useState(false);
  const [newBio, setNewBio] = useState(userInfo.bio);
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [likeLoading, setLikeLoading] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<{[postId: string]: string}>({});
  const [commentLoading, setCommentLoading] = useState<string | null>(null);

  // Refetch posts when coming back to profile or after a new post
  const fetchPosts = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      // Decode JWT to get userId and username
      if (token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
        setUserId(payload.userId);
        setUserInfo(info => ({
          ...info,
          name: payload.username || payload.name || payload.user || payload.email || info.name,
        }));
      }
      const res = await fetch('https://577e-31-205-71-190.ngrok-free.app/api/posts');
      const data = await res.json();
      setPosts(data);
    } catch (err) {
      Alert.alert('Error', 'Failed to load posts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts();
  }, []);

  // Listen for navigation focus to refresh posts
  useEffect(() => {
    const unsubscribe = navigation?.addListener?.('focus', fetchPosts);
    return unsubscribe;
  }, [navigation]);

  // Fetch logged-in user's profile (bio, avatar) from backend
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const token = await AsyncStorage.getItem('token');
        if (token && userId) {
          const res = await fetch(`https://577e-31-205-71-190.ngrok-free.app/api/users/profile/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setUserInfo({
              name: data.username || data.name || data.email || '',
              bio: data.bio || '',
              avatar: data.avatar || null,
              location: data.location || '',
              trips: data.trips || 0,
              reviews: data.reviews || 0,
              years: data.years || 0,
            });
            if (data.avatar) setAvatarUri(data.avatar);
          }
        }
      } catch (err) {
        // fallback: do nothing
      }
    };
    fetchProfile();
  }, [userId]);

  // Only show your own posts on your profile
  const userPosts = posts.filter(post => post.user && post.user._id === userId);

  // Pick image from gallery
  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setNewAvatar(result.assets[0].uri);
    }
  };

  // Save profile changes
  const saveProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('token');
      const formData = new FormData();
      formData.append('bio', newBio);
      if (newAvatar) {
        const filename = newAvatar.split('/').pop();
        const match = /\.([\w]+)$/.exec(filename || '');
        const type = match ? `image/${match[1]}` : `image`;
        formData.append('avatar', {
          uri: newAvatar,
          name: filename,
          type,
        } as any);
      }
      const res = await fetch('https://577e-31-205-71-190.ngrok-free.app/api/users/profile', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUserInfo(info => ({ ...info, bio: data.bio, avatar: data.avatar }));
        setAvatarUri(data.avatar);
        setEditVisible(false);
      } else {
        Alert.alert('Error', data.message || 'Failed to update profile');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  // Like/unlike post
  const toggleLike = async (post: Post) => {
    if (!userId) return;
    setLikeLoading(post._id);
    const token = await AsyncStorage.getItem('token');
    const liked = post.likes && post.likes.includes(userId);
    const url = `https://577e-31-205-71-190.ngrok-free.app/api/posts/${post._id}/${liked ? 'unlike' : 'like'}`;
    const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setPosts(posts => posts.map(p => p._id === post._id ? { ...p, likes: data.likes } : p));
    }
    setLikeLoading(null);
  };
  // Save/unsave post
  const toggleSave = async (post: Post) => {
    if (!userId) return;
    setSaveLoading(post._id);
    const token = await AsyncStorage.getItem('token');
    const saved = post.saves && post.saves.includes(userId);
    const url = `https://577e-31-205-71-190.ngrok-free.app/api/posts/${post._id}/${saved ? 'unsave' : 'save'}`;
    const res = await fetch(url, { method: 'POST', headers: { 'Authorization': `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setPosts(posts => posts.map(p => p._id === post._id ? { ...p, saves: data.saves } : p));
    }
    setSaveLoading(null);
  };
  // Add comment
  const addComment = async (post: Post) => {
    if (!userId || !commentText[post._id]?.trim()) return;
    setCommentLoading(post._id);
    const token = await AsyncStorage.getItem('token');
    const url = `https://577e-31-205-71-190.ngrok-free.app/api/posts/${post._id}/comment`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: commentText[post._id] })
    });
    if (res.ok) {
      const data = await res.json();
      setPosts(posts => posts.map(p => p._id === post._id ? { ...p, comments: data.comments } : p));
      setCommentText(t => ({ ...t, [post._id]: '' }));
      Keyboard.dismiss();
    }
    setCommentLoading(null);
  };

  useEffect(() => {
    // If userInfo.avatar is set, update avatarUri
    if (userInfo.avatar) setAvatarUri(userInfo.avatar);
  }, [userInfo.avatar]);

  return (
    <View style={styles.container}>
      {/* Profile Header */}
      <View style={styles.profileHeader}>
        <View style={styles.profileRow}>
          <TouchableOpacity>
            <Image
              style={styles.avatar}
              source={avatarUri ? { uri: avatarUri.startsWith('http') ? avatarUri : `https://577e-31-205-71-190.ngrok-free.app${avatarUri}` } : require('../../assets/images/icon.png')}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name}>{userInfo.name}</Text>
            <Text style={styles.location}>{userInfo.location}</Text>
            <Text style={styles.bio}>{userInfo.bio}</Text>
          </View>
          {/* Always show Edit button for the logged-in user */}
          <TouchableOpacity style={styles.editButton} onPress={() => {
            setEditVisible(true);
            setNewBio(userInfo.bio);
            setNewAvatar(null);
          }}>
            <Text style={styles.editButtonText}>Edit</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statBox}><Text style={styles.statNum}>{userInfo.trips}</Text><Text style={styles.statLabel}>Trips</Text></View>
          <View style={styles.statBox}><Text style={styles.statNum}>{userInfo.reviews}</Text><Text style={styles.statLabel}>Reviews</Text></View>
          <View style={styles.statBox}><Text style={styles.statNum}>{userInfo.years}</Text><Text style={styles.statLabel}>years on travel</Text></View>
        </View>
      </View>
      {/* Tabs */}
      <View style={styles.tabsRow}>
        {['Post','Itinerary','Trip','Review'].map(t => (
          <TouchableOpacity
            key={t}
            style={[styles.tabButton, tab === t ? styles.tabButtonActive : null]}
            onPress={() => setTab(t as any)}>
            <Text style={[styles.tabText, tab === t ? styles.tabTextActive : null]}>{t}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {/* Posts List (only for Post tab) */}
      {tab === 'Post' && (
        loading ? (
          <ActivityIndicator size="large" color="#2f95dc" />
        ) : userPosts.length === 0 ? (
          <Text style={styles.noPosts}>No posts yet.</Text>
        ) : (
          <FlatList
            data={userPosts}
            keyExtractor={item => item._id}
            renderItem={({ item }) => (
              <View style={styles.postCard}>
                {item.photo && (
                  <Image
                    source={{ uri: item.photo.startsWith('http') ? item.photo : `https://577e-31-205-71-190.ngrok-free.app${item.photo}` }}
                    style={styles.postImage}
                  />
                )}
                {item.text ? <Text style={styles.postText}>{item.text}</Text> : null}
                <Text style={styles.postDate}>{new Date(item.createdAt).toLocaleString()}</Text>
                {/* Like/Save/Comment UI */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                  <TouchableOpacity onPress={() => toggleLike(item)} disabled={likeLoading === item._id} style={{ marginRight: 16 }}>
                    <Text style={{ color: (item.likes||[]).includes(userId || '') ? '#e74c3c' : '#888', fontWeight: 'bold' }}>
                      ♥ {item.likes ? item.likes.length : 0}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleSave(item)} disabled={saveLoading === item._id} style={{ marginRight: 16 }}>
                    <Text style={{ color: (item.saves||[]).includes(userId || '') ? '#2f95dc' : '#888', fontWeight: 'bold' }}>
                      💾 {item.saves ? item.saves.length : 0}
                    </Text>
                  </TouchableOpacity>
                  <Text style={{ color: '#888', fontWeight: 'bold' }}>💬 {item.comments ? item.comments.length : 0}</Text>
                </View>
                {/* Comments List */}
                {item.comments && item.comments.length > 0 && (
                  <View style={{ width: '100%', marginTop: 8 }}>
                    {item.comments.slice(-2).map((c: any, idx: number) => (
                      <Text key={idx} style={{ fontSize: 13, color: '#444', marginBottom: 2 }}>
                        <Text style={{ fontWeight: 'bold', color: '#2f95dc' }}>{c.user?.username || 'User'}: </Text>{c.text}
                      </Text>
                    ))}
                    {item.comments.length > 2 && <Text style={{ fontSize: 12, color: '#888' }}>...and {item.comments.length - 2} more</Text>}
                  </View>
                )}
                {/* Add Comment */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                  <TextInput
                    style={{ flex: 1, borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 6, fontSize: 14, backgroundColor: '#fff' }}
                    placeholder="Add a comment..."
                    value={commentText[item._id] || ''}
                    onChangeText={t => setCommentText(txt => ({ ...txt, [item._id]: t }))}
                    editable={commentLoading !== item._id}
                    onSubmitEditing={() => addComment(item)}
                    returnKeyType="send"
                  />
                  <TouchableOpacity onPress={() => addComment(item)} disabled={commentLoading === item._id || !(commentText[item._id]||'').trim()} style={{ marginLeft: 8 }}>
                    <Text style={{ color: '#2f95dc', fontWeight: 'bold' }}>Post</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          />        )
      )}
      {tab !== 'Post' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#888', fontSize: 16 }}>No data for this tab yet.</Text>
        </View>
      )}
      {/* Edit Profile Modal */}
      <Modal visible={editVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={{ fontWeight: 'bold', fontSize: 18, marginBottom: 12 }}>Edit Profile</Text>
            <TouchableOpacity onPress={pickImage} style={{ alignSelf: 'center', marginBottom: 16 }}>
              <Image
                source={newAvatar ? { uri: newAvatar } : avatarUri ? { uri: avatarUri } : require('../../assets/images/icon.png')}
                style={styles.avatar}
              />
              <Text style={{ color: '#2f95dc', marginTop: 4, textAlign: 'center' }}>Change Photo</Text>
            </TouchableOpacity>
            <Text style={{ marginBottom: 4 }}>Bio:</Text>
            <TextInput
              value={newBio}
              onChangeText={setNewBio}
              style={styles.input}
              multiline
              numberOfLines={3}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 16 }}>
              <Button title="Cancel" onPress={() => setEditVisible(false)} color="#888" />
              <Button title="Save" onPress={saveProfile} color="#2f95dc" />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 0,
  },
  profileHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ccc',
    marginBottom: 4,
  },
  name: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  location: {
    fontSize: 14,
    color: '#888',
  },
  bio: {
    fontSize: 14,
    color: '#444',
    marginTop: 2,
  },
  editButton: {
    backgroundColor: '#2f95dc',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
  },
  editButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginBottom: 4,
  },
  statBox: {
    alignItems: 'center',
    flex: 1,
  },
  statNum: {
    fontWeight: 'bold',
    fontSize: 16,
  },
  statLabel: {
    fontSize: 13,
    color: '#888',
  },
  tabsRow: {
    flexDirection: 'row',
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
    margin: 12,
    marginBottom: 0,
    padding: 4,
    justifyContent: 'space-between',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: '#fff',
    borderColor: '#2f95dc',
    borderWidth: 1,
  },
  tabText: {
    color: '#888',
    fontWeight: 'bold',
    fontSize: 15,
  },
  tabTextActive: {
    color: '#2f95dc',
  },
  postCard: {
    width: '95%',
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignSelf: 'center',
    alignItems: 'center',
  },
  postImage: {
    width: 250,
    height: 180,
    borderRadius: 12,
    marginBottom: 8,
    resizeMode: 'cover',
  },
  postText: {
    fontSize: 16,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  postDate: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
  noPosts: {
    marginTop: 32,
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 8,
    fontSize: 15,
    backgroundColor: '#fff',
    minHeight: 48,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
});
