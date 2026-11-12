// Pure, deterministic demo model. No real provider, account, payment or booking API.
export const APP_KIND = "fitness";
export function catalog(now = Date.now()) {
  const entries = APP_KIND === 'home' ? [
    ['clean','Cleaning','Pulizie','Two-hour home clean','Pulizia casa di due ore',9000,120,1,false],
    ['assemble','Assembly','Montaggio','Furniture assembly','Montaggio mobili',5500,90,1,false],
    ['handy','Handyman','Manutenzione','Small home repairs','Piccole riparazioni',8000,90,1,false],
    ['plumb','Plumbing','Idraulica','Plumbing assessment','Valutazione idraulica',7500,60,1,true],
  ] : [
    ['bjj','BJJ','BJJ','Beginner BJJ','BJJ principianti',2200,60,6,false],
    ['yoga','Yoga','Yoga','Mobility and yoga','Mobilità e yoga',1800,60,8,false],
    ['boxing','Boxing','Boxe','Boxing fundamentals','Fondamenti di boxe',2000,60,5,false],
    ['trainer','Trainer','Personal trainer','Personal training','Allenamento personale',6500,60,1,false],
    ['gym','Gym pass','Ingresso palestra','Gym day pass','Ingresso giornaliero',1500,120,12,false],
  ];
  return entries.map(([id,category,categoryIt,title,titleIt,price,duration,capacity,requiresLicense],i)=>({
    id, category, categoryIt, title, titleIt, price, duration, capacity, requiresLicense,
    approved: true, licenseVerified: false, // Synthetic demo approval only. Never a real verification claim.
    start: now + (48+i*3)*3600000, area: ['Prati','Flaminio','Cipro','Trionfale','Parioli'][i],
  }));
}
export function initialState(now=Date.now()) { return {items:catalog(now),bookings:[],quotes:[],sequence:0}; }
export function money(price,locale='en') { return new Intl.NumberFormat(locale,{style:'currency',currency:'EUR'}).format(price/100); }
export function cost(item) {
  if (!Number.isSafeInteger(item.price) || item.price<=0) throw new Error('INVALID_PRICE');
  const deposit=APP_KIND==='home' ? Math.round(item.price*0.2) : 0;
  return {total:item.price,deposit,balance:item.price-deposit,feeIncluded:APP_KIND==='home'?Math.round(item.price*0.15):0};
}
function find(state,id) { const item=state.items.find(x=>x.id===id); if(!item)throw new Error('UNKNOWN_SERVICE'); return item; }
export function available(state,id) {
  const item=find(state,id);
  return Math.max(0,item.capacity-state.bookings.filter(b=>b.itemId===id&&b.status==='reserved').length);
}
export function reserve(state,id,now=Date.now()) {
  const item=find(state,id); cost(item);
  if(!Number.isFinite(now)||!Number.isFinite(item.start)||item.start<=now)throw new Error('EXPIRED');
  if(!item.approved)throw new Error('NOT_APPROVED');
  if(item.requiresLicense&&!item.licenseVerified)throw new Error('LICENSE_REQUIRED');
  if(available(state,id)<1)throw new Error('FULL');
  if(state.bookings.some(b=>b.itemId===id&&b.status==='reserved'&&b.owner==='demo'))throw new Error('DUPLICATE');
  const end=item.start+item.duration*60000;
  if(state.bookings.some(b=>b.owner==='demo'&&b.status==='reserved'&&item.start<b.end&&end>b.start))throw new Error('OVERLAP');
  const sequence=state.sequence+1;
  const booking={id:`demo-${sequence}`,itemId:id,owner:'demo',status:'reserved',start:item.start,end,...cost(item)};
  return {...state,sequence,bookings:[...state.bookings,booking]};
}
export function cancel(state,id) {
  const booking=state.bookings.find(b=>b.id===id);
  if(!booking)throw new Error('UNKNOWN_BOOKING');
  if(booking.status!=='reserved')throw new Error('ALREADY_CANCELLED');
  return {...state,bookings:state.bookings.map(b=>b.id===id?{...b,status:'cancelled'}:b)};
}
export function requestQuote(state,id) {
  find(state,id);
  if(state.quotes.some(q=>q.itemId===id))throw new Error('DUPLICATE_QUOTE');
  return {...state,quotes:[...state.quotes,{itemId:id,status:'demo_requested'}]};
}
