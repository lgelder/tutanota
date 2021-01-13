// @flow
import {lang} from "../misc/LanguageViewModel"
import type {WindowManager} from "./DesktopWindowManager.js"
import {defer} from '../api/common/utils/Utils.js'
import type {DeferredObject} from "../api/common/utils/Utils"
import {downcast, neverNull, noOp} from "../api/common/utils/Utils"
import {errorToObj, objToError} from "../api/common/WorkerProtocol"
import type {DesktopConfig} from "./config/DesktopConfig"
import type {DesktopSseClient} from './sse/DesktopSseClient.js'
import type {DesktopNotifier} from "./DesktopNotifier"
import type {Socketeer} from "./Socketeer"
import type {DesktopAlarmStorage} from "./sse/DesktopAlarmStorage"
import type {DesktopCryptoFacade} from "./DesktopCryptoFacade"
import type {DesktopDownloadManager} from "./DesktopDownloadManager"
import type {SseInfo} from "./sse/DesktopSseClient"
import {base64ToUint8Array, uint8ArrayToBase64} from "../api/common/utils/Encoding"
import {makeMsgFile} from "./DesktopUtils"
import type {ElectronUpdater} from "./ElectronUpdater"
import {DesktopConfigKey} from "./config/ConfigKeys";
import {log} from "./DesktopLog";
import type {DesktopUtils} from "./DesktopUtils"
import type {DesktopErrorHandler} from "./DesktopErrorHandler"
import type {DesktopIntegrator} from "./integration/DesktopIntegrator"

/**
 * node-side endpoint for communication between the renderer thread and the node thread
 */
export class IPC {
	_conf: DesktopConfig;
	_sse: DesktopSseClient;
	_wm: WindowManager;
	_notifier: DesktopNotifier;
	_sock: Socketeer;
	_alarmStorage: DesktopAlarmStorage;
	_crypto: DesktopCryptoFacade;
	_dl: DesktopDownloadManager;
	_initialized: Array<DeferredObject<void>>;
	_requestId: number = 0;
	_queue: {[string]: Function};
	_updater: ?ElectronUpdater;
	_electron: $Exports<"electron">;
	_desktopUtils: DesktopUtils;
	_err: DesktopErrorHandler;
	_integrator: DesktopIntegrator ;

	constructor(
		conf: DesktopConfig,
		notifier: DesktopNotifier,
		sse: DesktopSseClient,
		wm: WindowManager,
		sock: Socketeer,
		alarmStorage: DesktopAlarmStorage,
		desktopCryptoFacade: DesktopCryptoFacade,
		dl: DesktopDownloadManager,
		updater: ?ElectronUpdater,
		electron: $Exports<"electron">,
		desktopUtils: DesktopUtils,
		errorHandler: DesktopErrorHandler,
		integrator: DesktopIntegrator,
	) {
		this._conf = conf
		this._sse = sse
		this._wm = wm
		this._notifier = notifier
		this._sock = sock
		this._alarmStorage = alarmStorage
		this._crypto = desktopCryptoFacade
		this._dl = dl
		this._updater = updater
		this._electron = electron
		this._desktopUtils = desktopUtils
		this._err = errorHandler
		this._integrator = integrator
		if (!!this._updater) {
			this._updater.setUpdateDownloadedListener(() => {
				this._wm.getAll().forEach(w => this.sendRequest(w.id, 'appUpdateDownloaded', []))
			})
		}

		this._initialized = []
		this._queue = {}
		this._err = errorHandler
	}

	_invokeMethod(windowId: number, method: NativeRequestType, args: Array<Object>): Promise<any> {

		switch (method) {
			case 'init':
				this._initialized[windowId].resolve()
				return Promise.resolve(process.platform)
			case 'findInPage':
				return this.initialized(windowId).then(() => {
					const w = this._wm.get(windowId)
					if (w) {
						// findInPage might reject if requests come too quickly
						// if it's rejecting for another reason we'll have logs
						return w.findInPage(args)
						        .catch(e => log.debug("findInPage reject:", args, e))
					} else {
						return {numberOfMatches: 0, currentMatch: 0}
					}
				})
			case 'stopFindInPage':
				return this.initialized(windowId).then(() => {
					const w = this._wm.get(windowId)
					if (w) {
						w.stopFindInPage()
					}
				}).catch(noOp)
			case 'setSearchOverlayState': {
				const w = this._wm.get(windowId)
				if (w) {
					const state: boolean = downcast(args[0])
					const force: boolean = downcast(args[1])
					w.setSearchOverlayState(state, force)
				}
				return Promise.resolve()
			}
			case 'registerMailto':
				return this._desktopUtils.registerAsMailtoHandler(true)
			case 'unregisterMailto':
				return this._desktopUtils.unregisterAsMailtoHandler(true)
			case 'integrateDesktop':
				return this._integrator.integrate()
			case 'unIntegrateDesktop':
				return this._integrator.unintegrate()
			case 'sendDesktopConfig':
				return Promise.all([
					this._desktopUtils.checkIsMailtoHandler(),
					this._integrator.isAutoLaunchEnabled(),
					this._integrator.isIntegrated()
				]).then(([isMailtoHandler, autoLaunchEnabled, isIntegrated]) => {
					const config = this._conf.getVar()
					config.isMailtoHandler = isMailtoHandler
					config.runOnStartup = autoLaunchEnabled
					config.isIntegrated = isIntegrated
					config.updateInfo = !!this._updater
						? this._updater.updateInfo
						: null
					return config
				})
			case 'openFileChooser':
				if (args[1]) { // open folder dialog
					return this._electron.dialog.showOpenDialog(null, {properties: ['openDirectory']}).then(({filePaths}) => filePaths)
				} else { // open file
					return Promise.resolve([])
				}
			case 'open':
				// itemPath, mimeType
				const itemPath = args[0].toString()
				return this._dl.open(itemPath)
			case 'download':
				// sourceUrl, filename, headers
				return this._dl.downloadNative(...args.slice(0, 3))
			case 'saveBlob':
				// args: [data.name, uint8ArrayToBase64(data.data)]
				const filename: string = downcast(args[0])
				const data: Uint8Array = base64ToUint8Array(downcast(args[1]))
				return this._dl.saveBlob(filename, data, neverNull(this._wm.get(windowId)))
			case "aesDecryptFile":
				// key, path
				return this._crypto.aesDecryptFile(...args.slice(0, 2))
			case 'updateDesktopConfig':
				return this._conf.setVar('any', args[0])
			case 'openNewWindow':
				this._wm.newWindow(true)
				return Promise.resolve()
			case 'showWindow':
				return this.initialized(windowId).then(() => {
					const w = this._wm.get(windowId)
					if (w) {
						w.show()
					}
				})
			case 'enableAutoLaunch':
				return this._integrator.enableAutoLaunch()
			case 'disableAutoLaunch':
				return this._integrator.disableAutoLaunch()
			case 'getPushIdentifier':
				const uInfo = {
					userId: args[0].toString(),
					mailAddress: args[1].toString()
				}
				// we know there's a logged in window
				// first, send error report if there is one
				return this._err.sendErrorReport(windowId)
				           .then(() => {
					           const w = this._wm.get(windowId)
					           if (!w) return
					           w.setUserInfo(uInfo)
					           if (!w.isHidden()) {
						           this._notifier.resolveGroupedNotification(uInfo.userId)
					           }
					           const sseInfo = this._sse.getPushIdentifier()
					           return sseInfo && sseInfo.identifier
				           })
			case 'storePushIdentifierLocally':
				return Promise.all([
					this._sse.storePushIdentifier(
						args[0].toString(),
						args[1].toString(),
						args[2].toString()
					),
					this._alarmStorage.storePushIdentifierSessionKey(
						args[3].toString(),
						args[4].toString()
					)
				]).then(() => {})
			case 'initPushNotifications':
				// Nothing to do here because sse connection is opened when starting the native part.
				return Promise.resolve()
			case 'closePushNotifications':
				// only gets called in the app
				// the desktop client closes notifications on window focus
				return Promise.resolve()
			case 'sendSocketMessage':
				// for admin client integration
				this._sock.sendSocketMessage(args[0])
				return Promise.resolve()
			case 'getLog':
				return Promise.resolve(global.logger.getEntries())
			case 'unload':
				// On reloading the page reset window state to non-initialized because render process starts from scratch.
				this.removeWindow(windowId)
				this.addWindow(windowId)
				return Promise.resolve()
			case 'changeLanguage':
				return lang.setLanguage(args[0])
			case 'manualUpdate':
				return !!this._updater
					? this._updater.manualUpdate()
					: Promise.resolve(false)
			case 'isUpdateAvailable':
				return !!this._updater
					? Promise.resolve(this._updater.updateInfo)
					: Promise.resolve(null)
			case 'dragExport': {
				const w = this._wm.get(windowId)
				if (w) {
					return DesktopUtils.writeFilesToTmp(args).then(files => w.startDrag({
						files,
						icon: nativeImage.createFromDataURL("data:image/png;base64,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")
					}))
				}
				return Promise.resolve()
			}
			case 'makeMsgFile': {
				return Promise.resolve(uint8ArrayToBase64(makeMsgFile(args[0]).msg()))
			}
			default:
				return Promise.reject(new Error(`Invalid Method invocation: ${method}`))
		}
	}

	sendRequest(windowId: number, type: JsRequestType, args: Array<any>): Promise<Object> {
		return this.initialized(windowId).then(() => {
			const requestId = this._createRequestId();
			const request = {
				id: requestId,
				type: type,
				args: args,
			}
			const w = this._wm.get(windowId)
			if (w) {
				w.sendMessageToWebContents(windowId, request)
			}
			return new Promise((resolve, reject) => {
				this._queue[requestId] = (err, result) => err ? reject(err) : resolve(result)
			})
		})
	}

	_createRequestId(): string {
		if (this._requestId >= Number.MAX_SAFE_INTEGER) {
			this._requestId = 0
		}
		return "desktop" + this._requestId++
	}

	initialized(windowId: number): Promise<void> {
		if (this._initialized[windowId]) {
			return this._initialized[windowId].promise
		} else {
			return Promise.reject(new Error("Tried to call ipc function on nonexistent window"))
		}
	}

	addWindow(id: number) {
		this._initialized[id] = defer()
		this._electron.ipcMain.on(String(id), (ev: Event, msg: string) => {
			const request = JSON.parse(msg)
			if (request.type === "response") {
				this._queue[request.id](null, request.value);
			} else if (request.type === "requestError") {
				this._queue[request.id](objToError((request: any).error), null)
				delete this._queue[request.id]
			} else {
				const w = this._wm.get(id)
				this._invokeMethod(id, request.type, request.args)
				    .then(result => {
					    const response = {
						    id: request.id,
						    type: "response",
						    value: result,
					    }
					    if (w) w.sendMessageToWebContents(id, response)
				    })
				    .catch((e) => {
					    const response = {
						    id: request.id,
						    type: "requestError",
						    error: errorToObj(e),
					    }
					    if (w) w.sendMessageToWebContents(id, response)
				    })
			}
		})

		const sseValueListener = (value: ?SseInfo) => {
			if (value && value.userIds.length === 0) {
				log.debug("invalidating alarms for window", id)
				this.sendRequest(id, "invalidateAlarms", [])
				    .catch((e) => {
					    log.debug("Could not invalidate alarms for window ", id, e)
					    this._conf.removeListener(DesktopConfigKey.pushIdentifier, sseValueListener)
				    })
			}
		}
		this._conf.on(DesktopConfigKey.pushIdentifier, sseValueListener, true)
	}

	removeWindow(id: number) {
		this._electron.ipcMain.removeAllListeners(`${id}`)
		delete this._initialized[id]
	}
}
