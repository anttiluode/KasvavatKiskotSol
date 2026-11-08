const test=require('node:test');
const assert=require('node:assert/strict');
const {makeNetwork,openWait,wave,episode,train,budgetMass,buildStatic,primeWorseRoute,lesion,snapshot,runScenario}=require('../growing_rails.js');

test('grid is directed by packet travel but built of undirected candidate rails with a central barrier',()=>{
 const n=makeNetwork();assert.equal(n.width,12);assert.equal(n.height,7);
 assert.ok(n.nodes.length>70);assert.ok(n.edges.length>120);
 assert.ok(n.nodes.every(x=>n.adjacent[x.id].length>0));
 assert.ok(n.nodes.every(x=>!(x.x===5&&x.y>=2&&x.y<=4)));
});
test('local receiver opening waits are nonnegative and periodic',()=>{
 const n=makeNetwork(); const u=n.nodes[n.source],v=n.nodes[n.adjacent[n.source].map(i=>{const e=n.edges[i];return e.a===u.id?e.b:e.a;})[0]];
 for(let t=0;t<80;t++) {const w=openWait(v,u,t);assert.ok(w>=0&&w<v.period);assert.equal(w,openWait(v,u,t+v.period));}
});
test('feeler pulse cannot deliver through unbuilt roads, and ACK constructs them',()=>{
 const n=makeNetwork({budget:15});assert.equal(snapshot(n).delivery.found,false);
 const sample=episode(n);assert.ok(sample.probe.length>10);assert.equal(sample.complete,false);
 train(n,9);assert.equal(snapshot(n).delivery.found,true);
});
test('rail budget remains enforced over growth, break and retarget',()=>{
 const n=makeNetwork({budget:15});
 for(let i=0;i<150;i++){
   if(i===35)lesion(n); if(i===85)n.target='C';
   episode(n);assert.ok(budgetMass(n)<=15+1e-7,`${i} budget ${budgetMass(n)}`);
   assert.ok(n.edges.every(e=>e.mass>=0&&e.mass<=1));
 }
});
test('phase-aware network matches the phase-gated potential time on first destination',()=>{
 const n=makeNetwork({mode:'phase',budget:15}); train(n,35);
 const s=snapshot(n);assert.ok(s.delivery.found);
 assert.equal(s.delivery.time,s.potential.time);
 assert.ok(s.active<25);
});
test('flow-only learns a connected but slower road on the same terrain',()=>{
 const p=makeNetwork({mode:'phase',budget:15}),f=makeNetwork({mode:'flow',budget:15});train(p,35);train(f,35);
 const a=snapshot(p),b=snapshot(f);
 assert.ok(b.delivery.found);assert.ok(a.delivery.time<b.delivery.time);
 assert.equal(a.delivery.time,73);assert.equal(b.delivery.time,94);
});
test('cut physically removes the active route; phase system regrows a second one',()=>{
 const n=makeNetwork({mode:'phase',budget:15});train(n,35);const orig=snapshot(n).delivery;
 const cut=lesion(n);assert.ok(cut);assert.ok(orig.edges.includes(cut.edge));
 assert.equal(snapshot(n).delivery.found,false);
 train(n,45);const after=snapshot(n).delivery;
 assert.ok(after.found);assert.ok(!after.edges.includes(cut.edge));assert.ok(after.time>orig.time);
});
test('target relocation changes the structure without reset',()=>{
 const n=makeNetwork({mode:'phase',budget:15});train(n,35);lesion(n);train(n,45);
 n.target='C';assert.equal(snapshot(n).delivery.found,false);
 train(n,55);assert.equal(snapshot(n).delivery.time,78);
});
test('static physical rails never heal a lesion',()=>{
 const n=makeNetwork({mode:'static',budget:15});buildStatic(n);assert.ok(snapshot(n).delivery.found);
 lesion(n);train(n,120);assert.equal(snapshot(n).delivery.found,false);
});
test('worse route head start is reversible for phase-aware but not flow-only',()=>{
 const p=makeNetwork({mode:'phase',budget:15}),f=makeNetwork({mode:'flow',budget:15});
 primeWorseRoute(p);primeWorseRoute(f);
 assert.equal(snapshot(p).delivery.time,94);assert.equal(snapshot(f).delivery.time,94);
 train(p,45);train(f,45);
 assert.equal(snapshot(p).delivery.time,73);assert.equal(snapshot(f).delivery.time,94);
});
test('scenario reports reproducible outcomes and never invents a target',()=>{
 const a=runScenario('phase',{budget:15}),b=runScenario('phase',{budget:15});
 assert.equal(JSON.stringify(a),JSON.stringify(b));
 assert.equal(a.learned.delivery.time,73);assert.equal(a.recovered.delivery.time,80);
 assert.equal(a.retargeted.delivery.time,78);
});
