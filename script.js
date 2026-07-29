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
const KIKOBA_LOAN_INTEREST_RATE = 0.15;    // 15% flat kwa mzunguko wa miezi 3 (hata akilipa mapema)
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
      showAuthMsg("Wasiliana na  system administrator, taarifa zako hazipo kwenye mfumo.", "error");
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

// Returns list of {month, year} from the fund's start (Nov 2025) through
// the current point in the fund period (e.g. Nov 2025 ... Jul 2026 ... Nov 2026)
function getFundMonthsList(){
  const startVal = FUND_START_YEAR*12 + FUND_START_MONTH;
  const periodEnd = getFundPeriodEnd();
  const endVal = periodEnd.year*12 + periodEnd.month;
  const months = [];
  for(let v=startVal; v<=endVal; v++){
    const year = Math.floor((v-1)/12);
    const month = ((v-1)%12)+1;
    months.push({month, year});
  }
  return months;
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

  const [allPaidReqSnap, allContribSnap, allConfirmedIncomeSnap, currentActiveCountSnap, allPaidExpensesSnap] = await Promise.all([
    db.collection('assistanceRequests').where('status','==','paid').get(),
    db.collection('contributions').where('memberId','==',uid).get(),
    db.collection('extraIncome').where('status','==','confirmed').get(),
    db.collection('members').where('role','==','member').where('status','==','active').get(),
    db.collection('ustawiExpenses').where('status','==','paid').get()
  ]);

  // paidMonths keyed by "year-month" so contributions from any fund year (e.g. Nov/Dec 2025) show up
  const paidMonths = {};
  let totalContributed = 0;
  allContribSnap.forEach(d=>{
    const r = d.data();
    paidMonths[`${r.year}-${r.month}`] = r.amount;
    totalContributed += Number(r.amount||0);
  });

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

  const fundMonths = getFundMonthsList();
  let monthsRows = '';
  fundMonths.forEach(({month:m, year:y})=>{
    const key = `${y}-${m}`;
    const paid = paidMonths.hasOwnProperty(key);
    monthsRows += `<tr>
      <td>${MONTH_NAMES[m-1]} ${y}</td>
      <td class="amount">${paid ? 'TZS '+fmtTZS(paidMonths[key]) : '—'}</td>
      <td>${paid ? '<span class="stamp stamp-paid">Paid</span>' : '<span class="stamp stamp-unpaid">Not Paid</span>'}</td>
    </tr>`;
  });

  const periodEnd = getFundPeriodEnd();
  const periodLabel = `${MONTH_NAMES[FUND_START_MONTH-1]} ${FUND_START_YEAR} – ${MONTH_NAMES[periodEnd.month-1]} ${periodEnd.year}`;

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
        <div class="label">Matumizi</div>
        <div class="value">TZS ${fmtTZS(Math.round(totalUsedShare))}</div>
      </div>
      <div class="stat-card pos">
        <div class="label">Mapato ya nje(E.g pesa kutoka ofisi kuu/zawadi)</div>
        <div class="value">TZS ${fmtTZS(Math.round(incomeBonus))}</div>
      </div>
      <div class="stat-card ${remaining>=0?'pos':'neg'}">
        <div class="label">Salio lako</div>
        <div class="value">TZS ${fmtTZS(Math.round(remaining))}</div>
      </div>
    </div>

    <div class="card">
      <div class="section-title"><h3>Contribution Status — ${periodLabel}</h3></div>
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

  const [myShareSnap, allShareSnap, allRepaySnap, myLoansSnap, allFinesSnap] = await Promise.all([
    db.collection('kikobaShares').where('memberId','==',uid).get(),
    db.collection('kikobaShares').get(),
    db.collection('kikobaRepayments').get(),
    db.collection('kikobaLoans').where('memberId','==',uid).get(),
    db.collection('kikobaFines').get()
  ]);

  let myShares = [];
  let myTotalShares = 0;
  myShareSnap.forEach(d=>{ const s=d.data(); myShares.push(s); myTotalShares += Number(s.shares||0); });
  myShares.sort((a,b)=> (a.year*12+a.month) - (b.year*12+b.month));

  let totalSharesAll = 0;
  allShareSnap.forEach(d=> totalSharesAll += Number(d.data().shares||0));

  // Kikoba's own interest income (excludes any portion owed to an external capital source)
  let totalIncomeAll = 0;
  allRepaySnap.forEach(d=>{
    const r = d.data();
    totalIncomeAll += (r.internalInterestPortion !== undefined) ? Number(r.internalInterestPortion||0) : Number(r.interestPortion||0);
  });
  // Fines also feed into the Kikoba income pool used to grow share value
  allFinesSnap.forEach(d=> totalIncomeAll += Number(d.data().amount||0));

  const currentShareValue = totalSharesAll > 0 ? (totalIncomeAll / totalSharesAll) : 0;
  const myTotalValue = myTotalShares * currentShareValue;

  let sharesRows = '';
  myShares.forEach(s=>{
    sharesRows += `<tr><td>${MONTH_NAMES[s.month-1]} ${s.year}</td><td class="amount">${s.shares} shares</td><td class="amount">TZS ${fmtTZS(s.shares*KIKOBA_SHARE_PRICE)}</td></tr>`;
  });
  if(!sharesRows) sharesRows = `<tr><td colspan="3" class="empty-state">No hisa purchased yet.</td></tr>`;

  // Full loan history for this member (all statuses), newest first
  let myLoans = [];
  myLoansSnap.forEach(d=> myLoans.push({id:d.id, ...d.data()}));
  myLoans.sort((a,b)=>{
    const av = (a.year||0)*12+(a.month||0);
    const bv = (b.year||0)*12+(b.month||0);
    if(av!==bv) return bv-av;
    return (b.disbursedAtMillis||0)-(a.disbursedAtMillis||0);
  });

  let loanRows = myLoans.map(loan=>{
    const remaining = Number(loan.totalOwed||0) - Number(loan.amountRepaid||0);
    const monthLabel = loan.month ? `${MONTH_NAMES[loan.month-1]} ${loan.year}` : '—';
    const statusHtml = loan.status === 'completed'
      ? '<span class="stamp stamp-paid">Imelipwa Yote</span>'
      : '<span class="stamp stamp-pending">Inaendelea</span>';
    const renewalNote = loan.renewalCount
      ? ` <span style="font-size:0.7rem; color:var(--ink-soft);">(Imeongezwa muda ${loan.renewalCount}x)</span>`
      : '';
    return `<tr>
      <td>${monthLabel}</td>
      <td class="amount">TZS ${fmtTZS(loan.principal)}</td>
      <td class="amount">TZS ${fmtTZS(loan.amountRepaid||0)}</td>
      <td class="amount">TZS ${fmtTZS(remaining)}</td>
      <td>${statusHtml}${renewalNote}</td>
    </tr>`;
  }).join('');
  if(!loanRows) loanRows = `<tr><td colspan="5" class="empty-state">Hauna Mkopo wowote.</td></tr>`;

  container.innerHTML = `
    <div class="grid grid-3" style="margin-bottom:24px;">
      <div class="stat-card">
        <div class="label">Jumla ya Hisa ulizonazo</div>
        <div class="value">${myTotalShares} hisa</div>
      </div>
      <div class="stat-card pos">
        <div class="label">Thamani ya Hisa moja mpaka sasa</div>
        <div class="value">TZS ${fmtTZS(Math.round(currentShareValue))}</div>
      </div>
      <div class="stat-card pos">
        <div class="label">Faida(gawio)</div>
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

    <div class="card">
      <div class="section-title"><h3>History ya Mikopo yako uliokopa(Kikoba)</h3></div>
      <table>
        <thead><tr><th>Month</th><th>Kiasi ulichokopa</th><th>Ulicholipa</th><th>Deni linalodaiwa</th><th>Hali</th></tr></thead>
        <tbody>${loanRows}</tbody>
      </table>
    </div>
  `;
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
            <select id="reqMember">${options}</option>
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
            <label>Payout Amount (TZS)</label>
            <input type="number" id="reqAmount" placeholder="e.g. 100000" value="${ASSISTANCE_AMOUNT}">
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
  const amount = parseFloat(document.getElementById('reqAmount').value);

  if(!memberId || !eventDate){
    msgBox.innerHTML = `<div class="msg msg-error">Select Mwanachama na Tarehe ya tukio kutokea.</div>`;
    return;
  }
  if(!amount || amount <= 0){
    msgBox.innerHTML = `<div class="msg msg-error">Weka kiasi sahihi cha malipo.</div>`;
    return;
  }

  const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');
  const membersCountAtTime = activeMembers.length;

  try{
    await db.collection('assistanceRequests').add({
      memberId: memberId,
      type: type,
      description: desc,
      amount: amount,
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
    document.getElementById('reqAmount').value = ASSISTANCE_AMOUNT;
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
        <div class="label">Mapato (E.g Nyongeza kutoka ofisi kuu/zawadi )</div>
        <div class="value">TZS ${fmtTZS(totalIncomeAll)}</div>
      </div>
      <div class="stat-card neg">
        <div class="label">Matumizi</div>
        <div class="value">TZS ${fmtTZS(totalPaidOutAll)}</div>
      </div>
      <div class="stat-card ${fundBalanceTop>=0?'pos':'neg'}">
        <div class="label">Salio la Ustawi</div>
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
        Ripoti hii inajumuisha kuanzia mwanzo wa uchangiaji mpaka sasa.
      </p>
      <button class="btn btn-primary" onclick="generateAnnualPDF()">Download PDF (Fund Year)</button>
    `;
  }
}

async function generateMonthlyPDF(){
  const month = parseInt(document.getElementById('repMonth').value);
  const year = parseInt(document.getElementById('repYear').value);

  const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');

  const [contribSnap, paidReqSnap, confirmedIncomeSnap, paidExpSnap] = await Promise.all([
    db.collection('contributions').where('month','==',month).where('year','==',year).get(),
    db.collection('assistanceRequests').where('status','==','paid').get(),
    db.collection('extraIncome').where('status','==','confirmed').get(),
    db.collection('ustawiExpenses').where('status','==','paid').get()
  ]);

  const paidMap = {};
  let totalCollected = 0;
  contribSnap.forEach(d=>{
    const r = d.data();
    paidMap[r.memberId] = r.amount;
    totalCollected += Number(r.amount||0);
  });

  function inMonth(millis){
    if(!millis) return false;
    const d = new Date(millis);
    return (d.getMonth()+1)===month && d.getFullYear()===year;
  }

  const monthPayouts = [];
  paidReqSnap.forEach(d=>{
    const r = d.data();
    if(inMonth(r.paidAtMillis)){
      const member = allMembersCache.find(m=>m.id===r.memberId);
      monthPayouts.push({ name: member?member.name:'—', type: EVENT_TYPES[r.type]||r.type, amount: r.amount });
    }
  });

  const monthIncome = [];
  confirmedIncomeSnap.forEach(d=>{
    const inc = d.data();
    if(inMonth(inc.confirmedAtMillis)){
      monthIncome.push({ desc: inc.description, amount: inc.amount });
    }
  });

  const monthExpenses = [];
  paidExpSnap.forEach(d=>{
    const e = d.data();
    if(inMonth(e.paidAtMillis)){
      monthExpenses.push({ desc: e.description, amount: e.amount });
    }
  });

  const totalPayoutsMonth = monthPayouts.reduce((s,p)=>s+Number(p.amount||0),0);
  const totalIncomeMonth = monthIncome.reduce((s,i)=>s+Number(i.amount||0),0);
  const totalExpensesMonth = monthExpenses.reduce((s,e)=>s+Number(e.amount||0),0);

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Mfuko wa Ustawi wa Jamii", 14, 18);
  doc.setFontSize(11);
  doc.text("Kidegembye Secondary School", 14, 25);
  doc.setFontSize(13);
  doc.text(`Monthly Report - ${MONTH_NAMES[month-1]} ${year}`, 14, 34);

  doc.setFontSize(11);
  let y = 44;
  doc.text(`Jumla Makusanyo ya Mwezi: TZS ${fmtTZS(totalCollected)}`, 14, y); y+=6;
  doc.text(`Jumla Malipo (Payouts) ya Mwezi: TZS ${fmtTZS(totalPayoutsMonth)}`, 14, y); y+=6;
  doc.text(`Jumla Matumizi (Expenses) ya Mwezi: TZS ${fmtTZS(totalExpensesMonth)}`, 14, y); y+=6;
  doc.text(`Jumla Income Nyingine ya Mwezi: TZS ${fmtTZS(totalIncomeMonth)}`, 14, y); y+=10;

  const memberRows = activeMembers.map(m=>[
    m.name,
    paidMap.hasOwnProperty(m.id) ? 'Paid' : 'Not Paid',
    paidMap.hasOwnProperty(m.id) ? `TZS ${fmtTZS(paidMap[m.id])}` : '-'
  ]);

  doc.autoTable({
    startY: y,
    head: [['Jina', 'Hali', 'Kiasi']],
    body: memberRows.length ? memberRows : [['-','-','-']],
    theme: 'grid',
    headStyles: { fillColor: [40,40,40] }
  });

  let afterTableY = doc.lastAutoTable.finalY + 10;

  if(monthPayouts.length){
    doc.text("Malipo (Payouts) ya Mwezi Huu", 14, afterTableY);
    doc.autoTable({
      startY: afterTableY+4,
      head: [['Mnufaika','Aina','Kiasi']],
      body: monthPayouts.map(p=>[p.name, p.type, `TZS ${fmtTZS(p.amount)}`]),
      theme: 'grid'
    });
    afterTableY = doc.lastAutoTable.finalY + 10;
  }

  if(monthExpenses.length){
    doc.text("Matumizi ya Mwezi Huu", 14, afterTableY);
    doc.autoTable({
      startY: afterTableY+4,
      head: [['Maelezo','Kiasi']],
      body: monthExpenses.map(e=>[e.desc, `TZS ${fmtTZS(e.amount)}`]),
      theme: 'grid'
    });
    afterTableY = doc.lastAutoTable.finalY + 10;
  }

  if(monthIncome.length){
    doc.text("Income Nyingine ya Mwezi Huu", 14, afterTableY);
    doc.autoTable({
      startY: afterTableY+4,
      head: [['Chanzo','Kiasi']],
      body: monthIncome.map(i=>[i.desc, `TZS ${fmtTZS(i.amount)}`]),
      theme: 'grid'
    });
  }

  doc.save(`Ustawi_Report_${MONTH_NAMES[month-1]}_${year}.pdf`);
}

async function generateAnnualPDF(){
  const periodEnd = getFundPeriodEnd();
  const activeMembers = allMembersCache.filter(m=>m.role==='member' && m.status==='active');

  const [allContribSnap, paidReqSnap, confirmedIncomeSnap, paidExpSnap] = await Promise.all([
    db.collection('contributions').get(),
    db.collection('assistanceRequests').where('status','==','paid').get(),
    db.collection('extraIncome').where('status','==','confirmed').get(),
    db.collection('ustawiExpenses').where('status','==','paid').get()
  ]);

  const perMemberTotal = {};
  let totalContributed = 0;
  allContribSnap.forEach(d=>{
    const r = d.data();
    if(!isInFundPeriod(r.month, r.year, periodEnd)) return;
    perMemberTotal[r.memberId] = (perMemberTotal[r.memberId]||0) + Number(r.amount||0);
    totalContributed += Number(r.amount||0);
  });

  const payoutRows = [];
  let totalPayouts = 0;
  paidReqSnap.forEach(d=>{
    const r = d.data();
    const member = allMembersCache.find(m=>m.id===r.memberId);
    payoutRows.push([member?member.name:'—', EVENT_TYPES[r.type]||r.type, r.eventDate||'-', `TZS ${fmtTZS(r.amount)}`]);
    totalPayouts += Number(r.amount||0);
  });

  const expenseRows = [];
  let totalExpenses = 0;
  paidExpSnap.forEach(d=>{
    const e = d.data();
    expenseRows.push([e.description, `TZS ${fmtTZS(e.amount)}`]);
    totalExpenses += Number(e.amount||0);
  });

  const incomeRows = [];
  let totalIncome = 0;
  confirmedIncomeSnap.forEach(d=>{
    const inc = d.data();
    incomeRows.push([inc.description, `TZS ${fmtTZS(inc.amount)}`]);
    totalIncome += Number(inc.amount||0);
  });

  const fundBalance = totalContributed + totalIncome - totalPayouts - totalExpenses;

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text("Mfuko wa Ustawi wa Jamii", 14, 18);
  doc.setFontSize(11);
  doc.text("Kidegembye Secondary School", 14, 25);
  doc.setFontSize(13);
  doc.text(`Fund Year Report - ${MONTH_NAMES[FUND_START_MONTH-1]} ${FUND_START_YEAR} hadi ${MONTH_NAMES[periodEnd.month-1]} ${periodEnd.year}`, 14, 34);

  doc.setFontSize(11);
  let y = 44;
  doc.text(`Jumla Makusanyo (Contributions): TZS ${fmtTZS(totalContributed)}`, 14, y); y+=6;
  doc.text(`Jumla Income Nyingine: TZS ${fmtTZS(totalIncome)}`, 14, y); y+=6;
  doc.text(`Jumla Malipo (Payouts): TZS ${fmtTZS(totalPayouts)}`, 14, y); y+=6;
  doc.text(`Jumla Matumizi (Expenses): TZS ${fmtTZS(totalExpenses)}`, 14, y); y+=6;
  doc.setFont(undefined, 'bold');
  doc.text(`Fund Balance ya Sasa: TZS ${fmtTZS(fundBalance)}`, 14, y); y+=10;
  doc.setFont(undefined, 'normal');

  const memberRows = activeMembers.map(m=>[m.name, `TZS ${fmtTZS(perMemberTotal[m.id]||0)}`]);
  doc.autoTable({
    startY: y,
    head: [['Jina', 'Jumla Alicho Changia']],
    body: memberRows.length ? memberRows : [['-','-']],
    theme: 'grid'
  });
  let afterY = doc.lastAutoTable.finalY + 10;

  if(payoutRows.length){
    doc.text("Malipo (Payouts) Yote", 14, afterY);
    doc.autoTable({ startY: afterY+4, head: [['Mnufaika','Aina','Tarehe','Kiasi']], body: payoutRows, theme:'grid' });
    afterY = doc.lastAutoTable.finalY + 10;
  }
  if(expenseRows.length){
    doc.text("Matumizi Yote", 14, afterY);
    doc.autoTable({ startY: afterY+4, head:[['Maelezo','Kiasi']], body: expenseRows, theme:'grid' });
    afterY = doc.lastAutoTable.finalY + 10;
  }
  if(incomeRows.length){
    doc.text("Income Nyingine Yote", 14, afterY);
    doc.autoTable({ startY: afterY+4, head:[['Chanzo','Kiasi']], body: incomeRows, theme:'grid' });
  }

  doc.save(`Ustawi_FundYear_Report_${FUND_START_YEAR}-${periodEnd.year}.pdf`);
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
  if(!confirm("Confirm kiasi hiki umekipokea, then kitajazwa kwenye fund balance (salio)?")) return;
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
  const [allShareSnap, allRepaySnap, allExpPaidSnap, allLoansOutSnap, allFinesSnap, allExternalSnap] = await Promise.all([
    db.collection('kikobaShares').get(),
    db.collection('kikobaRepayments').get(),
    db.collection('kikobaExpenses').where('status','==','paid').get(),
    db.collection('kikobaLoans').get(),
    db.collection('kikobaFines').get(),
    db.collection('kikobaExternalCapital').get()
  ]);
  let totalShares = 0; allShareSnap.forEach(d=> totalShares += Number(d.data().shares||0));

  // Only count Kikoba's OWN share of interest as income — the portion of interest
  // that belongs to an external capital source is excluded here (it is tracked
  // separately and paid back to that source, not kept as Kikoba income).
  let totalInterestIncome = 0;
  allRepaySnap.forEach(d=>{
    const r = d.data();
    totalInterestIncome += (r.internalInterestPortion !== undefined)
      ? Number(r.internalInterestPortion||0)
      : Number(r.interestPortion||0);
  });

  let totalFines = 0; allFinesSnap.forEach(d=> totalFines += Number(d.data().amount||0));

  let totalExpensesPaid = 0; allExpPaidSnap.forEach(d=> totalExpensesPaid += Number(d.data().amount||0));

  const totalIncome = totalInterestIncome + totalFines;
  const kikobaBalance = totalIncome - totalExpensesPaid;
  const shareValue = totalShares > 0 ? totalIncome/totalShares : 0;

  // External capital currently outstanding (owed back to sources outside Kikoba)
  let externalOutstanding = 0;
  allExternalSnap.forEach(d=>{
    const e = d.data();
    if(e.status === 'active'){
      externalOutstanding += Math.max(0, Number(e.totalOwed||0) - Number(e.amountRepaid||0));
    }
  });
  window.__kikobaExternalOutstanding = externalOutstanding;

  // Available capital = share capital + net income, minus the portion of active loans
  // that was funded from Kikoba's OWN capital (internalPrincipal). Money funded
  // externally is not "ours" to begin with, so it doesn't reduce our own available pool.
  const shareCapital = totalShares * KIKOBA_SHARE_PRICE;
  let principalOutstanding = 0;
  allLoansOutSnap.forEach(d=>{
    const loan = d.data();
    if(loan.status === 'active'){
      const remaining = Math.max(0, Number(loan.totalOwed||0) - Number(loan.amountRepaid||0));
      const internalRatio = loan.principal ? ((loan.internalPrincipal !== undefined ? loan.internalPrincipal : loan.principal) / loan.principal) : 1;
      principalOutstanding += remaining * internalRatio;
    }
  });
  const availableCapital = (shareCapital + kikobaBalance) - principalOutstanding;
  window.__kikobaAvailableCapital = availableCapital; // used by the give-loan form

  c.innerHTML = `
    <div class="grid grid-3" style="margin-bottom:20px;">
      <div class="stat-card"><div class="label">Jumla ya Hisa</div><div class="value">${totalShares}</div></div>
      <div class="stat-card pos"><div class="label"> Thamani ya Hisa moja mpaka sasa</div><div class="value">TZS ${fmtTZS(Math.round(shareValue))}</div></div>
      <div class="stat-card ${kikobaBalance>=0?'pos':'neg'}"><div class="label">Faida (Riba)</div><div class="value">TZS ${fmtTZS(kikobaBalance)}</div></div>
      <div class="stat-card ${availableCapital>=0?'pos':'neg'}"><div class="label">Mtaji uliopo (Salio)</div><div class="value">TZS ${fmtTZS(Math.round(availableCapital))}</div></div>
      <div class="stat-card neg"><div class="label">Mtaji wa Nje </div><div class="value">TZS ${fmtTZS(Math.round(externalOutstanding))}</div></div>
      <div class="stat-card pos"><div class="label">Jumla Faini Zilizokusanywa</div><div class="value">TZS ${fmtTZS(totalFines)}</div></div>
    </div>
    <div class="tabs-row" style="margin-bottom:18px;">
      <button class="tab-btn ${kikobaAccountantSubTab==='kshares'?'active':''}" onclick="switchKikobaAccountantSubTab('kshares')">Record Hisa</button>
      <button class="tab-btn ${kikobaAccountantSubTab==='kdisburse'?'active':''}" onclick="switchKikobaAccountantSubTab('kdisburse')">Toa mkopo</button>
      <button class="tab-btn ${kikobaAccountantSubTab==='krepay'?'active':''}" onclick="switchKikobaAccountantSubTab('krepay')">Record Marejesho</button>
      <button class="tab-btn ${kikobaAccountantSubTab==='kfines'?'active':''}" onclick="switchKikobaAccountantSubTab('kfines')">Faini</button>
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

    const now = new Date();
    if(typeof kikobaShareFilterMonth === 'undefined' || kikobaShareFilterMonth === null) kikobaShareFilterMonth = now.getMonth()+1;
    if(typeof kikobaShareFilterYear === 'undefined' || kikobaShareFilterYear === null) kikobaShareFilterYear = now.getFullYear();

    const filterMonthOptions = ['<option value="all">Miezi Yote</option>']
      .concat(KIKOBA_MONTH_NAMES_SW.map((name,i)=>`<option value="${i+1}" ${kikobaShareFilterMonth==(i+1)?'selected':''}>${name}</option>`))
      .join('');

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

      <div class="card" style="margin-top:20px;">
        <div class="section-title"><h3>Manunuzi ya Hisa Yaliyorekodiwa</h3></div>
        <div class="form-row">
          <div class="field">
            <label>Chuja kwa Mwezi</label>
            <select id="kshareFilterMonth" onchange="onKikobaShareFilterChange()">${filterMonthOptions}</select>
          </div>
          <div class="field">
            <label>Mwaka</label>
            <select id="kshareFilterYear" onchange="onKikobaShareFilterChange()">${yearOptions}</select>
          </div>
        </div>
        <div class="form-row" style="margin:6px 0 16px; align-items:flex-end;">
          <div class="field" style="max-width:260px;">
            <label>Mwaka wa Fedha (kwa PDF)</label>
            <select id="kshareFiscalYear">${kikobaFiscalYearOptionsHTML()}</select>
          </div>
          <div class="field" style="flex:0;">
            <button class="btn btn-outline" onclick="downloadKikobaSharesYearlyPDF()"> Download PDF — Mwaka wa Fedha</button>
          </div>
        </div>
        <div id="kshareRecordsTable">Inapakia...</div>
      </div>
    `;

    await renderKikobaShareRecordsTable();
  }

  else if(kikobaAccountantSubTab === 'kdisburse'){
    await fetchKikobaMembers();
    const kMembers = allMembersCache.filter(m=> isKikobaActiveMember(m.id));
    const options = kMembers.map(m=>`<option value="${m.id}">${escapeHTML(m.name)}</option>`).join('');
    const { yearOptions, monthOptions } = yearMonthOptionsHTML();
    const availableCapital = window.__kikobaAvailableCapital || 0;

    box.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Toa Mkopo Mpya</h3></div>
        <p style="font-size:0.78rem; color:var(--ink-soft); margin-bottom:12px;">
          Chagua mwanachama aliyekuja physically kuomba mkopo, jaza mwezi na kiasi. Riba ni 15% flat
          kwa mzunguko wa miezi 3 — hata akilipa ndani ya mwezi mmoja bado atalipa riba hiyo hiyo ya 15%.
          Mtaji uliopo kwa sasa: <strong>TZS ${fmtTZS(Math.round(availableCapital))}</strong>.
        </p>
        <div id="kloanMsg"></div>
        <div class="form-row">
          <div class="field"><label>Member</label><select id="kloanMember">${options || '<option>Hakuna Kikoba members</option>'}</select></div>
          <div class="field"><label>Month</label><select id="kloanMonth">${monthOptions}</select></div>
          <div class="field"><label>Year</label><select id="kloanYear">${yearOptions}</select></div>
        </div>
        <div class="field" style="max-width:220px;">
          <label>Kiasi anachokopa (TZS)</label>
          <input type="number" id="kloanPrincipal" placeholder="e.g. 100000" oninput="updateKikobaLoanPreview()">
        </div>
        <p id="kloanPreview" style="font-size:0.85rem; color:var(--ink-soft); margin-bottom:14px;">
          Jaza kiasi kuona jumla ya kulipa (kiasi + riba 15%).
        </p>
        <div id="kloanExternalWrap" class="field hidden" style="max-width:340px; border:1.5px dashed var(--red); border-radius:var(--radius-sm); padding:14px;">
          <label>Chanzo cha Mtaji wa Nyongeza (nje ya Kikoba)</label>
          <input type="text" id="kloanExternalSource" placeholder="mfano: Imetolewa kwenye ustawi">
          <p style="font-size:0.72rem; color:var(--ink-soft); margin-top:6px;">
            Kiasi hiki kitafuatiliwa kama deni la Kikoba kwa chanzo hicho, na kitarudishwa kikiwa na riba 15% pindi mwanachama atakapolipa mkopo wake.
          </p>
        </div>
        <button class="btn btn-primary" onclick="giveKikobaLoan()">Thibitisha na Toa Mkopo</button>
      </div>

      <div class="card" style="margin-top:20px; border:1.5px dashed var(--red);">
        <div class="section-title"><h3>Ongeza Deni la Nyuma (Mtaji wa Nje - Historical)</h3></div>
        <p style="font-size:0.78rem; color:var(--ink-soft); margin-bottom:14px;">
          Tumia hii kurekodi mtaji wa nje uliochukuliwa huko nyuma (mfano kabla ya mfumo huu kuanza kutumika),
          ambao haukuhusiana na mkopo maalum wa mwanachama mmoja. Hii haitatengeneza mkopo wowote wa mwanachama —
          itaongeza tu deni la jumla la Kikoba kwa chanzo hicho.
        </p>
        <div id="histExtMsg"></div>
        <div class="form-row">
          <div class="field">
            <label>Chanzo cha Mtaji</label>
            <input type="text" id="histExtSource" placeholder="mfano: Ilitolewa na Ustawi Novemba 2025">
          </div>
          <div class="field">
            <label>Tarehe Ilipochukuliwa</label>
            <input type="date" id="histExtDate">
          </div>
        </div>
        <div class="form-row">
          <div class="field">
            <label>Kiasi Kilichochukuliwa (TZS)</label>
            <input type="number" id="histExtPrincipal" placeholder="e.g. 100000" oninput="updateHistExtPreview()">
          </div>
          <div class="field">
            <label>Kiasi Kilichokwisha Rudishwa (TZS)</label>
            <input type="number" id="histExtRepaid" value="0" placeholder="0 kama bado hakuna kilicholipwa">
          </div>
        </div>
        <p id="histExtPreview" style="font-size:0.85rem; color:var(--ink-soft); margin-bottom:14px;">
          Jaza kiasi kuona jumla ya deni (kiasi + riba 15%).
        </p>
        <button class="btn btn-primary" onclick="addHistoricalExternalCapital()">Save Deni la Nyuma</button>
      </div>

      <div class="card" style="margin-top:20px;">
        <div class="section-title"><h3>Historia ya Mtaji wa Nje</h3></div>
        <div id="externalCapitalTable">Uploading...</div>
      </div>
    `;
    await renderExternalCapitalTable();
  }

  else if(kikobaAccountantSubTab === 'krepay'){
    const snap = await db.collection('kikobaLoans').where('status','==','active').get();
    let docs = []; snap.forEach(d=> docs.push({id:d.id, ...d.data()}));
    const now = Date.now();
    let rows = docs.map(loan=>{
      const member = allMembersCache.find(m=>m.id===loan.memberId);
      const remaining = Number(loan.totalOwed||0) - Number(loan.amountRepaid||0);
      const isOverdue = !!(loan.dueDateMillis && now > loan.dueDateMillis);
      const overdueTag = isOverdue ? `<div class="stamp stamp-overdue" style="margin-top:6px;">⚠ Muda Umepita (Miezi 3)</div>` : '';
      const renewalTag = loan.renewalCount ? `<div style="font-size:0.7rem; color:var(--ink-soft); margin-top:4px;">Imeongezwa muda: ${loan.renewalCount}x</div>` : '';
      const renewBtn = isOverdue ? `<button class="btn btn-outline btn-sm" style="margin-top:8px;" onclick="renewOverdueKikobaLoan('${loan.id}')">Panga Upya Mkopo (hamisha) (+15%)</button>` : '';
      return `<tr>
        <td>${member?escapeHTML(member.name):'—'}${overdueTag}${renewalTag}</td>
        <td class="amount">TZS ${fmtTZS(loan.totalOwed)}</td>
        <td class="amount">TZS ${fmtTZS(loan.amountRepaid||0)}</td>
        <td class="amount">TZS ${fmtTZS(remaining)}</td>
        <td>
          <input type="number" id="repay_${loan.id}" placeholder="Amount handed over" style="width:130px; padding:8px; border:1px solid var(--line); border-radius:8px;">
          <button class="btn btn-primary btn-sm" onclick="recordKikobaRepayment('${loan.id}')">Confirm</button>
          ${renewBtn}
        </td>
      </tr>`;
    }).join('');
    if(!rows) rows = `<tr><td colspan="5" class="empty-state">No active loans.</td></tr>`;
    box.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Active Loans — Record Rejesho</h3></div>
        <p style="font-size:0.78rem; color:var(--ink-soft); margin-bottom:12px;">
          Mkopo ukikaa zaidi ya miezi 3 bila kulipwa wote, utaonekana na alama "⚠ Muda Umepita". Bonyeza
          "Panga Upya Mkopo" kuongeza riba mpya ya 15% kwenye kiasi kilichobaki na kuweka muda mpya wa miezi 3.
        </p>
        <table><thead><tr><th>Member</th><th>Jumla ya mkopo</th><th>Repaid</th><th>Remaining</th><th>Record Rejesho</th></tr></thead><tbody>${rows}</tbody></table>
      </div>
    `;
  }

  else if(kikobaAccountantSubTab === 'kfines'){
    await fetchKikobaMembers();
    const kMembers = allMembersCache.filter(m=> isKikobaActiveMember(m.id));
    const options = kMembers.map(m=>`<option value="${m.id}">${escapeHTML(m.name)}</option>`).join('');

    box.innerHTML = `
      <div class="card">
        <div class="section-title"><h3>Toa Faini kwa Mwanachama</h3></div>
        <p style="font-size:0.78rem; color:var(--ink-soft); margin-bottom:14px;">
          Tumia hii kwa faini za Kikoba (mfano: kuchelewa mkutano au michango). Faini zote huongezwa
          moja kwa moja kwenye Kikoba income na hutumika kuzalisha mtaji zaidi wa mikopo.
        </p>
        <div id="kfineMsg"></div>
        <div class="form-row">
          <div class="field"><label>Mwanachama</label><select id="kfineMember">${options || '<option>Hakuna Kikoba members</option>'}</select></div>
          <div class="field" style="max-width:220px;"><label>Kiasi cha Faini (TZS)</label><input type="number" id="kfineAmount" placeholder="e.g. 2000"></div>
        </div>
        <div class="field">
          <label>Sababu</label>
          <textarea id="kfineReason" rows="2" placeholder="mfano: Kuchelewa kwenye kikundi cha Kikoba"></textarea>
        </div>
        <button class="btn btn-primary" onclick="recordKikobaFine()">Save Faini</button>
      </div>
      <div class="card">
        <div class="section-title"><h3>Historia ya Faini</h3></div>
        <div id="kfineHistoryTable">Uploading...</div>
      </div>
    `;
    await renderKikobaFineHistoryTable();
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

const KIKOBA_MONTH_NAMES_SW = ['Januari','Februari','Machi','Aprili','Mei','Juni','Julai','Agosti','Septemba','Oktoba','Novemba','Desemba'];
let kikobaShareFilterMonth = new Date().getMonth()+1;
let kikobaShareFilterYear = new Date().getFullYear();

// Mwaka wa Fedha: Novemba (mwaka X) mpaka Novemba (mwaka X+1), miezi 13 jumla.
let kikobaShareFiscalYearStart = (function(){
  const now = new Date();
  const m = now.getMonth()+1; // 1-12
  const y = now.getFullYear();
  return (m >= 11) ? y : y - 1; // ikiwa tupo Nov/Dec, mwaka wa fedha unaanza mwaka huu; vinginevyo ulianza mwaka jana
})();

function kikobaFiscalYearOptionsHTML(){
  const currentGuess = (function(){
    const now = new Date();
    const m = now.getMonth()+1, y = now.getFullYear();
    return (m >= 11) ? y : y - 1;
  })();
  const startYears = [];
  for(let y = currentGuess - 3; y <= currentGuess + 1; y++) startYears.push(y);
  return startYears.map(y=>{
    const selected = (y === kikobaShareFiscalYearStart) ? 'selected' : '';
    return `<option value="${y}" ${selected}>${y}/${y+1}  (Nov ${y} \u2013 Nov ${y+1})</option>`;
  }).join('');
}

function onKikobaShareFilterChange(){
  const monthSel = document.getElementById('kshareFilterMonth');
  const yearSel = document.getElementById('kshareFilterYear');
  kikobaShareFilterMonth = monthSel.value === 'all' ? 'all' : parseInt(monthSel.value);
  kikobaShareFilterYear = parseInt(yearSel.value);
  renderKikobaShareRecordsTable();
}

async function renderKikobaShareRecordsTable(){
  const box = document.getElementById('kshareRecordsTable');
  if(!box) return;
  box.innerHTML = 'Inapakia...';

  let query = db.collection('kikobaShares').where('year','==', kikobaShareFilterYear);
  if(kikobaShareFilterMonth !== 'all'){
    query = query.where('month','==', kikobaShareFilterMonth);
  }
  const snap = await query.get();
  let docs = []; snap.forEach(d=> docs.push({id:d.id, ...d.data()}));

  // sort: month asc
  docs.sort((a,b)=> (a.month - b.month) || 0);

  let rows = docs.map(rec=>{
    const member = allMembersCache.find(m=>m.id===rec.memberId);
    const memberName = member ? escapeHTML(member.name) : '—';
    const monthName = KIKOBA_MONTH_NAMES_SW[rec.month-1] || rec.month;
    return `<tr>
      <td>${memberName}</td>
      <td>${monthName} ${rec.year}</td>
      <td class="amount">TZS ${fmtTZS(rec.amount)}</td>
      <td>${rec.shares}</td>
      <td><button class="btn btn-danger btn-sm" onclick="deleteKikobaShareRecord('${rec.id}')">Delete</button></td>
    </tr>`;
  }).join('');

  if(!rows) rows = `<tr><td colspan="5" class="empty-state">Hakuna record za hisa kwa kipindi hiki.</td></tr>`;

  box.innerHTML = `
    <table>
      <thead><tr><th>Member</th><th>Mwezi</th><th>Kiasi</th><th>Hisa</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function deleteKikobaShareRecord(id){
  if(!confirm('Una uhakika unataka kufuta record hii ya hisa? Kitendo hiki hakiwezi kurudishwa.')) return;
  try{
    await db.collection('kikobaShares').doc(id).delete();
    await renderKikobaAccountantTab(document.getElementById('accountantContent'));
  }catch(err){
    alert('Error: ' + err.message);
  }
}

async function downloadKikobaSharesYearlyPDF(){
  const fiscalStartYear = parseInt(document.getElementById('kshareFiscalYear').value);
  const fiscalEndYear = fiscalStartYear + 1;

  // Mwaka wa fedha = Nov+Des ya fiscalStartYear, kisha Jan-Nov ya fiscalEndYear (miezi 13).
  const [snapStart, snapEnd] = await Promise.all([
    db.collection('kikobaShares').where('year','==', fiscalStartYear).where('month','in',[11,12]).get(),
    db.collection('kikobaShares').where('year','==', fiscalEndYear).where('month','in',[1,2,3,4,5,6,7,8,9,10,11]).get()
  ]);

  let docs = [];
  snapStart.forEach(d=> docs.push({id:d.id, ...d.data()}));
  snapEnd.forEach(d=> docs.push({id:d.id, ...d.data()}));

  if(docs.length === 0){
    alert(`Hakuna record za hisa kwa mwaka wa fedha ${fiscalStartYear}/${fiscalEndYear}`);
    return;
  }

  // Mpangilio wa miezi ya mwaka wa fedha: Nov(mwaka1)=0, Des(mwaka1)=1, Jan(mwaka2)=2 ... Nov(mwaka2)=12
  const fiscalOrder = (rec)=> (rec.year === fiscalStartYear) ? (rec.month - 11) : (rec.month + 1);

  docs.sort((a,b)=>{
    const oa = fiscalOrder(a), ob = fiscalOrder(b);
    if(oa !== ob) return oa - ob;
    const ma = allMembersCache.find(m=>m.id===a.memberId);
    const mb = allMembersCache.find(m=>m.id===b.memberId);
    return (ma?.name||'').localeCompare(mb?.name||'');
  });

  const body = docs.map(rec=>{
    const member = allMembersCache.find(m=>m.id===rec.memberId);
    return [
      member ? member.name : '—',
      `${KIKOBA_MONTH_NAMES_SW[rec.month-1] || rec.month} ${rec.year}`,
      'TZS ' + fmtTZS(rec.amount),
      String(rec.shares)
    ];
  });

  const totalAmount = docs.reduce((sum,r)=> sum + Number(r.amount||0), 0);
  const totalShares = docs.reduce((sum,r)=> sum + Number(r.shares||0), 0);
  body.push(['JUMLA', '', 'TZS ' + fmtTZS(totalAmount), String(totalShares)]);

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();
  pdf.setFontSize(14);
  pdf.text(`Ripoti ya Hisa za Kikoba — Mwaka wa Fedha ${fiscalStartYear}/${fiscalEndYear}`, 14, 16);
  pdf.setFontSize(10);
  pdf.text(`(Novemba ${fiscalStartYear} \u2013 Novemba ${fiscalEndYear}) \u2014 Kidegembye Secondary School`, 14, 22);

  pdf.autoTable({
    startY: 28,
    head: [['Jina', 'Mwezi', 'Kiasi', 'Hisa']],
    body: body,
    styles: { fontSize: 9 },
    headStyles: { fillColor: [40, 60, 90] }
  });

  pdf.save(`Hisa_Kikoba_MwakaFedha_${fiscalStartYear}-${fiscalEndYear}.pdf`);
}

function updateKikobaLoanPreview(){
  const box = document.getElementById('kloanPreview');
  if(!box) return;
  const amountInput = document.getElementById('kloanPrincipal');
  const amount = amountInput ? parseFloat(amountInput.value) : NaN;
  const externalWrap = document.getElementById('kloanExternalWrap');

  if(!amount || amount<=0){
    box.textContent = "Jaza kiasi kuona jumla ya kulipa (kiasi + riba 15%).";
    if(externalWrap) externalWrap.classList.add('hidden');
    return;
  }

  const totalOwed = Math.round(amount * (1+KIKOBA_LOAN_INTEREST_RATE));
  const interestAmount = totalOwed - Math.round(amount);
  const availableCapital = window.__kikobaAvailableCapital || 0;
  const deficit = Math.max(0, Math.round(amount - availableCapital));

  let html = `Riba (15%): <strong>TZS ${fmtTZS(interestAmount)}</strong> &nbsp;|&nbsp; Jumla ya Kulipa: <strong>TZS ${fmtTZS(totalOwed)}</strong>`;

  if(deficit > 0){
    html += `<br><span style="color:var(--red); font-weight:700;">⚠ Mtaji wa Kikoba haitoshi kwa TZS ${fmtTZS(deficit)} — jaza chanzo cha mtaji wa nyongeza hapa chini ili kuendelea.</span>`;
    if(externalWrap) externalWrap.classList.remove('hidden');
  } else {
    if(externalWrap) externalWrap.classList.add('hidden');
  }

  box.innerHTML = html;
}

async function giveKikobaLoan(){
  const msgBox = document.getElementById('kloanMsg');
  const memberId = document.getElementById('kloanMember').value;
  const month = parseInt(document.getElementById('kloanMonth').value);
  const year = parseInt(document.getElementById('kloanYear').value);
  const principal = parseFloat(document.getElementById('kloanPrincipal').value);
  const externalSourceInput = document.getElementById('kloanExternalSource');
  const externalSource = externalSourceInput ? externalSourceInput.value.trim() : '';

  if(!memberId || !principal || principal<=0){
    msgBox.innerHTML = `<div class="msg msg-error">Chagua mwanachama na weka kiasi sahihi.</div>`;
    return;
  }

  const availableCapital = window.__kikobaAvailableCapital || 0;
  const deficit = Math.max(0, Math.round(principal - availableCapital));

  if(deficit > 0 && !externalSource){
    msgBox.innerHTML = `<div class="msg msg-error">Mtaji wa Kikoba haitoshi kwa TZS ${fmtTZS(deficit)}. Tafadhali jaza "Chanzo cha Mtaji wa Nyongeza" ili kuendelea.</div>`;
    return;
  }
  try{
    const totalOwed = Math.round(principal * (1+KIKOBA_LOAN_INTEREST_RATE));
    let confirmMsg = `Thibitisha: unatoa mkopo wa TZS ${fmtTZS(principal)}, jumla ya kulipa TZS ${fmtTZS(totalOwed)} (riba 15%).`;
    if(deficit > 0){
      confirmMsg += `\n\nKumbuka: TZS ${fmtTZS(deficit)} kati ya kiasi hiki kinatoka kwenye chanzo cha nje (${externalSource}), na kitarudishwa huko kikiwa na riba 15%.`;
    }
    confirmMsg += `\n\nEndelea?`;
    if(!confirm(confirmMsg)) return;

    const dueDateMillis = Date.now() + (KIKOBA_REPAYMENT_MONTHS*30*24*60*60*1000);
    const internalPrincipal = principal - deficit;
    const loanRef = db.collection('kikobaLoans').doc();
    const batch = db.batch();
    let externalCapitalId = null;

    if(deficit > 0){
      const extRef = db.collection('kikobaExternalCapital').doc();
      externalCapitalId = extRef.id;
      const extTotalOwed = Math.round(deficit * (1+KIKOBA_LOAN_INTEREST_RATE));
      batch.set(extRef, {
        loanId: loanRef.id,
        memberId,
        source: externalSource,
        principal: deficit,
        totalOwed: extTotalOwed,
        amountRepaid: 0,
        status: 'active',
        takenBy: currentUser.uid,
        takenAtMillis: Date.now(),
        takenAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    }

    batch.set(loanRef, {
      memberId, principal, totalOwed, amountRepaid:0, status:'active',
      month, year,
      internalPrincipal,
      externalCapitalId,
      renewalCount: 0,
      disbursedBy: currentUser.uid,
      disbursedAtMillis: Date.now(), dueDateMillis,
      disbursedAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    msgBox.innerHTML = `<div class="msg msg-ok">Mkopo umetolewa kikamilifu${deficit>0 ? ' (ikiwa ni pamoja na mtaji wa nje)' : ''}.</div>`;
    const principalInput = document.getElementById('kloanPrincipal');
    if(principalInput) principalInput.value = '';
    if(externalSourceInput) externalSourceInput.value = '';
    await renderKikobaAccountantTab(document.getElementById('accountantContent'));
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

/* =========================================================
   KIKOBA — EXTERNAL CAPITAL HISTORY
   ========================================================= */
async function renderExternalCapitalTable(){
  const box = document.getElementById('externalCapitalTable');
  if(!box) return;
  box.innerHTML = 'Uploading...';

  const snap = await db.collection('kikobaExternalCapital').get();
  let docs = []; snap.forEach(d=> docs.push({id:d.id, ...d.data()}));
  docs.sort((a,b)=> (b.takenAtMillis||0) - (a.takenAtMillis||0));

  let rows = docs.map(e=>{
    const member = allMembersCache.find(m=>m.id===e.memberId);
    const remaining = Math.max(0, Number(e.totalOwed||0) - Number(e.amountRepaid||0));
    const statusHtml = e.status === 'completed'
      ? '<span class="stamp stamp-paid">Imerudishwa Yote</span>'
      : '<span class="stamp stamp-pending">Bado Inadaiwa</span>';
    return `<tr>
      <td>${member?escapeHTML(member.name):'—'}</td>
      <td>${escapeHTML(e.source)}</td>
      <td class="amount">TZS ${fmtTZS(e.principal)}</td>
      <td class="amount">TZS ${fmtTZS(e.totalOwed)}</td>
      <td class="amount">TZS ${fmtTZS(remaining)}</td>
      <td>${statusHtml}</td>
    </tr>`;
  }).join('');
  if(!rows) rows = `<tr><td colspan="6" class="empty-state">Hakuna mtaji wa nje uliochukuliwa</td></tr>`;

  box.innerHTML = `
    <table>
      <thead><tr><th>Mwanachama</th><th>Chanzo</th><th>Kiasi Kilichochukuliwa</th><th>Jumla ya Kurudisha</th><th>Kinachodaiwa</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* =========================================================
   KIKOBA — HISTORICAL EXTERNAL CAPITAL (backdated, jumla)
   ========================================================= */
function updateHistExtPreview(){
  const box = document.getElementById('histExtPreview');
  if(!box) return;
  const principal = parseFloat(document.getElementById('histExtPrincipal').value);
  if(!principal || principal<=0){
    box.textContent = "Jaza kiasi kuona jumla ya deni (kiasi + riba 15%).";
    return;
  }
  const totalOwed = Math.round(principal * (1+KIKOBA_LOAN_INTEREST_RATE));
  box.innerHTML = `Jumla ya Deni (na riba 15%): <strong>TZS ${fmtTZS(totalOwed)}</strong>`;
}

async function addHistoricalExternalCapital(){
  const msgBox = document.getElementById('histExtMsg');
  const source = document.getElementById('histExtSource').value.trim();
  const dateStr = document.getElementById('histExtDate').value;
  const principal = parseFloat(document.getElementById('histExtPrincipal').value);
  const amountRepaid = parseFloat(document.getElementById('histExtRepaid').value) || 0;

  if(!source){
    msgBox.innerHTML = `<div class="msg msg-error">Andika chanzo cha mtaji.</div>`;
    return;
  }
  if(!principal || principal<=0){
    msgBox.innerHTML = `<div class="msg msg-error">Weka kiasi sahihi kilichochukuliwa.</div>`;
    return;
  }
  if(!dateStr){
    msgBox.innerHTML = `<div class="msg msg-error">Chagua tarehe ilipochukuliwa.</div>`;
    return;
  }

  const totalOwed = Math.round(principal * (1+KIKOBA_LOAN_INTEREST_RATE));
  if(amountRepaid > totalOwed){
    msgBox.innerHTML = `<div class="msg msg-error">Kiasi kilichorudishwa hakiwezi kuzidi jumla ya deni (TZS ${fmtTZS(totalOwed)}).</div>`;
    return;
  }
  const status = amountRepaid >= totalOwed ? 'completed' : 'active';
  const takenAtMillis = new Date(dateStr).getTime();

  if(!confirm(`Thibitisha: unaongeza deni la nyuma la TZS ${fmtTZS(principal)} kutoka "${source}", jumla ya deni TZS ${fmtTZS(totalOwed)}. Endelea?`)) return;

  try{
    await db.collection('kikobaExternalCapital').add({
      loanId: null,
      memberId: null,
      source,
      principal,
      totalOwed,
      amountRepaid,
      status,
      isHistorical: true,
      takenBy: currentUser.uid,
      takenAtMillis,
      takenAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgBox.innerHTML = `<div class="msg msg-ok">Deni la nyuma limerekodiwa kikamilifu.</div>`;
    document.getElementById('histExtSource').value = '';
    document.getElementById('histExtDate').value = '';
    document.getElementById('histExtPrincipal').value = '';
    document.getElementById('histExtRepaid').value = '0';
    document.getElementById('histExtPreview').textContent = "Jaza kiasi kuona jumla ya deni (kiasi + riba 15%).";
    await renderKikobaAccountantTab(document.getElementById('accountantContent'));
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

/* =========================================================
   KIKOBA — OVERDUE LOAN RENEWAL (RE-COMPOUNDING)
   ========================================================= */
async function renewOverdueKikobaLoan(loanId){
  if(!confirm("Mwanachama huyu hajakamilisha kulipa ndani ya miezi 3. Ukiendelea, deni lililobaki litaongezwa riba mpya ya 15% na muda mpya wa miezi 3 utaanza kuhesabiwa kuanzia leo. Endelea?")) return;
  try{
    await db.runTransaction(async (tx)=>{
      const loanRef = db.collection('kikobaLoans').doc(loanId);
      const loanDoc = await tx.get(loanRef);
      if(!loanDoc.exists) throw new Error("Mkopo haukupatikana.");
      const loan = loanDoc.data();
      if(loan.status !== 'active') throw new Error("Mkopo huu si hai tena.");

      let extRef = null, ext = null;
      if(loan.externalCapitalId){
        extRef = db.collection('kikobaExternalCapital').doc(loan.externalCapitalId);
        const extDoc = await tx.get(extRef);
        if(extDoc.exists) ext = extDoc.data();
      }

      const remaining = Math.max(0, Number(loan.totalOwed||0) - Number(loan.amountRepaid||0));
      const newTotalOwed = Math.round(remaining * (1+KIKOBA_LOAN_INTEREST_RATE));
      const newDueDate = Date.now() + (KIKOBA_REPAYMENT_MONTHS*30*24*60*60*1000);

      const renewalEntry = {
        renewedAtMillis: Date.now(),
        oldTotalOwed: loan.totalOwed,
        remainingAtRenewal: remaining,
        newTotalOwed: newTotalOwed
      };
      const history = Array.isArray(loan.renewalHistory) ? loan.renewalHistory.slice() : [];
      history.push(renewalEntry);

      tx.update(loanRef, {
        totalOwed: newTotalOwed,
        amountRepaid: 0,
        dueDateMillis: newDueDate,
        renewalCount: (loan.renewalCount||0) + 1,
        renewalHistory: history
      });

      if(extRef && ext && ext.status === 'active'){
        const extRemaining = Math.max(0, Number(ext.totalOwed||0) - Number(ext.amountRepaid||0));
        const newExtTotalOwed = Math.round(extRemaining * (1+KIKOBA_LOAN_INTEREST_RATE));
        tx.update(extRef, {
          totalOwed: newExtTotalOwed,
          amountRepaid: 0
        });
      }
    });

    await renderKikobaAccountantTab(document.getElementById('accountantContent'));
  }catch(err){
    alert("Error: " + err.message);
  }
}

/* =========================================================
   KIKOBA — FINES
   ========================================================= */
async function recordKikobaFine(){
  const msgBox = document.getElementById('kfineMsg');
  const memberId = document.getElementById('kfineMember').value;
  const amount = parseFloat(document.getElementById('kfineAmount').value);
  const reason = document.getElementById('kfineReason').value.trim();

  if(!memberId || !amount || amount<=0){
    msgBox.innerHTML = `<div class="msg msg-error">Chagua mwanachama na weka kiasi sahihi cha faini.</div>`;
    return;
  }
  if(!reason){
    msgBox.innerHTML = `<div class="msg msg-error">Andika sababu ya faini.</div>`;
    return;
  }

  try{
    await db.collection('kikobaFines').add({
      memberId, amount, reason,
      recordedBy: currentUser.uid,
      recordedAtMillis: Date.now(),
      recordedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgBox.innerHTML = `<div class="msg msg-ok">Faini imerekodiwa na kuongezwa kwenye Kikoba income.</div>`;
    document.getElementById('kfineAmount').value = '';
    document.getElementById('kfineReason').value = '';
    await renderKikobaAccountantTab(document.getElementById('accountantContent'));
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

async function renderKikobaFineHistoryTable(){
  const box = document.getElementById('kfineHistoryTable');
  if(!box) return;
  box.innerHTML = 'uploading...';

  const snap = await db.collection('kikobaFines').get();
  let docs = []; snap.forEach(d=> docs.push({id:d.id, ...d.data()}));
  docs.sort((a,b)=> (b.recordedAtMillis||0) - (a.recordedAtMillis||0));

  let rows = docs.map(f=>{
    const member = allMembersCache.find(m=>m.id===f.memberId);
    return `<tr>
      <td>${member?escapeHTML(member.name):'—'}</td>
      <td>${escapeHTML(f.reason)}</td>
      <td class="amount">TZS ${fmtTZS(f.amount)}</td>
    </tr>`;
  }).join('');
  if(!rows) rows = `<tr><td colspan="3" class="empty-state">Hakuna faini zilizorekodiwa.</td></tr>`;

  box.innerHTML = `
    <table>
      <thead><tr><th>Mwanachama</th><th>Sababu</th><th>Kiasi</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
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

      let extRef = null, ext = null;
      if(loan.externalCapitalId){
        extRef = db.collection('kikobaExternalCapital').doc(loan.externalCapitalId);
        const extDoc = await tx.get(extRef);
        if(extDoc.exists) ext = extDoc.data();
      }

      const interestPortion = amountPaid * (KIKOBA_LOAN_INTEREST_RATE/(1+KIKOBA_LOAN_INTEREST_RATE));
      const principalPortion = amountPaid - interestPortion;
      const newRepaid = Number(loan.amountRepaid||0) + amountPaid;

      // Split this payment between Kikoba's own capital (internal) and the
      // external source (if part of this loan was funded from outside), based
      // on the share of the loan's principal that came from each side.
      const externalRatio = (ext && ext.status === 'active' && loan.principal) ? (Number(ext.principal||0) / Number(loan.principal||1)) : 0;
      const externalInterestPortion = interestPortion * externalRatio;
      const externalPrincipalPortion = principalPortion * externalRatio;
      const internalInterestPortion = interestPortion - externalInterestPortion;
      const internalPrincipalPortion = principalPortion - externalPrincipalPortion;

      const repayRef = db.collection('kikobaRepayments').doc();
      tx.set(repayRef, {
        loanId, memberId: loan.memberId, amountPaid,
        interestPortion, principalPortion,
        internalInterestPortion, internalPrincipalPortion,
        externalInterestPortion, externalPrincipalPortion,
        recordedBy: currentUser.uid, recordedAtMillis: Date.now(),
        recordedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      const updateData = { amountRepaid: newRepaid };
      if(newRepaid >= loan.totalOwed) updateData.status = 'completed';
      tx.update(loanRef, updateData);

      if(extRef && ext && ext.status === 'active'){
        const extAmountApplied = externalInterestPortion + externalPrincipalPortion;
        const newExtRepaid = Number(ext.amountRepaid||0) + extAmountApplied;
        const extUpdate = { amountRepaid: newExtRepaid };
        if(newExtRepaid >= ext.totalOwed) extUpdate.status = 'completed';
        tx.update(extRef, extUpdate);
      }
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
/* =========================================================
   KIKOBA — EXTERNAL CAPITAL HISTORY
   ========================================================= */
async function renderExternalCapitalTable(){
  const box = document.getElementById('externalCapitalTable');
  if(!box) return;
  box.innerHTML = 'Uploading...';

  const snap = await db.collection('kikobaExternalCapital').get();
  let docs = []; snap.forEach(d=> docs.push({id:d.id, ...d.data()}));
  docs.sort((a,b)=> (b.takenAtMillis||0) - (a.takenAtMillis||0));

  let rows = docs.map(e=>{
    const member = allMembersCache.find(m=>m.id===e.memberId);
    const remaining = Math.max(0, Number(e.totalOwed||0) - Number(e.amountRepaid||0));
    const statusHtml = e.status === 'completed'
      ? '<span class="stamp stamp-paid">Imerudishwa Yote</span>'
      : '<span class="stamp stamp-pending">Bado Inadaiwa</span>';
    return `<tr>
      <td>${member?escapeHTML(member.name):'—'}</td>
      <td>${escapeHTML(e.source)}</td>
      <td class="amount">TZS ${fmtTZS(e.principal)}</td>
      <td class="amount">TZS ${fmtTZS(e.totalOwed)}</td>
      <td class="amount">TZS ${fmtTZS(remaining)}</td>
      <td>${statusHtml}</td>
    </tr>`;
  }).join('');
  if(!rows) rows = `<tr><td colspan="6" class="empty-state">Hakuna mtaji wa nje uliochukuliwa</td></tr>`;

  box.innerHTML = `
    <table>
      <thead><tr><th>Mwanachama</th><th>Chanzo</th><th>Kiasi Kilichochukuliwa</th><th>Jumla ya Kurudisha</th><th>Kinachodaiwa</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

/* =========================================================
   KIKOBA — OVERDUE LOAN RENEWAL (RE-COMPOUNDING)
   ========================================================= */
async function renewOverdueKikobaLoan(loanId){
  if(!confirm("Mwanachama huyu hajakamilisha kulipa ndani ya miezi 3. Ukiendelea, deni lililobaki litaongezwa riba mpya ya 15% na muda mpya wa miezi 3 utaanza kuhesabiwa kuanzia leo. Endelea?")) return;
  try{
    await db.runTransaction(async (tx)=>{
      const loanRef = db.collection('kikobaLoans').doc(loanId);
      const loanDoc = await tx.get(loanRef);
      if(!loanDoc.exists) throw new Error("Mkopo haukupatikana.");
      const loan = loanDoc.data();
      if(loan.status !== 'active') throw new Error("Mkopo huu si hai tena.");

      let extRef = null, ext = null;
      if(loan.externalCapitalId){
        extRef = db.collection('kikobaExternalCapital').doc(loan.externalCapitalId);
        const extDoc = await tx.get(extRef);
        if(extDoc.exists) ext = extDoc.data();
      }

      const remaining = Math.max(0, Number(loan.totalOwed||0) - Number(loan.amountRepaid||0));
      const newTotalOwed = Math.round(remaining * (1+KIKOBA_LOAN_INTEREST_RATE));
      const newDueDate = Date.now() + (KIKOBA_REPAYMENT_MONTHS*30*24*60*60*1000);

      const renewalEntry = {
        renewedAtMillis: Date.now(),
        oldTotalOwed: loan.totalOwed,
        remainingAtRenewal: remaining,
        newTotalOwed: newTotalOwed
      };
      const history = Array.isArray(loan.renewalHistory) ? loan.renewalHistory.slice() : [];
      history.push(renewalEntry);

      tx.update(loanRef, {
        totalOwed: newTotalOwed,
        amountRepaid: 0,
        dueDateMillis: newDueDate,
        renewalCount: (loan.renewalCount||0) + 1,
        renewalHistory: history
      });

      if(extRef && ext && ext.status === 'active'){
        const extRemaining = Math.max(0, Number(ext.totalOwed||0) - Number(ext.amountRepaid||0));
        const newExtTotalOwed = Math.round(extRemaining * (1+KIKOBA_LOAN_INTEREST_RATE));
        tx.update(extRef, {
          totalOwed: newExtTotalOwed,
          amountRepaid: 0
        });
      }
    });

    await renderKikobaAccountantTab(document.getElementById('accountantContent'));
  }catch(err){
    alert("Error: " + err.message);
  }
}

/* =========================================================
   KIKOBA — FINES
   ========================================================= */
async function recordKikobaFine(){
  const msgBox = document.getElementById('kfineMsg');
  const memberId = document.getElementById('kfineMember').value;
  const amount = parseFloat(document.getElementById('kfineAmount').value);
  const reason = document.getElementById('kfineReason').value.trim();

  if(!memberId || !amount || amount<=0){
    msgBox.innerHTML = `<div class="msg msg-error">Chagua mwanachama na weka kiasi sahihi cha faini.</div>`;
    return;
  }
  if(!reason){
    msgBox.innerHTML = `<div class="msg msg-error">Andika sababu ya faini.</div>`;
    return;
  }

  try{
    await db.collection('kikobaFines').add({
      memberId, amount, reason,
      recordedBy: currentUser.uid,
      recordedAtMillis: Date.now(),
      recordedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    msgBox.innerHTML = `<div class="msg msg-ok">Faini imerekodiwa na kuongezwa kwenye Kikoba income.</div>`;
    document.getElementById('kfineAmount').value = '';
    document.getElementById('kfineReason').value = '';
    await renderKikobaAccountantTab(document.getElementById('accountantContent'));
  }catch(err){
    msgBox.innerHTML = `<div class="msg msg-error">Error: ${err.message}</div>`;
  }
}

async function renderKikobaFineHistoryTable(){
  const box = document.getElementById('kfineHistoryTable');
  if(!box) return;
  box.innerHTML = 'uploading...';

  const snap = await db.collection('kikobaFines').get();
  let docs = []; snap.forEach(d=> docs.push({id:d.id, ...d.data()}));
  docs.sort((a,b)=> (b.recordedAtMillis||0) - (a.recordedAtMillis||0));

  let rows = docs.map(f=>{
    const member = allMembersCache.find(m=>m.id===f.memberId);
    return `<tr>
      <td>${member?escapeHTML(member.name):'—'}</td>
      <td>${escapeHTML(f.reason)}</td>
      <td class="amount">TZS ${fmtTZS(f.amount)}</td>
    </tr>`;
  }).join('');
  if(!rows) rows = `<tr><td colspan="3" class="empty-state">Hakuna faini zilizorekodiwa.</td></tr>`;

  box.innerHTML = `
    <table>
      <thead><tr><th>Mwanachama</th><th>Sababu</th><th>Kiasi</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  `;
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

      let extRef = null, ext = null;
      if(loan.externalCapitalId){
        extRef = db.collection('kikobaExternalCapital').doc(loan.externalCapitalId);
        const extDoc = await tx.get(extRef);
        if(extDoc.exists) ext = extDoc.data();
      }

      const interestPortion = amountPaid * (KIKOBA_LOAN_INTEREST_RATE/(1+KIKOBA_LOAN_INTEREST_RATE));
      const principalPortion = amountPaid - interestPortion;
      const newRepaid = Number(loan.amountRepaid||0) + amountPaid;

      // Split this payment between Kikoba's own capital (internal) and the
      // external source (if part of this loan was funded from outside), based
      // on the share of the loan's principal that came from each side.
      const externalRatio = (ext && ext.status === 'active' && loan.principal) ? (Number(ext.principal||0) / Number(loan.principal||1)) : 0;
      const externalInterestPortion = interestPortion * externalRatio;
      const externalPrincipalPortion = principalPortion * externalRatio;
      const internalInterestPortion = interestPortion - externalInterestPortion;
      const internalPrincipalPortion = principalPortion - externalPrincipalPortion;

      const repayRef = db.collection('kikobaRepayments').doc();
      tx.set(repayRef, {
        loanId, memberId: loan.memberId, amountPaid,
        interestPortion, principalPortion,
        internalInterestPortion, internalPrincipalPortion,
        externalInterestPortion, externalPrincipalPortion,
        recordedBy: currentUser.uid, recordedAtMillis: Date.now(),
        recordedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      const updateData = { amountRepaid: newRepaid };
      if(newRepaid >= loan.totalOwed) updateData.status = 'completed';
      tx.update(loanRef, updateData);

      if(extRef && ext && ext.status === 'active'){
        const extAmountApplied = externalInterestPortion + externalPrincipalPortion;
        const newExtRepaid = Number(ext.amountRepaid||0) + extAmountApplied;
        const extUpdate = { amountRepaid: newExtRepaid };
        if(newExtRepaid >= ext.totalOwed) extUpdate.status = 'completed';
        tx.update(extRef, extUpdate);
      }
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
