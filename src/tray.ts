// This file is a huge mess, please help.

import assert from 'assert'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  Menu,
  MenuItem,
  MenuItemConstructorOptions,
  Tray,
  app,
  nativeImage,
  nativeTheme,
} from 'electron'
import * as screenCapture from './lib/capture-service'
import { getImagePath, isTruthy } from './lib/utils'
import {
  IndicatorState,
  getNextCaptureAt,
  getState,
  getStateIndicator,
  hasFinishedOnboardingSteps,
  hasNoCurrentGoalOrPaused,
  isOnboardingFinished,
  onIndicatorStateChange,
  store,
} from './store'
import { onClickCheckForUpdates, updaterState } from './updater'
import { mainWindow, onboardWindow, prefWindow } from './windows'
import { logError } from './lib/logger'

dayjs.extend(relativeTime)

export function createTray() {
  assert(mainWindow)
  assert(prefWindow)

  // For a real app, you'd use a proper icon file
  // tray = new Tray(path.join(__dirname, "../../icon.png"))

  const iconPath = getTrayIconForStatus(getStateIndicator())
  const icon = nativeImage.createFromPath(iconPath)
  // if you want to resize it, be careful, it creates a copy
  const trayIcon = icon.resize({ width: 18, quality: 'best' })
  // here is the important part (has to be set on the resized version)
  trayIcon.setTemplateImage(true)

  // Set up theme change listener
  nativeTheme.on('updated', () => {
    updateTrayMenu()
  })

  const tray = new Tray(trayIcon)

  async function buildTrayMenu() {
    let template: (MenuItemConstructorOptions | MenuItem | false)[] = []
    if (!hasFinishedOnboardingSteps()) {
    } else {
      const nextCaptureAt = getNextCaptureAt()
      const captureFromNow = nextCaptureAt
        ? new Date(nextCaptureAt).getTime() - Date.now()
        : null

      // 🟢
      // If there's an active session, show button to capture now.
      if (!hasNoCurrentGoalOrPaused()) {
        const captureStatus =
          captureFromNow === null
            ? 'Status: not capturing'
            : captureFromNow < -30_000
            ? 'Status: captured (stuck?)'
            : captureFromNow < -10_000
            ? 'Status: captured just now'
            : captureFromNow < 0
            ? 'Status: capturing'
            : // : captureFromNow < 0_000
              // ? `Capturing in ${Math.floor(captureFromNow / 1000)}s`
              'Capture now (otherwise in ' +
              dayjs(nextCaptureAt).diff(dayjs(), 'seconds') +
              's)'

        template.push({
          label: captureStatus,
          click: () => {
            screenCapture.triggerCaptureAssessAndNudge()
            // ipcMain.emit('captureNow', null)
            updateTrayMenu()
          },
          enabled: !captureStatus?.startsWith('Status:'),
        })
        template.push({ type: 'separator' })
      }

      // Keep on top only applies after onboarding.
      if (isOnboardingFinished()) {
        template.push({
          label: `Keep window on top`,
          type: 'checkbox',
          checked: getState().isWindowPinned,
          click: () => {
            // If window isn't visible, show it.
            const isPinned = getState().isWindowPinned
            if (!isPinned && !mainWindow!.isVisible()) {
              mainWindow!.show()
            }

            store.setState({
              ...getState(),
              isWindowPinned: !getState().isWindowPinned,
            })
            updateTrayMenu()
          },
        })
      }
    }

    if (isOnboardingFinished()) {
      template.push({
        label: 'Settings...',
        accelerator: 'CmdOrCtrl+,',
        click: () => {
          prefWindow!.show()
        },
      })
    }

    template = template.concat([
      { type: 'separator' },
      {
        label: `Version ${app.getVersion()}${app.isPackaged ? '' : ' (dev)'}`,
        enabled: false,
      },
    ])

    if (updaterState === 'downloaded') {
      template.push({
        label: 'Quit & install update',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          app.quit()
        },
      })
    } else {
      template.push({
        enabled: updaterState !== 'downloading',
        label:
          updaterState === 'downloading'
            ? 'Downloading update...'
            : 'Check for updates...',
        click: async () => {
          await onClickCheckForUpdates()
        },
      })
      template.push({
        label: 'Quit',
        sublabel: '⌘Q',
        accelerator: 'CmdOrCtrl+Q',
        click: () => {
          // app.isQuitting = true // Do we need this?
          app.quit()
        },
      })
    }

    return template.filter(isTruthy)
  }

  async function updateTrayMenu() {
    const contextMenu = Menu.buildFromTemplate(await buildTrayMenu())
    tray.setContextMenu(contextMenu)

    const status = getStateIndicator()
    const iconPath = getTrayIconForStatus(status)
    const icon = nativeImage.createFromPath(iconPath)
    const resizedIcon = icon.resize({ width: 18, quality: 'best' })
    resizedIcon.setTemplateImage(true)
    tray.setImage(resizedIcon)
  }

  mainWindow.on('hide', () => {
    updateTrayMenu()
  })

  mainWindow.on('show', () => {
    updateTrayMenu()
  })

  onIndicatorStateChange(() => {
    updateTrayMenu()
  })

  // Set initial menu
  // tray.setToolTip('Buddy')
  updateTrayMenu()

  // Update every 2 seconds.
  setInterval(() => {
    updateTrayMenu()
  }, 2_000)

  // Optional: Show window when clicking the tray icon
  tray.on('click', () => {
    if (isOnboardingFinished()) {
      if (!mainWindow!.isFocused()) {
        mainWindow!.show()
      }
      return
    }

    if (!onboardWindow) {
      logError('onboardWindow should not be null')
      return
    }

    if (!onboardWindow.isFocused()) {
      onboardWindow.show()
    }
  })

  return tray
}

function getTrayIconForStatus(status: IndicatorState) {
  // const suffix = nativeTheme.shouldUseDarkColors ? '-white' : ''
  // return path.join(base, `nudge-capturingTemplate.png`)

  if (status === 'capturing') {
    return getImagePath(`nudge-capturing.png`)
  } else if (status === 'assessing') {
    return getImagePath(`nudge-assessing.png`)
  } else if (status === 'inactive' || status === 'paused') {
    return getImagePath(`nudge-inactive.png`)
  } else {
    return getImagePath(`nudge-default.png`)
  }
}
