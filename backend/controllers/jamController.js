const { admin, db, auth: adminAuth } = require('../config/firebase-admin');
const { v4: uuidv4 } = require('uuid');

const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const createRoom = async (req, res) => {
  try {
    const userId = req.userId; 
    const { name } = req.body;
    
    const roomCode = generateRoomCode();
    const roomId = uuidv4();
    
    const roomRef = db.collection('jamRooms').doc(roomId);
    
    await roomRef.set({
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
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      lastActive: admin.firestore.FieldValue.serverTimestamp()
    });

    const firebaseCustomToken = await adminAuth.createCustomToken(userId);
    res.status(201).json({ message: 'Room created', roomId, roomCode, participantId: userId, firebaseCustomToken });
  } catch (error) {
    res.status(500).json({ message: 'Error creating room', error: error.message });
  }
};

const joinRoom = async (req, res) => {
  try {
    const userId = req.userId;
    const { roomCode, name } = req.body;
    
    const snapshot = await db.collection('jamRooms').where('roomCode', '==', roomCode).limit(1).get();
    if (snapshot.empty) return res.status(404).json({ message: 'Room not found' });
    
    const roomRef = snapshot.docs[0].ref;
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(roomRef);
      const roomData = doc.data();
      const participants = roomData.participants;
      const index = participants.findIndex(p => p.uid === userId);
      
      if (index > -1) {
        participants[index].lastSeen = new Date().toISOString();
        participants[index].name = name; // Update name just in case
      } else {
        participants.push({ uid: userId, name, joinedAt: new Date().toISOString(), lastSeen: new Date().toISOString() });
      }
      
      t.update(roomRef, { 
        participants, 
        lastActive: admin.firestore.FieldValue.serverTimestamp() 
      });
    });

    const firebaseCustomToken = await adminAuth.createCustomToken(userId);
    res.json({ message: 'Joined room', roomId: snapshot.docs[0].id, participantId: userId, firebaseCustomToken });
  } catch (error) {
    res.status(500).json({ message: 'Error joining room', error: error.message });
  }
};

const addSong = async (req, res) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    const { song } = req.body; 
    
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
      // Async sweep of old votes to keep DB clean (no longer critical for race conditions!)
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
    
    const roomRef = db.collection('jamRooms').doc(roomId);
    
    await db.runTransaction(async (t) => {
      const doc = await t.get(roomRef);
      if (!doc.exists) throw new Error('Room not found');
      if (doc.data().hostId !== userId) throw new Error('Host only');
      
      t.update(roomRef, { 
        state: 'paused', 
        seekPosition: currentSeekPosition || doc.data().seekPosition,
        startedAt: null, // Paused has no active startedAt
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
        // Find next active participant
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

module.exports = { createRoom, joinRoom, addSong, voteSkip, play, pause, heartbeat };
