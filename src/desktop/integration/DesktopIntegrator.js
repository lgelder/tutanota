// @flow
import {log} from "../DesktopLog"

import type {WindowManager} from "../DesktopWindowManager"

let platformIntegrator: Promise<{
	enableAutoLaunch: ()=>Promise<void>,
	disableAutoLaunch: ()=>Promise<void>,
	isAutoLaunchEnabled: ()=>Promise<boolean>,
	runIntegration: (wm: WindowManager)=>Promise<void>,
	isIntegrated: ()=>Promise<boolean>,
	integrate: ()=>Promise<void>;
	unintegrate: ()=>Promise<void>;
}>

switch (process.platform) {
	case 'win32':
		platformIntegrator = import('./DesktopIntegratorWin32.js')
		break
	case 'darwin':
		platformIntegrator = import('./DesktopIntegratorDarwin.js')
		break
	case 'linux':
		platformIntegrator = import('./DesktopIntegratorLinux.js')
		break
	default:
		throw new Error('Invalid Platform')
}

export class DesktopIntegrator {
	async enableAutoLaunch(): Promise<void> {
		return (await platformIntegrator).enableAutoLaunch().catch(e => {
			log.debug("could not enable auto launch:", e)
		})
	}

	async disableAutoLaunch(): Promise<void> {
		return (await platformIntegrator).disableAutoLaunch().catch(e => {
			log.debug("could not disable auto launch:", e)
		})
	}

	async isAutoLaunchEnabled(): Promise<boolean> {
		return (await platformIntegrator).isAutoLaunchEnabled().catch(e => {
			console.error("could not check auto launch status:", e)
			return false
		})
	}

	async runIntegration(wm: WindowManager): Promise<void> {
		return (await platformIntegrator).runIntegration(wm)
	}

	async isIntegrated(): Promise<boolean> {
		return (await platformIntegrator).isIntegrated()
	}

	async integrate(): Promise<void> {
		return (await platformIntegrator).integrate()
	}

	async unintegrate(): Promise<void> {
		return (await platformIntegrator).unintegrate()
	}
}

export const integrator: DesktopIntegrator = new DesktopIntegrator()
