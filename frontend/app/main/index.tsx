import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, FlatList, View, Text, Image, ActivityIndicator, TouchableOpacity, TextInput, Keyboard } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { FontAwesome } from '@expo/vector-icons';

// Add a simple event emitter for feed refresh
export const FeedRefreshEmitter = {
  listeners: [] as (() => void)[],
  subscribe(fn: () => void) { this.listeners.push(fn); return () => this.unsubscribe(fn); },
  unsubscribe(fn: () => void) { this.listeners = this.listeners.filter(l => l !== fn); },
  emit() { this.listeners.forEach(fn => fn()); },
};

export default function HomeFeedScreen() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [likeLoading, setLikeLoading] = useState<string | null>(null);
  const [saveLoading, setSaveLoading] = useState<string | null>(null);
  const [commentText, setCommentText] = useState<{[postId: string]: string}>({});
  const [commentLoading, setCommentLoading] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedComments, setExpandedComments] = useState<string[]>([]);

  // Helper to toggle showing all comments for single post.
  const toggleComments = (postId: string) => {
    setExpandedComments(prev => 
      prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId]
    );
  };

  const fetchFeed = useCallback(async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const res = await fetch('https://577e-31-205-71-190.ngrok-free.app/api/users/feed', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (res.ok) setPosts(data);
    } catch (err) {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFeed();
    // Subscribe to feed refresh events
    const unsub = FeedRefreshEmitter.subscribe(fetchFeed);
    return () => unsub();
  }, [fetchFeed]);

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
  const toggleLike = async (post: any) => {
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
  const toggleSave = async (post: any) => {
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
  const addComment = async (post: any) => {
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Feed</Text>
      {loading ? (
        <ActivityIndicator size="large" color="#2f95dc" style={{ marginTop: 24 }} />
      ) : posts.length === 0 ? (
        <Text style={styles.noPosts}>No posts from followed users yet.</Text>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={item => item._id}
          renderItem={({ item }) => {
            const isExpanded = expandedComments.includes(item._id);
            return (
              <View style={styles.postCard}>
                {item.photo && (
                  <Image
                    source={{
                      uri: item.photo.startsWith('http')
                        ? item.photo
                        : `https://577e-31-205-71-190.ngrok-free.app${item.photo}`,
                    }}
                    style={styles.postImage}
                  />
                )}
                {item.text ? <Text style={styles.postText}>{item.text}</Text> : null}
                <Text style={styles.postUser}>by {item.user?.username || 'Unknown'}</Text>
                <Text style={styles.postDate}>{new Date(item.createdAt).toLocaleString()}</Text>
                {/* Like/Save/Comment UI */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 8,
                    width: '100%',
                    justifyContent: 'flex-start',
                    gap: 18,
                  }}
                >
                  <TouchableOpacity
                    onPress={() => toggleLike(item)}
                    disabled={likeLoading === item._id}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <FontAwesome
                      name={(item.likes || []).includes(userId) ? 'heart' : 'heart-o'}
                      size={22}
                      color={(item.likes || []).includes(userId) ? '#e74c3c' : '#444'}
                    />
                    <Text
                      style={{
                        marginLeft: 4,
                        color: '#444',
                        fontWeight: 'bold',
                        fontSize: 15,
                      }}
                    >
                      {item.likes ? item.likes.length : 0}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => toggleComments(item._id)}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <FontAwesome name="comment-o" size={22} color="#444" />
                    <Text
                      style={{
                        marginLeft: 4,
                        color: '#444',
                        fontWeight: 'bold',
                        fontSize: 15,
                      }}
                    >
                      {item.comments ? item.comments.length : 0}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => toggleSave(item)}
                    disabled={saveLoading === item._id}
                    style={{ flexDirection: 'row', alignItems: 'center' }}
                  >
                    <FontAwesome
                      name={(item.saves || []).includes(userId) ? 'bookmark' : 'bookmark-o'}
                      size={22}
                      color={(item.saves || []).includes(userId) ? '#2f95dc' : '#444'}
                    />
                    <Text
                      style={{
                        marginLeft: 4,
                        color: '#444',
                        fontWeight: 'bold',
                        fontSize: 15,
                      }}
                    >
                      {item.saves ? item.saves.length : 0}
                    </Text>
                  </TouchableOpacity>
                </View>
                {/* Comments List */}
                {item.comments && item.comments.length > 0 && (
                  <View style={{ width: '100%', marginTop: 8 }}>
                    {(isExpanded ? item.comments : item.comments.slice(-2)).map((c: any, idx: number) => {
                      let username = '';
                      if (typeof c.user === 'object' && c.user.username) {
                        username = c.user.username;
                      } else {
                        username = 'User';
                      }
                      return (
                        <Text key={idx} style={{ fontSize: 13, color: '#444', marginBottom: 2 }}>
                          <Text style={{ fontWeight: 'bold', color: '#2f95dc' }}>{username}: </Text>
                          {c.text}
                        </Text>
                      );
                    })}
                    {!isExpanded && item.comments.length > 2 && (
                      <TouchableOpacity onPress={() => toggleComments(item._id)}>
                        <Text style={{ fontSize: 12, color: '#888' }}>
                          View all {item.comments.length} comments
                        </Text>
                      </TouchableOpacity>
                    )}
                    {isExpanded && item.comments.length > 2 && (
                      <TouchableOpacity onPress={() => toggleComments(item._id)}>
                        <Text style={{ fontSize: 12, color: '#888' }}>Hide comments</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {/* Add Comment */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginTop: 6,
                    width: '100%',
                  }}
                >
                  <TextInput
                    style={{
                      flex: 1,
                      borderWidth: 1,
                      borderColor: '#eee',
                      borderRadius: 20,
                      paddingVertical: 7,
                      paddingHorizontal: 14,
                      fontSize: 15,
                      backgroundColor: '#fafafa',
                      marginRight: 8,
                    }}
                    placeholder="Add a comment..."
                    value={commentText[item._id] || ''}
                    onChangeText={t => setCommentText(txt => ({ ...txt, [item._id]: t }))}
                    editable={commentLoading !== item._id}
                    onSubmitEditing={() => addComment(item)}
                    returnKeyType="send"
                  />
                  <TouchableOpacity
                    onPress={() => addComment(item)}
                    disabled={commentLoading === item._id}
                    style={{
                      paddingHorizontal: 8,
                      paddingVertical: 4,
                      borderRadius: 16,
                      backgroundColor: commentText[item._id]?.trim() ? '#2f95dc' : '#ccc',
                    }}
                  >
                    <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 15 }}>Post</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
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
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    margin: 16,
  },
  noPosts: {
    marginTop: 32,
    fontSize: 16,
    color: '#888',
    textAlign: 'center',
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
  postUser: {
    fontSize: 14,
    color: '#2f95dc',
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  postDate: {
    fontSize: 12,
    color: '#888',
    textAlign: 'right',
    alignSelf: 'flex-end',
  },
});
