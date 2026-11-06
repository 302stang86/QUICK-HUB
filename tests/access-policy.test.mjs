import test from 'node:test';
import assert from 'node:assert/strict';
import {canPlay,ADMIN_EMAILS} from '../fire-defense/access-policy.mjs';
const employee={email:'employee@firedefense.com',isAnonymous:false};
test('signed-out and anonymous sessions are blocked even with an approved profile',()=>{
 assert.equal(canPlay(null,{status:'approved'}),false);
 assert.equal(canPlay({...employee,isAnonymous:true},{status:'approved'}),false);
});
test('ordinary pending, denied and missing employee profiles stay blocked',()=>{
 for(const p of [null,{}, {role:'tech',status:'pending'},{role:'tech',status:'denied'}])assert.equal(canPlay(employee,p),false);
});
test('approved employees are recognized even without a legacy role field',()=>{
 assert.equal(canPlay(employee,{status:'approved'}),true);
 assert.equal(canPlay(employee,{role:'tech',status:'approved'}),true);
});
test('existing designated hub admins retain access without an approved profile',()=>{
 for(const email of ADMIN_EMAILS){assert.equal(canPlay({email,isAnonymous:false},null),true);assert.equal(canPlay({email:email.toUpperCase(),isAnonymous:false},{status:'pending'}),true);}
});
test('existing admin roles match the hub override',()=>{
 assert.equal(canPlay(employee,{role:'admin',status:'pending'}),true);
});
test('outside accounts and forged admin-looking addresses stay blocked',()=>{
 assert.equal(canPlay({email:'outsider@example.com',isAnonymous:false},{status:'approved'}),false);
 assert.equal(canPlay({email:'302stang86@gmail.com.evil.example',isAnonymous:false},null),false);
 assert.equal(canPlay({email:ADMIN_EMAILS[0],isAnonymous:true},null),false);
});
