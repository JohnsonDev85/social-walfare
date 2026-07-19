/* =========================================================
   FIREBASE CONFIG — BADILISHA HAPA NA CONFIG YAKO MWENYEWE
   ========================================================= */
const firebaseConfig = {
  apiKey: "AIzaSyD7yKHK1bC6OUhgg1cpA_dl7bXUa09aU1Q",
  authDomain: "mfuko-ustawi-wa-jamii.firebaseapp.com",
  projectId: "mfuko-ustawi-wa-jamii",
  storageBucket: "mfuko-ustawi-wa-jamii.firebasestorage.app",
  messagingSenderId: "917002657122",
  appId: "1:917002657122:web:35feaea38128001333603b"
};
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

/* =========================================================
   CONSTANTS
   ========================================================= */
const MONTHLY_AMOUNT = 5000;
const ASSISTANCE_AMOUNT = 150000;
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","Oktober","November","December"];
const EVENT_TYPES = { msiba: "Msiba", kuuguza: "Kuuguza", mtoto: "Kupata Mtoto" };

let currentUser = null;
let currentProfile = null;
let allMembersCache = [];

/* =========================================================
   AUTH: LOGIN / REGISTER / LOGOUT / FORGOT PASSWORD
   ========================================================= */
function showRegister(){
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('forgotPasswordForm').classList.add('hidden');
  document.getElementById('registerForm').classList.remove('hidden');
  document.getElementById('authMsg').innerHTML = '';
}
function showLogin(){
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('forgotPasswordForm').classList.add('hidden');
  document.getElementById('loginForm').classList.remove('hidden');
  document.getElementById('authMsg').innerHTML = '';
}
function showForgotPassword(){
  document.getElementById('loginForm').classList.add('hidden');
  document.getElementById('registerForm').classList.add('hidden');
  document.getElementById('forgotPasswordForm').classList.remove('hidden');
  document.getElementById('authMsg').innerHTML = '';
}
async function doPasswordReset(){
  const email = document.getElementById('forgotEmail').value.trim();
  if(!email){
    showAuthMsg("Weka barua pepe yako kwanza.", "error");
    return;
  }
  try{
    await auth.sendPasswordResetEmail(email);
    showAuthMsg("Tumetuma link ya kubadilisha password kwenye " + email + ". Kagua 'Inbox' au 'Spam'.", "ok");
  }catch(err){
    showAuthMsg(tafsiriKosa(err), "error");
  }
}
function showAuthMsg(text, type){
  document.getElementById('authMsg').innerHTML = `<div class="msg msg-${type}">${text}</div>`;
}

async function doRegister(){
  const name = document.getElementById('regName').value.trim();
  const email = document.getElementById('regEmail').value.trim();
  const password = document.getElementById('regPassword').value;

  if(!name || !email || !password){
    showAuthMsg("Tafadhali jaza sehemu zote.", "error"); return;
  }
  if(password.length < 6){
    showAuthMsg("Password iwe atleast herufi 6.", "error"); return;
  }

  try{
    const cred = await auth.createUserWithEmailAndPassword(email, password);
    await db.collection('members').doc(cred.user.uid).set({
      name: name,
      email: email,
      role: 'member',
      status: 'active',
      joinDate: firebase.firestore.FieldValue.serverTimestamp()
    });
  }catch(err){
    showAuthMsg(tafsiriKosa(err), "error");
  }
}

async function doLogin(){
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  if(!email || !password){
    showAuthMsg("Ingiza email na password.", "error"); return;
  }
  try{
    await auth.signInWithEmailAndPassword(email, password);
  }catch(err){
    showAuthMsg(tafsiriKosa(err), "error");
  }
}

function doLogout(){
  auth.signOut();
}

function tafsiriKosa(err){
  const code = err.code || "";
  if(code.includes('email-already-in-use')) return "This email is already registered!.";
  if(code.includes('invalid-email')) return "Invalid email.";
  if(code.includes('wrong-password') || code.includes('invalid-credential')) return "Password au Email si sahihi.";
  if(code.includes('user-not-found')) return "No Account. Register Now!.";
  if(code.includes('weak-password')) return "Password ni dhaifu, weka atleast herufi 6.";
  return "Error!: " + err.message;
}

/* =========================================================
   AUTH STATE ROUTER
   ========================================================= */
auth.onAuthStateChanged(async (user)=>{
  if(user){
    currentUser = user;
    const doc = await db.collection('members').doc(user.uid).get();
    if(!doc.exists){
      showAuthMsg("Wasiliana na msimamizi wa mfumo, taarifa zako hazipo kwenye mfumo.", "error");
      auth.signOut();
      return;
    }
    currentProfile = doc.data();
    if(currentProfile.status === 'removed'){
      showAuthMsg("Uanachama wako umeondolewa kwenye mfuko. Wasiliana na Mwenyekiti.", "error");
      auth.signOut();
      return;
    }
    enterApp();
  } else {
    currentUser = null; currentProfile = null;
    document.getElementById('authScreen').classList.remove('hidden');
    document.getElementById('appShell').classList.add('hidden');
    document.body.className = 'theme-guest';
  }
});

function roleLabel(role){
  if(role === 'chairman') return 'Mwenyekiti';
  if(role === 'accountant') return 'Mhasibu';
  return 'Mwanachama';
}
function themeClassFor(role){
  if(role === 'chairman') return 'theme-chairman';
  if(role === 'accountant') return 'theme-accountant';
  return 'theme-member';
}

function enterApp(){
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appShell').classList.remove('hidden');
  document.body.className = themeClassFor(currentProfile.role);
  document.getElementById('roleTag').textContent = roleLabel(currentProfile.role);
  document.getElementById('userNameTag').textContent = currentProfile.name;

  if(currentProfile.role === 'chairman') renderChairmanDashboard();
  else if(currentProfile.role === 'accountant') renderAccountantDashboard();
  else renderMemberDashboard();
}

/* =========================================================
   HELPERS
   ========================================================= */
async function fetchAllMembers(){
  const snap = await db.collection('members').orderBy('name').get();
  allMembersCache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  return allMembersCache;
}
function fmtTZS(n){
  return Number(n||0).toLocaleString('en-US');
}
function currentYear(){ return new Date().getFullYear(); }
function yearMonthOptionsHTML(prefixId){
  const yearOptions = [currentYear()-1, currentYear(), currentYear()+1]
    .map(y=>`<option value="${y}" ${y===currentYear()?'selected':''}>${y}</option>`).join('');
  const monthOptions = MONTH_NAMES.map((mn,i)=>`<option value="${i+1}" ${i+1===new Date().getMonth()+1?'selected':''}>${mn}</option>`).join('');
  return { yearOptions, monthOptions };
}

/* =========================================================
   MEMBER DASHBOARD
   ========================================================= */
async function renderMemberDashboard(){
  const body = document.getElementById('appBody');
  body.innerHTML = `<div class="empty-state">Uploading your infos...</div>`;

  const uid = currentUser.uid;
  const year = currentYear();

  const [contribSnap, allPaidReqSnap, allContribSnap] = await Promise.all([
    db.collection('contributions').where('memberId','==',uid).where('year','==',year).get(),
    db.collection('assistanceRequests').where('status','==','paid').get(),
    db.collection('contributions').where('memberId','==',uid).get()
  ]);

  const paidMonths = {};
  contribSnap.forEach(d=>{ paidMonths[d.data().month] = d.data().amount; });

  let totalContributed = 0;
  allContribSnap.forEach(d=> totalContributed += Number(d.data().amount||0));

  let totalUsedShare = 0;
  allPaidReqSnap.forEach(d=>{
    const req = d.data();
    const cnt = req.membersCountAtTime || 1;
    totalUsedShare += (ASSISTANCE_AMOUNT / cnt);
  });
  const remaining = totalContributed - totalUsedShare;

  let monthsRows = '';
  for(let m=1; m<=12; m++){
    const paid = paidMonths.hasOwnProperty(m);
    monthsRows += `<tr>
      <td>${MONTH_NAMES[m-1]} ${year}</td>
      <td class="amount">${paid ? 'TZS '+fmtTZS(paidMonths[m]) : '—'}</td>
      <td>${paid ? '<span class="stamp stamp-paid">Paid</span>' : '<span class="stamp stamp-unpaid">Not- paid</span>'}</td>
    </tr>`;
  }

  body.innerHTML = `
    <div class="section-title">
      <h1>Welcome! ${currentProfile.name.split(' ')[0]}</h1>
      <span class="eyebrow">"Kamwene!"</span>
    </div>

    <div class="grid grid-3" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="label">Total contribution</div>
        <div class="value">TZS ${fmtTZS(totalContributed)}</div>
      </div>
      <div class="stat-card neg">
        <div class="label">Payout</div>
        <div class="value">TZS ${fmtTZS(Math.round(totalUsedShare))}</div>
      </div>
      <div class="stat-card ${remaining>=0?'pos':'neg'}">
        <div class="label">Remaining</div>
        <div class="value">TZS ${fmtTZS(Math.round(remaining))}</div>
      </div>
    </div>

    <div class="card">
      <div class="section-title"><h3>Contribution Status — ${year}</h3></div>
      <table>
        <thead><tr><th>Mwezi</th><th>Kiasi</th><th>Status</th></tr></thead>
        <tbody>${monthsRows}</tbody>
      </table>
    </div>
  `;
}
/* =========================================================
   CHAIRMAN DASHBOARD
   ========================================================= */
let chairmanTab = 'members';

async function renderChairmanDashboard(){
  const body = document.getElementById('appBody');
  body.innerHTML = `<div class="empty-state">Uploading Dashboard ya Mwenyekiti...</div>`;
  await fetchAllMembers();

  body.innerHTML = `
    <div class="section-title">
      <h1> Mwenyekiti Ustawi</h1>
      <span class="eyebrow">Usimamizi wa Mfuko</span>
    </div>

    <div class="tabs-row">
      <button class="tab-btn ${chairmanTab==='members'?'active':''}" onclick="switchChairmanTab('members')">Wanachama</button>
      <button class="tab-btn ${chairmanTab==='monthly'?'active':''}" onclick="switchChairmanTab('monthly')">Payout ya Mwezi</button>
      <button class="tab-btn ${chairmanTab==='newRequest'?'active':''}" onclick="switchChairmanTab('newRequest')">New Payout request</button>
      <button class="tab-btn ${chairmanTab==='requests'?'active':''}" onclick="switchChairmanTab('requests')">All Request</button>
    </div>

    <div id="chairmanContent"></div>
  `;
  renderChairmanTabContent();
}

function switchChairmanTab(tab){
  chairmanTab = tab;
  renderChairmanDashboard();
}

async function renderChairmanTabContent(){
  const c = document.getElementById('chairmanContent');

  if(chairmanTab === 'members'){
    let rows = '';
    allMembersCache.filter(m=>m.role==='member').forEach(m=>{
      const statusStamp = m.status === 'active'
        ? '<span class="stamp stamp-paid">Active</span>'
        : '<span class="stamp stamp-unpaid">Removed</span>';
      rows += `<tr>
        <td>${m.name}</td>
        <td>${m.email}</td>
        <td>${statusStamp}</td>
        <td>${m.status==='active'
              ? `<button class="btn btn-danger btn-sm" onclick="removeMember('${m.id}')">Remove Membership</button>`
              : `<button class="btn btn-outline btn-sm" onclick="restoreMember('${m.id}')">Restore</button>`}</td>
      </tr>`;
    });
    if(!rows) rows = `<tr><td colspan="4" class="empty-state">No any registered members.</td></tr>`;

    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>List ya Wanachama (${allMembersCache.filter(m=>m.role==='member').length})</h3></div>
        <table>
          <thead><tr><th>Jina</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  else if(chairmanTab === 'monthly'){
    const { yearOptions, monthOptions } = yearMonthOptionsHTML();
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Hali ya Malipo kwa Mwezi</h3></div>
        <p style="font-size:0.82rem; color:var(--ink-soft); margin-bottom:14px;">
          Chagua mwezi na mwaka kuona wanachama waliolipa na wasiolipa. (Ni Mhasibu tu anayeweza kuingiza/kubadilisha malipo.)
        </p>
        <div class="form-row">
          <div class="field">
            <label>Mwezi</label>
            <select id="chMonth">${monthOptions}</select>
          </div>
          <div class="field">
            <label>Mwaka</label>
            <select id="chYear">${yearOptions}</select>
          </div>
        </div>
        <button class="btn btn-outline" onclick="loadChairmanMonthlyView()">View payment status</button>
      </div>
      <div id="chMonthlyResult"></div>
    `;
    loadChairmanMonthlyView();
  }

  else if(chairmanTab === 'newRequest'){
    const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');
    const options = activeMembers.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>New payout request</h3></div>
        <div id="reqMsg"></div>
        <div class="form-row">
          <div class="field">
            <label>Mwanachama Mnufaika</label>
            <select id="reqMember">${options || '<option>No active member</option>'}</select>
          </div>
          <div class="field">
            <label>Aina ya Tukio</label>
            <select id="reqType">
              <option value="msiba">Msiba</option>
              <option value="kuuguza">Kuuguza</option>
              <option value="mtoto">Kupata Mtoto</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label>Tarehe ya Tukio</label>
            <input type="date" id="reqDate">
          </div>
          <div class="field">
            <label>Kiasi cha Payout</label>
            <input type="text" value="TZS ${fmtTZS(ASSISTANCE_AMOUNT)}" disabled>
          </div>
        </div>
        <div class="field">
          <label>Maelezo</label>
          <textarea id="reqDesc" rows="3" placeholder="Maelezo mafupi ya tukio..."></textarea>
        </div>
        <button class="btn btn-primary" onclick="submitAssistanceRequest()">Send request to Mhasibu</button>
      </div>
    `;
  }

  else if(chairmanTab === 'requests'){
    const snap = await db.collection('assistanceRequests').orderBy('createdAtMillis','desc').get();
    let rows = '';
    snap.forEach(d=>{
      const r = d.data();
      const member = allMembersCache.find(m=>m.id===r.memberId);
      const statusHtml = r.status === 'paid'
        ? '<span class="stamp stamp-paid">Paid</span>'
        : '<span class="stamp stamp-pending">Pending</span>';
      const deleteBtn = r.status === 'pending'
        ? `<button class="btn btn-danger btn-sm" onclick="deleteAssistanceRequest('${d.id}')">Delete</button>`
        : `<span style="color:var(--ink-soft); font-size:0.75rem;">Cannot be erased</span>`;
      rows += `<tr>
        <td>${member ? member.name : '—'}</td>
        <td>${EVENT_TYPES[r.type]||r.type}</td>
        <td>${r.eventDate||'—'}</td>
        <td class="amount">TZS ${fmtTZS(r.amount)}</td>
        <td>${statusHtml}</td>
        <td>${deleteBtn}</td>
      </tr>`;
    });
    if(!rows) rows = `<tr><td colspan="6" class="empty-state">No any payout request.</td></tr>`;
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>All Payout Requests</h3></div>
        <p style="font-size:0.78rem; color:var(--ink-soft); margin-bottom:12px;">
          Unaweza kufuta ombi ambalo bado ni "pending" tu.
        </p>
        <table>
          <thead><tr><th>Mhusika</th><th>Aina</th><th>Tarehe ya Tukio</th><th>Kiasi</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }
}

async function loadChairmanMonthlyView(){
  const resultBox = document.getElementById('chMonthlyResult');
  if(!resultBox) return;
  resultBox.innerHTML = `<div class="empty-state">Uploading...</div>`;

  const month = parseInt(document.getElementById('chMonth').value);
  const year = parseInt(document.getElementById('chYear').value);

  const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');
  const snap = await db.collection('contributions').where('month','==',month).where('year','==',year).get();

  const paidMap = {};
  let totalCollected = 0;
  snap.forEach(d=>{
    const data = d.data();
    paidMap[data.memberId] = data.amount;
    totalCollected += Number(data.amount||0);
  });

  const paidCount = activeMembers.filter(m=>paidMap.hasOwnProperty(m.id)).length;
  const unpaidCount = activeMembers.length - paidCount;

  let rows = '';
  activeMembers.forEach(m=>{
    const paid = paidMap.hasOwnProperty(m.id);
    rows += `<tr>
      <td>${m.name}</td>
      <td>${paid ? '<span class="stamp stamp-paid">Paid</span>' : '<span class="stamp stamp-unpaid">Not paid</span>'}</td>
      <td class="amount">${paid ? 'TZS '+fmtTZS(paidMap[m.id]) : '—'}</td>
    </tr>`;
  });
  if(!rows) rows = `<tr><td colspan="3" class="empty-state">No Active member.</td></tr>`;

  resultBox.innerHTML = `
    <div class="grid grid-3" style="margin-bottom:18px;">
      <div class="stat-card pos"><div class="label">Paid</div><div class="value">${paidCount}</div></div>
      <div class="stat-card neg"><div class="label">Unpaid</div><div class="value">${unpaidCount}</div></div>
      <div class="stat-card"><div class="label">Jumla Zilizokusanywa</div><div class="value">TZS ${fmtTZS(totalCollected)}</div></div>
    </div>
    <div class="card">
      <div class="section-title"><h3>${MONTH_NAMES[month-1]} ${year}</h3></div>
      <table>
        <thead><tr><th>Jina</th><th>Status</th><th>Kiasi</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function removeMember(memberId){
  if(!confirm("Una uhakika unataka kumuondoa mwanachama huyu kwenye mfuko?")) return;
  await db.collection('members').doc(memberId).update({ status:'removed' });
  await fetchAllMembers();
  renderChairmanTabContent();
}
async function restoreMember(memberId){
  await db.collection('members').doc(memberId).update({ status:'active' });
  await fetchAllMembers();
  renderChairmanTabContent();
}

async function submitAssistanceRequest(){
  const msgBox = document.getElementById('reqMsg');
  const memberId = document.getElementById('reqMember').value;
  const type = document.getElementById('reqType').value;
  const eventDate = document.getElementById('reqDate').value;
  const desc = document.getElementById('reqDesc').value.trim();

  if(!memberId || !eventDate){
    msgBox.innerHTML = `<div class="msg msg-error">Chagua mwanachama na tarehe ya tukio.</div>`;
    return;
  }

  const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');
  const membersCountAtTime = activeMembers.length;

  try{
    await db.collection('assistanceRequests').add({
      memberId: memberId,
      type: type,
      description: desc,
      amount: ASSISTANCE_AMOUNT,
      membersCountAtTime: membersCountAtTime,
      status: 'pending',
      eventDate: eventDate,
      createdBy: currentUser.uid,
      createdAtMillis: Date.now(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgBox.innerHTML = `<div class="msg msg-ok">Ombi limetumwa kwa Mhasibu kwa ajili ya malipo.</div>`;
    document.getElementById('reqDesc').value = '';
    document.getElementById('reqDate').value = '';
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

async function deleteAssistanceRequest(reqId){
  if(!confirm("Una uhakika unataka kufuta ombi hili la msaada? Kitendo hiki hakiwezi kurudishwa.")) return;
  try{
    await db.collection('assistanceRequests').doc(reqId).delete();
    renderChairmanTabContent();
  }catch(err){
    alert("Failed to delete: " + err.message);
  }
}

/* =========================================================
   ACCOUNTANT DASHBOARD
   ========================================================= */
let accountantTab = 'record';
let reportMode = 'monthly'; // 'monthly' | 'annual'

async function renderAccountantDashboard(){
  const body = document.getElementById('appBody');
  body.innerHTML = `<div class="empty-state">Uploading dashboard ya Mhasibu...</div>`;
  await fetchAllMembers();

  // --- Muhtasari wa Fedha (Total Contributions / Payouts / Balance) ---
  const [allContribSnapTop, allPaidReqSnapTop] = await Promise.all([
    db.collection('contributions').get(),
    db.collection('assistanceRequests').where('status','==','paid').get()
  ]);
  let totalContributedAll = 0;
  allContribSnapTop.forEach(d=> totalContributedAll += Number(d.data().amount||0));
  let totalPaidOutAll = 0;
  allPaidReqSnapTop.forEach(d=> totalPaidOutAll += Number(d.data().amount||0));
  const fundBalanceTop = totalContributedAll - totalPaidOutAll;

  body.innerHTML = `
    <div class="section-title">
      <h1>MHASIBU USTAWI KSS</h1>
      <span class="eyebrow">Usimamizi wa Fedha za Mfuko</span>
    </div>

    <div class="grid grid-3" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="label">Total Contributions</div>
        <div class="value">TZS ${fmtTZS(totalContributedAll)}</div>
      </div>
      <div class="stat-card neg">
        <div class="label">Total Payouts</div>
        <div class="value">TZS ${fmtTZS(totalPaidOutAll)}</div>
      </div>
      <div class="stat-card ${fundBalanceTop>=0?'pos':'neg'}">
        <div class="label">Fund Balance</div>
        <div class="value">TZS ${fmtTZS(fundBalanceTop)}</div>
      </div>
    </div>

    <div class="tabs-row">
      <button class="tab-btn ${accountantTab==='record'?'active':''}" onclick="switchAccountantTab('record')">Enter Contributions</button>
      <button class="tab-btn ${accountantTab==='payouts'?'active':''}" onclick="switchAccountantTab('payouts')">Payout requests</button>
      <button class="tab-btn ${accountantTab==='report'?'active':''}" onclick="switchAccountantTab('report')">Ripoti ya PDF</button>
    </div>

    <div id="accountantContent"></div>
  `;
  renderAccountantTabContent();
}

function switchAccountantTab(tab){
  accountantTab = tab;
  renderAccountantDashboard();
}

async function renderAccountantTabContent(){
  const c = document.getElementById('accountantContent');

  if(accountantTab === 'record'){
    const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');
    const options = activeMembers.map(m=>`<option value="${m.id}">${m.name}</option>`).join('');
    const { yearOptions, monthOptions } = yearMonthOptionsHTML();

    const recentSnap = await db.collection('contributions').orderBy('recordedAt','desc').limit(15).get();
    let recentRows = '';
    recentSnap.forEach(d=>{
      const r = d.data();
      const member = allMembersCache.find(m=>m.id===r.memberId);
      recentRows += `<tr>
        <td>${member ? member.name : '—'}</td>
        <td>${MONTH_NAMES[r.month-1]} ${r.year}</td>
        <td class="amount">TZS ${fmtTZS(r.amount)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteContribution('${d.id}')">Delete</button></td>
      </tr>`;
    });
    if(!recentRows) recentRows = `<tr><td colspan="4" class="empty-state">No any record.</td></tr>`;

    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Ingiza Malipo ya Mchango wa Mwezi</h3></div>
        <div id="recMsg"></div>
        <div class="form-row">
          <div class="field">
            <label>Mwanachama</label>
            <select id="recMember">${options || '<option>No Active Member</option>'}</select>
          </div>
          <div class="field">
            <label>Mwezi</label>
            <select id="recMonth">${monthOptions}</select>
          </div>
          <div class="field">
            <label>Mwaka</label>
            <select id="recYear">${yearOptions}</select>
          </div>
        </div>
        <div class="field" style="max-width:220px;">
          <label>Kiasi Kilicholipwa (TZS)</label>
          <input type="number" id="recAmount" value="${MONTHLY_AMOUNT}">
        </div>
        <button class="btn btn-primary" onclick="recordContribution()">Save Contribution</button>
      </div>

      <div class="card">
        <div class="section-title"><h3>Rekodi za Hivi Karibuni (futa kama kuna kosa)</h3></div>
        <table>
          <thead><tr><th>Mwanachama</th><th>Mwezi/Mwaka</th><th>Kiasi</th><th>Kitendo</th></tr></thead>
          <tbody>${recentRows}</tbody>
        </table>
      </div>
    `;
  }

  else if(accountantTab === 'payouts'){
    // FIX: Ondoa orderBy kutoka kwenye Firestore query (ilihitaji composite index
    // ambayo haikuwepo, ndiyo sababu maombi hayakuwa yakionekana). Sasa tunapanga
    // matokeo humo humo JS baada ya kuyapata.
    const snap = await db.collection('assistanceRequests').where('status','==','pending').get();
    let docs = [];
    snap.forEach(d=> docs.push({ id:d.id, ...d.data() }));
    docs.sort((a,b)=> (b.createdAtMillis||0) - (a.createdAtMillis||0));

    let rows = '';
    docs.forEach(r=>{
      const member = allMembersCache.find(m=>m.id===r.memberId);
      rows += `<tr>
        <td>${member ? member.name : '—'}</td>
        <td>${EVENT_TYPES[r.type]||r.type}</td>
        <td>${r.eventDate||'—'}</td>
        <td>${r.description || '—'}</td>
        <td class="amount">TZS ${fmtTZS(r.amount)}</td>
        <td><button class="btn btn-primary btn-sm" onclick="payAssistance('${r.id}')">Approve Payout!</button></td>
      </tr>`;
    });
    if(!rows) rows = `<tr><td colspan="6" class="empty-state">No pending requests.</td></tr>`;
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Pending Request za Malipo</h3></div>
        <table>
          <thead><tr><th>Mhusika</th><th>Aina ya tukio</th><th>Tarehe</th><th>Maelezo</th><th>Kiasi</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  else if(accountantTab === 'report'){
    const { yearOptions, monthOptions } = yearMonthOptionsHTML();
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Download Ripoti (PDF)</h3></div>

        <div class="tabs-row" style="margin-bottom:18px;">
          <button class="tab-btn ${reportMode==='monthly'?'active':''}" onclick="switchReportMode('monthly')">Ripoti ya Mwezi</button>
          <button class="tab-btn ${reportMode==='annual'?'active':''}" onclick="switchReportMode('annual')">Ripoti ya Mwaka</button>
        </div>

        <div id="reportModeContent"></div>
      </div>
    `;
    renderReportModeContent();
  }
}

function switchReportMode(mode){
  reportMode = mode;
  renderAccountantTabContent();
}

function renderReportModeContent(){
  const box = document.getElementById('reportModeContent');
  const { yearOptions, monthOptions } = yearMonthOptionsHTML();

  if(reportMode === 'monthly'){
    box.innerHTML = `
      <p style="font-size:0.85rem; color:var(--ink-soft); margin-bottom:16px;">
        Summary ya mwezi: makusanyo, matumizi, na status ya malipo ya wanachama.
      </p>
      <div class="form-row">
        <div class="field">
          <label>Mwezi</label>
          <select id="repMonth">${monthOptions}</select>
        </div>
        <div class="field">
          <label>Mwaka</label>
          <select id="repYear">${yearOptions}</select>
        </div>
      </div>
      <button class="btn btn-primary" onclick="generateMonthlyPDF()">Download PDF(Mwezi)</button>
    `;
  } else {
    box.innerHTML = `
      <p style="font-size:0.85rem; color:var(--ink-soft); margin-bottom:16px;">
        Summary ya mwaka mzima kuanzia Januari hadi mwezi wa huu (kwa mwaka wa huu) au Januari–Desemba (Mwak uliyopita).
      </p>
      <div class="field" style="max-width:220px;">
        <label>Mwaka</label>
        <select id="repYearAnnual">${yearOptions}</select>
      </div>
      <button class="btn btn-primary" onclick="generateAnnualPDF()">Download PDF(Mwaka)</button>
    `;
  }
}

async function recordContribution(){
  const msgBox = document.getElementById('recMsg');
  const memberId = document.getElementById('recMember').value;
  const month = parseInt(document.getElementById('recMonth').value);
  const year = parseInt(document.getElementById('recYear').value);
  const amount = parseFloat(document.getElementById('recAmount').value);

  if(!memberId || !amount || amount <= 0){
    msgBox.innerHTML = `<div class="msg msg-error">Jaza taarifa zote kwa usahihi.</div>`;
    return;
  }

  try{
    const existing = await db.collection('contributions')
      .where('memberId','==',memberId).where('month','==',month).where('year','==',year).get();
    if(!existing.empty){
      msgBox.innerHTML = `<div class="msg msg-error">Mwanachama huyu tayari ana rekodi ya malipo kwa mwezi huu.</div>`;
      return;
    }

    await db.collection('contributions').add({
      memberId: memberId,
      month: month,
      year: year,
      amount: amount,
      recordedBy: currentUser.uid,
      recordedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgBox.innerHTML = `<div class="msg msg-ok">Malipo yamerekodiwa kikamilifu.</div>`;
    renderAccountantTabContent();
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

async function deleteContribution(contribId){
  if(!confirm("Una uhakika unataka kufuta rekodi hii ya malipo? Kitendo hiki hakiwezi kurudishwa.")) return;
  try{
    await db.collection('contributions').doc(contribId).delete();
    renderAccountantTabContent();
  }catch(err){
    alert("Failed to Delete: " + err.message);
  }
}

async function payAssistance(reqId){
  if(!confirm("Approve Payout")) return;
  await db.collection('assistanceRequests').doc(reqId).update({
    status: 'paid',
    paidBy: currentUser.uid,
    paidAt: firebase.firestore.FieldValue.serverTimestamp(),
    paidAtMillis: Date.now()
  });
  renderAccountantDashboard();
}

/* =========================================================
   PDF: RIPOTI YA MWEZI
   ========================================================= */
async function generateMonthlyPDF(){
  const month = parseInt(document.getElementById('repMonth').value);
  const year = parseInt(document.getElementById('repYear').value);

  const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');

  const [contribSnap, allPaidReqSnap] = await Promise.all([
    db.collection('contributions').where('month','==',month).where('year','==',year).get(),
    db.collection('assistanceRequests').where('status','==','paid').get()
  ]);

  const paidThisMonthMap = {};
  let totalCollectedThisMonth = 0;
  contribSnap.forEach(d=>{
    const data = d.data();
    paidThisMonthMap[data.memberId] = data.amount;
    totalCollectedThisMonth += Number(data.amount||0);
  });

  let totalUsedAllTime = 0;
  let usedThisMonth = 0;
  let usedThisMonthCount = 0;
  allPaidReqSnap.forEach(d=>{
    const r = d.data();
    totalUsedAllTime += Number(r.amount||0);
    if(r.paidAt && r.paidAt.toDate){
      const dt = r.paidAt.toDate();
      if(dt.getMonth()+1 === month && dt.getFullYear() === year){
        usedThisMonth += Number(r.amount||0);
        usedThisMonthCount++;
      }
    }
  });

  const allContribSnap = await db.collection('contributions').get();
  let totalCollectedAllTime = 0;
  allContribSnap.forEach(d=> totalCollectedAllTime += Number(d.data().amount||0));
  const fundBalance = totalCollectedAllTime - totalUsedAllTime;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.text("MFUKO WA USTAWI WA JAMII", pageWidth/2, 18, { align:'center' });
  doc.setFontSize(10);
  doc.setFont("courier","normal");
  doc.text("Kidegembye Secondary School", pageWidth/2, 25, { align:'center' });
  doc.text(`Ripoti ya Mwezi: ${MONTH_NAMES[month-1]} ${year}`, pageWidth/2, 31, { align:'center' });

  doc.setLineWidth(0.4);
  doc.line(14, 36, pageWidth-14, 36);

  let y = 46;
  doc.setFont("courier","bold");
  doc.setFontSize(11);
  doc.text("MAKUSANYO YA FEDHA", 14, y);
  doc.setFont("courier","normal");
  doc.setFontSize(10);
  y += 8;
  doc.text(`Makusanyo ya Mwezi Huu:`, 14, y); doc.text(`TZS ${fmtTZS(totalCollectedThisMonth)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Payout Mwezi Huu (${usedThisMonthCount}):`, 14, y); doc.text(`TZS ${fmtTZS(usedThisMonth)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Jumla ya Makusanyo:`, 14, y); doc.text(`TZS ${fmtTZS(totalCollectedAllTime)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Jumla Matumizi:`, 14, y); doc.text(`TZS ${fmtTZS(totalUsedAllTime)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.setFont("courier","bold");
  doc.text(`SALIO LA MFUKO :`, 14, y); doc.text(`TZS ${fmtTZS(fundBalance)}`, pageWidth-14, y, {align:'right'});

  y += 12;
  doc.setLineWidth(0.2);
  doc.line(14, y, pageWidth-14, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(`STATUS YA MALIPO YA WANACHAMA — ${MONTH_NAMES[month-1]} ${year}`, 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("courier","bold");
  doc.text("Jina", 14, y);
  doc.text("Status", 130, y);
  doc.text("Kiasi", pageWidth-14, y, {align:'right'});
  y += 4;
  doc.line(14, y, pageWidth-14, y);
  y += 6;
  doc.setFont("courier","normal");

  activeMembers.forEach(m=>{
    if(y > 275){ doc.addPage(); y = 20; }
    const paid = paidThisMonthMap.hasOwnProperty(m.id);
    doc.text(m.name.substring(0,32), 14, y);
    doc.text(paid ? "PAID" : "NOT-PAID", 130, y);
    doc.text(paid ? `TZS ${fmtTZS(paidThisMonthMap[m.id])}` : "—", pageWidth-14, y, {align:'right'});
    y += 6;
  });

  y += 6;
  doc.setLineWidth(0.2);
  doc.line(14, y, pageWidth-14, y);
  y += 8;
  doc.setFontSize(8);
  doc.text(`Report generated by JohnsonDev85: ${new Date().toLocaleDateString('sw-TZ')} — Love is our language`, 14, y);

  doc.save(`Ripoti_Mfuko_${MONTH_NAMES[month-1]}_${year}.pdf`);
}

/* =========================================================
   PDF: RIPOTI YA MWAKA (Januari - Mwezi wa Sasa / Desemba)
   ========================================================= */
async function generateAnnualPDF(){
  const year = parseInt(document.getElementById('repYearAnnual').value);
  const lastMonth = (year === currentYear()) ? (new Date().getMonth()+1) : 12;

  const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');

  const [yearContribSnap, allPaidReqSnap, allContribSnap] = await Promise.all([
    db.collection('contributions').where('year','==',year).get(),
    db.collection('assistanceRequests').where('status','==','paid').get(),
    db.collection('contributions').get()
  ]);

  // Makusanyo ya mwaka (Jan - lastMonth) kwa mwanachama na jumla
  const memberYearTotals = {};   // memberId -> jumla ya mwaka
  const memberMonthsPaid = {};   // memberId -> idadi ya miezi aliyolipa (ndani ya Jan-lastMonth)
  let totalCollectedYear = 0;

  yearContribSnap.forEach(d=>{
    const data = d.data();
    if(data.month <= lastMonth){
      totalCollectedYear += Number(data.amount||0);
      memberYearTotals[data.memberId] = (memberYearTotals[data.memberId]||0) + Number(data.amount||0);
      memberMonthsPaid[data.memberId] = (memberMonthsPaid[data.memberId]||0) + 1;
    }
  });

  // Matumizi ya mwaka (paidAt ndani ya Jan-lastMonth ya mwaka huu)
  let totalUsedYear = 0;
  let usedYearCount = 0;
  let totalUsedAllTime = 0;
  allPaidReqSnap.forEach(d=>{
    const r = d.data();
    totalUsedAllTime += Number(r.amount||0);
    if(r.paidAt && r.paidAt.toDate){
      const dt = r.paidAt.toDate();
      if(dt.getFullYear() === year && (dt.getMonth()+1) <= lastMonth){
        totalUsedYear += Number(r.amount||0);
        usedYearCount++;
      }
    }
  });

  let totalCollectedAllTime = 0;
  allContribSnap.forEach(d=> totalCollectedAllTime += Number(d.data().amount||0));
  const fundBalance = totalCollectedAllTime - totalUsedAllTime;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const periodLabel = `Januari – ${MONTH_NAMES[lastMonth-1]} ${year}`;

  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.text("MFUKO WA USTAWI WA JAMII", pageWidth/2, 18, { align:'center' });
  doc.setFontSize(10);
  doc.setFont("courier","normal");
  doc.text("Kidegembye Secondary School", pageWidth/2, 25, { align:'center' });
  doc.text(`Ripoti ya Mwaka: ${periodLabel}`, pageWidth/2, 31, { align:'center' });

  doc.setLineWidth(0.4);
  doc.line(14, 36, pageWidth-14, 36);

  let y = 46;
  doc.setFont("courier","bold");
  doc.setFontSize(11);
  doc.text("MAKUSANYO YA FEDHA", 14, y);
  doc.setFont("courier","normal");
  doc.setFontSize(10);
  y += 8;
  doc.text(`Jumla Makusanyo (${periodLabel}):`, 14, y); doc.text(`TZS ${fmtTZS(totalCollectedYear)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Current Payout  (${usedYearCount}):`, 14, y); doc.text(`TZS ${fmtTZS(totalUsedYear)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Jumla Makusanyo:`, 14, y); doc.text(`TZS ${fmtTZS(totalCollectedAllTime)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Jumla Matumizi:`, 14, y); doc.text(`TZS ${fmtTZS(totalUsedAllTime)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.setFont("courier","bold");
  doc.text(`SALIO LA MFUKO:`, 14, y); doc.text(`TZS ${fmtTZS(fundBalance)}`, pageWidth-14, y, {align:'right'});

  y += 12;
  doc.setLineWidth(0.2);
  doc.line(14, y, pageWidth-14, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(`MCHANGANUO WA WANACHAMA — ${periodLabel}`, 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("courier","bold");
  doc.text("Jina", 14, y);
  doc.text("Miezi Aliyolipa", 110, y);
  doc.text("Jumla Alichochangia", pageWidth-14, y, {align:'right'});
  y += 4;
  doc.line(14, y, pageWidth-14, y);
  y += 6;
  doc.setFont("courier","normal");

  activeMembers.forEach(m=>{
    if(y > 275){ doc.addPage(); y = 20; }
    const monthsPaid = memberMonthsPaid[m.id] || 0;
    const yearTotal = memberYearTotals[m.id] || 0;
    doc.text(m.name.substring(0,30), 14, y);
    doc.text(`${monthsPaid} / ${lastMonth}`, 110, y);
    doc.text(`TZS ${fmtTZS(yearTotal)}`, pageWidth-14, y, {align:'right'});
    y += 6;
  });

  y += 6;
  doc.setLineWidth(0.2);
  doc.line(14, y, pageWidth-14, y);
  y += 8;
  doc.setFontSize(8);
  doc.text(`Report generated by JohnsonDev85: ${new Date().toLocaleDateString('sw-TZ')} — Love is our language`, 14, y);

  doc.save(`Ripoti_Mwaka_${year}.pdf`);
}