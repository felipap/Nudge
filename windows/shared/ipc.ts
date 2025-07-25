import { useCallback, useEffect, useRef, useState } from 'react'
import { ActiveSession, State } from '../../src/store/types'
import { AvailableProvider, ExposedElectronAPI } from './shared-types'

declare global {
  interface Window {
    electronAPI: ExposedElectronAPI
  }
}

export function getState() {
  return window.electronAPI.getState()
}

export function sendTestNotification() {
  return window.electronAPI.sendTestNotification()
}

export async function setAutoLaunch(enable: boolean) {
  return await window.electronAPI.setAutoLaunch(enable)
}

export async function getAutoLaunch() {
  return await window.electronAPI.getAutoLaunch()
}

export async function openSettings(tab?: string) {
  return await window.electronAPI.openSettings(tab)
}

export async function setWindowHeight(height: number, animate = false) {
  return await window.electronAPI.setWindowHeight(height, animate)
}

export async function getWindowHeight() {
  return await window.electronAPI.getWindowHeight()
}

export async function finishOnboarding() {
  return await window.electronAPI.finishOnboarding()
}

export async function captureNow() {
  return await window.electronAPI.captureNow()
}

export async function getGoalFeedback(goal: string) {
  return await window.electronAPI.getGoalFeedback(goal)
}

export async function validateModelKey(model: AvailableProvider, key: string) {
  return await window.electronAPI.validateModelKey(model, key)
}

export async function checkScreenPermissions() {
  return await window.electronAPI.checkScreenPermissions()
}

export async function tryAskForScreenPermission() {
  return await window.electronAPI.tryAskForScreenPermission()
}

export async function openExternal(url: string) {
  return await window.electronAPI.openExternal(url)
}

export async function openGithubDiscussion() {
  return await window.electronAPI.openGithubDiscussion()
}

export async function openSystemSettings(tab?: 'screen' | 'notifications') {
  return await window.electronAPI.openSystemSettings(tab)
}

//

export function closeWindow() {
  window.electronAPI.closeWindow()
}

export function minimizeWindow() {
  window.electronAPI.minimizeWindow()
}

export function zoomWindow() {
  window.electronAPI.zoomWindow()
}

// Session stuff

export async function pauseSession() {
  return await window.electronAPI.pauseSession()
}

export async function resumeSession() {
  return await window.electronAPI.resumeSession()
}

export async function startSession(goal: string, durationMs: number) {
  return await window.electronAPI.startSession(goal, durationMs)
}

export async function clearActiveCapture() {
  return await window.electronAPI.clearActiveCapture()
}

export async function setPartialState(state: Partial<State>) {
  return await window.electronAPI.setPartialState(state)
}

// Hooks

export function useBackendState() {
  const [loading, setLoading] = useState(true)
  const [state, setState] = useState<State | null>(null)
  const stateRef = useRef<State | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const state = await window.electronAPI.getState()
      stateRef.current = state
      setState(state)
      setLoading(false)
    }
    load()

    // Subscribe to state changes
    const unsubscribe = window.electronAPI.onStateChange((newState) => {
      stateRef.current = newState
      setState(newState)
    })

    // Cleanup subscription on unmount
    return () => {
      unsubscribe()
    }
  }, [])

  return {
    state,
    stateRef,
    setPartialState,
    loading,
  }
}

// Goals stuff

export function useGoalState() {
  const [value, setValue] = useState<ActiveSession | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const state = await window.electronAPI.getState()
      setValue(state.session)
      setLoading(false)
    }
    load()
  }, [])

  const update = useCallback(async (newValue: ActiveSession) => {
    setSaving(true)
    await window.electronAPI.setPartialState({ session: newValue })
    setValue(newValue)
    setSaving(false)
  }, [])

  return { value, loading, saving, update }
}

export function useScreenPermissionState() {
  const [value, setValue] = useState<'granted' | 'denied' | null>(null)

  useEffect(() => {
    async function check() {
      const permission = await checkScreenPermissions()
      setValue(permission ? 'granted' : 'denied')
    }
    check()
  }, [])

  return { screenPermission: value }
}

export function useLastClickedTestNudgeAt() {
  const { state } = useBackendState()
  return state?.lastClickedTestNudgeAt
    ? new Date(state.lastClickedTestNudgeAt)
    : null
}
