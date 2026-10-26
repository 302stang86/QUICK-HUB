/* Fleet Service Request integration — Firebase 10.12.2 modular SDK.
   Save alongside fdec-auth.js and fleet-service-request-firebase.html.
   IMPORTANT: This module SAVES reports; it does NOT send email.
   Deploy and connect a trusted email-delivery backend before advertising delivery. */
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, query, where, getDocs, addDoc, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';

const app = getApp('fdec');
const db = getFirestore(app);
const storage = getStorage(app);

async function identity(){
  if (!window.FDECAuth) throw new Error('Employee Hub authentication did not load.');
  await window.FDECAuth.ready;
  const auth = window.FDECAuth;
  if (!auth.user || auth.profile?.status !== 'approved' && !auth.isAdmin) throw new Error('An approved Employee Hub account is required.');
  if (!auth.canOpen('fleet')) throw new Error('Your account does not have Fleet Service Request access.');
  return auth;
}

async function listManagers(){
  await identity();
  // Firestore rules enforce role=manager and status=approved for this query.
  const q = query(collection(db,'users'), where('role','==','manager'), where('status','==','approved'));
  const snapshot = await getDocs(q);
  return snapshot.docs.filter(d => !!d.data().email).map(d => ({id:d.id, name:d.data().name || d.data().email})).sort((a,b)=>a.name.localeCompare(b.name));
}

async function submitReport(pdf,data,filename){
  const auth=await identity();
  const managerSnap=await getDocs(query(collection(db,'users'),where('role','==','manager'),where('status','==','approved')));
  const manager=managerSnap.docs.find(x=>x.id===data.managerId);
  if(!manager || !manager.data().email) throw new Error('Selected manager is no longer active or does not have an email address.');
  const record={
    uid:auth.user.uid,
    technician:auth.profile?.name || data.technician,
    managerUid:manager.id,
    managerName:manager.data().name || manager.data().email,
    vehicle:data.vehicle,
    vin:data.vin,
    plate:data.plate,
    scheduledServiceDate:data.date,
    scheduleStatus:data.scheduleStatus,
    checklist:data.checklist,
    points:data.points,
    notes:data.notes,
    createdAt:serverTimestamp(),
    deliveryStatus:'not_configured',
    pdfStatus:'uploading'
  };
  // Metadata first; Storage path is scoped to this immutable report id.
  const docRef=await addDoc(collection(db,'fleetServiceReports'),record);
  try{
    const path=`fleet-service-reports/${auth.user.uid}/${docRef.id}/report.pdf`;
    const pdfRef=ref(storage,path);
    await uploadBytes(pdfRef,pdf,{contentType:'application/pdf',customMetadata:{reportId:docRef.id}});
    await updateDoc(docRef,{pdfPath:path,pdfStatus:'saved'});
  }catch(error){
    try{await updateDoc(docRef,{pdfStatus:'failed'});}catch(_){}
    throw new Error('Report '+docRef.id+' was created but PDF upload failed: '+error.message);
  }
  return {reportId:docRef.id,saved:true,sent:false};
}
window.FDECFleet={listManagers,submitReport};
window.dispatchEvent(new Event('fdec-fleet-ready'));
