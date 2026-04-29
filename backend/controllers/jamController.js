const { admin, db, auth: adminAuth } = require('../config/firebase-admin');
const { v4: uuidv4 } = require('uuid');

const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

// ── In-memory room store (fallback when Firestore is unavailable) ──
const memoryRooms = new Map();
const isFirestoreAvailable = () => {
  try {
    return !!(admin.apps && admin.apps.length > 0);
  } catch {
    return false;
  }
};

const createRoom = async (req, res) => {
  try {
    const userId = req.userId; 
    const { name } = req.body;
    
    const roomCode = generateRoomCode();
    const roomId = uuidv4();

    const roomData = {
      roomCode,
      hostId: userId,
      state: 'waiting', 
      participants: [{ uid: userId, name, joinedAt: new Date().toISOString(), lastSeen: new Date().toISOString() }],
      queue: [],
      currentTrackIndex: 0,
      voteCount: 0,
      voteRoundId: 1,
      startedAt: null,
      seekPosition: 0,
      createdAt: new Date().toISOString(),
      lastActive: new Date().toISOString(),
    };

    let firebaseCustomToken = null;

    if (isFirestoreAvailable()) {
      const roomRef = db.collection('jamRooms').doc(roomId);
      await roomRef.set({
        ...roomData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      });
      firebaseCustomToken = await adminAuth.createCustomToken(userId);
      console.log(`✅ [Jam] Room ${roomCode} created in Firestore (ID: ${roomId})`);
    } else {
      // Store in memory as fallback
      memoryRooms.set(roomId, roomData);
      console.log(`⚠️ [Jam] Room ${roomCode} created in memory (ID: ${roomId}). Firestore unavailable.`);
    }

    res.status(201).json({ 
      message: 'Room created', 
      roomId, 
      roomCode, 
      participantId: userId, 
      firebaseCustomToken,
      // Send full room data so frontend can hydrate immediately
      room: roomData
    });
  } catch (error) {
    console.error('❌ [Jam] Error creating room:', error.message);
    res.status(500).json({ message: 'Error creating room', error: error.message });
  }
};

const joinRoom = async (req, res) => {
  try {
    const userId = req.userId;
    const { roomCode: rawRoomCode, name } = req.body;
    
    // Normalize room code: trim + uppercase
    const roomCode = (rawRoomCode || '').trim().toUpperCase();
    
    if (!roomCode || roomCode.length < 4) {
      return res.status(400).json({ message: 'Invalid room code' });
    }

    console.log(`🔍 [Jam] Join attempt: code="${roomCode}", user="${userId}", name="${name}"`);

    let roomId = null;
    let roomData = null;
    let firebaseCustomToken = null;

    // ── 1. Try Firestore first ──
    if (isFirestoreAvailable()) {
      try {
        const snapshot = await db.collection('jamRooms')
          .where('roomCode', '==', roomCode)
          .limit(1)
          .get();
        
        if (!snapshot.empty) {
          const roomDoc = snapshot.docs[0];
          roomId = roomDoc.id;
          roomData = roomDoc.data();
          
          // Update participant list
          const participants = roomData.participants || [];
          const existingIndex = participants.findIndex(p => p.uid === userId);
          
          if (existingIndex > -1) {
            participants[existingIndex].lastSeen = new Date().toISOString();
            participants[existingIndex].name = name;
          } else {
            participants.push({ uid: userId, name, joinedAt: new Date().toISOString(), lastSeen: new Date().toISOString() });
          }
          
          await db.runTransaction(async (t) => {
            t.update(roomDoc.ref, { 
              participants, 
              lastActive: admin.firestore.FieldValue.serverTimestamp() 
            });
          });

          firebaseCustomToken = await adminAuth.createCustomToken(userId);
          console.log(`✅ [Jam] User "${name}" joined room ${roomCode} via Firestore`);
        }
      } catch (firestoreError) {
        console.error('⚠️ [Jam] Firestore join failed, trying memory:', firestoreError.message);
      }
    }

    // ── 2. Fallback: check in-memory rooms ──
    if (!roomId) {
      for (const [id, room] of memoryRooms.entries()) {
        if (room.roomCode === roomCode) {
          roomId = id;
          roomData = room;
          
          // Update participant list in memory
          const participants = roomData.participants || [];
          const existingIndex = participants.findIndex(p => p.uid === userId);
          
          if (existingIndex > -1) {
            participants[existingIndex].lastSeen = new Date().toISOString();
            participants[existingIndex].name = name;
          } else {
            participants.push({ uid: userId, name, joinedAt: new Date().toISOString(), lastSeen: new Date().toISOString() });
          }
          
          roomData.participants = participants;
          roomData.lastActive = new Date().toISOString();
          memoryRooms.set(id, roomData);
          
          console.log(`✅ [Jam] User "${name}" joined room ${roomCode} via memory store`);
          break;
        }
      }
    }

    // ── 3. Room genuinely not found ──
    if (!roomId) {
      console.log(`❌ [Jam] Room not found for code: "${roomCode}"`);
      return res.status(404).json({ 
        message: `Room "${roomCode}" not found. Please check the code and try again.` 
      });
    }

    res.json({ 
      message: 'Joined room', 
      roomId, 
      participantId: userId, 
      firebaseCustomToken,
      // Send full room data so frontend can hydrate immediately
      room: roomData
    });
  } catch (error) {
    console.error('❌ [Jam] Error joining room:', error.message);
    res.status(500).json({ message: 'Error joining room', error: error.message });
  }
};

const addSong = async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    const { song } = req.body; 

    // Check memory store first
    if (memoryRooms.has(roomId)) {
      const room = memoryRooms.get(roomId);
      const newSong = { ...song, addedBy: userId, addedAt: new Date().toISOString() };
      room.queue.push(newSong);
      
      if (room.state === 'waiting' && room.queue.length === 1) {
        room.state = 'playing';
        room.currentTrackIndex = 0;
        room.seekPosition = 0;
        room.startedAt = new Date().toISOString();
      }
      
      room.lastActive = new Date().toISOString();
      memoryRooms.set(roomId, room);
      return res.json({ message: 'Song added to queue', room });
    }
    
    const roomRef = db.collection('jamRooms').doc(roomId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(roomRef);
      if (!doc.exists) throw new Error('Room not found');
      
      const roomData = doc.data();
      const newSong = { ...song, addedBy: userId, addedAt: new Date().toISOString() };
      
      const updates = {
        queue: [...roomData.queue, newSong],
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      };
      
      // Auto-play
      if (roomData.state === 'waiting' && roomData.queue.length === 0) {
        updates.state = 'playing';
        updates.currentTrackIndex = 0;
        updates.seekPosition = 0;
        updates.startedAt = admin.firestore.FieldValue.serverTimestamp();
      }
      
      t.update(roomRef, updates);
    });

    res.json({ message: 'Song added to queue' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const voteSkip = async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;

    // Check memory store first
    if (memoryRooms.has(roomId)) {
      const room = memoryRooms.get(roomId);
      const currentRound = room.voteRoundId || 1;
      const voteKey = `${currentRound}:${userId}`;
      
      if (!room._votes) room._votes = {};
      if (room._votes[voteKey]) {
        return res.status(400).json({ message: 'Already voted' });
      }
      
      room._votes[voteKey] = true;
      room.voteCount = (room.voteCount || 0) + 1;
      
      const activeParticipants = (room.participants || []).filter(p => {
        return Date.now() - new Date(p.lastSeen).getTime() < 90000;
      });
      const total = activeParticipants.length || 1;
      const threshold = total > 2 ? Math.floor(total / 2) + 1 : 1;
      
      if (room.voteCount >= threshold) {
        room.currentTrackIndex = (room.currentTrackIndex || 0) + 1;
        room.voteCount = 0;
        room.voteRoundId = currentRound + 1;
        room.seekPosition = 0;
        room.startedAt = new Date().toISOString();
        room._votes = {};
        
        if (room.currentTrackIndex >= (room.queue || []).length) {
          room.state = 'ended';
        } else {
          room.state = 'playing';
        }
        
        memoryRooms.set(roomId, room);
        return res.json({ message: 'Skip threshold met', room });
      }
      
      room.lastActive = new Date().toISOString();
      memoryRooms.set(roomId, room);
      return res.json({ message: 'Vote registered', room });
    }
    
    const roomRef = db.collection('jamRooms').doc(roomId);
    
    let skipTriggered = false;
    let oldVoteRoundId = null;
    
    await db.runTransaction(async (t) => {
      const roomDoc = await t.get(roomRef);
      if (!roomDoc.exists) throw new Error('Room not found');
      
      const roomData = roomDoc.data();
      const currentRoundId = roomData.voteRoundId || 1;
      oldVoteRoundId = currentRoundId;
      
      const voteRef = roomRef.collection('votes').doc(`${currentRoundId}_${userId}`);
      const voteDoc = await t.get(voteRef);
      if (voteDoc.exists) throw new Error('Already voted');
      
      const activeParticipants = roomData.participants.filter(p => {
        const diff = Date.now() - new Date(p.lastSeen).getTime();
        return diff < 90000; // Only count those seen in last 90s
      });
      
      const totalParticipants = activeParticipants.length || 1;
      const threshold = totalParticipants > 2 ? Math.floor(totalParticipants / 2) + 1 : 1;
      
      const newVoteCount = roomData.voteCount + 1;
      
      t.set(voteRef, { votedAt: admin.firestore.FieldValue.serverTimestamp() });
      
      if (newVoteCount >= threshold) {
        skipTriggered = true;
        const nextIndex = roomData.currentTrackIndex + 1;
        
        const updates = {
          currentTrackIndex: nextIndex,
          voteCount: 0,
          voteRoundId: currentRoundId + 1,
          seekPosition: 0,
          startedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastActive: admin.firestore.FieldValue.serverTimestamp()
        };
        
        if (nextIndex >= roomData.queue.length) {
          updates.state = 'ended';
        } else {
          updates.state = 'playing';
        }
        
        t.update(roomRef, updates);
      } else {
        t.update(roomRef, { 
          voteCount: newVoteCount,
          lastActive: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    });

    if (skipTriggered) {
      // Async sweep of old votes to keep DB clean
      const votesSnapshot = await roomRef.collection('votes')
        .where(admin.firestore.FieldPath.documentId(), '>=', `${oldVoteRoundId}_`)
        .where(admin.firestore.FieldPath.documentId(), '<', `${oldVoteRoundId}_\uf8ff`)
        .get();
        
      if (!votesSnapshot.empty) {
        const batch = db.batch();
        votesSnapshot.docs.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
      return res.json({ message: 'Skip threshold met' });
    }

    res.json({ message: 'Vote registered' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const play = async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    const { seekPosition = 0 } = req.body;

    // Memory store
    if (memoryRooms.has(roomId)) {
      const room = memoryRooms.get(roomId);
      if (room.hostId !== userId) return res.status(403).json({ message: 'Host only' });
      room.state = 'playing';
      room.seekPosition = seekPosition;
      room.startedAt = new Date().toISOString();
      room.lastActive = new Date().toISOString();
      memoryRooms.set(roomId, room);
      return res.json({ message: 'Playing', room });
    }
    
    const roomRef = db.collection('jamRooms').doc(roomId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(roomRef);
      if (!doc.exists) throw new Error('Room not found');
      if (doc.data().hostId !== userId) throw new Error('Host only');
      
      t.update(roomRef, { 
        state: 'playing', 
        seekPosition,
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActive: admin.firestore.FieldValue.serverTimestamp() 
      });
    });
    
    res.json({ message: 'Playing' });
  } catch (error) {
    res.status(403).json({ message: error.message });
  }
};

const pause = async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    const { currentSeekPosition } = req.body;

    // Memory store
    if (memoryRooms.has(roomId)) {
      const room = memoryRooms.get(roomId);
      if (room.hostId !== userId) return res.status(403).json({ message: 'Host only' });
      room.state = 'paused';
      room.seekPosition = currentSeekPosition || room.seekPosition;
      room.startedAt = null;
      room.lastActive = new Date().toISOString();
      memoryRooms.set(roomId, room);
      return res.json({ message: 'Paused', room });
    }
    
    const roomRef = db.collection('jamRooms').doc(roomId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(roomRef);
      if (!doc.exists) throw new Error('Room not found');
      if (doc.data().hostId !== userId) throw new Error('Host only');
      
      t.update(roomRef, { 
        state: 'paused', 
        seekPosition: currentSeekPosition || doc.data().seekPosition,
        startedAt: null,
        lastActive: admin.firestore.FieldValue.serverTimestamp() 
      });
    });
    
    res.json({ message: 'Paused' });
  } catch (error) {
    res.status(403).json({ message: error.message });
  }
};

const heartbeat = async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;

    // Memory store
    if (memoryRooms.has(roomId)) {
      const room = memoryRooms.get(roomId);
      const participants = room.participants || [];
      const index = participants.findIndex(p => p.uid === userId);
      if (index > -1) {
        participants[index].lastSeen = new Date().toISOString();
      }
      
      // Host migration
      let hostId = room.hostId;
      const hostIndex = participants.findIndex(p => p.uid === hostId);
      if (hostIndex === -1 || (Date.now() - new Date(participants[hostIndex].lastSeen).getTime() > 90000)) {
        const nextActive = participants.find(p => (Date.now() - new Date(p.lastSeen).getTime() <= 90000));
        if (nextActive) hostId = nextActive.uid;
      }
      
      room.participants = participants;
      room.hostId = hostId;
      room.lastActive = new Date().toISOString();
      memoryRooms.set(roomId, room);
      return res.json({ message: 'Heartbeat received', room });
    }

    const roomRef = db.collection('jamRooms').doc(roomId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(roomRef);
      if (!doc.exists) throw new Error('Room not found');
      
      const roomData = doc.data();
      const participants = roomData.participants;
      const index = participants.findIndex(p => p.uid === userId);
      
      if (index > -1) {
        participants[index].lastSeen = new Date().toISOString();
      }
      
      let hostId = roomData.hostId;
      
      // Host Migration Logic
      const hostIndex = participants.findIndex(p => p.uid === hostId);
      if (hostIndex === -1 || (Date.now() - new Date(participants[hostIndex].lastSeen).getTime() > 90000)) {
        const nextActive = participants.find(p => (Date.now() - new Date(p.lastSeen).getTime() <= 90000));
        if (nextActive) {
          hostId = nextActive.uid;
        }
      }
      
      t.update(roomRef, { 
        participants,
        hostId,
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    
    res.json({ message: 'Heartbeat received' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── Host Skip (advance to next track) ──
const skip = async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;

    // Memory store
    if (memoryRooms.has(roomId)) {
      const room = memoryRooms.get(roomId);
      if (room.hostId !== userId) return res.status(403).json({ message: 'Host only' });
      
      room.currentTrackIndex = (room.currentTrackIndex || 0) + 1;
      room.voteCount = 0;
      room.voteRoundId = (room.voteRoundId || 1) + 1;
      room.seekPosition = 0;
      room.startedAt = new Date().toISOString();
      room._votes = {};
      
      if (room.currentTrackIndex >= (room.queue || []).length) {
        room.state = 'ended';
      } else {
        room.state = 'playing';
      }
      
      room.lastActive = new Date().toISOString();
      memoryRooms.set(roomId, room);
      return res.json({ message: 'Skipped', room });
    }

    const roomRef = db.collection('jamRooms').doc(roomId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(roomRef);
      if (!doc.exists) throw new Error('Room not found');
      const roomData = doc.data();
      if (roomData.hostId !== userId) throw new Error('Host only');
      
      const nextIndex = roomData.currentTrackIndex + 1;
      const updates = {
        currentTrackIndex: nextIndex,
        voteCount: 0,
        voteRoundId: (roomData.voteRoundId || 1) + 1,
        seekPosition: 0,
        startedAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (nextIndex >= roomData.queue.length) {
        updates.state = 'ended';
      } else {
        updates.state = 'playing';
      }
      
      t.update(roomRef, updates);
    });
    
    res.json({ message: 'Skipped' });
  } catch (error) {
    res.status(403).json({ message: error.message });
  }
};

// ── Host Remove from Queue ──
const removeFromQueue = async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    const { queueIndex } = req.body;

    if (typeof queueIndex !== 'number') {
      return res.status(400).json({ message: 'queueIndex is required' });
    }

    // Memory store
    if (memoryRooms.has(roomId)) {
      const room = memoryRooms.get(roomId);
      if (room.hostId !== userId) return res.status(403).json({ message: 'Host only' });
      
      if (queueIndex < 0 || queueIndex >= room.queue.length) {
        return res.status(400).json({ message: 'Invalid queue index' });
      }
      
      room.queue.splice(queueIndex, 1);
      
      // Adjust currentTrackIndex if the removed item was before the current track
      if (queueIndex < room.currentTrackIndex) {
        room.currentTrackIndex = Math.max(0, room.currentTrackIndex - 1);
      }
      
      room.lastActive = new Date().toISOString();
      memoryRooms.set(roomId, room);
      return res.json({ message: 'Removed from queue', room });
    }

    const roomRef = db.collection('jamRooms').doc(roomId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(roomRef);
      if (!doc.exists) throw new Error('Room not found');
      const roomData = doc.data();
      if (roomData.hostId !== userId) throw new Error('Host only');
      
      const queue = [...roomData.queue];
      if (queueIndex < 0 || queueIndex >= queue.length) {
        throw new Error('Invalid queue index');
      }
      
      queue.splice(queueIndex, 1);
      
      const updates = {
        queue,
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (queueIndex < roomData.currentTrackIndex) {
        updates.currentTrackIndex = Math.max(0, roomData.currentTrackIndex - 1);
      }
      
      t.update(roomRef, updates);
    });
    
    res.json({ message: 'Removed from queue' });
  } catch (error) {
    res.status(403).json({ message: error.message });
  }
};

// ── GET room state (polling endpoint for non-Firestore mode) ──
const getRoom = async (req, res) => {
  try {
    const { roomId } = req.params;
    
    // Memory store
    if (memoryRooms.has(roomId)) {
      return res.json({ room: memoryRooms.get(roomId) });
    }
    
    if (isFirestoreAvailable()) {
      const doc = await db.collection('jamRooms').doc(roomId).get();
      if (doc.exists) {
        return res.json({ room: doc.data() });
      }
    }
    
    res.status(404).json({ message: 'Room not found' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createRoom, joinRoom, addSong, voteSkip, play, pause, skip, removeFromQueue, heartbeat, getRoom };
