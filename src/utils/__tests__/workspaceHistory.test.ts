import { describe, expect, it } from 'vitest';
import { WorkspaceHistory } from '../workspaceHistory';
import { cloneBuildingModel } from '../buildingModel';
import type { BuildingModel } from '../../types/building';
const model = (x=0) => cloneBuildingModel({id:'a',points:[{x,y:0,z:0},{x:x+10,y:0,z:0},{x,y:0,z:10}],floors:3,floorHeight:3,createdAt:new Date(0)} as BuildingModel);
describe('workspace history', () => {
  it('isolates pure snapshots, supports creation/deletion and clears redo after a new edit', () => {
    const history=new WorkspaceHistory(), building=model();
    history.record('Create',[],[building],'a'); building.points[0].x=999;
    expect(history.undo()?.models).toEqual([]);
    expect(history.redo()?.models[0].points[0].x).toBe(0);
    history.record('Delete',[model()],[],'a');
    expect(history.undo()?.models).toHaveLength(1);
    history.record('Move',[model()],[model(2)],'a');
    expect(history.canRedo).toBe(false);
    expect(history.record('No-op',[model(2)],[model(2)],'a')).toBe(false);
  });
  it('retains 100 commands and resets both stacks at workspace boundaries', () => {
    const history=new WorkspaceHistory();
    for(let i=0;i<120;i++) history.record('Move',[model(i)],[model(i+1)],'a');
    expect(history.size).toBe(100);
    for(let i=0;i<100;i++) expect(history.undo()).not.toBeNull();
    expect(history.undo()).toBeNull();
    history.clear(); expect(history.canRedo).toBe(false); expect(history.canUndo).toBe(false);
  });
});
