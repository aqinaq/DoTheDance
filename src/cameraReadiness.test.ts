import { describe, expect, it } from 'vitest'
import { emptyReadiness, observeCamera } from './cameraReadiness'

describe('camera readiness', () => {
  it('requires a continuous clear view for 800ms', () => {
    let state = emptyReadiness()
    for (let now = 100; now < 900; now += 100) {
      state = observeCamera(state, now, null)
      expect(state.ready).toBe(false)
    }
    expect(observeCamera(state, 900, null).ready).toBe(true)
  })
  it('resets when the body is lost or another person enters', () => {
    const state = observeCamera({ since: 100, last: 900, ready: true }, 1000, 'Multiple people')
    expect(state.ready).toBe(false)
    expect(observeCamera(state, 1100, null).ready).toBe(false)
  })
  it('does not count a suspended tab as continuous observation', () => {
    const state = observeCamera({ since: 100, last: 900, ready: true }, 3000, null)
    expect(state).toEqual({ since: 3000, last: 3000, ready: false })
  })
})
