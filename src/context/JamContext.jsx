import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { db, auth } from '../config/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signInWithCustomToken } from 'firebase/auth';
import axios from 'axios';
import { API } from '../config/api';

const JamContext = createContext();
const LOCAL_JAM_STORAGE_KEY = 'jam_rooms_local';
const LOCAL_JAM_EVENT = 'jam-room-local-update';

const generateRoomCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

const readLocalRooms = () => {
  try {
    const saved = localStorage.getItem(LOCAL_JAM_STORAGE_KEY);
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
};

const writeLocalRooms = (rooms) => {
  localStorage.setItem(LOCAL_JAM_STORAGE_KEY, JSON.stringify(rooms));
  window.dispatchEvent(new CustomEvent(LOCAL_JAM_EVENT));
};

const shouldUseLocalJamFallback = (error) => {
  const message = error?.response?.data?.error || error?.response?.data?.message || error?.message || '';
  const status = error?.response?.status;
  return (
    /credentials|project id|network error|auth\/configuration-not-found|failed to fetch|networkerror/i.test(message) ||
    status >= 500
  );
};

export const JamProvider = ({ children }) => {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [voteStatus, setVoteStatus] = useState({ count: 0, threshold: 0 });
  const [roomHistory, setRoomHistory] = useState(() => {
    const saved = localStorage.getItem('jam_history');
    return saved ? JSON.parse(saved) : [];
  });

  const unsubscribeRoom = useRef(null);
  const heartbeatInterval = useRef(null);

  const ensureJamIdentity = useCallback(() => {
    const token = localStorage.getItem('wavify_token');
    if (token && auth.currentUser?.uid) return auth.currentUser.uid;

    let guestId = localStorage.getItem('jam_guest_id');
    if (!guestId) {
      guestId = `guest_${globalThis.crypto?.randomUUID?.() || Date.now()}`;
      localStorage.setItem('jam_guest_id', guestId);
    }

    return guestId;
  }, []);

  const ensureJamRealtimeAuth = useCallback(async (firebaseCustomToken, expectedUid) => {
    if (auth.currentUser?.uid === expectedUid) return;
    if (!firebaseCustomToken) return;

    await signInWithCustomToken(auth, firebaseCustomToken);
  }, []);

  const updateLocalRoom = useCallback((id, updater) => {
    const rooms = readLocalRooms();
    const current = rooms[id];
    if (!current) throw new Error('Room not found');
    const next = updater(structuredClone(current));
    rooms[id] = next;
    writeLocalRooms(rooms);
    return next;
  }, []);

  const getJamHeaders = useCallback(async () => {
    const token = localStorage.getItem('wavify_token');
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }

    const guestId = ensureJamIdentity();
    return { 'X-Guest-Id': guestId };
  }, [ensureJamIdentity]);

  // Persistence for room history
  useEffect(() => {
    localStorage.setItem('jam_history', JSON.stringify(roomHistory));
  }, [roomHistory]);

  const addToHistory = (room) => {
    setRoomHistory(prev => {
      const filtered = prev.filter(r => r.roomId !== room.roomId).slice(0, 4);
      return [{ ...room, joinedAt: new Date().toISOString() }, ...filtered];
    });
  };

  const startHeartbeat = useCallback((id) => {
    if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
    
    if (id.startsWith('local-')) {
      const sendLocalHeartbeat = () => {
        try {
          const userId = ensureJamIdentity();
          updateLocalRoom(id, (room) => {
            room.participants = (room.participants || []).map((participant) =>
              participant.uid === userId
                ? { ...participant, lastSeen: new Date().toISOString() }
                : participant
            );
            room.lastActive = new Date().toISOString();
            return room;
          });
        } catch (error) {
          console.error(error);
        }
      };

      sendLocalHeartbeat();
      heartbeatInterval.current = setInterval(() => {
        if (document.visibilityState === 'visible') {
          sendLocalHeartbeat();
        }
      }, 30000);
      return;
    }

    // Initial heartbeat
    getJamHeaders()
      .then((headers) => axios.post(API(`/jam/${id}/heartbeat`), {}, { headers }))
      .catch(console.error);

    heartbeatInterval.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        getJamHeaders()
          .then((headers) => axios.post(API(`/jam/${id}/heartbeat`), {}, { headers }))
          .catch(console.error);
      }
    }, 30000);
  }, [ensureJamIdentity, getJamHeaders, updateLocalRoom]);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatInterval.current) {
      clearInterval(heartbeatInterval.current);
      heartbeatInterval.current = null;
    }
  }, []);

  const leaveRoom = useCallback(() => {
    if (unsubscribeRoom.current) {
      unsubscribeRoom.current();
      unsubscribeRoom.current = null;
    }
    stopHeartbeat();
    setRoomId(null);
    setCurrentRoom(null);
    setParticipants([]);
    setIsHost(false);
  }, [stopHeartbeat]);

  const handleRoomSync = useCallback((data) => {
    setCurrentRoom(data);
    setParticipants(data.participants || []);
    setVoteStatus({ count: data.voteCount || 0, threshold: 0 }); 
    
    const userId = auth.currentUser?.uid || ensureJamIdentity();
    setIsHost(data.hostId === userId);
  }, [ensureJamIdentity]);

  const subscribeToLocalRoom = useCallback((id) => {
    const syncLocalRoom = () => {
      const rooms = readLocalRooms();
      const room = rooms[id];

      if (room) {
        handleRoomSync(room);
      } else {
        leaveRoom();
      }
    };

    syncLocalRoom();
    window.addEventListener('storage', syncLocalRoom);
    window.addEventListener(LOCAL_JAM_EVENT, syncLocalRoom);

    unsubscribeRoom.current = () => {
      window.removeEventListener('storage', syncLocalRoom);
      window.removeEventListener(LOCAL_JAM_EVENT, syncLocalRoom);
    };
  }, [handleRoomSync, leaveRoom]);

  const joinRoom = useCallback(async (code, name) => {
    try {
      const headers = await getJamHeaders();
      const res = await axios.post(API('/jam/join'), { roomCode: code, name }, { headers });
      const id = res.data.roomId;
      await ensureJamRealtimeAuth(res.data.firebaseCustomToken, res.data.participantId);
      
      setRoomId(id);
      addToHistory({ roomId: id, roomCode: code, name });
      
      // Start listening
      unsubscribeRoom.current = onSnapshot(doc(db, 'jamRooms', id), (doc) => {
        if (doc.exists()) {
          handleRoomSync(doc.data());
        } else {
          leaveRoom();
        }
      });

      startHeartbeat(id);
      return id;
    } catch (error) {
      if (shouldUseLocalJamFallback(error)) {
        const userId = ensureJamIdentity();
        const rooms = readLocalRooms();
        const match = Object.values(rooms).find((room) => room.roomCode === code);
        if (!match) {
          throw new Error('Failed to join room. It may not exist.');
        }

        const updatedRoom = {
          ...match,
          participants: (match.participants || []).some((participant) => participant.uid === userId)
            ? match.participants.map((participant) =>
                participant.uid === userId
                  ? { ...participant, name, lastSeen: new Date().toISOString() }
                  : participant
              )
            : [...(match.participants || []), { uid: userId, name, joinedAt: new Date().toISOString(), lastSeen: new Date().toISOString() }],
          lastActive: new Date().toISOString(),
        };

        rooms[match.roomId] = updatedRoom;
        writeLocalRooms(rooms);
        setRoomId(match.roomId);
        addToHistory({ roomId: match.roomId, roomCode: match.roomCode, name });
        subscribeToLocalRoom(match.roomId);
        startHeartbeat(match.roomId);
        return match.roomId;
      }

      console.error('Error joining jam room:', error);
      throw error;
    }
  }, [ensureJamIdentity, ensureJamRealtimeAuth, getJamHeaders, handleRoomSync, leaveRoom, startHeartbeat, subscribeToLocalRoom]);

  const createRoom = useCallback(async (name) => {
    try {
      const headers = await getJamHeaders();
      const res = await axios.post(API('/jam/create'), { name }, { headers });
      const { roomId, roomCode } = res.data;
      await ensureJamRealtimeAuth(res.data.firebaseCustomToken, res.data.participantId);
      
      setRoomId(roomId);
      addToHistory({ roomId, roomCode, name });

      unsubscribeRoom.current = onSnapshot(doc(db, 'jamRooms', roomId), (doc) => {
        if (doc.exists()) {
          handleRoomSync(doc.data());
        }
      });

      startHeartbeat(roomId);
      return { roomId, roomCode };
    } catch (error) {
      if (shouldUseLocalJamFallback(error)) {
        const userId = ensureJamIdentity();
        const roomId = `local-${Date.now()}`;
        const roomCode = generateRoomCode();
        const room = {
          roomId,
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
          isLocalFallback: true,
        };

        const rooms = readLocalRooms();
        rooms[roomId] = room;
        writeLocalRooms(rooms);

        setRoomId(roomId);
        addToHistory({ roomId, roomCode, name });
        subscribeToLocalRoom(roomId);
        startHeartbeat(roomId);
        return { roomId, roomCode };
      }

      console.error('Error creating jam room:', error);
      throw error;
    }
  }, [ensureJamIdentity, ensureJamRealtimeAuth, getJamHeaders, handleRoomSync, startHeartbeat, subscribeToLocalRoom]);

  const castVote = useCallback(async () => {
    if (!roomId) return;
    if (roomId.startsWith('local-')) {
      const userId = ensureJamIdentity();
      updateLocalRoom(roomId, (room) => {
        const votes = room.localVotes || {};
        const round = room.voteRoundId || 1;
        const voteKey = `${round}:${userId}`;
        if (!votes[voteKey]) {
          votes[voteKey] = true;
          room.voteCount = (room.voteCount || 0) + 1;
          room.localVotes = votes;
        }
        return room;
      });
      return;
    }
    const headers = await getJamHeaders();
    await axios.post(API(`/jam/${roomId}/vote_skip`), {}, { headers });
  }, [ensureJamIdentity, getJamHeaders, roomId, updateLocalRoom]);

  const sendHostCommand = useCallback(async (command, payload = {}) => {
    if (!roomId || !isHost) return;
    if (roomId.startsWith('local-')) {
      updateLocalRoom(roomId, (room) => {
        if (command === 'queue' && payload.song) {
          room.queue = [...(room.queue || []), payload.song];
          if (room.state === 'waiting' && room.queue.length === 1) {
            room.state = 'playing';
            room.currentTrackIndex = 0;
          }
        }

        if (command === 'play') {
          room.state = 'playing';
        }

        if (command === 'pause') {
          room.state = 'paused';
        }

        room.lastActive = new Date().toISOString();
        return room;
      });
      return;
    }
    const headers = await getJamHeaders();
    await axios.post(API(`/jam/${roomId}/${command}`), payload, { headers });
  }, [getJamHeaders, isHost, roomId]);

  return (
    <JamContext.Provider value={{
      currentRoom,
      roomId,
      isHost,
      participants,
      voteStatus,
      roomHistory,
      joinRoom,
      createRoom,
      leaveRoom,
      castVote,
      sendHostCommand
    }}>
      {children}
    </JamContext.Provider>
  );
};

export const useJam = () => useContext(JamContext);
