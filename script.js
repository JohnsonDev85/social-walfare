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

db.enablePersistence().catch((err)=>{
  console.warn("Offline persistence haikuwezekana: ", err.code);
});

let cachedFundSummary = null;
let membersLoadedOnce = false;
let kikobaMembersCache = [];
let kikobaMembersLoadedOnce = false;

/* =========================================================
   CONSTANTS
   ========================================================= */
const MONTHLY_AMOUNT = 5000;
const ASSISTANCE_AMOUNT = 100000;
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const EVENT_TYPES = { msiba: "Msiba", kuuguza: "Kuuguza", mtoto: "Kupata mtoto" };

const FUND_START_YEAR = 2025;
const FUND_START_MONTH = 11;
const FUND_END_YEAR = 2026;
const FUND_END_MONTH = 11;
const FUND_YEARS = [2025, 2026];

// KIKOBA CONSTANTS
const KIKOBA_SHARE_PRICE = 10000;          // TZS 10,000 = hisa 1
const KIKOBA_LOAN_INTEREST_RATE = 0.15;    // 15% flat kwa mzunguko wa miezi 3
const KIKOBA_REPAYMENT_MONTHS = 3;

let currentUser = null;
let currentProfile = null;
let allMembersCache = [];

/* =========================================================
   SECURITY HELPER — escape user-supplied text before
   inserting into innerHTML to prevent stored XSS
   ========================================================= */
function escapeHTML(str){
  const div = document.createElement('div');
  div.textContent = (str === null || str === undefined) ? '' : String(str);
  return div.innerHTML;
}

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
    showAuthMsg("A password reset link has been sent to " + escapeHTML(email) + ". Check your 'Inbox' or 'Spam' folder.", "ok");
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
async function fetchAllMembers(forceRefresh){
  if(membersLoadedOnce && !forceRefresh){
    return allMembersCache;
  }
  const snap = await db.collection('members').orderBy('name').get();
  allMembersCache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  membersLoadedOnce = true;
  return allMembersCache;
}
async function fetchKikobaMembers(forceRefresh){
  if(kikobaMembersLoadedOnce && !forceRefresh){
    return kikobaMembersCache;
  }
  const snap = await db.collection('kikobaMembers').get();
  kikobaMembersCache = snap.docs.map(d => ({ id:d.id, ...d.data() }));
  kikobaMembersLoadedOnce = true;
  return kikobaMembersCache;
}
function isKikobaActiveMember(uid){
  const m = kikobaMembersCache.find(k=>k.id===uid);
  return !!(m && m.status === 'active');
}
function fmtTZS(n){
  return Number(n||0).toLocaleString('en-US');
}
function currentYear(){ return new Date().getFullYear(); }

function yearMonthOptionsHTML(){
  const nowYear = currentYear();
  const defaultYear = FUND_YEARS.includes(nowYear) ? nowYear : FUND_END_YEAR;
  const yearOptions = FUND_YEARS
    .map(y=>`<option value="${y}" ${y===defaultYear?'selected':''}>${y}</option>`).join('');
  const monthOptions = MONTH_NAMES.map((mn,i)=>`<option value="${i+1}" ${i+1===new Date().getMonth()+1?'selected':''}>${mn}</option>`).join('');
  return { yearOptions, monthOptions };
}

function getFundPeriodEnd(){
  const now = new Date();
  const nowVal = now.getFullYear()*12 + (now.getMonth()+1);
  const startVal = FUND_START_YEAR*12 + FUND_START_MONTH;
  const endVal = FUND_END_YEAR*12 + FUND_END_MONTH;
  const cappedVal = Math.min(Math.max(nowVal, startVal), endVal);
  return { year: Math.floor((cappedVal-1)/12), month: ((cappedVal-1)%12)+1 };
}

function isInFundPeriod(month, year, periodEnd){
  const val = year*12 + month;
  const startVal = FUND_START_YEAR*12 + FUND_START_MONTH;
  const endVal = periodEnd.year*12 + periodEnd.month;
  return val >= startVal && val <= endVal;
}

/* =========================================================
   MEMBER DASHBOARD (Ustawi + Kikoba tabs)
   ========================================================= */
let memberTab = 'ustawi';

async function renderMemberDashboard(){
  const body = document.getElementById('appBody');
  body.innerHTML = `<div class="empty-state">Loading your information...</div>`;
  await fetchKikobaMembers();
  const inKikoba = isKikobaActiveMember(currentUser.uid);

  if(!inKikoba){
    body.innerHTML = `<div id="memberContent"></div>`;
    renderMemberUstawiContent(document.getElementById('memberContent'));
    return;
  }

  body.innerHTML = `
    <div class="tabs-row">
      <button class="tab-btn ${memberTab==='ustawi'?'active':''}" onclick="switchMemberTab('ustawi')">Ustawi</button>
      <button class="tab-btn ${memberTab==='kikoba'?'active':''}" onclick="switchMemberTab('kikoba')">Kikoba</button>
    </div>
    <div id="memberContent"></div>
  `;
  const container = document.getElementById('memberContent');
  if(memberTab === 'ustawi') renderMemberUstawiContent(container);
  else renderMemberKikobaContent(container);
}

function switchMemberTab(tab){
  memberTab = tab;
  renderMemberDashboard();
}

async function renderMemberUstawiContent(container){
  container.innerHTML = `<div class="empty-state">Loading your information...</div>`;

  const uid = currentUser.uid;
  const year = currentYear();

  const [contribSnap, allPaidReqSnap, allContribSnap, allConfirmedIncomeSnap, currentActiveCountSnap, allPaidExpensesSnap] = await Promise.all([
    db.collection('contributions').where('memberId','==',uid).where('year','==',year).get(),
    db.collection('assistanceRequests').where('status','==','paid').get(),
    db.collection('contributions').where('memberId','==',uid).get(),
    db.collection('extraIncome').where('status','==','confirmed').get(),
    db.collection('members').where('role','==','member').where('status','==','active').get(),
    db.collection('ustawiExpenses').where('status','==','paid').get()
  ]);

  const paidMonths = {};
  contribSnap.forEach(d=>{ paidMonths[d.data().month] = d.data().amount; });

  let totalContributed = 0;
  allContribSnap.forEach(d=> totalContributed += Number(d.data().amount||0));

  const currentActiveCount = currentActiveCountSnap.size || 1;

  let totalUsedShare = 0;
  allPaidReqSnap.forEach(d=>{
    const req = d.data();
    totalUsedShare += (Number(req.amount||ASSISTANCE_AMOUNT) / currentActiveCount);
  });
  allPaidExpensesSnap.forEach(d=>{
    const e = d.data();
    totalUsedShare += (Number(e.amount||0) / currentActiveCount);
  });

  let incomeBonus = 0;
  allConfirmedIncomeSnap.forEach(d=>{
    const inc = d.data();
    incomeBonus += (Number(inc.amount||0) / currentActiveCount);
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

  container.innerHTML = `
    <div class="section-title">
      <h1>Welcome, ${escapeHTML(currentProfile.name.split(' ')[0])}!</h1>
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
   MEMBER — KIKOBA TAB
   ========================================================= */
async function renderMemberKikobaContent(container){
  container.innerHTML = `<div class="empty-state">Loading Kikoba information...</div>`;
  const uid = currentUser.uid;

  const [myShareSnap, allShareSnap, allRepaySnap, myLoanSnap, myReqSnap] = await Promise.all([
    db.collection('kikobaShares').where('memberId','==',uid).get(),
    db.collection('kikobaShares').get(),
    db.collection('kikobaRepayments').get(),
    db.collection('kikobaLoans').where('memberId','==',uid).where('status','==','active').get(),
    db.collection('kikobaLoanRequests').where('memberId','==',uid).get()
  ]);

  let myShares = [];
  let myTotalShares = 0;
  myShareSnap.forEach(d=>{ const s=d.data(); myShares.push(s); myTotalShares += Number(s.shares||0); });
  myShares.sort((a,b)=> (a.year*12+a.month) - (b.year*12+b.month));

  let totalSharesAll = 0;
  allShareSnap.forEach(d=> totalSharesAll += Number(d.data().shares||0));

  let totalIncomeAll = 0;
  allRepaySnap.forEach(d=> totalIncomeAll += Number(d.data().interestPortion||0));

  const currentShareValue = totalSharesAll > 0 ? (totalIncomeAll / totalSharesAll) : 0;
  const myTotalValue = myTotalShares * currentShareValue;

  let sharesRows = '';
  myShares.forEach(s=>{
    sharesRows += `<tr><td>${MONTH_NAMES[s.month-1]} ${s.year}</td><td class="amount">${s.shares} shares</td><td class="amount">TZS ${fmtTZS(s.shares*KIKOBA_SHARE_PRICE)}</td></tr>`;
  });
  if(!sharesRows) sharesRows = `<tr><td colspan="3" class="empty-state">No shares purchased yet.</td></tr>`;

  let loanHtml = '';
  if(!myLoanSnap.empty){
    const loan = myLoanSnap.docs[0].data();
    const remaining = Number(loan.totalOwed||0) - Number(loan.amountRepaid||0);
    const dueDate = loan.dueDateMillis ? new Date(loan.dueDateMillis).toLocaleDateString('en-GB') : '—';
    loanHtml = `
      <div class="card">
        <div class="section-title"><h3>Mkopo wako </h3></div>
        <table>
          <tbody>
            <tr><td>Principal Borrowed</td><td class="amount">TZS ${fmtTZS(loan.principal)}</td></tr>
            <tr><td>Total to Repay </td><td class="amount">TZS ${fmtTZS(loan.totalOwed)}</td></tr>
            <tr><td>Ulicholipa mpaka sasa</td><td class="amount">TZS ${fmtTZS(loan.amountRepaid||0)}</td></tr>
            <tr><td>Remaining Balance</td><td class="amount">TZS ${fmtTZS(remaining)}</td></tr>
            <tr><td>Due Date</td><td>${dueDate}</td></tr>
          </tbody>
        </table>
      </div>
    `;
  }

  const reqs = [];
  myReqSnap.forEach(d=> reqs.push({id:d.id, ...d.data()}));
  reqs.sort((a,b)=>(b.requestedAtMillis||0)-(a.requestedAtMillis||0));
  let reqRows = reqs.map(r=>{
    const statusHtml = r.status==='pending' ? '<span class="stamp stamp-pending">Pending</span>'
      : r.status==='approved' ? '<span class="stamp stamp-pending">Approved - Awaiting Disbursement</span>'
      : r.status==='disbursed' ? '<span class="stamp stamp-paid">Disbursed</span>'
      : '<span class="stamp stamp-unpaid">Rejected</span>';
    return `<tr><td>${escapeHTML(r.reason)||'—'}</td><td class="amount">TZS ${fmtTZS(r.amountRequested)}</td><td>${statusHtml}</td></tr>`;
  }).join('');
  if(!reqRows) reqRows = `<tr><td colspan="3" class="empty-state">No loan requests yet.</td></tr>`;

  const hasPendingRequest = reqs.some(r=> r.status==='pending' || r.status==='approved');

  container.innerHTML = `
    <div class="grid grid-3" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="label">Jumla ya Hisa ulizonazo</div>
        <div class="value">${myTotalShares} shares</div>
      </div>
      <div class="stat-card pos">
        <div class="label">Current Value Per Hisa</div>
        <div class="value">TZS ${fmtTZS(Math.round(currentShareValue))}</div>
      </div>
      <div class="stat-card pos">
        <div class="label">Total Value (Hisa + Faida)</div>
        <div class="value">TZS ${fmtTZS(Math.round(myTotalValue))}</div>
      </div>
    </div>

    <div class="card">
      <div class="section-title"><h3>History ya Manunuzi yako ya Hisa</h3></div>
      <table>
        <thead><tr><th>Month</th><th>Hisa zilizonunuliwa</th><th>Amount Paid</th></tr></thead>
        <tbody>${sharesRows}</tbody>
      </table>
    </div>

    ${loanHtml}

    <div class="card">
      <div class="section-title"><h3>Request a Loan</h3></div>
      <div id="kikobaLoanMsg"></div>
      ${hasPendingRequest ? `<p style="font-size:0.85rem; color:var(--ink-soft);">You already have a pending or active loan request. Wait for it to be resolved before requesting another.</p>` : `
      <div class="form-row">
        <div class="field">
          <label>Amount Requested (TZS)</label>
          <input type="number" id="kikobaLoanAmount" placeholder="e.g. 100000">
        </div>
      </div>
      
      <p style="font-size:0.78rem; color:var(--ink-soft); margin-bottom:12px;">
        Repayment: ndani ya miezi 3, jumla = kiasi ulichokopa + 5% (kwa kila mwezi) riba.
      </p>
      <button class="btn btn-primary" onclick="submitKikobaLoanRequest()">Submit Loan Request</button>
      `}
    </div>

    <div class="card">
      <div class="section-title"><h3>Your Loan Request History</h3></div>
      <table>
        <thead><tr><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${reqRows}</tbody>
      </table>
    </div>
  `;
}

async function submitKikobaLoanRequest(){
  const msgBox = document.getElementById('kikobaLoanMsg');
  const amount = parseFloat(document.getElementById('kikobaLoanAmount').value);
  const reason = document.getElementById('kikobaLoanReason').value.trim();
  if(!amount || amount<=0 || !reason){
    msgBox.innerHTML = `<div class="msg msg-error">Enter a valid amount and reason.</div>`;
    return;
  }
  try{
    await db.collection('kikobaLoanRequests').add({
      memberId: currentUser.uid,
      amountRequested: amount,
      reason: reason,
      status: 'pending',
      requestedAtMillis: Date.now(),
      requestedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgBox.innerHTML = `<div class="msg msg-ok">Loan request submitted to the Chairman for approval.</div>`;
    renderMemberDashboard();
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}
/* =========================================================
   CHAIRMAN DASHBOARD
   ========================================================= */
let chairmanTab = 'members';
let kikobaChairmanSubTab = 'kmembers';

async function renderChairmanDashboard(forceRefresh){
  const body = document.getElementById('appBody');
  if(!membersLoadedOnce || forceRefresh){
    body.innerHTML = `<div class="empty-state">Loading Chairman Dashboard...</div>`;
  }
  await fetchAllMembers(forceRefresh);
  await fetchKikobaMembers(forceRefresh);

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
      <button class="tab-btn ${chairmanTab==='expenses'?'active':''}" onclick="switchChairmanTab('expenses')">Ustawi Expenses</button>
      <button class="tab-btn ${chairmanTab==='kikoba'?'active':''}" onclick="switchChairmanTab('kikoba')">Kikoba</button>
    </div>

    <div id="chairmanContent"></div>
  `;
  renderChairmanTabContent();
}

function switchChairmanTab(tab){
  chairmanTab = tab;
  renderChairmanDashboard(false);
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
        <td>${escapeHTML(m.name)}</td>
        <td>${escapeHTML(m.email)}</td>
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
    const options = activeMembers.map(m=>`<option value="${m.id}">${escapeHTML(m.name)}</option>`).join('');
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
        <td>${member ? escapeHTML(member.name) : '—'}</td>
        <td>${escapeHTML(EVENT_TYPES[r.type]||r.type)}</td>
        <td>${escapeHTML(r.eventDate)||'—'}</td>
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

  else if(chairmanTab === 'expenses'){
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Report New Expense</h3></div>
        <p style="font-size:0.82rem; color:var(--ink-soft); margin-bottom:14px;">
          Tumia hii kwa operational costs (mf. kununua kitu kinachohusiana na ustawi) — sio kwa member payouts.
          The cost is split equally among all active members.
        </p>
        <div id="ustawiExpenseMsg"></div>
        <div class="field">
          <label>Description</label>
          <textarea id="ustawiExpenseDesc" rows="3" placeholder="e.g. Kununa daftari la kikundi"></textarea>
        </div>
        <div class="field" style="max-width:220px;">
          <label>Amount (TZS)</label>
          <input type="number" id="ustawiExpenseAmount" placeholder="e.g. 50000">
        </div>
        <button class="btn btn-primary" onclick="submitUstawiExpense()">Send to Accountant</button>
      </div>
      <div id="ustawiExpenseHistory"></div>
    `;
    loadUstawiExpenseHistory();
  }

  else if(chairmanTab === 'kikoba'){
    await renderKikobaChairmanTab(c);
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
      <td>${escapeHTML(inc.description)}</td>
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

async function loadUstawiExpenseHistory(){
  const box = document.getElementById('ustawiExpenseHistory');
  if(!box) return;
  const snap = await db.collection('ustawiExpenses').orderBy('requestedAtMillis','desc').get();
  let rows = '';
  snap.forEach(d=>{
    const e = d.data();
    const statusHtml = e.status === 'paid'
      ? '<span class="stamp stamp-paid">Paid</span>'
      : '<span class="stamp stamp-pending">Pending</span>';
    rows += `<tr><td>${escapeHTML(e.description)}</td><td class="amount">TZS ${fmtTZS(e.amount)}</td><td>${statusHtml}</td></tr>`;
  });
  if(!rows) rows = `<tr><td colspan="3" class="empty-state">No expenses reported yet.</td></tr>`;
  box.innerHTML = `
    <div class="card">
      <div class="section-title"><h3>Expense History</h3></div>
      <table>
        <thead><tr><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function submitUstawiExpense(){
  const msgBox = document.getElementById('ustawiExpenseMsg');
  const description = document.getElementById('ustawiExpenseDesc').value.trim();
  const amount = parseFloat(document.getElementById('ustawiExpenseAmount').value);
  if(!description || !amount || amount <= 0){
    msgBox.innerHTML = `<div class="msg msg-error">Enter description and a valid amount.</div>`;
    return;
  }
  try{
    await db.collection('ustawiExpenses').add({
      description, amount, status:'pending',
      requestedBy: currentUser.uid,
      requestedAtMillis: Date.now(),
      requestedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgBox.innerHTML = `<div class="msg msg-ok">Expense sent to Accountant for payment.</div>`;
    document.getElementById('ustawiExpenseDesc').value = '';
    document.getElementById('ustawiExpenseAmount').value = '';
    loadUstawiExpenseHistory();
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
      <td>${escapeHTML(m.name)}</td>
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
  await fetchAllMembers(true);
  renderChairmanTabContent();
}
async function restoreMember(memberId){
  await db.collection('members').doc(memberId).update({ status:'active' });
  await fetchAllMembers(true);
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
   CHAIRMAN — KIKOBA SUB-TABS
   ========================================================= */
async function renderKikobaChairmanTab(c){
  c.innerHTML = `
    <div class="tabs-row" style="margin-bottom:18px;">
      <button class="tab-btn ${kikobaChairmanSubTab==='kmembers'?'active':''}" onclick="switchKikobaChairmanSubTab('kmembers')">Kikoba Members</button>
      <button class="tab-btn ${kikobaChairmanSubTab==='kloans'?'active':''}" onclick="switchKikobaChairmanSubTab('kloans')">Loan Requests</button>
      <button class="tab-btn ${kikobaChairmanSubTab==='kexpenses'?'active':''}" onclick="switchKikobaChairmanSubTab('kexpenses')">Kikoba Expenses</button>
    </div>
    <div id="kikobaChairmanContent"></div>
  `;
  await renderKikobaChairmanSubContent();
}

function switchKikobaChairmanSubTab(tab){
  kikobaChairmanSubTab = tab;
  renderKikobaChairmanSubContent();
}

async function renderKikobaChairmanSubContent(){
  const box = document.getElementById('kikobaChairmanContent');
  if(!box) return;

  if(kikobaChairmanSubTab === 'kmembers'){
    await fetchKikobaMembers(true);
    const ustawiActive = allMembersCache.filter(m=>m.role==='member' && m.status==='active');
    const inKikoba = ustawiActive.filter(m=> isKikobaActiveMember(m.id));
    const notInKikoba = ustawiActive.filter(m=> !isKikobaActiveMember(m.id));

    let inRows = inKikoba.map(m=>`<tr><td>${escapeHTML(m.name)}</td><td><button class="btn btn-danger btn-sm" onclick="removeFromKikoba('${m.id}')">Remove from Kikoba</button></td></tr>`).join('');
    if(!inRows) inRows = `<tr><td colspan="2" class="empty-state">No members in Kikoba yet.</td></tr>`;

    let outRows = notInKikoba.map(m=>`<tr><td>${escapeHTML(m.name)}</td><td><button class="btn btn-outline btn-sm" onclick="addToKikoba('${m.id}')">Add to Kikoba</button></td></tr>`).join('');
    if(!outRows) outRows = `<tr><td colspan="2" class="empty-state">All Ustawi members are already in Kikoba.</td></tr>`;

    box.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Kikoba Members (${inKikoba.length})</h3></div>
        <table><thead><tr><th>Name</th><th>Action</th></tr></thead><tbody>${inRows}</tbody></table>
      </div>
      <div class="card">
        <div class="section-title"><h3>Not in Kikoba</h3></div>
        <table><thead><tr><th>Name</th><th>Action</th></tr></thead><tbody>${outRows}</tbody></table>
      </div>
    `;
  }

  else if(kikobaChairmanSubTab === 'kloans'){
    const snap = await db.collection('kikobaLoanRequests').where('status','==','pending').get();
    let docs = [];
    snap.forEach(d=> docs.push({id:d.id, ...d.data()}));
    docs.sort((a,b)=>(b.requestedAtMillis||0)-(a.requestedAtMillis||0));
    let rows = docs.map(r=>{
      const member = allMembersCache.find(m=>m.id===r.memberId);
      return `<tr>
        <td>${member?escapeHTML(member.name):'—'}</td>
        <td>${escapeHTML(r.reason)||'—'}</td>
        <td class="amount">TZS ${fmtTZS(r.amountRequested)}</td>
        <td>
          <button class="btn btn-primary btn-sm" onclick="decideKikobaLoanRequest('${r.id}','approved')">Approve</button>
          <button class="btn btn-danger btn-sm" onclick="decideKikobaLoanRequest('${r.id}','rejected')">Reject</button>
        </td>
      </tr>`;
    }).join('');
    if(!rows) rows = `<tr><td colspan="4" class="empty-state">No pending loan requests.</td></tr>`;
    box.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Pending Loan Requests</h3></div>
        <table><thead><tr><th>Member</th><th>Amount</th><th>Action</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }

  else if(kikobaChairmanSubTab === 'kexpenses'){
    box.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Report New Kikoba Expense</h3></div>
        <p style="font-size:0.82rem; color:var(--ink-soft); margin-bottom:14px;">
          Paid from Kikoba income (riba zinazotokana na mikopo) — na sio hisa za members.
        </p>
        <div id="kikobaExpenseMsg"></div>
        <div class="field">
          <label>Description</label>
          <textarea id="kikobaExpenseDesc" rows="3" placeholder="e.g. Kununua mfumo"></textarea>
        </div>
        <div class="field" style="max-width:220px;">
          <label>Amount (TZS)</label>
          <input type="number" id="kikobaExpenseAmount" placeholder="e.g. 20000">
        </div>
        <button class="btn btn-primary" onclick="submitKikobaExpense()">Send to Accountant</button>
      </div>
      <div id="kikobaExpenseHistory"></div>
    `;
    loadKikobaExpenseHistory();
  }
}

async function addToKikoba(memberId){
  await db.collection('kikobaMembers').doc(memberId).set({
    status:'active', addedBy: currentUser.uid, addedAt: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  await fetchKikobaMembers(true);
  renderKikobaChairmanSubContent();
}
async function removeFromKikoba(memberId){
  const activeLoanSnap = await db.collection('kikobaLoans').where('memberId','==',memberId).where('status','==','active').get();
  if(!activeLoanSnap.empty){
    alert("Huwezi kumwondoa mwanachama huyu kwenye Kikoba kwa sasa kwa sababu ana mkopo hai ambao bado haujalipwa wote. Hakikisha amemaliza kulipa deni lake kwanza.");
    return;
  }
  if(!confirm("Remove this member from Kikoba? They will remain a Ustawi member.")) return;
  await db.collection('kikobaMembers').doc(memberId).update({ status:'removed' });
  await fetchKikobaMembers(true);
  renderKikobaChairmanSubContent();
}

async function decideKikobaLoanRequest(reqId, decision){
  if(!confirm(`Are you sure you want to ${decision} this loan request?`)) return;
  await db.collection('kikobaLoanRequests').doc(reqId).update({
    status: decision,
    decidedBy: currentUser.uid,
    decidedAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  renderKikobaChairmanSubContent();
}

async function loadKikobaExpenseHistory(){
  const box = document.getElementById('kikobaExpenseHistory');
  if(!box) return;
  const snap = await db.collection('kikobaExpenses').orderBy('requestedAtMillis','desc').get();
  let rows = '';
  snap.forEach(d=>{
    const e = d.data();
    const statusHtml = e.status === 'paid'
      ? '<span class="stamp stamp-paid">Paid</span>'
      : '<span class="stamp stamp-pending">Pending</span>';
    rows += `<tr><td>${escapeHTML(e.description)}</td><td class="amount">TZS ${fmtTZS(e.amount)}</td><td>${statusHtml}</td></tr>`;
  });
  if(!rows) rows = `<tr><td colspan="3" class="empty-state">No Kikoba expenses yet.</td></tr>`;
  box.innerHTML = `
    <div class="card">
      <div class="section-title"><h3>Kikoba Expense History</h3></div>
      <table>
        <thead><tr><th>Description</th><th>Amount</th><th>Status</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

async function submitKikobaExpense(){
  const msgBox = document.getElementById('kikobaExpenseMsg');
  const description = document.getElementById('kikobaExpenseDesc').value.trim();
  const amount = parseFloat(document.getElementById('kikobaExpenseAmount').value);
  if(!description || !amount || amount <= 0){
    msgBox.innerHTML = `<div class="msg msg-error">Enter description and a valid amount.</div>`;
    return;
  }
  try{
    await db.collection('kikobaExpenses').add({
      description, amount, status:'pending',
      requestedBy: currentUser.uid,
      requestedAtMillis: Date.now(),
      requestedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgBox.innerHTML = `<div class="msg msg-ok">Kikoba expense sent to Accountant.</div>`;
    document.getElementById('kikobaExpenseDesc').value = '';
    document.getElementById('kikobaExpenseAmount').value = '';
    loadKikobaExpenseHistory();
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

/* =========================================================
   ACCOUNTANT DASHBOARD
   ========================================================= */
let accountantTab = 'record';
let reportMode = 'monthly';
let kikobaAccountantSubTab = 'kshares';

async function renderAccountantDashboard(forceRefresh){
  const body = document.getElementById('appBody');
  if(!cachedFundSummary || forceRefresh){
    body.innerHTML = `<div class="empty-state">Loading Accountant Dashboard...</div>`;
  }
  await fetchAllMembers(forceRefresh);
  await fetchKikobaMembers(forceRefresh);

  if(!cachedFundSummary || forceRefresh){
    const [allContribSnapTop, allPaidReqSnapTop, allConfirmedIncomeSnapTop, allPaidExpensesTop] = await Promise.all([
      db.collection('contributions').get(),
      db.collection('assistanceRequests').where('status','==','paid').get(),
      db.collection('extraIncome').where('status','==','confirmed').get(),
      db.collection('ustawiExpenses').where('status','==','paid').get()
    ]);
    let totalContributedAll = 0;
    allContribSnapTop.forEach(d=> totalContributedAll += Number(d.data().amount||0));
    let totalPaidOutAll = 0;
    allPaidReqSnapTop.forEach(d=> totalPaidOutAll += Number(d.data().amount||0));
    allPaidExpensesTop.forEach(d=> totalPaidOutAll += Number(d.data().amount||0));
    let totalIncomeAll = 0;
    allConfirmedIncomeSnapTop.forEach(d=> totalIncomeAll += Number(d.data().amount||0));
    cachedFundSummary = {
      totalContributedAll,
      totalPaidOutAll,
      totalIncomeAll,
      fundBalanceTop: totalContributedAll + totalIncomeAll - totalPaidOutAll
    };
  }
  const { totalContributedAll, totalPaidOutAll, totalIncomeAll, fundBalanceTop } = cachedFundSummary;

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
        <div class="label">Total Payouts + Expenses</div>
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
      <button class="tab-btn ${accountantTab==='expenses'?'active':''}" onclick="switchAccountantTab('expenses')">Ustawi Expenses</button>
      <button class="tab-btn ${accountantTab==='kikoba'?'active':''}" onclick="switchAccountantTab('kikoba')">Kikoba</button>
      <button class="tab-btn ${accountantTab==='report'?'active':''}" onclick="switchAccountantTab('report')">PDF Report</button>
    </div>

    <div id="accountantContent"></div>
  `;
  renderAccountantTabContent();
}

function switchAccountantTab(tab){
  accountantTab = tab;
  renderAccountantDashboard(false);
}

async function renderAccountantTabContent(){
  const c = document.getElementById('accountantContent');

  if(accountantTab === 'record'){
    const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');
    const options = activeMembers.map(m=>`<option value="${m.id}">${escapeHTML(m.name)}</option>`).join('');
    const { yearOptions, monthOptions } = yearMonthOptionsHTML();

    const recentSnap = await db.collection('contributions').orderBy('recordedAt','desc').limit(15).get();
    let recentRows = '';
    recentSnap.forEach(d=>{
      const r = d.data();
      const member = allMembersCache.find(m=>m.id===r.memberId);
      recentRows += `<tr>
        <td>${member ? escapeHTML(member.name) : '—'}</td>
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
        <div class="section-title"><h3>Search & Delete a Specific Contribution</h3></div>
        <p style="font-size:0.78rem; color:var(--ink-soft); margin-bottom:12px;">
          Use this to find and delete a contribution from any date — not just the most recent ones.
        </p>
        <div id="searchContribResult"></div>
        <div class="form-row">
          <div class="field">
            <label>Member</label>
            <select id="searchContribMember">${options || '<option>No active members</option>'}</select>
          </div>
          <div class="field">
            <label>Month</label>
            <select id="searchContribMonth">${monthOptions}</select>
          </div>
          <div class="field">
            <label>Year</label>
            <select id="searchContribYear">${yearOptions}</select>
          </div>
        </div>
        <button class="btn btn-outline" onclick="searchContribution()">Search</button>
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
        <td>${member ? escapeHTML(member.name) : '—'}</td>
        <td>${escapeHTML(EVENT_TYPES[r.type]||r.type)}</td>
        <td>${escapeHTML(r.eventDate)||'—'}</td>
        <td>${escapeHTML(r.description) || '—'}</td>
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
        <td>${escapeHTML(inc.description)}</td>
        <td class="amount">TZS ${fmtTZS(inc.amount)}</td>
        <td><button class="btn btn-primary btn-sm" onclick="confirmIncome('${inc.id}')">Confirm & Add to Fund</button></td>
      </tr>`;
    });
    if(!rows) rows = `<tr><td colspan="3" class="empty-state">No pending income reports.</td></tr>`;

    const confirmedSnap = await db.collection('extraIncome').where('status','==','confirmed').get();
    let confirmedDocs = [];
    confirmedSnap.forEach(d=> confirmedDocs.push({ id:d.id, ...d.data() }));
    confirmedDocs.sort((a,b)=> (b.confirmedAtMillis||0) - (a.confirmedAtMillis||0));
    confirmedDocs = confirmedDocs.slice(0, 15);

    let confirmedRows = '';
    confirmedDocs.forEach(inc=>{
      confirmedRows += `<tr>
        <td>${escapeHTML(inc.description)}</td>
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

  else if(accountantTab === 'expenses'){
    const snap = await db.collection('ustawiExpenses').where('status','==','pending').get();
    let docs = [];
    snap.forEach(d=> docs.push({id:d.id, ...d.data()}));
    docs.sort((a,b)=>(b.requestedAtMillis||0)-(a.requestedAtMillis||0));
    let rows = docs.map(e=>`<tr><td>${escapeHTML(e.description)}</td><td class="amount">TZS ${fmtTZS(e.amount)}</td><td><button class="btn btn-primary btn-sm" onclick="payUstawiExpense('${e.id}')">Approve & Pay</button></td></tr>`).join('');
    if(!rows) rows = `<tr><td colspan="3" class="empty-state">No pending expenses.</td></tr>`;
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Pending Ustawi Expenses</h3></div>
        <table><thead><tr><th>Description</th><th>Amount</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }

  else if(accountantTab === 'kikoba'){
    await renderKikobaAccountantTab(c);
  }

  else if(accountantTab === 'report'){
    const { yearOptions, monthOptions } = yearMonthOptionsHTML();
    c.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Download Report (PDF)</h3></div>

        <div class="tabs-row" style="margin-bottom:18px;">
          <button class="tab-btn ${reportMode==='monthly'?'active':''}" onclick="switchReportMode('monthly')">Monthly Report</button>
          <button class="tab-btn ${reportMode==='annual'?'active':''}" onclick="switchReportMode('annual')">Fund Year Report</button>
        </div>

        <div id="reportModeContent"></div>
      </div>
    `;
    renderReportModeContent();
  }
}

async function payUstawiExpense(id){
  if(!confirm("Confirm that this expense has been paid?")) return;
  await db.collection('ustawiExpenses').doc(id).update({
    status:'paid', paidBy: currentUser.uid, paidAtMillis: Date.now(),
    paidAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  renderAccountantDashboard(true);
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
    const periodEnd = getFundPeriodEnd();
    box.innerHTML = `
      <p style="font-size:0.85rem; color:var(--ink-soft); margin-bottom:16px;">
        Fund Year period: <strong>${MONTH_NAMES[FUND_START_MONTH-1]} ${FUND_START_YEAR} – ${MONTH_NAMES[periodEnd.month-1]} ${periodEnd.year}</strong>.
        This report covers the entire life of the fund so far.
      </p>
      <button class="btn btn-primary" onclick="generateAnnualPDF()">Download PDF (Fund Year)</button>
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
    renderAccountantDashboard(true);
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

async function searchContribution(){
  const resultBox = document.getElementById('searchContribResult');
  const memberId = document.getElementById('searchContribMember').value;
  const month = parseInt(document.getElementById('searchContribMonth').value);
  const year = parseInt(document.getElementById('searchContribYear').value);

  if(!memberId){
    resultBox.innerHTML = `<div class="msg msg-error">Select a member first.</div>`;
    return;
  }

  resultBox.innerHTML = `<div class="empty-state">Searching...</div>`;

  try{
    const snap = await db.collection('contributions')
      .where('memberId','==',memberId).where('month','==',month).where('year','==',year).get();

    if(snap.empty){
      resultBox.innerHTML = `<div class="msg msg-error">No contribution record found for this member in ${MONTH_NAMES[month-1]} ${year}.</div>`;
      return;
    }

    let rows = '';
    snap.forEach(d=>{
      const r = d.data();
      const member = allMembersCache.find(m=>m.id===r.memberId);
      rows += `<tr>
        <td>${member ? escapeHTML(member.name) : '—'}</td>
        <td>${MONTH_NAMES[r.month-1]} ${r.year}</td>
        <td class="amount">TZS ${fmtTZS(r.amount)}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deleteContribution('${d.id}')">Delete</button></td>
      </tr>`;
    });

    resultBox.innerHTML = `
      <table>
        <thead><tr><th>Member</th><th>Month/Year</th><th>Amount</th><th>Action</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }catch(err){
    resultBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

async function deleteContribution(contribId){
  if(!confirm("Are you sure you want to delete this payment record? This action cannot be undone.")) return;
  try{
    await db.collection('contributions').doc(contribId).delete();
    renderAccountantDashboard(true);
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
  renderAccountantDashboard(true);
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
    renderAccountantDashboard(true);
  }catch(err){
    alert("Failed to confirm: " + err.message);
  }
}

/* =========================================================
   ACCOUNTANT — KIKOBA SUB-TABS
   ========================================================= */
async function renderKikobaAccountantTab(c){
  const [allShareSnap, allRepaySnap, allExpPaidSnap, allLoansOutSnap] = await Promise.all([
    db.collection('kikobaShares').get(),
    db.collection('kikobaRepayments').get(),
    db.collection('kikobaExpenses').where('status','==','paid').get(),
    db.collection('kikobaLoans').get()
  ]);
  let totalShares = 0; allShareSnap.forEach(d=> totalShares += Number(d.data().shares||0));
  let totalIncome = 0; allRepaySnap.forEach(d=> totalIncome += Number(d.data().interestPortion||0));
  let totalExpensesPaid = 0; allExpPaidSnap.forEach(d=> totalExpensesPaid += Number(d.data().amount||0));
  const kikobaBalance = totalIncome - totalExpensesPaid;
  const shareValue = totalShares > 0 ? totalIncome/totalShares : 0;

  // Available capital = share capital + net income, minus principal currently out on active/unpaid loans
  const shareCapital = totalShares * KIKOBA_SHARE_PRICE;
  let principalOutstanding = 0;
  allLoansOutSnap.forEach(d=>{
    const loan = d.data();
    if(loan.status === 'active'){
      const remaining = Number(loan.totalOwed||0) - Number(loan.amountRepaid||0);
      principalOutstanding += Math.max(0, remaining);
    }
  });
  const availableCapital = (shareCapital + kikobaBalance) - principalOutstanding;
  window.__kikobaAvailableCapital = availableCapital; // used by disbursement check

  c.innerHTML = `
    <div class="grid grid-3" style="margin-bottom:20px;">
      <div class="stat-card"><div class="label">Jumla ya Hisa</div><div class="value">${totalShares}</div></div>
      <div class="stat-card pos"><div class="label">Current Thamani ya Hisa</div><div class="value">TZS ${fmtTZS(Math.round(shareValue))}</div></div>
      <div class="stat-card ${kikobaBalance>=0?'pos':'neg'}"><div class="label">Kikoba Income Balance</div><div class="value">TZS ${fmtTZS(kikobaBalance)}</div></div>
      <div class="stat-card ${availableCapital>=0?'pos':'neg'}"><div class="label">Mtaji uliopo kwa Mikopo mipya</div><div class="value">TZS ${fmtTZS(Math.round(availableCapital))}</div></div>
    </div>
    <div class="tabs-row" style="margin-bottom:18px;">
      <button class="tab-btn ${kikobaAccountantSubTab==='kshares'?'active':''}" onclick="switchKikobaAccountantSubTab('kshares')">Record Hisa</button>
      <button class="tab-btn ${kikobaAccountantSubTab==='kdisburse'?'active':''}" onclick="switchKikobaAccountantSubTab('kdisburse')">Toa mkopo</button>
      <button class="tab-btn ${kikobaAccountantSubTab==='krepay'?'active':''}" onclick="switchKikobaAccountantSubTab('krepay')">Record Marejesho</button>
      <button class="tab-btn ${kikobaAccountantSubTab==='kexp'?'active':''}" onclick="switchKikobaAccountantSubTab('kexp')">Kikoba Expenses</button>
    </div>
    <div id="kikobaAccountantContent"></div>
  `;
  await renderKikobaAccountantSubContent();
}

function switchKikobaAccountantSubTab(tab){
  kikobaAccountantSubTab = tab;
  renderKikobaAccountantSubContent();
}

async function renderKikobaAccountantSubContent(){
  const box = document.getElementById('kikobaAccountantContent');
  if(!box) return;

  if(kikobaAccountantSubTab === 'kshares'){
    await fetchKikobaMembers();
    const kMembers = allMembersCache.filter(m=> isKikobaActiveMember(m.id));
    const options = kMembers.map(m=>`<option value="${m.id}">${escapeHTML(m.name)}</option>`).join('');
    const { yearOptions, monthOptions } = yearMonthOptionsHTML();
    box.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Record Manunuzi ya Hisa</h3></div>
        <div id="kshareMsg"></div>
        <div class="form-row">
          <div class="field"><label>Member</label><select id="kshareMember">${options || '<option>No Kikoba members</option>'}</select></div>
          <div class="field"><label>Month</label><select id="kshareMonth">${monthOptions}</select></div>
          <div class="field"><label>Year</label><select id="kshareYear">${yearOptions}</select></div>
        </div>
        <div class="field" style="max-width:220px;">
          <label>Amount Paid (TZS) — must be a multiple of ${fmtTZS(KIKOBA_SHARE_PRICE)}</label>
          <input type="number" id="kshareAmount" placeholder="e.g. 30000" step="${KIKOBA_SHARE_PRICE}">
        </div>
        <p style="font-size:0.75rem; color:var(--ink-soft); margin-top:-6px; margin-bottom:12px;">
          Amount lazima igawanyike sawasawa na TZS ${fmtTZS(KIKOBA_SHARE_PRICE)} (bei ya hisa 1). Ukiingiza kiasi kisicho kamili, mfumo utakataa ili fedha isipotee.
        </p>
        <button class="btn btn-primary" onclick="recordKikobaShare()">Save Manunuzi ya Hisa</button>
      </div>
    `;
  }

  else if(kikobaAccountantSubTab === 'kdisburse'){
    const snap = await db.collection('kikobaLoanRequests').where('status','==','approved').get();
    let docs = []; snap.forEach(d=> docs.push({id:d.id, ...d.data()}));
    const availableCapital = window.__kikobaAvailableCapital || 0;
    let rows = docs.map(r=>{
      const member = allMembersCache.find(m=>m.id===r.memberId);
      const exceedsCapital = r.amountRequested > availableCapital;
      return `<tr>
        <td>${member?escapeHTML(member.name):'—'}</td>
        <td class="amount">TZS ${fmtTZS(r.amountRequested)}</td>
        <td>${exceedsCapital
              ? `<span class="stamp stamp-unpaid" title="Kiasi kinazidi mtaji uliopo wa Kikoba">Insufficient Capital</span>`
              : `<button class="btn btn-primary btn-sm" onclick="disburseKikobaLoan('${r.id}','${r.memberId}',${r.amountRequested})">Disburse</button>`}
        </td></tr>`;
    }).join('');
    if(!rows) rows = `<tr><td colspan="3" class="empty-state">No approved loans awaiting disbursement.</td></tr>`;
    box.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Approved Loans — Awaiting Disbursement</h3></div>
        <p style="font-size:0.78rem; color:var(--ink-soft); margin-bottom:12px;">
          Available Kikoba capital right now: <strong>TZS ${fmtTZS(Math.round(availableCapital))}</strong>.
          A loan that exceeds this amount cannot be disbursed until more shares or repayments come in.
        </p>
        <table><thead><tr><th>Member</th><th>Amount</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }

  else if(kikobaAccountantSubTab === 'krepay'){
    const snap = await db.collection('kikobaLoans').where('status','==','active').get();
    let docs = []; snap.forEach(d=> docs.push({id:d.id, ...d.data()}));
    let rows = docs.map(loan=>{
      const member = allMembersCache.find(m=>m.id===loan.memberId);
      const remaining = Number(loan.totalOwed||0) - Number(loan.amountRepaid||0);
      return `<tr>
        <td>${member?escapeHTML(member.name):'—'}</td>
        <td class="amount">TZS ${fmtTZS(loan.totalOwed)}</td>
        <td class="amount">TZS ${fmtTZS(loan.amountRepaid||0)}</td>
        <td class="amount">TZS ${fmtTZS(remaining)}</td>
        <td>
          <input type="number" id="repay_${loan.id}" placeholder="Amount handed over" style="width:130px; padding:8px; border:1px solid var(--line); border-radius:8px;">
          <button class="btn btn-primary btn-sm" onclick="recordKikobaRepayment('${loan.id}')">Confirm</button>
        </td>
      </tr>`;
    }).join('');
    if(!rows) rows = `<tr><td colspan="5" class="empty-state">No active loans.</td></tr>`;
    box.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Active Loans — Record Repayments</h3></div>
        <table><thead><tr><th>Member</th><th>Total Owed</th><th>Repaid</th><th>Remaining</th><th>Record Repayment</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }

  else if(kikobaAccountantSubTab === 'kexp'){
    const snap = await db.collection('kikobaExpenses').where('status','==','pending').get();
    let docs = []; snap.forEach(d=> docs.push({id:d.id, ...d.data()}));
    let rows = docs.map(e=>`<tr><td>${escapeHTML(e.description)}</td><td class="amount">TZS ${fmtTZS(e.amount)}</td><td><button class="btn btn-primary btn-sm" onclick="payKikobaExpense('${e.id}')">Approve & Pay</button></td></tr>`).join('');
    if(!rows) rows = `<tr><td colspan="3" class="empty-state">No pending Kikoba expenses.</td></tr>`;
    box.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Pending Kikoba Expenses</h3></div>
        <table><thead><tr><th>Description</th><th>Amount</th><th></th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }
}

async function recordKikobaShare(){
  const msgBox = document.getElementById('kshareMsg');
  const memberId = document.getElementById('kshareMember').value;
  const month = parseInt(document.getElementById('kshareMonth').value);
  const year = parseInt(document.getElementById('kshareYear').value);
  const amount = parseFloat(document.getElementById('kshareAmount').value);
  if(!memberId || !amount || amount < KIKOBA_SHARE_PRICE){
    msgBox.innerHTML = `<div class="msg msg-error">Enter a valid amount (minimum TZS ${fmtTZS(KIKOBA_SHARE_PRICE)}).</div>`;
    return;
  }
  if(amount % KIKOBA_SHARE_PRICE !== 0){
    msgBox.innerHTML = `<div class="msg msg-error">Kiasi lazima kiwe multiple kamili ya TZS ${fmtTZS(KIKOBA_SHARE_PRICE)} (mfano: 10000, 20000, 30000...). Rekebisha kiasi ulichoingiza.</div>`;
    return;
  }
  const shares = Math.floor(amount / KIKOBA_SHARE_PRICE);
  try{
    await db.collection('kikobaShares').add({
      memberId, month, year, shares, amount: shares*KIKOBA_SHARE_PRICE,
      recordedBy: currentUser.uid, recordedAtMillis: Date.now(),
      recordedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgBox.innerHTML = `<div class="msg msg-ok">${shares} share(s) recorded successfully.</div>`;
    await renderKikobaAccountantTab(document.getElementById('accountantContent'));
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

async function disburseKikobaLoan(reqId, memberId, principal){
  const availableCapital = window.__kikobaAvailableCapital || 0;
  if(principal > availableCapital){
    alert("Huwezi kutoa mkopo huu kwa sababu unazidi mtaji uliopo wa Kikoba (TZS " + fmtTZS(Math.round(availableCapital)) + "). Subiri hisa au malipo zaidi ziingie kabla ya kutoa mkopo huu.");
    return;
  }
  if(!confirm("Confirm you are handing over the loan funds now?")) return;
  const totalOwed = Math.round(principal * (1+KIKOBA_LOAN_INTEREST_RATE));
  const dueDateMillis = Date.now() + (KIKOBA_REPAYMENT_MONTHS*30*24*60*60*1000);
  try{
    await db.collection('kikobaLoans').add({
      memberId, principal, totalOwed, amountRepaid:0, status:'active',
      requestId: reqId, disbursedBy: currentUser.uid,
      disbursedAtMillis: Date.now(), dueDateMillis,
      disbursedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('kikobaLoanRequests').doc(reqId).update({ status:'disbursed' });
    await renderKikobaAccountantTab(document.getElementById('accountantContent'));
  }catch(err){
    alert("Error: " + err.message);
  }
}

async function recordKikobaRepayment(loanId){
  const input = document.getElementById('repay_'+loanId);
  const amountPaid = parseFloat(input.value);
  if(!amountPaid || amountPaid<=0){ alert("Enter a valid amount."); return; }
  if(!confirm("Confirm this repayment amount has been received?")) return;
  try{
    await db.runTransaction(async (tx)=>{
      const loanRef = db.collection('kikobaLoans').doc(loanId);
      const loanDoc = await tx.get(loanRef);
      if(!loanDoc.exists) throw new Error("Loan not found.");
      const loan = loanDoc.data();

      const interestPortion = amountPaid * (KIKOBA_LOAN_INTEREST_RATE/(1+KIKOBA_LOAN_INTEREST_RATE));
      const principalPortion = amountPaid - interestPortion;
      const newRepaid = Number(loan.amountRepaid||0) + amountPaid;

      const repayRef = db.collection('kikobaRepayments').doc();
      tx.set(repayRef, {
        loanId, memberId: loan.memberId, amountPaid, interestPortion, principalPortion,
        recordedBy: currentUser.uid, recordedAtMillis: Date.now(),
        recordedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      const updateData = { amountRepaid: newRepaid };
      if(newRepaid >= loan.totalOwed) updateData.status = 'completed';
      tx.update(loanRef, updateData);
    });

    await renderKikobaAccountantTab(document.getElementById('accountantContent'));
  }catch(err){
    alert("Error: " + err.message);
  }
}

async function payKikobaExpense(id){
  if(!confirm("Confirm this Kikoba expense has been paid?")) return;
  await db.collection('kikobaExpenses').doc(id).update({
    status:'paid', paidBy: currentUser.uid, paidAtMillis: Date.now(),
    paidAt: firebase.firestore.FieldValue.serverTimestamp()
  });
  await renderKikobaAccountantTab(document.getElementById('accountantContent'));
}
