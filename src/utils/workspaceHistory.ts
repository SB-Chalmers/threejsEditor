import type { BuildingModel } from '../types/building';
import { cloneBuildingModels } from './buildingModel';

export interface WorkspaceCommand {
  label: string;
  before: BuildingModel[];
  after: BuildingModel[];
  selection: string | null;
}

/** Pure model snapshots only: no scene resources or references to mutable drafts. */
export class WorkspaceHistory {
  private past: WorkspaceCommand[] = [];
  private future: WorkspaceCommand[] = [];
  get canUndo() { return this.past.length > 0; }
  get canRedo() { return this.future.length > 0; }
  get size() { return this.past.length; }
  record(label: string, before: BuildingModel[], after: BuildingModel[], selection: string | null) {
    if (JSON.stringify(before) === JSON.stringify(after)) return false;
    this.past.push({ label, before: cloneBuildingModels(before), after: cloneBuildingModels(after), selection });
    if (this.past.length > 100) this.past.shift();
    this.future = [];
    return true;
  }
  undo() {
    const command = this.past.pop();
    if (!command) return null;
    this.future.push(command);
    return { models: cloneBuildingModels(command.before), selection: command.selection };
  }
  redo() {
    const command = this.future.pop();
    if (!command) return null;
    this.past.push(command);
    return { models: cloneBuildingModels(command.after), selection: command.selection };
  }
  clear() { this.past = []; this.future = []; }
}
