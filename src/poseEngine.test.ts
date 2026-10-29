import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const model = vi.hoisted(() => ({
  create: vi.fn(),
  detect: vi.fn(() => ({ landmarks: [] })),
  close: vi.fn(),
}))
vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vi.fn(async () => ({})) },
  PoseLandmarker: { createFromOptions: model.create },
}))
import { analyzeVideo } from './poseEngine'

describe('video dancer modes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    model.create.mockResolvedValue({ detect: model.detect, close: model.close })
    const context = {
      drawImage: vi.fn(),
      getImageData: () => ({ width: 1, height: 1, data: new Uint8ClampedArray(4) }),
    }
    vi.stubGlobal('document', {
      createElement: (tag: string) => tag === 'video' ? {
        readyState: 2, currentTime: 0, videoWidth: 360, videoHeight: 640,
        removeAttribute: vi.fn(), load: vi.fn(),
      } : { width: 0, height: 0, getContext: () => context },
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it('defaults to one pose and never adds crop detections to solo videos', async () => {
    const progress = vi.fn()
    const frames = await analyzeVideo('blob:solo', 0, .01, new AbortController().signal, progress)
    expect(model.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ numPoses: 1, runningMode: 'IMAGE' }))
    expect(model.detect).toHaveBeenCalledTimes(frames.length)
    expect(progress).toHaveBeenLastCalledWith(100)
    expect(model.close).toHaveBeenCalledOnce()
  })

  it('keeps six-person detection and both crop passes available in group mode', async () => {
    const frames = await analyzeVideo('blob:group', 0, .01, new AbortController().signal, vi.fn(), 'group')
    expect(model.create).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ numPoses: 6 }))
    expect(model.detect).toHaveBeenCalledTimes(frames.length * 3)
    expect(model.close).toHaveBeenCalledOnce()
  })

  it('releases the detector when analysis is cancelled', async () => {
    const controller = new AbortController()
    await expect(analyzeVideo('blob:solo', 0, .01, controller.signal, () => controller.abort(), 'single')).rejects.toMatchObject({ name: 'AbortError' })
    expect(model.detect).toHaveBeenCalledOnce()
    expect(model.close).toHaveBeenCalledOnce()
  })
})
