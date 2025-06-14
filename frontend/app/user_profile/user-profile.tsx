import React, { useEffect, useState, useRef } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity, Modal, TextInput, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { useLocalSearchParams } from 'expo-router';
import { FeedRefreshEmitter } from '../main/index';

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

export default function UserProfileScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const [userInfo, setUserInfo] = useState({
    name: '',
    location: '',
    bio: '',
    trips: 0,
    reviews: 0,
    years: 0,
    avatar: null as string | null,
  });
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'Post'|'Itinerary'|'Trip'|'Review'>('Post');
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [showFollowDropdown, setShowFollowDropdown] = useState(false);
  const [likeLoading, setLikeLoading] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<{[postId: string]: string}>({});
  const [commentLoading, setCommentLoading] = useState<string | null>(null);
  const [userIdState, setUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfileAndPosts = async () => {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('token');
        if (token && userId) {
          // Fetch user info
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
          }
          // Fetch posts
          const postsRes = await fetch('https://577e-31-205-71-190.ngrok-free.app/api/posts');
          const postsData = await postsRes.json();
          setPosts(postsData.filter((post: Post) => post.user && post.user._id === userId));
        }
      } catch (err) {
        // fallback: do nothing
      } finally {
        setLoading(false);
      }
    };
    fetchProfileAndPosts();
  }, [userId]);

  // Check if following
  useEffect(() => {
    const checkFollowing = async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
        setCurrentUserId(payload.userId);
        if (userId && payload.userId !== userId) {
          // Fetch user profile to check followers
          const res = await fetch(`https://577e-31-205-71-190.ngrok-free.app/api/users/profile/${userId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (res.ok) {
            const data = await res.json();
            setIsFollowing((data.followers || []).includes(payload.userId));
          }
        }
      }
    };
    checkFollowing();
  }, [userId]);

  useEffect(() => {
    // Get userId from token
    (async () => {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(Buffer.from(base64, 'base64').toString('utf8'));
        setUserId(payload.userId);
      }
    })();
  }, []);

  // Like/unlike post
  const toggleLike = async (post: Post) => {
    if (!currentUserId) return;
    setLikeLoading(post._id);
    const token = await AsyncStorage.getItem('token');
    const liked = post.likes && post.likes.includes(currentUserId);
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
    if (!currentUserId) return;
    setSaveLoading(post._id);
    const token = await AsyncStorage.getItem('token');
    const saved = post.saves && post.saves.includes(currentUserId);
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
    if (!currentUserId || !commentText[post._id]?.trim()) return;
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

  const handleUnfollow = async () => {
    const token = await AsyncStorage.getItem('token');
    if (!token || !userId) return;
    const url = `https://577e-31-205-71-190.ngrok-free.app/api/users/${userId}/unfollow`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      setIsFollowing(false);
      setShowFollowDropdown(false);
      FeedRefreshEmitter.emit();
    }
  };

  const handleMute = async () => {
    // TODO: Implement mute functionality
    setShowFollowDropdown(false);
  };

  const handleRestrict = async () => {
    // TODO: Implement restrict functionality
    setShowFollowDropdown(false);
  };

  return (
    <View style={styles.container}>
      {showFollowDropdown && (
        <TouchableOpacity 
          style={styles.overlay} 
          activeOpacity={0} 
          onPress={() => setShowFollowDropdown(false)}
        />
      )}
      <View style={styles.profileHeader}>
        <View style={styles.profileRow}>
          <TouchableOpacity>
            <Image
              style={styles.avatar}
              source={userInfo.avatar ? { uri: userInfo.avatar.startsWith('http') ? userInfo.avatar : `https://577e-31-205-71-190.ngrok-free.app${userInfo.avatar}` } : require('../../assets/images/icon.png')}
            />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.name}>{userInfo.name}</Text>
            <Text style={styles.location}>{userInfo.location}</Text>
            <Text style={styles.bio}>{userInfo.bio}</Text>
          </View>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {currentUserId !== userId && (
              <View>
                <TouchableOpacity 
                  style={[styles.editButton, { 
                    backgroundColor: isFollowing ? '#fff' : '#2f95dc', 
                    borderWidth: 1, 
                    borderColor: '#2f95dc' 
                  }]}
                  onPress={async () => {
                    if (isFollowing) {
                      setShowFollowDropdown(true);
                    } else {
                      const token = await AsyncStorage.getItem('token');
                      if (!token || !userId) return;
                      const url = `https://577e-31-205-71-190.ngrok-free.app/api/users/${userId}/follow`;
                      const res = await fetch(url, {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${token}` },
                      });
                      if (res.ok) {
                        setIsFollowing(true);
                        FeedRefreshEmitter.emit();
                      }
                    }
                  }}
                >
                  <Text style={[styles.editButtonText, { color: isFollowing ? '#2f95dc' : '#fff' }]}>
                    {isFollowing ? 'Following' : 'Follow'}
                  </Text>
                </TouchableOpacity>
                {showFollowDropdown && (
                  <View style={styles.dropdownMenu}>
                    <TouchableOpacity style={styles.dropdownItem} onPress={handleMute}>
                      <Text style={styles.dropdownText}>Mute</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dropdownItem} onPress={handleRestrict}>
                      <Text style={styles.dropdownText}>Restrict</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.dropdownItem} onPress={handleUnfollow}>
                      <Text style={[styles.dropdownText, { color: '#ff3b30' }]}>Unfollow</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
            <TouchableOpacity style={styles.editButton} onPress={() => {}}>
              <Text style={styles.editButtonText}>Message</Text>
            </TouchableOpacity>
          </View>
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
        ) : posts.length === 0 ? (
          <Text style={styles.noPosts}>No posts yet.</Text>
        ) : (
          <FlatList
            data={posts}
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
                    <Text style={{ color: (item.likes||[]).includes(currentUserId || '') ? '#e74c3c' : '#888', fontWeight: 'bold' }}>
                      ♥ {item.likes ? item.likes.length : 0}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => toggleSave(item)} disabled={saveLoading === item._id} style={{ marginRight: 16 }}>
                    <Text style={{ color: (item.saves||[]).includes(currentUserId || '') ? '#2f95dc' : '#888', fontWeight: 'bold' }}>
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
                        <Text style={{ fontWeight: 'bold', color: '#2f95dc' }}>{typeof c.user === 'object' ? c.user.username : 'User'}: </Text>{c.text}
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
          />
        )
      )}
      {tab !== 'Post' && (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#888', fontSize: 16 }}>No data for this tab yet.</Text>
        </View>
      )}
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
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderColor: '#eee',
    backgroundColor: '#fff',
    paddingVertical: 8,
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 10,
  },
  tabButtonActive: {
    borderBottomWidth: 2,
    borderColor: '#2f95dc',
  },
  tabText: {
    fontSize: 16,
    color: '#444',
  },
  tabTextActive: {
    fontWeight: 'bold',
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
  dropdownMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: 4,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#eee',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  dropdownText: {
    fontSize: 14,
    color: '#444',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
    zIndex: 999,
  },
});
