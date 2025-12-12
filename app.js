import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCUNQAJVJzKU05mD1oJEIgfxTtDi1OXHKA",
  authDomain: "re-teahouse.firebaseapp.com",
  projectId: "re-teahouse",
  storageBucket: "re-teahouse.firebasestorage.app",
  messagingSenderId: "849115470428",
  appId: "1:849115470428:web:0dbae2769eba31963f6499",
  measurementId: "G-T79P5SNVLE"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let isAdmin = false;
let currentRound = null;
let currentTopicId = null;
const clickSequence = [];
const correctSequence = ['实', 'の', '间', '逃'];
const ADMIN_PASSWORD = "Occm007";

signInAnonymously(auth)
  .then((userCredential) => {
    currentUser = userCredential.user;
    loadApp();
  })
  .catch((error) => {
    alert('登录失败: ' + error.message);
  });

async function loadApp() {
  await loadCurrentRound();
  loadTopics();
  checkDailySubmits();
}

async function loadCurrentRound() {
  const roundRef = doc(db, 'rounds', 'current');
  const roundSnap = await getDoc(roundRef);
  if (roundSnap.exists()) {
    currentRound = roundSnap.data();
    if (currentRound.active) {
      document.getElementById('vote-btn').style.display = 'block';
    }
  } else {
    await setDoc(roundRef, { active: false, topics: [] });
    currentRound = { active: false, topics: [] };
  }
}

document.querySelectorAll('#main-title span').forEach(span => {
  span.addEventListener('click', () => {
    const char = span.dataset.char;
    clickSequence.push(char);
    if (clickSequence.length > correctSequence.length) clickSequence.shift();
    if (clickSequence.join('') === correctSequence.join('')) {
      document.getElementById('admin-login').style.display = 'block';
      clickSequence.length = 0;
    }
  });
});

function loginAdmin() {
  const pass = document.getElementById('admin-pass').value;
  if (pass === ADMIN_PASSWORD) {
    isAdmin = true;
    document.getElementById('admin-btn').style.display = 'block';
    document.getElementById('admin-login').style.display = 'none';
    alert('管理员登录成功');
  } else {
    alert('密码错误');
  }
}

function hideAllSections() {
  document.querySelectorAll('section').forEach(s => s.style.display = 'none');
}
function showSubmit() { hideAllSections(); document.getElementById('submit-section').style.display = 'block'; }
function showVote() { hideAllSections(); document.getElementById('vote-section').style.display = 'block'; }
function showAdminControls() { hideAllSections(); document.getElementById('admin-section').style.display = 'block'; }

async function submitTopic() {
  const title = document.getElementById('topic-title').value.trim();
  const content = document.getElementById('topic-content').value.trim();
  const nameInput = document.getElementById('submitter-name').value.trim();
  const anon = document.getElementById('anon-submit').checked;
  if (!title || !content || (!anon && !nameInput)) { alert('请填写完整'); return; }

  const name = anon ? '匿名茶客' : nameInput;

  await addDoc(collection(db, 'topics'), {
    title, content, submitter: name, userId: currentUser.uid,
    timestamp: serverTimestamp(), discussed: false, discussionDate: null
  });

  const anim = document.getElementById('submit-animation');
  anim.innerHTML = '<div class="steam"></div><div class="steam" style="animation-delay:0.3s"></div><div class="steam" style="animation-delay:0.6s"></div>';
  anim.style.display = 'block';
  setTimeout(() => anim.style.display = 'none', 2000);

  alert('提交成功！');
  document.getElementById('submit-section').style.display = 'none';
  checkDailySubmits();
  loadTopics();
}

async function checkDailySubmits() {
  const today = new Date().toISOString().slice(0,10);
  const q = query(collection(db, 'topics'), where('userId', '==', currentUser.uid));
  const snap = await getDocs(q);
  let count = 0;
  snap.forEach(doc => {
    const data = doc.data();
    if (data.timestamp && data.timestamp.toDate().toISOString().slice(0,10) === today) count++;
  });
  const remain = Math.max(0, 3 - count);
  document.getElementById('remain-submits').innerText = remain;
}

async function loadTopics() {
  const activeUl = document.getElementById('active-topics');
  const discussedUl = document.getElementById('discussed-topics');
  activeUl.innerHTML = ''; discussedUl.innerHTML = '';

  const q = query(collection(db, 'topics'), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const data = doc.data();
    const li = document.createElement('li');
    li.innerHTML = `<strong>${data.title}</strong><br>${data.content}<br>—— ${data.submitter}`;
    if (data.discussed) {
      li.onclick = () => openMeeting(doc.id, data);
      discussedUl.appendChild(li);
    } else {
      li.onclick = () => alert('尚未讨论');
      activeUl.appendChild(li);
    }
  });
}

async function openMeeting(topicId, data) {
  currentTopicId = topicId;
  hideAllSections();
  document.getElementById('meeting-section').style.display = 'block';
  document.getElementById('meeting-title').innerText = data.title;
  document.getElementById('meeting-desc').innerText = data.content;
  document.getElementById('meeting-date').innerText = data.discussionDate || '';
  loadComments(topicId);
}

async function loadComments(topicId) {
  const ul = document.getElementById('comments-list');
  ul.innerHTML = '';
  const q = query(collection(db, `topics/${topicId}/comments`), orderBy('timestamp'));
  const snap = await getDocs(q);
  snap.forEach(doc => {
    const data = doc.data();
    const li = document.createElement('li');
    li.textContent = data.text;
    ul.appendChild(li);
  });
}

async function addComment() {
  const text = document.getElementById('new-comment').value.trim();
  if (!text || !currentTopicId) return;
  await addDoc(collection(db, `topics/${currentTopicId}/comments`), {
    text, timestamp: serverTimestamp()
  });
  document.getElementById('new-comment').value = '';
  loadComments(currentTopicId);
}

async function createRound() {
  if (!isAdmin) return alert('无权限');
  await setDoc(doc(db, 'rounds', 'current'), { active: true }, { merge: true });
  document.getElementById('vote-btn').style.display = 'block';
  alert('轮次已激活');
}

function searchTopics() {
  alert('搜索功能待完善');
}

loadApp();
