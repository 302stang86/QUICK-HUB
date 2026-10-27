/* Fleet Service integration — no Cloud Functions / SMTP / paid services.
   - submitReport(): saves a fleetServiceReports doc for the manager dashboard.
     Email delivery is handled client-side by the page as a mailto: to the fixed
     fleet recipients below (the tech presses Send in their own mail app).
   - Assets: managers/admins assign a vehicle to a technician (fleetAssets/{uid});
     a technician reads only their OWN assignment. */
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, getDoc, setDoc, collection, getDocs, addDoc, serverTimestamp }
  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const db = getFirestore(getApp('fdec'));

/* Fixed recipients every Fleet Service Request is emailed to. */
const FLEET_RECIPIENTS = ['mp1@firedefense.com', 'wh1@firedefense.com', 'neal@firedefense.com'];

function isManagerOrAdmin(auth){
  return !!(auth && (auth.isAdmin || auth.profile?.role === 'manager' || auth.profile?.role === 'admin'));
}

async function submitReport(data){
  await window.FDECAuth.ready;
  const auth = window.FDECAuth;
  if(!auth.user || !auth.canOpen('fleet') || (!auth.isAdmin && auth.profile?.status !== 'approved'))
    throw new Error('An approved Employee Hub account is required to submit.');
  if(JSON.stringify(data).length > 100000) throw new Error('Request is too large. Shorten the notes and retry.');
  const payload = {
    uid: auth.user.uid,
    technicianName: String(data.technician || '').slice(0,150),
    technicianEmail: auth.user.email || '',
    recipientName: 'Fleet Managers',
    recipients: FLEET_RECIPIENTS.slice(),
    vehicleNumber: String(data.vin || '').slice(0,100),
    vehicleName: String(data.vehicle || '').slice(0,180),
    status: 'new',
    submittedAt: serverTimestamp(),
    details: { ...data }
  };
  const result = await addDoc(collection(db, 'fleetServiceReports'), payload);
  return { id: result.id, reference: 'FS-' + result.id.slice(0,8).toUpperCase() };
}

/* A technician's own assigned-vehicle record (or null). */
async function getMyAsset(){
  await window.FDECAuth.ready;
  const auth = window.FDECAuth;
  if(!auth.user) return null;
  try {
    const snap = await getDoc(doc(db, 'fleetAssets', auth.user.uid));
    return snap.exists() ? snap.data() : null;
  } catch(e){ return null; }
}

/* Manager/admin: the people a vehicle can be assigned to. */
async function listTechnicians(){
  await window.FDECAuth.ready;
  const auth = window.FDECAuth;
  if(!isManagerOrAdmin(auth)) throw new Error('Managers and administrators only.');
  const snap = await getDocs(collection(db, 'users'));
  return snap.docs.map(d => ({ uid: d.id, ...d.data() }))
    .filter(u => u.email && (u.status === 'approved' || u.role === 'admin'))
    .map(u => ({ uid: u.uid, name: u.name || u.email.split('@')[0], email: u.email, role: u.role || 'tech' }))
    .sort((a,b) => a.name.localeCompare(b.name));
}

/* Manager/admin: every current assignment, keyed by technician uid. */
async function listAssets(){
  await window.FDECAuth.ready;
  const auth = window.FDECAuth;
  if(!isManagerOrAdmin(auth)) throw new Error('Managers and administrators only.');
  const snap = await getDocs(collection(db, 'fleetAssets'));
  const map = {};
  snap.docs.forEach(d => { map[d.id] = d.data(); });
  return map;
}

/* Manager/admin: assign (or update) a technician's vehicle. */
async function saveAsset(techUid, techName, v){
  await window.FDECAuth.ready;
  const auth = window.FDECAuth;
  if(!isManagerOrAdmin(auth)) throw new Error('Managers and administrators only.');
  if(!techUid) throw new Error('No technician selected.');
  const payload = {
    techUid: String(techUid),
    techName: String(techName || '').slice(0,150),
    make: String(v.make || '').slice(0,60),
    model: String(v.model || '').slice(0,60),
    year: String(v.year || '').slice(0,8),
    plate: String(v.plate || '').slice(0,20).toUpperCase(),
    vin: String(v.vin || '').slice(0,40).toUpperCase(),
    vehicleNumber: String(v.vehicleNumber || '').slice(0,40),
    assignedBy: auth.user.uid,
    assignedByName: (auth.profile?.name || auth.user.email || ''),
    updatedAt: serverTimestamp()
  };
  await setDoc(doc(db, 'fleetAssets', String(techUid)), payload);
  return payload;
}

window.FDECFleet = { submitReport, getMyAsset, listTechnicians, listAssets, saveAsset, FLEET_RECIPIENTS };
window.dispatchEvent(new Event('fdec-fleet-ready'));
