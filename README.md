# Kasvavat Kiskot Sol — Growing Rails

**Independent Sol build, 8 November 2026.** A phase-sensitive train-yard network whose *rails themselves are learned* by exploratory pulses and target replies.

[Open the browser lab](https://anttiluode.github.io/KasvavatKiskotSol/) once GitHub Pages is enabled. For entirely offline use, download `index.html` **and** `growing_rails.js` together and double-click the HTML. No bundler, cloud service, GPU, Python, or web server is required. Node 18+ runs the tests.

The question follows Antti's railway turntable, Feynman's multiple paths, the vine that grows new attachments, and the slime-mold transport analogy. It **does not** pretend to simulate biological neurites, a physical path integral, or genuine traveling-salesman optimization. It is a deliberately small causal experiment.

## Core distinction

A standard neural model modifies weights on a predefined adjacency. This model *selects and constructs the operational adjacency* through a scarce material budget. Every lattice edge is initially a thin exploratory **feeler**. A material strength `mass` becomes a working rail only if it grows beyond `threshold`. A live pulse can travel only over built rails; a dilute exploratory pulse can investigate all candidate edges, including weak ones. When the target receives the earliest exploratory pulse, it sends a return **ACK** along that pulse's predecessor path. Only edges which actually carried that ACK receive credit. Each intermediate station acts as a new train factory: it delays and regenerates an outgoing pulse relative to its local clock.

Three policies share the same map and budget:

| Policy | Search / construction rule | What it lacks |
| --- | --- | --- |
| `phase` | Earliest arrival through actual local clock windows; returning ACK grows those edges | No stochastic jitter modeling; no internally generated goal |
| `flow` | Earliest arrival ignoring clock windows; returning ACK grows those edges | Cannot distinguish geometrically fast rails from actually fast phase-timed rails |
| `static` | Prebuild raw-shortest rails, never change them | Cannot repair or retarget |

The branch-specific timing effect is concrete: a receiver with clock period `P` and phase offset has an opening slot for each incoming direction; a train arriving at `t` waits until the next opening. Edge arrival thus depends on *travel time and the receiving station's phase*. The same rails can carry packets differently depending on clock choices. In this controlled test, periods span 7–14 ticks and the map has a central blocked strip and slower terrain.

## Exact experiments

```sh
node --test tests/growing_rails.test.js
node experiments/run.js
```

The second command regenerates `results/results.json`. The lab and experiment use **the same** `growing_rails.js`. Every scenario begins on the same fixed 12×7 terrain with 139 candidate edges (check the source for exact map construction), source `(0,3)`, destination B `(11,3)` and alternate destination C `(11,0)`. A rail only becomes active above mass 0.43; at most **15 units** of construction material may be used. The main trajectory is 35 training rounds, sever the active path, 45 recovery rounds, retarget to C, 55 more rounds.

| Outcome | Phase-aware | Flow-only | Static |
| --- | ---: | ---: | ---: |
| Delivery after growth (ticks; lower is better) | **73** | 94 | 94 |
| Immediately after severing a used rail | no route | no route | no route |
| After 45 repair rounds | **80** | no route at budget 15 | no route |
| After retargeting to C and 55 rounds | **78** | 118 | no route |
| With raw-shortest route given a head start, after 45 rounds | **73** | 94 | — |

Both learned policies can be made to connect using a larger budget, so *flow-only failure in the recovery test is not a universal impossibility*. The result depends on this terrain, budget and explicit clock assignments. The 73-tick route equals the *phase-aware best-potential path* in this designed test. It is not an out-of-sample machine-learning result.

**Controls:** (1) static network; (2) flow-only reinforcement; (3) exact earliest-arrival reference over *all potential* edges; (4) deliberate head start to a less useful route; (5) cut and (6) retarget. Eleven local tests cover the invariants and interventions. An optional GitHub Actions workflow checks byte-for-byte result regeneration.

## Three timescales, one explicit mechanism

1. **Fast pulses:** the source launches a wave. At each junction, a local turntable window determines when it can forward the signal. The earliest arriving pulse is retained; later competing pulses are discarded. A destination emits a reply along the recorded predecessor chain. `wave()` simulates this efficiently with a label-setting event scheduler. The *junction* has no global map, although the simulator maintains an event queue and predecessors.
2. **Intermediate ACK:** only the branches traversed by a successful target reply get reinforcing credit. There is no error gradient or ground-truth image attached to a station. The target and its value are supplied by the experimenter.
3. **Slow construction:** ACK-positive rails gain material, unused rails decay. A fixed global material pool (`budget`) redistributes mass away from low-credit branches. That central budget accounting is a deliberate **nonlocal approximation** to nutrient competition; a genuinely local resource-transport model is not implemented yet.

The code uses a **designed deterministic wavefront**—equivalent in shortest-arrival effect to time-dependent Dijkstra on potential edges. The ability to explore every unbuilt edge is strong. So the experiment tests *whether locally acknowledged timing can be stored in limited physical connectivity and recover when the target or terrain changes*, **not** whether an organism spontaneously discovers shortest paths without powerful exploratory search.

## Mathematical sketch

For arrival time `t` at node `v` from neighbor `u`, let its preferred opening phase depend on the incoming track direction. The waiting time is:

```
open(v,u) = (offset[v] + direction_slot(u,v) * period[v]/4) mod period[v]
wait(v,u,t) = (open(v,u) - t mod period[v]) mod period[v]
t_next = t + track_delay(u,v) + wait(v,u,t + track_delay(u,v))
```

The phase-aware exploratory wave solves the earliest-arrival recursion by local expansions. Flow-only uses the same recursion with `wait=0`; this is a meaningful negative control. The target return signal credits a rail if and only if it was on the winning path:

```
rail.mass <- 0.955 * rail.mass
on ACK: rail.mass <- min(1, rail.mass + 0.33 * phase_quality)
resource pool: if sum(mass) > 15, drain least-credited rails
built rail iff mass >= 0.43
```

The gates are discrete openings (not a faithful dendritic electrical model). The receiving station creates a new pulse, so this is an actual timed relay at the level of the model—not a passive drawing of a graph.

## Known limitations / next honest gates

- **Not yet a learned AI advantage.** The phase-aware search already includes the timing costs required to find the best path. The resulting 73 versus 94 difference is explanatory, not a fair claim that a new optimizer beats a strong timing-aware Dijkstra baseline.
- **No online noisy packets.** Test independent jitter on data against pilot-locked listeners, in addition to shared clock shifts.
- **The growth criterion is external.** The destination, target ACK and global material reservoir come from the experiment. No internally stored or rewritable Levin-style 'ought' has been shown.
- **Global resource allocation is a shortcut.** Replacing it with actual locally carried resources would be a meaningful next step. A realistic exploratory growth cone would also need growth costs and competing material flows through built tracks.
- **No general TSP.** Connecting one source to one target and recovering the connection does not solve an arbitrary tour over multiple cities.
- **Only fixed terrain, one clock assignment.** Randomized maps and a matched-cost recurrent matrix baseline are necessary before general claims.

## Lineage

- [`TurntableNeuron`](https://github.com/anttiluode/TurntableNeuron) — rotating gates, phase-delay addresses, listener entrainment and window sensitivity.
- [`TurntableAISol`](https://github.com/anttiluode/TurntableAISol) — multiple vertically connected yards with apical, basket and chandelier control. This new experiment does **not yet** integrate its inhibition or full multilevel topology; it isolates structural growth first.
- [`KasvavatKiskotClaude`](https://github.com/anttiluode/KasvavatKiskotClaude) — independent Claude approach, not imported or overwritten here.
- Tero et al. (2010), *Science*, "Rules for Biologically Inspired Adaptive Network Design" — physically inspired transport/flow reinforcement, not this exact clock-gated wavefront.

**Design target:** the railway should remember *which roads delivered in the right time*, not merely which roads carried the most traffic. The larger scientific question is whether that idea survives stronger baselines, stochasticity, and multiple tasks.
