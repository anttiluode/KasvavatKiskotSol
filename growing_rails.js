/* Kasvavat Kiskot Sol — deterministic, dependency-free growing rail experiment.
   Independent from Claude's repo. Browser and Node share this core.
   Local rule: exploratory pulse discovers a route; target ACK travels back along
   its predecessor chain and reinforces only the traversed edges. Shared finite
   resource pool enforces a mass budget. This is a model, not an optimal TSP solver.
*/
(function(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.GrowingRails = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  function key(x,y){return x+','+y;}
  function copy(o){return JSON.parse(JSON.stringify(o));}
  function makeNetwork(opts={}) {
    const width=opts.width||12, height=opts.height||7;
    const budget=opts.budget??21, threshold=opts.threshold??0.43;
    const nodes=[], nodeAt=new Map(), edges=[], adjacent=[];
    const mode=opts.mode||'phase';
    const forbidden = (x,y) => x===5 && y>=2 && y<=4;
    for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
      if(forbidden(x,y)) continue;
      const id=nodes.length;
      const period=7+(x*3+y*5)%8;
      nodes.push({id,x,y,period,offset:(x*2+y*3)%period});
      nodeAt.set(key(x,y),id); adjacent.push([]);
    }
    function addEdge(a,b) {
      const u=nodes[a],v=nodes[b],horizontal=u.y===v.y;
      const tau=horizontal ? 2+((u.x+u.y)%5===0?1:0)+(u.y>=5&&u.x>=3&&u.x<=8?2:0)
                           : 2+((u.x*3+u.y)%7===0?1:0);
      const id=edges.length;
      edges.push({id,a,b,tau,mass:0.025,broken:false,credit:0,used:0});
      adjacent[a].push(id);adjacent[b].push(id);
    }
    for(const n of nodes) {
      for(const [dx,dy] of [[1,0],[0,1]]) {
        const to=nodeAt.get(key(n.x+dx,n.y+dy));
        if(to!==undefined) addEdge(n.id,to);
      }
    }
    const source=nodeAt.get(key(0,3)), B=nodeAt.get(key(width-1,3)), C=nodeAt.get(key(width-1,0));
    if(source===undefined||B===undefined||C===undefined) throw Error('Map must contain source and both targets');
    const net={width,height,nodes,edges,adjacent,source,targets:{B,C},target:'B',mode,budget,threshold,
      rounds:0,probes:0,replies:0,spent:0,history:[],lastPath:[],lastProbe:null};
    return net;
  }
  function openWait(node, from, arrive) {
    const p=node.period;
    const dx=from.x-node.x,dy=from.y-node.y;
    const slot= dx<0?0:dx>0?2:dy<0?1:3;
    const opening=(node.offset+Math.round(slot*p/4))%p;
    return ((opening-(arrive%p))+p)%p;
  }
  function wave(net, targetId=net.targets[net.target], opts={}) {
    const free=opts.free??true, phase=opts.phase??true, start=opts.start??0;
    const N=net.nodes.length, dist=new Array(N).fill(Infinity), parent=new Array(N).fill(-1);
    const parentEdge=new Array(N).fill(-1), waits=new Array(N).fill(0), seen=new Array(N).fill(false);
    dist[net.source]=start;
    let visited=0;
    while(true) {
      let u=-1, best=Infinity;
      for(let i=0;i<N;i++) if(!seen[i] && dist[i]<best){best=dist[i];u=i;}
      if(u<0||u===targetId)break;
      seen[u]=true;visited++;
      for(const id of net.adjacent[u]) {
        const edge=net.edges[id];
        if(edge.broken||(!free&&edge.mass<net.threshold))continue;
        const v=edge.a===u?edge.b:edge.a;
        if(seen[v])continue;
        const base=dist[u]+edge.tau;
        const w=phase?openWait(net.nodes[v],net.nodes[u],base):0;
        const candidate=base+w;
        if(candidate < dist[v]-1e-8) {
          dist[v]=candidate;parent[v]=u;parentEdge[v]=id;waits[v]=w;
        }
      }
    }
    if(!Number.isFinite(dist[targetId])) return {found:false,time:null,edges:[],nodes:[],waits:[],visited};
    const route=[], routeNodes=[targetId], delays=[];
    for(let v=targetId;v!==net.source;) {
      if(parent[v]<0)throw Error('predecessor chain corrupted');
      route.push(parentEdge[v]);delays.push(waits[v]);v=parent[v];routeNodes.push(v);
    }
    route.reverse();delays.reverse();routeNodes.reverse();
    return {found:true,time:dist[targetId]-start,edges:route,nodes:routeNodes,waits:delays,visited};
  }
  function budgetMass(net) {return net.edges.reduce((s,e)=>s+e.mass,0);}
  function applyBudget(net) {
    let extra=budgetMass(net)-net.budget;
    if(extra<=1e-9)return;
    // Resource accounting is explicitly global. Each edge's credit is local, but
    // a common reservoir drains the least recently rewarded rail first.
    const candidates=net.edges.filter(e=>!e.broken).sort((a,b)=>(a.credit-b.credit)||(a.mass-b.mass)||(a.id-b.id));
    for(const e of candidates){
      if(extra<=0)break;
      const give=Math.min(extra,Math.max(0,e.mass-0.001));
      e.mass-=give;extra-=give;
    }
    if(extra>1e-8)throw Error('rail mass budget cannot be enforced');
  }
  function episode(net, options={}) {
    const grow=options.grow??(net.mode!=='static');
    const learnPhase=net.mode==='phase';
    // All potential weak feelers are probed each episode, even when inactive.
    // The first-arrival pulse is a distributed Dijkstra-like wavefront; the
    // winning target node replies along the recorded predecessor chain.
    const result=wave(net,net.targets[net.target],{free:true,phase:learnPhase});
    net.rounds++;net.probes+=result.visited;
    net.lastProbe=result;net.lastPath=result.edges.slice();
    if(grow) {
      for(const e of net.edges) {e.credit*=0.84;if(!e.broken)e.mass=Math.max(0.001,e.mass*(1-0.045));}
      if(result.found) {
        const reward=0.33;
        // ACK travels from target to source. Edge sees only its returning ACK
        // and local wait; phase mode favors low-phase-error delivery.
        for(let i=result.edges.length-1;i>=0;i--) {
          const e=net.edges[result.edges[i]];
          const wait=result.waits[i];
          const quality=learnPhase?0.60+0.40*Math.exp(-wait/4):1;
          e.mass=Math.min(1,e.mass+reward*quality);
          e.credit=1;e.used++;net.replies++;
        }
      }
      applyBudget(net);
    }
    const delivery=wave(net,net.targets[net.target],{free:false,phase:true});
    const info={round:net.rounds,target:net.target,probeTime:result.time,deliveryTime:delivery.time,
      complete:delivery.found,budget:budgetMass(net),active:net.edges.filter(e=>e.mass>=net.threshold&&!e.broken).length,
      route:delivery.edges.slice(),probe:result.edges.slice()};
    net.history.push(info);return info;
  }
  function train(net,rounds){const data=[];for(let i=0;i<rounds;i++)data.push(episode(net));return data;}
  function buildStatic(net) {
    const path=wave(net,net.targets[net.target],{free:true,phase:false});
    for(const e of net.edges)e.mass=0.001;
    for(const id of path.edges)net.edges[id].mass=1;
    applyBudget(net);
    return path;
  }
  function primeWorseRoute(net) {
    // Deliberately prebuild the raw-fastest route, potentially inferior after
    // the receivers' clock windows are accounted for.
    const p=wave(net,net.targets[net.target],{free:true,phase:false});
    for(const e of net.edges)e.mass=0.001;
    for(const id of p.edges)net.edges[id].mass=0.96;
    applyBudget(net);return p;
  }
  function lesion(net) {
    const p=wave(net,net.targets[net.target],{free:false,phase:true});
    if(!p.found) return null;
    const id=p.edges[Math.floor(p.edges.length/2)],edge=net.edges[id];
    edge.broken=true;edge.mass=0;edge.credit=0;
    return {edge:id,xy:[net.nodes[edge.a],net.nodes[edge.b]],before:p.time};
  }
  function snapshot(net) {
    return {mode:net.mode,rounds:net.rounds,target:net.target,source:net.source,
      budget:net.budget,mass:budgetMass(net),probes:net.probes,replies:net.replies,
      active:net.edges.filter(e=>!e.broken&&e.mass>=net.threshold).length,
      delivery:wave(net,net.targets[net.target],{free:false,phase:true}),
      potential:wave(net,net.targets[net.target],{free:true,phase:true})};
  }
  function runScenario(mode='phase',opts={}){
    const net=makeNetwork({...opts,mode});
    if(mode==='static')buildStatic(net);
    const initial=snapshot(net),growth=train(net,35),learned=snapshot(net);
    const cut=lesion(net);const afterCut=snapshot(net);
    const regrowth=train(net,45),recovered=snapshot(net);
    net.target='C';const changed=snapshot(net);
    const reversal=train(net,55),retargeted=snapshot(net);
    return {mode,initial,learned,cut,afterCut,recovered,changed,retargeted,
      firstConnection:growth.find(x=>x.complete)?.round??null,
      recoveryRound:regrowth.find(x=>x.complete)?.round??null,
      retargetRound:reversal.find(x=>x.complete)?.round??null};
  }
  return {makeNetwork,openWait,wave,episode,train,budgetMass,buildStatic,primeWorseRoute,lesion,snapshot,runScenario};
});
