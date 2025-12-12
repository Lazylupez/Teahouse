// 超稳定Compat版
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
let clickSequence = [];
const correctSequence = ['实', 'の', '间', '逃'];
const ADMIN_PASSWORD = "Occm007";

auth.signInAnonymously().then(user => {
  currentUser = user.user;
  loadTopics();
  checkDailySubmits();
}).catch(err => console.log(err));

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
    alert('登录成功');
  } else alert('密码错误');
}

function showSubmit() {
  document.querySelectorAll('section').forEach(s => s.style.display = 'none');
  document.getElementById('submit-section').style.display = 'block';
}

function submitTopic() {
  const title = document.getElementById('topic-title').value.trim();
  const content = document.getElementById('topic-content').value.trim();
  const name = document.getElementById('anon-submit').checked ? '匿名茶客' : document.getElementById('submitter-name').value.trim();
  if (!title || !content || (!document.getElementById('anon-submit').checked && !name)) return alert('请填写完整');

  db.collection('topics').add({
    title, content, submitter: name, userId: currentUser.uid, timestamp: firebase.firestore.FieldValue.serverTimestamp(), discussed: false
  }).then(() => {
    const anim = document.getElementById('submit-animation');
    anim.innerHTML = '<div class="steam"></div><div class="steam" style="animation-delay:0.3s"></div>';
    anim.style.display = 'block';
    setTimeout(() => anim.style.display = 'none', 2000);
    alert('提交成功！');
    document.getElementById('submit-section').style.display = 'none';
    loadTopics();
  });
}

function loadTopics() {
  const ul1 = document.getElementById('active-topics');
  const ul2 = document.getElementById('discussed-topics');
  ul1.innerHTML = ''; ul2.innerHTML = '';
  db.collection('topics').orderBy('timestamp', 'desc').get().then(snap => {
    snap.forEach(doc => {
      const data = doc.data();
      const li = document.createElement('li');
      li.innerHTML = `<strong>${data.title}</strong><br>${data.content}<br>—— ${data.submitter}`;
      (data.discussed ? ul2 : ul1).appendChild(li);
    });
  });
}

function checkDailySubmits() {
  // 简化
  document.getElementById('remain-submits').innerText = '3';
}