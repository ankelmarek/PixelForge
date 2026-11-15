/** Offline full-campaign balance probe using public player commands. */
import fs from 'node:fs';
import { StationModel } from '../../src/games/gas-station/model';
import { stationWorld } from './station';
import { operateWeekend, washRoad, type Strategy } from './station-campaign';
import { VARIANTS } from '../../src/games/gas-station/scenarios';
import { bodies } from '../../src/games/gas-station/state';
const reports = [];
for (const variant of VARIANTS)
  for (const seed of [731, 9021])
    for (const strategy of ['own', 'retail', 'tenant'] as Strategy[]) {
      const m = new StationModel(stationWorld, seed, true, true, variant);
      let maxUnits = 0;
      for (let i = 0; i < 36000 && !m.state.result; i++) {
        operateWeekend(m, strategy);
        m.tick();
        maxUnits = Math.max(maxUnits, bodies(m.state).length);
        if (i % 6000 === 0) m.validateSave(m.snapshot());
      }
      const s = m.state;
      m.validateSave(m.snapshot());
      const row = {
        variant,
        seed,
        strategy,
        result: s.result,
        served: s.served,
        lost: s.lost,
        goal: m.goal,
        profit: m.profit,
        worth: m.netWorth,
        rating: s.satisfaction / s.visits / 100,
        maxUnits,
        energy: s.campaign!.scenario!.energyCharged,
        wages: s.development!.wageTotal,
      };
      reports.push(row);
      console.log(JSON.stringify(row));
      fs.writeFileSync(
        `work/s4/last-${variant}-${seed}-${strategy}.json`,
        JSON.stringify(m.snapshot()),
      );
      fs.writeFileSync(
        'work/s4/balance.json',
        JSON.stringify(reports, null, 2) + '\n',
      );
    }
for (const seed of [731, 9021]) {
  const m = new StationModel(stationWorld, seed, true, true, 'highway');
  washRoad(m);
  m.hire();
  m.build(
    { kind: 'heavy-pump', point: { x: 84, y: 118 }, rotation: 0, fuel: 'on' },
    m.state.topology,
  );
  let maxUnits = 0;
  for (let i = 0; i < 36000 && !m.state.result; i++) {
    operateWeekend(m, 'retail');
    m.tick();
    maxUnits = Math.max(maxUnits, bodies(m.state).length);
  }
  m.validateSave(m.snapshot());
  const s = m.state;
  const row = {
    variant: 'highway',
    seed,
    strategy: 'heavy',
    result: s.result,
    served: s.served,
    lost: s.lost,
    goal: m.goal,
    profit: m.profit,
    worth: m.netWorth,
    rating: s.satisfaction / s.visits / 100,
    maxUnits,
  };
  reports.push(row);
  console.log(JSON.stringify(row));
  fs.writeFileSync(
    'work/s4/balance.json',
    JSON.stringify(reports, null, 2) + '\n',
  );
}

if (reports.some((r) => r.result !== 'success'))
  throw Error('Station balance: unsuccessful campaign');
