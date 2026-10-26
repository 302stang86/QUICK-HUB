/* FDEC Fleet integration: protected recipient directory, report storage, and confirmed delivery.
   Requires deploying functions/index.js and Firebase Storage/Firestore rules.
   Never expose employee user documents or SMTP credentials to technician browsers. */
import { getApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore, collection, addDoc, serverTimestamp, updateDoc } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';
import { getStorage, ref, uploadBytes } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js';
import { getFunctions, httpsCallable } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-functions.js';
const app=getApp('fdec'), db=getFirestore(app), storage=getStorage(app);
const functions=getFunctions(app, 'us-central1');
async function identity(){
  if(!window.FDECAuth) throw new Error('Employee Hub authentication is unavailable.');
  await window.FDECAuth.ready;
  const a=window.FDECAuth;
  if(!a.user) throw new Error('Sign in to submit a Fleet Service Request.');
  if(!a.canOpen('fleet')) throw new Error('Your role is not authorized for the Fleet Service Request page.');
  return a;
}
async function listManagers(){
  await identity();
  const result=await httpsCallable(functions,'listFleetRecipients')({});
  return result.data.recipients;
}
async function submitReport(pdf,data,filename){
  const a=await identity();
  if(!data.managerId) throw new Error('Select a recipient.');
  // Never trust a browser-submitted recipient email: delivery function resolves ID in Firestore.
  const record={
    uid:a.user.uid,
    technician:a.profile?.name || data.technician,
    recipientUid:data.managerId,
    recipientName:data.managerName,
    vehicle:data.vehicle,
    vehicleNumber:data.vin,
    plate:data.plate,
    scheduledServiceDate:data.date,
    scheduleStatus:data.scheduleStatus,
    dropOff:data.dropOff,
    dropOffDays:data.dropOffDays,
    spareVehicle:data.spareVehicle,
    transportNeeded:data.transportNeeded,
    checklist:data.checklist,
    points:data.points,
    notes:data.notes,
    createdAt:serverTimestamp(),
    deliveryStatus:'pending',
    pdfStatus:'uploading'
  };
  const docRef=await addDoc(collection(db,'fleetServiceReports'),record);
  const path=`fleet-service-reports/${a.user.uid}/${docRef.id}/report.pdf`;
  try{
    await uploadBytes(ref(storage,path),pdf,{contentType:'application/pdf',customMetadata:{reportId:docRef.id}});
    await updateDoc(docRef,{pdfPath:path,pdfStatus:'saved'});
  }catch(err){
    try{await updateDoc(docRef,{pdfStatus:'failed'});}catch(_){}
    throw new Error('Report '+docRef.id+' was created but its PDF could not be saved: '+err.message);
  }
  // Confirmed sent only when trusted server has successfully sent the message.
  try{
    const answer=await httpsCallable(functions,'deliverFleetReport')({reportId:docRef.id});
    return {reportId:docRef.id,saved:true,sent:answer.data.sent === true};
  }catch(err){
    return {reportId:docRef.id,saved:true,sent:false,deliveryError:err.message};
  }
}
window.FDECFleet={listManagers,submitReport};
window.dispatchEvent(new Event('fdec-fleet-ready'));
