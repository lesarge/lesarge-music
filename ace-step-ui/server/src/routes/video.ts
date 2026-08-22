import { Router, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { pool } from '../db/pool.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { config } from '../config/index.js';
import { generateUUID } from '../db/sqlite.js';

const router = Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const VIDEO_API = config.video.apiUrl;

interface VideoParams {
  prompt: string;
  negative_prompt?: string;
  num_frames?: number;
  fps?: number;
  width?: number;
  height?: number;
  num_inference_steps?: number;
  guidance_scale?: number;
  seed?: number | null;
}

async function videoServiceHealthy(): Promise<boolean> {
  try {
    const res = await fetch(`${VIDEO_API}/v1/health`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

async function submitVideoJob(params: VideoParams): Promise<string> {
  const res = await fetch(`${VIDEO_API}/v1/video/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Video service rejected request (${res.status}): ${body.slice(0, 300)}`);
  }
  const data = await res.json();
  return data.job_id as string;
}

async function getVideoStatus(taskId: string): Promise<any> {
  const res = await fetch(`${VIDEO_API}/v1/video/status/${taskId}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Video status request failed (${res.status})`);
  return res.json();
}

// GET /api/video/health — public, for UI status
router.get('/health', async (_req, res) => {
  const healthy = await videoServiceHealthy();
  res.json({ healthy, videoUrl: config.video.apiUrl });
});

// POST /api/video/generate — start a video generation job
router.post('/generate', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const {
      prompt,
      negative_prompt,
      num_frames,
      fps,
      width,
      height,
      num_inference_steps,
      guidance_scale,
      seed,
    } = req.body || {};

    if (!prompt || !String(prompt).trim()) {
      res.status(400).json({ error: 'prompt is required' });
      return;
    }

    if (!(await videoServiceHealthy())) {
      res.status(503).json({ error: 'Video generator is not running. Start the app to launch it.' });
      return;
    }

    const params: VideoParams = {
      prompt: String(prompt).trim(),
      negative_prompt: negative_prompt ? String(negative_prompt) : undefined,
      num_frames: num_frames ? Math.max(4, Math.min(32, Number(num_frames))) : 16,
      fps: fps ? Math.max(4, Math.min(30, Number(fps))) : 8,
      width: width ? Math.max(128, Math.min(512, Number(width))) : 256,
      height: height ? Math.max(128, Math.min(512, Number(height))) : 256,
      num_inference_steps: num_inference_steps ? Math.max(4, Math.min(60, Number(num_inference_steps))) : 12,
      guidance_scale: guidance_scale ? Number(guidance_scale) : 7.5,
      seed: seed === undefined ? null : Number(seed),
    };

    const localJobId = generateUUID();
    const taskId = await submitVideoJob(params);

    const { rows } = await pool.query(
      `INSERT INTO video_jobs (id, user_id, video_task_id, status, params, created_at, updated_at)
       VALUES (?, ?, ?, 'running', ?, datetime('now'), datetime('now')) RETURNING id`,
      [localJobId, req.user!.id, taskId, JSON.stringify(params)]
    );

    res.status(201).json({ jobId: localJobId, videoTaskId: taskId });
  } catch (error) {
    next(error);
  }
});

// GET /api/video/status/:jobId — poll job status
router.get('/status/:jobId', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const jobResult = await pool.query(
      `SELECT id, user_id, video_task_id, status, params, result, error, created_at
       FROM video_jobs WHERE id = ?`,
      [req.params.jobId]
    );
    if (jobResult.rows.length === 0) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }
    const job = jobResult.rows[0] as any;
    if (job.user_id !== req.user!.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (['pending', 'queued', 'running'].includes(job.status) && job.video_task_id) {
      try {
        const vStatus = await getVideoStatus(job.video_task_id);

        if (['done', 'failed'].includes(vStatus.status) && vStatus.status !== job.status) {
          let resultJson: string | null = null;
          let errorText: string | null = null;

          if (vStatus.status === 'done') {
            // Download the mp4 from the video service into the audio dir
            const dir = path.join(config.storage.audioDir, 'videos');
            fs.mkdirSync(dir, { recursive: true });
            const filename = `${req.params.jobId}.mp4`;
            const destPath = path.join(dir, filename);

            const fileRes = await fetch(`${VIDEO_API}/video/${vStatus.filename}`, {
              signal: AbortSignal.timeout(120000),
            });
            if (!fileRes.ok) throw new Error(`Failed to download video (${fileRes.status})`);
            const buffer = Buffer.from(await fileRes.arrayBuffer());
            const tmpPath = destPath + '.tmp';
            fs.writeFileSync(tmpPath, buffer);
            fs.renameSync(tmpPath, destPath);

            resultJson = JSON.stringify({ videoUrl: `/audio/videos/${filename}`, ...vStatus });
          } else {
            errorText = vStatus.error || 'Video generation failed';
          }

          await pool.query(
            `UPDATE video_jobs SET status = ?, result = ?, error = ?, updated_at = datetime('now') WHERE id = ?`,
            [vStatus.status, resultJson, errorText, req.params.jobId]
          );
          job.status = vStatus.status;
          job.result = resultJson;
          job.error = errorText;
        } else if (vStatus.status === 'running') {
          // mirror progress
          if (vStatus.progress !== undefined) {
            await pool.query(
              `UPDATE video_jobs SET updated_at = datetime('now') WHERE id = ?`,
              [req.params.jobId]
            );
            job.progress = vStatus.progress;
          }
        }
      } catch (statusErr) {
        // Video service temporarily unreachable - keep job as-is
      }
    }

    res.json({
      jobId: req.params.jobId,
      status: job.status,
      progress: job.progress ?? 0,
      result: job.result ? JSON.parse(job.result) : null,
      error: job.error,
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/video/history — recent video jobs for the user
router.get('/history', authMiddleware, async (req: AuthenticatedRequest, res: Response, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, status, params, result, error, created_at FROM video_jobs
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      [req.user!.id]
    );
    res.json({ jobs: rows });
  } catch (error) {
    next(error);
  }
});

export default router;
