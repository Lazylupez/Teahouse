// app.js (优化和安全增强版本)

const firebaseConfig = {
  apiKey: "AIzaSyCUNQAJVJzKU05mD1oJEIgfxTtDi1OXHKA",
  authDomain: "re-teahouse.firebaseapp.com",
  projectId: "re-teahouse",
  storageBucket: "re-teahouse.firebasestorage.app",
  messagingSenderId: "849115470428",
  appId: "1:849115470428:web:0dbae2769eba31963f6499",
  measurementId: "G-T79P5SNVLE"
};

// 使用 const 而不是 Const
const MAX_DAILY_SUBMITS = 3; // 定义最大提交次数为常量

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let currentUser = null;
let currentRound = { active: false };
let currentTopicId = null;
let clickSequence = [];
const correctSequence = ['实', 'の', '间', '逃'];
// 移除 ADMIN_PASSWORD 和 isAdmin

auth.signInAnonymously().then(user => {
  currentUser = user.user;
  loadApp();
  checkAdminRole(currentUser.uid); // 新增：检查管理员权限
}).catch(err => alert('登录失败: ' + err.message));

async function loadApp() {
  await loadCurrentRound();
  loadTopics();
  checkDailySubmits();
}

// 新增函数：检查并启用管理员权限
async function checkAdminRole(uid) {
  try {
    const docSnap = await db.collection('roles').doc(uid).get();
    
    // 如果是管理员，直接显示管理员按钮
    if (docSnap.exists && docSnap.data().isAdmin === true) {
      document.getElementById('admin-btn').style.display = 'block';
    }
  } catch (error) {
    console.error("检查管理员角色失败:", error);
  }
}

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

// 隐藏入口修改：现在只做触发器，不再需要密码验证
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('#main-title span').forEach(span => {
    span.onclick = () => {
      clickSequence.push(span.dataset.char);
      if (clickSequence.length > 4) clickSequence.shift();
      
      if (clickSequence.join('') === correctSequence.join('')) {
        // 如果点击序列正确，直接显示管理员登录框（尽管它现在功能单一）
        document.getElementById('admin-login').style.display = 'block';
        clickSequence = [];
      }
    };
  });
});

// loginAdmin 函数大改：移除密码验证。提示用户权限已自动检查。
function loginAdmin() {
  alert('您的管理员身份已在加载时通过安全规则检查。如果您是管理员，请直接点击“管理员”按钮进入控制台。');
  document.getElementById('admin-login').style.display = 'none';
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

function showAdminControls() { 
  // 客户端检查只是为了 UI，服务器端规则会进行真正的权限检查
  hideAllSections(); 
  document.getElementById('admin-section').style.display = 'block'; 
  // loadAdminTopics(); // 你的原始代码中没有这个函数，但保留调用
}

// 提交议题 (Submit Topic)
async function submitTopic() {
  const title = document.getElementById('topic-title').value.trim();
  const content = document.getElementById('topic-content').value.trim();
  const anon = document.getElementById('anon-submit').checked;
  const name = anon ? '匿名茶客' : document.getElementById('submitter-name').value.trim();
  
  if (!title || !content || (!anon && !name)) return alert('请填写完整');
  
  // 检查是否超出提交限制
  const remaining = parseInt(document.getElementById('remain-submits').innerText);
  if (remaining <= 0) {
    return alert(`每人每日限提交 ${MAX_DAILY_SUBMITS} 次。`);
  }

  try {
      await db.collection('topics').add({
        title, content, submitter: name, userId: currentUser.uid,
        timestamp: firebase.firestore.FieldValue.serverTimestamp(),
        // 增加 submitDate 字段，用于未来更精确的服务器端配额检查
        submitDate: new Date().toISOString().slice(0,10), 
        discussed: false
      });
  } catch(error) {
      // 如果 Firebase Security Rules 拒绝了，错误会在这里捕获
      if (error.code === 'permission-denied') {
          alert('提交失败：您没有权限或已达到每日提交上限。');
      } else {
          alert('提交失败：' + error.message);
      }
      return;
  }

  // 蒸汽动画
  const anim = document.getElementById('submit-animation');
  // 优化：使用通用函数（如果你愿意，可以修改 runAnimation 函数）
  anim.innerHTML = '<div class="steam"></div><div class="steam" style="animation-delay:0.3s"></div><div class="steam" style="animation-delay:0.6s"></div>';
  anim.style.display = 'block';
  setTimeout(() => anim.style.display = 'none', 2000);

  alert('提交成功！');
  // 清空表单
  document.getElementById('topic-title').value = '';
  document.getElementById('topic-content').value = '';
  document.getElementById('submitter-name').value = '';
  document.getElementById('anon-submit').checked = false;
  
  hideAllSections();
  document.getElementById('home').style.display = 'block';
  loadTopics();
  checkDailySubmits(); // 重新计算剩余次数
}

// 每日限制 (优化：利用 submitDate 字段提高查询效率)
async function checkDailySubmits() {
  const today = new Date().toISOString().slice(0,10);
  
  // 优化点：使用 where 查询今天的提交，而不是获取所有提交然后在客户端筛选
  const snap = await db.collection('topics')
                       .where('userId', '==', currentUser.uid)
                       .where('submitDate', '==', today) // 假设未来的数据会有 submitDate
                       .get();
                       
  const count = snap.size;
  document.getElementById('remain-submits').innerText = Math.max(0, MAX_DAILY_SUBMITS - count);
}

// 加载议题 (Load Topics) - 建议：使用 onSnapshot 实时监听
async function loadTopics() {
  const active = document.getElementById('active-topics');
  const discussed = document.getElementById('discussed-topics');
  active.innerHTML = ''; discussed.innerHTML = '';

  // 优化：改为实时监听 onSnapshot，数据变化时自动更新
  db.collection('topics').orderBy('timestamp', 'desc').onSnapshot(snapshot => {
    active.innerHTML = ''; discussed.innerHTML = ''; // 清空列表
    
    snapshot.forEach(doc => {
      const data = doc.data();
      const li = document.createElement('li');
      li.innerHTML = `<strong>${data.title}</strong><br>${data.content}<br>—— ${data.submitter}`;
      li.onclick = () => openMeeting(doc.id, data);
      (data.discussed ? discussed : active).appendChild(li);
    });
  }, err => console.error("Error loading topics:", err));
}

// 打开感想区 (Open Meeting)
async function openMeeting(id, data) {
  currentTopicId = id;
  hideAllSections();
  document.getElementById('meeting-section').style.display = 'block';
  document.getElementById('meeting-title').innerText = data.title;
  document.getElementById('meeting-desc').innerText = data.content;
  document.getElementById('meeting-date').innerText = data.discussionDate || '';
  loadComments(id);
}

// 加载/添加评论 (Load/Add Comments) - 建议：使用 onSnapshot 实时监听
async function loadComments(id) {
  const ul = document.getElementById('comments-list');
  ul.innerHTML = '';
  // 优化：改为实时监听 onSnapshot
  db.collection('topics').doc(id).collection('comments').orderBy('timestamp').onSnapshot(snap => {
    ul.innerHTML = '';
    snap.forEach(doc => {
      const li = document.createElement('li');
      li.textContent = doc.data().text;
      ul.appendChild(li);
    });
  }, err => console.error("Error loading comments:", err));
}

async function addComment() {
  const text = document.getElementById('new-comment').value.trim();
  if (!text || !currentTopicId) return;
  
  await db.collection('topics').doc(currentTopicId).collection('comments').add({
    text, 
    // 可以在这里添加 submitter: 'currentUser.uid' 或 'currentUser.displayName' 
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  });
  document.getElementById('new-comment').value = '';
  // loadComments(currentTopicId); // 由于改为 onSnapshot 实时监听，无需手动调用
}

// 投票 (Vote)
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
  // 确保 SortableJS 已经被加载
  if (typeof Sortable !== 'undefined') {
      new Sortable(ul, { animation: 150 });
  }
}

async function submitVote() {
  const items = document.getElementById('sortable-vote').children;
  if (items.length === 0) return alert('没有议题可投。');
  
  const ranks = Array.from(items).map((li, index) => ({
    topicId: li.id,
    score: items.length - index  // Borda: 第一得N分
  }));

  try {
      await db.collection('votes').add({
        userId: currentUser.uid,
        ranks,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });
  } catch(error) {
       if (error.code === 'permission-denied') {
          alert('投票失败：您没有权限或已提交过投票。');
      } else {
          alert('投票失败：' + error.message);
      }
      return;
  }

  // 茶叶动画
  const anim = document.getElementById('vote-animation');
  anim.innerHTML = '<div class="leaf"></div><div class="leaf" style="animation-delay:0.3s"></div>';
  anim.style.display = 'block';
  setTimeout(() => anim.style.display = 'none', 2000);

  alert('投票成功！');
  hideAllSections();
  document.getElementById('home').style.display = 'block';
}

// 管理员 (Admin) - 移除客户端权限检查
async function createRound() {
  // 权限检查已由 Firebase Rules 负责
  try {
      await db.collection('rounds').doc('current').update({ active: true });
      document.getElementById('vote-btn').style.display = 'block';
      alert('轮次已激活');
  } catch (e) {
      alert('激活失败：您不是管理员，操作被拒绝。');
  }
}

async function endRound() {
  // 权限检查已由 Firebase Rules 负责
  try {
      alert('结束轮次功能已启用，实际选当选议题请手动标记');
      await db.collection('rounds').doc('current').update({ active: false });
      document.getElementById('vote-btn').style.display = 'none';
  } catch (e) {
      alert('结束失败：您不是管理员，操作被拒绝。');
  }
}

// 搜索 (Search)
function searchTopics() {
  const keyword = document.getElementById('search-box').value.trim().toLowerCase();
  document.querySelectorAll('#active-topics li, #discussed-topics li').forEach(li => {
    // 搜索逻辑保持不变
    li.style.display = li.textContent.toLowerCase().includes(keyword) ? 'block' : 'none';
  });
}
