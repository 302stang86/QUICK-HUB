/* Fleet Service: free recipient directory. No Cloud Functions, Firebase Storage, or SMTP.
   Admins/managers maintain config/fleetRecipients in Firestore.
   Document format: { recipients: [{id:"manager-1",name:"Manager Name",email:"manager@firedefense.com",role:"manager"}] }
   The list exposes only intended recipient contact information; never exposes users documents. */
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, getDoc, collection, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
const db=getFirestore(getApp('fdec'));
async function listManagers(){
  await window.FDECAuth.ready;
  if(!window.FDECAuth.user || !window.FDECAuth.canOpen('fleet')) throw new Error('You must have access to Fleet Service.');
  const snap=await getDoc(doc(db,'config','fleetRecipients'));
  if(!snap.exists()) throw new Error('Recipient list has not been configured. Ask an administrator to add config/fleetRecipients in Firestore.');
  const source=snap.data().recipients;
  if(!Array.isArray(source)) throw new Error('Fleet recipient list is not correctly configured.');
  return source.filter(r=>r && r.id && r.name && r.email && ['manager','admin'].includes(r.role) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email))
    .map(r=>({id:String(r.id),name:String(r.name),email:String(r.email),role:r.role}));
}
async function submitReport(data){
  await window.FDECAuth.ready;
  const auth=window.FDECAuth;
  if(!auth.user || !auth.canOpen('fleet') || (!auth.isAdmin && auth.profile?.status!=='approved'))
    throw new Error('An approved Employee Hub account is required to submit.');
  const recipients=await listManagers();
  const recipient=recipients.find(r=>r.id===data.managerId);
  if(!recipient) throw new Error('The selected recipient is not currently in the approved recipient directory. Reload recipients.');
  if(JSON.stringify(data).length>100000) throw new Error('Request is too large. Shorten the notes and retry.');
  const payload={
    uid:auth.user.uid,
    technicianName:String(data.technician||'').slice(0,150),
    technicianEmail:auth.user.email||'',
    recipientId:recipient.id,
    recipientName:recipient.name,
    recipientEmail:recipient.email,
    recipientRole:recipient.role,
    vehicleNumber:String(data.vin||'').slice(0,100),
    vehicleName:String(data.vehicle||'').slice(0,180),
    status:'new',
    submittedAt:serverTimestamp(),
    details:{...data,managerId:recipient.id,managerName:recipient.name,managerEmail:recipient.email}
  };
  const result=await addDoc(collection(db,'fleetServiceReports'),payload);
  return {id:result.id,reference:'FS-'+result.id.slice(0,8).toUpperCase()};
}
window.FDECFleet={listManagers,submitReport};
window.dispatchEvent(new Event('fdec-fleet-ready'));
