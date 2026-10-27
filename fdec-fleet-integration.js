/* Fleet Service: free recipient directory. No Cloud Functions, Firebase Storage, or SMTP.
   Admins/managers maintain config/fleetRecipients in Firestore.
   Document format: { recipients: [{id:"manager-1",name:"Manager Name",email:"manager@firedefense.com",role:"manager"}] }
   The list exposes only intended recipient contact information; never exposes users documents. */
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
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
window.FDECFleet={listManagers};
window.dispatchEvent(new Event('fdec-fleet-ready'));
