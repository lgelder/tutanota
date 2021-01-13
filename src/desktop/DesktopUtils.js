// @flow
import path from 'path'
import {exec, spawn} from 'child_process'
import {promisify} from 'util'
import {closeSync, openSync, promises as fs, readFileSync, unlinkSync, writeFileSync} from "fs"
import {app} from 'electron'
import {defer} from '../api/common/utils/Utils.js'
import {DesktopCryptoFacade} from "./DesktopCryptoFacade"
import {noOp} from "../api/common/utils/Utils"
import {log} from "./DesktopLog"

export class DesktopUtils {
	checkIsMailtoHandler(): Promise<boolean> {
		return Promise.resolve(app.isDefaultProtocolClient("mailto"))
	}

	/**
	 * open and close a file to make sure it exists
	 * @param path: the file to touch
	 */
	touch(path: string): void {
		closeSync(openSync(path, 'a'))
	}

	registerAsMailtoHandler(tryToElevate: boolean): Promise<void> {
		log.debug("trying to register...")
		switch (process.platform) {
			case "win32":
				return checkForAdminStatus()
					.then((isAdmin) => {
						if (!isAdmin && tryToElevate) {
							return _elevateWin(process.execPath, ["-r"])
						} else if (isAdmin) {
							return _registerOnWin()
						}
					})
			case "darwin":
				return app.setAsDefaultProtocolClient("mailto")
					? Promise.resolve()
					: Promise.reject()
			case "linux":
				return app.setAsDefaultProtocolClient("mailto")
					? Promise.resolve()
					: Promise.reject()
			default:
				return Promise.reject(new Error("Invalid process.platform"))
		}
	}

	unregisterAsMailtoHandler(tryToElevate: boolean): Promise<void> {
		log.debug("trying to unregister...")
		switch (process.platform) {
			case "win32":
				return checkForAdminStatus()
					.then((isAdmin) => {
						if (!isAdmin && tryToElevate) {
							return _elevateWin(process.execPath, ["-u"])
						} else if (isAdmin) {
							return _unregisterOnWin()
						}
					})
			case "darwin":
				return app.removeAsDefaultProtocolClient("mailto")
					? Promise.resolve()
					: Promise.reject()
			case "linux":
				return app.removeAsDefaultProtocolClient("mailto")
					? Promise.resolve()
					: Promise.reject()
			default:
				return Promise.reject(new Error(`invalid platform: ${process.platform}`))
		}
	}

	/**
	 * reads the lockfile and then writes the own version into the lockfile
	 * @returns {Promise<boolean>} whether the lock was overridden by another version
	 */
	singleInstanceLockOverridden(): Promise<boolean> {
		const lockfilePath = getLockFilePath()
		return fs.readFile(lockfilePath, 'utf8')
		         .then(version => {
			         return fs.writeFile(lockfilePath, app.getVersion(), 'utf8')
			                  .then(() => version !== app.getVersion())
		         })
		         .catch(() => false)
	}

	/**
	 * checks that there's only one instance running while
	 * allowing different versions to steal the single instance lock
	 * from each other.
	 *
	 * should the lock file be unwritable/unreadable, behaves as if all
	 * running instances have the same version, effectively restoring the
	 * default single instance lock behaviour.
	 *
	 * @returns {Promise<boolean>} whether the app was successful in getting the lock
	 */
	makeSingleInstance(): Promise<boolean> {
		const lockfilePath = getLockFilePath()
		// first, put down a file in temp that contains our version.
		// will overwrite if it already exists.
		// errors are ignored and we fall back to a version agnostic single instance lock.
		return fs.writeFile(lockfilePath, app.getVersion(), 'utf8').catch(noOp)
		         .then(() => {
			         // try to get the lock, if there's already an instance running,
			         // give the other instance time to see if it wants to release the lock.
			         // if it changes the version back, it was a different version and
			         // will terminate itself.
			         return app.requestSingleInstanceLock()
				         ? Promise.resolve(true)
				         : delay(1500)
					         .then(() => this.singleInstanceLockOverridden())
					         .then(canStay => {
						         if (canStay) {
							         app.requestSingleInstanceLock()
						         } else {
							         app.quit()
						         }
						         return canStay
					         })
		         })
	}

	/**
	 * calls the callback if the ready event was already fired,
	 * registers it as an event listener otherwise
	 * @param callback listener to call
	 */
	callWhenReady(callback: ()=>void): void {
		if (app.isReady()) {
			callback()
		} else {
			app.once('ready', callback)
		}


	}

	/**
	 * Writes files to tmp and deletes them after 3 seconds
	 * @param files Array of named content to write to tmp
	 * @returns {Array<string>} Array of the resulting paths.
	 */
	static writeFilesToTmp(files: Array<{name: string, content: string}>): Promise<Array<string>> {
		const dirPath = path.join(app.getPath('temp'), 'tutanota', DesktopCryptoFacade.randomHexString(12))
		const dirPromise = fs.mkdirp(dirPath)
		const legalNames = DesktopUtils.legalizeFilenames(files.map(f => f.name))
		const legalFiles = files.map(f => ({
			content: base64ToUint8Array(f.content),
			name: legalNames[f.name].shift()
		}))
		const writePromise = () => Promise.map(legalFiles, f => {
			const p = path.join(dirPath, f.name)
			return fs.writeFile(p, f.content)
			         .then(() => setTimeout(() => fs.remove(dirPath), 3000))
			         .then(() => p)
		})

		return dirPromise.then(writePromise)
	}
}


const singleton: DesktopUtils = new DesktopUtils()
export default singleton

/**
 * Checks if the user has admin privileges
 * @returns {Promise<boolean>} true if user has admin privileges
 */
function checkForAdminStatus(): Promise<boolean> {
	if (process.platform === 'win32') {
		return promisify(exec)('NET SESSION')
			.then(() => true)
			.catch(() => false)
	} else {
		return Promise.reject(new Error(`No NET SESSION on ${process.platform}`))
	}
}

function getLockFilePath() {
	return path.join(app.getPath('temp'), 'tutanota_desktop_lockfile')
}

/**
 * Writes contents with a random file name into the directory of the executable
 * @param contents
 * @returns {*} path  to the written file
 * @private
 */
function _writeToDisk(contents: string): string {
	const filename = DesktopCryptoFacade.randomHexString(12)
	const filePath = path.join(path.dirname(process.execPath), filename)
	writeFileSync(filePath, contents, {encoding: 'utf-8', mode: 0o400})
	return filePath
}

/**
 * uses the bundled elevate.exe to show a UAC dialog to the user and execute command with elevated permissions
 * @param command
 * @param args
 * @returns {Promise<T>}
 * @private
 */
function _elevateWin(command: string, args: Array<string>) {
	const deferred = defer()
	const elevateExe = path.join((process: any).resourcesPath, "elevate.exe")
	let elevateArgs = ["-wait", command].concat(args)
	spawn(elevateExe, elevateArgs, {
		stdio: ['ignore', 'inherit', 'inherit'],
		detached: false
	}).on('exit', (code, signal) => {
		if (code === 0) {
			deferred.resolve()
		} else {
			deferred.reject(new Error("couldn't elevate permissions"))
		}
	})
	return deferred.promise
}

/**
 * this will silently fail if we're not admin.
 * @param script: path to registry script
 * @private
 */
function _executeRegistryScript(script: string): Promise<void> {
	const deferred = defer()
	const file = _writeToDisk(script)
	spawn('reg.exe', ['import', file], {
		stdio: ['ignore', 'inherit', 'inherit'],
		detached: false
	}).on('exit', (code, signal) => {
		unlinkSync(file)
		if (code === 0) {
			deferred.resolve()
		} else {
			deferred.reject(new Error("couldn't execute registry script"))
		}
	})
	return deferred.promise
}


async function _registerOnWin() {
	const tmpRegScript = (await import('./reg-templater.js')).registerKeys(process.execPath)
	return _executeRegistryScript(tmpRegScript)
		.then(() => {
			app.setAsDefaultProtocolClient('mailto')
		})
}

async function _unregisterOnWin() {
	app.removeAsDefaultProtocolClient('mailto')
	const tmpRegScript = (await import('./reg-templater.js')).unregisterKeys()
	return _executeRegistryScript(tmpRegScript)
}

export function readJSONSync(absolutePath: string): {[string]: mixed} {
	return JSON.parse(readFileSync(absolutePath, {encoding: "utf8"}))
}

export function delay(ms: number): Promise<void> {
	return new Promise((resolve, reject) => {
		setTimeout(resolve, ms)
	})
}
export type MsgRecipient = Recipient

export type MsgParams = {
	subject: string,
	body: string,
	sender: MsgRecipient,
	tos: Array<MsgRecipient>,
	ccs: Array<MsgRecipient>,
	bccs: Array<MsgRecipient>,
	replyTos: Array<MsgRecipient>,
	attachments?: Array<FileReference>,
	sentOn?: number,
	receivedOn?: number,
	isDraft?: boolean,
	isRead?: boolean
}

export function makeMsgFile(params: MsgParams): Email {
	return new Email(!!params.isDraft, !!params.isRead)
		.subject(params.subject)
		.bodyText(params.body)
		.sender(params.sender.address, params.sender.name)
		.tos(params.tos)
		.ccs(params.ccs)
		.bccs(params.bccs)
		.replyTos(params.replyTos)
		.sentOn(params.sentOn ? new Date(params.sentOn) : null)
		.receivedOn(params.receivedOn ? new Date(params.receivedOn) : null)
}

type LogFn = (...args: any) => void
export const log: {debug: LogFn, warn: LogFn, error: LogFn} = (typeof env !== "undefined" && env.mode === Mode.Test)
	? {
		debug: noOp,
		warn: noOp,
		error: noOp,
	}
	: {
		debug: console.log.bind(console),
		warn: console.warn.bind(console),
		error: console.error.bind(console)
	}
