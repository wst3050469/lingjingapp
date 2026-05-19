import { ipcMain, type BrowserWindow } from 'electron';
import { getDatabase, saveDatabase } from '../db/database.js';
import { getPlanManager } from '@codepilot/core';
function safeJsonParse<T>(val: unknown, fallback: T): T {
  if (typeof val !== 'string') return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}


export function registerPlanIpc(mainWindow: BrowserWindow): void {
  const planManager = getPlanManager();

  // Save plan to database
  async function savePlanToDb(plan: any): Promise<void> {
    const db = getDatabase();

    // Upsert plan
    const existingPlan = db.prepare('SELECT id FROM plans WHERE id = ?');
    existingPlan.bind([plan.id]);
    const planExists = existingPlan.step();
    existingPlan.free();

    if (planExists) {
      db.run(
        `UPDATE plans SET
          title = ?, description = ?, goals = ?, constraints = ?,
          status = ?, current_step_index = ?, working_directory = ?,
          retrospective = ?, updated_at = datetime('now'),
          completed_at = ?
        WHERE id = ?`,
        [
          plan.title,
          plan.description,
          JSON.stringify(plan.goals),
          JSON.stringify(plan.constraints),
          plan.status,
          plan.currentStepIndex,
          plan.workingDirectory,
          plan.retrospective || null,
          plan.completedAt || null,
          plan.id,
        ]
      );

      // Update steps
      db.run('DELETE FROM plan_steps WHERE plan_id = ?', [plan.id]);
    } else {
      db.run(
        `INSERT INTO plans (id, title, description, goals, constraints, status, current_step_index, working_directory, retrospective, completed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          plan.id,
          plan.title,
          plan.description,
          JSON.stringify(plan.goals),
          JSON.stringify(plan.constraints),
          plan.status,
          plan.currentStepIndex,
          plan.workingDirectory,
          plan.retrospective || null,
          plan.completedAt || null,
        ]
      );
    }

    // Insert steps
    for (let i = 0; i < plan.steps.length; i++) {
      const step = plan.steps[i];
      db.run(
        `INSERT INTO plan_steps (id, plan_id, step_index, title, description, files, commands, status, estimated_complexity, result, error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          step.id,
          plan.id,
          i,
          step.title,
          step.description,
          JSON.stringify(step.files || []),
          JSON.stringify(step.commands || []),
          step.status,
          step.estimatedComplexity || null,
          step.result || null,
          step.error || null,
        ]
      );
    }

    await saveDatabase();
  }

  // Load plan from database
  async function loadPlanFromDb(planId: string): Promise<any | null> {
    const db = getDatabase();

    const planStmt = db.prepare('SELECT * FROM plans WHERE id = ?');
    planStmt.bind([planId]);
    if (!planStmt.step()) {
      planStmt.free();
      return null;
    }
    const planRow = planStmt.getAsObject() as any;
    planStmt.free();

    const stepsStmt = db.prepare('SELECT * FROM plan_steps WHERE plan_id = ? ORDER BY step_index');
    stepsStmt.bind([planId]);
    const steps: any[] = [];
    while (stepsStmt.step()) {
      const stepRow = stepsStmt.getAsObject() as any;
      steps.push({
        id: stepRow.id,
        title: stepRow.title,
        description: stepRow.description,
        files: safeJsonParse(stepRow.files, []),
        commands: safeJsonParse(stepRow.commands, []),
        status: stepRow.status,
        estimatedComplexity: stepRow.estimated_complexity,
        result: stepRow.result,
        error: stepRow.error,
      });
    }
    stepsStmt.free();

    return {
      id: planRow.id,
      title: planRow.title,
      description: planRow.description,
      goals: safeJsonParse(planRow.goals, []),
      constraints: safeJsonParse(planRow.constraints, []),
      steps,
      status: planRow.status,
      currentStepIndex: planRow.current_step_index,
      workingDirectory: planRow.working_directory,
      retrospective: planRow.retrospective,
      createdAt: new Date(planRow.created_at).getTime(),
      updatedAt: new Date(planRow.updated_at).getTime(),
      completedAt: planRow.completed_at ? new Date(planRow.completed_at).getTime() : undefined,
    };
  }

  // Load all plans for a working directory
  async function loadPlansFromDb(workingDirectory: string): Promise<any[]> {
    const db = getDatabase();

    const stmt = db.prepare('SELECT * FROM plans WHERE working_directory = ? ORDER BY created_at DESC');
    stmt.bind([workingDirectory]);
    const plans: any[] = [];
    while (stmt.step()) {
      const row = stmt.getAsObject() as any;
      const plan = await loadPlanFromDb(row.id);
      if (plan) plans.push(plan);
    }
    stmt.free();

    return plans;
  }

  // Plan update handler
  ipcMain.handle('plan:update', async (_event, { planId, updates }: { planId: string; updates: any }) => {
    try {
      const plan = planManager.getPlan(planId);
      if (!plan) {
        return { success: false, error: 'Plan not found' };
      }

      Object.assign(plan, updates, { updatedAt: Date.now() });
      await savePlanToDb(plan);

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent:event', { type: 'plan_updated', plan });
      }

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // Plan approve handler
  ipcMain.handle('plan:approve', async (_event, { planId }: { planId: string }) => {
    try {
      planManager.setPlanStatus(planId, 'approved');
      const plan = planManager.getPlan(planId);
      if (plan) {
        await savePlanToDb(plan);
      }
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // Plan pause handler
  ipcMain.handle('plan:pause', async (_event, { planId }: { planId: string }) => {
    try {
      planManager.setPlanStatus(planId, 'paused');
      const plan = planManager.getPlan(planId);
      if (plan) {
        await savePlanToDb(plan);
      }
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // Plan resume handler
  ipcMain.handle('plan:resume', async (_event, { planId }: { planId: string }) => {
    try {
      planManager.setPlanStatus(planId, 'executing');
      const plan = planManager.getPlan(planId);
      if (plan) {
        await savePlanToDb(plan);
      }
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // Plan cancel handler
  ipcMain.handle('plan:cancel', async (_event, { planId }: { planId: string }) => {
    try {
      planManager.setPlanStatus(planId, 'cancelled');
      const plan = planManager.getPlan(planId);
      if (plan) {
        await savePlanToDb(plan);
      }
      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // Plan export handler
  ipcMain.handle('plan:export', async (_event, { planId }: { planId: string }) => {
    try {
      const plan = planManager.getPlan(planId);
      if (!plan) {
        return { success: false, error: 'Plan not found' };
      }
      return { success: true, plan };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // Plan import handler
  ipcMain.handle('plan:import', async (_event, { planData, workingDirectory }: { planData: any; workingDirectory: string }) => {
    try {
      const plan = planManager.createPlan({
        ...planData,
        workingDirectory,
      });
      await savePlanToDb(plan);
      return { success: true, planId: plan.id };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // Plan delete handler
  ipcMain.handle('plan:delete', async (_event, { planId }: { planId: string }) => {
    try {
      const db = getDatabase();
      db.run('DELETE FROM plan_steps WHERE plan_id = ?', [planId]);
      db.run('DELETE FROM plans WHERE id = ?', [planId]);
      planManager.deletePlan(planId);
      await saveDatabase();

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent:event', { type: 'plan_deleted', planId });
      }

      return { success: true };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // Plan load handler
  ipcMain.handle('plan:load', async (_event, { planId, workingDirectory }: { planId: string; workingDirectory: string }) => {
    try {
      const plan = await loadPlanFromDb(planId);
      if (!plan) {
        return { success: false, error: 'Plan not found in database' };
      }

      // Register in memory
      planManager.registerPlan(plan);

      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.send('agent:event', { type: 'plan_loaded', plan });
      }

      return { success: true, plan };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      return { success: false, error: msg };
    }
  });

  // Plan templates handler
  ipcMain.handle('plan:templates', async () => {
    return {
      success: true,
      templates: [
        {
          id: 'template-feature',
          name: 'New Feature',
          description: 'Implement a new feature with proper structure',
          goals: ['Understand requirements', 'Design implementation', 'Code', 'Test', 'Document'],
          steps: [
            { title: 'Requirements Analysis', description: 'Review and clarify requirements', estimatedComplexity: 'medium' },
            { title: 'Design', description: 'Design the implementation approach', estimatedComplexity: 'high' },
            { title: 'Implementation', description: 'Write the code', estimatedComplexity: 'high' },
            { title: 'Testing', description: 'Write and run tests', estimatedComplexity: 'medium' },
            { title: 'Documentation', description: 'Update documentation', estimatedComplexity: 'low' },
          ],
        },
        {
          id: 'template-refactor',
          name: 'Refactoring',
          description: 'Refactor existing code safely',
          goals: ['Identify refactoring scope', 'Maintain behavior', 'Improve structure'],
          steps: [
            { title: 'Analysis', description: 'Analyze current code structure', estimatedComplexity: 'medium' },
            { title: 'Test Coverage', description: 'Ensure adequate test coverage', estimatedComplexity: 'medium' },
            { title: 'Refactor', description: 'Perform the refactoring', estimatedComplexity: 'high' },
            { title: 'Verification', description: 'Run tests and verify behavior', estimatedComplexity: 'medium' },
          ],
        },
        {
          id: 'template-bugfix',
          name: 'Bug Fix',
          description: 'Investigate and fix a bug',
          goals: ['Reproduce bug', 'Identify root cause', 'Fix', 'Verify'],
          steps: [
            { title: 'Reproduction', description: 'Reproduce the bug', estimatedComplexity: 'low' },
            { title: 'Root Cause Analysis', description: 'Find the root cause', estimatedComplexity: 'medium' },
            { title: 'Fix Implementation', description: 'Implement the fix', estimatedComplexity: 'medium' },
            { title: 'Testing', description: 'Test the fix and edge cases', estimatedComplexity: 'medium' },
          ],
        },
      ],
    };
  });
}
