import test from 'node:test';
import assert from 'node:assert/strict';
import {APP_KIND,initialState,reserve,cancel,available,cost,requestQuote} from './engine.mjs';
const now=Date.UTC(2026,10,11,10);
test('catalog is explicitly deterministic and only priced in integer cents',()=>{
 const s=initialState(now);assert.deepEqual(s,initialState(now));
 for(const i of s.items){assert.ok(i.start>now);assert.ok(Number.isSafeInteger(i.price));assert.equal(cost(i).deposit+cost(i).balance,i.price);}
});
test('reservation does not mutate source and consumes capacity',()=>{const s=initialState(now),id=s.items[0].id,n=reserve(s,id,now);assert.equal(s.bookings.length,0);assert.equal(n.bookings.length,1);assert.equal(available(n,id),s.items[0].capacity-1);});
test('duplicate demo reservation is rejected',()=>{const s=initialState(now),n=reserve(s,s.items[0].id,now);assert.throws(()=>reserve(n,s.items[0].id,now),/DUPLICATE|FULL/);});
test('full slots reject a new reservation',()=>{const s=initialState(now),i=s.items[0];s.bookings=Array.from({length:i.capacity},(_,n)=>({itemId:i.id,status:'reserved',owner:`other-${n}`}));assert.throws(()=>reserve(s,i.id,now),/FULL/);});
test('expired or malformed starts fail closed',()=>{const s=initialState(now);s.items[0].start=now;assert.throws(()=>reserve(s,s.items[0].id,now),/EXPIRED/);s.items[0].start=NaN;assert.throws(()=>reserve(s,s.items[0].id,now),/EXPIRED/);});
test('unapproved offerings cannot be reserved',()=>{const s=initialState(now);s.items[0].approved=false;assert.throws(()=>reserve(s,s.items[0].id,now),/NOT_APPROVED/);});
test('regulated services require license verification',()=>{const s=initialState(now);s.items[0].requiresLicense=true;assert.throws(()=>reserve(s,s.items[0].id,now),/LICENSE_REQUIRED/);});
test('unknown offerings and invalid prices are rejected',()=>{const s=initialState(now);assert.throws(()=>reserve(s,'missing',now),/UNKNOWN_SERVICE/);s.items[0].price=-1;assert.throws(()=>reserve(s,s.items[0].id,now),/INVALID_PRICE/);});
test('overlapping reservations for demo customer are refused',()=>{const s=initialState(now);s.items[1].start=s.items[0].start;const n=reserve(s,s.items[0].id,now);assert.throws(()=>reserve(n,s.items[1].id,now),/OVERLAP/);});
test('cancellation restores capacity and cannot repeat',()=>{const s=initialState(now),id=s.items[0].id,n=reserve(s,id,now),c=cancel(n,n.bookings[0].id);assert.equal(available(c,id),s.items[0].capacity);assert.equal(n.bookings[0].status,'reserved');assert.throws(()=>cancel(c,c.bookings[0].id),/ALREADY_CANCELLED/);assert.throws(()=>cancel(c,'missing'),/UNKNOWN_BOOKING/);});
test('sample quote request is local and idempotence is enforced',()=>{const s=initialState(now),q=requestQuote(s,s.items[0].id);assert.equal(s.quotes.length,0);assert.equal(q.quotes[0].status,'demo_requested');assert.throws(()=>requestQuote(q,s.items[0].id),/DUPLICATE_QUOTE/);});
test('home fee is included, not added; fitness deposit is not invented',()=>{const p=cost(initialState(now).items[0]);assert.equal(p.feeIncluded,APP_KIND==='home'?1350:0);assert.equal(p.deposit,APP_KIND==='home'?1800:0);});
