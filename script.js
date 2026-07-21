/* =========================================================
   FIREBASE CONFIG — REPLACE WITH YOUR OWN CONFIG
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
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const EVENT_TYPES = { msiba: "Msiba", kuuguza: "Kuuguza", mtoto: "Kupata mtoto" };

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
    showAuthMsg("Enter your email first.", "error");
    return;
  }
  try{
    await auth.sendPasswordResetEmail(email);
    showAuthMsg("A password reset link has been sent to " + email + ". Check your 'Inbox' or 'Spam' folder.", "ok");
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
    showAuthMsg("Please fill in all fields.", "error"); return;
  }
  if(password.length < 6){
    showAuthMsg("Password must be at least 6 characters.", "error"); return;
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
    showAuthMsg("Enter email and password.", "error"); return;
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
  if(code.includes('email-already-in-use')) return "This email is already registered!";
  if(code.includes('invalid-email')) return "Invalid email.";
  if(code.includes('wrong-password') || code.includes('invalid-credential')) return "Incorrect email or password.";
  if(code.includes('user-not-found')) return "No account found. Register now!";
  if(code.includes('weak-password')) return "Password is weak, use at least 6 characters.";
  return "Error: " + err.message;
}

/* =========================================================
   AUTH STATE ROUTER
   ========================================================= */
auth.onAuthStateChanged(async (user)=>{
  if(user){
    currentUser = user;
    const doc = await db.collection('members').doc(user.uid).get();
    if(!doc.exists){
      showAuthMsg("Wasiliana na  system administrator, taarifa zako hazipo kwenye system.", "error");
      auth.signOut();
      return;
    }
    currentProfile = doc.data();
    if(currentProfile.status === 'removed'){
      showAuthMsg("Your membership has been removed from the Social. Contact the Chairman.", "error");
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
  if(role === 'chairman') return 'Chairman';
  if(role === 'accountant') return 'Accountant';
  return 'Member';
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
function yearMonthOptionsHTML(){
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
  body.innerHTML = `<div class="empty-state">Loading your information...</div>`;

  const uid = currentUser.uid;
  const year = currentYear();

  const [contribSnap, allPaidReqSnap, allContribSnap, allConfirmedIncomeSnap] = await Promise.all([
    db.collection('contributions').where('memberId','==',uid).where('year','==',year).get(),
    db.collection('assistanceRequests').where('status','==','paid').get(),
    db.collection('contributions').where('memberId','==',uid).get(),
    db.collection('extraIncome').where('status','==','confirmed').get()
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

  let incomeBonus = 0;
  allConfirmedIncomeSnap.forEach(d=>{
    const inc = d.data();
    const cnt = inc.membersCountAtTime || 1;
    incomeBonus += (Number(inc.amount||0) / cnt);
  });

  const remaining = totalContributed - totalUsedShare + incomeBonus;

  let monthsRows = '';
  for(let m=1; m<=12; m++){
    const paid = paidMonths.hasOwnProperty(m);
    monthsRows += `<tr>
      <td>${MONTH_NAMES[m-1]} ${year}</td>
      <td class="amount">${paid ? 'TZS '+fmtTZS(paidMonths[m]) : '—'}</td>
      <td>${paid ? '<span class="stamp stamp-paid">Paid</span>' : '<span class="stamp stamp-unpaid">Not Paid</span>'}</td>
    </tr>`;
  }

  body.innerHTML = `
    <div class="section-title">
      <h1>Welcome, ${currentProfile.name.split(' ')[0]}!</h1>
      <span class="eyebrow">"Kamwene!"</span>
    </div>

    <div class="grid grid-3" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="label">Total Contribution</div>
        <div class="value">TZS ${fmtTZS(totalContributed)}</div>
      </div>
      <div class="stat-card neg">
        <div class="label">Payout Used(Kiasi kilichotumika)</div>
        <div class="value">TZS ${fmtTZS(Math.round(totalUsedShare))}</div>
      </div>
      <div class="stat-card pos">
        <div class="label">Income Bonus(E.g pesa kutoka kwa HoS)</div>
        <div class="value">TZS ${fmtTZS(Math.round(incomeBonus))}</div>
      </div>
      <div class="stat-card ${remaining>=0?'pos':'neg'}">
        <div class="label">Remaining Balance</div>
        <div class="value">TZS ${fmtTZS(Math.round(remaining))}</div>
      </div>
    </div>

    <div class="card">
      <div class="section-title"><h3>Contribution Status — ${year}</h3></div>
      <table>
        <thead><tr><th>Month</th><th>Amount</th><th>Status</th></tr></thead>
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
  body.innerHTML = `<div class="empty-state">Loading Chairman Dashboard...</div>`;
  await fetchAllMembers();

  body.innerHTML = `
    <div class="section-title">
      <h1>Chairman Dashboard</h1>
      <span class="eyebrow">Fund Management</span>
    </div>

    <div class="tabs-row">
      <button class="tab-btn ${chairmanTab==='members'?'active':''}" onclick="switchChairmanTab('members')">Members</button>
      <button class="tab-btn ${chairmanTab==='monthly'?'active':''}" onclick="switchChairmanTab('monthly')">Monthly Payment Status</button>
      <button class="tab-btn ${chairmanTab==='newRequest'?'active':''}" onclick="switchChairmanTab('newRequest')">New Payout Request</button>
      <button class="tab-btn ${chairmanTab==='requests'?'active':''}" onclick="switchChairmanTab('requests')">All Requests</button>
      <button class="tab-btn ${chairmanTab==='income'?'active':''}" onclick="switchChairmanTab('income')">Income Report</button>
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
    if(!rows) rows = `<tr><td colspan="4" class="empty-state">No registered members yet.</td></tr>`;

    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Members List (${allMembersCache.filter(m=>m.role==='member').length})</h3></div>
        <table>
          <thead><tr><th>Name</th><th>Email</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  else if(chairmanTab === 'monthly'){
    const { yearOptions, monthOptions } = yearMonthOptionsHTML();
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Monthly Payment Status</h3></div>
        <p style="font-size:0.82rem; color:var(--ink-soft); margin-bottom:14px;">
          Select month and year to see which members have paid and which haven't. (Only the Accountant can enter/edit payments.)
        </p>
        <div class="form-row">
          <div class="field">
            <label>Month</label>
            <select id="chMonth">${monthOptions}</select>
          </div>
          <div class="field">
            <label>Year</label>
            <select id="chYear">${yearOptions}</select>
          </div>
        </div>
        <button class="btn btn-outline" onclick="loadChairmanMonthlyView()">View Payment Status</button>
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
        <div class="section-title"><h3>New Payout Request</h3></div>
        <div id="reqMsg"></div>
        <div class="form-row">
          <div class="field">
            <label>Beneficiary Member</label>
            <select id="reqMember">${options || '<option>No active members</option>'}</select>
          </div>
          <div class="field">
            <label>Event Type</label>
            <select id="reqType">
              <option value="msiba">Msiba</option>
              <option value="kuuguza">Kuuguza/Ugonjwa</option>
              <option value="mtoto">Childbirth</option>
            </select>
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label>Event Date</label>
            <input type="date" id="reqDate">
          </div>
          <div class="field">
            <label>Payout Amount</label>
            <input type="text" value="TZS ${fmtTZS(ASSISTANCE_AMOUNT)}" disabled>
          </div>
        </div>
        <div class="field">
          <label>Description</label>
          <textarea id="reqDesc" rows="3" placeholder="Maelezo mafupi ya tukio..."></textarea>
        </div>
        <button class="btn btn-primary" onclick="submitAssistanceRequest()">Send Request to Accountant</button>
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
        : `<span style="color:var(--ink-soft); font-size:0.75rem;">Cannot be deleted</span>`;
      rows += `<tr>
        <td>${member ? member.name : '—'}</td>
        <td>${EVENT_TYPES[r.type]||r.type}</td>
        <td>${r.eventDate||'—'}</td>
        <td class="amount">TZS ${fmtTZS(r.amount)}</td>
        <td>${statusHtml}</td>
        <td>${deleteBtn}</td>
      </tr>`;
    });
    if(!rows) rows = `<tr><td colspan="6" class="empty-state">No payout requests yet.</td></tr>`;
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>All Payout Requests</h3></div>
        <p style="font-size:0.78rem; color:var(--ink-soft); margin-bottom:12px;">
          You can only delete a request that is still "pending".
        </p>
        <table>
          <thead><tr><th>Beneficiary</th><th>Type</th><th>Event Date</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  else if(chairmanTab === 'income'){
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Report New Income</h3></div>
        <p style="font-size:0.82rem; color:var(--ink-soft); margin-bottom:14px;">
          Tumia hii endapo chanzo kimepatikana tofauti na michango ya kila mwezi ya members
          (e.g. a donation, top-up, or one-off gift). Once submitted, the Accountant must confirm it
          before it's added to the fund balance.
        </p>
        <div id="incomeMsg"></div>
        <div class="field">
          <label>Source of Income</label>
          <textarea id="incomeSource" rows="3" placeholder="e.g. Donation from Head of School, staff welfare top-up..."></textarea>
        </div>
        <div class="field" style="max-width:220px;">
          <label>Amount (TZS)</label>
          <input type="number" id="incomeAmount" placeholder="e.g. 200000">
        </div>
        <button class="btn btn-primary" onclick="submitIncomeReport()">Send to Accountant</button>
      </div>
      <div id="incomeHistory"></div>
    `;
    loadChairmanIncomeHistory();
  }
}

async function loadChairmanIncomeHistory(){
  const box = document.getElementById('incomeHistory');
  if(!box) return;
  const snap = await db.collection('extraIncome').orderBy('createdAtMillis','desc').get();
  let rows = '';
  snap.forEach(d=>{
    const inc = d.data();
    const statusHtml = inc.status === 'confirmed'
      ? '<span class="stamp stamp-paid">Confirmed</span>'
      : '<span class="stamp stamp-pending">Pending</span>';
    rows += `<tr>
      <td>${inc.description}</td>
      <td class="amount">TZS ${fmtTZS(inc.amount)}</td>
      <td>${statusHtml}</td>
    </tr>`;
  });
  if(!rows) rows = `<tr><td colspan="3" class="empty-state">No income reports submitted yet.</td></tr>`;
  box.innerHTML = `
    <div class="card">
      <div class="section-title"><h3>Income Report History</h3></div>
      <table>
        <thead><tr><th>Source / Description</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function submitIncomeReport(){
  const msgBox = document.getElementById('incomeMsg');
  const description = document.getElementById('incomeSource').value.trim();
  const amount = parseFloat(document.getElementById('incomeAmount').value);

  if(!description || !amount || amount <= 0){
    msgBox.innerHTML = `<div class="msg msg-error">Please describe the income source and enter a valid amount.</div>`;
    return;
  }

  try{
    await db.collection('extraIncome').add({
      description: description,
      amount: amount,
      status: 'pending',
      submittedBy: currentUser.uid,
      createdAtMillis: Date.now(),
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgBox.innerHTML = `<div class="msg msg-ok">Income report sent to the Accountant for confirmation.</div>`;
    document.getElementById('incomeSource').value = '';
    document.getElementById('incomeAmount').value = '';
    loadChairmanIncomeHistory();
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

async function loadChairmanMonthlyView(){
  const resultBox = document.getElementById('chMonthlyResult');
  if(!resultBox) return;
  resultBox.innerHTML = `<div class="empty-state">Loading...</div>`;

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
      <td>${paid ? '<span class="stamp stamp-paid">Paid</span>' : '<span class="stamp stamp-unpaid">Not Paid</span>'}</td>
      <td class="amount">${paid ? 'TZS '+fmtTZS(paidMap[m.id]) : '—'}</td>
    </tr>`;
  });
  if(!rows) rows = `<tr><td colspan="3" class="empty-state">No active members.</td></tr>`;

  resultBox.innerHTML = `
    <div class="grid grid-3" style="margin-bottom:18px;">
      <div class="stat-card pos"><div class="label">Paid</div><div class="value">${paidCount}</div></div>
      <div class="stat-card neg"><div class="label">Unpaid</div><div class="value">${unpaidCount}</div></div>
      <div class="stat-card"><div class="label">Total Collected</div><div class="value">TZS ${fmtTZS(totalCollected)}</div></div>
    </div>
    <div class="card">
      <div class="section-title"><h3>${MONTH_NAMES[month-1]} ${year}</h3></div>
      <table>
        <thead><tr><th>Name</th><th>Status</th><th>Amount</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function removeMember(memberId){
  if(!confirm("Are you sure you want to remove this member from the fund?")) return;
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
    msgBox.innerHTML = `<div class="msg msg-error">Select Mwanachama na Tarehe ya tukio kutokea.</div>`;
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
    msgBox.innerHTML = `<div class="msg msg-ok">Request sent to the Accountant for payment.</div>`;
    document.getElementById('reqDesc').value = '';
    document.getElementById('reqDate').value = '';
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

async function deleteAssistanceRequest(reqId){
  if(!confirm("Are you sure you want to delete this assistance request? This action cannot be undone.")) return;
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
  body.innerHTML = `<div class="empty-state">Loading Accountant Dashboard...</div>`;
  await fetchAllMembers();

  // --- Fund Summary (Total Contributions / Income / Payouts / Balance) ---
  const [allContribSnapTop, allPaidReqSnapTop, allConfirmedIncomeSnapTop] = await Promise.all([
    db.collection('contributions').get(),
    db.collection('assistanceRequests').where('status','==','paid').get(),
    db.collection('extraIncome').where('status','==','confirmed').get()
  ]);
  let totalContributedAll = 0;
  allContribSnapTop.forEach(d=> totalContributedAll += Number(d.data().amount||0));
  let totalPaidOutAll = 0;
  allPaidReqSnapTop.forEach(d=> totalPaidOutAll += Number(d.data().amount||0));
  let totalIncomeAll = 0;
  allConfirmedIncomeSnapTop.forEach(d=> totalIncomeAll += Number(d.data().amount||0));
  const fundBalanceTop = totalContributedAll + totalIncomeAll - totalPaidOutAll;

  body.innerHTML = `
    <div class="section-title">
      <h1>Accountant Dashboard</h1>
      <span class="eyebrow">Fund Financial Management</span>
    </div>

    <div class="grid grid-3" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="label">Total Contributions</div>
        <div class="value">TZS ${fmtTZS(totalContributedAll)}</div>
      </div>
      <div class="stat-card pos">
        <div class="label">Other Confirmed Income</div>
        <div class="value">TZS ${fmtTZS(totalIncomeAll)}</div>
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
      <button class="tab-btn ${accountantTab==='payouts'?'active':''}" onclick="switchAccountantTab('payouts')">Payout Requests</button>
      <button class="tab-btn ${accountantTab==='income'?'active':''}" onclick="switchAccountantTab('income')">Income Approval</button>
      <button class="tab-btn ${accountantTab==='report'?'active':''}" onclick="switchAccountantTab('report')">PDF Report</button>
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
    if(!recentRows) recentRows = `<tr><td colspan="4" class="empty-state">No records yet.</td></tr>`;

    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Record Monthly Contribution Payment</h3></div>
        <div id="recMsg"></div>
        <div class="form-row">
          <div class="field">
            <label>Member</label>
            <select id="recMember">${options || '<option>No active members</option>'}</select>
          </div>
          <div class="field">
            <label>Month</label>
            <select id="recMonth">${monthOptions}</select>
          </div>
          <div class="field">
            <label>Year</label>
            <select id="recYear">${yearOptions}</select>
          </div>
        </div>
        <div class="field" style="max-width:220px;">
          <label>Amount Paid (TZS)</label>
          <input type="number" id="recAmount" value="${MONTHLY_AMOUNT}">
        </div>
        <button class="btn btn-primary" onclick="recordContribution()">Save Contribution</button>
      </div>

      <div class="card">
        <div class="section-title"><h3>Recent Records (delete if there's an error)</h3></div>
        <table>
          <thead><tr><th>Member</th><th>Month/Year</th><th>Amount</th><th>Action</th></tr></thead>
          <tbody>${recentRows}</tbody>
        </table>
      </div>
    `;
  }

  else if(accountantTab === 'payouts'){
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
        <div class="section-title"><h3>Pending Payout Requests</h3></div>
        <table>
          <thead><tr><th>Beneficiary</th><th>Event Type</th><th>Date</th><th>Description</th><th>Amount</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  }

  else if(accountantTab === 'income'){
    const snap = await db.collection('extraIncome').where('status','==','pending').get();
    let docs = [];
    snap.forEach(d=> docs.push({ id:d.id, ...d.data() }));
    docs.sort((a,b)=> (b.createdAtMillis||0) - (a.createdAtMillis||0));

    let rows = '';
    docs.forEach(inc=>{
      rows += `<tr>
        <td>${inc.description}</td>
        <td class="amount">TZS ${fmtTZS(inc.amount)}</td>
        <td><button class="btn btn-primary btn-sm" onclick="confirmIncome('${inc.id}')">Confirm & Add to Fund</button></td>
      </tr>`;
    });
    if(!rows) rows = `<tr><td colspan="3" class="empty-state">No pending income reports.</td></tr>`;

    const confirmedSnap = await db.collection('extraIncome').where('status','==','confirmed').orderBy('confirmedAtMillis','desc').limit(15).get();
    let confirmedRows = '';
    confirmedSnap.forEach(d=>{
      const inc = d.data();
      confirmedRows += `<tr>
        <td>${inc.description}</td>
        <td class="amount">TZS ${fmtTZS(inc.amount)}</td>
        <td><span class="stamp stamp-paid">Confirmed</span></td>
      </tr>`;
    });
    if(!confirmedRows) confirmedRows = `<tr><td colspan="3" class="empty-state">No confirmed income yet.</td></tr>`;

    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Income Awaiting Confirmation</h3></div>
        <p style="font-size:0.78rem; color:var(--ink-soft); margin-bottom:12px;">
          These were submitted by the Chairman. Confirm only after the money has actually been received —
          once confirmed, it's added to the fund balance and split as a bonus across all active members.
        </p>
        <table>
          <thead><tr><th>Source / Description</th><th>Amount</th><th></th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>

      <div class="card">
        <div class="section-title"><h3>Recently Confirmed Income</h3></div>
        <table>
          <thead><tr><th>Source / Description</th><th>Amount</th><th>Status</th></tr></thead>
          <tbody>${confirmedRows}</tbody>
        </table>
      </div>
    `;
  }

  else if(accountantTab === 'report'){
    const { yearOptions, monthOptions } = yearMonthOptionsHTML();
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Download Report (PDF)</h3></div>

        <div class="tabs-row" style="margin-bottom:18px;">
          <button class="tab-btn ${reportMode==='monthly'?'active':''}" onclick="switchReportMode('monthly')">Monthly Report</button>
          <button class="tab-btn ${reportMode==='annual'?'active':''}" onclick="switchReportMode('annual')">Annual Report</button>
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
        Monthly summary: makusanyo, other income, matumizi, and member payment status.
      </p>
      <div class="form-row">
        <div class="field">
          <label>Month</label>
          <select id="repMonth">${monthOptions}</select>
        </div>
        <div class="field">
          <label>Year</label>
          <select id="repYear">${yearOptions}</select>
        </div>
      </div>
      <button class="btn btn-primary" onclick="generateMonthlyPDF()">Download PDF (Monthly)</button>
    `;
  } else {
    box.innerHTML = `
      <p style="font-size:0.85rem; color:var(--ink-soft); margin-bottom:16px;">
        Full year summary from January to the current month (for this year) or January–December (previous years).
      </p>
      <div class="field" style="max-width:220px;">
        <label>Year</label>
        <select id="repYearAnnual">${yearOptions}</select>
      </div>
      <button class="btn btn-primary" onclick="generateAnnualPDF()">Download PDF (Annual)</button>
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
    msgBox.innerHTML = `<div class="msg msg-error">Fill in all details correctly.</div>`;
    return;
  }

  try{
    const existing = await db.collection('contributions')
      .where('memberId','==',memberId).where('month','==',month).where('year','==',year).get();
    if(!existing.empty){
      msgBox.innerHTML = `<div class="msg msg-error">Mwanachama huyu ameshalipia kwa mwezi huu.</div>`;
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
    msgBox.innerHTML = `<div class="msg msg-ok">Payment recorded successfully.</div>`;
    renderAccountantTabContent();
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

async function deleteContribution(contribId){
  if(!confirm("Are you sure you want to delete this payment record? This action cannot be undone.")) return;
  try{
    await db.collection('contributions').doc(contribId).delete();
    renderAccountantTabContent();
  }catch(err){
    alert("Failed to delete: " + err.message);
  }
}

async function payAssistance(reqId){
  if(!confirm("Confirm that the payout funds have been given to the beneficiary?")) return;
  await db.collection('assistanceRequests').doc(reqId).update({
    status: 'paid',
    paidBy: currentUser.uid,
    paidAt: firebase.firestore.FieldValue.serverTimestamp(),
    paidAtMillis: Date.now()
  });
  renderAccountantDashboard();
}

async function confirmIncome(incomeId){
  if(!confirm("Confirm that this income has actually been received and should be added to the fund balance?")) return;
  const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');
  const membersCountAtTime = activeMembers.length || 1;
  try{
    await db.collection('extraIncome').doc(incomeId).update({
      status: 'confirmed',
      membersCountAtTime: membersCountAtTime,
      confirmedBy: currentUser.uid,
      confirmedAt: firebase.firestore.FieldValue.serverTimestamp(),
      confirmedAtMillis: Date.now()
    });
    renderAccountantDashboard();
  }catch(err){
    alert("Failed to confirm: " + err.message);
  }
}

/* =========================================================
   PDF: MONTHLY REPORT
   ========================================================= */
async function generateMonthlyPDF(){
  const month = parseInt(document.getElementById('repMonth').value);
  const year = parseInt(document.getElementById('repYear').value);

  const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');

  const [contribSnap, allPaidReqSnap, allConfirmedIncomeSnap] = await Promise.all([
    db.collection('contributions').where('month','==',month).where('year','==',year).get(),
    db.collection('assistanceRequests').where('status','==','paid').get(),
    db.collection('extraIncome').where('status','==','confirmed').get()
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

  let totalIncomeAllTime = 0;
  let incomeThisMonth = 0;
  allConfirmedIncomeSnap.forEach(d=>{
    const inc = d.data();
    totalIncomeAllTime += Number(inc.amount||0);
    if(inc.confirmedAt && inc.confirmedAt.toDate){
      const dt = inc.confirmedAt.toDate();
      if(dt.getMonth()+1 === month && dt.getFullYear() === year){
        incomeThisMonth += Number(inc.amount||0);
      }
    }
  });

  const allContribSnap = await db.collection('contributions').get();
  let totalCollectedAllTime = 0;
  allContribSnap.forEach(d=> totalCollectedAllTime += Number(d.data().amount||0));
  const fundBalance = totalCollectedAllTime + totalIncomeAllTime - totalUsedAllTime;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.text("MFUKO WA USTAWI WA JAMII", pageWidth/2, 18, { align:'center' });
  doc.setFontSize(10);
  doc.setFont("courier","normal");
  doc.text("Kidegembye Secondary School", pageWidth/2, 25, { align:'center' });
  doc.text(`Monthly Report: ${MONTH_NAMES[month-1]} ${year}`, pageWidth/2, 31, { align:'center' });

  doc.setLineWidth(0.4);
  doc.line(14, 36, pageWidth-14, 36);

  let y = 46;
  doc.setFont("courier","bold");
  doc.setFontSize(11);
  doc.text("FINANCIAL SUMMARY", 14, y);
  doc.setFont("courier","normal");
  doc.setFontSize(10);
  y += 8;
  doc.text(`This Month's Collections:`, 14, y); doc.text(`TZS ${fmtTZS(totalCollectedThisMonth)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Other Income This Month:`, 14, y); doc.text(`TZS ${fmtTZS(incomeThisMonth)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Payouts This Month (${usedThisMonthCount}):`, 14, y); doc.text(`TZS ${fmtTZS(usedThisMonth)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Total Collections (All-Time):`, 14, y); doc.text(`TZS ${fmtTZS(totalCollectedAllTime)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Total Other Income (All-Time):`, 14, y); doc.text(`TZS ${fmtTZS(totalIncomeAllTime)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Total Expenses (All-Time):`, 14, y); doc.text(`TZS ${fmtTZS(totalUsedAllTime)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.setFont("courier","bold");
  doc.text(`FUND BALANCE:`, 14, y); doc.text(`TZS ${fmtTZS(fundBalance)}`, pageWidth-14, y, {align:'right'});

  y += 12;
  doc.setLineWidth(0.2);
  doc.line(14, y, pageWidth-14, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(`MEMBER PAYMENT STATUS — ${MONTH_NAMES[month-1]} ${year}`, 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("courier","bold");
  doc.text("Name", 14, y);
  doc.text("Status", 130, y);
  doc.text("Amount", pageWidth-14, y, {align:'right'});
  y += 4;
  doc.line(14, y, pageWidth-14, y);
  y += 6;
  doc.setFont("courier","normal");

  activeMembers.forEach(m=>{
    if(y > 275){ doc.addPage(); y = 20; }
    const paid = paidThisMonthMap.hasOwnProperty(m.id);
    doc.text(m.name.substring(0,32), 14, y);
    doc.text(paid ? "PAID" : "UNPAID", 130, y);
    doc.text(paid ? `TZS ${fmtTZS(paidThisMonthMap[m.id])}` : "—", pageWidth-14, y, {align:'right'});
    y += 6;
  });

  y += 6;
  doc.setLineWidth(0.2);
  doc.line(14, y, pageWidth-14, y);
  y += 8;
  doc.setFontSize(8);
  doc.text(`Report generated by JohnsonDev85: ${new Date().toLocaleDateString('en-GB')} — Love is our language`, 14, y);

  doc.save(`Fund_Report_${MONTH_NAMES[month-1]}_${year}.pdf`);
}

/* =========================================================
   PDF: ANNUAL REPORT (January - Current Month / December)
   ========================================================= */
async function generateAnnualPDF(){
  const year = parseInt(document.getElementById('repYearAnnual').value);
  const lastMonth = (year === currentYear()) ? (new Date().getMonth()+1) : 12;

  const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');

  const [yearContribSnap, allPaidReqSnap, allContribSnap, allConfirmedIncomeSnap] = await Promise.all([
    db.collection('contributions').where('year','==',year).get(),
    db.collection('assistanceRequests').where('status','==','paid').get(),
    db.collection('contributions').get(),
    db.collection('extraIncome').where('status','==','confirmed').get()
  ]);

  const memberYearTotals = {};
  const memberMonthsPaid = {};
  let totalCollectedYear = 0;

  yearContribSnap.forEach(d=>{
    const data = d.data();
    if(data.month <= lastMonth){
      totalCollectedYear += Number(data.amount||0);
      memberYearTotals[data.memberId] = (memberYearTotals[data.memberId]||0) + Number(data.amount||0);
      memberMonthsPaid[data.memberId] = (memberMonthsPaid[data.memberId]||0) + 1;
    }
  });

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

  let totalIncomeYear = 0;
  let totalIncomeAllTime = 0;
  allConfirmedIncomeSnap.forEach(d=>{
    const inc = d.data();
    totalIncomeAllTime += Number(inc.amount||0);
    if(inc.confirmedAt && inc.confirmedAt.toDate){
      const dt = inc.confirmedAt.toDate();
      if(dt.getFullYear() === year && (dt.getMonth()+1) <= lastMonth){
        totalIncomeYear += Number(inc.amount||0);
      }
    }
  });

  let totalCollectedAllTime = 0;
  allContribSnap.forEach(d=> totalCollectedAllTime += Number(d.data().amount||0));
  const fundBalance = totalCollectedAllTime + totalIncomeAllTime - totalUsedAllTime;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const periodLabel = `January – ${MONTH_NAMES[lastMonth-1]} ${year}`;

  doc.setFont("courier", "bold");
  doc.setFontSize(14);
  doc.text("MFUKO WA USTAWI WA JAMII", pageWidth/2, 18, { align:'center' });
  doc.setFontSize(10);
  doc.setFont("courier","normal");
  doc.text("Kidegembye Secondary School", pageWidth/2, 25, { align:'center' });
  doc.text(`Annual Report: ${periodLabel}`, pageWidth/2, 31, { align:'center' });

  doc.setLineWidth(0.4);
  doc.line(14, 36, pageWidth-14, 36);

  let y = 46;
  doc.setFont("courier","bold");
  doc.setFontSize(11);
  doc.text("FINANCIAL SUMMARY", 14, y);
  doc.setFont("courier","normal");
  doc.setFontSize(10);
  y += 8;
  doc.text(`Total Collections (${periodLabel}):`, 14, y); doc.text(`TZS ${fmtTZS(totalCollectedYear)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Other Income (${periodLabel}):`, 14, y); doc.text(`TZS ${fmtTZS(totalIncomeYear)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Payouts (${usedYearCount}):`, 14, y); doc.text(`TZS ${fmtTZS(totalUsedYear)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Total Collections (All-Time):`, 14, y); doc.text(`TZS ${fmtTZS(totalCollectedAllTime)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Total Other Income (All-Time):`, 14, y); doc.text(`TZS ${fmtTZS(totalIncomeAllTime)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.text(`Total Expenses (All-Time):`, 14, y); doc.text(`TZS ${fmtTZS(totalUsedAllTime)}`, pageWidth-14, y, {align:'right'});
  y += 7;
  doc.setFont("courier","bold");
  doc.text(`FUND BALANCE:`, 14, y); doc.text(`TZS ${fmtTZS(fundBalance)}`, pageWidth-14, y, {align:'right'});

  y += 12;
  doc.setLineWidth(0.2);
  doc.line(14, y, pageWidth-14, y);
  y += 8;

  doc.setFontSize(11);
  doc.text(`MEMBER BREAKDOWN — ${periodLabel}`, 14, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont("courier","bold");
  doc.text("Name", 14, y);
  doc.text("Months Paid", 110, y);
  doc.text("Total Contributed", pageWidth-14, y, {align:'right'});
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
  doc.text(`Report generated by JohnsonDev85: ${new Date().toLocaleDateString('en-GB')} — Love is our language`, 14, y);

  doc.save(`Annual_Report_${year}.pdf`);
}
