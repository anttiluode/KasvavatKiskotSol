const fs=require('node:fs');
const path=require('node:path');
const {makeNetwork,primeWorseRoute,train,snapshot,runScenario,budgetMass}=require('../growing_rails.js');
const DEFAULT_BUDGET=15;
function compact(s){return {route_found:s.delivery.found,route_ticks:s.delivery.time,
  route_edges:s.delivery.edges.length,active_edges:s.active,rail_mass:Number(s.mass.toFixed(6)),
  potential_ticks:s.potential.time,available_edges:s.potential.edges.length};}
function scenario(mode){const a=runScenario(mode,{budget:DEFAULT_BUDGET});return {
  start:compact(a.initial),after_growth:compact(a.learned),lesion_edge:a.cut?.edge??null,
  just_after_lesion:compact(a.afterCut),after_repair:compact(a.recovered),
  immediately_after_retarget:compact(a.changed),after_retarget:compact(a.retargeted),
  first_connected_round:a.firstConnection,first_recovered_round:a.recoveryRound,
  first_retargeted_round:a.retargetRound};}
function trap(mode){const n=makeNetwork({mode,budget:DEFAULT_BUDGET});primeWorseRoute(n);const start=compact(snapshot(n));
  const runs=train(n,45);return {start,after:compact(snapshot(n)),
   connected_trials:runs.filter(x=>x.complete).length,peak_rail_mass:Number(Math.max(...runs.map(x=>x.budget)).toFixed(6))};}
function run(){const out={description:'Designed deterministic phase-gated pulse+ACK growing graph, not biology',
  provenance:'node experiments/run.js',seed:'none; fixed map and tie-order',budget:DEFAULT_BUDGET,
  terrain:'12x7 lattice with blocked central cells and heterogeneous travel time',
  costs:'physical delivery includes phase waits; flow-only growth ignores them',
  schedule:{growth:35,after_lesion:45,after_retarget:55},
  phase:scenario('phase'),flow_only:scenario('flow'),static:scenario('static'),
  worse_route_headstart:{phase:trap('phase'),flow_only:trap('flow')},
  caveats:['Exploration uses all candidate feeler edges, irrespective of constructed rail mass.',
    'First-arrival wavefront is a distributed Dijkstra-like search; the phase-aware growth target is the earliest-arrival path by construction.',
    'Budget pool is global, not fully local resource diffusion.',
    'The destination and success criterion come from the experimenter; no endogenous ought.',
    'No private jitter or stochastic generalization tested.']};
  const filepath=path.resolve(__dirname,'..','results','results.json');
  fs.mkdirSync(path.dirname(filepath),{recursive:true});
  fs.writeFileSync(filepath,JSON.stringify(out,null,2)+'\n');
  console.log(`Wrote ${filepath}`);
  console.log('phase/flow/static',out.phase.after_growth.route_ticks,out.flow_only.after_growth.route_ticks,out.static.after_growth.route_ticks);
  console.log('phase after cut, after repair, after retarget',out.phase.just_after_lesion.route_ticks,out.phase.after_repair.route_ticks,out.phase.after_retarget.route_ticks);
  return out;
}
if(require.main===module)run();module.exports={run};
