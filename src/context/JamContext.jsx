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

/**
 * Determines if we should skip Firestore real-time listeners and use polling.
 * This is true when we got a room from the backend but without a Firebase custom token
 * (meaning the backend is running in memory-only mode).
 */
const shouldUsePolling = (firebaseCustomToken) => {
  return !firebaseCustomToken;
};

/**
 * Only use local-only fallback when the backend is genuinely unreachable.
 */
const shouldUseLocalOnlyFallback = (error) => {
  // Network-level failures where no HTTP response was received at all
  if (!error?.response) {
    const message = error?.message || '';
    return /network error|failed to fetch|networkerror|econnrefused|timeout/i.test(message);
  }
  return false;
};

export const JamProvider = ({ children }) => {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [roomId, setRoomId] = useState(null);
  const [roomCode, setRoomCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [voteStatus, setVoteStatus] = useState({ count: 0, threshold: 0 });
  const [roomHistory, setRoomHistory] = useState(() => {
    const saved = localStorage.getItem('jam_history');
    return saved ? JSON.parse(saved) : [];
  });

  const unsubscribeRoom = useRef(null);
  const heartbeatInterval = useRef(null);
  const pollingInterval = useRef(null);
  const handleRoomSyncRef = useRef(null);

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
    if (!firebaseCustomToken) return false; // No token = can't auth with Firestore
    if (auth.currentUser?.uid === expectedUid) return true;

    try {
      await signInWithCustomToken(auth, firebaseCustomToken);
      return true;
    } catch (error) {
      console.warn('[Jam] Firebase auth failed, will use polling:', error.message);
      return false;
    }
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

  // ── Heartbeat ──
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

    // Server heartbeat
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

  // ── Polling (for when Firestore snapshots aren't available) ──
  const startPolling = useCallback((id) => {
    if (pollingInterval.current) clearInterval(pollingInterval.current);

    const poll = async () => {
      try {
        const headers = await getJamHeaders();
        const res = await axios.get(API(`/jam/${id}`), { headers });
        if (res.data?.room && handleRoomSyncRef.current) {
          handleRoomSyncRef.current(res.data.room);
        }
      } catch (error) {
        console.error('[Jam] Polling error:', error.message);
      }
    };

    // Poll immediately then every 3 seconds
    poll();
    pollingInterval.current = setInterval(() => {
      if (document.visibilityState === 'visible') {
        poll();
      }
    }, 3000);
  }, [getJamHeaders]);

  const stopPolling = useCallback(() => {
    if (pollingInterval.current) {
      clearInterval(pollingInterval.current);
      pollingInterval.current = null;
    }
  }, []);

  // ── Leave Room ──
  const leaveRoom = useCallback(() => {
    if (unsubscribeRoom.current) {
      unsubscribeRoom.current();
      unsubscribeRoom.current = null;
    }
    stopHeartbeat();
    stopPolling();
    setRoomId(null);
    setRoomCode(null);
    setCurrentRoom(null);
    setParticipants([]);
    setIsHost(false);
  }, [stopHeartbeat, stopPolling]);

  // ── Room Sync Handler ──
  const handleRoomSync = useCallback((data) => {
    setCurrentRoom(data);
    setParticipants(data.participants || []);
    setVoteStatus({ count: data.voteCount || 0, threshold: 0 }); 
    
    // Update roomCode from synced data if we don't have it yet
    if (data.roomCode) {
      setRoomCode(prev => prev || data.roomCode);
    }

    const userId = auth.currentUser?.uid || ensureJamIdentity();
    setIsHost(data.hostId === userId);
  }, [ensureJamIdentity]);

  // Keep ref in sync so polling can access latest version
  handleRoomSyncRef.current = handleRoomSync;

  // ── Local Room Subscription (localStorage-based, same-browser only) ──
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

  // ── Join Room ──
  const joinRoom = useCallback(async (code, name) => {
    const normalizedCode = (code || '').trim().toUpperCase();
    if (!normalizedCode) throw new Error('Please enter a room code');

    console.log(`[Jam] Attempting to join room: "${normalizedCode}"`);

    try {
      // ── 1. Try the backend API ──
      const headers = await getJamHeaders();
      const res = await axios.post(API('/jam/join'), { roomCode: normalizedCode, name }, { headers });
      const id = res.data.roomId;
      const token = res.data.firebaseCustomToken;
      
      console.log(`[Jam] Backend join success: roomId=${id}, hasToken=${!!token}`);

      // Set room state immediately
      setRoomId(id);
      setRoomCode(normalizedCode);
      addToHistory({ roomId: id, roomCode: normalizedCode, name });

      // Hydrate from response data immediately (no waiting for snapshot)
      if (res.data.room) {
        handleRoomSync(res.data.room);
      }

      // Try Firestore real-time sync
      const authed = await ensureJamRealtimeAuth(token, res.data.participantId);
      
      if (authed) {
        // Use Firestore real-time snapshots
        unsubscribeRoom.current = onSnapshot(doc(db, 'jamRooms', id), (docSnap) => {
          if (docSnap.exists()) {
            handleRoomSync(docSnap.data());
          } else {
            leaveRoom();
          }
        });
        console.log(`[Jam] Using Firestore real-time sync`);
      } else {
        // Fall back to polling the backend API
        startPolling(id);
        console.log(`[Jam] Using polling sync (no Firestore token)`);
      }

      startHeartbeat(id);
      return id;
    } catch (error) {
      // ── 2. If backend is unreachable, try local rooms ──
      if (shouldUseLocalOnlyFallback(error)) {
        console.warn('[Jam] Backend unreachable, trying local rooms');
        const userId = ensureJamIdentity();
        const rooms = readLocalRooms();
        const match = Object.values(rooms).find((room) => room.roomCode === normalizedCode);
        if (!match) {
          throw new Error(`Room "${normalizedCode}" not found. The backend is offline and no local room matches this code.`);
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
        setRoomCode(match.roomCode);
        addToHistory({ roomId: match.roomId, roomCode: match.roomCode, name });
        subscribeToLocalRoom(match.roomId);
        startHeartbeat(match.roomId);
        return match.roomId;
      }

      // ── 3. Backend returned an error (e.g., 404 Room not found) ──
      const serverMessage = error?.response?.data?.message;
      console.error('[Jam] Join failed:', serverMessage || error.message);
      throw new Error(serverMessage || 'Failed to join room. Please check the code and try again.');
    }
  }, [ensureJamIdentity, ensureJamRealtimeAuth, getJamHeaders, handleRoomSync, leaveRoom, startHeartbeat, startPolling, subscribeToLocalRoom]);

  // ── Create Room ──
  const createRoom = useCallback(async (name) => {
    console.log(`[Jam] Creating room for "${name}"`);
    
    try {
      // ── 1. Try the backend API ──
      const headers = await getJamHeaders();
      const res = await axios.post(API('/jam/create'), { name }, { headers });
      const { roomId: id, roomCode: code } = res.data;
      const token = res.data.firebaseCustomToken;

      console.log(`[Jam] Backend create success: roomId=${id}, code=${code}, hasToken=${!!token}`);

      // Set state immediately
      setRoomId(id);
      setRoomCode(code);
      addToHistory({ roomId: id, roomCode: code, name });

      // Hydrate from response data immediately
      if (res.data.room) {
        handleRoomSync(res.data.room);
      }

      // Try Firestore real-time sync
      const authed = await ensureJamRealtimeAuth(token, res.data.participantId);

      if (authed) {
        unsubscribeRoom.current = onSnapshot(doc(db, 'jamRooms', id), (docSnap) => {
          if (docSnap.exists()) {
            handleRoomSync(docSnap.data());
          }
        });
        console.log(`[Jam] Using Firestore real-time sync`);
      } else {
        // Poll the backend for state updates
        startPolling(id);
        console.log(`[Jam] Using polling sync (no Firestore token)`);
      }

      startHeartbeat(id);
      return { roomId: id, roomCode: code };
    } catch (error) {
      // ── 2. Backend unreachable — pure local fallback ──
      if (shouldUseLocalOnlyFallback(error)) {
        console.warn('[Jam] Backend unreachable, creating local room');
        const userId = ensureJamIdentity();
        const id = `local-${Date.now()}`;
        const code = generateRoomCode();
        const room = {
          roomId: id,
          roomCode: code,
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
        rooms[id] = room;
        writeLocalRooms(rooms);

        setRoomId(id);
        setRoomCode(code);
        addToHistory({ roomId: id, roomCode: code, name });
        subscribeToLocalRoom(id);
        startHeartbeat(id);
        return { roomId: id, roomCode: code };
      }

      console.error('[Jam] Error creating room:', error.message);
      throw error;
    }
  }, [ensureJamIdentity, ensureJamRealtimeAuth, getJamHeaders, handleRoomSync, startHeartbeat, startPolling, subscribeToLocalRoom]);

  // ── Vote Skip ──
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

  // ── Host Commands ──
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
      roomCode,
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
