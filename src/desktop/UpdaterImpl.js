//@flow

import {noOp} from "../api/common/utils/Utils"

export interface UpdaterImpl {
	updatesEnabledInBuild(): boolean,

	electronUpdater: Promise<AutoUpdater>,
}

const fakeAutoUpdater: $Shape<AutoUpdater> = {
	on() {
		return this
	},
	once() {
		return this
	},
	removeListener() {
		return this
	},
	downloadUpdate() {
		return Promise.resolve([])
	},
	quitAndInstall() {},
	checkForUpdates() {
		// Never resolved, return type is too complex
		return new Promise(noOp)
	},
}


const autoUpdaterPromise =
	env.dist
		? import("electron-updater").then((m) => m.autoUpdater)
		: Promise.resolve(fakeAutoUpdater)