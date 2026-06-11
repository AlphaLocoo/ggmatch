/* ============================================
   voice.js — Aide WebRTC réutilisable
   Mesh vocal (lobby) + 1v1 (room de match)
   Signalisation relayée via socket.io ('webrtc_signal')
   ============================================ */
(function () {
  const ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

  function createVoiceManager(socket, opts) {
    opts = opts || {};
    let localStream = null;
    const peers = {}; // id -> RTCPeerConnection
    const audioEls = {}; // id -> <audio>

    async function getLocalStream() {
      if (!localStream) {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      return localStream;
    }

    function createPeer(id) {
      const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
      peers[id] = pc;
      if (localStream) {
        localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));
      }
      pc.onicecandidate = (e) => {
        if (e.candidate) {
          socket.emit('webrtc_signal', { to: id, data: { type: 'candidate', candidate: e.candidate } });
        }
      };
      pc.ontrack = (e) => {
        let audio = audioEls[id];
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          audio.dataset.peer = id;
          document.body.appendChild(audio);
          audioEls[id] = audio;
        }
        audio.srcObject = e.streams[0];
        if (opts.onRemoteStream) opts.onRemoteStream(id, e.streams[0]);
      };
      return pc;
    }

    // Initie un appel vers un pair déjà présent (je rejoins, j'appelle ceux qui sont là)
    async function callPeer(id) {
      await getLocalStream();
      const pc = peers[id] || createPeer(id);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('webrtc_signal', { to: id, data: { type: 'offer', sdp: offer } });
    }

    async function handleSignal(msg) {
      const from = msg.from;
      const data = msg.data;
      if (!data) return;

      if (data.type === 'offer') {
        await getLocalStream();
        const pc = peers[from] || createPeer(from);
        await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_signal', { to: from, data: { type: 'answer', sdp: answer } });
      } else if (data.type === 'answer') {
        const pc = peers[from];
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      } else if (data.type === 'candidate') {
        const pc = peers[from];
        if (pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch (e) { /* ignore */ }
        }
      }
    }

    function closePeer(id) {
      if (peers[id]) {
        peers[id].close();
        delete peers[id];
      }
      if (audioEls[id]) {
        audioEls[id].remove();
        delete audioEls[id];
      }
    }

    function closeAll() {
      Object.keys(peers).forEach(closePeer);
      if (localStream) {
        localStream.getTracks().forEach((t) => t.stop());
        localStream = null;
      }
    }

    function isMuted() {
      if (!localStream) return true;
      return !localStream.getAudioTracks().some((t) => t.enabled);
    }

    function setMuted(muted) {
      if (!localStream) return;
      localStream.getAudioTracks().forEach((t) => { t.enabled = !muted; });
    }

    return { getLocalStream, callPeer, handleSignal, closePeer, closeAll, isMuted, setMuted, peers };
  }

  window.GGVoice = { createVoiceManager };
})();
