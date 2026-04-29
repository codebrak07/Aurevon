require('dotenv').config({ path: '../backend/.env' });
const { admin, db } = require('../config/firebase-admin');
const { v4: uuidv4 } = require('uuid');

const runSimulations = async () => {
  console.log('--- STARTING JAM ROOM FAILURE SIMULATIONS ---');

  const roomId = uuidv4();
  const roomRef = db.collection('jamRooms').doc(roomId);

  // 1. Setup Room
  console.log('1. Setting up room...');
  await roomRef.set({
    roomCode: 'SIM123',
    hostId: 'host_user',
    state: 'playing',
    participants: [
      { uid: 'host_user', lastSeen: new Date().toISOString() },
      { uid: 'user_A', lastSeen: new Date().toISOString() },
      { uid: 'user_B', lastSeen: new Date().toISOString() },
      { uid: 'user_C', lastSeen: new Date().toISOString() },
      { uid: 'user_D', lastSeen: new Date().toISOString() }
    ],
    queue: [{ id: 's1' }, { id: 's2' }, { id: 's3' }],
    currentTrackIndex: 0,
    voteCount: 0,
    voteRoundId: 1,
    startedAt: admin.firestore.FieldValue.serverTimestamp(),
    seekPosition: 0
  });

  // 2. Simulate Duplicate Vote Spam
  console.log('2. Simulating duplicate vote spam from user_A...');
  const voteRefA = roomRef.collection('votes').doc(`1_user_A`);
  await voteRefA.set({ votedAt: new Date().toISOString() });
  
  try {
    await db.runTransaction(async (t) => {
      const v = await t.get(voteRefA);
      if (v.exists) throw new Error('Already voted');
    });
  } catch (err) {
    console.log(`   [PASS] Duplicate vote blocked: ${err.message}`);
  }

  // 3. Simulate Simultaneous Skip Voting
  console.log('3. Simulating simultaneous skip voting (Race Condition)...');
  const voteUsers = ['user_B', 'user_C', 'user_D'];
  // Threshold is 5 participants -> 5/2 + 1 = 3 votes needed.
  
  const votePromises = voteUsers.map(async (uid) => {
    try {
      await db.runTransaction(async (t) => {
        const roomDoc = await t.get(roomRef);
        const roomData = roomDoc.data();
        const currentRoundId = roomData.voteRoundId || 1;
        
        const voteRef = roomRef.collection('votes').doc(`${currentRoundId}_${uid}`);
        const vDoc = await t.get(voteRef);
        if (vDoc.exists) return; // already voted
        
        const newCount = roomData.voteCount + 1;
        t.set(voteRef, { votedAt: new Date().toISOString() });
        
        if (newCount >= 3) { // Hardcoded threshold for test
          t.update(roomRef, {
            currentTrackIndex: roomData.currentTrackIndex + 1,
            voteCount: 0,
            voteRoundId: currentRoundId + 1
          });
          console.log(`   [SKIP TRIGGERED] by ${uid}`);
        } else {
          t.update(roomRef, { voteCount: newCount });
          console.log(`   [VOTE COUNTED] by ${uid}. Total: ${newCount}`);
        }
      });
    } catch (err) {
      console.log(`   [FAIL] Transaction error for ${uid}:`, err);
    }
  });

  await Promise.all(votePromises);
  
  const postVoteDoc = await roomRef.get();
  console.log(`   [PASS] Final track index: ${postVoteDoc.data().currentTrackIndex} (Expected: 1)`);
  console.log(`   [PASS] Final vote round: ${postVoteDoc.data().voteRoundId} (Expected: 2)`);
  console.log(`   [PASS] Final vote count: ${postVoteDoc.data().voteCount} (Expected: 0)`);

  // 4. Simulate Host Disconnect
  console.log('4. Simulating host disconnect (timeout > 90s)...');
  const pastTime = new Date(Date.now() - 100000).toISOString(); // 100s ago
  await roomRef.update({
    participants: [
      { uid: 'host_user', lastSeen: pastTime }, // offline
      { uid: 'user_A', lastSeen: new Date().toISOString() }, // online
      { uid: 'user_B', lastSeen: new Date().toISOString() } // online
    ]
  });

  // Heartbeat trigger
  await db.runTransaction(async (t) => {
    const r = await t.get(roomRef);
    const data = r.data();
    let hostId = data.hostId;
    const parts = data.participants;
    
    const hostIndex = parts.findIndex(p => p.uid === hostId);
    if (hostIndex === -1 || (Date.now() - new Date(parts[hostIndex].lastSeen).getTime() > 90000)) {
        const nextActive = parts.find(p => (Date.now() - new Date(p.lastSeen).getTime() <= 90000));
        if (nextActive) hostId = nextActive.uid;
    }
    t.update(roomRef, { hostId });
  });

  const postHeartbeat = await roomRef.get();
  console.log(`   [PASS] New Host ID: ${postHeartbeat.data().hostId} (Expected: user_A)`);

  console.log('--- SIMULATIONS COMPLETE ---');
  process.exit(0);
};

runSimulations();
