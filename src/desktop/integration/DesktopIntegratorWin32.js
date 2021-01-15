// @flow

import Registry from "winreg"
import type {WindowManager} from "../DesktopWindowManager"

const autoRunKey = new Registry({
	hive: Registry.HKCU,
	key: '\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
})

type Electron = $Exports<"electron">

export class DesktopIntegratorWin32 {
	_electron: Electron

	constructor(electron: Electron) {
		this._electron = electron
	}

	isAutoLaunchEnabled(): Promise<boolean> {
		// can't promisify here because it screws with autoRunKeys 'this' semantics
		return new Promise((resolve, reject) => {
			autoRunKey.get(this._electron.app.name, (err, item) => {
				if (err) {
					reject(err)
				} else {
					resolve(typeof item !== "undefined" && item !== null)
				}
			})
		}).catch(() => false)
	}

	enableAutoLaunch(): Promise<void> {
		// can't promisify here because it screws with autoRunKeys 'this' semantics
		return this.isAutoLaunchEnabled().then(enabled => enabled
			? Promise.resolve()
			: new Promise((resolve, reject) => {
				autoRunKey.set(this._electron.app.name, Registry.REG_SZ, `${process.execPath} -a`, (err) => {
					if (err) {
						reject(err)
					}
					resolve()
				})
			}))
	}

	disableAutoLaunch(): Promise<void> {
		// can't promisify here because it screws with autoRunKeys 'this' semantics
		return this.isAutoLaunchEnabled().then(enabled => enabled
			? new Promise((resolve, reject) => {
				autoRunKey.remove(this._electron.app.name, (err) => {
					if (err) {
						reject(err)
					}
					resolve()
				})
			})
			: Promise.resolve())
	}

	runIntegration(wm: WindowManager): Promise<void> {
		return Promise.resolve()
	}

	isIntegrated(): Promise<boolean> {
		return Promise.resolve(true)
	}

	integrate(): Promise<void> {
		return Promise.resolve()
	}

	unintegrate(): Promise<void> {
		return Promise.resolve()
	}
}