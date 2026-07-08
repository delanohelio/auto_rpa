import cron from 'node-cron';
import parser from 'cron-parser';
import { db } from '../db/db.js';
import { runTask } from '../runner/engine.js';

// Map to hold running node-cron job objects
const activeJobs = new Map();

/**
 * Calculates the next execution timestamp from a cron expression.
 */
export function getNextRun(cronExpression) {
  try {
    const interval = parser.parseExpression(cronExpression);
    return interval.next().toISOString();
  } catch (error) {
    console.error(`Invalid cron expression calculation: "${cronExpression}"`, error.message);
    return null;
  }
}

/**
 * Validates whether a cron expression is syntactically correct.
 */
export function isValidCron(cronExpression) {
  return cron.validate(cronExpression);
}

/**
 * Starts a single schedule job.
 */
export function startSchedule(sched) {
  // If schedule is disabled, just compute next run and return
  if (!sched.enabled) {
    db.saveSchedule({
      id: sched.id,
      nextRun: null
    });
    return;
  }

  if (!isValidCron(sched.cronExpression)) {
    console.error(`Cannot start schedule ${sched.id}: invalid cron expression "${sched.cronExpression}"`);
    return;
  }

  // Stop existing job if already running
  stopSchedule(sched.id);

  console.log(`Scheduling Task: "${sched.taskId}" with cron: "${sched.cronExpression}" (Schedule ID: ${sched.id})`);

  // Create the node-cron job
  const job = cron.schedule(sched.cronExpression, async () => {
    console.log(`Cron triggered for Schedule ${sched.id} (Task: ${sched.taskId})`);
    
    // Update last run time and compute next run
    const lastRun = new Date().toISOString();
    const nextRun = getNextRun(sched.cronExpression);
    
    db.saveSchedule({
      id: sched.id,
      lastRun,
      nextRun
    });

    try {
      // Execute the task in the background
      await runTask(sched.taskId);
    } catch (err) {
      console.error(`Error running scheduled task ${sched.taskId}:`, err.message);
    }
  });

  // Store the job object
  activeJobs.set(sched.id, job);

  // Update DB with the calculated next execution time
  const nextRun = getNextRun(sched.cronExpression);
  db.saveSchedule({
    id: sched.id,
    nextRun
  });
}

/**
 * Stops a scheduled job.
 */
export function stopSchedule(id) {
  const job = activeJobs.get(id);
  if (job) {
    job.stop();
    activeJobs.delete(id);
    console.log(`Stopped schedule job: ${id}`);
  }
}

/**
 * Initializes the scheduler on application startup.
 * Loads and schedules all active entries in the DB.
 */
export function initScheduler() {
  console.log('Initializing scheduler system...');
  const schedules = db.getSchedules();

  for (const sched of schedules) {
    if (sched.enabled) {
      startSchedule(sched);
    } else {
      // Reset next run for disabled schedules
      db.saveSchedule({
        id: sched.id,
        nextRun: null
      });
    }
  }

  // Schedule the auto-cleanup check daily at midnight
  cron.schedule('0 0 * * *', () => {
    console.log('Running daily auto-cleanup check...');
    try {
      db.cleanExpiredLogs();
    } catch (err) {
      console.error('Error running daily auto-cleanup check:', err);
    }
  });

  // Run cleanup once immediately on startup
  try {
    db.cleanExpiredLogs();
  } catch (err) {
    console.error('Error running initial auto-cleanup check:', err);
  }

  console.log(`Scheduler initialized. Loaded ${activeJobs.size} active schedules.`);
}
