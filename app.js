const firebaseConfig = {
  apiKey: "AIzaSyCUNQAJVJzKU05mD1oJEIgfxTtDi1OXHKA",
  authDomain: "re-teahouse.firebaseapp.com",
  projectId: "re-teahouse",
  storageBucket: "re-teahouse.firebasestorage.app",
  messagingSenderId: "849115470428",
  appId: "1:849115470428:web:0dbae2769eba31963f6499",
  measurementId: "G-T79P5SNVLE"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let isAdmin = false;
let currentRound = { active: false };
let currentTopicId = null;
let clickSequence = [];
const correctSequence = ['实', 'の', '间', '逃'];
const ADMIN_PASSWORD = "Occm007";

auth.signInAnonymously().then(user => {
  currentUser = user.user;
  loadApp();
}).catch(err => alert('登录失败: ' + err.message));

async function loadApp() {
  await loadCurrentRound();
  loadTopics();
  checkDailySubmits();
}

// 加载轮次
async function loadCurrentRound() {
  const docRef = db.collection('rounds').doc('current');
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    currentRound = docSnap.data();
  } else {
    await docRef.set({ active: false });
  }
  document.getElementById('vote-btn').style.display = currentRound.active ? 'block' : 'none';
}

// 隐藏入口
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#main-title span').forEach(span => {
    span.onclick = () => {
      clickSequence.push(span.dataset.char);
      if (clickSequence.length > 4) clickSequence.shift();
      if (clickSequence.join('') === correctSequence.join('')) {
        document.getElementById('admin-login').style.display = 'block';
        clickSequence = [];
      }
    };
  });
});

function loginAdmin() {
  if (document.getElementById('admin-pass').value === ADMIN_PASSWORD) {
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

function showVote() { 
  hideAllSections(); 
  document.getElementById('vote-section').style.display = 'block'; 
  loadVoteTopics();
}

function showAdminControls() { hideAllSections(); document.getElementById('admin-section').style.display = 'block'; loadAdminTopics(); }

// 提交议题
async function submitTopic() {
  const title = document.getElementById('topic-title').value.trim();
  const content = document.getElementById('topic-content').value.trim();
  const anon = document.getElementById('anon-submit').checked;
  const name = anon ? '匿名茶客' : document.getElementById('submitter-name').value.trim();
  if (!title || !content || (!anon && !name)) return alert('请填写完整');

  await db.collection('topics').add({
    title, content, submitter: name, userId: currentUser.uid,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    discussed: false
  });

  // 蒸汽动画
  const anim = document.getElementById('submit-animation');
  anim.innerHTML = '<div class="steam"></div><div class="steam" style="animation-delay:0.3s"></div><div class="steam" style="animation-delay:0.6s"></div>';
  anim.style.display = 'block';
  setTimeout(() => anim.style.display = 'none', 2000);

  alert('提交成功！');
  hideAllSections();
  document.getElementById('home').style.display = 'block';
  loadTopics();
  checkDailySubmits();
}

// 每日限制
async function checkDailySubmits() {
  const today = new Date().toISOString().slice(0,10);
  const snap = await db.collection('topics').where('userId', '==', currentUser.uid).get();
  let count = 0;
  snap.forEach(doc => {
    const ts = doc.data().timestamp;
    if (ts && ts.toDate().toISOString().slice(0,10) === today) count++;
  });
  document.getElementById('remain-submits').innerText = Math.max(0, 3 - count);
}

// 加载议题
async function loadTopics() {
  const active = document.getElementById('active-topics');
  const discussed = document.getElementById('discussed-topics');
  active.innerHTML = ''; discussed.innerHTML = '';

  const snap = await db.collection('topics').orderBy('timestamp', 'desc').get();
  snap.forEach(doc => {
    const data = doc.data();
    const li = document.createElement('li');
    li.innerHTML = `<strong>${data.title}</strong><br>${data.content}<br>—— ${data.submitter}`;
    li.onclick = () => openMeeting(doc.id, data);
    (data.discussed ? discussed : active).appendChild(li);
  });
}

// 打开感想区
async function openMeeting(id, data) {
  currentTopicId = id;
  hideAllSections();
  document.getElementById('meeting-section').style.display = 'block';
  document.getElementById('meeting-title').innerText = data.title;
  document.getElementById('meeting-desc').innerText = data.content;
  document.getElementById('meeting-date').innerText = data.discussionDate || '';
  loadComments(id);
}

// 加载/添加评论
async function loadComments(id) {
  const ul = document.getElementById('comments-list');
  ul.innerHTML = '';
  const snap = await db.collection('topics').doc(id).collection('comments').orderBy('timestamp').get();
  snap.forEach(doc => {
    const li = document.createElement('li');
    li.textContent = doc.data().text;
    ul.appendChild(li);
  });
}

async function addComment() {
  const text = document.getElementById('new-comment').value.trim();
  if (!text || !currentTopicId) return;
  await db.collection('topics').doc(currentTopicId).collection('comments').add({
    text, timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('new-comment').value = '';
  loadComments(currentTopicId);
}

// 投票
async function loadVoteTopics() {
  const ul = document.getElementById('sortable-vote');
  ul.innerHTML = '';
  const snap = await db.collection('topics').where('discussed', '==', false).get();
  snap.forEach(doc => {
    const li = document.createElement('li');
    li.id = doc.id;
    li.textContent = doc.data().title;
    ul.appendChild(li);
  });
  new Sortable(ul, { animation: 150 });
}

async function submitVote() {
  const items = document.getElementById('sortable-vote').children;
  const ranks = Array.from(items).map((li, index) => ({
    topicId: li.id,
    score: items.length - index  // Borda: 第一得N分
  }));

  await db.collection('votes').add({
    userId: currentUser.uid,
    ranks,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });

  // 茶叶动画
  const anim = document.getElementById('vote-animation');
  anim.innerHTML = '<div class="leaf"></div><div class="leaf" style="animation-delay:0.3s"></div>';
  anim.style.display = 'block';
  setTimeout(() => anim.style.display = 'none', 2000);

  alert('投票成功！');
  hideAllSections();
  document.getElementById('home').style.display = 'block';
}

// 管理员
async function createRound() {
  if (!isAdmin) return alert('无权限');
  await db.collection('rounds').doc('current').update({ active: true });
  document.getElementById('vote-btn').style.display = 'block';
  alert('轮次已激活');
}

async function endRound() {
  if (!isAdmin) return alert('无权限');
  // 简单结束 + 选当选（实际可加界面选择）
  alert('结束轮次功能已启用，实际选当选议题请手动标记');
  await db.collection('rounds').doc('current').update({ active: false });
  document.getElementById('vote-btn').style.display = 'none';
}

// 搜索
function searchTopics() {
  const keyword = document.getElementById('search-box').value.trim().toLowerCase();
  document.querySelectorAll('#active-topics li, #discussed-topics li').forEach(li => {
    li.style.display = li.textContent.toLowerCase().includes(keyword) ? 'block' : 'none';
  });
}